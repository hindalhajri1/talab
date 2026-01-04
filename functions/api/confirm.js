export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response("رمز غير صالح", { status: 400 });
  }

  // تحديث الحالة في قاعدة البيانات
  const result = await env.DB.prepare(`
    UPDATE requests
    SET status = 'Confirmed',
        confirmed_at = datetime('now')
    WHERE token = ? AND status != 'Confirmed'
  `).bind(token).run();

  if (result.changes === 0) {
    return new Response("تم التأكيد مسبقًا أو الرابط غير صحيح", {
      status: 404,
    });
  }

  return new Response(
    JSON.stringify({ ok: true }),
    { headers: { "content-type": "application/json; charset=utf-8" } }
  );
}
