'use strict';
var API = (new URLSearchParams(location.search).get("api")) || window.TT_API; window.TT_SHEET = window.TT_SHEET || "1Tiun8ybiPZMzb3Jv8-VEeJcvbHZc-SkFuaOYmJ8eJiU";
var SITE = location.origin + location.pathname;
var COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#14b8a6', '#ec4899', '#84cc16', '#f97316', '#64748b'];
var SHAPES = ['●', '■', '▲', '◆', '★', '⬟', '✚', '⬢', '☗', '✦'];
var PHASES = { lobby: 'Lobby', roll: 'Roll and move', decide: 'Decide', event: 'Event', payout: 'Payout', done: 'Finished' };
var $app = document.getElementById('app');
var cbn = 0;
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function api(a, extra, p) {
  return new Promise(function (res, rej) {
    var cb = 'tt' + (++cbn) + '_' + Date.now(); var q = new URLSearchParams(Object.assign({ a: a, callback: cb }, extra || {}));
    if (p) q.set('p', JSON.stringify(p));
    var s = document.createElement('script'); var to = setTimeout(function () { cl(); rej(new Error('Network timeout')); }, 25000);
    function cl() { clearTimeout(to); delete window[cb]; s.remove(); }
    window[cb] = function (d) { cl(); if (d && d.error) rej(new Error(d.error)); else res(d); };
    s.onerror = function () { cl(); rej(new Error('Network error')); };
    s.src = API + '?' + q.toString(); document.head.appendChild(s);
  });
}
function qrSvg(text, size) {
  var qr = qrcode(0, 'M'); qr.addData(text); qr.make(); var n = qr.getModuleCount(), cs = size / n, d = '';
  for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) d += 'M' + (c * cs) + ' ' + (r * cs) + 'h' + cs + 'v' + cs + 'h-' + cs + 'z';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000" transform="translate(0 0)"/></svg>';
}
function tokHtml(n, me) { return '<span class="tok' + (me ? ' me' : '') + '" style="background:' + COLORS[(n - 1) % 10] + '" title="Team ' + n + '">' + n + '</span>'; }
function bpos(pos) { // 7x7 ring, clockwise from top-left
  if (pos <= 6) return [1, pos + 1]; if (pos <= 12) return [pos - 5, 7]; if (pos <= 18) return [7, 7 - (pos - 12)]; return [7 - (pos - 18), 1];
}
function fmt(ms) { ms = Math.max(0, ms); var s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

/* ---------- polling base ---------- */
var CUR = null, OFFSET = 0, LAST = null, POLL = null, CT = null;
function remaining(v) { if (!v) return 0; if (v.paused) return v.remaining; if (!v.phaseEnd) return 0; return v.phaseEnd - (Date.now() + OFFSET); }
function startPoll(ctx, render, extra) {
  stopPoll(); CUR = ctx; var busy = false;
  function tickT() { var el = document.getElementById('timer'); if (el && LAST) { if (LAST.status !== 'playing') { el.textContent = ''; return; } var r = remaining(LAST); el.textContent = (LAST.paused ? '⏸ ' : '') + fmt(r); el.classList.toggle('low', r < 20000 && LAST.phase === 'decide'); } }
  CT = setInterval(tickT, 250);
  function one(force) {
    if (busy) return; busy = true;
    var q = Object.assign({ code: ctx.code }, ctx.auth); if (LAST && !force) q.v = LAST.v;
    api('state', q).then(function (v) {
      OFFSET = v.now - Date.now();
      if (v.same) { if (LAST && v.phaseEnd !== LAST.phaseEnd) { LAST.phaseEnd = v.phaseEnd; } } else { LAST = v; var ae = document.activeElement; if (!(ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName) && ae.dataset.keep)) render(v); }
      var e = document.getElementById('neterr'); if (e) e.remove(); busy = false; tickT();
    }).catch(function (e) {
      busy = false; if (/Session not found|Team not found|Wrong/.test(e.message)) { ctx.onFatal && ctx.onFatal(e.message); return; }
      var d = document.getElementById('neterr'); if (!d) { d = document.createElement('div'); d.id = 'neterr'; d.className = 'err'; d.style.cssText = 'position:fixed;bottom:8px;left:8px;z-index:99'; document.body.appendChild(d); } d.textContent = 'Reconnecting… (' + e.message + ')';
    });
  }
  POLL = setInterval(function () { one(false); }, 2000); one(true);
  CUR.refresh = function () { LAST = null; one(true); };
}
function stopPoll() { clearInterval(POLL); clearInterval(CT); LAST = null; }

