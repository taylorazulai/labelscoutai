# LabelScout — Project Summary

> Living document consolidating architecture, collaboration protocol, and Phase 1 decisions.  
> Canonical agent spec: [`../prompts/init-prompt.md`](../prompts/init-prompt.md) · Operating rules: [`../AGENTS.md`](../AGENTS.md)

---

## 1. Project identity

**LabelScout** is an automated A&R research and pitch pipeline built in **n8n**.

| Role | Who | Responsibility |
|------|-----|----------------|
| **Human** | Taylor (project owner) | Imports JSON into n8n, wires nodes, runs tests, shares execution logs/errors |
| **Cursor Agent** | AI in this repo | Designs modular n8n units, documents schemas, debugs from test feedback |

**Build method:** Modular Unit Construction — deliver valid, import-ready n8n JSON for specific sub-sections. Do **not** ship the full 7-phase workflow in one artifact. Proceed phase-by-phase; ensure each phase output schema matches the next phase input.

---

## 2. Seven-phase architecture

| Phase | Name | Status | Summary |
|-------|------|--------|---------|
| **1** | Intake & Pre-Flight Audit | **In progress** | Webhook → normalize → 202 async response → SoundCloud/reference audit → error email or continue |
| **2** | Spotify Label Mining | **Done** | Sub-workflow: Spotify API → artists/albums/P-line copyright JSON |
| **3** | A&R Research & Scoring | Planned | Two-agent split (Researcher → Scorer) |
| **4** | Quality Gate | Planned | Conditional routing to manual review queue (tool TBD) |
| **5** | Shortlist Finalization | Planned | Top 5 primary + 3 backup matches |
| **6** | Dossier & Pitch Copywriting | Planned | AI chain → per-label pitch copy → branded HTML template |
| **7** | PDF Delivery | Planned | HTML→PDF → S3/Google Drive → Gmail/SMTP |

### Phase 3 — two-agent split

- **Agent A (Researcher):** Perplexity/Tavily — active status, submission channels, contact details.
- **Agent B (Scorer):** Consumes Agent A JSON → 0–100 fit score + final rankings.
- Research and scoring stay decoupled; Agent B requires a stable JSON contract from Agent A.

### End-to-end story

1. Artist submits intake data via landing page webhook.
2. System normalizes payload and runs pre-flight audit (SoundCloud URL, private token, reference artists, download status).
3. Reference artists feed the **Spotify Metadata Extractor** sub-workflow to mine label names from P-line copyright metadata.
4. Two AI agents research then score labels for fit.
5. Human quality gate approves before pitch generation.
6. Shortlist finalized (5 primary + 3 backup).
7. AI writes personalized pitches in a branded HTML template.
8. Output converted to PDF, stored (S3/Drive), and emailed.

---

## 3. Phase 2 — existing sub-workflow (do not rebuild)

**Source of truth:** [`../../n8n-attempt-v1/workflows/spotify-metadata-subworkflow.json`](../../n8n-attempt-v1/workflows/spotify-metadata-subworkflow.json)

The former `n8n-attempt-v1/README.md` was deleted (outdated). All setup notes live in the workflow JSON sticky note and this document.

| Item | Value |
|------|-------|
| Workflow name in n8n | `Spotify Metadata Extractor` |
| Trigger | `When Executed by Another Workflow` |
| Input | `artist_name` (string) |
| Connect from main | `Execute Workflow` / `Call n8n Workflow` — one call per reference artist |
| Output | `{ query_artist, matched_artist, albums_returned, albums[] }` with `label_from_p_line` per album |

**Flow:** Search artist → match → get albums (up to 10) → fetch each album individually (Spotify removed batch album endpoint in Dev Mode, Feb 2026) → format output.

**Credentials:** Spotify OAuth2 on each HTTP Request node.

**Test payload:** `{ "artist_name": "Khruangbin" }`

---

## 4. Operational protocol

- **Deliverables:** Import-ready n8n JSON under `workflows/phase-XX-<name>/`, plus purpose, import steps, test payload, and input/output schema.
- **Schema compatibility:** Document output JSON explicitly; state downstream impact when schemas change.
- **Error handling:** `Continue On Fail` on HTTP nodes where appropriate; IF/Switch for validation; structured error objects `{ error, phase, recoverable, ...context }`.
- **Debug loop:** Human provides phase, node name, error message, input JSON, expected vs actual → agent returns corrected JSON.

---

## 5. Landing page & infra

**Form → webhook:** Browser posts directly to n8n (`landing-page/script.js`). Server-side proxy (`landing-page/api/intake.js`) is blocked by Cloudflare on the n8n host.

| Setting | Value |
|---------|-------|
| Test webhook URL | `https://n8n.powermindai.xyz/webhook-test/localscoutai-intake` |
| Webhook path (n8n) | `localscoutai-intake` |
| CORS | `N8N_CORS_ORIGIN` must include `https://www.labelscoutai.com` |
| Optional auth | Header `X-LabelScout-Secret` when `N8N_WEBHOOK_SECRET` is set |

### Intake payload (from landing page)

```json
{
  "artist_name": "string",
  "contact_email": "string",
  "genre": "string",
  "soundcloud_link": "string",
  "reference_artists": ["string"],
  "instagram_handle": "string",
  "submitted_at": "ISO-8601",
  "source": "labelscout-landing-page"
}
```

