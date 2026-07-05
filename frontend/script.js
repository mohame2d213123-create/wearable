// ---------------------------------------------------------------------
// Point this at your deployed Netlify backend (the "backend/" folder in
// this project deploys separately, since GitHub Pages can't run server
// code or store data). Example: "https://pharos-backend.netlify.app"
// ---------------------------------------------------------------------
const API_BASE = "https://YOUR-BACKEND-SITE.netlify.app";

const $ = (id) => document.getElementById(id);
const OFFLINE_AFTER_MS = 30000; // no check-in for 30s -> treat as offline

async function fetchStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/status`, { cache: "no-store" });
    const data = await res.json();
    render(data);
  } catch (e) {
    renderOffline();
  }
}

function render(data) {
  const beacon = $("beacon");
  const statusWord = $("status-word");
  const lastSeen = $("last-seen");
  const connIndicator = $("conn-indicator");
  const ackBtn = $("btn-ack");

  const updatedAt = data.updated_at ? new Date(data.updated_at) : null;
  const staleMs = updatedAt ? Date.now() - updatedAt.getTime() : Infinity;
  const isOffline = !updatedAt || staleMs > OFFLINE_AFTER_MS;

  beacon.classList.remove("offline", "emergency");
  statusWord.classList.remove("normal", "requested", "emergency", "offline");

  if (isOffline) {
    beacon.classList.add("offline");
    statusWord.classList.add("offline");
    statusWord.textContent = "NO SIGNAL";
    connIndicator.textContent = "offline";
    lastSeen.textContent = updatedAt
      ? `last check-in ${relTime(staleMs)} ago`
      : "waiting for first check-in…";
    ackBtn.disabled = true;
  } else {
    connIndicator.textContent = "online";
    lastSeen.textContent = `last check-in ${relTime(staleMs)} ago`;

    if (data.alert_status === "EMERGENCY") {
      beacon.classList.add("emergency");
      statusWord.classList.add("emergency");
      statusWord.textContent = "EMERGENCY";
      ackBtn.disabled = false;
    } else if (data.alert_status === "REQUESTED") {
      statusWord.classList.add("requested");
      statusWord.textContent = "LOCATING…";
      ackBtn.disabled = true;
    } else {
      statusWord.classList.add("normal");
      statusWord.textContent = "WATCHING";
      ackBtn.disabled = true;
    }
  }

  $("hero").classList.toggle("emergency", data.alert_status === "EMERGENCY" && !isOffline);

  $("val-hr").textContent = data.heart_rate != null ? data.heart_rate : "—";

  const sats = data.satellites ?? 0;
  $("val-sats").textContent = sats;

  const lockEl = $("val-lock");
  lockEl.textContent = data.gps_live ? "LIVE" : "NO LOCK";
  lockEl.classList.toggle("good", !!data.gps_live);
  lockEl.classList.toggle("bad", !data.gps_live);

  const lat = parseFloat(data.latitude);
  const lon = parseFloat(data.longitude);
  const hasFix = data.gps_live && Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0);

  $("coord-lat").textContent = hasFix ? `lat ${lat.toFixed(6)}` : "lat —";
  $("coord-lon").textContent = hasFix ? `lon ${lon.toFixed(6)}` : "lon —";

  const mapSlot = $("map-slot");
  if (hasFix) {
    const d = 0.006;
    const bbox = [lon - d, lat - d, lon + d, lat + d].join(",");
    mapSlot.innerHTML = `<iframe src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&marker=${lat},${lon}" loading="lazy"></iframe>`;
  } else {
    mapSlot.innerHTML = `<div class="map-empty">no location fix yet</div>`;
  }
}

function renderOffline() {
  $("conn-indicator").textContent = "unreachable";
  $("status-word").textContent = "DASHBOARD OFFLINE";
}

function relTime(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  return `${m}m`;
}

$("btn-locate").addEventListener("click", async () => {
  const btn = $("btn-locate");
  btn.disabled = true;
  btn.textContent = "Requested — waiting on bracelet…";
  try {
    await fetch(`${API_BASE}/api/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_location: true }),
    });
    await fetchStatus();
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = "Request location now";
    }, 5000);
  }
});

$("btn-ack").addEventListener("click", async () => {
  await fetch(`${API_BASE}/api/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reset_alert: true }),
  });
  await fetchStatus();
});

fetchStatus();
setInterval(fetchStatus, 3000);
