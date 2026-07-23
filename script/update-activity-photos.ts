// One-off updater: replaces the reused-portrait photo on the news-feed
// "free play" (toddler) / "tummy time" (baby) activity entries with a new
// contextual photo of the child actually doing that activity.
// Run: npx tsx --env-file=.env script/update-activity-photos.ts
import { readFileSync } from "fs";
import path from "path";
import { db, pool } from "../server/db";
import { activities } from "@shared/schema";
import { and, eq, like } from "drizzle-orm";

const DATA_DIR = path.join(import.meta.dirname, "data");

const manifest = JSON.parse(
  readFileSync(path.join(DATA_DIR, "activity-photos-manifest.json"), "utf8"),
) as Record<string, string>;

async function main() {
  let updated = 0;
  for (const [childId, photo] of Object.entries(manifest)) {
    const rows = await db
      .update(activities)
      .set({ photo })
      .where(and(eq(activities.childId, childId), like(activities.text, "%had free play.%")))
      .returning({ id: activities.id });
    const rows2 = await db
      .update(activities)
      .set({ photo })
      .where(and(eq(activities.childId, childId), like(activities.text, "%had tummy time.%")))
      .returning({ id: activities.id });
    const count = rows.length + rows2.length;
    updated += count;
    console.log(`${childId}: updated ${count} row(s)`);
  }
  console.log(`\nUpdated ${updated} activity rows.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
