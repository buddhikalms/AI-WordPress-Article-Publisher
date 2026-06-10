<?php

/**
 * Plugin Name: AI Article Publisher
 * Description: Generate, import, and publish AI-assisted WordPress posts from the WordPress admin.
 * Version: 0.7.2
 * Author: BUDDHIKA_VIRAJ
 * Requires at least: 6.4
 * Requires PHP: 7.4
 * Text Domain: ai-article-publisher
 */

if (!defined('ABSPATH')) {
	exit;
}

require_once __DIR__ . '/includes/class-aia-error.php';
require_once __DIR__ . '/includes/class-aia-providers.php';
require_once __DIR__ . '/includes/class-seo-meta.php';
require_once __DIR__ . '/includes/class-mcp-auth.php';
require_once __DIR__ . '/includes/class-mcp-tools.php';
require_once __DIR__ . '/includes/class-mcp-server.php';
require_once __DIR__ . '/includes/class-admin-ui.php';
require_once __DIR__ . '/includes/admin/class-aia-admin-screen.php';

final class AI_Article_Publisher
{
	const VERSION = '0.4.0';
	const OPTION_KEY = 'aia_publisher_settings';
	const PAGE_SLUG = 'ai-article-publisher';
	const NONCE_ACTION = 'aia_publisher_admin';
	const SAVE_SETTINGS_ACTION = 'aia_save_settings';
	const DEFAULT_TEXT_MODEL = 'gpt-4.1-mini';
	const IMAGE_MODEL = 'gpt-image-1';
	const DEFAULT_CLAUDE_MODEL = 'claude-3-5-sonnet-latest';
	const LOG_OPTION_KEY = 'aia_publisher_logs';

	/** @var AIA_Admin_Screen */
	private $admin_screen;

	/** @var AIA_MCP_Admin_UI */
	private $mcp_admin_ui;

	/** @var AIA_MCP_Server */
	private $mcp_server;

	public function __construct()
	{
		$this->admin_screen = new AIA_Admin_Screen($this);
		$mcp_auth = new AIA_MCP_Auth();
		$mcp_seo = new AIA_SEO_Meta();
		$mcp_tools = new AIA_MCP_Tools($mcp_auth, $mcp_seo);
		$this->mcp_server = new AIA_MCP_Server($mcp_auth, $mcp_tools);
		$this->mcp_admin_ui = new AIA_MCP_Admin_UI($mcp_auth);

		add_action('admin_menu', array($this->admin_screen, 'register_menu'));
		add_action('admin_menu', array($this->mcp_admin_ui, 'register_menu'));
		add_action('admin_enqueue_scripts', array($this->admin_screen, 'enqueue_assets'));
		add_action('rest_api_init', array($mcp_seo, 'register_rest_fields'));
		add_action('rest_api_init', array($this->mcp_server, 'register_routes'));
		$this->mcp_admin_ui->register_actions();
		add_action('admin_post_' . self::SAVE_SETTINGS_ACTION, array($this->admin_screen, 'handle_save_settings'));
		add_action('wp_ajax_aia_generate_article', array($this, 'ajax_generate_article'));
		add_action('wp_ajax_aia_generate_image', array($this, 'ajax_generate_image'));
		add_action('wp_ajax_aia_publish_post', array($this, 'ajax_publish_post'));
		add_action('wp_ajax_aia_import_google_doc', array($this, 'ajax_import_google_doc'));
		add_action('wp_ajax_aia_news_autopilot', array($this, 'ajax_news_autopilot'));
		add_action('wp_ajax_aia_generate_claude_prompt', array($this, 'ajax_generate_claude_prompt'));
		add_action('wp_ajax_aia_validate_claude_json', array($this, 'ajax_validate_claude_json'));
		add_action('wp_ajax_aia_ai_tool', array($this, 'ajax_ai_tool'));
	}

	public function get_settings()
	{
		$defaults = array(
			'default_provider' => 'openai',
			'openai_api_key' => '',
			'openai_text_model' => self::DEFAULT_TEXT_MODEL,
			'openai_image_model' => self::IMAGE_MODEL,
			'claude_api_key' => '',
			'claude_model' => self::DEFAULT_CLAUDE_MODEL,
			'provider_fallback_order' => 'openai,claude_api',
			'temperature' => '0.4',
			'max_tokens' => '4096',
			'newsdata_api_key' => '',
			'default_tone' => 'Professional',
		);
		$stored = get_option(self::OPTION_KEY, array());
		if (!is_array($stored)) {
			$stored = array();
		}
		return wp_parse_args($stored, $defaults);
	}

	public function sanitize_settings($settings)
	{
		$default_tone = isset($settings['default_tone']) ? sanitize_text_field($settings['default_tone']) : 'Professional';
		if (!in_array($default_tone, $this->get_tone_options(), true)) {
			$default_tone = 'Professional';
		}
		$default_provider = isset($settings['default_provider']) ? sanitize_key($settings['default_provider']) : 'openai';
		if (!in_array($default_provider, $this->get_provider_ids(), true)) {
			$default_provider = 'openai';
		}
		$temperature = isset($settings['temperature']) ? (float) $settings['temperature'] : 0.4;
		$temperature = min(max($temperature, 0), 2);
		$max_tokens = isset($settings['max_tokens']) ? (int) $settings['max_tokens'] : 4096;
		$max_tokens = min(max($max_tokens, 512), 20000);

		return array(
			'default_provider' => $default_provider,
			'openai_api_key' => isset($settings['openai_api_key']) ? trim((string) $settings['openai_api_key']) : '',
			'openai_text_model' => isset($settings['openai_text_model']) ? sanitize_text_field($settings['openai_text_model']) : self::DEFAULT_TEXT_MODEL,
			'openai_image_model' => isset($settings['openai_image_model']) ? sanitize_text_field($settings['openai_image_model']) : self::IMAGE_MODEL,
			'claude_api_key' => isset($settings['claude_api_key']) ? trim((string) $settings['claude_api_key']) : '',
			'claude_model' => isset($settings['claude_model']) ? sanitize_text_field($settings['claude_model']) : self::DEFAULT_CLAUDE_MODEL,
			'provider_fallback_order' => isset($settings['provider_fallback_order']) ? $this->sanitize_provider_order($settings['provider_fallback_order']) : 'openai,claude_api',
			'temperature' => (string) $temperature,
			'max_tokens' => (string) $max_tokens,
			'newsdata_api_key' => isset($settings['newsdata_api_key']) ? trim((string) $settings['newsdata_api_key']) : '',
			'default_tone' => $default_tone,
		);
	}

	public function get_provider_ids()
	{
		return array('openai', 'claude_api', 'claude_desktop_manual');
	}

	public function get_recent_logs()
	{
		$logs = get_option(self::LOG_OPTION_KEY, array());
		return is_array($logs) ? array_slice($logs, 0, 30) : array();
	}

	public function get_tone_options()
	{
		return array('Professional', 'Conversational', 'Authoritative', 'Friendly', 'Technical');
	}

	public function get_news_categories()
	{
		return array(
			'business',
			'entertainment',
			'environment',
			'food',
			'health',
			'politics',
			'science',
			'sports',
			'technology',
			'top',
			'tourism',
			'world',
		);
	}

	public function ajax_generate_article()
	{
		$this->guard_ajax('edit_posts');

		try {
			$payload = $this->read_payload();
			$input = $this->sanitize_generate_article_input($payload);
			$generated = $this->generate_article_draft($input);
			wp_send_json_success($generated);
		} catch (Throwable $error) {
			$this->send_exception($error);
		}
	}

	public function ajax_generate_image()
	{
		$this->guard_ajax('edit_posts');

		try {
			$payload = $this->read_payload();
			$title = $this->require_text(isset($payload['title']) ? $payload['title'] : '', 'Title is required.', 3);
			$brief = $this->require_text(isset($payload['brief']) ? $payload['brief'] : '', 'Brief is required.', 10);
			wp_send_json_success($this->generate_featured_image(array('title' => $title, 'brief' => $brief)));
		} catch (Throwable $error) {
			$this->send_exception($error);
		}
	}

	public function ajax_generate_claude_prompt()
	{
		$this->guard_ajax('edit_posts');

		try {
			$payload = $this->read_payload();
			$input = $this->sanitize_manual_claude_input($payload);
			$prompt = $this->build_claude_desktop_prompt($input);
			$this->add_log('Claude Desktop Manual', 'generate_claude_prompt', 'success', '', 0);
			wp_send_json_success(array('prompt' => $prompt));
		} catch (Throwable $error) {
			$this->send_exception($error);
		}
	}

	public function ajax_validate_claude_json()
	{
		$this->guard_ajax('edit_posts');

		try {
			$payload = $this->read_payload();
			$json = isset($payload['json']) ? (string) $payload['json'] : '';
			$links = $this->sanitize_manual_links_from_payload($payload);
			$parsed = $this->parse_json_from_model($json);
			$article = $this->sanitize_generated_article_payload(
				$parsed,
				isset($payload['title']) ? $this->sanitize_text($payload['title']) : 'Claude article',
				isset($payload['keyword']) ? $this->sanitize_text($payload['keyword']) : ''
			);
			$article['html'] = wp_kses_post($article['html']);
			$article['validation'] = $this->validate_article_payload($article['html'], $article['meta'], $links);
			$this->add_log('Claude Desktop Manual', 'validate_claude_json', 'success', '', 0);
			wp_send_json_success($article);
		} catch (Throwable $error) {
			$this->add_log('Claude Desktop Manual', 'validate_claude_json', 'error', $error->getMessage(), 0);
			$this->send_exception($error);
		}
	}

	public function ajax_ai_tool()
	{
		$this->guard_ajax('edit_posts');

		try {
			$payload = $this->read_payload();
			$tool = sanitize_key(isset($payload['tool']) ? $payload['tool'] : '');
			$title = $this->sanitize_text(isset($payload['title']) ? $payload['title'] : '');
			$brief = $this->sanitize_text(isset($payload['brief']) ? $payload['brief'] : '');
			$html = wp_kses_post(isset($payload['html']) ? (string) $payload['html'] : '');
			$focus_keyword = $this->sanitize_text(isset($payload['focusKeyword']) ? $payload['focusKeyword'] : '');
			$prompt = $this->build_article_tool_prompt($tool, $title, $brief, $html, $focus_keyword);
			$result = $this->ai_text_completion(
				array(
					array('role' => 'system', 'content' => 'You are a senior WordPress SEO editor. Return only the requested content with no preamble.'),
					array('role' => 'user', 'content' => $prompt),
				),
				array('temperature' => 0.35, 'action' => 'tool_' . $tool)
			);
			wp_send_json_success(array('tool' => $tool, 'provider' => $result['providerLabel'], 'content' => trim($result['content'])));
		} catch (Throwable $error) {
			$this->send_exception($error);
		}
	}

	private function guard_ajax($capability)
	{
		check_ajax_referer(self::NONCE_ACTION, 'nonce');

		if (!current_user_can($capability)) {
			wp_send_json_error(array('message' => __('You do not have permission to perform this action.', 'ai-article-publisher')), 403);
		}
	}

	private function read_payload()
	{
		$payload = isset($_POST['payload']) ? wp_unslash($_POST['payload']) : '';
		$decoded = json_decode((string) $payload, true);
		if (!is_array($decoded)) {
			throw new AI_Article_Publisher_Error('Invalid request payload.', 400);
		}
		return $decoded;
	}

	private function send_exception(Throwable $error)
	{
		$formatted = $this->format_error($error);
		wp_send_json_error($formatted, isset($formatted['status']) ? (int) $formatted['status'] : 500);
	}

	private function format_error(Throwable $error)
	{
		if ($error instanceof AI_Article_Publisher_Error) {
			return array(
				'message' => $error->getMessage(),
				'status' => $error->status,
				'details' => $error->details,
			);
		}

		return array(
			'message' => $error->getMessage(),
			'status' => 500,
		);
	}

	private function sanitize_generate_article_input($payload)
	{
		$title = $this->require_text(isset($payload['title']) ? $payload['title'] : '', 'Title is required.', 3);
		$brief = $this->require_text(isset($payload['brief']) ? $payload['brief'] : '', 'Topic brief is required.', 10);
		$focus_keyword = $this->sanitize_text(isset($payload['focusKeyword']) ? $payload['focusKeyword'] : '');
		if (!$focus_keyword) {
			$focus_keyword = $this->derive_focus_keyword($title);
		}
		$tone = $this->require_text(isset($payload['tone']) ? $payload['tone'] : '', 'Tone is required.', 1);
		$word_count = $this->sanitize_int(isset($payload['wordCount']) ? $payload['wordCount'] : 1200, 300, 5000);
		$keywords = $this->sanitize_csv_strings(isset($payload['keywords']) ? $payload['keywords'] : '');
		$links = array();

		if (isset($payload['links']) && is_array($payload['links'])) {
			foreach ($payload['links'] as $link) {
				if (!is_array($link)) {
					continue;
				}
				$url = $this->sanitize_text(isset($link['url']) ? $link['url'] : '');
				$anchor_text = $this->sanitize_text(isset($link['anchorText']) ? $link['anchorText'] : '');
				if (!$url && !$anchor_text) {
					continue;
				}
				if (!$url || !$anchor_text) {
					throw new AI_Article_Publisher_Error('Each hyperlink row must include both URL and anchor text.', 400);
				}
				if (!filter_var($url, FILTER_VALIDATE_URL)) {
					throw new AI_Article_Publisher_Error('Each hyperlink URL must be valid.', 400, array('url' => $url));
				}

				$links[] = array(
					'url' => $url,
					'anchorText' => $anchor_text,
					'required' => !empty($link['required']),
					'followType' => ('nofollow' === (isset($link['followType']) ? $link['followType'] : 'dofollow')) ? 'nofollow' : 'dofollow',
				);
			}
		}

		return array(
			'title' => $title,
			'brief' => $brief,
			'keywords' => $keywords,
			'focusKeyword' => $focus_keyword,
			'tone' => $tone,
			'wordCount' => $word_count,
			'links' => $links,
		);
	}

	private function sanitize_manual_claude_input($payload)
	{
		return array(
			'title' => $this->require_text(isset($payload['title']) ? $payload['title'] : '', 'Title is required.', 3),
			'keyword' => $this->sanitize_text(isset($payload['keyword']) ? $payload['keyword'] : ''),
			'tone' => $this->sanitize_text(isset($payload['tone']) ? $payload['tone'] : 'Professional'),
			'articleType' => $this->sanitize_text(isset($payload['articleType']) ? $payload['articleType'] : 'SEO article'),
			'country' => $this->sanitize_text(isset($payload['country']) ? $payload['country'] : ''),
			'audience' => $this->sanitize_text(isset($payload['audience']) ? $payload['audience'] : ''),
			'wordCount' => $this->sanitize_int(isset($payload['wordCount']) ? $payload['wordCount'] : 1200, 300, 5000),
			'requiredLinks' => $this->sanitize_csv_strings(isset($payload['requiredLinks']) ? $payload['requiredLinks'] : ''),
			'optionalLinks' => $this->sanitize_csv_strings(isset($payload['optionalLinks']) ? $payload['optionalLinks'] : ''),
			'seoInstructions' => $this->sanitize_text(isset($payload['seoInstructions']) ? $payload['seoInstructions'] : ''),
		);
	}

	private function sanitize_manual_links_from_payload($payload)
	{
		$input = array(
			'links' => array(),
			'title' => isset($payload['title']) ? $payload['title'] : 'Manual article',
			'brief' => 'Manual Claude validation',
			'focusKeyword' => isset($payload['keyword']) ? $payload['keyword'] : '',
			'tone' => 'Professional',
			'wordCount' => 1200,
			'keywords' => array(),
		);
		if (!empty($payload['links']) && is_array($payload['links'])) {
			$input['links'] = $payload['links'];
			return $this->sanitize_generate_article_input($input)['links'];
		}

		$links = array();
		foreach (array('requiredLinks' => true, 'optionalLinks' => false) as $key => $required) {
			foreach ($this->sanitize_csv_strings(isset($payload[$key]) ? $payload[$key] : '') as $link_value) {
				if (!filter_var($link_value, FILTER_VALIDATE_URL)) {
					continue;
				}
				$links[] = array(
					'url' => $link_value,
					'anchorText' => $link_value,
					'required' => $required,
					'followType' => 'dofollow',
				);
			}
		}
		return $links;
	}

