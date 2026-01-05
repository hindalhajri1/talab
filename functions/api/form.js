export async function onRequestGet({ request, env }) {
  try {
    // Cloudflare Access يضيف هيدر ايميل المستخدم
    const email =
      request.headers.get("Cf-Access-Authenticated-User-Email") ||
      request.headers.get("cf-access-authenticated-user-email") ||
      "";

    if (!email) {
      return json({ ok: false, error: "UNAUTHORIZED" }, 401);
    }

    const { results } = await env.DB
      .prepare(
        `SELECT id, name, slug, is_active, created_at
         FROM forms
         WHERE owner_email = ?
         ORDER BY id DESC`
      )
      .bind(email)
      .all();

    return json({ ok: true, forms: results || [] });
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
      "Access-Control-Allow-Origin": "*",
    },
  });
}
