<?php

if (!defined('ABSPATH')) {
	exit;
}

final class AIA_MCP_Admin_UI
{
	const PAGE_SLUG = 'ai-article-publisher-mcp';
	const SAVE_ACTION = 'aia_mcp_save_settings';
	const RESET_ACTION = 'aia_mcp_reset_token';
	const REVOKE_ACTION = 'aia_mcp_revoke_connection';
	const APPROVE_ACTION = 'aia_mcp_approve_connection';

	/** @var AIA_MCP_Auth */
	private $auth;

	public function __construct(AIA_MCP_Auth $auth)
	{
		$this->auth = $auth;
	}

	public function register_menu()
	{
		add_submenu_page(
			AI_Article_Publisher::PAGE_SLUG,
			__('MCP Server', 'ai-article-publisher'),
			__('MCP Server', 'ai-article-publisher'),
			'manage_options',
			self::PAGE_SLUG,
			array($this, 'render')
		);
	}

	public function register_actions()
	{
		add_action('admin_post_' . self::SAVE_ACTION, array($this, 'handle_save'));
		add_action('admin_post_' . self::RESET_ACTION, array($this, 'handle_reset'));
		add_action('admin_post_' . self::REVOKE_ACTION, array($this, 'handle_revoke'));
		add_action('admin_post_' . self::APPROVE_ACTION, array($this, 'handle_approve'));
	}

