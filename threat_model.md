# Threat Model

## Project Overview

Miss Sunshine is a public-facing React + Express childcare activity tracking application backed by PostgreSQL. Teachers, parents, and the school owner use the same deployed backend to view and update child activity feeds, guardian details, teacher records, and school branding data. In production, the primary security question is whether internet clients can access or modify daycare records without a server-verified identity and whether recovery/bootstrap flows can be abused to seize that identity.

## Assets

- **Child records and health-adjacent data** — names, birthdays, addresses, allergies, medications, doctor details, notes, and photos in `children`.
- **Guardian contact data** — guardian names, relationships, phone numbers, emails, photos, and addresses stored inside the `children.guardians` JSON field.
- **Teacher and owner contact data** — teacher profile fields plus owner/admin-derived email, phone, address, and photo exposed through teacher-facing APIs.
- **Activity feed content and authorship** — activity text, notes, photos, comments, likes, and timestamps. Integrity matters as much as confidentiality because families and staff rely on the feed as a record of who communicated what.
- **Administrative control of the school profile** — onboarding state, owner profile fields, school branding/logo, and the ability to represent the daycare as the owner.
- **Authentication and recovery secrets** — session cookies, invitation tokens, password-reset tokens, and the server-side admin setup token.
- **Application secrets** — database credentials and the OpenAI integration key/base URL kept in environment variables.

## Trust Boundaries

- **Browser to API** — every route under `/api/*` crosses from an untrusted client into the server and must authenticate and authorize requests server-side.
- **API to PostgreSQL** — the Express server has direct write access to all core records; any missing access control at the API layer becomes full database compromise for the exposed tables.
- **API to outbound email / recovery links** — password-reset and invitation flows cross from the app into email delivery. URLs embedded in those emails must be built from a trusted canonical origin, not attacker-controlled request metadata.
- **API to external AI provider** — `/api/generate-activity-image` and `/api/summarize-day` send data from the app to an OpenAI-compatible endpoint using server-held credentials.
- **Public vs authenticated users** — the deployment is public, so any control that only exists in client routing, localStorage, or hidden UI is not a real boundary.
- **Owner/admin vs teacher vs parent** — role distinctions shown in the UI must be enforced by the backend; client-selected roles are attacker-controlled input.
- **Development-only vs production** — Vite/dev-server behavior is out of scope in production; the production scan should focus on `server/index.ts`, `server/routes.ts`, `server/sse.ts`, `server/storage.ts`, and the browser code that drives those APIs.

## Scan Anchors

- Production entry point: `server/index.ts`.
- Highest-risk code: `server/routes.ts` and `server/sse.ts` because they define externally reachable data access, mutation paths, and recovery flows.
- Sensitive data model: `shared/schema.ts` (`children`, `teachers`, `admin_account`, `accounts`, `invitations`, `password_resets`, `activities`, `feed_comments`, `feed_likes`).
- Public auth surfaces: `/api/login`, `/api/admin/login`, `/api/auth/forgot-password`, `/api/auth/reset-password/:token`, `/api/invitations/:token`, `/api/invitations/:token/accept`, `/api/admin/register`, and `/api/events`.
- `getBaseUrl()` in `server/routes.ts` is security-sensitive because it feeds password-reset and invitation email links.
- Feed comments/likes should be checked for per-account actor binding, not just coarse `parent`/`teacher` role checks.
- Client-side role handling in `client/src/lib/roleStore.ts` is not a security control and should never be treated as authorization.
- `server/replit_integrations/` appears non-owning for the main app unless future scans find route registration from `server/index.ts`.

## Threat Categories

### Spoofing

This project presents parent, teacher, and owner/admin experiences, so the server must be able to distinguish who is making a request. The application must require a real authenticated session or equivalent credential for any route that exposes daycare data or mutates records. Client-chosen roles, URL paths, and successful navigation after login are not proof of identity. Public login, invitation, reset-password, and admin-bootstrap routes must resist brute-force and token-capture abuse.

### Tampering

Untrusted clients can create, edit, and delete child records, activities, comments, likes, guardian data, and teacher profiles. The backend must ensure only authorized users can perform those operations and must scope writes to records they are permitted to manage. Feed interactions must be bound to the specific authenticated account, not just a broad role label, so one parent or teacher cannot overwrite another actor’s records.

### Information Disclosure

The application stores highly sensitive personal information about children, guardians, and staff. API responses and SSE events must only disclose data to authorized users with a need to know, and responses should be scoped to the relevant child or staff relationship. Recovery and onboarding emails must not disclose valid tokens to attacker-controlled domains through untrusted host-derived link generation.

### Denial of Service

Public endpoints can be abused to create excessive writes, open many SSE connections, or trigger repeated AI-backed requests. The system should prevent unauthenticated abuse of expensive or state-changing operations and avoid allowing arbitrary internet clients to consume persistent server resources. Authentication endpoints also need abuse controls so attackers cannot run unlimited online guessing campaigns.

### Elevation of Privilege

The owner/admin bootstrap and owner profile flows are privileged operations. `/api/admin/register` is currently intended to be gated by a server-side `ADMIN_SETUP_TOKEN`; future scans should preserve that assumption and validate that no alternate path bypasses it. More broadly, privilege boundaries between owner, teacher, parent, and unauthenticated users must be enforced server-side on every sensitive route, and password-reset or invitation links must always resolve to the trusted application origin so they cannot be used to seize higher-privilege accounts.
