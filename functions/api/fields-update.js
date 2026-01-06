export async function onRequestPost({ request, env }) {
    try {
      const body = await request.json().catch(()=> ({}));
      const id = Number(body.id || 0);
      if(!id) return json({ ok:false, error:"ID_REQUIRED" }, 400);
  
      const label = String(body.label || "").trim();
      const field_type = String(body.field_type || "text").trim().toLowerCase();
      const required = Number(body.required || 0) ? 1 : 0;
      const options_json = (typeof body.options_json === "string") ? body.options_json : JSON.stringify(body.options_json || {});
  
      await env.DB.prepare(`
        UPDATE form_fields
        SET label = ?, field_type = ?, required = ?, options_json = ?
        WHERE id = ?
      `).bind(label, field_type, required, options_json, id).run();
  
      return json({ ok:true });
    } catch (e) {
      return json({ ok:false, error: e.message || "SERVER_ERROR" }, 500);
    }
  }
  
  function json(data, status=200){
    return new Response(JSON.stringify(data), {
      status,
      headers:{
        "content-type":"application/json; charset=utf-8",
        "cache-control":"no-store",
      }
    });
  }
  