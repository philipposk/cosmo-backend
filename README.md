# Cosmo backend

NestJS 11 API for [Cosmo](../README.md). Provides REST endpoints for auth, social graph, feed, stories, libraries, forums, goals, notifications, search, media, membership, moderation, and connected-apps. BullMQ workers run AI generation jobs.

## Local development

```bash
PATH="/opt/homebrew/opt/node@20/bin:$PATH"
npm install
npm run start:dev      # http://localhost:4000
```

Postgres + Redis + MinIO must be up — `docker compose up -d` from the repo root.

## Environment

`/.env` — minimum:

```
DATABASE_URL=postgresql://cosmo:cosmo@localhost:5433/cosmo?schema=public
REDIS_HOST=127.0.0.1
REDIS_PORT=6380
JWT_SECRET=at-least-16-chars
PORT=4000
FRONTEND_ORIGIN=http://localhost:5176
```

Optional:

```
AI_OS_BASE_URL=http://localhost:8765        # delegate AI to AI OS rotator
AI_OS_API_KEY=...
AI_OS_TIMEOUT_MS=120000
GROQ_API_KEY=...                            # direct Groq fallback
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CHECKOUT_SUCCESS_URL=http://localhost:5176/membership?status=success
STRIPE_CHECKOUT_CANCEL_URL=http://localhost:5176/membership?status=cancel
STRIPE_PORTAL_RETURN_URL=http://localhost:5176/membership
MINIO_ENDPOINT=localhost
MINIO_PORT=9100
MINIO_ACCESS_KEY=cosmo
MINIO_SECRET_KEY=cosmo-secret
MINIO_BUCKET=cosmo-media
MINIO_PUBLIC_URL=http://localhost:9100
SENTRY_DSN=...
SENTRY_ENVIRONMENT=development
SENTRY_TRACES_SAMPLE_RATE=0.1
MAIL_TRANSPORT=console
```

## Module map

```
src/
  auth/                register, login, email verify, password reset
  users/               profile read/update, privacy patch
  social/              follow + friend graph
  feed/                posts, reactions, comments, trending tags
  stories/             long-form drafts + AI Studio
  libraries/           personal collections CRUD
  forums/              rooms + threads + replies (auto-seeded)
  goals/               goals + progress events
  notifications/       REST list + mark-read
  search/              cross-entity Postgres ILIKE
  media/               MinIO presigned PUT + mark-ready
  membership/          tiers + Stripe checkout + billing portal
  ai-jobs/             BullMQ queue + processor
  ai-providers/        registry + AIOSProvider + GroqProvider
  stripe/              webhook handler
  moderation/          flagged stories admin API
  connected-apps/      AI OS / LifeHub / AppMaker / AppBlueprints seam
  common/              auth guard, mailer, sentry init, date util
  prisma/              PrismaService + generated client
```

## Auth

- `POST /auth/register`, `/auth/login` → returns `{ ...user, token }`.
- `POST /auth/request-verify`, `/auth/confirm-email`, `/auth/request-reset`, `/auth/reset-password`.
- All protected routes use `AuthenticatedGuard`, expects `Authorization: Bearer <jwt>`.

## AI generation

Story jobs queue on BullMQ (`ai-jobs` queue, Redis). Worker resolves the `ModelProvider` row to an identifier:

- `aios:<model>` — routes to AI OS HTTP shim (multi-provider rotator with cost tracking + circuit breakers).
- `groq:<model>` — direct Groq SDK call.

Quota enforced via `DailyUserUsage` + `MembershipTier`. On completion the worker writes a `Story`, creates an `AI_JOB_COMPLETE` notification, and increments the daily usage counter.

## Scripts

- `npm run start:dev` — watch mode.
- `npm run build` — Nest compile to `dist/`.
- `npm run test` — Jest.
- `npm run prisma:generate` — regenerate Prisma client (after schema edits).
