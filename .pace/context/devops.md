# DevOps Context

## Build & Run

### Backend
Source: `backend/app.py`, dependencies in `backend/requirements.txt`.

Local setup:
```bash
cd backend
python -m venv .venv
# macOS/Linux
source .venv/bin/activate
# Windows
.venv\Scripts\activate

pip install -r requirements.txt
python app.py
```

Expected runtime: Flask app on the port defined inside `backend/app.py` (README implies direct `python app.py` startup; no WSGI server config is present).

Production build:
- There is no `Dockerfile`, `pyproject.toml`, `setup.py`, or pinned lockfile.
- Current production packaging is effectively:
```bash
pip install -r backend/requirements.txt
python backend/app.py
```
Recommended production launcher:
```bash
gunicorn app:app --chdir backend --bind 0.0.0.0:8000
```
if `backend/app.py` exposes `app = Flask(...)`.

### Frontend
This is a Chrome extension, not a bundled web app.
Files:
- `frontend/manifest.json`
- `frontend/popup.html`
- `frontend/popup.js`
- `frontend/scraper.js`

Run locally:
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `frontend/` directory

Build for production:
- No Node/npm build exists.
- Production artifact is the unpacked extension folder or a zipped package of `frontend/`.

Example package step:
```bash
zip -r resume-tailor-extension.zip frontend/
```

## CI/CD Pipeline

There are no CI/CD config files in the repo (`.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`, etc. are absent), so currently no automated pipeline is defined.

### Minimum PR checks to add
On every PR:
1. **Python dependency install**
   ```bash
   pip install -r backend/requirements.txt
   ```
2. **Python syntax validation**
   ```bash
   python -m py_compile backend/app.py backend/parser.py backend/tailor.py backend/writer.py
   ```
3. **Chrome extension manifest validation**
   - Check `frontend/manifest.json` is valid JSON
   ```bash
   python -c "import json; json.load(open('frontend/manifest.json'))"
   ```
4. **Basic smoke packaging**
   - Zip frontend artifact
   - Optionally start Flask app in CI and hit health endpoint if one exists in `backend/app.py`

### Deployment trigger
Because no pipeline exists, deployment is manual today:
- Backend: deploy after merge to main by restarting the Flask process/service
- Frontend: manually reload unpacked extension or publish package to Chrome Web Store if that process is later adopted

Recommended trigger policy:
- **PRs**: lint/syntax/smoke only
- **Push to `main` / tagged release**: deploy backend
- **Version bump in `frontend/manifest.json`**: package extension release

## Infrastructure

## Containers
- No containerization files exist.
- No `Dockerfile` / `docker-compose.yml` present.

Recommended container split:
1. `backend` Flask API container
2. Optional reverse proxy container (nginx) if exposing publicly

## Cloud services
Observed external dependency:
- **Google Gemini API** via `google-generativeai` in:
  - `backend/parser.py`
  - `backend/tailor.py`
  - likely also `backend/app.py`

## Databases / storage
No traditional database is present in the visible files.

Current storage appears file-based:
- Resume JSON output: `resume_fixed.json`
- Tailored resume JSON: `tailored_resume.json`
- Generated DOCX: `Tailored_Resume.docx`
- Excel tracker mentioned in `README.md` via `openpyxl`
- Potential PDF generation via `docx2pdf`

Operational implication:
- Backend likely writes to local filesystem
- Container deployments need a writable volume if outputs must persist across restarts
- Horizontal scaling will be unsafe unless output storage is externalized

## Environment variables required
The code currently hardcodes API keys in source:
- `backend/parser.py`:
  ```python
  API_KEY = "Gemini_API_KEY"
  ```
- `backend/tailor.py`:
  ```python
  genai.configure(api_key="Gemini_API")
  ```

These should be replaced with env vars, e.g.:
- `GEMINI_API_KEY` — required
- `FLASK_ENV` — optional
- `PORT` — if `backend/app.py` supports it
- `OUTPUT_DIR` — recommended for generated JSON/DOCX/PDF files
- `CORS_ALLOWED_ORIGINS` — recommended because `Flask-Cors` is used
- `TRACKER_FILE` — recommended if Excel tracker path is configurable

