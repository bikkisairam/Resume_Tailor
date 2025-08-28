const getJD = document.getElementById("getJD");
const tailorBtn = document.getElementById("tailorBtn");
const downloadDocxBtn = document.getElementById("downloadDocxBtn");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");
const uploadBtn = document.getElementById("uploadBtn");
const resumeUpload = document.getElementById("resumeUpload");
const statusEl = document.getElementById("status");
const appliedBtn = document.getElementById("appliedBtn");
const checkMatchBtn = document.getElementById("checkMatchBtn");
const matchResult = document.getElementById("matchResult");
const downloadsRow = document.getElementById("downloads");

const API_BASE = "http://127.0.0.1:5000"; // Flask backend

function showDownloads() {
  downloadsRow.style.display = "flex";
}

// ------------------- UPLOAD RESUME -------------------
uploadBtn.addEventListener("click", async () => {
  const file = resumeUpload.files[0];
  if (!file) {
    statusEl.textContent = "⚠️ Please select a resume file (.docx or .pdf)";
    return;
  }

  statusEl.textContent = "⏳ Uploading resume...";
  try {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/upload_resume`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (res.ok) {
      statusEl.textContent = "✅ Resume uploaded and parsed.";
    } else {
      statusEl.textContent = "❌ Error: " + (data.error || "Upload failed");
    }
  } catch (err) {
    statusEl.textContent = "❌ Network error: " + err.message;
  }
});

// ------------------- GET JD -------------------
getJD.addEventListener("click", async () => {
  statusEl.textContent = "⏳ Extracting JD...";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        files: ["scraper.js"],
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          statusEl.textContent = "❌ Failed to inject scraper.";
        }
      }
    );
  } catch (err) {
    statusEl.textContent = "❌ Error: " + err.message;
  }
});

// Receive scraped data
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "jd_data") {
    document.getElementById("company").value = msg.company || "";
    document.getElementById("role").value = msg.role || "";
    document.getElementById("jdText").value = msg.jd || "";
    statusEl.textContent = "✅ JD scraped successfully!";
  }
});

// ------------------- TAILOR -------------------
tailorBtn.addEventListener("click", async () => {
  const jdText = document.getElementById("jdText").value.trim();
  const company = document.getElementById("company").value.trim();
  const role = document.getElementById("role").value.trim();

  if (!jdText || !company || !role) {
    statusEl.textContent = "⚠️ Please fill company, role, and JD.";
    return;
  }

  statusEl.textContent = "⏳ Tailoring resume...";
  try {
    const res = await fetch(`${API_BASE}/tailor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jd_text: jdText, company, role }),
    });

    const data = await res.json();
    if (res.ok) {
      statusEl.textContent = "✅ Resume tailored. You can now generate files.";
      showDownloads();
    } else {
      statusEl.textContent = "❌ Error: " + (data.error || "Unknown error");
    }
  } catch (err) {
    statusEl.textContent = "❌ Network error: " + err.message;
  }
});

// ------------------- SAVE DOCX -------------------
downloadDocxBtn.addEventListener("click", async () => {
  const company = document.getElementById("company").value.trim();
  const role = document.getElementById("role").value.trim();

  statusEl.textContent = "💾 Saving DOCX...";
  try {
    const res = await fetch(
      `${API_BASE}/generate_docx?company=${encodeURIComponent(company)}&role=${encodeURIComponent(role)}`
    );
    const data = await res.json();

    if (res.ok) {
      statusEl.textContent = "✅ DOCX saved in Resumes folder.";
      showDownloads();
    } else {
      statusEl.textContent = "❌ Error: " + (data.error || "Failed to save DOCX");
    }
  } catch (err) {
    statusEl.textContent = "❌ Network error: " + err.message;
  }
});

// ------------------- SAVE PDF -------------------
downloadPdfBtn.addEventListener("click", async () => {
  const company = document.getElementById("company").value.trim();
  const role = document.getElementById("role").value.trim();

  statusEl.textContent = "💾 Saving PDF...";
  try {
    const res = await fetch(
      `${API_BASE}/generate_pdf?company=${encodeURIComponent(company)}&role=${encodeURIComponent(role)}`
    );
    const data = await res.json();

    if (res.ok) {
      statusEl.textContent = "✅ PDF saved in Resumes folder.";
      showDownloads();
    } else {
      statusEl.textContent = "❌ Error: " + (data.error || "Failed to save PDF");
    }
  } catch (err) {
    statusEl.textContent = "❌ Network error: " + err.message;
  }
});

// ------------------- MARK APPLIED -------------------
appliedBtn.addEventListener("click", async () => {
  const company = document.getElementById("company").value.trim();
  const role = document.getElementById("role").value.trim();

  if (!company || !role) {
    statusEl.textContent = "⚠️ Please enter company and role before marking applied.";
    return;
  }

  statusEl.textContent = "📌 Saving application...";
  try {
    const res = await fetch(`${API_BASE}/applied`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company, role }),
    });

    const data = await res.json();
    if (res.ok) {
      statusEl.textContent = `✅ Marked as Applied for ${company} - ${role}.`;
    } else {
      statusEl.textContent = "❌ Error: " + (data.error || "Failed to save application");
    }
  } catch (err) {
    statusEl.textContent = "❌ Network error: " + err.message;
  }
});

// ------------------- MATCH SCORE -------------------
checkMatchBtn.addEventListener("click", async () => {
  const jdText = document.getElementById("jdText").value.trim();

  if (!jdText) {
    statusEl.textContent = "⚠️ Please paste a JD first.";
    return;
  }

  statusEl.textContent = "⏳ Checking match score with AI...";
  try {
    const res = await fetch(`${API_BASE}/match_score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jd_text: jdText }),
    });

    const data = await res.json();
    if (res.ok) {
      let color = "red", icon = "❌";
      if (data.score >= 75) { color = "green"; icon = "✅"; }
      else if (data.score >= 50) { color = "orange"; icon = "⚠️"; }

      matchResult.innerHTML = `${icon} Match Score: <span style="color:${color}">${data.score}%</span> → ${data.reason}`;
      statusEl.textContent = "✅ Match score ready.";
    } else {
      statusEl.textContent = "❌ Error: " + (data.error || "Failed to calculate match score");
    }
  } catch (err) {
    statusEl.textContent = "❌ Network error: " + err.message;
  }
});



// Show downloads
function showDownloads() { downloadsRow.style.display = "flex"; }

// ------------------- FLIP -------------------
const flipBtn = document.getElementById("flipBtn");
const flipContainer = document.getElementById("flipContainer");
flipBtn.addEventListener("click", () => flipContainer.classList.toggle("flipped"));

// ------------------- CHAT -------------------
const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");

function addMessage(sender, text) {
  const div = document.createElement("div");
  if (sender === "You") {
    div.className = "msg-user";
    div.textContent = text;
  } else {
    div.className = "msg-bot";
    div.textContent = text;
    const copyBtn = document.createElement("span");
    copyBtn.className = "copy-btn";
    copyBtn.textContent = "📋";
    copyBtn.title = "Copy";
    copyBtn.onclick = () => navigator.clipboard.writeText(text);
    div.appendChild(copyBtn);
  }
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendMessage() {
  const question = chatInput.value.trim();
  if (!question) return;
  addMessage("You", question);
  chatInput.value = "";

  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await res.json();
    if (res.ok) {
      addMessage("Assistant", data.answer);
    } else {
      addMessage("Error", data.error || "Failed to get answer");
    }
  } catch (err) {
    addMessage("Error", err.message);
  }
}

chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessage();
  }
});