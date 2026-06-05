# n8n workflows — LabelScout

## Import the Spotify Metadata sub-workflow

1. Open your n8n instance in the browser.
2. In the **top-right** of the editor, click the **⋯** (three dots) menu.
3. Choose **Import from File**.
4. Select `n8n/workflows/spotify-metadata-subworkflow.json` from this repo.
5. n8n creates a workflow named **Spotify Metadata Extractor**.

Alternative: open the JSON file, copy all, paste onto an empty canvas with **Ctrl+V** (or **Cmd+V** on Mac).

## After import

1. Open each **HTTP Request** node (`Search Artist`, `Get Artist Albums`, `Get Full Album`).
2. Under **Authentication**, confirm **Generic Credential Type → OAuth2 API**.
3. Select your **Spotify OAuth2** credential (e.g. "Spotify Dev. API").
4. **Save** the workflow.

If you use n8n's built-in **Spotify** predefined credential instead, change each HTTP node to **Predefined Credential Type → Spotify** and re-select the credential.

## Test the sub-workflow

1. Open **Spotify Metadata Extractor**.
2. Click **Execute workflow** (or use the test panel on the trigger).
3. Provide input:

```json
{
  "artist_name": "Khruangbin"
}
```

4. The last node (**Format Output** or **No Artist Match**) should return album metadata including `album_type` and, when available, P-line label fields.

## Connect to your main AI Agent workflow

1. In your Zone 1 / label miner workflow, **remove or disable** the Custom Code Tool (`spotify_metadata_extractor`).
2. Add **Call n8n Workflow Tool** to the AI Agent's tools.
3. Select workflow: **Spotify Metadata Extractor**.
4. **Description** (example):

   > Fetch Spotify album metadata and P-line copyright label info for one reference artist. Input: artist_name (exact name as submitted). Returns matched artist, up to 10 albums, and label_from_p_line for each album.

5. Map the tool input field `artist_name` from the agent call.
6. Save and test.

## Troubleshooting

### 403 Forbidden on `GET /v1/albums?ids=...` (batch)

**Root cause:** Spotify removed batch album fetch (`GET /v1/albums?ids=...`) for **Development Mode** apps in the [February 2026 API changes](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide). The endpoint returns **403 Forbidden** even with a valid token.

**Fix in this workflow:** The sub-workflow no longer uses the batch endpoint. It:

1. Reads **simplified** albums from `GET /v1/artists/{id}/albums` (includes `album_type`, `release_date`, `total_tracks`).
2. Fetches each album individually via `GET /v1/albums/{id}?market=US` for **copyrights / P-line** data.

### 403 on individual album fetch or missing P-line data

Check these Spotify Dev Mode requirements:

- **App owner must have Spotify Premium** (required since Feb 2026 for Development Mode).
- **OAuth credential** must be connected and authorized (reconnect if the token expired).
- **Client Credentials** (`grant_type=client_credentials`) may behave differently than user OAuth; this workflow expects **OAuth2 API** credentials.
- **Extended Quota Mode** apps keep broader endpoint access; Dev Mode apps have the restricted set.

If individual album fetches still fail, **Format Output** falls back to simplified album data: `album_type` and core fields are preserved; `p_line`, `c_line`, `label_from_p_line`, and `copyrights` will be `null` / `[]`.

### Album types without full album fetch

`album_type` is already present on **simplified** album objects from `GET /v1/artists/{id}/albums`. Full album fetch is only needed for copyright / P-line fields.

## Files

| File | Purpose |
|------|---------|
| `workflows/spotify-metadata-subworkflow.json` | Importable sub-workflow (HTTP Request + Code nodes) |
| `tools/spotify-metadata-extractor.js` | Legacy Custom Code Tool (sandbox-limited; prefer sub-workflow) |
