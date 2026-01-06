import { json, readJson, normalizeKey, safeStringify } from "./_utils.js";

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const form_id = Number(body?.form_id);
  const f = body?.field;

  if (!form_id || !f) return json({ ok: false, error: "BAD_REQUEST", hint: "form_id and field required" }, 400);

  const key = normalizeKey(f.field_key || f.key);
  const label = String(f.label || "").trim();
  const field_type = String(f.type || f.field_type || "").trim();
  const required = f.required ? 1 : 0;

  if (!key || !label || !field_type) {
    return json({ ok: false, error: "BAD_REQUEST", hint: "field_key, label, type required" }, 400);
  }

  // next sort_order
  const mx = await env.DB.prepare(`SELECT COALESCE(MAX(sort_order), 0) mx FROM form_fields WHERE form_id = ?`)
    .bind(form_id).first();

  const nextOrder = Number(mx?.mx || 0) + 1;

  const options_json = safeStringify({
    key,
    placeholder: f.placeholder || "",
    options: Array.isArray(f.options) ? f.options : [],
    settings: (f.settings && typeof f.settings === "object") ? f.settings : {},
  });

  try {
    const ins = await env.DB.prepare(`
      INSERT INTO form_fields (form_id, label, field_type, required, options_json, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).bind(form_id, label, field_type, required, options_json, nextOrder).run();

    return json({ ok: true, id: ins.meta?.last_row_id, sort_order: nextOrder });
  } catch (e) {
    return json({ ok: false, error: "DB_ERROR", hint: String(e?.message || e) }, 400);
  }
}
