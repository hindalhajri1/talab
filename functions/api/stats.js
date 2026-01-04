export async function onRequestGet({ env }) {
  const db = env.DB;

  // Cards
  const total = await db.prepare(`SELECT COUNT(*) AS n FROM requests`).first();

  const confirmed = await db.prepare(`
    SELECT COUNT(*) AS n FROM requests
    WHERE lower(status) IN ('confirmed','received')
  `).first();

  const canceled = await db.prepare(`
    SELECT COUNT(*) AS n FROM requests
    WHERE lower(status) IN ('canceled','cancelled')
  `).first();

  const pending = await db.prepare(`
    SELECT COUNT(*) AS n FROM requests
    WHERE lower(status) NOT IN ('confirmed','received','canceled','cancelled')
  `).first();

  // By city
  const byCity = await db.prepare(`
    SELECT
      city,
      COUNT(*) AS total,
      SUM(CASE WHEN lower(status) IN ('confirmed','received') THEN 1 ELSE 0 END) AS confirmed,
      SUM(CASE WHEN lower(status) IN ('canceled','cancelled') THEN 1 ELSE 0 END) AS canceled,
      SUM(CASE WHEN lower(status) NOT IN ('confirmed','received','canceled','cancelled') THEN 1 ELSE 0 END) AS pending
    FROM requests
    GROUP BY city
    ORDER BY total DESC
  `).all();

  // Latest
  const latest = await db.prepare(`
    SELECT id, name, city, status, created_at, mobile, token
    FROM requests
    ORDER BY datetime(created_at) DESC
    LIMIT 20
  `).all();

  return new Response(
    JSON.stringify({
      cards: {
        total: total?.n || 0,
        confirmed: confirmed?.n || 0,
        canceled: canceled?.n || 0,
        pending: pending?.n || 0,
      },
      byCity: byCity.results || [],
      latest: latest.results || [],
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    }
  );
}
