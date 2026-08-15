"""Resume versions per user."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from db import db
from models import Resume, ResumeCreate, ResumeUpdate, User, now_iso

resumes_router = APIRouter(prefix="/api/resumes", tags=["resumes"])


@resumes_router.post("", response_model=Resume)
async def create_resume(payload: ResumeCreate, user: User = Depends(get_current_user)):
    resume = Resume(user_id=user.user_id, **payload.model_dump())
    if resume.is_default:
        await db.resumes.update_many(
            {"user_id": user.user_id}, {"$set": {"is_default": False}}
        )
    await db.resumes.insert_one(resume.model_dump())
    return resume


@resumes_router.get("", response_model=List[Resume])
async def list_resumes(user: User = Depends(get_current_user)):
    docs = await db.resumes.find({"user_id": user.user_id}, {"_id": 0}).sort(
        "created_at", -1
    ).to_list(200)
    return [Resume(**d) for d in docs]


@resumes_router.get("/{resume_id}", response_model=Resume)
async def get_resume(resume_id: str, user: User = Depends(get_current_user)):
    doc = await db.resumes.find_one(
        {"resume_id": resume_id, "user_id": user.user_id}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Resume not found")
    return Resume(**doc)


@resumes_router.put("/{resume_id}", response_model=Resume)
async def update_resume(
    resume_id: str, payload: ResumeUpdate, user: User = Depends(get_current_user)
):
    doc = await db.resumes.find_one(
        {"resume_id": resume_id, "user_id": user.user_id}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Resume not found")

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    updates["updated_at"] = now_iso()
    if updates.get("is_default"):
        await db.resumes.update_many(
            {"user_id": user.user_id}, {"$set": {"is_default": False}}
        )
    await db.resumes.update_one({"resume_id": resume_id}, {"$set": updates})
    doc.update(updates)
    return Resume(**doc)


@resumes_router.delete("/{resume_id}")
async def delete_resume(resume_id: str, user: User = Depends(get_current_user)):
    res = await db.resumes.delete_one(
        {"resume_id": resume_id, "user_id": user.user_id}
    )
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Resume not found")
    return {"success": True}
