import { afterAll, beforeAll, beforeEach, describe, it, expect } from "vitest";
import { Miniflare } from "miniflare";
import { readFileSync } from "node:fs";
import { handleApi } from "../server/api";
let mf: Miniflare;
let db: D1Database;
let bucket: NonNullable<Parameters<typeof handleApi>[3]>;
const date = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10);
const validVenue = {
  name: "Test Atelier",
  cuisine: "Italian",
  location: "Manhattan, NY",
  address: "123 Test Avenue",
  description:
    "An exceptional independent dining destination with a seasonal menu.",
  chef: "Test Chef",
  price: 3,
  capacity: 10,
};
async function request(
  path: string,
  body?: unknown,
  cookie = "",
  method = "POST",
  origin = "https://quickdine.test",
  demo = true,
) {
  return handleApi(
    new Request("https://quickdine.test/api/" + path, {
      method: body === undefined ? "GET" : method,
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        Cookie: cookie,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    db,
    demo,
  );
}
async function register(email = "alex@test.com", role = "user") {
  const r = await request("auth/register", {
    name: "Alex Morgan",
    email,
    password: "a-long-safe-password",
    role,
  });
  return {
    response: r,
    cookie: r.headers.get("set-cookie")!.split(";")[0],
    user: ((await r.json()) as { user: { id: string } }).user,
  };
}
async function elevate(cookie: string, id: string, role = "admin") {
  await db.prepare("UPDATE users SET role=? WHERE id=?").bind(role, id).run();
  return cookie;
}
beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("test")}}',
    d1Databases: ["DB"],
    r2Buckets: ["BUCKET"],
    compatibilityDate: "2026-05-15",
  });
  db = await mf.getD1Database("DB");
  const remoteBucket = await mf.getR2Bucket("BUCKET");
  bucket = {
    async get(key) {
      const object = await remoteBucket.get(key, {});
      if (!object || !("arrayBuffer" in object)) return null;
      return {
        body: new Response(await object.arrayBuffer()).body!,
        httpMetadata: object.httpMetadata,
      };
    },
    async put(key, value, options) {
      return remoteBucket.put(key, value, options);
    },
  };
  for (const file of [
    "0000_yielding_slipstream.sql",
    "0001_booking_guards.sql",
  ])
    for (const sql of readFileSync("drizzle/" + file, "utf8")
      .split("--> statement-breakpoint")
      .filter((s) => s.trim()))
      await db.prepare(sql).run();
});
beforeEach(async () => {
  for (const table of [
    "bookings",
    "sessions",
    "restaurants",
    "users",
    "subscriptions",
    "rate_limits",
  ])
    await db.prepare("DELETE FROM " + table).run();
});
afterAll(async () => {
  await mf?.dispose();
});
describe("authentication and access", () => {
  it("persists a hashed account and an HttpOnly session", async () => {
    const a = await register();
    expect(a.response.status).toBe(201);
    expect(a.response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(a.response.headers.get("set-cookie")).toContain("Secure");
    const me = await request("me", undefined, a.cookie);
    expect(((await me.json()) as { user: { id: string } }).user.id).toBe(
      a.user.id,
    );
    const row = await db
      .prepare("SELECT password FROM users WHERE id=?")
      .bind(a.user.id)
      .first<{ password: string }>();
    expect(row?.password).not.toBe("a-long-safe-password");
  });
  it("rejects duplicate accounts and incorrect passwords", async () => {
    await register();
    expect(
      (
        await request("auth/register", {
          name: "Alex",
          email: "alex@test.com",
          password: "a-long-safe-password",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await request("auth/login", {
          email: "alex@test.com",
          password: "wrong-password",
        })
      ).status,
    ).toBe(401);
  });
  it("logs in and revokes sessions on logout", async () => {
    await register();
    const r = await request("auth/login", {
      email: "alex@test.com",
      password: "a-long-safe-password",
    });
    expect(r.status).toBe(200);
    const cookie = r.headers.get("set-cookie")!.split(";")[0];
    await request("auth/logout", {}, cookie);
    expect((await request("me", undefined, cookie)).status).toBe(200);
    expect(
      (
        (await (await request("me", undefined, cookie)).json()) as {
          user: unknown;
        }
      ).user,
    ).toBeNull();
  });
  it("rejects cross-origin mutation and unauthenticated access", async () => {
    expect(
      (
        await request(
          "auth/register",
          { name: "Alex" },
          "",
          "POST",
          "https://attacker.test",
        )
      ).status,
    ).toBe(403);
    expect((await request("bookings")).status).toBe(401);
  });
  it("prevents administrator role injection and enforces management authorization", async () => {
    expect(
      (
        await request("auth/register", {
          name: "Alex",
          email: "x@test.com",
          password: "a-long-safe-password",
          role: "admin",
        })
      ).status,
    ).toBe(400);
    const a = await register();
    expect((await request("dashboard", undefined, a.cookie)).status).toBe(403);
    expect((await request("restaurants", validVenue, a.cookie)).status).toBe(
      403,
    );
  });
  it("rate limits authentication attempts", async () => {
    for (let i = 0; i < 15; i++)
      await request("auth/login", {
        email: "missing@test.com",
        password: "wrong-password",
      });
    expect(
      (
        await request("auth/login", {
          email: "missing@test.com",
          password: "wrong-password",
        })
      ).status,
    ).toBe(429);
  });
  it("disables demo access unless configured", async () =>
    expect(
      (
        await request(
          "auth/demo",
          { role: "admin" },
          "",
          "POST",
          "https://quickdine.test",
          false,
        )
      ).status,
    ).toBe(404));
  it("keeps demo administrator workspaces isolated", async () => {
    const a = await request("auth/demo", { role: "admin" });
    const b = await request("auth/demo", { role: "admin" });
    const ca = a.headers.get("set-cookie")!.split(";")[0],
      cb = b.headers.get("set-cookie")!.split(";")[0];
    const da = (await (await request("dashboard", undefined, ca)).json()) as {
      restaurants: { id: string; owner: string | null }[];
    };
    const privateVenue = da.restaurants.find((v) => v.owner)!;
    expect(
      (
        await request(
          "restaurants/" + privateVenue.id,
          { status: "approved" },
          cb,
          "PATCH",
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await request(
          "restaurants/" + privateVenue.id,
          { status: "approved" },
          ca,
          "PATCH",
        )
      ).status,
    ).toBe(200);
  });
});
describe("reservation lifecycle and capacity", () => {
  it("creates, retrieves, and cancels a reservation; cancellation restores capacity", async () => {
    const a = await register();
    const payload = {
      restaurantId: "kuro-omakase",
      date,
      time: "18:00",
      guests: 4,
      occasion: "Birthday",
      requests: "Window seat, please",
    };
    const r = await request("bookings", payload, a.cookie);
    expect(r.status).toBe(201);
    const { id } = (await r.json()) as { id: string };
    let slots = (await (
      await request(
        "availability?" +
          new URLSearchParams({
            restaurantId: payload.restaurantId,
            date,
            guests: "1",
          }),
        undefined,
        a.cookie,
      )
    ).json()) as { slots: { time: string; remaining: number }[] };
    expect(slots.slots.find((s) => s.time === "18:00")?.remaining).toBe(12);
    const bookings = (await (
      await request("bookings", undefined, a.cookie)
    ).json()) as { bookings: { requests: string }[] };
    expect(bookings.bookings[0].requests).toBe(payload.requests);
    expect(
      (
        await request(
          "bookings/" + id,
          { status: "cancelled" },
          a.cookie,
          "PATCH",
        )
      ).status,
    ).toBe(200);
    slots = (await (
      await request(
        "availability?" +
          new URLSearchParams({
            restaurantId: payload.restaurantId,
            date,
            guests: "1",
          }),
        undefined,
        a.cookie,
      )
    ).json()) as typeof slots;
    expect(slots.slots.find((s) => s.time === "18:00")?.remaining).toBe(16);
  });
  it("enforces capacity atomically across competing reservations", async () => {
    const a = await register();
    const payload = {
      restaurantId: "kuro-omakase",
      date,
      time: "18:00",
      guests: 10,
    };
    const responses = await Promise.all([
      request("bookings", payload, a.cookie),
      request("bookings", payload, a.cookie),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    const row = await db
      .prepare("SELECT SUM(guests) AS n FROM bookings")
      .first<{ n: number }>();
    expect(row?.n).toBe(10);
  });
  it("rejects invalid service times and past dates", async () => {
    const a = await register();
    expect(
      (
        await request(
          "bookings",
          { restaurantId: "kuro-omakase", date, time: "03:00", guests: 2 },
          a.cookie,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await request(
          "bookings",
          {
            restaurantId: "kuro-omakase",
            date: "2020-01-01",
            time: "18:00",
            guests: 2,
          },
          a.cookie,
        )
      ).status,
    ).toBe(400);
  });
  it("prevents other diners from changing a reservation and blocks resurrection", async () => {
    const a = await register();
    const b = await register("other@test.com");
    const r = await request(
      "bookings",
      { restaurantId: "l-essence", date, time: "19:00", guests: 2 },
      a.cookie,
    );
    const { id } = (await r.json()) as { id: string };
    expect(
      (
        await request(
          "bookings/" + id,
          { status: "cancelled" },
          b.cookie,
          "PATCH",
        )
      ).status,
    ).toBe(403);
    await request("bookings/" + id, { status: "cancelled" }, a.cookie, "PATCH");
    const admin = await elevate(a.cookie, a.user.id);
    expect(
      (await request("bookings/" + id, { status: "confirmed" }, admin, "PATCH"))
        .status,
    ).toBe(409);
  });
});
describe("venue moderation and subscriptions", () => {
  it("supports submit, approve, discover, reserve, confirm, edit and re-review", async () => {
    const owner = await register("owner@test.com", "owner");
    const admin = await register("admin@test.com");
    await elevate(admin.cookie, admin.user.id);
    const r = await request("restaurants", validVenue, owner.cookie);
    expect(r.status).toBe(201);
    const { restaurant } = (await r.json()) as { restaurant: { id: string } };
    const list = async () =>
      (
        (await (await request("restaurants")).json()) as {
          restaurants: { id: string }[];
        }
      ).restaurants;
    expect((await list()).some((v) => v.id === restaurant.id)).toBe(false);
    expect(
      (
        await request(
          "restaurants/" + restaurant.id,
          { status: "approved" },
          admin.cookie,
          "PATCH",
        )
      ).status,
    ).toBe(200);
    expect((await list()).some((v) => v.id === restaurant.id)).toBe(true);
    const diner = await register("diner@test.com");
    const res = await request(
      "bookings",
      { restaurantId: restaurant.id, date, time: "19:00", guests: 2 },
      diner.cookie,
    );
    const { id } = (await res.json()) as { id: string };
    expect(
      (
        await request(
          "bookings/" + id,
          { status: "confirmed" },
          owner.cookie,
          "PATCH",
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await request(
          "restaurants/" + restaurant.id,
          { ...validVenue, name: "Updated Atelier" },
          owner.cookie,
          "PATCH",
        )
      ).status,
    ).toBe(200);
    expect((await list()).some((v) => v.id === restaurant.id)).toBe(false);
  });
  it("stores newsletter preferences idempotently without claiming email delivery", async () => {
    expect(
      (await request("newsletter", { email: "reader@example.com" })).status,
    ).toBe(200);
    expect(
      (await request("newsletter", { email: "reader@example.com" })).status,
    ).toBe(200);
    const row = await db
      .prepare("SELECT COUNT(*) AS n FROM subscriptions")
      .first<{ n: number }>();
    expect(row?.n).toBe(1);
  });
});

describe("restaurant cover uploads", () => {
  it("stores and serves an authenticated cover with immutable caching", async () => {
    const owner = await register("cover@test.com", "owner");
    const bytes = readFileSync("public/images/restaurant_3-450.webp");
    const r = await handleApi(
      new Request("https://quickdine.test/api/images", {
        method: "POST",
        headers: {
          Origin: "https://quickdine.test",
          Cookie: owner.cookie,
          "Content-Type": "image/webp",
        },
        body: bytes,
      }),
      db,
      true,
      bucket,
    );
    expect(r.status).toBe(201);
    const data = (await r.json()) as { image: string };
    const image = await handleApi(
      new Request("https://quickdine.test" + data.image),
      db,
      true,
      bucket,
    );
    expect(image.status).toBe(200);
    expect(image.headers.get("content-type")).toBe("image/webp");
    expect(image.headers.get("cache-control")).toContain("immutable");
    expect((await image.arrayBuffer()).byteLength).toBe(bytes.byteLength);
  });
  it("blocks non-owners and rejects invalid file signatures", async () => {
    const diner = await register();
    const upload = (cookie: string) =>
      handleApi(
        new Request("https://quickdine.test/api/images", {
          method: "POST",
          headers: {
            Origin: "https://quickdine.test",
            Cookie: cookie,
            "Content-Type": "image/png",
          },
          body: "not an image",
        }),
        db,
        true,
        bucket,
      );
    expect((await upload(diner.cookie)).status).toBe(403);
    await elevate(diner.cookie, diner.user.id, "owner");
    expect((await upload(diner.cookie)).status).toBe(400);
  });
  it("bounds image upload memory", async () => {
    const owner = await register("large@test.com", "owner");
    const r = await handleApi(
      new Request("https://quickdine.test/api/images", {
        method: "POST",
        headers: {
          Origin: "https://quickdine.test",
          Cookie: owner.cookie,
          "Content-Type": "image/png",
        },
        body: new Uint8Array(2 * 1024 * 1024 + 1),
      }),
      db,
      true,
      bucket,
    );
    expect(r.status).toBe(413);
  });
});