**Constraints:** `reference_artists` array length must be **3–5** (inclusive).

Normalize also accepts alternate field names from earlier specs: `email`, `private_soundcloud_link`.

---

## 6. Phase 1 — decisions (locked)

### Flow

```
Webhook (POST localscoutai-intake)
  → Normalize Intake (Code)
  → Respond to Webhook (HTTP 202 + report_id)
  → Pre-Flight Rules (Code)
  → Resolve SoundCloud Track (HTTP, optional)
  → Merge Pre-Flight Results (Code)
  → IF is_valid_for_research
       ├─ false → Format Error Email → Send via Resend → STOP
       └─ true  → (Phase 2: Spotify sub-workflow per reference artist)
```

### Async webhook response

n8n **Respond → Immediately** (legacy “On Received”) cannot return custom JSON with `report_id`. Use:

- Webhook **Respond:** `Using 'Respond to Webhook' Node`
- Chain: Webhook → Normalize → **Respond to Webhook** (202) → continue audit nodes

**202 response body:**

```json
{
  "status": "processing",
  "message": "Your track is being audited and matched. Your Pitch Prep Dossier will arrive in your email in under 3 minutes.",
  "report_id": "RPT-XXXXXXX"
}
```

### Pre-flight audit rules

| Flag | Severity | Blocks research? |
|------|----------|------------------|
| `NOT_SOUNDCLOUD_LINK` | Error | **Yes** |
| `MISSING_REFERENCE_ARTISTS` | Error | **Yes** — fewer than 3 |
| `TOO_MANY_REFERENCE_ARTISTS` | Error | **Yes** — more than 5 |
| `PUBLIC_SOUNDCLOUD_LINK` | Error | **Yes** — URL lacks private token `/s-` |
| `DOWNLOAD_NOT_ENABLED` | Warning | No — track not downloadable; user should enable for A&Rs |
| `DOWNLOAD_CHECK_SKIPPED` | Warning | No — no `SOUNDCLOUD_CLIENT_ID` configured yet |
| `DOWNLOAD_CHECK_FAILED` | Warning | No — resolve API failed; user should verify manually |

`is_valid_for_research = true` unless `NOT_SOUNDCLOUD_LINK`, `PUBLIC_SOUNDCLOUD_LINK`, `MISSING_REFERENCE_ARTISTS`, or `TOO_MANY_REFERENCE_ARTISTS`.

### SoundCloud download check

- Uses SoundCloud resolve API: `GET https://api-v2.soundcloud.com/resolve?url=...&client_id=...`
- **`SOUNDCLOUD_CLIENT_ID`:** not configured yet — set as n8n environment variable when available.
- Non-downloadable tracks **warn and continue** (flag + `audit_messages` for dossier/end user).

### Invalid submission email

- **Provider:** Resend (HTTP Request to `https://api.resend.com/emails`)
- **To:** submitter `contact_email`
- **When:** `is_valid_for_research === false` only
- **Credential:** Resend API key (HTTP Header Auth: `Authorization: Bearer re_...`)
- **From address:** set `email_from` in the **Format Error Email** Code node (some n8n hosts block `$env` in expressions)

### Deliverable split (Phase 1)

Import one JSON unit at a time into the same n8n workflow, then wire connections:

| File | Contents |
|------|----------|
| `01-webhook-normalize-respond.json` | Webhook, Normalize, Respond to Webhook |
| `02-preflight-audit.json` | Pre-Flight Rules, Resolve SoundCloud, Merge, IF |
| `03-submission-error-email.json` | Format Error Email, Send via Resend |

### Phase 1 output schema (valid branch)

```json
{
  "report_id": "RPT-XXXXXXX",
  "artist_name": "string",
  "contact_email": "string",
  "genre": "string",
  "soundcloud_link": "string",
  "reference_artists": ["string"],
  "instagram": "string",
  "instagram_handle": "string",
  "submitted_at": "ISO-8601",
  "source": "labelscout-landing-page",
  "timestamp": "ISO-8601",
  "audit_flags": [],
  "audit_messages": ["human-readable strings"],
  "is_valid_for_research": true,
  "soundcloud_downloadable": true,
  "soundcloud_track": { "id": "...", "title": "...", "permalink": "..." },
  "phase": "phase-01-preflight"
}
```

---

## 7. Repository layout

```
labelscoutai-n8n-workflow/
├── AGENTS.md
├── project-brief/
│   └── PROJECT-SUMMARY.md          ← this file
├── prompts/
│   └── init-prompt.md
└── workflows/
    └── phase-01-intake/
        ├── 01-webhook-normalize-respond.json
        ├── 02-preflight-audit.json
        └── 03-submission-error-email.json
```

Related assets:

- `../landing-page/` — intake form and webhook payload
- `../n8n-attempt-v1/workflows/spotify-metadata-subworkflow.json` — Phase 2 sub-workflow

---

## 8. Current focus

**Phase 1** units delivered. After import and test, share execution logs for iteration. **Phase 2** wiring (loop `reference_artists` → Spotify sub-workflow) follows once Phase 1 validates.
