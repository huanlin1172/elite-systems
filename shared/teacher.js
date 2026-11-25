/* 教師端：點名、請假審核、加扣分、公告 */
(function () {
  var E = KC.esc, cfg = KC.cfg, S, tab = "hub", sid = "", tf = "", H = {}, app = document.getElementById("app");
  function $(i) { return document.getElementById(i); }
  function sync() { S = KC.reload(); S.scores = S.scores || []; }
  var TABS = [["roll", "點名"], ["leave", "請假審核"]].concat(cfg.score ? [["score", "加扣分"]] : []).concat([["notice", "公告"]]);
  var STCLS = { 出席: 0, 遲到: 1, 請假: 2, 缺席: 3 };

  function curSess() { return S.sessions.filter(function (x) { return x.id === sid; })[0]; }
  function scope() { return window.KCW && KCW.scopeTeam ? KCW.scopeTeam("teacher") : ""; }
  function pool() { var sc = scope(), x = curSess(); return sc ? KC.sessMembers(sc, x || "") : KC.signed().filter(function (s) { return !tf || s.team === tf; }); }
  function mkTag(s) { return KC.mkTag(sid, s.id); }
  var openD = {};
  function hist(stu) {   /* 該生所有場次的出缺席明細與統計 */
    var today = KC.today(), c = { 出席: 0, 遲到: 0, 請假: 0, 缺席: 0, 未點: 0 };
    var h = S.sessions.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).map(function (x) {
      var st = KC.statusFor(x, stu); if (st) c[st]++; else if (x.date <= today) c.未點++; return { x: x, st: st };
    });
    var n = c.出席 + c.遲到 + c.請假 + c.缺席;
    return { c: c, h: h, rate: n ? Math.round((c.出席 + c.遲到) * 100 / n) : null };
  }
  function dtl(stu) {
    var d = hist(stu), cls = { 出席: "ok", 遲到: "wn", 請假: "gr", 缺席: "no" };
    var lv = S.leaves.filter(function (l) { return l.sid === stu.id; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    return '<tr><td colspan="5" style="background:rgba(0,0,0,.03)"><b>' + E(stu.name) + " 出缺席明細</b>　出席 " + d.c.出席 + "　遲到 " + d.c.遲到 + "　請假 " + d.c.請假 + "　缺席 " + d.c.缺席 + "　未點 " + d.c.未點 + (d.rate == null ? "" : "　出席率 " + d.rate + "%") +
      '<div class="scroll"><table style="margin-top:6px"><tr><th>日期</th><th>場次</th><th>狀態</th><th>備註</th></tr>' + (d.h.map(function (r) {
        var nt = r.st === "請假" ? (lv.filter(function (l) { return l.date === r.x.date; }).map(function (l) { return E(l.type + "：" + (l.reason || "")); }).join("；") || "已核准請假") : "";
        return "<tr><td>" + E(r.x.date) + "</td><td>" + E(r.x.title) + '</td><td><span class="b ' + (cls[r.st] || "gr") + '">' + (r.st || "未點名") + '</span></td><td class="mut">' + nt + "</td></tr>";
      }).join("") || '<tr><td colspan="4" class="mut">尚無場次</td></tr>') + "</table></div>" +
      (lv.length ? '<div style="margin-top:6px"><b>請假紀錄</b>' + lv.map(function (l) { return '<div class="mut">' + E(l.date) + "　" + E(l.type || "") + "　" + E(l.reason || "") + "　" + (l.status === "approved" ? "已核准" : l.status === "rejected" ? "已退回" : "待審") + "</div>"; }).join("") + "</div>" : "") + "</td></tr>";
  }
  var V = {};
  V.roll = function () {
    if (!S.sessions.length) return '<div class="card"><p class="mut">行政端尚未建立點名場次。</p></div>';
    var list = S.sessions.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    if (!curSess()) sid = (list.filter(function (x) { return x.date === KC.today(); })[0] || list[0]).id;
    var x = curSess(), st = pool();
    var cnt = { 出席: 0, 遲到: 0, 請假: 0, 缺席: 0, "": 0 };
    st.forEach(function (s) { cnt[KC.statusFor(x, s)]++; });
    var rows = st.map(function (s) {
      var cur = KC.statusFor(x, s), t = KC.team(s.team);
      return "<tr><td>" + E(s.cls) + "</td><td>" + E(s.name) + mkTag(s) + '</td><td class="mut">' + (t ? E(t.name) : "—") + '</td><td><div class="seg">' +
        KC.STATUS.map(function (k) { return '<button class="' + (cur === k ? "on s" + STCLS[k] : "") + '" data-do="mark" data-s="' + E(s.id) + '" data-v="' + k + '">' + k + "</button>"; }).join("") + "</div></td>" +
        '<td><a href="#" data-do="dtl" data-s="' + E(s.id) + '" style="white-space:nowrap">' + (function () { var d = hist(s); return "出" + d.c.出席 + " 遲" + d.c.遲到 + " 假" + d.c.請假 + " 缺" + d.c.缺席 + (d.rate == null ? "" : "｜" + d.rate + "%"); })() + (openD[s.id] ? " ▲" : " ▼") + "</a></td></tr>" + (openD[s.id] ? dtl(s) : "");
    }).join("");
    return '<div class="card"><div class="row"><select id="ss" data-do="pickSess">' + list.map(function (y) { return '<option value="' + y.id + '"' + (y.id === sid ? " selected" : "") + ">" + E(y.date) + " " + E(y.title) + "</option>"; }).join("") + "</select>" +
      (scope() ? '' : '<select id="tf" data-do="pickTeam"><option value="">全部' + cfg.unit + "</option>" + S.teams.map(function (t) { return '<option value="' + t.id + '"' + (t.id === tf ? " selected" : "") + ">" + E(t.name) + "</option>"; }).join("") + "</select>") +
      '<button class="sec" data-do="allIn">未點名者全部出席</button><button class="dng" data-do="clrAll">一鍵取消點名</button></div>' +
      '<p class="mut">出席 ' + cnt["出席"] + "　遲到 " + cnt["遲到"] + "　請假 " + cnt["請假"] + "　缺席 " + cnt["缺席"] + "　未點 " + cnt[""] + "（已核准請假自動帶入）</p>" +
      '<div class="scroll"><table><tr><th>班級</th><th>姓名</th><th>' + cfg.unit + "</th><th>狀態</th><th>出缺席統計</th></tr>" + (rows || '<tr><td colspan="5" class="mut">沒有學生</td></tr>') + "</table></div></div>";
  };
  V.leave = function () {
    var p = S.leaves.filter(function (l) { return l.status === "pending"; });
    return '<div class="card"><h3>待審請假（' + p.length + ")</h3>" + (p.map(function (l) {
      var s = KC.student(l.sid) || { name: l.sid, cls: "" };
      return '<div class="nt"><b>' + E(s.cls) + " " + E(s.name) + "</b>　" + E(l.date) + "　" + E(l.type) + "<br>" + E(l.reason) +
        '<div class="row"><button class="sm pri" data-do="lv" data-id="' + l.id + '" data-v="approved">核准</button><button class="sm dng" data-do="lv" data-id="' + l.id + '" data-v="rejected">退回</button></div></div>';
    }).join("") || '<p class="mut">沒有待審項目</p>') + "</div>";
  };
  V.score = function () {
    return '<div class="card"><h3>登記加扣分</h3><div class="row"><select id="sc_t">' + S.teams.map(function (t) { return '<option value="' + t.id + '">' + E(t.name) + "</option>"; }).join("") +
      '</select><input type="number" id="sc_p" placeholder="分數（扣分輸入負數）" style="width:170px"><input id="sc_r" placeholder="事由" style="flex:1;min-width:140px"><button class="pri" data-do="addScore">登記</button></div>' +
      '<div class="row">' + [["良好合作", 5], ["主動協助", 5], ["違反秩序", -5], ["遲到集合", -3]].map(function (q) { return '<button class="sm sec" data-do="quick" data-r="' + q[0] + '" data-p="' + q[1] + '">' + q[0] + " " + (q[1] > 0 ? "+" : "") + q[1] + "</button>"; }).join(" ") + "</div></div>" +
      '<div class="card"><h3>目前總分</h3><table>' + S.teams.map(function (t) {
        return "<tr><td>" + E(t.name) + "</td><td><b>" + S.scores.filter(function (x) { return x.team === t.id; }).reduce(function (a, x) { return a + x.pts; }, 0) + "</b></td></tr>";
      }).join("") + "</table></div>";
  };
  V.notice = function () {
    return '<div class="card"><h3>公告</h3>' + (S.notices.slice().reverse().map(function (n) { return '<div class="nt"><div class="mut">' + E(n.at) + "</div>" + E(n.text) + "</div>"; }).join("") || '<p class="mut">尚無公告</p>') + "</div>";
  };

  KC.bdgRole = "teacher";
  function render() { sync(); app.innerHTML = KC.head("教師端") + '<div class="wrap">' + KC.tabs(TABS, tab) + V[tab]() + "</div>"; if (window.KCQ) KCQ.post(app); if (window.KCH) KCH.post(app); }
  function done() { KC.save(); render(); }
  H.tab = function (d) { tab = d.t; render(); };
  H.logout = function () { KC.logout("teacher"); };
  H.pickSess = function (d, el) { sid = el.value; render(); };
  H.dtl = function (d, el, ev) { if (ev) ev.preventDefault(); openD[d.s] = !openD[d.s]; render(); };
  H.pickTeam = function (d, el) { tf = el.value; render(); };
  H.mark = function (d) {
    var m = S.att[sid] = S.att[sid] || {};
    if (m[d.s] === d.v) delete m[d.s]; else m[d.s] = d.v;   /* 再按一次取消 */
    done();
  };
  H.clrAll = function () {
    var x = curSess(), m = S.att[sid] || {}, n = 0;
    pool().forEach(function (s) { if (m[s.id]) n++; });
    if (!n) return alert("目前沒有已點名的紀錄");
    if (!confirm("取消「" + x.title + "」目前列出的 " + n + " 位學生的點名紀錄？（已核准請假仍會自動帶入）")) return;
    pool().forEach(function (s) { delete m[s.id]; }); done();
  };
  H.allIn = function () {
    var x = curSess(), m = S.att[sid] = S.att[sid] || {};
    pool().forEach(function (s) { if (!KC.statusFor(x, s)) m[s.id] = "出席"; });
    done();
  };
  H.lv = function (d) { S.leaves.filter(function (l) { return l.id === d.id; })[0].status = d.v; done(); };
  H.addScore = function () {
    var p = +$("sc_p").value, r = $("sc_r").value.trim();
    if (!$("sc_t").value || !p || !r) return alert("請選擇" + cfg.unit + "並填寫分數與事由");
    S.scores.push({ id: KC.uid(), team: $("sc_t").value, pts: p, reason: r, at: new Date().toLocaleString("zh-TW", { hour12: false }) }); done();
  };
  H.quick = function (d) { $("sc_r").value = d.r; $("sc_p").value = d.p; };

  if (window.KCH) KCH.mount("teacher", { TABS: TABS, V: V, H: H, render: render, done: done, sync: sync, me: function () { return null; } });
  if (window.KCPBL) KCPBL.mount("teacher", { TABS: TABS, V: V, H: H, render: render, done: done, sync: sync, me: function () { return null; } });
  if (window.KCP) KCP.mount("teacher", { TABS: TABS, V: V, H: H, render: render, done: done, sync: sync, me: function () { return null; } });
  if (window.KCM) KCM.mount("teacher", { TABS: TABS, V: V, H: H, render: render, done: done, sync: sync, me: function () { return null; } });
  if (window.KCW) KCW.mount("teacher", { TABS: TABS, V: V, H: H, render: render, done: done, sync: sync, me: function () { return null; } });
  if (window.KCG) KCG.mount("teacher", { TABS: TABS, V: V, H: H, render: render, done: done, sync: sync, me: function () { return null; } });
  if (window.KCD) KCD.mount("teacher", { TABS: TABS, V: V, H: H, render: render, done: done, sync: sync, me: function () { return null; } });
  if (window.KCQ) KCQ.mount("teacher", { TABS: TABS, V: V, H: H, render: render, done: done, sync: sync, me: function () { return null; } });
  if (window.KCG9) KCG9.mount("teacher", { TABS: TABS, V: V, H: H, render: render, done: done, sync: sync, me: function () { return null; } });
  if (window.KCW && KCW.finish) KCW.finish("teacher", TABS);
  document.addEventListener("click", function (e) { var t = e.target.closest("[data-do]"); if (t && t.tagName !== "SELECT" && H[t.dataset.do]) { if (t.tagName === "A") e.preventDefault(); sync(); H[t.dataset.do](t.dataset, t, e); } });
  document.addEventListener("change", function (e) { var t = e.target; if (t.tagName === "SELECT" && t.dataset.do && H[t.dataset.do]) { if (t.tagName === "A") e.preventDefault(); sync(); H[t.dataset.do](t.dataset, t, e); } });
  KC.auth("teacher", "教師端登入", function () { KC.rerender = render; render(); });
})();
