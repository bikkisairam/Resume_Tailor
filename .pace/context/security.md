# Security Context

## Authentication & Authorisation
- No authentication or authorisation mechanisms are visible in the provided files.
- The backend appears to be a Flask API (`backend/app.py`), but its contents were not included. Based on the frontend behavior and README, it likely exposes unauthenticated endpoints for:
  - resume upload/parsing
  - tailoring
  - match score
  - document generation/download
  - applied job tracking
  - chat
- The Chrome extension frontend (`frontend/popup.js`, not shown) likely calls the Flask backend directly. No evidence of:
  - user accounts
  - sessions
  - API keys on incoming requests
  - role/permission checks
  - CSRF protections
- Risk: if `backend/app.py` binds on localhost without auth, any local webpage/app may be able to call it depending on CORS configuration. `backend/requirements.txt` includes `Flask-Cors`, so review `backend/app.py` for permissive `CORS(app)` usage.

## Sensitive Data Handling
### Credentials / tokens
- Hardcoded Gemini API keys/placeholders are present:
  - `backend/parser.py`: `API_KEY = "Gemini_API_KEY"`
  - `backend/tailor.py`: `genai.configure(api_key="Gemini_API")`
- This pattern strongly suggests secrets may be manually pasted into source files, creating version control leakage risk.

### PII
- Resume parsing and generation handles substantial PII:
  - `backend/parser.py` extracts full resume text via `read_resume()`
  - Prompt in `backend/parser.py` explicitly includes `Name`, `Email`, `Phone`, `Location`, `LinkedIn`, `GitHub`
  - `backend/writer.py` writes these fields back into generated documents in `write_header()`
- Parsed and tailored resume data is stored on disk in plaintext JSON/DOCX:
  - `backend/parser.py`: `resume_fixed.json`
  - `backend/tailor.py`: `tailored_resume.json`
  - `backend/writer.py`: `Tailored_Resume.docx`
- README states applied jobs are saved into an Excel tracker, implying additional storage of job history and likely PII in backend files via `openpyxl`.

### Transmission
- `backend/parser.py` and `backend/tailor.py` send full resume content and job descriptions to Google Gemini via `model.generate_content(prompt)`.
- This transmits PII and employment history to a third-party LLM provider.
- `frontend/scraper.js` scrapes job description, company, and role from LinkedIn and sends it to the extension runtime with `chrome.runtime.sendMessage(...)`; likely then forwarded to backend by `popup.js`.

### Logging / console exposure
- `frontend/scraper.js` logs scraping failures with `console.error("LinkedIn scraping error:", err);`
- `backend/parser.py` prints warnings and success messages; low sensitivity by itself, but review `backend/app.py` for request/response logging that may include resume or JD content.

## Attack Surface
## Exposed endpoints
- Exact routes are unknown because `backend/app.py` content was omitted.
- Based on README/UI, expected backend endpoints likely include:
  - upload resume
  - tailor resume
  - match score
  - generate/download DOCX/PDF
  - applied job save
  - chat
- These are all likely reachable from the Chrome extension and possibly directly over HTTP.

## Input sources
Untrusted input enters from:
- resume file upload in `frontend/popup.html` (`#resumeUpload`, `.docx,.pdf`)
- company/role/JD text fields in `frontend/popup.html`
- page scraping in `frontend/scraper.js`
- local files read by backend scripts:
  - `backend/parser.py`: DOCX/PDF
  - `backend/tailor.py`: `jd.txt`, `resume_fixed.json`

## Input validation
- Very little validation is visible in the backend helper scripts:
  - `backend/parser.py:read_resume()` only checks extension by suffix and existence.
  - No file size limits, MIME validation, content validation, or malware scanning.
  - `backend/tailor.py:tailor_resume()` accepts arbitrary `resume_json` and `job_description` and embeds both directly into LLM prompts.
- Prompt injection risk is significant:
  - `job_description` is untrusted, scraped from arbitrary job pages or pasted by user.
  - `resume_text` may contain hostile content.
  - Both are inserted directly into prompts in `backend/parser.py` and `backend/tailor.py`.
  - This can alter model output, break JSON schema, or induce data exfiltration in downstream workflows.

