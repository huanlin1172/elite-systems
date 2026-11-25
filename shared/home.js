/* 活動首頁模組（行政／教師／學生三端共用）
   區塊：重要事項提醒、訊息公告、天氣預報、小隊幹部名單、活動照片花絮（G10 為小隊照片分享）、檔案存放區（可建目錄） */
(function (w) {
  var E = KC.esc, KCH = {}, cfg = KC.cfg;
  var ui = { lib: null, folder: "", lb: null, showAllNotes: false, editWx: false, galN: 12, wx: null, wxKey: "", wxErr: "", wxBusy: false };
  var FILE_MAX = 650 * 1024;   /* Firestore 單一文件上限 1MB，base64 會膨脹約 1/3 */
  var LEVELS = [["normal", "一般", "gr"], ["important", "重要", "wn"], ["urgent", "緊急", "no"]];
  var PLACES = { g7: ["臺北市立動物園", 24.9983, 121.5809], g8a: ["合歡山", 24.1436, 121.2706], g8b: ["臺灣（請設定營地）", 24.9936, 121.3010], g9: ["新加坡 魚尾獅公園", 1.2868, 103.8545], g10: ["臺中（請設定起點）", 24.1477, 120.6736] };
  var PRESETS = [["臺北市立動物園", 24.9983, 121.5809], ["合歡山", 24.1436, 121.2706], ["日月潭", 23.8523, 120.9154], ["新加坡 魚尾獅公園", 1.2868, 103.8545], ["新加坡 聖淘沙", 1.2494, 103.8303], ["臺北", 25.033, 121.5654], ["臺中", 24.1477, 120.6736], ["高雄", 22.6273, 120.3014], ["花蓮", 23.9871, 121.6015], ["桃園", 24.9936, 121.301]];
  function $(i) { return document.getElementById(i); }
  function badge(t, c) { return '<span class="b ' + c + '">' + t + "</span>"; }
  function stamp() { return new Date().toLocaleString("zh-TW", { hour12: false }); }
  function lv(k) { return LEVELS.filter(function (x) { return x[0] === k; })[0] || LEVELS[0]; }

  /* ---------- 檔案與照片（雲端存 Firestore；單機存 IndexedDB）---------- */
  var dbp, mem = {};
  function idb() { return dbp || (dbp = new Promise(function (res, rej) { var r = indexedDB.open("kch-" + KC.id + (KC.demo ? "-demo" : ""), 1); r.onupgradeneeded = function () { r.result.createObjectStore("b"); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; })); }
  KCH.put = function (id, data) {
    mem[id] = data;
    if (KC.cloud) return KC.cloud.putPhoto(id, data);
    return idb().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction("b", "readwrite"); t.objectStore("b").put(data, id); t.oncomplete = res; t.onerror = rej; }); });
  };
  KCH.get = function (id) {
    if (mem[id]) return Promise.resolve(mem[id]);
    var p = KC.cloud ? KC.cloud.getPhoto(id) : idb().then(function (d) { return new Promise(function (res) { var r = d.transaction("b").objectStore("b").get(id); r.onsuccess = function () { res(r.result); }; r.onerror = function () { res(null); }; }); });
    return p.then(function (d) { if (d) mem[id] = d; return d; }, function () { return null; });
  };
  KCH.del = function (id) {
    delete mem[id];
    if (KC.cloud) return KC.cloud.delPhoto(id).catch(function () {});
    return idb().then(function (d) { d.transaction("b", "readwrite").objectStore("b").delete(id); }, function () {});
  };
  function shrink(file, max, q) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { var im = new Image(); im.onload = function () { var s = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL("image/jpeg", q)); }; im.onerror = function () { rej(new Error("無法讀取圖片")); }; im.src = fr.result; };
      fr.onerror = function () { rej(fr.error); }; fr.readAsDataURL(file);
    });
  }
  function readURL(file) { return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = function () { rej(fr.error); }; fr.readAsDataURL(file); }); }
  function fmtSize(n) { return n < 1024 ? n + " B" : n < 1048576 ? Math.round(n / 1024) + " KB" : (n / 1048576).toFixed(1) + " MB"; }
  function safeUrl(u) { return /^https?:\/\//i.test(u) ? u : ""; }

  /* ---------- 天氣（Open-Meteo，免金鑰）---------- */
  var WX = { 0: ["晴天", "☀️"], 1: ["大致晴朗", "🌤️"], 2: ["局部多雲", "⛅"], 3: ["陰天", "☁️"], 45: ["有霧", "🌫️"], 48: ["霧凇", "🌫️"], 51: ["毛毛雨", "🌦️"], 53: ["毛毛雨", "🌦️"], 55: ["毛毛雨", "🌦️"], 56: ["凍毛毛雨", "🌧️"], 57: ["凍毛毛雨", "🌧️"], 61: ["小雨", "🌧️"], 63: ["中雨", "🌧️"], 65: ["大雨", "🌧️"], 66: ["凍雨", "🌧️"], 67: ["凍雨", "🌧️"], 71: ["小雪", "❄️"], 73: ["中雪", "❄️"], 75: ["大雪", "❄️"], 77: ["雪粒", "❄️"], 80: ["陣雨", "🌦️"], 81: ["陣雨", "🌦️"], 82: ["強陣雨", "⛈️"], 85: ["陣雪", "❄️"], 86: ["強陣雪", "❄️"], 95: ["雷雨", "⛈️"], 96: ["雷雨冰雹", "⛈️"], 99: ["強雷雨冰雹", "⛈️"] };
  function wxd(c) { return WX[c] || ["—", "❔"]; }
  function place() { var p = (KC.S.settings || {}).weather; return p && p.lat != null ? p : { name: PLACES[KC.id][0], lat: PLACES[KC.id][1], lng: PLACES[KC.id][2] }; }
  function loadWx(force, rerender) {
    var p = place(), key = p.lat + "," + p.lng;
    if (ui.wxBusy) return;
    if (!force && ui.wxKey === key && (ui.wx || ui.wxErr)) return;
    try { var c = JSON.parse(sessionStorage.getItem("kcwx:" + key)); if (!force && c && Date.now() - c.t < 30 * 60000) { ui.wx = c.d; ui.wxKey = key; ui.wxErr = ""; return; } } catch (e) {}
    ui.wxBusy = true; ui.wxErr = "";
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + p.lat + "&longitude=" + p.lng + "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=auto&forecast_days=5";
    fetch(url).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }).then(function (d) {
      if (!d || !d.daily) throw new Error("格式錯誤");
      ui.wx = d; ui.wxKey = key; ui.wxBusy = false; try { sessionStorage.setItem("kcwx:" + key, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {} rerender();
    }).catch(function (e) { ui.wxBusy = false; ui.wxErr = "天氣資料暫時無法取得（" + (e.message || e) + "），請確認網路後按「重新整理」。"; ui.wxKey = key; rerender(); });
  }
  function wxView(role) {
    var p = place(), d = ui.wx, h = '<div class="card" id="h_wx"><h3>🌤️ 天氣預報　<span class="mut" style="font-weight:400">' + E(p.name) + "</span></h3>";
    if (d && d.current) {
      var c = d.current, w0 = wxd(c.weather_code);
      h += '<div class="row"><span style="font-size:42px;line-height:1">' + w0[1] + '</span><div><b style="font-size:26px;color:var(--ac)">' + Math.round(c.temperature_2m) + "°C</b> " + w0[0] + '<div class="mut">體感 ' + Math.round(c.apparent_temperature) + "°C　風速 " + Math.round(c.wind_speed_10m) + " km/h　降水 " + c.precipitation + ' mm</div></div></div>';
      var evDate = KC.S.quest && KC.S.quest.cfg && KC.S.quest.cfg.date;
      h += '<div class="grid" style="margin-top:8px">' + d.daily.time.map(function (t, i) {
        var w1 = wxd(d.daily.weather_code[i]), dt = new Date(t + "T00:00"), pop = d.daily.precipitation_probability_max ? d.daily.precipitation_probability_max[i] : null;
        return '<div class="stat" style="text-align:center' + (evDate === t ? ";border-color:var(--ac)" : "") + '"><span>' + (i === 0 ? "今天" : dt.toLocaleDateString("zh-TW", { month: "numeric", day: "numeric", weekday: "short" })) + (evDate === t ? " ・活動日" : "") + '</span><div style="font-size:26px">' + w1[1] + "</div><b style=\"font-size:15px\">" + Math.round(d.daily.temperature_2m_max[i]) + "° / " + Math.round(d.daily.temperature_2m_min[i]) + '°</b><span>' + w1[0] + (pop != null ? "　☔" + pop + "%" : "") + "</span></div>";
      }).join("") + "</div>";
      var tips = [], i2;
      for (i2 = 0; i2 < d.daily.time.length; i2++) { var pp = d.daily.precipitation_probability_max ? d.daily.precipitation_probability_max[i2] : 0; if (pp >= 60) { tips.push("☔ 降雨機率偏高，請攜帶雨具"); break; } }
      for (i2 = 0; i2 < d.daily.time.length; i2++) { if (d.daily.temperature_2m_max[i2] >= 32) { tips.push("🥵 氣溫偏高，注意防曬與補充水分"); break; } }
      for (i2 = 0; i2 < d.daily.time.length; i2++) { if (d.daily.temperature_2m_min[i2] <= 12) { tips.push("🧥 早晚偏冷，請備保暖衣物"); break; } }
      for (i2 = 0; i2 < d.daily.time.length; i2++) { if ([95, 96, 99].indexOf(d.daily.weather_code[i2]) >= 0) { tips.push("⛈️ 預報有雷雨，請留意活動安全"); break; } }
      if (tips.length) h += '<div class="nt">' + tips.map(E).join("<br>") + "</div>";
    } else if (ui.wxErr) h += '<p class="mut">' + E(ui.wxErr) + "</p>";
    else h += '<p class="mut">載入中…</p>';
    h += '<div class="row"><button class="sm sec" data-do="hWxRefresh">重新整理</button>' + (role === "admin" ? '<button class="sm sec" data-do="hWxEdit">' + (ui.editWx ? "收合地點設定" : "更改預報地點") + "</button>" : "") + '<span class="mut">資料來源：Open-Meteo，約每 30 分鐘更新</span></div>';
    if (role === "admin" && ui.editWx) {
      h += '<div class="row"><select data-do="hWxPre"><option value="">選擇常用地點…</option>' + PRESETS.map(function (x, i) { return '<option value="' + i + '">' + E(x[0]) + "</option>"; }).join("") + '</select><input id="wx_n" value="' + E(p.name) + '" placeholder="地點名稱" style="width:170px"><input id="wx_la" value="' + p.lat + '" style="width:100px" placeholder="緯度"><input id="wx_lo" value="' + p.lng + '" style="width:100px" placeholder="經度"><button class="pri" data-do="hWxSave">儲存</button></div>';
    }
    return h + "</div>";
  }

  /* ---------- 各區塊 ---------- */
  function remView(role) {
    var today = KC.today(), isA = role === "admin", rank = { urgent: 0, important: 1, normal: 2 };
    var list = KC.S.reminders.slice().filter(function (r) { return isA || !r.date || r.date >= today; }).sort(function (a, b) {
      return ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || (rank[a.level] - rank[b.level]) || String(a.date || "9999").localeCompare(String(b.date || "9999"));
    });
    var h = '<div class="card" id="h_rem"><h3>⚠️ 重要事項提醒</h3>';
    if (isA) h += '<div class="row"><input id="rm_t" placeholder="提醒標題（例：6:30 於校門口集合）" style="flex:1;min-width:200px"><input type="date" id="rm_d"><select id="rm_l">' + LEVELS.map(function (l) { return '<option value="' + l[0] + '">' + l[1] + "</option>"; }).join("") + '</select></div><textarea id="rm_b" placeholder="詳細說明（選填）" style="min-height:56px"></textarea><div class="row"><button class="pri" data-do="hAddRem">新增提醒</button></div>';
    h += list.map(function (r) {
      var l = lv(r.level), past = r.date && r.date < today;
      return '<div class="nt" style="' + (r.level === "urgent" ? "border-left-color:var(--no)" : r.level === "important" ? "border-left-color:var(--wn)" : "") + (past ? ";opacity:.55" : "") + '">' + (r.pinned ? "📌 " : "") + badge(l[1], l[2]) + " <b>" + E(r.title) + "</b>" + (r.date ? ' <span class="mut">' + E(r.date) + (past ? "（已過）" : "") + "</span>" : "") +
        (r.body ? "<div>" + E(r.body).replace(/\n/g, "<br>") + "</div>" : "") +
        (isA ? '<div class="row"><button class="sm sec" data-do="hPinRem" data-id="' + E(r.id) + '">' + (r.pinned ? "取消置頂" : "置頂") + '</button><button class="sm dng" data-do="hDelRem" data-id="' + E(r.id) + '">刪除</button></div>' : "") + "</div>";
    }).join("") || '<p class="mut">目前沒有提醒事項</p>';
    return h + "</div>";
  }
  function noteView(role, me) {
    var all = KC.S.notices.filter(function (n) { var my = role === "student" ? (me && me.team) : (window.KCW && KCW.scopeTeam && KCW.scopeTeam(role)); return role === "admin" || !n.team || (my ? n.team === my : role !== "student"); }).slice().reverse();
    var list = ui.showAllNotes ? all : all.slice(0, 5);
    var h = '<div class="card" id="h_note"><h3>📢 訊息公告</h3>';
    if (role === "admin") h += '<div class="row"><textarea id="hn_t" placeholder="輸入公告內容（全體可見）" style="min-height:56px"></textarea></div><div class="row"><button class="pri" data-do="hAddNote">發布公告</button></div>';
    h += list.map(function (n) {
      var t = KC.team(n.team);
      return '<div class="nt"><div class="mut">' + E(n.at) + (n.team ? " → " + (t ? E(t.name) : "") : "") + (role === "admin" ? ' <button class="sm dng" data-do="hDelNote" data-id="' + E(n.id) + '">刪除</button>' : "") + "</div>" + E(n.text).replace(/\n/g, "<br>") + "</div>";
    }).join("") || '<p class="mut">尚無公告</p>';
    if (all.length > 5) h += '<div class="row"><button class="sm sec" data-do="hMoreNote">' + (ui.showAllNotes ? "只看最新 5 則" : "顯示全部 " + all.length + " 則") + "</button></div>";
    return h + "</div>";
  }
  function crewView(role, me) {
    if (RO(role)) return "";
    var teams = KC.S.teams, R = KC.ROLES;
    var h = '<div class="card" id="h_crew"><h3>🎖️ ' + E(cfg.unit) + "幹部名單</h3>";
    if (!teams.length) return h + '<p class="mut">尚未編組，編組後會顯示在這裡。</p></div>';
    h += '<div class="scroll"><table style="min-width:560px"><tr><th>' + E(cfg.unit) + "</th>" + R.map(function (x) { return "<th>" + x[1] + "</th>"; }).join("") + "</tr>" + teams.map(function (t) {
      var rm = KC.roleMap(t), mine = me && me.team === t.id;
      return "<tr" + (mine ? ' style="background:var(--okb)"' : "") + "><td><b>" + E(t.name) + "</b>" + (mine ? " " + badge("我的", "ok") : "") + "</td>" + R.map(function (x) { var s = KC.student(rm[x[0]]); return "<td>" + (s ? E(s.name) + '<div class="mut" style="font-size:12px">' + E(s.cls) + "</div>" : '<span class="mut">—</span>') + "</td>"; }).join("") + "</tr>";
    }).join("") + "</table></div>";
    if (role === "admin") h += '<p class="mut">指派請到「' + E(cfg.unit) + "管理」。</p>";
    return h + "</div>";
  }
  function RO(role) { return window.ACT === "g10" && role !== "admin"; }   /* G10：學生／教師端首頁內容僅供閱覽 */
  function teamPhotoView() {
    var A = KC.S.att || {}, TRN = ["2025-12-06", "2025-12-20", "2026-01-11", "2026-03-07", "2026-03-15", "2026-03-21"].map(function (d0, i) { var x = KC.S.sessions.filter(function (y) { return y.id === "pt" + (i + 1); })[0]; return x ? x.date : d0; }), tot = 0, body = "";
    TRN.forEach(function (d, i) {
      var m = A["info:pt" + (i + 1)] || {}, ks = Object.keys(m).filter(function (k) { return (m[k].list || []).length; }).sort(function (a, b) { return +a.slice(1) - +b.slice(1); }), n = 0;
      ks.forEach(function (k) { n += m[k].list.length; }); tot += n;
      body += "<h4>第 " + (i + 1) + " 次行前訓練 <small class=\"mut\">" + d + "　" + n + " 張</small></h4>" + (ks.length ? ks.map(function (k) {
        return '<div style="margin-bottom:6px"><b>第 ' + E(k.slice(1)) + ' 小隊</b><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin-top:4px">' + m[k].list.map(function (p) {
          return '<img src="' + E(p.thumb) + '" alt="" data-do="hTpView" data-pid="' + E(p.pid) + '" data-th="' + E(p.thumb) + '" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;border:1px solid var(--line);cursor:pointer">'; }).join("") + "</div></div>";
      }).join("") : '<p class="mut">尚無照片</p>');
    });
    return '<div class="card" id="h_gal"><h3>📷 行前訓練花絮（' + tot + '）</h3><p class="mut" style="margin:0">來源：各小隊資訊長上傳的行前訓練照片，依場次整理；點照片可放大下載。</p>' + body + "</div>";
  }
  function galView(role, me) {
    if (window.ACT === "g10") return teamPhotoView();
    var list = KC.S.gallery.slice().reverse(), shown = list.slice(0, ui.galN);
    var h = '<div class="card" id="h_gal"><h3>📷 活動照片花絮（' + list.length + "）</h3>" +
      (RO(role) ? "" : '<div class="row"><input id="g_cap" placeholder="照片說明（選填）" style="flex:1;min-width:160px"><input type="file" accept="image/*" multiple data-hgal="1"></div><p class="mut">可一次選多張，會自動壓縮。請勿上傳不當或未經同意的個人照片。</p>');
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px">' + shown.map(function (g) {
      return '<figure style="margin:0;cursor:pointer" data-do="hLb" data-id="' + E(g.id) + '"><img src="' + E(g.thumb) + '" alt="' + E(g.caption || "活動照片") + '" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;border:1px solid var(--line);display:block"><figcaption class="mut" style="font-size:12px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">' + E(g.caption || "") + "</figcaption></figure>";
    }).join("") + "</div>" + (list.length ? "" : '<p class="mut">' + (RO(role) ? "目前還沒有照片" : "還沒有照片，成為第一個上傳的人吧！") + "</p>");
    if (list.length > ui.galN) h += '<div class="row"><button class="sm sec" data-do="hGalMore">顯示更多（還有 ' + (list.length - ui.galN) + " 張）</button></div>";
    var lb = ui.lb && KC.S.gallery.filter(function (g) { return g.id === ui.lb; })[0];
    if (lb) {
      var canDel = RO(role) ? false : role !== "student" ? (role === "admin" || lb.byRole === "teacher") : lb.byId === (me && me.id);
      h += '<div style="position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:60;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;gap:10px">' +
        '<img data-bph="' + E(lb.pid) + '" src="' + E(lb.thumb) + '" alt="" style="max-width:100%;max-height:74vh;border-radius:10px"><div style="color:#fff;text-align:center">' + E(lb.caption || "") + '<div style="opacity:.7;font-size:13px">' + E(lb.by) + "　" + E(lb.at) + '</div></div><div class="row"><button class="pri" data-do="hLbDl" data-id="' + E(lb.id) + '">下載</button>' + (canDel ? '<button class="dng" data-do="hDelPhoto" data-id="' + E(lb.id) + '" style="background:#fff">刪除</button>' : "") + '<button class="sec" data-do="hLbClose" style="background:#fff">關閉</button></div></div>';
    }
    return h + "</div>";
  }
  /* 靜態資料庫：活動資料夾下的 library.json（隨網站一起部署，唯讀，不佔雲端資料庫額度） */
  function loadLib(rerender) {
    if (ui.lib) return; ui.lib = { folders: [], files: [], loading: true };
    fetch("library.json", { cache: "no-cache" }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (d) {
      ui.lib = { folders: (d.folders || []).map(function (f) { return Object.assign({}, f, { id: "s:" + f.id, parent: f.parent ? "s:" + f.parent : "", st: 1 }); }),
        files: (d.files || []).map(function (f) { return Object.assign({}, f, { id: "s:" + f.id, folder: f.folder ? "s:" + f.folder : "", st: 1 }); }) };
      rerender();
    }).catch(function () { ui.lib = { folders: [], files: [] }; });
  }
  function fileView(role) {
    var S = KC.S, cur = ui.folder, canUp = role !== "student" && !RO(role), LB0 = ui.lib || { folders: [], files: [] }, HID = (S.settings.hiddenLib || []), LB = { folders: LB0.folders.filter(function (x) { return HID.indexOf(x.id) < 0; }), files: LB0.files.filter(function (x) { return HID.indexOf(x.id) < 0; }) }, AF = S.folders.concat(LB.folders), AFi = S.files.concat(LB.files);
    var chain = [], f = cur;
    while (f) { var fo = AF.filter(function (x) { return x.id === f; })[0]; if (!fo) { ui.folder = cur = ""; chain = []; break; } chain.unshift(fo); f = fo.parent; }
    var h = '<div class="card" id="h_files"><h3>🗂️ 檔案存放區</h3><div class="row" style="gap:4px"><button class="sm sec" data-do="hCd" data-id="">🏠 根目錄</button>' +
      chain.map(function (x) { return '<span class="mut">›</span><button class="sm sec" data-do="hCd" data-id="' + E(x.id) + '">' + E(x.name) + "</button>"; }).join("") + "</div>";
    if (canUp) h += '<div class="row"><input id="fo_n" placeholder="新資料夾名稱" style="width:170px"><button class="sm sec" data-do="hNewFolder">＋ 建立資料夾</button></div>' +
      '<div class="row"><input type="file" data-hfile="1"><span class="mut">單檔上限 ' + Math.round(FILE_MAX / 1024) + ' KB</span></div>' +
      '<div class="row"><input id="ln_n" placeholder="連結名稱（例：行前說明簡報）" style="flex:1;min-width:150px"><input id="ln_u" placeholder="https://（雲端硬碟等連結）" style="flex:1;min-width:150px"><button class="sm sec" data-do="hAddLink">＋ 加入連結</button></div>' +
      (role === "admin" && HID.length ? '<div class="row"><button class="sm sec" data-do="hRestoreLib">還原已刪除的內建檔案（' + HID.length + "）</button></div>" : "") +
      '<p class="mut">較大的檔案（簡報、影片、PDF）請存到雲端硬碟，再用「加入連結」放到這裡。</p>';
    var subs = AF.filter(function (x) { return (x.parent || "") === cur; }).sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    var files = AFi.filter(function (x) { return (x.folder || "") === cur; }).sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    h += '<div class="scroll"><table style="min-width:420px">' + subs.map(function (x) {
      return '<tr><td>📁 <a href="#" data-do="hCd" data-id="' + E(x.id) + '">' + E(x.name) + "</a></td><td class=\"mut\">資料夾</td><td></td><td>" + (role === "admin" ? '<button class="sm dng" data-do="hDelFolder" data-id="' + E(x.id) + '">刪除</button>' : "") + "</td></tr>";
    }).join("") + files.map(function (x) {
      var canDel = role === "admin" || (!x.st && !RO(role) && role === "teacher" && x.byRole === "teacher");
      return "<tr><td>" + (x.url ? "🔗 " : "📄 ") + (x.url ? '<a href="' + E(safeUrl(x.url)) + '" target="_blank" rel="noopener">' + E(x.name) + "</a>" : (x.path || x.pid) ? '<a href="#" data-do="hView" data-id="' + E(x.id) + '">' + E(x.name) + "</a>" : E(x.name)) + '</td><td class="mut">' + (x.url ? "連結" : fmtSize(x.size || 0)) + '</td><td class="mut">' + E(x.by) + "<br>" + E(String(x.at).slice(0, 10)) + "</td><td>" + ((x.path || x.pid) ? '<button class="sm sec" data-do="hDl" data-id="' + E(x.id) + '">下載</button> ' : "") + (canDel ? '<button class="sm dng" data-do="hDelFile" data-id="' + E(x.id) + '">刪除</button>' : "") + "</td></tr>";
    }).join("") + (subs.length + files.length ? "" : '<tr><td colspan="4" class="mut">這個資料夾是空的</td></tr>') + "</table></div></div>";
    return h;
  }
  function hubView(role, me) {
    loadWx(false, function () { KCH._r && KCH._r(); }); loadLib(function () { KCH._r && KCH._r(); });
    return '<div class="row" style="gap:6px">' + [["h_rem", "提醒"], ["h_note", "公告"], ["h_wx", "天氣"]].concat(RO(role) ? [] : [["h_crew", "幹部"]]).concat([["h_gal", window.ACT === "g10" ? "行前訓練花絮" : "花絮"], ["h_files", "檔案"]]).map(function (x) { return '<a class="sm" href="#' + x[0] + '" style="text-decoration:none">' + x[1] + (KC.secBadge ? KC.secBadge(x[0]) : "") + "</a>"; }).join("") + "</div>" +
      remView(role) + noteView(role, me) + wxView(role) + crewView(role, me) + galView(role, me) + fileView(role);
  }

  /* ---------- 掛載與事件 ---------- */
  KCH.mount = function (role, c) {
    KCH._r = function () { if (document.querySelector('[data-t="hub"].on')) c.render(); };
    c.TABS.unshift(["hub", "🏠 首頁"]); c.V.hub = function () { return hubView(role, c.me()); };
    var who = function () { var m = c.me(); return role === "student" ? { by: m.name, id: m.id, role: "student" } : { by: role === "teacher" ? "老師" : "行政", id: "", role: role }; };
    var H = {
      hAddRem: function () { var t = $("rm_t").value.trim(); if (!t) return alert("請輸入提醒標題"); KC.S.reminders.push({ id: KC.uid(), title: t, body: $("rm_b").value.trim(), date: $("rm_d").value, level: $("rm_l").value, pinned: false, at: stamp() }); c.done(); },
      hDelRem: function (d) { KC.S.reminders = KC.S.reminders.filter(function (r) { return r.id !== d.id; }); c.done(); },
      hPinRem: function (d) { var r = KC.S.reminders.filter(function (x) { return x.id === d.id; })[0]; if (r) r.pinned = !r.pinned; c.done(); },
      hAddNote: function () { var t = $("hn_t").value.trim(); if (!t) return; KC.S.notices.push({ id: KC.uid(), text: t, team: "", at: stamp() }); c.done(); },
      hDelNote: function (d) { KC.S.notices = KC.S.notices.filter(function (n) { return n.id !== d.id; }); c.done(); },
      hMoreNote: function () { ui.showAllNotes = !ui.showAllNotes; c.render(); },
      hWxRefresh: function () { loadWx(true, c.render); c.render(); },
      hWxEdit: function () { ui.editWx = !ui.editWx; c.render(); },
      hWxPre: function (d, el) { var p = PRESETS[+el.value]; if (!p) return; $("wx_n").value = p[0]; $("wx_la").value = p[1]; $("wx_lo").value = p[2]; },
      hWxSave: function () {
        var la = parseFloat($("wx_la").value), lo = parseFloat($("wx_lo").value);
        if (isNaN(la) || isNaN(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return alert("請輸入正確的緯度與經度");
        KC.S.settings.weather = { name: $("wx_n").value.trim() || "預報地點", lat: la, lng: lo }; ui.wx = null; ui.editWx = false; c.done();
      },
      hLb: function (d) { ui.lb = d.id; c.render(); },
      hLbClose: function () { ui.lb = null; c.render(); },
      hGalMore: function () { ui.galN += 12; c.render(); },
      hLbDl: function (d) { var g = KC.S.gallery.filter(function (x) { return x.id === d.id; })[0]; if (!g) return; KCH.get(g.pid).then(function (u) { dl(u || g.thumb, (g.caption || "photo") + ".jpg"); }); },
      hDelPhoto: function (d) { if (!confirm("刪除這張照片？")) return; var g = KC.S.gallery.filter(function (x) { return x.id === d.id; })[0]; if (g) KCH.del(g.pid); KC.S.gallery = KC.S.gallery.filter(function (x) { return x.id !== d.id; }); ui.lb = null; c.done(); },
      hCd: function (d, el, ev) { if (ev) ev.preventDefault(); ui.folder = d.id || ""; c.render(); },
      hNewFolder: function () { var n = $("fo_n").value.trim(); if (!n) return alert("請輸入資料夾名稱"); if (KC.S.folders.some(function (x) { return (x.parent || "") === ui.folder && x.name === n; })) return alert("這裡已有同名資料夾"); KC.S.folders.push({ id: KC.uid(), name: n, parent: ui.folder, by: who().by, at: stamp() }); c.done(); },
      hDelFolder: function (d) {
        if (/^s:/.test(d.id)) { if (!confirm("刪除此內建資料夾（含其中檔案）？之後可按「還原已刪除的內建檔案」找回")) return; var LBx = ui.lib || { folders: [], files: [] }, hl = KC.S.settings.hiddenLib = KC.S.settings.hiddenLib || [], ids2 = [d.id], g2 = true; while (g2) { g2 = false; LBx.folders.forEach(function (f) { if (ids2.indexOf(f.parent) >= 0 && ids2.indexOf(f.id) < 0) { ids2.push(f.id); g2 = true; } }); } ids2.forEach(function (i) { hl.push(i); }); LBx.files.forEach(function (f) { if (ids2.indexOf(f.folder) >= 0) hl.push(f.id); }); return c.done(); }
        var S = KC.S, ids = [d.id], grew = true;
        while (grew) { grew = false; S.folders.forEach(function (f) { if (ids.indexOf(f.parent) >= 0 && ids.indexOf(f.id) < 0) { ids.push(f.id); grew = true; } }); }
        var fs = S.files.filter(function (f) { return ids.indexOf(f.folder) >= 0; });
        if (!confirm("刪除此資料夾" + (ids.length > 1 || fs.length ? "，連同其中 " + (ids.length - 1) + " 個子資料夾與 " + fs.length + " 個檔案" : "") + "？此動作無法復原")) return;
        fs.forEach(function (f) { if (f.pid) KCH.del(f.pid); });
        S.files = S.files.filter(function (f) { return ids.indexOf(f.folder) < 0; }); S.folders = S.folders.filter(function (f) { return ids.indexOf(f.id) < 0; }); c.done();
      },
      hAddLink: function () { var n = $("ln_n").value.trim(), u = $("ln_u").value.trim(); if (!n || !safeUrl(u)) return alert("請輸入名稱與以 http:// 或 https:// 開頭的連結"); KC.S.files.push({ id: KC.uid(), name: n, folder: ui.folder, url: u, by: who().by, byRole: role, at: stamp() }); c.done(); },
      hTpView: function (d) { if (window.KCD && KCD.showPhoto) KCD.showPhoto(d.pid, d.th); },
      hView: function (d, el, ev) {
        if (ev) ev.preventDefault();
        var f = KC.S.files.filter(function (x) { return x.id === d.id; })[0] || ((ui.lib && ui.lib.files) || []).filter(function (x) { return x.id === d.id; })[0]; if (!f) return;
        var ext = (f.name.split(".").pop() || "").toLowerCase(), MT = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", txt: "text/plain", csv: "text/plain", md: "text/plain", mp4: "video/mp4", mp3: "audio/mpeg", m4a: "audio/mp4" }, mt = MT[ext];
        var src = f.path ? Promise.resolve(f.path) : KCH.get(f.pid);
        src.then(function (u) {
          if (!u) return alert("找不到檔案內容");
          var o = document.createElement("div"); o.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:80;display:flex;flex-direction:column;padding:10px;gap:8px";
          var bar = '<div style="display:flex;gap:8px;align-items:center;color:#fff"><b style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + E(f.name) + '</b><button class="sm" data-a="dl">下載</button><button class="sm" data-a="x">✕ 關閉</button></div>';
          o.innerHTML = bar + '<div data-a="body" style="flex:1;min-height:0;background:#fff;border-radius:10px;overflow:auto;display:flex;align-items:center;justify-content:center"></div>';
          document.body.appendChild(o); var bd = o.querySelector("[data-a=body]");
          o.addEventListener("click", function (e) { var a = e.target.getAttribute && e.target.getAttribute("data-a"); if (a === "x") o.remove(); else if (a === "dl") dl(u, f.name); });
          function show(url) {
            if (!mt) { bd.innerHTML = '<p style="padding:20px;text-align:center">此檔案格式（.' + E(ext) + '）無法在頁面內直接預覽，請按右上角「下載」用手機或電腦開啟。</p>'; }
            else if (mt.indexOf("image/") === 0) bd.innerHTML = '<img src="' + url + '" style="max-width:100%;max-height:100%">';
            else if (mt === "application/pdf") { bd.style.display = "block"; bd.innerHTML = '<iframe src="' + url + '" style="width:100%;height:100%;border:0"></iframe>'; }
            else if (mt === "text/plain") { fetch(url).then(function (r) { return r.text(); }).then(function (t) { bd.style.display = "block"; bd.innerHTML = '<pre style="white-space:pre-wrap;padding:12px;margin:0;text-align:left;color:#222"></pre>'; bd.firstChild.textContent = t; }); }
            else if (mt.indexOf("video/") === 0) bd.innerHTML = '<video src="' + url + '" controls style="max-width:100%;max-height:100%"></video>';
            else bd.innerHTML = '<audio src="' + url + '" controls></audio>';
          }
          if (u.indexOf("data:") === 0) fetch(u).then(function (r) { return r.blob(); }).then(function (b) { show(URL.createObjectURL(b)); }); else show(u);
        });
      },
      hDl: function (d, el, ev) { if (ev) ev.preventDefault(); var f = KC.S.files.filter(function (x) { return x.id === d.id; })[0] || ((ui.lib && ui.lib.files) || []).filter(function (x) { return x.id === d.id; })[0]; if (!f) return; (f.path ? Promise.resolve(f.path) : KCH.get(f.pid)).then(function (u) { if (!u) return alert("找不到檔案內容"); dl(u, f.name); }); },
      hRestoreLib: function () { if (!confirm("還原所有已刪除的內建檔案與資料夾？")) return; KC.S.settings.hiddenLib = []; c.done(); },
      hDelFile: function (d) { if (!confirm("刪除此檔案？")) return; if (/^s:/.test(d.id)) { var hl = KC.S.settings.hiddenLib = KC.S.settings.hiddenLib || []; hl.push(d.id); return c.done(); } var f = KC.S.files.filter(function (x) { return x.id === d.id; })[0]; if (f && f.pid) KCH.del(f.pid); KC.S.files = KC.S.files.filter(function (x) { return x.id !== d.id; }); c.done(); }
    };
    function dl(url, name) { var a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
    Object.keys(H).forEach(function (k) { c.H[k] = H[k]; });
    document.addEventListener("click", function (e) { var t = e.target.closest("a[data-do]"); if (t && H[t.dataset.do]) e.preventDefault(); });
    document.addEventListener("change", function (e) {
      var t = e.target; if (!t.files || !t.files.length) return;
      if (t.dataset.hgal) {
        var files = [].slice.call(t.files), cap = ($("g_cap") || {}).value || "", me = who(), ok = [], bad = 0;
        t.disabled = true;
        Promise.all(files.map(function (f) {
          if (!/^image\//.test(f.type)) { bad++; return null; }
          return Promise.all([shrink(f, 1280, 0.7), shrink(f, 320, 0.6)]).then(function (r) {
            var id = KC.uid(), pid = "g|" + id;
            return KCH.put(pid, r[0]).then(function () { ok.push({ id: id, pid: pid, thumb: r[1], caption: cap.trim(), by: me.by, byId: me.id, byRole: me.role, at: stamp() }); });
          }).catch(function () { bad++; });
        })).then(function () { c.sync(); ok.forEach(function (g) { KC.S.gallery.push(g); }); c.done(); if (bad) alert(bad + " 個檔案無法上傳（非圖片或讀取失敗）"); });
      }
      if (t.dataset.hfile) {
        var f = t.files[0]; if (f.size > FILE_MAX) { t.value = ""; return alert("檔案超過 " + Math.round(FILE_MAX / 1024) + " KB，請改存雲端硬碟再用「加入連結」"); }
        var me2 = who(); readURL(f).then(function (u) { var id = KC.uid(), pid = "f|" + id; return KCH.put(pid, u).then(function () { c.sync(); KC.S.files.push({ id: id, pid: pid, name: f.name, folder: ui.folder, size: f.size, by: me2.by, byRole: role, at: stamp() }); c.done(); }); }).catch(function () { alert("檔案上傳失敗，請重試"); });
      }
    });
  };
  KCH.post = function (root) {
    [].forEach.call(root.querySelectorAll("img[data-bph]"), function (im) { KCH.get(im.dataset.bph).then(function (d) { if (d && im.isConnected) im.src = d; }); });
  };
  w.KCH = KCH;
})(window);
