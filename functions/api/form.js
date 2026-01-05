export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const formId = Number(url.searchParams.get("form_id") || 0);

    if (!formId) {
      return json({ ok: false, error: "MISSING_FORM_ID" }, 400);
    }

    // 1) جلب النموذج (عام)
    const formRow = await env.DB
      .prepare(`SELECT id, name, slug, is_active, created_at FROM forms WHERE id = ? LIMIT 1`)
      .bind(formId)
      .first();

    if (!formRow) {
      return json({ ok: false, error: "FORM_NOT_FOUND" }, 404);
    }

    if (Number(formRow.is_active) !== 1) {
      return json({ ok: false, error: "FORM_INACTIVE" }, 403);
    }

    // 2) جلب الحقول
    const fieldsRes = await env.DB
      .prepare(`
        SELECT id, label, field_type, required, options_json, sort_order
        FROM form_fields
        WHERE form_id = ?
        ORDER BY sort_order ASC, id ASC
      `)
      .bind(formId)
      .all();

    return json({
      ok: true,
      form: formRow,
      fields: fieldsRes.results || []
    });

  } catch (e) {
    return json({ ok: false, error: e.message || "SERVER_ERROR" }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
