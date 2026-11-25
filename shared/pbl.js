/* G9 專題小隊（Project-based Inquiring Course 分組名單）
   ‧ 行政端：匯入 Excel 分組名單、新增／編輯／刪除小隊、匯出 CSV
   ‧ 教師端、學生端：僅能檢視
   資料存在 settings/main 的 pbl 欄位（不進 GitHub，個資只在 Firebase）。 */
var KCPBL = (function () {
  var E = KC.esc;
  if (window.ACT !== "g9") return { enabled: false };

  var ROLES = [["cap", "小隊長", "Team Captain"], ["vice", "副小隊長", "Vice Team Captain"], ["ao1", "行政長 1", "Administrative Officer 1"], ["ao2", "行政長 2", "Administrative Officer 2"]];
  var XLSX_SRC = ["https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js", "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"];

  function list() { var p = KC.S.settings.pbl; return Array.isArray(p) ? p : []; }
  function str(v) { return v == null ? "" : String(v).replace(/\r/g, "").trim(); }
  function nl(s) { return E(s).replace(/\n/g, "<br>"); }
  function mail(e) { e = str(e); return e ? '<a href="mailto:' + E(e) + '">' + E(e) + "</a>" : '<span class="mut">—</span>'; }
  function cnName(s) { return str(s).split(/\s+/)[0]; }
  function grpKey(g) { var m = /^(9[A-Z]|\d{3})/i.exec(str(g.group).replace(/\s+/g, "")); return m ? m[1].toUpperCase() : "其他"; }
  function people(g) { var a = (g.members || []).slice(); ROLES.forEach(function (r) { if (g[r[0]] && g[r[0]].n) a.push(g[r[0]].n); }); return a; }
  function code(x) { return str(x).replace(/\s+/g, "").toUpperCase(); }
  /* 我的小隊：先看學生所屬的小隊編碼（例如 901-1，含小隊長編碼登入），再用姓名比對組員與幹部 */
  function isMine(g, me) {
    if (!me) return false;
    var t = me.team && KC.team ? KC.team(me.team) : null;
    if (t && (t.code || t.name) && code(t.code || t.name) === code(g.group)) return true;
    if (!me.name) return false; var n = cnName(me.name); return people(g).some(function (p) { return cnName(p) === n; });
  }
  function searchText(g) { return [g.group, g.room, g.advisor, g.email, g.theme, g.intro].concat(people(g)).join(" ").toLowerCase(); }

  /* ---------- 檢視 ---------- */
  function card(g, opt) {
    opt = opt || {};
    var roles = ROLES.map(function (r) { var p = g[r[0]] || {}; return "<tr><th>" + r[1] + '<br><small class="mut">' + r[2] + "</small></th><td>" + (p.n ? E(p.n) : '<span class="mut">—</span>') + (p.e ? "<br><small>" + mail(p.e) + "</small>" : "") + "</td></tr>"; }).join("");
    var mem = (g.members || []).map(function (m, i) { return "<li" + (opt.me && cnName(m) === cnName(opt.me.name) ? ' style="font-weight:700;color:var(--ac)"' : "") + ">" + E(m) + "</li>"; }).join("");
    return '<details class="card pbl" data-pbl="' + E(searchText(g)) + '" data-grp="' + E(grpKey(g)) + '"' + (opt.open ? " open" : "") + (opt.mine ? ' style="border-left:4px solid var(--ac)"' : "") + ">" +
      '<summary><b class="pbl-id">' + E(g.group || "（未命名）") + "</b>" + (opt.mine ? ' <span class="b ok">⭐ 我的小隊</span>' : "") +
      '<span class="pbl-th">' + E(str(g.theme).split("\n")[0]) + "</span>" +
      '<span class="mut pbl-meta">👩‍🏫 ' + E(str(g.advisor).replace(/\n/g, "、") || "—") + "　🏫 " + E(g.room || "—") + "　👥 " + (g.members || []).length + " 人</span></summary>" +
      '<div class="pbl-body">' +
      '<table class="pbl-t"><tr><th>組別<br><small class="mut">Group</small></th><td>' + E(g.group) + "</td></tr>" +
      '<tr><th>教室<br><small class="mut">Classroom</small></th><td>' + E(g.room || "—") + "</td></tr>" +
      '<tr><th>指導老師<br><small class="mut">Advisor</small></th><td>' + nl(g.advisor || "—") + (g.email ? "<br><small>" + mail(g.email) + "</small>" : "") + "</td></tr></table>" +
      "<h4>主題 <small class=\"mut\">Theme</small></h4><p>" + nl(g.theme || "—") + "</p>" +
      "<h4>主題簡介 <small class=\"mut\">Theme Introduction</small></h4><p>" + nl(g.intro || "—") + "</p>" +
      "<h4>幹部 <small class=\"mut\">Officers</small></h4><table class=\"pbl-t\">" + roles + "</table>" +
      "<h4>組員 <small class=\"mut\">Team Members（" + (g.members || []).length + " 人）</small></h4>" + (mem ? '<ol class="pbl-m">' + mem + "</ol>" : '<p class="mut">尚無組員</p>') +
      (opt.admin ? '<div class="row"><button class="pri" data-do="pblEdit" data-id="' + E(g.id) + '">✏️ 編輯</button><button class="dng sm" data-do="pblDel" data-id="' + E(g.id) + '">刪除此小隊</button></div>' : "") +
      "</div></details>";
  }
  function toolbar(all) {
    var keys = []; all.forEach(function (g) { var k = grpKey(g); if (keys.indexOf(k) < 0) keys.push(k); });
    return '<div class="row"><input id="pblQ" placeholder="🔍 搜尋組別、主題、老師、學生姓名…" style="flex:1;min-width:200px">' +
      '<select id="pblG"><option value="">全部班級</option>' + keys.map(function (k) { return "<option>" + E(k) + "</option>"; }).join("") + "</select></div>" +
      '<p class="mut" id="pblN" style="margin:4px 0 0">共 ' + all.length + " 組</p>";
  }
  function listView(role, me) {
    var all = list();
    if (!all.length) return '<div class="card"><h3>📚 專題小隊</h3><p class="mut">' + (role === "admin" ? "尚未建立專題小隊資料。請按上方「匯入 Excel」載入分組名單，或按「新增小隊」手動建立。" : "行政端尚未公布專題小隊名單。") + "</p></div>";
    var mine = role === "student" ? all.filter(function (g) { return isMine(g, me); }) : [];
    return (mine.length ? mine.map(function (g) { return card(g, { open: true, mine: true, me: me }); }).join("") : "") +
      '<div class="card"><h3>📚 全部專題小隊</h3>' + toolbar(all) + "</div>" +
      all.map(function (g) { return card(g, { admin: role === "admin", me: me, mine: mine.indexOf(g) >= 0 }); }).join("");
  }

  /* ---------- 行政端：編輯 ---------- */
  var editing = null; /* null＝列表；"new" 或小隊 id＝編輯中 */
  function field(id, label, val, ph) { return "<div><label>" + label + '</label><input id="' + id + '" value="' + E(val || "") + '"' + (ph ? ' placeholder="' + E(ph) + '"' : "") + ' style="width:100%"></div>'; }
  function area(id, label, val, h, ph) { return "<div><label>" + label + '</label><textarea id="' + id + '" style="width:100%;min-height:' + (h || 60) + 'px"' + (ph ? ' placeholder="' + E(ph) + '"' : "") + ">" + E(val || "") + "</textarea></div>"; }
  function editView() {
    var g = editing === "new" ? { members: [] } : list().filter(function (x) { return x.id === editing; })[0];
    if (!g) { editing = null; return adminView(); }
    return '<div class="card"><h3>' + (editing === "new" ? "➕ 新增專題小隊" : "✏️ 編輯專題小隊：" + E(g.group)) + "</h3>" +
      '<div class="pbl-grid">' + field("pe_group", "組別 Group", g.group, "例：901-1") + field("pe_room", "教室 Classroom", g.room, "例：H227") +
      area("pe_adv", "指導老師 Advisor（多位老師請分行）", g.advisor, 44) + field("pe_email", "指導老師 E-mail", g.email) + "</div>" +
      area("pe_theme", "主題 Theme", g.theme, 60) + area("pe_intro", "主題簡介 Theme Introduction", g.intro, 140) +
      "<h4>幹部</h4>" + ROLES.map(function (r) { var p = g[r[0]] || {}; return '<div class="pbl-grid">' + field("pe_" + r[0] + "_n", r[1] + " " + r[2], p.n) + field("pe_" + r[0] + "_e", r[1] + " E-mail", p.e) + "</div>"; }).join("") +
      area("pe_mem", "組員 Team Members（一行一位）", (g.members || []).join("\n"), 220, "劉永奇 Devin Liu\n林詠量 Leon Lin") +
      '<div class="row"><button class="pri" data-do="pblSave">💾 儲存</button><button class="sec" data-do="pblCancel">取消</button></div></div>';
  }
  function adminView() {
    if (editing) return editView();
    var all = list();
    return '<div class="card"><h3>📚 專題小隊管理</h3><p class="mut" style="margin-top:0">行政端可編輯；教師端、學生端只能檢視。' + (KC.S.settings.pblAt ? "最後更新：" + E(KC.S.settings.pblAt) : "") + "</p>" +
      '<div class="row"><button class="pri" data-do="pblNew">➕ 新增小隊</button>' +
      '<button class="sec" data-do="pblPick">📥 匯入 Excel</button><input type="file" id="pblFile" accept=".xlsx,.xls,.csv" style="display:none">' +
      (all.length ? '<button class="sec" data-do="pblCsv">📤 匯出 CSV</button>' : "") + "</div>" +
      '<p class="mut" style="margin-bottom:0">匯入會讀取「Group list 分組名單」工作表，並<b>取代</b>目前全部小隊資料。</p></div>' + listView("admin");
  }
  function readForm() {
    var v = function (id) { var el = document.getElementById(id); return el ? str(el.value) : ""; };
    var g = { group: v("pe_group"), room: v("pe_room"), advisor: v("pe_adv"), email: v("pe_email"), theme: v("pe_theme"), intro: v("pe_intro"),
      members: v("pe_mem").split("\n").map(str).filter(Boolean) };
    ROLES.forEach(function (r) { g[r[0]] = { n: v("pe_" + r[0] + "_n"), e: v("pe_" + r[0] + "_e") }; });
    return g;
  }
  function stamp() { KC.S.settings.pblAt = new Date().toLocaleString("zh-TW", { hour12: false }); }

  /* ---------- Excel 匯入 ---------- */
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve();
    var i = 0;
    return new Promise(function (res, rej) {
      (function next() {
        if (i >= XLSX_SRC.length) return rej(new Error("無法載入 Excel 讀取元件，請確認網路後再試"));
        var s = document.createElement("script"); s.src = XLSX_SRC[i++]; s.onload = function () { window.XLSX ? res() : next(); }; s.onerror = next; document.head.appendChild(s);
      })();
    });
  }
  function fromRows(rows) {
    var head = (rows[0] || []).map(function (h) { return str(h).toLowerCase().replace(/\s+/g, " "); });
    var col = function (test, dflt) { for (var i = 0; i < head.length; i++) if (test(head[i])) return i; return dflt; };
    var has = function () { var a = arguments; return function (h) { for (var i = 0; i < a.length; i++) if (h.indexOf(a[i]) < 0) return false; return true; }; };
    var C = {
      group: col(function (h) { return h === "group" || h.indexOf("組別") >= 0; }, 0), room: col(has("classroom"), 1), adv: col(has("advisor"), 2),
      email: col(function (h) { return h === "e-mail" || h === "email"; }, 3), intro: col(has("theme introduction"), 5),
      theme: col(function (h) { return h.indexOf("theme") >= 0 && h.indexOf("introduction") < 0; }, 4),
      cap_n: col(function (h) { return h.indexOf("小隊長") >= 0 && h.indexOf("副") < 0 && h.indexOf("mail") < 0; }, 6), cap_e: col(function (h) { return h.indexOf("team captain's e-mail") >= 0 && h.indexOf("vice") < 0; }, 7),
      vice_n: col(function (h) { return h.indexOf("副小隊長") >= 0; }, 8), vice_e: col(function (h) { return h.indexOf("vice") >= 0 && h.indexOf("mail") >= 0; }, 9),
      ao1_n: col(function (h) { return h.indexOf("行政長") >= 0 && /1\s*$/.test(h); }, 10), ao1_e: col(function (h) { return h.indexOf("officers 1") >= 0 && h.indexOf("mail") >= 0; }, 11),
      ao2_n: col(function (h) { return h.indexOf("行政長") >= 0 && /2\s*$/.test(h); }, 12), ao2_e: col(function (h) { return h.indexOf("officers 2") >= 0 && h.indexOf("mail") >= 0; }, 13)
    };
    var memCols = []; head.forEach(function (h, i) { if (h.indexOf("組員") >= 0 || h.indexOf("team members") >= 0) memCols.push(i); });
    if (!memCols.length) for (var k = 14; k < head.length; k++) memCols.push(k);
    var out = [], seen = {};
    rows.slice(1).forEach(function (r, ri) {
      var c = function (i) { return str(r[i]); };
      var g = { group: c(C.group).replace(/\s+/g, ""), room: c(C.room), advisor: c(C.adv), email: c(C.email), theme: c(C.theme), intro: c(C.intro), members: memCols.map(c).filter(Boolean) };
      if (!g.group && !g.theme && !g.members.length) return;
      if (!g.room && /^H\d{3}/i.test(g.advisor)) { g.room = g.advisor; g.advisor = ""; } /* 修正「教室」欄位錯位到「指導老師」的情況 */
      ROLES.forEach(function (rl) { g[rl[0]] = { n: c(C[rl[0] + "_n"]), e: c(C[rl[0] + "_e"]) }; });
      var id = "p_" + (g.group || "row" + (ri + 2)).replace(/[^\w-]/g, "_"); while (seen[id]) id += "_"; seen[id] = 1; g.id = id;
      out.push(g);
    });
    return out;
  }
  function importFile(file, ctx) {
    var r = new FileReader();
    r.onload = function () {
      loadXlsx().then(function () {
        var wb = XLSX.read(new Uint8Array(r.result), { type: "array" });
        var name = wb.SheetNames.filter(function (n) { return /group|分組/i.test(n); })[0] || wb.SheetNames[0];
        var rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: false });
        var gs = fromRows(rows);
        if (!gs.length) return alert("在工作表「" + name + "」找不到任何小隊資料");
        var warn = gs.filter(function (g) { return !g.advisor; }).map(function (g) { return g.group; });
        ctx.sync();
        if (!confirm("讀到工作表「" + name + "」共 " + gs.length + " 個小隊、" + gs.reduce(function (a, g) { return a + g.members.length; }, 0) + " 位組員。\n" + (list().length ? "將取代目前的 " + list().length + " 組資料，" : "") + "確定匯入？")) return;
        KC.S.settings.pbl = gs; stamp(); editing = null; ctx.done();
        alert("✅ 已匯入 " + gs.length + " 個小隊" + (warn.length ? "\n\n⚠️ 以下小隊沒有指導老師姓名，請按「編輯」補上：\n" + warn.join("、") : ""));
      }, function (e) { alert(e.message); });
    };
    r.readAsArrayBuffer(file);
  }

  /* ---------- 樣式 ---------- */
  (function () {
    var st = document.createElement("style");
    st.textContent = ".pbl summary{cursor:pointer;list-style:none;display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline}.pbl summary::-webkit-details-marker{display:none}" +
      ".pbl summary:before{content:'▸';color:var(--ac)}.pbl[open] summary:before{content:'▾'}.pbl-id{color:var(--ac)}.pbl-th{font-weight:600;flex:1;min-width:180px}.pbl-meta{width:100%;font-size:13px}" +
      ".pbl-body{margin-top:10px;border-top:1px solid var(--line);padding-top:8px}.pbl-body h4{margin:14px 0 4px}.pbl-body p{margin:0;line-height:1.7}" +
      ".pbl-t{width:100%;border-collapse:collapse;font-size:14px}.pbl-t th,.pbl-t td{border:1px solid var(--line);padding:5px 8px;text-align:left;vertical-align:top;overflow-wrap:anywhere}.pbl-t a{word-break:break-all}.pbl-t th{background:rgba(0,0,0,.03);white-space:nowrap;width:1%}" +
      ".pbl-m{margin:0;padding-left:24px;columns:2;column-gap:24px}.pbl-m li{padding:2px 0;break-inside:avoid}@media(max-width:560px){.pbl-m{columns:1}}" +
      ".pbl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0 12px}.pbl-grid textarea{min-height:44px}.pbl-grid input,.pbl-grid textarea{box-sizing:border-box}";
    document.head.appendChild(st);
  })();

  /* 搜尋與班級篩選：直接隱藏卡片，不重新繪製 */
  function filter() {
    var q = (document.getElementById("pblQ") || {}).value || "", gsel = (document.getElementById("pblG") || {}).value || "", n = 0;
    q = q.trim().toLowerCase();
    Array.prototype.forEach.call(document.querySelectorAll("details.pbl[data-pbl]"), function (d) {
      var ok = (!q || d.getAttribute("data-pbl").indexOf(q) >= 0) && (!gsel || d.getAttribute("data-grp") === gsel);
      d.style.display = ok ? "" : "none"; if (ok) n++;
    });
    var el = document.getElementById("pblN"); if (el) el.textContent = (q || gsel ? "符合 " + n + " 組／" : "") + "共 " + list().length + " 組";
  }
  document.addEventListener("input", function (e) { if (e.target.id === "pblQ") filter(); });

  function mount(role, ctx) {
    var tabs = ctx.TABS, at = 0;
    tabs.forEach(function (t, i) { if (t[0] === "hub") at = i + 1; });
    tabs.splice(at, 0, ["pbl", "📚 專題小隊"]);
    ctx.V.pbl = function () { return role === "admin" ? adminView() : listView(role, ctx.me()); };
    document.addEventListener("change", function (e) {
      if (e.target.id === "pblG") filter();
      if (role === "admin" && e.target.id === "pblFile" && e.target.files[0]) { importFile(e.target.files[0], ctx); e.target.value = ""; }
    });
    if (role !== "admin") return;
    var H = ctx.H;
    H.pblPick = function () { var f = document.getElementById("pblFile"); if (f) f.click(); };
    H.pblNew = function () { editing = "new"; ctx.render(); window.scrollTo(0, 0); };
    H.pblEdit = function (d) { editing = d.id; ctx.render(); window.scrollTo(0, 0); };
    H.pblCancel = function () { editing = null; ctx.render(); };
    H.pblSave = function () {
      var g = readForm();
      if (!g.group) return alert("請填寫組別");
      var all = list().slice(), dup = all.filter(function (x) { return x.group === g.group && x.id !== editing; })[0];
      if (dup) return alert("組別「" + g.group + "」已存在");
      if (editing === "new") { g.id = "p_" + g.group.replace(/[^\w-]/g, "_") + "_" + KC.uid().slice(-4); all.push(g); }
      else { var i = all.map(function (x) { return x.id; }).indexOf(editing); if (i < 0) return alert("找不到這個小隊，可能已被刪除"); g.id = editing; all[i] = g; }
      KC.S.settings.pbl = all; stamp(); editing = null; ctx.done();
    };
    H.pblDel = function (d) {
      var g = list().filter(function (x) { return x.id === d.id; })[0]; if (!g) return;
      if (!confirm("確定刪除「" + g.group + "　" + str(g.theme).split("\n")[0] + "」？\n刪除後無法復原（可再用 Excel 重新匯入）。")) return;
      KC.S.settings.pbl = list().filter(function (x) { return x.id !== d.id; }); stamp(); ctx.done();
    };
    H.pblCsv = function () {
      var maxM = list().reduce(function (a, g) { return Math.max(a, (g.members || []).length); }, 0), head = ["Group", "Classroom", "Advisor", "E-Mail", "Theme", "Theme Introduction"];
      ROLES.forEach(function (r) { head.push(r[1] + " " + r[2], r[1] + " E-mail"); });
      for (var i = 1; i <= maxM; i++) head.push("組員 Team Members" + i);
      KC.csv("G9專題小隊", [head].concat(list().map(function (g) {
        var row = [g.group, g.room, g.advisor, g.email, g.theme, g.intro]; ROLES.forEach(function (r) { var p = g[r[0]] || {}; row.push(p.n || "", p.e || ""); });
        for (var j = 0; j < maxM; j++) row.push((g.members || [])[j] || ""); return row;
      })));
    };
  }
  return { mount: mount, enabled: true, _fromRows: fromRows };
})();
