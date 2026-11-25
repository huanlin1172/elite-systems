/* 體驗模式（網址加 ?demo=1）：虛擬學生「王小明」＋範例資料，只存在這個瀏覽器，不連雲端。
   學生端、教師端、行政端使用同一份體驗資料，可互相驗證（例如學生送出請假 → 教師端核准 → 回學生端看結果）。 */
(function (w) {
  if (w.KC && !KC.demo && /[?&]demo=1/.test(location.search)) {
    var warn = document.createElement("div"); warn.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:99;background:#fde8e6;color:#b3261e;padding:10px 14px;font:14px/1.5 sans-serif;text-align:center";
    warn.textContent = "⚠️ 這個頁面載入的是舊版快取，無法進入體驗模式。請關閉分頁後重新開啟，或清除瀏覽器快取；網站也需要先更新部署。"; document.body.appendChild(warn); return;
  }
  if (!w.KC || !KC.demo) return;
  var cfg = KC.cfg, id = KC.id, ME = id === "g10" ? "LS15179" : "DEMO01";
  var GRADE = { g7: "7", g8a: "8", g8b: "8", g9: "9", g10: "10" }[id] || "9";
  function day(n) { var d = new Date(); d.setDate(d.getDate() + n); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
  function ts(n) { var d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleString("zh-TW", { hour12: false }); }
  function fieldVal(f, i) { return f[2] === "select" ? f[3][i % f[3].length] : (f[0] === "emg" ? "0912-000-" + (100 + i) : "無"); }
  function signup(i) { var o = {}; cfg.fields.forEach(function (f) { o[f[0]] = fieldVal(f, i); }); return { at: ts(-10), data: o }; }

  function seed() {
    var S = KC.S, names = ["王小明", "林小美", "陳大華", "張雅婷", "李俊傑", "黃心怡", "吳承恩", "劉子涵", "蔡佳穎", "鄭宇軒", "許家豪", "謝欣妤"];
    var tn = cfg.teamNames || ["第1" + cfg.unit, "第2" + cfg.unit, "第3" + cfg.unit];
    S.teams = tn.map(function (n, i) { return { id: "t" + (i + 1), name: n, leader: "" }; });
    S.students = names.map(function (n, i) {
      var sid = i === 0 ? ME : "DEMO" + ("0" + (i + 1)).slice(-2);
      return { id: sid, cls: GRADE + "0" + (i < 8 ? 1 : 2), name: n, signup: i === 11 ? null : signup(i), team: i === 11 ? "" : "t" + (i % 3 + 1) };
    });
    if (id === "g10" && window.KCW && KCW.enabled) { S.teams = []; S.students = []; KCW.seedRoster(); ME = "LS15179"; S.settings.demoCrew = true; }   /* G10 體驗：用真實小隊名單，虛擬學生＝第3小隊副小隊長 */
    var team1 = S.teams[0]; team1.leader = S.students[3].id;           /* 張雅婷 小隊長 */
    team1.roles = { leader: S.students[3].id, info: ME };               /* 王小明 資訊長 */
    S.settings.open = true; S.settings.deadline = day(14); S.settings.demoSeeded = true;

    /* 點名場次與紀錄 */
    var offs = [-14, -7, 0, 7];
    S.sessions = cfg.sessions.slice(0, 4).map(function (t, i) { return { id: "ds" + i, title: t, date: day(offs[i]) }; });
    S.att = {};
    S.sessions.slice(0, 2).forEach(function (x, si) {
      S.att[x.id] = {}; S.students.forEach(function (s, i) { if (s.signup) S.att[x.id][s.id] = s.id === ME ? (si ? "遲到" : "出席") : (i % 5 === 4 ? "缺席" : "出席"); });
    });

    if (id === "g10") {
      var GK = ["helmet","glass","gloves","bottle","light","shoes","rain","kit","cutlery","nhi"];
      [1, 2].forEach(function (n) {
        var k = "gear:pt" + n; S.att[k] = {};
        S.students.forEach(function (s, i) { if (i % 5 !== (n + 1) % 5) return; var m = {}; m[GK[(i + n) % GK.length]] = 1; if (i % 10 === 0) m[GK[(i + 3) % GK.length]] = 1; S.att[k][s.id] = { m: m, note: i % 10 === 0 ? "雨衣借用" : "", at: new Date().toISOString(), by: "teacher" }; });
        S.att[k]["T:t3"] = { done: 1, at: new Date().toISOString(), by: "teacher" };
      });
    }

    /* 請假 */
    var pt = id === "g8a" || id === "g10";
    var sg = { parent: true, teacher: true, lead: false };
    if (pt) {
      S.leaves = [
        { id: "dl1", kind: "pt", sid: ME, n: 2, date: day(-7), type: "傷病假（事先）", reason: "腳踝扭傷，醫師建議休息一週", mode: "self", mdate: day(5), sign: sg, late: false, status: "approved", done: false, proof: "", at: new Date(Date.now() - 12 * 864e5).toISOString() },
        { id: "dl2", kind: "pt", sid: ME, n: 4, date: day(12), type: "事假", reason: "家族聚會", mode: "other", mdate: day(19), sign: sg, late: false, status: "pending", done: false, proof: "", at: new Date().toISOString() },
        { id: "dl3", kind: "pt", sid: ME, n: 1, date: day(-14), type: "事假", reason: "補習班考試", mode: "other", mdate: day(-10), sign: sg, late: true, status: "rejected", done: false, proof: "", note: "請補附證明文件後重新申請", at: new Date(Date.now() - 20 * 864e5).toISOString() },
        { id: "dl4", kind: "pt", sid: S.students[1].id, n: 3, date: day(0), type: "公假", reason: "校隊比賽", mode: "self", mdate: day(6), sign: { parent: true, teacher: true, lead: true }, late: false, status: "pending", done: false, proof: "", at: new Date().toISOString() }];
    } else {
      S.leaves = [
        { id: "dl1", sid: ME, date: day(-7), type: "病假", reason: "感冒發燒就醫", status: "approved", at: new Date().toISOString() },
        { id: "dl2", sid: ME, date: day(10), type: "事假", reason: "家庭旅遊", status: "pending", at: new Date().toISOString() },
        { id: "dl3", sid: ME, date: day(-14), type: "其他", reason: "忘記附證明", status: "rejected", at: new Date().toISOString() },
        { id: "dl4", sid: S.students[1].id, date: day(0), type: "公假", reason: "校隊集訓", status: "pending", at: new Date().toISOString() }];
    }
    /* 公告、成績、提醒 */
    S.notices = [{ id: "dn1", text: "【體驗資料】請於本週五前繳回家長同意書。", team: "", at: ts(-3) }, { id: "dn2", text: "【體驗資料】集合地點更改為校門口，請提早 10 分鐘到。", team: "", at: ts(-1) }, { id: "dn3", text: "【體驗資料】本週天氣不穩，請自備雨具。", team: "", at: ts(0) }];
    S.scores = cfg.score ? [{ id: "dc1", team: "t1", pts: 5, reason: "主動協助", at: ts(-2) }, { id: "dc2", team: "t2", pts: 5, reason: "良好合作", at: ts(-2) }, { id: "dc3", team: "t1", pts: -3, reason: "遲到集合", at: ts(-1) }] : [];
    S.reminders = [
      { id: "dr1", title: "6:30 於校門口集合", body: "請攜帶水壺與防曬用品，遲到者將無法搭乘遊覽車。", date: day(3), level: "urgent", pinned: true, at: ts(-1) },
      { id: "dr2", title: "繳交家長同意書", body: "", date: day(5), level: "important", pinned: false, at: ts(-2) },
      { id: "dr3", title: "行前說明會", body: "地點：禮堂", date: day(8), level: "normal", pinned: false, at: ts(-3) }];
    S.folders = [{ id: "df1", name: "行前資料", parent: "", by: "活動組", at: ts(-5) }];
    S.files = [{ id: "dfi1", name: "活動須知（範例連結）", folder: "df1", url: "https://example.com/notice", by: "活動組", byRole: "admin", at: ts(-5) }, { id: "dfi2", name: "家長同意書（範例連結）", folder: "", url: "https://example.com/consent", by: "活動組", byRole: "admin", at: ts(-4) }];
    S.gallery = [["#7fb069", "🌿"], ["#f4a259", "🏞️"], ["#5b8e7d", "📸"]].map(function (g, i) {
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220"><rect width="320" height="220" fill="' + g[0] + '"/><text x="160" y="130" font-size="80" text-anchor="middle">' + g[1] + "</text></svg>";
      var url = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
      return { id: "dg" + i, pid: "g|dg" + i, thumb: url, _full: url, caption: ["訓練花絮（範例）", "集合合照（範例）", "路上風景（範例）"][i], by: "活動組", byId: "", byRole: "admin", at: ts(-i) };
    });
    S.gallery.forEach(function (g) { if (w.KCH) KCH.put(g.pid, g._full); delete g._full; });

    /* G9 闖關：匯入題庫、啟用 20 題＋1 題限時挑戰，並做出一些進度 */
    if (id === "g9" && w.KCQ && KCQ.importBank && w.KCQ_BANK) {
      var q = KCQ.q(); KCQ.importBank();
      q.tasks.filter(function (t) { return t.cat === "A"; }).sort(function (a, b) { return a.no - b.no; }).forEach(function (t, i) { t.active = i < 20; });
      q.tasks.push({ id: "dB1", cat: "B", no: 1, text: "限時挑戰：全隊在魚尾獅前擺出同一個姿勢，錄一段 5 秒影片。", hint: "", mode: "media", pts: 15, answer: "", lat: 0, lng: 0, radius: 0, useGps: false, photoTip: "全員入鏡", bStart: "00:00", bEnd: "23:59", fields: [], active: true, place: "" });
      var st = new Date(Date.now() - 75 * 60000), hh = ("0" + st.getHours()).slice(-2) + ":" + ("0" + st.getMinutes()).slice(-2);
      q.cfg.date = day(0); q.cfg.startT = hh; q.cfg.endT = "23:59"; q.cfg.force = true;
      var now = Date.now();
      q.tasks.filter(function (t) { return t.cat === "A" && t.active; }).sort(function (a, b) { return a.no - b.no; }).slice(0, 4).forEach(function (t, i) {
        var s = { team: "t1", task: t.id, status: i < 3 ? "approved" : "doing", wrong: i === 1 ? 1 : 0, arrived: true, arrivedAt: now - (60 - i * 12) * 60000, answerOk: i < 3 };
        if (i < 3) { s.pts = q.cfg.perCP; s.approvedAt = now - (55 - i * 15) * 60000; s.answer = String(t.answer).split("/")[0].split("|")[0]; s.at = ts(0); }
        q.subs["t1|" + t.id] = s;
      });
      q.pings = { t1: { t: now, lat: 1.2877, lng: 103.8507, by: "張雅婷" }, t2: { t: now - 40000, lat: 1.2931, lng: 103.8543, by: "林小美" } };
    }
  }

  var auth0 = KC.auth, head0 = KC.head;
  KC.auth = function (role, label, onOk) {
    if (!KC.isReady) return auth0(role, label, onOk);
    KC.reload();
    if (!KC.S.settings.demoSeeded || (id === "g10" && window.KCW && KCW.enabled && !KC.S.settings.demoCrew)) { seed(); KC.save(); }
    if (role === "student") { try { sessionStorage.setItem("kcauth:" + id + ":student", ME); } catch (e) {} }
    return auth0(role, label, onOk);
  };
  KC.head = function (role) {
    var h = head0(role).replace("💾 單機模式", "🧪 體驗模式");
    return h + '<div class="demobar">🧪 <b>體驗模式</b>：虛擬學生「' + (ME === "DEMO01" ? "王小明（DEMO01）" : "陳荷晴（第3小隊副小隊長）；教師端為張寬照老師") + '」，資料只存在這個瀏覽器、不會上傳。　' +
      '<a href="student.html?demo=1">學生端</a> ‧ <a href="teacher.html?demo=1">教師端</a> ‧ <a href="admin.html?demo=1">行政端</a>　<button data-demo="reset">重設體驗資料</button> <a href="student.html">離開體驗</a></div>';
  };
  var st = document.createElement("style");
  st.textContent = ".demobar{background:#fff3cd;color:#5c4400;border-bottom:2px solid #f0c040;padding:6px 16px;font-size:13px;text-align:center}.demobar a{color:#7a5200;margin:0 4px}.demobar button{font:inherit;font-size:12px;border:1px solid #c79a00;background:#fff;border-radius:6px;padding:2px 8px;cursor:pointer}";
  document.head.appendChild(st);
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-demo=reset]"); if (!t) return;
    if (!confirm("將清除體驗資料並重新產生，確定？")) return;
    try { localStorage.removeItem("kcislk-elite-demo:" + id); sessionStorage.removeItem("kcauth:" + id + ":student"); indexedDB.deleteDatabase("kcq-photos-" + id + "-demo"); indexedDB.deleteDatabase("kch-" + id + "-demo"); } catch (er) {}
    setTimeout(function () { location.reload(); }, 150);
  });
})(window);
