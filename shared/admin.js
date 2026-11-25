/* 行政後台端 */
(function () {
  var E = KC.esc, cfg = KC.cfg, S, tab = "hub", H = {}, app = document.getElementById("app"), sel = null;
  function $(i) { return document.getElementById(i); }
  function badge(t, c) { return '<span class="b ' + c + '">' + t + "</span>"; }
  function teamName(id) { var t = KC.team(id); return t ? E(t.name) : '<span class="mut">未編組</span>'; }
  function sync() { S = KC.reload(); S.scores = S.scores || []; }

  var TABS = [["home", "總覽"], ["roster", "學員名單"], ["signup", "報名管理"], ["teams", cfg.unit + "管理"], ["att", "活動點名"], ["leave", "請假審核"]]
    .concat(cfg.score ? [["score", "加扣分與成績"]] : []).concat([["notice", "公告"], ["sys", "系統設定"]]);

  var G10 = KC.id === "g10", tlS = "", tlQ = "";
  function pendingLeaves() { return S.leaves.filter(function (l) { return l.status === "pending" && (!G10 || l.img); }); }

  var V = {};
  V.home = function () {
    var signed = KC.signed().length, teamed = KC.signed().filter(function (s) { return s.team; }).length;
    return '<div class="grid">' +
      [["名單人數", S.students.length], ["已報名", signed], ["已編組", teamed], ["點名場次", S.sessions.length], ["待審請假", pendingLeaves().length]]
        .map(function (x) { return '<div class="stat"><b>' + x[1] + "</b><span>" + x[0] + "</span></div>"; }).join("") + "</div>" +
      '<div class="card" style="margin-top:12px"><h3>建議流程</h3><p class="mut">① 於「學員名單」匯入學生 → ② 「報名管理」開放報名 → ③ 「' + cfg.unit +
      '管理」自動編組 → ④ 「活動點名」建立場次，教師端即可點名 → ⑤ 學生於學生端提出請假，由「請假審核」處理。</p></div>';
  };
  V.roster = function () {
    var rows = S.students.map(function (s) {
      return "<tr><td>" + E(s.cls) + "</td><td>" + E(s.id) + "</td><td>" + E(s.name) + "</td><td>" + teamName(s.team) + "</td><td>" + (KC.roleLabel(s) ? badge(KC.roleLabel(s), "ok") : "") + "</td><td>" + (s.signup ? badge("已報名", "ok") : badge("未報名", "gr")) +
        '</td><td><button class="sm dng" data-do="delStu" data-id="' + E(s.id) + '">刪除</button></td></tr>';
    }).join("");
    return '<div class="card"><h3>批次匯入</h3><p class="mut">每行一位，格式：班級,學號,姓名（可直接從 Excel 複製貼上，欄位以逗號或 Tab 分隔）。學號重複者會更新。</p>' +
      '<textarea id="imp" placeholder="701,70101,王小明&#10;701,70102,李小華"></textarea><div class="row"><button class="pri" data-do="imp">匯入</button>' +
      '<button class="sec" data-do="expRoster">匯出名單 CSV</button></div></div>' +
      '<div class="card"><h3>名單（' + S.students.length + '）</h3><div class="scroll"><table><tr><th>班級</th><th>學號</th><th>姓名</th><th>' + cfg.unit + '</th><th>幹部</th><th>報名</th><th></th></tr>' +
      (rows || '<tr><td colspan="7" class="mut">尚無名單</td></tr>') + "</table></div></div>";
  };
  V.signup = function () {
    var st = S.settings, fields = cfg.fields;
    var rows = KC.signed().map(function (s) {
      return "<tr><td>" + E(s.cls) + "</td><td>" + E(s.name) + "</td>" + fields.map(function (f) { return "<td>" + E((s.signup.data || {})[f[0]] || "") + "</td>"; }).join("") +
        '<td><button class="sm dng" data-do="unsign" data-id="' + E(s.id) + '">取消</button></td></tr>';
    }).join("");
    return '<div class="card"><h3>報名設定</h3><div class="row"><label style="margin:0"><input type="checkbox" id="op"' + (st.open ? " checked" : "") + "> 開放報名</label></div>" +
      '<div class="row"><label style="margin:0">截止日期 <input type="date" id="dl" value="' + E(st.deadline) + '"></label>' +
      '<label style="margin:0">名額上限（0＝不限） <input type="number" id="qt" min="0" value="' + (st.quota || 0) + '" style="width:90px"></label></div>' +
      '<button class="pri" data-do="saveSet">儲存</button></div>' +
      '<div class="card"><h3>已報名（' + KC.signed().length + "）</h3>" + '<div class="row"><button class="sec" data-do="expSignup">匯出報名 CSV</button></div>' +
      '<div class="scroll"><table><tr><th>班級</th><th>姓名</th>' + fields.map(function (f) { return "<th>" + E(f[1]) + "</th>"; }).join("") + "<th></th></tr>" +
      (rows || '<tr><td colspan="9" class="mut">尚無報名</td></tr>') + "</table></div></div>";
  };
  V.teams = function () {
    var names = cfg.teamNames;
    var opts = function (cur) { return '<option value="">未編組</option>' + S.teams.map(function (t) { return '<option value="' + t.id + '"' + (t.id === cur ? " selected" : "") + ">" + E(t.name) + "</option>"; }).join(""); };
    var rows = KC.signed().map(function (s) {
      var rk = KC.roleKey(s);
      return "<tr><td>" + E(s.cls) + "</td><td>" + E(s.name) + '</td><td><select data-do="setTeam" data-id="' + E(s.id) + '">' + opts(s.team) + "</select></td><td>" +
        (s.team ? '<select data-do="setRole" data-id="' + E(s.id) + '"><option value="">（無幹部職務）</option>' + KC.ROLES.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === rk ? " selected" : "") + ">" + x[1] + "</option>"; }).join("") + "</select>" : "") + "</td></tr>";
    }).join("");
    var sum = S.teams.map(function (t) {
      var n = KC.signed().filter(function (s) { return s.team === t.id; }).length, rm = KC.roleMap(t);
      return "<tr><td>" + E(t.name) + "</td><td>" + n + "</td><td>" + KC.ROLES.map(function (x) { var p = KC.student(rm[x[0]]); return x[1] + "：" + (p ? E(p.name) : '<span class="mut">未設</span>'); }).join("　") + "</td></tr>";
    }).join("");
    return '<div class="card"><h3>自動編組</h3><p class="mut">將已報名學生依班級穿插平均分入各' + cfg.unit + "，會覆蓋目前編組。</p>" +
      (names ? '<p class="mut">本活動固定為：' + names.join("、") + "</p>" : '<div class="row"><label style="margin:0">' + cfg.unit + '數 <input type="number" id="tn" min="1" value="' + Math.max(1, Math.ceil(KC.signed().length / 8)) + '" style="width:90px"></label></div>') +
      '<div class="row"><button class="pri" data-do="auto">自動編組</button><button class="sec" data-do="expTeams">匯出編組 CSV</button></div></div>' +
      '<div class="card"><h3>' + cfg.unit + "一覽</h3><table><tr><th>名稱</th><th>人數</th><th>幹部</th></tr>" + (sum || '<tr><td colspan="3" class="mut">尚未編組</td></tr>') + "</table></div>" +
      '<div class="card"><h3>手動調整</h3><div class="scroll"><table><tr><th>班級</th><th>姓名</th><th>' + cfg.unit + "</th><th>幹部職務</th></tr>" + (rows || '<tr><td colspan="4" class="mut">尚無已報名學生</td></tr>') + "</table></div></div>";
  };
  function tlPanel() {
    var x = tlS && S.sessions.filter(function (y) { return y.id === tlS; })[0]; if (!x) return "";
    var m = S.att["tl:" + tlS] || {}, ids = Object.keys(m);
    var cur = ids.map(function (id) { var s = KC.student(id) || { name: id, cls: "" }; return "<tr><td>" + E(s.cls) + " " + E(s.name) + "</td><td>" + E(KC.team(s.team) ? KC.team(s.team).name : "") + "</td><td>" + E(m[id].note || "") + '</td><td><button class="sm dng" data-do="tlDel" data-id="' + E(id) + '">取消</button></td></tr>'; }).join("");
    var q = tlQ.toLowerCase(), res = q ? KC.signed().filter(function (s) { return (s.name + s.cls + s.id).toLowerCase().indexOf(q) >= 0 && !m[s.id]; }).slice(0, 30) : [];
    return '<div class="card"><h3>臨時請假設定：' + E(x.date) + " " + E(x.title) + '</h3><p class="mut" style="margin:0">設定後，學生端與教師端名單會同步顯示「請假」；教師若另行點名，以教師點名為準。</p>' +
      '<div class="row"><input id="tl_q" placeholder="輸入姓名／班級／學號搜尋" value="' + E(tlQ) + '"><button class="pri" data-do="tlQ">搜尋</button></div>' +
      (q ? '<div class="scroll"><table>' + (res.map(function (s) { return "<tr><td>" + E(s.cls) + " " + E(s.name) + "</td><td>" + E(KC.team(s.team) ? KC.team(s.team).name : "") + '</td><td><button class="sm pri" data-do="tlSet" data-id="' + E(s.id) + '">設為請假</button></td></tr>'; }).join("") || '<tr><td class="mut">找不到符合的學生</td></tr>') + "</table></div>" : "") +
      "<h4>本場次臨時請假（" + ids.length + '）</h4><div class="scroll"><table><tr><th>學生</th><th>小隊</th><th>原因</th><th></th></tr>' + (cur || '<tr><td colspan="4" class="mut">尚無</td></tr>') + "</table></div></div>";
  }
  var editS = "";
  V.att = function () {
    var list = S.sessions.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).map(function (x) {
      var st = KC.signed(), cnt = { 出席: 0, 遲到: 0, 請假: 0, 缺席: 0, "": 0 };
      st.forEach(function (s) { cnt[KC.statusFor(x, s)]++; });
      if (editS === x.id) return '<tr><td><input type="date" id="es_d" value="' + E(x.date) + '"></td><td><input id="es_t" value="' + E(x.title) + '" style="min-width:120px"></td><td class="mut">編輯中</td><td><button class="sm pri" data-do="svSess" data-id="' + x.id + '">儲存</button> <button class="sm sec" data-do="edSess" data-id="">取消</button></td></tr>';
      return "<tr><td>" + E(x.date) + "</td><td>" + E(x.title) + "</td><td>" + cnt["出席"] + "／" + cnt["遲到"] + "／" + cnt["請假"] + "／" + cnt["缺席"] + "／" + cnt[""] +
        '</td><td><button class="sm pri" data-do="edSess" data-id="' + x.id + '">編輯</button> <button class="sm sec" data-do="expAtt" data-id="' + x.id + '">匯出</button> <button class="sm sec" data-do="tlOpen" data-id="' + x.id + '">臨時請假</button> <button class="sm sec" data-do="clrSess" data-id="' + x.id + '">清空點名</button> <button class="sm dng" data-do="delSess" data-id="' + x.id + '">刪除</button></td></tr>';
    }).join("");
    var pre = cfg.sessions.map(function (t) { return '<button class="sm sec" data-do="preset" data-t="' + E(t) + '">' + E(t) + "</button>"; }).join(" ");
    return '<div class="card"><h3>建立點名場次</h3><div class="row"><input id="st" placeholder="場次名稱"><input type="date" id="sd" value="' + KC.today() + '"><button class="pri" data-do="addSess">建立</button></div>' +
      '<div class="row"><span class="mut">常用：</span>' + pre + "</div></div>" +
      '<div class="card"><h3>場次（出席／遲到／請假／缺席／未點）</h3><div class="scroll"><table><tr><th>日期</th><th>場次</th><th>統計</th><th></th></tr>' + (list || '<tr><td colspan="4" class="mut">尚無場次</td></tr>') + "</table></div>" +
      '<p class="mut">點名由教師端進行；已核准的請假與臨時請假會自動帶入「請假」。</p></div>' + tlPanel();
  };
  V.leave = function () {
    var row = function (l, act) {
      var s = KC.student(l.sid) || { name: l.sid, cls: "" };
      var c = l.status === "approved" ? badge("已核准", "ok") : l.status === "rejected" ? badge("已退回", "no") : badge("待審", "wn");
      if (G10 && l.status === "pending" && !l.img) c = badge("待學生上傳申請單", "no");
      var im = G10 && l.img ? '<button class="sm sec" data-do="lvView" data-id="' + l.id + '">看申請單</button> ' : "";
      return "<tr><td>" + E(s.cls) + " " + E(s.name) + "</td><td>" + E(l.date) + "</td><td>" + E(l.type) + "</td><td>" + E(l.reason) + (l.note ? '<div class="mut">退回：' + E(l.note) + "</div>" : "") + "</td><td>" + c + "</td><td>" + im +
        (act && (!G10 || l.img) ? '<button class="sm pri" data-do="lv" data-id="' + l.id + '" data-v="approved">核准</button> <button class="sm dng" data-do="lv" data-id="' + l.id + '" data-v="rejected">退回</button>' : "") + "</td></tr>";
    };
    var p = pendingLeaves(), all = S.leaves.slice().reverse(), np = G10 ? S.leaves.filter(function (l) { return l.status === "pending" && !l.img; }).length : 0;
    return (G10 ? '<div class="card"><p class="mut" style="margin:0">流程：學生線上申請 → 到活動組領紙本 → 家長導師簽名 → 學生上傳申請單影像 → <b>行政端核准才算請假完成</b>（該次點名自動轉為「請假」）。目前尚未上傳申請單：<b>' + np + "</b> 件。</p></div>" : "") + '<div class="card"><h3>待審請假（' + p.length + ")</h3><div class=\"scroll\"><table><tr><th>學生</th><th>日期</th><th>類別</th><th>原因</th><th>狀態</th><th></th></tr>" +
      (p.map(function (l) { return row(l, true); }).join("") || '<tr><td colspan="6" class="mut">沒有待審項目</td></tr>') + "</table></div></div>" +
      '<div class="card"><h3>全部紀錄</h3><div class="row"><button class="sec" data-do="expLeave">匯出請假 CSV</button></div><div class="scroll"><table><tr><th>學生</th><th>日期</th><th>類別</th><th>原因</th><th>狀態</th><th></th></tr>' +
      (all.map(function (l) { return row(l, false); }).join("") || '<tr><td colspan="6" class="mut">尚無紀錄</td></tr>') + "</table></div></div>";
  };
  function teamScore(tid) { return S.scores.filter(function (x) { return x.team === tid; }).reduce(function (a, x) { return a + x.pts; }, 0); }
  V.score = function () {
    var board = S.teams.map(function (t) { return { t: t, p: teamScore(t.id) }; }).sort(function (a, b) { return b.p - a.p; });
    var topt = S.teams.map(function (t) { return '<option value="' + t.id + '">' + E(t.name) + "</option>"; }).join("");
    var hist = S.scores.slice().reverse().map(function (x) {
      var t = KC.team(x.team);
      return "<tr><td>" + E(x.at) + "</td><td>" + (t ? E(t.name) : "") + "</td><td>" + E(x.reason) + "</td><td><b style=\"color:var(--" + (x.pts >= 0 ? "ok" : "no") + ')">' + (x.pts > 0 ? "+" : "") + x.pts +
        '</b></td><td><button class="sm dng" data-do="delScore" data-id="' + x.id + '">刪除</button></td></tr>';
    }).join("");
    return '<div class="card"><h3>' + cfg.unit + '成績榜</h3><table><tr><th>名次</th><th>' + cfg.unit + "</th><th>總分</th></tr>" +
      (board.map(function (b, i) { return "<tr><td>" + (i + 1) + "</td><td>" + E(b.t.name) + "</td><td><b>" + b.p + "</b></td></tr>"; }).join("") || '<tr><td colspan="3" class="mut">尚未編組</td></tr>') + "</table>" +
      '<div class="row"><button class="sec" data-do="expScore">匯出成績 CSV</button></div></div>' +
      '<div class="card"><h3>登記加扣分</h3><div class="row"><select id="sc_t">' + topt + '</select><input type="number" id="sc_p" placeholder="分數（扣分輸入負數）" style="width:170px"><input id="sc_r" placeholder="事由" style="flex:1;min-width:140px"><button class="pri" data-do="addScore">登記</button></div>' +
      '<div class="row"><span class="mut">快捷：</span>' + [["良好合作", 5], ["主動協助", 5], ["違反秩序", -5], ["遲到集合", -3]].map(function (q) { return '<button class="sm sec" data-do="quick" data-r="' + q[0] + '" data-p="' + q[1] + '">' + q[0] + " " + (q[1] > 0 ? "+" : "") + q[1] + "</button>"; }).join(" ") + "</div></div>" +
      '<div class="card"><h3>紀錄</h3><div class="scroll"><table><tr><th>時間</th><th>' + cfg.unit + "</th><th>事由</th><th>分數</th><th></th></tr>" + (hist || '<tr><td colspan="5" class="mut">尚無紀錄</td></tr>') + "</table></div></div>";
  };
  V.notice = function () {
    return '<div class="card"><h3>發布公告</h3><textarea id="nt" placeholder="公告內容（學生端與教師端都會看到）"></textarea><div class="row"><button class="pri" data-do="addNote">發布</button></div></div>' +
      '<div class="card"><h3>公告紀錄</h3>' + (S.notices.slice().reverse().map(function (n) {
        return '<div class="nt"><div class="mut">' + E(n.at) + ' <button class="sm dng" data-do="delNote" data-id="' + n.id + '">刪除</button></div>' + E(n.text) + "</div>";
      }).join("") || '<p class="mut">尚無公告</p>') + "</div>";
  };
  V.sys = function () {
    var pwc = '<div class="card"><h3>🔑 重設密碼</h3><p class="mut">學生、教師的預設密碼為「班級＋小隊編號」（例如 1003 班第 3 小隊 → 100303）。忘記密碼者可在此重設回預設。</p><div class="row"><select id="rps"><option value="">選擇學生</option>' + KC.S.students.map(function (s) { return '<option value="' + E(s.id) + '">' + E(s.cls) + " " + E(s.name) + "</option>"; }).join("") + '</select><button class="sec" data-do="pwRs">重設學生</button></div><div class="row"><select id="rpc"><option value="">班級</option>' + Object.keys(KC.S.students.reduce(function (m, s) { m[s.cls] = 1; return m; }, {})).sort().map(function (c) { return "<option>" + E(c) + "</option>"; }).join("") + '</select><select id="rpt"><option value="">小隊</option>' + KC.S.teams.map(function (t) { return '<option value="' + E(t.id) + '">' + E(t.name) + "</option>"; }).join("") + '</select><button class="sec" data-do="pwRt">重設教師</button></div></div>';
    return pwc + '<div class="card"><h3>備份與還原</h3><p class="mut">資料目前存放在此瀏覽器，換裝置或清除瀏覽資料前請先備份。</p><div class="row"><button class="sec" data-do="bak">下載備份（JSON）</button><input type="file" id="rf" accept=".json"><button class="sec" data-do="rst">還原</button></div></div>' +
      (KC.mode === "cloud" && KC.localData() ? '<div class="card"><h3>匯入單機資料</h3><p class="mut">這個瀏覽器裡有先前以單機模式輸入的資料，可以上傳到雲端（會覆蓋雲端目前資料）。</p><div class="row"><button class="sec" data-do="up">上傳到雲端</button></div></div>' : "") +
      '<div class="card"><h3>危險操作</h3><p class="mut">清空所有資料（名單、報名、編組、點名、請假、公告）。</p><div class="row"><input id="cf" placeholder="輸入 RESET 以確認"><button class="dng" data-do="wipe">清空</button></div></div>';
  };

  KC.bdgRole = "admin";
  function render() { sync(); app.innerHTML = KC.head("行政後台") + '<div class="wrap">' + KC.tabs(TABS, tab) + V[tab]() + "</div>"; if (window.KCQ) KCQ.post(app); if (window.KCH) KCH.post(app); }
  function done() { KC.save(); render(); }
  function csvRows(s) { return [s.cls, s.id, s.name]; }

  H.tab = function (d) { tab = d.t; render(); };
  H.logout = function () { KC.logout("admin"); };
  H.pwRs = function () { var v = document.getElementById("rps").value; if (!v) return alert("請選擇學生"); KC.pwSet(KC.pwKey("student", v), null).then(function () { alert("已重設為預設密碼"); }); };
  H.pwRt = function () { var c = document.getElementById("rpc").value, t = document.getElementById("rpt").value; if (!t || (!c && KC.id !== "g10")) return alert("請選擇" + (KC.id === "g10" ? "" : "班級與") + "小隊"); KC.pwSet(KC.pwKey("teacher", KC.id === "g10" ? t.replace("t", "") : c + "|" + t), null).then(function () { alert("已重設為預設密碼"); }); };
  H.imp = function () {
    var n = 0;
    $("imp").value.split(/\r?\n/).forEach(function (ln) {
      var p = ln.split(/[,\t，]/).map(function (x) { return x.trim(); });
      if (p.length < 3 || !p[1]) return;
      var ex = KC.student(p[1]) || S.students.filter(function (x) { return /^T\d\d-/.test(x.id) && x.name === p[2] && x.cls === p[0]; })[0];
      if (ex && ex.id !== p[1]) { var old = ex.id; ex.id = p[1]; Object.keys(S.att).forEach(function (k) { if (S.att[k][old]) { S.att[k][p[1]] = S.att[k][old]; delete S.att[k][old]; } }); S.leaves.forEach(function (l) { if (l.sid === old) l.sid = p[1]; }); }
      if (ex) { ex.cls = p[0]; ex.name = p[2]; } else S.students.push({ id: p[1], cls: p[0], name: p[2], signup: null, team: "" });
      n++;
    });
    done(); alert("已處理 " + n + " 筆");
  };
  H.delStu = function (d) { if (confirm("刪除此學生？其報名、點名紀錄會一併失效")) { S.students = S.students.filter(function (s) { return s.id !== d.id; }); done(); } };
  H.expRoster = function () { KC.csv("名單", [["班級", "學號", "姓名", cfg.unit, "幹部職務"]].concat(S.students.map(function (s) { var t = KC.team(s.team); return csvRows(s).concat([t ? t.name : "", KC.roleLabel(s)]); }))); };
  H.saveSet = function () { S.settings.open = $("op").checked; S.settings.deadline = $("dl").value; S.settings.quota = +$("qt").value || 0; done(); };
  H.unsign = function (d) { var s = KC.student(d.id); KC.setRole(s.id, ""); s.signup = null; s.team = ""; done(); };
  H.expSignup = function () {
    KC.csv("報名", [["班級", "學號", "姓名"].concat(cfg.fields.map(function (f) { return f[1]; }))].concat(KC.signed().map(function (s) { return csvRows(s).concat(cfg.fields.map(function (f) { return (s.signup.data || {})[f[0]] || ""; })); })));
  };
  H.auto = function () {
    var st = KC.signed();
    if (!st.length) return alert("尚無已報名學生");
    if (S.teams.length && !confirm("將覆蓋目前編組，確定？")) return;
    var names = cfg.teamNames, n = names ? names.length : Math.max(1, +$("tn").value || 1);
    S.teams = []; for (var i = 0; i < n; i++) S.teams.push({ id: "t" + (i + 1), name: names ? names[i] : "第" + (i + 1) + cfg.unit, leader: "" });
    st.sort(function (a, b) { return a.cls < b.cls ? -1 : a.cls > b.cls ? 1 : 0; });
    st.forEach(function (s, i) { s.team = S.teams[i % n].id; });
    S.teams.forEach(function (t) { var f = st.filter(function (s) { return s.team === t.id; })[0]; t.leader = f ? f.id : ""; t.roles = f ? { leader: f.id } : {}; });
    done();
  };
  H.setTeam = function (d, el) {
    var s = KC.student(d.id); KC.setRole(s.id, ""); s.team = el.value;
    done();
  };
  H.setRole = function (d, el) {
    var s = KC.student(d.id), t = KC.team(s.team), cur = el.value, rm = KC.roleMap(t), old = cur && KC.student(rm[cur]);
    if (old && old.id !== s.id && !confirm(old.name + " 目前是" + KC.roleLabel(old) + "，要改由 " + s.name + " 擔任嗎？")) return render();
    KC.setRole(s.id, cur); done();
  };
  H.expTeams = function () { KC.csv("編組", [["班級", "學號", "姓名", cfg.unit, "幹部職務"]].concat(KC.signed().map(function (s) { var t = KC.team(s.team); return [s.cls, s.id, s.name, t ? t.name : "", KC.roleLabel(s)]; }))); };
  H.preset = function (d) { $("st").value = d.t; };
  H.addSess = function () {
    var t = $("st").value.trim(), dt = $("sd").value;
    if (!t || !dt) return alert("請輸入場次名稱與日期");
    S.sessions.push({ id: KC.uid(), title: t, date: dt }); done();
  };
  H.edSess = function (d) { editS = d.id; render(); };
  H.svSess = function (d) {
    var x = S.sessions.filter(function (y) { return y.id === d.id; })[0], t = $("es_t").value.trim(), dt = $("es_d").value; if (!x) return;
    if (!t || !dt) return alert("場次名稱與日期不可空白");
    x.title = t; x.date = dt; editS = ""; done(); alert("已儲存，教師端與學生端會同步更新");
  };
  H.clrSess = function (d) { if (confirm("清空此場次所有學生的點名紀錄？（場次本身保留，已核准請假仍會自動帶入）")) { delete S.att[d.id]; done(); } };
  H.delSess = function (d) { if (confirm("刪除此場次與其點名紀錄？")) { S.sessions = S.sessions.filter(function (x) { return x.id !== d.id; }); delete S.att[d.id]; done(); } };
  H.expAtt = function (d) {
    var x = S.sessions.filter(function (y) { return y.id === d.id; })[0];
    KC.csv("點名_" + x.title + "_" + x.date, [["班級", "學號", "姓名", cfg.unit, "狀態"]].concat(KC.signed().map(function (s) { var t = KC.team(s.team); return [s.cls, s.id, s.name, t ? t.name : "", KC.statusFor(x, s) || "未點名"]; })));
  };
  H.lv = function (d) {
    var l = S.leaves.filter(function (x) { return x.id === d.id; })[0]; if (!l) return;
    if (G10 && d.v === "approved" && !l.img) return alert("學生尚未上傳紙本申請單，無法核准");
    if (G10 && d.v === "rejected") { var n = prompt("退回原因（選填，學生會看到）", ""); if (n === null) return; l.note = n; }
    l.status = d.v; done();
  };
  H.lvView = function (d) { var l = S.leaves.filter(function (x) { return x.id === d.id; })[0]; if (l && l.img && window.KCD) KCD.showPhoto(l.img.pid, l.img.thumb); };
  H.tlOpen = function (d) { tlS = tlS === d.id ? "" : d.id; tlQ = ""; render(); };
  H.tlQ = function () { var e = document.getElementById("tl_q"); tlQ = e ? e.value.trim() : ""; render(); };
  H.tlSet = function (d) {
    var m = S.att["tl:" + tlS] = S.att["tl:" + tlS] || {}, n = prompt("臨時請假原因（選填）", ""); if (n === null) return;
    m[d.id] = { note: n, at: new Date().toLocaleString("zh-TW", { hour12: false }) }; done();
  };
  H.tlDel = function (d) { var m = S.att["tl:" + tlS]; if (m) { delete m[d.id]; if (!Object.keys(m).length) delete S.att["tl:" + tlS]; } done(); };
  H.expLeave = function () { KC.csv("請假", [["班級", "姓名", "日期", "類別", "原因", "狀態"]].concat(S.leaves.map(function (l) { var s = KC.student(l.sid) || {}; return [s.cls, s.name, l.date, l.type, l.reason, l.status]; }))); };
  H.addScore = function () {
    var p = +$("sc_p").value, r = $("sc_r").value.trim();
    if (!$("sc_t").value || !p || !r) return alert("請選擇" + cfg.unit + "並填寫分數與事由");
    S.scores.push({ id: KC.uid(), team: $("sc_t").value, pts: p, reason: r, at: new Date().toLocaleString("zh-TW", { hour12: false }) }); done();
  };
  H.quick = function (d) { $("sc_r").value = d.r; $("sc_p").value = d.p; };
  H.delScore = function (d) { S.scores = S.scores.filter(function (x) { return x.id !== d.id; }); done(); };
  H.expScore = function () { KC.csv("成績", [[cfg.unit, "事由", "分數", "時間"]].concat(S.scores.map(function (x) { var t = KC.team(x.team); return [t ? t.name : "", x.reason, x.pts, x.at]; }))); };
  H.addNote = function () { var t = $("nt").value.trim(); if (!t) return; S.notices.push({ id: KC.uid(), text: t, at: new Date().toLocaleString("zh-TW", { hour12: false }) }); done(); };
  H.delNote = function (d) { S.notices = S.notices.filter(function (n) { return n.id !== d.id; }); done(); };
  H.pins = function () { if (!$("pa").value || !$("pt").value) return alert("通行碼不可為空"); S.settings.adminPin = $("pa").value; S.settings.teacherPin = $("pt").value; done(); alert("已儲存"); };
  H.bak = function () {
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: "application/json" }));
    a.download = KC.id + "_backup_" + KC.today() + ".json"; a.click();
  };
  H.rst = function () {
    var f = $("rf").files[0]; if (!f) return alert("請先選擇備份檔");
    var r = new FileReader();
    r.onload = function () { try { var o = JSON.parse(r.result); if (!o.students || !o.settings) throw 0; if (!confirm("將覆蓋目前所有資料，確定？")) return; KC.S = o; done(); } catch (e) { alert("備份檔格式不正確"); } };
    r.readAsText(f);
  };
  H.up = function () { var o = KC.localData(); if (!o || !confirm("將以此瀏覽器的單機資料覆蓋雲端，確定？")) return; KC.S = o; done(); alert("已上傳"); };
  H.wipe = function () { if ($("cf").value !== "RESET") return alert("請輸入 RESET"); KC.reset(); render(); };

  if (window.KCH) KCH.mount("admin", { TABS: TABS, V: V, H: H, render: render, done: done, sync: sync, me: function () { return null; } });
  if (window.KCPBL) KCPBL.mount("admin", { TABS: TABS, V: V, H: H, render: render, done: done, sync: sync, me: function () { return null; } });
  if (window.KCP) KCP.mount("admin", { TABS: TABS, V: V, H: H, render: render, done: done, sync: sync, me: function () { return null; } });
  if (window.KCM) KCM.mount("admin", { TABS: TABS, V: V, H: H, render: render, done: done, sync: sync, me: function () { return null; } });
  if (window.KCW) KCW.mount("admin", { TABS: TABS, V: V, H: H, render: render, done: done, sync: sync, me: function () { return null; } });
  if (window.KCG) KCG.mount("admin", { TABS: TABS, V: V, H: H, render: render, done: done, sync: sync, me: function () { return null; } });
  if (window.KCD) KCD.mount("admin", { TABS: TABS, V: V, H: H, render: render, done: done, sync: sync, me: function () { return null; } });
  if (window.KCB) KCB.mount("admin", { TABS: TABS, V: V, H: H, render: render, done: done, sync: sync, me: function () { return null; } });
  if (window.KCQ) KCQ.mount("admin", { TABS: TABS, V: V, H: H, render: render, done: done, sync: sync, me: function () { return null; } });
  document.addEventListener("click", function (e) { var t = e.target.closest("[data-do]"); if (t && t.tagName !== "SELECT" && H[t.dataset.do]) { if (t.tagName === "A") e.preventDefault(); if (t.dataset.do !== "tab") sync(); H[t.dataset.do](t.dataset, t, e); } });
  document.addEventListener("change", function (e) { var t = e.target; if (t.tagName === "SELECT" && t.dataset.do && H[t.dataset.do]) { if (t.tagName === "A") e.preventDefault(); sync(); H[t.dataset.do](t.dataset, t, e); } });

  KC.auth("admin", "行政後台登入", function () { KC.rerender = render; render(); });
})();
