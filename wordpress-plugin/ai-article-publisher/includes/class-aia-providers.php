<?php

if (!defined('ABSPATH')) {
	exit;
}

/**
 * Provider system for official AI API integrations.
 *
 * ManualClaudeProvider intentionally does not automate Claude Desktop or claude.ai.
 * It only identifies the manual bridge mode used by the admin UI.
 */
abstract class AIA_AI_Provider
{
	/** @var array */
	protected $settings;

	public function __construct($settings)
	{
		$this->settings = is_array($settings) ? $settings : array();
	}

	abstract public function get_id();

	abstract public function get_label();

	abstract public function generate_text($messages, $options = array());

	protected function decode_remote_json($response, $fallback_message)
	{
		if (is_wp_error($response)) {
			throw new AI_Article_Publisher_Error($response->get_error_message(), 502);
		}

		$status_code = (int) wp_remote_retrieve_response_code($response);
		$body = (string) wp_remote_retrieve_body($response);
		$decoded = json_decode($body, true);

		if ($status_code < 200 || $status_code >= 300) {
			$message = $fallback_message;
			if (is_array($decoded) && !empty($decoded['error']['message'])) {
				$message = (string) $decoded['error']['message'];
			} elseif (is_array($decoded) && !empty($decoded['error']['message'][0]['text'])) {
				$message = (string) $decoded['error']['message'][0]['text'];
			} elseif (is_array($decoded) && !empty($decoded['error']['type'])) {
				$message = (string) $decoded['error']['type'];
			}
			throw new AI_Article_Publisher_Error($message, $status_code ? $status_code : 502, $decoded ? $decoded : $body);
		}

		if (!is_array($decoded)) {
			throw new AI_Article_Publisher_Error($fallback_message, 502, $body);
		}

		return $decoded;
	}
}

final class AIA_OpenAI_Provider extends AIA_AI_Provider
{
	public function get_id()
	{
		return 'openai';
	}

	public function get_label()
	{
		return 'OpenAI';
	}

	public function generate_text($messages, $options = array())
	{
		$api_key = trim((string) (isset($this->settings['openai_api_key']) ? $this->settings['openai_api_key'] : ''));
		$model = trim((string) (isset($this->settings['openai_text_model']) ? $this->settings['openai_text_model'] : AI_Article_Publisher::DEFAULT_TEXT_MODEL));
		if (!$api_key) {
			throw new AI_Article_Publisher_Error('OpenAI API key is missing. Save it in Credentials first.', 500);
		}
		if (!$model) {
			$model = AI_Article_Publisher::DEFAULT_TEXT_MODEL;
		}

		try {
			return $this->responses_api_request($api_key, $model, $messages, $options);
		} catch (Throwable $error) {
			return $this->chat_completion_request($api_key, $model, $messages, $options);
		}
	}

	private function responses_api_request($api_key, $model, $messages, $options)
	{
		$payload = array(
			'model' => $model,
			'input' => $messages,
			'temperature' => isset($options['temperature']) ? (float) $options['temperature'] : 0.4,
		);
		if (!empty($options['max_tokens'])) {
			$payload['max_output_tokens'] = (int) $options['max_tokens'];
		}

		$response = wp_remote_post(
			'https://api.openai.com/v1/responses',
			array(
				'timeout' => 120,
				'headers' => array(
					'Authorization' => 'Bearer ' . $api_key,
					'Content-Type' => 'application/json',
				),
				'body' => wp_json_encode($payload),
			)
		);

		$decoded = $this->decode_remote_json($response, 'OpenAI Responses API request failed.');
		if (!empty($decoded['output_text'])) {
			return trim((string) $decoded['output_text']);
		}

		$parts = array();
		if (!empty($decoded['output']) && is_array($decoded['output'])) {
			foreach ($decoded['output'] as $output_item) {
				if (empty($output_item['content']) || !is_array($output_item['content'])) {
					continue;
				}
				foreach ($output_item['content'] as $content_item) {
					if (is_array($content_item) && isset($content_item['text'])) {
						$parts[] = (string) $content_item['text'];
					}
				}
			}
		}

		$content = trim(implode("\n", $parts));
		if (!$content) {
			throw new AI_Article_Publisher_Error('OpenAI returned an empty response.', 502, $decoded);
		}
		return $content;
	}

	private function chat_completion_request($api_key, $model, $messages, $options)
	{
		$payload = array(
			'model' => $model,
			'temperature' => isset($options['temperature']) ? (float) $options['temperature'] : 0.4,
			'messages' => $messages,
		);
		if (!empty($options['max_tokens'])) {
			$payload['max_tokens'] = (int) $options['max_tokens'];
		}

		$response = wp_remote_post(
			'https://api.openai.com/v1/chat/completions',
			array(
				'timeout' => 120,
				'headers' => array(
					'Authorization' => 'Bearer ' . $api_key,
					'Content-Type' => 'application/json',
				),
				'body' => wp_json_encode($payload),
			)
		);

		$decoded = $this->decode_remote_json($response, 'OpenAI chat completion request failed.');
		$content = isset($decoded['choices'][0]['message']['content']) ? $decoded['choices'][0]['message']['content'] : '';
		if (is_array($content)) {
			$parts = array();
			foreach ($content as $item) {
				if (is_array($item) && isset($item['text'])) {
					$parts[] = (string) $item['text'];
				}
			}
			$content = implode("\n", $parts);
		}

		$content = is_string($content) ? trim($content) : '';
		if (!$content) {
			throw new AI_Article_Publisher_Error('OpenAI returned an empty response.', 502, $decoded);
		}
		return $content;
	}
}

