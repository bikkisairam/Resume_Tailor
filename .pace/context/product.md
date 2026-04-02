# Product Context

## What This Product Does
Resume Tailor is a Chrome extension backed by Flask that helps job seekers adapt a resume for a specific job posting. A user uploads a `.docx` or `.pdf` resume, pulls a job description from a LinkedIn job page or pastes it manually, gets an AI match score, generates a tailored resume aligned to that job, and downloads the output as a formatted document. The UI also exposes an application-tracking action and a chat mode for asking resume-based questions.

## Core Features
- **Resume upload and parsing**
  - Users can upload resume files from the popup UI (`frontend/popup.html`).
  - Backend reads `.docx` and `.pdf` resumes and converts them into a fixed JSON schema using Gemini (`backend/parser.py`).
- **Job description scraping from LinkedIn**
  - Content script extracts **company**, **role**, and **job description** from LinkedIn job pages (`frontend/scraper.js`).
  - Extension can inject scraping logic via Chrome scripting APIs (`frontend/popup.js`, implied by manifest permissions and message flow).
- **Manual job description entry**
  - Popup includes fields for company, role, and JD text (`frontend/popup.html`).
- **AI resume tailoring**
  - Backend sends parsed resume JSON plus JD text to Gemini and rewrites:
    - summary,
    - skills,
    - work experience bullets,
    - project bullets
    while preserving personal details and keeping the same JSON schema (`backend/tailor.py`).
- **Structured resume document generation**
  - Tailored JSON is rendered into a formatted DOCX with sections for Summary, Skills, Experience, Projects, Education, and Achievements & Certifications (`backend/writer.py`).
- **Download actions**
  - Popup exposes separate buttons for **DOCX** and **PDF** downloads (`frontend/popup.html`).
- **Match score**
  - Popup includes a **Check Match** action and result area (`frontend/popup.html`).
  - README describes this as an AI-generated resume-to-JD match score.
- **Applied job tracking**
  - Popup includes an **Applied** button (`frontend/popup.html`).
  - README says applied jobs are saved into an Excel tracker.
- **Chat mode**
  - Popup includes a flip-card/chat interface with `flipBtn`, `flipContainer`, `chatBox`, and `chatInput` (`frontend/popup.html`, `frontend/popup.js`).
  - README describes chat as answering questions based on the uploaded resume.
- **Theme preference**
  - Popup supports light/dark mode toggling and persists the user’s theme in `chrome.storage.local` (`frontend/test_popup_theme.js`, `frontend/popup.js`).

## User Flows
- **Upload and parse a resume**
  1. User opens the extension popup.
  2. User selects a `.docx` or `.pdf` file via the resume upload control.
  3. Backend extracts raw text from the file and converts it to structured JSON with sections like Details, Summary, Skills, Work Experience, Project Experience, Education, and Achievements (`backend/parser.py`).

- **Capture a JD from LinkedIn**
  1. User opens a LinkedIn job posting.
  2. User clicks **Get JD** in the extension.
  3. The content script scrapes the page for company name, role title, and JD text (`frontend/scraper.js`).
  4. That data is sent back to the popup and used to populate the form fields.

- **Enter a JD manually**
  1. User types company and role into the popup.
  2. User pastes the JD into the job description textarea.
  3. User can then run match scoring or resume tailoring.

- **Check match**
  1. After a resume is uploaded and JD is available, user clicks **Check Match**.
  2. The system evaluates resume fit and displays a score/reason in the popup (`frontend/popup.html`; mocked in `frontend/test_popup_theme.js` fetch response).

- **Generate a tailored resume**
  1. User clicks **Tailor**.
  2. Backend sends the stored resume JSON and JD text to Gemini (`backend/tailor.py`).
  3. Gemini returns a JD-tailored JSON version with rewritten summary, skills, and bullets.
  4. Backend formats that tailored content into a polished Word document (`backend/writer.py`).
  5. Download buttons become relevant for exporting the result.

- **Download the tailored file**
  1. User clicks **DOCX** or **PDF** in the popup.
  2. The tailored resume is downloaded in the selected format (`frontend/popup.html`, README).

- **Mark a role as applied**
  1. User clicks **Applied** after submitting an application.
  2. The product records the application in a tracker, described in README as an Excel file.

- **Use chat mode**
  1. User clicks the flip button to switch to the chat side of the popup.
  2. User types a question in the chat input.
  3. The system returns an answer based on the uploaded resume context, as described in README.

- **Set theme preference**
  1. User toggles the popup theme switch.
  2. The popup updates to light or dark mode and stores the selection in local extension storage (`frontend/test_popup_theme.js`).

## Known Gaps & TODOs
- **Explicit TODO**
  - `backend/tailor.py`: `genai.configure(api_key="Gemini_API")   # TODO: replace with your Gemini API key`

- **Placeholder configuration that still needs real values**
  - `backend/parser.py`: `API_KEY = "Gemini_API_KEY"  # replace with your key`
  - `backend/parser.py`: `RESUME_FILE = "SAI RAM BIKKI.docx"   # change to your resume file name`

- **Feature scope gap: host permissions vs implemented scraping**
  - `frontend/manifest.json` requests access to Indeed, Glassdoor, Monster, and Dice.
  - `frontend/scraper.js` only implements selectors for **LinkedIn** pages.

- **Output/schema mismatch**
  - `backend/parser.py`’s education schema does not include `GPA`.
  - `backend/writer.py` tries to read and render `GPA` if present.

- **No explicit FIXME / NotImplementedError usage found**
  - In the provided files, there are no `FIXME` markers and no `NotImplementedError` raises.