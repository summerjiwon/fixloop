# Production connection checklist

The application is intentionally runnable with `mock` AI and in-memory data. To switch it to the real service, complete these steps in order. Do not put any secret in the frontend or commit it to Git.

## 1. Create Supabase data and private image storage

1. Create a Supabase project.
2. In its SQL editor, run `supabase/schema.sql`, then `supabase/seed.sql`, then `supabase/migrations/202609150001_admin_security.sql`.
3. Keep the `issue-images` Storage bucket private. The backend uses the service-role key and generates temporary signed links for the dashboard and Gemini.
4. Copy the project URL and **Secret Key** into the backend host's secret environment settings. The server key must never be used in a browser.
5. In **Authentication → Users**, create the administrator email-and-password account. Put that same email in `ADMIN_EMAILS` on the backend host. Do not share the password.

## 2. Configure Gemini in the backend host

Create a Gemini API key in Google AI Studio. Add it only to the backend host's secret environment settings:

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=replace-with-a-server-secret
GEMINI_MODEL=gemini-3.6-flash
EMBEDDING_MODEL=gemini-embedding-001
DATA_BACKEND=supabase
STORAGE_BACKEND=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace-with-a-server-secret
STORAGE_BUCKET=issue-images
ALLOWED_ORIGINS=https://app.example.com
AUTH_REQUIRED=true
ADMIN_EMAILS=admin@example.com
MAX_UPLOAD_BYTES=10485760
```

## 3. Publish the API and web application

Deploy `backend/` with the included Dockerfile to a server such as Railway. Deploy `frontend/` to Vercel or another Next.js host. After the API has a public HTTPS URL, configure the frontend host:

```dotenv
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
NEXT_PUBLIC_REPORT_BASE_URL=https://app.example.com
NEXT_PUBLIC_AUTH_REQUIRED=true
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace-with-a-public-key
```

`NEXT_PUBLIC_REPORT_BASE_URL` is the only value that determines the QR destination. Redeploy the frontend after changing it; the dashboard then renders a QR code containing the public report URL.

`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is public by design and is used only to establish the administrator's Supabase Auth session. Never put a Supabase Secret Key or Gemini key in Vercel or browser code.

## 4. Verify before using the QR in the field

1. Open `https://api.example.com/health`.
2. Log in to the deployed dashboard with the administrator account and scan its QR code on a mobile connection.
3. Upload one gallery image without a description.
4. Confirm the reporter sees the registration message and the dashboard receives a new `OPEN` issue.
5. Confirm anonymous calls to `/api/issues` return `401`, and administrator image URLs work only while their signed URL is valid.
