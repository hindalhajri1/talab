export async function onRequestGet({ request, env }) {
    // 1️⃣ نتحقق أن الطلب جاي من Cloudflare Access
    const email = request.headers.get("Cf-Access-Authenticated-User-Email");
  
    if (!email) {
      return new Response("Unauthorized", { status: 401 });
    }
  
    // 2️⃣ استعلام إحصائيات عامة (حالياً بدون تقسيم عملاء)
    const total = await env.DB
      .prepare("SELECT COUNT(*) as c FROM requests")
      .first();
  
    const received = await env.DB
      .prepare("SELECT COUNT(*) as c FROM requests WHERE status = 'received'")
      .first();
  
    const pending = await env.DB
      .prepare("SELECT COUNT(*) as c FROM requests WHERE status != 'received'")
      .first();
  
    return new Response(
      JSON.stringify({
        ok: true,
        user: email,
        total: total.c,
        received: received.c,
        pending: pending.c
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
  