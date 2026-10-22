import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    password: text("password").notNull(),
    role: text("role").notNull(),
    tenant: text("tenant").notNull(),
    demo: integer("demo").notNull().default(0),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("users_email").on(t.email)],
);
export const sessions = sqliteTable(
  "sessions",
  {
    token: text("token").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: integer("expires").notNull(),
  },
  (t) => [index("session_expiry").on(t.expires)],
);
export const restaurants = sqliteTable(
  "restaurants",
  {
    id: text("id").primaryKey(),
    tenant: text("tenant").notNull(),
    owner: text("owner")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull(),
    data: text("data").notNull(),
  },
  (t) => [index("restaurant_tenant").on(t.tenant)],
);
export const bookings = sqliteTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    tenant: text("tenant").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    restaurantId: text("restaurant_id").notNull(),
    restaurantName: text("restaurant_name").notNull(),
    image: text("image").notNull(),
    date: text("date").notNull(),
    time: text("time").notNull(),
    guests: integer("guests").notNull(),
    capacity: integer("capacity").notNull(),
    occasion: text("occasion").notNull(),
    requests: text("requests").notNull(),
    status: text("status").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("booking_capacity").on(
      t.tenant,
      t.restaurantId,
      t.date,
      t.time,
      t.status,
    ),
    index("booking_user").on(t.userId),
  ],
);
export const subscriptions = sqliteTable("subscriptions", {
  email: text("email").primaryKey(),
  createdAt: integer("created_at").notNull(),
});
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expires: integer("expires").notNull(),
});
