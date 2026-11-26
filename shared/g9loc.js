/* G9 教育旅行：30 小隊（10 班 × 3 隊）編碼、小隊長帳號 GPS 位置回報、即時位置圖（行政看 30 隊／導師看自己班 3 隊） */
(function (w) {
  if (w.ACT !== "g9") return;
  var E = KC.esc, KCL = {}, CLASSES = ["901", "902", "903", "904", "9A", "9B", "9C", "9D", "9E", "9F"], map = null, lay = null, fitted = false, focus = "", st = "";
  function $(i) { return document.getElementById(i); }
  var CODES = []; CLASSES.forEach(function (c) { for (var n = 1; n <= 3; n++) CODES.push({ code: c + "-" + n, cls: c }); });
  KCL.CODES = CODES;
  function coded() { return KC.S.teams.some(function (t) { return t.code; }); }
  function seedTeams(wipe) {
    var S = KC.S; if (wipe) S.students.forEach(function (s) { if (!/^LD-/.test(s.id)) s.team = ""; });
    S.students = S.students.filter(function (s) { return !/^LD-/.test(s.id); });
    S.teams = CODES.map(function (c, i) { return { id: "t" + (i + 1), name: c.code, code: c.code, cls: c.cls, leader: "", roles: {} }; });
  }
  KCL.ensureTeams = function () { if (!KC.S.teams.length) { seedTeams(false); KC.save(); } };
  /* 小隊長以小隊編碼登入（601-1、9A-2 …）；若行政端已指定真實學生當小隊長，則登入該學生 */
  KC.codeLogin = function (raw) {
    var m = /^(90[1-4]|9[A-F])-?([1-3])$/i.exec(String(raw || "").trim()); if (!m) return "";
    var code = m[1].toUpperCase() + "-" + m[2], S = KC.reload(); KCL.ensureTeams(); S = KC.S;
    var t = S.teams.filter(function (x) { return x.code === code; })[0]; if (!t) return "";
    if (t.leader && KC.student(t.leader)) return t.leader;
    var id = "LD-" + code; S.students = S.students.filter(function (s) { return s.id !== id; });
    S.students.push({ id: id, cls: t.cls, name: code + " 小隊長", signup: { at: new Date().toISOString(), auto: 1 }, team: t.id });
    t.leader = id; t.roles = Object.assign({}, t.roles, { leader: id }); KC.save(); return id;
  };
  /* ---- 小隊長手機回報 GPS ---- */
  function startPing(c) {
    function say(t) { st = t; var e = $("g9st"); if (e) e.textContent = t; }
    function tick() {
      if (!KC.isReady) return;
      var m = c.me(), t = m && KC.team(m.team);
      if (!t || t.leader !== m.id) return say("目前登入的不是小隊長帳號，不會回報位置。");
      if (!navigator.geolocation) return say("此裝置不支援定位");
      var send = function (lat, lng, acc, why) { KC.reload(); var q = KCQ.q(); q.pings[m.team] = { t: Date.now(), lat: lat, lng: lng, acc: acc, by: m.name }; KC.save(); say(lat ? "✅ 已回報位置（" + new Date().toLocaleTimeString("zh-TW", { hour12: false }) + "，誤差約 " + Math.round(acc || 0) + " 公尺）" : "⚠️ 無法取得定位：" + (why || "請允許定位權限並開啟 GPS")); };
      navigator.geolocation.getCurrentPosition(function (p) { send(p.coords.latitude, p.coords.longitude, p.coords.accuracy); }, function (e) { send(null, null, 0, e && e.message); }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 12000 });
    }
    setTimeout(tick, 1500); setInterval(tick, 20000);
  }
  /* ---- 即時位置圖 ---- */
  function myCls(role) { try { return localStorage.getItem("kcg9cls") || ""; } catch (e) { return ""; } }
  function curCls(role) { return role === "teacher" ? myCls() : (KCL.filter || ""); }
  function visible(role) { var cl = curCls(role); return KC.S.teams.filter(function (t) { return t.code && (!cl || t.cls === cl); }); }
  function colour(age) { return age == null ? "#9aa0a6" : age < 90 ? "#2e9e5b" : age < 300 ? "#e0a21b" : "#d9534f"; }
  function ageTxt(age) { return age == null ? "未連線" : age < 90 ? "在線" : age < 3600 ? Math.round(age / 60) + " 分前" : Math.round(age / 3600) + " 小時前"; }
  function rowsHtml(role) {
    var q = KCQ.q(), now = Date.now(), ts = visible(role);
    return ts.map(function (t) {
      var p = q.pings[t.id], age = p ? Math.round((now - p.t) / 1000) : null, ld = KC.student(t.leader), sc = KCQ.score ? KCQ.score(t.id) : null;
      return "<tr><td><b>" + E(t.code) + "</b></td><td>" + E(ld ? ld.name : "—") + '</td><td><span class="badge" style="background:' + colour(age) + ';color:#fff">' + ageTxt(age) + "</span></td><td>" + (sc ? sc.aDone : "–") + '</td><td class="mut">' + (p && p.lat ? p.lat.toFixed(5) + ", " + p.lng.toFixed(5) : "—") + "</td><td>" + (p && p.lat ? '<button class="sm sec" data-lf="' + E(t.id) + '">定位</button>' : "") + "</td></tr>";
    }).join("") || '<tr><td colspan="6" class="mut">尚無小隊</td></tr>';
  }
  function mapView(role) {
    return function () {
      var h = "";
      if (role === "admin" && KC.isReady && !KC.S.teams.length) { seedTeams(false); KC.save(); }
      if (role === "admin" && !coded()) h += '<div class="card"><h3>建立 30 小隊代碼</h3><p class="mut">10 個班（901–904、9A–9F）× 3 隊，代碼如 901-1、9A-2。小隊長用代碼登入學生端，手機會自動回報 GPS 位置。</p><button class="pri" data-lseed="1">建立 30 小隊</button></div>';
      var cl = curCls(role), sel = '<select data-lcls="1">' + (role === "teacher" ? '<option value="">請選擇您的班級</option>' : '<option value="">全部 30 隊</option>') + CLASSES.map(function (c) { return '<option value="' + c + '"' + (cl === c ? " selected" : "") + ">" + (role === "teacher" ? "導師班級 " : "") + c + "</option>"; }).join("") + "</select>";
      if (role === "teacher" && !cl) return h + '<div class="card"><h3>📍 小隊即時位置</h3><p>請先選擇您的導師班級，即可看到該班 3 個小隊的位置。</p>' + sel + "</div>";
      var nOn = visible(role).filter(function (t) { var p = KCQ.q().pings[t.id]; return p && Date.now() - p.t < 90000; }).length;
      h += '<div class="card"><h3>📍 小隊即時位置' + (role === "teacher" ? "（" + E(cl) + " 班）" : "") + '</h3><div class="row">' + sel + '<button class="sec" data-do="qRefresh">立即更新</button></div>' +
        '<div id="lmap" style="height:420px;border-radius:12px;border:1px solid var(--line);background:var(--line);margin-top:8px"></div><p class="mut" id="lnote">位置來自各小隊「小隊長帳號」的手機 GPS，每 20 秒回報；本頁每 15 秒自動更新。<span style="color:#2e9e5b">●</span>在線　<span style="color:#e0a21b">●</span>5 分鐘內　<span style="color:#d9534f">●</span>逾 5 分鐘　<span style="color:#9aa0a6">●</span>未連線。目前在線 <b id="lon">' + nOn + "</b> / " + visible(role).length + " 隊。</p></div>" +
        '<div class="card"><h3>小隊連線狀態</h3><div class="scroll"><table><tr><th>小隊</th><th>小隊長</th><th>狀態</th><th>通關</th><th>最後座標</th><th></th></tr><tbody id="ltb">' + rowsHtml(role) + "</tbody></table></div></div>";
      if (role === "admin") h += '<div class="card"><h3>小隊長帳號編碼</h3><p class="mut" style="margin:0 0 6px">學生端登入頁輸入下列編碼即可（行政端若在「小隊管理」指定了真實學生為小隊長，該編碼會登入該學生）。</p><div class="scroll"><table><tr><th>編碼</th><th>班級</th><th>目前小隊長</th></tr>' + visible(role).map(function (t) { var l = KC.student(t.leader); return "<tr><td><b>" + E(t.code) + "</b></td><td>" + E(t.cls) + "</td><td>" + E(l ? l.name + (/^LD-/.test(l.id) ? "（編碼帳號）" : "") : "尚未登入過") + "</td></tr>"; }).join("") + "</table></div></div>";
      return h;
    };
  }
  var ROLE = "";
  function initMap() {
    var go = function () {
      var el = $("lmap"); if (!el || !w.L) return;
      var c = KCQ.q().cfg.center; map = w.L.map(el).setView([c.lat, c.lng], 13); lay = w.L.layerGroup().addTo(map); fitted = false;
      w.L.tileLayer("https://mt{s}.google.com/vt/lyrs=m&hl=zh-TW&gl=SG&x={x}&y={y}&z={z}", { subdomains: "0123", maxZoom: 20, attribution: "地圖資料 ©Google" }).addTo(map);
      KCQ.q().tasks.filter(function (t) { return t.active && t.useGps; }).forEach(function (t) { w.L.circleMarker([t.lat, t.lng], { radius: 5, color: "#2f6b9a", weight: 1, fillOpacity: .6 }).addTo(map).bindPopup(t.cat + t.no + " " + E(t.place || "")); });
      draw();
    };
    if (w.L) return go();
    var css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(css);
    var s = document.createElement("script"); s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; s.onload = go;
    s.onerror = function () { var n = $("lnote"); if (n) n.textContent = "地圖載入失敗（需要網路），請參考下方座標列表。"; }; document.head.appendChild(s);
  }
  function draw() {
    if (!map || !lay || !$("lmap")) return; lay.clearLayers();
    var q = KCQ.q(), now = Date.now(), pts = [];
    visible(ROLE).forEach(function (t) {
      var p = q.pings[t.id]; if (!p || !p.lat) return; var age = Math.round((now - p.t) / 1000), cl = colour(age);
      var m = w.L.circleMarker([p.lat, p.lng], { radius: 10, color: "#fff", weight: 2, fillColor: cl, fillOpacity: .95 }).addTo(lay);
      m.bindTooltip(t.code, { permanent: true, direction: "top", offset: [0, -8] }); m.bindPopup("<b>" + E(t.code) + "</b><br>" + ageTxt(age) + (p.by ? "<br>" + E(p.by) : "") + (p.acc ? "<br>誤差約 " + Math.round(p.acc) + " 公尺" : ""));
      if (focus === t.id) { m.openPopup(); }
      pts.push([p.lat, p.lng]);
    });
    if (!fitted && pts.length) { fitted = true; try { map.fitBounds(pts, { padding: [40, 40], maxZoom: 16 }); } catch (e) {} }
  }
  function refresh() {
    if (!$("lmap")) return; KC.reload();
    var tb = $("ltb"); if (tb) tb.innerHTML = rowsHtml(ROLE);
    var on = $("lon"); if (on) on.textContent = visible(ROLE).filter(function (t) { var p = KCQ.q().pings[t.id]; return p && Date.now() - p.t < 90000; }).length;
    draw();
  }
  KCL.post = function (root) { if ($("lmap")) initMap(); };
  function demoSeed() {
    var q = KCQ.q(), S = KC.S; if (!S.settings.demoSeeded || coded()) return false; S.settings.g9loc = 1;
    var keep = {}; S.students.forEach(function (s) { keep[s.id] = s.team; });
    seedTeams(false); S.students.forEach(function (s) { s.team = keep[s.id] || ""; });
    var c = q.cfg.center, ME = "DEMO01"; S.teams[0].leader = ME; S.teams[0].roles = { leader: ME };
    S.teams.forEach(function (t, i) { if (i % 7 === 6) return; var a = i * 0.65; q.pings[t.id] = { t: Date.now() - (i % 5 === 4 ? 420000 : i % 3 === 0 ? 150000 : 20000), lat: c.lat + Math.sin(a) * 0.012 * (1 + i % 4 * .3), lng: c.lng + Math.cos(a) * 0.015 * (1 + i % 3 * .3), acc: 12, by: t.code + " 小隊長" }; });
    KC.save(); return true;
  }
  KCL.mount = function (role, c) { try { mount0(role, c); } catch (e) { console.error("g9loc", e); } };
  function mount0(role, c) {
    ROLE = role;
    if (KC.demo) { var tryDemo = function () { try { return demoSeed(); } catch (e) { console.error("demoSeed", e.message); } }; if (!tryDemo()) setTimeout(function () { if (tryDemo()) { c.sync && c.sync(); c.render(); } }, 400); }
    if (role === "student") {
      startPing(c); var q0 = c.V.quest;
      c.V.quest = function () { var m = c.me(), t = m && KC.team(m.team), ld = t && t.leader === m.id; return (ld ? '<div class="card"><b>📡 您是 ' + E(t.code || t.name) + ' 小隊長</b><div id="g9st" class="mut">' + E(st || "定位準備中…") + '</div><div class="mut">請保持本頁開啟並允許定位。</div></div>' : "") + q0(); };
    } else { c.V.qmap = mapView(role); }
    document.addEventListener("change", function (e) { var t = e.target; if (!t.dataset || !t.dataset.lcls) return; if (role === "teacher") { try { localStorage.setItem("kcg9cls", t.value); } catch (x) {} } else KCL.filter = t.value; fitted = false; c.render(); });
    document.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-lf],[data-lseed]"); if (!b) return;
      if (b.dataset.lseed) { if (KC.S.teams.length && !confirm("將以 30 個小隊代碼覆蓋目前編組，確定？")) return; seedTeams(true); KC.save(); return c.render(); }
      var p = KCQ.q().pings[b.dataset.lf]; if (p && map) { focus = b.dataset.lf; map.setView([p.lat, p.lng], 17); draw(); }
    });
    setInterval(function () { if (KC.isReady) refresh(); }, 15000);
  }
  w.KCL = KCL;
})(window);
