import { sql } from "drizzle-orm";
import {
  boolean,
  datetime,
  foreignKey,
  index,
  int,
  json,
  mediumtext,
  mysqlEnum,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const applicationStatusValues = [
  "pending",
  "approved",
  "rejected",
  "printed",
  "claimed",
] as const;

export const notificationTypeValues = [
  "rejection_notice",
  "ready_for_claiming",
] as const;

export const notificationStatusValues = ["pending", "sent", "failed"] as const;

export const adminUsers = mysqlTable(
  "admin_users",
  {
    id: int("id").autoincrement().primaryKey(),
    username: varchar("username", { length: 64 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: varchar("full_name", { length: 150 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: datetime("last_login_at", { mode: "date", fsp: 3 }),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 }).default(sql`(now())`).notNull(),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).default(sql`(now())`).notNull(),
  },
  (t) => [
    uniqueIndex("admin_users_username_uq").on(t.username),
    uniqueIndex("admin_users_email_uq").on(t.email),
  ],
);

export type AdminTemplateConfig = {
  schoolYear: string;
  orientation: "landscape" | "portrait";
  showBloodType: boolean;
  showTrackStrand: boolean;
  showEmergencyContact: boolean;
  signatoryName: string;
  signatoryTitle: string;
  designSettings: CardDesignSettings;
};

export type CardDesignSettings = {
  signatorySignature: string | null;
  signatoryScale: number;
  signatoryOffsetX: number;
  signatoryOffsetY: number;
  nameFontSize: number;
  detailFontScale: number;
  nameOffsetX: number;
  nameOffsetY: number;
  photoScale: number;
  photoOffsetX: number;
  photoOffsetY: number;
};

export const applicationAccessTokens = mysqlTable(
  "application_access_tokens",
  {
    id: int("id").autoincrement().primaryKey(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    tokenCiphertext: varchar("token_ciphertext", { length: 512 }),
    label: varchar("label", { length: 120 }).notNull(),
    createdByAdminId: int("created_by_admin_id"),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 }).default(sql`(now())`).notNull(),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }),
    revokedAt: datetime("revoked_at", { mode: "date", fsp: 3 }),
    lastUsedAt: datetime("last_used_at", { mode: "date", fsp: 3 }),
    useCount: int("use_count").notNull().default(0),
  },
  (t) => [
    uniqueIndex("application_access_tokens_hash_uq").on(t.tokenHash),
    index("application_access_tokens_created_idx").on(t.createdAt),
    foreignKey({
      name: "access_tokens_admin_fk",
      columns: [t.createdByAdminId],
      foreignColumns: [adminUsers.id],
    }).onDelete("set null"),
  ],
);

export const studentApplications = mysqlTable(
  "student_applications",
  {
    id: int("id").autoincrement().primaryKey(),
    applicationCode: varchar("application_code", { length: 32 }).notNull(),
    studentIdNumber: varchar("student_id_number", { length: 64 }).notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    middleName: varchar("middle_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    suffix: varchar("suffix", { length: 20 }),
    address: text("address").notNull(),
    gradeLevel: varchar("grade_level", { length: 40 }).notNull(),
    trackStrand: varchar("track_strand", { length: 120 }),
    email: varchar("email", { length: 255 }),
    contactNumber: varchar("contact_number", { length: 32 }),
    emergencyContactName: varchar("emergency_contact_name", { length: 150 }).notNull(),
    emergencyContactPhone: varchar("emergency_contact_phone", { length: 32 }).notNull(),
    bloodType: varchar("blood_type", { length: 8 }),
    photoStorageKey: varchar("photo_storage_key", { length: 128 }),
    status: mysqlEnum("status", applicationStatusValues).notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    accessTokenId: int("access_token_id"),
    reviewedByAdminId: int("reviewed_by_admin_id"),
    claimedByAdminId: int("claimed_by_admin_id"),
    reviewedAt: datetime("reviewed_at", { mode: "date", fsp: 3 }),
    approvedAt: datetime("approved_at", { mode: "date", fsp: 3 }),
    printedAt: datetime("printed_at", { mode: "date", fsp: 3 }),
    claimedAt: datetime("claimed_at", { mode: "date", fsp: 3 }),
    deletedAt: datetime("deleted_at", { mode: "date", fsp: 3 }),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 }).default(sql`(now())`).notNull(),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).default(sql`(now())`).notNull(),
    activeStudentIdNumber: varchar("active_student_id_number", { length: 64 }).generatedAlwaysAs(
      sql`CASE WHEN deleted_at IS NULL THEN student_id_number ELSE NULL END`,
      { mode: "virtual" },
    ),
    activeEmail: varchar("active_email", { length: 255 }).generatedAlwaysAs(
      sql`CASE WHEN deleted_at IS NULL THEN email ELSE NULL END`,
      { mode: "virtual" },
    ),
  },
  (t) => [
    uniqueIndex("student_applications_code_uq").on(t.applicationCode),
    uniqueIndex("student_applications_student_no_uq").on(t.activeStudentIdNumber),
    uniqueIndex("student_applications_email_uq").on(t.activeEmail),
    index("student_applications_status_idx").on(t.status),
    index("student_applications_created_idx").on(t.createdAt),
    index("student_applications_name_idx").on(t.lastName, t.firstName),
    foreignKey({
      name: "student_apps_access_token_fk",
      columns: [t.accessTokenId],
      foreignColumns: [applicationAccessTokens.id],
    }).onDelete("set null"),
    foreignKey({
      name: "student_apps_reviewed_admin_fk",
      columns: [t.reviewedByAdminId],
      foreignColumns: [adminUsers.id],
    }).onDelete("set null"),
    foreignKey({
      name: "student_apps_claimed_admin_fk",
      columns: [t.claimedByAdminId],
      foreignColumns: [adminUsers.id],
    }).onDelete("set null"),
  ],
);

