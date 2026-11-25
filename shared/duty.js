/* G10 單車環臺：小隊幹部入口（教師端）＋ 幹部回報（行政端）
   小隊長：點名／裝備檢核　副小隊長：行為表現／特殊狀況　環保長：午餐前後照片　資訊長：每日訓練照片（5 張）　行政長：正式活動 10 天手冊資料
   資料存在 att["<類型>:pt<次>"]["t<小隊>"]（團隊層級）或 [學生id]（個人層級）；照片檔存 KCH（雲端 photos／單機 IndexedDB）。 */
var KCD = (function () {
  var E = KC.esc, D = window.G10_CREW;
  if (window.ACT !== "g10" || !D) return { enabled: false };
  var TR = [["2025-12-06", "第1次"], ["2025-12-20", "第2次"], ["2026-01-11", "第3次"], ["2026-03-07", "第4次"], ["2026-03-15", "第5次"], ["2026-03-21", "第6次"]];
  var RL = [["leader", "🧭 小隊長", "小隊員點名、裝備檢核"], ["vice", "🤝 副小隊長", "小隊員行為表現、特殊狀況記錄"], ["eco", "🌱 環保長", "中午用餐點拍照回報（用餐前、用餐後各一張）"], ["info", "📷 資訊長", "每日訓練照片上傳（5 張）"], ["admin", "📋 行政長", "正式活動每日手冊資料上傳（主活動 10 天）"]];
  var BEH = ["優良", "良好", "尚可", "需關注"], BCLS = { 優良: "ok", 良好: "ok", 尚可: "wn", 需關注: "no" };
  var ui = { n: 1, role: "leader", team: "", day: 0 }, ROLE = "", ctxRef = null;
  var FMAX = function () { return KC.mode === "cloud" ? 600 * 1024 : 5 * 1024 * 1024; };
  function sess(n) { return "pt" + (n || ui.n); }
  function myTid() { if (ROLE === "student") { var m = ctxRef.me(); return m ? m.team : ""; } return ROLE === "teacher" ? (window.KCW && KCW.scopeTeam("teacher")) : ui.team; }
  function allowed() { if (ROLE === "student") return (window.KCW && KCW.cadreRoles(ctxRef.me())) || []; return RL.map(function (r) { return r[0]; }); }
  function tinfo(tid) { return D.teams.filter(function (t) { return "t" + t.no === tid; })[0]; }
  function rec(kind, key, create) {
    var A = KC.S.att, k = kind + ":" + sess(), m = A[k] = A[k] || {};
    if (!m[key] && create) m[key] = {}; return m[key];
  }
  function stamp() { return new Date().toLocaleString("zh-TW", { hour12: false }); }
  function ensureSessions() {
    var S = KC.S, ch = false;
    TR.forEach(function (t, i) { var id = "pt" + (i + 1), ex = S.sessions.filter(function (x) { return x.id === id; })[0]; if (ex) t[0] = ex.date; if (!ex) { S.sessions.push({ id: id, title: "第" + (i + 1) + "次行前訓練", date: t[0] }); ch = true; } });
    return ch;
  }
  function nl(x) { return E(x).replace(/\n/g, "<br>"); }

  /* ---------- 圖片處理 ---------- */
  function load(file) { return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = function () { rej(fr.error); }; fr.readAsDataURL(file); }); }
  function shrink(file, max, q) {
    return load(file).then(function (u) { return new Promise(function (res, rej) {
      var im = new Image(); im.onload = function () { var s = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL("image/jpeg", q)); };
      im.onerror = function () { rej(new Error("不是有效的圖片")); }; im.src = u; }); });
  }
  function photo(file) {      /* → {big, thumb}；大圖壓到 FMAX 以內 */
    var lim = Math.min(FMAX(), 600 * 1024);
    return shrink(file, 1280, .72).then(function (big) { var q = .6; return (function again(b) { if (b.length * .75 <= lim || q < .3) return b; q -= .1; return shrink(file, 1000, q).then(again); })(big); })
      .then(function (big) { return shrink(file, 220, .6).then(function (th) { return { big: big, thumb: th }; }); });
  }
  function showPhoto(pid, thumb) {
    var o = document.createElement("div"); o.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:80;display:flex;align-items:center;justify-content:center;padding:16px;cursor:zoom-out";
    o.innerHTML = '<div style="text-align:center"><img src="' + E(thumb || "") + '" style="max-width:100%;max-height:82vh;border-radius:10px"><div style="margin-top:10px"><a class="dl" style="color:#fff;border:1px solid #fff;border-radius:99px;padding:6px 16px;text-decoration:none" download="photo.jpg">下載原圖</a>　<span style="color:#fff;opacity:.7">點任一處關閉</span></div></div>'; o.onclick = function (e) { if (!e.target.classList.contains("dl")) o.remove(); }; document.body.appendChild(o);
    KCH.get(pid).then(function (u) { if (u) { o.querySelector("img").src = u; o.querySelector(".dl").href = u; } });
  }

  var css = document.createElement("style");
  css.textContent = ".dpill{display:inline-block;border:1px solid var(--line);border-radius:99px;padding:6px 12px;margin:3px;cursor:pointer;background:#fff;font-size:14px}.dpill.on{background:var(--ac,#7b4fa0);color:#fff;border-color:var(--ac,#7b4fa0)}" +
    ".dph{display:inline-block;position:relative;margin:4px}.dph img{width:104px;height:104px;object-fit:cover;border-radius:10px;border:1px solid var(--line);cursor:zoom-in;display:block}.dph .x{position:absolute;top:-6px;right:-6px;border-radius:50%;width:24px;height:24px;padding:0;line-height:22px}" +
    ".dbeh button{padding:4px 10px;margin:2px;border:1px solid var(--line);border-radius:99px;background:#fff;cursor:pointer}.dbeh button.on{color:#fff}.dbeh button.on.ok{background:#2e9e5b}.dbeh button.on.wn{background:#e0a21b}.dbeh button.on.no{background:#d9534f}";
  document.head.appendChild(css);

  /* ---------- 教師端：幹部入口 ---------- */
  function pills(o) {
    return '<div>' + TR.map(function (t, i) { return '<span class="dpill' + (ui.n === i + 1 ? " on" : "") + '" data-do="dN" data-n="' + (i + 1) + '">' + t[1] + '<br><small>' + t[0].slice(2) + "</small></span>"; }).join("") + "</div>";
  }
  function rolePills(t) {
    return '<div style="margin-top:6px">' + RL.filter(function (r) { return allowed().indexOf(r[0]) >= 0; }).map(function (r) { return '<span class="dpill' + (ui.role === r[0] ? " on" : "") + '" data-do="dRole" data-r="' + r[0] + '">' + r[1] + '<br><small>' + E(t.roles[r[0]] || "") + "</small></span>"; }).join("") + "</div>";
  }
  function dutyView() {
    var tid = myTid(), t = tinfo(tid);
    if (!t) return '<div class="card"><p class="mut">找不到小隊資料。</p></div>';
    var al = allowed(); if (!al.length) return '<div class="card"><p class="mut">你不是小隊幹部，沒有幹部任務。</p></div>';
    if (al.indexOf(ui.role) < 0) ui.role = al[0];
    var role = RL.filter(function (r) { return r[0] === ui.role; })[0], body = "";
    var head = '<div class="card"><h3>🎖️ ' + (ROLE === "student" ? "幹部任務" : "小隊幹部入口") + '　<small class="mut">第 ' + t.no + " 小隊</small></h3>" + (ui.role === "admin" ? "" : '<p class="mut" style="margin:0">先選擇訓練場次：</p>' + pills()) + rolePills(t) + '<p class="mut" style="margin:6px 0 0"><b>' + role[1] + "</b>：" + role[2] + "</p></div>";
    return head + ({ leader: leaderV, vice: viceV, eco: ecoV, info: infoV, admin: adminV }[ui.role])(tid, t);
  }
  function members(tid, sid) { return sid ? KC.sessMembers(tid, sid) : KC.S.students.filter(function (s) { return s.team === tid && s.signup; }); }
  function leaderV(tid, t) {
    var x = KC.S.sessions.filter(function (y) { return y.id === sess(); })[0], ms = members(tid, sess()), cnt = { 出席: 0, 遲到: 0, 請假: 0, 缺席: 0, "": 0 };
    ms.forEach(function (s) { cnt[x ? KC.statusFor(x, s) : ""]++; });
    var rows = ms.map(function (s) {
      var cur = x ? KC.statusFor(x, s) : "";
      return "<tr><td>" + E(s.name) + KC.mkTag(sess(), s.id) + '</td><td><div class="seg">' + KC.STATUS.map(function (k, i) { return '<button class="' + (cur === k ? "on s" + i : "") + '" data-do="dMark" data-s="' + E(s.id) + '" data-v="' + k + '">' + k + "</button>"; }).join("") + "</div></td></tr>";
    }).join("");
    return '<div class="card"><h3>小隊員點名　<small class="mut">' + TR[ui.n - 1][1] + "行前訓練 " + TR[ui.n - 1][0] + '</small></h3><p class="mut">出席 ' + cnt.出席 + "　遲到 " + cnt.遲到 + "　請假 " + cnt.請假 + "　缺席 " + cnt.缺席 + "　未點 " + cnt[""] + '（已核准請假自動帶入）</p><div class="row"><button class="sec" data-do="dAllIn">未點名者全部出席</button><button class="dng" data-do="dClr">一鍵取消點名</button></div><div class="scroll"><table><tr><th>姓名</th><th>狀態</th></tr>' + rows + "</table></div></div>" +
      '<div class="card"><h3>裝備檢核</h3><p class="mut">依「裝備檢核表」逐位檢查本小隊隊員的必帶裝備。</p><div class="row"><button class="pri" data-do="dGear">開啟本場次裝備檢核 →</button></div></div>';
  }
  function viceV(tid, t) {
    var ms = members(tid), B = rec("beh", "_"), A = KC.S.att["beh:" + sess()] || {}, sp = (rec("sp", tid) || {}).items || [];
    var rows = ms.map(function (s) {
      var r = A[s.id] || {};
      return "<tr><td>" + E(s.name) + '</td><td class="dbeh">' + BEH.map(function (k) { return '<button class="' + BCLS[k] + (r.r === k ? " on" : "") + '" data-do="dBeh" data-s="' + E(s.id) + '" data-v="' + k + '">' + k + "</button>"; }).join("") + '</td><td><input data-dnote="' + E(s.id) + '" placeholder="行為說明（選填）" value="' + E(r.note || "") + '" style="width:100%;min-width:140px"></td></tr>';
    }).join("");
    return '<div class="card"><h3>小隊員行為表現　<small class="mut">' + TR[ui.n - 1][1] + "行前訓練</small></h3><div class=\"scroll\"><table><tr><th>姓名</th><th>表現</th><th>說明</th></tr>" + rows + "</table></div></div>" +
      '<div class="card"><h3>特殊狀況記錄</h3><div class="row"><select id="dsp_s"><option value="">（全隊／非特定隊員）</option>' + ms.map(function (s) { return '<option value="' + E(s.id) + '">' + E(s.name) + "</option>"; }).join("") + '</select></div><textarea id="dsp_t" placeholder="例：身體不適、擦傷、單車故障、遲到原因…"></textarea><div class="row"><button class="pri" data-do="dSpAdd">新增記錄</button></div>' +
      (sp.slice().reverse().map(function (it) { var s = KC.student(it.sid); return '<div class="nt"><div class="mut">' + E(it.at) + (s ? "　" + E(s.name) : "") + ' <button class="sm dng" data-do="dSpDel" data-id="' + E(it.id) + '">刪除</button></div>' + nl(it.text) + "</div>"; }).join("") || '<p class="mut">本場次尚無記錄</p>') + "</div>";
  }
  function phBox(p, kind, extra) {
    return '<span class="dph"><img src="' + E(p.thumb) + '" alt="" data-do="dView" data-pid="' + E(p.pid) + '" data-th="' + E(p.thumb) + '"><button class="dng x" data-do="dPhDel" data-k="' + kind + '" data-id="' + E(p.id) + '"' + (extra || "") + '>×</button></span>';
  }
  function ecoV(tid) {
    var r = rec("eco", tid) || {};
    function slot(k, lab) { return '<div style="margin:8px 0"><b>' + lab + "</b><div>" + (r[k] ? phBox(r[k], k) : '<span class="mut">尚未上傳</span>') + '</div><input type="file" accept="image/*" capture="environment" data-dup="eco" data-k="' + k + '"></div>'; }
    return '<div class="card"><h3>午餐用餐點拍照回報　<small class="mut">' + TR[ui.n - 1][1] + "行前訓練</small></h3><p class=\"mut\">用餐前、用餐後各拍一張，確認環境整潔。重新選檔會取代舊照片。</p>" + slot("before", "🍱 用餐前") + slot("after", "🧹 用餐後") +
      '<input id="deco_n" placeholder="備註（選填，例：用餐地點）" value="' + E(r.note || "") + '" style="width:100%" data-dnote2="eco"></div>';
  }
  function vidList(r, del) {
    var L = (r && r.vids) || [];
    return L.map(function (v) { return '<div class="row" style="gap:6px;align-items:flex-start"><span>🎬 <a href="' + E(v.url) + '" target="_blank" rel="noopener">' + E(v.title || "觀看影片") + "</a> <small class=\"mut\">" + v.min + " 分鐘　" + E(v.at || "") + "</small>" + (v.note ? "<br><small>備註：" + E(v.note) + "</small>" : "") + "</span>" + (del ? '<button class="sm dng" data-do="dVidDel" data-id="' + E(v.id) + '">刪除</button>' : "") + "</div>"; }).join("");
  }
  function infoV(tid) {
    var r = rec("info", tid) || {}, L = r.list || [], left = 5 - L.length;
    return '<div class="card"><h3>每日訓練照片　<small class="mut">' + TR[ui.n - 1][1] + "行前訓練（" + L.length + '/5）</small></h3>' + (L.length ? "<div>" + L.map(function (p) { return phBox(p, "info"); }).join("") + "</div>" : '<p class="mut">尚未上傳</p>') +
      (left > 0 ? '<div class="row"><input type="file" accept="image/*" multiple data-dup="info"><span class="mut">還可上傳 ' + left + " 張</span></div>" : '<p class="mut">已達 5 張上限；刪除後可再上傳。</p>') + "</div>" +
      '<div class="card"><h3>🎬 訓練影片　<small class="mut">' + TR[ui.n - 1][1] + "行前訓練（" + ((r.vids || []).length) + '/3，每支最長 5 分鐘）</small></h3>' + (vidList(r, true) || '<p class="mut">尚未上傳</p>') +
      ((r.vids || []).length < 3 ? '<p class="mut" style="margin:6px 0">請先把影片上傳到雲端硬碟（Google 雲端硬碟／YouTube 不公開等），將「分享連結」貼在下方（權限需設為「知道連結的人可檢視」）。</p><div class="row"><input id="dvu" placeholder="影片雲端連結（https://…）" style="min-width:200px;flex:1"></div><div class="row"><input id="dvt" placeholder="影片名稱（選填）"><select id="dvm">' + [1, 2, 3, 4, 5].map(function (m) { return '<option value="' + m + '"' + (m === 5 ? " selected" : "") + ">長度 " + m + " 分鐘" + (m === 5 ? "（上限）" : "") + "</option>"; }).join("") + '</select></div><div class="row"><input id="dvn" placeholder="備註（拍攝內容、人物、地點…）" style="min-width:200px;flex:1"><button data-do="dVidAdd">新增影片</button></div>' : '<p class="mut">已達 3 支上限；刪除後可再新增。</p>') + "</div>";
  }
  function adminV(tid) {
    var r = (KC.S.att["hb:main"] || {})[tid] || {};
    var days = []; for (var d = 1; d <= 10; d++) days.push(d);
    return '<div class="card"><h3>正式活動手冊資料上傳</h3><p class="mut">主活動共 10 天，請依天數上傳當天的手冊資料（照片或 PDF）。單檔上限 ' + Math.round(FMAX() / 1024) + " KB；較大的檔案請改存雲端硬碟再回報行政。</p></div>" +
      days.map(function (d) {
        var L = r["d" + d] || [];
        return '<div class="card"><h4 style="margin:0 0 6px">Day ' + d + ' <small class="mut">（' + L.length + " 個檔案）</small></h4>" + (L.map(function (f) {
          return '<div class="row" style="gap:6px"><a href="#" data-do="dHbDl" data-pid="' + E(f.pid) + '" data-n="' + E(f.name) + '">📄 ' + E(f.name) + '</a><span class="mut">' + Math.round(f.size / 1024) + " KB　" + E(f.at) + '</span><button class="sm dng" data-do="dHbDel" data-d="' + d + '" data-id="' + E(f.id) + '">刪除</button></div>';
        }).join("") || '<p class="mut" style="margin:0">尚未上傳</p>') + '<div class="row"><input type="file" accept="image/*,application/pdf" multiple data-dup="hb" data-d="' + d + '"></div></div>';
      }).join("");
  }

  /* ---------- 任務檢核（行政端＝全部小隊；教師端＝自己小隊）---------- */
  function A_() { return KC.S.att; }
  function comp(tid, n) {       /* 某小隊在第 n 次訓練的各項任務完成度；手冊為正式活動 10 天的累計 */
    var A = A_(), sid = "pt" + n, ms = members(tid, sid), x = KC.S.sessions.filter(function (y) { return y.id === sid; })[0];
    var marked = x ? ms.filter(function (s) { return KC.statusFor(x, s); }).length : 0;
    var beh = A["beh:" + sid] || {}, nb = ms.filter(function (s) { return beh[s.id] && beh[s.id].r; }).length;
    var eco = (A["eco:" + sid] || {})[tid] || {}, ne = (eco.before ? 1 : 0) + (eco.after ? 1 : 0);
    var inf = (((A["info:" + sid] || {})[tid]) || {}).list || [], hb = (A["hb:main"] || {})[tid] || {}, nh = 0;
    for (var d = 1; d <= 10; d++) if ((hb["d" + d] || []).length) nh++;
    var gk = A["gear:" + sid] || {}, gdone = !!(gk["T:" + tid] && gk["T:" + tid].done);
    return { att: [marked, ms.length], gear: [gdone ? 1 : 0, 1], beh: [nb, ms.length], eco: [ne, 2], info: [inf.length, 5], hb: [nh, 10], n: ms.length };
  }
  var COLS = [["att", "點名"], ["gear", "裝備檢核"], ["beh", "隊員表現"], ["eco", "午餐場地照"], ["info", "訓練照片"], ["hb", "手冊(10天)"]];
  function chip(v, label) {
    var st = v[1] && v[0] >= v[1] ? 2 : v[0] > 0 ? 1 : 0, bg = st === 2 ? "#2e9e5b" : st === 1 ? "#e0a21b" : "#d9534f", tx = st === 2 ? "✔" : v[0] + "/" + v[1];
    if (label === "gear") tx = st === 2 ? "✔ 已確認" : "未確認";
    return '<span class="badge" style="background:' + bg + ';color:#fff;white-space:nowrap">' + tx + "</span>";
  }
  function allDone(c, withHb) { return COLS.every(function (k) { return (k[0] === "hb" && !withHb) || (c[k[0]][1] && c[k[0]][0] >= c[k[0]][1]); }); }
  function phView(p) { return '<span class="dph"><img src="' + E(p.thumb) + '" alt="" data-do="dView" data-pid="' + E(p.pid) + '" data-th="' + E(p.thumb) + '"></span>'; }
  function detailHtml(tid) {
    var t = tinfo(tid), A = A_(), sid = sess(), x = KC.S.sessions.filter(function (y) { return y.id === sid; })[0], ms = members(tid, sid), h = "";
    var c = { 出席: [], 遲到: [], 請假: [], 缺席: [], 未點: [] };
    ms.forEach(function (s) { var st = x ? KC.statusFor(x, s) : ""; c[st || "未點"].push(s.name); });
    h += '<div class="card"><h3>第 ' + t.no + " 小隊（" + E(t.teacher) + "）　" + TR[ui.n - 1][1] + "行前訓練 " + TR[ui.n - 1][0] + "</h3>";
    h += "<h4>🧭 出缺席（小隊長：" + E(t.roles.leader || "—") + "）</h4><p>出席 <b>" + c.出席.length + "</b>　遲到 <b>" + c.遲到.length + "</b>　請假 <b>" + c.請假.length + "</b>　缺席 <b>" + c.缺席.length + "</b>　未點 <b>" + c.未點.length + "</b></p>" +
      ["缺席", "遲到", "請假", "未點"].map(function (k) { return c[k].length ? '<p class="mut" style="margin:0"><b>' + k + "：</b>" + c[k].map(E).join("、") + "</p>" : ""; }).join("");
    var gk = A["gear:" + sid] || {}, miss = {}; ms.forEach(function (s) { var r = gk[s.id]; if (r && r.m) Object.keys(r.m).forEach(function (k) { (miss[k] = miss[k] || []).push(s.name); }); });
    h += "<h4>🧰 裝備檢核" + (gk["T:" + tid] ? ' <span class="badge ok">已確認完成</span>' : ' <span class="badge wn">尚未確認</span>') + "</h4>" + (Object.keys(miss).length ? Object.keys(miss).map(function (k) { return '<p class="mut" style="margin:0"><b>' + E(KCG.NAME[k] || k) + "（" + miss[k].length + "）：</b>" + miss[k].map(E).join("、") + "</p>"; }).join("") : '<p class="mut">無未帶品項</p>');
    var beh = A["beh:" + sid] || {}, sp = (((A["sp:" + sid] || {})[tid]) || {}).items || [];
    h += "<h4>🤝 隊員表現與特殊狀況（副小隊長：" + E(t.roles.vice || "—") + "）</h4>" + (ms.filter(function (s) { return beh[s.id] && beh[s.id].r; }).length ? '<div class="scroll"><table class="gt">' + ms.filter(function (s) { return beh[s.id] && beh[s.id].r; }).map(function (s) { var b = beh[s.id]; return "<tr><td>" + E(s.name) + '</td><td><span class="badge ' + (BCLS[b.r] || "gr") + '">' + E(b.r) + "</span></td><td>" + E(b.note || "") + "</td></tr>"; }).join("") + "</table></div>" : '<p class="mut">尚未填寫</p>') +
      (sp.map(function (it) { var s = KC.student(it.sid); return '<div class="nt"><div class="mut">' + E(it.at) + (s ? "　" + E(s.name) : "") + "</div>" + nl(it.text) + "</div>"; }).join("") || '<p class="mut">無特殊狀況記錄</p>');
    var eco = (A["eco:" + sid] || {})[tid] || {}, inf = (((A["info:" + sid] || {})[tid]) || {}).list || [];
    h += "<h4>🌱 午餐用餐場地照片（環保長：" + E(t.roles.eco || "—") + "）</h4>" + ((eco.before || eco.after) ? ["before", "after"].map(function (k) { return eco[k] ? "<span><b>" + (k === "before" ? "用餐前" : "用餐後") + "</b><br>" + phView(eco[k]) + "</span>" : ""; }).join("") + (eco.note ? '<p class="mut">' + E(eco.note) + "</p>" : "") : '<p class="mut">尚未上傳</p>');
    h += "<h4>📷 訓練照片（資訊長：" + E(t.roles.info || "—") + "，" + inf.length + "/5）</h4>" + (inf.map(phView).join("") || '<p class="mut">尚未上傳</p>') + vidList((A["info:" + sid] || {})[tid]) + "</div>";
    var hb = (A["hb:main"] || {})[tid] || {};
    h += '<div class="card"><h4 style="margin:0 0 6px">📋 正式活動手冊資料（行政長：' + E(t.roles.admin || "—") + "）</h4>" + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (d) { var L = hb["d" + d] || []; return "<div><b>Day " + d + "</b>　" + (L.map(function (f) { return '<a href="#" data-do="dHbDl" data-pid="' + E(f.pid) + '" data-n="' + E(f.name) + '">📄 ' + E(f.name) + "</a>"; }).join("　") || '<span class="mut">—</span>') + "</div>"; }).join("") + "</div>";
    return h;
  }
  function reportView() {
    var isT = ROLE === "teacher", mine = isT ? (window.KCW && KCW.scopeTeam("teacher")) : "";
    if (isT) ui.team = mine;
    var tid = ui.team, ts = isT ? D.teams.filter(function (t) { return "t" + t.no === mine; }) : D.teams;
    var head = '<div class="card"><h3>✅ 任務檢核' + (isT ? "（本小隊）" : "（全部小隊）") + '</h3><p class="mut" style="margin:0 0 6px">選擇訓練場次，查看各幹部的任務完成狀況。</p>' + pills() + "</div>";
    var rows = ts.map(function (t) {
      var id = "t" + t.no, c = comp(id, ui.n), okAll = allDone(c, false);
      return '<tr style="' + (okAll ? "" : "background:rgba(217,83,79,.07)") + '"><td><a href="#" data-do="dTeamGo" data-t="' + id + '"><b>第 ' + t.no + " 隊</b></a><br><small class=\"mut\">" + E(t.teacher) + "</small></td>" + COLS.map(function (k) { return '<td style="text-align:center">' + chip(c[k[0]], k[0]) + "</td>"; }).join("") + '<td style="text-align:center">' + (okAll ? '<span class="badge ok">全部完成</span>' : '<span class="badge no">未完成</span>') + "</td></tr>";
    });
    var nDone = ts.filter(function (t) { return allDone(comp("t" + t.no, ui.n), false); }).length;
    var matrix = '<div class="card"><h3>' + TR[ui.n - 1][1] + "行前訓練　任務完成總表</h3><p>" + (isT ? "" : "已全部完成 <b>" + nDone + "</b> / " + ts.length + " 個小隊；<b style=\"color:#d9534f\">" + (ts.length - nDone) + "</b> 個小隊尚有未完成。") + '</p><div class="scroll"><table class="gt"><tr><th>小隊</th>' + COLS.map(function (k) { return '<th style="text-align:center">' + k[1] + "</th>"; }).join("") + '<th style="text-align:center">本次</th></tr>' + rows.join("") + '</table></div><p class="mut">✔ 完成　<span style="color:#e0a21b">黃</span>＝部分完成（已完成數/應完成數）　<span style="color:#d9534f">紅</span>＝尚未開始。點小隊名稱看明細。「手冊(10天)」為正式活動資料，不計入「本次」。</p></div>';
    var sel = isT ? "" : '<div class="card"><div class="row"><select data-do="dTeamSel"><option value="">（選擇小隊查看明細）</option>' + D.teams.map(function (t) { return '<option value="t' + t.no + '"' + (tid === "t" + t.no ? " selected" : "") + ">第 " + t.no + " 小隊（" + E(t.teacher) + "）</option>"; }).join("") + "</select></div></div>";
    return head + matrix + sel + (tid ? detailHtml(tid) : (isT ? "" : '<div class="card"><p class="mut">點總表中的小隊名稱，或從上方選單選擇，查看該小隊的個別資料。</p></div>'));
  }
  /* ---------- 照片分享（學生端／教師端）：每次行前訓練資訊長上傳的照片 ---------- */
  function photosView() {
    var A = A_(), h = '<div class="card"><h3>📷 行前訓練照片分享</h3><p class="mut" style="margin:0">依訓練場次整理各小隊資訊長上傳的照片，點照片可放大下載。</p></div>';
    TR.forEach(function (t, i) {
      var m = A["info:pt" + (i + 1)] || {}, tids = Object.keys(m).filter(function (k) { return (m[k].list || []).length; }).sort(function (a, b) { return +a.slice(1) - +b.slice(1); });
      var total = tids.reduce(function (a, k) { return a + m[k].list.length; }, 0);
      h += '<div class="card"><h3>' + t[1] + "行前訓練 <small class=\"mut\">" + t[0] + "　" + total + " 張</small></h3>" + (tids.length ? tids.map(function (k) { var tm = tinfo(k); return "<div><b>第 " + (tm ? tm.no : k) + " 小隊</b>" + (tm ? ' <small class="mut">' + E(tm.teacher) + "</small>" : "") + "<br>" + m[k].list.map(phView).join("") + "</div>"; }).join("") : '<p class="mut">尚無照片</p>') + "</div>";
    });
    return h;
  }

  /* ---------- 行政端：幹部上傳檢核（行政長手冊／資訊長訓練照片／環保長用餐照片），可選分次或全部、分小隊或所有小隊 ---------- */
  var CK = { hb: { team: "", day: 0 }, info: { team: "", n: 0 }, eco: { team: "", n: 0 } };
  function ckTeams(k) { return D.teams.filter(function (t) { return !CK[k].team || "t" + t.no === CK[k].team; }); }
  function ckCtl(k) {
    var c = CK[k], h = '<div class="card"><div class="row"><select data-do="cT" data-k="' + k + '"><option value="">全部小隊（' + D.teams.length + "）</option>" + D.teams.map(function (t) { return '<option value="t' + t.no + '"' + (c.team === "t" + t.no ? " selected" : "") + ">第 " + t.no + " 小隊（" + E(t.teacher) + "）</option>"; }).join("") + "</select>";
    if (k === "hb") h += '<select data-do="cD" data-k="hb"><option value="0">全部 10 天</option>' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (d) { return '<option value="' + d + '"' + (c.day === d ? " selected" : "") + ">Day " + d + "</option>"; }).join("") + "</select>";
    h += "</div>";
    if (k !== "hb") h += '<div class="seg" style="margin-top:6px;flex-wrap:wrap"><button class="' + (c.n === 0 ? "on s2" : "") + '" data-do="cN2" data-k="' + k + '" data-n="0">全部 6 次</button>' + TR.map(function (t, i) { return '<button class="' + (c.n === i + 1 ? "on s2" : "") + '" data-do="cN2" data-k="' + k + '" data-n="' + (i + 1) + '">' + t[1] + "<br><small>" + E(t[0].slice(5)) + "</small></button>"; }).join("") + "</div>";
    return h + "</div>";
  }
  function ckChip(n, m) { var st = m && n >= m ? 2 : n > 0 ? 1 : 0; return '<span class="badge" style="background:' + (st === 2 ? "#2e9e5b" : st === 1 ? "#e0a21b" : "#d9534f") + ';color:#fff;white-space:nowrap">' + (st === 2 ? "✔" : "") + n + (m ? "/" + m : "") + "</span>"; }
  function hbCheck() {
    ensureSessions(); var c = CK.hb, ts = ckTeams("hb"), days = c.day ? [c.day] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    var full = 0, tot = ts.map(function (t) { var hb = (A_()["hb:main"] || {})["t" + t.no] || {}, n = 0; days.forEach(function (d) { if ((hb["d" + d] || []).length) n++; }); if (n === days.length) full++; return n; });
    var h = ckCtl("hb") + '<div class="card"><h3>📋 行政長：正式活動手冊繳交檢核</h3><p>' + (c.day ? "Day " + c.day : "10 天") + " 已繳交完成的小隊 <b>" + full + "</b> / " + ts.length + "；尚未完成 <b style=\"color:#d9534f\">" + (ts.length - full) + '</b> 隊。</p><div class="scroll"><table class="gt"><tr><th>小隊</th><th>行政長</th>' + days.map(function (d) { return '<th style="text-align:center">D' + d + "</th>"; }).join("") + "<th>完成</th></tr>" +
      ts.map(function (t, i) { var id = "t" + t.no, hb = (A_()["hb:main"] || {})[id] || {}; return '<tr style="' + (tot[i] === days.length ? "" : "background:rgba(217,83,79,.07)") + '"><td><a href="#" data-do="cTeam" data-k="hb" data-t="' + id + '"><b>第 ' + t.no + " 隊</b></a></td><td>" + E(t.roles.admin || "—") + "</td>" + days.map(function (d) { var n = (hb["d" + d] || []).length; return '<td style="text-align:center">' + (n ? '<span class="badge ok">' + n + "</span>" : '<span class="badge no">✘</span>') + "</td>"; }).join("") + '<td style="text-align:center">' + ckChip(tot[i], days.length) + "</td></tr>"; }).join("") + "</table></div></div>";
    if (c.team || c.day) h += ts.map(function (t) { var id = "t" + t.no, hb = (A_()["hb:main"] || {})[id] || {}; return '<div class="card"><h4 style="margin:0 0 6px">第 ' + t.no + " 小隊（行政長：" + E(t.roles.admin || "—") + "）</h4>" + days.map(function (d) { var L = hb["d" + d] || []; return "<div><b>Day " + d + "</b>　" + (L.map(function (f) { return '<a href="#" data-do="dHbDl" data-pid="' + E(f.pid) + '" data-n="' + E(f.name) + '">📄 ' + E(f.name) + "</a>"; }).join("　") || '<span class="mut">—</span>') + "</div>"; }).join("") + "</div>"; }).join("");
    return h;
  }
  function photoCheck(k) {
    ensureSessions(); var c = CK[k], ts = ckTeams(k), ns = c.n ? [c.n] : [1, 2, 3, 4, 5, 6], need = k === "info" ? 5 : 2;
    var get = function (t, n) { var v = ((A_()[k + ":pt" + n] || {})["t" + t.no]) || {}; return k === "info" ? (v.list || []) : [v.before ? { l: "用餐前", p: v.before } : null, v.after ? { l: "用餐後", p: v.after } : null].filter(Boolean); };
    var okT = ts.filter(function (t) { return ns.every(function (n) { return get(t, n).length >= need; }); }).length;
    var title = k === "info" ? "📷 資訊長：行前訓練照片／影片上傳檢核（每次 5 張）" : "🌱 環保長：午餐用餐前後照片上傳檢核（每次 2 張）";
    var h = ckCtl(k) + '<div class="card"><h3>' + title + "</h3><p>" + (c.n ? TR[c.n - 1][1] : "全部 6 次") + " 全部繳交完成的小隊 <b>" + okT + "</b> / " + ts.length + "；尚未完成 <b style=\"color:#d9534f\">" + (ts.length - okT) + '</b> 隊。</p><div class="scroll"><table class="gt"><tr><th>小隊</th><th>' + (k === "info" ? "資訊長" : "環保長") + "</th>" + ns.map(function (n) { return '<th style="text-align:center;font-size:12px">' + E(TR[n - 1][1]) + "<br>" + E(TR[n - 1][0].slice(5)) + "</th>"; }).join("") + "</tr>" +
      ts.map(function (t) { var done = ns.every(function (n) { return get(t, n).length >= need; }); return '<tr style="' + (done ? "" : "background:rgba(217,83,79,.07)") + '"><td><a href="#" data-do="cTeam" data-k="' + k + '" data-t="t' + t.no + '"><b>第 ' + t.no + " 隊</b></a></td><td>" + E(t.roles[k === "info" ? "info" : "eco"] || "—") + "</td>" + ns.map(function (n) { var nv = k === "info" ? (((A_()["info:pt" + n] || {})["t" + t.no] || {}).vids || []).length : 0; return '<td style="text-align:center">' + ckChip(get(t, n).length, need) + (nv ? ' <span class="badge" style="background:#4a7bd0;color:#fff">🎬' + nv + "</span>" : "") + "</td>"; }).join("") + "</tr>"; }).join("") + "</table></div></div>";
    if (c.team || c.n) h += ts.map(function (t) { var body = ns.map(function (n) { var L = get(t, n); return "<div><b>" + E(TR[n - 1][1]) + "（" + E(TR[n - 1][0]) + "）</b><br>" + (L.length ? L.map(function (x) { return k === "info" ? phView(x) : "<span><small>" + x.l + "</small><br>" + phView(x.p) + "</span>"; }).join("") : '<span class="mut">尚未上傳</span>') + (k === "info" ? vidList((A_()["info:pt" + n] || {})["t" + t.no]) : "") + "</div>"; }).join(""); return '<div class="card"><h4 style="margin:0 0 6px">第 ' + t.no + " 小隊</h4>" + body + "</div>"; }).join("");
    return h;
  }
  /* ---------- 掛載與事件 ---------- */
  function mount(role, ctx) {
    ROLE = role; ctxRef = ctx;
    var tabs = ctx.TABS;
    if (role === "teacher" || role === "student") {
      var i = tabs.map(function (x) { return x[0]; }).indexOf("crew"); tabs.splice(i < 0 ? tabs.length : i + 1, 0, ["duty", role === "student" ? "🎖️ 幹部任務" : "🎖️ 幹部入口"]); ctx.V.duty = function () { if (ensureSessions()) KC.save(); return dutyView(); };
      if (role === "teacher") { tabs.push(["dreport", "✅ 任務檢核"]); ctx.V.dreport = function () { if (ensureSessions()) KC.save(); return reportView(); }; }
    } else { var j = tabs.map(function (x) { return x[0]; }).indexOf("gear"); tabs.splice(j < 0 ? tabs.length : j + 1, 0, ["dreport", "✅ 任務檢核"]); ctx.V.dreport = function () { if (ensureSessions()) KC.save(); return reportView(); }; }
    var H = ctx.H;
    if (role === "admin") {
      var ia = tabs.map(function (x) { return x[0]; }).indexOf("dreport");
      tabs.splice(ia + 1, 0, ["ck_hb", "📋 手冊檢核"], ["ck_info", "📷 資訊長檢核"], ["ck_eco", "🌱 環保長檢核"]);
      ctx.V.ck_hb = hbCheck; ctx.V.ck_info = function () { return photoCheck("info"); }; ctx.V.ck_eco = function () { return photoCheck("eco"); };
    }
    H.cT = function (d, el) { CK[d.k].team = el.value; ctx.render(); };
    H.cD = function (d, el) { CK.hb.day = +el.value; ctx.render(); };
    H.cN2 = function (d) { CK[d.k].n = +d.n; ctx.render(); };
    H.cTeam = function (d, el, ev) { if (ev) ev.preventDefault(); CK[d.k].team = d.t; ctx.render(); };
    H.dN = function (d) { ui.n = +d.n; ctx.render(); };
    H.dRole = function (d) { ui.role = d.r; ctx.render(); };
    H.dTeamSel = function (d, el) { ui.team = el.value; ctx.render(); };
    H.dTeamGo = function (d, el, ev) { if (ev) ev.preventDefault(); ui.team = d.t; ctx.render(); };
    H.dView = function (d) { showPhoto(d.pid, d.th); };
    H.dGear = function () { if (window.KCG && KCG.setSess) KCG.setSess(sess()); ctx.H.tab({ t: "gear" }); };
    H.dMark = function (d) { var m = KC.S.att[sess()] = KC.S.att[sess()] || {}; if (m[d.s] === d.v) delete m[d.s]; else m[d.s] = d.v; ctx.done(); };
    H.dAllIn = function () { var x = KC.S.sessions.filter(function (y) { return y.id === sess(); })[0], m = KC.S.att[sess()] = KC.S.att[sess()] || {}; members(myTid(), sess()).forEach(function (s) { if (!KC.statusFor(x, s)) m[s.id] = "出席"; }); ctx.done(); };
    H.dClr = function () { var m = KC.S.att[sess()] || {}, ms = members(myTid(), sess()), n = ms.filter(function (s) { return m[s.id]; }).length; if (!n) return alert("目前沒有已點名的紀錄"); if (!confirm("取消本場次 " + n + " 位隊員的點名紀錄？")) return; ms.forEach(function (s) { delete m[s.id]; }); ctx.done(); };
    H.dBeh = function (d) { var m = KC.S.att["beh:" + sess()] = KC.S.att["beh:" + sess()] || {}, r = m[d.s] = m[d.s] || {}; r.r = r.r === d.v ? "" : d.v; r.at = stamp(); ctx.done(); };
    H.dSpAdd = function () { var t = document.getElementById("dsp_t").value.trim(); if (!t) return alert("請輸入內容"); var r = rec("sp", myTid(), true); (r.items = r.items || []).push({ id: KC.uid(), sid: document.getElementById("dsp_s").value, text: t, at: stamp() }); ctx.done(); };
    H.dSpDel = function (d) { var r = rec("sp", myTid()); if (r) r.items = (r.items || []).filter(function (x) { return x.id !== d.id; }); ctx.done(); };
    H.dVidAdd = function () {
      var u = document.getElementById("dvu").value.trim(), m = +document.getElementById("dvm").value;
      if (!/^https:\/\//i.test(u)) return alert("請貼上 https:// 開頭的雲端分享連結");
      if (!(m >= 1 && m <= 5)) return alert("影片長度最多 5 分鐘");
      var r = rec("info", myTid(), true); r.vids = r.vids || []; if (r.vids.length >= 3) return alert("每次訓練最多 3 支影片");
      r.vids.push({ id: KC.uid(), url: u, title: document.getElementById("dvt").value.trim(), min: m, note: document.getElementById("dvn").value.trim(), at: stamp(), by: ui.role });
      ctx.done();
    };
    H.dVidDel = function (d) { if (!confirm("刪除這支影片連結？")) return; var r = rec("info", myTid()); if (r) r.vids = (r.vids || []).filter(function (v) { return v.id !== d.id; }); ctx.done(); };
    H.dPhDel = function (d) {
      if (!confirm("刪除這張照片？")) return; var tid = myTid();
      if (d.k === "info") { var r = rec("info", tid); if (r) { (r.list || []).forEach(function (p) { if (p.id === d.id) KCH.del(p.pid); }); r.list = (r.list || []).filter(function (p) { return p.id !== d.id; }); } }
      else { var e = rec("eco", tid); if (e && e[d.k]) { KCH.del(e[d.k].pid); delete e[d.k]; } }
      ctx.done();
    };
    H.dHbDel = function (d) { if (!confirm("刪除這個檔案？")) return; var r = ((KC.S.att["hb:main"] || {})[myTid()] || {}), L = r["d" + d.d] || []; L.forEach(function (f) { if (f.id === d.id) KCH.del(f.pid); }); r["d" + d.d] = L.filter(function (f) { return f.id !== d.id; }); ctx.done(); };
    H.dHbDl = function (d, el, ev) { if (ev) ev.preventDefault(); KCH.get(d.pid).then(function (u) { if (!u) return alert("找不到檔案"); var a = document.createElement("a"); a.href = u; a.download = d.n; document.body.appendChild(a); a.click(); a.remove(); }); };
    document.addEventListener("change", function (e) {
      var t = e.target, ds = t.dataset || {};
      if (ds.dnote != null) { KC.reload(); var m = KC.S.att["beh:" + sess()] = KC.S.att["beh:" + sess()] || {}, r = m[ds.dnote] = m[ds.dnote] || {}; r.note = t.value.trim(); r.at = stamp(); KC.save(); return; }
      if (ds.dnote2) { KC.reload(); var q = rec("eco", myTid(), true); q.note = t.value.trim(); KC.save(); return; }
      if (!ds.dup || !t.files || !t.files.length) return;
      var files = Array.prototype.slice.call(t.files), tid = myTid(), kind = ds.dup, key = ds.k, day = ds.d; t.value = "";
      var chain = Promise.resolve(), bad = [];
      files.forEach(function (f) {
        chain = chain.then(function () {
          if (kind === "hb") {
            var isImg = /^image\//.test(f.type), pr = isImg ? shrink(f, 1600, .72) : load(f);
            return pr.then(function (u) {
              var size = Math.round(u.length * .75); if (size > FMAX()) { bad.push(f.name + "（" + Math.round(size / 1024) + " KB）"); return; }
              var id = KC.uid(), pid = "hb|" + tid + "|" + id;
              return KCH.put(pid, u).then(function () { ctx.sync(); var a = KC.S.att["hb:main"] = KC.S.att["hb:main"] || {}, r = a[tid] = a[tid] || {}; (r["d" + day] = r["d" + day] || []).push({ id: id, pid: pid, name: f.name, size: size, at: stamp() }); KC.save(); });
            });
          }
          return photo(f).then(function (p) {
            var id = KC.uid(), pid = "dp|" + kind + "|" + sess() + "|" + tid + "|" + id, item = { id: id, pid: pid, thumb: p.thumb, at: stamp() };
            return KCH.put(pid, p.big).then(function () {
              ctx.sync(); var r = rec(kind, tid, true);
              if (kind === "info") { r.list = r.list || []; if (r.list.length >= 5) { KCH.del(pid); bad.push(f.name + "（超過 5 張）"); return; } r.list.push(item); }
              else { if (r[key]) KCH.del(r[key].pid); r[key] = item; }
              KC.save();
            });
          });
        });
      });
      chain.then(function () { ctx.done(); if (bad.length) alert("以下檔案未上傳：\n" + bad.join("\n")); }, function (er) { alert("上傳失敗：" + (er && er.message || er)); });
    });
  }
  return { mount: mount, enabled: true, ensureSessions: ensureSessions, showPhoto: showPhoto, photo: photo };
})();
