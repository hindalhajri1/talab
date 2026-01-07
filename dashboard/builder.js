const $ = (s) => document.querySelector(s);
function setToast(msg){
  const t = document.getElementById("toast");
  if(!t) return;
  t.textContent = msg || "تم";
  t.style.opacity = "1";
  setTimeout(()=> t.style.opacity="0", 900);
}

function isMobileUI(){
  return window.matchMedia("(max-width: 860px)").matches;
}

function bindTabs(){
  const tabs = document.querySelectorAll(".tabbtn");
  tabs.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      tabs.forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const id = btn.getAttribute("data-tab");
      document.querySelectorAll(".tabpane").forEach(p=>p.classList.remove("active"));
      document.getElementById(id)?.classList.add("active");
    });
  });
}

const state = {
  form_id: null,
  form: null,
  fields: [],
  selectedId: null,
  draggingId: null,
  reorderTimer: null,
};

function getFormId() {
  const url = new URL(location.href);
  const id = Number(url.searchParams.get("form_id"));
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function api(url, method = "GET", body) {
  const res = await fetch(url, {
    method,
    headers: body
      ? { "Content-Type": "application/json", "Accept": "application/json" }
      : { "Accept": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data?.hint || data?.error || `HTTP ${res.status}`);
  }
  return data;
}

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m])
  );
}

function parseOpt(row) {
  try { return row.options_json ? JSON.parse(row.options_json) : {}; }
  catch { return {}; }
}

function slugKeyBase(s) {
  return String(s || "field")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "") || "field";
}

function uniqueKey(base) {
  const stamp = Date.now().toString(36);
  return `${base}_${stamp}`;
}

/* ---------------- Field Library (Typeform-like) ---------------- */

function libraryItems() {
  return [
    { group: "Essentials", label: "نص قصير", type: "text", key: "short_text", placeholder: "..." },
    { group: "Essentials", label: "نص طويل", type: "textarea", key: "long_text", placeholder: "..." },
    { group: "Essentials", label: "رقم", type: "number", key: "number", placeholder: "0" },
    { group: "Essentials", label: "جوال", type: "tel", key: "mobile", placeholder: "05xxxxxxxx" },
    { group: "Essentials", label: "بريد", type: "email", key: "email", placeholder: "name@email.com" },
    { group: "Essentials", label: "تاريخ", type: "date", key: "date", placeholder: "" },
    { group: "Choices", label: "قائمة (Select)", type: "select", key: "select", options: ["خيار 1", "خيار 2"] },
  ];
}

async function addFieldFromTemplate(tpl) {
  const base = slugKeyBase(tpl.key || tpl.type || "field");
  const autoKey = uniqueKey(base);

  const payload = {
    form_id: state.form_id,
    field: {
      field_key: autoKey,
      label: tpl.label || "سؤال جديد",
      type: tpl.type,
      required: 0,
      placeholder: tpl.placeholder || "",
      options: tpl.options || [],
      settings: {},
    },
  };

  await api("/api/fields-add", "POST", payload);
  await loadAll();
  state.selectedId = state.fields[state.fields.length - 1]?.id || null;
  renderAll();

  // focus label
  setTimeout(() => {
    const node = document.querySelector(`#field-${state.selectedId} [data-edit-label]`);
    node?.focus?.();
    node?.select?.();
  }, 80);
}

function renderLibrary() {
  const root = document.getElementById("library");
  const search = document.getElementById("libSearch");
  const q = (search?.value || "").trim();

  root.innerHTML = "";

  const items = libraryItems().filter(x => {
    if(!q) return true;
    return String(x.label).includes(q) || String(x.type).includes(q);
  });

  const groups = {};
  items.forEach(it=>{
    groups[it.group] = groups[it.group] || [];
    groups[it.group].push(it);
  });

  Object.keys(groups).forEach(g=>{
    const h = document.createElement("div");
    h.className = "small muted";
    h.style.margin = "8px 0 6px";
    h.textContent = g;
    root.appendChild(h);

    groups[g].forEach(it=>{
      const btn = document.createElement("button");
      btn.className = "lib-item";
      btn.type = "button";
      btn.textContent = `+ ${it.label}`;
      btn.onclick = () => addFieldFromTemplate(it);
      root.appendChild(btn);
    });
  });

  // اربطي البحث مرة وحدة فقط
  if (search && !search.dataset.bound) {
    search.dataset.bound = "1";
    search.addEventListener("input", () => renderLibrary());
  }
}




