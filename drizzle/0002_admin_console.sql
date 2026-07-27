ALTER TABLE `posts` ADD `moderation_note` text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `pending_uploads_session_position_unique`
ON `pending_uploads` (`session_hash`,`position`);
--> statement-breakpoint
ALTER TABLE `posts` ADD `moderated_by` text;
--> statement-breakpoint
ALTER TABLE `posts` ADD `moderated_at` integer;
--> statement-breakpoint
ALTER TABLE `posts` ADD `version` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `posts_status_created_idx` ON `posts` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `posts_club_created_idx` ON `posts` (`club_slug`,`created_at`);
--> statement-breakpoint

ALTER TABLE `club_accounts` ADD `key_hash` text;
--> statement-breakpoint
ALTER TABLE `club_accounts` ADD `key_issued_at` integer;
--> statement-breakpoint
ALTER TABLE `club_accounts` ADD `approved_by` text;
--> statement-breakpoint
ALTER TABLE `club_accounts` ADD `updated_at` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `club_accounts` ADD `version` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `club_accounts_status_updated_idx` ON `club_accounts` (`status`,`updated_at`);
--> statement-breakpoint

ALTER TABLE `club_sessions` ADD `revoked_at` integer;
--> statement-breakpoint
ALTER TABLE `club_sessions` ADD `revoked_reason` text;
--> statement-breakpoint
ALTER TABLE `club_sessions` ADD `version` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `club_sessions_club_expires_idx` ON `club_sessions` (`club_slug`,`expires_at`);
--> statement-breakpoint

ALTER TABLE `club_applications` ADD `club_slug` text;
--> statement-breakpoint
ALTER TABLE `club_applications` ADD `decision_note` text;
--> statement-breakpoint
ALTER TABLE `club_applications` ADD `reviewed_by` text;
--> statement-breakpoint
ALTER TABLE `club_applications` ADD `reviewed_at` integer;
--> statement-breakpoint
ALTER TABLE `club_applications` ADD `version` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `club_applications_slug_idx` ON `club_applications` (`club_slug`);
--> statement-breakpoint

ALTER TABLE `reports` ADD `resolution` text;
--> statement-breakpoint
ALTER TABLE `reports` ADD `resolved_by` text;
--> statement-breakpoint
ALTER TABLE `reports` ADD `resolved_at` integer;
--> statement-breakpoint
ALTER TABLE `reports` ADD `version` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `reports_post_status_idx` ON `reports` (`post_id`,`status`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `admin_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'owner' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `admin_users_email_unique` ON `admin_users` (`email`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `admin_users_role_status_idx` ON `admin_users` (`role`,`status`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `admin_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`admin_user_id` text NOT NULL,
	`csrf_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `admin_sessions_user_expires_idx` ON `admin_sessions` (`admin_user_id`,`expires_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `admin_sessions_expires_idx` ON `admin_sessions` (`expires_at`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text NOT NULL,
	`actor_role` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`metadata_json` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `audit_logs_created_idx` ON `audit_logs` (`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `audit_logs_target_idx` ON `audit_logs` (`target_type`,`target_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `audit_logs_actor_idx` ON `audit_logs` (`actor_user_id`,`created_at`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `rate_limits` (
	`key_hash` text NOT NULL,
	`action` text NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`expires_at` integer NOT NULL,
	PRIMARY KEY(`key_hash`, `action`, `window_start`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `rate_limits_expires_idx` ON `rate_limits` (`expires_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `rate_limits_action_window_idx` ON `rate_limits` (`action`,`window_start`);
