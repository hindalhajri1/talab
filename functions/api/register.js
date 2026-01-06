export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();

    // form_id (افتراضي 1)
    const formId = Number(body.form_id || 1);
    if (!Number.isFinite(formId) || formId < 1) {
      return json({ ok: false, error: "FORM_ID_INVALID" }, 400);
    }

    // نتأكد الفورم موجود ومفعل
    const form = await env.DB
      .prepare(`SELECT id, name, slug, is_active FROM forms WHERE id = ? LIMIT 1`)
      .bind(formId)
      .first();

    if (!form) return json({ ok: false, error: "FORM_NOT_FOUND" }, 404);
    if (Number(form.is_active) !== 1) return json({ ok: false, error: "FORM_INACTIVE" }, 403);

    // نجيب الحقول الفعّالة
    const fieldsRes = await env.DB
      .prepare(`
        SELECT label, field_type, required, options_json, sort_order
        FROM form_fields
        WHERE form_id = ? AND is_active = 1
        ORDER BY sort_order ASC
      `)
      .bind(formId)
      .all();

    const fields = fieldsRes.results || [];

    // نبني خريطة key من options_json.key
    const fieldKeys = fields.map(f => {
      let opt = null;
      try { opt = f.options_json ? JSON.parse(f.options_json) : null; } catch {}
      return {
        key: opt?.key || null,
        required: Number(f.required) === 1,
        label: f.label || "",
        type: f.field_type || "text",
      };
    }).filter(x => !!x.key);

    // نجمع بيانات المستخدم بناءً على key
    const data = {};
    for (const f of fieldKeys) {
      const raw = body[f.key];
      const val = (raw === undefined || raw === null) ? "" : String(raw).trim();
      data[f.key] = val;

      if (f.required && !val) {
        return json({ ok: false, error: `حقل مطلوب: ${f.label}` }, 400);
      }
    }

    // تجهيز قيم الأعمدة الأساسية (حسب حقولك الحالية)
    const name = (data.name || "").trim();
    const mobile = (data.mobile || "").trim();
    const city = (data.city || "").trim();
    const count = Number(data.count || 1);

    if (!name || !mobile || !city || !Number.isFinite(count) || count < 1) {
      return json({ ok: false, error: "بيانات غير مكتملة" }, 400);
    }

    const token = crypto.randomUUID();
    const now = new Date().toISOString();
    const data_json = JSON.stringify(data);

    // نحاول نخزن الأعمدة الثابتة + data_json (لو الأعمدة موجودة)
    await env.DB.prepare(`
      INSERT INTO requests (
        created_at, form_id, name, mobile, city, count,
        status, token, data_json
      )
      VALUES (?, ?, ?, ?, ?, ?, 'Registered', ?, ?)
    `).bind(now, formId, name, mobile, city, count, token, data_json).run();
    

    // رابط التأكيد (صفحتك confirm.html)
    const confirmUrl = new URL("/confirm.html", request.url);
    confirmUrl.searchParams.set("token", token);

    return json({
      ok: true,
      form: { id: form.id, name: form.name, slug: form.slug },
      token,
      confirmUrl: confirmUrl.toString(),
      message: "تم تسجيل طلبك بنجاح",
    });

  } catch (e) {
    return json({ ok: false, error: e.message || "خطأ غير متوقع" }, 500);
  }
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