/* ---------- landing ---------- */
function landing() {
  stopPoll(); document.body.className = '';
  var saved = JSON.parse(localStorage.getItem('tt_fac') || 'null');
  $app.innerHTML = '<div class="wrap"><h1>Transformation Tycoon</h1><p class="mut">Turn a legacy company into an AI-driven business in 8 rounds. Choose your screen.</p><div class="landing">' +
    '<div class="card"><h2>Team</h2><p class="mut">Join with the session code. No account needed.</p><input id="jc" maxlength="6" placeholder="Session code" style="text-transform:uppercase;margin-bottom:8px"><input id="jn" maxlength="24" placeholder="Team name" style="margin-bottom:8px"><button id="jb">Join game</button><div id="je"></div></div>' +
    '<div class="card"><h2>Facilitator</h2><p class="mut">Create a session and run the class.</p><button id="cb" class="go">Create new session</button><hr style="border-color:var(--line)"><p class="mut">Resume a session</p><input id="rc" maxlength="6" placeholder="Session code" style="margin-bottom:6px" value="' + (saved ? saved.code : '') + '"><input id="rk" maxlength="6" placeholder="Facilitator PIN" style="margin-bottom:6px" value="' + (saved ? saved.fk : '') + '"><button id="rb" class="sec">Resume console</button><div id="fe"></div></div>' +
    '<div class="card"><h2>Projector</h2><p class="mut">Open on the classroom screen.</p><input id="pc" maxlength="6" placeholder="Session code" style="text-transform:uppercase;margin-bottom:8px"><button id="pb" class="sec">Open projector view</button></div></div></div>';
  var pre = (location.hash.match(/join\/([A-Z0-9]+)/i) || [])[1]; if (pre) document.getElementById('jc').value = pre.toUpperCase();
  var lt = JSON.parse(localStorage.getItem('tt_team') || 'null'); if (lt && !pre) { document.getElementById('jc').value = lt.code; document.getElementById('jn').value = lt.name; }
  document.getElementById('jb').onclick = function () {
    var code = document.getElementById('jc').value.trim().toUpperCase(), name = document.getElementById('jn').value.trim();
    if (!code || !name) { document.getElementById('je').innerHTML = '<div class="err">Enter the code and a team name</div>'; return; }
    this.disabled = true; api('join', { code: code }, { name: name }).then(function (r) { localStorage.setItem('tt_team', JSON.stringify({ code: code, name: name, tok: r.tok })); location.hash = '#/team/' + code; })
      .catch(function (e) { document.getElementById('je').innerHTML = '<div class="err">' + esc(e.message) + '</div>'; document.getElementById('jb').disabled = false; });
  };
  document.getElementById('cb').onclick = function () { this.disabled = true; api('create').then(function (r) { localStorage.setItem('tt_fac', JSON.stringify(r)); location.hash = '#/console/' + r.code; }).catch(function (e) { document.getElementById('fe').innerHTML = '<div class="err">' + esc(e.message) + '</div>'; }); };
  document.getElementById('rb').onclick = function () { var c = document.getElementById('rc').value.trim().toUpperCase(), k = document.getElementById('rk').value.trim().toUpperCase(); if (!c || !k) return; localStorage.setItem('tt_fac', JSON.stringify({ code: c, fk: k })); location.hash = '#/console/' + c; };
  document.getElementById('pb').onclick = function () { var c = document.getElementById('pc').value.trim().toUpperCase(); if (c) location.hash = '#/screen/' + c; };
}

/* ---------- shared pieces ---------- */
var CONTENT = null;
function loadContent(code, fk) { return api('content', { code: code, fk: fk || '' }).then(function (c) { CONTENT = c; return c; }); }
function spaceKind(s) { return s.type === 'Use case' ? 'Use' : s.type; }
function spaceTag(s) { return { Capability: 'CAPABILITY', 'Use case': 'AI USE CASE', Event: 'EVENT', Corner: 'CORNER' }[s.type] + (s.group && s.type === 'Capability' ? ' · ' + s.group : ''); }
function boardHtml(v, opts) {
  opts = opts || {}; var me = opts.me, sel = opts.sel;
  var cells = CONTENT.board.map(function (s) {
    var rc = bpos(s.pos); var owned = me && (me.owned[s.name] || me.uc[s.name]);
    var tk = v.teams.filter(function (t) { return t.pos === s.pos; }).map(function (t) { return tokHtml(t.n, me && me.id === t.id); }).join('');
    return '<div class="cell ' + spaceKind(s) + (owned ? ' owned' : '') + (sel === s.pos ? ' sel' : '') + '" data-pos="' + s.pos + '" style="grid-area:' + rc[0] + '/' + rc[1] + '"><div class="nm">' + s.pos + '. ' + esc(s.name) + '</div><div class="tp">' + spaceTag(s) + (s.cost ? ' · ' + s.cost : '') + '</div>' + (owned ? '<span class="own">✔</span>' : '') + '<div class="tk">' + tk + '</div></div>';
  }).join('');
  return '<div class="board">' + cells + '<div class="center">' + (opts.center || '') + '</div></div>';
}
function leaderboard(v, meId) {
  var t = v.teams.slice().sort(function (a, b) { return b.value - a.value || a.n - b.n; });
  return '<table class="lb"><tr><th>#</th><th>Team</th><th>Company</th><th>Value</th>' + (v.phase === 'decide' ? '<th>Submitted</th>' : '') + '</tr>' + t.map(function (x, i) {
    return '<tr' + (meId === x.id ? ' style="background:#1f3351"' : '') + '><td>' + (i + 1) + '</td><td>' + tokHtml(x.n) + ' ' + esc(x.name) + '</td><td class="mut">' + esc(x.company) + '</td><td><b>' + x.value + '</b></td>' + (v.phase === 'decide' ? '<td>' + (x.submitted ? '✔' : '…') + '</td>' : '') + '</tr>';
  }).join('') + '</table>';
}
function phaseBar(v) {
  if (v.status === 'lobby') return 'Lobby';
  if (v.status === 'briefing') return 'Rules briefing';
  if (v.status === 'playing') return 'Round ' + v.round + ' of ' + v.totalRounds + ' · ' + (PHASES[v.phase] || v.phase);
  if (v.status === 'reveal') return 'Final reveal'; return 'Debrief';
}
var RULES_HTML = '<h2>Rules summary</h2><ul><li>8 rounds. Every team plays at the same time. Each round: roll and move, decide, event, payout.</li><li>You get your budget every round. Unspent budget carries over.</li><li>Up to <b>2 investments</b> per round. The space you landed on costs its list price. Any other space costs list price plus a 2-point consulting fee.</li><li><b>Capabilities</b> (data, cloud, talent, governance, change) are foundations. <b>AI use cases</b> earn value only when the capabilities they depend on are in place.</li><li>Use case states: <b>Live</b> (all prerequisites owned, pays every round), <b>Pilot</b> (missing something, pays nothing, goes live automatically when you buy the last prerequisite), <b>Fast-tracked</b> (launch with 1 or 2 prerequisites missing: pays now but you take a debt token for each missing one).</li><li>Without a Change Management Office, use cases pay only half.</li><li>Build a use case at list price, or buy from a vendor for 2 less. Vendor-bought use cases do not need the AI and Data Team but are exposed to vendor events.</li><li>Debt tokens cost budget every round. Buying the missing prerequisite removes the token.</li><li>Trust runs from 0 to 10. At 0, customer-facing use cases are paused.</li><li>Event cards hit teams that lack the right protection. Read the reason on your screen after each event.</li><li>The winner is the team with the highest Transformation Score after the last round. It is revealed at the end. Keep your Trust high and your debt low.</li></ul>';
function modal(html) {
  var d = document.createElement('div'); d.className = 'modal'; d.innerHTML = '<div>' + html + '<p><button class="sec" id="mclose">Close</button></p></div>'; document.body.appendChild(d);
  d.onclick = function (e) { if (e.target === d || e.target.id === 'mclose') d.remove(); }; return d;
}

