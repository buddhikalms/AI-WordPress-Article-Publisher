<?php

if (!defined('ABSPATH')) {
	exit;
}

final class AIA_MCP_Server
{
	const REST_NAMESPACE = 'aia-mcp/v1';

	/** @var AIA_MCP_Auth */
	private $auth;

	/** @var AIA_MCP_Tools */
	private $tools;

	public function __construct(AIA_MCP_Auth $auth, AIA_MCP_Tools $tools)
	{
		$this->auth = $auth;
		$this->tools = $tools;
	}

	public function register_routes()
	{
		register_rest_route(
			self::REST_NAMESPACE,
			'/mcp',
			array(
				array(
					'methods' => WP_REST_Server::READABLE,
					'callback' => array($this, 'handle_manifest'),
					'permission_callback' => '__return_true',
				),
				array(
					'methods' => WP_REST_Server::CREATABLE,
					'callback' => array($this, 'handle_json_rpc'),
					'permission_callback' => '__return_true',
				),
			)
		);

		register_rest_route(
			self::REST_NAMESPACE,
			'/approve',
			array(
				'methods' => WP_REST_Server::CREATABLE,
				'callback' => array($this, 'handle_approve'),
				'permission_callback' => function () {
					return current_user_can('manage_options');
				},
			)
		);
	}

	public function handle_manifest(WP_REST_Request $request)
	{
		$auth = $this->auth->authenticate($request);
		if (is_wp_error($auth)) {
			return $auth;
		}
		return rest_ensure_response(
			array(
				'name' => get_bloginfo('name') . ' WordPress MCP Server',
				'version' => AI_Article_Publisher::VERSION,
				'protocolVersion' => '2024-11-05',
				'capabilities' => array('tools' => array('listChanged' => false)),
				'tools' => $this->tools->get_tool_definitions(),
			)
		);
	}

	public function handle_json_rpc(WP_REST_Request $request)
	{
		$auth = $this->auth->authenticate($request);
		if (is_wp_error($auth)) {
			return $auth;
		}

		$body = json_decode((string) $request->get_body(), true);
		if (!is_array($body)) {
			return new WP_Error('aia_mcp_invalid_json', 'Invalid JSON body.', array('status' => 400));
		}

		try {
			$response = $this->dispatch($body);
			return rest_ensure_response($response);
		} catch (Throwable $error) {
			$this->auth->log('Claude Desktop MCP', isset($body['method']) ? $body['method'] : 'unknown', 'error', $error->getMessage(), 0);
			return rest_ensure_response(
				array(
					'jsonrpc' => '2.0',
					'id' => isset($body['id']) ? $body['id'] : null,
					'error' => array(
						'code' => ($error instanceof AI_Article_Publisher_Error) ? (int) $error->status : 500,
						'message' => $error->getMessage(),
						'data' => ($error instanceof AI_Article_Publisher_Error) ? $error->details : null,
					),
				)
			);
		}
	}

	public function handle_approve()
	{
		$this->auth->approve();
		return rest_ensure_response(array('ok' => true));
	}

	private function dispatch($body)
	{
		$method = isset($body['method']) ? (string) $body['method'] : '';
		$params = isset($body['params']) && is_array($body['params']) ? $body['params'] : array();
		$id = isset($body['id']) ? $body['id'] : null;

		if ('initialize' === $method) {
			return $this->rpc_result(
				$id,
				array(
					'protocolVersion' => '2024-11-05',
					'serverInfo' => array('name' => 'AI Article Publisher MCP Server', 'version' => AI_Article_Publisher::VERSION),
					'capabilities' => array('tools' => array('listChanged' => false)),
				)
			);
		}
		if ('tools/list' === $method) {
			return $this->rpc_result($id, array('tools' => $this->tools->get_tool_definitions()));
		}
		if ('tools/call' === $method) {
			$name = isset($params['name']) ? sanitize_key($params['name']) : '';
			$arguments = isset($params['arguments']) && is_array($params['arguments']) ? $params['arguments'] : array();
			$result = $this->tools->call($name, $arguments);
			return $this->rpc_result(
				$id,
				array(
					'content' => array(
						array(
							'type' => 'text',
							'text' => wp_json_encode($result, JSON_PRETTY_PRINT),
						),
					),
					'isError' => false,
				)
			);
		}

		throw new AI_Article_Publisher_Error('Unsupported MCP method.', 400, array('method' => $method));
	}

	private function rpc_result($id, $result)
	{
		return array(
			'jsonrpc' => '2.0',
			'id' => $id,
			'result' => $result,
		);
	}
}
