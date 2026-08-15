import logging

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from auth import auth_router
from db import client, ensure_indexes
from routes_ai import ai_router
from routes_applications import applications_router
from routes_jobs import jobs_router
from routes_resumes import resumes_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="MoneySeeker API")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/")
async def root():
    return {"message": "MoneySeeker API", "status": "ok"}


@app.get("/api/health")
async def health():
    return {"status": "healthy"}


app.include_router(auth_router)
app.include_router(jobs_router)
app.include_router(resumes_router)
app.include_router(applications_router)
app.include_router(ai_router)


@app.on_event("startup")
async def startup():
    await ensure_indexes()
    logger.info("MoneySeeker API started, indexes ensured.")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
