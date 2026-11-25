/* 行前訓練請假及補訓申請（僅 G8 圓夢合歡、G10 單車環臺）
   資料存在 leaves 集合（kind:"pt"），已核准者仍會自動帶入點名「請假」。 */
var KCP = (function () {
  var E = KC.esc;
  var CONF = {
    g8a: {
      title: "「築夢康橋圓夢合歡群峰」山訓請假及補訓申請",
      sub: "Pre-training Leave & Make-up Application",
      noun: "山訓", n: 6,
      req: ["6K，250M", "6K，250M", "8K，250M", "8K，250M", "10K，250M", "13K，250M"],
      types: [
        ["公假", "例：因校隊訓練、代表學校參與比賽等"],
        ["傷病假（事先）", "例：因已知個人疾病或傷勢等"],
        ["事假", "例：處理其他個人事務"],
        ["活動當日臨時傷病假（事後）", "例：因身體因素當天無法出席者"]
      ],
      rules: [
        "公假、傷病假（事先）、事假皆需提早一週前至活動組完成補訓申請，並繳交相關證明。",
        "活動當日臨時傷病假請於活動後一週內完成補訓申請，並繳交診斷證明。",
        "未於期限內完成者，將酌扣小隊分數（1 分）。",
        "無法參與公辦山訓者，登山證書將不登錄該次山訓紀錄。",
        "請事假者，需另外於社團時間，進入登山社體能加強。",
        "因故（含傷病）多次未能參與行前訓練者，列入預警名單，依審議會決議參與活動資格。"
      ],
      other: "參加其他公辦山訓場次（無法出席原時段山訓者，另擇他日出席）",
      self: "自行補訓（利用假日完成，並上傳佐證資料）",
      selfHelp: "需將個人補訓心得及照片（含登山口、登頂照、當日報紙或清楚證明時間日期方法、APP 移動路徑、時間、高度變化等相關截圖之佐證資料），上傳 Google Drive「圓夢合歡群峰」的補訓資料夾內。檔名：班級-姓名-標題（請參閱登山手冊 P.12）。須符合請假當次訓練對應公里數及高程差 250M（起點到登頂點垂直落差）。",
      proofLabel: "佐證資料連結／檔名（Google Drive）",
      lateHint: "逾期：依規定酌扣小隊分數 1 分",
      signs: [["parent", "家長簽名"], ["teacher", "導師簽名"], ["lead", "帶隊老師或承辦單位簽名（公假者必填）"]],
      leadOnly: "公假", selfDays: 0
    },
    g10: {
      title: "「築夢康橋壯遊臺灣」行前訓練請假及補訓申請",
      sub: "Pre-training Leave & Make-up Application",
      noun: "行前訓練", n: 6,
      req: ["單日騎乘 70 公里", "單日騎乘 70 公里", "單日騎乘 70 公里", "單日騎乘 70 公里", "單日騎乘 70 公里", "單日騎乘 70 公里"],
      types: [
        ["公假", "例：因校隊訓練、代表學校參與比賽等"],
        ["傷病假（事先）", "例：因已知個人疾病或傷勢等"],
        ["事假", "例：處理其他個人事務、考試等"],
        ["活動當日臨時傷病假（事後）", "例：因身體因素當天無法出席者"]
      ],
      rules: [
        "公假、傷病假（事先）、事假皆需提早一週前至活動組完成申請，並檢附相關證明文件（如：醫師證明、考試證明…等）。",
        "活動當日臨時傷病假請於活動後一週內完成申請，並繳交診斷證明。",
        "補訓須於請假後一個月內，自行利用非上課日、非行前訓練之時間完成單車騎乘補訓。",
        "單日里程須達 70 公里，並以 Strava 記錄路徑，檢附路線及里程紀錄、當日出發前與完成後照片各一張（本人須入鏡、清楚辨識、無濾鏡），電子檔即可。",
        "與活動組約定補訓時間後，二週內未完成上傳者，將暫停當週社團活動；須至體育館進行飛輪訓練，並再次約定時間完成補訓。",
        "無故缺席行前訓練者，將由委員會審議是否具備參與活動資格；委員會有權基於安全與準備度，決議禁止其參與本次活動。"
      ],
      other: "參加其他公辦行前訓練場次（另擇他日出席）",
      self: "自行補訓（單日 70 公里，Strava 記錄）",
      selfHelp: "請於非上課日、非行前訓練時間騎乘，單日里程須達 70 公里；以 Strava 記錄補訓路徑，並檢附路線及里程紀錄、出發前與完成後照片各一張（本人入鏡、無濾鏡）。與活動組約定補訓時間後，二週內須完成上傳。",
      proofLabel: "Strava 活動連結／上傳說明",
      lateHint: "逾期：暫停當週社團活動，改至體育館飛輪訓練",
      signs: [["parent", "家長簽名"], ["teacher", "導師簽名"], ["lead", "帶隊老師或承辦單位簽名（公假者必填）"]],
      leadOnly: "公假", selfDays: 30
    }
  };
  var C = CONF[KC.id];
  var draft = {};

  function addDays(d, n) { var x = new Date(d + "T00:00:00"); x.setDate(x.getDate() + n); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); }
  function badge(t, c) { return '<span class="b ' + c + '">' + E(t) + "</span>"; }
  function isPT(l) { return l.kind === "pt"; }
  function stBadge(l) { return l.status === "approved" ? badge("已核准・請假完成", "ok") : l.status === "rejected" ? badge("已退回", "no") : isPT(l) && !l.img ? badge("待上傳簽名紙本", "no") : badge("待行政審核", "wn"); }
  function sessDate(n) {
    if (!n) return "";
    var f = function () { return KC.S.sessions.filter(function (x) { return x.id === "pt" + n || (x.title && x.title.replace(/\s/g, "").indexOf("第" + n + "次") >= 0); })[0]; }, x = f();
    if (!x && window.KCD && KCD.ensureSessions) { try { KCD.ensureSessions(); } catch (e) {} x = f(); }
    return x ? x.date : "";
  }
  function reqDocs(l) {
    var post = /事後/.test(l.type), a = [
      { k: "paper", label: "簽名後的紙本請假申請單（家長、導師" + (l.type === C.leadOnly ? "、帶隊老師" : "") + "簽名）", have: !!l.img, req: true },
      { k: "docs", label: post ? "診斷證明" : "相關證明文件（醫師證明、考試證明、公假證明等）", have: (l.docs || []).length > 0, req: true }];
    if (l.mode === "self") a.push({ k: "rec", label: "補訓紀錄（Strava 路線與里程、出發前與完成後照片）", have: (l.rec || []).length > 0, req: false });
    return a;
  }
  function docState(l, d) { return l.ok && l.ok[d.k] ? badge("已核准", "ok") : d.have ? badge("已上傳，待審", "wn") : badge(d.req ? "尚未繳交" : "尚未繳交（補訓完成前）", "no"); }
  function docRows(l, admin) {
    return '<div style="margin-top:6px"><b>應繳文件</b>' + reqDocs(l).map(function (d) {
      var view = d.k === "paper" ? (d.have ? '<a href="#" data-do="ptView" data-id="' + l.id + '">檢視</a>' : "") : (l[d.k] || []).map(function (it, i) { return '<a href="#" data-do="ptAttView" data-id="' + l.id + '" data-k="' + d.k + '" data-i="' + i + '">📎' + E(it.name) + "</a>"; }).join(" ");
      return '<div style="margin:3px 0">' + (d.have ? "✔ " : "✘ ") + E(d.label) + "　" + docState(l, d) + "　" + view +
        (admin && d.have ? ' <button class="sm ' + (l.ok && l.ok[d.k] ? "sec" : "pri") + '" data-do="ptDocOk" data-id="' + l.id + '" data-k="' + d.k + '">' + (l.ok && l.ok[d.k] ? "取消核准" : "核准此文件") + "</button>" : "") + "</div>";
    }).join("") + "</div>";
  }
  function teamName(t) { var x = KC.team(t); return x ? x.name : (t || ""); }
  function mkLine(l, admin) {
    if (l.mode !== "other") return "";
    var h = "<br>🏁 補訓場次：<b>" + (l.mk ? "第 " + l.mk + " 次" + (l.mdate ? "（" + E(l.mdate) + "）" : "") : "尚未選擇") + "</b>　" + (l.assign ? badge("已派發至 " + teamName(l.assign), "ok") : badge(l.status === "approved" ? "等待行政端派發小隊" : "請假核准後由行政端派發小隊", "wn"));
    if (admin && l.status === "approved" && l.mk) h += '<br><select data-do="ptAssign" data-id="' + l.id + '"><option value="">（選擇要派發的小隊）</option>' + KC.S.teams.map(function (t) { return '<option value="' + t.id + '"' + (l.assign === t.id ? " selected" : "") + ">" + E(t.name) + "</option>"; }).join("") + "</select>";
    return h;
  }
  var DOCKIND = { docs: "證明文件", rec: "補訓紀錄" };
  function attList(l, k, edit) {
    var L = l[k] || [];
    return L.map(function (it, i) { return '<span style="display:inline-block;margin:2px 8px 2px 0">📎 <a href="#" data-do="ptAttView" data-id="' + l.id + '" data-k="' + k + '" data-i="' + i + '">' + E(it.name) + "</a>" + (edit ? ' <a href="#" data-do="ptAttDel" data-id="' + l.id + '" data-k="' + k + '" data-i="' + i + '" style="color:var(--no)">✕</a>' : "") + "</span>"; }).join("") || '<span class="mut">尚未上傳</span>';
  }
  function attBlock(l, k, hint) {
    return '<div style="margin-top:6px"><b>' + DOCKIND[k] + "</b>" + (hint ? '<span class="mut">（' + E(hint) + "）</span>" : "") + "<br>" + attList(l, k, true) +
      '<br><label class="sm sec" style="display:inline-block;cursor:pointer;padding:5px 10px;border-radius:8px;margin-top:4px">＋ 上傳' + DOCKIND[k] + '（圖片或 PDF，可多次補傳）<input type="file" accept="image/*,application/pdf" data-do="ptAtt" data-k="' + k + '" data-id="' + l.id + '" style="display:none"></label></div>';
  }
  function mkText(l) {
    if (l.mode === "other") return "參加其他公辦場次" + (l.mk ? "：第 " + l.mk + " 次" : "") + (l.mdate ? "（" + l.mdate + "）" : "（尚未選擇）");
    if (l.mode === "self") return "自行補訓，預計 " + (l.mdate || "（日期未填）") + " 完成";
    return "—";
  }
  function doneBadge(l) { return l.status !== "approved" ? "" : l.done ? badge("補訓完成", "ok") : l.proof ? badge("佐證已送，待確認", "wn") : badge("補訓未完成", "no"); }
  function dealine(l) { return C.selfDays && l.mode === "self" ? "（期限 " + addDays(l.date, C.selfDays) + "）" : ""; }
  function lateOf(type, tdate, today) {
    if (/事後/.test(type)) return today > addDays(tdate, 7);
    return today > addDays(tdate, -7);
  }
  function signTxt(l) {
    return C.signs.map(function (s) { return s[1].slice(0, 4) + (l.sign && l.sign[s[0]] ? "✔" : "✘"); }).join(" ");
  }

  /* ---------- 學生端 ---------- */
  function sessOpts(sel, skip) {
    var o = ""; for (var i = 1; i <= C.n; i++) { if (i === +skip) continue; var d = sessDate(i); o += '<option value="' + i + '"' + (String(sel || "") === String(i) ? " selected" : "") + ">第 " + i + " 次" + (d ? "（" + d + "）" : "") + "</option>"; } return o;
  }
  function studentView(ctx) {
    var me = ctx.me(), S = KC.S, t = KC.team(me.team);
    var mine = S.leaves.filter(function (l) { return l.sid === me.id; }).reverse();
    var d = draft;
    var rows = mine.map(function (l) {
      var extra = "";
      if (isPT(l) && l.status === "approved" && l.mode === "self" && !l.done) {
        extra = '<div class="row"><input id="pf_' + l.id + '" placeholder="' + E(C.proofLabel) + '" value="' + E(l.proof || "") + '" style="flex:1;min-width:180px"><button class="sm pri" data-do="ptProof" data-id="' + l.id + '">送出補訓佐證</button></div>';
      }
      return '<div class="nt"><b>' + (isPT(l) ? "第 " + l.n + " 次" + C.noun + "　" : "") + E(l.date) + "</b>　" + E(l.type) + "　" + stBadge(l) + " " + (l.late ? badge("逾期申請", "no") : "") + " " + doneBadge(l) +
        "<br>" + E(l.reason) + (isPT(l) ? '<br><span class="mut">補訓：' + E(mkText(l)) + dealine(l) + "　簽名：" + E(signTxt(l)) + "</span>" : "") +
        (l.note ? '<br><span class="mut">老師備註：' + E(l.note) + "</span>" : "") + extra +
        (isPT(l) ? docRows(l, false) + mkLine(l, false) + attBlock(l, "docs", /^(公假|傷病假（事先）)/.test(l.type) ? "此假別需附證明文件，可事後補傳" : "診斷／考試等證明，可選擇附上") +
          (l.mode === "self" ? attBlock(l, "rec", "Strava 紀錄、路線里程、出發前與完成後照片") : l.mode === "other" ? '<div style="margin-top:6px"><b>補訓場次</b> <select data-do="ptMkSet" data-id="' + l.id + '"><option value="">請選擇</option>' + sessOpts(l.mk, l.n) + "</select></div>" : "") : "") +
        '<div class="row">' + (isPT(l) ? '<button class="sm sec" data-do="ptPrint" data-id="' + l.id + '">列印申請單</button>' : "") +
        (isPT(l) && l.img ? '<button class="sm sec" data-do="ptView" data-id="' + l.id + '">看已上傳的申請單</button>' : "") +
        (isPT(l) && l.status !== "approved" ? '<label class="sm pri" style="display:inline-block;cursor:pointer;padding:6px 10px;border-radius:8px">' + (l.img ? "重新上傳紙本" : "📷 上傳簽名後的紙本申請單") + '<input type="file" accept="image/*" data-do="ptUp" data-id="' + l.id + '" style="display:none"></label>' : "") +
        (l.status === "pending" ? '<button class="sm dng" data-do="cancel" data-id="' + l.id + '">撤回</button>' : "") + "</div></div>";
    }).join("") || '<p class="mut">尚無紀錄</p>';
    var nopts = ""; for (var i = 1; i <= C.n; i++) nopts += '<option value="' + i + '"' + (String(d.n || "") === String(i) ? " selected" : "") + ">第 " + i + " 次（" + E(C.req[i - 1]) + "）" + (sessDate(i) ? " " + sessDate(i) : "") + "</option>";
    var tp = C.types.map(function (x) {
      return '<label class="ptr" style="display:block;margin:6px 0"><input type="radio" name="pt_type" value="' + E(x[0]) + '"' + (d.type === x[0] ? " checked" : "") + "> <b>" + E(x[0]) + '</b> <span class="mut">' + E(x[1]) + "</span></label>";
    }).join("");
    var sg = C.signs.map(function (s) { return '<label style="display:block;margin:4px 0"><input type="checkbox" name="pt_sign" value="' + s[0] + '"' + (d["s_" + s[0]] ? " checked" : "") + "> 已取得" + E(s[1]) + "（紙本）</label>"; }).join("");
    return '<div class="card"><h3>' + E(C.title) + '</h3><p class="mut">' + E(C.sub) + '</p>' +
      '<div class="row"><span>班級：<b>' + E(me.cls) + "</b></span><span>" + KC.cfg.unit + "：<b>" + (t ? E(t.name) : "—") + "</b></span><span>姓名：<b>" + E(me.name) + "</b></span><span>學號：<b>" + E(me.id) + "</b></span></div>" +
      '<div id="ptf"><div class="row"><label style="margin:0">請假場次 <select id="pt_n"><option value="">請選擇</option>' + nopts + '</select></label></div>' +
      "<label>事由（擇一）</label>" + tp +
      '<textarea id="pt_r" placeholder="請說明事由內容">' + E(d.reason || "") + "</textarea>" +
      "<label>補訓方式（擇一）</label>" +
      '<p style="margin:6px 0"><b>' + E(C.self) + "</b></p>" +
      '<div style="margin:0 0 6px 24px"><label style="margin:0">與活動組約定的補訓日期 <input type="date" id="pt_m" value="' + E(d.mdate || "") + '"></label></div>' +
      '<p class="mut" style="margin:6px 0">📎 證明文件（公假／傷病假）與自行補訓的 Strava 紀錄，<b>送出申請後</b>在下方「我的申請紀錄」中上傳，可隨時補傳、更換，不影響申請送出。</p>' +
      '<p class="mut" style="margin:6px 0">' + E(C.selfHelp) + "</p>" +
      "<label>簽名確認</label>" + sg + "</div>" +
      '<h4>請假規定說明</h4><ol class="mut" style="margin:4px 0 8px 18px;padding:0">' + C.rules.map(function (r) { return "<li>" + E(r) + "</li>"; }).join("") + "</ol>" +
      '<div class="row"><button class="pri" data-do="ptSubmit">送出申請</button></div></div>' +
      '<div class="card"><h3>我的申請紀錄</h3>' + rows + "</div>";
  }

  function readForm() {
    var g = function (i) { var e = document.getElementById(i); return e ? e.value : ""; };
    var ty = document.querySelector("input[name=pt_type]:checked"), md = document.querySelector("input[name=pt_mode]:checked");
    var sg = {}; Array.prototype.forEach.call(document.querySelectorAll("input[name=pt_sign]"), function (c) { sg[c.value] = c.checked; });
    return { n: g("pt_n"), mk: g("pt_mk"), type: ty ? ty.value : "", reason: g("pt_r").trim(), mode: md ? md.value : "", mdate: g("pt_m"),
      s_parent: sg.parent, s_teacher: sg.teacher, s_lead: sg.lead, sign: sg };
  }

  /* ---------- 審核（教師／行政） ---------- */
  function dispatchCard(all) {
    var L = all.filter(function (l) { return isPT(l) && l.mode === "other" && l.status === "approved" && !l.assign; });
    return '<div class="card"><h3>待派發補訓名單（' + L.length + '）</h3><p class="mut" style="margin:0">請假核准且選擇「參加其他公辦場次」的學生，須由行政端手動派發到該場次的某一隊；派發後會出現在該隊教師的點名名單中。</p>' +
      (L.map(function (l) { var s = KC.student(l.sid) || { name: l.sid, cls: "" }; return '<div class="nt"><b>' + E(s.cls) + " " + E(s.name) + "</b>　原請假第 " + l.n + " 次 → 補訓 <b>第 " + (l.mk || "?") + " 次" + (l.mdate ? "（" + E(l.mdate) + "）" : "") + '</b><br><select data-do="ptAssign" data-id="' + l.id + '"><option value="">（選擇要派發的小隊）</option>' + KC.S.teams.map(function (t) { return '<option value="' + t.id + '">' + E(t.name) + "</option>"; }).join("") + "</select></div>"; }).join("") || '<p class="mut">沒有待派發項目</p>') + "</div>";
  }
  function reviewView(ctx, role) {
    var S = KC.S, all = S.leaves.slice().sort(function (a, b) { return (a.at || "") < (b.at || "") ? 1 : -1; });
    var pend = all.filter(function (l) { return l.status === "pending"; });
    var ok = all.filter(function (l) { return l.status === "approved"; });
    var rej = all.filter(function (l) { return l.status === "rejected"; });
    var card = function (l, act) {
      var s = KC.student(l.sid) || { name: l.sid, cls: "" }, t = KC.team(s.team);
      var b = '<div class="nt"><b>' + E(s.cls) + " " + E(s.name) + "</b>" + (t ? '<span class="mut">（' + E(t.name) + "）</span>" : "") + "　" +
        (isPT(l) ? "第 " + l.n + " 次" + C.noun + "　" : "") + E(l.date) + "　" + E(l.type) + "　" + stBadge(l) + " " + (l.late ? badge("逾期申請", "no") : "") + " " + doneBadge(l) +
        "<br>" + E(l.reason);
      if (isPT(l)) {
        b += '<br><span class="mut">補訓：' + E(mkText(l)) + dealine(l) + "　簽名：" + E(signTxt(l)) + "　要求：" + E(C.req[l.n - 1] || "") + "</span>";
        if (l.late) b += '<br><span style="color:var(--no)">' + E(C.lateHint) + "</span>";
        if (l.proof) b += '<br>佐證：' + (/^https?:/.test(l.proof) ? '<a href="' + E(l.proof) + '" target="_blank" rel="noopener">' + E(l.proof) + "</a>" : E(l.proof));
      }
      if (isPT(l)) b += docRows(l, role === "admin") + mkLine(l, role === "admin");
      if (l.note) b += '<br><span class="mut">備註：' + E(l.note) + "</span>";
      var bt = "";
      if (isPT(l)) bt += l.img ? '<button class="sm sec" data-do="ptView" data-id="' + l.id + '">📄 看紙本申請單</button>' : "";
      if (act && l.status === "pending" && isPT(l) && !l.img) bt += '<span class="mut">學生尚未上傳簽名紙本，暫不能核准</span>';
      else if (act && l.status === "pending") bt += '<button class="sm pri" data-do="ptReview" data-id="' + l.id + '" data-v="approved">核准</button><button class="sm dng" data-do="ptReview" data-id="' + l.id + '" data-v="rejected">退回</button>';
      if (act && isPT(l) && l.mode === "self") bt += '<button class="sm sec" data-do="ptMdate" data-id="' + l.id + '">修改補訓日期</button> ';
      if (l.status === "approved" && isPT(l) && !l.done) bt += '<button class="sm pri" data-do="ptDone" data-id="' + l.id + '" data-v="1">確認補訓完成</button>';
      if (l.status === "approved" && isPT(l) && l.done) bt += '<button class="sm sec" data-do="ptDone" data-id="' + l.id + '" data-v="0">取消完成</button>';
      bt += '<button class="sm sec" data-do="ptNote" data-id="' + l.id + '">備註</button>';
      if (isPT(l)) bt += '<button class="sm sec" data-do="ptPrint" data-id="' + l.id + '">列印</button>';
      if (role === "admin") bt += '<button class="sm dng" data-do="ptDel" data-id="' + l.id + '">刪除</button>';
      return b + '<div class="row">' + bt + "</div></div>";
    };
    var todo = ok.filter(function (l) { return isPT(l) && !l.done; });
    return '<div class="card"><h3>' + E(C.noun) + "請假及補訓申請審核</h3>" +
      '<p class="mut">待審 ' + pend.length + "　已核准 " + ok.length + "（補訓未完成 " + todo.length + "）　已退回 " + rej.length + "。核准後會自動帶入該日點名為「請假」。</p>" +
      (role === "admin" ? '<div class="row"><button class="sec" data-do="ptExport">匯出申請 CSV</button></div>' : "") + "</div>" +
      (role === "admin" && all.some(function (l) { return isPT(l) && l.mode === "other"; }) ? dispatchCard(all) : "") + '<div class="card"><h3>待審（' + pend.length + "）</h3>" + (pend.map(function (l) { return card(l, true); }).join("") || '<p class="mut">沒有待審項目</p>') + "</div>" +
      '<div class="card"><h3>補訓追蹤（已核准、尚未完成 ' + todo.length + "）</h3>" + (todo.map(function (l) { return card(l, false); }).join("") || '<p class="mut">沒有待追蹤項目</p>') + "</div>" +
      '<div class="card"><h3>其他紀錄</h3>' + (ok.filter(function (l) { return !isPT(l) || l.done; }).concat(rej).map(function (l) { return card(l, false); }).join("") || '<p class="mut">尚無紀錄</p>') + "</div>";
  }

  /* ---------- 列印申請單 ---------- */
  function printForm(l) {
    var s = KC.student(l.sid) || { name: l.sid, cls: "" }, t = KC.team(s.team);
    var box = function (on) { return on ? "☑" : "□"; };
    var types = C.types.map(function (x) { var on = l.type === x[0]; return "<p>" + box(on) + " " + E(x[0]) + "：" + (on ? "<u>" + E(l.reason) + "</u>" : "________") + ' <small>(' + E(x[1]) + ")</small></p>"; }).join("");
    var h = "<!doctype html><meta charset=utf-8><title>" + E(C.title) + '</title><style>body{font:14px/1.7 "Microsoft JhengHei",sans-serif;margin:28px;color:#000}h2{text-align:center}small{color:#555}li{margin:2px 0}.sg{display:flex;gap:24px;margin-top:30px}.sg div{flex:1;border-top:1px solid #000;padding-top:4px}</style>' +
      "<h2>" + E(C.title) + "</h2><p>班級 Class：<b>" + E(s.cls) + "</b>　<b>" + E(KC.cfg.unit) + "</b>：" + (t ? E(t.name) : "") + "　姓名 Name：<b>" + E(s.name) + "</b>　學號 ID：<b>" + E(s.id) + "</b></p>" +
      "<p>※請假日期：<b>" + E(l.date) + "</b>（第 <b>" + E(l.n) + "</b> 次" + E(C.noun) + "；要求 " + E(C.req[l.n - 1] || "") + "）</p><p>※事由：</p>" + types +
      "<p>※請假規定說明：</p><ol>" + C.rules.map(function (r) { return "<li>" + E(r) + "</li>"; }).join("") + "</ol>" +
      "<p>※補訓方式：</p>" +
      "<p>" + box(l.mode === "self") + " " + E(C.self) + (l.mode === "self" ? "　預計完成日期：<u>" + E(l.mdate) + "</u>" : "　預計完成日期：______") + "</p><p><small>" + E(C.selfHelp) + "</small></p>" +
      '<div class="sg">' + C.signs.map(function (x) { return "<div>" + E(x[1]) + "：<br><br></div>"; }).join("") + "</div>" +
      "<p><small>系統申請時間：" + E((l.at || "").replace("T", " ").slice(0, 16)) + "　狀態：" + (l.status === "approved" ? "已核准" : l.status === "rejected" ? "已退回" : "待審") + "</small></p><script>window.onload=function(){window.print()}<\/script>";
    var w = window.open("", "_blank");
    if (!w) return alert("瀏覽器擋住了新視窗，請允許彈出視窗後再試");
    w.document.write(h); w.document.close();
  }

  /* ---------- 掛載 ---------- */
  function myTeam() { return window.KCW && KCW.scopeTeam ? KCW.scopeTeam("teacher") : ""; }
  function seenKey() { return "kclvn:" + KC.id + ":" + myTeam(); }
  function sig(l) { return l.id + "|" + l.status + "|" + (l.img ? 1 : 0) + "|" + (l.docs || []).length + "|" + (l.assign || "") + "|" + (l.rec || []).length; }
  function seenMap() { try { return JSON.parse(localStorage.getItem(seenKey()) || "{}"); } catch (e) { return {}; } }
  function teamLeaves() { var t = myTeam(); return KC.S.leaves.filter(function (l) { if (!isPT(l)) return false; var s = KC.student(l.sid); return s && s.team === t; }).sort(function (a, b) { return (a.at || "") < (b.at || "") ? 1 : -1; }); }
  function unread() { var m = seenMap(); return teamLeaves().filter(function (l) { return m[l.id] !== sig(l); }).length; }
  function notifView() {
    var t = myTeam(), m = seenMap(), L = teamLeaves();
    var cards = L.map(function (l) {
      var s = KC.student(l.sid) || { name: l.sid, cls: "" }, isNew = m[l.id] !== sig(l);
      return '<div class="nt">' + (isNew ? badge("新", "no") + " " : "") + "<b>" + E(s.cls) + " " + E(s.name) + "</b>　第 " + l.n + " 次" + C.noun + (l.date ? "（" + E(l.date) + "）" : "") + "　" + E(l.type) + "　" + stBadge(l) + (l.late ? " " + badge("逾期申請", "no") : "") +
        "<br>" + E(l.reason) + '<br><span class="mut">補訓：' + E(mkText(l)) + dealine(l) + "</span>" + docRows(l, false) + mkLine(l, false) + (l.note ? '<br><span class="mut">行政備註：' + E(l.note) + "</span>" : "") + '<div class="mut">申請時間：' + E((l.at || "").replace("T", " ").slice(0, 16)) + "</div></div>";
    }).join("");
    var inc = KC.S.leaves.filter(function (l) { return isPT(l) && l.mode === "other" && l.status === "approved" && l.assign === t; }).map(function (l) {
      var s = KC.student(l.sid) || { name: l.sid, cls: "" }, o = KC.team(s.team);
      return "<tr><td>" + E(s.cls) + " " + E(s.name) + "</td><td>" + E(o ? o.name : "") + "</td><td>第 " + (l.mk || "?") + " 次" + (l.mdate ? "（" + E(l.mdate) + "）" : "") + "</td></tr>";
    }).join("");
    var m2 = {}; L.forEach(function (l) { m2[l.id] = sig(l); }); try { localStorage.setItem(seenKey(), JSON.stringify(m2)); } catch (e) {}
    return '<div class="card"><h3>🔔 本小隊學生請假通知</h3><p class="mut" style="margin:0">學生送出請假申請、上傳文件或行政端審核後，這裡會更新並標示「新」。核准由行政端執行；核准後該次行前訓練點名名單會自動轉為「請假」。</p></div>' +
      '<div class="card">' + (cards || '<p class="mut">目前沒有請假申請</p>') + "</div>" +
      '<div class="card"><h3>派發到本小隊的補訓學生</h3>' + (inc ? '<div class="scroll"><table><tr><th>學生</th><th>原小隊</th><th>補訓場次</th></tr>' + inc + '</table></div><p class="mut">這些學生會出現在該場次的「點名」名單中，請一併點名。</p>' : '<p class="mut">目前沒有</p>') + "</div>";
  }
  function mount(role, ctx) {
    if (!C) return;
    if (role === "teacher" && KC.id === "g10") {
      var te = ["lvn", ""]; Object.defineProperty(te, 1, { get: function () { var n = unread(); return "🔔 請假通知" + (n ? "（" + n + "）" : ""); } });
      ctx.TABS.push(te); ctx.V.lvn = notifView;
    }
    var tb = ctx.TABS.filter(function (x) { return x[0] === "leave"; })[0];
    if (tb) tb[1] = role === "student" ? "行訓請假" : "行訓請假審核";
    ctx.V.leave = function () { return role === "student" ? studentView(ctx) : reviewView(ctx, role); };
    var H = ctx.H, find = function (id) { return KC.S.leaves.filter(function (l) { return l.id === id; })[0]; };
    H.ptSubmit = function () {
      var me = ctx.me(), f = readForm();
      draft = f;
      if (!f.n) return alert("請選擇請假場次");
      f.date = sessDate(f.n) || KC.today();
      if (!f.type) return alert("請勾選事由（假別）");
      if (!f.reason) return alert("請填寫事由說明");
      f.mode = "self";
      if (!f.mdate) return alert("請填寫與活動組約定的補訓日期");
      if (!f.sign.parent || !f.sign.teacher) return alert("請先取得家長及導師簽名（紙本），再勾選確認");
      if (f.type === C.leadOnly && !f.sign.lead) return alert("公假須有帶隊老師或承辦單位簽名");
      var today = KC.today(), late = lateOf(f.type, f.date, today);
      if (C.selfDays && f.mode === "self" && f.mdate > addDays(f.date, C.selfDays) && !confirm("自行補訓須於請假後一個月（" + addDays(f.date, C.selfDays) + "）內完成，你填的日期超過期限，仍要送出嗎？")) return;
      if (late && !confirm("依規定這份申請已逾期（" + (/事後/.test(f.type) ? "活動後一週內" : "活動前一週") + "），將標示為逾期申請，仍要送出嗎？")) return;
      KC.S.leaves.push({ id: KC.uid(), kind: "pt", sid: me.id, n: +f.n, date: f.date, type: f.type, reason: f.reason, mode: "self", mk: 0, mdate: f.mdate, docs: [], rec: [],
        sign: f.sign, late: late, status: "pending", done: false, proof: "", at: new Date().toISOString() });
      draft = {}; ctx.done(); alert("線上申請已送出。證明文件與補訓紀錄可稍後在申請紀錄中補傳。接著請：①到活動組領取（或用「列印申請單」）紙本 ②家長、導師簽名 ③回到此頁「上傳簽名後的紙本申請單」。行政端審核通過才算請假完成。");
    };
    H.ptDocOk = function (d) { var l = find(d.id); if (!l) return; l.ok = l.ok || {}; l.ok[d.k] = !l.ok[d.k]; ctx.done(); };
    H.ptAssign = function (d, el) { var l = find(d.id); if (!l) return; l.assign = el.value || ""; l.assignAt = l.assign ? new Date().toISOString() : ""; ctx.done(); };
    H.ptMkSet = function (d, el) { var l = find(d.id); if (!l) return; l.mk = +el.value || 0; l.mdate = l.mk ? sessDate(l.mk) : ""; ctx.done(); };
    H.ptAtt = function (d, el) {
      var f = el.files && el.files[0], l = find(d.id); if (!f || !l) return;
      var lim = KC.mode === "cloud" ? 600 * 1024 : 5 * 1024 * 1024, isPdf = /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name);
      var rd = function (file) { return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = rej; fr.readAsDataURL(file); }); };
      var get = isPdf ? (f.size > lim ? Promise.reject(new Error("PDF 超過 " + Math.round(lim / 1024) + " KB，請改拍照上傳或壓縮後再傳")) : rd(f)) : (window.KCD && KCD.photo ? KCD.photo(f).then(function (p) { return p.big; }) : Promise.reject(new Error("上傳功能未載入")));
      get.then(function (u) { var id = KC.uid(), pid = "pa|" + d.id + "|" + id; return KCH.put(pid, u).then(function () {
        ctx.sync(); var L = find(d.id); if (!L) return; var k = d.k; L[k] = L[k] || []; L[k].push({ id: id, pid: pid, name: f.name, mime: isPdf ? "application/pdf" : "image/jpeg", at: new Date().toISOString() }); ctx.done();
      }); }).catch(function (e) { alert("上傳失敗：" + (e && e.message || e)); });
    };
    H.ptAttDel = function (d, el, ev) { if (ev) ev.preventDefault(); var l = find(d.id); if (!l || !confirm("刪除這個檔案？")) return; var it = (l[d.k] || [])[+d.i]; if (it && it.pid) KCH.del(it.pid); (l[d.k] || []).splice(+d.i, 1); ctx.done(); };
    H.ptAttView = function (d, el, ev) {
      if (ev) ev.preventDefault(); var l = find(d.id), it = l && (l[d.k] || [])[+d.i]; if (!it) return;
      KCH.get(it.pid).then(function (u) {
        if (!u) return alert("找不到檔案內容");
        var o = document.createElement("div"); o.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:80;display:flex;flex-direction:column;padding:10px;gap:8px";
        o.innerHTML = '<div style="display:flex;gap:8px;align-items:center;color:#fff"><b style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + E(it.name) + '</b><a class="sm" data-a="dl" download="' + E(it.name) + '" style="color:#fff;border:1px solid #fff;border-radius:99px;padding:4px 12px;text-decoration:none">下載</a><button class="sm" data-a="x">✕ 關閉</button></div><div data-a="b" style="flex:1;min-height:0;background:#fff;border-radius:10px;overflow:auto;text-align:center"></div>';
        document.body.appendChild(o); o.addEventListener("click", function (e) { if (e.target.getAttribute && e.target.getAttribute("data-a") === "x") o.remove(); });
        var bd = o.querySelector("[data-a=b]"), show = function (url) { o.querySelector("[data-a=dl]").href = url; bd.innerHTML = it.mime === "application/pdf" ? '<iframe src="' + url + '" style="width:100%;height:100%;border:0"></iframe>' : '<img src="' + url + '" style="max-width:100%">'; };
        if (it.mime === "application/pdf" && u.indexOf("data:") === 0) fetch(u).then(function (r) { return r.blob(); }).then(function (b) { show(URL.createObjectURL(b)); }); else show(u);
      });
    };
    H.ptProof = function (d) {
      var l = find(d.id), e = document.getElementById("pf_" + d.id); if (!l || !e) return;
      if (!e.value.trim()) return alert("請填寫佐證連結或說明");
      l.proof = e.value.trim(); l.proofAt = new Date().toISOString(); ctx.done(); alert("已送出，待老師確認");
    };
    H.ptReview = function (d) {
      var l = find(d.id); if (!l) return;
      if (d.v === "approved" && isPT(l)) {
        if (!l.img) return alert("學生尚未上傳簽名後的紙本申請單，無法核准");
        var lack = reqDocs(l).filter(function (x) { return x.req && (!x.have || !(l.ok && l.ok[x.k])); }).map(function (x) { return x.have ? x.label + "（尚未核准）" : x.label + "（未繳）"; });
        if (lack.length && !confirm("以下文件尚未齊全／審核：\n・" + lack.join("\n・") + "\n\n仍要核准請假嗎？")) return;
      }
      if (d.v === "rejected") { var n = prompt("退回原因（選填，學生會看到）", l.note || ""); if (n === null) return; l.note = n.trim(); }
      l.status = d.v; ctx.done();
    };
    H.ptView = function (d) { var l = find(d.id); if (l && l.img && window.KCD) KCD.showPhoto(l.img.pid, l.img.thumb); };
    H.ptUp = function (d, el) {
      var f = el.files && el.files[0]; if (!f) return; if (!window.KCD || !KCD.photo) return alert("上傳功能未載入");
      KCD.photo(f).then(function (p) { var pid = "lv|" + d.id + "|" + Date.now(); return KCH.put(pid, p.big).then(function () {
        ctx.sync(); var l = find(d.id); if (!l) return; if (l.img && l.img.pid) KCH.del(l.img.pid);
        l.img = { pid: pid, thumb: p.thumb, at: new Date().toISOString() }; if (l.status === "rejected") l.status = "pending"; ctx.done(); alert("已上傳，待行政端審核。審核通過後才算請假完成。");
      }); }).catch(function (e) { alert("上傳失敗：" + (e && e.message || e)); });
    };
    H.ptMdate = function (d) { var l = find(d.id); if (!l) return; var v = prompt("補訓日期（YYYY-MM-DD）", l.mdate || ""); if (v === null) return; v = v.trim(); if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return alert("格式請用 YYYY-MM-DD"); l.mdate = v; ctx.done(); };
    H.ptDone = function (d) { var l = find(d.id); if (l) { l.done = d.v === "1"; l.doneAt = l.done ? new Date().toISOString() : ""; ctx.done(); } };
    H.ptNote = function (d) { var l = find(d.id); if (!l) return; var n = prompt("備註（學生可看到）", l.note || ""); if (n === null) return; l.note = n.trim(); ctx.done(); };
    H.ptPrint = function (d) { var l = find(d.id); if (l) printForm(l); };
    H.ptDel = function (d) { if (!confirm("確定刪除這筆申請？")) return; KC.S.leaves = KC.S.leaves.filter(function (l) { return l.id !== d.id; }); ctx.done(); };
    H.ptExport = function () {
      KC.csv(C.noun + "請假補訓申請", [["班級", "姓名", "學號", KC.cfg.unit, "場次", "請假日期", "假別", "事由", "補訓方式", "補訓日期", "逾期申請", "審核", "補訓完成", "佐證", "備註", "申請時間"]].concat(
        KC.S.leaves.map(function (l) {
          var s = KC.student(l.sid) || {}, t = KC.team(s.team);
          return [s.cls, s.name, s.id || l.sid, t ? t.name : "", isPT(l) ? "第" + l.n + "次" : "", l.date, l.type, l.reason, l.mode === "other" ? "公辦場次" : l.mode === "self" ? "自行補訓" : "", l.mdate || "",
            l.late ? "是" : "", l.status === "approved" ? "已核准" : l.status === "rejected" ? "已退回" : "待審", l.done ? "是" : "", l.proof || "", l.note || "", l.at || ""];
        })));
    };
    /* 草稿：雲端同步重繪時不遺失已填內容 */
    document.addEventListener("input", function (e) { if (e.target.closest && e.target.closest("#ptf")) draft = readForm(); });
    document.addEventListener("change", function (e) { if (e.target.closest && e.target.closest("#ptf")) draft = readForm(); });
  }
  return { mount: mount, enabled: !!C };
})();
