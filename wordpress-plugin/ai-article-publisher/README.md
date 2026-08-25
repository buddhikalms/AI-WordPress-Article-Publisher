# AI Article Publisher WordPress Plugin

Standalone WordPress plugin version of the workflows in this repo:

- Manual article generation with OpenAI, Gemini, or Claude API
- Featured image generation
- Publish now, save draft, or schedule
- Optional in-post image generation
- Google Doc import with lightweight front matter support, direct document HTML preservation, embedded image upload, and document-provided SEO metadata
- NewsData category autopilot with OpenAI, Gemini, or Claude API rewrites
- Yoast and AIOSEO post meta updates with character-limited metadata for Google Doc imports

## Structure

- `ai-article-publisher.php`: plugin bootstrap plus core publishing and API logic
- `includes/class-aia-error.php`: shared plugin exception wrapper
- `includes/admin/class-aia-admin-screen.php`: WordPress admin hooks, asset loading, and screen orchestration
- `includes/admin/views/`: Studio, Credentials, Documentation, and shared admin view partials
- `assets/admin.css` and `assets/admin.js`: admin UI styling and interactions
- `docs/USER-GUIDE.md`: written setup and usage guide

## Install

1. Copy `wordpress-plugin/ai-article-publisher` to `wp-content/plugins/ai-article-publisher`
2. Activate **AI Article Publisher** in WordPress
3. Open **AI Publisher** in the WP admin menu
4. Open **Credentials** and save your preferred provider key, such as `OpenAI API Key` or `Gemini API Key`
5. Save your `NewsData API Key` there if you want News Autopilot
6. Return to **Studio** to generate or import posts

## Admin Pages

- `Studio`: shared publish settings plus Manual Studio, Google Doc Import, and News Autopilot
- `Credentials`: OpenAI, Gemini, Claude, and NewsData API keys, model choice, provider fallback order, and default tone
- `Documentation`: quick-start help, workflow guidance, front matter example, and troubleshooting

## Notes

- This plugin is single-site WordPress admin tooling. It does not include the SaaS app's auth, billing, token accounting, device lock, or multi-site account management.
- Google Doc import expects a public doc link or doc ID. Private docs must be shared as "Anyone with the link can view" or published to the web.
- If `featured_image_url` is empty, the importer uses the first image embedded in the Google Doc as the uploaded WordPress featured image.
- When an SEO provider is selected for Google Doc import, the plugin uses the Google Doc front matter or fallback document-derived metadata for AIOSEO/Yoast. No AI provider key is required for Google Doc import.
- Yoast and AIOSEO support here is direct post-meta writing. If your SEO plugin requires extra indexing/rebuild steps, run those inside WordPress after publishing.
- News Autopilot fetches from `https://newsdata.io/api/1/news`.

## Google Doc front matter

The importer accepts either YAML-style front matter or simple leading `key: value` lines.

Example:

```text
---
title: Best AI SEO Tools for Agencies
slug: best-ai-seo-tools-for-agencies
excerpt: A practical comparison of AI SEO tools for agency teams.
brief: Use a professional angle focused on agencies scaling content.
categories: SEO, AI Tools
tags: ai seo, agency workflows, content automation
focus_keyword: ai seo tools for agencies
featured_image_url:
---

# Best AI SEO Tools for Agencies

Place your featured image directly below the title if `featured_image_url` is blank.

Your article body here.
```

Leave `seo_title` and `meta_description` out when you want AI Article Publisher to generate AIOSEO metadata automatically.
