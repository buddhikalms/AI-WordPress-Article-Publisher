<?php

if (!defined('ABSPATH')) {
	exit;
}

final class AIA_MCP_Auth
{
	const OPTION_KEY = 'aia_mcp_settings';
	const LOG_OPTION_KEY = 'aia_mcp_logs';
	const CLIENTS_OPTION_KEY = 'aia_mcp_clients';
	const RATE_OPTION_KEY = 'aia_mcp_rate';

	public function get_settings()
	{
		$admins = get_users(array('role__in' => array('administrator'), 'number' => 1, 'fields' => array('ID')));
		$default_author = !empty($admins[0]->ID) ? (int) $admins[0]->ID : get_current_user_id();
		$defaults = array(
			'enabled' => false,
			'secret_token' => '',
			'allowed_roles' => array('administrator', 'editor'),
			'default_post_status' => 'draft',
			'default_author' => $default_author,
			'default_category' => 0,
			'media_uploads_enabled' => true,
			'seo_fields_enabled' => true,
			'connection_revoked' => false,
			'connection_approved' => false,
			'last_regenerated' => '',
		);
		$stored = get_option(self::OPTION_KEY, array());
		if (!is_array($stored)) {
			$stored = array();
		}
		$settings = wp_parse_args($stored, $defaults);
		if (empty($settings['secret_token'])) {
			$settings['secret_token'] = $this->generate_token();
			update_option(self::OPTION_KEY, $settings, false);
		}
		return $settings;
	}

	public function save_settings($input)
	{
		$current = $this->get_settings();
		$allowed_roles = isset($input['allowed_roles']) && is_array($input['allowed_roles']) ? array_map('sanitize_key', $input['allowed_roles']) : array();
		$allowed_roles = array_values(array_intersect($allowed_roles, array('administrator', 'editor')));
		if (empty($allowed_roles)) {
			$allowed_roles = array('administrator');
		}

		$settings = array(
			'enabled' => !empty($input['enabled']),
			'secret_token' => isset($current['secret_token']) ? $current['secret_token'] : $this->generate_token(),
			'allowed_roles' => $allowed_roles,
			'default_post_status' => ('publish' === (isset($input['default_post_status']) ? $input['default_post_status'] : 'draft')) ? 'publish' : 'draft',
			'default_author' => isset($input['default_author']) ? (int) $input['default_author'] : (int) $current['default_author'],
			'default_category' => isset($input['default_category']) ? (int) $input['default_category'] : 0,
			'media_uploads_enabled' => !empty($input['media_uploads_enabled']),
			'seo_fields_enabled' => !empty($input['seo_fields_enabled']),
			'connection_revoked' => !empty($current['connection_revoked']),
			'connection_approved' => !empty($current['connection_approved']),
			'last_regenerated' => isset($current['last_regenerated']) ? $current['last_regenerated'] : '',
		);
		update_option(self::OPTION_KEY, $settings, false);
		return $settings;
	}

	public function regenerate_token()
	{
		$settings = $this->get_settings();
		$settings['secret_token'] = $this->generate_token();
		$settings['connection_revoked'] = false;
		$settings['connection_approved'] = false;
		$settings['last_regenerated'] = current_time('mysql');
		update_option(self::OPTION_KEY, $settings, false);
		update_option(self::CLIENTS_OPTION_KEY, array(), false);
		return $settings;
	}

	public function revoke()
	{
		$settings = $this->get_settings();
		$settings['connection_revoked'] = true;
		$settings['connection_approved'] = false;
		update_option(self::OPTION_KEY, $settings, false);
		$this->log('mcp', 'revoke_connection', 'success', 'Claude connection revoked.', 0);
	}

	public function approve()
	{
		$settings = $this->get_settings();
		$settings['connection_approved'] = true;
		$settings['connection_revoked'] = false;
		update_option(self::OPTION_KEY, $settings, false);
		$this->log('mcp', 'approve_connection', 'success', 'Claude connection approved.', 0);
	}

	public function get_endpoint_url()
	{
		$settings = $this->get_settings();
		return add_query_arg('token', rawurlencode($settings['secret_token']), rest_url('aia-mcp/v1/mcp'));
	}

