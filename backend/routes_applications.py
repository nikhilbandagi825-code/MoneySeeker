"""Application tracker: save jobs, move through kanban stages, notes, reminders."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user
from db import db
from models import (
    Application,
    ApplicationCreate,
    ApplicationStatus,
    ApplicationUpdate,
    Job,
    Note,
    NoteCreate,
    User,
    now_iso,
)

applications_router = APIRouter(prefix="/api/applications", tags=["applications"])


@applications_router.post("", response_model=Application)
async def create_application(
    payload: ApplicationCreate, user: User = Depends(get_current_user)
):
    job_doc = await db.jobs.find_one({"job_id": payload.job_id}, {"_id": 0})
    if not job_doc:
        raise HTTPException(status_code=404, detail="Job not found")

    existing = await db.applications.find_one(
        {"user_id": user.user_id, "job_id": payload.job_id}, {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=409, detail="Job already saved")

    count = await db.applications.count_documents(
        {"user_id": user.user_id, "status": payload.status.value}
    )
    app = Application(
        user_id=user.user_id,
        job_id=payload.job_id,
        job=Job(**job_doc),
        status=payload.status,
        resume_id=payload.resume_id,
        follow_up_date=payload.follow_up_date,
        order=count,
    )
    await db.applications.insert_one(app.model_dump())
    return app


@applications_router.get("", response_model=List[Application])
async def list_applications(
    status: Optional[ApplicationStatus] = Query(default=None),
    user: User = Depends(get_current_user),
):
    query: dict = {"user_id": user.user_id}
    if status:
        query["status"] = status.value
    docs = await db.applications.find(query, {"_id": 0}).sort("order", 1).to_list(500)
    return [Application(**d) for d in docs]


@applications_router.get("/{application_id}", response_model=Application)
async def get_application(application_id: str, user: User = Depends(get_current_user)):
    doc = await db.applications.find_one(
        {"application_id": application_id, "user_id": user.user_id}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Application not found")
    return Application(**doc)


@applications_router.patch("/{application_id}", response_model=Application)
async def update_application(
    application_id: str,
    payload: ApplicationUpdate,
    user: User = Depends(get_current_user),
):
    doc = await db.applications.find_one(
        {"application_id": application_id, "user_id": user.user_id}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Application not found")

    updates: dict = {}
    if payload.status is not None:
        updates["status"] = payload.status.value
    if payload.resume_id is not None:
        updates["resume_id"] = payload.resume_id
    if payload.follow_up_date is not None:
        updates["follow_up_date"] = payload.follow_up_date
    if payload.order is not None:
        updates["order"] = payload.order
    updates["updated_at"] = now_iso()

    await db.applications.update_one(
        {"application_id": application_id}, {"$set": updates}
    )
    doc.update(updates)
    return Application(**doc)


@applications_router.delete("/{application_id}")
async def delete_application(application_id: str, user: User = Depends(get_current_user)):
    res = await db.applications.delete_one(
        {"application_id": application_id, "user_id": user.user_id}
    )
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Application not found")
    return {"success": True}


@applications_router.post("/{application_id}/notes", response_model=Application)
async def add_note(
    application_id: str, payload: NoteCreate, user: User = Depends(get_current_user)
):
    doc = await db.applications.find_one(
        {"application_id": application_id, "user_id": user.user_id}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Application not found")

    note = Note(text=payload.text)
    await db.applications.update_one(
        {"application_id": application_id},
        {"$push": {"notes": note.model_dump()}, "$set": {"updated_at": now_iso()}},
    )
    doc["notes"].append(note.model_dump())
    return Application(**doc)


@applications_router.delete("/{application_id}/notes/{note_id}", response_model=Application)
async def delete_note(
    application_id: str, note_id: str, user: User = Depends(get_current_user)
):
    doc = await db.applications.find_one(
        {"application_id": application_id, "user_id": user.user_id}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Application not found")

    await db.applications.update_one(
        {"application_id": application_id},
        {"$pull": {"notes": {"note_id": note_id}}, "$set": {"updated_at": now_iso()}},
    )
    doc["notes"] = [n for n in doc.get("notes", []) if n.get("note_id") != note_id]
    return Application(**doc)
