import { z } from "zod";
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T12:00:00Z");
    return !isNaN(+d) && d.toISOString().slice(0, 10) === v;
  }, "Invalid date")
  .refine(
    (v) => v >= new Date().toISOString().slice(0, 10),
    "Choose today or a future date",
  )
  .refine(
    (v) => +new Date(v) <= Date.now() + 366 * 86400000,
    "Book within one year",
  );
export const loginSchema = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(10).max(128),
});
export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2).max(80),
  role: z.enum(["user", "owner"]).default("user"),
});
export const bookingSchema = z.object({
  restaurantId: z.string().max(100),
  date: dateSchema,
  time: z.string().regex(/^\d{2}:\d{2}$/),
  guests: z.number().int().min(1).max(12),
  occasion: z.string().max(60).default(""),
  requests: z.string().max(1000).default(""),
});
export const restaurantSchema = z.object({
  name: z.string().trim().min(2).max(80),
  cuisine: z.enum([
    "French",
    "Italian",
    "Japanese",
    "Vegetarian",
    "Steakhouse",
  ]),
  location: z.string().trim().min(2).max(100),
  address: z.string().trim().min(5).max(200),
  description: z.string().trim().min(30).max(2000),
  chef: z.string().trim().min(2).max(80),
  price: z.number().int().min(1).max(4),
  capacity: z.number().int().min(2).max(300),
  image: z
    .string()
    .regex(
      /^\/(images\/restaurant_[1-6]\.webp|api\/images\/[a-f0-9-]{36}\.(jpg|png|webp))$/,
    )
    .default("/images/restaurant_3.webp"),
  tags: z.array(z.string().trim().min(1).max(30)).max(6).default([]),
  slots: z
    .array(z.string().regex(/^(1[0-9]|2[0-3]):(00|15|30|45)$/))
    .min(1)
    .max(24)
    .transform((v) => [...new Set(v)].sort())
    .default(["17:00", "18:00", "19:00", "20:00", "21:00"]),
});
