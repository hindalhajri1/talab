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

function slugKeyBase(s){
  return String(s||"field")
    .trim()
    .toLowerCase()
    .replace(/\s+/g,"_")
    .replace(/[^a-z0-9_]/g,"") || "field";
}

function uniqueKey(base){
  const stamp = Date.now().toString(36);
  return `${base}_${stamp}`;
}

function renderLibrary() {
  const root = $("#library");
  root.innerHTML = "";

  // Search (اختياري بسيط)
  const search = document.createElement("input");
  search.placeholder = "بحث عن حقل...";
  search.style.marginBottom = "10px";
  root.appendChild(search);

  const listWrap = document.createElement("div");
  root.appendChild(listWrap);

  function drawList(q=""){
    listWrap.innerHTML = "";
    const items = libraryItems().filter(it => it.label.includes(q) || it.type.includes(q));
    items.forEach((it) => {
      const btn = document.createElement("button");
      btn.className = "btn lib-item";
      btn.textContent = `+ ${it.label}`;
      btn.onclick = async () => {
        const base = slugKeyBase(it.key || it.type || "field");
        const autoKey = uniqueKey(base);

        const payload = {
          form_id: state.form_id,
          field: {
            field_key: autoKey,
            label: it.label || "سؤال جديد",
            type: it.type,
            required: 0,
            placeholder: it.placeholder || "",
            options: it.options || [],
            settings: {},
          },
        };

        await api("/api/fields-add", "POST", payload);
        await loadAll();
        renderAll();

        // حددي آخر عنصر (الجديد) وافتحي تعديل العنوان تلقائيًا
        setTimeout(() => {
          const last = document.querySelector("#canvas .field-item:last-child [data-edit-label]");
          last?.focus?.();
          last?.select?.();
        }, 50);
      };
      listWrap.appendChild(btn);
    });

    const hint = document.createElement("div");
    hint.className = "small muted";
    hint.style.marginTop = "10px";
    hint.textContent = "اضغطي + لإضافة سؤال مباشرة. ثم عدّلي العنوان من البطاقة.";
    listWrap.appendChild(hint);
  }

  drawList("");

  search.addEventListener("input", () => drawList(search.value.trim()));
}


function fieldKeyFromRow(row){
  try{
    const o = row.options_json ? JSON.parse(row.options_json) : null;
    return o?.key || "";
  }catch{ return ""; }
}

function parseOpt(row){
  try{ return row.options_json ? JSON.parse(row.options_json) : {}; }catch{ return {}; }
}

async function updateField(id, updates){
  await api("/api/fields-update", "POST", { id, updates });
}

function renderCanvas() {
  const root = $("#canvas");
  root.innerHTML = "";

  // زر + إضافة سؤال داخل الكانفس (Typeform vibe)
  const addBox = document.createElement("div");
  addBox.style.marginBottom = "10px";
  addBox.innerHTML = `<button class="btn primary" type="button" id="btnAddInCanvas">+ إضافة سؤال</button>`;
  root.appendChild(addBox);

  $("#btnAddInCanvas").onclick = () => {
    // يفتح تركيز البحث باليسار
    const inp = $("#library input");
    inp?.focus?.();
  };

  if (!state.fields.length) {
    const empty = document.createElement("div");
    empty.className = "small muted";
    empty.textContent = "لا توجد حقول بعد. أضيفي من اليسار.";
    root.appendChild(empty);
    return;
  }

  state.fields.forEach((f) => {
    const opt = parseOpt(f);
    const key = opt.key || "";

    const el = document.createElement("div");
    el.className = "field-item";
    el.draggable = true;

    el.innerHTML = `
      <div class="field-meta" style="flex:1;">
        <input data-edit-label value="${esc(f.label)}" style="font-weight:800; border:0; padding:6px 8px; background:#f8fafc;"/>
        <div class="small muted" style="margin-top:6px;">
          key: <b>${esc(key)}</b> • <span class="tag">${esc(f.field_type)}</span>
        </div>

        <div class="row" style="margin-top:10px;">
          <label style="margin:0;display:flex;gap:8px;align-items:center;">
            <input type="checkbox" data-required ${Number(f.required)===1 ? "checked":""} style="width:auto;"/>
            <span class="small">مطلوب</span>
          </label>
        </div>
      </div>

      <div class="row" style="align-items:flex-start;">
        <button class="btn danger" type="button" data-del>حذف</button>
      </div>
    `;

    // Inline label update
    const labelInp = el.querySelector("[data-edit-label]");
    labelInp.addEventListener("change", async () => {
      const v = labelInp.value.trim();
      if (!v) return;
      await updateField(f.id, { label: v });
      await loadAll();
      renderAll();
    });

    // required toggle
    const reqChk = el.querySelector("[data-required]");
    reqChk.addEventListener("change", async () => {
      await updateField(f.id, { required: reqChk.checked ? 1 : 0 });
      await loadAll();
      renderAll();
    });

    // delete
    el.querySelector("[data-del]").onclick = async (ev) => {
      ev.stopPropagation();
      if (!confirm("تأكيد حذف الحقل نهائيًا؟")) return;
      await api("/api/fields-delete", "POST", { id: f.id });
      await loadAll();
      renderAll();
    };

    // drag reorder (محلي)
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
