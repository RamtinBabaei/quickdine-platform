import { describe, it, expect } from "vitest";
import { filterRestaurants } from "../domain/discovery";
import { catalog } from "../domain/catalog";
import {
  bookingSchema,
  dateSchema,
  registerSchema,
} from "../domain/validation";
import { hashPassword, verifyPassword } from "../server/crypto";
describe("reservation boundaries", () => {
  it("rejects dates that do not exist", () => {
    expect(dateSchema.safeParse("2027-02-30").success).toBe(false);
  });
  it("rejects past dates and far-future dates", () => {
    expect(dateSchema.safeParse("2020-01-01").success).toBe(false);
    expect(dateSchema.safeParse("2035-01-01").success).toBe(false);
  });
  it("rejects unsafe guest counts and oversized notes", () => {
    for (const guests of [0, 13, 2.5])
      expect(
        bookingSchema.safeParse({
          restaurantId: "x",
          date: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10),
          time: "19:00",
          guests,
        }).success,
      ).toBe(false);
    expect(
      bookingSchema.safeParse({
        restaurantId: "x",
        date: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10),
        time: "19:00",
        guests: 2,
        requests: "x".repeat(1001),
      }).success,
    ).toBe(false);
  });
  it("cannot register an administrator", () =>
    expect(
      registerSchema.safeParse({
        name: "Admin",
        email: "test@example.com",
        password: "sufficient-password",
        role: "admin",
      }).success,
    ).toBe(false));
  it("normalizes account email addresses", () =>
    expect(
      registerSchema.parse({
        name: "Alex",
        email: "Alex@Example.com",
        password: "sufficient-password",
      }).email,
    ).toBe("alex@example.com"));
});
describe("restaurant discovery", () => {
  it("searches case-insensitively across names and cuisines", () =>
    expect(
      filterRestaurants(catalog, "KURO", "", "", 0, 0).map((r) => r.slug),
    ).toEqual(["kuro-omakase"]));
  it("combines location, cuisine, price and minimum rating", () =>
    expect(
      filterRestaurants(catalog, "", "French", "manhattan", 4, 4.8),
    ).toHaveLength(2));
  it("supports rooftop discovery through venue tags", () =>
    expect(filterRestaurants(catalog, "", "Rooftop", "", 0, 0)[0].slug).toBe(
      "terraza-cielo",
    ));
  it("returns empty results for an unmatched location", () =>
    expect(filterRestaurants(catalog, "", "", "Berlin", 0, 0)).toHaveLength(0));
});
describe("password security", () => {
  it("uses independent salts and verifies the correct password", async () => {
    const a = await hashPassword("a-long-test-password");
    const b = await hashPassword("a-long-test-password");
    expect(a).not.toBe(b);
    expect(a).not.toContain("a-long-test-password");
    expect(await verifyPassword("a-long-test-password", a)).toBe(true);
    expect(await verifyPassword("incorrect-password", a)).toBe(false);
  });
});
