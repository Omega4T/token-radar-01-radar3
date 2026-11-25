// Launch Radar v5 dashboard: renders window.RADAR (written by main.ts)
// into the cover, board, detail view and live-token view. All filtering,
// sorting and search run locally; no network. Hash routes: #detail=<slug>
// opens a protocol, #filtered&category=<name> opens a filtered board.
(function () {
  var R = window.RADAR;
  if (!R) { document.body.insertAdjacentHTML('beforeend', '<p style="padding:20px">data.js not loaded — open the dashboard from the program output folder.</p>'); return; }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmtInt = function (n) { return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var fmtTvl = function (n) { return n >= 1e9 ? '$' + (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? '$' + (n / 1e6).toFixed(1) + 'M' : fmtInt(n); };
  var $ = function (id) { return document.getElementById(id); };
  var bySlug = {};
  R.rows.forEach(function (r) { bySlug[r.slug] = r; });

  // ---- Cover: KPI strip ----
  var m = R.meta, k = R.kpis, mo = R.model;
  var kpi = function (v, l) { return '<div class="kpi"><b>' + v + '</b><span>' + l + '</span></div>'; };
  $('kpis').innerHTML =
    kpi(m.counts.protocols, 'protocols in snapshot') +
    kpi(m.counts.fit_set, 'fit set (mcap + TVL)') +
    kpi(m.counts.watchlist, 'watchlist (floor $50M)') +
    kpi(m.counts.board_rows, 'board rows') +
    kpi(m.counts.pre_token, 'pre-token protocols');
  $('equation').textContent = mo.equation;
  $('fitnotes').innerHTML = 'Fit set n=' + m.counts.fit_set + '. Residual std ' + mo.residual_std.toFixed(3) +
    ' (log units). Held-out median log error: H1 ' + mo.final_h1_median.toFixed(3) + ' vs baseline ' + mo.baseline_h1_median.toFixed(3) +
    '; H2 ' + mo.final_h2_median.toFixed(3) + ' vs baseline ' + mo.baseline_h2_median.toFixed(3) +
    '. Walk-forward: final model beats baseline on ' + mo.final_wf_wins + ' of ' + mo.final_wf_valid + ' valid folds.' +
    (mo.kept_terms.length === 0 ? ' <b>No additional value term passed selection, so the final value model is the one-term log-TVL baseline.</b> The decision table below is the proof.' : ' Kept value terms: ' + esc(mo.kept_terms.join(', ')) + (mo.kept_k !== null ? ' (category K=' + mo.kept_k + ')' : '') + '.');
  $('oddsnotes').innerHTML = 'Odds model: logistic P(records a token) on all ' + m.counts.protocols +
    ' protocols. Kept features: ' + (mo.odds_kept_terms.length ? esc(mo.odds_kept_terms.join(', ')) + (mo.odds_kept_k !== null ? ' (category K=' + mo.odds_kept_k + ')' : '') : 'log TVL only — no added feature passed selection') +
    '. Held-out AUC (baseline): H1 ' + mo.odds_base_h1_auc.toFixed(3) + ', H2 ' + mo.odds_base_h2_auc.toFixed(3) +
    '. Board: median odds ' + k.median_odds_pct.toFixed(1) + '%, ' + k.high_odds + ' rows High odds, ' + k.high_implied_low_odds +
    ' rows with implied value at least half the top row but Low odds.';
  $('calwarn').textContent = mo.odds_calibration_warning || '';

  // ---- Decision tables ----
  var wfSummary = function (folds) {
    return folds.map(function (f) { return f.valid ? (f.median_gain != null ? (f.median_gain >= 0 ? '+' : '') + f.median_gain.toFixed(3) : (f.auc_gain >= 0 ? '+' : '') + f.auc_gain.toFixed(3)) : 'skip'; }).join(' / ');
  };
  $('vtable').querySelector('tbody').innerHTML = R.validation.value_verdicts.map(function (v) {
    return '<tr><td><b>' + esc(v.term) + '</b><br><span class="small">' + esc(v.label) + '</span></td>' +
      '<td class="num">' + (v.h1_median_gain >= 0 ? '+' : '') + v.h1_median_gain.toFixed(3) + '</td>' +
      '<td class="num">' + (v.h2_median_gain >= 0 ? '+' : '') + v.h2_median_gain.toFixed(3) + '</td>' +
      '<td>' + esc(wfSummary(v.folds)) + '</td>' +
      '<td class="' + (v.decision === 'KEEP' ? 'keep' : 'drop') + '">' + v.decision + '</td><td class="small">' + esc(v.reason) + '</td></tr>';
  }).join('');
  $('vnote').textContent = 'H1 test n=' + R.validation.h1_test_n + '; H2 test n=' + R.validation.h2_test_n +
    ' (H2 is thin by design: only categories with 10+ fit-set members contribute a test protocol; ' +
    R.validation.h2_small_categories + ' fit-set categories have fewer than 10 members and contribute none). ' +
    'Median log error is the primary metric; within-2x is the guard (a term that improves the median but wrecks the tail is dropped).';
  $('otable').querySelector('tbody').innerHTML = R.validation.odds_verdicts.map(function (v) {
    return '<tr><td><b>' + esc(v.term) + '</b><br><span class="small">' + esc(v.label) + '</span></td>' +
      '<td class="num">' + (v.h1_auc_gain >= 0 ? '+' : '') + v.h1_auc_gain.toFixed(3) + '</td>' +
      '<td class="num">' + (v.h2_auc_gain >= 0 ? '+' : '') + v.h2_auc_gain.toFixed(3) + '</td>' +
      '<td>' + esc(v.folds.map(function (f) { return f.valid ? (f.auc_gain >= 0 ? '+' : '') + f.auc_gain.toFixed(3) : 'skip'; }).join(' / ')) + '</td>' +
      '<td class="' + (v.decision === 'KEEP' ? 'keep' : 'drop') + '">' + v.decision + '</td><td class="small">' + esc(v.reason) + '</td></tr>';
  }).join('');

  // ---- Board ----
  var fill = function (sel, items) { items.forEach(function (x) { var o = document.createElement('option'); o.textContent = x; sel.appendChild(o); }); };
  fill($('fcat'), R.categories);
  fill($('fchain'), R.chains);
  var state = { q: '', cat: '', chain: '', tvl: '', odds: '', sort: 'implied' };
  function filtered() {
    var rows = R.rows.filter(function (r) {
      if (state.q && (r.name + ' ' + r.slug).toLowerCase().indexOf(state.q) < 0) return false;
      if (state.cat && (r.category || 'No category') !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (state.tvl === 's' && r.tvl_usd >= 1e8) return false;
      if (state.tvl === 'm' && (r.tvl_usd < 1e8 || r.tvl_usd >= 1e9)) return false;
      if (state.tvl === 'l' && r.tvl_usd < 1e9) return false;
      if (state.odds && r.odds_band !== state.odds) return false;
      return true;
    });
    var key = { implied: function (a, b) { return b.implied_value_usd - a.implied_value_usd; }, odds: function (a, b) { return b.token_odds_pct - a.token_odds_pct; }, tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; }, age: function (a, b) { return (b.age_days == null ? -1 : b.age_days) - (a.age_days == null ? -1 : a.age_days); } }[state.sort];
    rows.sort(function (a, b) { return key(a, b) || (a.slug < b.slug ? -1 : 1); });
    return rows;
  }
  function renderBoard() {
    var rows = filtered();
    $('count').textContent = rows.length + ' of ' + R.rows.length + ' rows';
    $('btable').querySelector('tbody').innerHTML = rows.map(function (r) {
      return '<tr><td class="num">' + r.rank + '</td><td><b>' + esc(r.name) + '</b><br><span class="small">' + esc(r.slug) + ' · ' + esc(r.category || 'No category') + ' · ' + esc(r.chains.join(', ')) + '</span></td>' +
        '<td class="num">' + fmtTvl(r.tvl_usd) + '</td><td class="num">' + (r.change_7d == null ? '—' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') + '</td>' +
        '<td class="num"><b>' + fmtInt(r.implied_value_usd) + '</b></td>' +
        '<td class="num">' + r.token_odds_pct.toFixed(1) + '% <span class="band ' + r.odds_band + '">' + r.odds_band + '</span></td>' +
        '<td><button data-slug="' + esc(r.slug) + '">Detail</button></td></tr>';
    }).join('');
  }
  function bind(id, fn) { $(id).addEventListener('input', function (e) { fn(e.target.value); renderBoard(); }); }
  bind('q', function (v) { state.q = v.toLowerCase(); });
  bind('fcat', function (v) { state.cat = v; });
  bind('fchain', function (v) { state.chain = v; });
  bind('ftvl', function (v) { state.tvl = v; });
  bind('fodds', function (v) { state.odds = v; });
  bind('sort', function (v) { state.sort = v; });
  $('btable').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-slug]');
    if (b) showDetail(b.getAttribute('data-slug'));
  });

  // ---- Detail view ----
  function showDetail(slug) {
    var r = bySlug[slug];
    if (!r) return;
    location.hash = 'detail=' + slug;
    var termName = { x1: 'log TVL', x2: 'log TVL squared', x3: '7d growth', x4: 'log age', x5: 'log chain count', x6: 'log TVL per chain', x7: 'growth x log TVL', x8: 'log age x growth', x10: 'recency < 180d', intercept: 'intercept', category_shrinkage: 'category shrinkage' };
    var bd = r.breakdown.map(function (b) {
      return '<tr><td>' + esc(termName[b.component] || b.component) + '</td><td class="num">' + b.log_points.toFixed(3) + '</td><td class="num">' + (b.factor < 0.001 ? b.factor.toExponential(2) : b.factor.toFixed(4)) + 'x</td><td class="num">' + fmtInt(b.dollars_counterfactual) + '</td></tr>';
    }).join('');
    var oddsDir = r.odds_contributions.map(function (c) {
      var name = { x1: 'log TVL', x4: 'log age', x2: 'log TVL squared', x3: '7d growth', x5: 'log chain count', x6: 'log TVL per chain', T9: 'category effect' }[c.term] || c.term;
      var dir = c.signed > 0.005 ? 'raises odds' : c.signed < -0.005 ? 'lowers odds' : 'barely moves odds';
      return '<li>' + esc(name) + ' (standardised ' + c.z.toFixed(2) + '): ' + dir + ' by ' + Math.abs(c.signed).toFixed(3) + ' log-odds points.</li>';
    }).join('');
    $('detailbox').innerHTML =
      '<h3>#' + r.rank + ' ' + esc(r.name) + ' <span class="small">(' + esc(r.slug) + ' · ' + esc(r.category || 'No category') + ' · ' + esc(r.chains.join(', ')) + ')</span></h3>' +
      '<p>TVL ' + fmtTvl(r.tvl_usd) + ' · 7d ' + (r.change_7d == null ? 'not reported' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') +
      ' · listed ' + (r.listed_at || 'not reported') + (r.age_days == null ? '' : ' (' + r.age_days + ' days)') +
      ' · status: records no token.</p>' +
      '<p><b>Implied value ' + fmtInt(r.implied_value_usd) + '</b> (fitted mcap/TVL ratio ' + r.fitted_ratio.toFixed(4) +
      '; category median ratio ' + (r.category_median_ratio == null ? 'n/a — too few fit-set members' : r.category_median_ratio.toFixed(4)) +
      '; global median ratio ' + R.global_median_ratio.toFixed(4) + '). Category multiplier (shrunk): ' + r.category_multiplier.toFixed(4) + '.</p>' +
      '<h4>Value breakdown — log points add to log(implied/TVL); factor multiplies TVL; dollars is the implied value if that component were removed (implied / factor)</h4>' +
      '<div class="scroll"><table><thead><tr><th>Component</th><th class="num">Log points</th><th class="num">Factor</th><th class="num">Dollars w/o it</th></tr></thead><tbody>' + bd + '</tbody></table></div>' +
      '<p class="small">Implied value = TVL x exp(sum of log points) = ' + fmtTvl(r.tvl_usd) + ' x exp(' + r.breakdown.map(function (b) { return b.log_points.toFixed(3); }).join(' + ') + ').</p>' +
      '<h4>Token odds ' + r.token_odds_pct.toFixed(1) + '% (' + r.odds_band + ') — proxy, not a launch probability</h4><ul>' + oddsDir + '</ul>' +
      '<h4>Farm plan — 9 steps for this protocol</h4><ol>' + r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>';
    document.getElementById('detail').scrollIntoView();
  }
  window.showDetail = showDetail;

  // ---- Live-token view ----
  $('livetable').querySelector('tbody').innerHTML = R.live.map(function (r, i) {
    return '<tr><td class="num">' + (i + 1) + '</td><td><b>' + esc(r.name) + '</b><br><span class="small">' + esc(r.slug) + ' · ' + esc(r.category || 'No category') + '</span></td>' +
      '<td class="num">' + fmtTvl(r.tvl_usd) + '</td><td class="num">' + fmtTvl(r.mcap_usd) + '</td><td class="num">' + r.ratio.toFixed(4) + '</td></tr>';
  }).join('');

  // ---- Validation: held-out detail + calibration ----
  $('heldout').textContent = 'Value model, final vs baseline median log error — H1 (n=' + R.validation.h1_test_n + '): ' +
    mo.final_h1_median.toFixed(3) + ' vs ' + mo.baseline_h1_median.toFixed(3) + '; H2 (n=' + R.validation.h2_test_n + '): ' +
    mo.final_h2_median.toFixed(3) + ' vs ' + mo.baseline_h2_median.toFixed(3) + '. Walk-forward: ' + mo.final_wf_wins + ' of ' + mo.final_wf_valid + ' valid folds won by the final model.';
  var cal = function (id, bands) {
    $(id).querySelector('tbody').innerHTML = bands.map(function (b) {
      return '<tr><td>' + esc(b.band) + '</td><td class="num">' + b.n + '</td><td class="num">' + b.mean_predicted_pct.toFixed(1) + '%</td><td class="num">' + b.actual_token_pct.toFixed(1) + '%</td><td class="num">' + (b.gap_pct >= 0 ? '+' : '') + b.gap_pct.toFixed(1) + '</td></tr>';
    }).join('');
  };
  cal('cal1', R.validation.calibration_h1);
  cal('cal2', R.validation.calibration_h2);

  $('prov').textContent = 'Data: ' + m.source + '; snapshot frozen, as_of ' + m.as_of + '. Floor $' + m.floor_usd.toLocaleString('en-US') + '. All figures are model estimates from this snapshot; nothing here is a promise of a future token, airdrop or price.';

  // ---- Hash routes (used by the screenshots) ----
  renderBoard();
  var h = location.hash || '';
  var dm = h.match(/detail=([A-Za-z0-9_-]+)/);
  if (dm) showDetail(dm[1]);
  var cm = h.match(/category=([^&]+)/);
  if (h.indexOf('filtered') >= 0 && cm) { state.cat = decodeURIComponent(cm[1]); $('fcat').value = state.cat; renderBoard(); }
})();
