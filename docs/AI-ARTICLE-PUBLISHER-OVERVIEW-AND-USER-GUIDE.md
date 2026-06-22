# AI Article Publisher: Complete System And WordPress Plugin Guide

Document version: 1.0  
System reviewed: June 22, 2026  
SaaS package version: 0.1.0  
WordPress plugin version: 0.7.2

## 1. Executive Summary

AI Article Publisher is a content production and WordPress publishing system. It turns a content brief, a public Google Doc, or a current news item into an SEO-ready WordPress post with editorial controls, images, taxonomy, metadata, and publishing options.

The repository contains two related but independently deployable products:

- A Next.js SaaS platform for multiple users, multiple WordPress sites, authentication, token billing, Stripe payments, and administration.
- A standalone WordPress plugin for a single WordPress installation, with AI generation, Google Doc import, news rewriting, Claude workflows, and an MCP-compatible publishing server.

The products share the same publishing goal, but they are not required to run together. A customer may use the SaaS application to publish remotely through the WordPress REST API, or install the plugin and work entirely inside WordPress.

## 2. Product Scope

### 2.1 Problems The System Solves

- Reduces manual drafting, formatting, image handling, and WordPress data entry.
- Preserves an editorial review step before content is published.
- Standardizes SEO titles, descriptions, focus keywords, canonical URLs, and social metadata.
- Connects Google Docs-based writing teams to WordPress.
- Supports repeatable news-based publishing without copying source articles verbatim.
- Gives a SaaS operator a token-based commercial model.
- Gives external AI clients controlled WordPress publishing tools through the plugin MCP server.

### 2.2 Intended Users

- Content and SEO agencies managing client sites.
- Editorial teams that prepare articles in Google Docs.
- Blog owners and niche publishers.
- News publishers that need high-frequency drafts.
- SaaS operators selling AI content services.
- WordPress administrators connecting Claude Desktop or another compatible client.

### 2.3 Main Capabilities

- Generate WordPress-ready article HTML from structured inputs.
- Generate a featured image and up to 10 requested in-post images.
- Enforce required links and apply dofollow or nofollow policies.
- Import public Google Docs, front matter, and embedded images.
- Fetch NewsData stories and rewrite them as original posts.
- Create or select WordPress categories and tags.
- Publish as a draft, publish immediately, or schedule where the workflow supports it.
- Apply AIOSEO or Yoast metadata.
- Preview output before publication.
- Record usage and operational logs.

## 3. Product Comparison

| Capability | SaaS Platform | WordPress Plugin |
| --- | --- | --- |
| User accounts and roles | Yes | Uses WordPress users and capabilities |
| Multiple WordPress sites per user | Yes | No; operates on the installed site |
| Token metering | Yes | No |
| Stripe package purchases | Yes | No |
| Manual article generation | OpenAI | OpenAI or Claude API; manual Claude bridge also available |
| Image generation | OpenAI | OpenAI |
| Google Doc import | Yes | Yes |
| NewsData autopublishing | Yes | Yes |
| AIOSEO and Yoast support | Yes | Yes |
| MCP publishing server | No | Yes |
| Admin activity logs | Usage and transaction records | Studio and MCP logs |

## 4. System Architecture

### 4.1 SaaS Architecture

The SaaS application uses Next.js App Router for pages and server-side API routes. React and Tailwind CSS provide the user interface. NextAuth manages credentials and Google authentication. Prisma connects to MySQL or MariaDB. OpenAI supplies text and image generation, NewsData supplies source news, Stripe handles checkout, and Nodemailer sends verification email.

Remote publishing uses the WordPress REST API with a WordPress username and Application Password. Each user's site credentials are stored in the application database, and the Application Password is encrypted with `APP_ENCRYPTION_KEY`.

Typical request flow:

1. The authenticated browser submits a validated request to a Next.js API route.
2. The route checks the user's account and token balance.
3. The service calls OpenAI, NewsData, Google Docs, or WordPress as required.
4. WordPress categories, tags, media, posts, and SEO fields are created or updated.
5. Tokens are charged only through the token transaction service, with a usage record for auditable actions.
6. The API returns the post result and the latest token balance.

### 4.2 WordPress Plugin Architecture

The plugin is a PHP 7.4+ WordPress plugin. Its admin UI uses PHP views, `admin.js`, and `admin.css`. WordPress AJAX actions perform generation, import, validation, image, and publishing operations. WordPress nonces and capability checks protect admin actions.

