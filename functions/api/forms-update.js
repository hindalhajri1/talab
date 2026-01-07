import { json, readJson } from "./_utils.js";

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const id = Number(body?.id);
  const updates = body?.updates || {};

  if (!id) {
    return json({ ok: false, error: "BAD_REQUEST", hint: "id required" }, 400);
  }

  const set = [];
  const params = [];

  if (updates.name != null) {
    set.push("name = ?");
    params.push(String(updates.name).trim());
  }

  if (updates.slug != null) {
    set.push("slug = ?");
    params.push(String(updates.slug).trim());
  }

  if (!set.length) {
    return json({ ok: false, error: "NO_UPDATES" }, 400);
  }

  try {
    await env.DB
      .prepare(`UPDATE forms SET ${set.join(", ")} WHERE id = ?`)
      .bind(...params, id)
      .run();

    return json({ ok: true });
  } catch (e) {
    return json({
      ok: false,
      error: "DB_ERROR",
      hint: String(e?.message || e),
    }, 500);
  }
}
