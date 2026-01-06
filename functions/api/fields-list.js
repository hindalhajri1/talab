import { json, safeParse } from "./_utils.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const form_id = Number(url.searchParams.get("form_id"));
  if (!form_id) return json({ ok: false, error: "BAD_REQUEST", hint: "form_id required" }, 400);

  const r = await env.DB.prepare(`
    SELECT id, form_id, label, field_type, required, options_json, sort_order, is_active, created_at
    FROM form_fields
    WHERE form_id = ?
    ORDER BY sort_order ASC, id ASC
  `).bind(form_id).all();

  const fields = (r.results || []).map(row => {
    const opt = safeParse(row.options_json, {});
    return {
      id: row.id,
      form_id: row.form_id,
      label: row.label,
      type: row.field_type,
      required: !!row.required,
      field_key: opt.key || null,
      placeholder: opt.placeholder || "",
      options: Array.isArray(opt.options) ? opt.options : [],
      settings: opt.settings || {},
      sort_order: row.sort_order,
      is_active: row.is_active,
      created_at: row.created_at,
    };
  });

  return json({ ok: true, fields });
}
