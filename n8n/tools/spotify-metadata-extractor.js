/**
 * n8n Custom Code Tool: spotify_metadata_extractor
 *
 * Paste this into: AI Agent → Tools → Custom Code Tool
 * Node name on canvas: spotify_metadata_extractor
 *
 * HTTP: use helpers.httpRequest (not bare httpRequest). $env is blocked in Code Tools.
 *
 * Credentials (pick ONE method — $env is blocked in Code Tools on n8n v2+):
 *
 *   A) n8n Variables (recommended): Settings → Variables
 *        SPOTIFY_CLIENT_ID
 *        SPOTIFY_CLIENT_SECRET
 *
 *   B) Inline fallback: fill SPOTIFY_CONFIG below (stored in workflow JSON)
 *
 * Input schema (enable "Specify Input Schema"):
 * {
 *   "type": "object",
 *   "properties": {
 *     "artist_name": {
 *       "type": "string",
 *       "description": "Reference artist name exactly as submitted (one artist per tool call)"
 *     }
 *   },
 *   "required": ["artist_name"]
 * }
 */

// Inline fallback — only used when n8n Variables are not set
const SPOTIFY_CONFIG = {
  clientId: '',
  clientSecret: '',
};

const MAX_ALBUMS = 10;
const MARKET = 'US';

const artistName =
  typeof query === 'string'
    ? query.trim()
    : String(query?.artist_name || query?.artist || '').trim();

if (!artistName) {
  return JSON.stringify({
    error: 'artist_name is required',
    albums: [],
  });
}

function resolveSpotifyCredentials() {
  let clientId = '';
  let clientSecret = '';

  try {
    clientId = String($vars.SPOTIFY_CLIENT_ID || '').trim();
    clientSecret = String($vars.SPOTIFY_CLIENT_SECRET || '').trim();
  } catch {
    // $vars unavailable in this runner context
  }

  if (!clientId || !clientSecret) {
    clientId = String(SPOTIFY_CONFIG.clientId || '').trim();
    clientSecret = String(SPOTIFY_CONFIG.clientSecret || '').trim();
  }

  return { clientId, clientSecret };
}

const { clientId, clientSecret } = resolveSpotifyCredentials();

if (!clientId || !clientSecret) {
  return JSON.stringify({
    error:
      'Missing Spotify credentials. Set n8n Variables SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET (Settings → Variables), or paste values into SPOTIFY_CONFIG in this tool code. Note: $env is blocked in Code Tools on n8n v2+.',
    albums: [],
  });
}

async function spotifyGet(url, token) {
  return await helpers.httpRequest({
    method: 'GET',
    url,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    json: true,
  });
}

const tokenResponse = await helpers.httpRequest({
  method: 'POST',
  url: 'https://accounts.spotify.com/api/token',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  auth: {
    username: clientId,
    password: clientSecret,
  },
  body: 'grant_type=client_credentials',
  json: true,
});

const token = tokenResponse.access_token;
if (!token) {
  return JSON.stringify({
    error: 'Spotify token request failed',
    albums: [],
  });
}

const searchUrl =
  'https://api.spotify.com/v1/search?' +
  new URLSearchParams({
    q: artistName,
    type: 'artist',
    limit: '5',
  }).toString();

const search = await spotifyGet(searchUrl, token);
const candidates = search.artists?.items || [];

if (!candidates.length) {
  return JSON.stringify({
    query_artist: artistName,
    error: 'No Spotify artist match found',
    matched_artist: null,
    albums_returned: 0,
    albums: [],
  });
}

const target = artistName.toLowerCase();
const matched =
  candidates.find((artist) => artist.name.toLowerCase() === target) || candidates[0];

const albumsUrl =
  `https://api.spotify.com/v1/artists/${matched.id}/albums?` +
  new URLSearchParams({
    include_groups: 'album,single',
    market: MARKET,
    limit: String(MAX_ALBUMS),
  }).toString();

const albumsList = await spotifyGet(albumsUrl, token);
const simplified = albumsList.items || [];

const seenIds = new Set();
const uniqueAlbums = [];

for (const album of simplified) {
  if (!album?.id || seenIds.has(album.id)) continue;
  seenIds.add(album.id);
  uniqueAlbums.push(album);
  if (uniqueAlbums.length >= MAX_ALBUMS) break;
}

const albumIds = uniqueAlbums.map((album) => album.id);
const fullAlbums = [];

for (let i = 0; i < albumIds.length; i += 20) {
  const batch = albumIds.slice(i, i + 20);
  const batchUrl =
    'https://api.spotify.com/v1/albums?' +
    new URLSearchParams({ ids: batch.join(',') }).toString();
  const batchResponse = await spotifyGet(batchUrl, token);
  fullAlbums.push(...(batchResponse.albums || []).filter(Boolean));
}

function parseLabelFromPLine(text) {
  if (!text) return null;
  return text
    .replace(/^℗\s*/i, '')
    .replace(/^©\s*/i, '')
    .replace(/^\d{4}\s+/, '')
    .trim();
}

const albums = fullAlbums.map((album) => {
  const pLine = (album.copyrights || []).find((entry) => entry.type === 'P');
  const cLine = (album.copyrights || []).find((entry) => entry.type === 'C');

  return {
    album_id: album.id,
    album_name: album.name,
    album_type: album.album_type,
    release_date: album.release_date,
    total_tracks: album.total_tracks,
    spotify_url: album.external_urls?.spotify || null,
    label_from_p_line: parseLabelFromPLine(pLine?.text),
    p_line: pLine?.text || null,
    c_line: cLine?.text || null,
    copyrights: album.copyrights || [],
  };
});

return JSON.stringify({
  query_artist: artistName,
  matched_artist: {
    id: matched.id,
    name: matched.name,
    genres: matched.genres || [],
    popularity: matched.popularity,
    spotify_url: matched.external_urls?.spotify || null,
  },
  albums_returned: albums.length,
  albums,
});
