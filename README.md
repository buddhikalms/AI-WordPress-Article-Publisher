# AI Article Publisher

AI Article Publisher is a content automation project for generating, importing, optimizing, and publishing SEO-ready WordPress articles. The repository contains two related products:

- A **Next.js SaaS platform** for users who need accounts, billing, token usage, multi-site WordPress publishing, and admin controls.
- A **standalone WordPress plugin** for site owners who want the same publishing workflow directly inside the WordPress admin area.

The main purpose of the project is to reduce the time between content idea and live WordPress post while keeping editorial control, SEO metadata, images, scheduling, billing, and publishing permissions manageable.

## Main Key Points

- AI-assisted article generation from a structured title, brief, tone, keywords, word count, and required links.
- Featured image generation and optional in-post image generation.
- Direct publishing to WordPress as draft, published post, or scheduled post.
- Google Doc import that preserves document HTML, embedded images, and document-provided metadata.
- NewsData-powered news autopublishing with AI rewriting and fresh image generation.
- Yoast and AIOSEO metadata support for SEO title, meta description, focus keyword, canonical URL, Open Graph, and Twitter metadata.
- Multi-site WordPress management in the SaaS app, including a default publishing target.
- User registration, credentials login, Google OAuth login, email verification, and concurrent multi-device access.
- Token-based usage billing with Stripe checkout and webhook-based token crediting.
- Admin panel for users, packages, and token adjustments.
- Standalone WordPress plugin with Studio, Credentials, Documentation, and MCP-compatible WordPress publishing tools.

## Project Structure

```text
app/                              Next.js App Router pages and API routes
components/                       Reusable dashboard and workspace UI components
lib/                              App services for auth, OpenAI, WordPress, SEO, Stripe, tokens, mail, and validation
prisma/                           Prisma schema, migrations, and seed script
docs/                             Shared project documentation and Google Doc sample format
wordpress-plugin/ai-article-publisher/
                                  Standalone WordPress plugin
wp-snippets/                      Optional WordPress snippets, including Yoast REST meta support
```

## Technology Stack

- Next.js 14 with App Router
- React 18
- TypeScript
- Tailwind CSS
- Prisma 7
- MySQL or MariaDB
- NextAuth
- OpenAI API
- NewsData API
- Stripe
- Nodemailer SMTP email delivery
- WordPress REST API
- PHP 7.4+ and WordPress 6.4+ for the plugin

## SaaS Platform Overview

The SaaS application is the full commercial version of the project. It supports multiple users, payment packages, token balances, protected publishing actions, and multiple connected WordPress sites per account.

### SaaS Features

- **Authentication:** credentials login, Google login, registration, email verification, protected sessions.
- **Multi-device access:** one user account can stay signed in on multiple devices at the same time.
- **WordPress site management:** save multiple WordPress sites, choose a default site, and publish to a selected site.
- **Manual article studio:** generate articles from briefs, keywords, tone, links, and SEO settings.
- **Google Doc import:** publish a prepared Google Doc directly into WordPress.
- **News autopilot:** fetch category news, rewrite it, generate images, and publish.
- **SEO controls:** choose AIOSEO, Yoast, or no SEO provider per publish workflow.
- **Billing:** users buy token packages through Stripe.
- **Usage accounting:** article generation, image generation, and publishing consume tokens.
- **Admin operations:** admins manage packages, users, and token adjustments.

### SaaS Access Points

Run the app locally and open:

```text
http://localhost:3000
```

Important pages:

- `/login` - sign in, register, and verify email.
- `/` - public marketing website.
- `/app/dashboard` - authenticated workspace for manual generation, Google Doc import, and news autopublishing.
- `/account` - manage profile, password, connected WordPress sites, and default site.
- `/billing` - view token balance, buy packages, and review purchase history.
- `/admin` - admin-only user, package, and token management.

Important API routes:

