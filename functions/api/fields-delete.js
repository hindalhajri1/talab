import { json, readJson } from "./_utils.js";

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const id = Number(body?.id);
  if (!id) return json({ ok: false, error: "BAD_REQUEST", hint: "id required" }, 400);

  const r = await env.DB.prepare(`DELETE FROM form_fields WHERE id = ?`).bind(id).run();
  return json({ ok: true, deleted: r.meta?.changes || 0 });
}
