<?php

if (!defined('ABSPATH')) {
	exit;
}
?>
<div class="wrap aia-wrap">
	<section class="aia-page-header">
		<div>
			<span class="aia-kicker aia-kicker--dark"><?php esc_html_e('Studio', 'ai-article-publisher'); ?></span>
			<h1><?php esc_html_e('Content Studio', 'ai-article-publisher'); ?></h1>
			<p class="aia-page-header__description">
				<?php esc_html_e('Everything related to drafting, importing, and publishing posts lives here. Credentials are managed separately so the generation workspace stays focused.', 'ai-article-publisher'); ?>
			</p>
		</div>
		<div class="aia-page-header__meta">
			<span class="aia-pill"><?php echo esc_html(sprintf(__('Default tone: %s', 'ai-article-publisher'), $settings['default_tone'])); ?></span>
			<span class="aia-pill aia-pill--subtle"><?php echo esc_html(sprintf(_n('%d category available', '%d categories available', count($categories), 'ai-article-publisher'), count($categories))); ?></span>
		</div>
	</section>

	<?php include __DIR__ . '/partials/page-nav.php'; ?>

	<section class="aia-hero">
		<div class="aia-hero__content">
			<span class="aia-kicker"><?php esc_html_e('WordPress Editorial Workspace', 'ai-article-publisher'); ?></span>
			<h2><?php esc_html_e('Generate and ship AI-assisted posts from one organized workspace.', 'ai-article-publisher'); ?></h2>
			<p class="aia-subtitle">
				<?php esc_html_e('Start with shared post settings, choose a workflow, then review the preview, image, and run output before publishing.', 'ai-article-publisher'); ?>
			</p>
			<div class="aia-hero__badges">
				<span class="aia-badge"><?php esc_html_e('Manual drafting', 'ai-article-publisher'); ?></span>
				<span class="aia-badge"><?php esc_html_e('Google Docs import', 'ai-article-publisher'); ?></span>
				<span class="aia-badge"><?php esc_html_e('News autopilot', 'ai-article-publisher'); ?></span>
			</div>
		</div>
		<div class="aia-hero__metrics">
			<?php foreach ($hero_metrics as $metric) : ?>
				<div class="aia-metric<?php echo $metric['is_ready'] ? ' is-ready' : ''; ?>">
					<span class="aia-metric__label"><?php echo esc_html($metric['label']); ?></span>
					<strong class="aia-metric__value"><?php echo esc_html($metric['value']); ?></strong>
				</div>
			<?php endforeach; ?>
		</div>
	</section>

	<section class="aia-workflow-overview">
		<?php foreach ($workflow_cards as $card) : ?>
			<article class="aia-overview-card">
				<span class="aia-overview-card__eyebrow"><?php echo esc_html($card['eyebrow']); ?></span>
				<h2><?php echo esc_html($card['title']); ?></h2>
				<p><?php echo esc_html($card['description']); ?></p>
			</article>
		<?php endforeach; ?>
	</section>

	<div id="aia-status" class="aia-status" hidden role="status" aria-live="polite"></div>

	<div class="aia-layout">
		<div class="aia-main">
			<section class="aia-card">
				<div class="aia-card__header">
					<div>
						<h2><?php esc_html_e('1. Shared Post Setup', 'ai-article-publisher'); ?></h2>
						<p><?php esc_html_e('These settings are reused by every workflow so you only have to configure them once per run.', 'ai-article-publisher'); ?></p>
					</div>
					<span class="aia-pill"><?php esc_html_e('Applies to every workflow', 'ai-article-publisher'); ?></span>
				</div>
				<div class="aia-shared-grid">
					<div class="aia-panel">
						<div class="aia-panel__header">
							<div>
								<h3><?php esc_html_e('Categories', 'ai-article-publisher'); ?></h3>
								<p><?php esc_html_e('Pick reusable site categories and optionally create a new one on publish.', 'ai-article-publisher'); ?></p>
							</div>
							<span id="aia-category-count" class="aia-pill aia-pill--subtle"><?php esc_html_e('0 selected', 'ai-article-publisher'); ?></span>
						</div>
						<div class="aia-category-list">
							<?php if (empty($categories)) : ?>
								<p class="description"><?php esc_html_e('No categories found yet.', 'ai-article-publisher'); ?></p>
							<?php else : ?>
								<?php foreach ($categories as $category) : ?>
									<label class="aia-checkbox">
										<input type="checkbox" class="aia-category-checkbox" value="<?php echo esc_attr((string) $category->term_id); ?>" />
										<span><?php echo esc_html($category->name); ?></span>
									</label>
								<?php endforeach; ?>
							<?php endif; ?>
						</div>
						<label class="aia-field">
							<span><?php esc_html_e('Create Category On Publish', 'ai-article-publisher'); ?></span>
							<input type="text" id="aia-new-category-name" placeholder="<?php esc_attr_e('Optional category name', 'ai-article-publisher'); ?>" />
						</label>
					</div>

					<div class="aia-panel">
						<div class="aia-panel__header">
							<div>
								<h3><?php esc_html_e('SEO Metadata', 'ai-article-publisher'); ?></h3>
								<p><?php esc_html_e('Choose the target SEO plugin and review the metadata payload before publishing.', 'ai-article-publisher'); ?></p>
							</div>
						</div>
						<label class="aia-field">
							<span><?php esc_html_e('SEO Provider', 'ai-article-publisher'); ?></span>
							<select id="aia-seo-provider">
								<option value="None"><?php esc_html_e('None', 'ai-article-publisher'); ?></option>
								<option value="AIOSEO"><?php esc_html_e('AIOSEO', 'ai-article-publisher'); ?></option>
								<option value="Yoast"><?php esc_html_e('Yoast', 'ai-article-publisher'); ?></option>
							</select>
						</label>
						<div class="aia-seo-grid">
							<label class="aia-field">
								<span><?php esc_html_e('SEO Title', 'ai-article-publisher'); ?></span>
								<input type="text" id="aia-seo-title" />
							</label>
							<label class="aia-field">
								<span><?php esc_html_e('Meta Description', 'ai-article-publisher'); ?></span>
								<textarea id="aia-meta-description" rows="3"></textarea>
							</label>
							<label class="aia-field">
								<span><?php esc_html_e('Focus Keyword', 'ai-article-publisher'); ?></span>
								<input type="text" id="aia-focus-keyword" placeholder="<?php esc_attr_e('If empty, it will be derived from the title', 'ai-article-publisher'); ?>" />
							</label>
							<label class="aia-field">
								<span><?php esc_html_e('Additional Keywords', 'ai-article-publisher'); ?></span>
								<input type="text" id="aia-additional-keywords" placeholder="<?php esc_attr_e('Comma-separated keyword suggestions', 'ai-article-publisher'); ?>" />
							</label>
							<label class="aia-field">
								<span><?php esc_html_e('Canonical URL', 'ai-article-publisher'); ?></span>
								<input type="url" id="aia-canonical-url" />
							</label>
							<label class="aia-field">
								<span><?php esc_html_e('Open Graph Title', 'ai-article-publisher'); ?></span>
								<input type="text" id="aia-og-title" />
							</label>
							<label class="aia-field">
								<span><?php esc_html_e('Open Graph Description', 'ai-article-publisher'); ?></span>
								<textarea id="aia-og-description" rows="3"></textarea>
							</label>
							<label class="aia-field">
								<span><?php esc_html_e('Open Graph Image URL', 'ai-article-publisher'); ?></span>
								<input type="url" id="aia-og-image-url" />
							</label>
							<label class="aia-field">
								<span><?php esc_html_e('Twitter Title', 'ai-article-publisher'); ?></span>
								<input type="text" id="aia-twitter-title" />
							</label>
							<label class="aia-field">
								<span><?php esc_html_e('Twitter Description', 'ai-article-publisher'); ?></span>
								<textarea id="aia-twitter-description" rows="3"></textarea>
							</label>
							<label class="aia-field">
								<span><?php esc_html_e('Twitter Image URL', 'ai-article-publisher'); ?></span>
								<input type="url" id="aia-twitter-image-url" />
							</label>
						</div>
					</div>
				</div>
			</section>

			<section class="aia-card">
				<div class="aia-card__header">
					<div>
						<h2><?php esc_html_e('2. Post Generation & Publishing', 'ai-article-publisher'); ?></h2>
						<p><?php esc_html_e('Choose a workflow and complete the publishing steps without leaving the Studio page.', 'ai-article-publisher'); ?></p>
					</div>
				</div>

				<div class="aia-tablist" role="tablist" aria-label="<?php esc_attr_e('Publishing workflows', 'ai-article-publisher'); ?>">
					<button type="button" id="aia-tab-manual" class="aia-tab is-active" data-aia-tab="manual" role="tab" aria-selected="true" aria-controls="aia-panel-manual">
						<?php esc_html_e('Studio', 'ai-article-publisher'); ?>
					</button>
					<button type="button" id="aia-tab-claude" class="aia-tab" data-aia-tab="claude" role="tab" aria-selected="false" aria-controls="aia-panel-claude">
						<?php esc_html_e('Claude Desktop Mode', 'ai-article-publisher'); ?>
					</button>
					<button type="button" id="aia-tab-news" class="aia-tab" data-aia-tab="news" role="tab" aria-selected="false" aria-controls="aia-panel-news">
						<?php esc_html_e('News Autopilot', 'ai-article-publisher'); ?>
					</button>
					<button type="button" id="aia-tab-google" class="aia-tab" data-aia-tab="google" role="tab" aria-selected="false" aria-controls="aia-panel-google">
						<?php esc_html_e('Google Doc Import', 'ai-article-publisher'); ?>
					</button>
					<button type="button" id="aia-tab-seo" class="aia-tab" data-aia-tab="seo" role="tab" aria-selected="false" aria-controls="aia-panel-seo">
						<?php esc_html_e('SEO Settings', 'ai-article-publisher'); ?>
					</button>
					<a class="aia-tab aia-tab--link" href="<?php echo esc_url(admin_url('admin.php?page=ai-article-publisher-credentials')); ?>">
						<?php esc_html_e('Credentials', 'ai-article-publisher'); ?>
					</a>
					<button type="button" id="aia-tab-logs" class="aia-tab" data-aia-tab="logs" role="tab" aria-selected="false" aria-controls="aia-panel-logs">
						<?php esc_html_e('Logs', 'ai-article-publisher'); ?>
					</button>
				</div>

				<div id="aia-panel-manual" class="aia-tabpanel is-active" data-aia-panel="manual" role="tabpanel" aria-labelledby="aia-tab-manual">
					<div class="aia-note">
						<?php esc_html_e('Best for original content where you want to control the prompt, links, article HTML, and publishing mode.', 'ai-article-publisher'); ?>
					</div>
					<div class="aia-form-grid">
						<label class="aia-field aia-field--full">
							<span><?php esc_html_e('Article Title', 'ai-article-publisher'); ?></span>
							<input type="text" id="aia-manual-title" placeholder="<?php esc_attr_e('Best AI Writing Tools for Agencies', 'ai-article-publisher'); ?>" />
						</label>
						<label class="aia-field aia-field--full">
							<span><?php esc_html_e('Post Slug', 'ai-article-publisher'); ?></span>
							<input type="text" id="aia-manual-slug" placeholder="<?php esc_attr_e('best-ai-writing-tools-for-agencies', 'ai-article-publisher'); ?>" />
							<small><?php esc_html_e('This becomes the WordPress permalink slug. Use lowercase words separated by hyphens.', 'ai-article-publisher'); ?></small>
						</label>
						<label class="aia-field aia-field--full">
							<span><?php esc_html_e('Topic Brief', 'ai-article-publisher'); ?></span>
							<textarea id="aia-manual-brief" rows="6" placeholder="<?php esc_attr_e('Describe the angle, audience, structure, and must-cover points.', 'ai-article-publisher'); ?>"></textarea>
							<small><?php esc_html_e('Use this description for placement notes. The hyperlink table tells the generator which URLs and anchor text to include, whether each link is required, whether it is dofollow or nofollow, and all published links open in a new tab.', 'ai-article-publisher'); ?></small>
						</label>
						<label class="aia-field">
							<span><?php esc_html_e('Keywords', 'ai-article-publisher'); ?></span>
							<input type="text" id="aia-manual-keywords" placeholder="<?php esc_attr_e('seo automation, ai publishing, wordpress', 'ai-article-publisher'); ?>" />
						</label>
						<label class="aia-field">
							<span><?php esc_html_e('Tone', 'ai-article-publisher'); ?></span>
							<select id="aia-manual-tone">
								<?php foreach ($tone_options as $tone_option) : ?>
									<option value="<?php echo esc_attr($tone_option); ?>" <?php selected($settings['default_tone'], $tone_option); ?>>
										<?php echo esc_html($tone_option); ?>
									</option>
								<?php endforeach; ?>
							</select>
						</label>
						<label class="aia-field">
							<span><?php esc_html_e('Word Count', 'ai-article-publisher'); ?></span>
							<input type="number" id="aia-manual-word-count" min="300" max="5000" value="1200" />
						</label>
						<label class="aia-field">
							<span><?php esc_html_e('Publish Mode', 'ai-article-publisher'); ?></span>
							<select id="aia-manual-status">
								<option value="draft"><?php esc_html_e('Draft', 'ai-article-publisher'); ?></option>
								<option value="publish"><?php esc_html_e('Publish Now', 'ai-article-publisher'); ?></option>
								<option value="future"><?php esc_html_e('Schedule', 'ai-article-publisher'); ?></option>
							</select>
						</label>
						<label class="aia-field">
							<span><?php esc_html_e('Schedule Date/Time', 'ai-article-publisher'); ?></span>
							<input type="datetime-local" id="aia-manual-schedule" disabled="disabled" />
						</label>
						<label class="aia-field">
							<span><?php esc_html_e('In-Post Images', 'ai-article-publisher'); ?></span>
							<input type="number" id="aia-manual-inline-images" min="0" max="10" value="0" />
						</label>
					</div>

					<div class="aia-links">
						<div class="aia-links__header">
							<div>
								<h3><?php esc_html_e('Hyperlinks', 'ai-article-publisher'); ?></h3>
								<p><?php esc_html_e('Set exact links, required status, anchor text, and dofollow/nofollow rules. Published links open in a new tab.', 'ai-article-publisher'); ?></p>
							</div>
							<button type="button" class="button" id="aia-add-link"><?php esc_html_e('Add Link', 'ai-article-publisher'); ?></button>
						</div>
						<div id="aia-links-list"></div>
						<template id="aia-link-row-template">
							<div class="aia-link-row">
								<label class="aia-field">
									<span><?php esc_html_e('URL', 'ai-article-publisher'); ?></span>
									<input type="url" class="aia-link-url" />
								</label>
								<label class="aia-field">
									<span><?php esc_html_e('Anchor Text', 'ai-article-publisher'); ?></span>
									<input type="text" class="aia-link-anchor" />
								</label>
								<label class="aia-field">
									<span><?php esc_html_e('Follow Type', 'ai-article-publisher'); ?></span>
									<select class="aia-link-follow">
										<option value="dofollow"><?php esc_html_e('DoFollow', 'ai-article-publisher'); ?></option>
										<option value="nofollow"><?php esc_html_e('NoFollow', 'ai-article-publisher'); ?></option>
									</select>
								</label>
								<label class="aia-checkbox aia-checkbox--inline">
									<input type="checkbox" class="aia-link-required" checked="checked" />
									<span><?php esc_html_e('Required', 'ai-article-publisher'); ?></span>
								</label>
								<button type="button" class="button-link-delete aia-link-remove"><?php esc_html_e('Remove', 'ai-article-publisher'); ?></button>
							</div>
						</template>
					</div>

					<div class="aia-actions">
						<button type="button" class="button" data-aia-tool="outline" data-busy-label="<?php esc_attr_e('Generating outline...', 'ai-article-publisher'); ?>"><?php esc_html_e('Generate Outline', 'ai-article-publisher'); ?></button>
						<button type="button" class="button button-primary" id="aia-generate-draft" data-busy-label="<?php esc_attr_e('Generating draft...', 'ai-article-publisher'); ?>">
							<?php esc_html_e('Generate Full Article', 'ai-article-publisher'); ?>
						</button>
						<button type="button" class="button" data-aia-tool="improve_draft" data-busy-label="<?php esc_attr_e('Improving draft...', 'ai-article-publisher'); ?>"><?php esc_html_e('Improve Existing Draft', 'ai-article-publisher'); ?></button>
						<button type="button" class="button" data-aia-tool="humanize" data-busy-label="<?php esc_attr_e('Humanizing...', 'ai-article-publisher'); ?>"><?php esc_html_e('Humanize Text', 'ai-article-publisher'); ?></button>
						<button type="button" class="button" data-aia-tool="rewrite_intro" data-busy-label="<?php esc_attr_e('Rewriting intro...', 'ai-article-publisher'); ?>"><?php esc_html_e('Rewrite Intro', 'ai-article-publisher'); ?></button>
						<button type="button" class="button" data-aia-tool="faq" data-busy-label="<?php esc_attr_e('Generating FAQ...', 'ai-article-publisher'); ?>"><?php esc_html_e('Generate FAQ Section', 'ai-article-publisher'); ?></button>
						<button type="button" class="button" data-aia-tool="meta_only" data-busy-label="<?php esc_attr_e('Generating meta...', 'ai-article-publisher'); ?>"><?php esc_html_e('Generate Meta Only', 'ai-article-publisher'); ?></button>
						<button type="button" class="button" data-aia-tool="social_captions" data-busy-label="<?php esc_attr_e('Generating captions...', 'ai-article-publisher'); ?>"><?php esc_html_e('Generate Social Captions', 'ai-article-publisher'); ?></button>
						<button type="button" class="button" data-aia-tool="image_prompt" data-busy-label="<?php esc_attr_e('Generating prompt...', 'ai-article-publisher'); ?>"><?php esc_html_e('Generate Featured Image Prompt', 'ai-article-publisher'); ?></button>
						<button type="button" class="button" id="aia-generate-image" data-busy-label="<?php esc_attr_e('Generating image...', 'ai-article-publisher'); ?>">
							<?php esc_html_e('Generate Image', 'ai-article-publisher'); ?>
						</button>
						<button type="button" class="button button-secondary" id="aia-publish-manual" data-busy-label="<?php esc_attr_e('Publishing...', 'ai-article-publisher'); ?>">
							<?php esc_html_e('Publish To WordPress', 'ai-article-publisher'); ?>
						</button>
					</div>

					<div class="aia-form-grid">
						<label class="aia-field aia-field--full">
							<span><?php esc_html_e('Excerpt', 'ai-article-publisher'); ?></span>
							<textarea id="aia-manual-excerpt" rows="4"></textarea>
						</label>
						<label class="aia-field aia-field--full">
							<span><?php esc_html_e('Suggested Tags', 'ai-article-publisher'); ?></span>
							<input type="text" id="aia-manual-tags" placeholder="<?php esc_attr_e('Comma-separated tags', 'ai-article-publisher'); ?>" />
						</label>
						<div class="aia-field aia-field--full">
							<span><?php esc_html_e('Add Image To Article Editor', 'ai-article-publisher'); ?></span>
							<div class="aia-form-grid">
								<input type="url" id="aia-editor-image-url" placeholder="<?php esc_attr_e('https://example.com/image.jpg', 'ai-article-publisher'); ?>" />
								<input type="text" id="aia-editor-image-alt" placeholder="<?php esc_attr_e('Image alt text', 'ai-article-publisher'); ?>" />
							</div>
							<div class="aia-actions">
								<button type="button" class="button" id="aia-insert-editor-image-url"><?php esc_html_e('Insert Image URL', 'ai-article-publisher'); ?></button>
								<label class="button">
									<?php esc_html_e('Upload Image Into Article', 'ai-article-publisher'); ?>
									<input type="file" id="aia-editor-image-file" accept="image/*" hidden />
								</label>
								<button type="button" class="button" id="aia-insert-generated-image"><?php esc_html_e('Insert Generated Image', 'ai-article-publisher'); ?></button>
							</div>
							<small><?php esc_html_e('You can type directly in Generated HTML after generation. Uploaded editor images are inserted now and uploaded to WordPress media during publish.', 'ai-article-publisher'); ?></small>
						</div>
						<label class="aia-field aia-field--full">
							<span><?php esc_html_e('Generated HTML', 'ai-article-publisher'); ?></span>
							<?php
							wp_editor(
								'',
								'aia-manual-html',
								array(
									'textarea_name' => 'aia-manual-html',
									'textarea_rows' => 18,
									'media_buttons' => true,
									'teeny' => false,
									'quicktags' => true,
									'tinymce' => true,
								)
							);
							?>
						</label>
					</div>
					<input type="hidden" id="aia-manual-image-base64" />
					<input type="hidden" id="aia-manual-image-mime" />
				</div>

				<div id="aia-panel-claude" class="aia-tabpanel" data-aia-panel="claude" role="tabpanel" aria-labelledby="aia-tab-claude" hidden="hidden">
					<div class="aia-note">
						<?php esc_html_e('Manual bridge mode: WordPress prepares the prompt, you paste it into Claude Desktop, then paste Claude JSON back here for validation and publishing. No Claude Desktop automation is used.', 'ai-article-publisher'); ?>
					</div>
					<div class="aia-form-grid">
						<label class="aia-field">
							<span><?php esc_html_e('Title', 'ai-article-publisher'); ?></span>
							<input type="text" id="aia-claude-title" />
						</label>
						<label class="aia-field">
							<span><?php esc_html_e('Keyword', 'ai-article-publisher'); ?></span>
							<input type="text" id="aia-claude-keyword" />
						</label>
						<label class="aia-field">
							<span><?php esc_html_e('Tone', 'ai-article-publisher'); ?></span>
							<input type="text" id="aia-claude-tone" value="<?php echo esc_attr($settings['default_tone']); ?>" />
						</label>
						<label class="aia-field">
							<span><?php esc_html_e('Article Type', 'ai-article-publisher'); ?></span>
							<input type="text" id="aia-claude-type" value="<?php esc_attr_e('SEO article', 'ai-article-publisher'); ?>" />
						</label>
						<label class="aia-field">
							<span><?php esc_html_e('Country', 'ai-article-publisher'); ?></span>
							<input type="text" id="aia-claude-country" />
						</label>
						<label class="aia-field">
							<span><?php esc_html_e('Audience', 'ai-article-publisher'); ?></span>
							<input type="text" id="aia-claude-audience" />
						</label>
						<label class="aia-field">
							<span><?php esc_html_e('Word Count', 'ai-article-publisher'); ?></span>
							<input type="number" id="aia-claude-word-count" min="300" max="5000" value="1200" />
						</label>
						<label class="aia-field">
							<span><?php esc_html_e('Required Links', 'ai-article-publisher'); ?></span>
							<textarea id="aia-claude-required-links" rows="3" placeholder="<?php esc_attr_e('One URL per line or comma-separated', 'ai-article-publisher'); ?>"></textarea>
						</label>
						<label class="aia-field">
							<span><?php esc_html_e('Optional Links', 'ai-article-publisher'); ?></span>
							<textarea id="aia-claude-optional-links" rows="3"></textarea>
						</label>
						<label class="aia-field aia-field--full">
							<span><?php esc_html_e('SEO Instructions', 'ai-article-publisher'); ?></span>
							<textarea id="aia-claude-seo-instructions" rows="4"></textarea>
						</label>
						<label class="aia-field aia-field--full">
							<span><?php esc_html_e('Claude-ready Prompt', 'ai-article-publisher'); ?></span>
							<textarea id="aia-claude-prompt" rows="16" readonly></textarea>
						</label>
					</div>
					<div class="aia-actions">
						<button type="button" class="button button-primary" id="aia-generate-claude-prompt" data-busy-label="<?php esc_attr_e('Generating prompt...', 'ai-article-publisher'); ?>"><?php esc_html_e('Generate Claude Prompt', 'ai-article-publisher'); ?></button>
						<button type="button" class="button" id="aia-copy-claude-prompt"><?php esc_html_e('Copy Prompt', 'ai-article-publisher'); ?></button>
					</div>
					<label class="aia-field aia-field--full">
						<span><?php esc_html_e('Paste Claude Output JSON', 'ai-article-publisher'); ?></span>
						<textarea id="aia-claude-json" rows="14"></textarea>
					</label>
					<div class="aia-actions">
						<button type="button" class="button button-primary" id="aia-validate-claude-json" data-busy-label="<?php esc_attr_e('Validating...', 'ai-article-publisher'); ?>"><?php esc_html_e('Validate & Preview', 'ai-article-publisher'); ?></button>
						<button type="button" class="button" id="aia-create-claude-draft" data-busy-label="<?php esc_attr_e('Creating draft...', 'ai-article-publisher'); ?>"><?php esc_html_e('Create Draft', 'ai-article-publisher'); ?></button>
						<button type="button" class="button button-secondary" id="aia-publish-claude" data-busy-label="<?php esc_attr_e('Publishing...', 'ai-article-publisher'); ?>"><?php esc_html_e('Publish', 'ai-article-publisher'); ?></button>
					</div>
				</div>

				<div id="aia-panel-google" class="aia-tabpanel" data-aia-panel="google" role="tabpanel" aria-labelledby="aia-tab-google" hidden="hidden">
					<div class="aia-note">
						<?php esc_html_e('Use a public Google Doc link or document ID. Private docs must be shared as "Anyone with the link can view" or published to the web.', 'ai-article-publisher'); ?>
					</div>
					<div class="aia-form-grid">
						<label class="aia-field aia-field--full">
							<span><?php esc_html_e('Google Doc Link Or ID', 'ai-article-publisher'); ?></span>
							<input type="text" id="aia-google-document" placeholder="https://docs.google.com/document/d/..." />
						</label>
						<label class="aia-field">
							<span><?php esc_html_e('Publish Mode', 'ai-article-publisher'); ?></span>
							<select id="aia-google-status">
								<option value="draft"><?php esc_html_e('Draft', 'ai-article-publisher'); ?></option>
								<option value="publish"><?php esc_html_e('Publish Now', 'ai-article-publisher'); ?></option>
								<option value="future"><?php esc_html_e('Schedule', 'ai-article-publisher'); ?></option>
							</select>
						</label>
						<label class="aia-field">
							<span><?php esc_html_e('Schedule Date/Time', 'ai-article-publisher'); ?></span>
							<input type="datetime-local" id="aia-google-schedule" disabled="disabled" />
						</label>
					</div>
					<div class="aia-actions">
						<button type="button" class="button button-primary" id="aia-publish-google" data-busy-label="<?php esc_attr_e('Importing...', 'ai-article-publisher'); ?>">
							<?php esc_html_e('Import And Publish', 'ai-article-publisher'); ?>
						</button>
					</div>
				</div>

				<div id="aia-panel-news" class="aia-tabpanel" data-aia-panel="news" role="tabpanel" aria-labelledby="aia-tab-news" hidden="hidden">
					<div class="aia-note">
						<?php esc_html_e('Best for high-volume publishing. Start with draft mode if you want to review rewritten articles before they go live.', 'ai-article-publisher'); ?>
					</div>
					<div class="aia-form-grid">
						<label class="aia-field">
							<span><?php esc_html_e('News Category', 'ai-article-publisher'); ?></span>
							<select id="aia-news-category">
								<?php foreach ($news_categories as $news_category) : ?>
									<option value="<?php echo esc_attr($news_category); ?>" <?php selected('technology', $news_category); ?>>
										<?php echo esc_html($news_category); ?>
									</option>
								<?php endforeach; ?>
							</select>
						</label>
						<label class="aia-field">
							<span><?php esc_html_e('Keyword Filter', 'ai-article-publisher'); ?></span>
							<input type="text" id="aia-news-query" />
						</label>
						<label class="aia-field">
							<span><?php esc_html_e('Language', 'ai-article-publisher'); ?></span>
							<input type="text" id="aia-news-language" value="en" />
						</label>
						<label class="aia-field">
							<span><?php esc_html_e('Max Articles', 'ai-article-publisher'); ?></span>
							<input type="number" id="aia-news-max-articles" min="1" max="5" value="1" />
						</label>
						<label class="aia-field">
							<span><?php esc_html_e('Tone', 'ai-article-publisher'); ?></span>
							<select id="aia-news-tone">
								<?php foreach ($tone_options as $tone_option) : ?>
									<option value="<?php echo esc_attr($tone_option); ?>" <?php selected($settings['default_tone'], $tone_option); ?>>
										<?php echo esc_html($tone_option); ?>
									</option>
								<?php endforeach; ?>
							</select>
						</label>
						<label class="aia-field">
							<span><?php esc_html_e('Word Count', 'ai-article-publisher'); ?></span>
							<input type="number" id="aia-news-word-count" min="300" max="5000" value="1200" />
						</label>
						<label class="aia-field">
							<span><?php esc_html_e('Publish Mode', 'ai-article-publisher'); ?></span>
							<select id="aia-news-status">
								<option value="publish"><?php esc_html_e('Publish Now', 'ai-article-publisher'); ?></option>
								<option value="future"><?php esc_html_e('Schedule', 'ai-article-publisher'); ?></option>
							</select>
						</label>
						<label class="aia-field">
							<span><?php esc_html_e('Schedule Date/Time', 'ai-article-publisher'); ?></span>
							<input type="datetime-local" id="aia-news-schedule" disabled="disabled" />
						</label>
						<label class="aia-field">
							<span><?php esc_html_e('In-Post Images', 'ai-article-publisher'); ?></span>
							<input type="number" id="aia-news-inline-images" min="0" max="10" value="0" />
						</label>
					</div>
					<div class="aia-actions">
						<button type="button" class="button button-primary" id="aia-run-news" data-busy-label="<?php esc_attr_e('Processing news...', 'ai-article-publisher'); ?>">
							<?php esc_html_e('Run News Autopilot', 'ai-article-publisher'); ?>
						</button>
					</div>
				</div>

				<div id="aia-panel-seo" class="aia-tabpanel" data-aia-panel="seo" role="tabpanel" aria-labelledby="aia-tab-seo" hidden="hidden">
					<div class="aia-note"><?php esc_html_e('SEO fields are shared by every publishing workflow. X/Twitter fields can copy Facebook/Open Graph values automatically.', 'ai-article-publisher'); ?></div>
					<div class="aia-actions">
						<button type="button" class="button" id="aia-copy-og-to-twitter"><?php esc_html_e('Copy Facebook To X', 'ai-article-publisher'); ?></button>
					</div>
					<div class="aia-seo-mirror"></div>
				</div>

				<div id="aia-panel-logs" class="aia-tabpanel" data-aia-panel="logs" role="tabpanel" aria-labelledby="aia-tab-logs" hidden="hidden">
					<div class="aia-log-table-wrap">
						<table class="widefat striped aia-log-table">
							<thead>
								<tr>
									<th><?php esc_html_e('Date/time', 'ai-article-publisher'); ?></th>
									<th><?php esc_html_e('Provider', 'ai-article-publisher'); ?></th>
									<th><?php esc_html_e('Action', 'ai-article-publisher'); ?></th>
									<th><?php esc_html_e('Status', 'ai-article-publisher'); ?></th>
									<th><?php esc_html_e('Error message', 'ai-article-publisher'); ?></th>
									<th><?php esc_html_e('Post ID', 'ai-article-publisher'); ?></th>
								</tr>
							</thead>
							<tbody>
								<?php if (empty($logs)) : ?>
									<tr><td colspan="6"><?php esc_html_e('No logs yet.', 'ai-article-publisher'); ?></td></tr>
								<?php else : ?>
									<?php foreach ($logs as $log) : ?>
										<tr>
											<td><?php echo esc_html(isset($log['date']) ? $log['date'] : ''); ?></td>
											<td><?php echo esc_html(isset($log['provider']) ? $log['provider'] : ''); ?></td>
											<td><?php echo esc_html(isset($log['action']) ? $log['action'] : ''); ?></td>
											<td><?php echo esc_html(isset($log['status']) ? $log['status'] : ''); ?></td>
											<td><?php echo esc_html(isset($log['error']) ? $log['error'] : ''); ?></td>
											<td><?php echo esc_html(!empty($log['postId']) ? (string) $log['postId'] : ''); ?></td>
										</tr>
									<?php endforeach; ?>
								<?php endif; ?>
							</tbody>
						</table>
					</div>
				</div>
			</section>
		</div>

		<aside class="aia-sidebar">
			<div class="aia-sidebar__stack">
				<section class="aia-card">
					<div class="aia-card__header">
						<h2><?php esc_html_e('Studio Checklist', 'ai-article-publisher'); ?></h2>
						<p><?php esc_html_e('A quick checklist to keep generation and publishing runs clean.', 'ai-article-publisher'); ?></p>
					</div>
					<ul class="aia-tip-list">
						<?php foreach ($quick_tips as $tip) : ?>
							<li><?php echo esc_html($tip); ?></li>
						<?php endforeach; ?>
					</ul>
				</section>

				<section class="aia-card">
					<div class="aia-card__header">
						<h2><?php esc_html_e('Generated Image', 'ai-article-publisher'); ?></h2>
						<p><?php esc_html_e('Featured image generated in Manual Studio or pulled from a Google Doc.', 'ai-article-publisher'); ?></p>
					</div>
					<div id="aia-image-empty" class="aia-empty-state">
						<p><?php esc_html_e('No featured image yet. Generate one in Manual Studio or import a Google Doc that includes an image.', 'ai-article-publisher'); ?></p>
					</div>
					<div id="aia-image-wrap" class="aia-image-wrap" hidden>
						<img id="aia-image-preview" alt="" />
					</div>
				</section>

				<section class="aia-card">
					<div class="aia-card__header">
						<h2><?php esc_html_e('Run Output', 'ai-article-publisher'); ?></h2>
						<p><?php esc_html_e('Structured responses from generate, import, and publish actions appear here for quick troubleshooting.', 'ai-article-publisher'); ?></p>
					</div>
					<pre id="aia-result" class="aia-result"><?php esc_html_e('No actions run yet.', 'ai-article-publisher'); ?></pre>
				</section>

				<section class="aia-card">
					<div class="aia-card__header">
						<div>
							<h2><?php esc_html_e('Live Preview', 'ai-article-publisher'); ?></h2>
							<p><?php esc_html_e('The manual draft HTML preview updates as soon as content is generated or edited.', 'ai-article-publisher'); ?></p>
						</div>
						<button type="button" class="button" id="aia-open-preview-modal"><?php esc_html_e('Preview Modal', 'ai-article-publisher'); ?></button>
					</div>
					<div id="aia-preview" class="aia-preview">
						<div class="aia-empty-state">
							<p><?php esc_html_e('No draft generated yet. Generate a manual draft to preview the article here.', 'ai-article-publisher'); ?></p>
						</div>
					</div>
				</section>
			</div>
		</aside>
	</div>

	<div id="aia-preview-modal" class="aia-modal" hidden>
		<div class="aia-modal__backdrop" data-aia-close-modal></div>
		<div class="aia-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="aia-preview-modal-title">
			<div class="aia-modal__header">
				<h2 id="aia-preview-modal-title"><?php esc_html_e('Article Preview', 'ai-article-publisher'); ?></h2>
				<button type="button" class="button" data-aia-close-modal><?php esc_html_e('Close', 'ai-article-publisher'); ?></button>
			</div>
			<div id="aia-preview-modal-body" class="aia-preview aia-preview--modal"></div>
		</div>
	</div>
</div>