- `/api/auth/[...nextauth]` - NextAuth credentials and Google login.
- `/api/auth/register` - user registration.
- `/api/auth/verify-email` - email code verification.
- `/api/auth/resend-code` - resend verification code.
- `/api/me` - account summary, sites, purchases, and token balance.
- `/api/account/wordpress` - create, update, delete, and set default WordPress sites.
- `/api/generate-article` - generate an article draft.
- `/api/generate-image` - generate an image.
- `/api/publish` - publish to WordPress.
- `/api/google-doc-publish` - import and publish from Google Docs.
- `/api/news-autopublish` - fetch, rewrite, and publish news articles.
- `/api/packages` - list active billing packages.
- `/api/stripe/checkout` - create Stripe checkout session.
- `/api/stripe/confirm` - confirm a successful checkout.
- `/api/stripe/webhook` - receive Stripe webhook events.
- `/api/admin/users` - admin user list.
- `/api/admin/packages` - admin package management.
- `/api/admin/tokens` - admin token adjustments.

## WordPress Plugin Overview

The standalone plugin is intended for WordPress administrators who want AI publishing tools inside their own WordPress dashboard without running the SaaS platform.

Plugin path:

```text
wordpress-plugin/ai-article-publisher
```

Plugin zip:

```text
wordpress-plugin/ai-article-publisher/ai-article-publisher.zip
```

### Plugin Features

- Manual article generation inside WordPress.
- Featured image generation.
- Optional in-post image generation.
- Publish as draft, publish immediately, or schedule.
- Google Doc import with front matter, embedded image upload, and SEO metadata support.
- NewsData category autopilot with OpenAI rewriting.
- AIOSEO and Yoast metadata updates.
- Credentials page for API keys and model settings.
- Documentation page inside the WordPress admin.
- MCP-style REST tools for external AI clients that need to create or update WordPress content.

### Plugin Access Points

After installing and activating the plugin in WordPress, open:

```text
WordPress Admin > AI Publisher
```

Plugin admin pages:

- `AI Publisher > Studio` - generate, import, preview, and publish posts.
- `AI Publisher > Credentials` - save OpenAI, Claude, NewsData, model, provider, and tone settings.
- `AI Publisher > Documentation` - read setup notes, workflow guidance, examples, and troubleshooting.

Plugin REST integration:

```text
/wp-json/aia-mcp/v1/mcp
/wp-json/aia-mcp/v1/approve
```

The MCP tool layer includes WordPress actions such as creating posts, creating pages, updating posts, creating categories and tags, searching posts, uploading images from URLs, and setting SEO metadata.

## Installation And Setup

### SaaS Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables in `.env`.

Required values:

