# Engineering Context

## Tech Stack

### Backend
- **Python**
- **Flask** via `backend/app.py`
- **Flask-Cors** for extension/backend cross-origin access
- **google-generativeai** for Gemini calls in:
  - `backend/parser.py`
  - `backend/tailor.py`
  - likely `backend/app.py` for match score/chat/tailoring endpoints
- **python-docx** for DOCX generation in `backend/writer.py`
- **PyPDF2** for PDF resume text extraction in `backend/parser.py`
- **openpyxl** listed in `backend/requirements.txt` and referenced by README for applied-job Excel tracking
- **docx2pdf** listed in `backend/requirements.txt`, likely used by `backend/app.py` for PDF export

### Frontend
- **Chrome Extension Manifest V3**
- **Plain JavaScript**
  - `frontend/popup.js`
  - `frontend/scraper.js`
- **HTML/CSS**
  - `frontend/popup.html`
  - `frontend/style.css`
- Chrome APIs:
  - `chrome.runtime.sendMessage`
  - likely `chrome.scripting` / `chrome.tabs` from `popup.js`
- Target sites declared in `frontend/manifest.json`:
  - LinkedIn
  - Indeed
  - Glassdoor
  - Monster
  - Dice

## Architecture

This is a **2-part system**:

1. **Chrome extension UI** in `frontend/`
2. **Flask API/backend pipeline** in `backend/`

The main product flow described by the repo is:

1. User uploads a resume in the extension popup
2. Backend parses the resume into structured JSON
3. Extension gets or pastes a JD
4. Backend asks Gemini to tailor the resume JSON
5. Backend renders output files (DOCX/PDF)
6. Backend can compute match score, chat against resume content, and track applied jobs

### Backend module ownership

#### `backend/app.py`
This is the backend entry point and API surface.  
Even though contents were omitted, based on README and the rest of the repo it is the orchestration layer that likely owns:
- Flask app creation
- route definitions
- request/response handling
- calling parser/tailor/writer functionality
- file upload handling
- DOCX/PDF download endpoints
- applied job tracker writes
- match score and chat endpoints

This is the file most likely to glue together:
- `read_resume()` / JSON parsing logic from `parser.py`
- `tailor_resume()` from `tailor.py`
- `build_doc()` from `writer.py`

#### `backend/parser.py`
Owns **resume ingestion into structured JSON**.
Key functions:
- `read_resume(file_path)`  
  Extracts plain text from `.docx` or `.pdf`
- `clean_gemini_output(output_text)`  
  Strips Markdown code fences and validates JSON

The `__main__` block is a standalone script path:
- reads a hardcoded resume file
- prompts Gemini with a fixed schema
- writes `resume_fixed.json`

This module establishes the canonical JSON schema used across the project:
- `Details`
- `Summary`
- `Skills`
- `Work Experience`
- `Project Experience`
- `Education`
- `Achievements and Certifications`

#### `backend/tailor.py`
Owns **resume tailoring via Gemini**.
Key function:
- `tailor_resume(resume_json: dict, job_description: str) -> dict`

Responsibilities:
- prompt construction for tailored summaries/skills/experience/projects
- preserving schema shape
- stripping Gemini code fences
- parsing returned JSON

The `__main__` block supports local script usage:
- reads `resume_fixed.json`
- reads `jd.txt`
- writes `tailored_resume.json`

#### `backend/writer.py`
Owns **rendering tailored JSON into DOCX**.
Key functions:
- `configure_styles(doc)`
- `set_margins(doc)`
- `build_doc(data, out_path)`

Section writers:
- `write_header`
- `write_summary`
- `write_skills`
- `write_experience`
- `write_projects`
- `write_education`
- `write_certifications`

Helpers:
- `add_line_after`
- `add_section_heading`
- `add_bullets`
- `add_tabbed_paragraph`

