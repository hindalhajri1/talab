export async function fieldsList(request, env) {
    const url = new URL(request.url);
    const formId = Number(url.searchParams.get("form_id"));
    if (!Number.isFinite(formId) || formId <= 0) {
      return json({ ok: false, error: "BAD_REQUEST", hint: "form_id is required" }, 400);
    }
  
    const rows = await env.DB
      .prepare(`
        SELECT id, form_id, field_key, label, type, placeholder, required, options_json, settings_json, sort_order, created_at
        FROM form_fields
        WHERE form_id = ?
        ORDER BY sort_order ASC, id ASC
      `)
      .bind(formId)
      .all();
  
    const fields = (rows.results || []).map(r => ({
      id: r.id,
      form_id: r.form_id,
      field_key: r.field_key,
      label: r.label,
      type: r.type,
      placeholder: r.placeholder,
      required: !!r.required,
      options: safeJsonParse(r.options_json, []),
      settings: safeJsonParse(r.settings_json, {}),
      sort_order: r.sort_order,
      created_at: r.created_at,
    }));
  
    return json({ ok: true, fields });
  }
  