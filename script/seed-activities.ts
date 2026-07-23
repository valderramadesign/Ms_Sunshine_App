// One-off demo seeder for the news feed: gives each child a realistic day of
// activities across the last few days so parents see a populated feed and the
// checkout day-summary modal has content to summarize.
// Run: npx tsx --env-file=.env script/seed-activities.ts
import { readFileSync } from "fs";
import path from "path";
import { db, pool } from "../server/db";
import { activities } from "@shared/schema";
import { eq } from "drizzle-orm";

const DATA_DIR = path.join(import.meta.dirname, "data");

const roster = JSON.parse(readFileSync(path.join(DATA_DIR, "roster.json"), "utf8")) as {
  children: { id: string; firstName: string }[];
};
const manifest = JSON.parse(readFileSync(path.join(DATA_DIR, "portraits-manifest.json"), "utf8")) as Record<
  string,
  string
>;

const BABY_IDS = new Set(["c10", "c11", "c12", "c13"]);

type Slot = {
  h: number; // hour, 24h local
  m: number;
  make: (first: string) => string; // activity text
  note?: string;
  photo?: boolean; // attach the child's portrait as a snapshot
};

function time12(h: number, m: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${m.toString().padStart(2, "0")} ${period}`;
}

// A full preschool/toddler day. Two variants so the feed isn't identical child to child.
function toddlerDay(variant: number): Slot[] {
  const lunches = [
    "ate a bowl of pasta and some steamed carrots",
    "ate a cheese quesadilla and a few apple slices",
    "ate a peanut butter sandwich and a bowl of berries",
  ];
  const snacks = [
    "ate half a banana and some crackers",
    "ate a bowl of berries",
    "ate a cheese stick and some grapes",
  ];
  const lessons = [
    { note: "We practiced counting to twenty and worked on shapes." },
    { note: "Story time today was all about friendly dinosaurs." },
    { note: "We learned the letter B and painted the sky blue." },
  ];
  const v = variant % 3;
  return [
    { h: 8, m: 45, make: (f) => `${f} checked in.` },
    { h: 9, m: 15, make: (f) => `${f} had free play.`, note: "Loved building a tall tower with the blocks.", photo: true },
    { h: 10, m: 10, make: (f) => `${f} had a lesson.`, note: lessons[v].note },
    { h: 11, m: 30, make: (f) => `${f} ${snacks[v]}.` },
    { h: 12, m: 15, make: (f) => `${f} ${lunches[v]}.` },
    { h: 12, m: 55, make: (f) => `${f} had nap time.` },
    { h: 14, m: 5, make: (f) => `${f} had a sleep check.`, note: "Slept soundly for just over an hour." },
    { h: 14, m: 45, make: (f) => `${f} had outdoor play.`, note: "Chased bubbles on the playground." },
    { h: 15, m: 20, make: (f) => `${f} had a potty break.` },
    { h: 15, m: 45, make: (f) => `${f} checked out.` },
  ];
}

// A full infant day.
function babyDay(variant: number): Slot[] {
  const purees = [
    "had a few spoonfuls of pureed pears",
    "had a jar of sweet potato puree",
    "had some mashed banana and oatmeal",
  ];
  const bottles = [
    "had a 6 oz bottle",
    "had a 5 oz bottle",
    "had a warm bottle",
  ];
  const v = variant % 3;
  return [
    { h: 8, m: 40, make: (f) => `${f} checked in.` },
    { h: 9, m: 10, make: (f) => `${f} ${bottles[v]}.` },
    { h: 9, m: 50, make: (f) => `${f} had a diaper change.` },
    { h: 10, m: 20, make: (f) => `${f} had tummy time.`, note: "So many smiles during tummy time this morning!", photo: true },
    { h: 11, m: 30, make: (f) => `${f} ${purees[v]}.` },
    { h: 12, m: 15, make: (f) => `${f} had nap time.` },
    { h: 13, m: 30, make: (f) => `${f} had a sleep check.`, note: "Napped peacefully for about an hour." },
    { h: 14, m: 10, make: (f) => `${f} had a diaper change.` },
    { h: 14, m: 40, make: (f) => `${f} ${bottles[(v + 1) % 3]}.` },
    { h: 15, m: 30, make: (f) => `${f} checked out.` },
  ];
}

// Today's in-progress (partial) day — no checkout yet.
function partialDay(baby: boolean): Slot[] {
  const full = baby ? babyDay(0) : toddlerDay(1);
  // keep morning through early-afternoon, drop checkout and late items
  const cutoffHour = 13;
  return full.filter((s) => s.h < cutoffHour);
}

function dateAt(daysAgo: number, h: number, m: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h, m, 0, 0);
  return d;
}

async function seedDay(childId: string, first: string, daysAgo: number, slots: Slot[]) {
  let i = 0;
  for (const s of slots) {
    await db.insert(activities).values({
      childId,
      text: s.make(first),
      time: time12(s.h, s.m),
      note: s.note ?? "",
      photo: s.photo && manifest[childId] ? manifest[childId] : "",
      createdAt: dateAt(daysAgo, s.h, s.m),
    });
    i++;
  }
  return i;
}

async function main() {
  let total = 0;
  let idx = 0;
  for (const c of roster.children) {
    const baby = BABY_IDS.has(c.id);
    // clear any prior activities for a clean, repeatable seed
    await db.delete(activities).where(eq(activities.childId, c.id));

    // two complete past days (with checkout -> day summary available)
    total += await seedDay(c.id, c.firstName, 2, baby ? babyDay(idx) : toddlerDay(idx));
    total += await seedDay(c.id, c.firstName, 1, baby ? babyDay(idx + 1) : toddlerDay(idx + 1));
    // today, in progress
    total += await seedDay(c.id, c.firstName, 0, partialDay(baby));

    console.log(`${c.id} ${c.firstName}: seeded feed (${baby ? "infant" : "toddler"})`);
    idx++;
  }
  console.log(`\nSeeded ${total} activities across ${roster.children.length} children.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
