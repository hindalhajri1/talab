function getJwt(request) {
  return request.headers.get("cf-access-jwt-assertion");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function slugify(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[\u0600-\u06FF]/g, "") // يشيل العربي من slug (اختياري)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function onRequestPost({ request, env }) {
  // ✅ Cloudflare Access check
  const jwt = getJwt(request);
  if (!jwt) return json({ ok: false, error: "Unauthorized" }, 401);

  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    let slug = String(body.slug || "").trim();

    if (!name) return json({ ok: false, error: "NAME_REQUIRED" }, 400);

    if (!slug) slug = slugify(name);
    if (!slug) slug = "form-" + crypto.randomUUID().slice(0, 8);

    // ✅ منع التكرار
    const exists = await env.DB
      .prepare("SELECT id FROM forms WHERE slug = ? LIMIT 1")
      .bind(slug)
      .first();

    if (exists) return json({ ok: false, error: "SLUG_EXISTS" }, 409);

    const now = new Date().toISOString();

    const res = await env.DB
      .prepare(
        `INSERT INTO forms (name, slug, is_active, created_at)
         VALUES (?, ?, 1, ?)`
      )
      .bind(name, slug, now)
      .run();

    const id = res?.meta?.last_row_id;

    // ✅ إنشاء حقول افتراضية للفورم الجديد
    await env.DB.prepare(
      `INSERT INTO form_fields (form_id, label, field_type, required, options_json, sort_order, is_active, created_at)
       VALUES
       (?, 'الاسم',   'text',   1, '{"key":"name"}',   1, 1, ?),
       (?, 'الجوال',  'tel',    1, '{"key":"mobile"}', 2, 1, ?),
       (?, 'المدينة', 'text',   1, '{"key":"city"}',   3, 1, ?),
       (?, 'العدد',   'number', 1, '{"key":"count"}',  4, 1, ?)`
    ).bind(id, now, id, now, id, now, id, now).run();

    return json({
      ok: true,
      form: { id, name, slug, is_active: 1 }
    });

  } catch (e) {
    return json({ ok: false, error: e.message || "SERVER_ERROR" }, 500);
  }
}
