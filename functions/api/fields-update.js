export async function fieldsUpdate(request, env) {
    const body = await readJson(request);
    const id = Number(body?.id);
    const updates = body?.updates;
  
    if (!Number.isFinite(id) || id <= 0 || !updates || typeof updates !== "object") {
      return json({ ok: false, error: "BAD_REQUEST", hint: "id and updates are required" }, 400);
    }
  
    // جلب الحقل الحالي لمعرفة form_id (مهم لو بنغير field_key)
    const current = await env.DB
      .prepare(`SELECT id, form_id FROM form_fields WHERE id = ?`)
      .bind(id)
      .first();
  
    if (!current) {
      return json({ ok: false, error: "NOT_FOUND" }, 404);
    }
  
    const allowed = new Set(["field_key","label","type","placeholder","required","options","settings"]);
    const setParts = [];
    const params = [];
  
    for (const [k, v] of Object.entries(updates)) {
      if (!allowed.has(k)) continue;
  
      if (k === "field_key") {
        const nk = normalizeFieldKey(v);
        if (!nk) return json({ ok: false, error: "BAD_REQUEST", hint: "invalid field_key" }, 400);
        setParts.push(`field_key = ?`);
        params.push(nk);
      } else if (k === "label") {
        const s = String(v || "").trim();
        if (!s) return json({ ok: false, error: "BAD_REQUEST", hint: "label required" }, 400);
        setParts.push(`label = ?`);
        params.push(s);
      } else if (k === "type") {
        const s = String(v || "").trim();
        if (!s) return json({ ok: false, error: "BAD_REQUEST", hint: "type required" }, 400);
        setParts.push(`type = ?`);
        params.push(s);
      } else if (k === "placeholder") {
        setParts.push(`placeholder = ?`);
        params.push(v == null ? null : String(v));
      } else if (k === "required") {
        setParts.push(`required = ?`);
        params.push(v ? 1 : 0);
      } else if (k === "options") {
        setParts.push(`options_json = ?`);
        params.push(safeJsonStringify(Array.isArray(v) ? v : []));
      } else if (k === "settings") {
        setParts.push(`settings_json = ?`);
        params.push(safeJsonStringify(v && typeof v === "object" ? v : {}));
      }
    }
  
    if (setParts.length === 0) {
      return json({ ok: false, error: "BAD_REQUEST", hint: "no valid updates" }, 400);
    }
  
    try {
      await env.DB
        .prepare(`UPDATE form_fields SET ${setParts.join(", ")} WHERE id = ?`)
        .bind(...params, id)
        .run();
  
      return json({ ok: true });
    } catch (e) {
      return json({ ok: false, error: "DB_ERROR", hint: String(e?.message || e) }, 400);
    }
  }
  