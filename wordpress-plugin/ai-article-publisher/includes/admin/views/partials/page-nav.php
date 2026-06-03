<?php

if (!defined('ABSPATH')) {
	exit;
}
?>
<nav class="aia-page-nav" aria-label="<?php esc_attr_e('AI Publisher pages', 'ai-article-publisher'); ?>">
	<?php foreach ($page_nav_items as $nav_item) : ?>
		<a class="aia-page-nav__link<?php echo $current_page === $nav_item['key'] ? ' is-active' : ''; ?>" href="<?php echo esc_url($nav_item['url']); ?>">
			<span class="aia-page-nav__label"><?php echo esc_html($nav_item['label']); ?></span>
			<span class="aia-page-nav__description"><?php echo esc_html($nav_item['description']); ?></span>
		</a>
	<?php endforeach; ?>
</nav>
