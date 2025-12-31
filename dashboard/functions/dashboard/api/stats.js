export async function onRequestGet({ request, env }) {
  // Cloudflare Access عادة يمنع قبل يوصل هنا، بس نخلي تحقق إضافي
  const jwt = request.headers.get("cf-access-jwt-assertion");
  if (!jwt) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  // لاحقًا نربطها بـ D1
  return new Response(JSON.stringify({ ok: true, total: 1 }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
