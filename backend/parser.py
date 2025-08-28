import google.generativeai as genai
import json
import os
from docx import Document
import PyPDF2

# ======================
# CONFIG
# ======================
API_KEY = "Gemini_API_KEY"  # replace with your key
RESUME_FILE = "SAI RAM BIKKI.docx"   # change to your resume file name
OUTPUT_FILE = "resume_fixed.json"

# ======================
# GEMINI SETUP
# ======================
genai.configure(api_key=API_KEY)
model = genai.GenerativeModel("gemini-1.5-flash")

# ======================
# FUNCTIONS
# ======================
def read_resume(file_path):
    """Extracts text from DOCX or PDF resume."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    text = ""
    if file_path.endswith(".docx"):
        doc = Document(file_path)
        text = "\n".join([para.text for para in doc.paragraphs if para.text.strip()])
    elif file_path.endswith(".pdf"):
        with open(file_path, "rb") as pdf_file:
            reader = PyPDF2.PdfReader(pdf_file)
            text = "\n".join([page.extract_text() for page in reader.pages if page.extract_text()])
    else:
        raise ValueError("Unsupported file format. Use .docx or .pdf")
    return text


def clean_gemini_output(output_text: str) -> str:
    """Remove ```json fences and validate JSON."""
    cleaned = output_text.strip()

    # Remove triple backticks and "json"
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

    # Validate JSON
    try:
        parsed = json.loads(cleaned)
        return json.dumps(parsed, indent=2)
    except json.JSONDecodeError:
        print("⚠️ Warning: Gemini output was not valid JSON. Saving raw text.")
        return cleaned


# ======================
# MAIN
# ======================
if __name__ == "__main__":
    resume_text = read_resume(RESUME_FILE)

    # Prompt Gemini with fixed schema
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
    - in the bullet do not add any symbols like "•" or "-". Just write the text as it is.

    Resume:
    {resume_text}
    """

    response = model.generate_content(prompt)

    # Clean output
    json_output = clean_gemini_output(response.text)

    # Save file
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(json_output)

    print(f"✅ Resume converted and saved as {OUTPUT_FILE}")
