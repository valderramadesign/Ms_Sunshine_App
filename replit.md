# Miss Sunshine App

A childcare/daycare activity tracking React app with a warm, playful design inspired by Figma mockups.

## Architecture

- **Frontend**: React 18, TypeScript, Tailwind CSS, Framer Motion, wouter routing
- **Backend**: Express.js, Drizzle ORM, PostgreSQL
- **Styling**: Glass morphism, teal/cream/brown color palette, SF Pro Rounded font

## Deployment

- Hosted on Vercel, deployed from GitHub; no Replit runtime dependency
- `server/app.ts` — shared Express app factory (`createApp()`, memoized so warm serverless invocations reuse it) used by both entry points below
- `server/index.ts` — traditional Node entry point: creates the HTTP server, serves the Vite dev server or the static build, listens on `PORT`
- `api/index.ts` — Vercel serverless entry point: wraps the same Express app for `vercel.json`'s catch-all `/api` rewrite
- `vercel.json` — build/output config and `/api` + SPA rewrites
- Client build output: `dist/public` (via `vite build`)

## Database

- PostgreSQL via Drizzle ORM
- Tables: `children`, `activities`, `feed_comments`, `feed_likes`, `teachers`
- `teachers` table stores: id, first_name, last_name, photo, relation, phone, email, address
- Children table stores: id, first_name, last_name, photo, birthday, guardians (JSON string with name/relation/contact/email), enrollment_date, graduation_date, address, allergies, medications, doctor, doctor_phone, note
- Activities table stores: id, child_id, text, time, note, photo, created_at
- feed_comments table stores: id, activity_id, text, time, role (always `"teacher"`), account_id (repurposed to hold an anonymous per-device UUID, used for authorship display only — not tied to any login), created_at
- feed_likes table stores: id, activity_id, role (always `"teacher"`), account_id (repurposed to hold an anonymous per-device UUID, used for "mine" like-state only — not tied to any login), created_at
- No seed data: the app starts empty and all people/activities are created through the UI (add children/teachers/guardians directly — there is no onboarding flow)
- Deleting an activity cascades to remove its comments and likes

## Key Routes

