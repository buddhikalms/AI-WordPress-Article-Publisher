# AI Article Publisher (SaaS Edition)

Next.js + Prisma + MySQL platform for AI-assisted WordPress publishing with:

- User registration + credentials login
- Google OAuth login (NextAuth)
- Email verification (SMTP / Gmail app password)
- Multi-site WordPress management per user with a default publishing site
- Token-based usage billing
- Stripe package checkout + webhook token credit
- Admin panel for users, packages, and token adjustments
- Device lock (one account per device, one device per account)
- Manual post status control (draft, publish now, schedule)
- Import posts from a Google Doc link only, uploading a provided/embedded featured image and generating character-limited AI SEO fields when needed
- Category news auto-publish pipeline from NewsData API with OpenAI rewrite + fresh image generation

## Tech stack

- Next.js 14 (App Router)
- Prisma ORM + MySQL
- NextAuth (credentials + Google)
- Stripe
- OpenAI

## Environment

Copy `.env.example` to `.env` and set values.

Required variables:

- `DATABASE_URL`
- `APP_ENCRYPTION_KEY`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `OPENAI_API_KEY`
- `NEWSDATA_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Optional:

- `ADMIN_EMAILS` (comma-separated emails promoted to admin at sign-in)
- `NEWSDATA_BASE_URL` (defaults to `https://newsdata.io/api/1/news`)

## Install and run

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Open `http://localhost:3000`.

## Auth flows

- `GET/POST /api/auth/[...nextauth]` NextAuth (credentials + Google)
- `POST /api/auth/register` register user + optional first WordPress site + device bind + email code
- `POST /api/auth/verify-email` verify 6-digit code
- `POST /api/auth/resend-code` resend verification code

Credentials login is blocked until email verification is completed.

## Billing flows

- `GET /api/packages` list active plans
- `POST /api/stripe/checkout` create checkout session
- `POST /api/stripe/webhook` credit tokens after successful payment

## Token costs

Configured in `lib/tokens.ts`:

- Article generation: `5`
- Image generation: `2`
- Publish to WordPress: `1`

## User pages

- `/login` sign-in, registration, email verification
- `/` article workspace (manual publish/schedule + Google Doc import + category news auto-publish)
- `/account` manage multiple WordPress sites and the default publishing target
- `/billing` packages and purchase history

## Admin page

- `/admin`

Admin APIs:

- `GET/POST/PUT /api/admin/packages`
- `GET /api/admin/users`
- `POST /api/admin/tokens`

## Prisma models

See `prisma/schema.prisma` for:

- `User`, `Account`, `Session`, `VerificationToken`
- `WordPressCredential` (multi-site per user)
- `DeviceRegistration`
- `Package`, `PackagePurchase`
- `TokenTransaction`, `GenerationUsage`
- `EmailVerificationCode`

## Important notes

- Prisma 7 is configured via `prisma.config.ts` (datasource URL is not in `schema.prisma`).
- Prisma Client uses `@prisma/adapter-mariadb` in `lib/prisma.ts`.
- Stripe webhook must be configured to call `/api/stripe/webhook`.
- WordPress credentials are encrypted before storing in DB.
- The project currently expects dependencies to be installable from npm registry.
- Google Docs import reads from a shareable document link. If a doc is private, switch it to "Anyone with the link can view" or use "Publish to web".
- For Google Doc imports, use `docs/SAMPLE-GOOGLE-DOC-FORMAT.md` as the source format. If `featured_image_url` is blank, the first embedded doc image is uploaded as the WordPress featured image.
