<?php

if (!defined('ABSPATH')) {
	exit;
}

final class AIA_MCP_Tools
{
	/** @var AIA_MCP_Auth */
	private $auth;

	/** @var AIA_SEO_Meta */
	private $seo;

	public function __construct(AIA_MCP_Auth $auth, AIA_SEO_Meta $seo)
	{
		$this->auth = $auth;
		$this->seo = $seo;
	}

	public function get_tool_definitions()
	{
		return array(
			$this->tool('wordpress_create_post', 'Create a WordPress blog post or page with categories, tags, featured image, and SEO fields.'),
			$this->tool('wordpress_create_page', 'Create a WordPress page.'),
			$this->tool('wordpress_update_post', 'Update an existing WordPress post.'),
			$this->tool('wordpress_add_category', 'Create a WordPress category.'),
			$this->tool('wordpress_add_tag', 'Create a WordPress tag.'),
			$this->tool('wordpress_search_posts', 'Search existing WordPress posts.'),
			$this->tool('wordpress_get_categories', 'Get WordPress site categories.'),
			$this->tool('wordpress_get_tags', 'Get WordPress site tags.'),
			$this->tool('wordpress_upload_image_from_url', 'Upload an image from a URL and optionally set it as a featured image.'),
			$this->tool('wordpress_set_seo_meta', 'Set Yoast and AIOSEO compatible SEO metadata.'),
		);
	}

	public function call($name, $arguments)
	{
		$arguments = is_array($arguments) ? $arguments : array();
		switch ($name) {
			case 'wordpress_create_post':
				return $this->create_post($arguments);
			case 'wordpress_create_page':
				$arguments['type'] = 'page';
				return $this->create_post($arguments);
			case 'wordpress_update_post':
				return $this->update_post($arguments);
			case 'wordpress_add_category':
				return $this->create_term_tool($arguments, 'category');
			case 'wordpress_add_tag':
				return $this->create_term_tool($arguments, 'post_tag');
			case 'wordpress_search_posts':
				return $this->search_posts($arguments);
			case 'wordpress_get_categories':
				return $this->get_terms('category');
			case 'wordpress_get_tags':
				return $this->get_terms('post_tag');
			case 'wordpress_upload_image_from_url':
				return $this->upload_image_from_url($arguments);
			case 'wordpress_set_seo_meta':
				return $this->set_seo_meta($arguments);
			default:
				throw new AI_Article_Publisher_Error('Unknown MCP tool.', 400, array('tool' => $name));
		}
	}

	private function tool($name, $description)
	{
		return array(
			'name' => $name,
			'description' => $description,
			'inputSchema' => array(
				'type' => 'object',
				'additionalProperties' => true,
			),
		);
	}

	private function create_post($args)
	{
		$settings = $this->auth->get_settings();
		if (!$this->auth->author_can_publish($settings)) {
			throw new AI_Article_Publisher_Error('Configured MCP author is not allowed to publish.', 403);
		}
		$title = $this->require_text(isset($args['title']) ? $args['title'] : '', 'Post title is required.', 3);
		$content = wp_kses_post($this->require_text(isset($args['content']) ? $args['content'] : '', 'Post content is required.', 20));
		$status = $this->sanitize_status(isset($args['status']) ? $args['status'] : $settings['default_post_status'], $settings);
		$type = ('page' === (isset($args['type']) ? sanitize_key($args['type']) : 'post')) ? 'page' : 'post';
		$author_id = (int) $settings['default_author'];

		$postarr = array(
			'post_title' => $title,
			'post_content' => $content,
			'post_excerpt' => isset($args['excerpt']) ? sanitize_textarea_field($args['excerpt']) : '',
			'post_status' => $status,
			'post_type' => $type,
			'post_author' => $author_id,
		);
		$post_id = wp_insert_post($postarr, true);
		if (is_wp_error($post_id)) {
			throw new AI_Article_Publisher_Error($post_id->get_error_message(), 500);
		}

		if ('post' === $type) {
			$category_ids = array();
			if (!empty($settings['default_category'])) {
				$category_ids[] = (int) $settings['default_category'];
			}
			if (!empty($args['category'])) {
				$category_ids[] = $this->ensure_term((string) $args['category'], 'category');
			}
			if (!empty($category_ids)) {
				wp_set_post_categories($post_id, array_values(array_unique($category_ids)), false);
			}
			if (!empty($args['tags']) && is_array($args['tags'])) {
				wp_set_post_tags($post_id, array_map('sanitize_text_field', $args['tags']), false);
			}
		}

		$featured_media = null;
		if (!empty($args['featured_image_url'])) {
			$featured_media = $this->upload_image_from_url(
				array(
					'image_url' => $args['featured_image_url'],
					'alt_text' => $title,
					'set_as_featured_for_post_id' => $post_id,
				)
			);
		}

		if (!empty($settings['seo_fields_enabled'])) {
			$this->seo->apply(
				$post_id,
				array(
					'seo_title' => isset($args['seo_title']) ? $args['seo_title'] : '',
					'meta_description' => isset($args['meta_description']) ? $args['meta_description'] : '',
					'focus_keyword' => isset($args['focus_keyword']) ? $args['focus_keyword'] : '',
				)
			);
		}

		$this->auth->log('Claude Desktop MCP', 'wordpress_create_post', 'success', '', (int) $post_id);
		return $this->post_response($post_id, array('featured_media' => $featured_media));
	}

