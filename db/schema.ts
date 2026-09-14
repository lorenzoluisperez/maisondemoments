import { bigint, boolean, check, date, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const accountType = pgEnum("account_type", ["CUSTOMER", "STAFF"]);
export const staffRole = pgEnum("staff_role", ["DESIGNER", "ADMIN"]);
export const productionState = pgEnum("production_state", ["NEW", "COLLECTING", "READY", "IN_PRODUCTION", "DELIVERED", "CLOSED", "CANCELLED"]);
export const eventType = pgEnum("event_type", ["wedding", "birthday", "debut", "christening"]);
export const reviewState = pgEnum("review_state", ["EDITING", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED"]);
export const invitationAvailability = pgEnum("invitation_availability", ["UNPUBLISHED", "LIVE", "SUSPENDED", "EXPIRED", "REMOVED"]);
export const mediaState = pgEnum("media_state", ["QUARANTINED", "PROCESSING", "READY", "REJECTED", "DELETED"]);
export const mediaUsage = pgEnum("media_usage", ["CUSTOMER_IMAGE", "EXCLUSIVE_ARTWORK", "CATALOG_ARTWORK"]);
export const guestSlotType = pgEnum("guest_slot_type", ["ADULT", "CHILD"]);
export const rsvpStatus = pgEnum("rsvp_status", ["ATTENDING", "DECLINED"]);
export const backgroundJobState = pgEnum("background_job_state", ["PENDING", "RUNNING", "SUCCEEDED", "FAILED"]);

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  authUserId: uuid("auth_user_id").notNull().unique(),
  type: accountType("type").notNull(),
  displayName: text("display_name").notNull(),
  email: text("email").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const staffMemberships = pgTable("staff_memberships", {
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  role: staffRole("role").notNull(),
}, (table) => [primaryKey({ columns: [table.accountId, table.role] })]);

export const packages = pgTable("packages", {
  id: uuid("id").primaryKey().defaultRandom(), code: text("code").notNull().unique(), name: text("name").notNull(),
  termsSnapshot: jsonb("terms_snapshot").notNull(), active: boolean("active").notNull().default(true),
});

export const jobOrderCounters = pgTable("job_order_counters", {
  year: integer("year").primaryKey(), lastValue: integer("last_value").notNull().default(0),
});

export const jobOrders = pgTable("job_orders", {
  id: uuid("id").primaryKey().defaultRandom(), jobNumber: text("job_number").notNull().unique(),
  customerId: uuid("customer_id").notNull().references(() => accounts.id), assignedDesignerId: uuid("assigned_designer_id").references(() => accounts.id),
  packageId: uuid("package_id").notNull().references(() => packages.id), state: productionState("state").notNull().default("NEW"),
  packageTermsSnapshot: jsonb("package_terms_snapshot").notNull().default({}),
  currency: text("currency").notNull(), quotedAmountMinor: bigint("quoted_amount_minor", { mode: "number" }).notNull(),
  depositRequiredMinor: bigint("deposit_required_minor", { mode: "number" }).notNull(), dueDate: date("due_date"),
  collectionKey: text("collection_key").notNull().default("midnight-garden"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("job_orders_queue_idx").on(table.state, table.dueDate),
  index("job_orders_customer_idx").on(table.customerId),
  index("job_orders_designer_idx").on(table.assignedDesignerId),
  index("job_orders_package_idx").on(table.packageId),
  check("job_order_amounts_valid", sql`${table.quotedAmountMinor} >= 0 AND ${table.depositRequiredMinor} >= 0 AND ${table.depositRequiredMinor} <= ${table.quotedAmountMinor}`),
  check("job_order_currency_iso", sql`${table.currency} ~ '^[A-Z]{3}$'`),
  check("job_order_collection_supported", sql`${table.collectionKey} IN ('midnight-garden', 'luminous-parchment')`),
]);

export const eventBriefs = pgTable("event_briefs", {
  jobOrderId: uuid("job_order_id").primaryKey().references(() => jobOrders.id, { onDelete: "cascade" }),
  eventType: eventType("event_type").notNull(),
  document: jsonb("document").notNull(),
  revision: integer("revision").notNull().default(1),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check("event_brief_revision_positive", sql`${table.revision} > 0`),
]);

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(), jobOrderId: uuid("job_order_id").notNull().unique().references(() => jobOrders.id, { onDelete: "cascade" }),
  type: eventType("type").notNull(), timezone: text("timezone").notNull(), primaryLocalDate: date("primary_local_date").notNull(),
  rsvpDeadline: date("rsvp_deadline").notNull(), schemaVersion: integer("schema_version").notNull(), details: jsonb("details").notNull(),
  contentRevision: integer("content_revision").notNull().default(1),
}, (table) => [check("rsvp_deadline_before_event", sql`${table.rsvpDeadline} <= ${table.primaryLocalDate}`)]);

export const eventActivities = pgTable("event_activities", {
  id: uuid("id").primaryKey().defaultRandom(), eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), label: text("label").notNull(), startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }), venueName: text("venue_name").notNull(), address: text("address").notNull(),
  mapUrl: text("map_url").notNull(), displayOrder: integer("display_order").notNull(),
}, (table) => [uniqueIndex("event_activity_order_unique").on(table.eventId, table.displayOrder)]);

