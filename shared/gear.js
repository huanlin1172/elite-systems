/* G10 單車環臺：行前訓練裝備檢核（行政端／教師端／小隊長）
   預設全員都有帶，只勾選「未帶」的人。以檢核品項為單位，並統計每次訓練各品項未帶的名單與人數。
   資料：att["gear:<場次id>"][學生id] = {m:{品項代碼:1}, note, at, by}（m＝未帶品項）；att["gear:<場次id>"]["T:<小隊id>"] = {done:1}（該隊已確認完成） */
var KCG = (function () {
  var E = KC.esc;
  if (window.ACT !== "g10") return { enabled: false };
  var ZONES = [
    { id: "body", name: "🦺 人身安全類", items: [["helmet", "安全帽"], ["glass", "運動型防風眼鏡"], ["gloves", "單車手套"], ["bottle", "單車水壺（公發）"], ["light", "前後車燈"], ["shoes", "全包式運動鞋"], ["rain", "輕便雨衣"], ["kit", "康橋車衣＆風衣外套（含帽套）"]] },
    { id: "other", name: "🎒 其他物品", items: [["cutlery", "環保餐具"], ["nhi", "健保卡"]] }
  ];
  var ALL = [], NAME = {};
  ZONES.forEach(function (z) { z.items.forEach(function (i) { ALL.push(i[0]); NAME[i[0]] = i[1]; }); });
  var ROLE = "", CTX = null;
  function scope() { if (ROLE === "student") { var m = CTX && CTX.me(); return m ? m.team : "none"; } return ROLE === "teacher" && window.KCW && KCW.scopeTeam ? KCW.scopeTeam("teacher") : ""; }
  var ui = { sess: "", team: "", zone: "", q: "" };

  function sessions() { return KC.S.sessions.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }); }
  function curSess() {
    var l = sessions(); if (!l.length) return null;
    var c = l.filter(function (x) { return x.id === ui.sess; })[0];
    if (!c) c = l.filter(function (x) { return x.date === KC.today() && /裝備|訓/.test(x.title); })[0] || l.filter(function (x) { return /訓練|裝備/.test(x.title); })[0] || l[0];
    ui.sess = c.id; return c;
  }
  function recOf(sess, sid) { var m = KC.S.att["gear:" + sess]; return m && m[sid] ? m[sid] : null; }
  function rec(sid) { return recOf(ui.sess, sid); }
  function missOf(sess, sid) { var r = recOf(sess, sid); return r && r.m ? ALL.filter(function (k) { return r.m[k]; }) : []; }
  function students() {
    var sc = scope();
    var t = sc || ui.team, base = t ? KC.sessMembers(t, ui.sess) : KC.signed();
    return base.filter(function (s) { return !ui.q || (s.name + s.cls).indexOf(ui.q) >= 0; });
  }
  function set(sid) { var m = KC.S.att["gear:" + ui.sess] = KC.S.att["gear:" + ui.sess] || {}; return m[sid] = m[sid] || { m: {}, note: "" }; }
  function tidNow() { return scope() || ui.team || ""; }
  function isDone() { var t = tidNow(), m = KC.S.att["gear:" + ui.sess]; return !!(t && m && m["T:" + t] && m["T:" + t].done); }
  function ZI(k) { var r; ZONES.forEach(function (z) { z.items.forEach(function (i) { if (i[0] === k) r = z; }); }); return r; }
  function who(s) { var t = KC.team(s.team); return E(s.name) + KC.mkTag(ui.sess, s.id) + (!scope() && t ? '<small class="mut">（' + E(t.name.replace(/\s+/g, "").replace("小隊", "隊")) + "）</small>" : ""); }

  function itemCard(z, it, ss) {
    var k = it[0], bad = ss.filter(function (s) { return missOf(ui.sess, s.id).indexOf(k) >= 0; }).length;
    return '<div class="card gitem" id="gi_' + k + '"><div class="gih"><b>' + E(it[1]) + '</b> <span class="mut">' + z.name + '</span><span class="gp">' + (bad ? '<span class="badge no">未帶 ' + bad + "</span>" : '<span class="badge ok">全員備齊</span>') + '</span>' + (bad ? '<button class="sm sec" data-do="gItemClr" data-k="' + k + '">清除未帶</button>' : "") + '</div><div class="gm">' +
      ss.map(function (s) { var on = missOf(ui.sess, s.id).indexOf(k) >= 0; return '<button class="gi' + (on ? " bad" : "") + '" data-do="gk" data-s="' + E(s.id) + '" data-k="' + k + '">' + (on ? "✖ " : "") + E(s.name) + "</button>"; }).join("") + "</div></div>";
  }
  /* 本次訓練：各品項未帶名單與人數 ＋ 各次訓練統計表 */
  function tShort(s) { var t = KC.team(s.team); return t ? t.name.replace(/\s+/g, "").replace("小隊", "隊") : "未編組"; }
  function tipOf(L) { return L.map(function (s) { return tShort(s) + " " + s.name; }).join("、"); }
  function byTeam(L) {
    var m = {}, ord = []; L.forEach(function (s) { var k = tShort(s); if (!m[k]) { m[k] = []; ord.push(k); } m[k].push(s.name); });
    return ord.map(function (k) { return "<b>" + E(k) + "</b>：" + m[k].map(E).join("、"); }).join("<br>");
  }
  function reportHtml(ss) {
    var rows = ALL.map(function (k) { var L = ss.filter(function (s) { return missOf(ui.sess, s.id).indexOf(k) >= 0; }); return { k: k, L: L }; }).filter(function (r) { return r.L.length; });
    var nStu = ss.filter(function (s) { return missOf(ui.sess, s.id).length; }).length, tot = rows.reduce(function (a, r) { return a + r.L.length; }, 0);
    var x = curSess();
    var h = '<div class="card" id="grep"><h3>📋 本次未帶名單與統計　<small class="mut">' + E(x.title) + "　" + E(x.date) + "</small></h3>" +
      '<p>受檢 <b>' + ss.length + "</b> 人，有未帶品項 <b>" + nStu + "</b> 人，未帶品項共 <b>" + tot + "</b> 件" + (tidNow() ? (isDone() ? ' <span class="badge ok">本隊檢核已確認</span>' : ' <span class="badge wn">本隊尚未確認完成</span>') : "") + "</p>" +
      (rows.length ? '<div class="scroll"><table class="gt"><tr><th>品項</th><th>缺帶數量</th><th>缺帶小隊／姓名</th></tr>' + rows.map(function (r) { return "<tr><td>" + E(NAME[r.k]) + '</td><td><b title="' + E(tipOf(r.L)) + '" style="cursor:help;border-bottom:1px dotted">' + r.L.length + "</b></td><td>" + (scope() ? r.L.map(who).join("、") : byTeam(r.L)) + "</td></tr>"; }).join("") + "</table></div>" : '<p class="mut">目前沒有人有未帶品項。</p>') + "</div>";
    /* 各次訓練（有裝備紀錄或已確認完成的場次）× 品項 的未帶人數 */
    var cols = sessions().slice().reverse().filter(function (y) { var m = KC.S.att["gear:" + y.id]; return y.id === ui.sess || (m && Object.keys(m).length); });
    if (cols.length) {
      var cnt = function (y, k) { return ss.filter(function (s) { return missOf(y.id, s.id).indexOf(k) >= 0; }).length; };
      h += '<div class="card" id="gmat"><h3>📊 各次訓練未帶人數</h3><div class="scroll"><table class="gt"><tr><th>品項</th>' + cols.map(function (y) { return '<th style="text-align:center;font-size:12px">' + E(y.date.slice(5)) + "<br>" + E(y.title.replace("行前訓練", "")) + "</th>"; }).join("") + "</tr>" +
        ALL.map(function (k) { return "<tr><td>" + E(NAME[k]) + "</td>" + cols.map(function (y) { var n = cnt(y, k); return '<td style="text-align:center">' + (n ? '<b style="color:#d9534f;cursor:help;border-bottom:1px dotted" title="' + E(tipOf(ss.filter(function (s) { return missOf(y.id, s.id).indexOf(k) >= 0; }))) + '">' + n + "</b>" : '<span class="mut">–</span>') + "</td>"; }).join("") + "</tr>"; }).join("") + '<tr><td><b>有未帶人數</b></td>' + cols.map(function (y) { return '<td style="text-align:center"><b>' + ss.filter(function (s) { return missOf(y.id, s.id).length; }).length + "</b></td>"; }).join("") + "</tr></table></div></div>";
    }
    return h;
  }
  var css = document.createElement("style");
  css.textContent = ".gih{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:6px}.gp{margin-left:auto}.gm{display:flex;flex-wrap:wrap;gap:6px}.gi{border:1px solid var(--line);background:#fff;color:inherit;border-radius:99px;padding:6px 12px;font-size:14px;cursor:pointer;min-height:34px}.gi.bad{background:#d9534f;border-color:#d9534f;color:#fff}" +
    ".gn{width:100%;box-sizing:border-box}.gchip{display:inline-block;border:1px solid var(--line);border-radius:99px;padding:5px 12px;margin:2px;cursor:pointer;background:#fff;font-size:14px}.gchip.on{background:#333;color:#fff;border-color:#333}";
  document.head.appendChild(css);

  function six() {
    var l = KC.S.sessions.filter(function (y) { return /^pt\d+$/.test(y.id); }).sort(function (a, b) { return +a.id.slice(2) - +b.id.slice(2); });
    if (!l.length) l = KC.S.sessions.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    return l.slice(0, 6);
  }
  function viewAll() {
    var cols = six(), t = scope() || ui.team, ss = students(), h = "";
    var th = function (y) { return '<th style="text-align:center;font-size:12px">' + E(y.date.slice(5)) + "<br>" + E(y.title.replace("行前訓練", "")) + "</th>"; };
    var head = '<div class="card"><h3>🧰 行前訓練裝備檢核　<small class="mut">全部（同時檢核 ' + cols.length + ' 次）</small></h3><div class="row"><select data-do="gSess"><option value="all" selected>📚 全部行前訓練（' + cols.length + ' 次）</option>' + sessions().map(function (y) { return '<option value="' + y.id + '">' + E(y.date) + "　" + E(y.title) + "</option>"; }).join("") + "</select>" +
      (scope() ? "" : '<select data-do="gTeam"><option value="">全部' + KC.cfg.unit + "</option>" + KC.S.teams.map(function (x) { return '<option value="' + x.id + '"' + (x.id === ui.team ? " selected" : "") + ">" + E(x.name) + "</option>"; }).join("") + "</select>") +
      '<input id="gq" placeholder="搜尋姓名／班級" value="' + E(ui.q) + '" style="width:150px"><button class="sec" data-do="gSearch">搜尋</button></div>' +
      '<p class="mut" style="margin:6px 0 0">' + (t ? "點選格子標示<b>未帶</b>（紅色✖），再按一次取消。每個品項一張表，橫向是各次訓練。" : "請在上方選擇<b>一個小隊</b>後，即可逐次逐項檢核；未選擇時顯示所有小隊的彙總。") + "</p></div>";
    var cnt = function (y, k, L) { return L.filter(function (s) { return missOf(y.id, s.id).indexOf(k) >= 0; }); };
    h += '<div class="card"><h3>📊 各品項未帶人數（' + (t ? E((KC.team(t) || {}).name || "") : "全部小隊") + '，滑鼠移過數字顯示名單）</h3><div class="scroll"><table class="gt"><tr><th>品項</th>' + cols.map(th).join("") + "<th>合計</th></tr>" +
      ALL.map(function (k) { var tot = 0; return "<tr><td>" + E(NAME[k]) + "</td>" + cols.map(function (y) { var L = cnt(y, k, ss); tot += L.length; return '<td style="text-align:center">' + (L.length ? '<b style="color:#d9534f;cursor:help;border-bottom:1px dotted" title="' + E(tipOf(L)) + '">' + L.length + "</b>" : '<span class="mut">0</span>') + "</td>"; }).join("") + '<td style="text-align:center"><b>' + tot + "</b></td></tr>"; }).join("") + "</table></div></div>";
    if (!t) {
      var rows = KC.S.teams.map(function (tm) { var L = KC.signed().filter(function (s) { return s.team === tm.id; }); if (!L.length) return ""; return "<tr><td><b>" + E(tm.name) + "</b></td>" + cols.map(function (y) { var n = L.filter(function (s) { return missOf(y.id, s.id).length; }).length, dn = (KC.S.att["gear:" + y.id] || {})["T:" + tm.id]; return '<td style="text-align:center">' + (n ? '<b style="color:#d9534f">' + n + "</b>" : dn ? '<span class="badge ok">✔</span>' : '<span class="mut">—</span>') + "</td>"; }).join("") + "</tr>"; }).join("");
      return head + h + '<div class="card"><h3>各小隊每次未帶人數（✔＝已確認全員備齊，—＝尚未檢核）</h3><div class="scroll"><table class="gt"><tr><th>小隊</th>' + cols.map(function (y) { return '<th style="text-align:center;font-size:12px">' + E(y.date.slice(5)) + "</th>"; }).join("") + "</tr>" + rows + "</table></div></div>";
    }
    var items = ""; ZONES.forEach(function (z) { if (ui.zone && z.id !== ui.zone) return; z.items.forEach(function (it) {
      var k = it[0];
      items += '<div class="card gitem"><div class="gih"><b>' + E(it[1]) + '</b> <span class="mut">' + z.name + '</span></div><div class="scroll"><table class="gt"><tr><th>隊員</th>' + cols.map(th).join("") + "</tr>" +
        ss.map(function (s) { return "<tr><td>" + E(s.name) + "</td>" + cols.map(function (y) { var on = missOf(y.id, s.id).indexOf(k) >= 0; return '<td style="text-align:center"><button class="gi' + (on ? " bad" : "") + '" style="padding:4px 10px;min-height:30px" data-do="gk" data-ss="' + y.id + '" data-s="' + E(s.id) + '" data-k="' + k + '">' + (on ? "✖" : "✔") + "</button></td>"; }).join("") + "</tr>"; }).join("") + "</table></div></div>";
    }); });
    return head + h + '<div style="margin:6px 0">' + [["", "全部"]].concat(ZONES.map(function (z) { return [z.id, z.name]; })).map(function (z) { return '<span class="gchip' + (ui.zone === z[0] ? " on" : "") + '" data-do="gZone" data-z="' + z[0] + '">' + z[1] + "</span>"; }).join("") + "</div>" + items;
  }
  function view() {
    if (window.KCD && KCD.ensureSessions && KCD.ensureSessions()) KC.save();
    if (ui.sess === "all") return viewAll();
    var x = curSess();
    if (!x) return '<div class="card"><h3>裝備檢核</h3><p class="mut">尚無訓練場次。</p></div>';
    var ss = students(), tid = tidNow();
    var items = []; ZONES.forEach(function (z) { if (ui.zone && z.id !== ui.zone) return; z.items.forEach(function (it) { items.push(itemCard(z, it, ss)); }); });
    var notes = '<div class="card"><h4 style="margin:0 0 6px">備註（選填）</h4>' + ss.map(function (s) { var r = rec(s.id); return '<div class="row" style="gap:6px"><span style="min-width:72px">' + E(s.name) + '</span><input class="gn" style="flex:1;margin:0" data-gnote="' + E(s.id) + '" placeholder="例：安全帽破損、借用雨衣" value="' + E(r && r.note || "") + '"></div>'; }).join("") + "</div>";
    return '<div class="card"><h3>🧰 行前訓練裝備檢核</h3><p class="mut" style="margin:0 0 6px">預設全員都有帶；只要點選<b>沒帶</b>的隊員姓名（會變紅色），再按一次取消。</p><div class="row"><select data-do="gSess"><option value="all">📚 全部行前訓練（同時檢核六次）</option>' + sessions().map(function (y) { return '<option value="' + y.id + '"' + (y.id === ui.sess ? " selected" : "") + ">" + E(y.date) + " " + E(y.title) + "</option>"; }).join("") + "</select>" +
      (scope() ? "" : '<select data-do="gTeam"><option value="">全部' + KC.cfg.unit + "</option>" + KC.S.teams.map(function (t) { return '<option value="' + t.id + '"' + (t.id === ui.team ? " selected" : "") + ">" + E(t.name) + "</option>"; }).join("") + "</select>") +
      '<input id="gq" placeholder="搜尋姓名／班級" value="' + E(ui.q) + '" style="width:150px"><button class="sec" data-do="gSearch">搜尋</button></div>' +
      '<div style="margin:6px 0"><span class="mut">分區：</span>' + [["", "全部"]].concat(ZONES.map(function (z) { return [z.id, z.name]; })).map(function (z) { return '<span class="gchip' + (ui.zone === z[0] ? " on" : "") + '" data-do="gZone" data-z="' + z[0] + '">' + z[1] + "</span>"; }).join("") + "</div>" +
      '<div class="row">' + (tid ? '<button class="' + (isDone() ? "sec" : "pri") + '" data-do="gDone">' + (isDone() ? "✔ 已確認完成（再按取消）" : "確認本隊檢核完成") + "</button>" : "") + '<button class="sec" data-do="gExp">匯出 CSV</button></div></div>' +
      '<div id="gwrap">' + reportHtml(ss) + "</div>" + (ss.length ? items.join("") + notes : '<div class="card"><p class="mut">沒有符合的學生</p></div>');
  }
  function mount(role, ctx) {
    ROLE = role; CTX = ctx;
    var tb = ctx.TABS.filter(function (x) { return x[0] === "gear"; })[0];
    if (!tb) { var i = ctx.TABS.map(function (x) { return x[0]; }).indexOf(role === "admin" ? "att" : "roll"); ctx.TABS.splice(i + 1, 0, ["gear", "裝備檢核"]); }
    ctx.V.gear = view;
    var H = ctx.H;
    var refresh = function (k) {
      KC.save();
      var ss = students(), el = document.getElementById("gi_" + k), z = ZI(k), g = document.getElementById("gwrap");
      if (!el || !z || !g) return ctx.render();
      var tmp = document.createElement("div"); tmp.innerHTML = itemCard(z, z.items.filter(function (i) { return i[0] === k; })[0], ss); el.replaceWith(tmp.firstChild);
      var old = g.querySelectorAll("#grep,#gmat"); var h = document.createElement("div"); h.innerHTML = reportHtml(ss);
      old.forEach(function (o) { o.remove(); }); while (h.lastChild) g.insertBefore(h.lastChild, g.firstChild);
    };
    H.gSess = function (d, el) { ui.sess = el.value; ctx.render(); };
    H.gTeam = function (d, el) { ui.team = el.value; ctx.render(); };
    H.gZone = function (d) { ui.zone = d.z; ctx.render(); };
    H.gSearch = function () { ui.q = (document.getElementById("gq").value || "").trim(); ctx.render(); };
    H.gk = function (d) {
      if (d.ss) { var sv = ui.sess; ui.sess = d.ss; var r0 = set(d.s); r0.m = r0.m || {}; if (r0.m[d.k]) delete r0.m[d.k]; else r0.m[d.k] = 1; r0.at = new Date().toISOString(); r0.by = role; if (!Object.keys(r0.m).length && !r0.note) delete KC.S.att["gear:" + d.ss][d.s]; ui.sess = sv; return ctx.done(); }
      var r = set(d.s); r.m = r.m || {}; if (r.m[d.k]) delete r.m[d.k]; else r.m[d.k] = 1; r.at = new Date().toISOString(); r.by = role;
      if (!Object.keys(r.m).length && !r.note) delete KC.S.att["gear:" + ui.sess][d.s];
      refresh(d.k);
    };
    H.gItemClr = function (d) { var m = KC.S.att["gear:" + ui.sess] || {}; students().forEach(function (s) { if (m[s.id] && m[s.id].m) { delete m[s.id].m[d.k]; if (!Object.keys(m[s.id].m).length && !m[s.id].note) delete m[s.id]; } }); refresh(d.k); };
    H.gDone = function () { var t = tidNow(), m = KC.S.att["gear:" + ui.sess] = KC.S.att["gear:" + ui.sess] || {}; if (m["T:" + t] && m["T:" + t].done) delete m["T:" + t]; else m["T:" + t] = { done: 1, at: new Date().toISOString(), by: role }; ctx.done(); };
    H.gExp = function () {
      var x = curSess(), rows = [["班級", "姓名", KC.cfg.unit, "未帶品項數", "未帶品項", "備註"].concat(ALL.map(function (k) { return NAME[k]; }))];
      students().forEach(function (s) { var ms = missOf(ui.sess, s.id), t = KC.team(s.team), r = rec(s.id); rows.push([s.cls, s.name, t ? t.name : "", ms.length, ms.map(function (k) { return NAME[k]; }).join("、"), r && r.note || ""].concat(ALL.map(function (k) { return ms.indexOf(k) >= 0 ? "未帶" : ""; }))); });
      var csv = "﻿" + rows.map(function (r) { return r.map(function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }).join(","); }).join("\r\n");
      var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "裝備檢核_" + x.date + ".csv"; document.body.appendChild(a); a.click(); a.remove();
    };
    document.addEventListener("change", function (e) {
      var t = e.target; if (!t.dataset || t.dataset.gnote == null) return;
      KC.reload(); var r = set(t.dataset.gnote); r.note = t.value.trim(); r.at = new Date().toISOString(); r.by = role; if (!Object.keys(r.m || {}).length && !r.note) delete KC.S.att["gear:" + ui.sess][t.dataset.gnote]; KC.save();
    });
  }
  /* 全部訓練的彙總：各品項備齊率、每位學生未帶累計（給行政總覽用）。只統計「已檢核」的小隊場次＝有任何裝備紀錄或已按「確認完成」 */
  function stats() {
    var signed = KC.signed(), items = {}, per = {}, sess = [];
    ALL.forEach(function (k) { items[k] = { miss: 0, total: 0, who: [] }; });
    KC.S.sessions.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).forEach(function (y) {
      var m = KC.S.att["gear:" + y.id]; if (!m) return;
      var teams = {}; Object.keys(m).forEach(function (k) { if (k.indexOf("T:") === 0) teams[k.slice(2)] = 1; else { var s = KC.student(k); if (s && s.team) teams[s.team] = 1; } });
      var st = signed.filter(function (s) { return teams[s.team]; }); if (!st.length) return;
      var row = { y: y, n: st.length, miss: 0, stu: 0 };
      st.forEach(function (s) {
        var ms = missOf(y.id, s.id), p = per[s.id] = per[s.id] || { s: s, n: 0, miss: 0, items: {} };
        p.n++; p.miss += ms.length; ms.forEach(function (k) { p.items[k] = (p.items[k] || 0) + 1; });
        ALL.forEach(function (k) { items[k].total++; }); ms.forEach(function (k) { items[k].miss++; items[k].who.push(tShort(s) + " " + s.name + "（" + y.date.slice(5) + "）"); });
        row.miss += ms.length; if (ms.length) row.stu++;
      });
      sess.push(row);
    });
    return { items: items, per: per, sess: sess };
  }
  return { mount: mount, enabled: true, setSess: function (id) { ui.sess = id; }, stats: stats, ALL: ALL, NAME: NAME };
})();
