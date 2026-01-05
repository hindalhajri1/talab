export async function onRequest(context) {
  const { request, env } = context;

  // CORS / Preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  // Allow only POST
  if (request.method !== "POST") {
    return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }

  // Read Cloudflare Access email (both variants)
  const h = request.headers;
  const email =
    h.get("cf-access-authenticated-user-email") ||
    h.get("Cf-Access-Authenticated-User-Email") ||
    h.get("CF-Access-Authenticated-User-Email");

  if (!email) {
    // مهم: هذا يوضح أن المشكلة من Access headers (وليس من JSON)
    return json(
      { ok: false, error: "UNAUTHORIZED", hint: "Missing Access email header" },
      401
    );
  }

  // Parse JSON body
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "BAD_JSON" }, 400);
  }

  const name = (body.name || "").trim();
  let slug = (body.slug || "").trim();

  if (!name) {
    return json({ ok: false, error: "NAME_REQUIRED" }, 400);
  }

  // Generate slug if empty
  if (!slug) slug = slugify(name);

  // Basic slug validation
  if (!/^[a-z0-9-]{1,80}$/i.test(slug)) {
    return json({ ok: false, error: "BAD_SLUG" }, 400);
  }

  // Insert to D1
  try {
    // تأكدي أن جدول forms عندك يحتوي owner_email NOT NULL
    // وأن الأعمدة: name, slug, owner_email, is_active, created_at
    const now = new Date().toISOString();

    // Check slug exists for same owner
    const exists = await env.DB
      .prepare("SELECT id FROM forms WHERE owner_email = ? AND slug = ? LIMIT 1")
      .bind(email, slug)
      .first();

    if (exists?.id) {
      return json({ ok: false, error: "SLUG_EXISTS" }, 409);
    }

    const res = await env.DB
      .prepare(
        "INSERT INTO forms (name, slug, owner_email, is_active, created_at) VALUES (?, ?, ?, 1, ?)"
      )
      .bind(name, slug, email, now)
      .run();

    // D1 returns last_row_id
    const id = res.meta?.last_row_id;

    return json({
      ok: true,
      form: { id, name, slug, owner_email: email, is_active: 1, created_at: now },
    });
  } catch (e) {
    return json(
      { ok: false, error: "D1_ERROR", message: String(e?.message || e) },
      500
    );
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type, accept",
  };
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 80);
}
