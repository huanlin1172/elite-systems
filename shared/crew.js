/* G10 單車環臺：小隊名單與小隊幹部
   行政端＝全部小隊；教師端＝只看自己帶的小隊幹部；學生端＝只看自己所屬小隊的幹部。資料來源：g10/crew.js */
var KCW = (function () {
  var E = KC.esc, D = window.G10_CREW;
  if (window.ACT !== "g10" || !D) return { enabled: false };
  var ROLES = [["leader", "小隊長", "🧭"], ["vice", "副小隊長", "🤝"], ["eco", "環保長", "🌱"], ["info", "資訊長", "📷"], ["admin", "行政長", "📋"]];
  var ui = { cls: "", q: "", t: "" };
  function classes() { var o = []; D.teams.forEach(function (t) { if (o.indexOf(t.cls) < 0) o.push(t.cls); }); return o; }
  function teamName(t) { return "第 " + t.no + " 小隊"; }
  function hbOf() { return null; }   /* 已取消「手冊編輯」職務 */
  function cadreHtml(t, meName, meId) {
    var rows = ROLES.map(function (r) {
      var n = t.roles[r[0]], id = t.ids[r[0]], me = n && (n === meName || (id && id === meId));
      return "<tr" + (me ? ' class="gme"' : "") + "><td>" + r[2] + " " + r[1] + '</td><td><b>' + E(n || "—") + "</b>" + (me ? ' <span class="badge ok">你</span>' : "") + '</td><td class="mut">' + E(id || "") + '</td><td class="mut gduty">' + E(D.duties[r[0]] || "") + "</td></tr>";
    }).join("");
    var h = hbOf(t);
    if (h) { var me2 = h.name === meName || (h.id && h.id === meId); rows += "<tr" + (me2 ? ' class="gme"' : "") + "><td>📖 手冊編輯<br><small class=\"mut\">（" + E(t.cls) + " 班）</small></td><td><b>" + E(h.name) + "</b>" + (me2 ? ' <span class="badge ok">你</span>' : "") + (h.team && h.team !== t.no ? ' <small class="mut">第 ' + h.team + " 小隊</small>" : "") + '</td><td class="mut">' + E(h.id) + '</td><td class="mut gduty">' + E(D.duties.handbook) + "</td></tr>"; }
    return '<div class="scroll"><table class="gt"><tr><th>職務</th><th>姓名</th><th>學號</th><th class="gduty">職掌</th></tr>' + rows + "</table></div>";
  }
  function teamCard(t, o) {
    o = o || {};
    return '<div class="card"><h3>' + teamName(t) + ' <small class="mut">' + E(t.cls) + "　小隊老師：" + E(t.teacher) + "</small></h3>" + cadreHtml(t, o.name, o.id) +
      (o.members ? '<h4 style="margin:10px 0 4px">小隊員名單（' + t.members.length + " 人）</h4><p style=\"margin:0\">" + t.members.map(function (m) { return '<span class="gchip2' + (m === o.name ? " gself" : "") + '">' + E(m) + "</span>"; }).join("") + "</p>" : "") + "</div>";
  }
  var css = document.createElement("style");
  css.textContent = ".gt{width:100%}.gt td,.gt th{padding:7px 8px;vertical-align:top}.gt tr.gme td{background:rgba(255,213,74,.28)}.gself{background:rgba(255,213,74,.45)}.gchip2{display:inline-block;border:1px solid var(--line);border-radius:99px;padding:2px 10px;margin:2px;font-size:14px}@media(max-width:640px){.gduty{display:none}}";
  document.head.appendChild(css);

  /* ---- 行政端：小隊師生名單（可增減人員、換隊、指派幹部）---- */
  var BASE = D.teams.map(function (t) { return { roles: Object.assign({}, t.roles), ids: Object.assign({}, t.ids), teacher: t.teacher }; });
  function applyOv() {      /* 依目前學員的所屬小隊與行政端的調整，更新幹部與老師（幹部換隊或被移出會自動空缺） */
    if (!KC.S) return;
    D.teams.forEach(function (t, i) {
      var b = BASE[i], r = KC.team("t" + t.no), ov = (r && r.roles) || {};
      t.teacher = (r && r.teacher) || b.teacher;
      ROLES.forEach(function (rl) {
        var k = rl[0], st = null;
        if (ov[k] !== undefined) st = ov[k] ? KC.student(ov[k]) : null;
        else { st = KC.student(b.ids[k]) || KC.S.students.filter(function (x) { return x.name === b.roles[k] && x.cls === t.cls; })[0] || null; if (!st) { t.roles[k] = b.roles[k]; t.ids[k] = b.ids[k]; return; } }
        if (st && st.team === "t" + t.no) { t.roles[k] = st.name; t.ids[k] = st.id; } else { t.roles[k] = ""; t.ids[k] = ""; }
      });
    });
  }
  var reload0 = KC.reload; KC.reload = function () { var r = reload0.apply(KC, arguments); applyOv(); return r; }; applyOv();
  function teamRec(t) { var r = KC.team("t" + t.no); if (!r) { r = { id: "t" + t.no, name: teamName(t), leader: "" }; KC.S.teams.push(r); } return r; }
  function stuLine(s, t) {
    var held = ROLES.filter(function (r) { return t.roles[r[0]] === s.name && (!t.ids[r[0]] || t.ids[r[0]] === s.id); })[0];
    var opts = '<option value="">組員</option>' + ROLES.map(function (r) { return '<option value="' + r[0] + '"' + (held && held[0] === r[0] ? " selected" : "") + ">" + r[1] + "</option>"; }).join("");
    var mv = '<option value="">換隊…</option>' + D.teams.filter(function (x) { return x.no !== t.no; }).map(function (x) { return '<option value="t' + x.no + '">' + teamName(x) + "</option>"; }).join("");
    return "<tr><td>" + E(s.name) + '</td><td class="mut">' + E(s.cls) + '</td><td class="mut">' + (/^T\d\d-|^N/.test(s.id) ? "—" : E(s.id)) + '</td><td><select data-do="wRole" data-s="' + E(s.id) + '" data-t="' + t.no + '">' + opts + '</select></td><td><select data-do="wMove" data-s="' + E(s.id) + '">' + mv + '</select></td><td><button class="sm sec" data-do="wOut" data-s="' + E(s.id) + '">移出</button></td></tr>';
  }
  function adminView() {
    var cs = classes(), S = KC.S, list = D.teams.filter(function (t) {
      if (ui.cls && t.cls !== ui.cls) return false;
      if (!ui.q) return true;
      var s = t.teacher + " " + S.students.filter(function (x) { return x.team === "t" + t.no; }).map(function (x) { return x.name; }).join(" ");
      return s.indexOf(ui.q) >= 0;
    });
    var out = S.students.filter(function (s) { return !s.team; });
    var head = '<div class="card"><h3>👥 小隊師生名單</h3><div class="row"><select data-do="wCls"><option value="">全部班級</option>' + cs.map(function (c) { return '<option' + (c === ui.cls ? " selected" : "") + ">" + E(c) + "</option>"; }).join("") + '</select>' +
      '<input id="wq" placeholder="搜尋姓名／老師" value="' + E(ui.q) + '" style="width:150px"><button class="sec" data-do="wSearch">搜尋</button><button class="sec" data-do="wExp">匯出 CSV</button><button class="sec" data-do="wSeed">依原始名單補齊</button></div>' +
      '<p class="mut">共 ' + D.teams.length + " 個小隊、" + S.students.filter(function (s) { return s.team; }).length + " 位學生（未編組 " + out.length + " 人）。每位學生可直接指定職務、換到其他小隊，或移出小隊；幹部換隊或移出後，該職務會自動空缺，可再指派其他人。</p></div>";
    var pw = '<div class="card"><h3>🔑 小隊編號與登入密碼</h3><p class="mut">學生端、教師端登入都要選身分並輸入小隊密碼（預設＝小隊編號去掉橫線，例如 10011）。登入後每位學生、每位教師可自行修改<b>個人密碼</b>；此處是「預設密碼」。個人密碼忘記時，請到「系統設定」→「重設密碼」。</p><div class="scroll"><table class="gt"><tr><th>小隊</th><th>編號</th><th>老師</th><th>學生密碼</th><th>教師密碼</th></tr>' + D.teams.filter(function (t) { return !ui.cls || t.cls === ui.cls; }).map(function (t) { return "<tr><td>第 " + t.no + " 隊</td><td>" + E(codeOf(t)) + "</td><td>" + E(t.teacher) + '</td><td><code>' + E(pwS(t)) + '</code> <button class="sm sec" data-do="wPw" data-n="' + t.no + '" data-k="pw">改</button></td><td><code>' + E(pwT(t)) + '</code> <button class="sm sec" data-do="wPw" data-n="' + t.no + '" data-k="tpw">改</button></td></tr>'; }).join("") + "</table></div></div>";
    var cards = list.map(function (t) {
      var ms = S.students.filter(function (x) { return x.team === "t" + t.no; }), ord = {}; ROLES.forEach(function (r, i) { ord[t.roles[r[0]]] = i + 1; });
      ms.sort(function (a, b) { return (ord[a.name] || 99) - (ord[b.name] || 99); });
      return '<div class="card"><h3>' + teamName(t) + ' <small class="mut">' + E(codeOf(t)) + "　" + E(t.cls) + "　小隊老師：" + E(t.teacher) + ' <button class="sm sec" data-do="wTeacher" data-n="' + t.no + '">改老師</button></small></h3>' +
        '<p class="mut" style="margin:0 0 4px">隊員 ' + ms.length + ' 人</p><div class="scroll"><table class="gt"><tr><th>姓名</th><th>班級</th><th>學號</th><th>職務</th><th>換隊</th><th></th></tr>' + (ms.map(function (s) { return stuLine(s, t); }).join("") || '<tr><td colspan="6" class="mut">尚無隊員</td></tr>') + "</table></div>" +
        '<div class="row" style="margin-top:8px"><input id="wa_n' + t.no + '" placeholder="姓名" style="width:110px"><input id="wa_c' + t.no + '" placeholder="班級" value="' + E(t.cls) + '" style="width:90px"><input id="wa_i' + t.no + '" placeholder="學號（選填）" style="width:130px"><button class="pri" data-do="wAdd" data-n="' + t.no + '">＋ 新增隊員</button></div></div>';
    }).join("");
    var un = out.length ? '<div class="card"><h3>未編組學生（' + out.length + '）</h3><div class="scroll"><table class="gt"><tr><th>姓名</th><th>班級</th><th>指派到</th><th></th></tr>' + out.map(function (s) { return "<tr><td>" + E(s.name) + '</td><td class="mut">' + E(s.cls) + '</td><td><select data-do="wMove" data-s="' + E(s.id) + '"><option value="">選擇小隊…</option>' + D.teams.map(function (x) { return '<option value="t' + x.no + '">' + teamName(x) + "</option>"; }).join("") + '</select></td><td><button class="sm dng" data-do="wDelStu" data-s="' + E(s.id) + '">刪除</button></td></tr>'; }).join("") + "</table></div></div>" : "";
    return head + un + pw + (cards || '<div class="card"><p class="mut">沒有符合的小隊</p></div>');
  }

  /* 依小隊名單建立學員（登入身分）與編組：幹部用學號 LS 開頭，組員（原表無學號）用暫時編號 T小隊-序號 */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function seed() {
    var S = KC.S, added = 0, upd = 0, seen = {};
    function put(id, cls, name, team) {
      var key = cls + "|" + name; if (seen[key]) return; seen[key] = 1;
      var ex = KC.student(id) || S.students.filter(function (x) { return x.name === name && x.cls === cls; })[0];
      if (ex) { if (!ex.team) { ex.team = team; upd++; } if (!ex.signup) { ex.signup = { at: new Date().toISOString(), data: {}, auto: true }; upd++; } return; }
      S.students.push({ id: id, cls: cls, name: name, team: team, signup: { at: new Date().toISOString(), data: {}, auto: true } }); added++;
    }
    D.teams.forEach(function (t) {
      var tid = "t" + t.no;
      if (!KC.team(tid)) S.teams.push({ id: tid, name: teamName(t), leader: t.roles.leader });
      ROLES.forEach(function (r) { if (t.roles[r[0]]) put(t.ids[r[0]] || "T" + pad(t.no) + "-" + r[0], t.cls, t.roles[r[0]], tid); });
      var h = hbOf(t); if (h && h.team === t.no) put(h.id, t.cls, h.name, tid);
      t.members.forEach(function (m, i) { put("T" + pad(t.no) + "-" + pad(i + 1), t.cls, m, tid); });
    });
    if (window.KCD && KCD.enabled) KCD.ensureSessions();
    S.students.sort(function (a, b) { return a.cls < b.cls ? -1 : a.cls > b.cls ? 1 : 0; });
    return { added: added, upd: upd };
  }

  /* ---------- 小隊編號與密碼 ---------- */
  function codeOf(t) { var n = D.teams.filter(function (x) { return x.cls === t.cls && x.no <= t.no; }).length; return t.cls + "-" + n; }   /* 例：1001-1、10A-2 */
  function defPw(t) { return codeOf(t).replace("-", ""); }                                                                              /* 例：10011、10A2 */
  function teamByNo(no) { return D.teams.filter(function (t) { return t.no === +no; })[0]; }
  function rec(t) { return KC.team("t" + t.no); }
  function pwS(t) { var r = rec(t); return (r && r.pw) || defPw(t); }
  function pwT(t) { var r = rec(t); return (r && r.tpw) || defPw(t); }
  function perKey(role, v) { return role === "student" ? "s:" + v : "t:" + v; }
  function chk(key, pw, def) {   /* 個人密碼（已自行修改）優先；否則用小隊層級密碼（預設＝小隊編號） */
    var st = ((KC.reload().settings || {}).pw || {})[key];
    if (!st) return Promise.resolve(norm(pw) === norm(def));
    return KC.hash(String(pw || "").trim()).then(function (h) { return h === st; });
  }
  function okS(s, pw) { var t = teamByNo(String(s.team).replace("t", "")); return t ? chk(perKey("student", s.id), pw, pwS(t)) : Promise.resolve(false); }
  function okT(t, pw) { return chk(perKey("teacher", t.no), pw, pwT(t)); }
  function norm(x) { return String(x || "").replace(/[\s\-－]/g, "").toLowerCase(); }
  var tNo = 0;                                                   /* 目前登入的教師所帶的小隊編號 */
  function tLoad() { var v = ""; try { v = sessionStorage.getItem("kcteacher-sess:g10") || ""; } catch (e) {} if (v) tNo = +v; return tNo; }
  function scopeTeam(role) { if (role !== "teacher") return ""; if (!tNo) tLoad(); return tNo ? "t" + tNo : ""; }

  /* ---------- 登入（學生／教師：依小隊名單選擇身分＋小隊密碼）---------- */
  var oldAuth = KC.auth, oldLogout = KC.logout;
  function shell(label, body) { return '<div class="login"><h1>' + E(KC.cfg.name) + "</h1><h2>" + label + "</h2>" + body + '<p class="mut" id="msg"></p><p class="mut" style="font-size:12.5px">密碼預設為「班級＋小隊」＝小隊編號，例如 1001-1 的密碼是 10011、10A-1 的密碼是 10A1。登入後可按上方「🔑 改密碼」自行修改。忘記請洽活動組。</p></div>'; }
  function studentLogin(label, onOk) {
    var app = document.getElementById("app"), S = KC.reload();
    if (!S.students.length) { seed(); KC.save(); }
    var k = "kcauth:g10:student", cur = "";
    try { cur = sessionStorage.getItem(k) || ""; } catch (e) {}
    if (cur && KC.student(cur)) return onOk(cur);
    var pk = "", pw0 = ""; try { pk = localStorage.getItem("kcpick:g10"); pw0 = localStorage.getItem("kcpw:g10"); } catch (e) {}
    if (pk && KC.student(pk)) return okS(KC.student(pk), pw0).then(function (ok) { if (ok) { try { sessionStorage.setItem(k, pk); } catch (e) {} onOk(pk); } else form(); });
    return form();
    function form() {
    var cl = []; S.students.forEach(function (s) { if (cl.indexOf(s.cls) < 0) cl.push(s.cls); }); cl.sort();
    app.innerHTML = shell(label, '<select id="lc" style="width:100%;margin-bottom:8px"><option value="">① 選擇班級</option>' + cl.map(function (c) { return "<option>" + E(c) + "</option>"; }).join("") + '</select>' +
      '<select id="pn" style="width:100%;margin-bottom:8px"><option value="">② 選擇姓名</option></select><input id="pw" type="password" placeholder="③ 小隊密碼" autocomplete="off" style="width:100%;margin-bottom:10px"><button class="pri" id="go" style="width:100%">進入</button>');
    var $ = function (i) { return document.getElementById(i); };
    $("lc").onchange = function () {
      var list = KC.S.students.filter(function (s) { return s.cls === $("lc").value; });
      $("pn").innerHTML = '<option value="">② 選擇姓名</option>' + list.map(function (s) { var t = KC.team(s.team); var rl = cadreTitle(s); return '<option value="' + E(s.id) + '">' + E(s.name) + (rl ? "　【" + E(rl) + "】" : "") + (t ? "（" + E(t.name) + "）" : "") + "</option>"; }).join("");
    };
    $("go").onclick = function () {
      var s = KC.student($("pn").value); if (!s) { $("msg").textContent = "請先選擇班級與姓名"; return; }
      okS(s, $("pw").value).then(function (ok) {
        if (!ok) { $("msg").textContent = "密碼錯誤"; return; }
        try { sessionStorage.setItem(k, s.id); localStorage.setItem("kcpick:g10", s.id); localStorage.setItem("kcpw:g10", $("pw").value); } catch (e) {}
        onOk(s.id);
      });
    };
    }
  }
  function teacherLogin(label, onOk) {
    var app = document.getElementById("app"), S = KC.reload();
    if (!S.students.length) { seed(); KC.save(); }
    var cur = tLoad();
    if (cur && teamByNo(cur)) return onOk("");
    var n = "", pw1 = ""; try { n = localStorage.getItem("kcteacher:g10"); pw1 = localStorage.getItem("kcteacherpw:g10"); } catch (e) {}
    if (n && teamByNo(n)) return okT(teamByNo(n), pw1).then(function (ok) { if (ok) { tNo = +n; try { sessionStorage.setItem("kcteacher-sess:g10", n); } catch (e) {} onOk(""); } else form(); });
    return form();
    function form() {
    app.innerHTML = shell(label, '<select id="tn" style="width:100%;margin-bottom:8px"><option value="">① 選擇小隊老師</option>' + D.teams.map(function (t) { return '<option value="' + t.no + '">' + E(t.teacher) + "（" + E(codeOf(t)) + "）</option>"; }).join("") + '</select>' +
      '<input id="pw" type="password" placeholder="② 小隊密碼" autocomplete="off" style="width:100%;margin-bottom:10px"><button class="pri" id="go" style="width:100%">進入</button>');
    var $ = function (i) { return document.getElementById(i); };
    $("go").onclick = function () {
      var t = teamByNo($("tn").value); if (!t) { $("msg").textContent = "請先選擇老師"; return; }
      okT(t, $("pw").value).then(function (ok) {
        if (!ok) { $("msg").textContent = "密碼錯誤"; return; }
        tNo = t.no; try { sessionStorage.setItem("kcteacher-sess:g10", String(t.no)); localStorage.setItem("kcteacher:g10", String(t.no)); localStorage.setItem("kcteacherpw:g10", $("pw").value); } catch (e) {}
        onOk("");
      });
    };
    }
  }
  /* 個人修改密碼（學生／教師各自獨立）；首次登入後即可修改 */
  KC.pwChange = function (role) {
    var who, key, chkf;
    if (role === "student") { var sid = ""; try { sid = sessionStorage.getItem("kcauth:g10:student") || ""; } catch (e) {} var s = KC.student(sid); if (!s) return alert("請先登入"); key = perKey("student", s.id); chkf = function (p) { return okS(s, p); }; }
    else { var t = teamByNo(tLoad()); if (!t) return alert("請先登入"); key = perKey("teacher", t.no); chkf = function (p) { return okT(t, p); }; }
    var o = prompt("請輸入目前的密碼（尚未自行修改者為預設密碼）"); if (o === null) return;
    chkf(o).then(function (ok) {
      if (!ok) return alert("目前密碼不正確");
      var n1 = prompt("請輸入新密碼（至少 4 碼）"); if (n1 === null) return; n1 = String(n1).trim();
      if (n1.length < 4) return alert("新密碼至少 4 碼");
      var n2 = prompt("請再輸入一次新密碼"); if (n2 === null) return;
      if (n1 !== String(n2).trim()) return alert("兩次輸入不一致，未變更");
      KC.pwSet(key, n1).then(function () { try { localStorage.setItem(role === "student" ? "kcpw:g10" : "kcteacherpw:g10", n1); } catch (e) {} alert("✅ 密碼已更新，下次登入請使用新密碼"); });
    });
  };
  KC.auth = function (role, label, onOk) {
    if (KC.demo) { if (role === "teacher") tNo = 3; return oldAuth.call(KC, role, label, onOk); }
    if (!KC.isReady || (role !== "student" && role !== "teacher")) return oldAuth.call(KC, role, label, onOk);
    return role === "student" ? studentLogin(label, onOk) : teacherLogin(label, onOk);
  };
  KC.logout = function (role) {
    try { sessionStorage.removeItem("kcteacher-sess:g10"); ["kcpick:g10", "kcpw:g10", "kcteacher:g10", "kcteacherpw:g10"].forEach(function (x) { localStorage.removeItem(x); }); } catch (e) {}
    tNo = 0; return oldLogout.call(KC, role);
  };

  /* ---------- 學生幹部身分 ---------- */
  function cadreRoles(s) {      /* 回傳此學生擔任的幹部職務代碼（leader/vice/eco/info/admin） */
    var t = s && teamByNo(String(s.team || "").replace("t", "")), o = [];
    if (!t) return o;
    ["leader", "vice", "eco", "info", "admin"].forEach(function (k) { if (t.roles[k] === s.name || (t.ids[k] && t.ids[k] === s.id)) o.push(k); });
    return o;
  }
  function cadreTitle(s) { var t = s && teamByNo(String(s.team || "").replace("t", "")); if (!t) return ""; var o = cadreRoles(s).map(function (k) { return ROLES.filter(function (r) { return r[0] === k; })[0][1]; }); var h = hbOf(t); if (h && (h.name === s.name || h.id === s.id)) o.push("手冊編輯"); return o.join("、"); }
  /* 學生端分頁：幹部多出「幹部任務」，小隊長另有「裝備檢核」 */
  function tabsFor(role, tabs, me) {
    if (role !== "student" || !me) return;
    for (var i = tabs.length - 1; i >= 0; i--) if (tabs[i][0] === "duty" || tabs[i][0] === "gear") tabs.splice(i, 1);
    var cr = cadreRoles(me); if (!cr.length) return;
    var at = tabs.map(function (x) { return x[0]; }).indexOf("crew") + 1, add = [["duty", "🎖️ 幹部任務"]];
    if (cr.indexOf("leader") >= 0) add.push(["gear", "裝備檢核"]);
    Array.prototype.splice.apply(tabs, [at, 0].concat(add));
  }

  /* ---------- 我的小隊（幹部＋隊員＋出缺席）---------- */
  var au = { n: 6 };
  function abbr(st) { return { 出席: ["✔", "ok"], 遲到: ["遲", "wn"], 請假: ["假", "gr"], 缺席: ["缺", "no"] }[st] || ["–", "gr"]; }
  function roleOf(t, name) { var o = []; ROLES.forEach(function (r) { if (t.roles[r[0]] === name) o.push(r[1]); }); var h = hbOf(t); if (h && h.name === name) o.push("手冊編輯"); return o.join("、"); }
  function teamPanel(t, me) {
    var tid = "t" + t.no, S = KC.S, ses = S.sessions.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, au.n).reverse();
    var mem = S.students.filter(function (s) { return s.team === tid; }), order = {}; ROLES.forEach(function (r, i) { order[t.roles[r[0]]] = i + 1; });
    mem.sort(function (a, b) { return (order[a.name] || 99) - (order[b.name] || 99); });
    var rows = mem.map(function (s) {
      var rl = roleOf(t, s.name), mine = me && s.id === me.id;
      return "<tr" + (mine ? ' class="gme"' : "") + "><td>" + E(s.name) + (mine ? ' <span class="badge ok">你</span>' : "") + (rl ? ' <small class="mut">' + E(rl) + "</small>" : "") + "</td>" +
        ses.map(function (x) { var a = abbr(KC.statusFor(x, s)); return '<td style="text-align:center"><span class="badge ' + a[1] + '">' + a[0] + "</span></td>"; }).join("") + "</tr>";
    }).join("");
    return '<div class="card"><h3>' + teamName(t) + ' <small class="mut">' + E(codeOf(t)) + "　小隊老師：" + E(t.teacher) + "</small></h3>" + cadreHtml(t, me && me.name, me && me.id) + "</div>" +
      '<div class="card"><h3>小隊名單與出缺席（' + mem.length + ' 人）</h3><div class="scroll"><table class="gt"><tr><th>姓名</th>' + ses.map(function (x) { return '<th style="text-align:center;font-size:12px">' + E(x.date.slice(5)) + "<br>" + E(x.title) + "</th>"; }).join("") + "</tr>" +
      (rows || '<tr><td class="mut">尚無名單</td></tr>') + '</table></div><p class="mut">✔ 出席　遲 遲到　假 請假　缺 缺席　– 未點名（只顯示最近 ' + au.n + " 場）</p></div>";
  }
  function myTeamView(role, ctx) {
    var me = role === "student" ? ctx.me() : null, no = role === "student" ? String(me.team).replace("t", "") : tNo, t = no && teamByNo(no);
    if (!t) return '<div class="card"><h3>👥 我的小隊</h3><p class="mut">找不到你的小隊資料，請洽活動組。</p></div>';
    return teamPanel(t, me);
  }

  /* ---------- 行政端總覽：每次訓練出缺席＋各項裝備備齊率 ---------- */
  function pct(a, b) { return b ? Math.round(a * 100 / b) : null; }
  function bar(p, bad) { return '<div style="background:rgba(0,0,0,.08);border-radius:99px;height:8px;min-width:80px"><div style="width:' + (p || 0) + '%;height:8px;border-radius:99px;background:' + (bad ? "#d9534f" : "#2e9e5b") + '"></div></div>'; }
  function overview() {
    if (window.KCD && KCD.ensureSessions && KCD.ensureSessions()) KC.save();
    var S = KC.S, ss = KC.signed().filter(function (s) { return s.team; }), N = ss.length, today = KC.today();
    var rows = S.sessions.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).map(function (x) {
      var c = { 出席: 0, 遲到: 0, 請假: 0, 缺席: 0, "": 0 }; ss.forEach(function (s) { c[KC.statusFor(x, s)]++; });
      var marked = N - c[""], rate = pct(c.出席 + c.遲到, marked);
      return "<tr><td>" + E(x.date) + "</td><td>" + E(x.title) + "</td><td>" + c.出席 + "</td><td>" + c.遲到 + "</td><td>" + c.請假 + "</td><td>" + (c.缺席 ? "<b style=\"color:#d9534f\">" + c.缺席 + "</b>" : 0) + "</td><td>" + (marked ? c[""] : '<span class="mut">未點名</span>') + "</td><td>" + (rate == null ? "–" : rate + "%") + "</td></tr>";
    }).join("");
    var h = '<div class="card"><h3>📅 每次訓練出缺席（受點名 ' + N + ' 人）</h3><div class="scroll"><table class="gt"><tr><th>日期</th><th>場次</th><th>出席</th><th>遲到</th><th>請假</th><th>缺席</th><th>未點</th><th>出席率</th></tr>' + (rows || '<tr><td colspan="8" class="mut">尚無場次</td></tr>') + '</table></div><p class="mut">出席率＝（出席＋遲到）÷ 已點名人數。</p></div>';
    if (window.KCG && KCG.stats) {
      var st = KCG.stats(), items = KCG.ALL.map(function (k) { var o = st.items[k]; return { k: k, who: o.who || [], miss: o.miss, total: o.total, ok: o.total ? Math.round((o.total - o.miss) * 100 / o.total) : null }; });
      h += '<div class="card"><h3>🧰 各項裝備備齊率</h3>' + (st.sess.length ? '<div class="scroll"><table class="gt"><tr><th>品項</th><th>備齊率</th><th></th><th>未帶人次</th></tr>' + items.map(function (o) { return "<tr><td>" + E(KCG.NAME[o.k]) + "</td><td><b>" + (o.ok == null ? "–" : o.ok + "%") + "</b></td><td style=\"width:40%\">" + bar(o.ok, o.ok != null && o.ok < 90) + '</td><td><span title="' + E(o.who.join("、")) + '" style="cursor:help;border-bottom:1px dotted">' + o.miss + "</span>／" + o.total + "</td></tr>"; }).join("") + "</table></div>" +
        '<p class="mut">已檢核 ' + st.sess.length + ' 個場次：' + st.sess.map(function (r) { return E(r.y.date.slice(5) + r.y.title.replace("行前訓練", "")) + "（有未帶 " + r.stu + "/" + r.n + " 人）"; }).join("、") + "。備齊率＝1 −（未帶人次 ÷ 受檢人次）。</p>" : '<p class="mut">尚無裝備檢核紀錄。</p>') + "</div>";
      var per = Object.keys(st.per).map(function (k) { return st.per[k]; });
      if (per.length) {
        per.forEach(function (p) { p.r = 100 - Math.round(p.miss * 100 / (p.n * KCG.ALL.length)); });
        per.sort(function (a, b) { return a.r - b.r; });
        var bad = per.filter(function (p) { return p.miss; });
        h += '<div class="card"><h3>👤 學生裝備備齊率</h3><p class="mut">共 ' + per.length + " 人受檢，其中 " + (per.length - bad.length) + " 人從未缺帶，" + bad.length + ' 人曾有缺帶（由低到高）：</p><details' + (bad.length && bad.length <= 12 ? " open" : "") + '><summary class="mut">展開名單</summary><div class="scroll"><table class="gt"><tr><th>姓名</th><th>小隊</th><th>備齊率</th><th>缺帶累計</th></tr>' + bad.map(function (p) {
          var t = KC.team(p.s.team);
          return "<tr><td>" + E(p.s.name) + "</td><td>" + (t ? E(t.name.replace(/\s+/g, "").replace("小隊", "隊")) : "") + "</td><td><b>" + p.r + "%</b></td><td class=\"mut\">" + Object.keys(p.items).map(function (k) { return E(KCG.NAME[k]) + "×" + p.items[k]; }).join("、") + "</td></tr>";
        }).join("") + "</table></div></details></div>";
      }
    }
    return h;
  }

  /* ---------- 掛載 ---------- */
  function mount(role, ctx) {
    var tabs = ctx.TABS, after = { admin: "teams", teacher: "roll", student: "team" }[role], i = tabs.map(function (x) { return x[0]; }).indexOf(after);
    tabs.splice(i < 0 ? tabs.length : i + 1, 0, ["crew", role === "admin" ? "小隊幹部" : "👥 我的小隊"]);
    ctx.V.crew = role === "admin" ? adminView : function () { return myTeamView(role, ctx); };
    if (role === "admin") {
      for (var q = tabs.length - 1; q >= 0; q--) if (["roster", "signup", "teams"].indexOf(tabs[q][0]) >= 0) tabs.splice(q, 1);   /* G10：關閉學員名單、報名管理、車隊管理 */
      tabs.forEach(function (x) { if (x[0] === "crew") x[1] = "小隊師生名單"; });
      var home0 = ctx.V.home; ctx.V.home = function () { var h = home0().replace(/<div class="card" style="margin-top:12px"><h3>建議流程<\/h3>[\s\S]*?<\/div>\s*$/, ""); return h + overview(); };
    }
    var H = ctx.H;
    H.wRole = function (d, el) {
      var t = teamByNo(d.t), r = teamRec(t), ov = r.roles = r.roles || {}, sid = d.s;
      ROLES.forEach(function (rl) { if (t.ids[rl[0]] === sid || (t.roles[rl[0]] === (KC.student(sid) || {}).name)) ov[rl[0]] = ""; });
      if (el.value) ov[el.value] = sid; ctx.done();
    };
    H.wMove = function (d, el) { var s = KC.student(d.s); if (!s || !el.value) return; s.team = el.value; if (!s.signup) s.signup = { at: new Date().toISOString(), data: {}, auto: true }; ctx.done(); };
    H.wOut = function (d) { var s = KC.student(d.s); if (!s || !confirm("將 " + s.name + " 移出小隊？（會放到「未編組學生」，之後可再指派）")) return; s.team = ""; ctx.done(); };
    H.wDelStu = function (d) { var s = KC.student(d.s); if (!s || !confirm("永久刪除 " + s.name + "（含其請假與點名紀錄）？")) return; KC.S.students = KC.S.students.filter(function (x) { return x.id !== d.s; }); KC.S.leaves = KC.S.leaves.filter(function (l) { return l.sid !== d.s; }); Object.keys(KC.S.att).forEach(function (k) { if (KC.S.att[k] && KC.S.att[k][d.s]) delete KC.S.att[k][d.s]; }); ctx.done(); };
    H.wAdd = function (d) {
      var g = function (p) { return document.getElementById(p + d.n).value.trim(); }, nm = g("wa_n"), cl = g("wa_c"), id = g("wa_i") || "N" + KC.uid();
      if (!nm || !cl) return alert("請輸入姓名與班級");
      if (KC.student(id)) return alert("學號 " + id + " 已存在");
      KC.S.students.push({ id: id, cls: cl, name: nm, team: "t" + d.n, signup: { at: new Date().toISOString(), data: {}, auto: true } }); ctx.done();
    };
    H.wTeacher = function (d) { var t = teamByNo(d.n), v = prompt(teamName(t) + " 小隊老師姓名：", t.teacher); if (v === null || !v.trim()) return; teamRec(t).teacher = v.trim(); ctx.done(); };
    H.wCls = function (d, el) { ui.cls = el.value; ctx.render(); };
    H.wSearch = function () { ui.q = (document.getElementById("wq").value || "").trim(); ctx.render(); };
    H.wPw = function (d) {
      var t = teamByNo(d.n), isT = d.k === "tpw", cur = isT ? pwT(t) : pwS(t);
      var v = prompt(teamName(t) + (isT ? " 教師端" : " 學生端") + "密碼（目前：" + cur + "）\n輸入新密碼；留空＝還原預設（" + defPw(t) + "）", ""); if (v === null) return;
      var r = rec(t); if (!r) { r = { id: "t" + t.no, name: teamName(t), leader: t.roles.leader }; KC.S.teams.push(r); }
      v = v.trim(); if (v) r[d.k] = v; else delete r[d.k]; ctx.done();
    };
    H.wSeed = function () { if (!confirm("依這份小隊名單建立學員（學生端登入身分）與編組？已存在的學員不會被覆蓋，只補上缺的人與小隊。")) return; var r = seed(); ctx.done(); alert("完成：新增 " + r.added + " 位學員，補齊 " + r.upd + " 筆資料"); };
    H.wExp = function () {
      var rows = [["小隊", "小隊編號", "班級", "小隊老師", "職務", "姓名", "學號"]];
      D.teams.forEach(function (t) { ROLES.forEach(function (r) { rows.push([t.no, codeOf(t), t.cls, t.teacher, r[1], t.roles[r[0]], t.ids[r[0]]]); }); var h = hbOf(t); if (h) rows.push([t.no, codeOf(t), t.cls, t.teacher, "手冊編輯(全班)", h.name, h.id]); t.members.forEach(function (m) { rows.push([t.no, codeOf(t), t.cls, t.teacher, "組員", m, ""]); }); });
      var csv = "﻿" + rows.map(function (r) { return r.map(function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }).join(","); }).join("\r\n");
      var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "G10小隊名單與幹部.csv"; document.body.appendChild(a); a.click(); a.remove();
    };
  }
  /* 所有模組掛載完成後，依角色整理分頁：學生＝閱覽＋請假＋留言；教師＝閱覽＋點名＋裝備檢核＋留言 */
  function finish(role, tabs) {
    var keep = { student: ["hub", "crew", "leave", "msg"], teacher: ["hub", "crew", "duty", "dreport", "lvn", "roll", "msg"] }[role]; if (!keep) return;
    var by = {}; tabs.forEach(function (x) { by[x[0]] = x; });
    tabs.length = 0; keep.forEach(function (k) { if (by[k]) tabs.push(by[k]); });
  }
  return { mount: mount, finish: finish, enabled: true, scopeTeam: scopeTeam, seedRoster: seed, cadreRoles: cadreRoles, cadreTitle: cadreTitle, tabsFor: tabsFor };
})();