	private function update_post($args)
	{
		$post_id = isset($args['post_id']) ? (int) $args['post_id'] : 0;
		if (!$post_id || !get_post($post_id)) {
			throw new AI_Article_Publisher_Error('Valid post_id is required.', 400);
		}
		$settings = $this->auth->get_settings();
		if (!$this->auth->author_can_publish($settings)) {
			throw new AI_Article_Publisher_Error('Configured MCP author is not allowed to update posts.', 403);
		}
		$postarr = array('ID' => $post_id);
		if (isset($args['title']) && '' !== trim((string) $args['title'])) {
			$postarr['post_title'] = sanitize_text_field($args['title']);
		}
		if (isset($args['content']) && '' !== trim((string) $args['content'])) {
			$postarr['post_content'] = wp_kses_post($args['content']);
		}
		if (isset($args['status']) && '' !== trim((string) $args['status'])) {
			$postarr['post_status'] = $this->sanitize_status($args['status'], $settings);
		}
		if (isset($args['excerpt'])) {
			$postarr['post_excerpt'] = sanitize_textarea_field($args['excerpt']);
		}

		$result = wp_update_post($postarr, true);
		if (is_wp_error($result)) {
			throw new AI_Article_Publisher_Error($result->get_error_message(), 500);
		}
		$this->auth->log('Claude Desktop MCP', 'wordpress_update_post', 'success', '', $post_id);
		return $this->post_response($post_id);
	}

	private function search_posts($args)
	{
		$status = isset($args['status']) ? sanitize_key($args['status']) : 'any';
		if (!in_array($status, array('draft', 'publish', 'any'), true)) {
			$status = 'any';
		}
		$query = new WP_Query(
			array(
				's' => isset($args['query']) ? sanitize_text_field($args['query']) : '',
				'post_type' => array('post', 'page'),
				'post_status' => $status,
				'posts_per_page' => 10,
				'no_found_rows' => true,
			)
		);
		$posts = array();
		foreach ($query->posts as $post) {
			$posts[] = $this->post_response((int) $post->ID);
		}
		$this->auth->log('Claude Desktop MCP', 'wordpress_search_posts', 'success', '', 0);
		return array('posts' => $posts);
	}

	private function create_term_tool($args, $taxonomy)
	{
		$name = isset($args['name']) ? sanitize_text_field($args['name']) : '';
		if (!$name) {
			throw new AI_Article_Publisher_Error('Term name is required.', 400);
		}
		$term_id = $this->ensure_term($name, $taxonomy);
		$term = get_term($term_id, $taxonomy);
		$this->auth->log('Claude Desktop MCP', 'category' === $taxonomy ? 'wordpress_add_category' : 'wordpress_add_tag', 'success', '', 0);
		return array(
			'id' => (int) $term_id,
			'name' => $term && !is_wp_error($term) ? $term->name : $name,
			'slug' => $term && !is_wp_error($term) ? $term->slug : sanitize_title($name),
			'taxonomy' => $taxonomy,
		);
	}

