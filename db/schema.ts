import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const connections = sqliteTable("connections", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull().default("local-user"),
  provider: text("provider").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("needs_auth"),
  accountLabel: text("account_label"),
  scopes: text("scopes").notNull().default("[]"),
  tokenCiphertext: text("token_ciphertext"),
  refreshTokenCiphertext: text("refresh_token_ciphertext"),
  expiresAt: text("expires_at"),
  lastTestedAt: text("last_tested_at"),
  statusReason: text("status_reason"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const oauthStates = sqliteTable("oauth_states", {
  state: text("state").primaryKey(),
  ownerEmail: text("owner_email").notNull().default("local-user"),
  connectionId: text("connection_id").notNull(),
  provider: text("provider").notNull(),
  returnTo: text("return_to").notNull().default("/"),
  verifier: text("verifier"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
});
