import { env } from "cloudflare:workers";
import { handleApi } from "../../../server/api";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  if (!env.DB)
    return Response.json({ error: "Database is unavailable" }, { status: 503 });
  return handleApi(request, env.DB, env.DEMO_MODE === "true", env.BUCKET);
}
export { handle as GET, handle as POST, handle as PATCH };