export const eventParticipants = pgTable("event_participants", {
  id: uuid("id").primaryKey().defaultRandom(), eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  groupKey: text("group_key").notNull(), roleLabel: text("role_label").notNull(), displayName: text("display_name").notNull(), displayOrder: integer("display_order").notNull(),
}, (table) => [index("event_participants_idx").on(table.eventId, table.groupKey, table.displayOrder)]);

export const eventContent = pgTable("event_content", {
  id: uuid("id").primaryKey().defaultRandom(), eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  moduleKey: text("module_key").notNull(), schemaVersion: integer("schema_version").notNull(), content: jsonb("content").notNull(),
}, (table) => [uniqueIndex("event_content_unique").on(table.eventId, table.moduleKey)]);

export const artworkCollections = pgTable("artwork_collections", {
  id: uuid("id").primaryKey().defaultRandom(), key: text("key").notNull().unique(), name: text("name").notNull(), active: boolean("active").notNull().default(true),
});

export const mediaObjects = pgTable("media_objects", {
  id: uuid("id").primaryKey().defaultRandom(), ownerAccountId: uuid("owner_account_id").references(() => accounts.id), jobOrderId: uuid("job_order_id").references(() => jobOrders.id),
  usage: mediaUsage("usage").notNull().default("CUSTOMER_IMAGE"), bucket: text("bucket").notNull(), storageKey: text("storage_key").notNull().unique(),
  quarantineStorageKey: text("quarantine_storage_key"),
  uploadIntentKey: uuid("upload_intent_key").unique(), originalFilename: text("original_filename").notNull(), claimedContentType: text("claimed_content_type"), detectedContentType: text("detected_content_type"),
  bytes: bigint("bytes", { mode: "number" }).notNull(), width: integer("width"), height: integer("height"), checksum: text("checksum"),
  state: mediaState("state").notNull().default("QUARANTINED"), failureCode: text("failure_code"), processingRecipeVersion: integer("processing_recipe_version"),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }), deletedAt: timestamp("deleted_at", { withTimezone: true }),
  storagePurgedAt: timestamp("storage_purged_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("media_objects_owner_idx").on(table.ownerAccountId),
  index("media_objects_order_idx").on(table.jobOrderId),
  index("media_objects_cleanup_idx").on(table.state, table.createdAt),
  check("media_bytes_nonnegative", sql`${table.bytes} >= 0`),
  check("media_dimensions_together", sql`(${table.width} IS NULL AND ${table.height} IS NULL) OR (${table.width} > 0 AND ${table.height} > 0)`),
  check("media_customer_ownership", sql`${table.usage} = 'CATALOG_ARTWORK' OR (${table.ownerAccountId} IS NOT NULL AND ${table.jobOrderId} IS NOT NULL)`),
]);

