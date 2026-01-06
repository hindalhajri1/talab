export async function onRequestPost({ request, env }) {
    try {
      const body = await request.json().catch(()=> ({}));
      const id = Number(body.id || 0);
      if(!id) return json({ ok:false, error:"ID_REQUIRED" }, 400);
  
      await env.DB.prepare(`
        UPDATE form_fields
        SET is_active = 0
        WHERE id = ?
      `).bind(id).run();
  
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
  