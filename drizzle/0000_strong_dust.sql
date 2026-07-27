CREATE TABLE IF NOT EXISTS `club_accounts` (
	`slug` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_verified_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `club_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`club_name` text NOT NULL,
	`ukm_email` text NOT NULL,
	`contact` text NOT NULL,
	`note` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `club_applications_status_idx` ON `club_applications` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `club_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`club_slug` text NOT NULL,
	`club_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `club_sessions_expires_idx` ON `club_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`area` text NOT NULL,
	`price` text,
	`contact_type` text NOT NULL,
	`contact` text NOT NULL,
	`image_key` text,
	`event_at` integer,
	`venue` text,
	`club_slug` text,
	`club_name` text,
	`status` text DEFAULT 'published' NOT NULL,
	`owner_token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `posts_status_expires_idx` ON `posts` (`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `posts_category_created_idx` ON `posts` (`category`,`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `presence_sessions` (
	`session_hash` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `presence_updated_idx` ON `presence_sessions` (`updated_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `reports_status_idx` ON `reports` (`status`,`created_at`);
