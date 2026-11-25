/* 學生端：報名、我的小隊、請假、出缺席、公告 */
(function () {
  var E = KC.esc, cfg = KC.cfg, S, me, tab = "hub", H = {}, app = document.getElementById("app");
  function $(i) { return document.getElementById(i); }
  function badge(t, c) { return '<span class="b ' + c + '">' + t + "</span>"; }
  var TABS = [["home", "報名"], ["team", "我的" + cfg.unit], ["leave", "請假"], ["att", "出缺席"], ["notice", "公告"]];
  function sync() { S = KC.reload(); me = KC.student(sessionStorage.getItem("kcauth:" + KC.id + ":student")); }

  function closed() {
    var st = S.settings;
    if (!st.open) return "報名尚未開放或已關閉";
    if (st.deadline && KC.today() > st.deadline) return "已超過報名截止日（" + st.deadline + "）";
    if (st.quota && !me.signup && KC.signed().length >= st.quota) return "名額已滿（" + st.quota + " 人）";
    return "";
  }
  var V = {};
  V.home = function () {
    var form = cfg.fields.map(function (f) {
      var v = me.signup ? (me.signup.data || {})[f[0]] || "" : "";
      var inp = f[2] === "select" ? '<select id="f_' + f[0] + '">' + f[3].map(function (o) { return "<option" + (o === v ? " selected" : "") + ">" + E(o) + "</option>"; }).join("") + "</select>"
        : '<input id="f_' + f[0] + '" value="' + E(v) + '">';
      return "<label>" + E(f[1]) + "</label>" + inp;
    }).join("");
    var c = closed();
    return '<div class="card"><h3>' + E(cfg.name) + " 報名</h3><p>" + E(me.cls) + " " + E(me.name) + "（" + E(me.id) + "）　" + (me.signup ? badge("已報名", "ok") : badge("尚未報名", "wn")) + "</p>" +
      (S.settings.deadline ? '<p class="mut">報名截止：' + E(S.settings.deadline) + "</p>" : "") +
      (c && !me.signup ? '<p class="b no" style="display:block">' + E(c) + "</p>" : form + '<div class="row"><button class="pri" data-do="sign">' + (me.signup ? "更新報名資料" : "送出報名") + "</button>" +
        (me.signup ? '<button class="dng" data-do="unsign">取消報名</button>' : "") + "</div>") + "</div>";
  };
  V.team = function () {
    var t = KC.team(me.team);
    if (!me.signup) return '<div class="card"><p class="mut">請先完成報名。</p></div>';
    if (!t) return '<div class="card"><p class="mut">尚未編組，編組完成後會顯示在這裡。</p></div>';
    var mem = KC.signed().filter(function (s) { return s.team === t.id; });
    return '<div class="card"><h3>' + E(t.name) + "</h3><p class=\"mut\">共 " + mem.length + " 人</p><table><tr><th>班級</th><th>姓名</th><th>幹部</th></tr>" +
      mem.map(function (s) { return "<tr><td>" + E(s.cls) + "</td><td>" + E(s.name) + "</td><td>" + (KC.roleLabel(s) ? badge(KC.roleLabel(s), "ok") : "") + "</td></tr>"; }).join("") + "</table></div>" +
      (cfg.score ? '<div class="card"><h3>' + cfg.unit + "目前總分</h3><b style=\"font-size:26px;color:var(--ac)\">" + (S.scores || []).filter(function (x) { return x.team === t.id; }).reduce(function (a, x) { return a + x.pts; }, 0) + "</b></div>" : "");
  };
  var G10 = KC.id === "g10";
  function lvState(l) {
    if (l.status === "approved") return badge("已核准・請假完成", "ok");
    if (l.status === "rejected") return badge("已退回", "no") + (l.note ? '<div class="mut">' + KC.esc(l.note) + "</div>" : "");
    return l.img ? badge("待行政審核", "wn") : badge("待上傳申請單", "no");
  }
  function lvAct(l) {
    if (l.status === "approved") return l.img ? '<button class="sm sec" data-do="lvView" data-id="' + l.id + '">看申請單</button>' : "";
    return (l.img ? '<button class="sm sec" data-do="lvView" data-id="' + l.id + '">看申請單</button> ' : "") +
      '<label class="sm pri" style="display:inline-block;cursor:pointer;padding:6px 10px;border-radius:8px">' + (l.img ? "重新上傳" : "📷 上傳申請單") + '<input type="file" accept="image/*" data-do="lvUp" data-id="' + l.id + '" style="display:none"></label>' +
      (l.status === "pending" && !l.img ? ' <button class="sm dng" data-do="cancel" data-id="' + l.id + '">撤回</button>' : "");
  }
  V.leave = function () {
    if (G10) return leaveG10();
    var mine = S.leaves.filter(function (l) { return l.sid === me.id; }).reverse();
    return '<div class="card"><h3>申請請假</h3><div class="row"><label style="margin:0">日期 <input type="date" id="ld" value="' + KC.today() + '"></label>' +
      '<label style="margin:0">類別 <select id="lt">' + KC.LTYPE.map(function (x) { return "<option>" + x + "</option>"; }).join("") + "</select></label></div>" +
      '<label>原因</label><textarea id="lr" placeholder="請簡述請假原因"></textarea><div class="row"><button class="pri" data-do="leave">送出申請</button></div></div>' +
      '<div class="card"><h3>我的請假紀錄</h3><table><tr><th>日期</th><th>類別</th><th>原因</th><th>狀態</th><th></th></tr>' +
      (mine.map(function (l) {
        var c = l.status === "approved" ? badge("已核准", "ok") : l.status === "rejected" ? badge("已退回", "no") : badge("待審", "wn");
        return "<tr><td>" + E(l.date) + "</td><td>" + E(l.type) + "</td><td>" + E(l.reason) + "</td><td>" + c + "</td><td>" + (l.status === "pending" ? '<button class="sm dng" data-do="cancel" data-id="' + l.id + '">撤回</button>' : "") + "</td></tr>";
      }).join("") || '<tr><td colspan="5" class="mut">尚無紀錄</td></tr>') + "</table></div>";
  };
  function leaveG10() {
    var mine = S.leaves.filter(function (l) { return l.sid === me.id; }).reverse();
    return '<div class="card"><h3>請假流程</h3><ol style="margin:0;padding-left:20px"><li>在下方<b>線上申請</b>請假日期與原因</li><li>到<b>活動組</b>領取紙本請假申請書</li><li>請<b>家長、導師簽名</b></li><li>回到本頁<b>拍照／掃描上傳</b>紙本申請單</li><li><b>行政端審核通過</b>後，才算請假完成，該次點名會自動顯示「請假」</li></ol></div>' +
      '<div class="card"><h3>線上申請請假</h3><div class="row"><label style="margin:0">日期 <input type="date" id="ld" value="' + KC.today() + '"></label>' +
      '<label style="margin:0">類別 <select id="lt">' + KC.LTYPE.map(function (x) { return "<option>" + x + "</option>"; }).join("") + "</select></label></div>" +
      '<label>原因</label><textarea id="lr" placeholder="請簡述請假原因"></textarea><div class="row"><button class="pri" data-do="leave">送出申請</button></div></div>' +
      '<div class="card"><h3>我的請假紀錄</h3><div class="scroll"><table><tr><th>日期</th><th>類別</th><th>原因</th><th>狀態</th><th></th></tr>' +
      (mine.map(function (l) { return "<tr><td>" + KC.esc(l.date) + "</td><td>" + KC.esc(l.type) + "</td><td>" + KC.esc(l.reason) + "</td><td>" + lvState(l) + "</td><td>" + lvAct(l) + "</td></tr>"; }).join("") || '<tr><td colspan="5" class="mut">尚無紀錄</td></tr>') + "</table></div></div>";
  }
  H.lvView = function (d) { var l = S.leaves.filter(function (x) { return x.id === d.id; })[0]; if (l && l.img && window.KCD) KCD.showPhoto(l.img.pid, l.img.thumb); };
  H.lvUp = function (d, el) {
    var f = el.files && el.files[0]; if (!f || !window.KCD) return;
    KCD.photo(f).then(function (p) { var pid = "lv|" + d.id + "|" + Date.now(); return KCH.put(pid, p.big).then(function () {
      sync(); var l = S.leaves.filter(function (x) { return x.id === d.id; })[0]; if (!l) return;
      if (l.img && l.img.pid) KCH.del(l.img.pid);
      l.img = { pid: pid, thumb: p.thumb, at: new Date().toISOString() }; l.status = "pending"; l.note = ""; done(); alert("已上傳，待行政端審核");
    }); }).catch(function (e) { alert("上傳失敗：" + (e && e.message || e)); });
  };
  V.att = function () {
    var rows = S.sessions.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).map(function (x) {
      var s = KC.statusFor(x, me), c = { 出席: "ok", 遲到: "wn", 請假: "gr", 缺席: "no" }[s] || "gr";
      return "<tr><td>" + E(x.date) + "</td><td>" + E(x.title) + "</td><td>" + badge(s || "未點名", c) + "</td></tr>";
    }).join("");
    return '<div class="card"><h3>我的出缺席</h3><table><tr><th>日期</th><th>場次</th><th>狀態</th></tr>' + (rows || '<tr><td colspan="3" class="mut">尚無場次</td></tr>') + "</table></div>";
  };
  V.notice = function () {
    return '<div class="card"><h3>公告</h3>' + (S.notices.filter(function (n) { return !n.team || n.team === me.team; }).reverse().map(function (n) { return '<div class="nt"><div class="mut">' + E(n.at) + "</div>" + E(n.text) + "</div>"; }).join("") || '<p class="mut">尚無公告</p>') + "</div>";
  };

  KC.bdgRole = "student"; KC.bdgMe = function () { return me && me.id; };
  function render() { sync(); if (!me) { KC.logout("student"); return; } if (window.KCW && KCW.tabsFor) KCW.tabsFor("student", TABS, me); app.innerHTML = KC.head("學生端") + '<div class="wrap">' + KC.tabs(TABS, tab) + V[tab]() + "</div>"; if (window.KCQ) KCQ.post(app); if (window.KCH) KCH.post(app); }
  function done() { KC.save(); render(); }
  H.tab = function (d) { tab = d.t; render(); };
  H.logout = function () { KC.logout("student"); };
  H.sign = function () {
    var c = closed(); if (c) return alert(c);
    var data = {}; cfg.fields.forEach(function (f) { data[f[0]] = $("f_" + f[0]).value.trim(); });
    me.signup = { at: new Date().toLocaleString("zh-TW", { hour12: false }), data: data }; done(); alert("報名資料已送出");
  };
  H.unsign = function () { if (!confirm("確定取消報名？")) return; me.signup = null; me.team = ""; done(); };
  H.leave = function () {
    var d = $("ld").value, r = $("lr").value.trim();
    if (!d || !r) return alert("請填寫日期與原因");
    S.leaves.push({ id: KC.uid(), sid: me.id, date: d, type: $("lt").value, reason: r, status: "pending", at: new Date().toISOString() }); done(); alert(G10 ? "已送出線上申請。請到活動組領取紙本申請書，家長、導師簽名後，回此頁上傳影像。" : "已送出，待老師審核");
  };
  H.cancel = function (d) { S.leaves = S.leaves.filter(function (l) { return l.id !== d.id; }); done(); };

  if (window.KCH) KCH.mount("student", { TABS: TABS, V: V, H: H, render: render, done: done, sync: sync, me: function () { return me; } });
  if (window.KCP) KCP.mount("student", { TABS: TABS, V: V, H: H, render: render, done: done, sync: sync, me: function () { return me; } });
  if (window.KCM) KCM.mount("student", { TABS: TABS, V: V, H: H, render: render, done: done, sync: sync, me: function () { return me; } });
  if (window.KCW) KCW.mount("student", { TABS: TABS, V: V, H: H, render: render, done: done, sync: sync, me: function () { return me; } });
  if (window.KCG) KCG.mount("student", { TABS: TABS, V: V, H: H, render: render, done: done, sync: sync, me: function () { return me; } });
  if (window.KCD) KCD.mount("student", { TABS: TABS, V: V, H: H, render: render, done: done, sync: sync, me: function () { return me; } });
  if (window.KCQ) KCQ.mount("student", { TABS: TABS, V: V, H: H, render: render, done: done, sync: sync, me: function () { return me; } });
  if (window.KCW && KCW.finish) KCW.finish("student", TABS);
  document.addEventListener("change", function (e) { var t = e.target; if ((t.tagName === "SELECT" || (t.tagName === "INPUT" && t.type === "file")) && t.dataset.do && H[t.dataset.do]) { sync(); H[t.dataset.do](t.dataset, t, e); } });
  document.addEventListener("click", function (e) { var t = e.target.closest("[data-do]"); if (t && t.tagName !== "SELECT" && H[t.dataset.do]) { if (t.tagName === "A") e.preventDefault(); sync(); H[t.dataset.do](t.dataset, t, e); } });
  KC.auth("student", "學生端登入", function () { KC.rerender = render; render(); });
})();
