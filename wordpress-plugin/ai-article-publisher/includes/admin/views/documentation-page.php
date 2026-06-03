<?php

if (!defined('ABSPATH')) {
	exit;
}
?>
<div class="wrap aia-wrap">
	<section class="aia-page-header">
		<div>
			<span class="aia-kicker aia-kicker--dark"><?php esc_html_e('Documentation', 'ai-article-publisher'); ?></span>
			<h1><?php esc_html_e('Plugin Documentation', 'ai-article-publisher'); ?></h1>
			<p class="aia-page-header__description">
				<?php esc_html_e('Setup instructions, workflow guidance, metadata examples, and common troubleshooting notes for the WordPress plugin.', 'ai-article-publisher'); ?>
			</p>
		</div>
	</section>

	<?php include __DIR__ . '/partials/page-nav.php'; ?>

	<div class="aia-docs-grid">
		<section class="aia-card">
			<div class="aia-card__header">
				<h2><?php esc_html_e('Quick Start', 'ai-article-publisher'); ?></h2>
			</div>
			<ol class="aia-doc-steps">
				<?php foreach ($quick_start_steps as $step) : ?>
					<li><?php echo esc_html($step); ?></li>
				<?php endforeach; ?>
			</ol>
		</section>

		<section class="aia-card">
			<div class="aia-card__header">
				<h2><?php esc_html_e('Workflow Guides', 'ai-article-publisher'); ?></h2>
			</div>
			<div class="aia-section-stack">
				<?php foreach ($workflow_docs as $workflow) : ?>
					<article class="aia-doc-card">
						<h3><?php echo esc_html($workflow['title']); ?></h3>
						<ul class="aia-tip-list">
							<?php foreach ($workflow['items'] as $item) : ?>
								<li><?php echo esc_html($item); ?></li>
							<?php endforeach; ?>
						</ul>
					</article>
				<?php endforeach; ?>
			</div>
		</section>

		<section class="aia-card">
			<div class="aia-card__header">
				<h2><?php esc_html_e('Google Doc Front Matter Example', 'ai-article-publisher'); ?></h2>
			</div>
			<pre class="aia-result aia-result--light"><?php echo esc_html($front_matter_example); ?></pre>
		</section>

		<section class="aia-card">
			<div class="aia-card__header">
				<h2><?php esc_html_e('Troubleshooting', 'ai-article-publisher'); ?></h2>
			</div>
			<ul class="aia-tip-list">
				<?php foreach ($troubleshooting_items as $item) : ?>
					<li><?php echo esc_html($item); ?></li>
				<?php endforeach; ?>
			</ul>
		</section>
	</div>
</div>