export const idTemplateConfig = mysqlTable("id_template_config", {
  id: int("id").autoincrement().primaryKey(),
  version: int("version").notNull().default(1),
  schoolYear: varchar("school_year", { length: 20 }).notNull(),
  orientation: mysqlEnum("orientation", ["landscape", "portrait"]).notNull().default("landscape"),
  showBloodType: boolean("show_blood_type").notNull().default(true),
  showTrackStrand: boolean("show_track_strand").notNull().default(true),
  showEmergencyContact: boolean("show_emergency_contact").notNull().default(true),
  signatoryName: varchar("signatory_name", { length: 150 }).notNull().default(""),
  signatoryTitle: varchar("signatory_title", { length: 150 }).notNull().default(""),
  designSettings: json("design_settings").$type<CardDesignSettings>(),
  updatedByAdminId: int("updated_by_admin_id"),
  createdAt: datetime("created_at", { mode: "date", fsp: 3 }).default(sql`(now())`).notNull(),
  updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).default(sql`(now())`).notNull(),
}, (t) => [
  foreignKey({
  name: "template_updated_admin_fk",
  columns: [t.updatedByAdminId],
  foreignColumns: [adminUsers.id],
  }).onDelete("set null"),
]);

export const printBatches = mysqlTable(
  "print_batches",
  {
    id: int("id").autoincrement().primaryKey(),
    batchCode: varchar("batch_code", { length: 32 }).notNull(),
    createdByAdminId: int("created_by_admin_id"),
    templateVersion: int("template_version").notNull(),
    templateSnapshot: json("template_snapshot").$type<AdminTemplateConfig>().notNull(),
    cardCount: int("card_count").notNull().default(0),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 }).default(sql`(now())`).notNull(),
    printedAt: datetime("printed_at", { mode: "date", fsp: 3 }),
  },
  (t) => [
    uniqueIndex("print_batches_code_uq").on(t.batchCode),
    foreignKey({
      name: "print_batches_admin_fk",
      columns: [t.createdByAdminId],
      foreignColumns: [adminUsers.id],
    }).onDelete("set null"),
  ],
);

export const printBatchItems = mysqlTable(
  "print_batch_items",
  {
    id: int("id").autoincrement().primaryKey(),
    batchId: int("batch_id").notNull(),
    applicationId: int("application_id").notNull(),
    templateVersion: int("template_version").notNull(),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 }).default(sql`(now())`).notNull(),
  },
  (t) => [
    uniqueIndex("print_batch_items_application_uq").on(t.applicationId),
    index("print_batch_items_batch_idx").on(t.batchId),
    foreignKey({
      name: "batch_items_batch_fk",
      columns: [t.batchId],
      foreignColumns: [printBatches.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "batch_items_application_fk",
      columns: [t.applicationId],
      foreignColumns: [studentApplications.id],
    }),
  ],
);

