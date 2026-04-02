# DevOps Context

## Build & Run

### Backend
Source: `backend/requirements.txt`, `backend/app.py`

Install dependencies:
```bash
cd backend
python -m venv .venv
# Linux/macOS
source .venv/bin/activate
# Windows
.venv\Scripts\activate

pip install --upgrade pip
pip install -r requirements.txt
```

Run locally:
```bash
python app.py
```

Notes:
- Flask app entrypoint is `backend/app.py`.
- LLM/document dependencies come from `backend/requirements.txt`:
  - `Flask`
  - `Flask-Cors`
  - `google-generativeai`
  - `python-docx`
  - `PyPDF2`
  - `openpyxl`
  - `docx2pdf`

### Frontend
Source: `frontend/manifest.json`, `frontend/popup.html`, `frontend/popup.js`

This is a Chrome extension, not a bundled web app. No npm build is defined in the repo.

Run locally:
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `frontend/` directory

### Frontend test
There is one Node-based test script:
```bash
node frontend/test_popup_theme.js
```

This validates theme behavior in `frontend/popup.js` against `frontend/popup.html`.

### Production build
No formal production build pipeline exists in the repository:
- Backend is interpreted Python; deploy source plus `requirements.txt`
- Frontend ships as static extension files from `frontend/`

If packaging the extension for release, zip the `frontend/` directory contents after validation.

---

## CI/CD Pipeline

## Current state
No CI workflow files are present in the provided tree (`.github/workflows/*` is absent). That means no repository-native automated pipeline is currently defined.

## Recommended PR checks
Given the actual repo contents, every PR should run:

1. **Python dependency install smoke test**
   ```bash
   pip install -r backend/requirements.txt
   ```

2. **Backend syntax validation**
   ```bash
   python -m py_compile backend/app.py backend/parser.py backend/tailor.py backend/writer.py
   ```

3. **Frontend test**
   ```bash
   node frontend/test_popup_theme.js
   ```

4. **Extension manifest validation**
   - At minimum, parse `frontend/manifest.json` as JSON.

## Deployment trigger
No deployment automation is defined in-repo. If adding CI/CD, use:
- **PRs**: run checks only
- **Push to `main` / release tag**: deploy backend
- **Tagged release**: package extension zip from `frontend/`

A practical pipeline would be:
- Trigger on `pull_request` to `main`
- Trigger deployment on `push` to `main` after checks pass

---

## Infrastructure

## Application topology
This service has two runtime parts:

1. **Chrome Extension**
   - Static files in `frontend/`
   - Runs in user browser
   - Requires Chrome Extension Manifest V3 (`frontend/manifest.json`)

2. **Flask Backend**
   - Python service in `backend/app.py`
   - Likely exposes APIs consumed by `frontend/popup.js`
   - Uses Gemini API, file parsing, DOCX/PDF generation, and Excel write operations

## Containers
No Dockerfile or container manifests are present. Containerization is not yet defined in-repo.

Recommended container baseline for backend:
- Python 3.11 slim image
- Install OS packages needed by `docx2pdf` only if PDF conversion is truly required in Linux runtime
- Mount writable volume for generated files if backend stores outputs on disk

Important risk:
- `docx2pdf` often depends on Microsoft Word on Windows/macOS and is unreliable/not viable in typical Linux containers. PDF generation must be validated in target environment before production rollout.

## Cloud services
Inferred required external services:
- **Gemini API** via `google-generativeai`
- Optional object/file storage if generated resumes are persisted externally
- No explicit managed DB is present in repo

## Databases / storage
No database config files are present.

Actual storage visible from code and README:
- JSON files on local disk
  - `resume_fixed.json`
  - `tailored_resume.json`
- Generated DOCX on local disk
  - `Tailored_Resume.docx`
- Excel tracker via `openpyxl` per README
- Uploaded resume files likely handled by backend filesystem

This means current implementation is primarily **filesystem-backed**, not DB-backed.

## Environment variables required
The code currently hardcodes placeholder Gemini keys in:
- `backend/parser.py`
- `backend/tailor.py`

These should be replaced with environment variables, e.g.:
```bash
GEMINI_API_KEY=<key>
FLASK_ENV=production
PORT=5000
```

Potentially required by `backend/app.py` as well:
- `CORS_ALLOWED_ORIGINS`
- `OUTPUT_DIR`
- `UPLOAD_DIR`
- `TRACKER_FILE`

