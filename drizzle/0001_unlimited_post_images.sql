CREATE TABLE IF NOT EXISTS `post_images` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`image_key` text NOT NULL UNIQUE,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `post_images_post_position_idx` ON `post_images` (`post_id`,`position`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `pending_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`image_key` text NOT NULL UNIQUE,
	`session_hash` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `pending_uploads_session_position_idx` ON `pending_uploads` (`session_hash`,`position`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `pending_uploads_expires_idx` ON `pending_uploads` (`expires_at`);
--> statement-breakpoint
INSERT OR IGNORE INTO `post_images` (`id`, `post_id`, `image_key`, `position`, `created_at`)
SELECT 'legacy_' || `id`, `id`, `image_key`, 0, `created_at`
FROM `posts`
WHERE `image_key` IS NOT NULL AND `image_key` <> '';
