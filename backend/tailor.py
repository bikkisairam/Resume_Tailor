import json
import google.generativeai as genai

# ---------------- CONFIG ----------------
genai.configure(api_key="Gemini_API")   # TODO: replace with your Gemini API key
model = genai.GenerativeModel("gemini-1.5-flash")  # use flash (higher free quota)

# ---------------- HELPER ----------------
def tailor_resume(resume_json: dict, job_description: str) -> dict:
    """
    Tailor resume JSON based on JD using Gemini rules
    """
    rules = """
    You are a professional resume writer. Rewrite the provided resume JSON following these rules:
    1. Keep Details (Name, Email, Phone, Location, LinkedIn, GitHub) the SAME.
    Rules:  
- Start with my professional identity (degree/role + years of experience).  
- Middle: Highlight my top technical skills and 1–2 achievements that best match the job description.  
- End: Mention my career goal and how I bring value to this specific role/company.  
- Keep it concise, ATS-friendly, and tailored to the given JD.  
Skills:
rewrite the skills section to include all relevant keywords from the JD max 20 skills.
    4. Rewrite Experience and Project according to the JD bullets using STAR (Situation, Task, Action, Result).
       - Do NOT change bullet point size or formatting style.
       - Use past tense for past roles, present tense for current.
       - use action verbs and quantify results where possible do not repeat the same action verb in the resume.
    5. Keep the output strictly valid JSON with the same schema as input.
    1. Extract all relevant keywords and technical terms from the job description.  
- Begin each bullet point with a strong, distinct action verb.  
- Keep each bullet point between 15 - 25 words.  
- For Work Experience entries → exactly 4 bullet points.  
- For Project Experience entries → exactly 3 bullet points.  
- Use STAR (Situation, Task, Action, Result) to emphasize impact and outcomes.  
- Prioritize metrics, achievements, and technologies that align with the JD.  
- Make the wording ATS-friendly (use keywords from the JD).  
- Do not repeat the same action verb across bullets within the same section.  
    """

    prompt = f"""
    {rules}

    --- Resume JSON ---
    {json.dumps(resume_json, indent=2)}

    --- Job Description ---
    {job_description}

    Now return ONLY the new tailored resume in JSON format.
    """

    response = model.generate_content(prompt)

    # Clean markdown code fences if Gemini wraps the JSON
    resp_text = response.text.strip()
    if resp_text.startswith("```"):
        # split into blocks and take only JSON inside
        parts = resp_text.split("```")
        if len(parts) >= 2:
            resp_text = parts[1]
        # remove optional 'json\n' prefix
        if resp_text.lower().startswith("json"):
            resp_text = resp_text[4:]
        resp_text = resp_text.strip()

    try:
        tailored_json = json.loads(resp_text)
    except Exception:
        raise ValueError("Gemini response could not be parsed as JSON:\n" + resp_text)

    return tailored_json


# ---------------- RUN EXAMPLE ----------------
if __name__ == "__main__":
    # Load resume.json
    with open("resume_fixed.json", "r", encoding="utf-8") as f:
        content = f.read().strip()
    # auto-clean if file has backticks
    content = content.replace("```json", "").replace("```", "").strip()
    resume_data = json.loads(content)

    # Load jd.txt
    try:
        with open("jd.txt", "r", encoding="utf-8") as f:
            jd_text = f.read()
    except UnicodeDecodeError:
        with open("jd.txt", "r", encoding="cp1252") as f:
            jd_text = f.read()

    # Generate tailored resume
    tailored_resume = tailor_resume(resume_data, jd_text)

    # Save tailored resume
    with open("tailored_resume.json", "w", encoding="utf-8") as f:
        json.dump(tailored_resume, f, indent=2, ensure_ascii=False)

    print("✅ Tailored resume saved to tailored_resume.json")