- `/` — Redirects to `/home`
- `/home` — Home (Activities feed)
- `/school` — School page with 3 tabs: Kids (DB-backed children list), Parents (auto-derived read-only from each child's guardians), Teachers (DB-backed). Tab persisted via `?tab=` query param; top tab bar has a search magnifier that filters the active list by name.
- `/school/add` — Add a new child
- `/school/add-teacher` — Add a new teacher (persists to `teachers` table)
- `/school/add-guardian` — Add a new guardian; requires selecting a child, appends the guardian (with photo) to that child's guardians JSON
- `/school/:childId` — Child activity feed
- `/school/:childId/details` — Child details/edit page (saves to DB)
- `/select-children` — Select children for activity
- `/select-items` — Select activity items
- `/add-note` — Add note and photos to activity
- `/success` — Success confirmation

## API Endpoints

- `GET /api/children` — List all children
- `GET /api/children/:id` — Get a single child
- `PUT /api/children/:id` — Update/create a child (Zod validated)
- `POST /api/generate-activity-image` — AI image generation
- `GET /api/activities/:childId` — List activities for a child
- `POST /api/activities` — Create activities (bulk for multiple children)
- `PATCH /api/activities/:id/text` — Update activity text
- `PATCH /api/activities/:id/note` — Update activity note
- `PATCH /api/activities/:id/photo` — Update activity photo
- `PATCH /api/activities/:id/time` — Update activity time
- `DELETE /api/activities/:id` — Delete activity (cascades comments/likes)
- `GET /api/comments/:activityId` — List comments for an activity
- `POST /api/comments` — Add a comment (activityId, text, time, deviceId)
- `PATCH /api/comments/:id` — Edit a comment
- `DELETE /api/comments/:id` — Delete a comment
- `GET /api/likes/:activityId?deviceId=...` — List likes for an activity; each entry has `mine: boolean` instead of a raw account id
- `POST /api/likes/toggle` — Toggle like for an activity (activityId, deviceId)
- `POST /api/summarize-day` — AI day summary generation
- `GET /api/teachers` — List all teachers
- `POST /api/teachers` — Create a teacher (Zod validated via `insertTeacherSchema`)

## Security

- There is no login, onboarding, or session system — every visitor gets full, unauthenticated access to the app. This is intentional: the app is single-tenant (one daycare) and has no parent/teacher/admin role distinction.
- Comment/like "authorship" uses a client-generated anonymous per-device UUID (`getDeviceId()`, `client/src/lib/deviceId.ts`, persisted in `localStorage`) sent as `deviceId` — used only to show "mine" like-state and comment attribution, never for access control.
- AI endpoints (`/api/generate-activity-image`, `/api/summarize-day`) are rate-limited + concurrency-capped. Buckets are in-memory (`Map`), so limits are per-instance, not shared across concurrent Vercel invocations
- Security headers: nosniff, Referrer-Policy, Permissions-Policy (X-Frame-Options intentionally omitted — a carryover from Replit's iframe-embedded preview; worth reconsidering now that the app is deployed standalone)

## Real-Time Sync

- Client-side polling every 5s — no persistent connection, since Vercel's serverless functions can't hold long-lived SSE streams or in-memory client lists
- Client hook: `client/src/lib/useRealtimeSync.ts` — invalidates all React Query caches on each tick; skips the tick while the tab is hidden and invalidates immediately on regaining focus (`document.visibilitychange`)
- All devices poll the same deployed backend
- Trade-off: a poll tick carries no per-event metadata, so there are no cross-device toasts (e.g. "Someone left a comment...") — devices just refetch and re-render silently

## Responsive Layout

- All body content uses `w-full px-[24px]` for full-width with 24px margins on both sides
- Grid items (SelectItems, Home activities) use `w-full aspect-square` instead of fixed pixel widths
- Modals/dialogs use `w-full max-w-[...] mx-[24px]` to stay fluid with a reasonable max
- Child name text uses `truncate flex-1 min-w-0` instead of fixed widths
- PageHeader color bar, BottomNav, and BottomCTA all use `w-full`

## Design System

- Primary CTA gradient: `linear-gradient(135deg, #5CD1E6 0%, #42ACBF 50%, #288899 100%)`
- Glass card: `bg-[#ffffff1a] border border-solid border-white shadow-[...] backdrop-blur-[2.0px]`
- Input style: `rounded-[12px] border-[#e0d9cc] bg-[#fafaf8] text-[#7a3428]`
- Labels: `text-[#288899] text-[13px] font-semibold`
- Photo border rings: amber #EBA63A → red #B34D3B → teal #288899 (4px each)
- Dark green icon filter for action icons
- Like active color: #EBA63A (amber)

## Image Generation Style

Activity icons (generated from the "icon discription" field in the new-activity modal via `POST /api/generate-activity-image`, model `gpt-image-1`) use a **soft hand-drawn watercolor cartoon** style on a **clean white background** (API `background: "opaque"`):
- Thick dark pencil-sketch outlines, pastel colors, curved watercolor shading, white highlight spots, subtle paper texture, light watercolor shadow washes
- People are faceless rounded figures: adults are taller with long soft limbs and circular heads; children are clearly smaller, chubbier, shorter-limbed, and playful
- Mitten hands, no fingers, no facial features, minimal clothing detail
- Objects are chunky, toy-like, geometric, slightly imperfect
- Warm, simple, cheerful, uncluttered; avoid realism, sharp vector art, gradients, text, logos, detailed backgrounds
- The exact generation prompt lives in `server/routes.ts` (the `prompt` in the `/api/generate-activity-image` route); the user's icon-description text is injected as the subject
- Generated images are returned directly as a base64 data URL in the API response — nothing is written to disk (required for Vercel's ephemeral serverless filesystem)
- White margins are auto-trimmed via `sharp`'s `.trim()` so the figure fills the frame

## Shared Components

- `client/src/components/PageHeader.tsx` — Reusable page header with color bar (group-2.png), title row with optional back navigation (white circle with tailed arrow) and action button. Title and action text share the same bottom baseline. Props: `title`, `actionText`, `onAction`, `backTo`, `onBackClick`, `onTitleClick`, `actionNode`, `hideTitleRow`.
- `client/src/components/BottomNav.tsx` — Shared bottom navigation with 2 tabs (activities/school), 3 color bars (teal/red/amber, 8px each), white background, checkmark badge on active tab. Props: `active`. Used in Home, School. Height: 113px.
- `client/src/components/BottomCTA.tsx` — Shared bottom call-to-action wrapper with same 3 color bars, white background area, 16px vertical gap between children. Height: 159px. Used in SelectChildren, SelectItems, AddChild, ChildDetails, Success, AddNoteAndPhotos.
- `client/src/components/PersonForm.tsx` — Shared add-person form (photo upload, first/last name, relation, phone, email, address) with optional child selector. Photos read as base64 data URLs (persist in DB). Used by AddTeacher and AddGuardian. Title color #8f530f, green CTA gradient, mobile keyboard toolbar + desktop BottomCTA variants.

## Key Files

- `shared/schema.ts` — Database schema and Zod types
- `server/db.ts` — Database connection
- `server/storage.ts` — Storage interface and implementation
- `server/routes.ts` — API routes
- `client/src/pages/` — All page components
- `client/src/components/` — Shared components (PageHeader, BottomNav, BottomCTA)
- `client/src/lib/activityStore.tsx` — Activity state management
