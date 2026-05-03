import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Companies / workspaces
export const workspaces = sqliteTable("workspaces", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  industry: text("industry"),
  brandColor: text("brand_color").default("#0f766e"),
  logoText: text("logo_text"),
  createdAt: integer("created_at").notNull(),
});

// Data sources uploaded to a workspace (PDF text, CSV summary, URL fetch, raw notes)
export const sources = sqliteTable("sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull(),
  title: text("title").notNull(),
  type: text("type").notNull(), // 'pdf' | 'csv' | 'url' | 'note' | 'gdrive' | 'notion' | 'airtable'
  status: text("status").notNull().default("ready"), // 'processing' | 'ready' | 'error'
  content: text("content").notNull(), // extracted text
  meta: text("meta"), // JSON string
  connectionId: integer("connection_id"), // null for manual sources
  externalId: text("external_id"), // upstream id (drive file id, notion page id, etc.)
  syncedAt: integer("synced_at"),
  createdAt: integer("created_at").notNull(),
});

// Templates — extracted from a sample document (image / PDF page) by LLM
// vision; reusable as branded fillable forms. Powers invoices, branded
// reports, newsletter mastheads, certificates — anything repetitive.
export const templates = sqliteTable("templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("other"), // 'invoice' | 'report' | 'newsletter' | 'other'
  schema: text("schema").notNull(), // JSON: { fields[], lineItemColumns?, brand{}, layoutHints[] }
  previewImage: text("preview_image"), // data: URL or stored path of source image
  brandColor: text("brand_color"),
  createdAt: integer("created_at").notNull(),
});

// Connections — OAuth tokens / API keys for external data sources
export const connections = sqliteTable("connections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull(),
  type: text("type").notNull(), // 'google_drive' | 'notion' | 'airtable' | 'url'
  name: text("name").notNull(),
  status: text("status").notNull().default("active"), // 'active' | 'expired' | 'error'
  config: text("config").notNull(), // JSON: { accessToken, refreshToken, expiresAt, ... }
  accountEmail: text("account_email"),
  lastSyncedAt: integer("last_synced_at"),
  createdAt: integer("created_at").notNull(),
});

// Generated assets: newsletter, report (pdf), deck (pptx)
export const assets = sqliteTable("assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull(),
  title: text("title").notNull(),
  kind: text("kind").notNull(), // 'newsletter' | 'report' | 'deck'
  prompt: text("prompt"),
  status: text("status").notNull().default("ready"), // 'generating' | 'ready' | 'failed'
  filePath: text("file_path"), // for binary outputs
  contentHtml: text("content_html"), // for newsletters
  outline: text("outline"), // JSON outline used to generate
  sourceIds: text("source_ids"), // JSON array of source ids
  createdAt: integer("created_at").notNull(),
});

// Recurring schedules
export const schedules = sqliteTable("schedules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull(),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // 'newsletter' | 'report' | 'deck'
  cadence: text("cadence").notNull(), // 'daily' | 'weekly' | 'monthly'
  prompt: text("prompt").notNull(),
  recipients: text("recipients"), // comma-separated emails
  enabled: integer("enabled").notNull().default(1),
  lastRunAt: integer("last_run_at"),
  nextRunAt: integer("next_run_at"),
  createdAt: integer("created_at").notNull(),
});

// Insert schemas
export const insertWorkspaceSchema = createInsertSchema(workspaces).omit({
  id: true,
  createdAt: true,
});
export const insertSourceSchema = createInsertSchema(sources).omit({
  id: true,
  createdAt: true,
});
export const insertConnectionSchema = createInsertSchema(connections).omit({
  id: true,
  createdAt: true,
});
export const insertTemplateSchema = createInsertSchema(templates).omit({
  id: true,
  createdAt: true,
});
export const insertAssetSchema = createInsertSchema(assets).omit({
  id: true,
  createdAt: true,
});
export const insertScheduleSchema = createInsertSchema(schedules).omit({
  id: true,
  createdAt: true,
});

// Types
export type Workspace = typeof workspaces.$inferSelect;
export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;
export type Source = typeof sources.$inferSelect;
export type InsertSource = z.infer<typeof insertSourceSchema>;
export type Connection = typeof connections.$inferSelect;
export type InsertConnection = z.infer<typeof insertConnectionSchema>;
export type Template = typeof templates.$inferSelect;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Asset = typeof assets.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Schedule = typeof schedules.$inferSelect;
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;

// API request shapes
export const generateRequestSchema = z.object({
  workspaceId: z.number(),
  kind: z.enum(["newsletter", "report", "deck"]),
  title: z.string().min(1),
  prompt: z.string().min(1),
  sourceIds: z.array(z.number()).default([]),
  tone: z.enum(["formal", "conversational", "punchy"]).default("formal"),
});
export type GenerateRequest = z.infer<typeof generateRequestSchema>;