The data contract here is the same structured JSON used by parser/tailor.  
Notable mismatch: `write_education()` reads `GPA`, but parser schema in `parser.py` does **not** include `GPA`. So writer is tolerant of extra fields, but GPA is not part of the guaranteed input schema.

### Frontend module ownership

#### `frontend/popup.html`
Main extension UI. Owns:
- upload input: `#resumeUpload`
- company/role inputs: `#company`, `#role`
- JD textarea: `#jdText`
- actions:
  - `#uploadBtn`
  - `#getJD`
  - `#checkMatchBtn`
  - `#tailorBtn`
  - `#appliedBtn`
  - download buttons
- chat UI on the flip side:
  - `#chatBox`
  - `#chatInput`
  - `#flipBtn`

Inline CSS is doing most of the actual styling here; `style.css` appears largely unused by this HTML.

#### `frontend/popup.js`
This is the extension controller script and likely the frontend entry point in day-to-day work. It presumably owns:
- DOM event wiring for all popup buttons
- calls to the Flask backend
- triggering content-script injection for JD scraping
- status updates in `#status`
- match score rendering in `#matchResult`
- showing/hiding `#downloads`
- chat request/response handling
- flip interaction

Because nearly every user action starts here, this is one of the primary files developers will touch.

#### `frontend/scraper.js`
Owns **page-level JD scraping**, currently with explicit LinkedIn selectors.
It extracts:
- `company`
- `role`
- `jd`

Then sends:
```js
chrome.runtime.sendMessage({
  type: "jd_data",
  company,
  role,
  jd
});
```

This is isolated from popup logic, which is good: popup triggers execution, scraper focuses only on DOM extraction.

#### `frontend/manifest.json`
Owns extension configuration:
- MV3 metadata
- permissions:
  - `scripting`
  - `activeTab`
- allowed hosts for job boards
- popup entry point: `popup.html`

## Coding Conventions

## Naming patterns

### Python
- Mostly **snake_case** for functions and locals:
  - `read_resume`
  - `clean_gemini_output`
  - `tailor_resume`
  - `build_doc`
  - `write_summary`
- Constants are **UPPER_SNAKE_CASE**:
  - `API_KEY`
  - `RESUME_FILE`
  - `OUTPUT_FILE`
  - `INPUT_FILE`
  - `OUTPUT_DOCX`

### JavaScript / frontend
- DOM variables and locals use **camelCase**:
  - `companyEl`
  - `roleEl`
  - `jdEl`
  - `flipContainer`
  - `matchResult`
- Element IDs in HTML are also camelCase:
  - `uploadBtn`
  - `checkMatchBtn`
  - `downloadDocxBtn`

## Project layout rules
Top-level split is simple and flat:
- `backend/` for Python server and processing scripts
- `frontend/` for Chrome extension assets

There are no nested packages, no tests directory, and no build system.  
Most backend modules are single-purpose scripts with reusable functions plus a `__main__` block.

## Data shape conventions
The project relies on a shared resume JSON schema. Exact key names matter because both tailoring and writing use them directly:
- `"Details"`
- `"Summary"`
- `"Skills"`
- `"Work Experience"`
- `"Project Experience"`
- `"Education"`
- `"Achievements and Certifications"`

Nested keys also use title-cased strings with spaces:
- `"Company Name"`
- `"Bullet Points"`
- `"Tech Stack"`

That means schema changes are high-impact across:
- Gemini prompts in `parser.py` and `tailor.py`
- all writer functions in `writer.py`
- probably route payloads in `app.py`

## Error handling style
Current error handling is lightweight and exception-driven.

Examples:
- `parser.py`
  - raises `FileNotFoundError`
  - raises `ValueError` on unsupported file type
  - falls back to saving raw Gemini output when JSON validation fails
- `tailor.py`
  - raises `ValueError` if Gemini response cannot be parsed as JSON
  - handles `UnicodeDecodeError` when reading `jd.txt`
- `scraper.js`
  - wraps scraping in `try/catch`
  - logs to console via `console.error(...)`

