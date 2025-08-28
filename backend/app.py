from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path
import json
import datetime
import openpyxl
import os
import tempfile
import shutil
from collections import Counter
from docx2pdf import convert  # ✅ for DOCX → PDF
import subprocess


# --- Import local modules
from tailor import tailor_resume
from writer import build_doc
from parser import read_resume, clean_gemini_output, model

app = Flask(__name__)
CORS(app)

# ---------------- CONFIG ----------------
RESUME_JSON_FILE = Path("resume_fixed.json")   # always points to the active resume
TAILORED_JSON_FILE = Path("tailored_resume.json")
RESUMES_DIR = Path("Resumes")
EXCEL_FILE = Path("Sai_Ram_Job_status.xlsx")

# Ensure folder exists
RESUMES_DIR.mkdir(exist_ok=True)


@app.route("/")
def index():
    return {"message": "Resume Tailor API is running 🚀"}


# ---------- STEP 0: Upload Resume ----------
@app.route("/upload_resume", methods=["POST"])
def upload_resume():
    if "file" not in request.files:
        return {"error": "No file uploaded"}, 400

    file = request.files["file"]
    if file.filename == "":
        return {"error": "Empty file"}, 400

    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
        temp_path = tmp.name
        file.save(temp_path)

    try:
        resume_text = read_resume(temp_path)

        # Prompt Gemini
        prompt = f"""
        Convert the following resume into JSON with this exact schema:
        {{
          "Details": {{
            "Name": "",
            "Email": "",
            "Phone": "",
            "Location": "",
            "LinkedIn": "",
            "GitHub": ""
          }},
          "Summary": "",
          "Skills": [""],
          "Work Experience": [
            {{
              "Company Name": "",
              "Role": "",
              "Bullet Points": [""],
              "Date": ""
            }}
          ],
          "Project Experience": [
            {{
              "Title": "",
              "Bullet Points": [""],
              "Tech Stack": ""
            }}
          ],
          "Education": [
            {{
              "Institution": "",
              "Degree": "",
              "Date": ""
            }}
          ],
          "Achievements and Certifications": [""]
        }}

        Rules:
        - Always follow the exact schema (same keys, same nesting).
        - If information is missing, leave it as "" or [].
        - Preserve bullet points exactly as written in the resume.
        - Do not add extra fields.
        - In bullet points, do not add any symbols like "•" or "-". Just write the text as it is.

        Resume:
        {resume_text}
        """

        response = model.generate_content(prompt)
        json_output = clean_gemini_output(response.text)

        # Save as resume_fixed.json
        with open(RESUME_JSON_FILE, "w", encoding="utf-8") as f:
            f.write(json_output)

        return {"message": "✅ Resume uploaded and parsed successfully."}
    except Exception as e:
        return {"error": str(e)}, 500
    finally:
        os.remove(temp_path)


