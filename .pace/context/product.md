# Product Context

## What This Product Does
Resume Tailor is a Chrome extension with a Flask backend that helps job seekers customize their resume for a specific job posting. A user uploads their resume, pulls or pastes a job description, checks an AI-generated match score, generates a tailored version of their resume aligned to that job, downloads the result as a formatted DOCX/PDF, saves the application to a tracker, and can also use a chat mode to ask questions based on their resume.

## Core Features
- **Resume upload and parsing**
  - Frontend supports uploading `.docx` or `.pdf` resumes (`frontend/popup.html`).
  - Backend parser reads DOCX/PDF text and converts it into a fixed structured JSON schema using Gemini (`backend/parser.py`).
- **Job description capture from job sites**
  - Chrome content script scrapes **LinkedIn** job pages for company, role, and job description text (`frontend/scraper.js`).
  - Manifest also requests host permissions for Indeed, Glassdoor, Monster, and Dice, though only LinkedIn scraping logic is visible in the provided code (`frontend/manifest.json`, `frontend/scraper.js`).
- **Manual JD entry**
  - Users can manually type or paste company, role, and job description in the popup (`frontend/popup.html`).
- **AI resume tailoring**
  - Backend rewrites resume JSON against a job description using Gemini (`backend/tailor.py`).
  - Tailoring rules include:
    - preserving personal details,
    - rewriting summary,
    - updating skills with JD keywords,
    - rewriting work/project bullets in ATS-friendly STAR style,
    - enforcing bullet count targets for work and project sections.
- **Resume document generation**
  - Backend converts tailored JSON into a formatted Word document with sections for header, summary, skills, experience, projects, education, and certifications (`backend/writer.py`).
  - README states PDF generation is supported.
- **Match score**
  - UI exposes a **Check Match** action and displays a “Match Score” result (`frontend/popup.html`).
  - README describes this as an AI match score feature.
- **Application tracking**
  - UI exposes an **Applied** action (`frontend/popup.html`).
  - README says applied jobs are saved into an Excel tracker.
- **Chat mode**
  - Popup has a flip-card UI with a back side for chat (`frontend/popup.html`).
  - README describes chat as asking questions and getting answers based on the user’s resume.
- **Download tailored resume**
  - UI includes download buttons for **DOCX** and **PDF** once tailoring is completed (`frontend/popup.html`).

## User Flows
- **1. Upload and parse a base resume**
  1. User opens the extension popup.
  2. User uploads a `.docx` or `.pdf` resume using **Upload Resume File**.
  3. Backend reads the file and transforms resume text into structured JSON with fixed sections like Details, Summary, Skills, Work Experience, Projects, Education, and Certifications (`backend/parser.py`).

- **2. Capture a job description from LinkedIn**
  1. User navigates to a LinkedIn job posting.
  2. User clicks **Get JD** in the extension.
  3. Content script extracts the company name, role title, and job description from the page and sends them back to the extension (`frontend/scraper.js`).
  4. The popup fields for company, role, and JD are populated.

- **3. Paste a JD manually**
  1. User types company and role into the popup.
  2. User pastes the job description into the JD textarea.
  3. User proceeds to check match or tailor the resume.

- **4. Check resume-to-job fit**
  1. After resume upload and JD entry, user clicks **Check Match**.
  2. System evaluates how well the current resume aligns with the JD.
  3. Match result is shown in the popup as “Match Score” (`frontend/popup.html`; feature called out in `README.md`).

- **5. Generate a tailored resume**
  1. User clicks **Tailor**.
  2. Backend sends the structured resume JSON and JD to Gemini (`backend/tailor.py`).
  3. Gemini returns updated JSON with a rewritten summary, JD-aligned skills, and revised experience/project bullets.
  4. Backend writes the tailored resume into a polished DOCX layout (`backend/writer.py`).
  5. Download buttons for DOCX/PDF become available in the popup (`frontend/popup.html`).

- **6. Download output files**
  1. After tailoring, user clicks **DOCX** or **PDF**.
  2. Tailored resume is downloaded in the selected format (`frontend/popup.html`, README).

- **7. Mark a job as applied**
  1. User clicks **Applied** after applying to a role.
  2. System saves the application details into an Excel tracker (described in `README.md`).

- **8. Ask questions in chat mode**
  1. User clicks **↔ Flip** to switch to the back side of the popup.
  2. User enters a question in the chat input.
  3. System responds using the uploaded resume as context (described in `README.md`; chat UI exists in `frontend/popup.html`).

## Known Gaps & TODOs
- **Hardcoded Gemini API keys need replacement**
  - `backend/tailor.py`: `genai.configure(api_key="Gemini_API")   # TODO: replace with your Gemini API key`
  - `backend/parser.py` also contains placeholder API key text: `API_KEY = "Gemini_API_KEY"`.
- **Host permissions exceed implemented scraping logic**
  - `frontend/manifest.json` includes Indeed, Glassdoor, Monster, and Dice.
  - `frontend/scraper.js` only contains scraping selectors/logic for **LinkedIn**.
- **Schema mismatch between parser and writer**
  - `backend/parser.py` outputs Education entries with `Institution`, `Degree`, and `Date`.
  - `backend/writer.py` expects optional `GPA` in education and will render it if present, but parser schema does not include GPA.
- **Formatting inconsistency between parser instructions and writer output**
  - `backend/parser.py` explicitly instructs Gemini not to include bullet symbols like `•` or `-`.
  - `backend/writer.py` adds `•` bullets when generating DOCX, which is fine for output, but indicates an implicit distinction between stored JSON and rendered document.
- **No explicit TODO/FIXME/NotImplementedError markers beyond API key replacement**
  - In the provided files, the only explicit `TODO` comment is the Gemini API key replacement in `backend/tailor.py`.
  - No `FIXME` comments or `NotImplementedError` usages are present in the included code.