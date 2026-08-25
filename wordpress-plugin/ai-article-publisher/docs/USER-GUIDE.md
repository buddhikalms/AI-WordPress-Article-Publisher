# AI Article Publisher User Guide

## Admin Pages

- `Studio`: generate articles, import Google Docs, run News Autopilot, preview output, and publish posts.
- `Credentials`: save OpenAI, Gemini, Claude, optional NewsData keys, and the default tone/model values.
- `Documentation`: quick-start notes, workflow usage, front matter examples, and troubleshooting.

## Setup

1. Activate the plugin in WordPress.
2. Open `AI Publisher > Credentials`.
3. Save the key for your preferred text provider, such as `OpenAI API Key` or `Gemini API Key`.
4. Save the `NewsData API Key` only if you plan to use News Autopilot.
5. Return to `AI Publisher > Studio` to create or import posts.

## Studio Workflow

### Shared Post Setup

- Choose category assignments that should apply to the next publish run.
- Add a new category name if the post should create one on publish.
- Set SEO provider and metadata fields before publishing.

### Manual Studio

1. Enter the article title and topic brief.
2. Add keywords and optional hyperlink requirements.
3. Generate the draft.
4. Review the HTML, excerpt, tags, image, and live preview.
5. Publish as draft, publish immediately, or schedule.

### Google Doc Import

1. Paste a public Google Doc URL or document ID.
2. Choose draft, publish, or schedule.
3. Add `featured_image_url` in front matter, or place the featured image as the first image in the Google Doc.
4. Select AIOSEO or Yoast to let AI generate character-limited SEO metadata during import.
5. Run the import and review the output.

### News Autopilot

1. Select the NewsData category.
2. Optionally add a keyword filter.
3. Set tone, word count, and publish mode.
4. Run the autopilot job and review the results.

## Google Doc Front Matter

Supported metadata keys include:

- `title`
- `slug`
- `excerpt`
- `brief`
- `categories`
- `tags`
- `seo_title`
- `meta_description`
- `focus_keyword`
- `featured_image_url`

Leave `seo_title` and `meta_description` blank or omit them when you want AI Article Publisher to generate AIOSEO/Yoast fields automatically. Generated SEO titles are capped at 60 characters, and generated descriptions are capped at 155 characters.

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

Place your featured image directly below the title if featured_image_url is blank.

Your article body here.
```

## Troubleshooting

- If AI generation fails, confirm the selected provider key and model are saved on the `Credentials` page.
- If Google Doc import fails, make sure the document is public and not behind a Google sign-in wall.
- If News Autopilot returns empty results, confirm the NewsData key is active and try a broader query.
- If SEO updates do not show immediately, your SEO plugin may require reindexing or rebuild steps.
