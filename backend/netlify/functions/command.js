import { getStore } from "@netlify/blobs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Called by the dashboard when a parent clicks "Request location" or
// "Acknowledge alert". Sets one-shot flags the bracelet picks up on its
// next POST to /api/update.
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

  const commands = (await store.get("commands", { type: "json" })) || {
    request_location: false,
    reset_alert: false,
  };

  if (body.request_location) commands.request_location = true;
  if (body.reset_alert) commands.reset_alert = true;

  await store.setJSON("commands", commands);

  // Reflect the change immediately in "latest" so the dashboard doesn't
  // have to wait for the bracelet's next report cycle to update the UI.
  const latest = await store.get("latest", { type: "json" });
  if (latest) {
    if (body.request_location) latest.alert_status = "REQUESTED";
    if (body.reset_alert) latest.alert_status = "NORMAL";
    await store.setJSON("latest", latest);
  }

  return json({ ok: true, commands });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export const config = { path: "/api/command" };
