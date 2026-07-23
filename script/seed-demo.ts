// One-off demo seeder: populates children (with guardians) and teachers,
// using portraits compressed into base64 data URLs.
// Run: npx tsx --env-file=.env script/seed-demo.ts
import { readFileSync } from "fs";
import path from "path";
import { storage } from "../server/storage";
import { pool } from "../server/db";

const DATA_DIR = path.join(import.meta.dirname, "data");

type RosterGuardian = {
  id: string;
  firstName: string;
  lastName: string;
  relation: string;
  phoneNumber: string;
  email: string;
  address: string;
};
type RosterChild = {
  id: string;
  firstName: string;
  lastName: string;
  birthday: string;
  enrollmentDate: string;
  graduationDate: string;
  allergies: string;
  medications: string;
  doctor: string;
  doctorPhone: string;
  note: string;
  guardians: RosterGuardian[];
};
type RosterTeacher = {
  id: string;
  firstName: string;
  lastName: string;
  relation: string;
  phone: string;
  email: string;
  address: string;
};

const roster = JSON.parse(readFileSync(path.join(DATA_DIR, "roster.json"), "utf8")) as {
  children: RosterChild[];
  teachers: RosterTeacher[];
};
const manifest = JSON.parse(readFileSync(path.join(DATA_DIR, "portraits-manifest.json"), "utf8")) as Record<
  string,
  string
>;

function photoFor(id: string): string {
  const p = manifest[id];
  if (!p) throw new Error(`missing portrait for ${id}`);
  return p;
}

async function main() {
  let childCount = 0;
  for (const c of roster.children) {
    const guardians = c.guardians.map((g) => ({
      name: `${g.firstName} ${g.lastName}`.trim(),
      relation: g.relation,
      contact: g.phoneNumber,
      email: g.email,
      photo: photoFor(g.id),
      address: g.address,
    }));
    await storage.upsertChild({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      photo: photoFor(c.id),
      birthday: c.birthday,
      guardians: JSON.stringify(guardians),
      enrollmentDate: c.enrollmentDate,
      graduationDate: c.graduationDate,
      address: c.guardians[0]?.address ?? "",
      allergies: c.allergies,
      medications: c.medications,
      doctor: c.doctor,
      doctorPhone: c.doctorPhone,
      note: c.note,
    });
    childCount++;
    console.log(`child ${c.id} ${c.firstName} ${c.lastName} (+${guardians.length} guardians)`);
  }

  let teacherCount = 0;
  for (const t of roster.teachers) {
    await storage.createTeacher({
      firstName: t.firstName,
      lastName: t.lastName,
      photo: photoFor(t.id),
      relation: "teacher",
      phone: t.phone,
      email: t.email,
      address: t.address,
    });
    teacherCount++;
    console.log(`teacher ${t.id} ${t.firstName} ${t.lastName}`);
  }

  console.log(`\nSeeded ${childCount} children and ${teacherCount} teachers.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
