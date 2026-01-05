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
    return { ok: true, email };
  } catch {
    return { ok: false };
  }
}

export async function onRequestGet({ request, env }) {
  const auth = decodeJwtEmail(request);
  if (!auth.ok || !auth.email) return json({ ok: false, error: "Unauthorized" }, 401);

  const url = new URL(request.url);
  const formId = Number(url.searchParams.get("form_id") || 0);
  if (!formId) return json({ ok: false, error: "FORM_REQUIRED" }, 400);

  // ✅ تأكد أن الفورم يخص هذا المستخدم
  const form = await env.DB
    .prepare(`SELECT id, name, slug FROM forms WHERE id = ? AND owner_email = ? LIMIT 1`)
    .bind(formId, auth.email)
    .first();

  if (!form) return json({ ok: false, error: "FORM_NOT_FOUND" }, 404);

  // Cards
  const totalRow = await env.DB
    .prepare(`SELECT COUNT(*) as c FROM requests WHERE form_id = ?`)
    .bind(formId)
    .first();

  const confirmedRow = await env.DB
    .prepare(`SELECT COUNT(*) as c FROM requests WHERE form_id = ? AND lower(status) = 'confirmed'`)
    .bind(formId)
    .first();

  const canceledRow = await env.DB
    .prepare(`SELECT COUNT(*) as c FROM requests WHERE form_id = ? AND (lower(status) = 'canceled' OR lower(status) = 'cancelled')`)
    .bind(formId)
    .first();

  const pendingRow = await env.DB
    .prepare(
      `SELECT COUNT(*) as c
       FROM requests
       WHERE form_id = ?
         AND lower(status) NOT IN ('confirmed','canceled','cancelled')`
    )
    .bind(formId)
    .first();

  // By City
  const byCity = await env.DB
    .prepare(
      `SELECT
         city,
         COUNT(*) as total,
         SUM(CASE WHEN lower(status) = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
         SUM(CASE WHEN lower(status) IN ('canceled','cancelled') THEN 1 ELSE 0 END) as canceled,
         SUM(CASE WHEN lower(status) NOT IN ('confirmed','canceled','cancelled') THEN 1 ELSE 0 END) as pending
       FROM requests
       WHERE form_id = ?
       GROUP BY city
       ORDER BY total DESC`
    )
    .bind(formId)
    .all();

  // Latest
  const latest = await env.DB
    .prepare(
      `SELECT id, created_at, name, mobile, city, count, status, token
       FROM requests
       WHERE form_id = ?
       ORDER BY id DESC
       LIMIT 30`
    )
    .bind(formId)
    .all();

  return json({
    ok: true,
    form,
    cards: {
      total: totalRow?.c || 0,
      confirmed: confirmedRow?.c || 0,
      canceled: canceledRow?.c || 0,
      pending: pendingRow?.c || 0,
    },
    byCity: byCity.results || [],
    latest: latest.results || [],
  });
}
