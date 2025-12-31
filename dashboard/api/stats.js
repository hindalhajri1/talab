export async function onRequestGet({ request, env }) {
  // إذا ما كان فيه Access session، عادةً Cloudflare Access نفسه يمنع الوصول قبل ما يوصل هنا
  // لكن نخليها حماية إضافية: نتأكد من وجود JWT Assertion header
  const jwt = request.headers.get("cf-access-jwt-assertion");
  if (!jwt) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  // مثال: ارجاع إحصائيات (بدليه باستعلامات D1 عندك)
  // لو عندك D1 binding اسمه DB:
  // const { results } = await env.DB.prepare("SELECT ...").all();

  return new Response(
    JSON.stringify({
      ok: true,
      // ضع بياناتك الحقيقية هنا
      total: 123,
      confirmed: 10,
    }),
    {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    }
  );
}
