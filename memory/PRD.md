# MoneySeeker — PRD

## Original Problem Statement
Job search & application tracker mobile app (Expo). Users search/filter job listings,
save to a shortlist, track applications through kanban stages (Saved, Applied,
Interviewing, Offer, Rejected), upload/store multiple resume versions, and add notes +
follow-up reminders per application. Email + Google login. Mobile-first, clean, minimal.
Delivered in phases:
- P1: Data model + auth (no UI)
- P2: Job search screen (search bar, filters, results list, detail with Save/Apply)
- P3: Application tracker kanban (drag between columns, notes, follow-up reminders)
- P4: Apify job-scraper integration (live listings mapped to Job model)
- P5: AI resume-match score + tailored cover letter generation

## User Choices
- Auth: Email/password (JWT) + Emergent-managed Google login
- Resume: stored as extracted text/content for analysis (local scan data)
- Phase 4 source: Apify job-scraper actor (user provides Apify token)
- Phase 5 AI: Claude Sonnet 5 / GPT-5.4
- Phase 1 scope: schema + auth + testable CRUD endpoints

## Architecture
- Frontend: Expo Router (React Native, SDK 54) — not started yet
- Backend: FastAPI, modular routers (auth, jobs, resumes, applications)
- DB: MongoDB (motor). UUID string ids everywhere; `_id` never exposed.
- Files: backend/{db,models,auth,routes_jobs,routes_resumes,routes_applications,server}.py

## Data Model (v1)
- User: user_id, email, name, picture, auth_provider (email|google), created_at (+password_hash internal)
- user_sessions: session_token, user_id, created_at, expires_at (TTL 7d)
- Job: job_id, title, company, location, remote_type (remote|onsite|hybrid),
  salary_min/max, currency, experience_level (intern|entry|mid|senior|lead),
  description, company_logo, tags[], source (seed|apify|manual), external_id, url, created_at
- Resume: resume_id, user_id, version_name, file_name, content, is_default, created_at, updated_at
- Application: application_id, user_id, job_id, job (denormalized snapshot),
  status (Saved|Applied|Interviewing|Offer|Rejected), resume_id, follow_up_date,
  notes[] ({note_id, text, created_at}), order, created_at, updated_at

## API (implemented, curl-verified)
- Auth: POST /api/auth/register, /login, /session (google), GET /me, POST /logout
- Jobs: POST /api/jobs, GET /api/jobs (q, location, remote_type, experience_level, salary_min/max),
  GET /api/jobs/{id}, POST /api/jobs/seed
- Resumes: POST/GET /api/resumes, GET/PUT/DELETE /api/resumes/{id}
- Applications: POST/GET /api/applications (?status), GET/PATCH/DELETE /api/applications/{id},
  POST /api/applications/{id}/notes, DELETE /api/applications/{id}/notes/{note_id}

## Implemented
- [x] P1 (2026-08-15): Data model, email+google auth, full CRUD for jobs/resumes/applications, sample seeder
- [x] P2 (2026-08-15): Full frontend — auth screen (email + Google), bottom-tab nav (Search/Tracker/Resumes/Profile),
  job search (search bar, quick pills, filter bottom sheet, results list), job detail (Save/Apply, sticky glass CTA),
  functional tracker (status-segmented), resumes (add/list/default/delete), profile (stats + logout).
  Design system: Geist font, warm sand + sage green, testIDs everywhere. All tests green (backend 19/19, frontend 17/17).
- [x] P3 (2026-06): Kanban tracker — horizontally scrollable columns (Saved→Rejected), long-press drag-and-drop
  between columns (reanimated ghost card, edge auto-scroll, target column highlight), tap card → ApplicationSheet
  bottom sheet with stage chips, follow-up reminder quick-picks (tomorrow/3d/1w/2w + clear), notes add/delete,
  remove from tracker. PATCH /applications now uses exclude_unset so follow_up_date can be cleared with null.
- [x] P4 (2026-06): Live jobs — Remotive free API (no key). POST /api/jobs/sync?q= fetches, maps to Job model
  (salary parsing, experience inference from title, HTML-stripped description), dedupes by external_id,
  source="remotive". Search screen syncs on first load, pull-to-refresh, and search submit; LIVE pill on job cards.
  NOTE: user originally wanted Apify but had no token; chose free alternative.
- [x] P5 (2026-06): AI extras via Emergent LLM key + claude-sonnet-5 (emergentintegrations).
  POST /api/ai/match {job_id, resume_id?} → {score 0-100, summary, strengths[], gaps[]};
  POST /api/ai/cover-letter → {cover_letter}. Uses default resume if resume_id omitted; 400 if no resume.
  Frontend: "AI Assistant" section on job detail (AiTools.tsx) — resume selector chips, match score ring,
  strengths/gaps lists, cover letter with copy (expo-clipboard).

## Testing
- 2026-06: testing_agent iteration_2 — backend 12/12 passed (sync idempotency, reminder set/clear, notes, AI match/letter),
  all frontend flows verified on mobile viewport. Backend test suite: /app/backend/tests/test_phase345.py
- Known non-blocking: react-native-web deprecation warnings; clearbit logos blocked in sandbox.
  BottomSheetTextInput web incompatibility fixed by using plain TextInput on web.

## Backlog
- (none — all 5 phases complete). Ideas: reminder push notifications on follow-up dates (needs native build),
  Apify integration if user later provides a token, resume file upload (PDF parse) via object storage.

## Test Accounts
See /app/memory/test_credentials.md
