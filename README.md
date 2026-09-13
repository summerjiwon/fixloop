# FixLoop

FixLoop is an AI-assisted remote operations MVP for multi-location spaces. A visitor reports a problem with a photo; the service structures the report, helps an operator find similar issues, compares Before/After photos, and leaves final resolution to an administrator.

## Repository layout

```text
frontend/  Next.js application (reporter and admin UI from Day 3 onward)
backend/   FastAPI application and AI provider boundary
supabase/  Supabase migrations and storage setup (Day 2)
```

## Day 1 local setup

1. Copy `.env.example` to `backend/.env` and retain `AI_PROVIDER=mock`.
2. Create a Python 3.11+ virtual environment, install the backend with `pip install -e ".[dev]"`, then run `uvicorn app.main:app --reload` from `backend/`.
3. Run `pytest` from `backend/` to exercise the health, Visual Triage, and Proof of Fix contracts.

The mock provider is deliberately deterministic and is for contract testing only. A real provider adapter must validate its output with `VisualTriageResult` or `ProofOfFixResult`; browser code must never receive an AI API key.

## Day 1 endpoints

- `GET /health`
- `POST /api/ai/triage`
- `POST /api/ai/verify`

Both AI endpoints accept image URLs for local contract tests. Storage uploads, issue persistence, auth, and UI workflows are scheduled for later milestones.
