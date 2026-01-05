export async function onRequestPost({ request, env }) {
  // 1) لازم JWT من Cloudflare Access
  const jwt = request.headers.get("cf-access-jwt-assertion");
  if (!jwt) return json({ ok: false, error: "UNAUTHORIZED", hint: "Missing Access JWT" }, 401);

  // 2) استخراج الإيميل من JWT
  let email = null;
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) throw new Error("Invalid JWT");

    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const claims = JSON.parse(atob(padded));

    email = claims.email || claims.upn || claims.sub || null;
  } catch (e) {
    return json({ ok: false, error: "BAD_TOKEN" }, 400);
  }

  if (!email) return json({ ok: false, error: "UNAUTHORIZED", hint: "Missing email in JWT" }, 401);

  // 3) قراءة Body
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

  // 4) تأكد إن الفورم ملك نفس المالك
  const check = await env.DB
    .prepare(`SELECT id, owner_email FROM forms WHERE id = ?`)
    .bind(id)
    .first();

  if (!check) return json({ ok: false, error: "NOT_FOUND" }, 404);
  if (String(check.owner_email || "").toLowerCase() !== String(email).toLowerCase()) {
    return json({ ok: false, error: "FORBIDDEN" }, 403);
  }

  // 5) حذف آمن داخل Transaction
  // ملاحظة: D1 يدعم batch، و BEGIN/COMMIT تمشي غالباً.
  // إذا بيئتك ما تدعم BEGIN/COMMIT، احذفيهم وسيظل الحذف يعمل.
  try {
    const statements = [
      env.DB.prepare("BEGIN"),

      // ✅ احذفي الحقول التابعة للفورم
      env.DB.prepare(`DELETE FROM form_fields WHERE form_id = ?`).bind(id),

      // ✅ (اختياري) احذفي الطلبات التابعة للفورم
      // إذا تبين تخلي الطلبات محفوظة، علّقي السطر هذا
      env.DB.prepare(`DELETE FROM requests WHERE form_id = ?`).bind(id),

      // ✅ احذفي الفورم نفسه
      env.DB.prepare(`DELETE FROM forms WHERE id = ? AND owner_email = ?`).bind(id, email),

      env.DB.prepare("COMMIT"),
    ];

    await env.DB.batch(statements);

    return json({ ok: true, deleted_id: id });
  } catch (e) {
    // rollback احتياطي
    try { await env.DB.prepare("ROLLBACK").run(); } catch {}
    return json({ ok: false, error: "DB_ERROR", message: e.message || String(e) }, 500);
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
