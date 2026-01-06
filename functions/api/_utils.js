export function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
  
  export async function readJson(request) {
    try {
      return await request.json();
    } catch {
      return null;
    }
  }
  
  export function normalizeKey(key) {
    return String(key || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
  }
  
  export function safeParse(str, fallback) {
    if (!str) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
  }
  
  export function safeStringify(v) {
    return v == null ? null : JSON.stringify(v);
  }
  