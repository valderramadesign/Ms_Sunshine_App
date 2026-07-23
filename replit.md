# Miss Sunshine App

A childcare/daycare activity tracking React app with a warm, playful design inspired by Figma mockups.

## Architecture

- **Frontend**: React 18, TypeScript, Tailwind CSS, Framer Motion, wouter routing
- **Backend**: Express.js, Drizzle ORM, PostgreSQL
- **Styling**: Glass morphism, teal/cream/brown color palette, SF Pro Rounded font

## Database

- PostgreSQL via Drizzle ORM
- Tables: `children`, `activities`, `feed_comments`, `feed_likes`, `teachers`, `admin_account`, `accounts`, `invitations`, `password_resets`, `session`
- `teachers` table stores: id, first_name, last_name, photo, relation, phone, email, address
- Children table stores: id, first_name, last_name, photo, birthday, guardians (JSON string with name/relation/contact/email), enrollment_date, graduation_date, address, allergies, medications, doctor, doctor_phone, note
- Activities table stores: id, child_id, text, time, note, photo, created_at
- feed_comments table stores: id, activity_id, text, time, role (parent/teacher), created_at
- feed_likes table stores: id, activity_id, role (parent/teacher), created_at
- No seed data: the app starts empty and all people/activities are created through the UI (admin onboarding → add children/teachers/guardians)
- Deleting an activity cascades to remove its comments and likes

## Key Routes

- `/` — Admin login; redirects to `/onboarding/admin` when no admin account exists yet
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
- `POST /api/comments` — Add a comment (activityId, text, time, role)
- `PATCH /api/comments/:id` — Edit a comment
- `DELETE /api/comments/:id` — Delete a comment
- `GET /api/likes/:activityId` — List likes for an activity
- `POST /api/likes/toggle` — Toggle like for an activity (activityId, role)
- `POST /api/summarize-day` — AI day summary generation
- `GET /api/teachers` — List all teachers
- `POST /api/teachers` — Create a teacher (Zod validated via `insertTeacherSchema`; broadcasts `teachers` SSE event)

## Security

- Session auth (scrypt-hashed passwords, timing-safe compare); roles enforced server-side on every route
- Parent isolation: parents only see/access their own children (404 on foreign data); SSE filtered per parent
- Rate limits: login, admin register, forgot/reset password, invitation accept (20/15min per IP); AI endpoints rate-limited + concurrency-capped; SSE connection caps
- `POST /api/admin/register` gated in production by `ADMIN_SETUP_TOKEN` (constant-time compare; token passed via onboarding link `?setup=...`); route also closed once an admin exists
- `SESSION_SECRET` required in production (server refuses to start without it)
- Admin onboarding credentials held in memory only (`client/src/lib/onboardingCredentials.ts`), never in sessionStorage
- Email HTML variables escaped (`escapeHtml` in `server/email.ts`); PII masked in server logs
- Security headers: nosniff, Referrer-Policy, Permissions-Policy (X-Frame-Options omitted for workspace iframe previews)

## Real-Time Sync

- Server-Sent Events (SSE) via `GET /api/events` for push updates
- Server module: `server/sse.ts` — manages client connections, heartbeat (25s), and broadcast
- Client hook: `client/src/lib/useRealtimeSync.ts` — connects to SSE, invalidates React Query caches
- Events: `activities` (childIds, action), `comments` (activityId, action), `likes` (activityId, action), `children` (childId, action), `teachers` (action)
- Auto-reconnect on disconnect (3s delay)
- Both teacher and parent devices connect to the same published backend

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
- Generating a new icon first **deletes all previous `.png` files** in `client/public/generatedAssets/` (only the latest generated icon is kept on disk)
- White margins are auto-trimmed via ImageMagick `-trim` so the figure fills the frame

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
