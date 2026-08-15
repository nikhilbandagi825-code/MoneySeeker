"""Job listings: create, search/filter, detail, and a sample seeder for testing."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user
from db import db
from models import ExperienceLevel, Job, JobCreate, RemoteType, User

jobs_router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@jobs_router.post("", response_model=Job)
async def create_job(payload: JobCreate, user: User = Depends(get_current_user)):
    job = Job(**payload.model_dump())
    await db.jobs.insert_one(job.model_dump())
    return job


@jobs_router.get("", response_model=List[Job])
async def search_jobs(
    q: Optional[str] = Query(default=None, description="Search role/company/keyword"),
    location: Optional[str] = None,
    remote_type: Optional[RemoteType] = None,
    experience_level: Optional[ExperienceLevel] = None,
    salary_min: Optional[int] = None,
    salary_max: Optional[int] = None,
    limit: int = 100,
    user: User = Depends(get_current_user),
):
    query: dict = {}
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"company": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"tags": {"$regex": q, "$options": "i"}},
        ]
    if location:
        query["location"] = {"$regex": location, "$options": "i"}
    if remote_type:
        query["remote_type"] = remote_type.value
    if experience_level:
        query["experience_level"] = experience_level.value
    if salary_min is not None:
        query["salary_max"] = {"$gte": salary_min}
    if salary_max is not None:
        query.setdefault("salary_min", {})
        query["salary_min"]["$lte"] = salary_max

    docs = await db.jobs.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return [Job(**d) for d in docs]


@jobs_router.get("/{job_id}", response_model=Job)
async def get_job(job_id: str, user: User = Depends(get_current_user)):
    doc = await db.jobs.find_one({"job_id": job_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Job not found")
    return Job(**doc)


SAMPLE_JOBS = [
    {
        "title": "Senior React Native Engineer",
        "company": "Nomad Labs",
        "location": "San Francisco, CA",
        "remote_type": "remote",
        "salary_min": 150000,
        "salary_max": 190000,
        "experience_level": "senior",
        "tags": ["React Native", "TypeScript", "Expo"],
        "description": "Build delightful cross-platform mobile experiences with React Native and Expo. Own features end to end, mentor engineers, and shape our mobile architecture.",
    },
    {
        "title": "Product Designer (Mobile)",
        "company": "Brightwave",
        "location": "New York, NY",
        "remote_type": "hybrid",
        "salary_min": 110000,
        "salary_max": 140000,
        "experience_level": "mid",
        "tags": ["Figma", "UX", "Design Systems"],
        "description": "Design intuitive mobile flows for our fintech app. Partner with PMs and engineers to ship polished, accessible interfaces.",
    },
    {
        "title": "Backend Engineer, Python",
        "company": "Datastack",
        "location": "Austin, TX",
        "remote_type": "onsite",
        "salary_min": 120000,
        "salary_max": 160000,
        "experience_level": "mid",
        "tags": ["Python", "FastAPI", "MongoDB"],
        "description": "Design and scale APIs powering millions of requests. Work with FastAPI, MongoDB, and event-driven systems.",
    },
    {
        "title": "Junior Frontend Developer",
        "company": "Pixel Foundry",
        "location": "Remote",
        "remote_type": "remote",
        "salary_min": 70000,
        "salary_max": 95000,
        "experience_level": "entry",
        "tags": ["React", "CSS", "JavaScript"],
        "description": "Join a friendly team building web apps. Great mentorship, code reviews, and room to grow.",
    },
    {
        "title": "Engineering Manager, Mobile",
        "company": "Skyline",
        "location": "Seattle, WA",
        "remote_type": "hybrid",
        "salary_min": 180000,
        "salary_max": 230000,
        "experience_level": "lead",
        "tags": ["Leadership", "iOS", "Android"],
        "description": "Lead a team of mobile engineers. Drive delivery, growth, and technical excellence across iOS and Android.",
    },
    {
        "title": "Data Scientist",
        "company": "Quanta AI",
        "location": "Boston, MA",
        "remote_type": "remote",
        "salary_min": 130000,
        "salary_max": 170000,
        "experience_level": "senior",
        "tags": ["Python", "ML", "Statistics"],
        "description": "Turn data into product. Build models, run experiments, and influence roadmap with insights.",
    },
]


@jobs_router.post("/seed")
async def seed_jobs(user: User = Depends(get_current_user)):
    """Insert sample jobs (idempotent-ish for testing/demo)."""
    inserted = 0
    for data in SAMPLE_JOBS:
        exists = await db.jobs.find_one({"title": data["title"], "company": data["company"]})
        if exists:
            continue
        job = Job(source="seed", **data)
        await db.jobs.insert_one(job.model_dump())
        inserted += 1
    total = await db.jobs.count_documents({})
    return {"inserted": inserted, "total_jobs": total}
