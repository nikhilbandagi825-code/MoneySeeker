"""End-to-end backend tests for MoneySeeker Phase 2.

Covers: health, auth (register/login/me/logout), jobs (seed/search/filters/detail),
resumes (CRUD + default toggle), applications (create/list/update status/notes/delete).
"""
import requests

# --- Health ---
def test_health(api_base):
    r = requests.get(f"{api_base}/health", timeout=10)
    assert r.status_code == 200
    assert r.json().get("status") == "healthy"


def test_root(api_base):
    r = requests.get(f"{api_base}/", timeout=10)
    assert r.status_code == 200


# --- Auth ---
class TestAuth:
    def test_login_seeded_user(self, api_base, session):
        r = session.post(
            f"{api_base}/auth/login",
            json={"email": "tester@moneyseeker.dev", "password": "Test@1234"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "session_token" in body and body["session_token"]
        assert body["user"]["email"] == "tester@moneyseeker.dev"
        assert "_id" not in body["user"]

    def test_login_wrong_password(self, api_base, session):
        r = session.post(
            f"{api_base}/auth/login",
            json={"email": "tester@moneyseeker.dev", "password": "wrong-pw"},
        )
        assert r.status_code == 401

    def test_me_requires_auth(self, api_base):
        r = requests.get(f"{api_base}/auth/me")
        assert r.status_code == 401

    def test_me_returns_user(self, api_base, auth_headers):
        r = requests.get(f"{api_base}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == "tester@moneyseeker.dev"

    def test_register_new_user_and_login_persists(self, api_base, session, unique_email):
        r = session.post(
            f"{api_base}/auth/register",
            json={"email": unique_email, "password": "Passw0rd!", "name": "New User"},
        )
        assert r.status_code == 200, r.text
        token = r.json()["session_token"]

        # /auth/me works with the new token
        me = requests.get(
            f"{api_base}/auth/me", headers={"Authorization": f"Bearer {token}"}
        )
        assert me.status_code == 200
        assert me.json()["email"] == unique_email

        # duplicate registration blocked
        r2 = session.post(
            f"{api_base}/auth/register",
            json={"email": unique_email, "password": "Passw0rd!", "name": "Dup"},
        )
        assert r2.status_code == 409

        # login with new user works
        r3 = session.post(
            f"{api_base}/auth/login",
            json={"email": unique_email, "password": "Passw0rd!"},
        )
        assert r3.status_code == 200

    def test_logout_invalidates_token(self, api_base, session, unique_email):
        # register a throwaway user, then logout
        r = session.post(
            f"{api_base}/auth/register",
            json={"email": unique_email, "password": "Passw0rd!", "name": "Bye"},
        )
        assert r.status_code == 200
        tok = r.json()["session_token"]
        h = {"Authorization": f"Bearer {tok}"}
        assert requests.get(f"{api_base}/auth/me", headers=h).status_code == 200
        assert requests.post(f"{api_base}/auth/logout", headers=h).status_code == 200
        assert requests.get(f"{api_base}/auth/me", headers=h).status_code == 401


# --- Jobs ---
class TestJobs:
    def test_search_requires_auth(self, api_base):
        r = requests.get(f"{api_base}/jobs")
        assert r.status_code == 401

    def test_seed_and_list_jobs(self, api_base, auth_headers):
        r = requests.post(f"{api_base}/jobs/seed", headers=auth_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["total_jobs"] >= 9

        r = requests.get(f"{api_base}/jobs", headers=auth_headers)
        assert r.status_code == 200
        jobs = r.json()
        assert isinstance(jobs, list) and len(jobs) >= 9
        j = jobs[0]
        for k in ("job_id", "title", "company", "remote_type", "experience_level"):
            assert k in j
        assert "_id" not in j

    def test_search_by_query(self, api_base, auth_headers):
        r = requests.get(f"{api_base}/jobs?q=React", headers=auth_headers)
        assert r.status_code == 200
        results = r.json()
        assert len(results) >= 1
        assert any("react" in (j["title"] + j["description"] + " ".join(j["tags"])).lower() for j in results)

    def test_filter_remote_type(self, api_base, auth_headers):
        r = requests.get(f"{api_base}/jobs?remote_type=remote", headers=auth_headers)
        assert r.status_code == 200
        assert all(j["remote_type"] == "remote" for j in r.json())

    def test_filter_experience_level(self, api_base, auth_headers):
        r = requests.get(
            f"{api_base}/jobs?experience_level=senior", headers=auth_headers
        )
        assert r.status_code == 200
        assert all(j["experience_level"] == "senior" for j in r.json())

    def test_filter_min_salary(self, api_base, auth_headers):
        r = requests.get(f"{api_base}/jobs?salary_min=100000", headers=auth_headers)
        assert r.status_code == 200
        for j in r.json():
            # salary_max must be >= 100000 per backend semantics
            if j.get("salary_max") is not None:
                assert j["salary_max"] >= 100000

    def test_get_job_detail(self, api_base, auth_headers):
        r = requests.get(f"{api_base}/jobs", headers=auth_headers)
        job_id = r.json()[0]["job_id"]
        r2 = requests.get(f"{api_base}/jobs/{job_id}", headers=auth_headers)
        assert r2.status_code == 200
        assert r2.json()["job_id"] == job_id

    def test_get_job_not_found(self, api_base, auth_headers):
        r = requests.get(f"{api_base}/jobs/job_doesnotexist", headers=auth_headers)
        assert r.status_code == 404


# --- Resumes ---
class TestResumes:
    created = []

    def test_create_list_default_delete(self, api_base, auth_headers):
        # cleanup any leftover TEST_ resumes first
        existing = requests.get(f"{api_base}/resumes", headers=auth_headers).json()
        for r in existing:
            if r["version_name"].startswith("TEST_"):
                requests.delete(f"{api_base}/resumes/{r['resume_id']}", headers=auth_headers)

        # create #1 (default)
        r1 = requests.post(
            f"{api_base}/resumes",
            headers=auth_headers,
            json={"version_name": "TEST_v1", "content": "hello resume", "is_default": True},
        )
        assert r1.status_code == 200, r1.text
        rid1 = r1.json()["resume_id"]
        assert r1.json()["is_default"] is True

        # create #2 (also default -> should flip #1 to false)
        r2 = requests.post(
            f"{api_base}/resumes",
            headers=auth_headers,
            json={"version_name": "TEST_v2", "content": "second", "is_default": True},
        )
        assert r2.status_code == 200
        rid2 = r2.json()["resume_id"]

        listed = requests.get(f"{api_base}/resumes", headers=auth_headers).json()
        defaults = [r for r in listed if r["is_default"]]
        assert len(defaults) == 1 and defaults[0]["resume_id"] == rid2

        # update #1 to default via PUT
        upd = requests.put(
            f"{api_base}/resumes/{rid1}",
            headers=auth_headers,
            json={"is_default": True},
        )
        assert upd.status_code == 200
        listed = requests.get(f"{api_base}/resumes", headers=auth_headers).json()
        defaults = [r for r in listed if r["is_default"]]
        assert len(defaults) == 1 and defaults[0]["resume_id"] == rid1

        # delete both
        for rid in (rid1, rid2):
            d = requests.delete(f"{api_base}/resumes/{rid}", headers=auth_headers)
            assert d.status_code == 200
            g = requests.get(f"{api_base}/resumes/{rid}", headers=auth_headers)
            assert g.status_code == 404


# --- Applications ---
class TestApplications:
    def test_full_lifecycle(self, api_base, auth_headers):
        # ensure jobs exist
        requests.post(f"{api_base}/jobs/seed", headers=auth_headers)
        jobs = requests.get(f"{api_base}/jobs", headers=auth_headers).json()
        job_id = jobs[0]["job_id"]

        # remove any existing application for this job (idempotent test setup)
        existing = requests.get(f"{api_base}/applications", headers=auth_headers).json()
        for a in existing:
            if a["job_id"] == job_id:
                requests.delete(
                    f"{api_base}/applications/{a['application_id']}", headers=auth_headers
                )

        # create Saved
        r = requests.post(
            f"{api_base}/applications",
            headers=auth_headers,
            json={"job_id": job_id, "status": "Saved"},
        )
        assert r.status_code == 200, r.text
        app = r.json()
        aid = app["application_id"]
        assert app["status"] == "Saved"
        assert app["job"] is not None and app["job"]["job_id"] == job_id

        # duplicate create -> 409
        dup = requests.post(
            f"{api_base}/applications",
            headers=auth_headers,
            json={"job_id": job_id, "status": "Saved"},
        )
        assert dup.status_code == 409

        # update to Applied
        upd = requests.patch(
            f"{api_base}/applications/{aid}",
            headers=auth_headers,
            json={"status": "Applied"},
        )
        assert upd.status_code == 200
        assert upd.json()["status"] == "Applied"

        # list filtered by status
        applied = requests.get(
            f"{api_base}/applications?status=Applied", headers=auth_headers
        ).json()
        assert any(a["application_id"] == aid for a in applied)

        # add note
        n = requests.post(
            f"{api_base}/applications/{aid}/notes",
            headers=auth_headers,
            json={"text": "TEST_note"},
        )
        assert n.status_code == 200
        note_id = n.json()["notes"][-1]["note_id"]

        # delete note
        dn = requests.delete(
            f"{api_base}/applications/{aid}/notes/{note_id}", headers=auth_headers
        )
        assert dn.status_code == 200
        assert all(nn["note_id"] != note_id for nn in dn.json()["notes"])

        # delete application
        d = requests.delete(
            f"{api_base}/applications/{aid}", headers=auth_headers
        )
        assert d.status_code == 200
        g = requests.get(f"{api_base}/applications/{aid}", headers=auth_headers)
        assert g.status_code == 404

    def test_create_application_bad_job(self, api_base, auth_headers):
        r = requests.post(
            f"{api_base}/applications",
            headers=auth_headers,
            json={"job_id": "job_missing", "status": "Saved"},
        )
        assert r.status_code == 404
