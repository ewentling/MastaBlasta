# GitHub Copilot Instructions for This Project

You are helping me build a web app that allows easy posting to multiple social media platforms at once. The goal is to replicate the **core workflows** of:

- https://www.blotato.com/
- https://www.upload-post.com/
- https://getlate.dev/

without copying any code or proprietary assets from them. Use them only as *functional inspiration* (e.g., connecting accounts, composing posts, scheduling posts, managing queues/history).

---

## Project Overview

- The app lets users:
  - Connect multiple social media accounts.
  - Compose a post once and publish it to multiple platforms at the same time.
  - Optionally schedule posts for later.
  - View status/history of posts (pending, sent, failed, per-platform status).

- The app must:
  - Expose an HTTP API on **port 33766** (configurable via `PORT` env var, default 33766).
  - Run inside Docker (Dockerfile + docker-compose or similar).
  - Be structured for future expansion to more providers.

If you need to assume something that isn't specified, pick a **simple, common-sense default** and clearly state it in comments.

---

## Tech Stack

Use the following stack for all code unless I explicitly ask otherwise:

- **Backend**
  - Language: **TypeScript** (Node.js)
  - Framework: **Express**
  - Database: **PostgreSQL**
  - ORM: **Prisma**
  - API style: **REST JSON**

- **Frontend**
  - Framework: **React** with **TypeScript**
  - Build tool: **Vite**
  - UI: Simple, minimal styling (e.g., Tailwind or basic CSS modules)

- **General**
  - Package manager: **npm**
  - Use `.env` for secrets and configuration.
  - Use `docker-compose.yml` to run app + database.

If I haven't created the baseline project structure yet, generate everything needed to bootstrap this stack.

---

## High-Level Features

When designing and implementing, assume the app should have at least:

1. **User & Auth (basic)**
   - Local user accounts (email + password) or simple session for now.
   - Abstraction layer so we can later plug in OAuth providers if needed.
   - Basic auth-protected API routes and frontend pages.

2. **Social Account Connections**
   - Concept of "connected accounts" stored in the database.
   - For now, you may implement **mock integrations** or partial, documented examples (e.g., using provider interfaces and fake implementations), since real APIs (Twitter/X, Meta, etc.) need credentials and complex flows.
   - Design clear interfaces like `SocialProvider` with methods such as:
     - `authorize()`
     - `postContent()`
     - `getStatus()`

3. **Post Composition & Publishing**
   - Backend endpoints to:
     - Create a draft post with:
       - Text
       - Media references (image URLs or file uploads; for now you can stub file storage)
       - Target platforms
       - Optional scheduled date/time
     - Immediately publish a post to selected platforms.
     - Schedule posts for later (basic scheduling mechanism: cron-like loop or simple polling job).

4. **Scheduling / Queue**
   - A simple job runner (can be a Node cron job within the backend container) that:
     - Checks for posts scheduled in the past that are not yet sent.
     - Sends them to the appropriate providers.
     - Updates status per platform.

5. **Post Status & History**
   - Store sending attempts, status per platform (pending/sent/failed).
   - API endpoints to fetch a user's:
     - Upcoming scheduled posts
     - Recent posts and their per-platform statuses
   - Frontend pages to:
     - View scheduled queue
     - View history

---

## API Requirements

- The backend must:
  - Listen on `process.env.PORT || 33766`.
  - Provide a health check endpoint, e.g.:
    - `GET /health` → `{ status: "ok" }`
  - Provide REST endpoints for:
    - Auth (login/logout/basic user signup or simple session).
    - Managing connected social accounts (list, add mock provider config, remove).
    - Creating, updating, deleting draft posts.
    - Triggering immediate publish.
    - Listing scheduled posts.
    - Listing history of posts and statuses.

- Use clear route naming, for example:
  - `/api/auth/...`
  - `/api/accounts/...`
  - `/api/posts/...`

Document the API routes with brief comments or a simple Markdown file.

---

## Docker Requirements

- Provide a **Dockerfile** for the backend (and frontend if separate).
- Provide **docker-compose.yml** that:
  - Starts:
    - Backend (exposing port 33766 on the host).
    - Frontend (if separate, on a reasonable port).
    - PostgreSQL database.
  - Uses environment variables for DB credentials and app config.
- Ensure the default Docker setup allows:
  - `docker-compose up` → app is reachable on `http://localhost:33766` for the API.

---

## Code Organization & Quality

- Prefer **small, focused modules** and clear folder structure:
  - `backend/src/` with `routes/`, `controllers/`, `services/`, `models/` (or Prisma `schema.prisma`).
  - `frontend/src/` with `components/`, `pages/`, `hooks/`, etc.
- Always:
  - Use TypeScript types/interfaces consistently.
  - Add minimal but meaningful comments for non-trivial logic.
  - Avoid over-engineering; keep things as simple as possible for a first version.
- For each significant feature:
  - Create or update **basic tests** (e.g., Jest for backend).
  - Include example requests/responses where helpful.

---

## How I Want You to Respond

When I ask you to implement or change something:

1. **Modify existing code rather than rewriting from scratch** unless I explicitly ask for a refactor.
2. Show **full files** when changes are significant or when context matters; otherwise, show precise diffs/snippets plus filenames.
3. Mention any **new environment variables**, config changes, or additional commands I must run.
4. If requirements are unclear, briefly state the assumption you are making in code comments or at the top of your answer.

Start by:

1. Generating a project skeleton for the chosen stack (backend + frontend + Docker + Postgres).
2. Setting up:
   - Basic auth
   - A health check route
   - A simple stub for one `SocialProvider` (e.g., a mock provider that just logs posts to the database instead of calling a real API)
3. Then iteratively implement:
   - Draft creation
   - Immediate posting via the mock provider
   - Scheduling via a simple background job
   - History/queue views on the frontend.
