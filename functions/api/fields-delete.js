export async function fieldsDelete(request, env) {
    const body = await readJson(request);
    const id = Number(body?.id);
  
    if (!Number.isFinite(id) || id <= 0) {
      return json({ ok: false, error: "BAD_REQUEST", hint: "id is required" }, 400);
    }
  
    const res = await env.DB
      .prepare(`DELETE FROM form_fields WHERE id = ?`)
      .bind(id)
      .run();
  
    return json({ ok: true, deleted: res.meta?.changes || 0 });
  }
  