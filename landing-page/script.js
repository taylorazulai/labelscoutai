/**
 * LabelScoutAI intake form → /api/intake → n8n webhook (server-side proxy)
 *
 * The browser posts to same-origin /api/intake to avoid HTTPS→HTTP mixed content
 * and cross-origin CORS blocks. Configure the n8n URL via N8N_WEBHOOK_URL in Vercel.
 */
const WEBHOOK_URL = window.LABELSCOUT_WEBHOOK_URL || "/api/intake";

const form = document.getElementById("intake-form");
const statusEl = document.getElementById("form-status");

function parseReferenceArtists(value) {
  return value
    .split(",")
    .map((artist) => artist.trim())
    .filter(Boolean);
}

function showStatus(message, type) {
  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.className = `form-status form-status--${type}`;
}

function hideStatus() {
  statusEl.hidden = true;
  statusEl.className = "form-status";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideStatus();

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const payload = {
    artist_name: form.artist_name.value.trim(),
    contact_email: form.contact_email.value.trim(),
    genre: form.genre.value.trim(),
    soundcloud_link: form.soundcloud_link.value.trim(),
    reference_artists: parseReferenceArtists(form.reference_artists.value),
    instagram_handle: form.instagram_handle.value.trim(),
    submitted_at: new Date().toISOString(),
    source: "labelscout-landing-page",
  };

  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.querySelector(".btn__text").textContent;
  submitBtn.disabled = true;
  submitBtn.querySelector(".btn__text").textContent = "Generating…";
  showStatus("Running your pre-flight pitch audit…", "loading");

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Server responded with ${res.status}`);
    }

    showStatus(
      "Your audit is in progress. Check your inbox for your Pitch Prep Dossier shortly.",
      "success"
    );
    form.reset();
  } catch (err) {
    console.error("Form submission error:", err);
    showStatus(
      "Something went wrong submitting your audit. Please try again or contact support.",
      "error"
    );
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector(".btn__text").textContent = originalText;
  }
});

/* Stagger FAQ open animation on mobile */
document.querySelectorAll(".faq__item").forEach((item) => {
  item.addEventListener("toggle", () => {
    if (item.open) {
      document.querySelectorAll(".faq__item").forEach((other) => {
        if (other !== item) other.open = false;
      });
    }
  });
});
