# AI Article Publisher: System Overview And Use Guide

## Two-Minute Overview

AI Article Publisher is a WordPress content automation system that helps users move from an idea, brief, Google Doc, or news topic to a published SEO-ready WordPress post. It combines article generation, image generation, Google Doc import, SEO metadata, publishing controls, scheduling, and token-based usage management.

The system can be used in two ways:

- As a Next.js SaaS platform for teams, agencies, and operators who need user accounts, billing, multi-site WordPress publishing, token usage, and admin controls.
- As a standalone WordPress plugin for site owners who want article generation and publishing tools inside the WordPress dashboard.

The main value is speed with control. Users can generate or import content, review the result, choose categories and tags, set SEO fields, add featured images, then publish as a draft, publish immediately, or schedule the post.

## Main Points

- Generate SEO-focused articles from a title, brief, tone, keywords, word count, and link requirements.
- Generate featured images and optional in-post images.
- Import public Google Docs while preserving article HTML, embedded images, and front matter metadata.
- Use the first image in a Google Doc as the featured image when no image URL is supplied.
- Rewrite fresh news from NewsData and publish it with AI-generated images.
- Publish directly to WordPress as a draft, live post, or scheduled post.
- Support AIOSEO and Yoast metadata, including SEO title, meta description, focus keyword, canonical URL, Open Graph, and Twitter fields.
- Manage multiple WordPress sites from the SaaS app.
- Sell usage through Stripe token packages.
- Manage users, packages, and token balances from the admin panel.
- Use the WordPress plugin for a simpler single-site workflow inside WordPress.

## Who It Is For

- Content agencies that publish for multiple client sites.
- SEO teams that need structured articles, metadata, and internal or external link control.
- Blog owners who want to create posts faster without leaving WordPress.
- News and niche publishers that need frequent content based on current topics.
- Editorial teams that draft in Google Docs and need a clean path into WordPress.
- SaaS operators who want to sell AI content generation and WordPress publishing as a token-based service.

## Core Benefits

- Faster publishing: reduces manual copy/paste, image handling, formatting, and metadata entry.
- Better SEO consistency: generates or stores metadata for AIOSEO and Yoast.
- Editorial safety: users can preview and publish as draft before anything goes live.
- Multi-site control: SaaS users can save and publish to multiple WordPress sites.
- Flexible deployment: use the hosted SaaS workflow or install the standalone WordPress plugin.
- Lower operational friction: billing, tokens, admin controls, and publishing permissions are built in.
- Google Docs compatibility: writers can keep using Google Docs while publishers keep WordPress clean.
- Automation with guardrails: News Autopilot speeds up publishing while still giving category, tag, SEO, and status controls.

## Main Workflows

### 1. Manual Article Generation

Use this when you already have a topic, title, brief, target keyword, and desired tone.

The user enters the article requirements, generates the content, reviews the draft, adjusts SEO fields, and publishes to WordPress. This is best for planned blog posts, service pages, tutorials, comparison articles, and SEO content.

### 2. Google Doc Import

Use this when writers prepare articles in Google Docs.

The Google Doc can include front matter for title, slug, excerpt, brief, categories, tags, focus keyword, canonical URL, and featured image URL. If the featured image URL is blank, the importer can upload the first embedded image from the document and set it as the WordPress featured image.

Google Doc sharing must be set to "Anyone with the link can view" or the document must be published to the web.

### 3. News Autopilot

Use this when the site needs fresh posts based on current news topics.

The system fetches news from NewsData, rewrites the article with AI, generates a new image, applies categories, tags, and SEO metadata, then publishes or schedules the post.

### 4. WordPress Publishing

Publishing supports draft posts, immediate publishing, scheduled publishing, category and tag assignment, featured image upload, in-post images, and SEO metadata updates for AIOSEO or Yoast.

## SaaS Platform Use Guide

### Setup

