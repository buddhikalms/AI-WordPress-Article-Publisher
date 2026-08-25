<?php

if (!defined('ABSPATH')) {
	exit;
}

final class AIA_Admin_Screen
{
	const STUDIO_PAGE = 'studio';
	const CREDENTIALS_PAGE = 'credentials';
	const DOCUMENTATION_PAGE = 'documentation';

	/** @var AI_Article_Publisher */
	private $plugin;

	/**
	 * @param AI_Article_Publisher $plugin
	 */
	public function __construct($plugin)
	{
		$this->plugin = $plugin;
	}

	public function register_menu()
	{
		add_menu_page(
			__('AI Article Publisher', 'ai-article-publisher'),
			__('AI Publisher', 'ai-article-publisher'),
			'edit_posts',
			AI_Article_Publisher::PAGE_SLUG,
			array($this, 'render_studio'),
			'dashicons-edit-large',
			58
		);

		add_submenu_page(
			AI_Article_Publisher::PAGE_SLUG,
			__('Studio', 'ai-article-publisher'),
			__('Studio', 'ai-article-publisher'),
			'edit_posts',
			AI_Article_Publisher::PAGE_SLUG,
			array($this, 'render_studio')
		);

		add_submenu_page(
			AI_Article_Publisher::PAGE_SLUG,
			__('Credentials', 'ai-article-publisher'),
			__('Credentials', 'ai-article-publisher'),
			'manage_options',
			$this->get_credentials_slug(),
			array($this, 'render_credentials')
		);

		add_submenu_page(
			AI_Article_Publisher::PAGE_SLUG,
			__('Documentation', 'ai-article-publisher'),
			__('Documentation', 'ai-article-publisher'),
			'edit_posts',
			$this->get_documentation_slug(),
			array($this, 'render_documentation')
		);
	}

	public function enqueue_assets($hook)
	{
		if (!$this->is_plugin_hook($hook)) {
			return;
		}

		$plugin_file = dirname(__DIR__, 2) . '/ai-article-publisher.php';
		$asset_base = plugin_dir_url($plugin_file) . 'assets/';

		wp_enqueue_style('aia-publisher-admin', $asset_base . 'admin.css', array(), AI_Article_Publisher::VERSION);
		wp_enqueue_editor();
		wp_enqueue_script('aia-publisher-admin', $asset_base . 'admin.js', array(), AI_Article_Publisher::VERSION, true);
		wp_add_inline_style('aia-publisher-admin', $this->get_notice_suppression_css());

		wp_localize_script(
			'aia-publisher-admin',
			'AIAArticlePublisher',
			array(
				'ajaxUrl' => admin_url('admin-ajax.php'),
				'nonce' => wp_create_nonce(AI_Article_Publisher::NONCE_ACTION),
				'defaultTone' => $this->plugin->get_settings()['default_tone'],
				'defaultProvider' => $this->plugin->get_settings()['default_provider'],
				'currentPage' => $this->resolve_current_page(),
				'tabStorageKey' => 'aia-active-tab',
				'strings' => array(
					'manualSaved' => __('Post created successfully.', 'ai-article-publisher'),
					'googleSaved' => __('Google Doc published successfully.', 'ai-article-publisher'),
					'newsSaved' => __('News autopilot finished.', 'ai-article-publisher'),
					'noActionsYet' => __('No actions run yet.', 'ai-article-publisher'),
					'noDraftYet' => __('No draft generated yet. Generate a manual draft to preview the article here.', 'ai-article-publisher'),
					'noImageYet' => __('No featured image yet. Generate one in Manual Studio or import a Google Doc that includes an image.', 'ai-article-publisher'),
				),
			)
		);
	}

	public function handle_save_settings()
	{
		if (!current_user_can('manage_options')) {
			wp_die(esc_html__('You do not have permission to update these settings.', 'ai-article-publisher'));
		}

		check_admin_referer(AI_Article_Publisher::SAVE_SETTINGS_ACTION);

		$raw = isset($_POST['settings']) ? wp_unslash($_POST['settings']) : array();
		$sanitized = $this->plugin->sanitize_settings(is_array($raw) ? $raw : array());
		update_option(AI_Article_Publisher::OPTION_KEY, $sanitized, false);

		$redirect_url = add_query_arg(
			array(
				'page' => $this->get_credentials_slug(),
				'settings-updated' => '1',
			),
			admin_url('admin.php')
		);

		wp_safe_redirect($redirect_url);
		exit;
	}

