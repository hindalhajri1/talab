export async function onRequestGet({ request, env }) {
  const jwt = request.headers.get("cf-access-jwt-assertion");
  if (!jwt) return json({ ok: false, error: "Unauthorized" }, 401);

  let email = null;
  try {
    const parts = jwt.split(".");
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const claims = JSON.parse(atob(padded));
    email = claims.email || claims.upn || claims.sub || null;
  } catch {
    return json({ ok: false, error: "Bad token" }, 400);
  }

  if (!email) return json({ ok: false, error: "Unauthorized" }, 401);

  const res = await env.DB
    .prepare(`
      SELECT id, name, slug, is_active, created_at
      FROM forms
      WHERE owner_email = ?
      ORDER BY id DESC
    `)
    .bind(email)
    .all();

  return json({ ok: true, rows: res.results || [] });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