export const notificationLogs = mysqlTable(
  "notification_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    applicationId: int("application_id"),
    recipientEmail: varchar("recipient_email", { length: 255 }).notNull().default(""),
    notificationType: mysqlEnum("notification_type", notificationTypeValues).notNull(),
    sentStatus: mysqlEnum("sent_status", notificationStatusValues).notNull().default("pending"),
    error: text("error"),
    attempts: int("attempts").notNull().default(0),
    sentAt: datetime("sent_at", { mode: "date", fsp: 3 }),
    acknowledgementTokenHash: varchar("acknowledgement_token_hash", { length: 64 }),
    acknowledgedAt: datetime("acknowledged_at", { mode: "date", fsp: 3 }),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 }).default(sql`(now())`).notNull(),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).default(sql`(now())`).notNull(),
  },
  (t) => [
    index("notification_logs_application_idx").on(t.applicationId),
    index("notification_logs_status_idx").on(t.sentStatus),
    index("notification_logs_created_idx").on(t.createdAt),
    uniqueIndex("notification_logs_ack_token_uq").on(t.acknowledgementTokenHash),
    foreignKey({
      name: "notifications_application_fk",
      columns: [t.applicationId],
      foreignColumns: [studentApplications.id],
    }).onDelete("set null"),
  ],
);

export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    adminUserId: int("admin_user_id"),
    action: varchar("action", { length: 80 }).notNull(),
    entityType: varchar("entity_type", { length: 60 }),
    entityId: varchar("entity_id", { length: 80 }),
    metadataJson: json("metadata_json").$type<Record<string, unknown>>(),
    ipHash: varchar("ip_hash", { length: 64 }),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 }).default(sql`(now())`).notNull(),
  },
  (t) => [
    index("audit_logs_created_idx").on(t.createdAt),
    index("audit_logs_action_idx").on(t.action),
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    foreignKey({
      name: "audit_admin_fk",
      columns: [t.adminUserId],
      foreignColumns: [adminUsers.id],
    }).onDelete("set null"),
  ],
);

export const rateLimits = mysqlTable("rate_limits", {
  key: varchar("key", { length: 191 }).primaryKey(),
  count: int("count").notNull().default(0),
  windowStart: datetime("window_start", { mode: "date", fsp: 3 }).notNull(),
});

export const adminSessions = mysqlTable(
  "admin_sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    adminUserId: int("admin_user_id").notNull(),
    csrfToken: varchar("csrf_token", { length: 96 }).notNull(),
    ipHash: varchar("ip_hash", { length: 64 }),
    userAgent: varchar("user_agent", { length: 300 }),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 }).default(sql`(now())`).notNull(),
    lastSeenAt: datetime("last_seen_at", { mode: "date", fsp: 3 }).default(sql`(now())`).notNull(),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
  },
  (t) => [
    uniqueIndex("admin_sessions_token_uq").on(t.tokenHash),
    index("admin_sessions_expires_idx").on(t.expiresAt),
    foreignKey({
      name: "admin_sessions_user_fk",
      columns: [t.adminUserId],
      foreignColumns: [adminUsers.id],
    }).onDelete("cascade"),
  ],
);

export const adminProfiles = mysqlTable(
  "admin_profiles",
  {
    adminUserId: int("admin_user_id").primaryKey(),
    avatarDataUrl: mediumtext("avatar_data_url"),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).default(sql`(now())`).notNull(),
  },
  (t) => [
    foreignKey({
      name: "admin_profiles_user_fk",
      columns: [t.adminUserId],
      foreignColumns: [adminUsers.id],
    }).onDelete("cascade"),
  ],
);

export const formSessions = mysqlTable(
  "form_sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    accessTokenId: int("access_token_id").notNull(),
    csrfToken: varchar("csrf_token", { length: 96 }).notNull(),
    ipHash: varchar("ip_hash", { length: 64 }),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 }).default(sql`(now())`).notNull(),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
  },
  (t) => [
    uniqueIndex("form_sessions_token_uq").on(t.tokenHash),
    index("form_sessions_expires_idx").on(t.expiresAt),
    foreignKey({
      name: "form_sessions_token_fk",
      columns: [t.accessTokenId],
      foreignColumns: [applicationAccessTokens.id],
    }).onDelete("cascade"),
  ],
);

export type ApplicationStatus = (typeof applicationStatusValues)[number];
export type NotificationType = (typeof notificationTypeValues)[number];
export type NotificationStatus = (typeof notificationStatusValues)[number];
export type StudentApplication = typeof studentApplications.$inferSelect;
export type AdminUser = typeof adminUsers.$inferSelect;
