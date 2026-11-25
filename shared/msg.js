/* G10：給行政的留言（學生端／教師端送出，行政端回覆） */
var KCM = (function () {
  var E = KC.esc;
  if (window.ACT !== "g10") return { enabled: false };
  function who(role, ctx) {
    if (role === "student") { var m = ctx.me(); return { kind: "student", id: m.id, name: m.name, cls: m.cls, team: m.team }; }
    var t = window.KCW && KCW.scopeTeam("teacher"); var tm = KC.team(t); return { kind: "teacher", id: "teacher:" + t, name: (tm && tm.name ? tm.name : "") + " 老師", cls: "", team: t };
  }
  function nl(x) { return E(x).replace(/\n/g, "<br>"); }
  function mount(role, ctx) {
    var tabs = ctx.TABS; tabs.push(["msg", role === "admin" ? "💬 留言" : "💬 給行政留言"]);
    var H = ctx.H;
    if (role === "admin") {
      var f = "pending";
      ctx.V.msg = function () {
        var all = KC.S.msgs.slice().reverse(), list = all.filter(function (m) { return f === "all" || (f === "pending" ? !m.reply : !!m.reply); });
        return '<div class="card"><h3>💬 學生／教師留言</h3><div class="row"><select data-do="mFilter"><option value="pending"' + (f === "pending" ? " selected" : "") + ">未回覆（" + all.filter(function (m) { return !m.reply; }).length + ")</option><option value=\"done\"" + (f === "done" ? " selected" : "") + ">已回覆</option><option value=\"all\"" + (f === "all" ? " selected" : "") + ">全部</option></select></div></div>" +
          (list.map(function (m) {
            var fr = m.from || {}, t = KC.team(fr.team);
            return '<div class="card"><div class="mut">' + E(m.at) + "　<b>" + E((fr.cls || "") + " " + fr.name) + "</b>" + (fr.kind === "teacher" ? ' <span class="badge ok">教師</span>' : "") + (t && fr.kind !== "teacher" ? "　" + E(t.name) : "") + "</div><div style=\"margin:6px 0\">" + nl(m.text) + "</div>" +
              (m.reply ? '<div class="nt"><div class="mut">行政回覆　' + E(m.replyAt || "") + "</div>" + nl(m.reply) + "</div>" : "") +
              '<textarea id="mr_' + E(m.id) + '" placeholder="輸入回覆…" style="min-height:50px">' + E(m.reply || "") + '</textarea><div class="row"><button class="pri" data-do="mReply" data-id="' + E(m.id) + '">' + (m.reply ? "更新回覆" : "回覆") + '</button><button class="dng sm" data-do="mDel" data-id="' + E(m.id) + '">刪除</button></div></div>';
          }).join("") || '<div class="card"><p class="mut">沒有留言</p></div>');
      };
      H.mFilter = function (d, el) { f = el.value; ctx.render(); };
      H.mReply = function (d) { var m = KC.S.msgs.filter(function (x) { return x.id === d.id; })[0], v = document.getElementById("mr_" + d.id).value.trim(); if (!m) return; m.reply = v; m.replyAt = v ? new Date().toLocaleString("zh-TW", { hour12: false }) : ""; ctx.done(); };
      H.mDel = function (d) { if (!confirm("刪除這則留言？")) return; KC.S.msgs = KC.S.msgs.filter(function (x) { return x.id !== d.id; }); ctx.done(); };
    } else {
      ctx.V.msg = function () {
        var me = who(role, ctx), mine = KC.S.msgs.filter(function (m) { return m.from && m.from.id === me.id; }).reverse();
        return '<div class="card"><h3>💬 留言給行政</h3><p class="mut">有問題或需要協助，請在這裡留言，行政老師會在這裡回覆。</p><textarea id="mm" placeholder="請輸入留言內容"></textarea><div class="row"><button class="pri" data-do="mSend">送出留言</button></div></div>' +
          '<div class="card"><h3>我的留言紀錄</h3>' + (mine.map(function (m) {
            return '<div class="nt"><div class="mut">' + E(m.at) + "</div>" + nl(m.text) + (m.reply ? '<div style="margin-top:6px;padding:6px 10px;background:var(--okb);border-radius:8px"><b>行政回覆</b>　<span class="mut">' + E(m.replyAt || "") + "</span><br>" + nl(m.reply) + "</div>" : '<div class="mut">（等待回覆）</div>') + "</div>";
          }).join("") || '<p class="mut">尚無留言</p>') + "</div>";
      };
      H.mSend = function () { var t = document.getElementById("mm").value.trim(); if (!t) return alert("請輸入留言內容"); KC.S.msgs.push({ id: KC.uid(), from: who(role, ctx), text: t, at: new Date().toLocaleString("zh-TW", { hour12: false }), reply: "", replyAt: "" }); ctx.done(); alert("已送出"); };
    }
  }
  return { mount: mount, enabled: true };
})();
