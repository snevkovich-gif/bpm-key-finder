// Herkent het nummer dat op de pagina speelt en toont een klein label
// met BPM, key en een knop naar SongBPM.

(() => {
  if (window.top !== window) return; // alleen in het hoofdvenster

  // ---------- 1. Nummer herkennen ----------

  // Rommel die vaak in titels staat en het zoeken verstoort
  function cleanTitle(t) {
    return (t || "")
      .replace(/\s*[\(\[][^\)\]]*(official|video|audio|lyric|visuali[sz]er|clip|hd|hq|4k|remaster|live|explicit|extended mix|original mix|radio edit|premiere)[^\)\]]*[\)\]]/gi, "")
      .replace(/\s+-\s+(remaster(ed)?|\d{4} remaster).*$/i, "")
      .replace(/\s+(ft\.?|feat\.?|featuring)\s.*$/i, "")
      .replace(/\s*\|.*$/, "")
      .replace(/["“”]/g, "")
      .trim();
  }

  function cleanArtist(a) {
    return (a || "")
      .replace(/\s*-\s*Topic$/i, "")      // YouTube "Artiest - Topic"-kanalen
      .replace(/VEVO$/i, "")
      .split(/\s*(,|&| x | feat\.? | ft\.? )\s*/i)[0]  // eerste artiest is genoeg
      .trim();
  }

  // Bron A: Media Session. YouTube, YouTube Music, Spotify, SoundCloud,
  // Deezer, Bandcamp e.a. vullen dit voor de mediabediening van je systeem.
  function fromMediaSession() {
    try {
      let md = navigator.mediaSession && navigator.mediaSession.metadata;
      if (!md && navigator.wrappedJSObject && navigator.wrappedJSObject.mediaSession) {
        md = navigator.wrappedJSObject.mediaSession.metadata;
      }
      if (md && md.title) return { artist: md.artist || "", title: md.title };
    } catch (e) { /* negeren */ }
    return null;
  }

  // Bron B: de paginatitel, als Media Session leeg is
  function fromDocumentTitle() {
    const host = location.hostname;
    let t = document.title;
    if (/(^|\.)youtube\.com$/.test(host) && location.pathname === "/watch") {
      t = t.replace(/^\(\d+\)\s*/, "").replace(/\s*-\s*YouTube$/, "");
      const m = t.match(/^(.+?)\s+[-–—]\s+(.+)$/);
      if (m) return { artist: m[1], title: m[2] };
    }
    return null;
  }

  function detect() {
    let r = fromMediaSession();
    if (r && !r.artist) {
      // Op YouTube is "artist" soms leeg en staat alles in de titel
      const m = r.title.match(/^(.+?)\s+[-–—]\s+(.+)$/);
      if (m) r = { artist: m[1], title: m[2] };
    } else if (r && /(^|\.)youtube\.com$/.test(location.hostname)) {
      // Kanaalnaam ≠ artiest als de titel zelf "Artiest - Titel" bevat
      const m = r.title.match(/^(.+?)\s+[-–—]\s+(.+)$/);
      if (m) r = { artist: m[1], title: m[2] };
    }
    if (!r) r = fromDocumentTitle();
    if (!r) return null;
    const title = cleanTitle(r.title);
    const artist = cleanArtist(r.artist);
    return title ? { artist, title } : null;
  }

  // ---------- 2. Het label ----------

  const host = document.createElement("div");
  host.style.cssText = "all:initial;position:fixed;z-index:2147483647;right:16px;bottom:16px;";
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `
    <style>
      .box{font:13px/1.35 system-ui,sans-serif;color:#f4f1ea;background:rgba(22,22,30,.94);
        border:1px solid rgba(255,170,40,.45);border-radius:12px;padding:10px 12px;
        box-shadow:0 6px 24px rgba(0,0,0,.35);min-width:220px;max-width:300px}
      .top{display:flex;align-items:center;gap:8px}
      .song{flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;opacity:.75;font-size:12px}
      .x{cursor:pointer;border:0;background:none;color:#f4f1ea;opacity:.5;font-size:15px;padding:0 2px}
      .x:hover{opacity:1}
      .vals{display:flex;gap:14px;margin:6px 0 8px}
      .v b{display:block;font-size:20px;color:#ffaa28;font-variant-numeric:tabular-nums}
      .v span{font-size:11px;opacity:.6;text-transform:uppercase;letter-spacing:.05em}
      .msg{margin:6px 0 8px;opacity:.85}
      .row{display:flex;gap:8px;align-items:center}
      a.btn,button.btn{font:inherit;font-size:12px;color:#16161e;background:#ffaa28;border:0;border-radius:7px;
        padding:4px 9px;text-decoration:none;cursor:pointer}
      a.src{margin-left:auto;font-size:10px;color:#f4f1ea;opacity:.45}
      .mini{cursor:pointer;font:600 12px system-ui,sans-serif;color:#16161e;background:#ffaa28;
        border-radius:999px;padding:5px 10px;box-shadow:0 4px 14px rgba(0,0,0,.3)}
    </style>
    <div class="box" id="box"></div>
    <div class="mini" id="mini" hidden></div>`;
  const box = root.getElementById("box");
  const mini = root.getElementById("mini");
  let collapsed = false;
  let attached = false;

  function attach() {
    if (!attached && document.body) { document.body.appendChild(host); attached = true; }
  }

  const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // SongBPM-pagina's hebben de vorm songbpm.com/@artiest/titel
  const slug = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const songbpmUrl = (a, t) => a ? `https://songbpm.com/@${slug(a)}/${slug(t)}` : "https://songbpm.com/";

  function render(track, data) {
    const songLine = `${esc(track.artist)}${track.artist ? " – " : ""}${esc(track.title)}`;
    let middle;
    if (!data) middle = `<div class="msg">Zoeken…</div>`;
    else if (data.error === "nokey") middle = `<div class="msg">Nog geen API-sleutel ingesteld.</div>`;
    else if (data.error) middle = `<div class="msg">⚠ ${esc(data.error)}</div>`;
    else if (!data.found) middle = `<div class="msg">Niet gevonden in GetSongBPM.</div>`;
    else middle = `
      <div class="vals">
        <div class="v"><b>${data.bpm ?? "?"}</b><span>BPM</span></div>
        <div class="v"><b>${esc(data.key || "?")}</b><span>Key</span></div>
        ${data.camelot ? `<div class="v"><b>${data.camelot}</b><span>Camelot</span></div>` : ""}
      </div>`;

    const settingsBtn = data && data.error === "nokey" ? `<button class="btn" id="opt">Instellen</button>` : "";
    box.innerHTML = `
      <div class="top"><div class="song" title="${songLine}">${songLine}</div>
        <button class="x" id="min" title="Inklappen">–</button></div>
      ${middle}
      <div class="row">
        ${settingsBtn}
        <a class="btn" href="${songbpmUrl(track.artist, track.title)}" target="_blank" rel="noopener">SongBPM ↗</a>
        <a class="src" href="${data && data.uri ? esc(data.uri) : "https://getsongbpm.com"}" target="_blank" rel="noopener">data: GetSongBPM</a>
      </div>`;
    mini.textContent = data && data.found ? `${data.bpm ?? "?"} · ${data.camelot || data.key || "?"}` : "♪ BPM";

    root.getElementById("min").onclick = () => { collapsed = true; show(); };
    const opt = root.getElementById("opt");
    if (opt) opt.onclick = () => browser.runtime.sendMessage({ type: "openOptions" });
  }

  function show() {
    box.hidden = collapsed;
    mini.hidden = !collapsed;
  }
  mini.onclick = () => { collapsed = false; show(); };

  // ---------- 3. Bijhouden wanneer het nummer wisselt ----------

  let current = "";
  let token = 0;

  async function tick() {
    const track = detect();
    const id = track ? `${track.artist}|${track.title}` : "";
    if (id === current) return;
    current = id;

    if (!track) { host.remove(); attached = false; return; }
    attach();
    show();
    render(track, null);

    const my = ++token;
    let data;
    try {
      data = await browser.runtime.sendMessage({ type: "lookup", artist: track.artist, title: track.title });
    } catch (e) {
      data = { error: "Addon niet bereikbaar, herlaad de pagina" };
    }
    if (my === token) render(track, data);
  }

  // Opnieuw zoeken nadat de API-sleutel is ingevuld
  browser.storage.onChanged.addListener((ch) => { if (ch.apiKey) { current = ""; tick(); } });

  setInterval(tick, 2000);
  tick();
})();