Because `backend/app.py` content was not included, verify its actual config reads before deployment.

---

## Observability

## Logging
No structured logging config is visible in provided files.
Current code uses simple `print()` in scripts such as:
- `backend/parser.py`
- `backend/tailor.py`
- `backend/writer.py`

Recommended:
- Standardize backend logging with Python `logging`
- Emit request logs, Gemini API errors, file generation failures, and JSON parse failures
- Log to stdout for container/cloud collection

Frontend/browser observability:
- `frontend/scraper.js` uses `console.error("LinkedIn scraping error:", err);`
- Extension errors will only be visible in extension/page devtools unless explicitly reported

## Metrics
No metrics stack is defined.

Recommended minimum backend metrics:
- request count / latency by endpoint
- Gemini call count / latency / failure rate
- file generation success/failure counts
- upload parse success/failure counts

## Health checks
No health endpoint is visible from the provided files, though `backend/app.py` may contain one.

Recommended:
- Add `GET /healthz` returning 200 with dependency-light response
- Add `GET /readyz` if startup or external API readiness matters

For deployment, wire load balancer/container health checks to `/healthz`.

## Alerting
No alerting config exists.

Recommended alerts:
- Backend unavailable / health check failing
- Error rate spike on tailor/upload/download endpoints
- Gemini API failure spike or quota exhaustion
- Disk usage growth if generated files remain on local filesystem
- Excel tracker write failures if “Applied” depends on a single local file

---

## Deployment Risks

## 1. Hardcoded secrets
Files:
- `backend/parser.py`
- `backend/tailor.py`

Risk:
- API keys are currently placeholder strings in source
- Real keys must never be committed
- Deployment will fail if env-based secret injection is not implemented

## 2. Filesystem coupling
The backend scripts read/write fixed filenames:
- `resume_fixed.json`
- `tailored_resume.json`
- `Tailored_Resume.docx`

Risk:
- Concurrent users can overwrite each other’s files
- Stateless/containerized deployments will lose files on restart unless persistent storage is mounted
- Multi-replica deployments are unsafe without shared storage or per-request temp paths

## 3. PDF generation portability
Dependency:
- `docx2pdf`

Risk:
- Often incompatible with Linux server/container environments
- Production PDF generation may fail even if local Windows dev works

## 4. Schema drift
Files:
- `backend/parser.py`
- `backend/writer.py`

Observed mismatch:
- Parser’s Education schema does not include `GPA`
- Writer optionally reads `GPA`

Risk:
- Non-fatal today, but schema changes across parser/tailor/writer can break rendering or produce incomplete output

## 5. LLM output fragility
Files:
- `backend/parser.py`
- `backend/tailor.py`

Risk:
- Gemini may return invalid JSON
- `tailor.py` raises on JSON parse failure
- Production requests can fail intermittently without retry/validation strategy

## 6. No formal migration system
No database migrations exist because no DB layer is defined.
However, there is still a data compatibility risk:
- JSON schema changes across releases
- Excel tracker column changes
- generated document format changes

Treat these as “schema migrations” even without a database.

## 7. Environment-specific config
Watch closely:
- Gemini API key presence and quota
- OS/runtime support for `docx2pdf`
- writable directories for uploads and generated files
- CORS behavior in Flask for Chrome extension origin
- Chrome extension host permissions in `frontend/manifest.json`

## 8. Extension/backend contract changes
Risk:
- `frontend/popup.js` likely expects specific backend endpoints and response shapes from `backend/app.py`
- Any backend API change is effectively a breaking change for already-installed extension versions

Recommended release discipline:
- version backend endpoints
- version extension package
- deploy backward-compatible backend changes before publishing updated extension

--- 

## Suggested minimal CI job
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
python -m py_compile backend/app.py backend/parser.py backend/tailor.py backend/writer.py
node frontend/test_popup_theme.js
python -c "import json; json.load(open('frontend/manifest.json'))"
```

## Suggested minimal deploy procedure
1. Inject `GEMINI_API_KEY`
2. Install `backend/requirements.txt`
3. Start `python backend/app.py`
4. Verify health endpoint or manual smoke test
5. Load/test extension from `frontend/`
6. Confirm upload, tailor, DOCX generation, and match score flows end-to-end