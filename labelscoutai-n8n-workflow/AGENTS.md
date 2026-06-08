# LabelScout n8n — Agent Instructions

Canonical extended spec: [`prompts/init-prompt.md`](prompts/init-prompt.md)

## Roles

| Role | Who | Responsibility |
|------|-----|----------------|
| **Human** | Taylor (project owner) | Imports JSON into n8n, wires nodes, runs tests, shares execution logs/errors |
| **Cursor Agent** | AI in this repo | Designs modular n8n units, documents schemas, debugs from test feedback |

Build **one phase or sub-section at a time**. The agent delivers import-ready JSON; the human integrates and validates in n8n.

## Pipeline Architecture (7 Phases)

Proceed in order. Do not design later phases until the current phase's output schema is agreed.

| Phase | Name | Status | Summary |
|-------|------|--------|---------|
| **1** | Intake & Pre-Flight Audit | **In progress** | Webhook → normalization → pre-flight SoundCloud/reference audit |
| **2** | Spotify Label Mining | **Done** | Sub-workflow: Spotify API → artists/albums/P-line copyright JSON |
| **3** | A&R Research & Scoring | Planned | Two-agent split (Researcher → Scorer) |
| **4** | Quality Gate | Planned | Conditional routing to manual review queue (tool TBD) |
| **5** | Shortlist Finalization | Planned | Top 5 primary + 3 backup matches |
| **6** | Dossier & Pitch Copywriting | Planned | AI chain → per-label pitch copy → branded HTML template |
| **7** | PDF Delivery | Planned | HTML→PDF → S3/Google Drive → Gmail/SMTP |

### Phase 2 — Existing sub-workflow (do not rebuild)

- **File:** `../n8n-attempt-v1/workflows/spotify-metadata-subworkflow.json`
- **Workflow name in n8n:** `Spotify Metadata Extractor`
- **Trigger:** `When Executed by Another Workflow` — input `artist_name` (string)
- **Nodes:** HTTP Request nodes for Spotify API + Code nodes for matching/formatting (not HTTP-only; that constraint applies to API calls, not formatting)
- **Connect from main workflow:** `Call n8n Workflow Tool` → pass `artist_name` per reference artist
- **Output shape:** `{ query_artist, matched_artist, albums_returned, albums[] }` with `label_from_p_line` per album when P-line data is available
- **Setup notes:** See sticky note in sub-workflow JSON + [`project-brief/PROJECT-SUMMARY.md`](project-brief/PROJECT-SUMMARY.md) (Spotify OAuth2, Feb 2026 Dev Mode batch-endpoint removal)

### Phase 3 — Two-agent split

- **Agent A (Researcher):** Perplexity/Tavily — active status, submission channels, contact details
- **Agent B (Scorer):** Consumes Agent A JSON → 0–100 fit score + rankings
- Research and scoring stay decoupled; Agent B input must be a stable JSON contract from Agent A

## Repository Layout

```
labelscoutai-n8n-workflow/
├── AGENTS.md              ← this file (agent operating rules)
├── prompts/
│   └── init-prompt.md     ← full architecture & collaboration protocol
└── workflows/             ← new importable n8n JSON units (create per phase)
    └── phase-01-intake/   ← example: one sub-section per file
```

- Save each deliverable as a `.json` file under `workflows/phase-XX-<name>/`
- Name files by function: e.g. `webhook-normalize.json`, `soundcloud-audit.json`
- Commit JSON that is valid for **Import from File** in n8n (workflow fragment or full mini-workflow)

Related repo assets (outside this folder):

- `../landing-page/` — intake form and webhook payload (Phase 1 input contract)
- `../n8n-attempt-v1/` — Phase 2 Spotify sub-workflow (already built)

## Phase 1 Input Contract (from landing page)

Phase 1 webhook must accept this payload (see `../landing-page/script.js`):

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

**Webhook endpoint (test):** `https://n8n.powermindai.xyz/webhook-test/localscoutai-intake`

**Infra constraints:**

- Browser posts directly to n8n (CORS: `N8N_CORS_ORIGIN` must include `https://www.labelscoutai.com`)
- Cloudflare on n8n may block server-side proxy (`../landing-page/api/intake.js`); prefer browser → n8n path
- Optional header: `X-LabelScout-Secret` when `N8N_WEBHOOK_SECRET` is set

Phase 1 output must preserve intake fields and add normalized/audit fields for Phase 2+ (document the schema when the unit is delivered).

## Operational Rules

### Deliverables

- **Primary:** Valid, import-ready n8n JSON (in chat and/or under `workflows/`)
- **Required with each unit:** Brief purpose, import steps, test payload, and **input/output JSON schema**
- **Do not** ship the full 7-phase workflow in one artifact

### Schema compatibility

- Each phase output must match the next phase's expected input
- When changing a schema, state what downstream phases must update
- Prefer explicit `Set` / `Code` nodes that emit a documented `json` shape over implicit passthrough

### Error handling

Every sub-section must include appropriate failure paths:

- `Continue On Fail` on HTTP/AI nodes where partial progress is useful
- `IF` / `Switch` branches for validation failures (bad SoundCloud URL, empty reference artists, etc.)
- Structured error objects: `{ error: string, phase: string, recoverable: boolean, ...context }`
- Consider an **Error Trigger** workflow only when a phase needs global failure notification

### Debugging loop

When the human reports a failure, they should provide:

1. Phase and node name that failed
2. n8n execution error message / stack
3. Input JSON to that node (or screenshot of item data)
4. Expected vs actual behavior

The agent responds with corrected JSON and a short explanation of the fix.

## Phase Activation

- **Default:** Work on the phase the human explicitly requests
- **Current focus:** Phase 1 — Intake & Pre-Flight Audit
- **Do not** write Phase 1+ JSON until the human issues that phase instruction (initialization handshake in `init-prompt.md` may still apply)

## Quick Reference — Phase Summaries

1. **Intake & Pre-Flight Audit** — Webhook, normalize landing-page payload, AI audit of SoundCloud link (private token, download enabled, genre fit signals)
2. **Spotify Label Mining** — Sub-workflow per reference artist → label names from P-line metadata
3. **A&R Research & Scoring** — Research agent → scoring agent → ranked label list
4. **Quality Gate** — Human approval branch before pitch generation
5. **Shortlist Finalization** — 5 primary + 3 backup
6. **Dossier & Pitch Copywriting** — Personalized pitches in HTML template
7. **PDF Delivery** — Convert, store, email