	private function build_claude_desktop_prompt($input)
	{
		return implode(
			"\n",
			array(
				'You are a senior SEO editor creating a WordPress-ready article.',
				'Return ONLY valid JSON. Do not include markdown fences, explanations, comments, or text outside the JSON.',
				'Use this exact JSON shape:',
				'{',
				'  "html": "...",',
				'  "meta": {',
				'    "title": "...",',
				'    "excerpt": "...",',
				'    "suggestedTags": [],',
				'    "seo": {',
				'      "seoTitle": "...",',
				'      "metaDescription": "...",',
				'      "focusKeyword": "...",',
				'      "additionalKeywords": [],',
				'      "canonicalUrl": "",',
				'      "og": { "title": "", "description": "", "imageUrl": "" },',
				'      "twitter": { "title": "", "description": "", "imageUrl": "" }',
				'    }',
				'  }',
				'}',
				'',
				'Article requirements:',
				'- html must be valid WordPress-ready HTML only.',
				'- Use h2/h3 headings, short paragraphs, useful examples, a conclusion, and an FAQ section.',
				'- Keep the voice natural and professional. Avoid generic AI filler and keyword stuffing.',
				'- Include every required link exactly once. Use the URL exactly as provided.',
				'- Optional links may be included only when natural.',
				'- Create keyword suggestions inside meta.seo.additionalKeywords.',
				'- Keep seoTitle near 50-60 characters and metaDescription near 140-155 characters when possible.',
				'',
				'Title: ' . $input['title'],
				'Focus keyword: ' . $input['keyword'],
				'Tone: ' . $input['tone'],
				'Article type: ' . $input['articleType'],
				'Country or market: ' . $input['country'],
				'Audience: ' . $input['audience'],
				'Target word count: ' . $input['wordCount'],
				'Required links: ' . (empty($input['requiredLinks']) ? 'None' : implode(', ', $input['requiredLinks'])),
				'Optional links: ' . (empty($input['optionalLinks']) ? 'None' : implode(', ', $input['optionalLinks'])),
				'SEO instructions: ' . ($input['seoInstructions'] ? $input['seoInstructions'] : 'Use best-practice SEO without over-optimization.'),
			)
		);
	}

	private function sanitize_status($status)
	{
		$status = $this->sanitize_text($status);
		if (!in_array($status, array('draft', 'publish', 'future'), true)) {
			throw new AI_Article_Publisher_Error('Invalid publish status.', 400);
		}
		return $status;
	}

	private function sanitize_seo_provider($provider)
	{
		$provider = $this->sanitize_text($provider);
		if (!in_array($provider, array('AIOSEO', 'Yoast', 'None'), true)) {
			throw new AI_Article_Publisher_Error('Invalid SEO provider.', 400);
		}
		return $provider;
	}

	private function sanitize_news_category($category)
	{
		$category = $this->sanitize_text($category);
		if (!in_array($category, $this->get_news_categories(), true)) {
			throw new AI_Article_Publisher_Error('Invalid news category.', 400);
		}
		return $category;
	}

	private function sanitize_provider_order($value)
	{
		$providers = $this->sanitize_csv_strings($value);
		$clean = array();
		foreach ($providers as $provider) {
			$provider = sanitize_key($provider);
			if (in_array($provider, $this->get_provider_ids(), true) && 'claude_desktop_manual' !== $provider) {
				$clean[] = $provider;
			}
		}
		$clean = array_values(array_unique($clean));
		return empty($clean) ? 'openai,claude_api' : implode(',', $clean);
	}

	private function sanitize_scheduled_at($value, $status)
	{
		$value = $this->sanitize_text($value);
		if ('future' === $status) {
			if (!$value) {
				throw new AI_Article_Publisher_Error('scheduledAt is required when status is future.', 400);
			}
			$timestamp = strtotime($value);
			if (!$timestamp) {
				throw new AI_Article_Publisher_Error('scheduledAt must be a valid ISO datetime.', 400);
			}
			if ($timestamp <= time()) {
				throw new AI_Article_Publisher_Error('scheduledAt must be in the future.', 400);
			}
			return gmdate('c', $timestamp);
		}

		if ($value) {
			throw new AI_Article_Publisher_Error('scheduledAt is only allowed when status is future.', 400);
		}

		return '';
	}

	private function sanitize_int($value, $min, $max)
	{
		$int = (int) $value;
		if ($int < $min || $int > $max) {
			throw new AI_Article_Publisher_Error(sprintf('Value must be between %d and %d.', $min, $max), 400);
		}
		return $int;
	}

	private function sanitize_int_array($items)
	{
		$items = is_array($items) ? $items : array();
		$clean = array();
		foreach ($items as $item) {
			$value = (int) $item;
			if ($value > 0) {
				$clean[] = $value;
			}
		}
		return array_values(array_unique($clean));
	}

	private function sanitize_text($value)
	{
		return trim(wp_strip_all_tags((string) $value));
	}

	private function normalize_meta_text($value)
	{
		$text = $this->sanitize_text($value);
		$text = preg_replace('/\s+/', ' ', $text);
		$text = preg_replace('/^[\'"`]+|[\'"`]+$/u', '', (string) $text);
		return trim((string) $text);
	}

	private function truncate_text_at_word_boundary($value, $max_length)
	{
		$text = $this->normalize_meta_text($value);
		if (!$text || strlen($text) <= $max_length) {
			return $text;
		}

		$slice = substr($text, 0, $max_length + 1);
		$last_space = strrpos($slice, ' ');
		if (false !== $last_space && $last_space >= (int) floor($max_length * 0.6)) {
			$slice = substr($slice, 0, $last_space);
		} else {
			$slice = substr($text, 0, $max_length);
		}

		$slice = preg_replace('/[,:;\/-]+$/', '', trim((string) $slice));
		return trim((string) $slice);
	}

	private function clean_headline_text($value, $fallback, $max_length)
	{
		$headline = $this->truncate_text_at_word_boundary($value ? $value : $fallback, $max_length);
		if (!$headline) {
			$headline = $this->truncate_text_at_word_boundary($fallback, $max_length);
		}

		$headline = preg_replace('/[.!?,;:]+$/', '', (string) $headline);
		return trim((string) $headline);
	}

	private function clean_summary_text($value, $fallback, $max_length)
	{
		$summary = $this->truncate_text_at_word_boundary($value ? $value : $fallback, $max_length);
		if (!$summary) {
			$summary = $this->truncate_text_at_word_boundary($fallback, $max_length);
		}

		$summary = preg_replace('/\s+([,.;!?])/', '$1', (string) $summary);
		$summary = trim((string) $summary);
		if ($summary && !preg_match('/[.!?]$/', $summary)) {
			$summary .= '.';
		}

		return $summary;
	}

	private function require_text($value, $message, $min_length)
	{
		$text = trim((string) $value);
		if (strlen($text) < $min_length) {
			throw new AI_Article_Publisher_Error($message, 400);
		}
		return $text;
	}

	private function sanitize_csv_strings($value)
	{
		$parts = is_array($value) ? $value : preg_split('/[\r\n,]+/', (string) $value);
		if (!is_array($parts)) {
			$parts = array();
		}
		$clean = array();
		foreach ($parts as $part) {
			$item = $this->sanitize_text($part);
			if ($item) {
				$clean[] = $item;
			}
		}
		return array_values(array_unique($clean));
	}

	private function sanitize_string_list($items)
	{
		return $this->sanitize_csv_strings(is_array($items) ? $items : array());
	}

	private function sanitize_suggested_tags($items)
	{
		return array_slice($this->sanitize_string_list($items), 0, 10);
	}

	private function sanitize_optional_url($value)
	{
		$value = trim((string) $value);
		if (!$value) {
			return '';
		}
		return esc_url_raw($value);
	}

	private function sanitize_optional_image_url($value)
	{
		$value = trim((string) $value);
		if (!$value) {
			return '';
		}
		if (!empty($this->parse_inline_base64_image_source($value))) {
			return $value;
		}
		if (!filter_var($value, FILTER_VALIDATE_URL)) {
			return '';
		}
		return esc_url_raw($value);
	}

	private function slugify($input)
	{
		$slug = strtolower(trim((string) $input));
		$slug = preg_replace('/[^a-z0-9]+/', '-', $slug);
		$slug = trim((string) $slug, '-');
		return substr($slug, 0, 120);
	}

	private function slugify_metadata_value($input)
	{
		$value = trim((string) $input);
		if (!$value) {
			return '';
		}

		$parsed = wp_parse_url($value);
		if (!empty($parsed['path'])) {
			$value = (string) $parsed['path'];
		}
		$value = trim($value, " \t\n\r\0\x0B/");
		if (false !== strpos($value, '/')) {
			$parts = array_values(array_filter(explode('/', $value)));
			$value = !empty($parts) ? end($parts) : $value;
		}

		return $this->slugify($value);
	}

	private function derive_focus_keyword($title)
	{
		$parts = preg_split('/\s+/', trim((string) $title));
		if (!is_array($parts)) {
			return trim((string) $title);
		}
		$parts = array_values(array_filter($parts));
		return implode(' ', array_slice($parts, 0, 4));
	}

