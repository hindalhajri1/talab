export async function fieldsAdd(request, env) {
    const body = await readJson(request);
    if (!body?.form_id || !body?.field) {
      return json({ ok: false, error: "BAD_REQUEST", hint: "form_id and field are required" }, 400);
    }
  
    const formId = Number(body.form_id);
    if (!Number.isFinite(formId) || formId <= 0) {
      return json({ ok: false, error: "BAD_REQUEST", hint: "invalid form_id" }, 400);
    }
  
    const f = body.field;
    const field_key = normalizeFieldKey(f.field_key);
    const label = String(f.label || "").trim();
    const type = String(f.type || "").trim();
    const placeholder = f.placeholder == null ? null : String(f.placeholder);
    const required = f.required ? 1 : 0;
  
    if (!field_key || !label || !type) {
      return json({ ok: false, error: "BAD_REQUEST", hint: "field_key, label, type are required" }, 400);
    }
  
    const options_json = safeJsonStringify(Array.isArray(f.options) ? f.options : []);
    const settings_json = safeJsonStringify(f.settings && typeof f.settings === "object" ? f.settings : {});
  
    // sort_order = آخر ترتيب + 10 (للمرونة)
    const maxRow = await env.DB
      .prepare(`SELECT COALESCE(MAX(sort_order), 0) AS mx FROM form_fields WHERE form_id = ?`)
      .bind(formId)
      .first();
  
    const nextOrder = Number(maxRow?.mx || 0) + 10;
  
    try {
      const res = await env.DB
        .prepare(`
          INSERT INTO form_fields (form_id, field_key, label, type, placeholder, required, options_json, settings_json, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(formId, field_key, label, type, placeholder, required, options_json, settings_json, nextOrder)
        .run();
  
      return json({ ok: true, id: res.meta?.last_row_id, sort_order: nextOrder });
    } catch (e) {
      // unique key violation غالبًا
      return json({ ok: false, error: "DB_ERROR", hint: String(e?.message || e) }, 400);
    }
  }
  