/* ---------- TEAM ---------- */
var TS = { sel: null, cart: [] };
function teamView(code) {
  document.body.className = ''; var lt = JSON.parse(localStorage.getItem('tt_team') || 'null');
  if (!lt || lt.code !== code) { location.hash = '#/join/' + code; return; }
  TS = { sel: null, cart: [], round: 0 };
  loadContent(code).then(function () {
    startPoll({ code: code, auth: { tok: lt.tok }, onFatal: function (m) { stopPoll(); $app.innerHTML = '<div class="wrap"><div class="err">' + esc(m) + '</div><button onclick="location.hash=\'#/\'">Back</button></div>'; } }, renderTeam);
  }).catch(function (e) { $app.innerHTML = '<div class="wrap"><div class="err">' + esc(e.message) + '</div><button onclick="location.hash=\'#/\'">Back</button></div>'; });
}
function quoteC(me, cfg, it, first) {
  var sp = CONTENT.board[it.pos], fee = it.pos === me.pos ? 0 : cfg.consultingFee, price, miss = [];
  if (sp.type === 'Capability') price = sp.cost + fee + (sp.name === 'AI and Data Team' ? me.aiExtra : 0);
  else { var def = CONTENT.ucs[sp.name]; price = (it.mode === 'buy' ? Math.max(0, sp.cost - cfg.vendorDiscount) : sp.cost) + fee; miss = def.prereqs.filter(function (p) { return !(it.mode === 'buy' && p === 'AI and Data Team') && !me.owned[p] && !cart_has(me, it, p); }); }
  var d = 0; if (first && me.disc > 0) { d = Math.min(price, me.disc); price -= d; }
  return { sp: sp, price: price, miss: miss, fee: fee, disc: d };
}
function cart_has(me, it, p) { return false; }
function cartOwned(me) { // owned set including capabilities already in cart (cart order matters for prerequisites)
  var o = Object.assign({}, me.owned); TS.cart.forEach(function (c) { var s = CONTENT.board[c.pos]; if (s.type === 'Capability') o[s.name] = true; }); return o;
}
function renderTeam(v) {
  var me = v.me, cfg = v.cfg;
  if (TS.round !== v.round) { TS.round = v.round; TS.cart = []; }
  var canDecide = v.status === 'playing' && v.phase === 'decide' && !me.submitted && !v.paused;
  var center = '<div class="mut">' + esc(me.company) + '</div><div style="font-size:1.4em;font-weight:800">' + esc(me.name) + '</div><div>Last roll: ' + me.roll[0] + ' + ' + me.roll[1] + '</div>';
  var h = '<div class="wrap"><div class="card row"><div class="grow"><b>' + esc(me.name) + '</b> · ' + esc(me.company) + '<div class="mut">' + phaseBar(v) + '</div></div><div class="timer" id="timer"></div><button class="sec" id="rules">Rules</button><button class="sec" id="mem">Team</button></div>';
  h += '<div class="stats"><div class="stat"><b>' + me.budget + '</b><span>Budget</span></div><div class="stat"><b>' + me.trust + '/10</b><span>Trust</span></div><div class="stat"><b>' + me.debt + '</b><span>Debt tokens</span></div><div class="stat"><b>' + me.value + '</b><span>Value earned</span></div></div>';
  if (v.status === 'lobby' || v.status === 'briefing') h += '<div class="card">You are in. Waiting for the facilitator to start. Your company: <b>' + esc(me.company) + '</b>. Look at the projector for the rules.</div>';
  if (v.status === 'reveal' || v.status === 'debrief') h += '<div class="card"><h2>Game over</h2>Watch the projector for the reveal. Your final value: <b>' + me.value + '</b>.</div>';
  if (v.status === 'playing' && v.phase === 'event' && v.curEvent) { var ev = me.evs[me.evs.length - 1]; h += '<div class="card ev' + (ev && ev.hit ? ' hit' : '') + '"><b>Event: ' + esc(v.curEvent.title) + '</b><br>' + (ev ? esc(ev.text) : '') + '</div>'; }
  h += '<div class="grid2"><div>' + boardHtml(v, { me: me, sel: TS.sel, center: center }) + '<p class="mut" style="font-size:.8em">Tap a space for details. ✔ = you own it. Colour bar: blue capability, purple AI use case, orange event, teal corner.</p></div><div id="side">';
  h += sidePanel(v, canDecide);
  h += '</div></div></div>'; $app.innerHTML = h;
  document.querySelectorAll('.cell').forEach(function (c) { c.onclick = function () { TS.sel = Number(c.dataset.pos); renderTeam(LAST); }; });
  document.getElementById('rules').onclick = function () { modal(RULES_HTML); };
  document.getElementById('mem').onclick = function () { var d = modal('<h3>Team members and roles (optional)</h3><p class="mut">First names only. Used in the debrief.</p><textarea id="mt" rows="5" data-keep="1" placeholder="e.g. Asha - CEO, Ravi - CIO, Meera - CFO">' + esc(me.members) + '</textarea><p><button id="ms">Save</button></p>'); d.querySelector('#ms').onclick = function () { api('members', { code: CUR.code, tok: CUR.auth.tok }, { text: d.querySelector('#mt').value }).then(function () { d.remove(); CUR.refresh(); }); }; };
  wireSide(v, canDecide);
}
function sidePanel(v, canDecide) {
  var me = v.me, cfg = v.cfg, h = '';
  // space detail
  if (TS.sel != null) {
    var s = CONTENT.board[TS.sel]; h += '<div class="card"><h3>' + s.pos + '. ' + esc(s.name) + '</h3><div class="mut">' + spaceTag(s) + '</div>';
    if (s.type === 'Capability') {
      var unl = Object.keys(CONTENT.ucs).filter(function (n) { return CONTENT.ucs[n].prereqs.indexOf(s.name) >= 0; });
      h += '<p>List price <b>' + s.cost + '</b>' + (s.name === 'AI and Data Team' ? ' (+1 for every team that already owns it; now +' + me.aiExtra + ')' : '') + '. ' + (s.name === 'Leadership Sponsorship' ? 'Gives +1 budget every round.' : '') + '</p><p>Unlocks: ' + (unl.length ? esc(unl.join(', ')) : 'nothing directly') + '</p>' + (me.owned[s.name] ? '<p style="color:var(--ok)">✔ You own this.</p>' : '');
    } else if (s.type === 'Use case') {
      var d = CONTENT.ucs[s.name]; h += '<p>List price <b>' + s.cost + '</b> (vendor: ' + Math.max(0, s.cost - cfg.vendorDiscount) + '). Pays <b>' + d.value + '</b> per round when live' + (d.cust ? '. Customer-facing' : '') + '.</p><p>Needs: ' + d.prereqs.map(function (p) { return (me.owned[p] ? '✔ ' : '✘ ') + esc(p); }).join(', ') + '</p>' + (me.uc[s.name] ? '<p>Your state: <span class="badge b-' + me.uc[s.name].state + '">' + me.uc[s.name].state + '</span></p>' : '');
    } else if (s.type === 'Event') h += '<p>Draw an extra event card that applies only to your team (from round 2).</p>';
    else h += '<p>' + cornerText(s.name) + '</p>';
    var owned = me.owned[s.name] || me.uc[s.name];
    if (canDecide && (s.type === 'Capability' || s.type === 'Use case') && !owned) {
      var inCart = TS.cart.some(function (c) { return c.pos === s.pos; });
      h += '<button id="addc" ' + (inCart || TS.cart.length >= cfg.investmentsPerRound ? 'disabled' : '') + '>Add to this round\'s investments</button>';
    }
    h += '</div>';
  }
  // decide panel
  if (canDecide) {
    h += '<div class="card"><h3>Your investments (max ' + cfg.investmentsPerRound + ')</h3>';
    if (!TS.cart.length) h += '<p class="mut">Tap a space on the board and add it. You can also submit with no investment to keep your budget.</p>';
    var total = 0, bad = false, tmp = Object.assign({}, me, { owned: Object.assign({}, me.owned) });
    TS.cart.forEach(function (c, i) {
      var q = quoteC(tmp, cfg, c, i === 0); total += q.price; var sp = q.sp;
      h += '<div class="cart"><b>' + esc(sp.name) + '</b> <button class="sec" data-rm="' + i + '" style="float:right;padding:.2em .6em">remove</button><br>';
      if (sp.type === 'Use case') {
        h += '<label><input type="radio" name="m' + i + '" value="build" ' + (c.mode !== 'buy' ? 'checked' : '') + ' style="width:auto"> Build (' + sp.cost + ')</label> <label><input type="radio" name="m' + i + '" value="buy" ' + (c.mode === 'buy' ? 'checked' : '') + ' style="width:auto"> Buy from vendor (' + Math.max(0, sp.cost - cfg.vendorDiscount) + ')</label><br>';
        if (q.miss.length) {
          h += '<div class="mut">Missing: ' + esc(q.miss.join(', ')) + '</div><label><input type="radio" name="l' + i + '" value="pilot" ' + (c.launch !== 'fast' ? 'checked' : '') + ' style="width:auto"> Pilot: pays nothing until prerequisites are bought, no debt</label><br><label><input type="radio" name="l' + i + '" value="fast" ' + (c.launch === 'fast' ? 'checked' : '') + ' ' + (q.miss.length > 2 ? 'disabled' : '') + ' style="width:auto"> Fast-track: pays now, you take <b>' + q.miss.length + ' debt token' + (q.miss.length > 1 ? 's' : '') + '</b> (' + cfg.debtInterest + ' budget each per round)</label>' + (q.miss.length > 2 ? ' <span class="mut">(needs 2 or fewer missing)</span>' : '');
        } else h += '<div style="color:var(--ok)">All prerequisites owned: goes live.</div>';
      }
      h += '<div>Price: <b>' + q.price + '</b>' + (q.fee ? ' (includes ' + q.fee + ' consulting fee)' : '') + (q.disc ? ' (Innovation Hub -' + q.disc + ')' : '') + '</div></div>';
      if (sp.type === 'Capability') tmp.owned[sp.name] = true;
    });
    // note: prerequisites bought earlier in the cart count for the later item
    if (total > me.budget) bad = true;
    h += '<p>Total <b>' + total + '</b> of your <b>' + me.budget + '</b> budget' + (bad ? ' <span style="color:var(--bad)">- too much</span>' : '') + '</p><button class="go" id="sub" ' + (bad ? 'disabled' : '') + '>Lock in decisions</button><p class="mut">You cannot change them after locking in.</p></div>';
  } else if (v.status === 'playing' && v.phase === 'decide' && me.submitted) h += '<div class="card">✔ Decisions locked in. Waiting for the timer.</div>';
  else if (v.status === 'playing' && v.paused) h += '<div class="card">⏸ The facilitator paused the game.</div>';
  // use cases
  var ucn = Object.keys(me.uc);
  h += '<div class="card"><h3>Your AI use cases</h3>' + (ucn.length ? '<table>' + ucn.map(function (n) { var u = me.uc[n]; var paused = u.pausedUntil || (u.skip && u.skip.indexOf(v.round) >= 0 && v.phase !== 'payout'); return '<tr><td>' + esc(n) + ' <span class="mut">(' + u.mode + ')</span></td><td><span class="badge b-' + u.state + '">' + u.state.toUpperCase() + '</span>' + (u.pausedUntil ? ' <span class="badge b-paused">paused: needs ' + esc(u.pausedUntil) + '</span>' : '') + '</td><td class="mut">' + (u.missing.length ? 'missing: ' + esc(u.missing.join(', ')) : 'complete') + '</td></tr>'; }).join('') + '</table>' : '<p class="mut">None yet.</p>') + '</div>';
  // feed
  h += '<div class="card"><h3>This round</h3>' + (me.msgs.length ? '<ul style="padding-left:18px;margin:0">' + me.msgs.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' : '<p class="mut">Nothing yet.</p>') + '</div>';
  if (me.evs.length) h += '<div class="card"><h3>Event impact</h3>' + me.evs.slice().reverse().map(function (e) { return '<div class="ev' + (e.hit ? ' hit' : '') + '"><b>Round ' + e.r + ': ' + esc(e.title) + (e.personal ? ' (event space)' : '') + '</b><br>' + esc(e.text) + '</div>'; }).join('') + '</div>';
  h += '<div class="card"><h3>Leaderboard (value)</h3>' + leaderboard(v, me.id) + '</div>';
  return h;
}
function cornerText(n) { return { 'Start: New Financial Year': 'Passing or landing here: gain extra budget.', 'Regulator Audit': 'With a Responsible AI Policy you gain 1 Trust. Without one you lose 2 Trust.', 'Innovation Hub': 'Your first investment this round costs 2 less.', 'Board Review': 'With a live use case you gain 2 value. With only pilots you lose 1 Trust.' }[n] || ''; }
function wireSide(v, canDecide) {
  var a = document.getElementById('addc'); if (a) a.onclick = function () { TS.cart.push({ pos: TS.sel, mode: 'build', launch: 'pilot' }); renderTeam(LAST); };
  document.querySelectorAll('[data-rm]').forEach(function (b) { b.onclick = function () { TS.cart.splice(Number(b.dataset.rm), 1); renderTeam(LAST); }; });
  TS.cart.forEach(function (c, i) {
    document.querySelectorAll('input[name=m' + i + ']').forEach(function (r) { r.onchange = function () { c.mode = r.value; renderTeam(LAST); }; });
    document.querySelectorAll('input[name=l' + i + ']').forEach(function (r) { r.onchange = function () { c.launch = r.value; renderTeam(LAST); }; });
  });
  var s = document.getElementById('sub'); if (s) s.onclick = function () {
    var me = LAST.me, msg = TS.cart.length ? 'Lock in ' + TS.cart.length + ' investment(s)? You cannot undo this.' : 'Lock in with NO investment?';
    if (!confirm(msg)) return; s.disabled = true;
    api('submit', { code: CUR.code, tok: CUR.auth.tok }, { items: TS.cart.map(function (c) { return { pos: c.pos, mode: c.mode, launch: c.launch }; }) }).then(function () { TS.cart = []; CUR.refresh(); }).catch(function (e) { alert(e.message); s.disabled = false; CUR.refresh(); });
  };
}

/* ---------- debrief ---------- */
function debriefHtml(v) {
  var D = v.debrief, W = v.weights || { trust: 2, debt: 3 }, teams = D.teams.slice().sort(function (a, b) { return a.rank - b.rank; }), h = '';
  var fin = {}; D.final.forEach(function (f) { fin[f.id] = f; });
  var maxS = Math.max.apply(null, D.final.map(function (f) { return Math.max(f.value + W.trust * f.trust, 1); }));
  h += '<div class="card"><h2>1. Score breakdown</h2><p class="mut">Value, Trust and debt side by side. The richest team is not always the winner.</p><table><tr><th>#</th><th>Team</th><th>Value</th><th>Trust</th><th>Debt</th><th>Final score</th><th></th></tr>' + teams.map(function (t) {
    var f = fin[t.id]; var bv = Math.round(f.value / maxS * 260), bt = Math.round(W.trust * f.trust / maxS * 260), bd = Math.round(W.debt * f.debt / maxS * 260);
    return '<tr><td>' + t.rank + '</td><td>' + esc(t.name) + ' <span class="mut">(' + esc(t.company) + ')</span></td><td>' + f.value + '</td><td>' + f.trust + ' (x' + W.trust + ')</td><td>' + f.debt + ' (x-' + W.debt + ')</td><td><b>' + f.score + '</b></td><td style="white-space:nowrap"><span class="bar" style="width:' + bv + 'px;background:#3b82f6"></span><span class="bar" style="width:' + bt + 'px;background:#22c55e"></span><span class="bar" style="width:' + bd + 'px;background:#ef4444"></span></td></tr>';
  }).join('') + '</table><p class="mut">Blue = value, green = Trust points, red = debt penalty.</p></div>';
  // line chart
  var n = Math.max.apply(null, D.teams.map(function (t) { return t.vs.length; })), mx = Math.max.apply(null, [1].concat(D.teams.map(function (t) { return t.value; }))), Wd = 640, Ht = 260, svg = '<svg viewBox="0 0 ' + (Wd + 60) + ' ' + (Ht + 40) + '" style="width:100%;max-width:760px;background:#0b1626;border-radius:8px">';
  for (var g = 0; g <= 4; g++) { var yy = 10 + Ht - g * Ht / 4; svg += '<line x1="40" x2="' + (Wd + 40) + '" y1="' + yy + '" y2="' + yy + '" stroke="#2c4466"/><text x="34" y="' + (yy + 4) + '" fill="#9fb2cc" font-size="11" text-anchor="end">' + Math.round(mx * g / 4) + '</text>'; }
  for (var r = 1; r <= n; r++) svg += '<text x="' + (40 + (r - 1) * Wd / Math.max(n - 1, 1)) + '" y="' + (Ht + 28) + '" fill="#9fb2cc" font-size="11" text-anchor="middle">R' + r + '</text>';
  D.teams.forEach(function (t, i) { var pts = t.vs.map(function (x, k) { return (40 + k * Wd / Math.max(n - 1, 1)) + ',' + (10 + Ht - x / mx * Ht); }).join(' '); svg += '<polyline fill="none" stroke="' + COLORS[i % 10] + '" stroke-width="3" points="' + pts + '"/>'; });
  svg += '</svg><div class="row" style="margin-top:6px">' + D.teams.map(function (t, i) { return '<span><span class="tok" style="background:' + COLORS[i % 10] + '">' + (i + 1) + '</span> ' + esc(t.name) + '</span>'; }).join('') + '</div>';
  h += '<div class="card"><h2>2. Value over time</h2><p class="mut">Foundation-first teams start slowly and overtake.</p>' + svg + '</div>';
  h += '<div class="card"><h2>3. First three rounds of investment vs final rank</h2><table><tr><th>Final rank</th><th>Team</th><th>Bought in rounds 1 to 3</th></tr>' + teams.map(function (t) { return '<tr><td>' + t.rank + '</td><td>' + esc(t.name) + '</td><td>' + (t.first3.length ? esc(t.first3.join(', ')) : '<span class="mut">nothing</span>') + '</td></tr>'; }).join('') + '</table></div>';
  h += '<div class="card"><h2>4. Pilots that never went live</h2><table><tr><th>Team</th><th>Still a pilot at the end</th><th>Bought as pilot at some point</th></tr>' + teams.map(function (t) { return '<tr><td>' + esc(t.name) + '</td><td>' + (t.pilotsEnd.length ? esc(t.pilotsEnd.join(', ')) : '-') + '</td><td>' + (t.pilotEver.length ? esc(t.pilotEver.join(', ')) : '-') + '</td></tr>'; }).join('') + '</table></div>';
  h += '<div class="card"><h2>5. Event impact</h2><p class="mut">The event that cost each team most, and what would have protected them.</p><table><tr><th>Team</th><th>Worst event</th><th>What happened</th><th>Protection</th></tr>' + teams.map(function (t) { var w = t.worst; return '<tr><td>' + esc(t.name) + '</td>' + (w ? '<td>' + esc(w.title) + '</td><td>' + esc(w.text) + '</td><td>' + esc(w.protect) + '</td>' : '<td colspan="3" class="mut">No damaging event</td>') + '</tr>'; }).join('') + '</table></div>';
  h += '<div class="card"><h2>6. Build versus buy</h2><table><tr><th>Team</th><th>Vendor-bought use cases</th><th>Price hikes that hit</th></tr>' + teams.map(function (t) { return '<tr><td>' + esc(t.name) + '</td><td>' + (t.vendor.length ? esc(t.vendor.join(', ')) : '-') + '</td><td>' + t.hike + '</td></tr>'; }).join('') + '</table></div>';
  h += '<div class="card"><h2>Discussion questions</h2><ol><li>Which team led after round 3, and which team won? What changed in between?</li><li>Who fast-tracked a use case? Was it worth the debt?</li><li>Which event hurt your company most, and what would have protected you?</li><li>Inside your team, which role argued for what? Who won the argument?</li><li>Where have you seen a real organisation make the same mistake your team made?</li><li>If you played again, what would you buy in the first two rounds?</li></ol></div>';
  return h;
}

/* ---------- PROJECTOR ---------- */
var SLIDES = [
  ['The idea', ['Eight teams each run a legacy company.', 'Your goal: turn it into an AI-driven business in 8 rounds.', 'AI use cases earn value only when the foundations they depend on are in place.', 'All teams play at the same time. Nobody waits for a turn.']],
  ['One round, about 5 minutes', ['Roll and move: the app rolls the dice for every team.', 'Decide: up to two investments, submit before the timer ends.', 'Event: one card hits every team. Protection matters.', 'Payout: live use cases pay, debt interest is charged.']],
  ['Investing', ['Capabilities: data, cloud, talent, governance, change.', 'AI use cases: need their capabilities to pay.', 'The space you landed on costs list price. Any other space adds a 2-point consulting fee.', 'Build a use case, or buy from a vendor for 2 less.']],
  ['Worked example: pilot or live?', ['Customer Service Chatbot needs Data Quality and Cleaning plus Responsible AI Policy.', 'You own only Data Quality. The chatbot is a PILOT: it pays nothing.', 'You buy Responsible AI Policy later. The chatbot goes LIVE automatically and pays every round.', 'Fast-track it early: it pays now, but you take a debt token for each missing prerequisite.']],
  ['Trust, debt and events', ['Debt tokens cost budget every round. Buy the missing piece to remove them.', 'Trust moves with events and audits. At zero, customer-facing use cases pause.', 'Without a Change Management Office every use case pays half.', 'The full result is revealed at the end. Play for the long game.']]];
function screenView(code) {
  document.body.className = 'pj'; loadContent(code).then(function () {
    startPoll({ code: code, auth: {}, onFatal: function (m) { stopPoll(); $app.innerHTML = '<div class="slide"><div class="err">' + esc(m) + '</div></div>'; } }, renderScreen);
  }).catch(function (e) { $app.innerHTML = '<div class="slide"><div class="err">' + esc(e.message) + '</div></div>'; });
}
function joinUrl(code) { return SITE + '#/join/' + code; }
function renderScreen(v) {
  var top = '<div class="top"><div><b style="font-size:1.4em">Transformation Tycoon</b> <span class="mut">· code ' + v.code + '</span></div><div style="font-size:1.4em">' + phaseBar(v) + '</div><div class="timer" id="timer"></div></div>', h;
  if (v.status === 'lobby') {
    h = top + '<div class="slide" style="display:flex;gap:60px;align-items:flex-start"><div><h1>Join the game</h1><p>Open this page on your team device:</p><p class="mut" style="font-size:.8em">' + esc(SITE) + '</p><p>Session code</p><div class="big">' + v.code + '</div></div><div>' + qrSvg(joinUrl(v.code), 300) + '</div><div style="flex:1"><h2>Teams (' + v.teams.length + ')</h2>' + v.teams.map(function (t) { return '<div style="font-size:1.1em;margin:4px 0">' + tokHtml(t.n) + ' ' + esc(t.name) + ' <span class="mut">· ' + esc(t.company) + '</span></div>'; }).join('') + '</div></div>';
  } else if (v.status === 'briefing') {
    var s = SLIDES[v.slide] || SLIDES[0]; h = top + '<div class="slide"><div class="mut">Slide ' + (v.slide + 1) + ' of 5</div><h1>' + esc(s[0]) + '</h1><ul>' + s[1].map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
  } else if (v.status === 'playing') {
    var center = '<div class="mut" style="font-size:1.1em">Round</div><div style="font-size:4em;font-weight:900">' + v.round + '/' + v.totalRounds + '</div><div style="font-size:1.4em">' + (PHASES[v.phase] || '') + '</div>';
    h = top + '<div class="main"><div>' + boardHtml(v, { center: center }) + '</div><div class="card lb"><h2>Leaderboard (value)</h2>' + leaderboard(v) + '</div></div>';
    if (v.phase === 'event' && v.curEvent) h += '<div class="evfull"><div class="mut" style="font-size:1.5em">EVENT CARD · Round ' + v.round + '</div><h1>' + esc(v.curEvent.title) + '</h1><p>' + esc(v.curEvent.desc) + '</p><div class="timer" id="timer2" style="font-size:3em"></div></div>';
  } else if (v.status === 'reveal') {
    var st = v.revealStep, f = v.final.slice().sort(function (a, b) { return st >= 3 ? a.rank - b.rank : b.value - a.value; });
    h = top + '<div class="slide"><h1>Final reveal</h1><table style="font-size:1.1em"><tr><th>#</th><th>Team</th><th>Value</th>' + (st >= 1 ? '<th>Trust</th>' : '') + (st >= 2 ? '<th>Debt tokens</th>' : '') + (st >= 3 ? '<th>Transformation Score</th>' : '') + '</tr>' + f.map(function (x, i) { return '<tr><td>' + (i + 1) + '</td><td>' + esc(x.name) + '</td><td>' + x.value + '</td>' + (st >= 1 ? '<td>' + x.trust + (v.weights ? ' x' + v.weights.trust : '') + '</td>' : '') + (st >= 2 ? '<td>' + x.debt + (v.weights ? ' x-' + v.weights.debt : '') + '</td>' : '') + (st >= 3 ? '<td><b>' + x.score + '</b></td>' : '') + '</tr>'; }).join('') + '</table>' + (st >= 3 ? '<h1 style="color:var(--acc)">Winner: ' + esc(f[0].name) + '</h1>' : '<p class="mut">' + ['Value only so far…', 'Adding Trust…', 'Subtracting debt…'][st] + '</p>') + '</div>';
  } else { document.body.className = ''; h = '<div class="wrap">' + debriefHtml(v) + '</div>'; }
  $app.innerHTML = h;
  var t2 = document.getElementById('timer2'); if (t2) { t2.id = 'timer'; var t1 = document.querySelector('.top #timer'); if (t1) t1.removeAttribute('id'); }
}

/* ---------- CONSOLE ---------- */
var PARAMLABELS = { rounds: 'Rounds', budgetPerRound: 'Budget per round', decisionSeconds: 'Decision timer (s)', investmentsPerRound: 'Investments per round', consultingFee: 'Consulting fee', startingTrust: 'Starting Trust', debtInterest: 'Debt interest per token', debtPenalty: 'End penalty per debt token', trustMultiplier: 'Trust multiplier in score', vendorDiscount: 'Vendor discount', rollSeconds: 'Roll phase (s)', eventSeconds: 'Event phase (s)', payoutSeconds: 'Payout phase (s)', startBonus: 'Start bonus budget', innovationDiscount: 'Innovation Hub discount' };
function consoleView(code) {
  document.body.className = ''; var fc = JSON.parse(localStorage.getItem('tt_fac') || 'null');
  if (!fc || fc.code !== code) { location.hash = '#/'; return; }
  loadContent(code, fc.fk).then(function () {
    startPoll({ code: code, auth: { fk: fc.fk }, onFatal: function (m) { stopPoll(); $app.innerHTML = '<div class="wrap"><div class="err">' + esc(m) + '</div><button onclick="location.hash=\'#/\'">Back</button></div>'; } }, renderConsole);
  }).catch(function (e) { $app.innerHTML = '<div class="wrap"><div class="err">' + esc(e.message) + '</div><button onclick="location.hash=\'#/\'">Back</button></div>'; });
}
function fac(op, extra) { return api('fac', { code: CUR.code, fk: CUR.auth.fk }, Object.assign({ op: op }, extra || {})).then(function () { CUR.refresh(); }).catch(function (e) { alert(e.message); CUR.refresh(); }); }
function renderConsole(v) {
  var F = v.fac, h = '<div class="wrap"><div class="card row noprint"><div class="grow"><h2>Facilitator console</h2><div class="mut">' + phaseBar(v) + '</div></div><div>Code <b style="font-size:1.6em;letter-spacing:.1em">' + v.code + '</b><br><span class="mut">PIN ' + F.fk + '</span></div><div class="timer" id="timer"></div><a href="#/screen/' + v.code + '" target="_blank"><button class="sec">Open projector view</button></a></div><div id="cerr"></div>';
  if (v.status === 'lobby' || v.status === 'briefing') {
    h += '<div class="card noprint row"><div>' + qrSvg(joinUrl(v.code), 150) + '</div><div class="grow"><b>Share with students:</b><br>' + esc(joinUrl(v.code)) + '<br>or open <b>' + esc(SITE) + '</b> and enter code <b>' + v.code + '</b>.</div></div>';
    h += '<div class="card"><h3>Teams (' + v.teams.length + '/10) - need at least 4</h3>' + (v.teams.length ? '<table><tr><th>Team</th><th>Company</th></tr>' + v.teams.map(function (t) { return '<tr><td>' + tokHtml(t.n) + ' ' + esc(t.name) + '</td><td>' + esc(t.company) + '</td></tr>'; }).join('') + '</table>' : '<p class="mut">Waiting for teams to join…</p>') + '</div>';
    h += '<div class="card"><h3>Parameters</h3><div class="params">' + Object.keys(PARAMLABELS).map(function (k) { return '<div><label>' + PARAMLABELS[k] + '</label><input type="number" min="0" data-keep="1" data-p="' + k + '" value="' + F.params[k] + '"></div>'; }).join('') + '</div><p><button class="sec" id="savep">Save parameters</button> <span class="mut">Content (spaces, use cases, event text, companies) is edited in the Google Sheet and read when a session is created.</span></p></div>';
    h += '<div class="card"><h3>Event cards</h3><label><input type="radio" name="em" value="shuffle" style="width:auto" ' + (F.eventMode === 'shuffle' ? 'checked' : '') + '> Shuffle</label> <label><input type="radio" name="em" value="fixed" style="width:auto" ' + (F.eventMode === 'fixed' ? 'checked' : '') + '> Fixed order</label><p class="mut">Cards: ' + F.events.map(function (e) { return e.id + '=' + esc(e.title); }).join('; ') + '</p><input id="eo" data-keep="1" value="' + F.eventOrder.join(',') + '" placeholder="Fixed order, e.g. 2,9,12,1,..."><p><button class="sec" id="savee">Save event setting</button></p></div>';
    h += '<div class="card row"><button class="sec" id="briefb">' + (v.status === 'briefing' ? 'Rules briefing on projector' : 'Show rules briefing on projector') + '</button>' + (v.status === 'briefing' ? '<button class="sec" id="sp">◀ Prev slide</button><span>Slide ' + (v.slide + 1) + '/5</span><button class="sec" id="sn">Next slide ▶</button>' : '') + '<button class="go grow" id="startb" ' + (v.teams.length < 4 ? 'disabled' : '') + '>Start game</button></div>';
  } else if (v.status === 'playing') {
    h += '<div class="card row"><button id="pz" class="sec">' + (v.paused ? '▶ Resume' : '⏸ Pause') + '</button><button id="sk" class="sec">Skip to next phase</button><button id="a30" class="sec">+30 s</button><button id="cut" class="sec">Cut game to… rounds</button><button id="endb" class="warn">End game now</button></div>';
  } else if (v.status === 'reveal') {
    h += '<div class="card row"><div class="grow">Reveal step ' + v.revealStep + '/3 (value, Trust, debt, final score)</div><button id="rv" ' + (v.revealStep >= 3 ? 'disabled' : '') + '>Reveal next</button><button class="go" id="db" ' + (v.revealStep >= 3 ? '' : 'disabled') + '>Show debrief</button></div>';
  } else {
    h += '<div class="card row noprint"><button id="pr">Print / save debrief as PDF</button><button class="sec" id="csv">Download decision log (CSV)</button><a href="https://docs.google.com/spreadsheets/d/' + (window.TT_SHEET) + '/edit" target="_blank"><button class="sec">Open data sheet in Drive</button></a></div>';
  }
  if (v.status === 'playing' || v.status === 'reveal') {
    h += '<div class="card"><h3>Teams</h3><table><tr><th>Team</th><th>Company</th><th>Sub.</th><th>Budget</th><th>Trust</th><th>Debt</th><th>Value</th><th>Live UC</th></tr>' + F.teams.map(function (t, i) { return '<tr><td>' + tokHtml(i + 1) + ' ' + esc(t.name) + '</td><td>' + esc(t.company) + '</td><td>' + (t.submitted ? '✔' : '…') + '</td><td>' + t.budget + '</td><td>' + t.trust + '</td><td>' + t.debt + '</td><td>' + t.value + '</td><td>' + t.live + '</td></tr>'; }).join('') + '</table><p class="mut">Trust and debt are visible only on this console during play.</p></div>';
  }
  if (v.status === 'debrief') h += debriefHtml(v);
  h += '</div>'; $app.innerHTML = h;
  var $ = function (id) { return document.getElementById(id); };
  if ($('savep')) $('savep').onclick = function () { var p = {}; document.querySelectorAll('[data-p]').forEach(function (i) { p[i.dataset.p] = i.value; }); fac('params', { params: p }); };
  if ($('savee')) $('savee').onclick = function () { var m = document.querySelector('input[name=em]:checked').value; fac('events', { mode: m, order: $('eo').value.split(',').map(function (x) { return x.trim(); }) }); };
  if ($('briefb')) $('briefb').onclick = function () { fac('briefing', { slide: 0 }); };
  if ($('sp')) $('sp').onclick = function () { fac('briefing', { slide: v.slide - 1 }); };
  if ($('sn')) $('sn').onclick = function () { fac('briefing', { slide: v.slide + 1 }); };
  if ($('startb')) $('startb').onclick = function () { if (confirm('Start the game with ' + v.teams.length + ' teams? Parameters lock now.')) fac('start'); };
  if ($('pz')) $('pz').onclick = function () { fac(v.paused ? 'resume' : 'pause'); };
  if ($('sk')) $('sk').onclick = function () { fac('skip'); };
  if ($('a30')) $('a30').onclick = function () { fac('add30'); };
  if ($('cut')) $('cut').onclick = function () { var n = prompt('Play only this many rounds in total (current round ' + v.round + '):', '6'); if (n) fac('rounds', { n: n }); };
  if ($('endb')) $('endb').onclick = function () { if (confirm('End the game now and go to the reveal?')) fac('end'); };
  if ($('rv')) $('rv').onclick = function () { fac('reveal'); };
  if ($('db')) $('db').onclick = function () { fac('debrief'); };
  if ($('pr')) $('pr').onclick = function () { window.print(); };
  if ($('csv')) $('csv').onclick = function () { api('log', { code: v.code, fk: CUR.auth.fk }).then(function (r) { var csv = r.rows.map(function (row) { return row.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(','); }).join('\n'); var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'decision-log-' + v.code + '.csv'; a.click(); }); };
}

/* ---------- router ---------- */
function route() {
  var m = location.hash.match(/^#\/(team|console|screen|join)\/([A-Za-z0-9]+)/); stopPoll();
  if (!m) return landing(); var code = m[2].toUpperCase();
  if (m[1] === 'join') return landing(); if (m[1] === 'team') return teamView(code); if (m[1] === 'console') return consoleView(code); screenView(code);
}
window.addEventListener('hashchange', route); route();
