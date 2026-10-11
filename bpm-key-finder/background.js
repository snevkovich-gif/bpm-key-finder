// Haalt BPM en key op bij GetSongBPM. Draait in de achtergrond zodat
// er geen CORS-problemen zijn en resultaten gedeeld gecachet worden.

const API = "https://api.getsong.co/search/";
const cache = new Map(); // "artiest|titel" -> resultaat

// ---------- Camelot-omrekening (handig voor harmonisch mixen) ----------
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const CAMELOT_MAJOR = { 11: "1B", 6: "2B", 1: "3B", 8: "4B", 3: "5B", 10: "6B", 5: "7B", 0: "8B", 7: "9B", 2: "10B", 9: "11B", 4: "12B" };
const CAMELOT_MINOR = { 8: "1A", 3: "2A", 10: "3A", 5: "4A", 0: "5A", 7: "6A", 2: "7A", 9: "8A", 4: "9A", 11: "10A", 6: "11A", 1: "12A" };

function toCamelot(key) {
  if (!key) return null;
  const k = key.replace("♯", "#").replace("♭", "b").trim();
  const m = k.match(/^([A-G])([#b]?)(m|min|minor)?$/i);
  if (!m) return null;
  let semi = NOTE[m[1].toUpperCase()];
  if (m[2] === "#") semi += 1;
  if (m[2] === "b") semi -= 1;
  semi = (semi + 12) % 12;
  return m[3] ? CAMELOT_MINOR[semi] : CAMELOT_MAJOR[semi];
}

// ---------- Hulpjes voor vergelijken ----------
const norm = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function score(item, artist, title) {
  const t = norm(item.title), a = norm(item.artist && item.artist.name);
  const wt = norm(title), wa = norm(artist);
  let s = 0;
  if (t === wt) s += 3; else if (t.includes(wt) || wt.includes(t)) s += 2;
  if (wa) {
    if (a === wa) s += 3; else if (a && (a.includes(wa) || wa.includes(a))) s += 2;
  }
  return s;
}

async function apiSearch(apiKey, type, lookup) {
  const url = `${API}?type=${type}&limit=15&lookup=${encodeURIComponent(lookup)}`;
  const res = await fetch(url, { headers: { "X-API-KEY": apiKey } });
  if (res.status === 401 || res.status === 403) throw new Error("API-sleutel ongeldig of geblokkeerd");
  if (res.status === 429) throw new Error("Te veel verzoeken, probeer het over een uur opnieuw");
  if (!res.ok) throw new Error(`GetSongBPM gaf fout ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.search) ? data.search : []; // bij geen resultaat geeft de API een object met "error"
}

async function lookup(artist, title) {
  const cacheKey = norm(artist) + "|" + norm(title);
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const { apiKey } = await browser.storage.local.get("apiKey");
  if (!apiKey) return { error: "nokey" };

  let results = [];
  if (artist) results = await apiSearch(apiKey, "both", `song:${title} artist:${artist}`);
  if (!results.length) results = await apiSearch(apiKey, "song", title);

  let best = null, bestScore = -1;
  for (const r of results) {
    const s = score(r, artist, title);
    if (s > bestScore) { best = r; bestScore = s; }
  }
  // Minimaal de titel moet ongeveer kloppen, anders liever "niet gevonden"
  const out = best && bestScore >= 2
    ? {
        found: true,
        title: best.title,
        artist: best.artist && best.artist.name,
        bpm: best.tempo ? Number(best.tempo) : null,
        key: best.key_of || null,
        camelot: toCamelot(best.key_of),
        uri: best.uri
      }
    : { found: false };

  cache.set(cacheKey, out);
  return out;
}

browser.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "lookup") {
    return lookup(msg.artist, msg.title).catch((e) => ({ error: e.message }));
  }
  if (msg && msg.type === "openOptions") {
    browser.runtime.openOptionsPage();
  }
});

browser.browserAction.onClicked.addListener(() => browser.runtime.openOptionsPage());