1. Install the project dependencies with `npm install`.
2. Configure `.env` with database, OpenAI, NewsData, Google OAuth, SMTP, Stripe, and app secrets.
3. Generate Prisma Client with `npx prisma generate`.
4. Apply database migrations with `npx prisma migrate deploy`.
5. Optionally seed starter data with `npm run prisma:seed`.
6. Start the app with `npm run dev`.
7. Open `http://localhost:3000`.

### User Workflow

1. Open `/login`.
2. Register an account or sign in with Google.
3. Verify the email address if using credentials registration.
4. Open `/account`.
5. Add at least one WordPress site.
6. Create a WordPress Application Password in the WordPress user profile.
7. Save the WordPress URL, username, and application password in the SaaS account settings.
8. Open `/billing` and purchase or receive tokens.
9. Open `/` and choose Manual Studio, Google Doc Import, or News Autopilot.
10. Review generated content, images, categories, tags, excerpt, and SEO fields.
11. Publish as draft, publish immediately, or schedule.

### Admin Workflow

1. Sign in with an admin account.
2. Open `/admin`.
3. Create or update token packages.
4. Add Stripe price IDs to paid packages.
5. Review users and connected WordPress sites.
6. Credit or debit user tokens when support or sales operations require it.

## WordPress Plugin Use Guide

### Setup

1. Copy `wordpress-plugin/ai-article-publisher` into `wp-content/plugins/ai-article-publisher`.
2. Activate "AI Article Publisher" in WordPress.
3. Open `AI Publisher > Credentials`.
4. Save the OpenAI API key.
5. Save the NewsData API key if News Autopilot will be used.
6. Return to `AI Publisher > Studio`.

### Plugin Workflow

1. Choose Manual Article, Google Doc Import, or News Autopilot.
2. Enter the topic, brief, keywords, links, or Google Doc URL.
3. Select categories, tags, SEO provider, post status, and schedule time.
4. Generate or import the content.
5. Preview the article.
6. Publish as draft, publish immediately, or schedule.

## Recommended Google Doc Format

Use front matter at the top of the Google Doc when importing structured articles:

```text
---
title: Best AI SEO Tools for Agencies
slug: best-ai-seo-tools-for-agencies
excerpt: A practical comparison of AI SEO tools for agency teams.
brief: Compare tools for agencies scaling keyword research, outlines, and publishing workflows.
categories: SEO, AI Tools
tags: ai seo, agency workflows, content automation
focus_keyword: ai seo tools for agencies
canonical_url:
featured_image_url:
---
```

Leave `seo_title` and `meta_description` out when you want the system to generate SEO fields automatically. Generated SEO titles are capped at 60 characters. Generated meta, Open Graph, and Twitter descriptions are capped at 155 characters.

## Common Use Cases

### Agency Client Publishing

An agency can connect multiple client WordPress sites, generate posts for each client, apply SEO fields, and publish drafts for approval. Token usage makes cost tracking clearer.

### SEO Blog Production

An SEO team can generate articles around focus keywords, required links, structured headings, meta descriptions, and optimized titles, then publish directly into WordPress.

### Google Docs Editorial Workflow

Writers can draft in Google Docs while publishers use Google Doc Import to move approved content into WordPress with images, metadata, categories, and tags.

### News-Based Content Sites

A publisher can choose a news category, rewrite current stories, generate images, and schedule posts for frequent publishing.

### Single-Site WordPress Owners

A site owner can install the plugin and create content directly from the WordPress admin area without running the SaaS app.

## Quick Best Practices

- Publish as draft first when using the system for a new site or client.
- Use clear briefs with target audience, tone, keyword, and required links.
- Review AI-generated facts before publishing, especially for news and technical content.
- Use WordPress Application Passwords instead of account passwords.
- Keep SEO provider selection consistent per site.
- Use Google Doc front matter when editors need predictable slugs, excerpts, categories, and tags.
- Monitor token usage so teams understand which actions cost the most.

## One-Sentence Summary

AI Article Publisher helps teams generate, import, optimize, and publish WordPress content faster while keeping editorial review, SEO metadata, images, scheduling, billing, and site management under control.
