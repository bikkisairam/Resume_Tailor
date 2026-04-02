# Engineering Context

## Tech Stack

### Backend
- **Python**
- **Flask** and **Flask-Cors** (`backend/requirements.txt`)
- **Google Gemini SDK** via `google-generativeai`
- **python-docx** for DOCX generation and formatting (`backend/writer.py`)
- **PyPDF2** for resume PDF text extraction (`backend/parser.py`)
- **openpyxl** for Excel tracking support per README / backend requirements
- **docx2pdf** for PDF export support per README / backend requirements

### Frontend
- **Chrome Extension (Manifest V3)** (`frontend/manifest.json`)
- **Vanilla JavaScript** (`frontend/popup.js`, `frontend/scraper.js`)
- **HTML/CSS** (`frontend/popup.html`, `frontend/style.css`)
- Chrome APIs used:
  - `chrome.tabs`
  - `chrome.scripting`
  - `chrome.runtime.onMessage`
  - `chrome.storage.local`

### Testing
- **Node.js built-in modules only** in `frontend/test_popup_theme.js`
  - `assert`
  - `fs`
  - `path`
  - `vm`

---

## Architecture

This repo is split into a **Flask backend** and a **Chrome extension frontend**.

### Backend structure

#### `backend/app.py`
- Main Flask server entry point.
- Owns HTTP API endpoints the extension calls.
- Based on README/product context, this is the orchestration layer for:
  - resume upload/parsing
  - tailoring
  - match score
  - document download
  - applied-job tracking
  - chat mode
- This is the file to inspect first when tracing request flow end-to-end from `frontend/popup.js`.

#### `backend/parser.py`
- Owns **resume ingestion and normalization into structured JSON**.
- Key functions:
  - `read_resume(file_path)`:
    - reads `.docx` with `Document`
    - reads `.pdf` with `PyPDF2.PdfReader`
  - `clean_gemini_output(output_text)`
    - strips markdown code fences
    - validates/normalizes JSON
- Script mode reads `RESUME_FILE`, sends prompt to Gemini, writes `resume_fixed.json`.

#### `backend/tailor.py`
- Owns **LLM-based resume rewriting against a job description**.
- Key function:
  - `tailor_resume(resume_json: dict, job_description: str) -> dict`
- Builds a long prompt with tailoring rules, calls Gemini, strips markdown fences, parses JSON, and returns tailored JSON.
- Script mode reads `resume_fixed.json` and `jd.txt`, writes `tailored_resume.json`.

#### `backend/writer.py`
- Owns **rendering tailored JSON into a formatted DOCX**.
- Main build function:
  - `build_doc(data: dict, out_path: Path)`
- Section writers:
  - `write_header`
  - `write_summary`
  - `write_skills`
  - `write_experience`
  - `write_projects`
  - `write_education`
  - `write_certifications`
- Styling/layout helpers:
  - `configure_styles`
  - `set_margins`
  - `add_section_heading`
  - `add_tabbed_paragraph`
- Script mode reads `tailored_resume.json`, writes `Tailored_Resume.docx`.

### Frontend structure

#### `frontend/popup.html`
- Main extension UI.
- Contains the controls referenced by `popup.js`, including IDs verified by tests:
  - `getJD`
  - `tailorBtn`
  - `downloadDocxBtn`
  - `downloadPdfBtn`
  - `uploadBtn`
  - `resumeUpload`
  - `status`
  - `appliedBtn`
  - `checkMatchBtn`
  - `matchResult`
  - `downloads`
  - `flipBtn`
  - `flipContainer`
  - `chatBox`
  - `chatInput`
  - `company`
  - `role`
  - `jdText`
  - `themeToggle`
  - `themeToggleLabel`

#### `frontend/popup.js`
- Main client-side controller for the popup.
- Owns:
  - wiring button handlers
  - talking to backend APIs with `fetch`
  - invoking content-script injection with `chrome.scripting.executeScript`
  - receiving scraped JD data through `chrome.runtime.onMessage`
  - theme persistence with `chrome.storage.local`
  - showing/hiding download controls and status text
- This is the frontend file most developers will touch daily.

#### `frontend/scraper.js`
- Content script injected into job pages.
- Current implementation is **LinkedIn-specific**.
- Extracts:
  - company
  - role
  - JD text
- Sends result back to popup with:
  ```js
  chrome.runtime.sendMessage({
    type: "jd_data",
    company,
    role,
    jd
  });
  ```

#### `frontend/style.css`
- Base popup styling.
- Small file; likely only core/default styles. Theme behavior is mainly driven by DOM state set in `popup.js`.

---

## Coding Conventions

## Naming patterns
### Python
- Functions use **snake_case**:
  - `read_resume`
  - `clean_gemini_output`
  - `tailor_resume`
  - `write_experience`
- Module names are lowercase single-purpose files:
  - `parser.py`
  - `tailor.py`
  - `writer.py`
  - `app.py`
- Constants are uppercase:
  - `API_KEY`
  - `RESUME_FILE`
  - `OUTPUT_FILE`
  - `INPUT_FILE`
  - `OUTPUT_DOCX`

### JavaScript
- Variables and functions use **camelCase**:
  - `buildEnvironment`
  - `flushMicrotasks`
  - `storageSetCalls`
  - `runtimeListeners`
