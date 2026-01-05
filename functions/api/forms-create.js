// functions/api/forms-create.js

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getAccessEmail(request) {
  // Cloudflare Access identity headers (قد تختلف حسب الإعداد)
  const candidates = [
    "cf-access-authenticated-user-email",
    "Cf-Access-Authenticated-User-Email",
    "CF-Access-Authenticated-User-Email",
    "x-forwarded-email",
    "X-Forwarded-Email",
  ];

  for (const k of candidates) {
    const v = request.headers.get(k);
    if (v && String(v).trim()) return String(v).trim();
  }

  // Fallback: JWT assertion header
  const jwt =
    request.headers.get("cf-access-jwt-assertion") ||
    request.headers.get("Cf-Access-Jwt-Assertion") ||
    request.headers.get("CF-Access-Jwt-Assertion");

  if (jwt) {
    const email = getEmailFromJwt(jwt);
    if (email) return email;
  }

  return "";
}

function getEmailFromJwt(jwt) {
  try {
    const parts = String(jwt).split(".");
    if (parts.length < 2) return "";
    const payload = parts[1];

    // base64url decode
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((payload.length + 3) % 4);
    const jsonStr = atob(b64);
    const obj = JSON.parse(jsonStr);

    // غالباً claim اسمها email
    return (obj.email || obj.user_email || "").trim();
  } catch {
    return "";
  }
}

function slugify(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\u0600-\u06FF]+/g, "-") // يسمح بالعربي والإنجليزي والأرقام
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function onRequestPost({ request, env }) {
  // لازم يكون عندك D1 binding اسمه DB
  const DB = env.DB;
  if (!DB) return json({ ok: false, error: "SERVER_MISCONFIG", hint: "Missing D1 binding: env.DB" }, 500);

  const email = getAccessEmail(request);

  // ✅ وضع تشخيص سريع: لو تضيفي ?debug=1 بيرجع لك الإيميل والـ headers المهمة
  const url = new URL(request.url);
  if (url.searchParams.get("debug") === "1") {
    return json({
      ok: true,
      email: email || null,
      hasEmailHeader: !!(
        request.headers.get("cf-access-authenticated-user-email") ||
        request.headers.get("Cf-Access-Authenticated-User-Email") ||
        request.headers.get("CF-Access-Authenticated-User-Email")
      ),
      hasJwt: !!(
        request.headers.get("cf-access-jwt-assertion") ||
        request.headers.get("Cf-Access-Jwt-Assertion") ||
        request.headers.get("CF-Access-Jwt-Assertion")
      ),
    });
  }

  if (!email) {
    return json(
      { ok: false, error: "UNAUTHORIZED", hint: "Missing Access identity (email/JWT). Check Cloudflare Access path for /api/forms-create" },
      401
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "BAD_JSON" }, 400);
  }

  const name = String(body.name || "").trim();
  let slug = String(body.slug || "").trim();

  if (!name) return json({ ok: false, error: "NAME_REQUIRED" }, 400);

  if (!slug) slug = slugify(name);
  else slug = slugify(slug);

  if (!slug) return json({ ok: false, error: "SLUG_INVALID" }, 400);

  // تحقق slug موجود مسبقاً لنفس المالك
  const exists = await DB.prepare(
    "SELECT id FROM forms WHERE owner_email = ? AND slug = ? LIMIT 1"
  )
    .bind(email, slug)
    .first();

  if (exists?.id) return json({ ok: false, error: "SLUG_EXISTS" }, 409);

  // إدخال
  const createdAt = new Date().toISOString();
  const result = await DB.prepare(
    "INSERT INTO forms (name, slug, owner_email, is_active, created_at) VALUES (?, ?, ?, 1, ?)"
  )
    .bind(name, slug, email, createdAt)
    .run();

  const id = result?.meta?.last_row_id;

  return json({
    ok: true,
    form: { id, name, slug, owner_email: email, is_active: 1, created_at: createdAt },
  });
}
