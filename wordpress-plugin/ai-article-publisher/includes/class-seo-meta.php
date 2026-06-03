<?php

if (!defined('ABSPATH')) {
	exit;
}

final class AIA_SEO_Meta
{
	public function register_rest_fields()
	{
		foreach (array('post', 'page') as $post_type) {
			register_rest_field(
				$post_type,
				'aioseo_meta_data',
				array(
					'get_callback' => array($this, 'get_aioseo_rest_meta'),
					'update_callback' => array($this, 'update_aioseo_rest_meta'),
					'schema' => array(
						'description' => 'AIOSEO-compatible metadata for AI Article Publisher.',
						'type' => 'object',
						'context' => array('edit'),
					),
				)
			);
		}

		foreach ($this->get_registered_meta_keys() as $key) {
			register_post_meta(
				'',
				$key,
				array(
					'show_in_rest' => true,
					'single' => true,
					'type' => 'string',
					'auth_callback' => function () {
						return current_user_can('edit_posts');
					},
				)
			);
		}
	}

	public function apply($post_id, $payload)
	{
		$post_id = (int) $post_id;
		$seo_title = isset($payload['seo_title']) ? sanitize_text_field($payload['seo_title']) : '';
		$meta_description = isset($payload['meta_description']) ? sanitize_textarea_field($payload['meta_description']) : '';
		$focus_keyword = isset($payload['focus_keyword']) ? sanitize_text_field($payload['focus_keyword']) : '';
		$canonical_url = isset($payload['canonical_url']) ? esc_url_raw($payload['canonical_url']) : '';
		$social_title = isset($payload['social_title']) ? sanitize_text_field($payload['social_title']) : $seo_title;
		$social_description = isset($payload['social_description']) ? sanitize_textarea_field($payload['social_description']) : $meta_description;
		$social_image_url = isset($payload['social_image_url']) ? esc_url_raw($payload['social_image_url']) : '';

		$meta = array(
			'_yoast_wpseo_title' => $seo_title,
			'_yoast_wpseo_metadesc' => $meta_description,
			'_yoast_wpseo_focuskw' => $focus_keyword,
			'_yoast_wpseo_canonical' => $canonical_url,
			'_yoast_wpseo_opengraph-title' => $social_title,
			'_yoast_wpseo_opengraph-description' => $social_description,
			'_yoast_wpseo_opengraph-image' => $social_image_url,
			'_yoast_wpseo_twitter-title' => $social_title,
			'_yoast_wpseo_twitter-description' => $social_description,
			'_yoast_wpseo_twitter-image' => $social_image_url,
			'_aioseo_title' => $seo_title,
			'_aioseo_description' => $meta_description,
			'_aioseo_focus_keyphrase' => $focus_keyword,
			'_aioseo_canonical_url' => $canonical_url,
			'_aioseo_og_title' => $social_title,
			'_aioseo_og_description' => $social_description,
			'_aioseo_og_image' => $social_image_url,
			'_aioseo_twitter_title' => $social_title,
			'_aioseo_twitter_description' => $social_description,
			'_aioseo_twitter_image' => $social_image_url,
		);

		foreach ($meta as $key => $value) {
			if ('' === (string) $value) {
				delete_post_meta($post_id, $key);
			} else {
				update_post_meta($post_id, $key, $value);
			}
		}

		return array(
			'ok' => true,
			'post_id' => $post_id,
			'updated_fields' => array_keys(array_filter($meta, 'strlen')),
		);
	}

	public function get_aioseo_rest_meta($post)
	{
		$post_id = is_array($post) && isset($post['id']) ? (int) $post['id'] : 0;
		return array(
			'title' => (string) get_post_meta($post_id, '_aioseo_title', true),
			'description' => (string) get_post_meta($post_id, '_aioseo_description', true),
			'focus_keyphrase' => (string) get_post_meta($post_id, '_aioseo_focus_keyphrase', true),
			'canonical_url' => (string) get_post_meta($post_id, '_aioseo_canonical_url', true),
			'og_title' => (string) get_post_meta($post_id, '_aioseo_og_title', true),
			'og_description' => (string) get_post_meta($post_id, '_aioseo_og_description', true),
			'og_image' => (string) get_post_meta($post_id, '_aioseo_og_image', true),
			'twitter_title' => (string) get_post_meta($post_id, '_aioseo_twitter_title', true),
			'twitter_description' => (string) get_post_meta($post_id, '_aioseo_twitter_description', true),
			'twitter_image' => (string) get_post_meta($post_id, '_aioseo_twitter_image', true),
		);
	}

	public function update_aioseo_rest_meta($value, $post)
	{
		$post_id = is_object($post) && isset($post->ID) ? (int) $post->ID : 0;
		if (!$post_id || !current_user_can('edit_post', $post_id)) {
			return false;
		}
		if (is_string($value)) {
			$decoded = json_decode($value, true);
			$value = is_array($decoded) ? $decoded : array();
		}
		if (!is_array($value)) {
			$value = array();
		}

		$social = isset($value['social']) && is_array($value['social']) ? $value['social'] : array();
		$facebook = isset($social['facebook']) && is_array($social['facebook']) ? $social['facebook'] : array();
		$twitter = isset($social['twitter']) && is_array($social['twitter']) ? $social['twitter'] : array();

		$this->apply(
			$post_id,
			array(
				'seo_title' => isset($value['title']) ? $value['title'] : '',
				'meta_description' => isset($value['description']) ? $value['description'] : '',
				'focus_keyword' => isset($value['focus_keyphrase']) ? $value['focus_keyphrase'] : (isset($value['focus_keyword']) ? $value['focus_keyword'] : ''),
				'canonical_url' => isset($value['canonical_url']) ? $value['canonical_url'] : '',
				'social_title' => isset($value['og_title']) ? $value['og_title'] : (isset($facebook['title']) ? $facebook['title'] : ''),
				'social_description' => isset($value['og_description']) ? $value['og_description'] : (isset($facebook['description']) ? $facebook['description'] : ''),
				'social_image_url' => isset($value['og_image']) ? $value['og_image'] : (isset($facebook['image']) ? $facebook['image'] : ''),
			)
		);

		if (!empty($value['twitter_title']) || !empty($twitter['title'])) {
			update_post_meta($post_id, '_aioseo_twitter_title', sanitize_text_field(!empty($value['twitter_title']) ? $value['twitter_title'] : $twitter['title']));
		}
		if (!empty($value['twitter_description']) || !empty($twitter['description'])) {
			update_post_meta($post_id, '_aioseo_twitter_description', sanitize_textarea_field(!empty($value['twitter_description']) ? $value['twitter_description'] : $twitter['description']));
		}
		if (!empty($value['twitter_image']) || !empty($twitter['image'])) {
			update_post_meta($post_id, '_aioseo_twitter_image', esc_url_raw(!empty($value['twitter_image']) ? $value['twitter_image'] : $twitter['image']));
		}

		return true;
	}

	private function get_registered_meta_keys()
	{
		return array(
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
			'_aioseo_title',
			'_aioseo_description',
			'_aioseo_focus_keyphrase',
			'_aioseo_canonical_url',
			'_aioseo_og_title',
			'_aioseo_og_description',
			'_aioseo_og_image',
			'_aioseo_twitter_title',
			'_aioseo_twitter_description',
			'_aioseo_twitter_image',
		);
	}
}
