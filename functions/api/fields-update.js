import { json, readJson, normalizeKey, safeParse, safeStringify } from "./_utils.js";

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const id = Number(body?.id);
  const updates = body?.updates;

  if (!id || !updates) return json({ ok: false, error: "BAD_REQUEST", hint: "id and updates required" }, 400);

  const current = await env.DB.prepare(`SELECT id, options_json FROM form_fields WHERE id = ?`).bind(id).first();
  if (!current) return json({ ok: false, error: "NOT_FOUND" }, 404);

  const setParts = [];
  const params = [];

  if (updates.label != null) { setParts.push("label = ?"); params.push(String(updates.label).trim()); }
  if (updates.type != null || updates.field_type != null) {
    setParts.push("field_type = ?");
    params.push(String(updates.type || updates.field_type).trim());
  }
  if (updates.required != null) { setParts.push("required = ?"); params.push(updates.required ? 1 : 0); }

  // options_json update (merge)
  const opt = safeParse(current.options_json, {});
  if (updates.field_key != null || updates.key != null) opt.key = normalizeKey(updates.field_key || updates.key);
  if (updates.placeholder != null) opt.placeholder = updates.placeholder || "";
  if (updates.options != null) opt.options = Array.isArray(updates.options) ? updates.options : [];
  if (updates.settings != null) opt.settings = (updates.settings && typeof updates.settings === "object") ? updates.settings : {};

  setParts.push("options_json = ?");
  params.push(safeStringify(opt));

  if (setParts.length === 0) return json({ ok: false, error: "BAD_REQUEST", hint: "no valid updates" }, 400);

  try {
    await env.DB.prepare(`UPDATE form_fields SET ${setParts.join(", ")} WHERE id = ?`)
      .bind(...params, id).run();
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: "DB_ERROR", hint: String(e?.message || e) }, 400);
  }
}
