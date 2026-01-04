function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function decodeJwtEmail(request) {
  const jwt = request.headers.get("cf-access-jwt-assertion");
  if (!jwt) return { ok: false };

  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return { ok: false };

    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const claims = JSON.parse(atob(padded));

    const email = claims.email || claims.upn || claims.sub || null;
    const name =
      claims.name || claims.nickname || (email ? email.split("@")[0] : "User");

    return { ok: true, email, name, claims };
  } catch {
    return { ok: false };
  }
}

function slugify(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[\u0600-\u06FF]/g, "") // اختياري: يشيل العربي
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function onRequestPost({ request, env }) {
  const auth = decodeJwtEmail(request);
  if (!auth.ok || !auth.email) return json({ ok: false, error: "Unauthorized" }, 401);

  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    let slug = String(body.slug || "").trim();

    if (!name) return json({ ok: false, error: "NAME_REQUIRED" }, 400);

    if (!slug) slug = slugify(name);
    if (!slug) slug = "form-" + crypto.randomUUID().slice(0, 8);

    // ✅ منع تكرار الـ slug لنفس المالك
    const exists = await env.DB
      .prepare("SELECT id FROM forms WHERE owner_email = ? AND slug = ? LIMIT 1")
      .bind(auth.email, slug)
      .first();

    if (exists) return json({ ok: false, error: "SLUG_EXISTS" }, 409);

    const now = new Date().toISOString();

    // ✅ إدخال الفورم مع owner_email
    const ins = await env.DB
      .prepare(
        `INSERT INTO forms (name, slug, is_active, owner_email, created_at)
         VALUES (?, ?, 1, ?, ?)`
      )
      .bind(name, slug, auth.email, now)
      .run();

    const formId = ins?.meta?.last_row_id;

    // ✅ حقول افتراضية للفورم الجديد
    await env.DB.prepare(
      `INSERT INTO form_fields (form_id, label, field_type, required, options_json, sort_order, is_active, created_at)
       VALUES
       (?, 'الاسم',   'text',   1, '{"key":"name"}',   1, 1, ?),
       (?, 'الجوال',  'tel',    1, '{"key":"mobile"}', 2, 1, ?),
       (?, 'المدينة', 'text',   1, '{"key":"city"}',   3, 1, ?),
       (?, 'العدد',   'number', 1, '{"key":"count"}',  4, 1, ?)`
    ).bind(formId, now, formId, now, formId, now, formId, now).run();

    return json({
      ok: true,
      form: { id: formId, name, slug, owner_email: auth.email, is_active: 1 },
    });
  } catch (e) {
    return json({ ok: false, error: e.message || "SERVER_ERROR" }, 500);
  }
}
