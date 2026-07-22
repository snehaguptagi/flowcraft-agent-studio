CREATE TABLE `connections` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text DEFAULT 'local-user' NOT NULL,
	`provider` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'needs_auth' NOT NULL,
	`account_label` text,
	`scopes` text DEFAULT '[]' NOT NULL,
	`token_ciphertext` text,
	`refresh_token_ciphertext` text,
	`expires_at` text,
	`last_tested_at` text,
	`status_reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `oauth_states` (
	`state` text PRIMARY KEY NOT NULL,
	`owner_email` text DEFAULT 'local-user' NOT NULL,
	`connection_id` text NOT NULL,
	`provider` text NOT NULL,
	`return_to` text DEFAULT '/' NOT NULL,
	`verifier` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` integer NOT NULL
);