/* ---------------- Update Helpers ---------------- */

async function updateField(id, updates) {
  await api("/api/fields-update", "POST", { id, updates });
}

function getFieldById(id) {
  return state.fields.find((x) => x.id === id) || null;
}

/* ---------------- Canvas (Questions list) ---------------- */

function scheduleAutoReorderSave() {
  clearTimeout(state.reorderTimer);
  state.reorderTimer = setTimeout(async () => {
    try {
      const ordered_ids = state.fields.map((x) => x.id);
      await api("/api/fields-reorder", "POST", { form_id: state.form_id, ordered_ids });
      // tiny feedback
      const t = $("#toast");
      if (t) {
        t.textContent = "تم حفظ الترتيب";
        t.style.opacity = "1";
        setTimeout(() => (t.style.opacity = "0"), 900);
      }
    } catch (e) {
      console.error(e);
      alert("تعذر حفظ الترتيب: " + (e.message || e));
    }
  }, 450);
}

function renderOptionsEditor(fieldRow, opt) {
  // only for select
  const isSelect = String(fieldRow.field_type || "").toLowerCase() === "select";
  if (!isSelect) return "";

  const options = Array.isArray(opt.options) ? opt.options : [];
  const list = options.map((v, i) => `
    <div class="row" style="margin-bottom:6px;">
      <input data-opt-idx="${i}" value="${esc(v)}" />
      <button class="btn danger" type="button" data-opt-del="${i}">حذف</button>
    </div>
  `).join("");

  return `
    <div class="divider"></div>
    <div class="small muted" style="margin-bottom:8px;">الخيارات</div>
    <div data-options-wrap>
      ${list || `<div class="small muted">لا توجد خيارات بعد.</div>`}
      <button class="btn" type="button" data-opt-add>+ إضافة خيار</button>
    </div>
  `;
}

