// Single API client for MoneySeeker. All calls hit `${EXPO_PUBLIC_BACKEND_URL}/api`.

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const res = await fetch(`${BASE}/api${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = "Request failed";
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

// ---------- Types ----------
export interface User {
  user_id: string;
  email: string;
  name: string;
  picture: string;
  auth_provider: string;
}

export interface Job {
  job_id: string;
  title: string;
  company: string;
  company_logo: string;
  location: string;
  remote_type: "remote" | "onsite" | "hybrid";
  salary_min: number | null;
  salary_max: number | null;
  currency: string;
  experience_level: "intern" | "entry" | "mid" | "senior" | "lead";
  description: string;
  tags: string[];
  source: string;
  url: string;
  created_at: string;
}

export interface Note {
  note_id: string;
  text: string;
  created_at: string;
}

export interface Application {
  application_id: string;
  user_id: string;
  job_id: string;
  job: Job | null;
  status: "Saved" | "Applied" | "Interviewing" | "Offer" | "Rejected";
  resume_id: string | null;
  follow_up_date: string | null;
  notes: Note[];
  order: number;
  created_at: string;
  updated_at: string;
}

export interface Resume {
  resume_id: string;
  user_id: string;
  version_name: string;
  file_name: string;
  content: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface MatchResult {
  score: number;
  summary: string;
  strengths: string[];
  gaps: string[];
}

export interface AuthResponse {
  session_token: string;
  user: User;
}

export interface JobFilters {
  q?: string;
  location?: string;
  remote_type?: string;
  experience_level?: string;
  salary_min?: number;
  salary_max?: number;
}

// ---------- API ----------
export const api = {
  // auth
  register: (email: string, password: string, name: string) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  googleSession: (session_id: string) =>
    request<AuthResponse>("/auth/session", {
      method: "POST",
      body: JSON.stringify({ session_id }),
    }),
  me: () => request<User>("/auth/me"),
  logout: () => request<{ success: boolean }>("/auth/logout", { method: "POST" }),

  // jobs
  searchJobs: (filters: JobFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") params.append(k, String(v));
    });
    const qs = params.toString();
    return request<Job[]>(`/jobs${qs ? `?${qs}` : ""}`);
  },
  getJob: (id: string) => request<Job>(`/jobs/${id}`),
  seedJobs: () => request<{ inserted: number; total_jobs: number }>("/jobs/seed", { method: "POST" }),
  syncJobs: (q?: string) =>
    request<{ synced: number; total_jobs: number }>(
      `/jobs/sync${q ? `?q=${encodeURIComponent(q)}` : ""}`,
      { method: "POST" },
    ),

  // applications
  listApplications: (status?: string) =>
    request<Application[]>(`/applications${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  createApplication: (job_id: string, status = "Saved") =>
    request<Application>("/applications", {
      method: "POST",
      body: JSON.stringify({ job_id, status }),
    }),
  updateApplication: (
    id: string,
    payload: { status?: string; follow_up_date?: string | null; resume_id?: string | null; order?: number },
  ) =>
    request<Application>(`/applications/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteApplication: (id: string) =>
    request<{ success: boolean }>(`/applications/${id}`, { method: "DELETE" }),
  addNote: (id: string, text: string) =>
    request<Application>(`/applications/${id}/notes`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  deleteNote: (id: string, noteId: string) =>
    request<Application>(`/applications/${id}/notes/${noteId}`, { method: "DELETE" }),

  // resumes
  listResumes: () => request<Resume[]>("/resumes"),
  createResume: (payload: { version_name: string; content: string; is_default?: boolean }) =>
    request<Resume>("/resumes", { method: "POST", body: JSON.stringify(payload) }),
  updateResume: (
    id: string,
    payload: { version_name?: string; content?: string; is_default?: boolean },
  ) => request<Resume>(`/resumes/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteResume: (id: string) =>
    request<{ success: boolean }>(`/resumes/${id}`, { method: "DELETE" }),

  // ai
  aiMatch: (job_id: string, resume_id?: string | null) =>
    request<MatchResult>("/ai/match", {
      method: "POST",
      body: JSON.stringify({ job_id, resume_id }),
    }),
  aiCoverLetter: (job_id: string, resume_id?: string | null) =>
    request<{ cover_letter: string }>("/ai/cover-letter", {
      method: "POST",
      body: JSON.stringify({ job_id, resume_id }),
    }),
};
