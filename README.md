# FixLoop

FixLoop is an AI-assisted remote operations MVP for multi-location spaces. A visitor reports a problem with a photo; the service structures the report, helps an operator find similar issues, compares Before/After photos, and leaves final resolution to an administrator.

## Repository layout

```text
frontend/  Next.js application (reporter and admin UI from Day 3 onward)
backend/   FastAPI application and AI provider boundary
supabase/  Supabase migrations and storage setup (Day 2)
```

## Local setup

1. Copy `docker.env.example` to `.env` and retain `AI_PROVIDER=mock`, `DATA_BACKEND=memory`, and `STORAGE_BACKEND=memory` for local development.
2. Run `docker compose up --build`, then open `/report/00000000-0000-0000-0000-000000000001` or `/dashboard`.
3. Run `pytest` from `backend/` to exercise the health, AI contracts, report-to-resolution API flow, and insights aggregation.

The mock provider is deliberately deterministic and is for contract testing only. A real provider adapter must validate its output with `VisualTriageResult` or `ProofOfFixResult`; browser code must never receive an AI API key.

## Docker setup

Docker Compose is the recommended way to run the same local environment on another computer without installing Python, Node.js, or a project virtual environment. Copy `docker.env.example` to `.env` in the repository root, then run:

```bash
docker compose up --build
```

Open `http://localhost:3000/dashboard`. The default is a no-cost mock/memory demonstration. To use Gemini and Supabase, fill only the matching values in the root `.env`; Docker passes secrets to the API container and never to the browser. For phone QR testing, set both `NEXT_PUBLIC_*_BASE_URL` values to the computer's current Wi-Fi IP and include the web URL in `ALLOWED_ORIGINS`, then restart with `docker compose up --build`.

## API foundation

- `GET /health`
- `POST /api/ai/triage`
- `POST /api/ai/verify`
- `POST /api/reports/analyze` (multipart photo + optional reporter text)
- `POST /api/reports/{draftId}/confirm`
- `POST /api/reports` (QR/mobile flow: analyze and create an issue in one request)
- `GET /api/issues`, `GET /api/issues/{id}`, `PATCH /api/issues/{id}/status`
- `POST /api/issues/{id}/after`, `POST /api/issues/{id}/verify`, `POST /api/issues/{id}/resolve`

The default `memory` backend makes the flow runnable without credentials. `supabase/schema.sql` defines the production PostgreSQL, private Storage, and pgvector layout. Apply it, then apply `supabase/migrations/202609150001_admin_security.sql` to enable RLS and prevent browser-side table access. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only on the backend. The browser receives only the Supabase publishable key for administrator login.

## Production handoff

- Follow [DEPLOYMENT.md](DEPLOYMENT.md) to connect Supabase PostgreSQL/private Storage, Gemini, and public URLs. The repository now includes both the Supabase persistence adapter and the Gemini vision adapter; only the account secrets and deployment targets are external prerequisites.
- Railway builds the FastAPI container from `backend/Dockerfile` at the repository root; set `AI_PROVIDER=gemini`, `GEMINI_API_KEY`, `ALLOWED_ORIGINS`, `DATA_BACKEND=supabase`, `STORAGE_BACKEND=supabase`, `AUTH_REQUIRED=true`, `ADMIN_EMAILS`, and Supabase server values there.
- Vercel deploys `frontend/`; set `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_REPORT_BASE_URL`, `NEXT_PUBLIC_AUTH_REQUIRED=true`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` there.
- Run `supabase/schema.sql` and then `supabase/seed.sql` in the Supabase SQL editor. Keep the Storage bucket private.
- Set `AI_PROVIDER=gemini` only after adding a Gemini API key to the backend host. The backend sends images to Gemini from the server and validates its structured output before creating an issue.

## Product rules enforced in the current flow

- A reporter uploads one Before photo and may add optional text without signing in. Only real JPG, PNG, and WebP files up to the configured limit are accepted.
- Dashboard, issue, insight, and status-changing routes require a Supabase-authenticated email listed in `ADMIN_EMAILS` when `AUTH_REQUIRED=true`.
- The QR/mobile report flow creates the issue after validated AI analysis and shows a “registered” confirmation to the reporter.
- `RESOLVED` cannot be selected in the ordinary status API; a verification result must exist before the dedicated approval route permits it.
- Similar-issue candidates are advisory only. The application never auto-merges issues.
- Insights aggregate data deterministically. AI may later phrase recommendations but must not calculate or modify the numbers.

## Temporary QR test on a phone

For a same-Wi-Fi demonstration, set both `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_REPORT_BASE_URL` to your computer's LAN address (for example, `http://192.168.x.x:8000` and `http://192.168.x.x:3000`). Start FastAPI and Next.js with `--host 0.0.0.0` / `--hostname 0.0.0.0`, open the LAN dashboard URL on the computer, and scan the QR code it displays. The phone's uploaded report will be analyzed and immediately appear in the dashboard after refresh. If Windows asks about network access, allow the development servers on **Private networks** only. The in-memory demo data is reset whenever the API server restarts.