The plugin stores its provider keys and defaults in WordPress options. It calls provider APIs directly from the WordPress server and creates content through WordPress core functions. It does not use SaaS accounts, the SaaS database, Stripe, or SaaS tokens.

The MCP module adds a token-protected WordPress REST endpoint, an approval step, role and author controls, feature switches, rate limiting, client tracking, and activity logs.

### 4.3 Repository Layout

```text
app/                                      Next.js pages and API routes
components/                               Shared React components
lib/                                      Auth, AI, WordPress, SEO, billing, and utility services
prisma/                                   Schema, migrations, and seed data
docs/                                     Shared product documentation
scripts/                                  Documentation conversion tooling
wordpress-plugin/ai-article-publisher/    Standalone WordPress plugin source and zip
wp-snippets/                              Optional WordPress REST helpers
```

## 5. SaaS Platform User Guide

### 5.1 Main Pages

- `/login`: registration, email verification, credentials login, and Google login.
- `/`: public product website.
- `/app/dashboard`: Manual Studio, Google Doc Import, News Autopilot, article preview, and publishing controls.
- `/account`: profile, password, WordPress sites, connection health, and default site selection.
- `/billing`: token balance, active packages, Stripe checkout, and purchase history.
- `/admin`: administrator-only users, token packages, and balance adjustments.

### 5.2 Registration And Sign-In

Credentials users register with a name, email address, and password. The system sends a verification code through configured SMTP. Credentials login is rejected until the email is verified. Google OAuth users are treated as verified by the Google sign-in flow.

The NextAuth session strategy is JWT. Application roles are `USER` and `ADMIN`. Email addresses listed in `ADMIN_EMAILS` are promoted to the administrator role during sign-in. The application supports concurrent sessions; the current `DeviceRegistration` model records one latest device registration per account but is not used to enforce a one-device restriction.

### 5.3 Connecting WordPress

1. In WordPress, open the profile of a user allowed to create and publish posts.
2. Create a WordPress Application Password.
3. In the SaaS application, open `/account`.
4. Add a site name, base URL, WordPress username, and Application Password.
5. Run the health check.
6. Mark the site as default if it should be selected automatically.

Each user may save multiple sites. The combination of user and base URL is unique. Deleting a site removes its stored credentials but does not delete content already published to WordPress.

### 5.4 Manual Article Workflow

1. Select the destination site.
2. Enter a title of at least 3 characters and a brief of at least 10 characters.
3. Enter keywords, a focus keyword, tone, and a word count from 300 to 5,000.
4. Add up to 50 links with URL, anchor text, required/optional status, and dofollow/nofollow behavior.
5. Generate the article.
6. Review the HTML, title, excerpt, suggested tags, and SEO fields.
7. Generate a featured image if needed.
8. Choose 0 to 10 in-post images.
9. Select or create categories and tags.
10. Choose AIOSEO, Yoast, or no SEO provider.
11. Publish as draft, publish now, or schedule for a future ISO date/time.

Generated article output includes HTML, title, excerpt, suggested tags, SEO title, meta description, focus keyword, canonical URL, Open Graph data, and X/Twitter data.

Required links are validated against exact URL and anchor-text matches. Duplicate required links are reduced, and link attributes are normalized. All configured links open in a new tab with `noopener noreferrer`; nofollow links also receive `nofollow`.

### 5.5 Google Doc Import Workflow

1. Share the Google Doc as "Anyone with the link can view" or publish it to the web.
2. Paste the document URL or document ID.
3. Select the destination site, status, categories, tags, and SEO provider.
4. Supply a future time when scheduling.
5. Import and publish.

The importer preserves usable document HTML, uploads embedded images to WordPress, and reads supported leading metadata. If `featured_image_url` is blank, the first embedded document image may become the featured image. The document must be accessible without a Google login.

Supported metadata keys and aliases include:

- `title`
- `slug`, `url`, or `permalink`
- `excerpt`
- `brief`
- `image_prompt`, `featured_image_prompt`, or `prompt`
- `seo_title` or `meta_title`
- `meta_description` or `seo_description`
- `focus_keyword`
- `canonical_url`
- `featured_image_url`, `featured_image`, or `image_url`
- `categories` or `category`
- `tags` or `tag`

Recommended front matter:

