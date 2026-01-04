function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const token = (url.searchParams.get("token") || "").trim();
    if (!token) return json({ ok: false, error: "TOKEN_MISSING" }, 400);

    const db = env.talab_db; // ✅ عدّليها إذا Binding اسمها DB

    const row = await db
      .prepare(`SELECT id, name, status, decision, decided_at FROM requests WHERE token = ? LIMIT 1`)
      .bind(token)
      .first();

    if (!row) return json({ ok: false, error: "NOT_FOUND" }, 404);

    // decision: null | "CONFIRMED" | "CANCELLED"
    return json({
      ok: true,
      data: {
        id: row.id,
        name: row.name,
        decision: row.decision || null,
        decided_at: row.decided_at || null,
        status: row.status || null,
      },
    });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = (body.token || "").trim();
    const action = (body.action || "").trim(); // "confirm" | "cancel"

    if (!token) return json({ ok: false, error: "TOKEN_MISSING" }, 400);
    if (!["confirm", "cancel"].includes(action)) {
      return json({ ok: false, error: "INVALID_ACTION" }, 400);
    }

    const db = env.talab_db; // ✅ عدّليها إذا Binding اسمها DB

    const row = await db
      .prepare(`SELECT id, decision FROM requests WHERE token = ? LIMIT 1`)
      .bind(token)
      .first();

    if (!row) return json({ ok: false, error: "NOT_FOUND" }, 404);

    // ✅ قفل القرار: إذا سبق اتخاذ قرار ممنوع تغييره
    if (row.decision) {
      return json({ ok: false, error: "ALREADY_DECIDED", decision: row.decision }, 409);
    }

    const decision = action === "confirm" ? "CONFIRMED" : "CANCELLED";
    const newStatus = action === "confirm" ? "Confirmed" : "Cancelled";

    await db
      .prepare(`
        UPDATE requests
        SET decision = ?, status = ?, decided_at = datetime('now')
        WHERE token = ? AND (decision IS NULL OR decision = '')
      `)
      .bind(decision, newStatus, token)
      .run();

    return json({ ok: true, decision });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}
