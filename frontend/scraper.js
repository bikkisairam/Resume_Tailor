(() => {
  let company = "";
  let role = "";
  let jd = "";

  // ------------------ LINKEDIN ------------------
  try {
    // Company
    const companyEl = document.querySelector(
      ".job-details-jobs-unified-top-card__company-name a, " +
      ".topcard__org-name-link, " +
      ".jobs-unified-top-card__company-name"
    );

    // Role / Title
    const roleEl = document.querySelector("h1.t-24, .topcard__title");

    // JD Content
    const jdEl = document.querySelector(
      ".jobs-box__html-content, " +              // new LinkedIn JD container
      ".jobs-description-content__text, " +     // old JD container
      ".jobs-description__container"            // fallback
    );

    if (companyEl) company = companyEl.innerText.trim();
    if (roleEl) role = roleEl.innerText.trim();
    if (jdEl) {
      jd = jdEl.innerText
        .replace(/\s+/g, " ")   // clean up extra spaces
        .trim();
    }
  } catch (err) {
    console.error("LinkedIn scraping error:", err);
  }

  // ------------------ SEND TO EXTENSION ------------------
  chrome.runtime.sendMessage({
    type: "jd_data",
    company,
    role,
    jd
  });
})();
