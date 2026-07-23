import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { insertTeacherSchema } from "@shared/schema";
import sharp from "sharp";
import { z } from "zod";

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

// Feed comment/like authorship. There is no login, so every visitor acts with
// full access; the "role" column is always "teacher". The accountId is an
// anonymous per-device identifier generated client-side (see
// client/src/lib/deviceId.ts) and is only used to annotate "liked by this
// device" state and to display who authored a comment — never for access
// control, since anyone may edit or delete anything.
function deviceIdFrom(source: unknown): string {
  return typeof source === "string" && source.trim() ? source.trim() : "anonymous";
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
  app.post("/api/generate-activity-image", async (req: Request, res: Response) => {
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

  app.post("/api/summarize-day", async (req: Request, res: Response) => {
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

  app.get("/api/children", async (_req: Request, res: Response) => {
    try {
      const all = await storage.getAllChildren();
      res.json(all);
    } catch (err) {
      console.error("Error fetching children:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/children/:id", async (req: Request, res: Response) => {
    try {
      const child = await storage.getChild(req.params.id as string);
      if (!child) return res.status(404).json({ error: "Child not found" });
      res.json(child);
    } catch (err) {
      console.error("Error fetching child:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/activities/:childId", async (req: Request, res: Response) => {
    try {
      const acts = await storage.getActivitiesByChild(req.params.childId as string);
      res.json(acts);
    } catch (err) {
      console.error("Error fetching activities:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/activities", async (req: Request, res: Response) => {
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

  app.patch("/api/activities/:id/text", async (req: Request, res: Response) => {
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

  app.patch("/api/activities/:id/note", async (req: Request, res: Response) => {
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

  app.patch("/api/activities/:id/time", async (req: Request, res: Response) => {
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

  app.patch("/api/activities/:id/photo", async (req: Request, res: Response) => {
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

  app.delete("/api/activities/:id", async (req: Request, res: Response) => {
    try {
      await storage.deleteActivity(req.params.id as string);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting activity:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/comments/:activityId", async (req: Request, res: Response) => {
    try {
      const comments = await storage.getCommentsByActivity(req.params.activityId as string);
      res.json(comments);
    } catch (err) {
      console.error("Error fetching comments:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/comments", async (req: Request, res: Response) => {
    try {
      const { activityId, text, time, deviceId } = req.body;
      if (!activityId || !text || !time) {
        return res.status(400).json({ error: "activityId, text, and time are required" });
      }
      const comment = await storage.createComment({ activityId, text, time, role: "teacher", accountId: deviceIdFrom(deviceId) });
      res.json(comment);
    } catch (err) {
      console.error("Error creating comment:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/comments/:id", async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ error: "text is required" });
      const existing = await storage.getComment(req.params.id as string);
      if (!existing) return res.status(404).json({ error: "Comment not found" });
      const comment = await storage.updateComment(req.params.id as string, text);
      res.json(comment);
    } catch (err) {
      console.error("Error updating comment:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/comments/:id", async (req: Request, res: Response) => {
    try {
      const commentToDelete = await storage.getComment(req.params.id as string);
      if (!commentToDelete) return res.status(404).json({ error: "Comment not found" });
      await storage.deleteComment(req.params.id as string);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting comment:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/likes/:activityId", async (req: Request, res: Response) => {
    try {
      const likes = await storage.getLikesByActivity(req.params.activityId as string);
      const actor = deviceIdFrom(req.query.deviceId);
      // Annotate each like with whether it belongs to the current device.
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

  app.post("/api/likes/toggle", async (req: Request, res: Response) => {
    try {
      const { activityId, deviceId } = req.body;
      if (!activityId) return res.status(400).json({ error: "activityId is required" });
      const liked = await storage.toggleLike(activityId, "teacher", deviceIdFrom(deviceId));
      res.json({ liked });
    } catch (err) {
      console.error("Error toggling like:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/children/:id", async (req: Request, res: Response) => {
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
    } catch (err) {
      console.error("Error saving child:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // DELETE /api/children/:id — remove a child (cascades activities/comments/likes)
  app.delete("/api/children/:id", async (req: Request, res: Response) => {
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

  // GET /api/teachers — list all teachers
  app.get("/api/teachers", async (_req: Request, res: Response) => {
    try {
      const all = await storage.getAllTeachers();
      res.json(all);
    } catch (err) {
      console.error("Error fetching teachers:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/teachers/:id — get a single teacher
  app.get("/api/teachers/:id", async (req: Request, res: Response) => {
    try {
      const teacher = await storage.getTeacher(req.params.id as string);
      if (!teacher) return res.status(404).json({ error: "Teacher not found" });
      res.json(teacher);
    } catch (err) {
      console.error("Error fetching teacher:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PATCH /api/teachers/:id — update a teacher
  app.patch("/api/teachers/:id", async (req: Request, res: Response) => {
    try {
      const parsed = insertTeacherSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.flatten() });
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

  // DELETE /api/teachers/:id — remove a teacher
  app.delete("/api/teachers/:id", async (req: Request, res: Response) => {
    try {
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
  app.post("/api/teachers", async (req: Request, res: Response) => {
    try {
      const parsed = insertTeacherSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.flatten() });
      }
      const teacher = await storage.createTeacher(parsed.data);
      res.json(teacher);
    } catch (err) {
      console.error("Error creating teacher:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
