import { json, readJson } from "./_utils.js";

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const form_id = Number(body?.form_id);
  const ordered_ids = body?.ordered_ids;

  if (!form_id || !Array.isArray(ordered_ids)) {
    return json({ ok: false, error: "BAD_REQUEST", hint: "form_id and ordered_ids required" }, 400);
  }

  const stmts = [];
  let order = 1;
  for (const raw of ordered_ids) {
    const id = Number(raw);
    if (!id) continue;
    stmts.push(env.DB.prepare(`UPDATE form_fields SET sort_order = ? WHERE id = ? AND form_id = ?`)
      .bind(order, id, form_id));
    order += 1;
  }

  await env.DB.batch(stmts);
  return json({ ok: true });
}
