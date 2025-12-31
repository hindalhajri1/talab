export async function onRequestGet({ request, env }) {
    const url = new URL(request.url);
    const token = (url.searchParams.get("token") || "").trim();
    if (!token) return json({ ok: false, error: "Token مفقود" }, 400);
  
    const now = new Date().toISOString();
  
    const result = await env.DB.prepare(
      `UPDATE requests
       SET status='Received', confirmed_at=?
       WHERE token=? AND (confirmed_at IS NULL OR confirmed_at='')`
    ).bind(now, token).run();
  
    if (result.meta.changes === 0) {
      return json({ ok: false, error: "الرابط غير صالح أو تم التأكيد مسبقًا" }, 404);
    }
  
    return json({ ok: true, message: "تم تأكيد الاستلام بنجاح" });
  }
  
  function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
  