	private function decode_remote_json($response, $fallback_message)
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
			}
			throw new AI_Article_Publisher_Error($message, $status_code ? $status_code : 502, $decoded ? $decoded : $body);
		}

		if (!is_array($decoded)) {
			throw new AI_Article_Publisher_Error($fallback_message, 502, $body);
		}

		return $decoded;
	}

	private function get_provider($provider_id)
	{
		$settings = $this->get_settings();
		switch ($provider_id) {
			case 'claude_api':
				return new AIA_Claude_Api_Provider($settings);
			case 'claude_desktop_manual':
				return new AIA_Manual_Claude_Provider($settings);
			case 'openai':
			default:
				return new AIA_OpenAI_Provider($settings);
		}
	}

	private function get_provider_order($requested_provider = '')
	{
		$settings = $this->get_settings();
		$requested_provider = sanitize_key($requested_provider ? $requested_provider : $settings['default_provider']);
		$order = array();
		if ($requested_provider && 'claude_desktop_manual' !== $requested_provider) {
			$order[] = $requested_provider;
		}
		foreach ($this->sanitize_csv_strings($settings['provider_fallback_order']) as $provider) {
			$provider = sanitize_key($provider);
			if ('claude_desktop_manual' !== $provider && in_array($provider, $this->get_provider_ids(), true)) {
				$order[] = $provider;
			}
		}
		return array_values(array_unique($order));
	}

	private function ai_text_completion($messages, $options = array())
	{
		$settings = $this->get_settings();
		$options = wp_parse_args(
			$options,
			array(
				'provider' => '',
				'temperature' => (float) $settings['temperature'],
				'max_tokens' => (int) $settings['max_tokens'],
				'action' => 'text_generation',
			)
		);
		$last_error = null;

		foreach ($this->get_provider_order($options['provider']) as $provider_id) {
			try {
				$provider = $this->get_provider($provider_id);
				$content = $provider->generate_text($messages, $options);
				$this->add_log($provider->get_label(), $options['action'], 'success', '', 0);
				return array(
					'provider' => $provider_id,
					'providerLabel' => $provider->get_label(),
					'content' => $content,
				);
			} catch (Throwable $error) {
				$last_error = $error;
				$this->add_log($provider_id, $options['action'], 'error', $error->getMessage(), 0);
			}
		}

		if ($last_error) {
			throw $last_error;
		}
		throw new AI_Article_Publisher_Error('No API provider is configured. Save an OpenAI or Claude API key first.', 500);
	}

	private function add_log($provider, $action, $status, $error_message = '', $post_id = 0)
	{
		$logs = get_option(self::LOG_OPTION_KEY, array());
		if (!is_array($logs)) {
			$logs = array();
		}
		array_unshift(
			$logs,
			array(
				'date' => current_time('mysql'),
				'provider' => sanitize_text_field($provider),
				'action' => sanitize_text_field($action),
				'status' => sanitize_text_field($status),
				'error' => sanitize_text_field($error_message),
				'postId' => (int) $post_id,
			)
		);
		update_option(self::LOG_OPTION_KEY, array_slice($logs, 0, 100), false);
	}

	private function openai_chat_completion($messages, $temperature)
	{
		$result = $this->ai_text_completion($messages, array('temperature' => $temperature, 'action' => 'article_generation'));
		return $result['content'];
	}

	private function openai_image_generation($prompt)
	{
		$settings = $this->get_settings();
		$api_key = trim((string) $settings['openai_api_key']);
		$model = trim((string) $settings['openai_image_model']);
		if (!$api_key) {
			throw new AI_Article_Publisher_Error('OpenAI API key is missing. Save it in the plugin settings first.', 500);
		}
		if (!$model) {
			$model = self::IMAGE_MODEL;
		}

		$response = wp_remote_post(
			'https://api.openai.com/v1/images/generations',
			array(
				'timeout' => 180,
				'headers' => array(
					'Authorization' => 'Bearer ' . $api_key,
					'Content-Type' => 'application/json',
				),
				'body' => wp_json_encode(
					array(
						'model' => $model,
						'prompt' => $prompt,
						'size' => '1536x1024',
					)
				),
			)
		);

		$decoded = $this->decode_remote_json($response, 'OpenAI image generation request failed.');
		$data = isset($decoded['data'][0]) && is_array($decoded['data'][0]) ? $decoded['data'][0] : array();
		if (!empty($data['b64_json'])) {
			return array(
				'imageBase64' => (string) $data['b64_json'],
				'mimeType' => 'image/png',
			);
		}
		if (!empty($data['url'])) {
			return $this->fetch_remote_image_as_base64((string) $data['url']);
		}

		throw new AI_Article_Publisher_Error('OpenAI image response did not contain image data.', 502, $decoded);
	}

	private function parse_json_from_model($content)
	{
		$decoded = json_decode((string) $content, true);
		if (is_array($decoded)) {
			return $decoded;
		}

		$start = strpos((string) $content, '{');
		$end = strrpos((string) $content, '}');
		if (false === $start || false === $end || $end <= $start) {
			throw new AI_Article_Publisher_Error('AI response did not contain valid JSON.', 502);
		}

		$decoded = json_decode(substr((string) $content, $start, ($end - $start + 1)), true);
		if (!is_array($decoded)) {
			throw new AI_Article_Publisher_Error('Failed to parse AI JSON output.', 502, $content);
		}

		return $decoded;
	}

	private function generate_article_draft($input)
	{
		$required_links = array_values(array_filter($input['links'], array($this, 'is_required_link')));
		$optional_links = array_values(array_filter($input['links'], array($this, 'is_optional_link')));
		$required_links_prompt = empty($required_links) ? 'None' : implode(
			"\n",
			array_map(
				function ($link, $index) {
					return sprintf('%d. <a href="%s">%s</a>', $index + 1, $link['url'], $link['anchorText']);
				},
				$required_links,
				array_keys($required_links)
			)
		);
		$optional_links_prompt = empty($optional_links) ? 'None' : implode(
			"\n",
			array_map(
				function ($link, $index) {
					return sprintf('%d. <a href="%s">%s</a>', $index + 1, $link['url'], $link['anchorText']);
				},
				$optional_links,
				array_keys($optional_links)
			)
		);

		$content = $this->openai_chat_completion(
			array(
				array(
					'role' => 'system',
					'content' => implode(
						' ',
						array(
							'You are a senior editorial SEO strategist and human copywriter creating WordPress-ready content.',
							'Write with a natural human voice, clear structure, and strong search-intent alignment.',
							'Avoid robotic filler, generic AI phrases, keyword stuffing, and cheap clickbait.',
							'Every title, heading, excerpt, and SEO field must feel human, useful, and SEO-friendly.',
							'Follow constraints exactly.',
						)
					),
				),
				array(
					'role' => 'user',
					'content' => implode(
						"\n",
						array(
							'Return a JSON object with this exact shape:',
							'{',
							'  "html": "<valid wordpress html>",',
							'  "meta": {',
							'    "title": "string",',
							'    "excerpt": "string",',
							'    "suggestedTags": ["string"],',
							'    "seo": {',
							'      "seoTitle": "string",',
							'      "metaDescription": "string",',
							'      "focusKeyword": "string",',
							'      "canonicalUrl": "optional absolute url",',
							'      "og": { "title": "string", "description": "string", "imageUrl": "optional absolute url" },',
							'      "twitter": { "title": "string", "description": "string", "imageUrl": "optional absolute url" }',
							'    }',
							'  }',
							'}',
							'',
							'Rules:',
							'- html MUST be valid WordPress-ready HTML only (no markdown, no code fences).',
							'- Include each required link exactly once using the exact anchor text and URL.',
							'- Optional links may be included only when natural.',
							'- Use h2/h3 headings, short paragraphs, and include a conclusion section.',
							'- Add an FAQ section at the end.',
							'- Rewrite weak phrasing so the article reads like a skilled human writer, not AI-generated copy.',
							'- Avoid cliches and filler such as "in today\'s fast-paced world", "delve", "unlock", "game-changing", or similar fluff.',
							'- Make meta.title a strong SEO headline. Improve the supplied title when a clearer, more searchable angle is available.',
							'- Make seoTitle concise and compelling, ideally around 50-60 characters.',
							'- Make metaDescription natural, benefit-led, and ideally around 140-155 characters without keyword stuffing.',
							'- Keep the focus keyword aligned to the primary search intent and use it naturally.',
							'',
							'Title: ' . $input['title'],
							'Topic/Brief: ' . $input['brief'],
							'Keywords: ' . implode(', ', $input['keywords']),
							'Focus keyword: ' . $input['focusKeyword'],
							'Tone: ' . $input['tone'],
							'Target word count: ' . $input['wordCount'],
							'',
							'Required links:',
							$required_links_prompt,
							'',
							'Optional links:',
							$optional_links_prompt,
						)
					),
				),
			),
			0.4
		);

		$parsed = $this->parse_json_from_model($content);
		$generated = $this->sanitize_generated_article_payload($parsed, $input['title'], $input['focusKeyword']);
		$generated['html'] = $this->dedupe_required_links_in_html($generated['html'], $input['links']);
		$generated['html'] = $this->enforce_link_policies_in_html($generated['html'], $input['links']);
		$link_validation = $this->validate_required_links($generated['html'], $input['links']);

		if (!empty($link_validation['missing']) || !empty($link_validation['duplicateRequired'])) {
			throw new AI_Article_Publisher_Error('Generated HTML failed required link validation. Please regenerate.', 400, $link_validation);
		}

		return $generated;
	}

	private function sanitize_generated_article_payload($parsed, $fallback_title, $fallback_focus_keyword)
	{
		$html = $this->require_text(isset($parsed['html']) ? $parsed['html'] : '', 'Generated HTML is missing.', 40);
		if (false !== strpos($html, '```')) {
			throw new AI_Article_Publisher_Error('AI returned markdown fences instead of pure HTML.', 502);
		}

		$meta = isset($parsed['meta']) && is_array($parsed['meta']) ? $parsed['meta'] : array();
		$seo = isset($meta['seo']) && is_array($meta['seo']) ? $meta['seo'] : array();
		$excerpt = $this->clean_summary_text(
			$this->require_text(isset($meta['excerpt']) ? $meta['excerpt'] : '', 'Excerpt is missing from the generated response.', 1),
			$fallback_title,
			180
		);
		$title = $this->clean_headline_text(isset($meta['title']) ? $meta['title'] : '', $fallback_title, 72);

		$payload = array(
			'html' => $html,
			'meta' => array(
				'title' => $title,
				'excerpt' => $excerpt,
				'suggestedTags' => $this->sanitize_suggested_tags(isset($meta['suggestedTags']) ? $meta['suggestedTags'] : array()),
				'seo' => array(
					'seoTitle' => $this->normalize_meta_text(isset($seo['seoTitle']) ? $seo['seoTitle'] : ''),
					'metaDescription' => $this->normalize_meta_text(isset($seo['metaDescription']) ? $seo['metaDescription'] : ''),
					'focusKeyword' => $this->normalize_meta_text(isset($seo['focusKeyword']) ? $seo['focusKeyword'] : ''),
					'additionalKeywords' => $this->sanitize_string_list(isset($seo['additionalKeywords']) ? $seo['additionalKeywords'] : array()),
					'canonicalUrl' => $this->sanitize_optional_url(isset($seo['canonicalUrl']) ? $seo['canonicalUrl'] : ''),
					'og' => array(
						'title' => $this->normalize_meta_text(isset($seo['og']['title']) ? $seo['og']['title'] : ''),
						'description' => $this->normalize_meta_text(isset($seo['og']['description']) ? $seo['og']['description'] : ''),
						'imageUrl' => $this->sanitize_optional_url(isset($seo['og']['imageUrl']) ? $seo['og']['imageUrl'] : ''),
					),
					'twitter' => array(
						'title' => $this->normalize_meta_text(isset($seo['twitter']['title']) ? $seo['twitter']['title'] : ''),
						'description' => $this->normalize_meta_text(isset($seo['twitter']['description']) ? $seo['twitter']['description'] : ''),
						'imageUrl' => $this->sanitize_optional_url(isset($seo['twitter']['imageUrl']) ? $seo['twitter']['imageUrl'] : ''),
					),
				),
			),
		);

		$payload['meta']['seo'] = $this->hydrate_seo_payload($payload['meta']['seo'], $title, $excerpt, '');
		if (!$payload['meta']['seo']['focusKeyword']) {
			$payload['meta']['seo']['focusKeyword'] = $fallback_focus_keyword;
		}

		return $payload;
	}

	private function hydrate_seo_payload($seo_payload, $fallback_title, $fallback_excerpt, $featured_image_url)
	{
		$fallback_title = $this->clean_headline_text($fallback_title, 'Article', 72);
		$fallback_excerpt = $this->clean_summary_text($fallback_excerpt, $fallback_title, 180);
		$seo_title = $this->clean_headline_text(isset($seo_payload['seoTitle']) ? $seo_payload['seoTitle'] : '', $fallback_title, 60);
		$meta_description = $this->clean_summary_text(isset($seo_payload['metaDescription']) ? $seo_payload['metaDescription'] : '', $fallback_excerpt ? $fallback_excerpt : $fallback_title, 155);
		$focus_keyword = $this->normalize_meta_text(isset($seo_payload['focusKeyword']) ? $seo_payload['focusKeyword'] : '');
		$canonical_url = $this->sanitize_optional_url(isset($seo_payload['canonicalUrl']) ? $seo_payload['canonicalUrl'] : '');
		$additional_keywords = array_slice($this->sanitize_string_list(isset($seo_payload['additionalKeywords']) ? $seo_payload['additionalKeywords'] : array()), 0, 12);
		$og = isset($seo_payload['og']) && is_array($seo_payload['og']) ? $seo_payload['og'] : array();
		$twitter = isset($seo_payload['twitter']) && is_array($seo_payload['twitter']) ? $seo_payload['twitter'] : array();

		if (!$focus_keyword) {
			$focus_keyword = $this->derive_focus_keyword($fallback_title);
		}

		$og_title = $this->clean_headline_text(isset($og['title']) ? $og['title'] : '', $seo_title, 60);
		$og_description = $this->clean_summary_text(isset($og['description']) ? $og['description'] : '', $meta_description, 155);
		$og_image_url = $this->sanitize_optional_url(isset($og['imageUrl']) ? $og['imageUrl'] : '');
		$twitter_title = $this->clean_headline_text(isset($twitter['title']) ? $twitter['title'] : '', $seo_title, 60);
		$twitter_description = $this->clean_summary_text(isset($twitter['description']) ? $twitter['description'] : '', $meta_description, 155);
		$twitter_image_url = $this->sanitize_optional_url(isset($twitter['imageUrl']) ? $twitter['imageUrl'] : '');
		if (!$og_image_url) {
			$og_image_url = $featured_image_url;
		}
		if (!$twitter_image_url) {
			$twitter_image_url = $featured_image_url;
		}

		return array(
			'seoTitle' => $seo_title,
			'metaDescription' => $meta_description,
			'focusKeyword' => $focus_keyword,
			'additionalKeywords' => $additional_keywords,
			'canonicalUrl' => $canonical_url,
			'og' => array(
				'title' => $og_title,
				'description' => $og_description,
				'imageUrl' => $og_image_url,
			),
			'twitter' => array(
				'title' => $twitter_title,
				'description' => $twitter_description,
				'imageUrl' => $twitter_image_url,
			),
		);
	}

	private function build_google_doc_fallback_seo_payload($draft, $excerpt, $featured_image_url)
	{
		return $this->hydrate_seo_payload(
			array(
				'seoTitle' => isset($draft['seoTitle']) ? $draft['seoTitle'] : '',
				'metaDescription' => isset($draft['metaDescription']) ? $draft['metaDescription'] : '',
				'focusKeyword' => isset($draft['focusKeyword']) ? $draft['focusKeyword'] : '',
				'canonicalUrl' => isset($draft['canonicalUrl']) ? $draft['canonicalUrl'] : '',
				'og' => array(
					'title' => isset($draft['seoTitle']) ? $draft['seoTitle'] : '',
					'description' => isset($draft['metaDescription']) ? $draft['metaDescription'] : '',
					'imageUrl' => '',
				),
				'twitter' => array(
					'title' => isset($draft['seoTitle']) ? $draft['seoTitle'] : '',
					'description' => isset($draft['metaDescription']) ? $draft['metaDescription'] : '',
					'imageUrl' => '',
				),
			),
			isset($draft['title']) ? $draft['title'] : '',
			$excerpt,
			$featured_image_url
		);
	}

	private function generate_seo_payload_for_article($draft, $excerpt, $featured_image_url)
	{
		$title = isset($draft['title']) ? (string) $draft['title'] : 'Article';
		$html = isset($draft['html']) ? (string) $draft['html'] : '';
		$plain_text = substr($this->normalize_meta_text($this->strip_html_text($html)), 0, 6000);
		$fallback_focus = !empty($draft['focusKeyword']) ? (string) $draft['focusKeyword'] : $this->derive_focus_keyword($title);
		$fallback_seo = $this->build_google_doc_fallback_seo_payload($draft, $excerpt, $featured_image_url);

		$content = $this->ai_text_completion(
			array(
				array(
					'role' => 'system',
					'content' => implode(
						' ',
						array(
							'You are an AIOSEO on-page SEO specialist.',
							'Generate concise, human SEO metadata for a pre-written WordPress article.',
							'Respect character limits exactly and avoid keyword stuffing.',
							'Return JSON only.',
						)
					),
				),
				array(
					'role' => 'user',
					'content' => implode(
						"\n",
						array(
							'Return a JSON object with this exact shape:',
							'{',
							'  "seoTitle": "string",',
							'  "metaDescription": "string",',
							'  "focusKeyword": "string",',
							'  "canonicalUrl": "optional absolute url",',
							'  "additionalKeywords": ["string"],',
							'  "og": { "title": "string", "description": "string", "imageUrl": "optional absolute url" },',
							'  "twitter": { "title": "string", "description": "string", "imageUrl": "optional absolute url" }',
							'}',
							'',
							'Limits:',
							'- seoTitle: max 60 characters, ideally 50-60.',
							'- metaDescription: max 155 characters, ideally 140-155.',
							'- og.title and twitter.title: max 60 characters.',
							'- og.description and twitter.description: max 155 characters.',
							'- focusKeyword: short primary phrase, 2-6 words.',
							'- additionalKeywords: up to 8 short related phrases.',
							'- Leave imageUrl empty unless the article explicitly provides a usable image URL.',
							'',
							'Title: ' . $title,
							'Existing excerpt: ' . $excerpt,
							'Preferred focus keyword: ' . $fallback_focus,
							'Canonical URL: ' . (!empty($draft['canonicalUrl']) ? $draft['canonicalUrl'] : ''),
							'',
							'Article text:',
							$plain_text,
						)
					),
				),
			),
			array('temperature' => 0.25, 'action' => 'seo_generation', 'max_tokens' => 1200)
		);

		try {
			$parsed = $this->parse_ai_json($content['content']);
			if (!is_array($parsed)) {
				$parsed = array();
			}
		} catch (Throwable $error) {
			$parsed = array();
		}

		return $this->hydrate_seo_payload(
			array_merge($fallback_seo, $parsed),
			$title,
			$excerpt,
			$featured_image_url
		);
	}

	private function validate_article_payload($html, $meta, $links)
	{
		$warnings = array();
		$errors = array();
		$text = $this->strip_html_text($html);
		if (strlen($text) < 120) {
			$errors[] = 'Post content is too short or empty.';
		}

		$link_validation = $this->validate_required_links($html, $links);
		if (!empty($link_validation['missing'])) {
			$errors[] = 'One or more required links are missing.';
		}
		if (!empty($link_validation['duplicateRequired'])) {
			$errors[] = 'One or more required links appear more than once.';
		}

		$seo = isset($meta['seo']) && is_array($meta['seo']) ? $meta['seo'] : array();
		$seo_title = isset($seo['seoTitle']) ? $this->normalize_meta_text($seo['seoTitle']) : '';
		$meta_description = isset($seo['metaDescription']) ? $this->normalize_meta_text($seo['metaDescription']) : '';
		$focus_keyword = isset($seo['focusKeyword']) ? $this->normalize_meta_text($seo['focusKeyword']) : '';

		if (strlen($seo_title) > 65) {
			$warnings[] = 'SEO title is longer than the usual 60-65 character target.';
		}
		if (strlen($meta_description) > 160 || strlen($meta_description) < 120) {
			$warnings[] = 'Meta description is outside the usual 120-160 character target.';
		}
		if ($focus_keyword && false === stripos($text, $focus_keyword)) {
			$warnings[] = 'Focus keyword was not found naturally in the article body.';
		}
		if (!$focus_keyword) {
			$warnings[] = 'Focus keyword is empty.';
		}

		return array(
			'ok' => empty($errors),
			'errors' => $errors,
			'warnings' => $warnings,
			'links' => $link_validation,
		);
	}

	private function build_article_tool_prompt($tool, $title, $brief, $html, $focus_keyword)
	{
		$context = implode(
			"\n",
			array(
				'Title: ' . ($title ? $title : 'Untitled'),
				'Brief: ' . ($brief ? $brief : 'No brief supplied.'),
				'Focus keyword: ' . ($focus_keyword ? $focus_keyword : 'Not supplied'),
				'Current HTML: ' . ($html ? $this->truncate($this->strip_html_text($html), 3000) : 'No current draft supplied.'),
			)
		);
		$prompts = array(
			'outline' => 'Generate a practical SEO article outline with h2/h3 headings and bullet notes.',
			'improve_draft' => 'Improve the current draft for clarity, flow, search intent, and originality. Return WordPress-ready HTML only.',
			'humanize' => 'Rewrite the current draft to sound more natural, specific, and human while preserving meaning. Return WordPress-ready HTML only.',
			'rewrite_intro' => 'Rewrite only the introduction. Return HTML for the new introduction only.',
			'faq' => 'Generate a concise FAQ section in WordPress-ready HTML using h2/h3 and paragraph tags.',
			'meta_only' => 'Generate JSON only with seoTitle, metaDescription, focusKeyword, additionalKeywords, og, and twitter fields.',
			'social_captions' => 'Generate 5 social captions for Facebook/X/LinkedIn with a professional tone.',
			'image_prompt' => 'Generate one featured image prompt for a clean editorial image. No text overlays, no logos, no watermarks.',
			'full_article' => 'Generate a full WordPress-ready HTML article using the context and SEO best practices.',
		);
		if (empty($prompts[$tool])) {
			throw new AI_Article_Publisher_Error('Unknown article quality tool.', 400);
		}
		return $prompts[$tool] . "\n\n" . $context;
	}

	private function generate_featured_image($input)
	{
		$stem = $this->slugify($input['title']);
		$image = $this->openai_image_generation(
			implode(
				' ',
				array(
					sprintf('Create a professional featured image for an article titled "%s".', $input['title']),
					'Article brief: ' . $input['brief'],
					'Style: editorial, clean, high-quality, realistic or polished illustration.',
					'Important: no text overlays, no logos, no watermarks.',
				)
			)
		);

		return array(
			'imageBase64' => $image['imageBase64'],
			'mimeType' => $image['mimeType'],
			'filenameSuggestion' => ($stem ? $stem : 'featured-image') . '.png',
			'altTextSuggestion' => 'Featured image for ' . $input['title'],
		);
	}

	private function generate_inline_article_images($input)
	{
		$count = isset($input['count']) ? (int) $input['count'] : 0;
		if ($count <= 0) {
			return array();
		}

		$stem = $this->slugify($input['title']);
		$images = array();
		for ($index = 1; $index <= $count; $index++) {
			$generated = $this->openai_image_generation(
				implode(
					' ',
					array(
						sprintf('Create in-article supporting image %d for an article titled "%s".', $index, $input['title']),
						'Article brief: ' . $input['brief'],
						sprintf('Visual variation %d of %d.', $index, $count),
						'Style: professional editorial, consistent with a business or tech blog.',
						'Important: no text overlays, no logos, no watermarks.',
					)
				)
			);

			$images[] = array(
				'imageBase64' => $generated['imageBase64'],
				'mimeType' => $generated['mimeType'],
				'filenameSuggestion' => ($stem ? $stem : 'article') . '-inline-' . $index . '.png',
				'altTextSuggestion' => sprintf('In-article visual %d for %s', $index, $input['title']),
			);
		}

		return $images;
	}

	private function rewrite_news_as_original_article($input)
	{
		$content = $this->openai_chat_completion(
			array(
				array(
					'role' => 'system',
					'content' => implode(
						' ',
						array(
							'You are an editor producing original, factual, SEO-ready WordPress news articles.',
							'Write with a natural human voice, clean news judgment, and clear search-intent alignment.',
							'Avoid robotic filler, repeated phrasing, and sensational clickbait.',
							'Every title, excerpt, and SEO field must sound human and be optimized for discoverability.',
						)
					),
				),
				array(
					'role' => 'user',
					'content' => implode(
						"\n",
						array(
							'Rewrite this news into a fully original article.',
							'Return JSON only with this exact shape:',
							'{',
							'  "html": "<valid wordpress html>",',
							'  "meta": {',
							'    "title": "string",',
							'    "excerpt": "string",',
							'    "suggestedTags": ["string"],',
							'    "seo": {',
							'      "seoTitle": "string",',
							'      "metaDescription": "string",',
							'      "focusKeyword": "string",',
							'      "canonicalUrl": "optional absolute url",',
							'      "og": { "title": "string", "description": "string", "imageUrl": "optional absolute url" },',
							'      "twitter": { "title": "string", "description": "string", "imageUrl": "optional absolute url" }',
							'    }',
							'  }',
							'}',
							'',
							'Hard rules:',
							'- Write from scratch using the facts only. Do not copy wording from source text.',
							'- Output WordPress-ready HTML only (no markdown, no code fences).',
							'- Use clear h2/h3 sections, short paragraphs, and a concise conclusion.',
							'- Preserve factual details and numbers; if a detail is uncertain, omit it.',
							'- Add a short source credit sentence at the end linking to the original source URL.',
							'- Rewrite the headline into a more compelling SEO-friendly news title when it improves clarity or search intent.',
							'- Keep the copy human, specific, and direct. Avoid filler such as "in today\'s fast-paced world", "delve", or "game-changing".',
							'- Make seoTitle concise and search-friendly, ideally around 50-60 characters.',
							'- Make metaDescription natural and ideally around 140-155 characters.',
							'',
							'Target category: ' . $input['category'],
							'Tone: ' . $input['tone'],
							'Target word count: ' . $input['wordCount'],
							'',
							'Source title: ' . $input['article']['title'],
							'Source summary: ' . $input['article']['description'],
							'Source content: ' . $input['article']['content'],
							'Source link: ' . $input['article']['link'],
							'Source name: ' . (!empty($input['article']['sourceName']) ? $input['article']['sourceName'] : 'Unknown source'),
							'Source publishedAt: ' . (!empty($input['article']['publishedAt']) ? $input['article']['publishedAt'] : 'Unknown'),
						)
					),
				),
			),
			0.45
		);

		$parsed = $this->parse_json_from_model($content);
		$fallback_keyword = $this->derive_focus_keyword(!empty($parsed['meta']['title']) ? (string) $parsed['meta']['title'] : $input['article']['title']);
		return $this->sanitize_generated_article_payload($parsed, $input['article']['title'], $fallback_keyword);
	}

	public function ajax_publish_post()
	{
		$this->guard_ajax('edit_posts');

		try {
			$payload = $this->read_payload();
			$title = $this->require_text(isset($payload['title']) ? $payload['title'] : '', 'Title is required.', 3);
			$brief = $this->sanitize_text(isset($payload['brief']) ? $payload['brief'] : '');
			$html = wp_kses_post($this->require_text(isset($payload['html']) ? $payload['html'] : '', 'Generated HTML is required.', 40));
			$excerpt = $this->require_text(isset($payload['excerpt']) ? $payload['excerpt'] : '', 'Excerpt is required.', 1);
			$status = $this->sanitize_status(isset($payload['status']) ? $payload['status'] : 'draft');
			$scheduled_at = $this->sanitize_scheduled_at(isset($payload['scheduledAt']) ? $payload['scheduledAt'] : '', $status);
			$inline_image_count = $this->sanitize_int(isset($payload['inPostImageCount']) ? $payload['inPostImageCount'] : 0, 0, 10);
			$selected_category_ids = $this->sanitize_int_array(isset($payload['selectedCategoryIds']) ? $payload['selectedCategoryIds'] : array());
			$new_category_name = $this->sanitize_text(isset($payload['newCategoryName']) ? $payload['newCategoryName'] : '');
			$tags = $this->sanitize_csv_strings(isset($payload['suggestedTags']) ? $payload['suggestedTags'] : '');
			$links = $this->sanitize_manual_links_from_payload($payload);

			if ($new_category_name) {
				$selected_category_ids[] = $this->ensure_category($new_category_name);
				$selected_category_ids = array_values(array_unique($selected_category_ids));
			}

			$featured_media_id = 0;
			$featured_image_url = '';
			$featured_image_base64 = $this->sanitize_text(isset($payload['featuredImageBase64']) ? $payload['featuredImageBase64'] : '');
			$featured_image_mime = $this->sanitize_text(isset($payload['featuredImageMime']) ? $payload['featuredImageMime'] : '');

			if ($featured_image_base64) {
				if (!$featured_image_mime) {
					throw new AI_Article_Publisher_Error('featuredImageMime is required when featuredImageBase64 is set.', 400);
				}
				$media = $this->upload_base64_image_to_media($featured_image_base64, $featured_image_mime, $title, $this->slugify($title) . '.png', 'Featured image for ' . $title);
				$featured_media_id = (int) $media['id'];
				$featured_image_url = (string) $media['source_url'];
			}

			$html_for_publish = $html;
			$inline_images = array();
			if ($inline_image_count > 0) {
				$generated_inline_images = $this->generate_inline_article_images(
					array(
						'title' => $title,
						'brief' => $brief ? $brief : $excerpt,
						'count' => $inline_image_count,
					)
				);

				foreach ($generated_inline_images as $index => $generated_inline_image) {
					$media = $this->upload_base64_image_to_media(
						$generated_inline_image['imageBase64'],
						$generated_inline_image['mimeType'],
						sprintf('%s inline image %d', $title, $index + 1),
						$generated_inline_image['filenameSuggestion'],
						$generated_inline_image['altTextSuggestion']
					);

					$inline_images[] = array(
						'id' => (int) $media['id'],
						'sourceUrl' => (string) $media['source_url'],
						'altText' => (string) $generated_inline_image['altTextSuggestion'],
					);
				}
				$html_for_publish = $this->inject_inline_images_into_html($html_for_publish, $inline_images);
			}

			$seo_provider = $this->sanitize_seo_provider(isset($payload['seoProvider']) ? $payload['seoProvider'] : 'None');
			$seo_payload = $this->hydrate_seo_payload(
				isset($payload['seoPayload']) && is_array($payload['seoPayload']) ? $payload['seoPayload'] : array(),
				$title,
				$excerpt,
				$featured_image_url
			);
			$validation = $this->validate_article_payload(
				$html_for_publish,
				array('seo' => $seo_payload),
				$links
			);
			if (empty($validation['ok']) && 'publish' === $status) {
				throw new AI_Article_Publisher_Error('Publishing blocked by validation errors. Create a draft first or fix the warnings.', 400, $validation);
			}

			$post = $this->create_post(
				array(
					'title' => $title,
					'html' => $html_for_publish,
					'excerpt' => $excerpt,
					'status' => $status,
					'date' => $scheduled_at,
					'featured_media_id' => $featured_media_id,
					'categories' => $selected_category_ids,
					'tags' => $tags,
				)
			);

			$seo_update = $this->apply_seo_meta((int) $post['id'], $seo_provider, $seo_payload, $featured_image_url);
			$this->add_log('WordPress', 'publish_post', 'success', '', (int) $post['id']);

			wp_send_json_success(
				array(
					'postId' => (int) $post['id'],
					'link' => (string) $post['link'],
					'status' => (string) $post['status'],
					'categories' => $selected_category_ids,
					'inlineImages' => $inline_images,
					'seoUpdate' => $seo_update,
					'validation' => $validation,
				)
			);
		} catch (Throwable $error) {
			$this->add_log('WordPress', 'publish_post', 'error', $error->getMessage(), 0);
			$this->send_exception($error);
		}
	}

	private function ensure_category($name)
	{
		$name = $this->sanitize_text($name);
		if (!$name) {
			throw new AI_Article_Publisher_Error('Category name cannot be empty.', 400);
		}

		$existing = term_exists($name, 'category');
		if (is_array($existing) && !empty($existing['term_id'])) {
			return (int) $existing['term_id'];
		}
		if (is_numeric($existing)) {
			return (int) $existing;
		}

		$created = wp_insert_term($name, 'category');
		if (is_wp_error($created)) {
			throw new AI_Article_Publisher_Error($created->get_error_message(), 500);
		}
		return (int) $created['term_id'];
	}

	private function extension_from_mime($mime_type)
	{
		$mime_type = strtolower((string) $mime_type);
		if (false !== strpos($mime_type, 'jpeg') || false !== strpos($mime_type, 'jpg')) {
			return 'jpg';
		}
		if (false !== strpos($mime_type, 'webp')) {
			return 'webp';
		}
		if (false !== strpos($mime_type, 'gif')) {
			return 'gif';
		}
		return 'png';
	}

	private function sanitize_upload_filename($filename_suggestion, $mime_type, $title)
	{
		$extension = $this->extension_from_mime($mime_type);
		$stem = strtolower(trim((string) pathinfo((string) $filename_suggestion, PATHINFO_FILENAME)));
		$stem = preg_replace('/[^a-z0-9]+/', '-', $stem);
		$stem = trim((string) $stem, '-');
		if (!$stem) {
			$stem = $this->slugify($title);
		}
		if (!$stem) {
			$stem = 'featured-image';
		}
		return substr($stem, 0, 80) . '.' . $extension;
	}

	private function upload_base64_image_to_media($image_base64, $mime_type, $title, $filename_suggestion, $alt_text)
	{
		$cleaned = preg_replace('/^(?:data:)?[^;]+;base64,/i', '', (string) $image_base64);
		$bytes = base64_decode((string) $cleaned, true);
		if (false === $bytes) {
			throw new AI_Article_Publisher_Error('Invalid base64 image data.', 400);
		}

		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';

		$filename = $this->sanitize_upload_filename($filename_suggestion, $mime_type, $title);
		$upload = wp_upload_bits($filename, null, $bytes);
		if (!empty($upload['error'])) {
			throw new AI_Article_Publisher_Error((string) $upload['error'], 500);
		}

		$filetype = wp_check_filetype($upload['file'], null);
		$attachment_id = wp_insert_attachment(
			array(
				'post_mime_type' => !empty($filetype['type']) ? $filetype['type'] : $mime_type,
				'post_title' => sanitize_text_field($title),
				'post_content' => '',
				'post_status' => 'inherit',
			),
			$upload['file']
		);

		if (is_wp_error($attachment_id)) {
			throw new AI_Article_Publisher_Error($attachment_id->get_error_message(), 500);
		}

		$attachment_metadata = wp_generate_attachment_metadata($attachment_id, $upload['file']);
		wp_update_attachment_metadata($attachment_id, $attachment_metadata);
		if ($alt_text) {
			update_post_meta($attachment_id, '_wp_attachment_image_alt', sanitize_text_field($alt_text));
		}

		return array(
			'id' => (int) $attachment_id,
			'source_url' => wp_get_attachment_url($attachment_id),
		);
	}

	private function create_post($payload)
	{
		$postarr = array(
			'post_title' => $payload['title'],
			'post_content' => $payload['html'],
			'post_excerpt' => $payload['excerpt'],
			'post_status' => $payload['status'],
			'post_type' => 'post',
		);

		if (!empty($payload['slug'])) {
			$postarr['post_name'] = sanitize_title($payload['slug']);
		}
		if ('future' === $payload['status'] && !empty($payload['date'])) {
			$timestamp = strtotime($payload['date']);
			if (!$timestamp) {
				throw new AI_Article_Publisher_Error('Invalid scheduled date.', 400);
			}
			$postarr['post_date_gmt'] = gmdate('Y-m-d H:i:s', $timestamp);
			$postarr['post_date'] = get_date_from_gmt($postarr['post_date_gmt'], 'Y-m-d H:i:s');
		}

		$post_id = wp_insert_post($postarr, true);
		if (is_wp_error($post_id)) {
			throw new AI_Article_Publisher_Error($post_id->get_error_message(), 500);
		}

		if (!empty($payload['categories'])) {
			wp_set_post_categories($post_id, $payload['categories'], false);
		}
		if (!empty($payload['tags'])) {
			wp_set_post_tags($post_id, $payload['tags'], false);
		}
		if (!empty($payload['featured_media_id'])) {
			$this->assign_featured_media_to_post($post_id, (int) $payload['featured_media_id']);
		}

		return array(
			'id' => (int) $post_id,
			'link' => get_permalink($post_id),
			'status' => get_post_status($post_id),
		);
	}

	private function assign_featured_media_to_post($post_id, $attachment_id)
	{
		$post_id = (int) $post_id;
		$attachment_id = (int) $attachment_id;
		if ($post_id <= 0 || $attachment_id <= 0) {
			return;
		}

		wp_update_post(
			array(
				'ID' => $attachment_id,
				'post_parent' => $post_id,
			)
		);

		set_post_thumbnail($post_id, $attachment_id);
		if ((int) get_post_thumbnail_id($post_id) !== $attachment_id) {
			update_post_meta($post_id, '_thumbnail_id', $attachment_id);
		}
	}

	private function apply_seo_meta($post_id, $provider, $seo_payload, $featured_image_url)
	{
		if ('None' === $provider) {
			return array(
				'ok' => true,
				'provider' => 'None',
				'details' => 'SEO update skipped because provider is None.',
			);
		}

		$seo_payload = $this->hydrate_seo_payload($seo_payload, get_the_title($post_id), get_post_field('post_excerpt', $post_id), $featured_image_url);
		if ('Yoast' === $provider) {
			$meta = array(
				'_yoast_wpseo_title' => $seo_payload['seoTitle'],
				'_yoast_wpseo_metadesc' => $seo_payload['metaDescription'],
				'_yoast_wpseo_focuskw' => $seo_payload['focusKeyword'],
				'_yoast_wpseo_focuskeywords' => wp_json_encode($seo_payload['additionalKeywords']),
				'_yoast_wpseo_canonical' => $seo_payload['canonicalUrl'],
				'_yoast_wpseo_opengraph-title' => $seo_payload['og']['title'],
				'_yoast_wpseo_opengraph-description' => $seo_payload['og']['description'],
				'_yoast_wpseo_opengraph-image' => $seo_payload['og']['imageUrl'],
				'_yoast_wpseo_twitter-title' => $seo_payload['twitter']['title'],
				'_yoast_wpseo_twitter-description' => $seo_payload['twitter']['description'],
				'_yoast_wpseo_twitter-image' => $seo_payload['twitter']['imageUrl'],
			);
		} else {
			$meta = array(
				'_aioseo_title' => $seo_payload['seoTitle'],
				'_aioseo_description' => $seo_payload['metaDescription'],
				'_aioseo_focus_keyphrase' => $seo_payload['focusKeyword'],
				'_aioseo_keywords' => implode(',', $seo_payload['additionalKeywords']),
				'_aioseo_canonical_url' => $seo_payload['canonicalUrl'],
				'_aioseo_og_title' => $seo_payload['og']['title'],
				'_aioseo_og_description' => $seo_payload['og']['description'],
				'_aioseo_og_image' => $seo_payload['og']['imageUrl'],
				'_aioseo_twitter_title' => $seo_payload['twitter']['title'],
				'_aioseo_twitter_description' => $seo_payload['twitter']['description'],
				'_aioseo_twitter_image' => $seo_payload['twitter']['imageUrl'],
			);
		}

		foreach ($meta as $key => $value) {
			if ('' === (string) $value) {
				delete_post_meta($post_id, $key);
			} else {
				update_post_meta($post_id, $key, $value);
			}
		}

		return array(
			'ok' => true,
			'provider' => $provider,
			'details' => ('Yoast' === $provider) ? 'Yoast metadata updated via post meta.' : 'AIOSEO fallback meta fields updated via post meta.',
		);
	}

	public function ajax_import_google_doc()
	{
		$this->guard_ajax('edit_posts');

		try {
			$payload = $this->read_payload();
			$document = $this->require_text(isset($payload['document']) ? $payload['document'] : '', 'Google Doc URL or ID is required.', 3);
			$status = $this->sanitize_status(isset($payload['status']) ? $payload['status'] : 'draft');
			$scheduled_at = $this->sanitize_scheduled_at(isset($payload['scheduledAt']) ? $payload['scheduledAt'] : '', $status);
			$selected_category_ids = $this->sanitize_int_array(isset($payload['selectedCategoryIds']) ? $payload['selectedCategoryIds'] : array());
			$new_category_name = $this->sanitize_text(isset($payload['newCategoryName']) ? $payload['newCategoryName'] : '');
			$seo_provider = $this->sanitize_seo_provider(isset($payload['seoProvider']) ? $payload['seoProvider'] : 'None');

			$draft = $this->read_google_doc_post($document);
			$category_ids = $selected_category_ids;
			foreach ($draft['categories'] as $category_name) {
				$category_ids[] = $this->ensure_category($category_name);
			}
			if ($new_category_name) {
				$category_ids[] = $this->ensure_category($new_category_name);
			}
			$category_ids = array_values(array_unique($category_ids));
			$tag_names = isset($draft['tags']) ? $this->sanitize_string_list($draft['tags']) : array();

			$uploaded_doc_images = array();
			$image_replacements = array();
			$doc_images = !empty($draft['images']) && is_array($draft['images']) ? $draft['images'] : array();
			foreach ($doc_images as $index => $doc_image) {
				if (empty($doc_image['url'])) {
					continue;
				}
				$downloaded = !empty($doc_image['imageBase64']) && !empty($doc_image['mimeType'])
					? array(
						'imageBase64' => (string) $doc_image['imageBase64'],
						'mimeType' => (string) $doc_image['mimeType'],
					)
					: $this->fetch_remote_image_as_base64($doc_image['url']);
				$media_title = !empty($doc_image['title']) ? $doc_image['title'] : (!empty($doc_image['altText']) ? $doc_image['altText'] : sprintf('%s image %d', $draft['title'], $index + 1));
				$alt_text = !empty($doc_image['altText']) ? $doc_image['altText'] : (!empty($doc_image['title']) ? $doc_image['title'] : (($index === 0) ? 'Featured image for ' . $draft['title'] : sprintf('Image %d for %s', $index + 1, $draft['title'])));
				$uploaded = $this->upload_base64_image_to_media(
					$downloaded['imageBase64'],
					$downloaded['mimeType'],
					$media_title,
					($draft['slug'] ? $draft['slug'] : 'google-doc') . '-' . ($index + 1) . '.png',
					$alt_text
				);
				$uploaded_doc_images[] = array(
					'originalUrl' => (string) $doc_image['url'],
					'id' => (int) $uploaded['id'],
					'sourceUrl' => (string) $uploaded['source_url'],
					'altText' => $alt_text,
					'title' => $media_title,
				);
				$image_replacements[(string) $doc_image['url']] = array(
					'sourceUrl' => (string) $uploaded['source_url'],
					'altText' => $alt_text,
					'title' => $media_title,
				);
				$image_replacements[$this->normalize_image_source_key((string) $doc_image['url'])] = array(
					'sourceUrl' => (string) $uploaded['source_url'],
					'altText' => $alt_text,
					'title' => $media_title,
				);
			}

			$featured_media = !empty($uploaded_doc_images[0])
				? array(
					'id' => (int) $uploaded_doc_images[0]['id'],
					'source_url' => (string) $uploaded_doc_images[0]['sourceUrl'],
				)
				: null;

			$content_html = wp_kses_post($this->open_links_in_new_tabs($this->replace_image_sources($draft['html'], $image_replacements)));
			if (!empty($featured_media['source_url'])) {
				$content_html = $this->remove_image_source_from_html($content_html, (string) $featured_media['source_url']);
			}
			if (!$this->has_publishable_post_content($content_html)) {
				throw new AI_Article_Publisher_Error('Google Doc content could not be converted into a publishable post body. Please check that the document has readable text below the title and try again.', 400, array('documentId' => $draft['documentId']));
			}
			$excerpt = $draft['excerpt'] ? $draft['excerpt'] : $this->truncate($this->strip_html_text($content_html), 160);
			$html_for_publish = $content_html;
			$post = $this->create_post(
				array(
					'title' => $draft['title'],
					'slug' => $draft['slug'],
					'html' => $html_for_publish,
					'excerpt' => $excerpt,
					'status' => $status,
					'date' => $scheduled_at,
					'featured_media_id' => !empty($featured_media['id']) ? (int) $featured_media['id'] : 0,
					'categories' => $category_ids,
					'tags' => $tag_names,
				)
			);
			foreach ($uploaded_doc_images as $uploaded_doc_image) {
				if (!empty($uploaded_doc_image['id'])) {
					wp_update_post(
						array(
							'ID' => (int) $uploaded_doc_image['id'],
							'post_parent' => (int) $post['id'],
						)
					);
				}
			}

			$featured_image_url = !empty($featured_media['source_url']) ? (string) $featured_media['source_url'] : '';
			$seo_payload = $this->build_google_doc_fallback_seo_payload($draft, $excerpt, $featured_image_url);
			$seo_update = $this->apply_seo_meta((int) $post['id'], $seo_provider, $seo_payload, $featured_image_url);
			$this->add_log('Google Docs', 'import_google_doc', 'success', '', (int) $post['id']);

			wp_send_json_success(
				array(
					'documentId' => $draft['documentId'],
					'documentName' => $draft['documentName'],
					'title' => $draft['title'],
					'slug' => $draft['slug'],
					'postId' => (int) $post['id'],
					'link' => (string) $post['link'],
					'status' => (string) $post['status'],
					'featuredImage' => $featured_media
						? array(
							'id' => (int) $featured_media['id'],
							'sourceUrl' => (string) $featured_media['source_url'],
							'source' => 'google-doc',
						)
						: null,
					'importedImages' => $uploaded_doc_images,
					'categories' => $category_ids,
					'tags' => $tag_names,
					'seoUpdate' => $seo_update,
					'seoSource' => ('None' === $seo_provider) ? 'skipped' : 'google-doc',
				)
			);
		} catch (Throwable $error) {
			$this->add_log('Google Docs', 'import_google_doc', 'error', $error->getMessage(), 0);
			$this->send_exception($error);
		}
	}

	public function ajax_news_autopilot()
	{
		$this->guard_ajax('edit_posts');

		try {
			$payload = $this->read_payload();
			$category = $this->sanitize_news_category(isset($payload['category']) ? $payload['category'] : '');
			$query = $this->sanitize_text(isset($payload['query']) ? $payload['query'] : '');
			$language = $this->sanitize_text(isset($payload['language']) ? $payload['language'] : 'en');
			$max_articles = $this->sanitize_int(isset($payload['maxArticles']) ? $payload['maxArticles'] : 1, 1, 5);
			$tone = $this->require_text(isset($payload['tone']) ? $payload['tone'] : $this->get_settings()['default_tone'], 'Tone is required.', 1);
			$word_count = $this->sanitize_int(isset($payload['wordCount']) ? $payload['wordCount'] : 1200, 300, 5000);
			$status = $this->sanitize_status(isset($payload['status']) ? $payload['status'] : 'publish');
			$scheduled_at = $this->sanitize_scheduled_at(isset($payload['scheduledAt']) ? $payload['scheduledAt'] : '', $status);
			$selected_category_ids = $this->sanitize_int_array(isset($payload['selectedCategoryIds']) ? $payload['selectedCategoryIds'] : array());
			$new_category_name = $this->sanitize_text(isset($payload['newCategoryName']) ? $payload['newCategoryName'] : '');
			$inline_image_count = $this->sanitize_int(isset($payload['inPostImageCount']) ? $payload['inPostImageCount'] : 0, 0, 10);
			$seo_provider = $this->sanitize_seo_provider(isset($payload['seoProvider']) ? $payload['seoProvider'] : 'None');

			$category_ids = $selected_category_ids;
			if ($new_category_name) {
				$category_ids[] = $this->ensure_category($new_category_name);
			}
			$category_ids = array_values(array_unique($category_ids));

			$source_articles = $this->fetch_news_by_category(array('category' => $category, 'query' => $query, 'language' => $language, 'maxArticles' => $max_articles));
			$results = array();
			$failures = array();
			$base_schedule_timestamp = $scheduled_at ? strtotime($scheduled_at) : 0;

			foreach ($source_articles as $index => $source) {
				try {
					$generated = $this->rewrite_news_as_original_article(array('category' => $category, 'tone' => $tone, 'wordCount' => $word_count, 'article' => $source));
					$featured_image = $this->generate_featured_image(array('title' => $generated['meta']['title'], 'brief' => $generated['meta']['excerpt']));
					$featured_media = $this->upload_base64_image_to_media($featured_image['imageBase64'], $featured_image['mimeType'], $generated['meta']['title'], $featured_image['filenameSuggestion'], $featured_image['altTextSuggestion']);

					$html_for_publish = $generated['html'];
					$inline_images = array();
					if ($inline_image_count > 0) {
						$generated_inline_images = $this->generate_inline_article_images(array('title' => $generated['meta']['title'], 'brief' => $generated['meta']['excerpt'], 'count' => $inline_image_count));
						foreach ($generated_inline_images as $inline_index => $generated_inline_image) {
							$media = $this->upload_base64_image_to_media($generated_inline_image['imageBase64'], $generated_inline_image['mimeType'], sprintf('%s inline image %d', $generated['meta']['title'], $inline_index + 1), $generated_inline_image['filenameSuggestion'], $generated_inline_image['altTextSuggestion']);
							$inline_images[] = array('id' => (int) $media['id'], 'sourceUrl' => (string) $media['source_url'], 'altText' => (string) $generated_inline_image['altTextSuggestion']);
						}
						$html_for_publish = $this->inject_inline_images_into_html($html_for_publish, $inline_images);
					}

					$item_scheduled_at = '';
					if ('future' === $status && $base_schedule_timestamp > 0) {
						$item_scheduled_at = gmdate('c', $base_schedule_timestamp + ($index * 15 * MINUTE_IN_SECONDS));
					}

					$post = $this->create_post(array(
						'title' => $generated['meta']['title'],
						'html' => $html_for_publish,
						'excerpt' => $generated['meta']['excerpt'],
						'status' => $status,
						'date' => $item_scheduled_at,
						'featured_media_id' => (int) $featured_media['id'],
						'categories' => $category_ids,
						'tags' => $generated['meta']['suggestedTags'],
					));

					$seo_update = $this->apply_seo_meta((int) $post['id'], $seo_provider, $generated['meta']['seo'], (string) $featured_media['source_url']);
					$this->add_log('NewsData', 'news_autopilot', 'success', '', (int) $post['id']);
					$results[] = array(
						'source' => array('title' => $source['title'], 'link' => $source['link'], 'sourceName' => isset($source['sourceName']) ? $source['sourceName'] : ''),
						'postId' => (int) $post['id'],
						'link' => (string) $post['link'],
						'status' => (string) $post['status'],
						'scheduledAt' => $item_scheduled_at ? $item_scheduled_at : null,
						'categories' => $category_ids,
						'inlineImages' => $inline_images,
						'seoUpdate' => $seo_update,
					);
				} catch (Throwable $item_error) {
					$this->add_log('NewsData', 'news_autopilot', 'error', $item_error->getMessage(), 0);
					$failures[] = array(
						'source' => array('title' => $source['title'], 'link' => $source['link']),
						'error' => $this->format_error($item_error),
					);
				}
			}

			if (empty($results)) {
				throw new AI_Article_Publisher_Error('Failed to auto-publish any news articles.', 502, array('failures' => $failures));
			}

			wp_send_json_success(array(
				'requested' => $max_articles,
				'published' => count($results),
				'failed' => count($failures),
				'category' => $category,
				'status' => $status,
				'results' => $results,
				'failures' => $failures,
			));
		} catch (Throwable $error) {
			$this->add_log('NewsData', 'news_autopilot', 'error', $error->getMessage(), 0);
			$this->send_exception($error);
		}
	}

	private function fetch_remote_image_as_base64($url)
	{
		$response = wp_remote_get($url, array('timeout' => 60));
		if (is_wp_error($response)) {
			throw new AI_Article_Publisher_Error($response->get_error_message(), 502);
		}

		$status_code = (int) wp_remote_retrieve_response_code($response);
		if ($status_code < 200 || $status_code >= 300) {
			throw new AI_Article_Publisher_Error('Failed to download featured image.', 502, array('url' => $url, 'status' => $status_code));
		}

		$mime_type = trim((string) strtok((string) wp_remote_retrieve_header($response, 'content-type'), ';'));
		if (!$mime_type || 0 !== strpos($mime_type, 'image/')) {
			throw new AI_Article_Publisher_Error('Featured image URL did not return an image.', 400, array('url' => $url, 'mimeType' => $mime_type));
		}

		return array(
			'imageBase64' => base64_encode((string) wp_remote_retrieve_body($response)),
			'mimeType' => $mime_type,
		);
	}

	private function fetch_news_by_category($params)
	{
		$settings = $this->get_settings();
		$api_key = trim((string) $settings['newsdata_api_key']);
		if (!$api_key) {
			throw new AI_Article_Publisher_Error('NewsData API key is missing. Save it in the plugin settings first.', 500);
		}

		$url = add_query_arg(
			array(
				'apikey' => $api_key,
				'category' => $params['category'],
				'language' => !empty($params['language']) ? $params['language'] : 'en',
				'size' => min(max(((int) $params['maxArticles']) * 3, 10), 50),
				'q' => !empty($params['query']) ? $params['query'] : null,
			),
			'https://newsdata.io/api/1/news'
		);

		$decoded = $this->decode_remote_json(wp_remote_get($url, array('timeout' => 60)), 'NewsData API request failed.');
		if (empty($decoded['status']) || 'success' !== $decoded['status']) {
			throw new AI_Article_Publisher_Error('NewsData API returned an invalid response.', 502, $decoded);
		}

		$results = isset($decoded['results']) && is_array($decoded['results']) ? $decoded['results'] : array();
		$dedupe = array();
		$normalized = array();
		foreach ($results as $article) {
			$item = $this->normalize_news_article($article);
			if (empty($item)) {
				continue;
			}
			$key = strtolower($item['link']) . '|' . strtolower($item['title']);
			if (isset($dedupe[$key])) {
				continue;
			}
			$dedupe[$key] = true;
			$normalized[] = $item;
		}

		if (empty($normalized)) {
			throw new AI_Article_Publisher_Error('No usable news articles were returned for this category.', 404);
		}

		return array_slice($normalized, 0, (int) $params['maxArticles']);
	}

	private function normalize_news_article($article)
	{
		if (!is_array($article)) {
			return array();
		}

		$title = $this->normalize_news_text(isset($article['title']) ? $article['title'] : '');
		$description = $this->pick_news_description($article);
		$content = $this->pick_news_content($article);
		$link = trim((string) (isset($article['link']) ? $article['link'] : ''));
		if (!$title || !$description || !$link) {
			return array();
		}

		return array(
			'title' => $title,
			'description' => $description,
			'content' => $content,
			'link' => $link,
			'imageUrl' => !empty($article['image_url']) ? trim((string) $article['image_url']) : '',
			'publishedAt' => !empty($article['pubDate']) ? trim((string) $article['pubDate']) : '',
			'sourceName' => !empty($article['source_name']) ? trim((string) $article['source_name']) : (!empty($article['source_id']) ? trim((string) $article['source_id']) : ''),
			'categories' => !empty($article['category']) && is_array($article['category']) ? array_values(array_filter(array_map(array($this, 'sanitize_text'), $article['category']))) : array(),
		);
	}

	private function normalize_news_text($value)
	{
		$text = $this->strip_html_text((string) $value);
		$text = preg_replace('/^only available.*$/i', '', $text);
		return trim((string) $text);
	}

	private function pick_news_description($article)
	{
		$description = $this->normalize_news_text(isset($article['description']) ? $article['description'] : '');
		if ($description) {
			return $description;
		}
		$content = $this->normalize_news_text(isset($article['content']) ? $article['content'] : '');
		return $content ? $this->truncate($content, 260) : '';
	}

	private function pick_news_content($article)
	{
		$content = $this->normalize_news_text(isset($article['content']) ? $article['content'] : '');
		return $content ? $content : $this->normalize_news_text(isset($article['description']) ? $article['description'] : '');
	}

	private function extract_google_doc_id($input)
	{
		$input = trim((string) $input);
		if (preg_match('#/document/d/([a-zA-Z0-9\-_]+)#', $input, $matches)) {
			return $matches[1];
		}
		return $input;
	}

	private function read_google_doc_post($document)
	{
		$document_id = $this->extract_google_doc_id($document);
		$export_url = sprintf('https://docs.google.com/document/d/%s/export?format=txt', rawurlencode($document_id));
		$response = wp_remote_get($export_url, array('timeout' => 60, 'redirection' => 5));
		if (is_wp_error($response)) {
			throw new AI_Article_Publisher_Error($response->get_error_message(), 502);
		}

		$status_code = (int) wp_remote_retrieve_response_code($response);
		$body = (string) wp_remote_retrieve_body($response);
		$final_url = (string) wp_remote_retrieve_header($response, 'x-final-url');
		if ($this->is_google_access_wall($body, $final_url) || 401 === $status_code || 403 === $status_code) {
			throw new AI_Article_Publisher_Error('This Google Doc is not accessible from the link alone. Share it as "Anyone with the link can view" or publish it to the web, then try again.', 403, array('documentId' => $document_id, 'status' => $status_code));
		}
		if ($status_code < 200 || $status_code >= 300) {
			throw new AI_Article_Publisher_Error('Failed to export Google Doc content.', 502, array('documentId' => $document_id, 'status' => $status_code, 'body' => substr($body, 0, 500)));
		}
		if (!trim($body)) {
			throw new AI_Article_Publisher_Error('Google Doc is empty or could not be exported.', 400, array('documentId' => $document_id));
		}

		$parsed = $this->parse_google_doc_markdown($body, 'Untitled');
		$html_export = $this->fetch_google_doc_html_export($document_id);
		$image_items = !empty($html_export['images']) ? $html_export['images'] : array();
		$image_urls = array();
		foreach ($image_items as $image_item) {
			if (!empty($image_item['url'])) {
				$image_urls[] = $image_item['url'];
			}
		}
		$featured_image_source = empty($parsed['featuredImageUrl']) ? 'none' : 'provided';
		if (!empty($parsed['featuredImageUrl'])) {
			array_unshift(
				$image_items,
				array(
					'url' => $parsed['featuredImageUrl'],
					'altText' => '',
					'title' => '',
				)
			);
		} elseif (!empty($image_items[0]['url'])) {
			$parsed['featuredImageUrl'] = $image_items[0]['url'];
			$featured_image_source = 'google-doc';
		}
		$image_items = $this->dedupe_google_doc_images($image_items);
		$image_urls = array();
		foreach ($image_items as $image_item) {
			$image_urls[] = $image_item['url'];
		}
		$parsed['imageUrls'] = $image_urls;
		$parsed['images'] = $image_items;
		$parsed['featuredImageSource'] = $featured_image_source;
		if (!empty($html_export['html']) && $this->is_google_doc_html_export_complete($html_export['html'], $parsed['html'])) {
			$parsed['html'] = $html_export['html'];
		}
		// Do not append images at the bottom. Only replace images where Google's
		// HTML export exposes their original inline position.
		if (!$parsed['title']) {
			throw new AI_Article_Publisher_Error('Google Doc is missing a usable title.', 400);
		}
		if (!$parsed['html']) {
			throw new AI_Article_Publisher_Error('Google Doc is missing usable content.', 400);
		}

		return array(
			'documentId' => $document_id,
			'documentName' => $parsed['title'],
		) + $parsed;
	}

	private function is_google_access_wall($body, $final_url)
	{
		return false !== stripos((string) $final_url, 'accounts.google.com')
			|| preg_match('/ServiceLogin|Sign in - Google Accounts|To continue, sign in/i', (string) $body);
	}

	private function fetch_google_doc_html_export($document_id)
	{
		$candidates = array(
			sprintf('https://docs.google.com/document/d/%s/export?format=html', rawurlencode($document_id)),
			sprintf('https://docs.google.com/document/d/%s/mobilebasic', rawurlencode($document_id)),
		);

		foreach ($candidates as $url) {
			$response = wp_remote_get($url, array('timeout' => 60, 'redirection' => 5));
			if (is_wp_error($response)) {
				continue;
			}
			$status_code = (int) wp_remote_retrieve_response_code($response);
			$body = (string) wp_remote_retrieve_body($response);
			$final_url = (string) wp_remote_retrieve_header($response, 'x-final-url');
			if ($status_code < 200 || $status_code >= 300 || $this->is_google_access_wall($body, $final_url)) {
				continue;
			}
			$html = $this->normalize_google_doc_html($body, $url);
			return array(
				'html' => $html,
				'images' => $this->dedupe_google_doc_images(array_merge(
					$this->extract_image_items_from_html($body, $url),
					$this->extract_image_items_from_html($html, $url)
				)),
			);
		}

		return array('html' => '', 'images' => array());
	}

	private function extract_image_items_from_html($html, $base_url)
	{
		$images = array();
		if (!preg_match_all('/<img\b[^>]*>/i', (string) $html, $matches)) {
			return array();
		}

		foreach ($matches[0] as $image_tag) {
			$src = html_entity_decode(trim((string) $this->get_html_attribute($image_tag, 'src')), ENT_QUOTES, 'UTF-8');
			if (!$src) {
				continue;
			}
			$inline_image = $this->parse_inline_base64_image_source($src);
			if (!empty($inline_image)) {
				$images[] = array(
					'url' => $src,
					'altText' => sanitize_text_field($this->get_html_attribute($image_tag, 'alt')),
					'title' => sanitize_text_field($this->get_html_attribute($image_tag, 'title')),
					'imageBase64' => $inline_image['imageBase64'],
					'mimeType' => $inline_image['mimeType'],
				);
				continue;
			}
			if (0 === strpos($src, '//')) {
				$src = 'https:' . $src;
			} elseif (!preg_match('/^https?:\/\//i', $src)) {
				$src = $this->resolve_url($src, $base_url);
			}
			if ($src && preg_match('/^https?:\/\//i', $src)) {
				$images[] = array(
					'url' => esc_url_raw($src),
					'altText' => sanitize_text_field($this->get_html_attribute($image_tag, 'alt')),
					'title' => sanitize_text_field($this->get_html_attribute($image_tag, 'title')),
				);
			}
		}

		return $this->dedupe_google_doc_images($images);
	}

	private function get_html_attribute($html, $attribute)
	{
		if (preg_match('/\b' . preg_quote($attribute, '/') . '\s*=\s*([\'"])(.*?)\1/i', (string) $html, $matches)) {
			return html_entity_decode((string) $matches[2], ENT_QUOTES, 'UTF-8');
		}
		return '';
	}

	private function parse_inline_base64_image_source($src)
	{
		$src = trim((string) $src);
		if (!preg_match('/^(?:data:)?(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i', $src, $matches)) {
			return array();
		}

		$image_base64 = preg_replace('/\s+/', '', (string) $matches[2]);
		if (!$image_base64 || false === base64_decode($image_base64, true)) {
			return array();
		}

		return array(
			'mimeType' => strtolower((string) $matches[1]),
			'imageBase64' => $image_base64,
		);
	}

	private function dedupe_google_doc_images($images)
	{
		$seen = array();
		$deduped = array();
		foreach ($images as $image) {
			if (empty($image['url']) || isset($seen[$image['url']])) {
				continue;
			}
			$seen[$image['url']] = true;
			$deduped[] = $image;
		}
		return $deduped;
	}

	private function normalize_google_doc_html($html, $base_url)
	{
		$body = (string) $html;
		if (preg_match('/<body[^>]*>([\s\S]*?)<\/body>/i', $body, $matches)) {
			$body = (string) $matches[1];
		}
		$body = preg_replace('/<script\b[\s\S]*?<\/script>/i', '', $body);
		$body = preg_replace('/<style\b[\s\S]*?<\/style>/i', '', $body);
		$body = preg_replace('/<meta\b[^>]*>/i', '', $body);
		$body = preg_replace('/<link\b[^>]*>/i', '', $body);
		$body = $this->inline_google_doc_class_styles($body, $html);
		$body = $this->strip_front_matter_from_html($body);
		$body = $this->remove_google_doc_metadata_blocks($body);
		$body = $this->convert_inline_styled_headings($body);
		$body = $this->absolutize_image_sources($body, $base_url);
		$body = $this->normalize_google_doc_links($body, $base_url);
		$body = $this->apply_google_doc_image_alignment($body);
		$body = $this->make_google_doc_html_responsive($body);
		$body = preg_replace('/<p\b[^>]*>\s*<\/p>/i', '', $body);
		return $this->sanitize_google_doc_html_for_processing($body);
	}

	private function sanitize_google_doc_html_for_processing($html)
	{
		$allowed_protocols = array_values(array_unique(array_merge(wp_allowed_protocols(), array('data'))));
		return trim((string) wp_kses((string) $html, wp_kses_allowed_html('post'), $allowed_protocols));
	}

	private function parse_google_doc_class_styles($html)
	{
		$class_styles = array();
		if (!preg_match_all('/<style\b[^>]*>([\s\S]*?)<\/style>/i', (string) $html, $style_blocks)) {
			return $class_styles;
		}

		foreach ($style_blocks[1] as $css) {
			if (!preg_match_all('/([^{}]+)\{([^{}]*)\}/', (string) $css, $rules, PREG_SET_ORDER)) {
				continue;
			}
			foreach ($rules as $rule) {
				if (!preg_match_all('/\.([a-zA-Z0-9_-]+)/', (string) $rule[1], $class_matches)) {
					continue;
				}
				$declarations = trim((string) $rule[2]);
				$declarations = rtrim($declarations, ';');
				if (!$declarations) {
					continue;
				}
				foreach ($class_matches[1] as $class_name) {
					$class_styles[$class_name] = !empty($class_styles[$class_name])
						? $class_styles[$class_name] . '; ' . $declarations
						: $declarations;
				}
			}
		}

		return $class_styles;
	}

	private function merge_style_attributes($existing_style, $class_style)
	{
		$existing = rtrim(trim((string) $existing_style), ';');
		$from_class = rtrim(trim((string) $class_style), ';');
		if (!$existing) {
			return $from_class;
		}
		if (!$from_class) {
			return $existing;
		}
		return $from_class . '; ' . $existing;
	}

	private function inline_google_doc_class_styles($body_html, $source_html)
	{
		$class_styles = $this->parse_google_doc_class_styles($source_html);
		if (empty($class_styles)) {
			return (string) $body_html;
		}

		return preg_replace_callback(
			'/<([a-z][a-z0-9]*)\b([^>]*)>/i',
			function ($matches) use ($class_styles) {
				$tag = (string) $matches[0];
				$name = (string) $matches[1];
				$attrs = (string) $matches[2];
				$class_value = $this->get_html_attribute($tag, 'class');
				if (!$class_value) {
					return $tag;
				}

				$merged_class_style = array();
				foreach (preg_split('/\s+/', $class_value) as $class_name) {
					if (!empty($class_styles[$class_name])) {
						$merged_class_style[] = $class_styles[$class_name];
					}
				}
				if (empty($merged_class_style)) {
					return $tag;
				}

				$existing_style = $this->get_html_attribute($tag, 'style');
				$merged_style = $this->merge_style_attributes($existing_style, implode('; ', $merged_class_style));
				if (preg_match('/\bstyle\s*=/i', $attrs)) {
					return preg_replace('/\bstyle\s*=\s*([\'"])(.*?)\1/i', 'style="' . esc_attr($merged_style) . '"', $tag, 1);
				}
				return '<' . $name . $attrs . ' style="' . esc_attr($merged_style) . '">';
			},
			(string) $body_html
		);
	}

	private function absolutize_image_sources($html, $base_url)
	{
		return preg_replace_callback(
			'/<img\b[^>]*>/i',
			function ($matches) use ($base_url) {
				$image_tag = $matches[0];
				$src = $this->get_html_attribute($image_tag, 'src');
				if (!$src || !empty($this->parse_inline_base64_image_source($src))) {
					return $image_tag;
				}
				if (0 === strpos($src, '//')) {
					$src = 'https:' . $src;
				} elseif (!preg_match('/^https?:\/\//i', $src)) {
					$src = $this->resolve_url($src, $base_url);
				}
				if (!$src) {
					return $image_tag;
				}
				if (preg_match('/\bsrc\s*=/i', $image_tag)) {
					return preg_replace('/\bsrc\s*=\s*([\'"])(.*?)\1/i', 'src="' . esc_url($src) . '"', $image_tag, 1);
				}
				return preg_replace('/\s*\/?>$/', ' src="' . esc_url($src) . '" />', $image_tag, 1);
			},
			(string) $html
		);
	}

	private function normalize_google_doc_links($html, $base_url)
	{
		return preg_replace_callback(
			'/<a\b[^>]*>/i',
			function ($matches) use ($base_url) {
				$anchor_tag = $matches[0];
				$href = $this->get_html_attribute($anchor_tag, 'href');
				if (!$href) {
					return $anchor_tag;
				}

				$href = $this->unwrap_google_redirect_url($href);
				if (0 === strpos($href, '//')) {
					$href = 'https:' . $href;
				} elseif ('#' !== substr($href, 0, 1) && !preg_match('/^[a-z][a-z0-9+.-]*:/i', $href)) {
					$href = $this->resolve_url($href, $base_url);
				}
				if (!$href) {
					return $anchor_tag;
				}

				if (preg_match('/\bhref\s*=/i', $anchor_tag)) {
					$anchor_tag = preg_replace('/\bhref\s*=\s*([\'"])(.*?)\1/i', 'href="' . esc_url($href) . '"', $anchor_tag, 1);
				} else {
					$anchor_tag = preg_replace('/>$/', ' href="' . esc_url($href) . '">', $anchor_tag, 1);
				}

				if ('#' !== substr($href, 0, 1)) {
					$anchor_tag = $this->set_anchor_attribute($anchor_tag, 'target', '_blank');
					$anchor_tag = $this->set_anchor_attribute($anchor_tag, 'rel', 'noopener noreferrer');
				}
				return $anchor_tag;
			},
			(string) $html
		);
	}

	private function open_links_in_new_tabs($html)
	{
		return preg_replace_callback(
			'/<a\b[^>]*>/i',
			function ($matches) {
				$anchor_tag = $matches[0];
				$href = $this->get_html_attribute($anchor_tag, 'href');
				if (!$href || '#' === substr($href, 0, 1)) {
					return $anchor_tag;
				}
				$anchor_tag = $this->set_anchor_attribute($anchor_tag, 'target', '_blank');
				return $this->set_anchor_attribute($anchor_tag, 'rel', 'noopener noreferrer');
			},
			(string) $html
		);
	}

	private function make_google_doc_html_responsive($html)
	{
		$html = preg_replace_callback(
			'/<([a-z][a-z0-9]*)\b([^>]*)>/i',
			function ($matches) {
				$tag_name = strtolower((string) $matches[1]);
				$tag = (string) $matches[0];
				$existing_class = $this->get_html_attribute($tag, 'class');
				$tag = preg_replace('/\s*\bclass\s*=\s*([\'"])(.*?)\1/i', '', $tag);
				if (!preg_match('/^h[1-6]$/', $tag_name)) {
					$tag = preg_replace('/\s*\bid\s*=\s*([\'"])(.*?)\1/i', '', $tag);
				}
				$style = $this->get_html_attribute($tag, 'style');
				if ('' !== $style) {
					$clean_style = $this->normalize_google_doc_style_attribute($style, $tag_name);
					if ('' !== $clean_style) {
						$tag = preg_replace('/\bstyle\s*=\s*([\'"])(.*?)\1/i', 'style="' . esc_attr($clean_style) . '"', $tag, 1);
					} else {
						$tag = preg_replace('/\s*\bstyle\s*=\s*([\'"])(.*?)\1/i', '', $tag, 1);
					}
				}

				if ('img' === $tag_name) {
					$alignment = $this->extract_alignment_from_class($existing_class);
					if ($alignment) {
						$tag = $this->set_html_class($tag, 'align' . $alignment);
					}
					$tag = $this->set_image_attribute($tag, 'style', $this->build_responsive_image_style($alignment));
					$tag = preg_replace('/\s*\bwidth\s*=\s*([\'"])(.*?)\1/i', '', $tag);
					$tag = preg_replace('/\s*\bheight\s*=\s*([\'"])(.*?)\1/i', '', $tag);
				}

				return $tag;
			},
			(string) $html
		);

		return (string) $html;
	}

	private function apply_google_doc_image_alignment($html)
	{
		return preg_replace_callback(
			'/<p\b[^>]*>[\s\S]*?<\/p>/i',
			function ($matches) {
				$paragraph = (string) $matches[0];
				if (false === stripos($paragraph, '<img')) {
					return $paragraph;
				}
				$alignment = $this->detect_google_doc_block_alignment($paragraph);
				if (!$alignment) {
					return $paragraph;
				}

				return preg_replace_callback(
					'/<img\b[^>]*>/i',
					function ($image_matches) use ($alignment) {
						return $this->set_html_class($image_matches[0], 'align' . $alignment);
					},
					$paragraph
				);
			},
			(string) $html
		);
	}

	private function detect_google_doc_block_alignment($html)
	{
		$alignment = $this->extract_alignment_from_class($this->get_html_attribute($html, 'class'));
		if ($alignment) {
			return $alignment;
		}

		$style = $this->get_html_attribute($html, 'style');
		if (preg_match('/float\s*:\s*(left|right)/i', $style, $matches)) {
			return strtolower((string) $matches[1]);
		}
		if (preg_match('/text-align\s*:\s*(right|center)/i', $style, $matches)) {
			return strtolower((string) $matches[1]);
		}

		if (
			preg_match(
				'/<(?:span|img)\b[^>]*\bstyle\s*=\s*([\'"])(.*?)\1/i',
				(string) $html,
				$matches
			)
			&& preg_match('/float\s*:\s*(left|right)/i', (string) $matches[2], $style_matches)
		) {
			return strtolower((string) $style_matches[1]);
		}
		if (
			preg_match(
				'/<(?:span|img)\b[^>]*\bstyle\s*=\s*([\'"])(.*?)\1/i',
				(string) $html,
				$matches
			)
			&& preg_match(
				'/text-align\s*:\s*(right|center)/i',
				(string) $matches[2],
				$style_matches
			)
		) {
			return strtolower((string) $style_matches[1]);
		}

		return '';
	}

	private function extract_alignment_from_class($class_value)
	{
		if (preg_match(
			'/(?:^|\s)align(left|right|center)(?:\s|$)/i',
			(string) $class_value,
			$matches
		)) {
			return strtolower((string) $matches[1]);
		}
		return '';
	}

	private function build_responsive_image_style($alignment)
	{
		$style = 'max-width:100%;height:auto;';
		if ('right' === $alignment) {
			return $style . 'float:right;margin:0 0 1em 1.5em;';
		}
		if ('left' === $alignment) {
			return $style . 'float:left;margin:0 1.5em 1em 0;';
		}
		if ('center' === $alignment) {
			return $style . 'display:block;margin-left:auto;margin-right:auto;';
		}
		return $style;
	}

	private function normalize_google_doc_style_attribute($style, $tag_name)
	{
		$blocked = array(
			'display',
			'white-space',
			'margin',
			'margin-left',
			'margin-right',
			'padding',
			'padding-left',
			'padding-right',
			'width',
			'height',
			'min-width',
			'max-width',
			'min-height',
			'max-height',
			'overflow',
			'transform',
			'-webkit-transform',
			'list-style-type',
		);
		$allowed_by_tag = array(
			'a' => array('color', 'text-decoration'),
			'span' => array('color', 'font-weight', 'font-style', 'text-decoration'),
			'strong' => array('font-weight'),
			'em' => array('font-style'),
			'p' => array('text-align'),
			'h1' => array('text-align'),
			'h2' => array('text-align'),
			'h3' => array('text-align'),
			'h4' => array('text-align'),
			'h5' => array('text-align'),
			'h6' => array('text-align'),
		);
		$allowed = array();
		foreach (explode(';', (string) $style) as $declaration) {
			$declaration = trim((string) $declaration);
			if ('' === $declaration || false === strpos($declaration, ':')) {
				continue;
			}
			list($property, $value) = array_map('trim', explode(':', $declaration, 2));
			$property = strtolower((string) $property);
			if (in_array($property, $blocked, true)) {
				continue;
			}
			if (empty($allowed_by_tag[$tag_name]) || !in_array(
				$property,
				$allowed_by_tag[$tag_name],
				true
			)) {
				continue;
			}
			$allowed[] = $property . ':' . $value;
		}
		return implode(';', $allowed);
	}

	private function unwrap_google_redirect_url($url)
	{
		$url = html_entity_decode(trim((string) $url), ENT_QUOTES, 'UTF-8');
		$parts = wp_parse_url($url);
		$host = isset($parts['host']) ? strtolower((string) $parts['host']) : '';
		$path = isset($parts['path']) ? (string) $parts['path'] : '';
		if (
			!$host || !preg_match('/(^|\.)google\.[a-z.]+$/i', $host) || '/url' !== $path ||
			empty($parts['query'])
		) {
			return $url;
		}

		$query = array();
		wp_parse_str((string) $parts['query'], $query);
		foreach (array('q', 'url') as $key) {
			if (!empty($query[$key]) && is_string($query[$key])) {
				return trim((string) $query[$key]);
			}
		}
		return $url;
	}

	private function convert_inline_styled_headings($html)
	{
		return preg_replace_callback(
			'/<p\b([^>]*)>([\s\S]*?)<\/p>/i',
			function ($matches) {
				$attrs = (string) $matches[1];
				$inner = (string) $matches[2];
				$text = $this->normalize_meta_text($this->strip_html_text($inner));
				if (preg_match('/^(#{1,3})\s+(.+)$/', $text, $heading_match)) {
					$level = strlen($heading_match[1]);
					$clean_inner = preg_replace('/^(\s*<[^>]+>)*\s*#{1,3}\s*/i', '', $inner, 1);
					return $this->build_google_doc_heading_tag(
						$level,
						$attrs,
						$clean_inner
					);
				}
				$style_text = $attrs . ' '
					. $inner;
				$class_value = $this->get_html_attribute(
					'<p' . $attrs . '>',
					'class'
				);
				if (preg_match('/(^|\s)title(\s|$)/i', $class_value)) {
					return
						$this->build_google_doc_heading_tag(1, $attrs, $inner);
				}
				if (preg_match('/(^|\s)subtitle(\s|$)/i', $class_value)) {
					return $this->build_google_doc_heading_tag(2, $attrs, $inner);
				}
				if (!preg_match(
					'/font-size\s*:\s*([0-9.]+)\s*(pt|px)/i',
					$style_text,
					$size_match
				)) {
					return
						$matches[0];
				}
				$size = (float) $size_match[1];
				$size_px = ('pt' === strtolower($size_match[2])) ? $size *
					1.333 : $size;
				$is_bold = (bool) preg_match(
					'/font-weight\s*:\s*(bold|[6-9]00)|<b\b|<strong\b /i',
					$style_text
				);
				if ($size_px >= 31) {
					return $this->build_google_doc_heading_tag(1, $attrs, $inner);
				}
				if ($size_px >= 23) {
					return $this->build_google_doc_heading_tag(2, $attrs, $inner);
				}
				if ($size_px >= 18) {
					return $this->build_google_doc_heading_tag(3, $attrs, $inner);
				}
				if ($size_px >= 15 && $is_bold) {
					return $this->build_google_doc_heading_tag(4, $attrs, $inner);
				}
				return $matches[0];
			},
			(string) $html
		);
	}

	private function build_google_doc_heading_tag(
		$level,
		$attrs,
		$inner
	) {
		$level = min(max((int) $level, 1), 6);
		return '<h' . $level . $this->preserve_google_doc_block_attrs($attrs) . '>' .
			trim((string) $inner) . '</h' . $level . '>';
	}
	private
	function preserve_google_doc_block_attrs($attrs)
	{
		$source_tag = '<p' . (string) $attrs . '>';
		$output = '';
		foreach (
			array('id', 'class', 'style', 'dir') as
			$attribute
		) {
			$value = $this->get_html_attribute(
				$source_tag,
				$attribute
			);
			if ('' !== $value) {
				$output .= ' ' . $attribute . '="' . esc_attr($value) . '"';
			}
		}
		return $output;
	}

	private function strip_front_matter_from_html($html)
	{
		$output = trim((string) $html);
		$output = preg_replace(
			'/^\s*<[^>]+>\s*---\s*<\/[^>]+>\s*/i',
			'',
			$output,
			1
		);
		$guard = 0;
		while (
			$guard < 40 &&
			preg_match(
				'/^\s*<([a-z0-9]+)\b[^>]*>([\s\S]*?)<\/\1>\s*/i',
				$output,
				$matches
			)
		) {
			$text = $this->normalize_meta_text($this->strip_html_text($matches[2]));
			if ('---' === $text) {
				$output = substr($output, strlen($matches[0]));
				break;
			}
			if (!preg_match(
				'/^([^:]{1,60}):\s*(.*)$/',
				$text,
				$metadata_match
			)) {
				break;
			}
			$key =
				$this->normalize_metadata_key($metadata_match[1]);
			if (!$this->is_allowed_metadata_key($key)) {
				break;
			}
			$output = substr($output, strlen($matches[0]));
			$guard++;
		}
		return trim($output);
	}

	private function
	remove_google_doc_metadata_blocks($html)
	{
		return preg_replace_callback(
			'/<p\b[^>]*>([\s\S]*?)<\/p>/i',
			function ($matches) {
				$text =
					$this->normalize_meta_text($this->strip_html_text($matches[1]));
				if (!preg_match(
					'/^([^:]{1,60}):\s*(.*)$/',
					$text,
					$metadata_match
				)) {
					return $matches[0];
				}
				$key =
					$this->normalize_metadata_key($metadata_match[1]);
				return $this->is_allowed_metadata_key($key)
					? '' : $matches[0];
			},
			(string) $html
		);
	}

	private function
	has_useful_google_doc_html($html)
	{
		return (bool)
		trim($this->strip_html_text($html)) ||
			preg_match('/<img\b/i', (string) $html);
	}
	private function
	has_publishable_post_content($html)
	{
		$text = trim($this->strip_html_text($html));
		if (strlen($text) >= 80) {
			return true;
		}
		return (bool) preg_match('/<(h[1-6]|p|ul|ol|figure|img)\b/i', (string) $html);
	}
	private function
	is_google_doc_html_export_complete(
		$html,
		$fallback_html
	) {
		if (!$this->has_useful_google_doc_html($html)) {
			return false;
		}

		$html_text_length =
			strlen($this->strip_html_text($html));
		$fallback_text_length =
			strlen($this->strip_html_text($fallback_html));
		if ($fallback_text_length <= 0) {
			return
				true;
		}
		return $html_text_length >=
			max(80, (int)
			floor($fallback_text_length * 0.6));
	}
	private function resolve_url(
		$path,
		$base_url
	) {
		if (!$path) {
			return '';
		}
		$base = wp_parse_url($base_url);
		if (
			empty($base['scheme']) ||
			empty($base['host'])
		) {
			return '';
		}
		if ('/' === substr(
			$path,
			0,
			1
		)) {
			return $base['scheme'] . '://' .
				$base['host'] .
				$path;
		}
		$base_path = isset($base['path']) ?
			preg_replace(
				'/\/[^\/]*$/',
				'/',
				$base['path']
			) : '/';
		return
			$base['scheme'] . '://' .
			$base['host'] . $base_path . $path;
	}
	private function
	append_google_doc_images_if_missing(
		$html,
		$image_urls,
		$title
	) {
		if (
			empty($image_urls) ||
			preg_match('/<img\b/i', (string)
			$html)
		) {
			return $html;
		}
		$figures = array();
		foreach ($image_urls as $url) {
			$figures[] = sprintf(
				'<figure class="wp-block-image size-large"><img src="%s" alt="%s" loading="lazy" decoding="async" /></figure>',
				esc_url($url),
				esc_attr($title)
			);
		}
		return
			trim((string) $html) . "\n" .
			implode("\n", $figures);
	}
	private function
	replace_image_sources(
		$html,
		$replacements
	) {
		$updated = (string) $html;
		if (
			empty($replacements) ||
			!is_array($replacements)
		) {
			return $updated;
		}
		$replacement_lookup = array();
		foreach (
			$replacements as
			$source_url => $replacement
		) {
			$replacement_lookup[(string)
			$source_url] = $replacement;
			$replacement_lookup[$this->normalize_image_source_key((string)
			$source_url)] = $replacement;
		}
		return preg_replace_callback(
			'/<img\b[^>]*>/i',
			function ($matches)
			use ($replacement_lookup) {
				$image_tag = $matches[0];
				$src =
					$this->get_html_attribute(
						$image_tag,
						'src'
					);
				$src_key =
					$this->normalize_image_source_key((string)
					$src);
				if (
					!$src ||
					empty($replacement_lookup[$src])
					&&
					empty($replacement_lookup[$src_key])
				) {
					return $image_tag;
				}

				$replacement =
					!empty($replacement_lookup[$src])
					? $replacement_lookup[$src]
					:
					$replacement_lookup[$src_key];
				$updated = preg_replace(
					'/\bsrc\s*=\s*([\'"])(.*?)\1/i',
					'src="' .
						esc_url($replacement['sourceUrl'])
						. '"',
					$image_tag,
					1
				);
				$updated =
					$this->set_image_attribute(
						$updated,
						'alt',
						isset($replacement['altText'])
							? $replacement['altText'] :
							''
					);
				$updated =
					$this->set_image_attribute(
						$updated,
						'title',
						isset($replacement['title'])
							? $replacement['title'] : ''
					);
				return $updated;
			},
			$updated
		);
	}

	private function
	remove_image_source_from_html(
		$html,
		$image_url
	) {
		$image_url = trim((string)
		$image_url);
		if (!$image_url) {
			return (string) $html;
		}

		$updated = (string) $html;
		$quoted_url =
			preg_quote($image_url, '/');
		foreach (
			array(
				'figure',
				'p'
			) as $tag_name
		) {
			$updated =
				preg_replace_callback(
					'/<' . $tag_name
						. '\b[^>]*>[\s\S]*?<\/'
						. $tag_name . '>/i',
					function ($matches) use ($quoted_url) {
						if (!preg_match(
							'/<img\b[^>
                                                                                                ]*\bsrc\s*=\s*([\'"])' .
								$quoted_url . '\1/i',
							$matches[0]
						)) {
							return $matches[0];
						}
						$text_without_images =
							preg_replace(
								'/<img\b[^>]*>/i',
								'',
								$matches[0]
							);
						return '' ===
							trim($this->strip_html_text($text_without_images))
							?
							'' :
							$text_without_images;
					},
					$updated
				);
		}

		$updated =
			preg_replace(
				'/
                                                                                                    <img\b[^>
                                                                                                        ]*\bsrc\s*=\s*([\'"])'
					. $quoted_url .
					'\1[^>]*>/i',
				'',
				$updated
			);
		$updated =
			preg_replace(
				'/
                                                                                                        <p\b[^>]*>\s*<\
                                                                                                                /p>/i',
				'',
				$updated
			);
		return
			trim((string)
			$updated);
	}

	private
	function
	normalize_image_source_key($value)
	{
		$decoded
			=
			html_entity_decode(
				trim((string)
				$value),
				ENT_QUOTES,
				'UTF-8'
			);
		$decoded
			=
			str_replace(
				'&#38;',
				'&',
				$decoded
			);
		$decoded
			=
			preg_replace(
				'/^data:(image\/[a-z0-9.+-]+;base64,)/i',
				'$1',
				$decoded
			);
		return
			rawurldecode($decoded);
	}

	private
	function
	set_image_attribute(
		$image_tag,
		$attribute,
		$value
	) {
		$value =
			esc_attr((string)
			$value);
		if (preg_match(
			'/\b' .
				preg_quote(
					$attribute,
					'/'
				) .
				'\s*=/i',
			$image_tag
		)) {
			return
				preg_replace(
					'/\b' .
						preg_quote(
							$attribute,
							'/'
						) .
						'\s*=\s*([\'"])(.*?)\1/i',
					$attribute
						. '="' .
						$value .
						'"',
					$image_tag,
					1
				);
		}
		return
			preg_replace(
				'/\s*\/?>$/',
				' ' .
					$attribute
					. '="' .
					$value .
					'"
                                                                                                                />',
				$image_tag,
				1
			);
	}

	private
	function
	set_html_class(
		$tag,
		$class_name
	) {
		$class_name
			=
			sanitize_html_class((string)
			$class_name);
		if (!$class_name) {
			return
				(string)
				$tag;
		}

		$existing
			=
			$this->get_html_attribute(
				$tag,
				'class'
			);
		$classes
			=
			$existing
			?
			preg_split(
				'/\s+/',
				trim((string)
				$existing)
			)
			:
			array();
		if (!is_array($classes)) {
			$classes
				=
				array();
		}
		$classes[]
			=
			$class_name;
		$classes
			=
			array_values(array_unique(array_filter(array_map(
				'sanitize_html_class',
				$classes
			))));
		$class_attr
			=
			implode(
				'
                                                                                                                ',
				$classes
			);

		if (preg_match(
			'/\bclass\s*=/i',
			(string)
			$tag
		)) {
			return
				preg_replace(
					'/\bclass\s*=\s*([\'"])(.*?)\1/i',
					'class="'
						.
						esc_attr($class_attr)
						. '"',
					(string)
					$tag,
					1
				);
		}

		return
			preg_replace(
				'/\s*\/?>$/',
				'
                                                                                                                class="'
					.
					esc_attr($class_attr)
					. '"
                                                                                                                />',
				(string)
				$tag,
				1
			);
	}

	private
	function
	parse_google_doc_markdown(
		$markdown,
		$fallback_title
	) {
		$front_matter
			=
			$this->parse_front_matter($markdown);
		$metadata_source
			=
			!empty($front_matter)
			?
			$front_matter
			:
			$this->parse_leading_metadata($markdown);
		$metadata
			=
			$metadata_source['metadata'];
		$body =
			trim((string)
			preg_replace(
				'/^#{1,6}\s+content\s*$/im',
				'',
				(string)
				$metadata_source['body']
			));
		$title =
			$this->pick_metadata(
				$metadata,
				array('title')
			);

		if (
			!$title
			&&
			preg_match(
				'/^#\s+(.+)$/m',
				$body,
				$matches
			)
		) {
			$title =
				trim((string)
				$matches[1]);
			$body =
				trim((string)
				preg_replace(
					'/^#\s+.+\n*/m',
					'',
					$body,
					1
				));
		}
		if (!$title) {
			$lines =
				preg_split(
					'/\r?\n/',
					$body
				);
			if (is_array($lines)) {
				foreach (
					$lines
					as
					$line
				) {
					$line =
						trim((string)
						$line);
					if ($line) {
						$title =
							$line;
						$body =
							trim((string)
							preg_replace(
								'/^' .
									preg_quote(
										$line,
										'/'
									) .
									'\s*/',
								'',
								$body,
								1
							));
						break;
					}
				}
			}
		}

		$title =
			$title ?
			$title :
			$fallback_title;
		$html =
			$this->markdown_to_html($body);
		$excerpt
			=
			$this->pick_metadata(
				$metadata,
				array('excerpt')
			);
		$brief =
			$this->pick_metadata(
				$metadata,
				array(
					'brief',
					'image_prompt',
					'featured_image_prompt',
					'prompt'
				)
			);
		if (!$brief) {
			$brief =
				$excerpt
				?
				$excerpt
				:
				$this->truncate(
					$this->strip_html_text($html),
					240
				);
		}
		if (!$brief) {
			$brief =
				$title;
		}

		return
			array(
				'title'
				=>
				$title,
				'slug'
				=>
				$this->slugify_metadata_value($this->pick_metadata(
					$metadata,
					array(
						'slug',
						'url',
						'permalink'
					)
				) ?
					$this->pick_metadata(
						$metadata,
						array(
							'slug',
							'url',
							'permalink'
						)
					) :
					$title),
				'html'
				=>
				trim((string)
				$html),
				'excerpt'
				=>
				$excerpt,
				'brief'
				=>
				$brief,
				'categories'
				=>
				$this->sanitize_csv_strings($this->pick_metadata(
					$metadata,
					array(
						'categories',
						'category'
					)
				)),
				'tags'
				=>
				$this->sanitize_csv_strings($this->pick_metadata(
					$metadata,
					array(
						'tags',
						'tag'
					)
				)),
				'seoTitle'
				=>
				$this->pick_metadata(
					$metadata,
					array(
						'seo_title',
						'meta_title'
					)
				),
				'metaDescription'
				=>
				$this->pick_metadata(
					$metadata,
					array(
						'meta_description',
						'seo_description'
					)
				),
				'focusKeyword'
				=>
				$this->pick_metadata(
					$metadata,
					array('focus_keyword')
				),
				'canonicalUrl'
				=>
				$this->sanitize_optional_url($this->pick_metadata(
					$metadata,
					array('canonical_url')
				)),
				'featuredImageUrl'
				=>
				$this->sanitize_optional_image_url($this->pick_metadata(
					$metadata,
					array(
						'featured_image_url',
						'featured_image',
						'image_url'
					)
				)),
				'imagePrompt'
				=>
				$this->pick_metadata(
					$metadata,
					array(
						'image_prompt',
						'featured_image_prompt',
						'prompt'
					)
				),
			);
	}

	private
	function
	parse_front_matter($markdown)
	{
		$normalized
			=
			preg_replace(
				'/^\xEF\xBB\xBF/',
				'',
				(string)
				$markdown
			);
		if (
			0
			!==
			strpos(
				$normalized,
				"---\n"
			)
		) {
			return
				array();
		}
		$end_index
			=
			strpos(
				$normalized,
				"\n---\n",
				4
			);
		if (
			false
			===
			$end_index
		) {
			return
				array();
		}

		$raw_metadata
			=
			substr(
				$normalized,
				4,
				$end_index
					- 4
			);
		$metadata
			=
			array();
		$lines =
			preg_split(
				'/\r?\n/',
				$raw_metadata
			);
		if (is_array($lines)) {
			foreach (
				$lines
				as
				$line
			) {
				if (preg_match(
					'/^([^:]+):\s*(.*)$/',
					$line,
					$matches
				)) {
					$key =
						$this->normalize_metadata_key($matches[1]);
					if ($this->is_allowed_metadata_key($key)) {
						$metadata[$key]
							=
							trim((string)
							$matches[2]);
					}
				}
			}
		}

		return
			array(
				'metadata'
				=>
				$metadata,
				'body'
				=>
				substr(
					$normalized,
					$end_index
						+
						5
				)
			);
	}

	private
	function
	parse_leading_metadata($markdown)
	{
		$lines =
			preg_split(
				'/\r?\n/',
				preg_replace(
					'/^\xEF\xBB\xBF/',
					'',
					(string)
					$markdown
				)
			);
		$metadata
			=
			array();
		$index =
			0;
		$saw_metadata
			= false;
		if (!is_array($lines)) {
			$lines =
				array();
		}

		while (
			$index
			< count($lines)
		) {
			$line = trim((string)
			$lines[$index]);
			if ('' === $line) {
				if ($saw_metadata) {
					$index++;
					break;
				}
				$index++;
				continue;
			}
			if (!preg_match(
				'/^([^:]{1,60}):\s*(.*)$/',
				$line,
				$matches
			)) {
				break;
			}
			$key = $this->normalize_metadata_key($matches[1]);
			if (!$this->is_allowed_metadata_key($key)) {
				break;
			}
			$metadata[$key]
				=
				trim((string)
				$matches[2]);
			$saw_metadata
				=
				true;
			$index++;
		}

		return
			array(
				'metadata'
				=>
				$metadata,
				'body'
				=>
				implode(
					"\n",
					array_slice(
						$lines,
						$index
					)
				)
			);
	}

	private
	function
	normalize_metadata_key($value)
	{
		$key
			=
			strtolower(trim((string)
			$value));
		$key
			=
			preg_replace(
				'/[^a-z0-9]+/',
				'_',
				$key
			);
		return
			trim(
				(string)
				$key,
				'_'
			);
	}

	private
	function
	is_allowed_metadata_key($key)
	{
		return
			in_array(
				$key,
				array(
					'title',
					'slug',
					'url',
					'permalink',
					'excerpt',
					'brief',
					'image_prompt',
					'featured_image_prompt',
					'prompt',
					'seo_title',
					'meta_title',
					'meta_description',
					'seo_description',
					'focus_keyword',
					'canonical_url',
					'featured_image_url',
					'featured_image',
					'image_url',
					'categories',
					'category',
					'tags',
					'tag'
				),
				true
			);
	}

	private
	function
	pick_metadata(
		$metadata,
		$keys
	) {
		foreach (
			$keys
			as
			$key
		) {
			if (!empty($metadata[$key])) {
				return
					trim((string)
					$metadata[$key]);
			}
		}
		return
			'';
	}

	private
	function
	markdown_to_html($markdown)
	{
		$markdown
			=
			(string)
			$markdown;
		if (preg_match(
			'/
                                                                                                                    <[a-z][\s\S]*>
                                                                                                                        /i',
			$markdown
		)) {
			return
				trim($markdown);
		}

		$lines
			=
			preg_split(
				'/\r?\n/',
				str_replace(
					"\r\n",
					"\n",
					$markdown
				)
			);
		if (!is_array($lines)) {
			$lines
				=
				array();
		}

		$blocks
			=
			array();
		$paragraph
			=
			array();
		$list_items
			=
			array();
		$list_type
			=
			'';
		$flush_paragraph
			=
			function ()
			use (
				&$paragraph,
				&$blocks
			) {
				if (empty($paragraph)) {
					return;
				}
				$blocks[]
					=
					'
                                                                                                                        <p>' .
					$this->apply_inline_markdown(implode(
						'
                                                                                                                            ',
						$paragraph
					))
					.
					'
                                                                                                                        </p>
                                                                                                                        ';
				$paragraph
					=
					array();
			};
		$flush_list
			=
			function ()
			use (
				&$list_items,
				&$list_type,
				&$blocks
			) {
				if (
					!$list_type
					||
					empty($list_items)
				) {
					return;
				}
				$blocks[]
					=
					'
                                                                                                                        <' . $list_type
					. '>'
					.
					implode(
						'',
						$list_items
					)
					. '</'
					.
					$list_type
					. '>';
				$list_items = array();
				$list_type = '';
			};
		foreach (
			$lines
			as
			$raw_line
		) {
			$line = trim((string)
			$raw_line);
			if ('' === $line) {
				$flush_paragraph();
				$flush_list();
				continue;
			}
			if (preg_match(
				'/^(#{1,6})\s+(.+)$/',
				$line,
				$heading_matches
			)) {
				$flush_paragraph();
				$flush_list();
				$level = min(
					strlen($heading_matches[1]),
					6
				);
				$blocks[] = sprintf(
					'<h%d>
                                                                                                                            %s
                                                                                                                            </h%d>
                                                                                                                            ',
					$level,
					$this->apply_inline_markdown($heading_matches[2]),
					$level
				);
				continue;
			}
			if (preg_match(
				'/^\d+\.\s+(.+)$/',
				$line,
				$ordered_matches
			)) {
				$flush_paragraph();
				if (
					$list_type
					&&
					'ol'
					!==
					$list_type
				) {
					$flush_list();
				}
				$list_type
					=
					'ol';
				$list_items[]
					=
					'
                                                                                                                            <li>'
					.
					$this->apply_inline_markdown($ordered_matches[1])
					.
					'
                                                                                                                            </li>
                                                                                                                            ';
				continue;
			}
			if (preg_match(
				'/^[-*+]\s+(.+)$/',
				$line,
				$unordered_matches
			)) {
				$flush_paragraph();
				if (
					$list_type
					&&
					'ul'
					!==
					$list_type
				) {
					$flush_list();
				}
				$list_type
					=
					'ul';
				$list_items[]
					=
					'
                                                                                                                            <li>'
					.
					$this->apply_inline_markdown($unordered_matches[1])
					.
					'
                                                                                                                            </li>
                                                                                                                            ';
				continue;
			}
			if (preg_match(
				'/^
                                                                                                                            <\
                                                                                                                                /?[a-z][\s\S]*>
                                                                                                                                $/i',
				$line
			)) {
				$flush_paragraph();
				$flush_list();
				$blocks[]
					=
					$line;
				continue;
			}

			if ($list_type) {
				$flush_list();
			}
			$paragraph[]
				=
				$line;
		}

		$flush_paragraph();
		$flush_list();

		return
			implode(
				"\n",
				$blocks
			);
	}

	private
	function
	apply_inline_markdown($value)
	{
		$text
			=
			esc_html((string)
			$value);
		$text
			=
			preg_replace_callback(
				'/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/',
				function ($matches) {
					return
						sprintf(
							'<img
                                                                                                                                    src="%s"
                                                                                                                                    alt="%s"
                                                                                                                                    loading="lazy"
                                                                                                                                    decoding="async" />',
							esc_url($matches[2]),
							esc_attr($matches[1])
						);
				},
				$text
			);
		$text
			=
			preg_replace_callback(
				'/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/',
				function ($matches) {
					return
						sprintf(
							'<a
                                                                                                                                    href="%s">%s</a>',
							esc_url($matches[2]),
							esc_html($matches[1])
						);
				},
				$text
			);
		$text
			=
			preg_replace(
				'/`([^`]+)`/',
				'<code>$1</code>',
				$text
			);
		$text
			=
			preg_replace(
				'/\*\*([^*]+)\*\*/',
				'<strong>$1</strong>',
				$text
			);
		return
			preg_replace(
				'/(^|[^*])\*([^*]+)\*(?!\*)/',
				'$1<em>$2</em>',
				$text
			);
	}

	private
	function
	strip_html_text($value)
	{
		$value
			=
			preg_replace(
				'/
                                                                                                                                <[^>]+>/',
				'
                                                                                                                                    ',
				(string)
				$value
			);
		$value
			=
			preg_replace(
				'/\s+/',
				'
                                                                                                                                    ',
				(string)
				$value
			);
		return
			trim((string)
			$value);
	}

	private
	function
	truncate(
		$value,
		$max_length
	) {
		$value
			=
			trim((string)
			$value);
		if (
			strlen($value)
			<= $max_length
		) {
			return
				$value;
		}
		return
			rtrim(substr(
				$value,
				0,
				$max_length
					-
					1
			))
			. '...';
	}
	private
	function
	inject_inline_images_into_html(
		$html,
		$images
	) {
		if (empty($images)) {
			return
				$html;
		}
		$parts = preg_split(
			'/<\/p>/i',
			$html
		);
		if (
			!is_array($parts)
			||
			count($parts)
			<= 1
		) {
			$appended = '';
			foreach (
				$images
				as
				$image
			) {
				$appended
					.= $this->build_inline_image_figure($image);
			}
			return
				$html
				.
				$appended;
		}

		$interval
			=
			max(
				1,
				(int)
				floor(count($parts)
					/
					(count($images)
						+
						1))
			);
		$image_index
			=
			0;
		$output
			=
			'';
		foreach (
			$parts
			as
			$index
			=>
			$part
		) {
			if (
				''
				!==
				$part
			) {
				$output
					.=
					$part;
			}
			if (
				$index
				< count($parts)
				-
				1
			) {
				$output
					.= '</p>';
			}
			if (
				$image_index
				<
				count($images)
				&&
				0 === (($index
					+
					1)
					%
					$interval)
			) {
				$output
					.= $this->build_inline_image_figure($images[$image_index]);
				$image_index++;
			}
		}
		while (
			$image_index
			< count($images)
		) {
			$output
				.= $this->build_inline_image_figure($images[$image_index]);
			$image_index++;
		}
		return
			$output;
	}

	private
	function
	build_inline_image_figure($image)
	{
		return
			sprintf(
				'
                                                                                                                                                <figure
                                                                                                                                                    class="wp-block-image size-large">
                                                                                                                                                    <img src="%s"
                                                                                                                                                        alt="%s"
                                                                                                                                                        loading="lazy"
                                                                                                                                                        decoding="async" />
                                                                                                                                                </figure>
                                                                                                                                                ',
				esc_url(isset($image['sourceUrl'])
					?
					$image['sourceUrl']
					:
					''),
				esc_attr(isset($image['altText'])
					?
					$image['altText']
					:
					'')
			);
	}

	private
	function
	validate_required_links(
		$html,
		$links
	) {
		$present
			=
			array();
		$missing
			=
			array();
		$duplicate_required
			=
			array();
		foreach (
			$links
			as
			$link
		) {
			if (empty($link['required'])) {
				continue;
			}
			$count
				=
				$this->count_exact_anchor_matches(
					$html,
					$link
				);
			if (
				1
				===
				$count
			) {
				$present[]
					=
					$link;
			} elseif (
				0
				===
				$count
			) {
				$missing[]
					=
					$link;
			} else {
				$duplicate_required[]
					=
					$link;
			}
		}
		return
			array(
				'present'
				=>
				$present,
				'missing'
				=>
				$missing,
				'duplicateRequired'
				=>
				$duplicate_required
			);
	}

	private
	function
	count_exact_anchor_matches(
		$html,
		$link
	) {
		$href
			=
			preg_quote(
				trim((string)
				$link['url']),
				'/'
			);
		$anchor
			=
			preg_quote(
				trim((string)
				$link['anchorText']),
				'/'
			);
		return
			preg_match_all(
				'/
                                                                                                                                                <a\b[^>
                                                                                                                                                    ]*\bhref\s*=\s*([\'"])'
					.
					$href
					.
					'\1[^>]*>\s*'
					.
					$anchor
					.
					'\s*
                                                                                                                                                    <\
                                                                                                                                                        /a>
                                                                                                                                                        /i',
				(string)
				$html
			);
	}

	private
	function
	dedupe_required_links_in_html(
		$html,
		$links
	) {
		$updated_html
			=
			(string)
			$html;
		foreach (
			$links
			as
			$link
		) {
			if (empty($link['required'])) {
				continue;
			}
			$href
				=
				preg_quote(
					trim((string)
					$link['url']),
					'/'
				);
			$anchor
				=
				preg_quote(
					trim((string)
					$link['anchorText']),
					'/'
				);
			$pattern
				=
				'/
                                                                                                                                                        <a\b[^>
                                                                                                                                                            ]*\bhref\s*=\s*([\'"])'
				.
				$href
				.
				'\1[^>]*>\s*'
				.
				$anchor
				.
				'\s*
                                                                                                                                                            <\
                                                                                                                                                                /a>
                                                                                                                                                                /i';
			$seen
				=
				false;
			$updated_html
				=
				preg_replace_callback(
					$pattern,
					function ($matches)
					use (
						&$seen,
						$link
					) {
						if (!$seen) {
							$seen
								=
								true;
							return
								$matches[0];
						}
						return
							$link['anchorText'];
					},
					$updated_html
				);
		}
		return
			$updated_html;
	}

	private
	function
	enforce_link_policies_in_html(
		$html,
		$links
	) {
		$follow_type_by_url
			=
			array();
		foreach (
			$links
			as
			$link
		) {
			$follow_type_by_url[$this->normalize_url_for_comparison($link['url'])]
				=
				$link['followType'];
		}

		return
			preg_replace_callback(
				'/
                                                                                                                                                                <a\b[^>
                                                                                                                                                                    ]*>/i',
				function ($matches)
				use ($follow_type_by_url) {
					$anchor_tag
						=
						$matches[0];
					$href
						=
						$this->get_href_from_anchor_tag($anchor_tag);
					if (!$href) {
						return
							$anchor_tag;
					}

					$follow_type
						=
						isset($follow_type_by_url[$this->normalize_url_for_comparison($href)])
						?
						$follow_type_by_url[$this->normalize_url_for_comparison($href)]
						:
						'dofollow';
					$updated
						=
						$this->set_anchor_attribute(
							$anchor_tag,
							'target',
							'_blank'
						);
					$rel_tokens
						=
						array(
							'noopener',
							'noreferrer'
						);
					if (
						'nofollow'
						===
						$follow_type
					) {
						$rel_tokens[]
							=
							'nofollow';
					}
					return
						$this->set_anchor_attribute(
							$updated,
							'rel',
							implode(
								'
                                                                                                                                                                    ',
								$rel_tokens
							)
						);
				},
				(string)
				$html
			);
	}

	private
	function
	get_href_from_anchor_tag($anchor_tag)
	{
		if (preg_match(
			'/\bhref\s*=\s*([\'"])(.*?)\1/i',
			$anchor_tag,
			$matches
		)) {
			return
				$matches[2];
		}
		return
			'';
	}

	private
	function
	set_anchor_attribute(
		$anchor_tag,
		$attribute,
		$value
	) {
		$pattern
			=
			'/\s'
			.
			preg_quote(
				$attribute,
				'/'
			)
			.
			'\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)/i';
		$anchor_tag
			=
			preg_replace(
				$pattern,
				'',
				$anchor_tag
			);
		return
			preg_replace(
				'/>$/',
				sprintf(
					'
                                                                                                                                                                    %s="%s">',
					$attribute,
					esc_attr($value)
				),
				(string)
				$anchor_tag
			);
	}

	private
	function
	normalize_url_for_comparison($url)
	{
		return
			strtolower(rtrim(
				trim((string)
				$url),
				'/'
			));
	}

	private
	function
	is_required_link($link)
	{
		return
			!empty($link['required']);
	}

	private
	function
	is_optional_link($link)
	{
		return
			empty($link['required']);
	}
}

new
	AI_Article_Publisher();
