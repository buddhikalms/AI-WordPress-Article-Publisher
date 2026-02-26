# AI WordPress Article Publisher

Next.js App Router project that:
- Generates WordPress-ready article HTML with OpenAI chat.
- Enforces required hyperlinks.
- Generates a featured image with OpenAI image generation.
- Publishes to WordPress via REST API (draft/publish).
- Applies SEO metadata best-effort for AIOSEO or Yoast.

## 1) Environment setup

Copy `.env.example` to `.env.local` and set:

```bash
OPENAI_API_KEY=
OPENAI_TEXT_MODEL=gpt-4.1-mini
WORDPRESS_BASE_URL=https://your-site.com
WORDPRESS_USERNAME=your-wp-username
WORDPRESS_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

Notes:
- Use a WordPress Application Password for `WORDPRESS_APP_PASSWORD`.
- Do not expose these values in the browser; they are server-only in route handlers.

## 2) Install and run

```bash
npm install
npm run dev
```

Open: `http://localhost:3000`

## 3) Main flow

1. Fill article inputs and links.
2. Click **Generate Draft** to create HTML + SEO payload.
3. Optionally click **Generate Image**.
4. Click **Publish as Draft**.

The app will:
1. Optionally upload featured image (`/wp-json/wp/v2/media`)
2. Create post (`/wp-json/wp/v2/posts`)
3. Apply SEO metadata by provider (best-effort)

## 4) Diagnostics endpoints

- `GET /api/wp-health`
  - Verifies WordPress auth via `/wp-json/wp/v2/users/me`

- `GET /api/seo-health?provider=AIOSEO`
  - Checks whether AIOSEO-related fields appear in a post REST response.

- `GET /api/seo-health?provider=Yoast`
  - Returns guidance that Yoast meta keys may need REST registration.

## 5) AIOSEO vs Yoast testing

### AIOSEO
1. In UI set provider to `AIOSEO`.
2. Publish a draft.
3. If SEO update fails with 400/403:
   - Ensure AIOSEO REST API addon is installed/enabled.
   - Ensure WP user has permissions to edit SEO metadata.

### Yoast
1. In UI set provider to `Yoast`.
2. Publish a draft.
3. If meta update fails:
   - Install this MU-plugin file:
     - `wp-snippets/yoast-rest-meta.php`
     - destination: `wp-content/mu-plugins/yoast-rest-meta.php`
   - Retry publish/update.

## 6) File highlights

- `app/page.tsx` - single-page UI
- `app/api/generate-article/route.ts` - article generation + required link enforcement
- `app/api/generate-image/route.ts` - image generation
- `app/api/publish/route.ts` - WP media + post + provider SEO update
- `lib/wp.ts` - WordPress REST helpers
- `lib/seo.ts` - AIOSEO/Yoast payload mapping
- `wp-snippets/yoast-rest-meta.php` - Yoast REST meta registration helper