	private function get_terms($taxonomy)
	{
		$terms = get_terms(array('taxonomy' => $taxonomy, 'hide_empty' => false));
		if (is_wp_error($terms)) {
			throw new AI_Article_Publisher_Error($terms->get_error_message(), 500);
		}
		$items = array();
		foreach ($terms as $term) {
			$items[] = array(
				'id' => (int) $term->term_id,
				'name' => $term->name,
				'slug' => $term->slug,
				'count' => (int) $term->count,
			);
		}
		$this->auth->log('Claude Desktop MCP', 'get_' . $taxonomy, 'success', '', 0);
		return array('items' => $items);
	}

	private function upload_image_from_url($args)
	{
		$settings = $this->auth->get_settings();
		if (empty($settings['media_uploads_enabled'])) {
			throw new AI_Article_Publisher_Error('Media uploads are disabled for MCP.', 403);
		}
		$image_url = isset($args['image_url']) ? esc_url_raw($args['image_url']) : '';
		if (!$image_url || !filter_var($image_url, FILTER_VALIDATE_URL)) {
			throw new AI_Article_Publisher_Error('A valid image_url is required.', 400);
		}

		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';

		$tmp = download_url($image_url, 60);
		if (is_wp_error($tmp)) {
			throw new AI_Article_Publisher_Error($tmp->get_error_message(), 500);
		}
		$file = array(
			'name' => basename((string) wp_parse_url($image_url, PHP_URL_PATH)),
			'tmp_name' => $tmp,
		);
		if (!$file['name']) {
			$file['name'] = 'mcp-image.jpg';
		}
		$attachment_id = media_handle_sideload($file, 0);
		if (is_wp_error($attachment_id)) {
			@unlink($tmp);
			throw new AI_Article_Publisher_Error($attachment_id->get_error_message(), 500);
		}
		if (!empty($args['alt_text'])) {
			update_post_meta($attachment_id, '_wp_attachment_image_alt', sanitize_text_field($args['alt_text']));
		}
		if (!empty($args['set_as_featured_for_post_id'])) {
			set_post_thumbnail((int) $args['set_as_featured_for_post_id'], (int) $attachment_id);
		}

		$this->auth->log('Claude Desktop MCP', 'wordpress_upload_image_from_url', 'success', '', !empty($args['set_as_featured_for_post_id']) ? (int) $args['set_as_featured_for_post_id'] : 0);
		return array(
			'attachment_id' => (int) $attachment_id,
			'url' => wp_get_attachment_url($attachment_id),
		);
	}

	private function set_seo_meta($args)
	{
		$settings = $this->auth->get_settings();
		if (empty($settings['seo_fields_enabled'])) {
			throw new AI_Article_Publisher_Error('SEO fields are disabled for MCP.', 403);
		}
		$post_id = isset($args['post_id']) ? (int) $args['post_id'] : 0;
		if (!$post_id || !get_post($post_id)) {
			throw new AI_Article_Publisher_Error('Valid post_id is required.', 400);
		}
		$result = $this->seo->apply($post_id, $args);
		$this->auth->log('Claude Desktop MCP', 'wordpress_set_seo_meta', 'success', '', $post_id);
		return $result;
	}

	private function sanitize_status($status, $settings)
	{
		$status = sanitize_key($status ? $status : $settings['default_post_status']);
		if (!in_array($status, array('draft', 'publish'), true)) {
			$status = $settings['default_post_status'];
		}
		return $status;
	}

	private function ensure_term($name, $taxonomy)
	{
		$name = sanitize_text_field($name);
		$term = term_exists($name, $taxonomy);
		if (!$term) {
			$term = wp_insert_term($name, $taxonomy);
		}
		if (is_wp_error($term)) {
			throw new AI_Article_Publisher_Error($term->get_error_message(), 500);
		}
		return is_array($term) ? (int) $term['term_id'] : (int) $term;
	}

	private function require_text($value, $message, $min)
	{
		$text = trim((string) $value);
		if (strlen(wp_strip_all_tags($text)) < $min) {
			throw new AI_Article_Publisher_Error($message, 400);
		}
		return $text;
	}

	private function post_response($post_id, $extra = array())
	{
		$post = get_post($post_id);
		return array_merge(
			array(
				'post_id' => (int) $post_id,
				'title' => get_the_title($post_id),
				'status' => get_post_status($post_id),
				'type' => $post ? $post->post_type : '',
				'link' => get_permalink($post_id),
			),
			$extra
		);
	}
}
