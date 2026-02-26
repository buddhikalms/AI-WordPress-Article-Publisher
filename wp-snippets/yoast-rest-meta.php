<?php
/**
 * Yoast REST Meta Registration (MU Plugin)
 *
 * Place this file at:
 * wp-content/mu-plugins/yoast-rest-meta.php
 *
 * This registers common Yoast SEO meta keys for post type "post"
 * so they are writable via the WordPress REST API.
 */

if (!defined('ABSPATH')) {
	exit;
}

add_action('init', function () {
	$yoast_meta_keys = array(
		'_yoast_wpseo_title',
		'_yoast_wpseo_metadesc',
		'_yoast_wpseo_focuskw',
		'_yoast_wpseo_canonical',
		'_yoast_wpseo_opengraph-title',
		'_yoast_wpseo_opengraph-description',
		'_yoast_wpseo_opengraph-image',
		'_yoast_wpseo_twitter-title',
		'_yoast_wpseo_twitter-description',
		'_yoast_wpseo_twitter-image',
	);

	foreach ($yoast_meta_keys as $meta_key) {
		register_post_meta(
			'post',
			$meta_key,
			array(
				'type'              => 'string',
				'single'            => true,
				'show_in_rest'      => true,
				'auth_callback'     => function () {
					return current_user_can('edit_posts');
				},
				'sanitize_callback' => 'sanitize_text_field',
			)
		);
	}
});

