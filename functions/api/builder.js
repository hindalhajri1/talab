const $ = (s) => document.querySelector(s);

const state = {
  form_id: null,
  form: null,
  fields: [],
  selectedId: null,
  draggingId: null,
};

function getFormId() {
  const url = new URL(location.href);
  const id = Number(url.searchParams.get("form_id"));
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function api(url, method = "GET", body) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json", "Accept":"application/json" } : { "Accept":"application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data?.hint || data?.error || `HTTP ${res.status}`);
  }
  return data;
}

function esc(s){ return String(s||"").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])); }

function libraryItems() {
  return [
    { label: "الاسم", type: "text", key: "name", placeholder: "اكتب الاسم" },
    { label: "رقم الجوال", type: "tel", key: "mobile", placeholder: "05xxxxxxxx" },
    { label: "المدينة", type: "text", key: "city", placeholder: "مثال: الدمام" },
    { label: "العدد", type: "number", key: "count", placeholder: "1" },
    { label: "ملاحظات", type: "textarea", key: "notes", placeholder: "..." },
    { label: "قائمة (Select)", type: "select", key: "select_field", options: ["خيار 1","خيار 2"] },
  ];
}

function renderLibrary() {
  const root = $("#library");
  root.innerHTML = "";

  libraryItems().forEach((it) => {
    const btn = document.createElement("button");
    btn.className = "btn lib-item";
    btn.textContent = `+ ${it.label}`;
    btn.onclick = async () => {
      const key = prompt("اكتبي key (بالانجليزي) مثل: name / mobile", it.key);
      if (!key) return;

      const label = prompt("اكتبي Label بالعربي", it.label);
      if (!label) return;

      const required = confirm("هل الحقل مطلوب؟");

      const payload = {
        form_id: state.form_id,
        field: {
          field_key: key,
          label,
          type: it.type,
          required: required ? 1 : 0,
          placeholder: it.placeholder || "",
          options: it.options || [],
          settings: {},
        },
      };

      await api("/api/fields-add", "POST", payload);
      await loadAll();
      renderAll();
    };
    root.appendChild(btn);
  });

  const hint = document.createElement("div");
  hint.className = "small muted";
  hint.style.marginTop = "10px";
  hint.textContent = "اضغطي + لإضافة حقل، ثم رتّبيه من الوسط.";
  root.appendChild(hint);
}

function fieldKeyFromRow(row){
  try{
    const o = row.options_json ? JSON.parse(row.options_json) : null;
    return o?.key || "";
  }catch{ return ""; }
}

function renderCanvas() {
  const root = $("#canvas");
  root.innerHTML = "";

  if (!state.fields.length) {
    root.innerHTML = `<div class="small muted">لا توجد حقول بعد. أضيفي من اليمين (الحقول الجاهزة).</div>`;
    return;
  }

  state.fields.forEach((f) => {
    const key = fieldKeyFromRow(f);
    const el = document.createElement("div");
    el.className = "field-item";
    el.draggable = true;

    el.innerHTML = `
      <div class="field-meta">
        <div style="font-weight:700;">${esc(f.label)} ${Number(f.required)===1 ? '<span class="muted">*</span>' : ""}</div>
        <div class="small muted">key: <b>${esc(key)}</b> • <span class="tag">${esc(f.field_type)}</span></div>
      </div>
      <div class="row">
        <button class="btn danger" type="button">حذف</button>
      </div>
    `;

    el.querySelector(".btn.danger").onclick = async (ev) => {
      ev.stopPropagation();
      if (!confirm("تأكيد حذف الحقل نهائيًا؟")) return;
      await api("/api/fields-delete", "POST", { id: f.id });
      await loadAll();
      renderAll();
    };

    // Drag reorder (محلي)
    el.addEventListener("dragstart", () => { state.draggingId = f.id; el.classList.add("dragging"); });
    el.addEventListener("dragend", () => { state.draggingId = null; el.classList.remove("dragging"); });
    el.addEventListener("dragover", (e) => e.preventDefault());
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      const fromId = state.draggingId;
      const toId = f.id;
      if (!fromId || fromId === toId) return;
      reorderLocal(fromId, toId);
      renderAll();
    });

    root.appendChild(el);
  });
}

function reorderLocal(fromId, toId) {
  const arr = [...state.fields];
  const fromIdx = arr.findIndex(x => x.id === fromId);
  const toIdx = arr.findIndex(x => x.id === toId);
  if (fromIdx < 0 || toIdx < 0) return;
  const [moved] = arr.splice(fromIdx, 1);
  arr.splice(toIdx, 0, moved);
  state.fields = arr;
}

async function saveOrder(){
  const ordered_ids = state.fields.map(x => x.id);
  await api("/api/fields-reorder", "POST", { form_id: state.form_id, ordered_ids });
  alert("تم حفظ الترتيب ✅");
}

async function loadAll() {
  const r = await api(`/api/form?form_id=${state.form_id}&t=${Date.now()}`);
  state.form = r.form;
  // ملاحظة: /api/form يرجع fields بصيغة rows
  state.fields = r.fields || [];
  $("#formTitle").textContent = `${state.form?.name || "محرر النموذج"} (ID: ${state.form_id})`;
}

function renderAll(){
  renderLibrary();
  renderCanvas();
  // props مو ضروري الآن (نضيفه لاحقًا)
  $("#props").innerHTML = `<div class="small muted">حالياً: إضافة/حذف/ترتيب. (بنضيف تعديل الخصائص بعد ما نتأكد الإضافة شغالة)</div>`;
}

async function init(){
  state.form_id = getFormId();
  if (!state.form_id) { alert("لازم form_id في الرابط"); return; }

  $("#btnReload").onclick = async () => { await loadAll(); renderAll(); };
  $("#btnSaveOrder").onclick = async () => { await saveOrder(); };

  await loadAll();
  renderAll();
}

init().catch(e => { console.error(e); alert("خطأ: " + (e.message || e)); });
