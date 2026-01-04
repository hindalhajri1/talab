export async function onRequestGet({ env }) {
  try {
    // ✅ مهم: اسم الـ binding هنا لازم يطابق اللي حطيتيه في D1 binding داخل Cloudflare Pages
    // إذا اسم البايندنق عندك "talab_db" خليه env.talab_db
    // إذا اسم البايندنق عندك "DB" خليه env.DB
    const db = env.DB; // <-- عدّليها لو اسم البايندنق مختلف

    const totalRow = await db.prepare(`
      SELECT COUNT(*) AS n FROM requests
    `).first();

    const confirmedRow = await db.prepare(`
      SELECT COUNT(*) AS n FROM requests
      WHERE lower(status) IN ('confirmed','received')
    `).first();

    const pendingRow = await db.prepare(`
      SELECT COUNT(*) AS n FROM requests
      WHERE lower(status) NOT IN ('confirmed','received')
    `).first();

    const byCity = await db.prepare(`
      SELECT
        city,
        COUNT(*) AS total,
        SUM(CASE WHEN lower(status) IN ('confirmed','received') THEN 1 ELSE 0 END) AS confirmed,
        SUM(CASE WHEN lower(status) NOT IN ('confirmed','received') THEN 1 ELSE 0 END) AS pending
      FROM requests
      GROUP BY city
      ORDER BY total DESC
    `).all();

    const totalRow = await env.DB.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status='Confirmed' THEN 1 ELSE 0 END) AS confirmed,
        SUM(CASE WHEN status='Cancelled' THEN 1 ELSE 0 END) AS cancelled,
        SUM(CASE WHEN status='Registered' THEN 1 ELSE 0 END) AS pending
      FROM requests
    `).first();
    

    return new Response(JSON.stringify({
      cards: {
        total: totalRow?.n ?? 0,
        confirmed: confirmedRow?.n ?? 0,
        pending: pendingRow?.n ?? 0
      },
      byCity: byCity.results || [],
      latest: latest.results || []
    }), {
      headers: { "content-type": "application/json; charset=utf-8" }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }
}
