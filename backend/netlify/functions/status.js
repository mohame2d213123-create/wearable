import { getStore } from "@netlify/blobs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Called by the dashboard (polled every few seconds). Returns the last
// telemetry payload the bracelet reported.
export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const store = getStore("tracker");
  const latest = await store.get("latest", { type: "json" });

  return json(
    latest || {
      heart_rate: null,
      latitude: null,
      longitude: null,
      satellites: 0,
      gps_live: false,
      alert_status: "NORMAL",
      updated_at: null,
    }
  );
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export const config = { path: "/api/status" };
