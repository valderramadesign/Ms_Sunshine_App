import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";
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

// role/accountId identify an anonymous per-device visitor (see
// client/src/lib/deviceId.ts) for "mine" like-state and comment-authorship
// display only — there is no login, so these never gate access.
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
