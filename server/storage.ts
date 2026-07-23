import { type Child, type InsertChild, type Activity, type InsertActivity, type FeedComment, type InsertFeedComment, type FeedLike, type AdminAccount, type Teacher, type InsertTeacher, type Account, type Invitation, type PasswordReset, children, activities, feedComments, feedLikes, adminAccount, teachers, accounts, invitations, passwordResets } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, isNull, isNotNull, lt, or } from "drizzle-orm";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const hashBuf = Buffer.from(hash, "hex");
  const derivedBuf = scryptSync(password, salt, 64);
  return timingSafeEqual(hashBuf, derivedBuf);
}

export interface IStorage {
  getAdminAccount(): Promise<AdminAccount | undefined>;
  createAdminAccount(data: {
    email: string; passwordHash: string; passwordHint: string;
    fullName: string; role: string; schoolName: string;
    schoolNumber: string; schoolAddress: string; logoPath: string; photo?: string;
  }): Promise<AdminAccount>;
  updateAdminAccount(data: Partial<{
    email: string; fullName: string; role: string;
    schoolNumber: string; schoolAddress: string; logoPath: string; photo: string;
  }>): Promise<AdminAccount | undefined>;
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
  getAccountByEmail(email: string): Promise<Account | undefined>;
  createAccount(data: { email: string; passwordHash: string; role: string }): Promise<Account>;
  createInvitation(data: { token: string; email: string; role: string; invitedByName: string; expiresAt: Date }): Promise<Invitation>;
  getInvitationByToken(token: string): Promise<Invitation | undefined>;
  getPendingInvitation(email: string, role: string): Promise<Invitation | undefined>;
  markInvitationAccepted(id: string): Promise<void>;
  getParentChildIds(email: string): Promise<string[]>;
  createPasswordReset(data: { token: string; email: string; expiresAt: Date }): Promise<PasswordReset>;
  getPasswordResetByToken(token: string): Promise<PasswordReset | undefined>;
  markPasswordResetUsed(id: string): Promise<void>;
  deleteExpiredInvitations(): Promise<void>;
  deleteExpiredPasswordResets(): Promise<void>;
  updateAccountPassword(email: string, passwordHash: string): Promise<void>;
  updateAdminPassword(email: string, passwordHash: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getAdminAccount(): Promise<AdminAccount | undefined> {
    const [result] = await db.select().from(adminAccount).limit(1);
    return result;
  }

  async createAdminAccount(data: {
    email: string; passwordHash: string; passwordHint: string;
    fullName: string; role: string; schoolName: string;
    schoolNumber: string; schoolAddress: string; logoPath: string; photo?: string;
  }): Promise<AdminAccount> {
    const [result] = await db.insert(adminAccount).values(data).returning();
    return result;
  }

  async updateAdminAccount(data: Partial<{
    email: string; fullName: string; role: string;
    schoolNumber: string; schoolAddress: string; logoPath: string; photo: string;
  }>): Promise<AdminAccount | undefined> {
    const existing = await this.getAdminAccount();
    if (!existing) return undefined;
    const [result] = await db.update(adminAccount).set(data).where(eq(adminAccount.id, existing.id)).returning();
    return result;
  }

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

  async getAccountByEmail(email: string): Promise<Account | undefined> {
    const [result] = await db.select().from(accounts).where(eq(accounts.email, email.trim().toLowerCase()));
    return result;
  }

  async createAccount(data: { email: string; passwordHash: string; role: string }): Promise<Account> {
    const [result] = await db
      .insert(accounts)
      .values({ ...data, email: data.email.trim().toLowerCase() })
      .returning();
    return result;
  }

  async createInvitation(data: { token: string; email: string; role: string; invitedByName: string; expiresAt: Date }): Promise<Invitation> {
    const [result] = await db
      .insert(invitations)
      .values({ ...data, email: data.email.trim().toLowerCase() })
      .returning();
    return result;
  }

  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    const [result] = await db.select().from(invitations).where(eq(invitations.token, token));
    return result;
  }

  async getPendingInvitation(email: string, role: string): Promise<Invitation | undefined> {
    const [result] = await db
      .select()
      .from(invitations)
      .where(and(eq(invitations.email, email.trim().toLowerCase()), eq(invitations.role, role), isNull(invitations.acceptedAt)));
    return result;
  }

  async markInvitationAccepted(id: string): Promise<void> {
    await db.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, id));
  }

  async createPasswordReset(data: { token: string; email: string; expiresAt: Date }): Promise<PasswordReset> {
    const [result] = await db
      .insert(passwordResets)
      .values({ ...data, email: data.email.trim().toLowerCase() })
      .returning();
    return result;
  }

  async getPasswordResetByToken(token: string): Promise<PasswordReset | undefined> {
    const [result] = await db.select().from(passwordResets).where(eq(passwordResets.token, token));
    return result;
  }

  async markPasswordResetUsed(id: string): Promise<void> {
    await db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, id));
  }

  async deleteExpiredInvitations(): Promise<void> {
    await db.delete(invitations).where(
      or(isNotNull(invitations.acceptedAt), lt(invitations.expiresAt, new Date()))
    );
  }

  async deleteExpiredPasswordResets(): Promise<void> {
    await db.delete(passwordResets).where(
      or(isNotNull(passwordResets.usedAt), lt(passwordResets.expiresAt, new Date()))
    );
  }

  async updateAccountPassword(email: string, passwordHash: string): Promise<void> {
    await db.update(accounts).set({ passwordHash }).where(eq(accounts.email, email.trim().toLowerCase()));
  }

  async updateAdminPassword(email: string, passwordHash: string): Promise<void> {
    await db.update(adminAccount).set({ passwordHash }).where(eq(adminAccount.email, email.trim().toLowerCase()));
  }

  async getParentChildIds(email: string): Promise<string[]> {
    const target = email.trim().toLowerCase();
    if (!target) return [];
    const all = await db.select().from(children);
    const ids: string[] = [];
    for (const c of all) {
      let gs: { email?: string }[] = [];
      try { gs = JSON.parse(c.guardians || "[]"); } catch { gs = []; }
      if (!Array.isArray(gs)) continue;
      if (gs.some((g) => (g.email || "").trim().toLowerCase() === target)) {
        ids.push(c.id);
      }
    }
    return ids;
  }
}

export const storage = new DatabaseStorage();
