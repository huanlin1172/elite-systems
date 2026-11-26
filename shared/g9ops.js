/* G9 教育旅行：限時任務派送、闖關即時戰況公告、班級導師總覽、小隊聯繫
   ‧ 行政端：派送限時任務／派送戰況公告／與 30 小隊聯繫
   ‧ 教師端（10 班導師）：接收；查閱自己班 3 個小隊的資料與闖關狀態；與小隊聯繫
   ‧ 學生端：接收限時任務（在「闖關」作答、上傳照片）、戰況公告；與老師聯繫
   資料：限時任務＝闖關任務（tasks，cat:"B"，disp:1，startAt／endAt／target）；戰況公告＝公告（notices，kind:"battle"）；
         聯繫訊息＝公告集合中的 kind:"chat"（core.js 會分到 KC.S.chat，不會出現在一般公告）。 */
var KCG9 = (function () {
  if (window.ACT !== "g9") return null;
  var E = KC.esc, CLS = ["901", "902", "903", "904", "9A", "9B", "9C", "9D", "9E", "9F"];
  var ui = { chatTeam: "", rkCls: "", dImg: null, open: {} }, ROLE = "", CTX = null;
  function $(i) { return document.getElementById(i); }
  function badge(t, c) { return '<span class="b ' + c + '">' + t + "</span>"; }
  function stamp() { return new Date().toLocaleString("zh-TW", { hour12: false }); }
  function hm(ms) { return new Date(ms).toLocaleTimeString("zh-TW", { hour12: false, hour: "2-digit", minute: "2-digit" }); }
  function code(t) { return String((t && (t.code || t.name)) || ""); }
  function clsOf(t) { return t.cls || code(t).split("-")[0]; }
  function teams(cls) { return KC.S.teams.filter(function (t) { return /-\d$/.test(code(t)) && (!cls || clsOf(t) === cls); }).sort(function (a, b) { return CLS.indexOf(clsOf(a)) - CLS.indexOf(clsOf(b)) || (code(a) < code(b) ? -1 : 1); }); }
  function pblOf(t) { return window.KCPBL && KCPBL.byCode ? KCPBL.byCode(code(t)) : null; }
  function theme(t) { var g = pblOf(t); return g ? String(g.theme || "").split("\n")[0] : ""; }
  function score(t) { return window.KCQ ? KCQ.score(t.id) : { total: 0, aDone: 0, b: 0, wrongN: 0 }; }
  function myCls() { var a = sessionStorage.getItem("kcauth:g9:teacher") || ""; return a.split("|")[0]; }
  function me() { return CTX && CTX.me ? CTX.me() : null; }
  function myTeam() { var m = me(); return m && m.team ? KC.team(m.team) : null; }
  function ranking() {
    return teams().map(function (t) { var s = score(t); return { team: t.id, code: code(t), cls: clsOf(t), total: s.total, aDone: s.aDone, b: s.b || 0, wrong: s.wrongN || 0 }; })
      .sort(function (a, b) { return b.total - a.total || b.aDone - a.aDone || (a.code < b.code ? -1 : 1); })
      .map(function (r, i, arr) { r.rank = i && arr[i - 1].total === r.total && arr[i - 1].aDone === r.aDone ? arr[i - 1].rank : i + 1; return r; });
  }
  function medal(n) { return n === 1 ? "🥇" : n === 2 ? "🥈" : n === 3 ? "🥉" : n; }
  function rankTable(rows, hi, opt) {
    opt = opt || {};
    if (!rows.length) return '<p class="mut">尚無小隊</p>';
    return '<div class="scroll"><table><tr><th>名次</th><th>小隊</th>' + (opt.theme ? "<th>主題</th>" : "") + "<th>總分</th><th>通過關數</th>" + (opt.full ? "<th>限時加分</th><th>答錯</th>" : "") + "</tr>" +
      rows.map(function (r) {
        var on = hi && (hi === r.team || hi === r.cls);
        return "<tr" + (on ? ' style="background:var(--okb);font-weight:700"' : "") + "><td>" + (r.total || r.aDone ? medal(r.rank) : "—") + "</td><td>" + E(r.code) + "</td>" + (opt.theme ? '<td class="mut">' + E(theme(KC.team(r.team) || {}).slice(0, 18)) + "</td>" : "") +
          "<td><b>" + r.total + "</b></td><td>" + r.aDone + "</td>" + (opt.full ? "<td>" + r.b + "</td><td>" + r.wrong + "</td>" : "") + "</tr>";
      }).join("") + "</table></div>";
  }

  /* ================= 限時任務 ================= */
  function disp() { return window.KCQ ? KCQ.q().tasks.filter(function (t) { return t.disp; }).sort(function (a, b) { return (b.startAt || 0) - (a.startAt || 0); }) : []; }
  function live(t) { return t.active && KCQ.inWindow(t) === "open"; }
  function cd(t) { return '<b data-cd="' + t.endAt + '"></b>'; }
  function tgtTxt(t) { return t.target && t.target.length ? t.target.join("、") + " 班" : "全部 30 隊"; }
  function stOf(team, t) {
    var s = KCQ.sub(team.id, t.id), st = s ? s.status : "";
    if (st === "approved") return badge("✅ 通過 +" + (s.pts || 0), "ok");
    if (st === "pending") return badge("📤 已上傳，待審", "wn");
    if (st === "rejected") return badge("↩️ 退回", "no");
    return KCQ.inWindow(t) === "after" ? badge("⌛ 逾時未交", "no") : badge(st === "doing" ? "作答中" : "未上傳", "gr");
  }
  function counts(t, list) { var c = { up: 0, ok: 0, n: list.length }; list.forEach(function (tm) { var s = KCQ.sub(tm.id, t.id); if (s && (s.status === "pending" || s.status === "approved" || s.status === "rejected")) c.up++; if (s && s.status === "approved") c.ok++; }); return c; }
  function dispView() {
    var ds = disp(), lv = ds.filter(live), old = ds.filter(function (t) { return !live(t); });
    var form = '<div class="card"><h3>⏱ 派送限時任務</h3>' + (KCQ.q().cfg.bN ? '<p style="margin:0 0 6px"><b>計分規則：每題 ' + (KCQ.q().cfg.bPts || 50) + " 分，共 " + KCQ.q().cfg.bN + " 題。目前已派送 " + ds.length + " 題" + (ds.length >= KCQ.q().cfg.bN ? "（已達規劃題數）" : "") + "。</b></p>" : "") + '<p class="mut" style="margin-top:0">送出後，指定小隊的學生端會立即跳出通知並開始倒數；導師端同步收到。學生在「🗺️ 闖關」作答並上傳照片，由「📝 闖關審核」核可加分。</p>' +
      '<label>任務題目</label><textarea id="dp_text" placeholder="例：在 10 分鐘內找到一位穿著傳統服飾的人，全隊與他合照（請先徵得同意）"></textarea>' +
      '<label>拍照／作答說明（選填）</label><input id="dp_tip" placeholder="例：全員入鏡，畫面中要看得到店家招牌" style="width:100%">' +
      '<div class="pbl-grid"><div><label>作答方式</label><select id="dp_mode" style="width:100%"><option value="photo">📷 拍照上傳</option><option value="text">✍️ 文字作答＋拍照上傳</option><option value="media">🎬 照片或影片上傳</option></select></div>' +
      '<div><label>答題時間（分鐘）</label><input id="dp_min" type="number" min="1" max="600" value="10" style="width:100%"></div>' +
      '<div><label>核可後加分</label><input id="dp_pts" type="number" value="' + (KCQ.q().cfg.bPts || 50) + '" style="width:100%"></div></div>' +
      '<label>題目照片（選填）</label><input type="file" accept="image/*" id="dp_img">' + (ui.dImg ? '<p><img src="' + ui.dImg + '" alt="" style="max-width:220px;border-radius:10px"> <button class="sm sec" data-do="g9dImgClr">移除</button></p>' : "") +
      '<label>派送對象</label><div class="row"><label style="margin:0"><input type="checkbox" id="dp_all" checked> 全部 30 隊</label>' + CLS.map(function (c) { return '<label style="margin:0"><input type="checkbox" data-dpc="' + c + '"> ' + c + "</label>"; }).join("") + "</div>" +
      '<div class="row"><button class="pri" data-do="g9disp">🚀 立即派送</button></div></div>';
    var item = function (t, isLive) {
      var list = teams().filter(function (tm) { return KCQ.forTeam(t, tm); }), c = counts(t, list), op = ui.open[t.id];
      return '<div class="card"' + (isLive ? ' style="border-left:4px solid var(--ac)"' : "") + '><div class="row"><b>B' + t.no + "</b>" + (isLive ? badge("進行中，剩 " + cd(t), "wn") : badge("已截止 " + hm(t.endAt), "gr")) + badge(KCQ.MODES[t.mode] || t.mode, "gr") + badge(tgtTxt(t), "gr") + badge("+" + KCQ.calcPts(t), "ok") + "</div>" +
        '<p style="white-space:pre-wrap;margin:6px 0">' + E(t.text) + "</p>" + (t.photoTip ? '<p class="mut" style="margin:0">' + E(t.photoTip) + "</p>" : "") +
        '<p class="mut">派送 ' + hm(t.startAt) + "，限時 " + t.mins + " 分鐘｜已上傳 <b>" + c.up + "</b>／" + c.n + " 隊，已核可 " + c.ok + " 隊</p>" +
        '<div class="row"><button class="sm sec" data-do="g9dOpen" data-id="' + t.id + '">' + (op ? "收合各隊狀態" : "查看各隊狀態") + "</button>" +
        (isLive ? '<button class="sm sec" data-do="g9dExt" data-id="' + t.id + '">延長 5 分鐘</button><button class="sm dng" data-do="g9dEnd" data-id="' + t.id + '">立即截止</button>' : '<button class="sm sec" data-do="g9dRe" data-id="' + t.id + '">再派送一次</button>') +
        '<button class="sm dng" data-do="g9dDel" data-id="' + t.id + '">刪除</button></div>' +
        (op ? '<div class="scroll"><table><tr><th>小隊</th><th>狀態</th><th>上傳者／時間</th></tr>' + list.map(function (tm) { var s = KCQ.sub(tm.id, t.id); return "<tr><td>" + E(code(tm)) + "</td><td>" + stOf(tm, t) + '</td><td class="mut">' + E(s && s.at ? (s.by || "") + " " + s.at : "") + "</td></tr>"; }).join("") + "</table></div>" : "") + "</div>";
    };
    return form + (lv.length ? "<h3>進行中的限時任務</h3>" + lv.map(function (t) { return item(t, true); }).join("") : "") + (old.length ? "<h3>已截止</h3>" + old.map(function (t) { return item(t, false); }).join("") : "");
  }
  function readDisp() {
    var text = ($("dp_text").value || "").trim(), mins = Math.max(1, Math.min(600, +$("dp_min").value || 10)), pts = +$("dp_pts").value;
    var tg = $("dp_all").checked ? [] : [].slice.call(document.querySelectorAll("[data-dpc]")).filter(function (x) { return x.checked; }).map(function (x) { return x.dataset.dpc; });
    return { text: text, tip: ($("dp_tip").value || "").trim(), mode: $("dp_mode").value, mins: mins, pts: isNaN(pts) ? (KCQ.q().cfg.bPts || 50) : pts, target: tg, none: !$("dp_all").checked && !tg.length };
  }
  function pushTask(o, clueImg) {
    var q = KCQ.q(), now = Date.now(), no = q.tasks.filter(function (t) { return t.cat === "B"; }).reduce(function (a, t) { return Math.max(a, +t.no || 0); }, 0) + 1, end = now + o.mins * 60000;
    var t = { id: "d" + KC.uid(), cat: "B", no: no, disp: 1, active: true, text: o.text, photoTip: o.tip, mode: o.mode, pts: o.pts, mins: o.mins, startAt: now, endAt: end, bStart: KCQ.hm(), bEnd: hm(end), target: o.target, at: stamp() };
    if (clueImg) t.clueImg = clueImg;
    q.tasks.push(t); return t;
  }

  /* ================= 戰況公告 ================= */
  function battles() { return KC.S.notices.filter(function (n) { return n.kind === "battle"; }).slice().reverse(); }
  function battleCard(n, hi) {
    return '<div class="card g9dark"><div class="mut">📣 ' + E(n.at) + "</div>" + (n.msg ? '<p style="white-space:pre-wrap;font-size:16px;margin:6px 0">' + E(n.msg) + "</p>" : "") +
      (n.rank && n.rank.length ? rankTable(n.rank, hi) + (n.total && n.total > n.rank.length ? '<p class="mut" style="margin:4px 0 0">（公布前 ' + n.rank.length + " 名，共 " + n.total + " 隊）</p>" : "") : "") +
      (ROLE === "admin" ? '<div class="row"><button class="sm dng" data-do="g9bDel" data-id="' + n.id + '">刪除</button></div>' : "") + "</div>";
  }
  function battleAdmin() {
    var rk = ranking(), f = ui.rkCls;
    return '<div class="card"><h3>📣 派送戰況公告</h3><p class="mut" style="margin-top:0">送出後，教師端與學生端會立即跳出通知，並在「📣 闖關戰況」看到。</p>' +
      '<label>公告內容</label><textarea id="bt_msg" placeholder="例：第一階段戰況出爐！目前 901-2 暫居第一，各隊加油！下一個限時任務 15:30 派送。"></textarea>' +
      '<div class="row"><label style="margin:0">附上排名 <select id="bt_n"><option value="3">前 3 名</option><option value="5" selected>前 5 名</option><option value="10">前 10 名</option><option value="0">全部小隊</option><option value="-1">不附排名</option></select></label>' +
      '<button class="pri" data-do="g9bSend">📣 派送戰況公告</button></div></div>' +
      '<div class="card g9dark"><h3>🏆 即時戰況（僅行政端與導師可見）</h3><div class="row"><select data-do="g9rk"><option value="">全部 30 隊</option>' + CLS.map(function (c) { return '<option value="' + c + '"' + (f === c ? " selected" : "") + ">" + c + " 班</option>"; }).join("") + "</select></div>" +
      rankTable(rk.filter(function (r) { return !f || r.cls === f; }), "", { theme: true, full: true }) + "</div>" +
      "<h3>已派送的戰況公告</h3>" + (battles().map(function (n) { return battleCard(n); }).join("") || '<div class="card"><p class="mut">尚未派送</p></div>');
  }
  function battleRecv() {
    var hi = ROLE === "student" ? (myTeam() || {}).id : myCls(), bs = battles();
    var h = ROLE === "teacher" ? '<div class="card g9dark"><h3>🏆 即時戰況（您的班級以綠色標示）</h3>' + rankTable(ranking(), hi, { theme: true }) + "</div><h3>行政端派送的戰況公告</h3>" : "<h3>📣 闖關戰況公告</h3>";
    return h + (bs.map(function (n) { return battleCard(n, hi); }).join("") || '<div class="card"><p class="mut">行政端尚未派送戰況公告。</p></div>');
  }

  /* ================= 小隊聯繫 ================= */
  function chat(tid) { return (KC.S.chat || []).filter(function (m) { return m.team === tid; }).sort(function (a, b) { return (a.t || 0) - (b.t || 0); }); }
  function rk() { var m = me(); return "kcg9read:" + ROLE + ":" + (ROLE === "student" ? (m && m.team) || "" : ROLE === "teacher" ? myCls() : "a"); }
  function readMap() { try { return JSON.parse(localStorage.getItem(rk()) || "{}"); } catch (e) { return {}; } }
  function markRead(tid) { var m = readMap(), l = chat(tid).slice(-1)[0]; m[tid] = l ? l.t : Date.now(); try { localStorage.setItem(rk(), JSON.stringify(m)); } catch (e) {} }
  function incoming(msg) { return ROLE === "student" ? msg.from !== "student" : msg.from === "student"; }
  function unread(tid) { var since = readMap()[tid] || 0; return chat(tid).filter(function (m) { return incoming(m) && (m.t || 0) > since; }).length; }
  function who(m) { return m.from === "student" ? "🧑‍🎓 " + (m.by || "學生") : m.from === "teacher" ? "👩‍🏫 " + (m.by || "導師") : "🏫 " + (m.by || "行政"); }
  function thread(tid) {
    var mine = ROLE === "student" ? "student" : ROLE;
    var list = chat(tid);
    markRead(tid);
    return '<div class="g9thr" id="g9thr">' + (list.map(function (m) {
      var self = m.from === mine;
      return '<div class="g9m' + (self ? " me" : "") + '"><div class="mut" style="font-size:12px">' + E(who(m)) + "・" + E(m.at) + "</div>" + (m.text ? '<div style="white-space:pre-wrap">' + E(m.text) + "</div>" : "") +
        (m.img ? '<img data-photo="' + E(m.img) + '" data-g9zoom="1" alt="圖片" style="display:block;max-width:220px;max-height:260px;border-radius:10px;margin-top:4px;cursor:zoom-in">' : "") +
        (m.audio ? '<div style="margin-top:4px">🎤 語音 ' + (m.dur ? m.dur + " 秒" : "") + '<audio data-aud="' + E(m.audio) + '" controls preload="none" style="display:block;width:230px;max-width:100%;margin-top:2px"></audio></div>' : "") + "</div>";
    }).join("") || '<p class="mut">還沒有訊息，傳第一則吧。</p>') + "</div>" +
      '<div class="row" style="align-items:flex-end"><textarea id="g9msg" placeholder="輸入訊息…" style="flex:1;min-height:56px;margin:0"></textarea><button class="pri" data-do="g9send" data-team="' + E(tid) + '">傳送</button></div>' +
      '<div class="row">' + (rec ? '<button class="dng" data-do="g9recStop" data-team="' + E(tid) + '">⏹ 停止並傳送語音（<span id="g9rt">0</span> 秒）</button><button class="sm sec" data-do="g9recCancel">取消</button>'
        : '<button class="sec" data-do="g9pickImg" data-team="' + E(tid) + '">📷 傳送圖片</button><button class="sec" data-do="g9rec" data-team="' + E(tid) + '">🎤 錄製語音</button>') +
      '<input type="file" accept="image/*" id="g9img" data-team="' + E(tid) + '" style="display:none"><span class="mut" id="g9busy"></span></div>';
  }
  function teamBtn(t) { var n = unread(t.id); return '<button class="sm ' + (ui.chatTeam === t.id ? "pri" : "sec") + '" data-do="g9pick" data-team="' + t.id + '">' + E(code(t)) + (n ? ' <i class="bdg">' + n + "</i>" : "") + "</button>"; }
  function chatStaff() {
    var cl = ROLE === "teacher" ? myCls() : ui.rkCls, list = teams(cl);
    if (ROLE === "teacher" && !cl) return '<div class="card"><p class="mut">請重新登入並選擇您的導師班級。</p></div>';
    if (!list.some(function (t) { return t.id === ui.chatTeam; })) ui.chatTeam = (list.filter(function (t) { return unread(t.id); })[0] || list[0] || {}).id || "";
    var t = KC.team(ui.chatTeam);
    return (ROLE === "teacher" ? '<div class="card g9dark"><h3>📢 傳給全班 ' + list.length + " 個小隊</h3>" + '<div class="row" style="align-items:flex-end"><textarea id="g9all" placeholder="例：請各隊 16:00 前回到集合點" style="flex:1;min-height:56px;margin:0"></textarea><button class="pri" data-do="g9sendAll">全部傳送</button></div></div>' : "") +
      '<div class="card g9dark"><h3>💬 小隊聯繫</h3>' + (ROLE === "admin" ? '<div class="row"><select data-do="g9rk"><option value="">全部班級</option>' + CLS.map(function (c) { return '<option value="' + c + '"' + (ui.rkCls === c ? " selected" : "") + ">" + c + " 班</option>"; }).join("") + "</select></div>" : "") +
      '<div class="row">' + list.map(teamBtn).join("") + "</div>" +
      (t ? '<h4 style="margin:10px 0 6px">' + E(code(t)) + "　" + E(theme(t)) + "</h4>" + thread(t.id) : '<p class="mut">尚無小隊，請行政端先在「📚 專題小隊」按「套用為小隊編組」。</p>') + "</div>";
  }
  function chatStudent() {
    var t = myTeam(); if (!t) return '<div class="card"><p class="mut">尚未編入小隊，無法聯繫。</p></div>';
    return '<div class="card g9dark"><h3>💬 ' + E(code(t)) + " 與老師聯繫</h3><p class=\"mut\" style=\"margin-top:0\">訊息會傳給 " + E(clsOf(t)) + " 班導師與行政端。</p>" + thread(t.id) + "</div>";
  }
  function post(tid, text, extra) { KC.S.chat = KC.S.chat || []; var m = me(); KC.S.chat.push(Object.assign({ id: "c" + KC.uid(), kind: "chat", team: tid, from: ROLE, by: ROLE === "student" ? (m && m.name) || "" : ROLE === "teacher" ? myCls() + " 導師" : "行政", text: (window.KCTEST && ROLE === "student" && text ? "🧪測試｜" : "") + text, at: stamp(), t: Date.now() }, extra || {})); }
  /* 圖片與語音：檔案存在 photos 集合（與闖關照片相同），訊息只記錄編號 */
  var rec = null, REC_MAX = 60;
  function sendMedia(tid, data, extra, label) {
    var b = $("g9busy"); if (b) b.textContent = "上傳中…";
    var pid = "chat|" + tid + "|" + Date.now();
    return KCQ.putPhoto(pid, data).then(function () { CTX.sync(); var x = {}; x[extra.key] = pid; if (extra.dur) x.dur = extra.dur; post(tid, "", x); CTX.done(); }, function (e) { if (b) b.textContent = ""; alert(label + "傳送失敗：" + ((e && e.message) || e)); });
  }
  function recStart(tid) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) return alert("這個瀏覽器不支援錄音，請改用文字或更新瀏覽器（iPhone 請用 Safari 14.5 以上）");
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var types = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/aac"], mt = "";
      for (var i = 0; i < types.length; i++) if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(types[i])) { mt = types[i]; break; }
      var mr = new MediaRecorder(stream, mt ? { mimeType: mt, audioBitsPerSecond: 32000 } : { audioBitsPerSecond: 32000 });
      rec = { mr: mr, chunks: [], start: Date.now(), team: tid, stream: stream, send: false, timer: null };
      mr.ondataavailable = function (e) { if (e.data && e.data.size) rec.chunks.push(e.data); };
      mr.onstop = function () {
        var r = rec; rec = null; clearInterval(r.timer); r.stream.getTracks().forEach(function (t) { t.stop(); });
        if (!r.send) return CTX.render();
        var dur = Math.max(1, Math.round((Date.now() - r.start) / 1000)), blob = new Blob(r.chunks, { type: mr.mimeType || mt || "audio/webm" });
        if (blob.size > 700 * 1024) { CTX.render(); return alert("語音檔太大，請錄短一點（建議 60 秒內）"); }
        var fr = new FileReader(); fr.onload = function () { CTX.render(); sendMedia(r.team, fr.result, { key: "audio", dur: dur }, "語音"); }; fr.readAsDataURL(blob);
      };
      mr.start(1000);
      rec.timer = setInterval(function () { var s = Math.round((Date.now() - rec.start) / 1000), el = $("g9rt"); if (el) el.textContent = s; if (s >= REC_MAX) { rec.send = true; rec.mr.stop(); } }, 500);
      CTX.render();
    }, function () { alert("無法使用麥克風，請在瀏覽器設定允許「麥克風」"); });
  }

  /* ================= 導師：我的班級 ================= */
  function pingTxt(t) {
    var p = KCQ.q().pings[t.id]; if (!p || !p.t) return badge("未回報位置", "gr");
    var age = Math.round((Date.now() - p.t) / 60000), b = age < 2 ? badge("📍 在線", "ok") : age < 10 ? badge("📍 " + age + " 分前", "wn") : badge("📍 " + (age < 120 ? age + " 分前" : Math.round(age / 60) + " 小時前"), "no");
    return b + (p.lat ? ' <a href="https://www.google.com/maps/search/?api=1&query=' + p.lat + "," + p.lng + '" target="_blank" rel="noopener">地圖</a>' : "");
  }
  function clsView() {
    var cl = myCls(); if (!cl) return '<div class="card"><p class="mut">請重新登入並選擇您的導師班級。</p></div>';
    var list = teams(cl), rkAll = ranking(), A = KCQ.activeTasks("A"), ds = disp().filter(function (t) { return list.some(function (tm) { return KCQ.forTeam(t, tm); }); }).slice(0, 5);
    if (!list.length) return '<div class="card"><h3>🏫 ' + E(cl) + ' 班</h3><p class="mut">行政端尚未完成小隊編組。</p></div>';
    var h = '<div class="card"><h3>🏫 ' + E(cl) + " 班　" + list.length + ' 個小隊</h3><p class="mut" style="margin:0">資料即時更新。闖關照片可在「📝 關卡檢核」查看；與小隊聯繫請按各隊的「💬 聯繫」。</p></div>';
    var lv = ds.filter(live);
    if (lv.length) h += '<div class="card" style="border-left:4px solid var(--ac)"><h3>⏱ 進行中的限時任務</h3>' + lv.map(function (t) {
      return '<div class="nt"><b>B' + t.no + "</b> 剩 " + cd(t) + '<div style="white-space:pre-wrap">' + E(t.text) + '</div><div class="row">' + list.filter(function (tm) { return KCQ.forTeam(t, tm); }).map(function (tm) { return E(code(tm)) + " " + stOf(tm, t); }).join("　") + "</div></div>";
    }).join("") + "</div>";
    list.forEach(function (t) {
      var g = pblOf(t) || {}, s = score(t), r = rkAll.filter(function (x) { return x.team === t.id; })[0] || {}, q = KCQ.q();
      var pend = Object.keys(q.subs).filter(function (k) { return q.subs[k].team === t.id && q.subs[k].status === "pending"; }).length, n = unread(t.id);
      var chips = A.map(function (a) { var sb = KCQ.sub(t.id, a.id), st = sb ? sb.status : "", bg = st === "approved" ? "var(--ok)" : st === "pending" ? "var(--wn)" : st === "rejected" ? "var(--no)" : sb && sb.arrived ? "#7aa7c7" : "var(--line)";
        return '<span title="A' + a.no + " " + E(a.place || "") + '" style="display:inline-block;min-width:30px;text-align:center;padding:2px 4px;margin:2px;border-radius:6px;font-size:12px;background:' + bg + ";color:" + (st || (sb && sb.arrived) ? "#fff" : "var(--mut)") + '">A' + a.no + "</span>"; }).join("");
      var off = (window.KCPBL ? KCPBL.ROLES : []).map(function (x) { var p = g[x[0]] || {}; return p.n ? x[1] + "：" + E(p.n) : ""; }).filter(Boolean).join("　");
      h += '<div class="card"><div class="row" style="justify-content:space-between"><div><b style="font-size:18px;color:var(--ac)">' + E(code(t)) + "</b>　" + E(theme(t)) + "</div>" +
        '<button class="sm pri" data-do="g9goChat" data-team="' + t.id + '">💬 聯繫' + (n ? ' <i class="bdg">' + n + "</i>" : "") + "</button></div>" +
        '<p class="mut" style="margin:4px 0">👩‍🏫 ' + E(String(g.advisor || "—").replace(/\n/g, "、")) + "　🏫 " + E(g.room || "—") + "　" + pingTxt(t) + "</p>" +
        '<div class="grid"><div class="stat"><b>' + (r.rank && (r.total || r.aDone) ? medal(r.rank) : "—") + '</b><span>全年級名次</span></div><div class="stat"><b>' + s.total + '</b><span>總分</span></div><div class="stat"><b>' + s.aDone + "／" + A.length + '</b><span>通過關卡</span></div><div class="stat"><b>' + pend + '</b><span>待審核</span></div><div class="stat"><b>' + (s.wrongN || 0) + "</b><span>答錯次數</span></div></div>" +
        (A.length ? '<p class="mut" style="margin:8px 0 2px">關卡進度（綠＝通過、黃＝待審、紅＝退回、藍＝已抵達）</p><div>' + chips + "</div>" : "") +
        (ds.length ? '<p class="mut" style="margin:8px 0 2px">限時任務</p>' + ds.filter(function (d) { return KCQ.forTeam(d, t); }).map(function (d) { return '<div class="row" style="margin:2px 0">B' + d.no + " " + E(String(d.text).slice(0, 24)) + " " + stOf(t, d) + "</div>"; }).join("") : "") +
        '<details style="margin-top:8px"><summary style="cursor:pointer">幹部與組員（' + (g.members || []).length + " 人）</summary>" + (off ? "<p>" + off + "</p>" : "") + '<p style="line-height:1.8">' + (g.members || []).map(E).join("、") + "</p></details></div>";
    });
    return h;
  }

  /* ================= 公告／廣播（合併） ================= */
  function noticeView() {
    var tm = myTeam(), cl = myCls();
    var ns = KC.S.notices.filter(function (n) {
      if (ROLE === "admin" || !n.team) return true;
      if (ROLE === "student") return tm && n.team === tm.id;
      var t = KC.team(n.team); return t && clsOf(t) === cl;
    }).slice().reverse();
    var form = ROLE === "admin" ? '<div class="card g9dark"><h3>📢 發布公告／廣播</h3><p class="mut" style="margin-top:0">選「全體」時，導師與 30 隊小隊長都看得到；選單一小隊時，只有該隊與其導師看得到。</p>' +
      '<div class="row"><select id="m_to"><option value="">全體（導師＋全部小隊）</option>' + CLS.map(function (c) { var l = teams(c); return l.length ? '<optgroup label="' + c + ' 班">' + l.map(function (t) { return '<option value="' + t.id + '">' + E(code(t)) + "</option>"; }).join("") + "</optgroup>" : ""; }).join("") + "</select></div>" +
      '<textarea id="m_tx" placeholder="公告內容"></textarea><div class="row"><button class="pri" data-do="qSend">發布</button></div></div>' : "";
    return form + '<div class="card g9dark"><h3>' + (ROLE === "admin" ? "公告紀錄" : "📢 公告") + "</h3>" + (ns.map(function (n) {
      var t = KC.team(n.team);
      return '<div class="nt"><div class="mut">' + E(n.at) + (n.kind === "battle" ? "　📣 戰況公告" : "") + "　→ " + (t ? E(code(t)) : "全體") +
        (ROLE === "admin" ? ' <button class="sm dng" data-do="delNote" data-id="' + E(n.id) + '">刪除</button>' : "") + '</div><div style="white-space:pre-wrap">' + E(n.text) + "</div></div>";
    }).join("") || '<p class="mut">尚無公告</p>') + "</div>";
  }

  /* ================= 學生端首頁：戰況｜公告 分欄 ================= */
  function hubCols(m) {
    var tm = m && m.team ? KC.team(m.team) : null, hi = tm ? tm.id : "";
    var bs = battles().slice(0, 3), ns = KC.S.notices.filter(function (n) { return n.kind !== "battle" && (!n.team || (tm && n.team === tm.id)); }).slice().reverse().slice(0, 8);
    return '<div class="g9cols" id="h_note">' +
      '<div class="card g9dark"><h3>📣 闖關戰況</h3>' + (bs.map(function (n) {
        return '<div class="nt"><div class="mut">' + E(n.at) + "</div>" + (n.msg ? '<div style="white-space:pre-wrap;margin:2px 0 4px">' + E(n.msg) + "</div>" : "") + (n.rank && n.rank.length ? n.rank.map(function (r) { return '<div class="g9rk"' + (r.team === hi ? ' style="background:#1d4a37;font-weight:700"' : "") + "><span>" + (r.total || r.aDone ? medal(r.rank) : r.rank) + "</span><span>" + E(r.code) + "</span><span>" + r.total + " 分</span></div>"; }).join("") : "") + "</div>";
      }).join("") || '<p class="mut">行政端尚未派送戰況公告</p>') + "</div>" +
      '<div class="card g9dark"><h3>📢 公告</h3>' + (ns.map(function (n) { return '<div class="nt"><div class="mut">' + E(n.at) + (n.team ? "　→ 本隊" : "") + '</div><div style="white-space:pre-wrap">' + E(n.text) + "</div></div>"; }).join("") || '<p class="mut">尚無公告</p>') + "</div></div>";
  }

  /* ================= 學生端闖關頁：小隊與關卡即時地圖 ================= */
  var QM = { node: null, map: null, lay: null, me: null, meAcc: 0, watch: null, fitted: false, loading: false };
  function dist(a, b, c, d) { var R = 6371000, r = Math.PI / 180, x = (c - a) * r, y = (d - b) * r, h = Math.sin(x / 2) * Math.sin(x / 2) + Math.cos(a * r) * Math.cos(c * r) * Math.sin(y / 2) * Math.sin(y / 2); return 2 * R * Math.asin(Math.sqrt(h)); }
  function fmtD(m) { return m >= 1000 ? (m / 1000).toFixed(1) + " 公里" : Math.round(m) + " 公尺"; }
  function qmLoad(cb) {
    if (window.L) return cb();
    if (QM.loading) return; QM.loading = true;
    var css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(css);
    var sc = document.createElement("script"); sc.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; sc.onload = function () { QM.loading = false; cb(); };
    sc.onerror = function () { QM.loading = false; var n = $("g9qnote"); if (n) n.textContent = "地圖載入失敗（需要網路），請稍後重新整理。"; }; document.head.appendChild(sc);
  }
  function qmWatch() {
    if (QM.watch !== null || !navigator.geolocation) return;
    QM.watch = navigator.geolocation.watchPosition(function (p) { QM.me = [p.coords.latitude, p.coords.longitude]; QM.meAcc = p.coords.accuracy || 0; qmDraw(); },
      function (e) { var n = $("g9qnote"); if (n) n.textContent = "⚠️ 無法取得 GPS 位置（" + (e && e.message || "") + "），請允許定位。"; }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  }
  function qmDraw() {
    var host = $("g9qmapHost"); if (!host || !QM.map) return;
    var tm = myTeam(); if (!tm) return;
    var L = window.L, q = KCQ.q(); QM.lay.clearLayers();
    var me = QM.me; if (!me) { var p = q.pings[tm.id]; if (p && p.lat && Date.now() - p.t < 600000) me = [p.lat, p.lng]; }
    var pts = [], near = null;
    KCQ.activeTasks("A").filter(function (t) { return t.lat && t.lng && KCQ.forTeam(t, tm); }).forEach(function (t) {
      var sb = KCQ.sub(tm.id, t.id), st = sb ? sb.status : "", col = st === "approved" ? "#2e9e5b" : st === "pending" ? "#e0a21b" : st === "rejected" ? "#d9534f" : sb && sb.arrived ? "#2f6bd6" : "#7a7f87";
      var d = me ? dist(me[0], me[1], t.lat, t.lng) : null;
      if (t.useGps && t.radius) L.circle([t.lat, t.lng], { radius: t.radius, color: col, weight: 1, fillOpacity: .08 }).addTo(QM.lay);
      var mk = L.circleMarker([t.lat, t.lng], { radius: 9, color: "#fff", weight: 2, fillColor: col, fillOpacity: .95 }).addTo(QM.lay);
      mk.bindTooltip("A" + t.no, { permanent: true, direction: "top", offset: [0, -8], className: "g9tip" });
      mk.bindPopup("<b>A" + t.no + "</b> " + E(t.code || t.place || "") + (d !== null ? "<br>距離約 " + fmtD(d) : "") + "<br>" + (st === "approved" ? "✅ 已通過" : st === "pending" ? "📤 待審核" : st === "rejected" ? "↩️ 退回" : sb && sb.arrived ? "📍 已抵達" : "尚未完成"));
      pts.push([t.lat, t.lng]);
      if (d !== null && st !== "approved" && st !== "pending" && (!near || d < near.d)) near = { t: t, d: d };
    });
    if (me) {
      if (QM.meAcc) L.circle(me, { radius: Math.min(QM.meAcc, 300), color: "#1a73e8", weight: 0, fillOpacity: .15 }).addTo(QM.lay);
      L.circleMarker(me, { radius: 10, color: "#fff", weight: 3, fillColor: "#1a73e8", fillOpacity: 1 }).addTo(QM.lay).bindTooltip("我們 " + E(code(tm)), { permanent: true, direction: "bottom", offset: [0, 8], className: "g9tip" });
      if (near) L.polyline([me, [near.t.lat, near.t.lng]], { color: "#1a73e8", weight: 3, dashArray: "6 6" }).addTo(QM.lay);
      pts.push(me);
    }
    if (!QM.fitted && pts.length) { QM.fitted = true; try { QM.map.fitBounds(pts, { padding: [30, 30], maxZoom: 17 }); } catch (e) {} }
    var n = $("g9qnote");
    if (n) n.innerHTML = (me ? "🔵 我們的位置" + (QM.meAcc ? "（誤差約 " + Math.round(QM.meAcc) + " 公尺）" : "") : "⏳ 正在取得 GPS 位置…") +
      (near ? "　｜　最近的未完成關卡：<b>A" + near.t.no + "</b> 約 " + fmtD(near.d) : "") +
      '<br><span style="color:#2e9e5b">●</span>通過 <span style="color:#e0a21b">●</span>待審 <span style="color:#d9534f">●</span>退回 <span style="color:#2f6bd6">●</span>已抵達 <span style="color:#7a7f87">●</span>未完成　<button class="sm sec" data-do="g9qCenter">📍 回到我的位置</button>';
  }
  function qmPost() {
    var host = $("g9qmapHost"); if (!host) return;
    if (!QM.node) { QM.node = document.createElement("div"); QM.node.id = "g9qmap"; QM.node.style.cssText = "height:300px;border-radius:12px;border:1px solid var(--line);background:#dfe7ee"; }
    if (QM.node.parentNode !== host) host.appendChild(QM.node);
    qmWatch();
    qmLoad(function () {
      if (!QM.map) { var c = KCQ.q().cfg.center || { lat: 1.2839, lng: 103.8607 }; QM.map = window.L.map(QM.node).setView([c.lat, c.lng], 15); window.L.tileLayer("https://mt{s}.google.com/vt/lyrs=m&hl=zh-TW&gl=SG&x={x}&y={y}&z={z}", { subdomains: "0123", maxZoom: 20, attribution: "地圖資料 ©Google" }).addTo(QM.map); QM.lay = window.L.layerGroup().addTo(QM.map); }
      setTimeout(function () { QM.map.invalidateSize(); qmDraw(); }, 0);
    });
  }

  /* ================= 通知（跳出提醒） ================= */
  var toastBox = null, inited = false;
  function sk() { var m = me(); return "kcg9seen:" + ROLE + ":" + (ROLE === "student" ? (m && m.id) || "" : ROLE === "teacher" ? myCls() : "a"); }
  function seenGet() { try { return JSON.parse(localStorage.getItem(sk()) || "null"); } catch (e) { return null; } }
  function seenSet(o) { try { localStorage.setItem(sk(), JSON.stringify(o)); } catch (e) {} }
  function beep() { try { if (navigator.vibrate) navigator.vibrate([180, 80, 180]); var A = window.AudioContext || window.webkitAudioContext; if (!A) return; var a = new A(), o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; g.gain.value = 0.08; o.connect(g); g.connect(a.destination); o.start(); setTimeout(function () { o.stop(); a.close(); }, 250); } catch (e) {} }
  function toast(html, btn) {
    if (!toastBox) { toastBox = document.createElement("div"); toastBox.id = "g9toast"; document.body.appendChild(toastBox); }
    var d = document.createElement("div"); d.className = "g9t"; d.innerHTML = '<div style="flex:1">' + html + "</div>" + (btn || "") + '<button class="sm sec" data-g9x="1">✕</button>';
    toastBox.appendChild(d); beep();
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 60000);
  }
  function check() {
    if (!KC.isReady || !window.KCQ) return;
    var m = me(); if (ROLE === "student" && !m) return; if (ROLE === "teacher" && !myCls()) return;
    var bs = battles(), ds = disp(), tm = myTeam(), cl = myCls();
    var myDs = ds.filter(function (t) { return ROLE === "student" ? tm && KCQ.forTeam(t, tm) : ROLE === "teacher" ? teams(cl).some(function (x) { return KCQ.forTeam(t, x); }) : false; });
    var myTeams = ROLE === "student" ? (tm ? [tm] : []) : ROLE === "teacher" ? teams(cl) : teams();
    var chats = []; myTeams.forEach(function (t) { chats = chats.concat(chat(t.id).filter(incoming)); });
    var mx = function (a, f) { return a.reduce(function (x, y) { return Math.max(x, f(y) || 0); }, 0); };
    var cur = { b: mx(bs, function (n) { return n.t; }), d: mx(myDs, function (t) { return t.startAt; }), c: mx(chats, function (x) { return x.t; }) };
    var s = seenGet();
    if (!s) { seenSet(cur); return; }
    if (ROLE !== "admin") bs.filter(function (n) { return (n.t || 0) > (s.b || 0); }).slice(0, 2).forEach(function (n) {
      toast("<b>📣 闖關戰況公告</b><div>" + E(n.msg || "排名已更新").slice(0, 80) + "</div>", '<button class="sm pri" data-do="tab" data-t="' + (ROLE === "student" ? "hub" : "g9battle") + '" data-g9x="1">查看</button>');
    });
    myDs.filter(function (t) { return (t.startAt || 0) > (s.d || 0) && live(t); }).forEach(function (t) {
      toast("<b>⏱ 新的限時任務 B" + t.no + "</b>（" + t.mins + " 分鐘，剩 " + cd(t) + "）<div>" + E(t.text).slice(0, 80) + "</div>",
        ROLE === "student" ? '<button class="sm pri" data-do="g9openTask" data-id="' + t.id + '" data-g9x="1">開始作答</button>' : '<button class="sm pri" data-do="tab" data-t="g9cls" data-g9x="1">查看</button>');
    });
    var nc = chats.filter(function (x) { return (x.t || 0) > (s.c || 0); });
    if (nc.length) { var l = nc[nc.length - 1], lt = KC.team(l.team); toast("<b>💬 " + (ROLE === "student" ? "老師傳來訊息" : E(code(lt)) + " 傳來訊息") + "</b><div>" + (l.img ? "📷 圖片" : l.audio ? "🎤 語音訊息" : E(l.text).slice(0, 80)) + "</div>", '<button class="sm pri" data-do="g9goChat" data-team="' + E(l.team) + '" data-g9x="1">回覆</button>'); }
    seenSet({ b: Math.max(cur.b, s.b || 0), d: Math.max(cur.d, s.d || 0), c: Math.max(cur.c, s.c || 0) });
  }
  function tabBadges(root) {
    var tot = 0; (ROLE === "student" ? (myTeam() ? [myTeam()] : []) : ROLE === "teacher" ? teams(myCls()) : teams()).forEach(function (t) { tot += unread(t.id); });
    var b = document.querySelector('nav.tabs button[data-t="g9chat"]'); if (b && tot && !b.querySelector(".bdg")) b.insertAdjacentHTML("beforeend", '<i class="bdg">' + tot + "</i>");
    if (ROLE === "student") { var lv = disp().filter(function (t) { var tm = myTeam(); if (!tm || !live(t) || !KCQ.forTeam(t, tm)) return false; var s = KCQ.sub(tm.id, t.id); return !s || s.status === "doing" || s.status === "rejected"; }).length, q = document.querySelector('nav.tabs button[data-t="quest"]'); if (q && lv && !q.querySelector(".bdg")) q.insertAdjacentHTML("beforeend", '<i class="bdg">⏱' + lv + "</i>"); }
  }
  /* 倒數計時 */
  setInterval(function () {
    var now = Date.now();
    [].forEach.call(document.querySelectorAll("[data-cd]"), function (el) { var left = Math.max(0, Math.round((+el.getAttribute("data-cd") - now) / 1000)); el.textContent = left ? Math.floor(left / 60) + ":" + ("0" + left % 60).slice(-2) : "已截止"; if (left <= 60) el.style.color = "var(--no)"; });
  }, 1000);
  setInterval(function () { try { check(); } catch (e) {} }, 5000);
  document.addEventListener("click", function (e) { var x = e.target.closest && e.target.closest("[data-g9x]"); if (x) { var t = x.closest(".g9t"); if (t) setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 0); } });
  (function () {
    var st = document.createElement("style");
    st.textContent = "#g9toast{position:fixed;top:8px;left:8px;right:8px;z-index:200;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none}" +
      ".g9t{pointer-events:auto;display:flex;gap:8px;align-items:center;max-width:560px;width:100%;background:#111;color:#f2f2f2;border:2px solid #f0c95a;border-radius:14px;padding:10px 12px;box-shadow:0 8px 28px rgba(0,0,0,.35);font-size:14px;animation:g9in .25s}" +
      "@keyframes g9in{from{transform:translateY(-20px);opacity:0}}" +
      ".g9thr{max-height:420px;overflow:auto;display:flex;flex-direction:column;gap:6px;padding:6px;background:#000;border-radius:12px;margin-bottom:8px}" +
      "body button.pri.sm,body .g9t button.pri{color:#fff}" +
      "nav.tabs{flex-wrap:wrap;overflow-x:visible;row-gap:6px}nav.tabs button{flex:0 0 auto}" +
      ".g9cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;align-items:start;margin-bottom:12px}.g9cols>.card{margin:0;padding:10px;min-width:0}.g9cols h3{font-size:15px}" +
      ".g9cols .scroll{overflow-x:auto;max-width:100%}.g9cols table{width:100%;min-width:0;table-layout:fixed;font-size:12px}.g9cols .nt{padding:4px 6px}.g9cols td,.g9cols th{overflow-wrap:anywhere}.g9cols table th,.g9cols table td{padding:4px 5px}.g9cols .qrow{flex-wrap:wrap;gap:4px 6px;font-size:13px}.g9cols .qno{flex:0 0 auto}.g9cols .qtx{flex:1 1 100%;order:3}.g9cols .qrow .b{font-size:11px}" +
      ".g9rk{display:grid;grid-template-columns:2em 1fr auto;gap:4px;padding:3px 4px;border-bottom:1px solid #2e2e2e;font-size:13px}" +
      ".g9tip{font-size:11px;padding:1px 5px;font-weight:700}" +
      ".g9m{max-width:85%;background:#2b2b2b;color:#f2f2f2;border:1px solid #3a3a3a;border-radius:12px;padding:6px 10px;align-self:flex-start}.g9m.me{align-self:flex-end;background:#1d4a37;border-color:#2c6b51}.g9m .mut{color:#a9b4c2!important}.g9m a{color:#8cc8ff}" +
      ".g9t button.sec{background:#2b2b2b!important;color:#fff!important;border-color:#555!important}" +
      "body .card.g9dark,body .g9dark{background:#111!important;color:#eee;border-color:#222!important}body .g9dark h3,body .g9dark b{color:#fff}body .g9dark .mut{color:#a9b4c2!important}" +
      "body .g9dark table th{color:#cfd8e3;background:#1b1b1b}body .g9dark table td,body .g9dark table th{border-color:#2e2e2e!important}body .g9dark tr[style*=okb]{background:#1d4a37!important}" +
      "body .g9dark select,body .g9dark textarea,body .g9dark input{background:#1e1e1e;color:#fff;border-color:#444}body .g9dark .nt{border-color:#2e2e2e}body .g9dark button.sec{background:#2b2b2b!important;color:#fff!important;border-color:#555!important}body .g9dark button.dng{background:#2a1515!important;color:#ff9b9b!important;border-color:#7a3333!important}body .g9dark .nt+.nt{border-top:1px solid #2e2e2e}";
    document.head.appendChild(st);
  })();

  /* ================= 掛載 ================= */
  var DROP = { admin: ["home", "roster", "signup", "teams", "att", "leave", "qmsg"], teacher: ["roll", "leave"], student: ["home", "leave", "att", "team", "notice"] };
  function mount(role, ctx) {
    ROLE = role; CTX = ctx;
    var T = ctx.TABS, V = ctx.V, H = ctx.H;
    for (var i = T.length - 1; i >= 0; i--) if (DROP[role].indexOf(T[i][0]) >= 0) T.splice(i, 1);
    function after(k, tab) { var j = -1; T.forEach(function (t, x) { if (t[0] === k) j = x; }); T.splice(j + 1, 0, tab); }
    if (role === "admin") { after("pbl", ["g9disp", "⏱ 限時任務派送"]); after("g9disp", ["g9battle", "📣 戰況公告"]); after("g9battle", ["g9chat", "💬 小隊聯繫"]); V.g9disp = dispView; V.g9battle = battleAdmin; }
    if (role === "teacher") { after("hub", ["g9cls", "🏫 我的班級"]); after("g9cls", ["g9chat", "💬 小隊聯繫"]); after("g9chat", ["g9battle", "📣 闖關戰況"]); V.g9cls = clsView; V.g9battle = battleRecv; }
    if (role === "student") { after("quest", ["g9chat", "💬 聯絡老師"]); }
    V.g9chat = role === "student" ? chatStudent : chatStaff;
    V.notice = noticeView;
    T.forEach(function (t) { if (t[0] === "notice") t[1] = role === "admin" ? "📢 公告廣播" : "📢 公告"; });
    if (window.KCQ) { var op = KCQ.post; KCQ.post = function (root) { op(root); try { tabBadges(root); var hn = root.querySelector("#h_note"); if (hn && hn.classList.contains("card")) hn.classList.add("g9dark"); if (ROLE === "student") qmPost(); [].forEach.call(root.querySelectorAll("audio[data-aud]"), function (a) { KCQ.getPhoto(a.getAttribute("data-aud")).then(function (d) { if (d) a.src = d; }); }); var th = $("g9thr"); if (th) th.scrollTop = th.scrollHeight; check(); } catch (e) {} }; }

    H.g9pick = function (d) { ui.chatTeam = d.team; ctx.render(); };
    H.g9goChat = function (d) { ui.chatTeam = d.team; H.tab({ t: "g9chat" }); };
    H.g9rk = function (d, el) { ui.rkCls = el.value; ctx.render(); };
    H.g9send = function (d) { var v = ($("g9msg").value || "").trim(); if (!v) return; post(d.team, v); ctx.done(); };
    H.g9sendAll = function () { var v = ($("g9all").value || "").trim(); if (!v) return; var l = teams(myCls()); if (!confirm("傳給 " + l.map(code).join("、") + " 共 " + l.length + " 隊？")) return; l.forEach(function (t) { post(t.id, v); }); ctx.done(); alert("已傳送給 " + l.length + " 個小隊"); };
    H.g9pickImg = function () { var f = $("g9img"); if (f) f.click(); };
    H.g9rec = function (d) { if (rec) return; recStart(d.team); };
    H.g9recStop = function () { if (!rec) return; rec.send = true; rec.mr.stop(); };
    H.g9recCancel = function () { if (!rec) return; rec.send = false; rec.mr.stop(); };
    document.addEventListener("change", function (e) { if (e.target.id === "g9img" && e.target.files[0]) { var tid = e.target.getAttribute("data-team"), f = e.target.files[0]; e.target.value = ""; KCQ.compress(f, function (d) { sendMedia(tid, d, { key: "img" }, "圖片"); }); } });
    document.addEventListener("click", function (e) { var z = e.target.closest && e.target.closest("[data-g9zoom]"); if (z && z.src) { var w = window.open(""); if (w) w.document.write('<title>圖片</title><body style="margin:0;background:#000"><img src="' + z.src + '" style="max-width:100%;display:block;margin:auto">'); } });
    H.g9qCenter = function () { if (QM.map && QM.me) QM.map.setView(QM.me, 17); else alert("尚未取得 GPS 位置，請確認已允許定位"); };
    H.g9openTask = function (d) { if (role !== "student") return; KCQ.openTask(d.id); H.tab({ t: "quest" }); };
    if (role !== "admin") return;
    H.g9disp = function () {
      var o = readDisp();
      if (!o.text) return alert("請輸入任務題目");
      if (o.none) return alert("請選擇派送對象");
      if (!confirm("派送限時任務給「" + (o.target.length ? o.target.join("、") + " 班" : "全部 30 隊") + "」？\n答題時間 " + o.mins + " 分鐘，送出後立即開始倒數。")) return;
      var img = ui.dImg, go = function (clue) { ctx.sync(); var t = pushTask(o, clue); ui.dImg = null; ui.open[t.id] = true; ctx.done(); };
      if (!img) return go("");
      var pid = "clue|disp" + Date.now(); KCQ.putPhoto(pid, img).then(function () { go(pid); }, function () { alert("題目照片上傳失敗，改為不附照片派送"); go(""); });
    };
    H.g9dImgClr = function () { ui.dImg = null; ctx.render(); };
    H.g9dOpen = function (d) { ui.open[d.id] = !ui.open[d.id]; ctx.render(); };
    var find = function (id) { return KCQ.q().tasks.filter(function (t) { return t.id === id; })[0]; };
    H.g9dExt = function (d) { var t = find(d.id); if (!t) return; t.endAt = Math.max(t.endAt, Date.now()) + 300000; t.mins = (t.mins || 0) + 5; t.bEnd = hm(t.endAt); ctx.done(); };
    H.g9dEnd = function (d) { var t = find(d.id); if (!t || !confirm("立即截止 B" + t.no + "？截止後學生無法再上傳。")) return; t.endAt = Date.now(); t.bEnd = hm(t.endAt); ctx.done(); };
    H.g9dDel = function (d) { var t = find(d.id); if (!t || !confirm("刪除 B" + t.no + "？各隊在此任務的得分也會一併不計。")) return; var q = KCQ.q(); q.tasks = q.tasks.filter(function (x) { return x.id !== d.id; }); ctx.done(); };
    H.g9dRe = function (d) { var t = find(d.id); if (!t) return; var m = prompt("再派送一次 B" + t.no + "，答題時間（分鐘）：", t.mins || 10); if (m === null) return; var n = pushTask({ text: t.text, tip: t.photoTip || "", mode: t.mode, mins: Math.max(1, +m || 10), pts: t.pts, target: t.target || [] }, t.clueImg || ""); ui.open[n.id] = true; ctx.done(); };
    H.g9bSend = function () {
      var msg = ($("bt_msg").value || "").trim(), n = +$("bt_n").value, rkAll = ranking(), rows = n < 0 ? [] : n === 0 ? rkAll : rkAll.slice(0, n);
      if (!msg && !rows.length) return alert("請輸入公告內容或附上排名");
      if (!confirm("派送戰況公告給所有導師與學生？")) return;
      var text = "【闖關戰況】" + (msg ? msg : "") + (rows.length ? "\n" + rows.map(function (r) { return (r.rank <= 3 && (r.total || r.aDone) ? medal(r.rank) : r.rank + ".") + " " + r.code + "　" + r.total + " 分（通過 " + r.aDone + " 關）"; }).join("\n") : "");
      KC.S.notices.push({ id: "b" + KC.uid(), kind: "battle", text: text, msg: msg, rank: rows, total: rkAll.length, team: "", at: stamp(), t: Date.now() });
      ctx.done();
    };
    H.g9bDel = function (d) { if (!confirm("刪除這則戰況公告？")) return; KC.S.notices = KC.S.notices.filter(function (n) { return n.id !== d.id; }); ctx.done(); };
    document.addEventListener("change", function (e) { if (e.target.dataset && e.target.dataset.dpc && e.target.checked && $("dp_all")) $("dp_all").checked = false; if (e.target.id === "dp_all" && e.target.checked) [].forEach.call(document.querySelectorAll("[data-dpc]"), function (x) { x.checked = false; }); });
    document.addEventListener("change", function (e) { if (e.target.id === "dp_img" && e.target.files[0]) KCQ.compress(e.target.files[0], function (d) { ui.dImg = d; var keep = readDisp(); ctx.render(); try { $("dp_text").value = keep.text; $("dp_tip").value = keep.tip; $("dp_mode").value = keep.mode; $("dp_min").value = keep.mins; $("dp_pts").value = keep.pts; } catch (x) {} }); });
  }
  return { mount: mount, ranking: ranking, hubCols: hubCols };
})();