function renderCanvas() {
  const root = $("#canvas");
  root.innerHTML = "";



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
    el.id = `field-${f.id}`;
    el.draggable = true;

    const selected = state.selectedId === f.id;

    el.style.borderColor = selected ? "#0b5fff" : "#eef0f6";
    el.style.background = selected ? "#f5f8ff" : "#fff";

    el.innerHTML = `
      <div class="field-meta" style="flex:1;">
        <input data-edit-label value="${esc(f.label)}"
          style="font-weight:800;border:1px solid #dfe3ee;padding:10px;border-radius:10px;background:#fff;" />

        <div class="small muted" style="margin-top:6px;">
  <span class="tag">${esc(f.field_type)}</span>
</div>


        <div class="row" style="margin-top:10px; justify-content:space-between;">
          <label style="margin:0;display:flex;gap:8px;align-items:center;">
            <input type="checkbox" data-required ${Number(f.required) === 1 ? "checked" : ""} style="width:auto;" />
            <span class="small">مطلوب</span>
          </label>

          <span class="small muted" style="cursor:grab;">⋮⋮</span>
        </div>

        ${renderOptionsEditor(f, opt)}
      </div>
<div class="field-head">
  <div style="font-weight:900;">${esc(f.label)}</div>
  <button class="xbtn" type="button" data-del title="حذف">×</button>
</div>

    `;

    // select field card
    el.addEventListener("click", () => {
      state.selectedId = f.id;
      renderAll();
    });

    // label update (debounced on blur/change)
    const labelInp = el.querySelector("[data-edit-label]");
    labelInp.addEventListener("click", (e) => e.stopPropagation());
    labelInp.addEventListener("change", async () => {
      const v = labelInp.value.trim();
      if (!v) return;
      await updateField(f.id, { label: v });
      await loadAll();
      renderAll();
    });

    // required
    const reqChk = el.querySelector("[data-required]");
    reqChk.addEventListener("click", (e) => e.stopPropagation());
    reqChk.addEventListener("change", async () => {
      await updateField(f.id, { required: reqChk.checked ? 1 : 0 });
      await loadAll();
      renderAll();
    });

    // options editor
    const wrap = el.querySelector("[data-options-wrap]");
    if (wrap) {
      wrap.addEventListener("click", async (e) => {
        e.stopPropagation();
        const addBtn = e.target.closest("[data-opt-add]");
        const delBtn = e.target.closest("[data-opt-del]");
        if (addBtn) {
          const newOpt = prompt("أضيفي خيار:", "");
          if (!newOpt) return;
          const cur = parseOpt(f);
          const arr = Array.isArray(cur.options) ? cur.options : [];
          arr.push(newOpt);
          await updateField(f.id, { options: arr });
          await loadAll(); renderAll();
        }
        if (delBtn) {
          const idx = Number(delBtn.getAttribute("data-opt-del"));
          const cur = parseOpt(f);
          const arr = Array.isArray(cur.options) ? cur.options : [];
          arr.splice(idx, 1);
          await updateField(f.id, { options: arr });
          await loadAll(); renderAll();
        }
      });

      // input change
      wrap.querySelectorAll("input[data-opt-idx]").forEach((inp) => {
        inp.addEventListener("click", (e) => e.stopPropagation());
        inp.addEventListener("change", async () => {
          const idx = Number(inp.getAttribute("data-opt-idx"));
          const cur = parseOpt(f);
          const arr = Array.isArray(cur.options) ? cur.options : [];
          arr[idx] = inp.value;
          await updateField(f.id, { options: arr });
          await loadAll(); renderAll();
        });
      });
    }

    // delete
    el.querySelector("[data-del]").onclick = async (ev) => {
      ev.stopPropagation();
      if (!confirm("تأكيد حذف الحقل نهائيًا؟")) return;
      await api("/api/fields-delete", "POST", { id: f.id });
      if (state.selectedId === f.id) state.selectedId = null;
      await loadAll();
      renderAll();
    };

    // Drag reorder (محلي + autosave)
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
      scheduleAutoReorderSave();
    });

    root.appendChild(el);
  });
}

function reorderLocal(fromId, toId) {
  const arr = [...state.fields];
  const fromIdx = arr.findIndex((x) => x.id === fromId);
  const toIdx = arr.findIndex((x) => x.id === toId);
  if (fromIdx < 0 || toIdx < 0) return;
  const [moved] = arr.splice(fromIdx, 1);
  arr.splice(toIdx, 0, moved);
  state.fields = arr;
}

/* ---------------- Right Panel (Properties) ---------------- */

function renderProps() {
  const root = $("#props");
  const f = getFieldById(state.selectedId);
  if (!f) {
    root.innerHTML = `<div class="small muted">اختاري حقلًا من الوسط لتعديل خصائصه.</div>`;
    return;
  }

  const opt = parseOpt(f);
  const key = opt.key || "";
  const placeholder = opt.placeholder || "";

  root.innerHTML = `
    <div class="small muted">خصائص</div>

    <label>العنوان (Label)</label>
    <input id="p_label" value="${esc(f.label)}" />


    <label>Placeholder</label>
    <input id="p_ph" value="${esc(placeholder)}" />

    <label>النوع</label>
    <select id="p_type">
      ${["text","textarea","tel","number","email","date","select"].map(t =>
        `<option value="${t}" ${String(f.field_type)===t ? "selected":""}>${t}</option>`
      ).join("")}
    </select>

    <div class="divider"></div>

    <button class="btn primary" type="button" id="p_save">حفظ التعديلات</button>
  `;

  $("#p_save").onclick = async () => {
    const newLabel = $("#p_label").value.trim();
    const newPh = $("#p_ph").value || "";
    const newType = $("#p_type").value;

    await updateField(f.id, {
      label: newLabel,
      placeholder: newPh,
      type: newType,
    });

    await loadAll();
    renderAll();
  };
}