The style is pragmatic rather than centralized. There is no custom exception hierarchy and no evidence of shared error wrappers.

## Logging approach
Logging is mostly **print-based** in Python scripts and **console.error** in frontend scraping.
Examples:
- `print(f"✅ Resume converted and saved as {OUTPUT_FILE}")`
- `print("✅ Tailored resume saved to tailored_resume.json")`
- `print(f"✅ DOCX saved to {OUTPUT_DOCX}")`
- `console.error("LinkedIn scraping error:", err)`

No structured logging framework is present.  
For backend API routes in `app.py`, expect similar simple logging unless that file introduces Flask logger usage.

## Configuration conventions
Secrets are currently hardcoded placeholders:
- `API_KEY = "Gemini_API_KEY"` in `parser.py`
- `genai.configure(api_key="Gemini_API")` in `tailor.py`

This codebase has **not** been normalized around environment variables yet.

## Testing Approach

There are **no test files** in the provided tree and no testing dependencies in `backend/requirements.txt`.

So current testing is effectively:
- **manual UI testing** through the Chrome extension popup
- **manual API testing** by running `backend/app.py`
- **manual script testing** via:
  - `python backend/parser.py`
  - `python backend/tailor.py`
  - `python backend/writer.py`

### Current practical test split
- **Unit tests:** none present
- **Integration tests:** none automated; manual integration across popup ↔ Flask ↔ Gemini ↔ DOCX generation
- **E2E tests:** none automated; likely done by loading the extension and exercising the workflow on LinkedIn job pages

### How to run current manual checks

#### Backend server
```bash
cd backend
pip install -r requirements.txt
python app.py
```

#### Parser script
```bash
cd backend
python parser.py
```

#### Tailor script
```bash
cd backend
python tailor.py
```

#### Writer script
```bash
cd backend
python writer.py
```

#### Extension
- Open Chrome extensions page
- Enable Developer Mode
- Load unpacked extension from `frontend/`
- Open `popup.html` through the extension action
- Test JD scraping on a LinkedIn job page

## Entry Points

## Backend execution start
### `backend/app.py`
Primary runtime entry point for the product.  
This is the server developers will run daily.

### Script entry points
These are secondary standalone entry points for local pipeline debugging:
- `backend/parser.py`
- `backend/tailor.py`
- `backend/writer.py`

Each has an `if __name__ == "__main__":` block.

## Frontend execution start
### `frontend/manifest.json`
Declares the extension popup:
```json
"action": {
  "default_popup": "popup.html"
}
```

### `frontend/popup.html`
Loads:
```html
<script src="popup.js"></script>
```
So popup execution effectively starts in `frontend/popup.js`.

### `frontend/scraper.js`
This is not a static content script in `manifest.json`; it is likely injected dynamically by `popup.js` using `chrome.scripting`. Developers working on JD extraction will touch both files together.

## Daily-touch files

Most likely:
- `backend/app.py` — API routes and orchestration
- `backend/tailor.py` — Gemini tailoring behavior
- `backend/writer.py` — resume output formatting
- `frontend/popup.js` — UI actions and backend calls
- `frontend/scraper.js` — job-page extraction logic
- `frontend/popup.html` — popup controls/layout

Less frequently:
- `backend/parser.py` — resume schema extraction/prompt tuning
- `frontend/manifest.json` — permissions and extension behavior

## Notable implementation details / gotchas

- `README.md` says `extension/`, but actual folder is `frontend/`.
- `popup.html` includes a large inline `<style>` block; `frontend/style.css` appears redundant or stale.
- `scraper.js` currently has real selector support only for LinkedIn despite broader host permissions.
- `writer.py` expects optional `GPA`, but `parser.py`’s schema does not produce it.
- Gemini output cleaning is duplicated in `parser.py` and `tailor.py`; there is no shared utility module.
- API keys are hardcoded placeholders, not environment-driven.
- The schema uses exact human-readable keys with spaces/title case; accidental renaming will break downstream consumers fast.