	public function render_studio()
	{
		if (!current_user_can('edit_posts')) {
			wp_die(esc_html__('You do not have permission to access this page.', 'ai-article-publisher'));
		}

		$current_page = self::STUDIO_PAGE;
		$settings = $this->plugin->get_settings();
		$tone_options = $this->plugin->get_tone_options();
		$news_categories = $this->plugin->get_news_categories();
		$categories = get_categories(
			array(
				'hide_empty' => false,
				'taxonomy' => 'category',
			)
		);
		$page_nav_items = $this->get_page_nav_items();
		$hero_metrics = array(
			array(
				'label' => __('OpenAI', 'ai-article-publisher'),
				'value' => !empty($settings['openai_api_key']) ? __('Connected', 'ai-article-publisher') : __('Missing key', 'ai-article-publisher'),
				'is_ready' => !empty($settings['openai_api_key']),
			),
			array(
				'label' => __('Claude API', 'ai-article-publisher'),
				'value' => !empty($settings['claude_api_key']) ? __('Connected', 'ai-article-publisher') : __('Optional', 'ai-article-publisher'),
				'is_ready' => !empty($settings['claude_api_key']),
			),
			array(
				'label' => __('Gemini', 'ai-article-publisher'),
				'value' => !empty($settings['gemini_api_key']) ? __('Connected', 'ai-article-publisher') : __('Optional', 'ai-article-publisher'),
				'is_ready' => !empty($settings['gemini_api_key']),
			),
			array(
				'label' => __('Claude Desktop', 'ai-article-publisher'),
				'value' => __('Manual bridge ready', 'ai-article-publisher'),
				'is_ready' => true,
			),
			array(
				'label' => __('NewsData', 'ai-article-publisher'),
				'value' => !empty($settings['newsdata_api_key']) ? __('Connected', 'ai-article-publisher') : __('Optional', 'ai-article-publisher'),
				'is_ready' => !empty($settings['newsdata_api_key']),
			),
			array(
				'label' => __('Site Categories', 'ai-article-publisher'),
				'value' => sprintf(_n('%d category', '%d categories', count($categories), 'ai-article-publisher'), count($categories)),
				'is_ready' => !empty($categories),
			),
		);
		$workflow_cards = array(
			array(
				'eyebrow' => __('Manual Studio', 'ai-article-publisher'),
				'title' => __('Write from a brief', 'ai-article-publisher'),
				'description' => __('Create the article, generate an image, review HTML, and publish without leaving WordPress.', 'ai-article-publisher'),
			),
			array(
				'eyebrow' => __('Google Doc Import', 'ai-article-publisher'),
				'title' => __('Bring in editorial drafts', 'ai-article-publisher'),
				'description' => __('Convert a public Google Doc into a WordPress draft or scheduled post with metadata support.', 'ai-article-publisher'),
			),
			array(
				'eyebrow' => __('News Autopilot', 'ai-article-publisher'),
				'title' => __('Rewrite breaking stories', 'ai-article-publisher'),
				'description' => __('Pull NewsData articles, rewrite them into original posts, and publish at a controlled pace.', 'ai-article-publisher'),
			),
		);
		$quick_tips = array(
			__('Start with shared categories and SEO defaults before switching workflows.', 'ai-article-publisher'),
			__('Use Manual Studio for your highest-value posts where title, links, and image prompt need tight control.', 'ai-article-publisher'),
			__('Keep Google Docs public to avoid import failures caused by Google sign-in walls.', 'ai-article-publisher'),
			__('Run News Autopilot as draft first if you want editorial review before posts go live.', 'ai-article-publisher'),
		);
		$logs = $this->plugin->get_recent_logs();

		include __DIR__ . '/views/admin-page.php';
	}

