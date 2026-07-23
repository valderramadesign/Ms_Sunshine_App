import type { Express, Request, Response, NextFunction } from "express";
import { storage, hashPassword, verifyPassword } from "./storage";
import { insertTeacherSchema } from "@shared/schema";
import { z } from "zod";
import sharp from "sharp";
import { randomBytes, timingSafeEqual } from "crypto";
import { sendInvitationEmail, sendPasswordResetEmail } from "./email";

type Role = "admin" | "teacher" | "parent";

// --- Simple in-memory rate limiter for expensive AI endpoints ---
const AI_RATE_WINDOW_MS = 60_000;
const AI_RATE_MAX = 10;
const aiRateBuckets = new Map<string, { count: number; windowStart: number }>();

// Evict expired buckets every 5 minutes to prevent unbounded Map growth.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of Array.from(aiRateBuckets)) {
    if (now - bucket.windowStart >= AI_RATE_WINDOW_MS) {
      aiRateBuckets.delete(key);
    }
  }
}, 5 * 60_000).unref();

// req.ip is the proxy-aware client address set by Express (trust proxy: 1).
function getClientIp(req: Request): string {
  return req.ip ?? "unknown";
}

function checkAiRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = aiRateBuckets.get(ip);
  if (!bucket || now - bucket.windowStart >= AI_RATE_WINDOW_MS) {
    aiRateBuckets.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (bucket.count >= AI_RATE_MAX) return false;
  bucket.count++;
  return true;
}

// --- Global concurrency cap for expensive AI endpoints ---
const AI_MAX_INFLIGHT = 5;
let aiInflight = 0;

// --- Per-IP rate limiter for authentication endpoints ---
// Allows at most LOGIN_RATE_MAX attempts per LOGIN_RATE_WINDOW_MS per client IP.
// Reuses the same sliding-window bucket pattern as the AI rate limiter above.
const LOGIN_RATE_WINDOW_MS = 15 * 60_000; // 15-minute window
const LOGIN_RATE_MAX = 20;                 // max attempts per window
const loginRateBuckets = new Map<string, { count: number; windowStart: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of Array.from(loginRateBuckets)) {
    if (now - bucket.windowStart >= LOGIN_RATE_WINDOW_MS) {
      loginRateBuckets.delete(key);
    }
  }
}, 5 * 60_000).unref();

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = loginRateBuckets.get(ip);
  if (!bucket || now - bucket.windowStart >= LOGIN_RATE_WINDOW_MS) {
    loginRateBuckets.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (bucket.count >= LOGIN_RATE_MAX) return false;
  bucket.count++;
  return true;
}

declare module "express-session" {
  interface SessionData {
    authenticated?: boolean;
    role?: Role;
    email?: string;
    accountId?: string;
    parentChildIds?: string[];
  }
}

// Any authenticated user (admin, teacher, or parent).
function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.authenticated) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

// Restrict a route to a set of roles. Always enforced server-side; the client
// role selection is never trusted.
function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session?.authenticated || !req.session.role) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!roles.includes(req.session.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

// Admin/owner + teacher (staff). Used for the activity-authoring surfaces.
const requireStaff = requireRole("admin", "teacher");
const requireAdmin = requireRole("admin");

function isParentSession(req: Request): boolean {
  return req.session?.role === "parent";
}

// Comment/like authorship role is derived from the session, never the request
// body. Admins act as staff ("teacher") for feed authorship.
function feedRole(req: Request): "teacher" | "parent" {
  return req.session?.role === "parent" ? "parent" : "teacher";
}

// Returns a stable per-account actor identifier for feed ownership checks.
// Regular teacher/parent accounts have a UUID accountId set at login.
// Admins use a deterministic string derived from their email so that their
// comments and likes survive server restarts without a dedicated accounts row.
function feedActorId(req: Request): string {
  if (req.session?.accountId) return req.session.accountId;
  return `admin:${(req.session?.email || "unknown").trim().toLowerCase()}`;
}

async function parentCanAccessChild(req: Request, childId: string): Promise<boolean> {
  const ids = await storage.getParentChildIds(req.session?.email || "");
  return ids.includes(childId);
}

async function parentCanAccessActivity(req: Request, activityId: string): Promise<boolean> {
  const activity = await storage.getActivity(activityId);
  if (!activity) return false;
  return parentCanAccessChild(req, activity.childId);
}

// Who may edit/delete a comment:
// - Admins may modify any comment.
// - Teachers and parents may only modify comments they themselves authored
//   (accountId match). Role-level access ("any teacher can edit any teacher
//   comment") is intentionally removed to prevent cross-account tampering.
// - Parents additionally require current active access to the child's activity
//   so that a revoked parent cannot alter records they can no longer reach.
async function canModifyComment(req: Request, comment: { activityId: string; role: string; accountId?: string | null }): Promise<boolean> {
  const role = req.session?.role;
  if (role === "admin") return true;
  // All non-admin users must be the exact author of the comment.
  const actor = feedActorId(req);
  if (!comment.accountId || comment.accountId !== actor) return false;
  // Parents must also still have active access to the activity's child.
  if (role === "parent") {
    return parentCanAccessActivity(req, comment.activityId);
  }
  return true;
}

// Returns the canonical application base URL used to construct security-sensitive
// email links (password-reset, invitations).
//
// In production the only acceptable source is the APP_BASE_URL environment
// variable. Request headers (Host, X-Forwarded-Proto) are attacker-controlled
// and must never be used in production to build these URLs; doing so enables
// host-header poisoning attacks that exfiltrate reset/invite tokens to an
// attacker-controlled origin.
//
// In development (NODE_ENV !== "production") the function falls back to
// request headers when APP_BASE_URL is absent, purely for convenience.
// In production without APP_BASE_URL the function throws so callers can
// return 500 rather than silently email a poisoned link.
function getBaseUrl(req: Request): string {
  const raw = (process.env.APP_BASE_URL || "").trim();
  if (raw) {
    // Validate and normalise: must be a parseable URL; strip trailing slash.
    try {
      const parsed = new URL(raw);
      return parsed.origin; // scheme + host + optional port, no trailing slash
    } catch {
      // Misconfigured APP_BASE_URL — treat as absent (will throw below in prod).
      console.error("[security] APP_BASE_URL is set but not a valid URL:", raw);
    }
  }

  if (process.env.NODE_ENV === "production") {
    // Fail closed: never derive links from attacker-controlled headers in prod.
    throw new Error(
      "[security] APP_BASE_URL must be set in production. " +
      "Cannot build password-reset or invitation links without a trusted canonical origin.",
    );
  }

  // Development-only fallback — request headers are acceptable here because
  // the dev server is not exposed to untrusted clients.
  const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0] || req.protocol;
  const host = req.get("host");
  return `${proto}://${host}`;
}

