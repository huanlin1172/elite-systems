/* 菁英活動系統 共用核心：資料層、活動設定、登入、工具
   兩種模式：
   ‧ 單機模式（預設）：資料存在這個瀏覽器的 localStorage
   ‧ 雲端模式：shared/firebase-config.js 填入 Firebase 設定後自動啟用，資料存在 Firestore，多裝置即時同步 */
(function (w) {
  var CFG = {
    g7: { name: "G7 校外教學 × 童軍定向", color: "#1f6f5c", unit: "小隊", teamNames: null, score: true,
      sessions: ["出發集合", "午間點名", "返校點名"],
      fields: [["diet", "飲食需求", "select", ["無", "素食", "其他"]], ["emg", "緊急聯絡人電話", "text"]] },
    g8a: { name: "G8 圓夢合歡", color: "#2f6b9a", unit: "登山小隊", teamNames: null,
      sessions: ["山訓課", "出發集合", "山屋點名", "下山點名"],
      fields: [["fit", "體能自評", "select", ["良好", "普通", "需加強"]], ["med", "過敏／慢性病", "text"], ["emg", "緊急聯絡人電話", "text"]] },
    g8b: { name: "G8 熱血三國 ‧ 隔宿露營", color: "#a14a2f", unit: "國別", teamNames: ["魏", "蜀", "吳"],
      sessions: ["入營集合", "關卡點名", "夜間點名", "晨間點名"],
      fields: [["diet", "飲食需求", "select", ["無", "素食", "其他"]], ["med", "過敏／慢性病", "text"], ["emg", "緊急聯絡人電話", "text"]] },
    /* G9 教育旅行：比照 G7 校外教學的系統（小隊制、點名場次、報名欄位、加扣分成績） */
    g9: { name: "G9 教育旅行", color: "#1b7f9e", unit: "小隊", teamNames: null, score: true,
      sessions: ["出發集合", "午間點名", "返校點名"],
      fields: [["diet", "飲食需求", "select", ["無", "素食", "其他"]], ["emg", "緊急聯絡人電話", "text"]] },
    g10: { name: "G10 單車環臺 × SEL", color: "#7b4fa0", unit: "車隊", teamNames: null,
      sessions: ["車訓課", "裝備檢核", "每日出發", "每日抵達"],
      fields: [["bike", "單車來源", "select", ["自備", "學校租借"]], ["size", "衣物尺寸", "select", ["S", "M", "L", "XL"]], ["diet", "飲食需求", "select", ["無", "素食", "其他"]], ["emg", "緊急聯絡人電話", "text"]] }
  };
  var id = w.ACT, cfg = CFG[id];
  if (!cfg) { document.body.textContent = "未指定活動"; return; }
  document.title = cfg.name;
  document.documentElement.style.setProperty("--ac", cfg.color);
  var DEMO = false;   /* 體驗模式已停用（虛擬學生體驗取消） */
  var KEY = "kcislk-elite" + (DEMO ? "-demo" : "") + ":" + id;
  var FB = DEMO ? null : (w.FIREBASE_CONFIG || null), CLOUD = !!FB;

  function fresh() {
    return { settings: { open: true, deadline: "", quota: 0, adminPin: "admin", teacherPin: "teacher" },
      students: [], teams: [], sessions: [], att: {}, leaves: [], notices: [], scores: [], folders: [], files: [], gallery: [], reminders: [], chat: [] };
  }
  function norm(S) {
    ["students", "teams", "sessions", "leaves", "notices", "scores", "folders", "files", "gallery", "msgs", "reminders", "chat"].forEach(function (k) { if (!Array.isArray(S[k])) S[k] = []; });
    S.att = S.att || {}; S.settings = Object.assign({ open: true, deadline: "", quota: 0, adminPin: "admin", teacherPin: "teacher" }, S.settings); return S;
  }
  function loadLocal() { try { return norm(JSON.parse(localStorage.getItem(KEY)) || fresh()); } catch (e) { return fresh(); } }

  var KC = { id: id, cfg: cfg, demo: DEMO, mode: CLOUD ? "cloud" : "local", isReady: !CLOUD, S: CLOUD ? fresh() : loadLocal(),
    STATUS: ["出席", "遲到", "請假", "缺席"], LTYPE: ["病假", "事假", "公假", "其他"] };

  /* ================= 雲端層（Firestore）=================
     把整份資料拆成「一筆一文件」：路徑 elite/{活動}/{集合}/{文件}。
     save() 時只寫入與雲端不同的文件，所以多支手機同時操作不會互相覆蓋。 */
  var db = null, base = null, cache = {}, snap = {}, COLS = ["settings", "students", "teams", "sessions", "notices", "scores", "leaves", "att", "qcfg", "tasks", "subs", "pings", "folders", "files", "gallery", "reminders"];
  function enc(s) { return String(s).replace(/\|/g, "__").replace(/\//g, "_"); }
  function canon(v) {
    if (v === null || typeof v !== "object") return JSON.stringify(v);
    if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
    return "{" + Object.keys(v).sort().filter(function (k) { return v[k] !== undefined; }).map(function (k) { return JSON.stringify(k) + ":" + canon(v[k]); }).join(",") + "}";
  }
  function flatten(S) {
    var m = {}, put = function (col, list) { (list || []).forEach(function (x, i) { m[col + "/" + enc(x.id)] = Object.assign({}, x, { _i: i }); }); };
    m["settings/main"] = S.settings;
    put("students", S.students); put("teams", S.teams); put("sessions", S.sessions); put("notices", (S.notices || []).concat(S.chat || []));  /* 小隊聯繫訊息（kind:"chat"）與公告共用 notices 集合 */ put("scores", S.scores); put("leaves", S.leaves); put("folders", S.folders); put("files", S.files); put("gallery", S.gallery); put("reminders", S.reminders); put("msgs", S.msgs);
    Object.keys(S.att || {}).forEach(function (sess) { Object.keys(S.att[sess]).forEach(function (sid) { m["att/" + enc(sess) + "__" + enc(sid)] = { sess: sess, sid: sid, v: S.att[sess][sid] }; }); });
    var q = S.quest;
    if (q) {
      if (q.cfg) m["qcfg/main"] = q.cfg;
      put("tasks", q.tasks);
      Object.keys(q.subs || {}).forEach(function (k) { m["subs/" + enc(k)] = Object.assign({}, q.subs[k], { _k: k }); });
      Object.keys(q.pings || {}).forEach(function (k) { m["pings/" + enc(k)] = Object.assign({}, q.pings[k], { _k: k }); });
    }
    return m;
  }
  function build() {
    var S = fresh(), g = function (c) { return cache[c] || {}; };
    var list = function (c) {
      return Object.keys(g(c)).map(function (k) { return g(c)[k]; }).sort(function (a, b) { return ((a._i || 0) - (b._i || 0)) || (String(a.id) < String(b.id) ? -1 : 1); })
        .map(function (x) { var o = Object.assign({}, x); delete o._i; return o; });
    };
    if (g("settings").main) S.settings = Object.assign(S.settings, g("settings").main);
    S.students = list("students"); S.teams = list("teams"); S.sessions = list("sessions"); S.notices = list("notices"); S.chat = S.notices.filter(function (n) { return n.kind === "chat"; }); S.notices = S.notices.filter(function (n) { return n.kind !== "chat"; }); S.scores = list("scores"); S.leaves = list("leaves"); S.folders = list("folders"); S.files = list("files"); S.gallery = list("gallery"); S.reminders = list("reminders"); S.msgs = list("msgs");
    Object.keys(g("att")).forEach(function (k) { var d = g("att")[k]; (S.att[d.sess] = S.att[d.sess] || {})[d.sid] = d.v; });
    var tasks = list("tasks"), has = tasks.length || Object.keys(g("subs")).length || Object.keys(g("pings")).length || g("qcfg").main;
    if (has) {
      S.quest = { cfg: g("qcfg").main, tasks: tasks, subs: {}, pings: {} };
      Object.keys(g("subs")).forEach(function (k) { var d = Object.assign({}, g("subs")[k]), kk = d._k; delete d._k; S.quest.subs[kk] = d; });
      Object.keys(g("pings")).forEach(function (k) { var d = Object.assign({}, g("pings")[k]), kk = d._k; delete d._k; S.quest.pings[kk] = d; });
    }
    return S;
  }
  function split(p) { var i = p.indexOf("/"); return [p.slice(0, i), p.slice(i + 1)]; }
  function ref(p) { var s = split(p); return base.collection(s[0]).doc(s[1]); }
  function cloudFail(e) {
    var m = String((e && e.code) || (e && e.message) || e), tip = /permission/i.test(m) ? "權限不足：請確認 Firestore 規則已貼上，且 Authentication 已啟用「匿名」登入。" : /network|unavailable/i.test(m) ? "網路不穩，稍後會自動重試。" : "";
    var d = document.getElementById("kc-err") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "kc-err" }));
    d.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;z-index:99;background:#b3261e;color:#fff;padding:8px 12px;border-radius:10px;font-size:13px";
    d.textContent = "雲端同步異常（" + m + "）" + tip;
  }
  function cloudSave() {
    var next = flatten(KC.S), ops = [], p, j;
    for (p in next) { j = canon(next[p]); if (snap[p] !== j) { var v = JSON.parse(JSON.stringify(next[p])), s = split(p); (cache[s[0]] = cache[s[0]] || {})[s[1]] = v; snap[p] = j; ops.push({ p: p, v: v }); } }
    Object.keys(snap).forEach(function (p) { if (!(p in next)) { var s = split(p); if (cache[s[0]]) delete cache[s[0]][s[1]]; delete snap[p]; ops.push({ p: p, del: true }); } });
    for (var i = 0; i < ops.length; i += 400) {
      var b = db.batch();
      ops.slice(i, i + 400).forEach(function (o) { if (o.del) b.delete(ref(o.p)); else b.set(ref(o.p), o.v); });
      b.commit().catch(cloudFail);
    }
  }
  function loadScript(src) { return new Promise(function (res, rej) { var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = function () { rej(new Error("無法載入 Firebase 元件（請確認網路）")); }; document.head.appendChild(s); }); }
  var rt = null, changed = {};
  function scheduleRerender() {
    if (rt || !KC.rerender) return;
    rt = setTimeout(function () {
      rt = null; var a = document.activeElement, tag = a && a.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") { if (a.type !== "checkbox" && a.type !== "button") return; }
      if (KC.rerender) KC.rerender();
    }, 700);
  }
  function startCloud() {
    var V = "10.12.2", pre = "https://www.gstatic.com/firebasejs/" + V + "/firebase-";
    var sdk = w.firebase ? Promise.resolve() : loadScript(pre + "app-compat.js").then(function () { return loadScript(pre + "firestore-compat.js"); }).then(function () { return FB.anonAuth === false ? 0 : loadScript(pre + "auth-compat.js"); });
    return sdk.then(function () {
      if (!w.firebase.apps || !w.firebase.apps.length) w.firebase.initializeApp(FB);
      return (FB.anonAuth === false || !w.firebase.auth) ? 0 : w.firebase.auth().signInAnonymously();
    }).then(function () {
      db = w.firebase.firestore(); base = db.collection("elite").doc(id);
      return Promise.all(COLS.map(function (col) {
        return new Promise(function (res, rej) {
          var first = true;
          base.collection(col).onSnapshot(function (qs) {
            Object.keys(snap).forEach(function (p) { if (p.indexOf(col + "/") === 0) delete snap[p]; });
            cache[col] = {};
            qs.forEach(function (d) { var v = d.data(); cache[col][d.id] = v; snap[col + "/" + d.id] = canon(v); });
            if (first) { first = false; res(); }
            else if (!(qs.metadata && qs.metadata.hasPendingWrites) && col !== "pings") scheduleRerender();
          }, function (e) { if (first) { first = false; rej(e); } else cloudFail(e); });
        });
      }));
    }).then(function () { KC.S = build(); KC.isReady = true; });
  }
  KC.ready = CLOUD ? startCloud() : Promise.resolve();
  KC.cloud = !CLOUD ? null : {
    putPhoto: function (pid, data) { return KC.ready.then(function () { return base.collection("photos").doc(enc(pid)).set({ data: data }); }); },
    delPhoto: function (pid) { return base.collection("photos").doc(enc(pid)).delete(); },
    getPhoto: function (pid) { return base.collection("photos").doc(enc(pid)).get().then(function (d) { return d.exists ? d.data().data : null; }); }
  };

  /* ================= 共用 API ================= */
  KC.save = function () {
    if (CLOUD) { cloudSave(); return; }
    try { localStorage.setItem(KEY, JSON.stringify(KC.S)); } catch (e) { alert("儲存失敗，瀏覽器儲存空間可能已滿"); }
  };
  KC.reload = function () { KC.S = CLOUD ? build() : loadLocal(); return KC.S; };
  KC.norm = norm;
  KC.reset = function () { KC.S = fresh(); KC.save(); };
  KC.localData = function () { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };
  KC.esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  KC.uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  KC.today = function () { var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  KC.student = function (sid) { return KC.S.students.filter(function (s) { return s.id === sid; })[0]; };
  KC.team = function (tid) { return KC.S.teams.filter(function (t) { return t.id === tid; })[0]; };
  /* 幹部：每位學生最多擔任一個職務；同一小隊的同一職務只有一人 */
  KC.ROLES = [["leader", "小隊長"], ["vice", "副隊長"], ["admin", "行政長"], ["info", "資訊長"], ["eco", "環保長"]]
    .concat(id === "g10" ? [["manual", "手冊編輯"]] : []).concat(id === "g8a" ? [["medic", "醫護長"]] : []);
  KC.roleMap = function (t) { var r = Object.assign({}, t && t.roles); if (t && t.leader && !r.leader) r.leader = t.leader; return r; };
  KC.roleKey = function (s) { var t = KC.team(s.team), r = KC.roleMap(t), k = ""; KC.ROLES.forEach(function (x) { if (r[x[0]] === s.id) k = x[0]; }); return k; };
  KC.roleLabel = function (s) { var k = KC.roleKey(s), l = ""; KC.ROLES.forEach(function (x) { if (x[0] === k) l = x[1]; }); return l; };
  KC.setRole = function (sid, key) {
    var s = KC.student(sid), t = s && KC.team(s.team); if (!t) return;
    var r = t.roles = KC.roleMap(t);
    Object.keys(r).forEach(function (k) { if (r[k] === sid) delete r[k]; });
    if (key) r[key] = sid;
    t.leader = r.leader || "";
  };
  KC.signed = function () { return KC.S.students.filter(function (s) { return s.signup; }); };
  KC.sessNo = function (x) { var m = x && (/^pt(\d+)$/.exec(x.id) || /第\s*(\d+)\s*次/.exec(x.title || "")); return m ? +m[1] : 0; };
  /* 補訓派發：行政端把「選擇參加其他公辦場次」的學生派到該場次的某一隊 */
  KC.makeups = function (sess) {
    var n = KC.sessNo(sess); if (!n) return [];
    return KC.S.leaves.filter(function (l) { return l.kind === "pt" && l.mode === "other" && l.status === "approved" && l.mk === n && l.assign; });
  };
  /* 某場次某小隊的實際名單：補訓派發出去的學生移出原隊、移入新隊 */
  KC.sessMembers = function (tid, sessId) {
    var x = typeof sessId === "string" ? KC.S.sessions.filter(function (y) { return y.id === sessId; })[0] : sessId, mk = x ? KC.makeups(x) : [], away = {};
    mk.forEach(function (l) { away[l.sid] = l.assign; });
    var base = KC.signed().filter(function (s) { return s.team === tid && (!away[s.id] || away[s.id] === tid); });
    mk.forEach(function (l) { if (l.assign === tid && !base.some(function (s) { return s.id === l.sid; })) { var st = KC.student(l.sid); if (st) base.push(st); } });
    return base;
  };
  KC.mkTag = function (sessId, stuId) {
    var x = KC.S.sessions.filter(function (y) { return y.id === sessId; })[0], l = x && KC.makeups(x).filter(function (m) { return m.sid === stuId; })[0];
    return l ? ' <span class="badge wn">補訓（原第 ' + l.n + " 次請假）</span>" : "";
  };
  KC.tempLeave = function (sid, stuId) { var m = KC.S.att["tl:" + sid]; return m && m[stuId] ? m[stuId] : null; };
  KC.approvedLeave = function (sid, date) {
    return KC.S.leaves.some(function (l) { return l.sid === sid && l.status === "approved" && l.date === date; });
  };
  /* 某學生在某場次的狀態：老師點名結果 > 已核准請假 > 未點名 */
  KC.statusFor = function (sess, st) {
    var a = (KC.S.att[sess.id] || {})[st.id];
    if (a) return a;
    if (KC.tempLeave(sess.id, st.id)) return "請假";
    if (KC.S.leaves.some(function (l) { return l.sid === st.id && l.status === "approved" && l.kind === "pt" && l.n === KC.sessNo(sess); })) return "請假";
    return KC.approvedLeave(st.id, sess.date) ? "請假" : "";
  };
  KC.csv = function (name, rows) {
    var t = rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"'; }).join(","); }).join("\r\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + t], { type: "text/csv" }));
    a.download = cfg.name.split(" ")[0] + "_" + name + ".csv"; a.click();
  };
  /* ---------- 紅色數字通知（新公告／檔案／照片／留言回覆／請假進度／幹部上傳） ---------- */
  var BR = function () { return KC.bdgRole || ""; };
  function ms(x) { if (!x) return 0; var t = typeof x === "number" ? x : Date.parse(String(x).replace(/\//g, "-").replace(" ", "T")); return isNaN(t) ? Date.parse(String(x)) || 0 : t; }
  function myTeamId() { try { return window.KCW && KCW.scopeTeam ? KCW.scopeTeam("teacher") : ""; } catch (e) { return ""; } }
  function uid() { var r = BR(); return r === "student" ? (KC.bdgMe && KC.bdgMe()) || "s" : r === "teacher" ? (myTeamId() || "t") : "a"; }
  function sk() { return "kcseen:" + id + ":" + BR() + ":" + uid(); }
  function seenAll() { try { return JSON.parse(localStorage.getItem(sk()) || "{}"); } catch (e) { return {}; } }
  function seen(k) { var m = seenAll(); if (m[k] == null) { m[k] = Date.now(); try { localStorage.setItem(sk(), JSON.stringify(m)); } catch (e) {} } return m[k]; }
  function mark(k) { var m = seenAll(); m[k] = Date.now(); try { localStorage.setItem(sk(), JSON.stringify(m)); } catch (e) {} }
  function sigs(k, cur) { var m = seenAll(), p = m["sig:" + k]; return p ? p : null; }
  function teamOfMe() { var r = BR(); if (r === "teacher") return myTeamId(); if (r === "student") { var s = KC.student(KC.bdgMe && KC.bdgMe()); return s ? s.team : ""; } return ""; }
  function cnt(arr, key, since, filt) { return (arr || []).filter(function (x) { return ms(x[key || "at"]) > since && (!filt || filt(x)); }).length; }
  var SEC = {
    h_note: function () { var t = teamOfMe(); return cnt(KC.S.notices, "at", seen("sec:h_note"), function (n) { return !n.team || !t || n.team === t || BR() === "admin"; }); },
    h_files: function () { return cnt(KC.S.files, "at", seen("sec:h_files")); },
    h_gal: function () {
      var since = seen("sec:h_gal"), n = cnt(KC.S.gallery, "at", since);
      if (id === "g10") { n = 0; Object.keys(KC.S.att || {}).forEach(function (k) { if (k.indexOf("info:") !== 0) return; var o = KC.S.att[k]; Object.keys(o).forEach(function (t) { n += cnt((o[t] || {}).list, "at", since); }); }); }
      return n;
    }
  };
  function uploads(since, onlyTeam) {
    var A = KC.S.att || {}, n = 0, tm = onlyTeam;
    Object.keys(A).forEach(function (k) {
      var o = A[k]; if (!o || typeof o !== "object") return;
      if (/^(info|eco|hb|sp):/.test(k)) Object.keys(o).forEach(function (t) {
        if (tm && t !== tm) return; var v = o[t] || {};
        if (v.list) n += cnt(v.list, "at", since); if (v.items) n += cnt(v.items, "at", since);
        if (v.before && ms(v.before.at) > since) n++; if (v.after && ms(v.after.at) > since) n++;
        Object.keys(v).forEach(function (d) { if (/^d\d+$/.test(d)) n += cnt(v[d], "at", since); });
      });
    });
    return n;
  }
  function lvSig(l) { return [l.status, l.assign || "", l.done ? 1 : 0, l.note || "", (l.docs || []).length, l.img ? 1 : 0, l.mdate || ""].join("|"); }
  var COUNT = {
    msg: function () {
      var r = BR(); if (r === "admin") return KC.S.msgs.filter(function (m) { return !m.reply; }).length;
      var mine = r === "student" ? (KC.bdgMe && KC.bdgMe()) : "teacher:" + myTeamId(), since = seen("msg");
      return KC.S.msgs.filter(function (m) { return m.reply && ms(m.replyAt) > since && m.from && m.from.id === mine; }).length;
    },
    leave: function () {
      var r = BR(); if (r === "admin") return KC.S.leaves.filter(function (l) { return l.status === "pending" && (id !== "g10" || l.img); }).length;
      if (r === "student") { var me = KC.bdgMe && KC.bdgMe(), m = seenAll(); var ch = false, n = KC.S.leaves.filter(function (l) { if (l.sid !== me) return false; if (m["lv:" + l.id] == null) { m["lv:" + l.id] = lvSig(l); ch = true; return false; } return m["lv:" + l.id] !== lvSig(l); }).length; if (ch) { try { localStorage.setItem(sk(), JSON.stringify(m)); } catch (e) {} } return n; }
      return 0;
    },
    dreport: function () { var since = seen("dreport"); return uploads(since, BR() === "teacher" ? myTeamId() : ""); },
    home: function () { if (BR() === "admin") return 0; return Object.keys(SEC).reduce(function (a, k) { return a + SEC[k](); }, 0); }
  };
  COUNT.hub = COUNT.home;
  KC.secBadge = function (sid) { var f = SEC[sid]; var n = f ? f() : 0; return n ? '<i class="bdg">' + (n > 99 ? "99+" : n) + "</i>" : ""; };
  KC.secSeen = function (sid) { mark("sec:" + sid); };
  KC.tabs = function (list, cur) {
    return '<nav class="tabs">' + list.map(function (t) {
      var n = 0; try { if (t[0] === cur) { if (t[0] !== "home" && t[0] !== "hub") mark(t[0]); if (t[0] === "leave" && BR() === "student") { var me = KC.bdgMe && KC.bdgMe(); KC.S.leaves.forEach(function (l) { if (l.sid === me) { var m = seenAll(); m["lv:" + l.id] = lvSig(l); try { localStorage.setItem(sk(), JSON.stringify(m)); } catch (e) {} } }); } } else if (COUNT[t[0]]) n = COUNT[t[0]](); } catch (e) {}
      return '<button data-do="tab" data-t="' + t[0] + '"' + (t[0] === cur ? ' class="on"' : "") + ">" + t[1] + (n ? '<i class="bdg">' + (n > 99 ? "99+" : n) + "</i>" : "") + "</button>";
    }).join("") + "</nav>";
  };
  (function () { var st = document.createElement("style"); st.textContent = ".bdg{display:inline-flex;align-items:center;gap:3px;background:#d93025;color:#fff;font-style:normal;font-size:12px;font-weight:700;line-height:1;padding:3px 8px 3px 6px;border-radius:99px;margin-left:6px;vertical-align:middle;box-shadow:0 0 0 2px rgba(217,48,37,.25)}.bdg::before{content:\"\\26A0\\FE0E\";font-size:12px}"; document.head.appendChild(st); })();
  document.addEventListener("click", function (e) { var a = e.target.closest && e.target.closest("a[href^='#h_']"); if (a) { var sid = a.getAttribute("href").slice(1); mark("sec:" + sid); var b = a.querySelector(".bdg"); if (b) b.remove(); } });
  KC.head = function (role) {
    return '<header class="top"><div><b>' + KC.esc(cfg.name) + '</b><span>' + role + (window.KCTEST ? "・🧪 關卡測試" : "") + '</span><span>' + (CLOUD ? "☁️ 雲端同步" : "💾 單機模式") + '</span></div><div class="hr">' + (role === "學生端" ? "" : '<a href="../index.html">總入口</a>') + (role === "學生端" ? '<button data-do="logout">切換身分</button>' : "") + ((role === "學生端" || role === "教師端") && !KC.demo ? '<button data-kcpw="' + (role === "學生端" ? "student" : "teacher") + '">🔑 改密碼</button>' + (role === "教師端" ? '<button data-do="logout">登出</button>' : "") : "") + '</div></header>';
  };

  /* ---------- 密碼（學生端／教師端）：預設＝班級＋小隊編號；首次登入後可自行修改。註：密碼僅在前端比對，屬基本防誤入，非嚴格安全機制 ---------- */
  KC.defPws = function (cls, tid) {
    var out = [], t = tid && KC.team(tid), n = (String(tid || "").match(/\d+/) || [""])[0], nm = t ? (String(t.name).match(/\d+/) || [""])[0] : "";
    if (!tid) return [cls];
    if (t && t.code) out.push(t.code, String(t.code).replace("-", ""));   /* G9：預設密碼也可用小隊編碼，例如 901-1 */
    [n, nm].forEach(function (x) { if (!x) return; var p = x.length < 2 ? "0" + x : x; [x, p].forEach(function (y) { out.push(cls + y, cls + "-" + y); }); });
    return out;
  };
  KC.hash = function (s) {
    if (!(w.crypto && w.crypto.subtle && w.TextEncoder)) return Promise.resolve("p:" + s);
    return w.crypto.subtle.digest("SHA-256", new TextEncoder().encode("kc|" + id + "|" + s)).then(function (b) { return "h:" + Array.prototype.map.call(new Uint8Array(b), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); });
  };
  KC.pwKey = function (role, a) { return role === "student" ? "s:" + a : "t:" + a; };
  KC.pwCheck = function (key, input, defs) {
    input = String(input || "").trim(); var st = (KC.reload().settings || {}).pw || {};
    if (!st[key]) return Promise.resolve(defs.indexOf(input) >= 0);
    return KC.hash(input).then(function (h) { return h === st[key]; });
  };
  KC.pwSet = function (key, val) {
    return KC.hash(val).then(function (h) { var S = KC.reload(); S.settings = S.settings || {}; S.settings.pw = S.settings.pw || {}; if (val === null) delete S.settings.pw[key]; else S.settings.pw[key] = h; KC.save(); });
  };
  KC.pwChange = function (role) {
    var cur = sessionStorage.getItem("kcauth:" + id + ":" + role); if (!cur) return alert("請先登入");
    var key = KC.pwKey(role, cur), defs = [];
    if (role === "student") { var s = KC.student(cur); defs = s ? KC.defPws(s.cls, s.team) : []; } else { var p = cur.split("|"); defs = KC.defPws(p[0], p[1]); }
    var o = prompt("請輸入目前的密碼（尚未改過者為預設：班級＋小隊編號）"); if (o === null) return;
    KC.pwCheck(key, o, defs).then(function (ok) {
      if (!ok) return alert("目前密碼不正確");
      var n1 = prompt("請輸入新密碼（至少 4 碼）"); if (n1 === null) return;
      if (String(n1).trim().length < 4) return alert("新密碼至少 4 碼");
      var n2 = prompt("請再輸入一次新密碼"); if (n2 === null) return;
      if (n1 !== n2) return alert("兩次輸入不一致，未變更");
      KC.pwSet(key, String(n1).trim()).then(function () { alert("✅ 密碼已更新，下次登入請使用新密碼"); });
    });
  };
  document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-kcpw]"); if (b) KC.pwChange(b.getAttribute("data-kcpw")); });

  /* 進入：行政端不需密碼；教師端選班級＋小隊並輸入密碼；學生端選名字並輸入密碼，直接進入；學生端從名單選擇自己（不需密碼） */
  KC.auth = function (role, label, onOk) {
    var app = document.getElementById("app");
    if (!KC.isReady) {
      app.innerHTML = '<div class="login"><h1>' + KC.esc(cfg.name) + '</h1><p class="mut" id="msg">☁️ 連線雲端資料中…</p></div>';
      KC.ready.then(function () { KC.auth(role, label, onOk); }, function (e) {
        var m = String((e && e.code) || (e && e.message) || e);
        document.getElementById("msg").textContent = "連線失敗：" + m + (/admin-restricted|operation-not-allowed/.test(m) ? "（請到 Firebase 主控台 Authentication 啟用「匿名」登入）" : /permission/i.test(m) ? "（請確認 Firestore 規則）" : "");
      });
      return;
    }
    if (role === "teacher" && !KC.demo && id === "g9") {   /* G9：班級導師只選班級，密碼預設＝班級（例如 901、9A） */
      var gk = "kcauth:g9:teacher", gp = "kcpick:g9:teacher", gcur = sessionStorage.getItem(gk);
      if (!gcur) { try { gcur = localStorage.getItem(gp); } catch (e) {} if (gcur) sessionStorage.setItem(gk, gcur); }
      if (gcur) { try { localStorage.setItem("kcg9cls", gcur.split("|")[0]); } catch (e) {} return onOk(""); }
      var GC = ["901", "902", "903", "904", "9A", "9B", "9C", "9D", "9E", "9F"];
      app.innerHTML = '<div class="login"><h1>' + KC.esc(cfg.name) + "</h1><h2>" + label + '</h2><select id="tc" style="width:100%;margin-bottom:10px"><option value="">選擇您的導師班級</option>' + GC.map(function (c) { return "<option>" + c + "</option>"; }).join("") + '</select><input id="tpw" type="password" placeholder="密碼（預設：班級，例如 901）" autocomplete="off"><button class="pri" id="tgo">進入</button><p class="mut" id="msg"></p></div>';
      document.getElementById("tgo").onclick = function () {
        var c = document.getElementById("tc").value, m = document.getElementById("msg");
        if (!c) { m.textContent = "請選擇班級"; return; }
        KC.pwCheck(KC.pwKey("teacher", c + "|"), document.getElementById("tpw").value, [c, c.toLowerCase()]).then(function (ok) {
          if (!ok) { m.textContent = "密碼不正確"; return; }
          sessionStorage.setItem(gk, c + "|"); try { localStorage.setItem(gp, c + "|"); localStorage.setItem("kcg9cls", c); } catch (e) {} onOk("");
        });
      };
      return;
    }
    if (role === "teacher" && !KC.demo) {
      var tk = "kcauth:" + id + ":teacher", tp = "kcpick:" + id + ":teacher", tcur = sessionStorage.getItem(tk);
      if (!tcur) { try { tcur = localStorage.getItem(tp); } catch (e) {} if (tcur) sessionStorage.setItem(tk, tcur); }
      if (tcur) return onOk("");
      var S0 = KC.reload(), cl = {}; S0.students.forEach(function (s) { cl[s.cls] = 1; });
      app.innerHTML = '<div class="login"><h1>' + KC.esc(cfg.name) + "</h1><h2>" + label + '</h2><select id="tc" style="width:100%;margin-bottom:10px"><option value="">選擇班級</option>' + Object.keys(cl).sort().map(function (c) { return '<option>' + KC.esc(c) + "</option>"; }).join("") + '</select><select id="tt" style="width:100%;margin-bottom:10px"><option value="">選擇' + KC.esc(cfg.unit) + "</option>" + S0.teams.map(function (t) { return '<option value="' + KC.esc(t.id) + '">' + KC.esc(t.name) + "</option>"; }).join("") + '</select><input id="tpw" type="password" placeholder="密碼（預設：班級＋小隊編號）" autocomplete="off"><button class="pri" id="tgo">進入</button><p class="mut" id="msg"></p></div>';
      document.getElementById("tgo").onclick = function () {
        var c = document.getElementById("tc").value, t = document.getElementById("tt").value, m = document.getElementById("msg");
        if (!c || !t) { m.textContent = "請選擇班級與小隊"; return; }
        KC.pwCheck(KC.pwKey("teacher", c + "|" + t), document.getElementById("tpw").value, KC.defPws(c, t)).then(function (ok) {
          if (!ok) { m.textContent = "密碼不正確"; return; }
          sessionStorage.setItem(tk, c + "|" + t); try { localStorage.setItem(tp, c + "|" + t); } catch (e) {} onOk("");
        });
      };
      return;
    }
    if (role !== "student") return onOk("");
    if (id === "g9") {   /* G9：學生端僅限 30 隊小隊長登入（依專題分組名單）；選小隊＋密碼（預設＝小隊編碼，例如 901-1） */
      var GK = "kcauth:g9:student", GP = "kcpick:g9", GO = ["901", "902", "903", "904", "9A", "9B", "9C", "9D", "9E", "9F"];
      var isCap = function (sid) { var st = KC.student(sid), tm = st && KC.team(st.team); return !!(tm && (tm.leader === sid || (tm.roles && tm.roles.leader === sid))); };
      var gc = sessionStorage.getItem(GK);
      if (!gc) { try { gc = localStorage.getItem(GP); } catch (e) {} }
      if (gc && isCap(gc)) { sessionStorage.setItem(GK, gc); return onOk(gc); }
      sessionStorage.removeItem(GK); try { localStorage.removeItem(GP); } catch (e) {}
      var S9 = KC.reload(), TS = S9.teams.filter(function (t) { return /^(90[1-4]|9[A-F])-[1-3]$/.test(t.code || ""); })
        .sort(function (a, b) { return GO.indexOf(a.cls) - GO.indexOf(b.cls) || (a.code < b.code ? -1 : 1); });
      var capName = function (t) { var st = KC.student(t.leader || (t.roles || {}).leader); return st && !/^LD-/.test(st.id) ? st.name : ""; };
      app.innerHTML = '<div class="login"><h1>' + KC.esc(cfg.name) + "</h1><h2>" + label + '（限各隊小隊長）</h2>' +
        (TS.length ? '<select id="g9t" style="width:100%;margin-bottom:10px"><option value="">請選擇你的小隊</option>' +
          GO.map(function (c) { var l = TS.filter(function (t) { return t.cls === c; }); return l.length ? '<optgroup label="' + c + ' 班">' + l.map(function (t) { var n = capName(t); return '<option value="' + KC.esc(t.id) + '">' + KC.esc(t.code) + (n ? "　小隊長 " + KC.esc(n) : "") + "</option>"; }).join("") + "</optgroup>" : ""; }).join("") +
          '</select><input id="g9pw" type="password" placeholder="密碼（預設：小隊編碼，例如 901-1）" autocomplete="off"><button class="pri" id="g9go">小隊長登入</button><p class="mut" id="msg">學生端只開放給 30 個專題小隊的小隊長，其他組員請跟著小隊長的手機一起作答。</p>'
          : '<p class="mut" id="msg">行政端尚未完成小隊編組，請稍後再試。</p>') + "</div>";
      if (!TS.length) return;
      document.getElementById("g9go").onclick = function () {
        var tid = document.getElementById("g9t").value, mm = document.getElementById("msg");
        if (!tid) { mm.textContent = "請先選擇你的小隊"; return; }
        var t = KC.team(tid), sid = t.leader || (t.roles || {}).leader;
        if (!sid || !KC.student(sid)) sid = KC.codeLogin ? KC.codeLogin(t.code) : "";
        if (!sid) { mm.textContent = "這個小隊尚未設定小隊長，請洽行政端"; return; }
        var st = KC.student(sid);
        KC.pwCheck(KC.pwKey("student", sid), document.getElementById("g9pw").value, KC.defPws(st.cls, st.team)).then(function (ok) {
          if (!ok) { mm.textContent = "密碼不正確（預設為小隊編碼，例如 901-1）"; return; }
          sessionStorage.setItem(GK, sid); try { localStorage.setItem(GP, sid); } catch (e) {} onOk(sid);
        });
      };
      return;
    }
    var k = "kcauth:" + id + ":student", pk = "kcpick:" + id;
    var cur = sessionStorage.getItem(k);
    if (!cur) { try { cur = localStorage.getItem(pk); } catch (e) {} if (cur && KC.student(cur)) sessionStorage.setItem(k, cur); else cur = ""; }
    if (cur && KC.student(cur)) return onOk(cur);
    var S = KC.reload(), by = {};
    S.students.forEach(function (s) { (by[s.cls] = by[s.cls] || []).push(s); });
    app.innerHTML = '<div class="login"><h1>' + KC.esc(cfg.name) + '</h1><h2>' + label + '</h2>' +
      (S.students.length ? '<select id="pn" style="width:100%;margin-bottom:10px"><option value="">請選擇你的班級與姓名</option>' +
        Object.keys(by).sort().map(function (c) { return '<optgroup label="' + KC.esc(c) + '">' + by[c].map(function (s) { return '<option value="' + KC.esc(s.id) + '">' + KC.esc(s.name) + "（" + KC.esc(/^T\d\d-/.test(s.id) && KC.team(s.team) ? KC.team(s.team).name : s.id) + "）</option>"; }).join("") + "</optgroup>"; }).join("") + '</select><button class="pri" id="go">進入</button><p class="mut" id="msg">請選擇自己的名字，不需要密碼</p>'
        : '<p class="mut" id="msg">尚未匯入學員名單，請洽老師</p>') + "</div>";
    if (KC.codeLogin) app.querySelector(".login").insertAdjacentHTML("beforeend", '<hr style="margin:14px 0"><p style="margin:0 0 6px"><b>小隊長登入</b>（使用小隊編碼，如 901-1、9A-2）</p><input id="lc" placeholder="小隊編碼" style="width:100%;margin-bottom:8px;text-transform:uppercase"><button class="pri" id="lgo">小隊長進入</button>');
    if (document.getElementById("lgo")) document.getElementById("lgo").onclick = function () {
      var v = KC.codeLogin(document.getElementById("lc").value); if (!v) { document.getElementById("msg").textContent = "找不到這個小隊編碼，請確認（例如 901-1、9A-2）"; return; }
      sessionStorage.setItem(k, v); try { localStorage.setItem(pk, v); } catch (e) {} onOk(v);
    };
    if (!S.students.length) return;
    if (!KC.demo) document.getElementById("go").insertAdjacentHTML("beforebegin", '<input id="spw" type="password" placeholder="密碼（預設：班級＋小隊編號）" autocomplete="off">');
    document.getElementById("go").onclick = function () {
      var v = document.getElementById("pn").value, mm = document.getElementById("msg") || (function () { var p = document.createElement("p"); p.id = "msg"; p.className = "mut"; document.querySelector(".login").appendChild(p); return p; })();
      if (!v) { mm.textContent = "請先選擇你的名字"; return; }
      var done = function () { sessionStorage.setItem(k, v); try { localStorage.setItem(pk, v); } catch (e) {} onOk(v); };
      if (KC.demo) return done();
      var st = KC.student(v);
      KC.pwCheck(KC.pwKey("student", v), document.getElementById("spw").value, KC.defPws(st.cls, st.team)).then(function (ok) { if (ok) done(); else mm.textContent = "密碼不正確（預設為班級＋小隊編號，例如 100303）"; });
    };
  };
  KC.logout = function (role) { sessionStorage.removeItem("kcauth:" + id + ":" + role); try { localStorage.removeItem(role === "teacher" ? "kcpick:" + id + ":teacher" : "kcpick:" + id); } catch (e) {} location.reload(); };
  w.KC = KC;
})(window);