- DOM nodes are commonly named with `El` suffix in scraper code:
  - `companyEl`
  - `roleEl`
  - `jdEl`

## Project layout rules
- Backend logic is flat under `backend/`; there are no packages/subpackages yet.
- Frontend extension assets are flat under `frontend/`.
- Scripts are currently organized by responsibility, not by layers/classes:
  - parse JSON
  - tailor JSON
  - write DOCX
- There are **no shared utility modules** yet; helper logic stays local to each file.

## Error handling style
### Python
- Mostly direct exceptions rather than custom exception types.
- Examples:
  - `FileNotFoundError` in `read_resume`
  - `ValueError` for unsupported format in `read_resume`
  - `ValueError` when Gemini JSON parsing fails in `tailor_resume`
- Failure handling is lightweight and synchronous; no retry wrappers or structured API error objects are visible in provided modules.

### JavaScript
- Browser-side scraping uses `try/catch` and logs to console:
  - `console.error("LinkedIn scraping error:", err);`
- Test file uses Node `assert` and throws on failure naturally.

## Logging approach
- Backend uses simple `print(...)` status logging in script mode:
  - `print(f"✅ Resume converted and saved as {OUTPUT_FILE}")`
  - `print("✅ Tailored resume saved to tailored_resume.json")`
  - `print(f"✅ DOCX saved to {OUTPUT_DOCX}")`
- No structured logging framework is present.
- Frontend uses `console.error(...)` for scraping failures.
- Expect ad hoc logging rather than centralized logger configuration.

## Data/schema conventions
The JSON resume schema is centered around these top-level keys from `backend/parser.py`:
- `Details`
- `Summary`
- `Skills`
- `Work Experience`
- `Project Experience`
- `Education`
- `Achievements and Certifications`

Important mismatch:
- `backend/writer.py` reads optional `Education[].GPA`
- `backend/parser.py` schema does **not** output `GPA`

Also note:
- parser prompt requires bullet text without symbols
- writer adds `•` when rendering DOCX

---

## Testing Approach

## Frameworks used
- There is **no Python test suite** shown in the provided tree.
- Frontend has a **custom Node-based test script**:
  - `frontend/test_popup_theme.js`

## Current test coverage
### Frontend unit-style tests
`frontend/test_popup_theme.js` tests popup theme behavior by:
- creating fake DOM elements (`FakeElement`, `FakeClassList`)
- mocking Chrome extension APIs
- loading `frontend/popup.js` into a VM context
- asserting UI and storage behavior

Covered theme behaviors:
- theme toggle control exists in `popup.html`
- `applyTheme("dark")` updates body attribute and label
- `applyTheme("light")` restores state
- saved theme restores on popup init
- default theme is light
- theme change persists to `chrome.storage.local`
- theme toggle does not trigger backend `fetch`

This is closer to a **unit/integration hybrid** for popup behavior.

## Unit vs integration vs e2e
- **Unit:** minimal; mostly frontend theme logic in isolation
- **Integration:** popup script + fake DOM + fake Chrome APIs in `test_popup_theme.js`
- **E2E:** none present
- **Backend API/integration tests:** none present in provided files

## How to run tests
From repo root:
```bash
node frontend/test_popup_theme.js
```

There is no visible `package.json`, so tests rely on having Node available and use only built-in modules.

---

## Entry Points

## Runtime entry points

### Backend server
- `backend/app.py`
- Start with:
  ```bash
  cd backend
  pip install -r requirements.txt
  python app.py
  ```

### Standalone backend scripts
Useful for debugging specific pipeline stages independently:

- Parse resume:
  ```bash
  python backend/parser.py
  ```
- Tailor parsed resume:
  ```bash
  python backend/tailor.py
  ```
- Generate DOCX:
  ```bash
  python backend/writer.py
  ```

These scripts depend on local files like:
- `resume_fixed.json`
- `jd.txt`
- `tailored_resume.json`

### Chrome extension
- Extension entry is `frontend/manifest.json`
- Popup entry is:
  - `frontend/popup.html`
- Popup behavior is implemented in:
  - `frontend/popup.js`

### Content script execution
- `frontend/scraper.js` is not declared statically in the manifest; it is intended to be injected dynamically via `chrome.scripting.executeScript` from `popup.js`.

## Files a developer will touch most often
- `backend/app.py` — API contract and request routing
- `backend/parser.py` — resume schema extraction and Gemini prompt
- `backend/tailor.py` — tailoring prompt and JSON parsing
- `backend/writer.py` — output formatting and DOCX layout
- `frontend/popup.js` — main UI behavior and backend calls
- `frontend/popup.html` — popup controls / DOM IDs
- `frontend/scraper.js` — JD scraping selectors

## Important implementation details to know on day one
- Gemini API keys are currently hardcoded placeholders in:
  - `backend/parser.py`
  - `backend/tailor.py`
- Frontend manifest has host permissions for multiple job sites, but only LinkedIn scraping is implemented in `frontend/scraper.js`.
- The backend pipeline is effectively:
  1. parse uploaded resume into JSON
  2. tailor JSON to JD
  3. render tailored JSON to DOCX/PDF
- The UI relies heavily on stable element IDs in `popup.html`; changing IDs will break `popup.js` and `frontend/test_popup_theme.js`.