```text
---
title: Best AI SEO Tools for Agencies
slug: best-ai-seo-tools-for-agencies
excerpt: A practical comparison of AI SEO tools for agency teams.
brief: Compare tools for agencies scaling content production.
categories: SEO, AI Tools
tags: ai seo, agency workflows, content automation
seo_title: Best AI SEO Tools for Agencies
meta_description: Compare practical AI SEO tools for agency teams.
focus_keyword: ai seo tools for agencies
canonical_url:
featured_image_url:
---
```

### 5.6 News Autopilot Workflow

1. Select one of the supported NewsData categories: business, entertainment, environment, food, health, politics, science, sports, technology, top, tourism, or world.
2. Optionally enter a query and language code.
3. Select 1 to 5 source articles.
4. Choose tone, word count, image count, taxonomy, SEO provider, and publishing status.
5. Run the workflow and review the returned results.

For each source, the application generates an original rewrite, generates a featured image, optionally creates in-post images, and publishes the resulting WordPress post. Operators should still review source accuracy, licensing implications, attribution requirements, and generated claims. The feature is a production accelerator, not a substitute for editorial verification.

### 5.7 SEO Support

The publishing layer supports:

- SEO title and meta description.
- Focus keyword.
- Canonical URL.
- Open Graph title, description, and image.
- X/Twitter title, description, and image.
- AIOSEO and Yoast storage paths.

WordPress REST exposure varies by SEO plugin and site configuration. The optional `wp-snippets/yoast-rest-meta.php` file can be installed as `wp-content/mu-plugins/yoast-rest-meta.php` when Yoast fields need explicit REST registration. Use `/api/seo-health` to diagnose provider availability.

### 5.8 Billing And Token Usage

The configured SaaS costs are:

| Action | Cost |
| --- | ---: |
| Article generation | 5 tokens |
| Image generation | 2 tokens |
| WordPress publishing | 1 token |
| One News Autopilot post | 8 tokens before optional extra in-post images |
| Google Doc import and publish | 1 token |

Token debits require a sufficient balance and are recorded in `TokenTransaction` and `GenerationUsage`. A request ID can make a metered operation idempotent, preventing the same request from being charged twice. Package purchases create purchase records; Stripe webhook and confirmation logic credit paid purchases. Administrators can also credit or debit balances.

### 5.9 SaaS Administrator Guide

Administrators can:

- View users and current balances.
- Inspect connected-site summaries.
- Create, update, activate, deactivate, and delete packages where permitted.
- Set package price, currency, token amount, feature list, Stripe product ID, and Stripe price ID.
- Credit or debit user tokens with an audit description.

Stripe should be configured with a webhook pointing to `/api/stripe/webhook`. Package price IDs must refer to the corresponding Stripe prices. Webhook signing requires `STRIPE_WEBHOOK_SECRET`.

## 6. SaaS API Reference

All account, generation, publishing, and admin routes require the appropriate authenticated session unless noted by their login or webhook purpose.

| Route | Methods | Purpose |
| --- | --- | --- |
| `/api/auth/[...nextauth]` | NextAuth handlers | Credentials and Google authentication |
| `/api/auth/register` | POST | Register credentials user and send verification code |
| `/api/auth/verify-email` | POST | Verify an email code |
| `/api/auth/resend-code` | POST | Send a replacement verification code |
| `/api/me` | GET | Return user, sites, purchases, and balance |
| `/api/account/profile` | PATCH | Update profile |
| `/api/account/password` | PATCH | Change credentials password |
| `/api/account/wordpress` | GET, POST, PATCH, DELETE | Manage WordPress sites and default selection |
| `/api/wp-health` | GET | Test selected WordPress connection |
| `/api/wp-categories` | GET, POST | List or create WordPress categories |
| `/api/wp-tags` | GET, POST | List or create WordPress tags |
| `/api/seo-health` | GET | Inspect SEO integration health |
| `/api/generate-article` | POST | Generate structured article output |
| `/api/generate-image` | POST | Generate an image |
| `/api/publish` | POST | Create WordPress media, taxonomy, post, and SEO data |
| `/api/google-doc-publish` | POST | Import a Google Doc and publish it |
| `/api/news-autopublish` | POST | Fetch, rewrite, image, and publish news items |
| `/api/packages` | GET | List active token packages |
| `/api/stripe/checkout` | POST | Create Stripe Checkout session |
| `/api/stripe/confirm` | POST | Confirm and reconcile checkout |
| `/api/stripe/webhook` | POST | Process signed Stripe events |
| `/api/admin/users` | GET | List users for administrators |
| `/api/admin/packages` | GET, POST, PUT, DELETE | Manage packages |
| `/api/admin/tokens` | POST | Adjust a user's balance |

