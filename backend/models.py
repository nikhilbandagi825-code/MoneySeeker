"""Pydantic models for MoneySeeker.

Every document uses a custom UUID-based string id (never MongoDB's _id).
All datetimes are timezone-aware and stored as ISO strings.
"""
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def gen_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


# ---------- Enums ----------
class RemoteType(str, Enum):
    remote = "remote"
    onsite = "onsite"
    hybrid = "hybrid"


class ExperienceLevel(str, Enum):
    intern = "intern"
    entry = "entry"
    mid = "mid"
    senior = "senior"
    lead = "lead"


class ApplicationStatus(str, Enum):
    saved = "Saved"
    applied = "Applied"
    interviewing = "Interviewing"
    offer = "Offer"
    rejected = "Rejected"


# ---------- User / Auth ----------
class User(BaseModel):
    user_id: str = Field(default_factory=lambda: gen_id("user"))
    email: EmailStr
    name: str = ""
    picture: str = ""
    auth_provider: str = "email"  # "email" | "google"
    created_at: str = Field(default_factory=now_iso)


class UserPublic(BaseModel):
    user_id: str
    email: EmailStr
    name: str = ""
    picture: str = ""
    auth_provider: str = "email"


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = ""


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SessionRequest(BaseModel):
    session_id: str


class AuthResponse(BaseModel):
    session_token: str
    user: UserPublic


# ---------- Job ----------
class JobBase(BaseModel):
    title: str
    company: str
    location: str = ""
    remote_type: RemoteType = RemoteType.onsite
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    currency: str = "USD"
    experience_level: ExperienceLevel = ExperienceLevel.mid
    description: str = ""
    company_logo: str = ""
    tags: List[str] = Field(default_factory=list)
    source: str = "seed"  # "seed" | "apify" | "manual"
    external_id: str = ""
    url: str = ""


class JobCreate(JobBase):
    pass


class Job(JobBase):
    job_id: str = Field(default_factory=lambda: gen_id("job"))
    created_at: str = Field(default_factory=now_iso)


# ---------- Resume ----------
class ResumeCreate(BaseModel):
    version_name: str
    file_name: str = ""
    content: str = ""  # extracted/pasted resume text used for AI analysis
    is_default: bool = False


class ResumeUpdate(BaseModel):
    version_name: Optional[str] = None
    file_name: Optional[str] = None
    content: Optional[str] = None
    is_default: Optional[bool] = None


class Resume(BaseModel):
    resume_id: str = Field(default_factory=lambda: gen_id("resume"))
    user_id: str
    version_name: str
    file_name: str = ""
    content: str = ""
    is_default: bool = False
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


# ---------- Application ----------
class Note(BaseModel):
    note_id: str = Field(default_factory=lambda: gen_id("note"))
    text: str
    created_at: str = Field(default_factory=now_iso)


class NoteCreate(BaseModel):
    text: str


class ApplicationCreate(BaseModel):
    job_id: str
    status: ApplicationStatus = ApplicationStatus.saved
    resume_id: Optional[str] = None
    follow_up_date: Optional[str] = None


class ApplicationUpdate(BaseModel):
    status: Optional[ApplicationStatus] = None
    resume_id: Optional[str] = None
    follow_up_date: Optional[str] = None
    order: Optional[int] = None


class Application(BaseModel):
    application_id: str = Field(default_factory=lambda: gen_id("app"))
    user_id: str
    job_id: str
    job: Optional[Job] = None  # denormalized snapshot for self-contained cards
    status: ApplicationStatus = ApplicationStatus.saved
    resume_id: Optional[str] = None
    follow_up_date: Optional[str] = None
    notes: List[Note] = Field(default_factory=list)
    order: int = 0
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)
