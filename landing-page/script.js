/**
 * LabelScoutAI intake form → n8n webhook (browser → n8n directly)
 *
 * We post from the browser because Cloudflare on n8n blocks Vercel server IPs,
 * so /api/intake cannot reach the webhook. Requires n8n CORS for this site:
 *   N8N_CORS_ORIGIN=https://www.labelscoutai.com,https://labelscoutai.com
 */
const WEBHOOK_URL =
  window.LABELSCOUT_WEBHOOK_URL ||
  "https://n8n.powermindai.xyz/webhook-test/localscoutai-intake";

const form = document.getElementById("intake-form");
const statusEl = document.getElementById("form-status");
const referenceArtistsInput = document.getElementById("reference_artists");

const MIN_REFERENCE_ARTISTS = 3;
const MAX_REFERENCE_ARTISTS = 5;

function parseReferenceArtists(value) {
  return value
    .split(",")
    .map((artist) => artist.trim())
    .filter(Boolean);
}

function validateReferenceArtists() {
  const artists = parseReferenceArtists(referenceArtistsInput.value);

  if (artists.length < MIN_REFERENCE_ARTISTS) {
    referenceArtistsInput.setCustomValidity(
      `Please enter at least ${MIN_REFERENCE_ARTISTS} reference artists, separated by commas.`
    );
    return false;
  }

  if (artists.length > MAX_REFERENCE_ARTISTS) {
    referenceArtistsInput.setCustomValidity(
      `Please enter no more than ${MAX_REFERENCE_ARTISTS} reference artists.`
    );
    return false;
  }

  referenceArtistsInput.setCustomValidity("");
  return true;
}

referenceArtistsInput.addEventListener("input", validateReferenceArtists);

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

  if (!validateReferenceArtists() || !form.checkValidity()) {
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
    const isCors =
      err instanceof TypeError ||
      String(err.message || err).toLowerCase().includes("failed to fetch");
    showStatus(
      isCors
        ? "Could not reach the intake service (CORS). On n8n, set N8N_CORS_ORIGIN to include https://www.labelscoutai.com"
        : "Something went wrong submitting your audit. Please try again or contact support.",
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