## Injection risks
### SQL injection
- No SQL usage is visible in provided files.

### Command injection
- No direct shell execution is visible in provided files.
- However, `backend/requirements.txt` includes `docx2pdf`, which often depends on platform-specific automation. Review `backend/app.py` for any subprocess usage around PDF generation.

### File/path handling
- `backend/parser.py` and `backend/tailor.py` use fixed filenames, not user-supplied paths, which reduces path traversal in these scripts.
- Need to inspect `backend/app.py` for upload filename handling (`secure_filename`, temp directory use, overwrite behavior).

### Document parsing
- `backend/parser.py:read_resume()` parses PDF via `PyPDF2.PdfReader` and DOCX via `python-docx.Document`.
- Parsing untrusted files can be a DoS vector (large or malformed PDFs/DOCX causing memory/CPU consumption).

### Output handling
- `backend/tailor.py` attempts to strip markdown fences and `json.loads()` model output.
- No schema validation after parsing. Malformed or oversized model output could cause failures or unexpected content in generated documents.

## Dependency Risk
From `backend/requirements.txt`:
- `Flask>=3.0.0`
- `Flask-Cors>=4.0.0`
- `google-generativeai>=0.7.0`
- `python-docx>=1.1.0`
- `PyPDF2>=3.0.0`
- `openpyxl>=3.1.2`
- `docx2pdf>=0.1.8`

Observations:
- All dependencies are loosely pinned (`>=` only). This creates supply-chain unpredictability and non-reproducible builds.
- `google-generativeai` should be reviewed for current maintenance status and deprecation guidance; Google has shifted some SDKs over time.
- `PyPDF2` has historically had robustness issues with malformed PDFs; even absent a known RCE, it is a risky parser for untrusted files from a DoS perspective.
- `docx2pdf` may be operationally fragile/unmaintained depending on environment; confirm maintenance and whether it invokes Microsoft Word/COM automation on Windows.
- No lockfile or hashes are present.

Recommended review:
- run `pip-audit` or `safety` against `backend/requirements.txt`
- pin exact versions
- verify maintenance status of `google-generativeai` and `docx2pdf`

## Secrets Management
- Secrets are not loaded from environment variables or a secret manager in the visible code.
- Hardcoded secret pattern:
  - `backend/parser.py`: `API_KEY = "Gemini_API_KEY"`
  - `backend/tailor.py`: `genai.configure(api_key="Gemini_API")`
- This is the main secrets-management weakness:
  - easy to commit real keys into git
  - difficult rotation
  - shared across environments
- No `.env`, config module, or secret loading mechanism is shown.
- No evidence of secret redaction in logs.
- If `backend/app.py` returns exceptions verbosely, stack traces could expose local paths, filenames, prompt content, or configured secrets.

## Files/Functions to Prioritise in Pentest Review
1. `backend/app.py`
   - enumerate routes, auth, CORS policy, upload handling, file storage paths, download endpoints, chat endpoint, Excel write logic
2. `backend/parser.py`
   - `read_resume()`
   - hardcoded `API_KEY`
   - prompt construction with raw resume text
3. `backend/tailor.py`
   - `tailor_resume()`
   - hardcoded API key
   - prompt injection / JSON parsing robustness
4. `backend/writer.py`
   - `build_doc()`, `write_header()`, `write_experience()`
   - confirm generated documents cannot include unexpected active content or unsafe filenames
5. `frontend/popup.js`
   - backend base URL, request methods, token handling, download flows, any storage in `chrome.storage` or `localStorage`
6. `frontend/scraper.js`
   - untrusted JD scraping source flowing into backend/LLM without sanitisation

## Key Risks Summary
- Likely no authn/authz on backend API
- Hardcoded API secrets in source
- Plaintext storage of resumes and tailored outputs containing PII
- Third-party transmission of full resume/JD content to Gemini
- Prompt injection via scraped/pasted job descriptions
- Possible overly permissive CORS in unseen `backend/app.py`
- Unpinned dependencies and risky document parsing libraries