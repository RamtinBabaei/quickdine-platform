# Architecture and engineering decisions

## Runtime boundaries

The React application uses App Router route conventions and runs on Vinext, Cloudflare's Vite-based implementation of the Next.js interface. Server code executes inside a Cloudflare Worker. The deployment keeps a single origin for static assets and `/api/*`, avoiding cross-origin cookies and a second separately operated API server.

The UI does not trust a client-selected role, price, capacity or reservation status. Zod validates every input. The API loads the session and account, resolves the tenant, checks the role and record ownership, and executes parameterized SQL. The API adapter only connects the runtime's D1/R2 bindings to this independently testable business logic.

| Module | Responsibility |
| --- | --- |
| `domain/types.ts` | Explicit account, restaurant, booking and dashboard contracts |
| `domain/validation.ts` | Boundary validation and normalized server input |
| `domain/discovery.ts` | Pure combined discovery filters without shipping Zod to the browser |
| `domain/catalog.ts` | Versioned illustrative editorial collection |
| `server/crypto.ts` | PBKDF2 password hashing, comparison and session-token digests |
| `server/api.ts` | Authentication, permissions, inventory and reservation lifecycle, venue moderation and uploads |
| `db/schema.ts` | Typed relational structure and indexes |
| `components/quickdine.tsx` | Diner-facing journeys, shared components, forms and request states |
| `components/management.tsx` | Lazy-loaded owner and administrator workspace |

Management is loaded on demand. A separate client state framework is intentionally omitted: the application has a small number of server-owned collections and local form states, so React state and explicit API refreshes avoid extra runtime dependencies. A larger product could adopt TanStack Query for background invalidation and pagination.

## Persistence

D1 stores accounts, hashed sessions, submitted venues, reservations, newsletter preferences and rate-limit windows. R2 stores validated cover image bytes. The six illustrative editorial restaurants are immutable application content; submitted restaurants are persisted in D1. This makes initial discovery content versioned and reviewable while keeping operational data durable.

Bookings capture the venue name and cover as a snapshot so old reservations remain understandable after a venue profile edit. Queries use indexes on session tokens, account email, booking owner, restaurant tenant and inventory keys.

## Capacity and status transitions

A service time is an independent inventory bucket keyed by `(tenant, restaurant, date, time)`. Both pending and confirmed reservations consume seats; cancellation releases them. The SQL `booking_capacity_guard` trigger checks the sum inside the same database operation as the insert. Two competing requests cannot both reserve the same final seats. This behavior is exercised against real local D1 in the integration suite.

Status transitions are intentionally narrow:

- A reservation begins as `pending`.
- The venue owner or an administrator can confirm it.
- Its diner, venue owner, or administrator can cancel it.
- A cancelled reservation cannot be reactivated.
- Updates compare the prior status in SQL and return a conflict when another request changed it first.

This is a **seat-capacity model**, not a physical floor-plan optimizer. It does not combine two-person tables, model overlapping service durations, or allocate specific table numbers. These would require explicit table inventory and occupancy intervals.

Submitted venues begin pending approval. Owners can edit only their own venue. Edits return the venue to review. Administrators can approve or reject submitted venues; registered users cannot self-assign administrator privileges.

## Identity and demo boundaries

Registered diners and owners belong to the shared `public` application tenant. A database operator can explicitly promote an existing registered account to administrator. No public endpoint grants shared-tenant administrator access.

When `DEMO_MODE=true`, each demo request creates a new account and a cryptographically random isolated tenant. All operational queries are tenant scoped. A demo administrator can review their seeded sample venue, but cannot see another demo workspace or registered-user records. Demo access is entirely disabled when the environment variable is absent or false. Sessions last seven days. Demo workspaces persist with the session; choosing another demo creates a new workspace.

Passwords use unique salts and PBKDF2-SHA-256 with 100,000 iterations, respecting the supported Worker Web Crypto iteration limit. Sessions store only SHA-256 digests of random tokens. Cookies are HttpOnly, SameSite=Lax, and Secure over HTTPS. A seven-day expiry is enforced on the server. Logout deletes the stored session.

## Performance

The hero image is eagerly prioritized and has responsive 768/1200/1800-pixel WebP variants. Restaurant photography uses 450/900-pixel variants and lazy loading. Images reserve layout dimensions. The entire local photography collection, including responsive variants, is approximately 1.2 MiB. Fonts use the system sans-serif stack and Georgia, avoiding font-network requests. The management UI is a separate lazy-loaded chunk. Discovery filtering does not pull server validation schemas into the client.

R2 images have immutable public cache headers. Authenticated APIs explicitly use `no-store`; personalized responses are never cached across users. API row counts are bounded to 100 or 200 depending on the collection. This version favors a small portfolio dataset; production-scale browsing would need cursor pagination and server-side text search.

## Reference scope

The supplied reference establishes the fine-dining visual direction, editorial imagery, restaurant discovery, availability checking, diner booking management, owner onboarding/profile management and administrator moderation. This implementation replaces the reference frontend's mock authentication and booking data with working APIs and durable storage. It preserves the MIT notices for reused reference assets.

A membership marketing section is expressed as editorial discovery rather than a paid subscription. The brief does not define a payment workflow, so this application does not invent one. Newsletter signup stores a preference and does not pretend to send an email. Restaurant ratings are illustrative catalog metadata; this version does not accept user reviews or claim verified diner reviews.