	public function render_credentials()
	{
		if (!current_user_can('manage_options')) {
			wp_die(esc_html__('You do not have permission to access this page.', 'ai-article-publisher'));
		}

		$current_page = self::CREDENTIALS_PAGE;
		$settings = $this->plugin->get_settings();
		$tone_options = $this->plugin->get_tone_options();
		$page_nav_items = $this->get_page_nav_items();
		$settings_saved = isset($_GET['settings-updated']) && '1' === $_GET['settings-updated'];
		$credential_cards = array(
			array(
				'label' => __('OpenAI API Key', 'ai-article-publisher'),
				'status' => !empty($settings['openai_api_key']) ? __('Saved', 'ai-article-publisher') : __('Missing', 'ai-article-publisher'),
				'description' => __('Required for article generation, rewrites, and image creation.', 'ai-article-publisher'),
				'is_ready' => !empty($settings['openai_api_key']),
			),
			array(
				'label' => __('OpenAI Text Model', 'ai-article-publisher'),
				'status' => !empty($settings['openai_text_model']) ? $settings['openai_text_model'] : AI_Article_Publisher::DEFAULT_TEXT_MODEL,
				'description' => __('Used for manual drafting and News Autopilot rewrites.', 'ai-article-publisher'),
				'is_ready' => true,
			),
			array(
				'label' => __('Claude API Key', 'ai-article-publisher'),
				'status' => !empty($settings['claude_api_key']) ? __('Saved', 'ai-article-publisher') : __('Optional', 'ai-article-publisher'),
				'description' => __('Only needed for official Anthropic Messages API generation.', 'ai-article-publisher'),
				'is_ready' => !empty($settings['claude_api_key']),
			),
			array(
				'label' => __('Gemini API Key', 'ai-article-publisher'),
				'status' => !empty($settings['gemini_api_key']) ? __('Saved', 'ai-article-publisher') : __('Optional', 'ai-article-publisher'),
				'description' => __('Only needed when Gemini is selected for article generation or rewrites.', 'ai-article-publisher'),
				'is_ready' => !empty($settings['gemini_api_key']),
			),
			array(
				'label' => __('Default Provider', 'ai-article-publisher'),
				'status' => $settings['default_provider'],
				'description' => __('Controls the primary API provider used by Studio tools.', 'ai-article-publisher'),
				'is_ready' => true,
			),
			array(
				'label' => __('NewsData API Key', 'ai-article-publisher'),
				'status' => !empty($settings['newsdata_api_key']) ? __('Saved', 'ai-article-publisher') : __('Optional', 'ai-article-publisher'),
				'description' => __('Only needed if you want the News Autopilot workflow.', 'ai-article-publisher'),
				'is_ready' => !empty($settings['newsdata_api_key']),
			),
		);
		$security_notes = array(
			__('Credentials are stored in WordPress options for this site only.', 'ai-article-publisher'),
			__('Only administrators should have access to this page.', 'ai-article-publisher'),
			__('If you rotate API keys, save the new values here before running any workflow again.', 'ai-article-publisher'),
		);

		include __DIR__ . '/views/credentials-page.php';
	}

