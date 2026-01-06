export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const formId = Number(url.searchParams.get("form_id"));
  if (!Number.isFinite(formId) || formId <= 0) {
    return json({ ok: false, error: "BAD_REQUEST", hint: "form_id is required" }, 400);
  }

  const form = await env.DB
    .prepare(`SELECT id, name, slug, is_active FROM forms WHERE id = ? LIMIT 1`)
    .bind(formId)
    .first();

  if (!form) return json({ ok: false, error: "NOT_FOUND" }, 404);

  const rows = await env.DB
    .prepare(`
      SELECT id, form_id, label, field_type, required, options_json, sort_order, is_active, created_at
      FROM form_fields
      WHERE form_id = ? AND is_active = 1
      ORDER BY sort_order ASC, id ASC
    `)
    .bind(formId)
    .all();

  // نخليها بنفس شكل اللي يفهمه index.html عندك:
  const fields = (rows.results || []).map(r => ({
    id: r.id,
    form_id: r.form_id,
    label: r.label,
    field_type: r.field_type,
    required: r.required,
    options_json: r.options_json, // يحتوي {"key":"name", ...}
    sort_order: r.sort_order,
    is_active: r.is_active,
    created_at: r.created_at,
  }));

  return json({ ok: true, form, fields });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}