/* ---------------- Load ---------------- */

async function loadAll() {
  const r = await api(`/api/form?form_id=${state.form_id}&t=${Date.now()}`);
  state.form = r.form;
  state.fields = r.fields || [];
  $("#formTitle").textContent = `${state.form?.name || "محرر النموذج"} (ID: ${state.form_id})`;

 

const canvasMeta = document.getElementById("canvasMeta");
if (canvasMeta) canvasMeta.textContent = `ID: ${state.form_id} • الحقول: ${state.fields.length}`;

const mCanvasMeta = document.getElementById("mCanvasMeta");
if (mCanvasMeta) mCanvasMeta.textContent = `الحقول: ${state.fields.length}`;


}

function syncMobile(){
  const mLib = document.getElementById("mLibrary");
  const mCanvas = document.getElementById("mCanvas");
  const mProps = document.getElementById("mProps");

  if(mLib) mLib.innerHTML = document.getElementById("library")?.innerHTML || "";
  if(mCanvas) mCanvas.innerHTML = document.getElementById("canvas")?.innerHTML || "";
  if(mProps) mProps.innerHTML = document.getElementById("props")?.innerHTML || "";
}

function renderAll() {
  renderLibrary();
  renderCanvas();
  renderProps();
}



async function init() {
  state.form_id = getFormId();
  if (!state.form_id) { alert("لازم form_id في الرابط"); return; }

  // ✅ مهم: لا تربطين إلا إذا العنصر موجود
  const btnReload   = document.getElementById("btnReload");
  const btnPreview  = document.getElementById("btnPreview");
  const btnCopyLink = document.getElementById("btnCopyLink");
  const btnStats    = document.getElementById("btnStats");

  if (btnReload) {
    btnReload.onclick = async () => { await loadAll(); renderAll(); };
  }

  if (btnPreview) {
    btnPreview.onclick = () => {
      window.open(`/?form_id=${encodeURIComponent(state.form_id)}`, "_blank");
    };
  }

  if (btnCopyLink) {
    btnCopyLink.onclick = async () => {
      const url = `${location.origin}/?form_id=${encodeURIComponent(state.form_id)}`;
      try {
        await navigator.clipboard.writeText(url);
        setToast("تم نسخ الرابط ✅");
      } catch {
        const ta = document.createElement("textarea");
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        setToast("تم نسخ الرابط ✅");
      }
    };
  }

  // عرض/إخفاء الإحصائيات (UI فقط)
  const editorGrid = document.getElementById("editorGrid");
  const statsView  = document.getElementById("statsView");
  let statsOpen = false;

  function showEditor() {
    if (editorGrid) editorGrid.style.display = "";
    if (statsView) statsView.style.display = "none";
    statsOpen = false;
  }
  function showStats() {
    if (editorGrid) editorGrid.style.display = "none";
    if (statsView) statsView.style.display = "";
    const statsMeta = document.getElementById("statsMeta");
    if (statsMeta) statsMeta.textContent = `ID: ${state.form_id}`;
    statsOpen = true;
  }

  if (btnStats) {
    btnStats.onclick = () => {
      if (!editorGrid || !statsView) return; // ما يمنع التشغيل
      statsOpen ? showEditor() : showStats();
    };
  }

  // ✅ تحميل البيانات ثم رسم الواجهة
  await loadAll();
  renderAll();

  // لو عندك تبويبات موبايل وتستخدمين bindTabs
  if (typeof bindTabs === "function") bindTabs();
}

init().catch((e) => { console.error(e); alert("خطأ: " + (e.message || e)); });


init().catch((e) => { console.error(e); alert("خطأ: " + (e.message || e)); });