	public function render_documentation()
	{
		if (!current_user_can('edit_posts')) {
			wp_die(esc_html__('You do not have permission to access this page.', 'ai-article-publisher'));
		}

		$current_page = self::DOCUMENTATION_PAGE;
		$page_nav_items = $this->get_page_nav_items();
		$quick_start_steps = array(
			__('Open the Credentials page and save your OpenAI API key if you use Manual Studio. Add the NewsData key only if you plan to use News Autopilot.', 'ai-article-publisher'),
			__('Go to Studio and set shared categories and SEO fields before you start generating or importing content.', 'ai-article-publisher'),
			__('Use Manual Studio for original articles, Google Doc Import for editorial drafts, or News Autopilot for source-driven rewrites.', 'ai-article-publisher'),
			__('Review the generated HTML, preview, image, and response output before publishing live posts.', 'ai-article-publisher'),
		);
		$workflow_docs = array(
			array(
				'title' => __('Manual Studio', 'ai-article-publisher'),
				'items' => array(
					__('Add a title, brief, optional keywords, and link requirements.', 'ai-article-publisher'),
					__('Generate a draft first, then optionally generate a featured image.', 'ai-article-publisher'),
					__('Adjust excerpt, tags, HTML, and publish mode before sending the post to WordPress.', 'ai-article-publisher'),
				),
			),
			array(
				'title' => __('Google Doc Import', 'ai-article-publisher'),
				'items' => array(
					__('Use a public Google Doc URL or document ID.', 'ai-article-publisher'),
					__('Front matter keys like `title`, `slug`, `excerpt`, `categories`, `tags`, and `featured_image_url` are supported.', 'ai-article-publisher'),
					__('If `featured_image_url` is blank, the first embedded Google Doc image is uploaded as the featured image.', 'ai-article-publisher'),
					__('When AIOSEO or Yoast is selected, Google Doc front matter and document-derived fallbacks are applied without an AI provider key.', 'ai-article-publisher'),
					__('Private docs must be shared as "Anyone with the link can view" or published to the web.', 'ai-article-publisher'),
				),
			),
			array(
				'title' => __('News Autopilot', 'ai-article-publisher'),
				'items' => array(
					__('Pick a NewsData category, optional keyword filter, tone, and word count.', 'ai-article-publisher'),
					__('Run in draft mode first if you want an editor to review rewritten articles.', 'ai-article-publisher'),
					__('The plugin fetches source articles and rewrites them into new WordPress-ready posts.', 'ai-article-publisher'),
				),
			),
		);
		$troubleshooting_items = array(
			__('If draft generation fails immediately, verify that the OpenAI key is saved and valid.', 'ai-article-publisher'),
			__('If Google Doc import fails, confirm the document is public and not showing a Google sign-in wall.', 'ai-article-publisher'),
			__('If News Autopilot returns empty results, try a different category, broader keyword, or confirm the NewsData key is active.', 'ai-article-publisher'),
			__('If SEO fields are not visible on the live post, check whether your SEO plugin requires indexing or rebuild steps after meta updates.', 'ai-article-publisher'),
		);
		$front_matter_example = "---\n"
			. "title: Best AI SEO Tools for Agencies\n"
			. "slug: best-ai-seo-tools-for-agencies\n"
			. "excerpt: A practical comparison of AI SEO tools for agency teams.\n"
			. "brief: Use a professional angle focused on agencies scaling content.\n"
			. "categories: SEO, AI Tools\n"
			. "tags: ai seo, agency workflows, content automation\n"
			. "focus_keyword: ai seo tools for agencies\n"
			. "featured_image_url:\n"
			. "---\n\n"
			. "# Best AI SEO Tools for Agencies\n\n"
			. "Place your featured image directly below the title if featured_image_url is blank.\n\n"
			. "Your article body here.\n";

		include __DIR__ . '/views/documentation-page.php';
	}

	private function get_credentials_slug()
	{
		return AI_Article_Publisher::PAGE_SLUG . '-credentials';
	}

	private function get_documentation_slug()
	{
		return AI_Article_Publisher::PAGE_SLUG . '-documentation';
	}

	private function get_page_nav_items()
	{
		$items = array(
			array(
				'key' => self::STUDIO_PAGE,
				'label' => __('Studio', 'ai-article-publisher'),
				'description' => __('Generate, import, and publish posts.', 'ai-article-publisher'),
				'url' => admin_url('admin.php?page=' . AI_Article_Publisher::PAGE_SLUG),
			),
		);

		if (current_user_can('manage_options')) {
			$items[] = array(
				'key' => self::CREDENTIALS_PAGE,
				'label' => __('Credentials', 'ai-article-publisher'),
				'description' => __('Save API keys and defaults.', 'ai-article-publisher'),
				'url' => admin_url('admin.php?page=' . $this->get_credentials_slug()),
			);
		}

		$items[] = array(
			'key' => self::DOCUMENTATION_PAGE,
			'label' => __('Documentation', 'ai-article-publisher'),
			'description' => __('Setup, workflows, and troubleshooting.', 'ai-article-publisher'),
			'url' => admin_url('admin.php?page=' . $this->get_documentation_slug()),
		);

		return $items;
	}

	private function resolve_current_page()
	{
		$page = isset($_GET['page']) ? sanitize_key(wp_unslash($_GET['page'])) : '';
		if ($page === $this->get_credentials_slug()) {
			return self::CREDENTIALS_PAGE;
		}
		if ($page === $this->get_documentation_slug()) {
			return self::DOCUMENTATION_PAGE;
		}
		return self::STUDIO_PAGE;
	}

	private function is_plugin_hook($hook)
	{
		$hook = (string) $hook;

		return false !== strpos($hook, AI_Article_Publisher::PAGE_SLUG)
			|| false !== strpos($hook, $this->get_credentials_slug())
			|| false !== strpos($hook, $this->get_documentation_slug());
	}

	private function get_notice_suppression_css()
	{
		return '#wpbody-content > .notice:not(.aia-notice),'
			. '#wpbody-content > .updated:not(.aia-notice),'
			. '#wpbody-content > .error:not(.aia-notice),'
			. '#wpbody-content > .update-nag{display:none !important;}';
	}
}
