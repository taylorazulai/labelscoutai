# n8n Advanced AI Node Optimization Brief: Record Label Pitch Pipeline

This brief outlines how to leverage **n8n's native Advanced AI capabilities** (under the "Advanced AI" category, using LangChain-backed structures) to radically optimize and streamline the **"Label Scout & Pitch Prep Dossier"** workflow. 

By replacing complex logic, sequential HTTP looping, and multi-step data parsing with cognitive agent nodes, we can compress our original **19-node workflow into a highly maintainable 10-node layout**.

---

## The Core Concept: Re-Architecting with n8n Advanced AI

Standard n8n workflows rely on rigid, deterministic nodes (looping, merging, custom JS string formatting). While reliable, they are complex to build and prone to breaking when API structures shift. 

n8n’s native **Advanced AI Nodes** introduce reasoning-capable structures that can execute REST queries, search the web, deduplicate data, score fit, and draft custom copy in a single step using **Tools, Memory, and Agents**.

```text
  [ Intake Form Webhook ]
             │
             ▼
  [ Normalize & Pre-Flight ] (AI Agent Node)
             │
             ▼
  [ Spotify Label Miner ] (AI Agent Node + Spotify API Tool)
             │
             ▼
  [ A&R Web Researcher & Scorer ] (AI Agent Node + Web Search Tool)
             │
             ▼
   {Needs Review?} ──(Yes)──> [Notion Queue] ──> [Wait/Resume Webhook] ──┐
             │                                                           │
            (No)                                                         │
             ▼                                                           │
  [ HTML Report & Pitch Copywriter ] (AI Chat Model + Structured Output) <┘
             │
             ▼
  [ Create PDF ] (APITemplate / Carbone)
             │
             ▼
  [ Store S3 & Email Delivery ] ──> [Success Response] ──> [End]
```

---

## 3 Key Zones of AI Node Consolidation

---

### Zone 1: The Spotify Metadata Label Miner

- **Consolidates**: 
  - `Node 04: Query Spotify API` (Looping/Batches)
  - `Node 05: Extract Labels from Copyrights` (JSON-path / Custom regex mapping)
  - `Node 06: Deduplicate & Merge Pool` (Custom JS deduplication arrays)
- **n8n AI Solution**: An **AI Agent Node** connected to an **OpenAI Chat Model (GPT-4o)** and a **Custom HTTP Request Tool**.

#### Node Configuration in n8n

1. **The AI Agent Node**: Drag an `AI Agent` onto the canvas. Set agent type to `Zero-Shot Agent`.
2. **Model**: Connect an `OpenAI Chat Model` node to the agent.
3. **The Tool**: Connect a `Custom Tool` node to the agent. Name it `spotify_metadata_extractor`.
  - **Tool Description**: *"Use this tool to query the Spotify Web API. Pass search queries for artists to find their albums and tracks. The API returns full album details including copyright text strings which reveal their record label name."*
  - **Tool Request Settings**:
    - **Method**: `GET`
    - **URL**: `https://api.spotify.com/v1/search?q={{ $parameter.artist_name }}&type=album&limit=10`
    - **Headers**: `Authorization: Bearer {{ $credentials.spotify_token }}`

#### Prompt Instruction to AI Agent Node

```text
You are an expert music metadata analyst. Your goal is to find record labels associated with the following reference artists: {{ $json.reference_artists.join(', ') }}.

Use your `spotify_metadata_extractor` tool for EACH artist. Under each album object, parse the 'copyrights' or 'publisher' fields (look specifically for 'type': 'P' phonogram lines). 

Compile all extracted label names, deduplicate them (e.g., 'Anjunadeep Ltd' and 'Anjunadeep' are the same), and rank them by frequency of occurrence across the releases.

Return a clean, structured JSON array of the top 12 unique candidate labels with this exact schema:
[
  {
    "label_name": "Label Name",
    "associated_artists": ["Artist Name"],
    "evidence_releases": ["Album Name (Year)"],
    "evidence_count": 3
  }
]
```

#### Why it's better:

- **Zero Custom Code**: Eliminates the need to write complex nested javascript loops or split-in-batch throttle mechanics.
- **Intelligent Deduplication**: Standardizes disparate string formats (e.g., removing year codes, copyright characters, "LLC", or "Records") naturally using LLM semantics rather than fragile regex expressions.

---

### Zone 2: The A&R Web Researcher & Scorer

- **Consolidates**:
  - `Node 07: Verify Label Activity & Guidelines` (Raw Perplexity completions API)
  - `Node 08: Score Label Fit` (Deterministic JS weighting rules)
- **n8n AI Solution**: An **AI Agent Node** connected to a **Tavily / Perplexity Web Search Tool**.

#### Node Configuration in n8n

1. **The AI Agent Node**: Set type to `Plan and Execute Agent` (highly optimized for multi-step research).
2. **The Tool**: Connect a native `Tavily Search` or `Perplexity` node as a Tool.

#### Prompt Instruction to AI Agent Node

