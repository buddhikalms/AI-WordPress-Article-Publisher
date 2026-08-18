# ChatGPT MCP Integration

This document covers the SaaS-hosted MCP (Model Context Protocol) server that lets
ChatGPT act on a user's AI Article Publisher account: their connected WordPress
sites, article generation, and news autopilot — through the same service logic the
`/app/dashboard` UI uses, gated by the same token billing.

This is separate from, and does not replace, the standalone WordPress plugin's own
MCP server (`/wp-json/aia-mcp/v1/mcp`). That one is single-tenant and lives entirely
inside one WordPress install; this one is multi-tenant and lives in the SaaS app,
resolving every call to one authenticated SaaS user.

## Endpoints

| Purpose | URL |
| --- | --- |
| MCP server (Streamable HTTP) | `POST/GET/DELETE {APP_URL}/api/mcp` |
| OAuth authorization | `GET {APP_URL}/oauth/authorize` |
| OAuth token exchange | `POST {APP_URL}/api/oauth/token` |
| Dynamic client registration | `POST {APP_URL}/api/oauth/register` |
| Token revocation | `POST {APP_URL}/api/oauth/revoke` |
| Authorization server metadata | `GET {APP_URL}/.well-known/oauth-authorization-server` |
| Protected resource metadata | `GET {APP_URL}/.well-known/oauth-protected-resource` |

`APP_URL` is whatever `APP_URL` / `NEXTAUTH_URL` is set to in `.env` (e.g.
`https://your-domain.com` in production, `http://localhost:3000` locally).

## Authentication

OAuth 2.1 with Dynamic Client Registration (RFC 7591) and mandatory PKCE (S256) —
this is the flow ChatGPT's "Connectors" UI expects for an MCP server that needs to
identify an individual user, not a shared API key.

1. ChatGPT registers itself via `POST /api/oauth/register` and gets back a
   `client_id` (no client secret — every client here is a public client, PKCE-only).
2. ChatGPT sends the user's browser to `GET /oauth/authorize?...&code_challenge=...&code_challenge_method=S256`.
3. If the user isn't signed in, they're bounced to the normal `/login` page (email/password
   or Google) and returned to the same authorize URL afterward.
4. The user must have a **verified email** — same requirement as every other
   authenticated action in the app. Unverified accounts are redirected back to
   ChatGPT with `error=access_denied`.
5. The user sees a consent screen naming the connecting app and what it can do, and
   approves or denies.
6. On approval, ChatGPT is redirected back with a short-lived, single-use
   authorization code, which it exchanges at `/api/oauth/token` (with the PKCE
   `code_verifier`) for an access token (1 hour) and refresh token (90 days, rotated
   on each use).
7. Every `/api/mcp` call carries `Authorization: Bearer <access_token>`. The server
   hashes the token, looks up the stored hash (raw tokens are never stored — same
   pattern as the app's existing verification-code hashing), and resolves it to one
   `userId`. That `userId` is the only thing every tool handler ever sees; there is
   no way to pass a different user's id from the client side.

Site ownership is enforced the same way it already is everywhere else in the app:
every tool that takes a `site_id` calls the existing `getUserWordPressConfig(userId,
site_id)` helper, which only ever returns a site if it belongs to that `userId`. A
foreign or made-up `site_id` fails with a plain "no site configured" error — it
never leaks another user's data.

### Connecting from ChatGPT

In ChatGPT's connector/MCP settings, add a custom connector pointing at
`{APP_URL}/api/mcp`. ChatGPT will discover the OAuth endpoints via the
`.well-known` metadata above, register itself, and walk the user through the
sign-in + consent screen described above the first time they use it.

### Local development

Point the connector at `http://localhost:3000/api/mcp` while running `npm run dev`.
The token endpoint accepts `http://localhost` as a valid redirect URI specifically
for this case (production registrations must use `https://`).

## Available tools

| Tool | What it does | Publishes? |
| --- | --- | --- |
| `list_wordpress_sites` | Lists the user's connected sites with a live connection check. Never returns credentials. | No |
| `get_wordpress_categories` | Categories for one site. | No |
| `get_wordpress_tags` | Tags for one site. | No |
| `search_articles` | Search posts on one site by keyword/status. | No |
| `get_article` | Full detail (incl. content) for one post. | No |
| `search_news` | NewsData search by category/query/language. API key never exposed. | No |
| `generate_news_article` | Rewrites one news item into an original draft (spends tokens). Returns the draft only. | **Never** |
| `create_article_draft` | Creates a new WordPress post — always as a draft. | **Never** |
| `update_article` | Edits title/content/excerpt/categories/tags/SEO on an existing post. Cannot set status to `publish`. | **Never** |
| `publish_article` | Sets an existing post's status to `publish`. | **Yes — the only tool that does** |
| `news_autopilot` | Full pipeline: fetch news → rewrite → optional images → create WordPress post(s). `status` defaults to `draft`; `publish` must be requested explicitly. | Only if `status=publish` is explicitly passed |

Publishing is always an explicit, separate action — asking ChatGPT to "write" or
"rewrite" an article never makes it live on its own; the model has to be asked (and
call `publish_article`, or pass `status: "publish"` to `news_autopilot`) to publish.

## Token billing

MCP calls spend the same token balance and cost table as the dashboard
(`lib/tokens.ts`: 5 tokens/article generation, 2/image, 1/publish). Tool inputs that
generate or publish accept an optional `request_id`; passing the same value on a
retried call reuses the existing `GenerationUsage` idempotency check
(`lib/tokens.ts:consumeTokens`) so a duplicated network request doesn't double-charge.
This does not protect against the model genuinely deciding to call a tool twice —
only against the same call being sent twice.

## Logging

Every tool call writes one `McpActivityLog` row (user, tool, action, site, WordPress
post id, tokens spent, success/failure, and — on failure — a short status+message
summary only, never a raw error body or any credential). Admins can review recent
calls on `/admin` under "MCP Activity", or query `GET /api/admin/mcp-logs`.

## Known limitations

- **Rate limiting is in-memory per Node process** (60 req/min/user, matching the
  WordPress plugin's MCP limit). It resets on restart and is not shared across
  instances if this app is ever run horizontally scaled — a correct distributed
  limit would need a shared store (e.g. Redis), which this repo doesn't have today.
- Idempotency is request-id based (see above), not a guarantee against the model
  issuing a genuinely new duplicate call.
- `update_article` intentionally cannot change status to `publish` — only
  `publish_article` can. This is enforced by the tool's input schema, not just a
  prompt instruction.
