import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

export const posts = sqliteTable(
  'posts',
  {
    id: text('id').primaryKey(),
    category: text('category').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    area: text('area').notNull(),
    price: text('price'),
    contactType: text('contact_type').notNull(),
    contact: text('contact').notNull(),
    imageKey: text('image_key'),
    eventAt: integer('event_at'),
    venue: text('venue'),
    clubSlug: text('club_slug'),
    clubName: text('club_name'),
    status: text('status').notNull().default('published'),
    ownerTokenHash: text('owner_token_hash').notNull(),
    moderationNote: text('moderation_note'),
    moderatedBy: text('moderated_by'),
    moderatedAt: integer('moderated_at'),
    version: integer('version').notNull().default(1),
    createdAt: integer('created_at').notNull(),
    // Kept for backwards-compatible migrations. Posts are permanent and new
    // rows use a year-9999 sentinel; runtime visibility never filters on it.
    expiresAt: integer('expires_at').notNull(),
  },
  (table) => [
    index('posts_status_expires_idx').on(table.status, table.expiresAt),
    index('posts_category_created_idx').on(table.category, table.createdAt),
    index('posts_status_created_idx').on(table.status, table.createdAt),
    index('posts_club_created_idx').on(table.clubSlug, table.createdAt),
  ],
)

export const postImages = sqliteTable(
  'post_images',
  {
    id: text('id').primaryKey(),
    postId: text('post_id').notNull(),
    imageKey: text('image_key').notNull().unique(),
    position: integer('position').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('post_images_post_position_idx').on(table.postId, table.position)],
)

export const pendingUploads = sqliteTable(
  'pending_uploads',
  {
    id: text('id').primaryKey(),
    imageKey: text('image_key').notNull().unique(),
    sessionHash: text('session_hash').notNull(),
    position: integer('position').notNull(),
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (table) => [
    uniqueIndex('pending_uploads_session_position_unique').on(table.sessionHash, table.position),
    index('pending_uploads_session_position_idx').on(table.sessionHash, table.position),
    index('pending_uploads_expires_idx').on(table.expiresAt),
  ],
)

export const clubAccounts = sqliteTable(
  'club_accounts',
  {
    slug: text('slug').primaryKey(),
    name: text('name').notNull(),
    status: text('status').notNull().default('active'),
    keyHash: text('key_hash'),
    keyIssuedAt: integer('key_issued_at'),
    approvedBy: text('approved_by'),
    lastVerifiedAt: integer('last_verified_at').notNull(),
    updatedAt: integer('updated_at').notNull().default(0),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    index('club_accounts_status_updated_idx').on(table.status, table.updatedAt),
  ],
)

export const clubSessions = sqliteTable(
  'club_sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    clubSlug: text('club_slug').notNull(),
    clubName: text('club_name').notNull(),
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
    revokedAt: integer('revoked_at'),
    revokedReason: text('revoked_reason'),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    index('club_sessions_expires_idx').on(table.expiresAt),
    index('club_sessions_club_expires_idx').on(table.clubSlug, table.expiresAt),
  ],
)

export const clubApplications = sqliteTable(
  'club_applications',
  {
    id: text('id').primaryKey(),
    clubName: text('club_name').notNull(),
    ukmEmail: text('ukm_email').notNull(),
    contact: text('contact').notNull(),
    note: text('note'),
    status: text('status').notNull().default('pending'),
    clubSlug: text('club_slug'),
    decisionNote: text('decision_note'),
    reviewedBy: text('reviewed_by'),
    reviewedAt: integer('reviewed_at'),
    version: integer('version').notNull().default(1),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('club_applications_status_idx').on(table.status, table.createdAt),
    index('club_applications_slug_idx').on(table.clubSlug),
  ],
)

export const presenceSessions = sqliteTable(
  'presence_sessions',
  {
    sessionHash: text('session_hash').primaryKey(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [index('presence_updated_idx').on(table.updatedAt)],
)

export const reports = sqliteTable(
  'reports',
  {
    id: text('id').primaryKey(),
    postId: text('post_id').notNull(),
    reason: text('reason').notNull(),
    status: text('status').notNull().default('pending'),
    resolution: text('resolution'),
    resolvedBy: text('resolved_by'),
    resolvedAt: integer('resolved_at'),
    version: integer('version').notNull().default(1),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('reports_status_idx').on(table.status, table.createdAt),
    index('reports_post_status_idx').on(table.postId, table.status),
  ],
)

export const adminUsers = sqliteTable(
  'admin_users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    role: text('role').notNull().default('owner'),
    status: text('status').notNull().default('active'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    index('admin_users_role_status_idx').on(table.role, table.status),
  ],
)

export const adminSessions = sqliteTable(
  'admin_sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    adminUserId: text('admin_user_id').notNull(),
    csrfHash: text('csrf_hash').notNull(),
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (table) => [
    index('admin_sessions_user_expires_idx').on(table.adminUserId, table.expiresAt),
    index('admin_sessions_expires_idx').on(table.expiresAt),
  ],
)

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    actorUserId: text('actor_user_id').notNull(),
    actorRole: text('actor_role').notNull(),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    metadataJson: text('metadata_json'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('audit_logs_created_idx').on(table.createdAt),
    index('audit_logs_target_idx').on(table.targetType, table.targetId, table.createdAt),
    index('audit_logs_actor_idx').on(table.actorUserId, table.createdAt),
  ],
)

export const rateLimits = sqliteTable(
  'rate_limits',
  {
    keyHash: text('key_hash').notNull(),
    action: text('action').notNull(),
    windowStart: integer('window_start').notNull(),
    count: integer('count').notNull().default(1),
    expiresAt: integer('expires_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.keyHash, table.action, table.windowStart] }),
    index('rate_limits_expires_idx').on(table.expiresAt),
    index('rate_limits_action_window_idx').on(table.action, table.windowStart),
  ],
)
