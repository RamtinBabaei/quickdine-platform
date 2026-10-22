import { z } from "zod";
import { catalog } from "../domain/catalog";
import {
  bookingSchema,
  dateSchema,
  loginSchema,
  registerSchema,
  restaurantSchema,
} from "../domain/validation";
import type { Restaurant, Role } from "../domain/types";
import { digest, hashPassword, verifyPassword } from "./crypto";
interface Account {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenant: string;
  demo: number;
  password: string;
}
interface VenueRow {
  id: string;
  owner: string;
  status: Restaurant["status"];
  data: string;
}
class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function assert(
  condition: unknown,
  status: number,
  message: string,
): asserts condition {
  if (!condition) throw new ApiError(status, message);
}
const userView = (u: Account) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  demo: !!u.demo,
});
const venueView = (r: VenueRow): Restaurant => ({
  ...JSON.parse(r.data),
  id: r.id,
  owner: r.owner,
  status: r.status,
});
const bookingSelect = `SELECT b.id,b.restaurant_id AS restaurantId,b.restaurant_name AS restaurantName,b.image,b.date,b.time,b.guests,b.occasion,b.requests,b.status,b.created_at AS createdAt,u.name,u.email FROM bookings b JOIN users u ON u.id=b.user_id`;
export async function handleApi(
  request: Request,
  db: D1Database,
  demoEnabled: boolean,
  bucket?: {
    get(key: string): Promise<{
      body: ReadableStream;
      httpMetadata?: { contentType?: string };
    } | null>;
    put(
      key: string,
      value: Uint8Array,
      options: { httpMetadata: { contentType: string } },
    ): Promise<unknown>;
  },
): Promise<Response> {
  let sessionCookie: string | undefined;
  const respond = (data: unknown, status = 200) =>
    Response.json(data, {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...(sessionCookie ? { "Set-Cookie": sessionCookie } : {}),
      },
    });
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api\/?/, "");
    if (!["GET", "HEAD"].includes(request.method)) {
      assert(
        request.headers.get("Origin") === url.origin,
        403,
        "Request origin is not allowed",
      );
      assert(
        url.pathname === "/api/images" ||
          request.headers.get("content-type")?.includes("application/json"),
        415,
        "Use application/json",
      );
    }
    const parse = async () => {
      const reader = request.body?.getReader();
      assert(reader, 400, "Request body is required");
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 16000) {
          await reader.cancel();
          throw new ApiError(413, "Request is too large");
        }
        chunks.push(chunk.value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return JSON.parse(new TextDecoder().decode(bytes));
    };
    const token = request.headers
      .get("cookie")
      ?.match(/(?:^|;\s*)qd_session=([^;]+)/)?.[1];
    const user = token
      ? await db
          .prepare(
            "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?",
          )
          .bind(await digest(token), Date.now())
          .first<Account>()
      : null;
    const tenant = user?.tenant ?? "public";
    const requireUser = () => {
      assert(user, 401, "Please sign in to continue");
      return user;
    };
    const requireRole = (role: Role) => {
      const u = requireUser();
      assert(u.role === role, 403, "You do not have permission");
      return u;
    };
    const getVenues = async () => {
      const rows = await db
        .prepare("SELECT * FROM restaurants WHERE tenant=? LIMIT 200")
        .bind(tenant)
        .all<VenueRow>();
      return [...catalog, ...rows.results.map(venueView)];
    };
    const session = async (u: Account) => {
      const raw = crypto.randomUUID() + crypto.randomUUID();
      await db.batch([
        db.prepare("DELETE FROM sessions WHERE expires<?").bind(Date.now()),
        db
          .prepare("INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)")
          .bind(await digest(raw), u.id, Date.now() + 7 * 86400000),
      ]);
      sessionCookie = `qd_session=${raw}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${url.protocol === "https:" ? "; Secure" : ""}`;
      return userView(u);
    };
    const limit = async (action: string, max: number) => {
      const ip = request.headers.get("CF-Connecting-IP") ?? "local";
      const bucket = Math.floor(Date.now() / 900000);
      const key = await digest(`${action}:${ip}:${bucket}`);
      const row = await db
        .prepare(
          "INSERT INTO rate_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
        )
        .bind(key, Date.now() + 900000)
        .first<{ count: number }>();
      assert(
        (row?.count ?? max + 1) <= max,
        429,
        "Too many attempts. Please try again in 15 minutes",
      );
      await db
        .prepare("DELETE FROM rate_limits WHERE expires<?")
        .bind(Date.now())
        .run();
    };

    if (path.startsWith("images/") && request.method === "GET") {
      assert(bucket, 503, "Image storage is unavailable");
      const key = path.slice(7);
      assert(
        /^[a-f0-9-]{36}\.(webp|png|jpg)$/.test(key),
        404,
        "Image not found",
      );
      const object = await bucket.get(key);
      assert(object, 404, "Image not found");
      return new Response(object.body, {
        headers: {
          "Content-Type": object.httpMetadata?.contentType ?? "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'",
        },
      });
    }
    if (path === "images" && request.method === "POST") {
      requireRole("owner");
      assert(bucket, 503, "Image storage is unavailable");
      await limit("image", 20);
      const reader = request.body?.getReader();
      assert(reader, 400, "Choose an image");
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 2 * 1024 * 1024) {
          await reader.cancel();
          throw new ApiError(413, "Image must be smaller than 2 MB");
        }
        chunks.push(chunk.value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      const png =
        bytes[0] === 137 &&
        bytes[1] === 80 &&
        bytes[2] === 78 &&
        bytes[3] === 71;
      const webp =
        new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
        new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
      assert(jpg || png || webp, 400, "Use a JPEG, PNG, or WebP image");
      const ext = jpg ? "jpg" : png ? "png" : "webp";
      const key = crypto.randomUUID() + "." + ext;
      await bucket.put(key, bytes, {
        httpMetadata: { contentType: "image/" + (jpg ? "jpeg" : ext) },
      });
      return respond({ image: "/api/images/" + key }, 201);
    }
    if (path === "health")
      return respond({
        status: "ok",
        database: !!(await db.prepare("SELECT 1 AS ok").first()),
        demoEnabled,
      });
    if (path === "me" && request.method === "GET")
      return respond({ user: user ? userView(user) : null, demoEnabled });
    if (path === "auth/logout" && request.method === "POST") {
      if (token)
        await db
          .prepare("DELETE FROM sessions WHERE token=?")
          .bind(await digest(token))
          .run();
      sessionCookie = "qd_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
      return respond({ ok: true });
    }
    if (path === "auth/register" && request.method === "POST") {
      await limit("auth", 15);
      const data = registerSchema.parse(await parse());
      const exists = await db
        .prepare("SELECT id FROM users WHERE email=?")
        .bind(data.email)
        .first();
      assert(!exists, 409, "An account with this email already exists");
      const id = crypto.randomUUID();
      await db
        .prepare(
          "INSERT INTO users(id,name,email,password,role,tenant,demo,created_at) VALUES(?,?,?,?,?,?,0,?)",
        )
        .bind(
          id,
          data.name,
          data.email,
          await hashPassword(data.password),
          data.role,
          "public",
          Date.now(),
        )
        .run();
      const u = await db
        .prepare("SELECT * FROM users WHERE id=?")
        .bind(id)
        .first<Account>();
      assert(u, 500, "Could not create account");
      return respond({ user: await session(u) }, 201);
    }
    if (path === "auth/login" && request.method === "POST") {
      await limit("auth", 15);
      const data = loginSchema.parse(await parse());
      const u = await db
        .prepare("SELECT * FROM users WHERE email=? AND demo=0")
        .bind(data.email)
        .first<Account>();
      const valid = await verifyPassword(
        data.password,
        u?.password ??
          "unavailable:0000000000000000000000000000000000000000000000000000000000000000",
      );
      assert(u && valid, 401, "Email or password is incorrect");
      return respond({ user: await session(u) });
    }
    if (path === "auth/demo" && request.method === "POST") {
      assert(demoEnabled, 404, "Demo access is disabled");
      await limit("demo", 30);
      const { role } = z
        .object({ role: z.enum(["user", "owner", "admin"]) })
        .parse(await parse());
      const id = crypto.randomUUID();
      const t = "demo-" + id;
      const u: Account = {
        id,
        name:
          role === "user"
            ? "Alex Morgan"
            : role === "owner"
              ? "Elena Rossi"
              : "Demo Administrator",
        email: `${id}@demo.invalid`,
        role,
        tenant: t,
        demo: 1,
        password: "disabled",
      };
      await db
        .prepare(
          "INSERT INTO users(id,name,email,password,role,tenant,demo,created_at) VALUES(?,?,?,?,?,?,1,?)",
        )
        .bind(id, u.name, u.email, "disabled", role, t, Date.now())
        .run();
      if (role !== "user") {
        const venue = {
          ...catalog[1],
          id: crypto.randomUUID(),
          slug: "your-rooftop-" + id.slice(0, 6),
          name: "Your Rooftop Atelier",
          owner: id,
          status: role === "admin" ? "pending" : "approved",
        };
        await db
          .prepare(
            "INSERT INTO restaurants(id,tenant,owner,status,data) VALUES(?,?,?,?,?)",
          )
          .bind(venue.id, t, id, venue.status, JSON.stringify(venue))
          .run();
      }
      return respond({ user: await session(u) }, 201);
    }
    if (path === "restaurants" && request.method === "GET") {
      const venues = await getVenues();
      return respond({
        restaurants: venues.filter((r) => r.status === "approved"),
      });
    }
    if (path === "availability" && request.method === "GET") {
      const id = url.searchParams.get("restaurantId");
      const date = dateSchema.parse(url.searchParams.get("date"));
      const guests = z.coerce
        .number()
        .int()
        .min(1)
        .max(12)
        .parse(url.searchParams.get("guests"));
      const r = (await getVenues()).find(
        (r) => r.id === id && r.status === "approved",
      );
      assert(r, 404, "Restaurant not found");
      const rows = await db
        .prepare(
          "SELECT time,SUM(guests) AS used FROM bookings WHERE tenant=? AND restaurant_id=? AND date=? AND status!='cancelled' GROUP BY time",
        )
        .bind(tenant, r.id, date)
        .all<{ time: string; used: number }>();
      return respond({
        slots: r.slots
          .map((time) => ({
            time,
            remaining:
              r.capacity -
              (rows.results.find((x) => x.time === time)?.used ?? 0),
          }))
          .filter((s) => s.remaining >= guests),
      });
    }
    if (path === "bookings" && request.method === "POST") {
      const u = requireUser();
      await limit("booking", 40);
      const data = bookingSchema.parse(await parse());
      const r = (await getVenues()).find(
        (r) => r.id === data.restaurantId && r.status === "approved",
      );
      assert(r, 404, "Restaurant not found");
      assert(r.slots.includes(data.time), 400, "Choose a valid service time");
      const localTime = new Date()
        .toLocaleString("sv-SE", { timeZone: "America/New_York" })
        .slice(0, 16);
      assert(
        `${data.date} ${data.time}` > localTime,
        400,
        "This service time has already passed",
      );
      const id = "QD-" + crypto.randomUUID().slice(0, 8).toUpperCase();
      try {
        await db
          .prepare(
            "INSERT INTO bookings(id,tenant,user_id,restaurant_id,restaurant_name,image,date,time,guests,capacity,occasion,requests,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            id,
            tenant,
            u.id,
            r.id,
            r.name,
            r.image,
            data.date,
            data.time,
            data.guests,
            r.capacity,
            data.occasion,
            data.requests,
            "pending",
            Date.now(),
          )
          .run();
      } catch (error) {
        if (String(error).includes("capacity_exceeded"))
          throw new ApiError(
            409,
            "This time just filled up. Please choose another time",
          );
        throw error;
      }
      return respond({ id, status: "pending" }, 201);
    }
    if (path === "bookings" && request.method === "GET") {
      const u = requireUser();
      return respond({
        bookings: (
          await db
            .prepare(
              bookingSelect +
                " WHERE b.user_id=? ORDER BY b.created_at DESC LIMIT 100",
            )
            .bind(u.id)
            .all()
        ).results,
      });
    }
    if (path.startsWith("bookings/") && request.method === "PATCH") {
      const u = requireUser();
      const id = path.split("/")[1];
      const { status } = z
        .object({ status: z.enum(["confirmed", "cancelled"]) })
        .parse(await parse());
      const b = await db
        .prepare("SELECT * FROM bookings WHERE id=? AND tenant=?")
        .bind(id, tenant)
        .first<{ user_id: string; restaurant_id: string; status: string }>();
      assert(b, 404, "Reservation not found");
      const r = (await getVenues()).find((v) => v.id === b.restaurant_id);
      const manager =
        u.role === "admin" || (u.role === "owner" && r?.owner === u.id);
      assert(
        manager || (b.user_id === u.id && status === "cancelled"),
        403,
        "You cannot update this reservation",
      );
      assert(
        b.status === "pending" ||
          (b.status === "confirmed" && status === "cancelled"),
        409,
        "This reservation cannot be changed",
      );
      const updated = await db
        .prepare("UPDATE bookings SET status=? WHERE id=? AND status=?")
        .bind(status, id, b.status)
        .run();
      assert(
        updated.meta.changes === 1,
        409,
        "This reservation changed. Refresh before trying again",
      );
      return respond({ ok: true });
    }
    if (path === "restaurants" && request.method === "POST") {
      const u = requireRole("owner");
      const data = restaurantSchema.parse(await parse());
      const id = crypto.randomUUID();
      const venue: Restaurant = {
        ...data,
        id,
        slug:
          data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") +
          "-" +
          id.slice(0, 6),
        image: data.image,
        rating: 0,
        tags: data.tags,
        slots: data.slots,
        owner: u.id,
        status: "pending",
        featured: false,
      };
      await db
        .prepare(
          "INSERT INTO restaurants(id,tenant,owner,status,data) VALUES(?,?,?,?,?)",
        )
        .bind(id, tenant, u.id, "pending", JSON.stringify(venue))
        .run();
      return respond({ restaurant: venue }, 201);
    }
    if (path.startsWith("restaurants/") && request.method === "PATCH") {
      const u = requireUser();
      const id = path.split("/")[1];
      const row = await db
        .prepare("SELECT * FROM restaurants WHERE id=? AND tenant=?")
        .bind(id, tenant)
        .first<VenueRow>();
      assert(row, 404, "Venue not found");
      const input = await parse();
      if (u.role === "admin") {
        const { status } = z
          .object({ status: z.enum(["approved", "rejected"]) })
          .parse(input);
        await db
          .prepare("UPDATE restaurants SET status=? WHERE id=?")
          .bind(status, id)
          .run();
      } else {
        assert(
          row.owner === u.id && u.role === "owner",
          403,
          "You cannot edit this venue",
        );
        const data = restaurantSchema.parse(input);
        await db
          .prepare("UPDATE restaurants SET data=?,status='pending' WHERE id=?")
          .bind(JSON.stringify({ ...venueView(row), ...data }), id)
          .run();
      }
      return respond({ ok: true });
    }
    if (path === "dashboard" && request.method === "GET") {
      const u = requireUser();
      assert(u.role !== "user", 403, "Management access required");
      const venues = (await getVenues()).filter(
        (r) => u.role === "admin" || r.owner === u.id,
      );
      const ids = venues.map((r) => r.id);
      const all = (
        await db
          .prepare(
            bookingSelect +
              " WHERE b.tenant=? ORDER BY b.created_at DESC LIMIT 200",
          )
          .bind(tenant)
          .all<{ restaurantId: string }>()
      ).results;
      const count = await db
        .prepare("SELECT COUNT(*) AS n FROM users WHERE tenant=?")
        .bind(tenant)
        .first<{ n: number }>();
      return respond({
        restaurants: venues,
        bookings:
          u.role === "admin"
            ? all
            : all.filter((b) => ids.includes(b.restaurantId)),
        users: count?.n ?? 0,
      });
    }
    if (path === "newsletter" && request.method === "POST") {
      await limit("newsletter", 10);
      const { email } = z
        .object({ email: z.string().email().max(254) })
        .parse(await parse());
      await db
        .prepare(
          "INSERT OR IGNORE INTO subscriptions(email,created_at) VALUES(?,?)",
        )
        .bind(email.toLowerCase(), Date.now())
        .run();
      return respond({
        ok: true,
        message: "You are on the list. Your preference has been saved.",
      });
    }
    throw new ApiError(404, "Endpoint not found");
  } catch (error) {
    if (error instanceof z.ZodError)
      return respond(
        { error: error.issues[0]?.message ?? "Invalid input" },
        400,
      );
    if (error instanceof ApiError)
      return respond({ error: error.message }, error.status);
    if (error instanceof SyntaxError)
      return respond({ error: "Invalid JSON body" }, 400);
    console.error(
      JSON.stringify({
        event: "api_error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
    );
    return respond({ error: "Something went wrong. Please try again." }, 500);
  }
}