export const mediaVariants = pgTable("media_variants", {
  id: uuid("id").primaryKey().defaultRandom(), sourceMediaId: uuid("source_media_id").notNull().references(() => mediaObjects.id, { onDelete: "cascade" }),
  bucket: text("bucket").notNull(), storageKey: text("storage_key").notNull().unique(), contentType: text("content_type").notNull(), format: text("format").notNull(),
  width: integer("width").notNull(), height: integer("height").notNull(), bytes: bigint("bytes", { mode: "number" }).notNull(), checksum: text("checksum").notNull(),
  recipeVersion: integer("recipe_version").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("media_variants_source_idx").on(table.sourceMediaId),
  uniqueIndex("media_variant_recipe_unique").on(table.sourceMediaId, table.recipeVersion, table.width, table.format),
  check("media_variant_values_valid", sql`${table.width} > 0 AND ${table.height} > 0 AND ${table.bytes} > 0 AND ${table.recipeVersion} > 0`),
]);

export const artworkAssets = pgTable("artwork_assets", {
  id: uuid("id").primaryKey().defaultRandom(), collectionId: uuid("collection_id").notNull().references(() => artworkCollections.id),
  key: text("key").notNull(), originalMediaId: uuid("original_media_id").notNull().references(() => mediaObjects.id), metadata: jsonb("metadata").notNull(), reuseScope: text("reuse_scope").notNull(),
}, (table) => [
  uniqueIndex("artwork_asset_key_unique").on(table.collectionId, table.key),
  index("artwork_assets_original_media_idx").on(table.originalMediaId),
]);

