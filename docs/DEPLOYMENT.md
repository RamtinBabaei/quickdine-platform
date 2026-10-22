# Deployment

## Delivered online demo

The live demo runs on Cloudflare Workers with managed D1 and R2 bindings through Sites:

https://quickdine-ramtin.shaficp.chatgpt.site

The demo is public, with isolated optional role demos and a separate shared workspace for registered accounts. Source is published at https://github.com/RamtinBabaei/quickdine-platform. No credentials, account passwords, session data or uploaded user files are included in the source archive.

`.openai/hosting.json` retains the identity of this delivered Site and its logical `DB` and `BUCKET` bindings. The hosting service supplies the actual resource identities and runs committed migrations before deploying the Worker. Preserve that identity when updating this Site; create a new Site identity when intentionally making an independent copy.

## Independent deployment to your own Cloudflare account

The source also supports a standalone Workers deployment. Enable Workers, D1 and **R2** in the target account first. At delivery, the connected personal account's R2 API reported that R2 was not enabled; the delivered managed demo uses its provisioned R2 binding and does not depend on that account activation.

1. Install dependencies and run all checks from the README.
2. Authenticate Wrangler and create dedicated resources:

```sh
pnpm exec wrangler login
pnpm exec wrangler d1 create quickdine
pnpm exec wrangler r2 bucket create quickdine-media
```

3. Record the database UUID returned by D1. Build and generate a deployment configuration using that real UUID:

```sh
pnpm build
node scripts/configure-cloudflare.mjs --database-id YOUR_D1_UUID --bucket quickdine-media --name quickdine-platform --demo
```

The helper writes ignored `dist/server/wrangler.deploy.json`. It preserves the compiled Worker entrypoint, modules and client assets, installs the real D1/R2 bindings, enables observability and points Wrangler to the committed migrations. The original build configuration is left intact. Omit `--demo` for a non-demo environment; demo account creation then returns 404.

4. Apply migrations and deploy:

```sh
pnpm exec wrangler d1 migrations apply DB --remote --config dist/server/wrangler.deploy.json
pnpm exec wrangler deploy --config dist/server/wrangler.deploy.json
```

Wrangler uploads the compiled Worker modules and static assets and prints the deployed URL. Use that exact URL. Verify `/api/health`, restaurant discovery, registration/login, venue cover upload, reservation persistence after a refresh, owner confirmation, and administrator approval.

5. Provision a real administrator explicitly. Create a regular registered account first, then use the operator's authenticated Cloudflare access:

```sh
pnpm exec wrangler d1 execute DB --remote --config dist/server/wrangler.deploy.json --command "UPDATE users SET role='admin' WHERE email='YOUR_ADMIN_EMAIL' AND demo=0"
```

Never expose an administrator-promotion endpoint or publish shared administrator credentials. The role is read from the database on every authenticated request.

## Continuous integration

`.github/workflows/ci.yml` runs locked installation, TypeScript, lint, formatting, all automated tests, a production build and a production dependency audit on pushes and pull requests. It has read-only repository permissions.

The workflow performs verification. The delivered Site uses its own native publishing workflow. For independent automatic deployment, configure Cloudflare Workers Builds against this GitHub repository, or run the deployment commands above in a protected GitHub environment with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` supplied as encrypted secrets. No deploy token is committed.

## Migrations, backup and rollback

Commit schema changes and newly generated SQL together. Do not edit already applied migrations. The custom capacity trigger is schema-owned and must remain installed. Migration and runtime code should be deployed together; an applied migration may survive a failed code deployment.

Before a destructive schema change, export a D1 backup or use the account's configured recovery capabilities. A Worker rollback restores code, not database state or uploaded R2 objects. For managed hosting, select and deploy the previous saved Site version. For an independent Worker deployment, use Wrangler's version and rollback commands after inspecting the target version.

## Before accepting real bookings

This delivery is a verified portfolio demonstration, not an operated restaurant service. A real launch requires restaurant agreements and real venue content, a privacy/data-retention and deletion policy, verified email and password recovery, transactional notification delivery, monitoring and alerting, backups and a recovery drill, abuse controls such as Turnstile where appropriate, and physical table/occupancy rules if seats-per-service is insufficient. Add payment handling only if the actual product requires deposits or fees.

Load testing, independently measured Lighthouse/Core Web Vitals, Safari/Firefox testing and a third-party security review have not been performed. The unpatched development-only `braces` advisory is recorded in the testing report; keep untrusted patterns out of build/lint configuration and monitor upstream fixes.
