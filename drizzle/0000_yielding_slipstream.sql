CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant` text NOT NULL,
	`user_id` text NOT NULL,
	`restaurant_id` text NOT NULL,
	`restaurant_name` text NOT NULL,
	`image` text NOT NULL,
	`date` text NOT NULL,
	`time` text NOT NULL,
	`guests` integer NOT NULL,
	`capacity` integer NOT NULL,
	`occasion` text NOT NULL,
	`requests` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `booking_capacity` ON `bookings` (`tenant`,`restaurant_id`,`date`,`time`,`status`);--> statement-breakpoint
CREATE INDEX `booking_user` ON `bookings` (`user_id`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `restaurants` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant` text NOT NULL,
	`owner` text NOT NULL,
	`status` text NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `restaurant_tenant` ON `restaurants` (`tenant`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `session_expiry` ON `sessions` (`expires`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`email` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`role` text NOT NULL,
	`tenant` text NOT NULL,
	`demo` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email` ON `users` (`email`);