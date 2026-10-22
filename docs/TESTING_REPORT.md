# Testing and debugging report

Verification date: **22 October 2026**. This report distinguishes executed checks from remaining verification limits.

## Final automated results

| Check | Executed result |
| --- | --- |
| Strict TypeScript (`pnpm typecheck`) | Passed |
| ESLint (`pnpm lint`) | Passed, no application errors or warnings |
| Prettier (`pnpm format:check`) | Passed |
| Vitest | **32 tests passed across 3 files** |
| Production build | Passed; client, SSR, RSC and API Worker output generated |
| Local migrations on an empty local D1 database | Passed |
| Re-running the local migration helper | Passed; no migrations replayed |
| Full dependency audit after remediation | 0 critical, 1 high, 0 moderate, 0 low |
| Production dependency audit | **0 advisories** |

Tests use real local D1 and R2 via Miniflare, not a fake in-memory repository implementation. R2's remote test wrapper adapts its returned response stream into the host runtime without bypassing storage operations. The emulator uses the starter's supported compatibility date, 2026-05-15; an initial attempted date newer than the pinned local Workerd binary was corrected after the emulator rejected it.

## Pass 1 — architecture and code quality

Reviewed the application boundaries, schema, business rules and all authored source. Replaced the reference's mocked authentication and reservations with durable API behavior. Kept role and tenant checks on the server. Removed unused starter component dependencies and UI files. Extracted pure discovery filtering from Zod validation to avoid shipping server schema initialization to the browser. Kept management as a lazy-loaded feature.

Fixed initial TypeScript issues around unknown JSON response bodies and the Miniflare R2 transport interface. Native image elements are intentional: their local files are precompressed, responsive variants are supplied, and dimensions/loading priorities are explicit. ESLint's framework image-component suggestion is disabled only for the two authored image-heavy components. Modal forms use native dialogs for focus containment and Escape handling. Wrangler generated the resource binding types from the built deployment configuration.

## Pass 2 — functionality and integration

### Domain tests (10)

- Calendar validity, past dates and maximum booking horizon.
- Invalid guest counts and oversized special requests.
- Rejection of administrator-role registration.
- Email normalization.
- Case-insensitive venue/cuisine search, combined filters, rooftop tags, empty results.
- Independent password salts and correct/incorrect password verification.

### API integration tests (17)

- Persistent hashed accounts and Secure/HttpOnly sessions.
- Duplicate registration, incorrect passwords, login and logout revocation.
- Cross-origin write rejection and unauthenticated access.
- Role injection and management permission checks.
- Authentication rate limits and environment-controlled demo access.
- Isolation between demo administrator workspaces.
- Request/retrieve/cancel reservation flow, exact preservation of special requests, and released capacity.
- Competing reservations for insufficient remaining capacity: exactly one succeeds and one returns 409.
- Invalid service times and historical dates.
- Denial of cross-account reservation changes and cancelled-reservation reactivation.
- Owner submission → administrator approval → discovery → booking → owner confirmation → profile edit → re-review.
- Idempotent newsletter preference persistence.
- Authenticated cover upload and exact byte retrieval with immutable caching.
- Denial of non-owner uploads, invalid file signatures and oversized uploads.

### React component tests (5)

- Complete reservation content and special requests.
- Diner cancellation without management actions.
- Manager confirmation callback.
- No mutation controls on a cancelled reservation.
- Meaningful empty-state content.

### Browser checks performed in Chromium

- Home page visuals, local imagery, navigation and responsive search form.
- Owner demo session and management access.
- Restaurant discovery and detail navigation with date/party parameters.
- Time selection and reservation submission with a special request.
- Displayed reservation success reference and status.
- Owner confirmation followed by cancellation in the management portal.
- Administrator demo approval, including the resulting approved venue state.
- Mobile navigation and search at a 390-pixel embedded viewport.
- Mobile and tablet homepage visual inspection at 390 and 768 pixels; desktop inspection at approximately 1350 pixels.
- Mobile main content width equaled its scroll width (375 pixels inside the viewport after the scrollbar), with no horizontal overflow in the inspected view.

Browser checks used the application UI. Password-based sign-in behavior was tested through the API integration suite; no real account credentials were entered during browser QA. Upload persistence was tested against local R2 through the API suite. Browser UI checks are recorded here; they are not represented as an independently replayable Playwright CLI suite.

## Pass 3 — performance, security and deployment readiness

Added responsive WebP variants, prioritized the hero, lazy-loaded secondary images and the management UI, used local/system fonts, and kept stable image dimensions. R2 images are immutable-cacheable while authenticated APIs use no-store. Requests, uploads and API collections have explicit size/count limits. SQL inventory checks happen inside the insert trigger; compare-and-update status changes detect races. Roles, record ownership, workspace isolation, bound SQL parameters, CSRF Origin checks and cryptographically random sessions were reviewed.

The initial starter dependency audit reported numerous issues. Applied available patched Next.js/React/RSC/Vite/Vitest versions, transitive overrides, and removed unused dependencies; reran the build and automated checks after remediation. Production dependency audit is clear.

The remaining **high** advisory is an **unpatched stack-exhaustion denial of service in `braces`**, reached through development dependencies (`micromatch` / `fast-glob` in the build and lint toolchain). It is not in the deployed application dependency graph or an application API input path. Build/lint patterns are repository-controlled. Monitor upstream; do not accept untrusted build patterns. This finding is retained rather than silently suppressed.

### Measured build assets

These are file and gzip sizes from the executed production build, not Lighthouse scores or real-user network measurements.

| Chunk | Uncompressed | Gzip |
| --- | --- | --- |
| quickdine | 51,755 bytes | 16,416 bytes |
| management | 8,998 bytes | 3,351 bytes |
| framework | 190,038 bytes | 58,895 bytes |

Local WebP photography, including all responsive variants: **1,155,456 bytes**.

## Remaining limitations

- No Lighthouse, real-user Core Web Vitals, sustained load test or independent security assessment was performed.
- Chromium was inspected; Firefox, Safari, real iOS/Android devices and assistive-technology testing remain unverified.
- Vinext is a beta framework dependency. The build emits non-fatal forward-compatibility and route-classification notices; the listed routes and API were generated and exercised.
- The inventory model counts seats independently per service time. It does not allocate physical tables or block overlapping dining durations.
- Restaurant listings and catalog ratings are illustrative; no verified-review or real restaurant relationship is claimed.
- Payments, paid memberships, transactional email, email verification, password recovery and user review submission are not implemented integrations. Newsletter signup saves a preference only.
- Demo workspaces persist and do not yet have an automated retention cleanup job. Uploaded covers have no orphan cleanup lifecycle in this portfolio version.
- Collection limits are intentional for a small portfolio dataset; production pagination/search and operational monitoring require further work.

**Readiness conclusion:** tested, deployable full-stack portfolio demonstration. This report does not certify readiness to operate a live restaurant booking business. Production prerequisites are listed in `DEPLOYMENT.md`.
