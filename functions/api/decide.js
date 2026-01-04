export async function onRequestPost({ request, env }) {
    try {
      const { token, action } = await request.json();
  
      if (!token || !["confirm", "cancel"].includes(action)) {
        return json({ error: "Bad request" }, 400);
      }
  
      // 1) نجيب الطلب
      const row = await env.DB
        .prepare(`SELECT id, status, decision FROM requests WHERE token = ? LIMIT 1`)
        .bind(token)
        .first();
  
      if (!row) return json({ error: "Not found" }, 404);
  
      // 2) إذا تم اتخاذ قرار سابقًا، لا نسمح بالتغيير
      if (row.decision) {
        return json({ error: "Already decided", decision: row.decision }, 409);
      }
  
      const now = new Date().toISOString();
  
      if (action === "confirm") {
        await env.DB.prepare(`
          UPDATE requests
          SET status = 'Confirmed',
              confirmed_at = ?,
              decided_at = ?,
              decision = 'confirmed'
          WHERE token = ? AND decision IS NULL
        `).bind(now, now, token).run();
  
        return json({ ok: true, decision: "confirmed" }, 200);
      }
  
      // cancel
      await env.DB.prepare(`
        UPDATE requests
        SET status = 'Cancelled',
            decided_at = ?,
            decision = 'cancelled'
        WHERE token = ? AND decision IS NULL
      `).bind(now, token).run();
  
      return json({ ok: true, decision: "cancelled" }, 200);
    } catch (e) {
      return json({ error: String(e) }, 500);
    }
  }
  
  function json(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
          });
  }
  