	public function authenticate(WP_REST_Request $request)
	{
		$settings = $this->get_settings();
		if (empty($settings['enabled'])) {
			return new WP_Error('aia_mcp_disabled', 'MCP Server is disabled.', array('status' => 403));
		}
		if (!empty($settings['connection_revoked'])) {
			return new WP_Error('aia_mcp_revoked', 'Claude connection has been revoked.', array('status' => 403));
		}

		$token = $request->get_param('token');
		$authorization = (string) $request->get_header('authorization');
		if (!$token && preg_match('/Bearer\s+(.+)/i', $authorization, $matches)) {
			$token = trim($matches[1]);
		}
		if (!$token || !hash_equals((string) $settings['secret_token'], (string) $token)) {
			return new WP_Error('aia_mcp_unauthorized', 'Invalid MCP token.', array('status' => 401));
		}
		$this->track_client($request);
		if (empty($settings['connection_approved'])) {
			return new WP_Error('aia_mcp_pending_approval', 'MCP connection is pending WordPress admin approval.', array('status' => 403));
		}
		if (!$this->check_rate_limit($request)) {
			return new WP_Error('aia_mcp_rate_limited', 'MCP rate limit exceeded. Try again shortly.', array('status' => 429));
		}
		if (!$this->author_can_publish($settings)) {
			return new WP_Error('aia_mcp_forbidden_author', 'Default MCP author does not have publish_posts capability.', array('status' => 403));
		}
		return true;
	}

	public function author_can_publish($settings = null)
	{
		$settings = $settings ? $settings : $this->get_settings();
		$user = get_user_by('id', (int) $settings['default_author']);
		if (!$user) {
			return false;
		}
		$roles = is_array($settings['allowed_roles']) ? $settings['allowed_roles'] : array('administrator');
		if (empty(array_intersect($roles, (array) $user->roles))) {
			return false;
		}
		return user_can($user, 'publish_posts');
	}

	public function get_clients()
	{
		$clients = get_option(self::CLIENTS_OPTION_KEY, array());
		return is_array($clients) ? $clients : array();
	}

	public function get_logs()
	{
		$logs = get_option(self::LOG_OPTION_KEY, array());
		return is_array($logs) ? array_slice($logs, 0, 100) : array();
	}

	public function log($provider, $action, $status, $message = '', $post_id = 0)
	{
		$logs = $this->get_logs();
		array_unshift(
			$logs,
			array(
				'date' => current_time('mysql'),
				'provider' => sanitize_text_field($provider),
				'action' => sanitize_text_field($action),
				'status' => sanitize_text_field($status),
				'message' => sanitize_text_field($message),
				'post_id' => (int) $post_id,
			)
		);
		update_option(self::LOG_OPTION_KEY, array_slice($logs, 0, 200), false);
	}

	private function generate_token()
	{
		return wp_generate_password(48, false, false);
	}

	private function check_rate_limit(WP_REST_Request $request)
	{
		$key = md5($request->get_header('user_agent') . '|' . $this->get_ip());
		$rates = get_option(self::RATE_OPTION_KEY, array());
		$now = time();
		if (!is_array($rates)) {
			$rates = array();
		}
		$bucket = isset($rates[$key]) && is_array($rates[$key]) ? $rates[$key] : array('start' => $now, 'count' => 0);
		if (($now - (int) $bucket['start']) > 60) {
			$bucket = array('start' => $now, 'count' => 0);
		}
		$bucket['count']++;
		$rates[$key] = $bucket;
		update_option(self::RATE_OPTION_KEY, $rates, false);
		return $bucket['count'] <= 60;
	}

	private function track_client(WP_REST_Request $request)
	{
		$key = md5($request->get_header('user_agent') . '|' . $this->get_ip());
		$clients = $this->get_clients();
		$clients[$key] = array(
			'id' => $key,
			'user_agent' => sanitize_text_field((string) $request->get_header('user_agent')),
			'ip' => sanitize_text_field($this->get_ip()),
			'last_seen' => current_time('mysql'),
			'status' => 'connected',
		);
		update_option(self::CLIENTS_OPTION_KEY, array_slice($clients, -20, null, true), false);
	}

	private function get_ip()
	{
		return isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : '';
	}
}
