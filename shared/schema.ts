import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const children = pgTable("children", {
  id: varchar("id", { length: 64 }).primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  photo: text("photo").notNull(),
  birthday: text("birthday").notNull().default(""),
  guardians: text("guardians").notNull().default("[]"),
  enrollmentDate: text("enrollment_date").notNull().default(""),
  graduationDate: text("graduation_date").notNull().default(""),
  address: text("address").notNull().default(""),
  allergies: text("allergies").notNull().default(""),
  medications: text("medications").notNull().default(""),
  doctor: text("doctor").notNull().default(""),
  doctorPhone: text("doctor_phone").notNull().default(""),
  note: text("note").notNull().default(""),
});

export const insertChildSchema = createInsertSchema(children).omit({});

export type InsertChild = z.infer<typeof insertChildSchema>;
export type Child = typeof children.$inferSelect;

export const activities = pgTable("activities", {
  id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()`),
  childId: varchar("child_id", { length: 64 }).notNull(),
  text: text("text").notNull(),
  time: text("time").notNull(),
  note: text("note").notNull().default(""),
  photo: text("photo").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });

export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;

export const feedComments = pgTable("feed_comments", {
  id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()`),
  activityId: varchar("activity_id", { length: 64 }).notNull(),
  text: text("text").notNull(),
  time: text("time").notNull(),
  role: text("role").notNull().default("parent"),
  accountId: text("account_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFeedCommentSchema = createInsertSchema(feedComments).omit({ id: true, createdAt: true });
export type InsertFeedComment = z.infer<typeof insertFeedCommentSchema>;
export type FeedComment = typeof feedComments.$inferSelect;

export const feedLikes = pgTable("feed_likes", {
  id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()`),
  activityId: varchar("activity_id", { length: 64 }).notNull(),
  role: text("role").notNull().default("parent"),
  accountId: text("account_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFeedLikeSchema = createInsertSchema(feedLikes).omit({ id: true, createdAt: true });
export type InsertFeedLike = z.infer<typeof insertFeedLikeSchema>;
export type FeedLike = typeof feedLikes.$inferSelect;

export const teachers = pgTable("teachers", {
  id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull().default(""),
  photo: text("photo").notNull().default(""),
  relation: text("relation").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  address: text("address").notNull().default(""),
});

export const insertTeacherSchema = createInsertSchema(teachers).omit({ id: true }).extend({
  firstName: z.string().min(1),
});
export type InsertTeacher = z.infer<typeof insertTeacherSchema>;
export type Teacher = typeof teachers.$inferSelect;

export const adminAccount = pgTable("admin_account", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  passwordHint: text("password_hint").notNull().default(""),
  fullName: text("full_name").notNull().default(""),
  role: text("role").notNull().default(""),
  schoolName: text("school_name").notNull().default(""),
  schoolNumber: text("school_number").notNull().default(""),
  schoolAddress: text("school_address").notNull().default(""),
  logoPath: text("logo_path").notNull().default(""),
  photo: text("photo").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AdminAccount = typeof adminAccount.$inferSelect;

// Login credentials for non-admin roles (teachers and parents/guardians).
// Admins continue to use the admin_account table.
export const accounts = pgTable("accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(), // "teacher" | "parent"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true, createdAt: true });
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accounts.$inferSelect;

// Single-use, expiring invitation tokens tied to an email + role.
// Parents' accessible children are derived from guardian-email matching,
// so no child IDs are stored here.
export const invitations = pgTable("invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: text("token").notNull().unique(),
  email: text("email").notNull(),
  role: text("role").notNull(), // "teacher" | "parent"
  invitedByName: text("invited_by_name").notNull().default(""),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertInvitationSchema = createInsertSchema(invitations).omit({ id: true, createdAt: true });
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type Invitation = typeof invitations.$inferSelect;

export const passwordResets = pgTable("password_resets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: text("token").notNull().unique(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PasswordReset = typeof passwordResets.$inferSelect;
