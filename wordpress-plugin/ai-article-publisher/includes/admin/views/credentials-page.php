<?php

if (!defined('ABSPATH')) {
	exit;
}
?>
<div class="wrap aia-wrap">
	<section class="aia-page-header">
		<div>
			<span class="aia-kicker aia-kicker--dark"><?php esc_html_e('Credentials', 'ai-article-publisher'); ?></span>
			<h1><?php esc_html_e('API Credentials & Defaults', 'ai-article-publisher'); ?></h1>
			<p class="aia-page-header__description">
				<?php esc_html_e('Keep site credentials, model preferences, and plugin defaults on a dedicated page so editors can focus on publishing inside the Studio.', 'ai-article-publisher'); ?>
			</p>
		</div>
	</section>

	<?php include __DIR__ . '/partials/page-nav.php'; ?>

	<?php if ($settings_saved) : ?>
		<div class="notice notice-success aia-notice is-dismissible">
			<p><?php esc_html_e('Plugin settings saved.', 'ai-article-publisher'); ?></p>
		</div>
	<?php endif; ?>

	<div class="aia-credential-grid">
		<section class="aia-card">
			<div class="aia-card__header">
				<div>
					<h2><?php esc_html_e('Credentials Form', 'ai-article-publisher'); ?></h2>
					<p><?php esc_html_e('Save the API keys used by this plugin on the current WordPress site.', 'ai-article-publisher'); ?></p>
				</div>
				<span class="aia-pill"><?php esc_html_e('Admin only', 'ai-article-publisher'); ?></span>
			</div>
			<form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" class="aia-settings-grid">
				<input type="hidden" name="action" value="<?php echo esc_attr(AI_Article_Publisher::SAVE_SETTINGS_ACTION); ?>" />
				<?php wp_nonce_field(AI_Article_Publisher::SAVE_SETTINGS_ACTION); ?>
				<label class="aia-field">
					<span><?php esc_html_e('Default Provider', 'ai-article-publisher'); ?></span>
					<select name="settings[default_provider]">
						<option value="openai" <?php selected($settings['default_provider'], 'openai'); ?>><?php esc_html_e('OpenAI', 'ai-article-publisher'); ?></option>
						<option value="gemini" <?php selected($settings['default_provider'], 'gemini'); ?>><?php esc_html_e('Gemini', 'ai-article-publisher'); ?></option>
						<option value="claude_api" <?php selected($settings['default_provider'], 'claude_api'); ?>><?php esc_html_e('Claude API', 'ai-article-publisher'); ?></option>
						<option value="claude_desktop_manual" <?php selected($settings['default_provider'], 'claude_desktop_manual'); ?>><?php esc_html_e('Claude Desktop Manual', 'ai-article-publisher'); ?></option>
					</select>
				</label>
				<label class="aia-field">
					<span><?php esc_html_e('OpenAI API Key', 'ai-article-publisher'); ?></span>
					<input type="password" name="settings[openai_api_key]" value="<?php echo esc_attr($settings['openai_api_key']); ?>" autocomplete="off" />
				</label>
				<label class="aia-field">
					<span><?php esc_html_e('OpenAI Text Model', 'ai-article-publisher'); ?></span>
					<input type="text" name="settings[openai_text_model]" value="<?php echo esc_attr($settings['openai_text_model']); ?>" placeholder="<?php echo esc_attr(AI_Article_Publisher::DEFAULT_TEXT_MODEL); ?>" />
				</label>
				<label class="aia-field">
					<span><?php esc_html_e('OpenAI Image Model', 'ai-article-publisher'); ?></span>
					<input type="text" name="settings[openai_image_model]" value="<?php echo esc_attr($settings['openai_image_model']); ?>" placeholder="<?php echo esc_attr(AI_Article_Publisher::IMAGE_MODEL); ?>" />
				</label>
				<label class="aia-field">
					<span><?php esc_html_e('Claude API Key', 'ai-article-publisher'); ?></span>
					<input type="password" name="settings[claude_api_key]" value="<?php echo esc_attr($settings['claude_api_key']); ?>" autocomplete="off" />
				</label>
				<label class="aia-field">
					<span><?php esc_html_e('Claude Model', 'ai-article-publisher'); ?></span>
					<input type="text" name="settings[claude_model]" value="<?php echo esc_attr($settings['claude_model']); ?>" placeholder="<?php echo esc_attr(AI_Article_Publisher::DEFAULT_CLAUDE_MODEL); ?>" />
				</label>
				<label class="aia-field">
					<span><?php esc_html_e('Gemini API Key', 'ai-article-publisher'); ?></span>
					<input type="password" name="settings[gemini_api_key]" value="<?php echo esc_attr($settings['gemini_api_key']); ?>" autocomplete="off" />
				</label>
				<label class="aia-field">
					<span><?php esc_html_e('Gemini Model', 'ai-article-publisher'); ?></span>
					<input type="text" name="settings[gemini_model]" value="<?php echo esc_attr($settings['gemini_model']); ?>" placeholder="<?php echo esc_attr(AI_Article_Publisher::DEFAULT_GEMINI_MODEL); ?>" />
				</label>
				<label class="aia-field">
					<span><?php esc_html_e('Provider Fallback Order', 'ai-article-publisher'); ?></span>
					<input type="text" name="settings[provider_fallback_order]" value="<?php echo esc_attr($settings['provider_fallback_order']); ?>" placeholder="openai,gemini,claude_api" />
				</label>
				<label class="aia-field">
					<span><?php esc_html_e('Temperature', 'ai-article-publisher'); ?></span>
					<input type="number" step="0.1" min="0" max="2" name="settings[temperature]" value="<?php echo esc_attr($settings['temperature']); ?>" />
				</label>
				<label class="aia-field">
					<span><?php esc_html_e('Max Tokens', 'ai-article-publisher'); ?></span>
					<input type="number" min="512" max="20000" name="settings[max_tokens]" value="<?php echo esc_attr($settings['max_tokens']); ?>" />
				</label>
				<label class="aia-field">
					<span><?php esc_html_e('NewsData API Key', 'ai-article-publisher'); ?></span>
					<input type="password" name="settings[newsdata_api_key]" value="<?php echo esc_attr($settings['newsdata_api_key']); ?>" autocomplete="off" />
				</label>
				<label class="aia-field">
					<span><?php esc_html_e('Default Tone', 'ai-article-publisher'); ?></span>
					<select name="settings[default_tone]">
						<?php foreach ($tone_options as $tone_option) : ?>
							<option value="<?php echo esc_attr($tone_option); ?>" <?php selected($settings['default_tone'], $tone_option); ?>>
								<?php echo esc_html($tone_option); ?>
							</option>
						<?php endforeach; ?>
					</select>
				</label>
				<div class="aia-settings-actions">
					<button type="submit" class="button button-primary"><?php esc_html_e('Save Credentials', 'ai-article-publisher'); ?></button>
				</div>
			</form>
		</section>

		<div class="aia-section-stack">
			<section class="aia-card">
				<div class="aia-card__header">
					<h2><?php esc_html_e('Credential Status', 'ai-article-publisher'); ?></h2>
				</div>
				<div class="aia-docs-grid">
					<?php foreach ($credential_cards as $card) : ?>
						<article class="aia-doc-card">
							<span class="aia-doc-card__eyebrow"><?php echo esc_html($card['label']); ?></span>
							<h3 class="<?php echo $card['is_ready'] ? 'aia-credential-status is-ready' : 'aia-credential-status'; ?>">
								<?php echo esc_html($card['status']); ?>
							</h3>
							<p><?php echo esc_html($card['description']); ?></p>
						</article>
					<?php endforeach; ?>
				</div>
			</section>

			<section class="aia-card">
				<div class="aia-card__header">
					<h2><?php esc_html_e('Security Notes', 'ai-article-publisher'); ?></h2>
				</div>
				<ul class="aia-tip-list">
					<?php foreach ($security_notes as $note) : ?>
						<li><?php echo esc_html($note); ?></li>
					<?php endforeach; ?>
				</ul>
			</section>
		</div>
	</div>
</div>
