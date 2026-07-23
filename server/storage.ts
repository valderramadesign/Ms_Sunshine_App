import { type Child, type InsertChild, type Activity, type InsertActivity, type FeedComment, type InsertFeedComment, type FeedLike, type Teacher, type InsertTeacher, children, activities, feedComments, feedLikes, teachers } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  getAllChildren(): Promise<Child[]>;
  getChild(id: string): Promise<Child | undefined>;
  upsertChild(child: InsertChild): Promise<Child>;
  deleteChild(id: string): Promise<void>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  getActivity(id: string): Promise<Activity | undefined>;
  getActivitiesByChild(childId: string): Promise<Activity[]>;
  deleteActivity(id: string): Promise<void>;
  updateActivityText(id: string, text: string): Promise<Activity>;
  updateActivityNote(id: string, note: string): Promise<Activity>;
  updateActivityPhoto(id: string, photo: string): Promise<Activity>;
  updateActivityTime(id: string, time: string): Promise<Activity>;
  getCommentsByActivity(activityId: string): Promise<FeedComment[]>;
  getComment(id: string): Promise<FeedComment | undefined>;
  createComment(comment: InsertFeedComment): Promise<FeedComment>;
  updateComment(id: string, text: string): Promise<FeedComment>;
  deleteComment(id: string): Promise<void>;
  getLikesByActivity(activityId: string): Promise<FeedLike[]>;
  toggleLike(activityId: string, role: string, accountId: string): Promise<boolean>;
  getAllTeachers(): Promise<Teacher[]>;
  getTeacher(id: string): Promise<Teacher | undefined>;
  createTeacher(teacher: InsertTeacher): Promise<Teacher>;
  updateTeacher(id: string, data: InsertTeacher): Promise<Teacher>;
  deleteTeacher(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getAllChildren(): Promise<Child[]> {
    return await db.select().from(children);
  }

  async getChild(id: string): Promise<Child | undefined> {
    const [child] = await db.select().from(children).where(eq(children.id, id));
    return child;
  }

  async upsertChild(child: InsertChild): Promise<Child> {
    const [result] = await db
      .insert(children)
      .values(child)
      .onConflictDoUpdate({
        target: children.id,
        set: {
          firstName: child.firstName,
          lastName: child.lastName,
          photo: child.photo,
          birthday: child.birthday,
          guardians: child.guardians,
          enrollmentDate: child.enrollmentDate,
          graduationDate: child.graduationDate,
          address: child.address,
          allergies: child.allergies,
          medications: child.medications,
          doctor: child.doctor,
          doctorPhone: child.doctorPhone,
          note: child.note,
        },
      })
      .returning();
    return result;
  }

  async deleteChild(id: string): Promise<void> {
    const guardianKey = (g: { name?: string; email?: string }) =>
      `${(g.name || "").trim().toLowerCase()}|${(g.email || "").trim().toLowerCase()}`;

    const child = await this.getChild(id);
    const removedKeys = new Set<string>();
    if (child) {
      try {
        const gs = JSON.parse(child.guardians || "[]");
        if (Array.isArray(gs)) for (const g of gs) removedKeys.add(guardianKey(g));
      } catch { /* ignore malformed guardians */ }
    }

    const childActivities = await db.select().from(activities).where(eq(activities.childId, id));
    for (const activity of childActivities) {
      await db.delete(feedComments).where(eq(feedComments.activityId, activity.id));
      await db.delete(feedLikes).where(eq(feedLikes.activityId, activity.id));
    }
    await db.delete(activities).where(eq(activities.childId, id));
    await db.delete(children).where(eq(children.id, id));

    if (removedKeys.size > 0) {
      const others = await db.select().from(children);
      for (const c of others) {
        let gs: { name?: string; email?: string }[] = [];
        try { gs = JSON.parse(c.guardians || "[]"); } catch { gs = []; }
        if (!Array.isArray(gs) || gs.length === 0) continue;
        const next = gs.filter((g) => !removedKeys.has(guardianKey(g)));
        if (next.length !== gs.length) {
          await db.update(children).set({ guardians: JSON.stringify(next) }).where(eq(children.id, c.id));
        }
      }
    }
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [result] = await db.insert(activities).values(activity).returning();
    return result;
  }

  async getActivity(id: string): Promise<Activity | undefined> {
    const [result] = await db.select().from(activities).where(eq(activities.id, id));
    return result;
  }

  async getActivitiesByChild(childId: string): Promise<Activity[]> {
    return await db.select().from(activities).where(eq(activities.childId, childId)).orderBy(desc(activities.createdAt));
  }

  async deleteActivity(id: string): Promise<void> {
    await db.delete(feedComments).where(eq(feedComments.activityId, id));
    await db.delete(feedLikes).where(eq(feedLikes.activityId, id));
    await db.delete(activities).where(eq(activities.id, id));
  }

  async updateActivityText(id: string, text: string): Promise<Activity> {
    const [result] = await db
      .update(activities)
      .set({ text })
      .where(eq(activities.id, id))
      .returning();
    return result;
  }

  async updateActivityNote(id: string, note: string): Promise<Activity> {
    const [result] = await db
      .update(activities)
      .set({ note })
      .where(eq(activities.id, id))
      .returning();
    return result;
  }

  async updateActivityPhoto(id: string, photo: string): Promise<Activity> {
    const [result] = await db
      .update(activities)
      .set({ photo })
      .where(eq(activities.id, id))
      .returning();
    return result;
  }

  async updateActivityTime(id: string, time: string): Promise<Activity> {
    const [result] = await db
      .update(activities)
      .set({ time })
      .where(eq(activities.id, id))
      .returning();
    return result;
  }

  async getCommentsByActivity(activityId: string): Promise<FeedComment[]> {
    return await db.select().from(feedComments).where(eq(feedComments.activityId, activityId)).orderBy(feedComments.createdAt);
  }

  async getComment(id: string): Promise<FeedComment | undefined> {
    const [result] = await db.select().from(feedComments).where(eq(feedComments.id, id));
    return result;
  }

  async createComment(comment: InsertFeedComment): Promise<FeedComment> {
    const [result] = await db.insert(feedComments).values(comment).returning();
    return result;
  }

  async updateComment(id: string, text: string): Promise<FeedComment> {
    const [result] = await db.update(feedComments).set({ text }).where(eq(feedComments.id, id)).returning();
    return result;
  }

  async deleteComment(id: string): Promise<void> {
    await db.delete(feedComments).where(eq(feedComments.id, id));
  }

  async getLikesByActivity(activityId: string): Promise<FeedLike[]> {
    return await db.select().from(feedLikes).where(eq(feedLikes.activityId, activityId));
  }

  async toggleLike(activityId: string, role: string, accountId: string): Promise<boolean> {
    const existing = await db.select().from(feedLikes).where(
      and(eq(feedLikes.activityId, activityId), eq(feedLikes.accountId, accountId))
    );
    if (existing.length > 0) {
      await db.delete(feedLikes).where(
        and(eq(feedLikes.activityId, activityId), eq(feedLikes.accountId, accountId))
      );
      return false;
    } else {
      await db.insert(feedLikes).values({ activityId, role, accountId }).returning();
      return true;
    }
  }

  async getAllTeachers(): Promise<Teacher[]> {
    return await db.select().from(teachers);
  }

  async getTeacher(id: string): Promise<Teacher | undefined> {
    const [result] = await db.select().from(teachers).where(eq(teachers.id, id));
    return result;
  }

  async createTeacher(teacher: InsertTeacher): Promise<Teacher> {
    const [result] = await db.insert(teachers).values(teacher).returning();
    return result;
  }

  async deleteTeacher(id: string): Promise<void> {
    await db.delete(teachers).where(eq(teachers.id, id));
  }

  async updateTeacher(id: string, data: InsertTeacher): Promise<Teacher> {
    const [result] = await db.update(teachers).set(data).where(eq(teachers.id, id)).returning();
    return result;
  }
}

export const storage = new DatabaseStorage();