// Idempotently create (and email) an invitation for a guardian/teacher email.
// Skips when an account already exists or a pending invite is outstanding, so
// repeated child/teacher edits never spam invitations. Best-effort: never
// throws, so it cannot abort the operation that triggered it.
async function maybeCreateInvite(
  rawEmail: string,
  role: "teacher" | "parent",
  invitedByName: string,
  schoolName: string,
  baseUrl: string,
): Promise<void> {
  try {
    const email = (rawEmail || "").trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
    const existingAccount = await storage.getAccountByEmail(email);
    if (existingAccount) return;
    await storage.deleteExpiredInvitations();
    const pending = await storage.getPendingInvitation(email, role);
    if (pending) return;
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await storage.createInvitation({ token, email, role, invitedByName, expiresAt });
    const inviteUrl = `${baseUrl}/invite/${token}`;
    await sendInvitationEmail({ to: email, role, inviteUrl, invitedByName, schoolName });
  } catch (err) {
    // Do not log the raw email address (PII) — log a masked form instead.
    const masked = rawEmail.replace(/^(.).*(@.*)$/, "$1***$2");
    console.error("Failed to create invitation for", masked, err);
  }
}

// Trim uniform border margins (white on the opaque watercolor icons) so the
// generated subject fills the frame, matching the tightly-cropped default
// activity icons on the home page.
async function trimImageMargins(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer).trim({ threshold: 20 }).toBuffer();
  } catch (e) {
    console.error("Image trim failed (using untrimmed image):", e);
    return buffer;
  }
}

const updateChildSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  photo: z.string(),
  birthday: z.string().optional().default(""),
  guardians: z.union([
    z.string(),
    z.array(z.object({ name: z.string(), relation: z.string().optional().default(""), contact: z.string(), email: z.string().optional().default(""), photo: z.string().optional().default(""), address: z.string().optional().default("") })),
  ]).optional().default("[]"),
  enrollmentDate: z.string().optional().default(""),
  graduationDate: z.string().optional().default(""),
  address: z.string().optional().default(""),
  allergies: z.string().optional().default(""),
  medications: z.string().optional().default(""),
  doctor: z.string().optional().default(""),
  doctorPhone: z.string().optional().default(""),
  note: z.string().optional().default(""),
});