```text
You are a music industry A&R scout. You are provided with a candidate list of record labels: {{ $json.candidate_pool }}.

For each label in the list, use your Search Tool to investigate and verify their current active status and demo submission procedures.

Specifically, discover:
1. Active Check: Have they released music or updated their roster in the last 60 days?
2. Submission Channel: How do they accept demos? (Categorize as: Direct Email, SubmitHub, LabelRadar, Groover, Direct Web Form, or Closed).
3. Contact Details: Locate the verified submission email (e.g., 'demos@label.com') or submission portal URL.
4. Fit Score: Calculate a fit score from 0 to 100 based on:
   - Base 50 points.
   - Add 20 points if their submission process is fully open and documented.
   - Add 15 points if they have signed artists matching the submitter's genre lane ({{ $json.genre }}).
   - Subtract 20 points if they are strictly closed to unsolicited submissions.

Output a structured JSON array of the top 10 scored labels with fields: label_name, active_signal (bool), submission_channel, contact_channel, fit_score (int), and reasoning (array of strings).
```

#### Why it's better:

- **Dynamic, Contextual Scoring**: Instead of using regex to find email addresses or guessing status, the LLM reads and interprets active web pages, realizing, for example, that a label has moved from email submissions to LabelRadar.
- **Consolidated Data Gathering**: Replaces raw, unformatted search query management with a self-correcting agent that can refine its search queries if the first attempt returns empty.

---

### Zone 3: The HTML Report & Pitch Copywriter

- **Consolidates**:
  - `Node 12: Assemble HTML Report Template`
  - Complex email drafting nodes (that tend to sound robotic/boilerplate)
- **n8n AI Solution**: An **AI Chain Node** utilizing **Structured Output (JSON Schema / Instructor)**.

#### Node Configuration in n8n

1. **The Node**: Drag an `Advanced AI Chain` node onto the canvas.
2. **Model**: Connect the `OpenAI Chat Model` with temperature set to `0.7` (encouraging creative, natural copywriting).
3. **Structured Output Parser**: Connect a `Structured Output Parser` node, defining the exact JSON schema of the HTML-ready payload.

#### Prompt Instruction to AI Chain Node

```text
You are a professional music copywriter. You are provided with the matched label shortlist: {{ $json.top_matches }} and the artist's profile: {{ $json.artist_name }} (Genre: {{ $json.genre }}, SoundCloud link: {{ $json.soundcloud_link }}).

For each record label, draft a highly personalized, natural-sounding, 3-sentence email pitch.
Guidelines:
1. Address the lead A&R by name (or use 'A&R Team' if unavailable).
2. Reference their actual recent release ({{ $item.recent_release }}) naturally to show authentic interest (e.g., 'I was recently listening to [Release] and loved the production aesthetic...').
3. Keep the pitch concise, stating the track sub-genre, tempo, and providing a clean, single-click SoundCloud streaming link.

Compile all results and inject them directly into the pre-configured HTML report body framework provided below, returning the complete, ready-to-render HTML string.
```

#### Why it's better:

- **Authentic Copywriting**: Boilerplate email templates are instantly rejected by A&Rs. The native AI node creates human-quality, highly contextual pitches that mention real, current songs released by that specific label.
- **Direct Layout Injection**: Merges structured data parsing with document layout generation in a single step, outputting a fully styled webpage string.

---

## Detailed Replaced Node Mapping Comparison


| Step Category                   | Original 19-Node Standard Architecture                                                           | AI-Consolidated 10-Node Architecture                       | Net Reduction / Value Added                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Data Normalization & Audit**  | `02 Normalize Intake` + `03 Pre-Flight Auditor` + IF validator nodes                             | **Single AI Agent Node** with an audit instruction prompt. | **-2 Nodes**. AI performs semantic audit (e.g., checking link syntax and social content validation) in one pass. |
| **Record Label Extraction**     | `04 Query Spotify` + Split in Batches loops + `05 Extract Copyrights` + `06 Deduplicate JS Code` | **Single AI Agent Node** utilizing a custom Spotify Tool.  | **-3 Nodes**. The AI handles loops, standardizes publisher names, and deduplicates the pool organically.         |
| **A&R Research & Fit Scoring**  | `07 Web Search (HTTP)` + `08 Score Fit Code`                                                     | **Single AI Agent Node** with a native Tavily Search Tool. | **-1 Node**. Replaces fragile static scraping with reasoning-capable web analysis and cognitive scoring.         |
| **Dossier & Pitch Copywriting** | `11 Rank Code` + `12 Build HTML Template` + Template parsing steps                               | **Single AI Chain Node** with Structured HTML/JSON output. | **-1 Node**. Merges raw report compiling with professional, highly personalized email pitch copywriting.         |


---

## Technical Recommendations for AI Node Deployment in n8n

1. **Leverage LangChain Memory Nodes**: Attach a `Window Buffer Memory` node to your AI Agents. This ensures that when the agent is looping through multiple searches, it remembers previous successes and avoids repeating search patterns, saving execution costs.
2. **Configure Fail-safes via Tool Parameters**: When configuring Custom Tools (like the Spotify Metadata Tool), ensure the `maxResults` and timeouts are strictly capped. This prevents the AI Agent from getting stuck in "hallucination loops" if the Spotify API returns complex, unexpected payloads.
3. **Use Structured Output Modes**: Under the OpenAI model settings inside n8n, activate `Response Format: JSON Object` or use the `Structured Output` connector. This guarantees the LLM returns parsable data frames rather than wrapping reports in conversational conversational fluff.

&nbsp;