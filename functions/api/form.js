function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function decodeJwtEmail(request) {
  const jwt = request.headers.get("cf-access-jwt-assertion");
  if (!jwt) return { ok: false };

  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return { ok: false };

    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const claims = JSON.parse(atob(padded));

    const email = claims.email || claims.upn || claims.sub || null;
    const name =
      claims.name || claims.nickname || (email ? email.split("@")[0] : "User");

    return { ok: true, email, name };
  } catch {
    return { ok: false };
  }
}

export async function onRequestGet({ request, env }) {
  const auth = decodeJwtEmail(request);
  if (!auth.ok || !auth.email) return json({ ok: false, error: "Unauthorized" }, 401);

  const rows = await env.DB
    .prepare(
      `SELECT id, name, slug, is_active, created_at
       FROM forms
       WHERE owner_email = ?
       ORDER BY id DESC`
    )
    .bind(auth.email)
    .all();

  return json({ ok: true, forms: rows.results || [] });
}
