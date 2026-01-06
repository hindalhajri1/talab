export async function onRequestGet({ request, env }) {
    try {
      const url = new URL(request.url);
      const formId = Number(url.searchParams.get("form_id") || 0);
      if (!formId) return json({ ok:false, error:"FORM_ID_REQUIRED" }, 400);
  
      const res = await env.DB.prepare(`
        SELECT id, form_id, label, field_type, required, options_json, sort_order, is_active
        FROM form_fields
        WHERE form_id = ? AND is_active = 1
        ORDER BY sort_order ASC, id ASC
      `).bind(formId).all();
  
      return json({ ok:true, rows: res.results || [] });
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
  