# ---------- STEP 1: Tailor Resume ----------
@app.route("/tailor", methods=["POST"])
def tailor():
    data = request.get_json()
    if not data or "jd_text" not in data:
        return {"error": "Send JSON with keys: jd_text, company, role"}, 400

    jd_text = data["jd_text"]
    company = data.get("company", "").strip().replace(" ", "_")
    role = data.get("role", "").strip().replace(" ", "_")

    if not RESUME_JSON_FILE.exists():
        return {"error": "resume_fixed.json not found. Upload resume first."}, 400
    resume_data = json.loads(RESUME_JSON_FILE.read_text(encoding="utf-8"))

    try:
        tailored = tailor_resume(resume_data, jd_text)
    except Exception as e:
        return {"error": str(e)}, 500

    TAILORED_JSON_FILE.write_text(
        json.dumps(tailored, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )

    return {
        "message": "✅ Resume tailored successfully. Now call /generate_docx or /generate_pdf.",
        "company": company,
        "role": role
    }


# ---------- STEP 2A: Generate DOCX ----------
@app.route("/generate_docx", methods=["GET"])
def generate_docx():
    if not TAILORED_JSON_FILE.exists():
        return {"error": "No tailored_resume.json found. Run /tailor first."}, 400

    company = request.args.get("company", "Company").replace(" ", "_")
    role = request.args.get("role", "Role").replace(" ", "_")
    output_path = RESUMES_DIR / f"{company}_{role}.docx"

    data = json.loads(TAILORED_JSON_FILE.read_text(encoding="utf-8"))
    build_doc(data, output_path)

    update_excel(company, role)

    return jsonify({"message": f"✅ DOCX saved as {output_path.name} in Resumes folder"})


# ---------- STEP 2B: Generate PDF ----------
@app.route("/generate_pdf", methods=["GET"])
def generate_pdf():
    if not TAILORED_JSON_FILE.exists():
        return {"error": "No tailored_resume.json found. Run /tailor first."}, 400

    company = request.args.get("company", "Company").replace(" ", "_")
    role = request.args.get("role", "Role").replace(" ", "_")

    docx_path = RESUMES_DIR / f"{company}_{role}.docx"
    pdf_path = RESUMES_DIR / f"{company}_{role}.pdf"

    data = json.loads(TAILORED_JSON_FILE.read_text(encoding="utf-8"))
    build_doc(data, docx_path)

    try:
        subprocess.run([
            "soffice", "--headless", "--convert-to", "pdf", "--outdir",
            str(RESUMES_DIR), str(docx_path)
        ], check=True)
    except Exception as e:
        return {"error": f"PDF conversion failed: {e}"}, 500

    update_excel(company, role)

    return jsonify({"message": f"✅ PDF saved as {pdf_path.name} in Resumes folder"})
# ---------- STEP 3: Mark as Applied ----------
@app.route("/applied", methods=["POST"])
def applied():
    data = request.get_json()
    if not data or "company" not in data or "role" not in data:
        return {"error": "Send JSON with keys: company, role"}, 400

    company = data["company"].strip().replace(" ", "_")
    role = data["role"].strip().replace(" ", "_")

    update_excel(company, role)

    return jsonify({"message": f"✅ Application saved for {company} - {role} in Excel"})

# ---------- BONUS: Match Score ----------
@app.route("/match_score", methods=["POST"])
def match_score():
    data = request.get_json()
    if not data or "jd_text" not in data:
        return {"error": "Send JSON with key: jd_text"}, 400

    jd_text = data["jd_text"]

    if not RESUME_JSON_FILE.exists():
        return {"error": "resume_fixed.json not found. Upload resume first."}, 400

    resume_data = json.loads(RESUME_JSON_FILE.read_text(encoding="utf-8"))

    prompt = f"""
    You are an expert career coach and ATS system.
    Compare the resume and job description carefully and give a match score.

    Resume JSON:
    {json.dumps(resume_data, indent=2)}

    Job Description:
    {jd_text}

    Rules:
    - Return STRICT JSON only.
    - Include "score" (0-100, integer).
    - Include "reason" (short explanation of match/gaps).
    Example output:
    {{
      "score": 78,
      "reason": "Strong in Python, SQL, ML. Missing AWS and CI/CD."
    }}
    """

    try:
        response = model.generate_content(prompt)
        resp_text = response.text.strip()

        # clean Gemini’s JSON (in case it wraps in code fences)
        if resp_text.startswith("```"):
            parts = resp_text.split("```")
            if len(parts) >= 2:
                resp_text = parts[1]
            if resp_text.lower().startswith("json"):
                resp_text = resp_text[4:]
            resp_text = resp_text.strip()

        result = json.loads(resp_text)
        return jsonify(result)

    except Exception as e:
        return {"error": str(e)}, 500
@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    question = data.get("question", "")

    if not RESUME_JSON_FILE.exists():
        return {"error": "Resume not uploaded"}, 400

    resume_data = json.loads(RESUME_JSON_FILE.read_text(encoding="utf-8"))

    prompt = f"""
    You are a helpful career assistant answering job application questions.
    Use ONLY this resume when answering:

    Resume JSON:
    {json.dumps(resume_data, indent=2)}

    Question: {question}

    Answer clearly and concisely as if filling out a job application form.
    """

    try:
        response = model.generate_content(prompt)
        return jsonify({"answer": response.text.strip()})
    except Exception as e:
        return {"error": str(e)}, 500

# ---------- HELPER: Update Excel ----------
def update_excel(company, role):
    today = datetime.datetime.now().strftime("%d %b %Y")
    status = "Applied"

    if not EXCEL_FILE.exists():
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Applications"
        ws.append(["Date", "Company", "Role", "Status"])
    else:
        wb = openpyxl.load_workbook(EXCEL_FILE)
        ws = wb.active

    ws.append([today, company, role, status])

    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
        temp_filename = tmp.name
    wb.save(temp_filename)
    wb.close()
    shutil.move(temp_filename, EXCEL_FILE)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