```text
DATABASE_URL
APP_ENCRYPTION_KEY
NEXTAUTH_SECRET
NEXTAUTH_URL
NEXT_PUBLIC_APP_URL
OPENAI_API_KEY
NEWSDATA_API_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
SMTP_FROM
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

Optional values:

```text
ADMIN_EMAILS
NEWSDATA_BASE_URL
```

3. Generate Prisma Client:

```bash
npx prisma generate
```

4. Apply database migrations:

```bash
npx prisma migrate deploy
```

5. Optional: seed starter data:

```bash
npm run prisma:seed
```

6. Start the development server:

```bash
npm run dev
```

7. Open:

```text
http://localhost:3000
```

### WordPress Plugin Setup

1. Copy the plugin folder into WordPress:

```text
wordpress-plugin/ai-article-publisher
```

to:

```text
wp-content/plugins/ai-article-publisher
```

2. Activate **AI Article Publisher** in WordPress.
3. Open `AI Publisher > Credentials`.
4. Save the OpenAI API key.
5. Save the NewsData API key if News Autopilot will be used.
6. Return to `AI Publisher > Studio`.
7. Generate, import, preview, and publish posts.

## How To Access And Use

### For SaaS Users

1. Open `/login`.
2. Register an account or sign in with Google.
3. Verify the email address if using credentials registration.
4. Go to `/account` and add at least one WordPress site.
5. Create a WordPress Application Password in the WordPress user profile and save it in the SaaS account site settings.
6. Go to `/billing` and purchase or receive tokens.
7. Open `/` and choose a workspace mode:
   - Manual Studio
   - Google Doc Import
   - News Autopilot
8. Review the generated content and SEO fields.
9. Publish as draft, publish now, or schedule.

### For SaaS Admins

1. Sign in with an admin account.
2. Open `/admin`.
3. Create or update token packages.
4. Assign Stripe price IDs to packages.
5. View users and connected WordPress sites.
6. Credit or debit user tokens when needed.

### For WordPress Plugin Users

1. Open `AI Publisher > Credentials`.
2. Add provider keys and default settings.
3. Open `AI Publisher > Studio`.
4. Choose one of the workflows:
   - Manual article generation
   - Google Doc import
   - News Autopilot
5. Set categories, tags, SEO provider, post status, and schedule time.
6. Preview the result.
7. Publish to WordPress.

## Core Workflows

### Manual Article Generation

Use this when you have a title, brief, target keyword, tone, and editorial requirements.

The system can generate:

- WordPress-ready HTML
- SEO title
- Meta description
- Focus keyword
- Suggested tags
- Excerpt
- Featured image
- Optional in-post images
- Required and optional links

### Google Doc Import

Use this when writers prepare articles in Google Docs and the publisher needs to move them into WordPress with minimal formatting loss.

The importer supports:

- Public Google Doc URLs or document IDs.
- Preserved document HTML.
- Embedded image upload.
- First embedded image as featured image when `featured_image_url` is blank.
- Front matter metadata.
- Category and tag metadata.
- SEO metadata for AIOSEO and Yoast.

Example Google Doc front matter:

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

### News Autopilot

Use this when a site needs fresh posts based on current news topics.

The workflow:

1. Choose a NewsData category.
2. Add an optional keyword filter.
3. Select tone, word count, SEO provider, categories, tags, and post status.
4. Fetch news.
5. Rewrite article content with AI.
6. Generate a fresh image.
7. Publish or schedule the result.

### WordPress Publishing

Publishing supports:

- Draft posts
- Immediate publishing
- Scheduled publishing
- Existing category selection
- New category creation
- Existing tag selection
- New tag creation
- Featured image upload
- In-post image insertion
- AIOSEO or Yoast metadata updates

## Use Cases

### Content Agencies

Agencies can manage publishing for multiple client WordPress sites from one SaaS account. The multi-site workflow helps teams move from brief to client-ready draft quickly while keeping token usage measurable.

### SEO Teams

SEO teams can generate optimized articles with focus keywords, metadata, internal or external link requirements, and structured headings. Yoast and AIOSEO support reduces duplicate metadata entry.

### News And Niche Publishers

Publishers can use News Autopilot to turn category-based news into rewritten WordPress posts with generated images. This is useful for high-frequency publishing sites that still need editorial control.

### Blog Owners

Solo publishers can use the WordPress plugin to generate articles, import Google Docs, and publish from the WordPress admin without maintaining a separate SaaS installation.

### Editorial Teams Using Google Docs

Teams that draft in Google Docs can preserve their writing workflow and use Google Doc Import as the bridge into WordPress. Front matter gives editors control over slug, excerpt, categories, tags, SEO metadata, and featured images.

### SaaS Operators

The platform can be sold as a token-based content generation and publishing service. Stripe package management, webhook token crediting, and admin token adjustments provide the foundation for a commercial workflow.

### AI Tool Integrations

The plugin's MCP-compatible REST route can expose WordPress publishing tools to external AI clients. This allows approved tools to create posts, update posts, create terms, upload images, and set SEO fields.

## Advantages

- **Faster publishing:** reduces manual copy, paste, image handling, formatting, and metadata entry.
- **Editorial control:** users can preview, adjust, draft, publish, or schedule instead of publishing blindly.
- **SEO-ready output:** supports focus keywords, metadata, excerpts, tags, canonical URLs, Open Graph, and Twitter metadata.
- **Multi-site support:** the SaaS app supports multiple WordPress targets per user.
- **Commercial ready:** token accounting and Stripe checkout make usage easier to monetize.
- **Flexible deployment:** run as a SaaS platform or as a standalone WordPress plugin.
- **Google Docs compatibility:** keeps existing writer and editor workflows intact.
- **Automation with guardrails:** News Autopilot can speed up news publishing while still allowing category, tag, SEO, and status controls.
- **Reduced plugin lock-in:** supports both AIOSEO and Yoast metadata paths.
- **Operational visibility:** admins can review users, token balances, packages, and purchases.
- **Secure credential handling:** WordPress credentials are encrypted in the SaaS database.
- **Cost control:** token costs make expensive actions visible and limited.

## Token Costs

Token costs are configured in `lib/tokens.ts`.

| Action | Cost |
| --- | ---: |
| Article generation | 5 tokens |
| Image generation | 2 tokens |
| Publish to WordPress | 1 token |

## Database Models

The SaaS application uses Prisma models for:

- `User`
- `Account`
- `Session`
- `VerificationToken`
- `WordPressCredential`
- `DeviceRegistration`
- `Package`
- `PackagePurchase`
- `TokenTransaction`
- `GenerationUsage`
- `EmailVerificationCode`

The schema is located at:

```text
prisma/schema.prisma
```

## SEO Support

The project supports:

- AIOSEO metadata
- Yoast metadata
- SEO title
- Meta description
- Focus keyword
- Canonical URL
- Open Graph title, description, and image
- Twitter title, description, and image

For Yoast REST API workflows, the optional snippet in `wp-snippets/yoast-rest-meta.php` can be installed as a WordPress MU plugin:

```text
wp-content/mu-plugins/yoast-rest-meta.php
```

## Security And Permissions

- WordPress credentials are encrypted before storage in the SaaS database.
- Credentials login requires email verification.
- Account access is protected by verified credentials or Google OAuth and supports concurrent device sessions.
- Admin pages are role-protected.
- Publishing requests require authenticated users.
- WordPress publishing uses WordPress Application Passwords.
- Plugin AJAX actions check WordPress capabilities and nonces.
- Plugin MCP publishing requires configured authorization and admin approval.

## Operational Notes

- Prisma 7 is configured through `prisma.config.ts`.
- The Prisma datasource URL is not stored directly in `schema.prisma`.
- Prisma Client uses `@prisma/adapter-mariadb` in `lib/prisma.ts`.
- Stripe webhooks must point to `/api/stripe/webhook`.
- Google Doc links must be public, shared as "Anyone with the link can view", or published to the web.
- If a Google Doc does not provide `featured_image_url`, the first embedded image can become the featured image.
- News Autopilot uses NewsData. The default endpoint can be overridden with `NEWSDATA_BASE_URL`.
- The standalone plugin does not include SaaS auth, billing, token accounting, or multi-site account management.

## Development Commands

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run dev
npm run build
npm run typecheck
```

## Recommended User Journey

1. Install and configure the SaaS app or WordPress plugin.
2. Add API keys and WordPress credentials.
3. Prepare a content brief or Google Doc.
4. Generate or import the article.
5. Review title, HTML, excerpt, image, categories, tags, and SEO fields.
6. Publish as draft first for editorial review.
7. Schedule or publish when approved.
8. Track token usage and purchases from billing or admin tools.

## Documentation Files

- `docs/SAMPLE-GOOGLE-DOC-FORMAT.md` - sample Google Doc front matter and article structure.
- `wordpress-plugin/ai-article-publisher/README.md` - plugin-specific overview.
- `wordpress-plugin/ai-article-publisher/docs/USER-GUIDE.md` - plugin setup and usage guide.