## 7. SaaS Data Model

- `User`: identity, role, verification state, password hash, and token balance.
- `WordPressCredential`: encrypted per-user WordPress site connection and default flag.
- `DeviceRegistration`: latest registered device identifier and user agent.
- `Package`: commercial offer, price, currency, tokens, Stripe identifiers, and active state.
- `PackagePurchase`: checkout/payment state and granted token snapshot.
- `TokenTransaction`: immutable-style balance ledger entry with resulting balance.
- `GenerationUsage`: metered action, token amount, metadata, and optional unique request ID.
- `EmailVerificationCode`: hashed verification code, expiry, and consumption state.
- `Account`, `Session`, and `VerificationToken`: NextAuth-compatible account data.

Deleting a user cascades to their connected sites, purchases, transactions, usage, verification codes, OAuth accounts, and sessions. Package deletion is restricted while purchases refer to it.

## 8. SaaS Installation And Operations

### 8.1 Requirements

- A current Node.js release compatible with Next.js 14.
- MySQL or MariaDB.
- OpenAI API credentials.
- SMTP credentials for credentials-account verification.
- Stripe credentials when selling packages.
- NewsData credentials when using News Autopilot.
- Google OAuth credentials when enabling Google login.
- WordPress sites with REST API access and Application Password support.

### 8.2 Environment Variables

Core variables:

```text
DATABASE_URL
APP_ENCRYPTION_KEY
NEXTAUTH_SECRET
NEXTAUTH_URL
NEXT_PUBLIC_APP_URL
OPENAI_API_KEY
```

Feature variables:

```text
OPENAI_TEXT_MODEL
NEWSDATA_API_KEY
NEWSDATA_BASE_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASS
SMTP_FROM
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
ADMIN_EMAILS
APP_URL
MYSQL_ALLOW_PUBLIC_KEY_RETRIEVAL
```

Legacy single-site variables `WORDPRESS_BASE_URL`, `WORDPRESS_USERNAME`, and `WORDPRESS_APP_PASSWORD` are read by the lower-level WordPress helper, while normal SaaS usage selects encrypted per-user credentials.

### 8.3 Installation

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

For production, configure HTTPS and environment secrets, run `npm run build`, then run `npm start` behind the chosen reverse proxy or hosting platform.

### 8.4 Verification Commands

```bash
npm run typecheck
npm run build
```

The `lint` script uses `next lint`, which belongs to the Next.js 14 toolchain and may require framework-specific configuration.

## 9. WordPress Plugin Guide

### 9.1 Requirements And Package

- WordPress 6.4 or later.
- PHP 7.4 or later.
- WordPress administrator access for installation and settings.
- Outbound HTTPS access from WordPress to the selected AI and news providers.
- OpenAI, Claude, and/or NewsData credentials according to the workflows used.

Source directory:

```text
wordpress-plugin/ai-article-publisher
```

Installable archive:

```text
wordpress-plugin/ai-article-publisher/ai-article-publisher.zip
```

### 9.2 Installation

1. In WordPress, open Plugins > Add New > Upload Plugin.
2. Upload `ai-article-publisher.zip`.
3. Install and activate AI Article Publisher.
4. Open AI Publisher > Credentials.
5. Configure the required provider and model settings.
6. Open AI Publisher > Studio and run a draft workflow.

Alternatively, copy the plugin folder to `wp-content/plugins/ai-article-publisher` and activate it from the Plugins screen.

### 9.3 Admin Pages

- `AI Publisher > Studio`: shared post setup, Manual Studio, Claude Desktop Mode, Google Doc Import, News Autopilot, SEO, logs, preview, and output.
- `AI Publisher > Credentials`: API keys, models, fallback order, temperature, maximum tokens, default provider, and default tone.
- `AI Publisher > Documentation`: embedded setup, workflow, front matter, and troubleshooting help.
- `AI Publisher > MCP Server`: external client endpoint, connection approval, permissions, author defaults, clients, and activity logs.

### 9.4 Provider Configuration

