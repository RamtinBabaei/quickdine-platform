# QuickDine

**Exceptional tables. Unforgettable evenings.**

A full-stack restaurant reservation platform by **Ramtin Babaei**, built with React, TypeScript, Tailwind CSS and a Cloudflare Workers backend. Discover curated dining rooms, check available seats, request a table, and manage the complete hospitality workflow.

[Live demo](https://quickdine-ramtin.shaficp.chatgpt.site) · [Architecture](docs/ARCHITECTURE.md) · [Testing report](docs/TESTING_REPORT.md) · [Deployment](docs/DEPLOYMENT.md) · [راهنمای فارسی اجرای پروژه](docs/LOCAL_SETUP_FA.md)

## What works

- Restaurant discovery with combined name, cuisine, location, price and rating filters; sorting; shareable discovery links.
- Detailed venue pages, optimized local photography, live capacity by service time, party size and date.
- Account registration and sign-in, salted password hashes, revocable HttpOnly cookie sessions, and server-side authorization.
- Reservation requests with occasion and special instructions; personal booking history, status filters, and cancellation.
- Owner workspace for venue submissions, cover uploads, service times, tags, capacity and profile editing; incoming booking confirmation and cancellation.
- Administrator workspace for approval/rejection, restaurant and booking overview, and account metrics.
- Private, persistent demo workspaces for diner, owner and administrator exploration. Demo administrators never gain access to registered users or other demo tenants.
- Newsletter preference persistence with duplicate handling. No email delivery is claimed.
- Mobile navigation, responsive desktop/tablet/mobile layouts, accessible form labels, keyboard-focusable controls, native focus-trapped dialogs, reduced-motion support, and error/empty/loading/success states.

This is a **portfolio demo with illustrative restaurants**. It does not contact real restaurants, reserve real tables, collect payments, or send transactional emails.

## Stack

| Layer | Choice |
| --- | --- |
| UI | React 19, TypeScript, Tailwind CSS 4, Lucide icons |
| Routing / rendering | Next.js App Router conventions on Cloudflare Vinext / Vite |
| API | TypeScript REST handlers, Web Request/Response, Zod validation |
| Database | Cloudflare D1 / SQLite, Drizzle schemas and committed SQL migrations |
| Images | Local responsive WebP assets; bounded JPEG/PNG/WebP uploads in R2 |
| Tests | Vitest, React Testing Library, Miniflare with real local D1 and R2 |
| Delivery | pnpm lockfile, ESLint, Prettier, GitHub Actions, Cloudflare Workers |

SQLite/D1 fits this relational reservation workload and the deployed edge runtime without an external database subscription. A SQL trigger makes capacity enforcement atomic; an API pre-check alone would allow overbooking under concurrency. See the architecture document for tradeoffs and the seat-inventory model.

## Run locally in VS Code

Install **Node.js 22 LTS (22.13 or newer)**, Git and VS Code. The tested package manager is **pnpm 11.25.0**.

```sh
git clone https://github.com/RamtinBabaei/quickdine-platform.git
cd quickdine-platform
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
```

Open this folder in VS Code. Create `.dev.vars` from `.dev.vars.example` (enable the isolated demos locally):

```powershell
# Windows PowerShell
Copy-Item .dev.vars.example .dev.vars
```

```sh
# macOS / Linux
cp .dev.vars.example .dev.vars
```

Then initialize the local database and start the app:

```sh
pnpm build
pnpm db:local
pnpm dev
```

Open **http://localhost:5173**. No Cloudflare login, external database, or paid API is needed locally. D1 and R2 run locally through Miniflare. `pnpm db:local` keeps an applied-migration ledger and can be rerun safely. Local state lives in ignored `.wrangler/state/`.

Verify **http://localhost:5173/api/health** returns `status: "ok"`, `database: true`. On the home page, choose an owner demo, locate **Your Rooftop Atelier**, request a table, then confirm it from **Management → Reservations**. Your reservation and special instructions should appear in **My bookings**. Cancel it and check the updated status.

The managed development environment used to build this delivery has its own internal preview port. Your standalone checkout defaults to **5173**. If occupied, run `pnpm dev -- --port 5174` and use the URL printed in the terminal.

## Commands

```sh
pnpm typecheck       # strict TypeScript
pnpm lint            # authored application, API, database and tests
pnpm format:check    # code formatting
pnpm test            # domain, React component and D1/R2 integration tests
pnpm build           # production client + Worker build
pnpm start           # local production Worker preview (default port 8787)
pnpm db:generate     # schema migrations after intentional schema changes
pnpm db:local        # apply pending migrations locally after a build
```

`pnpm start` uses the built Worker and local data. It is separate from the HMR development server. Production deployment instructions, required resource bindings, administrator provisioning, demo configuration and rollback notes are in [DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Project layout

```text
app/                 Routes, API adapter, metadata and responsive design system
components/          Diner application and lazy-loaded management workspace
domain/              Typed models, catalog, discovery logic and Zod schemas
server/              Authentication, authorization, reservation and venue APIs
db/                  Drizzle relational schema
drizzle/             Immutable SQL migrations and capacity trigger
public/images/       Compressed local photographs and responsive variants
tests/               Domain, React component and real D1/R2 integration tests
scripts/             Portable local database and Cloudflare deployment helpers
docs/                Architecture, setup, deployment and executed QA report
.github/workflows/   Continuous integration checks
```

## Security and readiness

Passwords are hashed with salted PBKDF2-SHA-256. Stored session tokens are SHA-256 digests; cookies are HttpOnly, SameSite=Lax and Secure over HTTPS. Mutation requests require a matching Origin. Queries are parameterized, bodies and uploads are bounded, authentication and write actions are rate-limited, and roles and workspace scope are enforced on the server.

The final audit has **zero production dependency advisories**. One unpatched high-severity advisory remains in the development-only `braces` glob parser through the build/lint toolchain; untrusted patterns are not accepted by this application. The detailed report records its scope and remaining verification limits. This delivery is suitable for a portfolio demonstration, and does **not** claim audited readiness for a real restaurant business.

## Credits and license

Application implementation © 2026 Ramtin Babaei, MIT licensed. The visual direction, supplied photographs and adapted restaurant descriptions originate from the MIT-licensed [GreatStack QuickDine reference](https://github.com/GreatStackDev/QuickDine), linked from the [project brief](https://greatstack.dev/p/multi-restaurant). Original notices are retained in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
