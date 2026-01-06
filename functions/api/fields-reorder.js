export async function fieldsReorder(request, env) {
    const body = await readJson(request);
    const formId = Number(body?.form_id);
    const ordered = body?.ordered_ids;
  
    if (!Number.isFinite(formId) || formId <= 0 || !Array.isArray(ordered) || ordered.length === 0) {
      return json({ ok: false, error: "BAD_REQUEST", hint: "form_id and ordered_ids required" }, 400);
    }
  
    // ترتيب: 10,20,30...
    const stmts = [];
    let order = 10;
  
    for (const rawId of ordered) {
      const id = Number(rawId);
      if (!Number.isFinite(id) || id <= 0) continue;
  
      stmts.push(
        env.DB.prepare(`UPDATE form_fields SET sort_order = ? WHERE id = ? AND form_id = ?`)
          .bind(order, id, formId)
      );
      order += 10;
    }
  
    const batchRes = await env.DB.batch(stmts);
    return json({ ok: true, updated: batchRes.length });
  }
  