The plugin supports three text-generation modes:

- `OpenAI`: automated generation through the OpenAI API.
- `Claude API`: automated generation through the Anthropic Messages API.
- `Claude Desktop Manual`: WordPress creates a prompt; the user runs it manually in Claude Desktop and pastes the returned JSON into WordPress for validation and publication.

Credential settings include default provider, OpenAI API key, OpenAI text model, OpenAI image model, Claude API key, Claude model, provider fallback order, temperature from 0 to 2, maximum tokens from 512 to 20,000, NewsData API key, and default tone.

The provider fallback order can contain automated providers such as `openai,claude_api`. Manual Claude mode is deliberately a copy-and-paste bridge and does not automate the Claude Desktop application. Image generation remains an OpenAI operation even when Claude generates article text.

### 9.5 Shared Post Setup

Before running a Studio workflow, choose the post status, schedule time when applicable, categories, tags, SEO provider, and shared metadata. Draft mode is recommended for the first run on a new site. The SEO tab allows Open Graph values to be copied into X/Twitter fields.

### 9.6 Manual Studio

1. Enter title, brief, keywords, focus keyword, tone, word count, and link requirements.
2. Select an automated provider and generate, or use the dedicated Claude Desktop Mode.
3. Review and edit the returned HTML and metadata.
4. Generate a featured image if required.
5. Select the in-post image count.
6. Preview the article.
7. Publish, schedule, or save as draft.

The plugin validates required links, removes duplicate exact required links, and applies link follow policies before publication.

### 9.7 Claude Desktop Manual Mode

1. Fill in the article requirements.
2. Open the Claude Desktop Mode tab.
3. Generate the Claude-ready prompt.
4. Paste the prompt into Claude Desktop.
5. Ask Claude to return the required JSON structure.
6. Paste that JSON back into WordPress.
7. Validate the JSON.
8. Review the populated draft and publish through the normal controls.

This mode avoids an Anthropic API call from WordPress. It still requires a person to transfer the prompt and result, and it is distinct from the automated MCP server.

### 9.8 Google Doc Import

The plugin accepts the same public document URL/ID pattern and front matter described in the SaaS guide. It converts readable content, uploads embedded images, and can use the first embedded image as featured media. A provider key is not required merely to import document content or apply document-derived SEO fallbacks.

### 9.9 News Autopilot

The plugin requests NewsData items, rewrites each source using the configured text provider, generates fresh images through OpenAI, and creates WordPress posts. The UI accepts category, optional keyword, language, 1 to 5 articles, tone, 300 to 5,000 words, immediate or scheduled status, and 0 to 10 in-post images.

Use draft status during validation and monitor provider cost, timeout limits, WordPress cron behavior, and source accuracy when processing several items.

### 9.10 Plugin Logs And Diagnostics

Studio logs show date/time, provider, action, status, error, and post ID. Structured AJAX responses are displayed in Run Output. The live preview updates after generation or editing. Credential cards show which integrations are ready.

Provider keys are stored in the WordPress database. Access to the Credentials page must be limited to trusted administrators, the site should use HTTPS, and database backups should be protected as secrets.

## 10. WordPress MCP Server

### 10.1 Purpose

The plugin MCP server exposes controlled WordPress operations to Claude Desktop or another compatible client. It can create and update content, work with taxonomy, upload remote images, and set SEO metadata without granting the client a normal WordPress password.

Endpoints:

```text
/wp-json/aia-mcp/v1/mcp
/wp-json/aia-mcp/v1/approve
```

The generated MCP URL contains a secret query token. The server also accepts the token as a Bearer authorization value.

### 10.2 Connection Setup

1. Open AI Publisher > MCP Server.
2. Select a default author with the required publishing capability.
3. Set allowed roles, default draft/publish status, and optional default category.
4. Enable or disable remote media uploads and SEO fields.
5. Enable the MCP server and save settings.
6. Copy the generated MCP URL into the compatible client's custom connector settings.
7. Let the client contact WordPress once so it appears as pending.
8. Return to WordPress and approve the connection.
9. Test with a draft creation request.

Regenerating the token clears tracked clients and requires approval again. Revoking a connection disables its approval state.

### 10.3 Available MCP Tools

