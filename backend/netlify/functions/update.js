import { getStore } from "@netlify/blobs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Called by the ESP32 bracelet. Body: { heart_rate, latitude, longitude,
// satellites, gps_live, alert_status }. Responds with any pending command
// flags set by the dashboard (request_location / reset_alert), then clears
// them so each command fires exactly once.
export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const store = getStore("tracker");

  const telemetry = {
    heart_rate: numberOrNull(body.heart_rate),
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
    satellites: numberOrNull(body.satellites) ?? 0,
    gps_live: Boolean(body.gps_live),
    alert_status: validAlertStatus(body.alert_status),
    updated_at: new Date().toISOString(),
  };

  await store.setJSON("latest", telemetry);

  const commands = (await store.get("commands", { type: "json" })) || {
    request_location: false,
    reset_alert: false,
  };

  // One-shot commands: clear immediately after reading so a slow poll
  // cycle on the device doesn't replay the same command forever.
  await store.setJSON("commands", { request_location: false, reset_alert: false });

  return json({
    request_location: Boolean(commands.request_location),
    reset_alert: Boolean(commands.reset_alert),
  });
};

function numberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function validAlertStatus(v) {
  return ["NORMAL", "REQUESTED", "EMERGENCY"].includes(v) ? v : "NORMAL";
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export const config = { path: "/api/update" };