export const themes = pgTable("themes", { id: uuid("id").primaryKey().defaultRandom(), key: text("key").notNull().unique(), name: text("name").notNull() });
export const themeVersions = pgTable("theme_versions", {
  id: uuid("id").primaryKey().defaultRandom(), themeId: uuid("theme_id").notNull().references(() => themes.id), version: text("version").notNull(),
  schemaCompatibility: integer("schema_compatibility").notNull(), definition: jsonb("definition").notNull(), releasedAt: timestamp("released_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("theme_version_unique").on(table.themeId, table.version)]);

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(), jobOrderId: uuid("job_order_id").notNull().unique().references(() => jobOrders.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(), liveVersionId: uuid("live_version_id"), availability: invitationAvailability("availability").notNull().default("UNPUBLISHED"),
  accessEpoch: integer("access_epoch").notNull().default(1), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("invitations_live_version_idx").on(table.liveVersionId)]);

export const invitationDrafts = pgTable("invitation_drafts", {
  invitationId: uuid("invitation_id").primaryKey().references(() => invitations.id, { onDelete: "cascade" }), themeVersionId: uuid("theme_version_id").notNull().references(() => themeVersions.id),
  configuration: jsonb("configuration").notNull(), revision: integer("revision").notNull().default(1), reviewState: reviewState("review_state").notNull().default("EDITING"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("invitation_drafts_theme_version_idx").on(table.themeVersionId)]);

export const invitationVersions = pgTable("invitation_versions", {
  id: uuid("id").primaryKey().defaultRandom(), invitationId: uuid("invitation_id").notNull().references(() => invitations.id, { onDelete: "cascade" }),
  version: integer("version").notNull(), sourceRevision: integer("source_revision").notNull(), snapshot: jsonb("snapshot").notNull(),
  contentHash: text("content_hash").notNull(), rendererVersion: text("renderer_version").notNull(), materialChanges: jsonb("material_changes").notNull().default([]),
  createdBy: uuid("created_by").notNull().references(() => accounts.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("invitation_version_unique").on(table.invitationId, table.version),
  index("invitation_versions_creator_idx").on(table.createdBy),
  check("invitation_version_values_valid", sql`${table.version} > 0 AND ${table.sourceRevision} > 0 AND ${table.contentHash} ~ '^[0-9a-f]{64}$'`),
]);

export const versionMediaRefs = pgTable("version_media_refs", {
  versionId: uuid("version_id").notNull().references(() => invitationVersions.id, { onDelete: "cascade" }), mediaId: uuid("media_id").notNull().references(() => mediaObjects.id),
}, (table) => [
  primaryKey({ columns: [table.versionId, table.mediaId] }),
  index("version_media_refs_media_idx").on(table.mediaId),
]);

export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey().defaultRandom(), versionId: uuid("version_id").notNull().unique().references(() => invitationVersions.id),
  customerId: uuid("customer_id").notNull().references(() => accounts.id), approvedAt: timestamp("approved_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("approvals_customer_idx").on(table.customerId)]);

export const reviewRequests = pgTable("review_requests", {
  id: uuid("id").primaryKey().defaultRandom(), versionId: uuid("version_id").notNull().references(() => invitationVersions.id),
  requestedBy: uuid("requested_by").notNull().references(() => accounts.id), summary: text("summary").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("review_requests_version_unique").on(table.versionId),
  index("review_requests_requester_idx").on(table.requestedBy),
]);

export const reviewItems = pgTable("review_items", {
  id: uuid("id").primaryKey().defaultRandom(), reviewRequestId: uuid("review_request_id").notNull().references(() => reviewRequests.id, { onDelete: "cascade" }),
  sectionKey: text("section_key").notNull(), message: text("message").notNull(), displayOrder: integer("display_order").notNull(),
}, (table) => [
  uniqueIndex("review_item_order_unique").on(table.reviewRequestId, table.displayOrder),
  check("review_item_values_valid", sql`${table.sectionKey} ~ '^[a-z][a-z0-9-]{0,79}$' AND char_length(${table.message}) BETWEEN 1 AND 1200 AND ${table.displayOrder} >= 0`),
]);

export const guestGroups = pgTable("guest_groups", {
  id: uuid("id").primaryKey().defaultRandom(), invitationId: uuid("invitation_id").notNull().references(() => invitations.id, { onDelete: "cascade" }),
  label: text("label").notNull(), active: boolean("active").notNull().default(true), revision: integer("revision").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("guest_groups_invitation_idx").on(table.invitationId),
  check("guest_group_values_valid", sql`char_length(btrim(${table.label})) BETWEEN 1 AND 160 AND ${table.revision} > 0`),
]);

export const guestSlots = pgTable("guest_slots", {
  id: uuid("id").primaryKey().defaultRandom(), groupId: uuid("group_id").notNull().references(() => guestGroups.id, { onDelete: "cascade" }),
  type: guestSlotType("type").notNull(), assignedName: text("assigned_name"), isAdditionalGuest: boolean("is_additional_guest").notNull().default(false), displayOrder: integer("display_order").notNull(),
}, (table) => [
  uniqueIndex("guest_slot_order_unique").on(table.groupId, table.displayOrder),
  check("guest_slot_values_valid", sql`${table.displayOrder} >= 0 AND (${table.assignedName} IS NULL OR char_length(btrim(${table.assignedName})) BETWEEN 1 AND 120)`),
]);

export const guestLinks = pgTable("guest_links", {
  id: uuid("id").primaryKey().defaultRandom(), groupId: uuid("group_id").notNull().references(() => guestGroups.id, { onDelete: "cascade" }),
  tokenDigest: text("token_digest").notNull().unique(), encryptedToken: text("encrypted_token").notNull(), generation: integer("generation").notNull().default(1),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("guest_links_group_idx").on(table.groupId),
  uniqueIndex("guest_links_active_group_unique").on(table.groupId).where(sql`${table.revokedAt} IS NULL`),
  check("guest_link_generation_positive", sql`${table.generation} > 0`),
]);

export const guestSessions = pgTable("guest_sessions", {
  id: uuid("id").primaryKey().defaultRandom(), groupId: uuid("group_id").notNull().references(() => guestGroups.id, { onDelete: "cascade" }),
  linkGeneration: integer("link_generation").notNull(), invitationAccessEpoch: integer("invitation_access_epoch").notNull(), sessionDigest: text("session_digest").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("guest_sessions_group_idx").on(table.groupId),
  check("guest_session_values_valid", sql`${table.linkGeneration} > 0 AND ${table.invitationAccessEpoch} > 0`),
]);

export const rsvps = pgTable("rsvps", {
  id: uuid("id").primaryKey().defaultRandom(), groupId: uuid("group_id").notNull().unique().references(() => guestGroups.id, { onDelete: "cascade" }),
  status: rsvpStatus("status").notNull(), revision: integer("revision").notNull().default(1), submittedInvitationVersion: integer("submitted_invitation_version").notNull(),
  note: text("note"), lastIdempotencyKey: uuid("last_idempotency_key").notNull().unique(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [check("rsvp_values_valid", sql`${table.revision} > 0 AND ${table.submittedInvitationVersion} > 0 AND (${table.note} IS NULL OR char_length(${table.note}) <= 500)`)]);

export const rsvpAttendees = pgTable("rsvp_attendees", {
  rsvpId: uuid("rsvp_id").notNull().references(() => rsvps.id, { onDelete: "cascade" }), slotId: uuid("slot_id").notNull().references(() => guestSlots.id), displayName: text("display_name"),
}, (table) => [
  primaryKey({ columns: [table.rsvpId, table.slotId] }),
  uniqueIndex("rsvp_attendees_slot_unique").on(table.slotId),
  check("rsvp_attendee_name_valid", sql`${table.displayName} IS NULL OR char_length(btrim(${table.displayName})) BETWEEN 1 AND 120`),
]);

export const guestRateLimits = pgTable("guest_rate_limits", {
  keyDigest: text("key_digest").notNull(), action: text("action").notNull(), windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(), attempts: integer("attempts").notNull().default(1),
}, (table) => [
  primaryKey({ columns: [table.keyDigest, table.action, table.windowStartedAt] }),
  index("guest_rate_limits_cleanup_idx").on(table.windowStartedAt),
  check("guest_rate_limit_values_valid", sql`${table.attempts} > 0 AND char_length(${table.action}) BETWEEN 1 AND 40`),
]);

export const paymentEntries = pgTable("payment_entries", {
  id: uuid("id").primaryKey().defaultRandom(), jobOrderId: uuid("job_order_id").notNull().references(() => jobOrders.id),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(), currency: text("currency").notNull(), method: text("method").notNull(),
  externalReference: text("external_reference"), confirmedBy: uuid("confirmed_by").notNull().references(() => accounts.id), reversalOfId: uuid("reversal_of_id"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("payment_entries_order_idx").on(table.jobOrderId),
  index("payment_entries_confirmer_idx").on(table.confirmedBy),
  index("payment_entries_reversal_idx").on(table.reversalOfId),
  check("payment_nonzero", sql`${table.amountMinor} <> 0`),
]);

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(), actorAccountId: uuid("actor_account_id").references(() => accounts.id), action: text("action").notNull(),
  entityType: text("entity_type").notNull(), entityId: uuid("entity_id").notNull(), metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("audit_entity_idx").on(table.entityType, table.entityId, table.createdAt),
  index("audit_actor_idx").on(table.actorAccountId),
]);

export const backgroundJobs = pgTable("background_jobs", {
  id: uuid("id").primaryKey().defaultRandom(), kind: text("kind").notNull(), payload: jsonb("payload").notNull(), idempotencyKey: text("idempotency_key").notNull().unique(),
  state: backgroundJobState("state").notNull().default("PENDING"), attempts: integer("attempts").notNull().default(0), availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
  leasedUntil: timestamp("leased_until", { withTimezone: true }), lastErrorCode: text("last_error_code"), completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [index("background_jobs_claim_idx").on(table.state, table.availableAt, table.leasedUntil)]);