- `wordpress_create_post`: create a post with content, excerpt, taxonomy, featured image, and SEO fields.
- `wordpress_create_page`: create a WordPress page.
- `wordpress_update_post`: update title, content, excerpt, or status.
- `wordpress_add_category`: create or return a category.
- `wordpress_add_tag`: create or return a tag.
- `wordpress_search_posts`: search up to 10 posts/pages by query and status.
- `wordpress_get_categories`: list categories.
- `wordpress_get_tags`: list tags.
- `wordpress_upload_image_from_url`: sideload an image and optionally set featured media.
- `wordpress_set_seo_meta`: apply compatible SEO metadata to an existing post.

MCP create/update status is limited to draft or publish. Scheduled publishing is handled by the Studio workflows, not the current MCP tool implementation.

### 10.4 MCP Security Controls

- Server-wide enable switch.
- 48-character generated secret token.
- Constant-time token comparison.
- Explicit administrator approval after client discovery.
- Connection revocation and token regeneration.
- Allowed WordPress roles restricted to administrator and editor.
- Configured default author must have `publish_posts`.
- Default status can be forced to draft.
- Independent media-upload and SEO-field switches.
- Per client/IP bucket limit of 60 requests per minute.
- Tracking for up to 20 recent clients.
- Up to 200 stored log entries, with the dashboard returning the latest entries.
- WordPress sanitization and `wp_kses_post` filtering before content storage.

Because the query-token URL is a credential, do not place it in screenshots, public tickets, analytics, or shared documents. Regenerate the token immediately after suspected exposure.

## 11. WordPress And SEO Publishing Details

Publishing may perform the following ordered operations:

1. Validate the requested content and future date.
2. Resolve existing and new categories.
3. Resolve existing, new, and suggested tags.
4. Upload featured media.
5. Generate and upload requested in-post images.
6. Insert in-post image figures through the body.
7. Create the WordPress post with draft, publish, or future status.
8. Apply selected AIOSEO or Yoast metadata.
9. Return post ID, status, and link.

SEO plugin field names and REST permissions can change between SEO plugin releases. Always test on staging after updating Yoast, AIOSEO, WordPress, or this plugin.

## 12. Security, Privacy, And Governance

### 12.1 SaaS Controls

- Passwords are hashed with bcrypt.
- Credentials accounts require email verification.
- WordPress Application Passwords are encrypted at rest.
- Authenticated routes resolve the database user from the session.
- Administrator routes enforce the `ADMIN` role.
- Stripe webhooks verify their signing secret.
- Zod schemas constrain URLs, dates, counts, statuses, and payload sizes.
- Atomic database updates prevent a balance from falling below zero during concurrent charges.

### 12.2 Operational Responsibilities

- Store all environment variables in a secret manager in production.
- Use a strong, stable `APP_ENCRYPTION_KEY`; changing it without migration prevents stored WordPress passwords from being decrypted.
- Rotate WordPress Application Passwords, provider keys, Stripe keys, and MCP tokens after exposure.
- Grant connected WordPress accounts only the capabilities required by the publishing workflow.
- Use HTTPS for the SaaS application and WordPress.
- Restrict WordPress admin and database backup access.
- Review AI output for factual, legal, brand, copyright, and disclosure requirements.
- Define retention policies for user data, provider prompts, purchases, logs, and generated content.

### 12.3 Important Limitations

- AI output can be inaccurate and requires editorial review.
- Google Docs must be publicly readable to the unauthenticated importer.
- Generated or remotely downloaded images must be reviewed for suitability and rights.
- News rewriting does not remove the need to verify facts or honor source obligations.
- SEO metadata depends on the installed SEO plugin and its supported storage/REST behavior.
- The standalone plugin has no SaaS billing, token balance, or multi-site account layer.
- The SaaS does not expose the plugin's MCP server.
- MCP tool schemas currently allow additional properties and rely on each tool's runtime validation.

## 13. Troubleshooting

### WordPress Connection Fails

- Confirm the base URL includes the correct scheme and no incorrect subdirectory.
- Confirm REST endpoints are not blocked by a firewall or security plugin.
- Recreate the Application Password and verify the username.
- Confirm the WordPress user can upload media and create the requested post status.

### Article Or Image Generation Fails

- Verify the provider key and selected model.
- Confirm the server can make outbound HTTPS requests.
- Check provider quota, billing, model access, timeout, and response logs.
- For plugin image generation, configure OpenAI even when Claude supplies article text.

### Google Doc Import Fails