final class AIA_Claude_Api_Provider extends AIA_AI_Provider
{
	public function get_id()
	{
		return 'claude_api';
	}

	public function get_label()
	{
		return 'Claude API';
	}

	public function generate_text($messages, $options = array())
	{
		$api_key = trim((string) (isset($this->settings['claude_api_key']) ? $this->settings['claude_api_key'] : ''));
		$model = trim((string) (isset($this->settings['claude_model']) ? $this->settings['claude_model'] : 'claude-3-5-sonnet-latest'));
		if (!$api_key) {
			throw new AI_Article_Publisher_Error('Claude API key is missing. Save it in Credentials first, or use Claude Desktop Mode.', 500);
		}

		$system = '';
		$user_messages = array();
		foreach ($messages as $message) {
			if (!is_array($message) || empty($message['role'])) {
				continue;
			}
			if ('system' === $message['role']) {
				$system .= ($system ? "\n\n" : '') . (string) $message['content'];
				continue;
			}
			$user_messages[] = array(
				'role' => 'assistant' === $message['role'] ? 'assistant' : 'user',
				'content' => (string) $message['content'],
			);
		}

		$response = wp_remote_post(
			'https://api.anthropic.com/v1/messages',
			array(
				'timeout' => 120,
				'headers' => array(
					'x-api-key' => $api_key,
					'anthropic-version' => '2023-06-01',
					'Content-Type' => 'application/json',
				),
				'body' => wp_json_encode(
					array(
						'model' => $model,
						'max_tokens' => !empty($options['max_tokens']) ? (int) $options['max_tokens'] : 4096,
						'system' => $system,
						'messages' => $user_messages,
					)
				),
			)
		);

		$decoded = $this->decode_remote_json($response, 'Claude Messages API request failed.');
		$parts = array();
		if (!empty($decoded['content']) && is_array($decoded['content'])) {
			foreach ($decoded['content'] as $content_item) {
				if (is_array($content_item) && isset($content_item['text'])) {
					$parts[] = (string) $content_item['text'];
				}
			}
		}

		$content = trim(implode("\n", $parts));
		if (!$content) {
			throw new AI_Article_Publisher_Error('Claude returned an empty response.', 502, $decoded);
		}
		return $content;
	}
}

final class AIA_Gemini_Provider extends AIA_AI_Provider
{
	public function get_id()
	{
		return 'gemini';
	}

	public function get_label()
	{
		return 'Gemini';
	}

	public function generate_text($messages, $options = array())
	{
		$api_key = trim((string) (isset($this->settings['gemini_api_key']) ? $this->settings['gemini_api_key'] : ''));
		$model = trim((string) (isset($this->settings['gemini_model']) ? $this->settings['gemini_model'] : AI_Article_Publisher::DEFAULT_GEMINI_MODEL));
		if (!$api_key) {
			throw new AI_Article_Publisher_Error('Gemini API key is missing. Save it in Credentials first.', 500);
		}
		if (!$model) {
			$model = AI_Article_Publisher::DEFAULT_GEMINI_MODEL;
		}

		$system = '';
		$user_parts = array();
		foreach ($messages as $message) {
			if (!is_array($message) || empty($message['role'])) {
				continue;
			}
			if ('system' === $message['role']) {
				$system .= ($system ? "\n\n" : '') . (string) $message['content'];
				continue;
			}
			$user_parts[] = strtoupper((string) $message['role']) . ":\n" . (string) $message['content'];
		}

		$payload = array(
			'systemInstruction' => array(
				'parts' => array(array('text' => $system)),
			),
			'contents' => array(
				array(
					'role' => 'user',
					'parts' => array(array('text' => trim(implode("\n\n", $user_parts)))),
				),
			),
			'generationConfig' => array(
				'temperature' => isset($options['temperature']) ? (float) $options['temperature'] : 0.4,
				'responseMimeType' => 'application/json',
			),
		);
		if (!empty($options['max_tokens'])) {
			$payload['generationConfig']['maxOutputTokens'] = (int) $options['max_tokens'];
		}

		$response = wp_remote_post(
			'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent',
			array(
				'timeout' => 120,
				'headers' => array(
					'x-goog-api-key' => $api_key,
					'Content-Type' => 'application/json',
				),
				'body' => wp_json_encode($payload),
			)
		);

		$decoded = $this->decode_remote_json($response, 'Gemini generateContent request failed.');
		$parts = array();
		if (!empty($decoded['candidates'][0]['content']['parts']) && is_array($decoded['candidates'][0]['content']['parts'])) {
			foreach ($decoded['candidates'][0]['content']['parts'] as $content_item) {
				if (is_array($content_item) && isset($content_item['text'])) {
					$parts[] = (string) $content_item['text'];
				}
			}
		}

		$content = trim(implode("\n", $parts));
		if (!$content) {
			throw new AI_Article_Publisher_Error('Gemini returned an empty response.', 502, $decoded);
		}
		return $content;
	}
}

final class AIA_Manual_Claude_Provider extends AIA_AI_Provider
{
	public function get_id()
	{
		return 'claude_desktop_manual';
	}

	public function get_label()
	{
		return 'Claude Desktop Manual';
	}

	public function generate_text($messages, $options = array())
	{
		throw new AI_Article_Publisher_Error('Claude Desktop manual mode uses copy and paste. Generate a Claude prompt in the Claude Desktop Mode tab.', 400);
	}
}
