"""Phase 5 AI extras: resume match scoring + cover letter generation (Claude Sonnet 5)."""
import json
import os
import re
import uuid
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_current_user
from db import db
from models import User

load_dotenv(Path(__file__).parent / ".env")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

ai_router = APIRouter(prefix="/api/ai", tags=["ai"])


class AiRequest(BaseModel):
    job_id: str
    resume_id: Optional[str] = None


class MatchResult(BaseModel):
    score: int
    summary: str
    strengths: List[str]
    gaps: List[str]


class CoverLetterResult(BaseModel):
    cover_letter: str


async def _load_job_and_resume(payload: AiRequest, user: User):
    job = await db.jobs.find_one({"job_id": payload.job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if payload.resume_id:
        resume = await db.resumes.find_one(
            {"resume_id": payload.resume_id, "user_id": user.user_id}, {"_id": 0}
        )
    else:
        resume = await db.resumes.find_one(
            {"user_id": user.user_id, "is_default": True}, {"_id": 0}
        ) or await db.resumes.find_one({"user_id": user.user_id}, {"_id": 0})

    if not resume:
        raise HTTPException(status_code=400, detail="Add a resume first to use AI tools")
    if not (resume.get("content") or "").strip():
        raise HTTPException(status_code=400, detail="This resume has no content to analyze")
    return job, resume


def _job_block(job: dict) -> str:
    salary = ""
    if job.get("salary_min") or job.get("salary_max"):
        salary = f"Salary: {job.get('salary_min')}-{job.get('salary_max')} {job.get('currency', 'USD')}\n"
    return (
        f"Job title: {job['title']}\n"
        f"Company: {job['company']}\n"
        f"Location: {job.get('location', '')} ({job.get('remote_type', '')})\n"
        f"Experience level: {job.get('experience_level', '')}\n"
        f"{salary}"
        f"Tags: {', '.join(job.get('tags', []))}\n"
        f"Description:\n{(job.get('description') or '')[:5000]}"
    )


async def _ask_claude(system_message: str, prompt: str) -> str:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"ai_{uuid.uuid4().hex[:10]}",
        system_message=system_message,
    ).with_model("anthropic", "claude-sonnet-5")
    try:
        response = await chat.send_message(UserMessage(text=prompt))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"AI service error: {exc}") from exc
    return str(response)


def _extract_json(text: str) -> dict:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise HTTPException(status_code=502, detail="AI returned an unexpected response")
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="AI returned invalid JSON") from exc


@ai_router.post("/match", response_model=MatchResult)
async def resume_match(payload: AiRequest, user: User = Depends(get_current_user)):
    job, resume = await _load_job_and_resume(payload, user)
    raw = await _ask_claude(
        "You are an expert technical recruiter and career coach. You evaluate how well a "
        "candidate's resume matches a specific job posting. Be honest and specific. "
        "Respond ONLY with a JSON object, no markdown fences, no extra text.",
        f"{_job_block(job)}\n\n---\nCandidate resume:\n{resume['content'][:6000]}\n\n---\n"
        'Return JSON exactly in this shape: {"score": <int 0-100 overall match>, '
        '"summary": "<2 concise sentences on overall fit>", '
        '"strengths": ["<3-5 short bullets of matching strengths>"], '
        '"gaps": ["<2-4 short bullets of missing skills or gaps>"]}',
    )
    data = _extract_json(raw)
    return MatchResult(
        score=max(0, min(100, int(data.get("score", 0)))),
        summary=str(data.get("summary", "")).strip(),
        strengths=[str(s) for s in data.get("strengths", [])][:5],
        gaps=[str(g) for g in data.get("gaps", [])][:4],
    )


@ai_router.post("/cover-letter", response_model=CoverLetterResult)
async def cover_letter(payload: AiRequest, user: User = Depends(get_current_user)):
    job, resume = await _load_job_and_resume(payload, user)
    candidate = user.name or "the candidate"
    raw = await _ask_claude(
        "You are an expert career writer. You write concise, tailored, professional cover "
        "letters that connect a candidate's real experience to the job. Warm, confident tone. "
        "Never invent experience that is not in the resume. Output only the letter text, "
        "no preamble, no markdown.",
        f"{_job_block(job)}\n\n---\nCandidate name: {candidate}\n"
        f"Candidate resume:\n{resume['content'][:6000]}\n\n---\n"
        "Write a tailored cover letter (220 words max, 3-4 short paragraphs) for this job. "
        f'Sign off with "{candidate}".',
    )
    letter = re.sub(r"^```[a-z]*\n?|```$", "", raw.strip()).strip()
    return CoverLetterResult(cover_letter=letter)
