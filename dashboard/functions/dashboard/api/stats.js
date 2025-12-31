export async function onRequest(context) {
  const { env } = context;
  const db = env.DB; // ✔️ binding الصحيح

  const totalRes = await db.prepare(
    `SELECT COUNT(*) as total FROM requests`
  ).first();

  const confirmedRes = await db.prepare(
    `SELECT COUNT(*) as confirmed FROM requests WHERE confirmed_at IS NOT NULL`
  ).first();

  const pendingRes = await db.prepare(
    `SELECT COUNT(*) as pending FROM requests WHERE confirmed_at IS NULL`
  ).first();

  const byCityRes = await db.prepare(`
    SELECT
      city,
      COUNT(*) as total,
      SUM(CASE WHEN confirmed_at IS NOT NULL THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN confirmed_at IS NULL THEN 1 ELSE 0 END) as pending
    FROM requests
    GROUP BY city
  `).all();

  const latestRes = await db.prepare(`
    SELECT id, name, city, status, created_at
    FROM requests
    ORDER BY created_at DESC
    LIMIT 10
  `).all();

  return new Response(
    JSON.stringify({
      cards: {
        total: totalRes.total,
        confirmed: confirmedRes.confirmed,
        pending: pendingRes.pending,
      },
      byCity: byCityRes.results,
      latest: latestRes.results,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