- Open the link in a private browser window; it must not show a Google login wall.
- Use a standard Google Doc URL or document ID.
- Ensure readable body text follows the title/front matter.
- Check whether embedded image URLs are accessible from the server.

### News Autopilot Returns No Items

- Verify the NewsData key.
- Use a supported category and a broader query.
- Check the language value and provider response.
- Reduce the article count while diagnosing timeout or quota errors.

### Scheduling Fails

- Supply a valid future date/time.
- Check the WordPress site timezone.
- Confirm WordPress cron is operating reliably.
- Remember that MCP tools currently support draft or publish, not future status.

### SEO Fields Do Not Appear

- Confirm the selected SEO plugin is installed and active.
- Run the SaaS SEO health route where applicable.
- Install the optional Yoast REST field snippet if required.
- Clear caches and inspect the saved post meta.
- Retest after SEO plugin upgrades.

### Stripe Payment Does Not Credit Tokens

- Verify the package Stripe price ID.
- Check Checkout success/cancel URLs and `NEXT_PUBLIC_APP_URL` or `APP_URL`.
- Confirm the webhook URL and signing secret.
- Inspect the purchase status before applying any manual adjustment.

### MCP Client Cannot Connect

- Ensure the server is enabled and the URL contains the current token.
- Approve the pending connection in WordPress.
- Confirm the connection has not been revoked.
- Verify the default author has an allowed administrator/editor role and `publish_posts`.
- Check the 60 requests/minute rate limit and MCP activity log.

## 14. Recommended Operating Procedure

1. Configure providers and a staging WordPress site.
2. Use a least-privilege WordPress publishing account.
3. Start every new workflow in draft mode.
4. Test categories, tags, media, SEO fields, and links.
5. Review factual claims and images before publication.
6. Validate scheduling in the site's timezone.
7. Monitor token transactions, purchases, provider usage, and plugin logs.
8. Back up the database and rotate credentials on a defined schedule.
9. Re-test integrations after WordPress, SEO plugin, provider model, or application upgrades.

## 15. Development Reference

Technology stack:

- Next.js 14.2 and React 18.3.
- TypeScript 5.7 and Tailwind CSS 3.4.
- Prisma 7.4 with the MariaDB adapter and MySQL datasource.
- NextAuth 4.24.
- OpenAI Node SDK 4.104.
- Stripe Node SDK 18.1.
- Zod 3.24 and Nodemailer 7.
- WordPress 6.4+ and PHP 7.4+ for the plugin.

Important implementation files:

- `lib/schemas.ts`: generation and publishing validation.
- `lib/tokens.ts`: token costs and transaction logic.
- `lib/openai.ts`: SaaS text and image generation.
- `lib/google-docs.ts`: Google Doc extraction.
- `lib/wp.ts` and `lib/wp-seo.ts`: WordPress and SEO integration.
- `prisma/schema.prisma`: SaaS database model.
- `wordpress-plugin/ai-article-publisher/ai-article-publisher.php`: plugin bootstrap and workflows.
- `wordpress-plugin/ai-article-publisher/includes/class-aia-providers.php`: plugin providers.
- `wordpress-plugin/ai-article-publisher/includes/class-mcp-server.php`: MCP protocol route.
- `wordpress-plugin/ai-article-publisher/includes/class-mcp-auth.php`: MCP authorization and limits.
- `wordpress-plugin/ai-article-publisher/includes/class-mcp-tools.php`: WordPress MCP operations.

## 16. Related Documentation

- `README.md`: repository quick start and feature summary.
- `docs/SAMPLE-GOOGLE-DOC-FORMAT.md`: reusable Google Doc template.
- `wordpress-plugin/ai-article-publisher/README.md`: plugin package notes.
- `wordpress-plugin/ai-article-publisher/docs/USER-GUIDE.md`: concise plugin operator guide.
- `docs/AI-Article-Publisher-Overview-And-User-Guide.docx`: Word version of this document.

## 17. Final Summary

AI Article Publisher provides two deployment paths for the same core outcome: faster, controlled production of WordPress content. The SaaS platform adds user management, multi-site publishing, metered usage, and commercial billing. The standalone plugin puts generation and publishing directly inside WordPress and adds Claude manual/API choices plus a secured MCP server. In both cases, the strongest operating model is to generate into drafts, review every article and image, validate SEO and links, and publish only through appropriately restricted WordPress accounts.
