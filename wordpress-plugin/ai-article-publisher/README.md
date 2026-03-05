# AI Article Publisher WordPress Plugin

Standalone WordPress plugin version of the workflows in this repo:

- Manual article generation with OpenAI
- Featured image generation
- Publish now, save draft, or schedule
- Optional in-post image generation
- Google Doc import with lightweight front matter support
- NewsData category autopilot with OpenAI rewrites
- Basic Yoast and AIOSEO post meta updates

## Install

1. Copy `wordpress-plugin/ai-article-publisher` to `wp-content/plugins/ai-article-publisher`
2. Activate **AI Article Publisher** in WordPress
3. Open **AI Publisher** in the WP admin menu
4. Save your `OpenAI API Key`
5. Save your `NewsData API Key` if you want News Autopilot

## Notes

- This plugin is single-site WordPress admin tooling. It does not include the SaaS app's auth, billing, token accounting, device lock, or multi-site account management.
- Google Doc import expects a public doc link or doc ID. Private docs must be shared as "Anyone with the link can view" or published to the web.
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
seo_title: Best AI SEO Tools for Agencies in 2026
meta_description: Compare the top AI SEO tools agencies can use to scale content and research.
focus_keyword: ai seo tools for agencies
featured_image_url: https://example.com/image.jpg
---

# Best AI SEO Tools for Agencies

Your article body here.
```
