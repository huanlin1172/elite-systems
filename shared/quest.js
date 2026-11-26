/* GPS 闖關模組（比照 G7 動物園闖關，G9 改為新加坡城市探索）
   掛載方式：各端頁面在定義完 TABS / V / H 後呼叫 KCQ.mount(role, ctx)。 */
(function (w) {
  var FILE_MAX = 650 * 1024;
  var E = KC.esc, KCQ = {}, ui = { test: !!w.KCTEST, task: null, draft: {}, photo: null, msg: "", fails: 0, edit: null, filter: "A", rv: "pending" };
  var MODES = { photo: "拍照送審", text: "填答＋拍照送審", match: "答對後拍照送審", matchAuto: "答對直接給分", media: "上傳照片／影片（行政核可）" };
  var REASONS = ["照片拍錯／非指定目標", "未全員合照／小隊成員未入鏡", "照片模糊／角度不佳", "答案內容不完整或錯誤", "其他（見備註）"];
  var PRESETS = [["魚尾獅公園", 1.2868, 103.8545], ["濱海灣金沙", 1.2834, 103.8607], ["濱海灣花園", 1.2816, 103.8636], ["牛車水", 1.2833, 103.8443], ["小印度", 1.3067, 103.8518], ["新加坡植物園", 1.3138, 103.8159], ["聖淘沙", 1.2494, 103.8303]];
  var DEF = { cfg: { date: "", startT: "13:30", endT: "21:00", force: false, ver: 3, nLevels: 20, perCP: 32, radiusDefault: 120, wrong: 8, tMax: 360, tFull: 360, tDec: 4, center: { name: "魚尾獅公園", lat: 1.2868, lng: 103.8545 } }, tasks: [], subs: {}, pings: {} };
  function $(i) { return document.getElementById(i); }
  function badge(t, c) { return '<span class="b ' + c + '">' + t + "</span>"; }

  /* ---------- 資料 ---------- */
  KCQ.q = function () {
    var S = KC.S; if (!S.quest) S.quest = JSON.parse(JSON.stringify(DEF));
    var q = S.quest; q.cfg = Object.assign({}, DEF.cfg, q.cfg); if (q.cfg.ver !== 3) { ["ver", "nLevels", "perCP", "wrong", "tMax", "tFull", "tDec"].forEach(function (k) { q.cfg[k] = DEF.cfg[k]; }); if (q.cfg.startT === "11:00" || q.cfg.startT === "09:00") q.cfg.startT = DEF.cfg.startT; if (q.cfg.endT === "17:00" || q.cfg.endT === "20:00") q.cfg.endT = DEF.cfg.endT; }
    /* G9 2026 計分規則（只套用一次，之後行政端仍可在「闖關設定」修改）：每關 30 分×20 關＝600；全部通關 300 分鐘內得時間分 300，之後每分鐘扣 5 分（19:30 歸零）；限時任務每題 50 分 */
    if (window.ACT === "g9" && !q.cfg.rule2026) Object.assign(q.cfg, { rule2026: 1, nLevels: 20, perCP: 30, tMax: 300, tFull: 300, tDec: 5, startT: "13:30", endT: "19:30", bPts: 50, bN: 2 });
    if (window.ACT === "g9" && !q.cfg.rule2026b) Object.assign(q.cfg, { rule2026b: 1, wrong: 5 });   /* 答錯一次扣 5 分；扣滿一關分數（6 次）即公布答案 */
    q.subs = q.subs || {}; q.pings = q.pings || {}; q.tasks = q.tasks || []; S.scores = S.scores || []; return q;
  };
  function taskById(id) { return KCQ.q().tasks.filter(function (t) { return t.id === id; })[0]; }
  function sk(team, task) { return team + "|" + task; }
  function getSub(team, task, make) { var q = KCQ.q(), k = sk(team, task), s = q.subs[k]; if (!s && make) s = q.subs[k] = { team: team, task: task, status: "doing", wrong: 0 }; return s; }
  function activeTasks(cat) { return KCQ.q().tasks.filter(function (t) { return t.active && (t.cat === "A" || t.cat === "B") && (!cat || t.cat === cat); }).sort(function (a, b) { return a.no - b.no; }); }
  function stamp() { return new Date().toLocaleString("zh-TW", { hour12: false }); }

  /* ---------- 照片（IndexedDB，避免塞爆 localStorage）---------- */
  var dbp;
  function db() { return dbp || (dbp = new Promise(function (res, rej) { var r = indexedDB.open("kcq-photos-" + KC.id + (KC.demo ? "-demo" : ""), 1); r.onupgradeneeded = function () { r.result.createObjectStore("p"); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; })); }
  KCQ.putPhoto = function (id, data) { if (KC.cloud) return KC.cloud.putPhoto(id, data).then(function () { pc[id] = data; }); return db().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction("p", "readwrite"); t.objectStore("p").put(data, id); t.oncomplete = res; t.onerror = rej; }); }); };
  var pc = {};
  KCQ.getPhoto = function (id) { if (String(id).indexOf("s:") === 0) return Promise.resolve(String(id).slice(2)); if (KC.cloud) return pc[id] ? Promise.resolve(pc[id]) : KC.cloud.getPhoto(id).then(function (d) { if (d) pc[id] = d; return d; }, function () { return null; }); return db().then(function (d) { return new Promise(function (res) { var r = d.transaction("p").objectStore("p").get(id); r.onsuccess = function () { res(r.result); }; r.onerror = function () { res(null); }; }); }); };
  KCQ.compress = function (file, cb) {
    var fr = new FileReader();
    fr.onload = function () { var im = new Image(); im.onload = function () { var s = Math.min(1, 900 / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); cb(c.toDataURL("image/jpeg", 0.65)); }; im.onerror = function () { alert("無法讀取這張圖片"); }; im.src = fr.result; };
    fr.readAsDataURL(file);
  };
  function img(id) { return id ? '<img data-photo="' + E(id) + '" alt="" style="max-width:100%;max-height:260px;border-radius:10px;border:1px solid var(--line)">' : '<span class="mut">無照片</span>'; }
  function media(id, kind) { return !id ? "" : kind === "video" ? '<video data-photo="' + E(id) + '" controls playsinline style="max-width:100%;max-height:300px;border-radius:10px"></video>' : img(id); }
  function bWin(t) { if (t.endAt) return "⏱ 限時派送，截止 " + new Date(t.endAt).toLocaleTimeString("zh-TW", { hour12: false, hour: "2-digit", minute: "2-digit" }) + '（<span data-cd="' + t.endAt + '"></span>）'; return (t.bStart || t.bEnd) ? "⏱ " + (t.bStart || "開始") + " – " + (t.bEnd || "不限") : "⏱ 不限時"; }

  /* ---------- 地理與時間 ---------- */
  function hav(a, b, c, d) { var r = Math.PI / 180, x = (c - a) * r, y = (d - b) * r, h = Math.sin(x / 2) * Math.sin(x / 2) + Math.cos(a * r) * Math.cos(c * r) * Math.sin(y / 2) * Math.sin(y / 2); return 12742000 * Math.asin(Math.sqrt(h)); }
  function hm() { var d = new Date(); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }
  KCQ.eventState = function () {
    var c = KCQ.q().cfg; if (c.force || !c.date) return "open";
    var t = KC.today(); if (t < c.date) return "before"; if (t > c.date) return "after";
    return hm() < c.startT ? "before" : hm() > c.endT ? "after" : "open";
  };
  function inWindow(t) { if (t.endAt) { var nw = Date.now(); return t.startAt && nw < t.startAt ? "before" : nw > t.endAt ? "after" : "open"; } if (!t.bStart && !t.bEnd) return "open"; var n = hm(); return t.bStart && n < t.bStart ? "before" : t.bEnd && n > t.bEnd ? "after" : "open"; }

  /* ---------- 計分 ---------- */
  /* 計分（比照 Popworld「城市探索-新加坡」）：
     總分 = 時間分數（滿分 tMax；tFull 分鐘內完成得滿分，超過每分鐘扣 tDec 分，扣到 0 為止）＋ 每關得分 × 通過關數 − 答錯次數 × 每次扣分 */
  KCQ.timeScore = function (durMin) {
    var c = KCQ.q().cfg; if (durMin == null || durMin < 0) return 0;
    return Math.max(0, Math.min(c.tMax, c.tMax - Math.ceil(Math.max(0, durMin - c.tFull)) * c.tDec));
  };
  KCQ.score = function (tid) {
    var q = KCQ.q(), c = q.cfg, r = { isT: String(tid).indexOf("T|") === 0, a: 0, b: 0, aDone: 0, last: 0, wrongN: 0, pen: 0, timePts: 0, dur: null, done: false };
    Object.keys(q.subs).forEach(function (k) {
      var s = q.subs[k]; if (s.team !== tid) return;
      if (s.task === "_start") { r.start = s.t; return; }
      var t = taskById(s.task); if (!t || !t.active) return;
      if (t.cat === "B") { if (s.status === "approved") r.b += s.pts || 0; return; }
      if (t.cat !== "A") return;
      r.wrongN += s.wrong || 0;
      r.pen += Math.min((s.wrong || 0) * c.wrong, c.perCP);
      if (s.revealed) r.revealN = (r.revealN || 0) + 1;
      if (s.status === "approved") { r.a += s.pts || 0; r.aDone++; r.last = Math.max(r.last, s.approvedAt || 0); }
    });
    var aAll = activeTasks("A").length;
    if (aAll && r.aDone >= aAll) {
      r.done = true;
      var st0 = String(tid).indexOf("T|") === 0 ? r.start : (c.date ? new Date(c.date + "T" + c.startT).getTime() : 0);
      if (st0) { r.dur = Math.max(0, Math.round((r.last - st0) / 60000)); r.timePts = KCQ.timeScore(r.dur); }
    }
    r.bonus = r.timePts; r.e = 0;
    r.total = r.a + r.timePts - r.pen + r.b; return r;
  };
  /* 答錯幾次公布答案：扣分扣滿一關分數為止（30 分 ÷ 5 分 ＝ 6 次） */
  function maxWrong() { var c = KCQ.q().cfg; return Math.max(1, Math.ceil(c.perCP / Math.max(1, c.wrong))); }
  KCQ.maxWrong = maxWrong;
  function netPts(s) { return Math.max(0, (s.pts || 0) - Math.min((s.wrong || 0) * KCQ.q().cfg.wrong, KCQ.q().cfg.perCP)); }
  var GTILE = "https://mt{s}.google.com/vt/lyrs=m&hl=zh-TW&gl=SG&x={x}&y={y}&z={z}";
  KCQ.GTILE = GTILE;
  function radiusOf(t) { return t && +t.radius > 0 ? +t.radius : (KCQ.q().cfg.radiusDefault || 120); }
  function calcPts(t) {
    if (t && t.cat === "B") { var bp = window.ACT === "g9" ? (KCQ.q().cfg.bPts || 50) : 10; return +t.pts > 0 ? +t.pts : bp; }   /* G9：限時任務沒設分數（空白或 0）就用「闖關設定」的每題分數 */
    return KCQ.q().cfg.perCP;
  }

  /* ---------- 答案核對（text 單一答案／parts 依序多格／set 不計順序／choice 選擇題可複選）---------- */
  function nz(x) { return String(x == null ? "" : x).toLowerCase().replace(/[Ａ-Ｚａ-ｚ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 65248); }).replace(/[\s\u3000.,，、。'’‘"“”·・\-_/／()（）]/g, ""); }
  function okOne(spec, v) { return String(spec).split("|").some(function (a) { return nz(a) === nz(v); }); }
  function atypeOf(t) { return t.atype || "text"; }
  function checkAns(t, vals) {
    var ty = atypeOf(t), specs = String(t.answer || "").split("/");
    if (ty === "choice") { var a = String(t.answer).toUpperCase().match(/[A-Z]/g) || [], b = (vals || []).join("").toUpperCase().match(/[A-Z]/g) || []; return a.slice().sort().join("") === b.slice().sort().join("") && a.length > 0; }
    if (ty === "parts") return specs.length === vals.length && specs.every(function (sp, i) { return okOne(sp, vals[i]); });
    if (ty === "set") { var used = {}; return vals.length === specs.length && vals.every(function (v) { var hit = -1; specs.forEach(function (sp, i) { if (hit < 0 && !used[i] && okOne(sp, v)) hit = i; }); if (hit < 0) return false; used[hit] = 1; return true; }); }
    return okOne(t.answer, vals[0]);
  }
  function nparts(t) { return atypeOf(t) === "parts" || atypeOf(t) === "set" ? Math.max(2, t.nparts || String(t.answer).split("/").length) : 1; }
  function optLetters(t) { var m = String((t.note || "") + " " + (t.text || "")).match(/(?:^|[\s\n　])([A-F])\s*[.．、:：]/g) || [], L = []; m.forEach(function (x) { var c = x.replace(/[^A-F]/g, ""); if (L.indexOf(c) < 0) L.push(c); }); return L.length >= 2 ? L : ["A", "B", "C", "D"]; }
  function mapLink(t) { return "https://www.google.com/maps/search/?api=1&query=" + t.lat + "," + t.lng; }
  function story(h, t) { return h ? '<div class="nt" style="white-space:pre-wrap">' + E(h) + "</div>" : ""; }

  /* ---------- 新加坡範例題組（座標為概略位置，現場勘查後請於題庫校正）---------- */
  function seed() {
    var A = [["魚尾獅公園", 1.2868, 103.8545, "找到新加坡的象徵，全隊與魚尾獅合影。", "photo", "", "全員入鏡，魚尾獅須清楚可見"],
      ["萊佛士登陸點", 1.2886, 103.8512, "雕像紀念的是誰在這裡登陸？請輸入人名（英文）。", "match", "raffles", "與雕像合影"],
      ["螺旋橋", 1.2871, 103.8602, "這座橋的造型像什麼分子結構？（兩個字）", "matchAuto", "dna", ""],
      ["濱海灣金沙", 1.2834, 103.8607, "數一數頂部船形平台由幾座塔樓支撐？請填數字。", "match", "3", "拍出建築全景與全員"],
      ["濱海灣花園", 1.2816, 103.8636, "觀察超級樹：它們除了好看，還有什麼功能？請寫下你們的發現。", "text", "", "與超級樹合影"],
      ["克拉碼頭", 1.2906, 103.8465, "這個地方過去是做什麼用的碼頭？用一句話回答。", "text", "", "全員合影"],
      ["佛牙寺（牛車水）", 1.2813, 103.8445, "寺廟外觀屬於哪個朝代的建築風格？", "match", "唐", "遵守參訪規定，在入口處合影"],
      ["麥士威熟食中心", 1.2803, 103.8445, "觀察攤位：記錄三種你們沒在臺灣看過的食物名稱。", "text", "", "拍攝你們選的食物與全員"]];
    var q = KCQ.q(), n = 0;
    A.forEach(function (a, i) { q.tasks.push({ id: KC.uid() + i, cat: "A", no: i + 1, text: a[3], hint: "前往「" + a[0] + "」，到達後定位打卡。", mode: a[4], answer: a[5], lat: a[1], lng: a[2], radius: 0, useGps: true, photoTip: a[6], bStart: "", bEnd: "", fields: [], active: true, place: a[0] }); n++; });
    q.tasks.push({ id: KC.uid() + "b1", cat: "B", no: 1, text: "臨時任務：全隊做出一個代表臺灣的團體動作並拍照。", hint: "", mode: "photo", answer: "", lat: 0, lng: 0, radius: 0, useGps: false, photoTip: "全員入鏡", bStart: "", bEnd: "", fields: [], active: true, place: "" });
    return n + 1;
  }

  function importBank() {
    var B = window.KCQ_BANK || [], q = KCQ.q(), add = 0, upd = 0;
    B.forEach(function (b) {
      var base = { cat: "A", no: b.no, code: b.code, designer: b.designer, item: b.item, place: b.code, text: b.text, clueImg: b.clueImg, answer: b.answer, atype: b.atype, nparts: b.nparts, note: b.note,
        tip: b.tip, tipImg: b.tipImg, intro: b.intro, introImg: b.introImg, after: b.after, afterImg: b.afterImg, addr: b.addr, hint: b.addr ? "前往：" + b.addr : "前往地圖標示的位置", mode: "matchAuto",
        lat: b.lat, lng: b.lng, radius: b.approx ? 250 : 0, useGps: !!b.lat, approx: !!b.approx, photoTip: "", bStart: "", bEnd: "", fields: [], active: true };
      var i = q.tasks.map(function (t) { return t.code; }).indexOf(b.code);
      if (i >= 0) { q.tasks[i] = Object.assign({}, q.tasks[i], base); upd++; } else { base.id = KC.uid() + b.code; q.tasks.push(base); add++; }
    });
    /* 題庫是「指定關卡」清單：不在題庫裡的舊 CP 關卡一律停用（不刪除，保留紀錄） */
    var codes = B.map(function (b) { return b.code; }), off = 0;
    q.tasks.forEach(function (t) { if (t.cat === "A" && /^CP\d+$/.test(t.code || "") && codes.indexOf(t.code) < 0 && t.active) { t.active = false; off++; } });
    return [add, upd, off];
  }

  KCQ.importBank = importBank;

  /* ---------- 方位導航：手機 GPS＋羅盤，顯示距離、方位與靠近／遠離效果 ---------- */
  var nav = { on: false, task: null, pos: null, d: null, hist: [], trend: "", heading: null, err: "", wid: null, hasHeading: false };
  var navCss = document.createElement("style");
  navCss.textContent = ".qsc{grid-template-columns:repeat(2,minmax(0,1fr))}@media(min-width:700px){.qsc{grid-template-columns:repeat(4,minmax(0,1fr))}}.qrow[class*=qs-]{border-left:6px solid #c9ced6;padding-left:8px;margin:4px 0;border-radius:6px}.qs-on{border-left-color:#1a73e8!important;background:rgba(26,115,232,.10)}.qs-wrong{border-left-color:#f57c00!important;background:rgba(245,124,0,.13)}.qs-ok{border-left-color:#2e7d32!important;background:rgba(46,125,50,.13)}.qs-part{border-left-color:#c9a400!important;background:rgba(201,164,0,.16)}.qs-zero{border-left-color:#c62828!important;background:rgba(198,40,40,.12)}.qs-pend{border-left-color:#7b1fa2!important;background:rgba(123,31,162,.10)}.qleg{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 6px;font-size:12px}.qleg span{border-left:5px solid #c9ced6;padding:1px 6px;border-radius:4px}" + ".qrow{display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid var(--line)}.qrow:last-child{border-bottom:0}.qno{flex:0 0 40px}.qtx{flex:1;min-width:0;overflow-wrap:anywhere}.qrow .b,.qrow button{flex:0 0 auto;white-space:nowrap}" + ".qnav{border-radius:16px;padding:14px;margin:10px 0;background:linear-gradient(160deg,#16324a,#0f2233);color:#fff;text-align:center;position:relative;overflow:hidden;transition:background .4s}" +
    ".qnav.near{background:linear-gradient(160deg,#1f6b3a,#123d22)}.qnav.far{background:linear-gradient(160deg,#6b2a2a,#3a1414)}.qnav.here{background:linear-gradient(160deg,#c78a00,#7a4f00)}" +
    ".qnav svg{width:190px;height:190px;max-width:70%}.qn-d{font-size:34px;font-weight:700;line-height:1.1}.qn-s{font-size:14px;opacity:.9}" +
    ".qn-t{margin-top:6px;display:inline-block;padding:3px 14px;border-radius:99px;background:rgba(255,255,255,.18);font-size:15px;font-weight:600}" +
    ".qnav.near .qn-t{animation:qnPulse 1.1s ease-in-out infinite}.qnav.far .qn-t{animation:qnShake .5s ease-in-out infinite}.qnav.here .qn-t{animation:qnPulse .6s ease-in-out infinite}" +
    ".qnav.near .qn-ring{animation:qnRing 1.4s ease-out infinite}.qnav.here .qn-ring{animation:qnRing .8s ease-out infinite;stroke:#ffd54a}.qnav.far .qn-ring{stroke:#ff8a80}" +
    ".qn-ring{fill:none;stroke:#8bf0a8;stroke-width:3;opacity:0;transform-origin:100px 100px}" +
    ".qn-wrap{position:relative;width:250px;height:250px;margin:0 auto;border-radius:50%;overflow:hidden;border:3px solid rgba(255,255,255,.6);background:#223}.qn-map{position:absolute;width:360px;height:360px;left:-55px;top:-55px;transform-origin:50% 50%}.qn-wrap svg{position:absolute;inset:0;width:100%;height:100%;max-width:none;pointer-events:none}.qn-att{font-size:10px;opacity:.7;margin-top:3px}.qn-wrap.nomap{background:radial-gradient(circle,#2b4a63,#14293a)}" +
    "@keyframes qnPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}@keyframes qnShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}" +
    "@keyframes qnRing{0%{opacity:.9;transform:scale(.55)}100%{opacity:0;transform:scale(1.15)}}";
  document.head.appendChild(navCss);
  function bearing(a, b, c, d) { var r = Math.PI / 180, y = Math.sin((d - b) * r) * Math.cos(c * r), x = Math.cos(a * r) * Math.sin(c * r) - Math.sin(a * r) * Math.cos(c * r) * Math.cos((d - b) * r); return (Math.atan2(y, x) / r + 360) % 360; }
  function card8(b) { return ["北", "東北", "東", "東南", "南", "西南", "西", "西北"][Math.round(b / 45) % 8]; }
  function rel8(b) { return ["正前方", "右前方", "右方", "右後方", "正後方", "左後方", "左方", "左前方"][Math.round(b / 45) % 8]; }
  function fmtD(m) { return m >= 1000 ? (m / 1000).toFixed(2) + " 公里" : Math.round(m) + " 公尺"; }
  function onOri(e) {
    var h = null;
    if (typeof e.webkitCompassHeading === "number") h = e.webkitCompassHeading;
    else if (e.absolute && e.alpha != null) h = (360 - e.alpha) % 360;
    else if (e.alpha != null && !nav.hasHeading) h = (360 - e.alpha) % 360;
    if (h != null) { nav.heading = h; nav.hasHeading = true; updateNav(); }
  }
  function stopNav() {
    if (nav.wid != null && navigator.geolocation) navigator.geolocation.clearWatch(nav.wid);
    nav.wid = null; nav.on = false; nav.hist = []; nav.trend = ""; nav.d = null; nav.pos = null; if (nav.map) { try { nav.map.remove(); } catch (e) {} nav.map = null; }
    w.removeEventListener("deviceorientationabsolute", onOri, true); w.removeEventListener("deviceorientation", onOri, true);
  }
  function startNav(taskId, c) {
    stopNav(); nav.on = true; nav.task = taskId; nav.err = "";
    var go = function () { w.addEventListener("deviceorientationabsolute", onOri, true); w.addEventListener("deviceorientation", onOri, true); };
    try { if (w.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === "function") DeviceOrientationEvent.requestPermission().then(function (r) { if (r === "granted") go(); }).catch(function () {}); else go(); } catch (e) {}
    if (!navigator.geolocation) { nav.err = "此裝置不支援定位"; return c.render(); }
    nav.wid = navigator.geolocation.watchPosition(function (p) {
      var t = taskById(nav.task); if (!t) return;
      var d = hav(p.coords.latitude, p.coords.longitude, t.lat, t.lng), now = Date.now();
      nav.pos = { t: now, lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy || 0, b: bearing(p.coords.latitude, p.coords.longitude, t.lat, t.lng) };
      if (p.coords.heading != null && !isNaN(p.coords.heading) && (p.coords.speed || 0) > 1 && !nav.hasHeading) nav.gpsHeading = p.coords.heading;
      nav.hist.push({ t: now, d: d, p: [p.coords.latitude, p.coords.longitude] }); nav.hist = nav.hist.filter(function (x) { return now - x.t < 20000; });
      var old = nav.hist.filter(function (x) { return now - x.t >= 5000; }).pop();
      if (old) { var dl = d - old.d; if (dl < -4) nav.trend = "near"; else if (dl > 4) nav.trend = "far"; }
      var was = nav.d; nav.d = d;
      var lim = radiusOf(t) + Math.min(p.coords.accuracy || 0, 50);
      if (d <= lim && (was == null || was > lim) && navigator.vibrate) try { navigator.vibrate([200, 100, 200]); } catch (e) {}
      nav.err = ""; updateNav();
    }, function (e) { nav.err = e.code === 1 ? "沒有定位權限，請在瀏覽器設定允許「位置」" : "暫時無法取得定位，請到空曠處再試"; updateNav(); }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
    c.render();
  }
  function navCard(t) {
    if (!nav.on || nav.task !== t.id) return '<div class="row"><button class="pri" data-do="qNavStart">🧭 開啟方位導航（地圖＋羅盤）</button></div><p class="mut">會使用手機 GPS 與方向感測器，在真實地圖上顯示你的位置、目標方位和距離。</p>';
    return '<div class="qnav" id="qnav"><div class="qn-wrap nomap" id="qn-wrap"><div class="qn-map" id="qn-mapbox"><div id="qn-map" style="width:100%;height:100%"></div></div>' +
      '<svg viewBox="0 0 200 200"><circle class="qn-ring" cx="100" cy="100" r="92"/><g id="qn-rose"><circle cx="100" cy="100" r="96" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1"/>' +
      '<g stroke="#fff" stroke-width="2.5"><line x1="100" y1="2" x2="100" y2="14"/><line x1="198" y1="100" x2="186" y2="100"/><line x1="100" y1="198" x2="100" y2="186"/><line x1="2" y1="100" x2="14" y2="100"/></g>' +
      '<g font-weight="700" stroke="rgba(0,0,0,.65)" stroke-width="3" paint-order="stroke"><text x="100" y="30" text-anchor="middle" fill="#ff6b6b" font-size="17">北</text><text x="178" y="105" text-anchor="middle" fill="#fff" font-size="13">東</text><text x="100" y="187" text-anchor="middle" fill="#fff" font-size="13">南</text><text x="22" y="105" text-anchor="middle" fill="#fff" font-size="13">西</text></g>' +
      '<g id="qn-arrow"><polygon points="100,22 111,62 100,55 89,62" fill="#ffd54a" stroke="#222" stroke-width="1.5"/><line x1="100" y1="62" x2="100" y2="94" stroke="#ffd54a" stroke-width="2.5" stroke-dasharray="4 4"/></g></g>' +
      '<circle cx="100" cy="100" r="7" fill="#2f80ed" stroke="#fff" stroke-width="3"/></svg></div>' +
      '<div class="qn-att" id="qn-att">地圖資料 ©Google</div>' +
      '<div class="qn-d" id="qn-d">定位中…</div><div class="qn-s" id="qn-s"></div><div class="qn-t" id="qn-t">📡 取得位置中</div><div class="qn-s" id="qn-a" style="margin-top:6px"></div>' +
      '<div class="row" style="justify-content:center"><button class="sm sec" style="background:#fff" data-do="qNavStop">關閉導航</button></div></div>';
  }
  var lfState = 0;
  function loadL(cb) {
    if (w.L) return cb(); if (lfState === 2) return;
    if (lfState === 0) {
      lfState = 1;
      var css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(css);
      var sc = document.createElement("script"); sc.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      sc.onload = function () { lfState = 0; updateNav(); }; sc.onerror = function () { lfState = 2; var wr = $("qn-wrap"); if (wr) wr.classList.add("nomap"); var at = $("qn-att"); if (at) at.textContent = "地圖無法載入（需要網路），仍可使用羅盤箭頭"; };
      document.head.appendChild(sc);
    }
  }
  function navZoom(d, lat) {
    var z = Math.floor(Math.log(156543.03 * Math.cos(lat * Math.PI / 180) * 105 / Math.max(d, 20)) / Math.LN2);
    return Math.max(3, Math.min(18, z));
  }
  function navMapUpdate(t) {
    var el = $("qn-map"); if (!el || !nav.pos) return;
    if (!w.L) return loadL(function () {});
    if (!nav.map || nav.map.getContainer() !== el) {
      if (nav.map) try { nav.map.remove(); } catch (e) {}
      var m = nav.map = w.L.map(el, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false, tap: false });
      w.L.tileLayer(GTILE, { subdomains: "0123", maxZoom: 20 }).addTo(m);
      nav.layers = {
        c: w.L.circle([t.lat, t.lng], { radius: radiusOf(t), color: "#ffd54a", weight: 2, fillColor: "#ffd54a", fillOpacity: .25 }).addTo(m),
        p: w.L.circleMarker([t.lat, t.lng], { radius: 9, color: "#fff", weight: 3, fillColor: "#e53935", fillOpacity: 1 }).addTo(m)
      };
      m.setView([nav.pos.lat, nav.pos.lng], navZoom(nav.d, nav.pos.lat), { animate: false });
      var wr = $("qn-wrap"); if (wr) wr.classList.remove("nomap");
    }
    nav.layers.c.setLatLng([t.lat, t.lng]); nav.layers.c.setRadius(radiusOf(t)); nav.layers.p.setLatLng([t.lat, t.lng]);
    nav.map.setView([nav.pos.lat, nav.pos.lng], navZoom(nav.d, nav.pos.lat), { animate: false });
  }
  function updateNav() {
    var box = $("qnav"); if (!box) return;
    var t = taskById(nav.task); if (!t) return;
    if (nav.err) { $("qn-t").textContent = "⚠️ " + nav.err; return; }
    if (!nav.pos) return;
    var hd = nav.hasHeading ? nav.heading : (nav.gpsHeading != null ? nav.gpsHeading : 0), known = nav.hasHeading || nav.gpsHeading != null;
    var lim = radiusOf(t) + Math.min(nav.pos.acc, 50), here = nav.d <= lim;
    $("qn-rose").setAttribute("transform", "rotate(" + (-hd) + " 100 100)");
    $("qn-mapbox").style.transform = "rotate(" + (-hd) + "deg)";
    $("qn-arrow").setAttribute("transform", "rotate(" + nav.pos.b + " 100 100)");
    try { navMapUpdate(t); } catch (e) {}
    $("qn-d").textContent = here ? "🎯 已到達！" : fmtD(nav.d);
    $("qn-s").textContent = "目標在" + card8(nav.pos.b) + "方（" + Math.round(nav.pos.b) + "°）" + (known ? "，你的" + rel8((nav.pos.b - hd + 360) % 360) : "（羅盤未啟用，地圖上方為北）");
    box.className = "qnav " + (here ? "here" : nav.trend);
    $("qn-t").textContent = here ? "已進入打卡範圍，請按下方「我到了」" : nav.trend === "near" ? "🔥 越來越近了！" : nav.trend === "far" ? "❄️ 離目標越來越遠…" : "往目標方向前進吧";
    $("qn-a").textContent = "定位精度約 ±" + Math.round(nav.pos.acc) + " 公尺　觸發半徑 " + radiusOf(t) + " 公尺（黃圈）";
  }

  /* ================= 學生端 ================= */
  function elapsed(c, sc) {
    if (sc && sc.isT && !sc.start) return "尚未開始"; if (!c.date && !(sc && sc.start)) return "—"; var st = sc && sc.start ? sc.start : new Date(c.date + "T" + c.startT).getTime(), end = sc && sc.done ? sc.last : Date.now(), m = Math.floor((end - st) / 60000);
    if (m < 0) return "未開始"; return Math.floor(m / 60) + "時" + ("0" + (m % 60)).slice(-2) + "分";
  }
  function studentView(me) {
    var q = KCQ.q(), team = KC.team(me.team);
    if (!me.signup) return '<div class="card"><p class="mut">請先完成報名。</p></div>';
    if (!team) return '<div class="card"><p class="mut">尚未編組，編組完成後即可闖關。</p></div>';
    var es = KCQ.eventState(), onlyDisp = es !== "open" && q.tasks.some(function (t) { return t.disp && t.active && inWindow(t) === "open" && KCQ.forTeam(t, team); });
    if (onlyDisp) es = "open";   /* 闖關時段外，仍可作答行政端派送中的限時任務 */
    var TB = "";
    if (ui.test) {
      if (!testOn()) return '<div class="card"><h3>🧪 關卡測試</h3><p>行政端目前已關閉關卡測試。</p><p class="mut">要測試請到行政端「⚙️ 闖關設定」勾選「開放關卡測試頁」並儲存。</p></div>';
      { var pt = { id: "T|" + team.id, name: team.name + "（測試）", code: team.code, cls: team.cls }; return testHead() + (ui.task ? taskDetail(me, pt) : listView(q, pt, false)); }
    }
    if (es !== "open") return TB + '<div class="card"><h3>闖關</h3><p>' + (es === "before" ? "活動尚未開始（" + E(q.cfg.date) + " " + E(q.cfg.startT) + " 開放）" : "活動已結束") + "</p></div>";
    if (ui.task) return taskDetail(me, team);
    if (TB) return TB + listView(q, team, onlyDisp);
    return listView(q, team, onlyDisp);
  }
  /* 關卡狀態與顏色：未開始／已觸發／作答中有扣分／完成（全對）／完成有扣分／未得分（公布答案）／待審核／退回 */
  function qState(t, s) {
    var st = s ? s.status : "new", w = (s && s.wrong) || 0, cw = KCQ.q().cfg.wrong, pen = Math.min(w * cw, KCQ.q().cfg.perCP);
    if (st === "approved") {
      if (t.cat !== "A") return { c: "ok", b: badge("完成 +" + s.pts, "ok") };
      if (s.revealed) return { c: "zero", b: badge("未得分 0（−" + pen + "）", "no") };
      return w ? { c: "part", b: badge("完成 +" + netPts(s) + "（−" + pen + "）", "wn") } : { c: "ok", b: badge("完成 +" + s.pts, "ok") };
    }
    if (st === "pending") return { c: "pend", b: badge("待審核", "wn") };
    if (st === "rejected") return { c: "zero", b: badge("退回，請修正", "no") };
    if (w) return { c: "wrong", b: badge("答錯 " + w + " 次 −" + pen, "no") };
    if (s && (s.arrived || st === "doing")) return { c: "on", b: badge(s.arrived ? "已觸發" : "進行中", "gr") };
    return { c: "new", b: badge("未開始", "gr") };
  }
  var QLEG = '<p class="qleg"><span class="qs-new">未開始</span><span class="qs-on">已觸發</span><span class="qs-wrong">作答中・已扣分</span><span class="qs-ok">完成</span><span class="qs-part">完成・有扣分</span><span class="qs-zero">未得分</span></p>';
  function listView(q, team, onlyDisp) {
    var sc = KCQ.score(team.id);
    var c9 = q.cfg, bN = c9.bN || 0, bMax = bN ? (c9.bPts || 50) * bN : 0, aMax = c9.perCP * activeTasks("A").length;
    var st = function (v, lab, sub, col) { return '<div class="stat"><b' + (col ? ' style="color:' + col + '"' : "") + ">" + v + "</b><span>" + lab + (sub ? '<br><small class="mut">' + sub + "</small>" : "") + "</span></div>"; };
    var html = '<div class="card"><h3>' + E(team.name) + '</h3>' +
      '<div class="stat" style="text-align:center;margin-bottom:10px"><b style="font-size:34px">' + sc.total + '</b><span>目前總分（＝ 關卡分數 ＋ 時間分數 ＋ 限時任務 − 答錯扣分）</span></div>' +
      '<div class="grid qsc">' +
        st(sc.a, "🏁 關卡分數", "完成 " + sc.aDone + "／" + activeTasks("A").length + " 關，滿分 " + aMax) +
        st(sc.done ? sc.timePts : "—", "⏱ 時間分數", sc.done ? "用時 " + elapsed(c9, sc) + "，滿分 " + c9.tMax : "全部通關後計算（已用 " + elapsed(c9, sc) + "）") +
        st(sc.b, "⚡ 限時任務", bN ? "每題 " + (c9.bPts || 50) + " 分，滿分 " + bMax : "") +
        st(sc.pen ? "−" + sc.pen : "0", "❌ 答錯扣分", "答錯 " + sc.wrongN + " 次，每次 −" + c9.wrong, "var(--no)") +
      "</div>" +
      '<p class="mut" style="margin:8px 0 0">' + c9.tFull + " 分鐘內全部通關得時間分 " + c9.tMax + "，之後每分鐘扣 " + c9.tDec + " 分；同一關答錯 " + maxWrong() + " 次公布答案、該關 0 分。</p></div>";
    var G9 = window.ACT === "g9";
    if (G9) html += '<div class="card"><h3>🗺️ 小隊與關卡即時位置' + (ui.test ? "（測試：顏色依測試成績，不需走到現場）" : "") + '</h3><div id="g9qmapHost"></div><p class="mut" id="g9qnote" style="margin:6px 0 0">正在取得 GPS 位置…</p></div><div class="g9cols">';
    [["A", "關卡列表"], ["B", G9 ? "⏱ 限時挑戰" : "⏱ 限時挑戰（行政端核可後加分）"]].forEach(function (g) {
      var l = activeTasks(g[0]).filter(function (t) { return KCQ.forTeam(t, team) && (!onlyDisp || (t.disp && inWindow(t) === "open")); }); if (!l.length) return;
      if (g[0] === "B") l.sort(function (a, b) { var oa = a.endAt && inWindow(a) === "open" ? 0 : 1, ob = b.endAt && inWindow(b) === "open" ? 0 : 1; return oa - ob || (b.startAt || 0) - (a.startAt || 0) || a.no - b.no; });
      html += '<div class="card"><h3>' + g[1] + "</h3>" + (g[0] === "A" ? QLEG : "") + l.map(function (t) {
        var s = getSub(team.id, t.id), st = s ? s.status : "new";
        var k = qState(t, s);
        return '<div class="qrow qs-' + k.c + '"><b class="qno">' + g[0] + t.no + '</b><span class="qtx">' + E(t.cat === "A" && !(s && s.arrived) ? (t.code ? t.code + (t.addr ? "　" + t.addr.slice(0, 22) : "") : (t.place || "任務 " + t.no)) : (t.cat === "B" ? t.text.slice(0, 22) + " 〔" + (t.endAt ? (inWindow(t) === "open" ? "限時派送" : "已截止") : bWin(t)) + "｜+" + calcPts(t) + "〕" : (t.item || t.text).slice(0, 26))) + "</span>" + k.b + '<button class="sm pri" data-do="qOpen" data-id="' + t.id + '">開啟</button></div>';
      }).join("") + "</div>";
    });
    if (G9) html += "</div>";
    return html || '<div class="card"><p class="mut">行政端尚未設定本次活動任務。</p></div>';
  }
  /* 關卡測試：完整比照正式闖關（計分、扣分、公布答案、時間分），但不需 GPS 觸發；
     紀錄寫在測試專用小隊「T|小隊id」，不影響正式成績，可一鍵重設 */
  function testOn() { return window.ACT === "g9" && KCQ.q().cfg.testOn !== false; }
  function tid(me) { return ui.test ? "T|" + me.team : me.team; }
  function testStart(me) { var q = KCQ.q(), k = sk(tid(me), "_start"); if (!q.subs[k]) q.subs[k] = { team: tid(me), task: "_start", status: "meta", t: Date.now() }; }
  function testHead() {
    return '<div class="card" style="border:2px dashed #e0a000"><div class="row"><b>🧪 關卡測試模式</b><span class="mut">不需定位；計分、扣分、公布答案、時間分都比照正式（時間從開啟第一關起算）。成績與正式成績分開，不會出現在排行榜。</span></div>' +
      '<div class="row"><button class="sm dng" data-do="qTReset">重設測試紀錄</button><span class="mut">版本 ' + (((document.querySelector('script[src*="quest.js"]') || {}).src || "").split("v=")[1] || "") + "</span></div></div>";
  }
  function taskDetail(me, team) {
    var t = taskById(ui.task); if (!t) { ui.task = null; return studentView(me); }
    var s = getSub(team.id, t.id) || { status: "new", wrong: 0 }, st = s.status, d = ui.draft;
    var h = '<div class="card"><div class="row"><button class="sm sec" data-do="qBack">← 任務清單</button><b>' + t.cat + t.no + "</b> " + badge(MODES[t.mode], "gr") + "</div>";
    if (st === "approved") return h + (t.item ? "<h3>" + E(t.item) + "</h3>" : "") + '<p>' + (s.revealed ? badge("答錯 " + s.wrong + " 次，已公布答案，本關 0 分", "no") : badge("已通過 +" + (t.cat === "A" ? netPts(s) : s.pts) + " 分" + (t.cat === "A" && s.wrong ? "（" + s.pts + " − 答錯 " + s.wrong + " 次 × " + KCQ.q().cfg.wrong + "）" : ""), "ok")) + "</p>" + (t.answer && t.atype ? "<p>正確答案：<b>" + E(String(t.answer).split("/").map(function (x) { return x.split("|")[0]; }).join(" / ")) + "</b></p>" : "") + story(0, t) + (t.after ? '<h3>後續故事</h3>' + story(t.after, t) : "") + (t.afterImg ? img(t.afterImg) : "") + (s.note ? '<p class="mut">老師評語：' + E(s.note) + "</p>" : "") + "</div>";
    if (st === "pending") return h + "<p>" + badge("已送出，等待老師審核", "wn") + '</p><p class="mut">送出內容：' + E(s.answer || "") + "</p>" + (s.photoId ? media(s.photoId, s.kind) : "") + (s.link ? '<p class="mut">連結：' + E(s.link) + "</p>" : "") + "</div>";
    if (st === "rejected") h += '<p class="b no" style="display:block">已退回：' + E(s.reason || "") + (s.note ? "（" + E(s.note) + "）" : "") + "</p>";
    var win = t.cat === "B" && !ui.test ? inWindow(t) : "open";
    if (win !== "open") return h + "<p>" + (win === "before" ? "⏳ 尚未開放（" + E(t.bStart) + " 開始）" : "⏰ 已截止") + "</p></div>";
    if (t.cat === "B") h += '<p class="mut">' + (t.endAt ? bWin(t) : E(bWin(t))) + "　完成並經行政端核可可得 <b>+" + calcPts(t) + "</b> 分</p>";
    var arrived = !t.useGps || s.arrived || !!ui.test;
    if (ui.test && t.useGps) h += '<p class="mut">🧪 測試模式：略過 GPS（正式闖關需走進 ' + radiusOf(t) + " 公尺內才解鎖）</p>";
    else if (t.hint || t.useGps) h += '<h3 style="margin-top:12px">① 地圖判讀與抵達</h3><p>' + E(t.hint || "前往指定地點") + "</p>" + (t.lat && !s.arrived ? '<p><a href="' + mapLink(t) + '" target="_blank" rel="noopener">🗺️ 在地圖開啟目的地</a></p>' + (t.useGps ? navCard(t) : "") : "");
    if (t.useGps && !ui.test) {
      h += s.arrived ? "<p>" + badge("已抵達" + (s.gpsBypass ? "（人工確認）" : ""), "ok") + "</p>"
        : '<div class="row"><button class="pri" data-do="qCheckin">📍 我到了，定位打卡</button></div>' + (ui.msg ? '<p class="mut">' + E(ui.msg) + "</p>" : "") +
          (ui.fails >= 3 ? '<div class="row"><button class="sec" data-do="qBypass">定位一直失敗？回報由老師人工確認</button></div>' : "");
    }
    if (!arrived) return h + "</div>";
    if (t.intro) h += '<h3 style="margin-top:12px">關卡故事</h3>' + story(t.intro, t) + (t.introImg ? img(t.introImg) : "");
    h += '<h3 style="margin-top:12px">② 謎題' + (t.item && t.atype ? "" : "") + "</h3><p style=\"white-space:pre-wrap\">" + E(t.text) + "</p>" + (t.clueImg ? "<p>" + img(t.clueImg) + "</p>" : "") + (t.note ? '<p class="mut" style="white-space:pre-wrap">' + E(t.note) + "</p>" : "");
    var needAns = t.mode === "text" || t.mode === "match" || t.mode === "matchAuto";
    var matched = s.answerOk;
    if (t.tip) h += ui.tipOpen === t.id ? '<div class="nt"><b>💡 提示</b>　' + E(t.tip) + (t.tipImg ? "<br>" + img(t.tipImg) : "") + "</div>" : '<div class="row"><button class="sm sec" data-do="qTip">💡 需要提示</button></div>';
    if (needAns) {
      var ty = atypeOf(t), inputs = "";
      if (ty === "choice") inputs = optLetters(t).map(function (L) { return '<label style="display:inline-block;margin:4px 10px 4px 0"><input type="checkbox" data-qsel="' + L + '"' + ((d.sel || []).indexOf(L) >= 0 ? " checked" : "") + (matched ? " disabled" : "") + "> " + L + "</label>"; }).join("");
      else if (nparts(t) > 1) { for (var pi = 0; pi < nparts(t); pi++) inputs += '<input data-qin="p' + pi + '" placeholder="第 ' + (pi + 1) + ' 格" value="' + E(d["p" + pi] || "") + '" style="min-width:130px"' + (matched ? " disabled" : "") + ">"; }
      else inputs = '<input data-qin="ans" value="' + E(d.ans || "") + '" style="flex:1;min-width:160px"' + (matched ? " disabled" : "") + ">";
      h += "<label>你們的答案" + (s.wrong ? "（已答錯 " + s.wrong + " 次" + (t.cat === "A" ? "，再錯 " + (maxWrong() - s.wrong) + " 次將公布答案，本關 0 分" : "") + "）" : "") + (ty === "choice" ? "（可複選）" : "") + '</label><div class="row">' + inputs +
        (t.mode !== "text" && !matched ? '<button class="pri" data-do="qAnswer">核對答案</button>' : "") + "</div>" + (matched ? "<p>" + badge("答對了！", "ok") + "</p>" : "");
      if (ui.msg && t.mode !== "text") h += '<p class="mut">' + E(ui.msg) + "</p>";
    }
    if (t.mode === "media") {
      h += '<h3 style="margin-top:12px">③ 上傳成果（照片或影片）</h3>' + (t.photoTip ? "<p>" + E(t.photoTip) + "</p>" : "") +
        '<input type="file" accept="image/*,video/*" data-qfile="1">' + (ui.photo ? "<p>" + (ui.kind === "video" ? '<video src="' + ui.photo + '" controls playsinline style="max-width:100%;max-height:260px;border-radius:10px"></video>' : '<img src="' + ui.photo + '" alt="" style="max-width:100%;max-height:260px;border-radius:10px">') + "</p>" : "") +
        '<p class="mut">' + (KC.cloud ? "雲端模式：影片檔上限約 " + Math.round(FILE_MAX / 1024) + " KB（約數秒低畫質）；較大的影片請上傳到雲端硬碟，並在下方貼上分享連結。" : "單機模式：影片上限 30MB。") + '</p><input data-qin="link" placeholder="或貼上影片／雲端硬碟連結（選填）" value="' + E(d.link || "") + '" style="width:100%">' +
        '<div class="row"><button class="pri" data-do="qSubmit">送出，等待行政端核可</button></div>';
      return h + "</div>";
    }
    var canPhoto = t.mode === "photo" || t.mode === "text" || (t.mode === "match" && matched);
    if (canPhoto) {
      h += '<h3 style="margin-top:12px">③ 拍照</h3>' + (t.photoTip ? "<p>" + E(t.photoTip) + "</p>" : "") +
        '<input type="file" accept="image/*" capture="environment" data-qfile="1">' + (ui.photo ? '<p><img src="' + ui.photo + '" alt="" style="max-width:100%;max-height:260px;border-radius:10px"></p>' : "") +
        '<div class="row"><button class="pri" data-do="qSubmit">送出審核</button></div>';
    }
    return h + "</div>";
  }
  var studentH = {
    qTReset: function (d, el, c) {
      if (!confirm("清除本小隊所有測試紀錄（分數、答錯次數、時間），重新開始計時？\n正式成績不受影響。")) return;
      var q = KCQ.q(), id = tid(c.me()); Object.keys(q.subs).forEach(function (k) { if (q.subs[k].team === id) delete q.subs[k]; });
      ui.task = null; ui.draft = {}; c.done();
    },
    qOpen: function (d, el, c) {
      stopNav(); ui.task = d.id; ui.tipOpen = null; ui.draft = {}; ui.photo = null; ui.msg = ""; ui.fails = 0;
      if (ui.test) { testStart(c.me()); var s = getSub(tid(c.me()), d.id, true); if (!s.arrived) { s.arrived = true; s.arrivedAt = Date.now(); return c.done(); } }   /* 測試：開啟即視為已觸發 */
      c.render();
    },
    qBack: function (d, el, c) { stopNav(); ui.task = null; c.render(); },
    qNavStart: function (d, el, c) { startNav(ui.task, c); },
    qNavStop: function (d, el, c) { stopNav(); c.render(); },
    qCheckin: function (d, el, c) {
      var t = taskById(ui.task);
      var judge = function (lat, lng, acc) {
        c.sync(); var me = c.me(), dist = Math.round(hav(lat, lng, t.lat, t.lng));
        if (dist <= radiusOf(t) + Math.min(acc || 0, 50)) { var s = getSub(tid(me), t.id, true); s.arrived = true; s.arrivedAt = Date.now(); ui.msg = ""; ui.fails = 0; stopNav(); c.done(); }
        else { ui.msg = "距離目標約 " + dist + " 公尺，還沒到喔（需在 " + radiusOf(t) + " 公尺內）"; ui.fails++; c.render(); }
      };
      if (nav.on && nav.pos && Date.now() - nav.pos.t < 15000) return judge(nav.pos.lat, nav.pos.lng, nav.pos.acc);   /* 導航中直接用最新定位 */
      ui.msg = "定位中…請稍候"; c.render();
      if (!navigator.geolocation) { ui.msg = "此裝置不支援定位"; ui.fails = 3; return c.render(); }
      navigator.geolocation.getCurrentPosition(function (p) { judge(p.coords.latitude, p.coords.longitude, p.coords.accuracy); },
        function () { ui.fails++; ui.msg = "無法取得定位，請確認已允許瀏覽器使用位置"; c.render(); }, { enableHighAccuracy: true, timeout: 15000 });
    },
    qBypass: function (d, el, c) { var s = getSub(tid(c.me()), ui.task, true); s.arrived = true; s.gpsBypass = true; s.arrivedAt = Date.now(); c.done(); },
    qTip: function (d, el, c) { var s = getSub(tid(c.me()), ui.task, true); s.tips = (s.tips || 0) + 1; ui.tipOpen = ui.task; c.done(); },
    qAnswer: function (d, el, c) {
      var t = taskById(ui.task), me = c.me(), s = getSub(tid(me), t.id, true), ty = atypeOf(t), vals, shown;
      if (ty === "choice") { vals = ui.draft.sel || []; shown = vals.slice().sort().join("、"); if (!vals.length) { ui.msg = "請先選擇答案"; return c.render(); } }
      else if (nparts(t) > 1) { vals = []; for (var i = 0; i < nparts(t); i++) vals.push(String(ui.draft["p" + i] || "").trim()); if (vals.some(function (x) { return !x; })) { ui.msg = "每一格都要填寫"; return c.render(); } shown = vals.join(" / "); }
      else { vals = [String(ui.draft.ans || "").trim()]; shown = vals[0]; if (!shown) { ui.msg = "請先輸入答案"; return c.render(); } }
      if (!checkAns(t, vals)) {
        s.wrong = (s.wrong || 0) + 1;
        if (t.cat === "A" && s.wrong >= maxWrong()) {   /* 扣滿本關分數：公布答案、本關 0 分，可繼續下一關 */
          s.revealed = true; s.answerOk = true; s.answer = shown; s.status = "approved"; s.pts = calcPts(t); s.approvedAt = Date.now(); s.at = stamp(); ui.msg = "";
          return c.done();
        }
        ui.msg = "答案不對，再想想（已錯 " + s.wrong + " 次，每次扣 " + KCQ.q().cfg.wrong + " 分" + (t.cat === "A" ? "；再錯 " + (maxWrong() - s.wrong) + " 次將公布答案，本關 0 分" : "") + "）"; return c.done();
      }
      s.answerOk = true; s.answer = shown; ui.msg = "";
      if (t.mode === "matchAuto") { s.status = "approved"; s.pts = calcPts(t, s, false); s.approvedAt = Date.now(); s.at = stamp(); }
      c.done();
    },
    qSubmit: function (d, el, c) {
      var t = taskById(ui.task), me = c.me(), team = tid(me);
      if (t.cat === "B" && !ui.test && inWindow(t) !== "open") return alert("不在開放時間內");
      var s = getSub(team, t.id, true), ans = String(ui.draft.ans || "").trim(), link = String(ui.draft.link || "").trim();
      if ((t.mode === "text") && !ans) return alert("請填寫答案");
      if (t.mode === "media") { if (!ui.photo && !link) return alert("請上傳照片／影片，或貼上連結"); }
      else if (!ui.photo) return alert("請先拍照或選擇照片");
      var fin = function (pid, kind) {
        c.sync(); var s2 = getSub(team, t.id, true);
        s2.photoId = pid || ""; s2.kind = kind || "image"; s2.link = link; if (ans) s2.answer = ans; s2.status = "pending"; s2.at = stamp(); s2.by = me.name; s2.reason = ""; ui.task = null; ui.photo = null; ui.draft = {}; c.done(); alert("已送出，等待審核");
      };
      if (!ui.photo) return fin("", "");
      var pid = team + "|" + t.id + "|" + Date.now();
      KCQ.putPhoto(pid, ui.photo).then(function () { fin(pid, ui.kind); }, function () { alert("檔案儲存失敗（可能太大），請縮小或改貼連結"); });
    }
  };

  /* ================= 審核（教師端／行政端共用）================= */
  function reviewView() {
    var q = KCQ.q(), keys = Object.keys(q.subs), pend = keys.filter(function (k) { return q.subs[k].status === "pending"; }).sort(function (a, b) { return q.subs[a].at < q.subs[b].at ? -1 : 1; });
    var apr = keys.filter(function (k) { var x = q.subs[k]; if (x.status !== "approved") return false; var t0 = taskById(x.task); return !(t0 && t0.mode === "matchAuto" && String(x.team).indexOf("T|") === 0); })   /* 測試頁的照片／限時任務審核後也列在「已通過」（自動給分的測試關卡不列，避免太多） */.sort(function (a, b) { return (q.subs[b].approvedAt || 0) - (q.subs[a].approvedAt || 0); });
    var cat = function (k) { return k.replace(/\W/g, "_"); };
    var h = '<div class="card"><div class="row"><div class="seg"><button class="' + (ui.rv === "pending" ? "on s2" : "") + '" data-do="qRv" data-v="pending">待審核（' + pend.length + '）</button><button class="' + (ui.rv === "approved" ? "on s2" : "") + '" data-do="qRv" data-v="approved">已通過（' + apr.length + "）</button></div></div></div>";
    var list = ui.rv === "pending" ? pend : apr;
    if (!list.length) h += '<div class="card"><p class="mut">' + (ui.rv === "pending" ? "沒有待審項目" : "尚無已通過項目") + "</p></div>";
    list.forEach(function (k) {
      var s = q.subs[k], t = taskById(s.task), isT = String(s.team).indexOf("T|") === 0, tm = KC.team(isT ? s.team.slice(2) : s.team); if (!t) return;
      h += '<div class="card"><div class="row"><b>' + (isT ? "🧪測試 " : "") + E(tm ? tm.name : s.team) + "</b>" + badge(t.cat + t.no, "gr") + badge(MODES[t.mode], "gr") + (s.gpsBypass ? badge("定位人工確認", "wn") : "") + (s.wrong ? badge("答錯 " + s.wrong + " 次", "no") : "") + '</div><p>' + E(t.text) + "</p>" +
        (t.answer ? '<p class="mut">標準答案：' + E(t.answer) + "</p>" : "") + '<p>學生答案：' + E(s.answer || "—") + '</p><div class="row">' +
        (t.refPhoto ? '<div><div class="mut">標準對照</div>' + img(t.refPhoto) + "</div>" : "") + (s.photoId ? '<div><div class="mut">小隊回傳</div>' + media(s.photoId, s.kind) + "</div>" : "") + (s.link ? '<div><div class="mut">連結</div><a href="' + E(s.link) + '" target="_blank" rel="noopener">' + E(s.link) + "</a></div>" : "") + "</div>";
      var lock = ui.role !== "admin";
      if (lock) h += '<p class="mut">' + (ui.rv === "approved" ? "✅ 已通過，得 " + s.pts + " 分" : "⏳ 待行政端審核") + "（教師端僅供檢視，審核由行政端進行）</p>";
      else if (ui.rv === "pending") {
        h += '<div class="row">' + (t.cat === "B" ? '<label style="margin:0">核可加分 <input type="number" id="sc_' + cat(k) + '" value="' + calcPts(t) + '" style="width:90px"></label>' : "") +
          "</div>" +
          '<div class="row"><button class="pri" data-do="qApprove" data-k="' + E(k) + '">審核通過</button></div>' +
          '<div class="row"><select id="rs_' + cat(k) + '">' + REASONS.map(function (r) { return "<option>" + r + "</option>"; }).join("") + '</select><input id="nt_' + cat(k) + '" placeholder="給學生的備註（選填）" style="flex:1;min-width:140px"><button class="dng" data-do="qReject" data-k="' + E(k) + '">退回修正</button></div>';
      } else if (ui.rv === "approved") {
        h += '<div class="row"><b>' + s.pts + ' 分</b><input type="number" id="rp_' + cat(k) + '" value="' + s.pts + '" style="width:80px"><button class="sm sec" data-do="qRescore" data-k="' + E(k) + '">修改分數</button><button class="sm dng" data-do="qRevert" data-k="' + E(k) + '">退回重做</button></div>';
      }
      h += "</div>";
    });
    return h;
  }
  var cid = function (k) { return k.replace(/\W/g, "_"); };
  var reviewH = {
    qRv: function (d, el, c) { ui.rv = d.v; c.render(); },
    qApprove: function (d, el, c) {
      var q = KCQ.q(), s = q.subs[d.k], t = taskById(s.task), b = $("bn_" + cid(d.k)), sc = $("sc_" + cid(d.k));
      s.pts = t.cat === "B" ? (sc && sc.value !== "" ? Math.max(0, +sc.value || 0) : calcPts(t)) : calcPts(t); s.bonus = !!(b && b.checked); s.status = "approved"; s.approvedAt = Date.now(); s.reason = ""; c.done();
    },
    qReject: function (d, el, c) { var s = KCQ.q().subs[d.k]; s.status = "rejected"; s.reason = $("rs_" + cid(d.k)).value; s.note = $("nt_" + cid(d.k)).value.trim(); c.done(); },
    qRescore: function (d, el, c) { KCQ.q().subs[d.k].pts = Math.max(0, +$("rp_" + cid(d.k)).value || 0); c.done(); },
    qRevert: function (d, el, c) { if (!confirm("退回後學生可重新作答，確定？")) return; var s = KCQ.q().subs[d.k]; s.status = "rejected"; s.reason = "老師要求重做"; s.pts = 0; c.done(); }
  };

  /* ================= 行政端 ================= */
  function cfgView() {
    var c = KCQ.q().cfg;
    var num = function (id, lab, v) { return '<label style="margin:0">' + lab + ' <input type="number" id="' + id + '" value="' + v + '" style="width:90px"></label>'; };
    return '<div class="card"><h3>活動時程</h3><div class="row"><label style="margin:0">日期 <input type="date" id="c_date" value="' + E(c.date) + '"></label><label style="margin:0">開始 <input type="time" id="c_st" value="' + E(c.startT) + '"></label><label style="margin:0">結束 <input type="time" id="c_en" value="' + E(c.endT) + '"></label></div>' +
      '<div class="row"><label style="margin:0"><input type="checkbox" id="c_force"' + (c.force ? " checked" : "") + '> 強制開放（測試用，忽略時間）</label></div><p class="mut">日期留空＝不限制時間。</p></div>' +
      '<div class="card"><h3>計分規則（比照 Popworld 城市探索）</h3><div class="row">' + num("c_nl", "本次關數", c.nLevels) + num("c_pc", "每關得分", c.perCP) + num("c_w", "答錯一次扣", c.wrong) + num("c_tm", "時間分滿分", c.tMax) + num("c_tf", "滿分時限（分鐘）", c.tFull) + num("c_td", "超時每分鐘扣", c.tDec) + (window.ACT === "g9" ? num("c_bp", "限時任務每題", c.bPts || 50) + num("c_bn", "限時任務題數", c.bN || 0) : "") + "</div>" +
      (window.ACT === "g9" ? '<div class="card" style="margin:10px 0"><h4 style="margin:0 0 6px">🧪 關卡測試頁</h4><label style="margin:0"><input type="checkbox" id="c_test"' + (c.testOn !== false ? " checked" : "") + '> 開放關卡測試頁（功能比照正式闖關，只是不需 GPS 觸發；成績另外計算，不進排行榜）</label><p>測試頁網址：<a href="test.html" target="_blank" rel="noopener">' + E(location.href.replace(/[^\/]*$/, "test.html")) + '</a>（用小隊帳號登入，例如 901-1）</p><p class="mut">正式活動當天請取消勾選並儲存，否則拿到網址的人可以提前看到所有題目。</p></div>' : "") +
      '<div class="card" style="margin:10px 0"><h4 style="margin:0 0 6px">📍 題目觸發半徑</h4><div class="row">' + num("c_rd", "預設觸發半徑（公尺）", c.radiusDefault) + '<button class="sec" data-do="qRadiusAll">套用到全部題目（覆蓋個別設定）</button></div><p class="mut">學生走進目標點此半徑內（再加上手機定位誤差，最多 +50 公尺）即可打卡並看到題目。個別題目可在「編輯題目」中自訂，填 0 表示使用預設值。</p></div>' +
      '<p class="mut">總分 ＝ 時間分數 ＋ 每關得分 × 通過關數 − 答錯次數 × 扣分。時間分數：自活動開始時間起算，' + c.tFull + " 分鐘內全部通關得 " + c.tMax + " 分；超過後每分鐘扣 " + c.tDec + " 分，扣到 0 為止（約 " + (c.tFull + Math.ceil(c.tMax / Math.max(1, c.tDec))) + " 分鐘）。需全部關卡通過才計時間分，且需設定活動日期。設定 " + c.nLevels + " 關" + (c.bN ? "；另設限時任務 " + (c.bPts || 50) + " 分／題，共 " + c.bN + " 題 " + (c.bPts || 50) * c.bN + " 分" : "") + "。滿分 " + (c.tMax + c.perCP * c.nLevels + (c.bN ? (c.bPts || 50) * c.bN : 0)) + " 分（關卡 " + (c.perCP * c.nLevels) + " ＋ 時間 " + c.tMax + (c.bN ? " ＋ 限時任務 " + (c.bPts || 50) * c.bN : "") + "）。答錯一次扣 " + c.wrong + " 分，每關最多扣到 0 分；同一關答錯 " + maxWrong() + " 次會自動公布答案，該關 0 分，小隊可繼續下一關。</p>" + (activeTasks("A").length !== c.nLevels ? '<p class="b no" style="display:block">⚠️ 題庫目前啟用 ' + activeTasks("A").length + " 關，與設定的 " + c.nLevels + ' 關不符，請到「任務題庫」勾選本次使用的題目（或按「僅啟用前 ' + c.nLevels + ' 題」）。</p>' : '<p class="mut">題庫啟用關數與設定相符 ✔</p>') + "</div>" +
      '<div class="card"><h3>重新開始</h3><p class="mut">清除所有小隊的闖關紀錄與定位，題庫與設定保留。測試後正式開跑前使用。</p><div class="row"><input id="c_rs" placeholder="輸入 RESET 確認" style="width:150px"><button class="dng" data-do="qReset">清除闖關紀錄</button></div></div>' +
      '<div class="card"><h3>地圖中心</h3><div class="row"><select id="c_pre" data-do="qPre">' + PRESETS.map(function (p, i) { return '<option value="' + i + '">' + p[0] + "</option>"; }).join("") + '</select><label style="margin:0">緯度 <input id="c_lat" value="' + c.center.lat + '" style="width:110px"></label><label style="margin:0">經度 <input id="c_lng" value="' + c.center.lng + '" style="width:110px"></label></div></div>' +
      '<div class="row"><button class="pri" data-do="qSaveCfg">儲存活動設定</button></div>';
  }
  function taskView() {
    var c0 = KCQ.q().cfg;
    var q = KCQ.q(), e = ui.edit, list = q.tasks.filter(function (t) { return t.cat === ui.filter; }).sort(function (a, b) { return a.no - b.no; });
    var h = '<div class="card"><div class="row"><div class="seg">' + ["A", "B"].map(function (x) { return '<button class="' + (ui.filter === x ? "on s2" : "") + '" data-do="qFilter" data-v="' + x + '">' + (x === "A" ? "A 關卡" : "B 限時挑戰") + "</button>"; }).join("") + '</div><button class="pri" data-do="qNewTask">＋ 新增題目</button>' +
      '<button class="sec" data-do="qFirstN">僅啟用前 ' + c0.nLevels + ' 題（依題號）</button>' + (window.KCQ_BANK ? '<button class="sec" data-do="qBank">匯入試算表題庫（' + window.KCQ_BANK.length + ' 題）</button>' : "")  + "</div></div>";
    if (e) h += editor(e);
    if (ui.filter === "A") h += '<div class="card"><div class="row" style="justify-content:space-between"><h3 style="margin:0">🗺️ 關卡地圖（' + list.filter(function (t) { return t.active && t.useGps; }).length + ' 關啟用）</h3><div class="seg">' + [["m", "地圖"], ["y", "衛星"]].map(function (x) { return '<button class="' + (BM.ly === x[0] ? "on s2" : "") + '" data-do="qbmLy" data-v="' + x[0] + '">' + x[1] + "</button>"; }).join("") + '</div><button class="sec sm" data-do="qbmFit">顯示全部關卡</button><label style="margin:0"><input type="checkbox" data-do="qbmOff"' + (BM.off ? " checked" : "") + '> 顯示停用關卡</label></div>' +
      '<div id="qbmHost" style="margin-top:8px"></div><p class="mut" id="qbmNote">紅點＝啟用關卡，黃色圓圈＝觸發半徑；灰色虛線＝停用關卡。點關卡可看座標、半徑並直接編輯。' + (e ? "<b>編輯中：在地圖上點一下，就會把該位置填入「緯度／經度」（藍色圈＝目前填的位置與半徑）。</b>" : "") + "</p></div>";
    h += '<div class="card"><h3>' + (ui.filter === "B" ? "限時挑戰（" : "關卡題庫（") + list.length + "）</h3><div class=\"scroll\"><table><tr><th>題號</th><th>內容</th><th>模式</th><th>座標</th><th>啟用</th><th></th></tr>" +
      (list.map(function (t) {
        return "<tr><td>" + t.cat + t.no + "</td><td>" + E((t.item || t.place ? (t.item || t.place) + "：" : "") + t.text.slice(0, 24)) + (t.approx ? " " + badge("座標待確認", "wn") : "") + "<span class=\"mut\"> [" + ({ text: "單一答案", parts: "依序多格", set: "多格不計序", choice: "選擇題" }[t.atype || "text"]) + "]</span>" + "</td><td>" + MODES[t.mode] + "</td><td class=\"mut\">" + (t.cat === "B" ? bWin(t) + "｜+" + calcPts(t) + "　" : "") + (t.useGps ? t.lat + ", " + t.lng + " ±" + radiusOf(t) + "m" + (+t.radius > 0 ? "" : "(預設)") : "—") + '</td><td><input type="checkbox" data-do="qActive" data-id="' + t.id + '"' + (t.active ? " checked" : "") + '></td><td><button class="sm sec" data-do="qEdit" data-id="' + t.id + '">編輯</button> <button class="sm dng" data-do="qDel" data-id="' + t.id + '">刪</button></td></tr>';
      }).join("") || '<tr><td colspan="6" class="mut">尚無題目</td></tr>') + "</table></div></div>";
    return h;
  }
  function editor(e) {
    var inp = function (k, lab, ph, st) { return "<label>" + lab + '</label><input data-qe="' + k + '" value="' + E(e[k] == null ? "" : e[k]) + '" placeholder="' + (ph || "") + '" style="' + (st || "width:100%") + '">'; };
    return '<div class="card"><h3>' + (e._new ? "新增" : "編輯") + "題目</h3><div class=\"row\"><label style=\"margin:0\">類別 <select data-qe=\"cat\">" + [["A", "A 關卡"], ["B", "B 限時挑戰"]].map(function (x) { return "<option value=\"" + x[0] + "\"" + (e.cat === x[0] ? " selected" : "") + ">" + x[1] + "</option>"; }).join("") + "</select></label>" +
      '<label style="margin:0">題號 <input type="number" data-qe="no" value="' + e.no + '" style="width:80px"></label><label style="margin:0">模式 <select data-qe="mode">' + Object.keys(MODES).map(function (m) { return '<option value="' + m + '"' + (e.mode === m ? " selected" : "") + ">" + MODES[m] + "</option>"; }).join("") + "</select></label></div>" +
      inp("place", "地點名稱／關卡代號（例：CP1）") + inp("code", "關卡編號（匯入題庫用，例：CP1）", "", "width:160px") + inp("item", "項目（抵達後才顯示的標題）") + inp("addr", "地址（抵達前顯示）") +  '<label>題目敘述（抵達後才揭曉）</label><textarea data-qe="text">' + E(e.text) + "</textarea>" + inp("hint", "地圖判讀提示（抵達前顯示，不要透露答案）") +
      "<label>答案格式</label>" + '<div class="row"><select data-qe="atype">' + [["text", "單一答案"], ["parts", "依序多格（用 / 分隔）"], ["set", "多格不計順序（用 / 分隔）"], ["choice", "選擇題（可複選，例：C、D）"]].map(function (x) { return '<option value="' + x[0] + '"' + ((e.atype || "text") === x[0] ? " selected" : "") + ">" + x[1] + "</option>"; }).join("") + '</select><label style="margin:0">格數 <input type="number" data-qe="nparts" value="' + (e.nparts || 1) + '" style="width:70px"></label></div>' +
      inp("answer", "標準答案（同一格可用 | 列出多個可接受寫法；多格用 / 分隔）") +
      '<label>關卡故事前言（抵達後顯示）</label><textarea data-qe="intro">' + E(e.intro || "") + '</textarea><label>作答說明／選項（顯示在謎題下方）</label><textarea data-qe="note">' + E(e.note || "") + '</textarea>' + inp("tip", "謎題提示（學生按「需要提示」才顯示）") + '<label>關卡故事後續（答對後顯示）</label><textarea data-qe="after">' + E(e.after || "") + "</textarea>" +
      [["clueImg", "謎題線索圖片"], ["tipImg", "提示圖片"], ["introImg", "前言圖片"], ["afterImg", "後續圖片"]].map(function (x) { return "<label>" + x[1] + '</label><input type="file" accept="image/*" data-qimg="' + x[0] + '">' + (e[x[0]] ? "<p>" + img(e[x[0]]) + ' <button class="sm dng" data-do="qImgDel" data-f="' + x[0] + '">移除</button></p>' : ""); }).join("") + inp("photoTip", "指定拍照說明") +
      '<div class="row"><label style="margin:0"><input type="checkbox" data-qe="useGps"' + (e.useGps ? " checked" : "") + '> 啟用 GPS 抵達打卡</label></div>' +
      '<div class="row"><label style="margin:0">緯度 <input data-qe="lat" value="' + e.lat + '" style="width:120px"></label><label style="margin:0">經度 <input data-qe="lng" value="' + e.lng + '" style="width:120px"></label><label style="margin:0">觸發半徑(公尺，0＝用預設 '+(KCQ.q().cfg.radiusDefault||120)+') <input type="number" min="0" data-qe="radius" value="' + e.radius + '" style="width:90px"></label></div>' +
      '<div class="row"><label style="margin:0">貼上 Google Maps 座標 <input id="q_paste" placeholder="1.2868, 103.8545" style="width:180px"></label><button class="sm sec" data-do="qPaste">套用</button></div>' +
      (e.cat === "B" ? '<div class="row"><label style="margin:0">限時挑戰分數 <input type="number" data-qe="pts" value="' + (e.pts == null || e.pts === "" ? calcPts({ cat: "B" }) : e.pts) + '" style="width:80px"></label><label style="margin:0">B 開放時間 <input type="time" data-qe="bStart" value="' + E(e.bStart) + '"></label><label style="margin:0">完成期限 <input type="time" data-qe="bEnd" value="' + E(e.bEnd) + '"></label></div>' : '<p class="mut">關卡分數一律依「⚙️ 闖關設定」的每關得分計算（目前 ' + KCQ.q().cfg.perCP + ' 分）。</p>') +
      '<label>標準對照照片（教師審核用，學生看不到）</label><input type="file" accept="image/*" data-qref="1">' + (e.refPhoto ? "<p>" + img(e.refPhoto) + "</p>" : "") +
      '<div class="row"><label style="margin:0"><input type="checkbox" data-qe="active"' + (e.active ? " checked" : "") + '> 本次活動使用</label></div><div class="row"><button class="pri" data-do="qSaveTask">儲存</button><button class="sec" data-do="qCancel">取消</button></div></div>';
  }
  function readForm() {
    var e = ui.edit; if (!e) return;
    [].forEach.call(document.querySelectorAll("[data-qe]"), function (el) {
      var k = el.dataset.qe, v = el.type === "checkbox" ? el.checked : el.value;
      if (k === "fields") v = String(v).split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
      else if (k === "no" || k === "radius" || k === "nparts" || k === "pts") v = +v || 0; else if (k === "lat" || k === "lng") v = parseFloat(v) || 0;
      e[k] = v;
    });
  }
  function rankView() {
    var q = KCQ.q(), c = q.cfg, rows = KC.S.teams.map(function (t) { return { t: t, s: KCQ.score(t.id) }; }).sort(function (a, b) { return b.s.total - a.s.total || a.s.last - b.s.last; }), n = activeTasks("A").length;
    if (ui.host) return '<div class="card" style="text-align:center"><div class="row" style="justify-content:space-between"><b style="font-size:22px">📺 ' + E(KC.cfg.name) + ' 成績排行</b><button class="sm sec" data-do="qHost">離開主持畫面</button></div><table style="font-size:22px;width:100%">' +
      rows.map(function (r, i) { return '<tr><td style="width:60px"><b>' + (i + 1) + "</b></td><td>" + E(r.t.name) + "</td><td>" + r.s.aDone + "／" + n + "關</td><td>" + elapsed(c, r.s) + '</td><td style="text-align:right"><b style="color:var(--ac)">' + r.s.total + "</b></td></tr>"; }).join("") + '</table><p class="mut">每 20 秒自動更新</p></div>';
    return '<div class="card"><h3>小隊成績榜</h3><div class="row"><button class="pri" data-do="qHost">📺 主持畫面</button><button class="sec" data-do="qExpRank">匯出 CSV</button></div><div class="scroll"><table><tr><th>名次</th><th>小隊</th><th>通關</th><th>關卡分</th><th>用時</th><th>時間分</th><th>挑戰加分</th><th>答錯（扣分）</th><th>總分</th></tr>' +
      (rows.map(function (r, i) { return "<tr><td>" + (i + 1) + "</td><td>" + E(r.t.name) + "</td><td>" + r.s.aDone + "／" + n + "</td><td>" + r.s.a + "</td><td>" + elapsed(c, r.s) + "</td><td>" + (r.s.done ? r.s.timePts : "—") + "</td><td>" + r.s.b + "</td><td>" + r.s.wrongN + "（-" + r.s.pen + "）</td><td><b>" + r.s.total + "</b></td></tr>"; }).join("") || '<tr><td colspan="9" class="mut">尚未編組</td></tr>') + "</table></div>" +
      '<p class="mut">時間分在小隊全部通關後才計入；限時挑戰加分經行政端核可後計入；同分時先完成者名次在前。</p></div>';
  }
  function mapView() {
    var q = KCQ.q(), now = Date.now();
    var rows = KC.S.teams.map(function (t) {
      var p = q.pings[t.id], age = p ? Math.round((now - p.t) / 1000) : null;
      return "<tr><td>" + E(t.name) + "</td><td>" + (p ? (age < 90 ? badge("在線", "ok") : badge(Math.round(age / 60) + " 分前", "wn")) : badge("未連線", "gr")) + "</td><td class=\"mut\">" + (p && p.lat ? p.lat.toFixed(5) + ", " + p.lng.toFixed(5) : "—") + "</td></tr>";
    }).join("");
    return '<div class="card"><h3>即時地圖</h3><div id="qmap" style="height:380px;border-radius:12px;border:1px solid var(--line);background:var(--line)"></div><p class="mut" id="qmapnote">藍點＝任務點位，橘點＝小隊最後回報位置。地圖需連網載入。</p><div class="row"><button class="sec" data-do="qRefresh">重新整理</button></div></div>' +
      '<div class="card"><h3>小隊連線狀態</h3><table><tr><th>小隊</th><th>狀態</th><th>最後座標</th></tr>' + (rows || '<tr><td colspan="3" class="mut">尚未編組</td></tr>') + "</table></div>";
  }
  function msgView() {
    var ns = KC.S.notices.slice().reverse();
    return '<div class="card"><h3>廣播訊息</h3><div class="row"><select id="m_to"><option value="">全體小隊</option>' + KC.S.teams.map(function (t) { return '<option value="' + t.id + '">' + E(t.name) + "</option>"; }).join("") + '</select></div><textarea id="m_tx" placeholder="訊息內容"></textarea><div class="row"><button class="pri" data-do="qSend">發送</button></div></div>' +
      '<div class="card"><h3>紀錄</h3>' + (ns.map(function (n) { var t = KC.team(n.team); return '<div class="nt"><div class="mut">' + E(n.at) + " → " + (t ? E(t.name) : "全體") + '</div>' + E(n.text) + "</div>"; }).join("") || '<p class="mut">尚無訊息</p>') + "</div>";
  }
  var adminH = {
    qFilter: function (d, el, c) { ui.filter = d.v; ui.edit = null; c.render(); },
    qNewTask: function (d, el, c) { ui.edit = { _new: true, id: KC.uid(), cat: ui.filter, no: KCQ.q().tasks.filter(function (t) { return t.cat === ui.filter; }).length + 1, text: "", hint: "", mode: ui.filter === "B" ? "media" : "photo", pts: 10, answer: "", lat: KCQ.q().cfg.center.lat, lng: KCQ.q().cfg.center.lng, radius: 150, useGps: false, photoTip: "", bStart: "", bEnd: "", fields: [], active: true, place: "" }; c.render(); },
    qFirstN: function (d, el, c) { var q = KCQ.q(), n = q.cfg.nLevels; if (!confirm("依題號只啟用前 " + n + " 題，其餘停用，確定？")) return; q.tasks.filter(function (t) { return t.cat === "A"; }).sort(function (a, b) { return a.no - b.no; }).forEach(function (t, i) { t.active = i < n; }); c.done(); },
    qBank: function (d, el, c) { if (!confirm("將匯入題庫 " + (window.KCQ_BANK || []).length + " 關指定關卡：同題號 CPn 會被覆蓋，不在題庫中的舊 CP 關卡會停用（紀錄保留），確定？")) return; var r = importBank(); c.done(); alert("完成：新增 " + r[0] + " 題、更新 " + r[1] + " 題" + (r[2] ? "，停用不在題庫中的舊關卡 " + r[2] + " 題" : "") + "。標示「座標待確認」的題請現場校正。"); },
    qImgDel: function (d, el, c) { readForm(); ui.edit[d.f] = ""; c.render(); },
    qSeed: function (d, el, c) { var n = seed(); c.done(); alert("已載入 " + n + " 題（座標為概略位置，請現場勘查後校正）"); },
    qEdit: function (d, el, c) { ui.edit = JSON.parse(JSON.stringify(taskById(d.id))); c.render(); },
    qCancel: function (d, el, c) { ui.edit = null; c.render(); },
    qDel: function (d, el, c) { if (!confirm("刪除此題？已有的作答紀錄也會失效")) return; var q = KCQ.q(); q.tasks = q.tasks.filter(function (t) { return t.id !== d.id; }); c.done(); },
    qActive: function (d, el, c) { taskById(d.id).active = el.checked; c.done(); },
    qPaste: function (d, el, c) { var m = String($("q_paste").value).match(/(-?\d+\.?\d*)\s*[, ]\s*(-?\d+\.?\d*)/); if (!m) return alert("格式應為：1.2868, 103.8545"); readForm(); ui.edit.lat = +m[1]; ui.edit.lng = +m[2]; c.render(); },
    qSaveTask: function (d, el, c) {
      readForm(); var e = ui.edit; if (!e.text.trim()) return alert("請填寫題目敘述");
      if (e.useGps && (!e.lat || !e.lng)) return alert("啟用 GPS 需設定座標");
      if ((e.mode === "match" || e.mode === "matchAuto") && !e.answer.trim()) return alert("此模式需要標準答案");
      delete e._new; var q = KCQ.q(), i = q.tasks.map(function (t) { return t.id; }).indexOf(e.id); if (i < 0) q.tasks.push(e); else q.tasks[i] = e; ui.edit = null; c.done();
    },
    qSaveCfg: function (d, el, c) {
      var q = KCQ.q(), g = function (i) { return +$(i).value || 0; }, cf = q.cfg;
      cf.date = $("c_date").value; cf.startT = $("c_st").value || "13:30"; cf.endT = $("c_en").value || "21:00"; cf.force = $("c_force").checked;
      cf.nLevels = g("c_nl"); cf.perCP = g("c_pc"); cf.wrong = g("c_w"); cf.tMax = g("c_tm"); cf.tFull = g("c_tf"); cf.tDec = g("c_td"); if ($("c_bp")) { cf.bPts = g("c_bp"); cf.bN = g("c_bn"); } cf.radiusDefault = Math.max(10, g("c_rd") || 120); if ($("c_test")) cf.testOn = $("c_test").checked;
      cf.center = { name: cf.center.name, lat: parseFloat($("c_lat").value) || cf.center.lat, lng: parseFloat($("c_lng").value) || cf.center.lng }; c.done(); alert("已儲存");
    },
    qPre: function (d, el, c) { var p = PRESETS[+el.value]; $("c_lat").value = p[1]; $("c_lng").value = p[2]; },
    qRadiusAll: function (d, el, c) { var v = Math.max(10, +$("c_rd").value || 120); if (!confirm("將全部題目的觸發半徑都設為 " + v + " 公尺（覆蓋個別設定），確定？")) return; var q = KCQ.q(); q.cfg.radiusDefault = v; q.tasks.forEach(function (t) { t.radius = v; }); c.done(); alert("已套用"); },
    qReset: function (d, el, c) { if ($("c_rs").value !== "RESET") return alert("請輸入 RESET"); var q = KCQ.q(); q.subs = {}; q.pings = {}; c.done(); alert("已清除闖關紀錄"); },
    qHost: function (d, el, c) { ui.host = !ui.host; clearInterval(ui.hostT); if (ui.host) ui.hostT = setInterval(function () { if (ui.host && KC.rerender) KC.rerender(); }, 20000); c.render(); },
    qRefresh: function (d, el, c) { c.render(); },
    qExpRank: function () { var c = KCQ.q().cfg; KC.csv("闖關成績", [["小隊", "通關數", "關卡分", "用時", "時間分", "挑戰加分", "答錯次數", "扣分", "總分"]].concat(KC.S.teams.map(function (t) { var s = KCQ.score(t.id); return [t.name, s.aDone, s.a, elapsed(c, s), s.done ? s.timePts : "", s.b, s.wrongN, s.pen, s.total]; }))); },
    qSend: function (d, el, c) { var t = $("m_tx").value.trim(); if (!t) return; KC.S.notices.push({ id: KC.uid(), text: t, team: $("m_to").value, at: stamp() }); c.done(); }
  };

  /* ---------- 掛載與事件 ---------- */
  KCQ.mount = function (role, c) {
    ui.role = role;
    function add(after, tab) { var i = -1; c.TABS.forEach(function (t, j) { if (t[0] === after) i = j; }); c.TABS.splice(i + 1, 0, tab); }
    var ctx = { render: c.render, done: c.done, sync: c.sync, me: c.me };
    function bind(map) { Object.keys(map).forEach(function (k) { c.H[k] = function (d, el) { map[k](d, el, ctx); }; }); }
    if (role === "student") {
      add("home", ["quest", "🗺️ 闖關"]); c.V.quest = function () { return studentView(c.me()); }; bind(studentH);
      if (!w.KCL && !w.KCTEST) setInterval(function () { var m = c.me(); if (!m || !m.team) return; var send = function (lat, lng) { KC.reload(); var q = KCQ.q(); q.pings[m.team] = { t: Date.now(), lat: lat, lng: lng, by: m.name }; KC.save(); };
        if (navigator.geolocation) navigator.geolocation.getCurrentPosition(function (p) { send(p.coords.latitude, p.coords.longitude); }, function () { send(null, null); }, { maximumAge: 30000, timeout: 8000 }); else send(null, null); }, 30000);
    } else {
      add(role === "teacher" ? "roll" : "teams", ["qreview", role === "teacher" ? "📝 關卡檢核（檢視）" : "📝 闖關審核"]); c.V.qreview = reviewView; bind(role === "teacher" ? { qRv: reviewH.qRv } : reviewH);
      if (role === "teacher") { add("qreview", ["qrank", "🏆 闖關成績"]); add("qrank", ["qmap", "📡 即時地圖"]); c.V.qrank = rankView; c.V.qmap = mapView; bind({ qHost: adminH.qHost, qExpRank: adminH.qExpRank, qRefresh: adminH.qRefresh }); }
      if (role === "admin") {
        add("qreview", ["qtask", "🗺️ 任務題庫"]); add("qtask", ["qcfg", "⚙️ 闖關設定"]); add("qcfg", ["qrank", "🏆 闖關成績"]); add("qrank", ["qmap", "📡 即時地圖"]); add("qmap", ["qmsg", "📢 廣播"]);
        c.V.qtask = taskView; c.V.qcfg = cfgView; c.V.qrank = rankView; c.V.qmap = mapView; c.V.qmsg = msgView; bind(adminH);
      }
    }
    if (w.KCL && KCL.mount) KCL.mount(role, c);
    document.addEventListener("input", function (e) { var k = e.target.dataset && e.target.dataset.qin; if (k) ui.draft[k] = e.target.value; });
    document.addEventListener("change", function (e) { var L = e.target.dataset && e.target.dataset.qsel; if (!L) return; var a = ui.draft.sel || []; a = a.filter(function (x) { return x !== L; }); if (e.target.checked) a.push(L); ui.draft.sel = a; });
    document.addEventListener("change", function (e) {
      var t = e.target; if (!t.files || !t.files[0]) return;
      if (t.dataset.qfile) {
        var f = t.files[0];
        if (/^video\//.test(f.type)) {
          var lim = KC.cloud ? FILE_MAX : 30 * 1024 * 1024;
          if (f.size > lim) { t.value = ""; return alert("影片超過 " + (KC.cloud ? Math.round(FILE_MAX / 1024) + " KB" : "30MB") + "，請縮短／壓縮，或上傳雲端硬碟後貼上連結"); }
          var fr = new FileReader(); fr.onload = function () { ui.photo = fr.result; ui.kind = "video"; c.render(); }; fr.readAsDataURL(f);
        } else KCQ.compress(f, function (d) { ui.photo = d; ui.kind = "image"; c.render(); });
      }
      if (t.dataset.qimg) { var fld = t.dataset.qimg; KCQ.compress(t.files[0], function (d) { readForm(); var id = fld + "|" + ui.edit.id; KCQ.putPhoto(id, d).then(function () { ui.edit[fld] = id; c.render(); }); }); }
      if (t.dataset.qref) KCQ.compress(t.files[0], function (d) { readForm(); var id = "ref|" + ui.edit.id; KCQ.putPhoto(id, d).then(function () { ui.edit.refPhoto = id; c.render(); }); });
    });
  };
  /* 每次 render 之後：載入照片、初始化地圖 */
  KCQ.post = function (root) {
    [].forEach.call(root.querySelectorAll("img[data-photo],video[data-photo]"), function (im) { KCQ.getPhoto(im.dataset.photo).then(function (d) { if (d) im.src = d; }); });
    if (nav.on) { if ($("qnav")) updateNav(); else stopNav(); }
    if ($("qmap")) initMap();
    if ($("qbmHost")) bankMap();
    if (w.KCL && KCL.post) KCL.post(root);
  };
  function initMap() {
    var go = function () {
      var el = $("qmap"); if (!el || !w.L) return;
      var q = KCQ.q(), c = q.cfg.center, m = w.L.map(el).setView([c.lat, c.lng], 13);
      w.L.tileLayer(GTILE, { subdomains: "0123", maxZoom: 20, attribution: "地圖資料 ©Google" }).addTo(m);
      q.tasks.filter(function (t) { return t.active && t.useGps; }).forEach(function (t) { w.L.circleMarker([t.lat, t.lng], { radius: 7, color: "#2f6b9a", fillOpacity: .8 }).addTo(m).bindPopup(t.cat + t.no + " " + E(t.place || "")); w.L.circle([t.lat, t.lng], { radius: radiusOf(t), color: "#2f6b9a", weight: 1, fillOpacity: .08 }).addTo(m); });
      Object.keys(q.pings).forEach(function (id) { var p = q.pings[id], tm = KC.team(id); if (p.lat) w.L.circleMarker([p.lat, p.lng], { radius: 9, color: "#d9822b", fillOpacity: .9 }).addTo(m).bindPopup(E(tm ? tm.name : id)); });
    };
    if (w.L) return go();
    var css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(css);
    var s = document.createElement("script"); s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; s.onload = go;
    s.onerror = function () { var n = $("qmapnote"); if (n) n.textContent = "地圖載入失敗（需要網路），請參考下方座標列表。"; }; document.head.appendChild(s);
  }
  /* 行政端「任務題庫」關卡地圖（Google 地圖底圖） */
  var BM = { node: null, map: null, lay: null, tile: null, ly: "m", off: false, fitted: false, loading: false };
  function loadL(cb, fail) {
    if (w.L) return cb();
    if (!document.querySelector('link[href*="leaflet.css"]')) { var css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(css); }
    var s = document.createElement("script"); s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; s.onload = cb; s.onerror = fail; document.head.appendChild(s);
  }
  function bmTile() {
    if (BM.tile) BM.map.removeLayer(BM.tile);
    BM.tile = w.L.tileLayer("https://mt{s}.google.com/vt/lyrs=" + BM.ly + "&hl=zh-TW&gl=SG&x={x}&y={y}&z={z}", { subdomains: "0123", maxZoom: 20, attribution: "地圖資料 ©Google" }).addTo(BM.map);
  }
  function tCode(t) { return t.code || t.cat + t.no; }
  function bmDraw() {
    var L = w.L, q = KCQ.q(), pts = []; BM.lay.clearLayers();
    q.tasks.filter(function (t) { return t.cat === "A" && t.useGps && t.lat && t.lng && (t.active || BM.off); }).sort(function (a, b) { return a.no - b.no; }).forEach(function (t) {
      var on = t.active, r = radiusOf(t), col = on ? "#e53935" : "#9e9e9e";
      L.circle([t.lat, t.lng], { radius: r, color: on ? "#f9a825" : "#9e9e9e", weight: 2, dashArray: on ? null : "5 5", fillColor: on ? "#ffd54a" : "#bdbdbd", fillOpacity: on ? .25 : .1 }).addTo(BM.lay);
      L.circleMarker([t.lat, t.lng], { radius: 8, color: "#fff", weight: 2, fillColor: col, fillOpacity: 1 }).addTo(BM.lay)
        .bindTooltip(E(tCode(t)), { permanent: true, direction: "top", offset: [0, -8], className: "qbmTip" })
        .bindPopup("<b>" + E(tCode(t)) + "　" + E(t.place || t.item || "") + "</b><br>" + t.lat + ", " + t.lng + "<br>觸發半徑 " + r + " 公尺" + (+t.radius > 0 ? "" : "（預設）") + (on ? "" : "<br>（停用中）") +
          '<br><a href="' + mapLink(t) + '" target="_blank" rel="noopener">在 Google 地圖開啟</a>　<button class="sm sec" data-do="qEdit" data-id="' + t.id + '">編輯</button>');
      pts.push([t.lat, t.lng]);
    });
    var e = ui.edit;
    if (e && e.cat === "A") {
      var la = parseFloat(($("qbmLat") || {}).value), ln = parseFloat(($("qbmLng") || {}).value), ri = +(($("qbmRad") || {}).value);
      la = isNaN(la) ? e.lat : la; ln = isNaN(ln) ? e.lng : ln; ri = ri > 0 ? ri : (+e.radius > 0 ? +e.radius : (q.cfg.radiusDefault || 120));
      if (la && ln) { L.circle([la, ln], { radius: ri, color: "#1a73e8", weight: 2, fillOpacity: .15 }).addTo(BM.lay); L.circleMarker([la, ln], { radius: 9, color: "#fff", weight: 3, fillColor: "#1a73e8", fillOpacity: 1 }).addTo(BM.lay).bindTooltip("編輯中", { permanent: true, direction: "bottom", offset: [0, 8], className: "qbmTip" }); }
    }
    if (!BM.fitted && pts.length) { BM.fitted = true; try { BM.map.fitBounds(pts, { padding: [30, 30], maxZoom: 17 }); } catch (x) {} }
    return pts;
  }
  function bankMap() {
    var host = $("qbmHost"); if (!host) return;
    if (!BM.node) { BM.node = document.createElement("div"); BM.node.style.cssText = "height:440px;border-radius:12px;border:1px solid var(--line);background:#e8eef3"; }
    if (BM.node.parentNode !== host) host.appendChild(BM.node);
    if (!document.getElementById("qbmCss")) { var st = document.createElement("style"); st.id = "qbmCss"; st.textContent = ".qbmTip{background:#fff;color:#c62828;border:1px solid #e53935;font-weight:700;padding:0 4px;font-size:12px;box-shadow:none}.qbmTip:before{display:none}.leaflet-popup-content{color:#222}"; document.head.appendChild(st); }
    /* 編輯欄位改動時，地圖上的藍圈跟著更新 */
    [].forEach.call(document.querySelectorAll('[data-qe="lat"],[data-qe="lng"],[data-qe="radius"]'), function (el) { el.id = { lat: "qbmLat", lng: "qbmLng", radius: "qbmRad" }[el.dataset.qe]; if (!el._bm) { el._bm = 1; el.addEventListener("input", function () { if (BM.map) bmDraw(); }); } });
    loadL(function () {
      if (!BM.map) {
        var c = KCQ.q().cfg.center || { lat: 1.2868, lng: 103.8545 };
        BM.map = w.L.map(BM.node).setView([c.lat, c.lng], 15); bmTile(); BM.lay = w.L.layerGroup().addTo(BM.map);
        BM.map.on("click", function (ev) {
          var a = $("qbmLat"), b = $("qbmLng"); if (!ui.edit || !a || !b) return;
          a.value = ev.latlng.lat.toFixed(6); b.value = ev.latlng.lng.toFixed(6); bmDraw();
        });
      }
      setTimeout(function () { BM.map.invalidateSize(); bmDraw(); }, 0);
    }, function () { var n = $("qbmNote"); if (n) n.textContent = "地圖載入失敗（需要網路），請稍後重新整理；座標仍可在下方列表查看。"; });
  }
  Object.assign(adminH, {
    qbmLy: function (d, el, c) { BM.ly = d.v; if (BM.map) bmTile(); c.render(); },
    qbmFit: function () { if (!BM.map) return; var p = bmDraw(); if (p.length) BM.map.fitBounds(p, { padding: [30, 30], maxZoom: 17 }); },
    qbmOff: function (d, el, c) { BM.off = el.checked; if (BM.map) bmDraw(); }
  });
  /* 供 G9 派送／戰況模組使用 */
  KCQ.forTeam = function (t, team) { var tg = t && t.target; if (!tg || !tg.length || !team) return true; return tg.indexOf(team.cls || String(team.code || team.name || "").split("-")[0]) >= 0; };
  KCQ.inWindow = inWindow; KCQ.sub = function (team, task) { return getSub(team, task); }; KCQ.taskById = taskById; KCQ.activeTasks = activeTasks; KCQ.calcPts = calcPts; KCQ.hm = hm; KCQ.MODES = MODES;
  KCQ.openTask = function (id) { stopNav(); ui.task = id; ui.tipOpen = null; ui.draft = {}; ui.photo = null; ui.msg = ""; ui.fails = 0; };
  w.KCQ = KCQ;
})(window);
