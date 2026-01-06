export async function onRequestPost({ request, env }) {
    try {
      const body = await request.json().catch(()=> ({}));
      const formId = Number(body.form_id || 0);
      const ids = Array.isArray(body.ordered_ids) ? body.ordered_ids.map(Number).filter(Boolean) : [];
      if(!formId) return json({ ok:false, error:"FORM_ID_REQUIRED" }, 400);
      if(!ids.length) return json({ ok:false, error:"ORDER_REQUIRED" }, 400);
  
      // Transaction-like (D1 ما يدعم transaction حقيقي بنفس مفهوم SQL التقليدي، لكن هذا كافي عادة)
      let sort = 1;
      for(const id of ids){
        await env.DB.prepare(`
          UPDATE form_fields
          SET sort_order = ?
          WHERE id = ? AND form_id = ?
        `).bind(sort, id, formId).run();
        sort++;
      }
  
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
  