export async function registerRoutes(app: Express): Promise<void> {

  // POST /api/generate-activity-image
  // Generates a watercolor illustration using the subject from the description field
  app.post("/api/generate-activity-image", requireStaff, async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!checkAiRateLimit(ip)) {
      return res.status(429).json({ error: "Too many requests. Please wait before generating another image." });
    }
    if (aiInflight >= AI_MAX_INFLIGHT) {
      return res.status(503).json({ error: "Server is busy. Please try again shortly." });
    }
    aiInflight++;
    try {
      const { subject } = req.body;
      if (!subject || typeof subject !== "string") {
        return res.status(400).json({ error: "subject is required" });
      }
      if (subject.length > 300) {
        return res.status(400).json({ error: "subject must be 300 characters or fewer" });
      }

      const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
      const apiKey  = process.env.OPENAI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "AI integration not configured" });
      }

      const prompt =
        `Illustrate ${subject} in a soft hand-drawn watercolor cartoon style matching the reference images. ` +
        "Use thick dark pencil sketch drawn outlines, pastel colors, curved watercolor shading, white highlight spots, " +
        "subtle paper texture, and light watercolor shadow washes. " +
        "People are faceless rounded figures: adults are taller with long soft limbs and large rounded heads; " +
        "children are clearly smaller, chubbier, shorter-limbed, and playful. " +
        "Use mitten hands, no fingers, and absolutely no facial features (no eyes, eyebrows, nose, mouth, or cheeks). " +
        "Each head is NOT a closed circle — the head opens smoothly into the body at the neck so the head and body form one " +
        "continuous shape, with no outline closing off the bottom of the head and no separating line between head and body. " +
        "Stylize every adult and child as a simple smooth one-piece rounded figure, like a minimalist wooden peg doll, " +
        "rendered in a single solid flat color that is exactly the SAME from head to toe. " +
        "Do NOT use skin tones, beige, or peach for the bodies; instead pick a soft color that fits the app's palette " +
        "(teal, cream, warm brown, amber, coral red, or sage green). " +
        "The figures have no separate clothing, garments, outfits, shoes, patterns, or accessories. " +
        "Objects are chunky, toy-like, geometric, and slightly imperfect. " +
        "Keep it warm, simple, cheerful, and uncluttered. " +
        "Avoid realism, sharp vector art, gradients, text, logos, and detailed backgrounds. " +
        "The background must be a plain solid pure white (#ffffff) that exactly matches the white activity tile — " +
        "no off-white, cream, paper tint, vignette, or background shadow behind the figures.";

      const imageAbort = new AbortController();
      const imageTimeout = setTimeout(() => imageAbort.abort(), 55_000);

      let apiResponse: globalThis.Response;
      try {
        apiResponse = await fetch(`${baseUrl}/images/generations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-image-1",
            prompt,
            n: 1,
            size: "1024x1024",
            quality: "high",
            output_format: "png",
            background: "opaque",
          }),
          signal: imageAbort.signal,
        });
      } finally {
        clearTimeout(imageTimeout);
      }

      if (!apiResponse.ok) {
        const errText = await apiResponse.text();
        console.error("Image generation API error:", errText);
        return res.status(500).json({ error: "Image generation failed" });
      }

      const data = await apiResponse.json() as { data: Array<{ b64_json?: string; url?: string }> };
      const imageData = data.data?.[0];

      if (!imageData) {
        return res.status(500).json({ error: "No image returned from API" });
      }

      let buffer: Buffer;
      if (imageData.b64_json) {
        buffer = Buffer.from(imageData.b64_json, "base64");
      } else if (imageData.url) {
        const imgRes = await fetch(imageData.url);
        buffer = Buffer.from(await imgRes.arrayBuffer());
      } else {
        return res.status(500).json({ error: "No image data in response" });
      }

      const trimmed = await trimImageMargins(buffer);
      return res.json({ image: `data:image/png;base64,${trimmed.toString("base64")}` });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return res.status(504).json({ error: "Image generation timed out" });
      }
      console.error("Error generating image:", err);
      res.status(500).json({ error: "Internal server error" });
    } finally {
      aiInflight--;
    }
  });

  app.post("/api/summarize-day", requireStaff, async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!checkAiRateLimit(ip)) {
      return res.status(429).json({ error: "Too many requests. Please wait before generating another summary." });
    }
    if (aiInflight >= AI_MAX_INFLIGHT) {
      return res.status(503).json({ error: "Server is busy. Please try again shortly." });
    }
    aiInflight++;
    try {
      const { childName, activities } = req.body;
      if (!childName || typeof childName !== "string") {
        return res.status(400).json({ error: "childName is required" });
      }
      if (childName.length > 100) {
        return res.status(400).json({ error: "childName must be 100 characters or fewer" });
      }
      if (!activities || !Array.isArray(activities) || activities.length === 0) {
        return res.status(400).json({ error: "activities[] is required and must be non-empty" });
      }
      if (activities.length > 50) {
        return res.status(400).json({ error: "activities[] must contain 50 items or fewer" });
      }
      for (const a of activities) {
        if (typeof a.text === "string" && a.text.length > 500) {
          return res.status(400).json({ error: "Each activity text must be 500 characters or fewer" });
        }
        if (typeof a.note === "string" && a.note.length > 500) {
          return res.status(400).json({ error: "Each activity note must be 500 characters or fewer" });
        }
      }

      const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
      const apiKey = process.env.OPENAI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "AI integration not configured" });
      }

      const activitiesList = activities.map((a: { text: string; note?: string }) =>
        `- ${a.text}${a.note ? ` (Note: ${a.note})` : ""}`
      ).join("\n");

      const summaryAbort = new AbortController();
      const summaryTimeout = setTimeout(() => summaryAbort.abort(), 30_000);

      let apiResponse: globalThis.Response;
      try {
        apiResponse = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are a warm, caring daycare teacher writing an end-of-day summary for a parent. Write in a friendly, personal tone. You MUST include EVERY single activity from the list — do not skip or omit any. For snack/meal activities, list the specific food items mentioned. Include ALL notes provided by the teacher — weave them naturally into the summary. Do NOT invent or embellish any details not provided. Do NOT include any timestamps or times of day (no '8:30 AM', 'at 10am', 'in the morning', etc.). Do not use bullet points. Do not start with the child's name. The summary can be as long as needed to cover everything."
              },
              {
                role: "user",
                content: `Write a brief end-of-day summary for ${childName}. Here are today's activities:\n${activitiesList}`
              }
            ],
            max_tokens: 500,
          }),
          signal: summaryAbort.signal,
        });
      } finally {
        clearTimeout(summaryTimeout);
      }

      if (!apiResponse.ok) {
        const err = await apiResponse.text();
        console.error("AI summary error:", err);
        return res.status(500).json({ error: "Failed to generate summary" });
      }

      const data = await apiResponse.json();
      const summary = data.choices?.[0]?.message?.content?.trim() || "No summary available.";
      return res.json({ summary });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return res.status(504).json({ error: "Summary generation timed out" });
      }
      console.error("Error generating summary:", err);
      res.status(500).json({ error: "Internal server error" });
    } finally {
      aiInflight--;
    }
  });

  app.get("/api/children", requireAuth, async (req: Request, res: Response) => {
    try {
      const all = await storage.getAllChildren();
      // Parents only ever see their own children.
      if (isParentSession(req)) {
        const ids = new Set(await storage.getParentChildIds(req.session.email || ""));
        return res.json(all.filter((c) => ids.has(c.id)));
      }
      res.json(all);
    } catch (err) {
      console.error("Error fetching children:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/children/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      if (isParentSession(req) && !(await parentCanAccessChild(req, req.params.id as string))) {
        return res.status(404).json({ error: "Child not found" });
      }
      const child = await storage.getChild(req.params.id as string);
      if (!child) return res.status(404).json({ error: "Child not found" });
      res.json(child);
    } catch (err) {
      console.error("Error fetching child:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/activities/:childId", requireAuth, async (req: Request, res: Response) => {
    try {
      if (isParentSession(req) && !(await parentCanAccessChild(req, req.params.childId as string))) {
        return res.status(404).json({ error: "Child not found" });
      }
      const acts = await storage.getActivitiesByChild(req.params.childId as string);
      res.json(acts);
    } catch (err) {
      console.error("Error fetching activities:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/activities", requireStaff, async (req: Request, res: Response) => {
    try {
      const { childIds, text, texts, time } = req.body;
      if (!childIds || !Array.isArray(childIds) || !time) {
        return res.status(400).json({ error: "childIds (array) and time are required" });
      }
      if (!text && !texts) {
        return res.status(400).json({ error: "text (string) or texts (object mapping childId to text) is required" });
      }
      const results = [];
      for (const childId of childIds) {
        const activityText = texts?.[childId] ?? text;
        const activity = await storage.createActivity({ childId, text: activityText, time });
        results.push(activity);
      }
      res.json(results);
    } catch (err) {
      console.error("Error creating activity:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/activities/:id/text", requireStaff, async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      if (typeof text !== "string") {
        return res.status(400).json({ error: "text (string) is required" });
      }
      const updated = await storage.updateActivityText(req.params.id as string, text);
      res.json(updated);
    } catch (err) {
      console.error("Error updating activity text:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/activities/:id/note", requireStaff, async (req: Request, res: Response) => {
    try {
      const { note } = req.body;
      if (typeof note !== "string") {
        return res.status(400).json({ error: "note (string) is required" });
      }
      const updated = await storage.updateActivityNote(req.params.id as string, note);
      res.json(updated);
    } catch (err) {
      console.error("Error updating activity note:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/activities/:id/time", requireStaff, async (req: Request, res: Response) => {
    try {
      const { time } = req.body;
      if (typeof time !== "string") {
        return res.status(400).json({ error: "time (string) is required" });
      }
      const updated = await storage.updateActivityTime(req.params.id as string, time);
      res.json(updated);
    } catch (err) {
      console.error("Error updating activity time:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/activities/:id/photo", requireStaff, async (req: Request, res: Response) => {
    try {
      const { photo } = req.body;
      if (typeof photo !== "string") {
        return res.status(400).json({ error: "photo (string) is required" });
      }
      const updated = await storage.updateActivityPhoto(req.params.id as string, photo);
      res.json(updated);
    } catch (err) {
      console.error("Error updating activity photo:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/activities/:id", requireStaff, async (req: Request, res: Response) => {
    try {
      await storage.deleteActivity(req.params.id as string);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting activity:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/comments/:activityId", requireAuth, async (req: Request, res: Response) => {
    try {
      if (isParentSession(req) && !(await parentCanAccessActivity(req, req.params.activityId as string))) {
        return res.status(404).json({ error: "Activity not found" });
      }
      const comments = await storage.getCommentsByActivity(req.params.activityId as string);
      res.json(comments);
    } catch (err) {
      console.error("Error fetching comments:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/comments", requireAuth, async (req: Request, res: Response) => {
    try {
      const { activityId, text, time } = req.body;
      if (!activityId || !text || !time) {
        return res.status(400).json({ error: "activityId, text, and time are required" });
      }
      if (isParentSession(req) && !(await parentCanAccessActivity(req, activityId))) {
        return res.status(404).json({ error: "Activity not found" });
      }
      // Authorship role and accountId come from the session, never the request body.
      const commentRole = feedRole(req);
      const comment = await storage.createComment({ activityId, text, time, role: commentRole, accountId: feedActorId(req) });
      res.json(comment);
    } catch (err) {
      console.error("Error creating comment:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/comments/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ error: "text is required" });
      const existing = await storage.getComment(req.params.id as string);
      if (!existing) return res.status(404).json({ error: "Comment not found" });
      if (!(await canModifyComment(req, existing))) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const comment = await storage.updateComment(req.params.id as string, text);
      res.json(comment);
    } catch (err) {
      console.error("Error updating comment:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/comments/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const commentToDelete = await storage.getComment(req.params.id as string);
      if (!commentToDelete) return res.status(404).json({ error: "Comment not found" });
      if (!(await canModifyComment(req, commentToDelete))) {
        return res.status(403).json({ error: "Forbidden" });
      }
      await storage.deleteComment(req.params.id as string);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting comment:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/likes/:activityId", requireAuth, async (req: Request, res: Response) => {
    try {
      if (isParentSession(req) && !(await parentCanAccessActivity(req, req.params.activityId as string))) {
        return res.status(404).json({ error: "Activity not found" });
      }
      const likes = await storage.getLikesByActivity(req.params.activityId as string);
      const actor = feedActorId(req);
      // Annotate each like with whether it belongs to the current session's account.
      // accountId is never exposed to clients; only the boolean `mine` field is.
      const annotated = likes.map(({ accountId: _a, ...rest }) => ({
        ...rest,
        mine: !!_a && _a === actor,
      }));
      res.json(annotated);
    } catch (err) {
      console.error("Error fetching likes:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/likes/toggle", requireAuth, async (req: Request, res: Response) => {
    try {
      const { activityId } = req.body;
      if (!activityId) return res.status(400).json({ error: "activityId is required" });
      if (isParentSession(req) && !(await parentCanAccessActivity(req, activityId))) {
        return res.status(404).json({ error: "Activity not found" });
      }
      // Like role and accountId are derived from the session, never the request body.
      const likeRole = feedRole(req);
      const liked = await storage.toggleLike(activityId, likeRole, feedActorId(req));
      res.json({ liked });
    } catch (err) {
      console.error("Error toggling like:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/children/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = updateChildSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.flatten() });
      }
      const { firstName, lastName, photo, birthday, guardians, enrollmentDate, graduationDate, address, allergies, medications, doctor, doctorPhone, note } = parsed.data;
      const childData = await storage.upsertChild({
        id: req.params.id as string,
        firstName,
        lastName,
        photo,
        birthday: birthday || "",
        guardians: typeof guardians === "string" ? guardians : JSON.stringify(guardians),
        enrollmentDate: enrollmentDate || "",
        graduationDate: graduationDate || "",
        address: address || "",
        allergies: allergies || "",
        medications: medications || "",
        doctor: doctor || "",
        doctorPhone: doctorPhone || "",
        note: note || "",
      });
      res.json(childData);

      // Invite every guardian with an email who doesn't yet have an account.
      // Fire-and-forget so email latency/failures never affect the response.
      void (async () => {
        try {
          const admin = await storage.getAdminAccount();
          const invitedByName = admin?.fullName || "";
          const schoolName = admin?.schoolName || "Miss Sunshine";
          const baseUrl = getBaseUrl(req);
          let gs: { email?: string }[] = [];
          try { gs = JSON.parse(childData.guardians || "[]"); } catch { gs = []; }
          if (Array.isArray(gs)) {
            for (const g of gs) {
              if (g.email) await maybeCreateInvite(g.email, "parent", invitedByName, schoolName, baseUrl);
            }
          }
        } catch (e) {
          console.error("Error sending guardian invites:", e);
        }
      })();
    } catch (err) {
      console.error("Error saving child:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // DELETE /api/children/:id — remove a child (cascades activities/comments/likes)
  app.delete("/api/children/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const existing = await storage.getChild(req.params.id as string);
      if (!existing) return res.status(404).json({ error: "Child not found" });
      await storage.deleteChild(req.params.id as string);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting child:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // The school owner/administrator (from onboarding) is surfaced as a
  // synthetic, non-removable teacher with the reserved id "owner".
  const OWNER_TEACHER_ID = "owner";
  function buildOwnerTeacher(account: {
    fullName: string; role: string; email: string;
    schoolNumber: string; schoolAddress: string; logoPath: string; photo: string;
  }) {
    const full = (account.fullName || "").trim();
    const sp = full.indexOf(" ");
    return {
      id: OWNER_TEACHER_ID,
      firstName: sp === -1 ? full : full.slice(0, sp),
      lastName: sp === -1 ? "" : full.slice(sp + 1).trim(),
      photo: account.photo || account.logoPath || "",
      relation: account.role || "",
      phone: account.schoolNumber || "",
      email: account.email || "",
      address: account.schoolAddress || "",
    };
  }

  // GET /api/teachers — list all teachers (owner first, if present)
  app.get("/api/teachers", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const all = await storage.getAllTeachers();
      const account = await storage.getAdminAccount();
      res.json(account ? [buildOwnerTeacher(account), ...all] : all);
    } catch (err) {
      console.error("Error fetching teachers:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/teachers/:id — get a single teacher
  app.get("/api/teachers/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      if (req.params.id === OWNER_TEACHER_ID) {
        const account = await storage.getAdminAccount();
        if (!account) return res.status(404).json({ error: "Teacher not found" });
        return res.json(buildOwnerTeacher(account));
      }
      const teacher = await storage.getTeacher(req.params.id as string);
      if (!teacher) return res.status(404).json({ error: "Teacher not found" });
      res.json(teacher);
    } catch (err) {
      console.error("Error fetching teacher:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PATCH /api/teachers/:id — update a teacher (owner edits sync to admin account)
  app.patch("/api/teachers/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertTeacherSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.flatten() });
      }
      if (req.params.id === OWNER_TEACHER_ID) {
        const d = parsed.data;
        const updated = await storage.updateAdminAccount({
          fullName: `${d.firstName} ${d.lastName}`.trim(),
          role: d.relation,
          email: d.email,
          schoolNumber: d.phone,
          schoolAddress: d.address,
          photo: d.photo,
        });
        if (!updated) return res.status(404).json({ error: "Teacher not found" });
        res.json(buildOwnerTeacher(updated));
        return;
      }
      const existing = await storage.getTeacher(req.params.id as string);
      if (!existing) return res.status(404).json({ error: "Teacher not found" });
      const teacher = await storage.updateTeacher(req.params.id as string, parsed.data);
      res.json(teacher);
    } catch (err) {
      console.error("Error updating teacher:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // DELETE /api/teachers/:id — remove a teacher (the owner cannot be removed)
  app.delete("/api/teachers/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      if (req.params.id === OWNER_TEACHER_ID) {
        return res.status(403).json({ error: "The school owner cannot be removed" });
      }
      const existing = await storage.getTeacher(req.params.id as string);
      if (!existing) return res.status(404).json({ error: "Teacher not found" });
      await storage.deleteTeacher(req.params.id as string);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting teacher:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/teachers — create a teacher
  app.post("/api/teachers", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = insertTeacherSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.flatten() });
      }
      const teacher = await storage.createTeacher(parsed.data);
      res.json(teacher);

      // Invite the new teacher to set up their login (best-effort).
      void (async () => {
        try {
          const admin = await storage.getAdminAccount();
          const invitedByName = admin?.fullName || "";
          const schoolName = admin?.schoolName || "Miss Sunshine";
          if (teacher.email) {
            await maybeCreateInvite(teacher.email, "teacher", invitedByName, schoolName, getBaseUrl(req));
          }
        } catch (e) {
          console.error("Error sending teacher invite:", e);
        }
      })();
    } catch (err) {
      console.error("Error creating teacher:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/admin/logo — return the school logo data URL (requires auth)
  app.get("/api/admin/logo", requireAuth, async (_req: Request, res: Response) => {
    const account = await storage.getAdminAccount();
    res.json({ logoUrl: account?.logoPath || "" });
  });

  // GET /api/admin/status — check if admin account exists
  app.get("/api/admin/status", async (_req: Request, res: Response) => {
    const account = await storage.getAdminAccount();
    res.json({ exists: !!account });
  });

  // POST /api/admin/register — create admin account during onboarding
  app.post("/api/admin/register", async (req: Request, res: Response) => {
    if (!checkLoginRateLimit(getClientIp(req))) {
      return res.status(429).json({ error: "Too many attempts. Please try again later." });
    }
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
      passwordHint: z.string().min(1),
      fullName: z.string().min(1),
      role: z.string().min(1),
      schoolName: z.string().min(1),
      schoolNumber: z.string().min(1),
      schoolAddress: z.string().min(1),
      logoPath: z.string().optional().default(""),
      photo: z.string().optional().default(""),
      setupToken: z.string().optional().default(""),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid data", details: parsed.error.flatten() });
    }
    const existing = await storage.getAdminAccount();
    if (existing) {
      return res.status(409).json({ error: "Admin account already exists" });
    }
    // Bootstrap gate: in production, creating the owner account requires the
    // server-side ADMIN_SETUP_TOKEN so a random internet client cannot claim
    // ownership on a fresh deployment. Compared in constant time.
    if (process.env.NODE_ENV === "production") {
      const expected = process.env.ADMIN_SETUP_TOKEN || "";
      if (!expected) {
        return res.status(403).json({ error: "Admin setup is disabled. Set ADMIN_SETUP_TOKEN to enable it." });
      }
      const provided = parsed.data.setupToken;
      const a = Buffer.from(provided);
      const b = Buffer.from(expected);
      const match = a.length === b.length && timingSafeEqual(a, b);
      if (!match) {
        return res.status(403).json({ error: "Invalid setup token" });
      }
    }
    const { email, password, passwordHint, fullName, role, schoolName, schoolNumber, schoolAddress, logoPath, photo } = parsed.data;
    const passwordHash = hashPassword(password);
    const account = await storage.createAdminAccount({
      email, passwordHash, passwordHint, fullName, role,
      schoolName, schoolNumber, schoolAddress, logoPath, photo,
    });
    // Auto-login: establish session immediately after registration
    req.session.authenticated = true;
    req.session.role = "admin";
    req.session.email = account.email.toLowerCase();
    req.session.accountId = undefined;
    res.json({ id: account.id, email: account.email, role: "admin" });
  });

  // Authenticate any role: the admin/owner (admin_account) or an invited
  // teacher/parent (accounts). Establishes the session and returns the
  // server-decided role plus, for parents, their accessible child IDs.
  async function loginHandler(req: Request, res: Response): Promise<void> {
    const ip = getClientIp(req);
    if (!checkLoginRateLimit(ip)) {
      res.status(429).json({ error: "Too many login attempts. Please try again later." });
      return;
    }

    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }
    const normalized = String(email).trim().toLowerCase();

    const admin = await storage.getAdminAccount();
    if (admin && admin.email.toLowerCase() === normalized && verifyPassword(password, admin.passwordHash)) {
      req.session.authenticated = true;
      req.session.role = "admin";
      req.session.email = admin.email.toLowerCase();
      req.session.accountId = undefined;
      res.json({ success: true, role: "admin", email: admin.email, fullName: admin.fullName });
      return;
    }

    const account = await storage.getAccountByEmail(normalized);
    if (account && verifyPassword(password, account.passwordHash)) {
      const childIds = account.role === "parent" ? await storage.getParentChildIds(account.email) : undefined;
      req.session.authenticated = true;
      req.session.role = account.role as Role;
      req.session.email = account.email;
      req.session.accountId = account.id;
      if (childIds) req.session.parentChildIds = childIds;
      res.json({ success: true, role: account.role, email: account.email, childIds });
      return;
    }

    res.status(401).json({ error: "Invalid email or password" });
  }

  // POST /api/login — unified login for all roles.
  app.post("/api/login", loginHandler);
  // POST /api/admin/login — retained for backward compatibility.
  app.post("/api/admin/login", loginHandler);

  // GET /api/auth/me — current session identity (role + parent scope).
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.session?.authenticated || !req.session.role) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const role = req.session.role;
    const childIds = role === "parent" ? await storage.getParentChildIds(req.session.email || "") : undefined;
    res.json({ role, email: req.session.email || "", childIds });
  });

  // GET /api/invitations/:token — public validation of an invite link.
  app.get("/api/invitations/:token", async (req: Request, res: Response) => {
    try {
      const invite = await storage.getInvitationByToken(req.params.token as string);
      if (!invite || invite.acceptedAt || invite.expiresAt.getTime() < Date.now()) {
        return res.json({ valid: false });
      }
      const admin = await storage.getAdminAccount();
      res.json({
        valid: true,
        email: invite.email,
        role: invite.role,
        invitedByName: invite.invitedByName,
        schoolName: admin?.schoolName || "Miss Sunshine",
      });
    } catch (err) {
      console.error("Error validating invitation:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/invitations/:token/accept — set a password, create the account,
  // and log in. Public, but gated by possession of a valid single-use token.
  app.post("/api/invitations/:token/accept", async (req: Request, res: Response) => {
    try {
      if (!checkLoginRateLimit(getClientIp(req))) {
        return res.status(429).json({ error: "Too many attempts. Please try again later." });
      }
      const schema = z.object({ password: z.string().min(8) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }
      const invite = await storage.getInvitationByToken(req.params.token as string);
      if (!invite || invite.acceptedAt || invite.expiresAt.getTime() < Date.now()) {
        return res.status(400).json({ error: "This invitation is invalid or has expired" });
      }
      const existingAccount = await storage.getAccountByEmail(invite.email);
      if (existingAccount) {
        await storage.markInvitationAccepted(invite.id);
        return res.status(409).json({ error: "An account already exists for this email. Please log in.", alreadyExists: true });
      }
      const passwordHash = hashPassword(parsed.data.password);
      const account = await storage.createAccount({ email: invite.email, passwordHash, role: invite.role });
      await storage.markInvitationAccepted(invite.id);

      const childIds = account.role === "parent" ? await storage.getParentChildIds(account.email) : undefined;
      req.session.authenticated = true;
      req.session.role = account.role as Role;
      req.session.email = account.email;
      req.session.accountId = account.id;
      if (childIds) req.session.parentChildIds = childIds;
      res.json({ success: true, role: account.role, email: account.email, childIds });
    } catch (err) {
      console.error("Error accepting invitation:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/auth/forgot-password — accepts an email, creates a 1-hour reset
  // token, sends the reset link via email (logs to console if Resend is absent).
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      if (!checkLoginRateLimit(getClientIp(req))) {
        return res.status(429).json({ error: "Too many attempts. Please try again later." });
      }
      const schema = z.object({ email: z.string().email() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Valid email required" });
      }
      const email = parsed.data.email.trim().toLowerCase();

      // Verify the email belongs to a known account (admin or teacher/parent).
      // Respond identically whether found or not to prevent email enumeration.
      const admin = await storage.getAdminAccount();
      const account = await storage.getAccountByEmail(email);
      const isKnown = (admin && admin.email.toLowerCase() === email) || !!account;

      await storage.deleteExpiredPasswordResets();

      if (isKnown) {
        const token = randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await storage.createPasswordReset({ token, email, expiresAt });

        const baseUrl = getBaseUrl(req);
        const resetUrl = `${baseUrl}/reset-password/${token}`;
        const schoolName = admin?.schoolName || "Miss Sunshine";
        await sendPasswordResetEmail({ to: email, resetUrl, schoolName });
      }

      // Always respond 200 — don't reveal whether email exists.
      res.json({ success: true });
    } catch (err) {
      console.error("Error in forgot-password:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/auth/reset-password/:token — validate a reset token.
  app.get("/api/auth/reset-password/:token", async (req: Request, res: Response) => {
    try {
      const reset = await storage.getPasswordResetByToken(req.params.token as string);
      if (!reset || reset.usedAt || reset.expiresAt.getTime() < Date.now()) {
        return res.json({ valid: false });
      }
      res.json({ valid: true, email: reset.email });
    } catch (err) {
      console.error("Error validating reset token:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/auth/reset-password/:token — set new password, invalidate token,
  // and auto-log in the user.
  app.post("/api/auth/reset-password/:token", async (req: Request, res: Response) => {
    try {
      if (!checkLoginRateLimit(getClientIp(req))) {
        return res.status(429).json({ error: "Too many attempts. Please try again later." });
      }
      const schema = z.object({ password: z.string().min(8) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }

      const reset = await storage.getPasswordResetByToken(req.params.token as string);
      if (!reset || reset.usedAt || reset.expiresAt.getTime() < Date.now()) {
        return res.status(400).json({ error: "This reset link is invalid or has expired" });
      }

      const passwordHash = hashPassword(parsed.data.password);
      const email = reset.email;

      // Update password in the appropriate table.
      const admin = await storage.getAdminAccount();
      if (admin && admin.email.toLowerCase() === email) {
        await storage.updateAdminPassword(email, passwordHash);
        await storage.markPasswordResetUsed(reset.id);
        req.session.authenticated = true;
        req.session.role = "admin";
        req.session.email = admin.email.toLowerCase();
        req.session.accountId = undefined;
        res.json({ success: true, role: "admin", email: admin.email });
        return;
      }

      const account = await storage.getAccountByEmail(email);
      if (!account) {
        return res.status(400).json({ error: "No account found for this email" });
      }
      await storage.updateAccountPassword(email, passwordHash);
      await storage.markPasswordResetUsed(reset.id);

      const childIds = account.role === "parent" ? await storage.getParentChildIds(account.email) : undefined;
      req.session.authenticated = true;
      req.session.role = account.role as Role;
      req.session.email = account.email;
      req.session.accountId = account.id;
      if (childIds) req.session.parentChildIds = childIds;
      res.json({ success: true, role: account.role, email: account.email, childIds });
    } catch (err) {
      console.error("Error in reset-password:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/logout (and legacy /api/admin/logout) — destroy session.
  function logoutHandler(req: Request, res: Response): void {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  }
  app.post("/api/logout", logoutHandler);
  app.post("/api/admin/logout", logoutHandler);

  // GET /api/cron/cleanup — scheduled cleanup of expired invitations/password
  // resets. Replaces the traditional hosting path's setInterval for Vercel's
  // serverless model (see vercel.json's `crons` entry). Gated by CRON_SECRET
  // in production so only Vercel's cron invoker (or an operator) can trigger it.
  app.get("/api/cron/cleanup", async (req: Request, res: Response) => {
    if (process.env.NODE_ENV === "production") {
      const expected = process.env.CRON_SECRET || "";
      if (!expected) {
        return res.status(403).json({ error: "Cron endpoint is disabled. Set CRON_SECRET to enable it." });
      }
      const provided = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      const a = Buffer.from(provided);
      const b = Buffer.from(expected);
      const match = a.length === b.length && timingSafeEqual(a, b);
      if (!match) {
        return res.status(403).json({ error: "Invalid cron secret" });
      }
    }
    try {
      await storage.deleteExpiredInvitations();
      await storage.deleteExpiredPasswordResets();
      res.json({ success: true });
    } catch (err) {
      console.error("Error running cron cleanup:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
