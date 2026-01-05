export async function onRequestPost({ request, env }) {
  const jwt = request.headers.get("cf-access-jwt-assertion");
  if (!jwt) return json({ ok: false, error: "UNAUTHORIZED", hint: "Missing Access JWT" }, 401);

  let email = null;
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) throw new Error("Invalid JWT");

    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const claims = JSON.parse(atob(padded));

    email = claims.email || claims.upn || claims.sub || null;
  } catch (e) {
    return json({ ok: false, error: "BAD_TOKEN", message: e.message || String(e) }, 400);
  }

  if (!email) return json({ ok: false, error: "UNAUTHORIZED", hint: "Missing email in JWT" }, 401);

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "BAD_JSON" }, 400);
  }

  const id = Number(body.id);
  if (!Number.isFinite(id) || id <= 0) {
    return json({ ok: false, error: "ID_REQUIRED" }, 400);
  }

  // تأكد الفورم موجود ومملوك لنفس الإيميل
  const form = await env.DB
    .prepare(`SELECT id, owner_email FROM forms WHERE id = ?`)
    .bind(id)
    .first();

  if (!form) return json({ ok: false, error: "NOT_FOUND" }, 404);
  if (String(form.owner_email || "").toLowerCase() !== String(email).toLowerCase()) {
    return json({ ok: false, error: "FORBIDDEN" }, 403);
  }

  try {
    // 1) حذف الحقول التابعة
    await env.DB.prepare(`DELETE FROM form_fields WHERE form_id = ?`).bind(id).run();

    // 2) حذف الطلبات التابعة (إذا تبين تبقيها، احذفي هذا السطر)
    await env.DB.prepare(`DELETE FROM requests WHERE form_id = ?`).bind(id).run();

    // 3) حذف الفورم نفسه
    const del = await env.DB
      .prepare(`DELETE FROM forms WHERE id = ? AND owner_email = ?`)
      .bind(id, email)
      .run();

    // D1 يرجع meta غالباً
    const changes = del?.meta?.changes ?? null;

    if (changes === 0) {
      return json({ ok: false, error: "NOT_DELETED", hint: "No rows deleted (unexpected)" }, 409);
    }

    return json({ ok: true, deleted_id: id, changes });
  } catch (e) {
    return json(
      { ok: false, error: "DB_ERROR", message: e.message || String(e) },
      500
    );
  }
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
