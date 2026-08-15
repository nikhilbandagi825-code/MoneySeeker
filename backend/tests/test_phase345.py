"""Phase 3-5 backend tests: live job sync, applications (notes, follow-up clear), AI (match, cover letter).

Uses seeded tester@moneyseeker.app / Test1234! from /app/memory/test_credentials.md.
"""
import requests


# --- Auth sanity for new credentials ---
def test_phase345_login_new_creds(api_base, session):
    r = session.post(
        f"{api_base}/auth/login",
        json={"email": "tester@moneyseeker.app", "password": "Test1234!"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["session_token"]
    assert body["user"]["email"] == "tester@moneyseeker.app"


# --- Phase 4: Live jobs sync (Remotive) ---
class TestJobsSync:
    def test_sync_no_query(self, api_base, auth_headers):
        r = requests.post(f"{api_base}/jobs/sync", headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "synced" in body and "total_jobs" in body
        assert isinstance(body["synced"], int)
        assert body["synced"] >= 0

    def test_sync_is_idempotent(self, api_base, auth_headers):
        # First sync
        r1 = requests.post(f"{api_base}/jobs/sync", headers=auth_headers, timeout=30)
        assert r1.status_code == 200
        # Second sync should produce 0 new (deduped by external_id)
        r2 = requests.post(f"{api_base}/jobs/sync", headers=auth_headers, timeout=30)
        assert r2.status_code == 200
        assert r2.json()["synced"] == 0, "Re-sync should be idempotent (dedupe by external_id)"

    def test_sync_with_query(self, api_base, auth_headers):
        r = requests.post(
            f"{api_base}/jobs/sync?q=developer", headers=auth_headers, timeout=30
        )
        assert r.status_code == 200
        body = r.json()
        assert "synced" in body

    def test_remotive_jobs_have_source_and_live_flag(self, api_base, auth_headers):
        # ensure at least one remotive job exists
        requests.post(f"{api_base}/jobs/sync", headers=auth_headers, timeout=30)
        jobs = requests.get(f"{api_base}/jobs", headers=auth_headers).json()
        remotive_jobs = [j for j in jobs if j.get("source") == "remotive"]
        assert len(remotive_jobs) > 0, "Expected at least one remotive-sourced job in DB"
        # Check no _id leakage
        for j in remotive_jobs[:3]:
            assert "_id" not in j
            assert j["source"] == "remotive"


# --- Phase 3: Applications (status, follow-up date null, notes) ---
class TestApplicationsPhase3:
    def _ensure_app(self, api_base, auth_headers):
        """Return an application_id for the tester user (create if none)."""
        apps = requests.get(f"{api_base}/applications", headers=auth_headers).json()
        if apps:
            return apps[0]["application_id"]
        # else create one
        requests.post(f"{api_base}/jobs/seed", headers=auth_headers)
        jobs = requests.get(f"{api_base}/jobs", headers=auth_headers).json()
        # Pick a job not already saved
        saved_ids = {a["job_id"] for a in apps}
        candidate = next(j for j in jobs if j["job_id"] not in saved_ids)
        r = requests.post(
            f"{api_base}/applications",
            headers=auth_headers,
            json={"job_id": candidate["job_id"], "status": "Saved"},
        )
        assert r.status_code == 200, r.text
        return r.json()["application_id"]

    def test_patch_status(self, api_base, auth_headers):
        aid = self._ensure_app(api_base, auth_headers)
        r = requests.patch(
            f"{api_base}/applications/{aid}",
            headers=auth_headers,
            json={"status": "Interviewing"},
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "Interviewing"

        # Verify persistence via GET
        g = requests.get(f"{api_base}/applications/{aid}", headers=auth_headers)
        assert g.status_code == 200
        assert g.json()["status"] == "Interviewing"

    def test_patch_set_follow_up_date_then_clear_null(self, api_base, auth_headers):
        aid = self._ensure_app(api_base, auth_headers)

        # set follow-up
        r = requests.patch(
            f"{api_base}/applications/{aid}",
            headers=auth_headers,
            json={"follow_up_date": "2026-02-15T09:00:00Z"},
        )
        assert r.status_code == 200
        assert r.json()["follow_up_date"] is not None
        # verify persist
        g = requests.get(f"{api_base}/applications/{aid}", headers=auth_headers)
        assert g.json()["follow_up_date"] is not None

        # clear follow-up via null
        r2 = requests.patch(
            f"{api_base}/applications/{aid}",
            headers=auth_headers,
            json={"follow_up_date": None},
        )
        assert r2.status_code == 200, r2.text
        assert r2.json()["follow_up_date"] is None, "follow_up_date must be cleared to null"

        # Verify null persisted
        g2 = requests.get(f"{api_base}/applications/{aid}", headers=auth_headers)
        assert g2.status_code == 200
        assert g2.json()["follow_up_date"] is None, "follow_up_date null must persist in DB"

    def test_notes_add_and_delete(self, api_base, auth_headers):
        aid = self._ensure_app(api_base, auth_headers)

        r = requests.post(
            f"{api_base}/applications/{aid}/notes",
            headers=auth_headers,
            json={"text": "TEST_phase3_note"},
        )
        assert r.status_code == 200, r.text
        notes = r.json()["notes"]
        assert any(n["text"] == "TEST_phase3_note" for n in notes)
        note_id = next(n["note_id"] for n in notes if n["text"] == "TEST_phase3_note")

        # Verify persist
        g = requests.get(f"{api_base}/applications/{aid}", headers=auth_headers)
        assert any(n["note_id"] == note_id for n in g.json()["notes"])

        # Delete
        d = requests.delete(
            f"{api_base}/applications/{aid}/notes/{note_id}", headers=auth_headers
        )
        assert d.status_code == 200
        assert all(n["note_id"] != note_id for n in d.json()["notes"])

        # Verify gone
        g2 = requests.get(f"{api_base}/applications/{aid}", headers=auth_headers)
        assert all(n["note_id"] != note_id for n in g2.json()["notes"])


# --- Phase 5: AI (match + cover letter) ---
class TestAI:
    def _pick_job(self, api_base, auth_headers):
        jobs = requests.get(f"{api_base}/jobs", headers=auth_headers).json()
        assert len(jobs) > 0
        # prefer a seeded (rich desc) job
        seeded = [j for j in jobs if j.get("source") == "seed"]
        return (seeded[0] if seeded else jobs[0])["job_id"]

    def test_ai_match_default_resume(self, api_base, auth_headers):
        job_id = self._pick_job(api_base, auth_headers)
        r = requests.post(
            f"{api_base}/ai/match",
            headers=auth_headers,
            json={"job_id": job_id},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data["score"], int) and 0 <= data["score"] <= 100
        assert isinstance(data["summary"], str) and len(data["summary"]) > 0
        assert isinstance(data["strengths"], list)
        assert isinstance(data["gaps"], list)

    def test_ai_match_bad_job(self, api_base, auth_headers):
        r = requests.post(
            f"{api_base}/ai/match",
            headers=auth_headers,
            json={"job_id": "job_missing_xyz"},
            timeout=30,
        )
        assert r.status_code == 404

    def test_ai_cover_letter(self, api_base, auth_headers):
        job_id = self._pick_job(api_base, auth_headers)
        r = requests.post(
            f"{api_base}/ai/cover-letter",
            headers=auth_headers,
            json={"job_id": job_id},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        letter = r.json()["cover_letter"]
        assert isinstance(letter, str)
        assert len(letter.strip()) > 100, "Cover letter looks too short"

    def test_ai_match_no_resume_user(self, api_base, session, unique_email):
        """A fresh user with no resume should get 400 with helpful message."""
        # register throwaway
        r = session.post(
            f"{api_base}/auth/register",
            json={"email": unique_email, "password": "Passw0rd!", "name": "No Resume"},
        )
        assert r.status_code == 200, r.text
        token = r.json()["session_token"]
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

        # need a job in DB
        jobs = requests.get(f"{api_base}/jobs", headers=headers).json()
        assert len(jobs) > 0
        job_id = jobs[0]["job_id"]

        rm = requests.post(
            f"{api_base}/ai/match",
            headers=headers,
            json={"job_id": job_id},
            timeout=30,
        )
        assert rm.status_code == 400, rm.text
        assert "resume" in rm.json()["detail"].lower()
