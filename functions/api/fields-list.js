import { json, safeParse } from "./_utils.js";

export async function onRequestGet({ request, env }) {
  // إذا تبين تخليه محمي بالداشبورد فقط، خلّي تحقق الـ JWT موجود:
  const jwt = request.headers.get("cf-access-jwt-assertion");
  if (!jwt) return json({ ok: false, error: "UNAUTHORIZED" }, 401);

  const url = new URL(request.url);
  const form_id = Number(url.searchParams.get("form_id"));
  if (!form_id) return json({ ok: false, error: "BAD_REQUEST", hint: "form_id required" }, 400);

  const r = await env.DB.prepare(`
    SELECT id, form_id, label, field_type, required, options_json, sort_order, is_active, created_at
    FROM form_fields
    WHERE form_id = ? AND is_active = 1
    ORDER BY sort_order ASC, id ASC
  `).bind(form_id).all();

  const fields = (r.results || []).map(row => {
    const opt = safeParse(row.options_json, {});
    return {
      id: row.id,
      form_id: row.form_id,
      label: row.label,
      field_type: row.field_type,
      required: !!row.required,
      options_json: row.options_json, // نخليه string عشان index.html يفهمه مباشرة
      sort_order: row.sort_order,
      is_active: row.is_active,
      created_at: row.created_at,
      // إضافات مريحة للـ Builder:
      field_key: opt.key || "",
      placeholder: opt.placeholder || "",
      options: Array.isArray(opt.options) ? opt.options : [],
      settings: opt.settings || {},
    };
  });

  return json({ ok: true, fields });
}
