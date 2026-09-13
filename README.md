# FixLoop

FixLoop is an AI-assisted remote operations MVP for multi-location spaces. A visitor reports a problem with a photo; the service structures the report, helps an operator find similar issues, compares Before/After photos, and leaves final resolution to an administrator.

## Repository layout

```text
frontend/  Next.js application (reporter and admin UI from Day 3 onward)
backend/   FastAPI application and AI provider boundary
supabase/  Supabase migrations and storage setup (Day 2)
```

## Local setup

1. Copy `.env.example` to `backend/.env` and retain `AI_PROVIDER=mock`, `DATA_BACKEND=memory`, and `STORAGE_BACKEND=memory` for local development.
2. Create a Python 3.11+ virtual environment, install the backend with `pip install -e ".[dev]"`, then run `uvicorn app.main:app --reload` from `backend/`.
3. Run `pnpm install && pnpm dev` from `frontend/`.
4. Open `/report/00000000-0000-0000-0000-000000000001`, submit a photo, then visit `/dashboard` to process the created issue.
5. Run `pytest` from `backend/` to exercise the health, AI contracts, report-to-resolution API flow, and insights aggregation.

The mock provider is deliberately deterministic and is for contract testing only. A real provider adapter must validate its output with `VisualTriageResult` or `ProofOfFixResult`; browser code must never receive an AI API key.

## API foundation

- `GET /health`
- `POST /api/ai/triage`
- `POST /api/ai/verify`
- `POST /api/reports/analyze` (multipart photo + optional reporter text)
- `POST /api/reports/{draftId}/confirm`
- `GET /api/issues`, `GET /api/issues/{id}`, `PATCH /api/issues/{id}/status`
- `POST /api/issues/{id}/after`, `POST /api/issues/{id}/verify`, `POST /api/issues/{id}/resolve`

The default `memory` backend makes the flow runnable without credentials. `supabase/schema.sql` defines the production PostgreSQL, private Storage, and pgvector layout, including the same-location similarity RPC. Apply it in the Supabase SQL editor, create an email/password admin user, and set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` before deploying.

## Product rules enforced in the current flow

- A reporter uploads one Before photo and may add optional text without signing in.
- The reporter sees validated AI analysis before confirming issue creation.
- `RESOLVED` cannot be selected in the ordinary status API; a verification result must exist before the dedicated approval route permits it.
- Similar-issue candidates are advisory only. The application never auto-merges issues.
- Insights aggregate data deterministically. AI may later phrase recommendations but must not calculate or modify the numbers.
