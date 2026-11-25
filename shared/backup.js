/* 雲端備份（行政端）：把後台資料與上傳的照片／檔案同步備份到使用者自己的 Google Drive（經 Google Apps Script 收件口） */
(function (w) {
  var E = KC.esc, KCB = {}, busy = false, GS = "/* 菁英活動系統：雲端備份收件口（Google Apps Script）\n * 請用要存放備份的 Google 帳號貼到 script.google.com 的新專案，改下面的密碼後「部署 → 新增部署作業 → 網頁應用程式」\n * 執行身分：我　存取權：任何人　→ 取得「網頁應用程式網址」貼到系統後台的「☁️ 雲端備份」。 */\nvar TOKEN = \"請改成自己的密碼\";          // 與後台填的「備份密碼」必須相同\nvar ROOT_NAME = \"菁英活動系統備份\";        // Drive 裡的根資料夾名稱\n\nfunction sub_(parent, name) {\n  var it = parent.getFoldersByName(name);\n  return it.hasNext() ? it.next() : parent.createFolder(name);\n}\nfunction root_() { return sub_(DriveApp.getRootFolder(), ROOT_NAME); }\nfunction putText_(folder, name, text) {\n  var it = folder.getFilesByName(name);\n  if (it.hasNext()) { it.next().setContent(text); } else { folder.createFile(name, text, \"application/json\"); }\n}\nfunction out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }\n\nfunction doPost(e) {\n  try {\n    var b = JSON.parse(e.postData.contents);\n    if (b.token !== TOKEN) return out_({ ok: false, error: \"密碼不正確\" });\n    var act = String(b.act || \"misc\").replace(/[^\\w-]/g, \"\");\n    var base = sub_(root_(), act);\n    if (b.action === \"ping\") return out_({ ok: true, folder: base.getUrl() });\n    if (b.action === \"snapshot\") {\n      var day = Utilities.formatDate(new Date(), \"Asia/Taipei\", \"yyyy-MM-dd\");\n      putText_(base, \"snapshot-latest.json\", b.data);\n      putText_(sub_(base, \"每日版本\"), \"snapshot-\" + day + \".json\", b.data);\n      PropertiesService.getScriptProperties().setProperty(\"last_\" + act, new Date().toISOString());\n      return out_({ ok: true, folder: base.getUrl() });\n    }\n    if (b.action === \"file\") {\n      var files = sub_(base, \"files\"), name = String(b.name).replace(/[\\\\\\/:*?\"<>|]/g, \"_\");\n      if (!files.getFilesByName(name).hasNext()) {\n        files.createFile(Utilities.newBlob(Utilities.base64Decode(b.b64), b.mime || \"application/octet-stream\", name));\n      }\n      return out_({ ok: true });\n    }\n    return out_({ ok: false, error: \"未知的動作\" });\n  } catch (err) { return out_({ ok: false, error: String(err) }); }\n}\nfunction doGet() { return out_({ ok: true, msg: \"備份收件口運作中\" }); }\n";
  function $(i) { return document.getElementById(i); }
  function ld(k, d) { try { return JSON.parse(localStorage.getItem("kcbak:" + KC.id + ":" + k) || "null") || d; } catch (e) { return d; } }
  function sv(k, v) { try { localStorage.setItem("kcbak:" + KC.id + ":" + k, JSON.stringify(v)); } catch (e) {} }
  function cfg() { return Object.assign({ url: "", token: "", auto: true, mins: 5 }, ld("cfg", {})); }
  function stt() { return Object.assign({ at: 0, msg: "尚未備份", hash: "", sent: {} }, ld("st", {})); }
  function hash(s) { var h = 5381, i = s.length; while (i) h = (h * 33) ^ s.charCodeAt(--i); return (h >>> 0).toString(36) + ":" + s.length; }
  function pids(o, set, d) { d = d || 0; if (!o || typeof o !== "object" || d > 12) return set; Object.keys(o).forEach(function (k) { var v = o[k]; if (k === "pid" && typeof v === "string" && v) set[v] = 1; else if (v && typeof v === "object") pids(v, set, d + 1); }); return set; }
  function post(c, obj) {
    obj.token = c.token; obj.act = KC.id;
    return fetch(c.url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(obj) }).then(function (r) { return r.json(); }, function () {
      return fetch(c.url, { method: "POST", mode: "no-cors", body: JSON.stringify(obj) }).then(function () { return { ok: true, unverified: true }; });
    });
  }
  function ext(m) { return /pdf/.test(m) ? ".pdf" : /png/.test(m) ? ".png" : /gif/.test(m) ? ".gif" : /jpe?g/.test(m) ? ".jpg" : /text/.test(m) ? ".txt" : ""; }
  function pending() { try { var st = stt(); return Object.keys(pids(KC.S, {})).filter(function (p) { return !st.sent[p]; }); } catch (e) { return []; } }
  function setMsg(m) { var st = stt(); st.msg = m; st.at = Date.now(); sv("st", st); var e = $("bk_st"); if (e) e.textContent = m; }
  KCB.run = function (manual) {
    var c = cfg(); if (!c.url || !c.token) { if (manual) alert("請先填寫網址與密碼並儲存"); return Promise.resolve(); }
    if (busy) return Promise.resolve(); busy = true; try { KC.reload(); } catch (e) {}
    var json; try { json = JSON.stringify(KC.S); } catch (e) { busy = false; setMsg("⚠️ 資料無法序列化：" + e.message); return Promise.resolve(); } var h = hash(json), st = stt(), snap = manual || h !== st.hash, sent = 0, fail = "";
    var chain = Promise.resolve();
    if (snap) chain = post(c, { action: "snapshot", data: json }).then(function (r) { if (!r.ok) throw new Error(r.error || "寫入失敗"); st = stt(); st.hash = h; sv("st", st); });
    chain = chain.then(function () {
      var todo = pending().slice(0, manual ? 60 : 12);
      return todo.reduce(function (p, pid) { return p.then(function () { return KCH.get(pid).then(function (u) {
        if (!u || u.indexOf("data:") !== 0) { var s0 = stt(); s0.sent[pid] = 1; sv("st", s0); return; }
        var m = /^data:([^;]+);base64,(.*)$/.exec(u); if (!m) { var s2 = stt(); s2.sent[pid] = 1; sv("st", s2); return; }
        return post(c, { action: "file", pid: pid, name: pid + ext(m[1]), mime: m[1], b64: m[2] }).then(function (r) { if (!r.ok) throw new Error(r.error || "檔案寫入失敗"); var s1 = stt(); s1.sent[pid] = 1; sv("st", s1); sent++; });
      }); }); }, Promise.resolve());
    });
    return chain.then(function () { var left = pending().length; setMsg("✅ " + new Date().toLocaleString("zh-TW", { hour12: false }) + " 備份完成" + (snap ? "（資料）" : "（資料無變動）") + (sent ? "、新增 " + sent + " 個檔案" : "") + (left ? "；還有 " + left + " 個檔案待上傳" : "")); },
      function (e) { setMsg("⚠️ 備份失敗：" + (e && e.message || e)); }).then(function () { busy = false; var t = $("bk_pend"); if (t) t.textContent = pending().length; });
  };
  function view() {
    var c = cfg(), st = stt();
    return '<div class="card"><h3>☁️ 雲端備份（存到您的 Google Drive）</h3><p class="mut" style="margin:0">系統照常用 Firebase 即時運作；後台資料（名單、點名、請假、成績、留言…）與學生上傳的照片、檔案，會自動同步備份到您的 Google 帳號 Drive 的「菁英活動系統備份」資料夾。</p></div>' +
      '<div class="card"><h4 style="margin-top:0">設定（只需一次）</h4><ol style="padding-left:20px;margin:0 0 8px"><li>用要存放備份的 Google 帳號開啟 <b>script.google.com</b> → 新專案，貼上下方程式碼，並把 <code>TOKEN</code> 改成自己的密碼。</li><li>右上「部署 → 新增部署作業 → 網頁應用程式」，執行身分選「我」、存取權選「任何人」，部署並授權。</li><li>複製「網頁應用程式網址」貼到下面，並填入相同的密碼。</li></ol>' +
      '<label>網頁應用程式網址</label><input id="bk_url" value="' + E(c.url) + '" placeholder="https://script.google.com/macros/s/…/exec" style="width:100%"><label>備份密碼（同上方 TOKEN）</label><input id="bk_tk" type="password" value="' + E(c.token) + '" style="width:100%">' +
      '<div class="row" style="margin-top:8px"><label style="margin:0"><input type="checkbox" id="bk_auto"' + (c.auto ? " checked" : "") + '> 自動備份，每 <input type="number" id="bk_m" min="1" max="120" value="' + c.mins + '" style="width:64px"> 分鐘（行政端頁面開著時）</label></div>' +
      '<div class="row"><button class="pri" data-do="bkSave">儲存設定</button><button class="sec" data-do="bkTest">測試連線</button><button class="pri" data-do="bkRun">立即備份</button><button class="sec" data-do="bkDl">下載資料 JSON</button></div></div>' +
      '<div class="card"><h4 style="margin-top:0">備份狀態</h4><p id="bk_st">' + E(st.msg) + '</p><p class="mut">待上傳檔案：<b id="bk_pend">' + pending().length + '</b> 個（照片／手冊檔／請假文件會逐批上傳，第一次較久）。<br>備份會留 <b>snapshot-latest.json</b> 與「每日版本」資料夾的每日快照；檔案放在 <b>files</b> 資料夾。<br>提醒：自動備份由<b>開著的行政端頁面</b>執行；活動期間請讓至少一台電腦開著行政端。</p></div>' +
      '<div class="card"><h4 style="margin-top:0">Apps Script 程式碼</h4><textarea readonly style="width:100%;height:200px;font-family:monospace;font-size:12px" onclick="this.select()">' + E(GS) + "</textarea></div>";
  }
  KCB.mount = function (role, ctx) {
    if (role !== "admin") return;
    ctx.TABS.push(["backup", "☁️ 雲端備份"]); ctx.V.backup = function () { try { return view(); } catch (e) { return '<div class="card"><h3>☁️ 雲端備份</h3><p>頁面載入發生錯誤：' + E(String(e && e.message || e)) + "</p><p class=\"mut\">請把這行錯誤文字回報給開發者。</p></div>"; } };
    var H = ctx.H;
    H.bkSave = function () { sv("cfg", { url: $("bk_url").value.trim(), token: $("bk_tk").value, auto: $("bk_auto").checked, mins: Math.max(1, +$("bk_m").value || 5) }); setMsg("設定已儲存"); alert("已儲存"); };
    H.bkTest = function () { H.bkSave && sv("cfg", { url: $("bk_url").value.trim(), token: $("bk_tk").value, auto: $("bk_auto").checked, mins: Math.max(1, +$("bk_m").value || 5) }); var c = cfg(); if (!c.url) return alert("請先填網址"); post(c, { action: "ping" }).then(function (r) { alert(r.ok ? (r.unverified ? "已送出，但瀏覽器無法確認回應；請按「立即備份」後到 Drive 檢查。" : "連線成功！備份資料夾：" + r.folder) : "失敗：" + r.error); }, function (e) { alert("連線失敗：" + e); }); };
    H.bkRun = function () { setMsg("備份中…"); KCB.run(true); };
    H.bkDl = function () { KC.reload(); var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(KC.S)], { type: "application/json" })); a.download = KC.id + "-backup-" + new Date().toISOString().slice(0, 10) + ".json"; a.click(); };
    setInterval(function () { var c = cfg(), st = stt(); if (c.auto && c.url && c.token && KC.isReady && !busy && Date.now() - (st.runAt || 0) >= c.mins * 60000) { var s2 = stt(); s2.runAt = Date.now(); sv("st", s2); KCB.run(false); } }, 30000);
  };
  w.KCB = KCB;
})(window);