	public function render()
	{
		if (!current_user_can('manage_options')) {
			wp_die(esc_html__('You do not have permission to access this page.', 'ai-article-publisher'));
		}
		$settings = $this->auth->get_settings();
		$endpoint = $this->auth->get_endpoint_url();
		$clients = $this->auth->get_clients();
		$logs = $this->auth->get_logs();
		$authors = get_users(array('role__in' => array('administrator', 'editor'), 'fields' => array('ID', 'display_name', 'user_login')));
		$categories = get_categories(array('hide_empty' => false));
		$status_label = empty($settings['enabled']) ? __('Disabled', 'ai-article-publisher') : (!empty($settings['connection_revoked']) ? __('Revoked', 'ai-article-publisher') : (!empty($settings['connection_approved']) || !empty($clients) ? __('Connected', 'ai-article-publisher') : __('Ready', 'ai-article-publisher')));
		?>
		<div class="wrap aia-wrap aia-mcp-wrap">
			<section class="aia-page-header">
				<div>
					<span class="aia-kicker aia-kicker--dark"><?php esc_html_e('Claude Desktop MCP', 'ai-article-publisher'); ?></span>
					<h1><?php esc_html_e('MCP Server Dashboard', 'ai-article-publisher'); ?></h1>
					<p class="aia-page-header__description"><?php esc_html_e('Connect Claude Desktop to this WordPress site through a secure token-protected MCP endpoint.', 'ai-article-publisher'); ?></p>
				</div>
				<div class="aia-page-header__meta">
					<span class="aia-pill"><?php echo esc_html($status_label); ?></span>
					<span class="aia-pill aia-pill--subtle"><?php echo esc_html(sprintf(_n('%d client', '%d clients', count($clients), 'ai-article-publisher'), count($clients))); ?></span>
				</div>
			</section>

			<div id="aia-status" class="aia-status" hidden role="status" aria-live="polite"></div>

			<section class="aia-hero aia-mcp-hero">
				<div class="aia-hero__content">
					<span class="aia-kicker"><?php esc_html_e('Secure WordPress Connector', 'ai-article-publisher'); ?></span>
					<h2><?php esc_html_e('Let Claude create drafts, publish posts, upload images, and set SEO metadata.', 'ai-article-publisher'); ?></h2>
					<p class="aia-subtitle"><?php esc_html_e('The endpoint uses a secret token, WordPress REST routes, role restrictions, rate limiting, and full activity logs.', 'ai-article-publisher'); ?></p>
				</div>
				<div class="aia-hero__metrics">
					<div class="aia-metric <?php echo !empty($settings['enabled']) ? 'is-ready' : ''; ?>">
						<span class="aia-metric__label"><?php esc_html_e('MCP Status', 'ai-article-publisher'); ?></span>
						<strong class="aia-metric__value"><?php echo esc_html($status_label); ?></strong>
					</div>
					<div class="aia-metric <?php echo $this->auth->author_can_publish($settings) ? 'is-ready' : ''; ?>">
						<span class="aia-metric__label"><?php esc_html_e('Publish Author', 'ai-article-publisher'); ?></span>
						<strong class="aia-metric__value"><?php echo $this->auth->author_can_publish($settings) ? esc_html__('Allowed', 'ai-article-publisher') : esc_html__('Needs capability', 'ai-article-publisher'); ?></strong>
					</div>
				</div>
			</section>

			<div class="aia-layout">
				<div class="aia-main">
					<section class="aia-card">
						<div class="aia-card__header">
							<div>
								<h2><?php esc_html_e('MCP URL', 'ai-article-publisher'); ?></h2>
								<p><?php esc_html_e('Copy this URL into Claude Desktop as a custom connector.', 'ai-article-publisher'); ?></p>
							</div>
							<button type="button" class="button" id="aia-copy-mcp-url"><?php esc_html_e('Copy URL', 'ai-article-publisher'); ?></button>
						</div>
						<label class="aia-field aia-field--full">
							<span><?php esc_html_e('Secure MCP Endpoint', 'ai-article-publisher'); ?></span>
							<input type="text" id="aia-mcp-url" readonly value="<?php echo esc_attr($endpoint); ?>" />
						</label>
						<div class="aia-actions">
							<button type="button" class="button button-primary" id="aia-test-mcp-connection"><?php esc_html_e('Test Connection', 'ai-article-publisher'); ?></button>
							<?php $this->action_button(self::RESET_ACTION, __('Reset Token', 'ai-article-publisher'), 'button'); ?>
							<?php $this->action_button(self::REVOKE_ACTION, __('Revoke Claude Connection', 'ai-article-publisher'), 'button button-secondary'); ?>
							<?php $this->action_button(self::APPROVE_ACTION, __('Approve Connection', 'ai-article-publisher'), 'button'); ?>
						</div>
					</section>

					<section class="aia-card">
						<div class="aia-card__header">
							<h2><?php esc_html_e('Publishing Permissions', 'ai-article-publisher'); ?></h2>
						</div>
						<form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" class="aia-settings-grid">
							<input type="hidden" name="action" value="<?php echo esc_attr(self::SAVE_ACTION); ?>" />
							<?php wp_nonce_field(self::SAVE_ACTION); ?>
							<label class="aia-checkbox aia-checkbox--inline"><input type="checkbox" name="settings[enabled]" value="1" <?php checked(!empty($settings['enabled'])); ?> /> <span><?php esc_html_e('Enable MCP Server', 'ai-article-publisher'); ?></span></label>
							<label class="aia-checkbox aia-checkbox--inline"><input type="checkbox" name="settings[media_uploads_enabled]" value="1" <?php checked(!empty($settings['media_uploads_enabled'])); ?> /> <span><?php esc_html_e('Enable media uploads', 'ai-article-publisher'); ?></span></label>
							<label class="aia-checkbox aia-checkbox--inline"><input type="checkbox" name="settings[seo_fields_enabled]" value="1" <?php checked(!empty($settings['seo_fields_enabled'])); ?> /> <span><?php esc_html_e('Enable SEO fields', 'ai-article-publisher'); ?></span></label>
							<label class="aia-field">
								<span><?php esc_html_e('Allowed User Roles', 'ai-article-publisher'); ?></span>
								<select name="settings[allowed_roles][]" multiple>
									<option value="administrator" <?php selected(in_array('administrator', (array) $settings['allowed_roles'], true)); ?>><?php esc_html_e('Administrator', 'ai-article-publisher'); ?></option>
									<option value="editor" <?php selected(in_array('editor', (array) $settings['allowed_roles'], true)); ?>><?php esc_html_e('Editor', 'ai-article-publisher'); ?></option>
								</select>
							</label>
							<label class="aia-field">
								<span><?php esc_html_e('Default Post Status', 'ai-article-publisher'); ?></span>
								<select name="settings[default_post_status]">
									<option value="draft" <?php selected($settings['default_post_status'], 'draft'); ?>><?php esc_html_e('Draft', 'ai-article-publisher'); ?></option>
									<option value="publish" <?php selected($settings['default_post_status'], 'publish'); ?>><?php esc_html_e('Publish', 'ai-article-publisher'); ?></option>
								</select>
							</label>
							<label class="aia-field">
								<span><?php esc_html_e('Default Author', 'ai-article-publisher'); ?></span>
								<select name="settings[default_author]">
									<?php foreach ($authors as $author) : ?>
										<option value="<?php echo esc_attr((string) $author->ID); ?>" <?php selected((int) $settings['default_author'], (int) $author->ID); ?>><?php echo esc_html($author->display_name . ' (' . $author->user_login . ')'); ?></option>
									<?php endforeach; ?>
								</select>
							</label>
							<label class="aia-field">
								<span><?php esc_html_e('Default Category', 'ai-article-publisher'); ?></span>
								<select name="settings[default_category]">
									<option value="0"><?php esc_html_e('None', 'ai-article-publisher'); ?></option>
									<?php foreach ($categories as $category) : ?>
										<option value="<?php echo esc_attr((string) $category->term_id); ?>" <?php selected((int) $settings['default_category'], (int) $category->term_id); ?>><?php echo esc_html($category->name); ?></option>
									<?php endforeach; ?>
								</select>
							</label>
							<div class="aia-settings-actions"><button type="submit" class="button button-primary"><?php esc_html_e('Save MCP Settings', 'ai-article-publisher'); ?></button></div>
						</form>
					</section>

					<section class="aia-card">
						<div class="aia-card__header"><h2><?php esc_html_e('Activity Logs', 'ai-article-publisher'); ?></h2></div>
						<?php $this->render_logs($logs); ?>
					</section>
				</div>

				<aside class="aia-sidebar">
					<div class="aia-sidebar__stack">
						<section class="aia-card">
							<div class="aia-card__header"><h2><?php esc_html_e('Claude Desktop Setup', 'ai-article-publisher'); ?></h2></div>
							<ol class="aia-doc-steps">
								<li><?php esc_html_e('Download Claude Desktop.', 'ai-article-publisher'); ?></li>
								<li><?php esc_html_e('Open Claude Desktop.', 'ai-article-publisher'); ?></li>
								<li><?php esc_html_e('Go to Settings -> Connectors.', 'ai-article-publisher'); ?></li>
								<li><?php esc_html_e('Add Custom Connector.', 'ai-article-publisher'); ?></li>
								<li><?php esc_html_e('Paste the MCP URL from this plugin.', 'ai-article-publisher'); ?></li>
								<li><?php esc_html_e('Approve connection in WordPress.', 'ai-article-publisher'); ?></li>
								<li><?php esc_html_e('Start prompting Claude to publish posts.', 'ai-article-publisher'); ?></li>
							</ol>
						</section>

						<section class="aia-card">
							<div class="aia-card__header"><h2><?php esc_html_e('Example Prompt', 'ai-article-publisher'); ?></h2></div>
							<pre class="aia-result aia-result--light"><?php esc_html_e('Write a 900-word SEO blog post about [topic], save it as draft on this WordPress site, use category [category], tags [tags], add meta description and focus keyword.', 'ai-article-publisher'); ?></pre>
						</section>

						<section class="aia-card">
							<div class="aia-card__header"><h2><?php esc_html_e('Connected Clients', 'ai-article-publisher'); ?></h2></div>
							<?php if (empty($clients)) : ?>
								<div class="aia-empty-state"><p><?php esc_html_e('No clients connected yet.', 'ai-article-publisher'); ?></p></div>
							<?php else : ?>
								<ul class="aia-tip-list">
									<?php foreach ($clients as $client) : ?>
										<li><strong><?php echo esc_html(isset($client['last_seen']) ? $client['last_seen'] : ''); ?></strong><br /><?php echo esc_html(isset($client['user_agent']) ? $client['user_agent'] : 'Claude Desktop'); ?></li>
									<?php endforeach; ?>
								</ul>
							<?php endif; ?>
						</section>
					</div>
				</aside>
			</div>
		</div>
		<?php
	}