If `docx2pdf` is used in production, note it may require Microsoft Word on Windows/macOS and is typically unreliable in Linux containers.

## Observability

## Logging setup
No logging config files are present.
Visible Python modules use:
- `print(...)` in `parser.py`, `tailor.py`, `writer.py`
- likely ad hoc Flask logging in `backend/app.py`

Current state:
- stdout/stderr logging only
- no structured logging
- no log rotation config
- no correlation/request IDs

Recommended baseline:
- Run backend with stdout capture through systemd/Docker/cloud runtime
- Replace `print` with Python `logging`
- Log request path, status code, latency, Gemini API failures, file write failures

## Metrics
No metrics stack is configured.
No Prometheus/OpenTelemetry instrumentation is present.

Recommended app metrics:
- request count / latency / error rate
- Gemini API call count / failures / latency
- resume parse failures
- DOCX/PDF generation failures
- Excel tracker write failures

## Health checks
No health endpoint is visible in listed files, though one may exist in `backend/app.py`.
Recommended:
- `GET /healthz` → returns 200 if process is alive
- `GET /readyz` → checks Gemini config, writable output directory, optional tracker file accessibility

If containerized, wire:
```bash
curl -f http://localhost:8000/healthz
```

## Alerting
No alerting configuration exists.

Recommended alerts:
- backend process down / healthcheck failing
- sustained 5xx rate
- Gemini API auth failures
- filesystem write failures
- PDF generation failures if `docx2pdf` is enabled
- abnormal latency on tailor/match endpoints

## Deployment Risks

1. **Hardcoded secrets**
   - `backend/parser.py` and `backend/tailor.py` contain placeholder API keys in source.
   - Must be moved to environment variables before any shared deployment.

2. **File-based persistence**
   - Outputs such as `resume_fixed.json`, `tailored_resume.json`, and `Tailored_Resume.docx` are local files.
   - In containers/serverless, these may be ephemeral.
   - Concurrent requests may overwrite each other if filenames are static.

3. **No pinned dependencies**
   - `backend/requirements.txt` uses broad `>=` ranges.
   - Builds are not reproducible; upstream library changes may break production unexpectedly.

4. **No automated tests**
   - PR safety is low.
   - Breaking changes in `backend/app.py` routes or extension-to-backend contract may go undetected.

5. **PDF generation portability**
   - `docx2pdf` often depends on OS-specific components.
   - Linux CI/containers may fail to generate PDFs even if DOCX generation works.

6. **Schema drift**
   - `writer.py` expects specific JSON keys like:
     - `Details`
     - `Work Experience`
     - `Project Experience`
     - `Education`
     - `Achievements and Certifications`
   - LLM output from `tailor.py` must preserve exact schema or document generation will break.

7. **Potential migration risk in `backend/app.py`**
   - Since `app.py` content is not fully shown, verify:
     - upload paths
     - CORS configuration
     - route names used by `frontend/popup.js`
     - any Excel tracker file paths
     - whether port/debug mode is hardcoded

8. **Extension host permissions**
   - `frontend/manifest.json` restricts host permissions to job sites.
   - If new sites are supported, manifest updates are required and may need extension republishing.

9. **Environment-specific config**
   Watch for:
   - Gemini API key presence
   - writable filesystem path
   - OS support for `docx2pdf`
   - Chrome extension backend base URL inside `frontend/popup.js`
   - CORS allowed origins between extension and Flask backend

## Recommended Immediate Next Steps

1. Add:
   - `Dockerfile`
   - `.github/workflows/ci.yml`
   - `.env.example`
2. Move Gemini keys to `GEMINI_API_KEY`
3. Add unique per-request output filenames
4. Add `/healthz`
5. Pin dependencies in `backend/requirements.txt`
6. Verify `frontend/popup.js` backend API URL and document it explicitly
7. Add smoke tests for:
   - upload
   - tailor
   - DOCX generation
   - match score endpoint