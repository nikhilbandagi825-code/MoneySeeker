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

## Implemented (2026-08-15)
- [x] P1: Data model, email+google auth, full CRUD for jobs/resumes/applications, sample seeder

## Backlog
- P2 (next): Job search UI + detail screen (Save/Apply)
- P3: Kanban tracker with drag-and-drop, notes, follow-up date picker
- P4: Apify integration + field mapping
- P5: AI resume match score + cover letter generator

## Test Accounts
See /app/memory/test_credentials.md