	public function handle_save()
	{
		$this->guard(self::SAVE_ACTION);
		$raw = isset($_POST['settings']) ? wp_unslash($_POST['settings']) : array();
		$this->auth->save_settings(is_array($raw) ? $raw : array());
		$this->redirect('settings-updated');
	}

	public function handle_reset()
	{
		$this->guard(self::RESET_ACTION);
		$this->auth->regenerate_token();
		$this->redirect('token-reset');
	}

	public function handle_revoke()
	{
		$this->guard(self::REVOKE_ACTION);
		$this->auth->revoke();
		$this->redirect('connection-revoked');
	}

	public function handle_approve()
	{
		$this->guard(self::APPROVE_ACTION);
		$this->auth->approve();
		$this->redirect('connection-approved');
	}

	private function action_button($action, $label, $class)
	{
		?>
		<form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" class="aia-inline-form">
			<input type="hidden" name="action" value="<?php echo esc_attr($action); ?>" />
			<?php wp_nonce_field($action); ?>
			<button type="submit" class="<?php echo esc_attr($class); ?>"><?php echo esc_html($label); ?></button>
		</form>
		<?php
	}

	private function render_logs($logs)
	{
		?>
		<div class="aia-log-table-wrap">
			<table class="widefat striped aia-log-table">
				<thead><tr><th><?php esc_html_e('Date/time', 'ai-article-publisher'); ?></th><th><?php esc_html_e('Provider', 'ai-article-publisher'); ?></th><th><?php esc_html_e('Action', 'ai-article-publisher'); ?></th><th><?php esc_html_e('Status', 'ai-article-publisher'); ?></th><th><?php esc_html_e('Message', 'ai-article-publisher'); ?></th><th><?php esc_html_e('Post ID', 'ai-article-publisher'); ?></th></tr></thead>
				<tbody>
				<?php if (empty($logs)) : ?>
					<tr><td colspan="6"><?php esc_html_e('No MCP activity logged yet.', 'ai-article-publisher'); ?></td></tr>
				<?php else : ?>
					<?php foreach ($logs as $log) : ?>
						<tr>
							<td><?php echo esc_html(isset($log['date']) ? $log['date'] : ''); ?></td>
							<td><?php echo esc_html(isset($log['provider']) ? $log['provider'] : ''); ?></td>
							<td><?php echo esc_html(isset($log['action']) ? $log['action'] : ''); ?></td>
							<td><?php echo esc_html(isset($log['status']) ? $log['status'] : ''); ?></td>
							<td><?php echo esc_html(isset($log['message']) ? $log['message'] : ''); ?></td>
							<td><?php echo esc_html(!empty($log['post_id']) ? (string) $log['post_id'] : ''); ?></td>
						</tr>
					<?php endforeach; ?>
				<?php endif; ?>
				</tbody>
			</table>
		</div>
		<?php
	}

	private function guard($action)
	{
		if (!current_user_can('manage_options')) {
			wp_die(esc_html__('You do not have permission to update MCP settings.', 'ai-article-publisher'));
		}
		check_admin_referer($action);
	}

	private function redirect($notice)
	{
		wp_safe_redirect(add_query_arg(array('page' => self::PAGE_SLUG, 'mcp-notice' => $notice), admin_url('admin.php')));
		exit;
	}
}
