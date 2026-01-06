export async function onRequestGet({ request, env }) {
    // نخليه محمي بـ Access لأنه داخل الداشبورد
    const jwt = request.headers.get("cf-access-jwt-assertion");
    if (!jwt) return json({ ok: false, error: "UNAUTHORIZED", hint: "Missing cf-access-jwt-assertion" }, 401);
  
    const url = new URL(request.url);
    const form_id = Number(url.searchParams.get("form_id"));
    if (!Number.isFinite(form_id) || form_id <= 0) {
      return json({ ok: false, error: "BAD_REQUEST", hint: "form_id required" }, 400);
    }
  
    const r = await env.DB.prepare(`
      SELECT id, form_id, label, field_type, required, options_json, sort_order, is_active, created_at
      FROM form_fields
      WHERE form_id = ?
      ORDER BY sort_order ASC, id ASC
    `).bind(form_id).all();
  
    return json({ ok: true, fields: r.results || [] });
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
  