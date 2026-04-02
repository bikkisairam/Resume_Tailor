# Security Context

## Authentication & Authorisation
- No user authentication or authorization controls are visible in the provided backend modules (`backend/parser.py`, `backend/tailor.py`, `backend/writer.py`) or manifest/frontend files.
- The Chrome extension appears to rely on local user interaction only; there is no evidence of login, session management, API key per user, RBAC, or permission checks.
- `frontend/manifest.json` grants the extension `activeTab`, `scripting`, and `storage` permissions, plus host access to LinkedIn, Indeed, Glassdoor, Monster, and Dice. This is extension-level privilege, not user auth.
- Backend likely exposes Flask routes in `backend/app.py`, but the file contents were not provided. Authentication on API endpoints cannot be confirmed. Given the surrounding code, assume endpoints may be unauthenticated unless `app.py` proves otherwise.

## Sensitive Data Handling
- Hardcoded API credentials placeholders are present:
  - `backend/parser.py`: `API_KEY = "Gemini_API_KEY"`
  - `backend/tailor.py`: `genai.configure(api_key="Gemini_API")`
- Resume contents contain clear PII and are processed in multiple places:
  - Parsed schema in `backend/parser.py` includes `Name`, `Email`, `Phone`, `Location`, `LinkedIn`, `GitHub`.
  - `backend/writer.py` writes these fields directly into generated output documents via `write_header()`.
- Resume and JD data are transmitted to Google Gemini:
  - `backend/parser.py`: `model.generate_content(prompt)` sends full resume text.
  - `backend/tailor.py`: `model.generate_content(prompt)` sends full structured resume JSON plus job description.
- Local storage/files:
  - `backend/parser.py` writes parsed resume data to `resume_fixed.json`.
  - `backend/tailor.py` reads `resume_fixed.json`, `jd.txt`, and writes `tailored_resume.json`.
  - `backend/writer.py` writes `Tailored_Resume.docx`.
  - These files likely contain PII and career history unencrypted on disk.
- Chrome extension local persistence:
  - `frontend/test_popup_theme.js` shows use of `chrome.storage.local` for theme preference (`popupTheme`). No evidence in provided code that resumes/JDs are stored there, but `popup.js` was not included.
- `frontend/scraper.js` extracts and sends company, role, and JD text from the active page via `chrome.runtime.sendMessage(...)`. This is not high-sensitivity by itself, but it is data collection from third-party pages.

## Attack Surface
- **Browser extension surface**
  - `frontend/manifest.json` host permissions allow code execution/data access on:
    - `https://www.linkedin.com/*`
    - `https://*.indeed.com/*`
    - `https://*.glassdoor.com/*`
    - `https://*.monster.com/*`
    - `https://*.dice.com/*`
  - `frontend/scraper.js` scrapes DOM content from job pages and sends it to the extension runtime.
  - Only LinkedIn selectors are implemented in `frontend/scraper.js`; permissions for other job sites are broader than current functionality, increasing unnecessary exposure.
- **Backend/API surface**
  - Flask app exists in `backend/app.py`, but routes were not provided. This is the main unknown attack surface and should be reviewed before testing.
  - Based on README/product context, expected endpoints likely include upload, tailor, match score, download, applied tracking, and chat.
- **Input validation**
  - `backend/parser.py`:
    - `read_resume(file_path)` only validates file extension by suffix (`.docx` / `.pdf`).
    - No file size limits, content-type validation, path normalization, or sandboxing shown.
  - `backend/tailor.py`:
    - `tailor_resume(resume_json, job_description)` directly interpolates untrusted `job_description` and resume JSON into LLM prompts.
    - This is vulnerable to prompt injection / instruction override from malicious job descriptions or resume content.
  - `frontend/scraper.js`:
    - Uses `innerText`, reducing HTML injection risk in the scrape itself.
- **Injection risks**
  - No SQL usage is visible in provided files; no direct SQL injection sink observed.
  - No shell/command execution is visible in provided files.
  - `docx2pdf` is listed in `backend/requirements.txt`; if used in `backend/app.py`, it may invoke platform-specific automation, but no command injection sink is visible in the provided code.
  - Main practical injection risk is **LLM prompt injection** via resume/JD content in `backend/parser.py` and `backend/tailor.py`.
- **Parsing risks**
  - `PyPDF2.PdfReader` in `backend/parser.py` processes untrusted PDFs. Malformed PDFs may cause denial-of-service or parser issues.
  - `python-docx` processes DOCX input; malformed Office files should be treated as untrusted content.

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
- All dependencies are loosely pinned with lower bounds only (`>=`). Builds are non-reproducible and may pull vulnerable or breaking future versions.
- `google-generativeai` should be reviewed for current maintenance/deprecation status; Google has been shifting SDKs, so this may become stale quickly.
- `PyPDF2` has historically had robustness/security concerns around parsing malformed PDFs; keep updated and treat uploads as untrusted.
- `docx2pdf` can be operationally fragile and depends on local Word automation on some platforms; not necessarily a vulnerability, but a reliability and environment-hardening concern if exposed through backend endpoints.
- No lockfile or hashes are present.
- No evidence of automated dependency scanning (`pip-audit`, `safety`, Dependabot, etc.).

## Secrets Management
- Secrets are not managed securely in the visible code:
  - `backend/parser.py` hardcodes `API_KEY`.
  - `backend/tailor.py` hardcodes Gemini API key value placeholder in code.
- This pattern creates risk of:
  - committing real secrets to version control,
  - leaking secrets through screenshots/shared code,
  - difficulty rotating keys across environments.
- No environment variable loading, secrets manager integration, or `.env` handling is visible in the provided files.
- Logging/leakage:
  - `backend/parser.py` and `backend/tailor.py` do not explicitly log API keys.
  - `backend/tailor.py` raises `ValueError("Gemini response could not be parsed as JSON:\n" + resp_text)`, which could leak model output into logs/exceptions. Since prompts include resume/JD data, malformed responses may expose sensitive resume or job content in logs.
  - `backend/parser.py` may print warnings and writes raw Gemini output if JSON validation fails (`clean_gemini_output()`), potentially storing unexpected sensitive or prompt-injected content.
- Generated artifacts (`resume_fixed.json`, `tailored_resume.json`, `Tailored_Resume.docx`) should be treated as sensitive and are currently written to predictable local paths without access controls.

## Notable Files / Review Priorities
1. `backend/app.py` — highest priority; routes, CORS policy, file upload handling, download endpoints, and any auth need review.
2. `frontend/popup.js` — likely contains fetch targets and client-side handling of uploaded files/resume/JD data.
3. `backend/parser.py` / `backend/tailor.py` — hardcoded secret pattern and LLM prompt injection exposure.
4. `frontend/manifest.json` — host permissions are broader than implemented need.
5. Output/storage files — local PII persistence in JSON/DOCX without encryption or retention controls.