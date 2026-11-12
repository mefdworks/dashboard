/* Panel de pauta MARA COLOMBIA. Lee en vivo la hoja «[Mara] Fuente de datos» (gviz/tq en formato JSON: trae el valor crudo, no el texto con
   formato regional) y dibuja Resumen, Campañas y Anuncios con lo que entrega Meta, sin homologar. Sin datos embebidos. */
(function () {
'use strict';

var SHEET_ID = '1NZixxOmcKoEQBWjtIvxp2XzHh5q8zS3vWebszIEwVVM';
var $ = function (id) { return document.getElementById(id); };

/* ------------------------------------------------------------------ datos */

function gviz(hoja) {
  var url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:json&sheet=' + encodeURIComponent(hoja) + '&_cb=' + Date.now();
  return fetch(url).then(function (r) {
    if (!r.ok) throw new Error('La hoja respondió ' + r.status);
    return r.text();
  }).then(function (t) {
    var j = JSON.parse(t.slice(t.indexOf('(') + 1, t.lastIndexOf(')')));
    if (j.status !== 'ok') throw new Error((j.errors && j.errors[0] && j.errors[0].detailed_message) || 'Error de la hoja');
    return j.table.rows.map(function (r) { return r.c.map(function (c) { return c ? c.v : null; }); });
  });
}
var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
function fechaClave(v) { // "Date(2026,10,6)" -> 2026-11-06
  var m = /Date\((\d+),(\d+),(\d+)/.exec(String(v));
  return m ? m[1] + '-' + p2(+m[2] + 1) + '-' + p2(+m[3]) : null;
}
var num = function (v) { return typeof v === 'number' ? v : 0; };

var CAMP = [];     // una fila por día y campaña
var ADS = null;    // una fila por día y anuncio; se carga al abrir Campañas o Anuncios
var MAXD = '', MIND = '';
var SUMAS = ['inv', 'impr', 'alc', 'clics', 'ce', 'vid', 'vis', 'vc', 'atc', 'pag', 'comp', 'val', 'conv'];

function cargarCamp() {
  return gviz('Campañas').then(function (rows) {
    CAMP = rows.map(function (r) {
      return { d: fechaClave(r[0]), camp: String(r[1] || ''), id: String(r[2] || ''), obj: r[3] || '', inv: num(r[4]), impr: num(r[5]), alc: num(r[6]), clics: num(r[8]),
        ce: num(r[9]), vid: num(r[10]), vis: num(r[11]), vc: num(r[12]), atc: num(r[13]), pag: num(r[14]), comp: num(r[15]), val: num(r[16]), conv: num(r[19]) };
    }).filter(function (r) { return r.d; });
    CAMP.forEach(function (r) { if (!MAXD || r.d > MAXD) MAXD = r.d; if (!MIND || r.d < MIND) MIND = r.d; });
  });
}
function cargarAds() {
  if (ADS) return Promise.resolve();
  return gviz('Anuncios').then(function (rows) {
    ADS = rows.map(function (r) {
      return { d: fechaClave(r[0]), camp: String(r[1] || ''), conj: String(r[2] || ''), ad: String(r[3] || ''), id: String(r[4] || ''), obj: r[5] || '', inv: num(r[6]), impr: num(r[7]),
        alc: num(r[8]), clics: num(r[10]), ce: num(r[11]), vid: num(r[12]), vis: num(r[13]), vc: num(r[14]), atc: num(r[15]), pag: num(r[16]), comp: num(r[17]), val: num(r[18]),
        conv: num(r[21]), estado: r[23] || '', url: String(r[24] || '') };
    }).filter(function (r) { return r.d; });
  });
}

/* ------------------------------------------------------------------ formato */

var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var nf = function (n, d) { return n.toLocaleString('es-CO', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); };
var cop = function (n) { return (n < 0 ? '-' : '') + '$' + nf(Math.abs(Math.round(n))); };
var copM = function (n) { return Math.abs(n) >= 1e6 ? '$' + nf(n / 1e6, 1) + ' M' : cop(n); };
var roasF = function (n) { return n == null ? '—' : nf(n, 2) + 'x'; };
var pctF = function (n) { return n == null ? '—' : nf(n, 1) + '%'; };
var cpF = function (n) { return n == null ? '—' : cop(n); };
var MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
var MESES_N = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
var DIAS_N = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
function lblDia(k) { return +k.slice(8) + ' ' + MES[+k.slice(5, 7) - 1]; }
function lblMes(k) { return MES[+k.slice(5, 7) - 1] + ' ' + k.slice(2, 4); }
function lblRango(a, b) { return lblDia(a) + ' ' + a.slice(0, 4) + ' → ' + lblDia(b) + ' ' + b.slice(0, 4); }
var mesNombre = function (k) { return MESES_N[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4); };

/* Objetivos de Meta, solo traducidos para mostrar */
var OBJ = { OUTCOME_SALES: 'Compras', OUTCOME_ENGAGEMENT: 'WPP', OUTCOME_AWARENESS: 'Alcance', LINK_CLICKS: 'Tráfico', OUTCOME_TRAFFIC: 'Tráfico', OUTCOME_LEADS: 'Clientes potenciales' };
var ORDEN_OBJ = ['OUTCOME_SALES', 'OUTCOME_ENGAGEMENT', 'OUTCOME_AWARENESS', 'LINK_CLICKS'];
var objN = function (o) { return OBJ[o] || o || 'Sin objetivo'; };
var ordenObj = function (a, b) { var i = ORDEN_OBJ.indexOf(a), j = ORDEN_OBJ.indexOf(b); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j) || a.localeCompare(b); };
var pillObj = function (o) { return '<span class="pill-c obj-' + esc(String(o).toLowerCase().replace(/[^a-z]/g, '')) + '">' + esc(objN(o)) + '</span>'; };
var ESTADO_N = { ACTIVE: 'Activo', PAUSED: 'Pausado', ADSET_PAUSED: 'Conjunto pausado', CAMPAIGN_PAUSED: 'Campaña pausada', WITH_ISSUES: 'Con problemas', ARCHIVED: 'Archivado', DISAPPROVED: 'Rechazado', PENDING_REVIEW: 'En revisión', IN_PROCESS: 'En proceso' };

/* ------------------------------------------------------------------ rango y filtros */

function claveDe(dt) { return dt.getFullYear() + '-' + p2(dt.getMonth() + 1) + '-' + p2(dt.getDate()); }
function sumaDias(k, n) { return claveDe(new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8) + n)); }
function diasEntre(a, b) { return Math.round((new Date(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8)) - new Date(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8))) / 864e5) + 1; }

function rango() {
  var v = $('rangeSelect').value, hoy = claveDe(new Date()), a, b = hoy, h = new Date();
  if (v === 'mtd') a = hoy.slice(0, 8) + '01';
  else if (v === 'lastmonth') { a = claveDe(new Date(h.getFullYear(), h.getMonth() - 1, 1)); b = claveDe(new Date(h.getFullYear(), h.getMonth(), 0)); }
  else if (v === 'all') a = MIND;
  else if (v === 'custom') { a = $('dateFrom').value || MIND; b = $('dateTo').value || hoy; }
  else a = sumaDias(hoy, -(+v - 1));
  if (a > b) { var t = a; a = b; b = t; }
  var prev = null;
  if (v !== 'all') { var n = diasEntre(a, b); prev = { a: sumaDias(a, -n), b: sumaDias(a, -1) }; }
  return { a: a, b: b, prev: prev };
}
function filtra(arr, a, b) {
  var obj = $('fObj').value;
  return arr.filter(function (r) { return r.d >= a && r.d <= b && (!obj || r.obj === obj); });
}
function agg(rows) {
  var o = {}; SUMAS.forEach(function (k) { o[k] = 0; });
  rows.forEach(function (r) { SUMAS.forEach(function (k) { o[k] += r[k] || 0; }); });
  return deriva(o);
}
function deriva(o) {
  o.roas = o.inv > 0 && o.val > 0 ? o.val / o.inv : null;
  o.cpa = o.comp > 0 ? o.inv / o.comp : null;
  o.cpc = o.conv > 0 ? o.inv / o.conv : null;
  o.cpm = o.impr > 0 ? o.inv / o.impr * 1000 : null;
  o.ctr = o.impr > 0 ? o.ce / o.impr * 100 : null;
  return o;
}

/* ------------------------------------------------------------------ piezas comunes */

var G = 'm', charts = {}, OPEN = {}, OPENC = {};
var META_ROAS = 5; // meta de retorno de Mara: ventas de Shopify ÷ inversión de Meta; aquí se compara el ROAS del pixel
var PRESUPUESTO = null;
try { var pp = parseFloat(localStorage.getItem('mara_presupuesto')); if (pp > 0) PRESUPUESTO = pp; } catch (e) { /* sin almacenamiento */ }

function kpiCard(label, valor, cmp) { return '<div class="kpi-card"><div class="kpi-label">' + label + '</div><div class="kpi-value">' + valor + '</div>' + (cmp || '') + '</div>'; }
function cmpHTML(cur, prev, fmt, mejor, etiqueta) { // mejor: 'sube' | 'baja' | null (sin juicio)
  if (prev == null || cur == null) return '<div class="kpi-cmp">Sin periodo anterior para comparar</div>';
  var d = prev === 0 ? null : (cur - prev) / prev * 100, cls = 'igual', flecha = '=';
  if (d != null && Math.abs(d) >= 0.5) {
    flecha = (d > 0 ? '▲ ' : '▼ ') + nf(Math.abs(d), 0) + '%';
    if (mejor) cls = ((d > 0) === (mejor === 'sube')) ? 'bien' : 'mal';
  } else if (d == null) flecha = 'nuevo';
  return '<div class="kpi-cmp">' + (etiqueta || 'Periodo anterior') + ' <b>' + fmt(prev) + '</b> <span class="d ' + cls + '">' + flecha + '</span></div>';
}
function bucket(k) {
  if (G === 'd') return k;
  if (G === 'm') return k.slice(0, 7);
  var dt = new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8)), dow = (dt.getDay() + 6) % 7;
  return sumaDias(k, -dow);
}
function lblBucket(k) { return G === 'm' ? lblMes(k) : (G === 's' ? 'Sem ' : '') + lblDia(k); }
function dibuja(id, cfg) { if (charts[id]) charts[id].destroy(); charts[id] = new Chart($(id), cfg); }
var ejeY = function (fmt) { return { beginAtZero: true, grid: { color: UI.grid }, border: { display: false }, ticks: { callback: fmt } }; };
var ejeX = { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } };
var opc = function (y, extra) { return Object.assign({ responsive: true, maintainAspectRatio: false, scales: { x: ejeX, y: y } }, extra || {}); };
var tipo = function (fmt) { return { tooltip: { callbacks: { label: function (c) { return ' ' + c.dataset.label + ': ' + fmt(c.parsed.y); } } } }; };
var sinLeyenda = function (fmt) { return Object.assign({ legend: { display: false } }, tipo(fmt)); };

/* columnas de las tablas con objetivo, mes y campaña */
function tdMetricas(o, total) {
  return '<td class="num">' + cop(o.inv) + '</td><td class="num">' + (total > 0 ? nf(o.inv / total * 100, 1) + '%' : '—') + '</td><td class="num">' + nf(Math.round(o.comp)) +
    '</td><td class="num">' + cop(o.val) + '</td><td class="num">' + roasF(o.roas) + '</td><td class="num">' + cpF(o.cpa) + '</td><td class="num">' + nf(Math.round(o.impr)) + '</td><td class="num">' + nf(Math.round(o.ce)) + '</td>';
}

/* ------------------------------------------------------------------ Resumen */

function renderKpis(R, rows) {
  var c = agg(rows), p = R.prev ? agg(filtra(CAMP, R.prev.a, R.prev.b)) : null;
  $('kpis').innerHTML =
    kpiCard('Inversión', copM(c.inv), cmpHTML(c.inv, p && p.inv, copM, null)) +
    kpiCard('Compras', nf(Math.round(c.comp)), cmpHTML(c.comp, p && p.comp, function (v) { return nf(Math.round(v)); }, 'sube')) +
    kpiCard('Valor de compras', copM(c.val), cmpHTML(c.val, p && p.val, copM, 'sube')) +
    kpiCard('ROAS de Meta', roasF(c.roas), '<div class="kpi-sub">Meta de retorno: ' + roasF(META_ROAS) + ' (sobre Shopify)</div>' + cmpHTML(c.roas, p && p.roas, roasF, 'sube')) +
    kpiCard('Costo por compra', cpF(c.cpa), cmpHTML(c.cpa, p && p.cpa, cop, 'baja'));
}

function renderEmbudo(R) {
  // el embudo del pixel solo tiene sentido en las campañas de compras
  var c = agg(CAMP.filter(function (r) { return r.d >= R.a && r.d <= R.b && r.obj === 'OUTCOME_SALES'; }));
  var pasos = [['Clics en enlace', c.ce], ['Visitas a la página', c.vis], ['Ver contenido', c.vc], ['Añadir al carrito', c.atc], ['Pagos iniciados', c.pag], ['Compras', c.comp]];
  var max = Math.max.apply(null, pasos.map(function (p) { return p[1]; })) || 1;
  $('embudo').innerHTML = pasos.map(function (p, i) {
    var ant = i > 0 ? pasos[i - 1][1] : null;
    return '<div class="fn-row"><div class="fn-lbl">' + p[0] + '</div><div class="fn-track"><div class="fn-bar" style="width:' + Math.max(1.5, p[1] / max * 100) + '%;background:' + UI.ramp[Math.min(Math.floor(i * 4 / 6), 3)] + '"></div></div>' +
      '<div class="fn-num"><b>' + nf(Math.round(p[1])) + '</b></div><div class="fn-pct">' + (ant ? pctF(ant > 0 ? p[1] / ant * 100 : null) + ' del paso anterior' : '') + '</div>' +
      '<div class="fn-cost">' + (p[1] > 0 ? 'Costo de esta etapa: <b>' + cop(c.inv / p[1]) + '</b>' : '—') + '</div></div>';
  }).join('');
  $('embudoNota').textContent = 'Solo campañas de compras del periodo (' + copM(c.inv) + ' de inversión). Los eventos vienen del pixel de Meta y pueden diferir de los de Shopify (por ejemplo, «Ver contenido» puede superar a «Visitas a la página»).';
}

function renderEvolucion(rows) {
  var m = {}, objs = {};
  rows.forEach(function (r) {
    var b = bucket(r.d), o = m[b] || (m[b] = { inv: 0, val: 0, comp: 0, porObj: {} });
    o.inv += r.inv; o.val += r.val; o.comp += r.comp; o.porObj[r.obj] = (o.porObj[r.obj] || 0) + r.inv; objs[r.obj] = 1;
  });
  var ks = Object.keys(m).sort(), lbl = ks.map(lblBucket), cols = [UI.s1, UI.s2, UI.s3, UI.otro];
  dibuja('chInv', { type: 'bar', data: { labels: lbl, datasets: Object.keys(objs).sort(ordenObj).map(function (o, i) {
    return { label: objN(o), data: ks.map(function (k) { return m[k].porObj[o] || 0; }), backgroundColor: cols[Math.min(i, 3)], stack: 'a' };
  }) }, options: { responsive: true, maintainAspectRatio: false, scales: { x: Object.assign({ stacked: true }, ejeX), y: Object.assign(ejeY(copM), { stacked: true }) }, plugins: tipo(cop) } });
  dibuja('chVal', { type: 'bar', data: { labels: lbl, datasets: [
    { label: 'Inversión', data: ks.map(function (k) { return m[k].inv; }), backgroundColor: UI.s2 },
    { label: 'Valor de compras', data: ks.map(function (k) { return m[k].val; }), backgroundColor: UI.s1 }] }, options: opc(ejeY(copM), { plugins: tipo(cop) }) });
  dibuja('chRoas', { type: 'line', data: { labels: lbl, datasets: [{ label: 'ROAS', data: ks.map(function (k) { return m[k].inv > 0 && m[k].val > 0 ? m[k].val / m[k].inv : null; }), borderColor: UI.s1, backgroundColor: UI.s1, spanGaps: true },
    { label: 'Meta', data: ks.map(function () { return META_ROAS; }), borderColor: UI.s2, backgroundColor: UI.s2, borderDash: [6, 4], borderWidth: 1.5 }] },
    options: opc(ejeY(function (v) { return nf(v, 1) + 'x'; }), { plugins: tipo(roasF) }) });
  dibuja('chComp', { type: 'bar', data: { labels: lbl, datasets: [{ label: 'Compras', data: ks.map(function (k) { return Math.round(m[k].comp); }), backgroundColor: UI.s3 }] },
    options: opc(ejeY(function (v) { return nf(v); }), { plugins: sinLeyenda(nf) }) });
  dibuja('chCostos', { type: 'line', data: { labels: lbl, datasets: [
    { label: 'Costo por compra', data: ks.map(function (k) { return m[k].comp > 0 ? m[k].inv / m[k].comp : null; }), borderColor: UI.s1, backgroundColor: UI.s1, spanGaps: true }] },
    options: opc(ejeY(copM), { plugins: sinLeyenda(cop) }) });
}

function renderPorObjetivo(rows) {
  var tot = agg(rows).inv, T = {};
  rows.forEach(function (r) { var o = T[r.obj] || (T[r.obj] = { obj: r.obj, rows: [] }); o.rows.push(r); });
  var h = Object.keys(T).sort(ordenObj).map(function (k) { var c = agg(T[k].rows); return '<tr><td>' + pillObj(k) + '</td>' + tdMetricas(c, tot) + '</tr>'; }).join('');
  if (h) h += '<tr class="tr-total"><td>Total</td>' + tdMetricas(agg(rows), tot) + '</tr>';
  $('tObj').innerHTML = h || '<tr><td colspan="9">Sin datos en este periodo.</td></tr>';
}

/* Serie diaria del mes (días 1..dia) para el sparkline de las tarjetas */
function serieMes(mes, dia, fn) { // el día en curso va incompleto: no entra a la línea
  var h = new Date(), hoy = h.getFullYear() + '-' + p2(h.getMonth() + 1) + '-' + p2(h.getDate()), v = [];
  for (var i = 1; i <= dia; i++) if (mes + '-' + p2(i) !== hoy) v.push(fn(mes + '-' + p2(i)));
  return v;
}

/* Ritmo del mes en curso: acumulado, proyección al ritmo diario y mes anterior. No depende del rango ni del filtro de objetivo. */
function renderRitmo() {
  var el = $('ritmo');
  var mes = MAXD.slice(0, 7), dia = +MAXD.slice(8), dim = new Date(+mes.slice(0, 4), +mes.slice(5, 7), 0).getDate();
  var pm = new Date(+mes.slice(0, 4), +mes.slice(5, 7) - 2, 1), pk = pm.getFullYear() + '-' + p2(pm.getMonth() + 1), pdim = new Date(pm.getFullYear(), pm.getMonth() + 1, 0).getDate();
  var cur = agg(CAMP.filter(function (r) { return r.d >= mes + '-01' && r.d <= MAXD; })), prv = agg(CAMP.filter(function (r) { return r.d >= pk + '-01' && r.d <= pk + '-' + p2(pdim); }));
  var f = dim / dia, pInv = cur.inv * f, pComp = cur.comp * f;
  var pres = PRESUPUESTO ? '<div class="kpi-cmp">Presupuesto <b>' + copM(PRESUPUESTO) + '</b> · gastado <b>' + pctF(cur.inv / PRESUPUESTO * 100) + '</b></div><div class="ritmo-bar pres"><div style="width:' + Math.min(100, cur.inv / PRESUPUESTO * 100) + '%"></div></div>' : '';
  el.innerHTML =
    kpiCard(mesNombre(mes) + ' acumulado', copM(cur.inv), '<div class="kpi-sub">Inversión · ' + dia + ' de ' + dim + ' días</div><div class="ritmo-bar"><div style="width:' + (dia / dim * 100) + '%"></div></div>' +
      '<div class="kpi-cmp"><b>' + nf(Math.round(cur.comp)) + '</b> compras · ROAS <b>' + roasF(cur.roas) + '</b></div>' + pres + UI.spark(serieMes(mes, dia, function (d) { return CAMP.reduce(function (t, r) { return r.d === d ? t + r.inv : t; }, 0); }))) +
    kpiCard('Proyección a fin de mes', copM(pInv), '<div class="kpi-sub">Inversión al ritmo de los ' + dia + ' días</div><div class="kpi-cmp"><b>' + nf(Math.round(pComp)) + '</b> compras</div>' +
      (PRESUPUESTO ? cmpHTML(pInv, PRESUPUESTO, copM, null, 'Frente al presupuesto') : '') + (prv.inv > 0 ? cmpHTML(pInv, prv.inv, copM, null, 'Frente a ' + MESES_N[+pk.slice(5) - 1].toLowerCase()) : '')) +
    kpiCard(mesNombre(pk) + ' completo', copM(prv.inv), '<div class="kpi-sub">Inversión</div><div class="kpi-cmp"><b>' + nf(Math.round(prv.comp)) + '</b> compras · ROAS <b>' + roasF(prv.roas) + '</b></div>');
}

/* Tabla mes a mes (desplegable: mes → objetivo → campaña). Todo el histórico; no usa los filtros. */
function renderMeses() {
  var M = {};
  CAMP.forEach(function (r) {
    var m = r.d.slice(0, 7), o = M[m] || (M[m] = { rows: [], obj: {} });
    o.rows.push(r);
    var ob = o.obj[r.obj] || (o.obj[r.obj] = { rows: [], camp: {} }); ob.rows.push(r);
    var c = ob.camp[r.camp] || (ob.camp[r.camp] = []); c.push(r);
  });
  var meses = Object.keys(M).sort().reverse();
  if (!meses.length) { $('tMeses').innerHTML = '<tr><td colspan="9">Sin datos.</td></tr>'; return; }
  if (!renderMeses.listo) { OPEN['M' + meses[0]] = true; renderMeses.listo = true; }
  var tog = function (id) { return '<span class="tog' + (OPEN[id] ? ' open' : '') + '">▶</span>'; };
  var h = '';
  meses.forEach(function (mes) {
    var o = M[mes], id = 'M' + mes, c = agg(o.rows), dim = new Date(+mes.slice(0, 4), +mes.slice(5, 7), 0).getDate(), nota = '';
    if (mes === MAXD.slice(0, 7) && +MAXD.slice(8) < dim) nota = ' <span class="t-mute">(al ' + (+MAXD.slice(8)) + ')</span>';
    h += '<tr class="lv1" data-id="' + id + '"><td>' + tog(id) + mesNombre(mes) + nota + '</td>' + tdMetricas(c, 0) + '</tr>';
    Object.keys(o.obj).sort(ordenObj).forEach(function (ob) {
      var cid = id + '|' + ob, oc = !!OPEN[id], co = agg(o.obj[ob].rows);
      h += '<tr class="lv2' + (oc ? '' : ' hidden') + '" data-id="' + cid + '"><td>' + tog(cid) + pillObj(ob) + ' <span class="t-mute">' + Object.keys(o.obj[ob].camp).length + ' campañas</span></td>' + tdMetricas(co, c.inv) + '</tr>';
      Object.keys(o.obj[ob].camp).sort(function (x, y) { return agg(o.obj[ob].camp[y]).inv - agg(o.obj[ob].camp[x]).inv; }).forEach(function (cn) {
        h += '<tr class="lv3' + (oc && OPEN[cid] ? '' : ' hidden') + '"><td class="tx">' + esc(cn) + '</td>' + tdMetricas(agg(o.obj[ob].camp[cn]), co.inv) + '</tr>';
      });
    });
  });
  h += '<tr class="tr-total"><td>Total</td>' + tdMetricas(agg(CAMP), 0) + '</tr>';
  $('tMeses').innerHTML = h;
}

function renderResumen(R) {
  var rows = filtra(CAMP, R.a, R.b);
  renderKpis(R, rows);
  $('nota').innerHTML = '<b>Cómo leer las cifras.</b> Lo entrega Meta sin homologar, con la atribución por defecto de Ads Manager (la misma de la bitácora). Compras y valor son del pixel (<code>fb_pixel_purchase</code>); ' +
    'el alcance no se suma entre días, por eso no hay un alcance total del periodo.';
  renderMeses();
  renderRitmo();
  renderEmbudo(R);
  renderEvolucion(rows);
  renderPorObjetivo(rows);
}

/* ------------------------------------------------------------------ Campañas (objetivo → campaña → conjunto → anuncio) */

var plural = function (n, a, b) { return n + ' ' + (n === 1 ? a : b); };
var sortC = { k: 'inv', dir: -1 };
var COLS_C = [['label', 'Objetivo · campaña · conjunto · anuncio', 0], ['inv', 'Inversión', 1], ['pct', '% del total', 1], ['comp', 'Compras', 1], ['val', 'Valor', 1], ['roas', 'ROAS', 1], ['cpa', 'Costo/compra', 1],
  ['impr', 'Impresiones', 1], ['ce', 'Clics enlace', 1]];
function renderCampanas(R) {
  if (!ADS) { $('tCamp').innerHTML = '<tr><td colspan="9">' + UI.sk('filas') + '</td></tr>'; return; }
  var q = $('qCamp').value.trim().toLowerCase(), T = {}, tot = [], ids = [], buscando = !!q;
  filtra(ADS, R.a, R.b).forEach(function (r) {
    if (q && (r.camp + ' ' + r.conj + ' ' + r.ad).toLowerCase().indexOf(q) < 0) return;
    tot.push(r);
    var o = T[r.obj] || (T[r.obj] = { label: r.obj, rows: [], h: {} }); o.rows.push(r);
    var c = o.h[r.camp] || (o.h[r.camp] = { label: r.camp, rows: [], h: {} }); c.rows.push(r);
    var j = c.h[r.conj] || (c.h[r.conj] = { label: r.conj, rows: [], h: {} }); j.rows.push(r);
    var a = j.h[r.id] || (j.h[r.id] = { label: r.ad, rows: [], estado: r.estado, h: null }); a.rows.push(r);
  });
  var total = agg(tot).inv;
  var fin = function (o) { var c = agg(o.rows); c.label = o.label; c.pct = total > 0 ? c.inv / total * 100 : 0; c.h = o.h; c.estado = o.estado; return c; };
  var ordena = function (obj, esObj) {
    return Object.keys(obj).map(function (k) { return fin(obj[k]); }).sort(function (a, b) {
      if (esObj) return ordenObj(a.label, b.label);
      var x = a[sortC.k], y = b[sortC.k];
      if (typeof x === 'string') return sortC.dir * x.localeCompare(y);
      return sortC.dir * ((x == null ? -1 : x) - (y == null ? -1 : y));
    });
  };
  var tog = function (id) { return '<span class="tog' + (buscando || OPENC[id] ? ' open' : '') + '">▶</span>'; };
  var abierto = function (id) { return buscando || !!OPENC[id]; };
  var h = '';
  ordena(T, true).forEach(function (o) {
    var oid = 'O' + o.label; ids.push(oid);
    h += '<tr class="lv1" data-id="' + oid + '"><td>' + tog(oid) + pillObj(o.label) + ' <span class="t-mute">' + plural(Object.keys(o.h).length, 'campaña', 'campañas') + '</span></td>' + tdMetricas(o, total) + '</tr>';
    ordena(o.h).forEach(function (c) {
      var cid = oid + '|' + c.label; ids.push(cid);
      h += '<tr class="lv2' + (abierto(oid) ? '' : ' hidden') + '" data-id="' + cid + '"><td class="tx">' + tog(cid) + esc(c.label) + ' <span class="t-mute">' + plural(Object.keys(c.h).length, 'conjunto', 'conjuntos') + '</span></td>' + tdMetricas(c, total) + '</tr>';
      ordena(c.h).forEach(function (j) {
        var jid = cid + '|' + j.label; ids.push(jid);
        h += '<tr class="lv3' + (abierto(oid) && abierto(cid) ? '' : ' hidden') + '" data-id="' + jid + '"><td class="tx">' + tog(jid) + esc(j.label) + ' <span class="t-mute">' + plural(Object.keys(j.h).length, 'anuncio', 'anuncios') + '</span></td>' + tdMetricas(j, total) + '</tr>';
        ordena(j.h).forEach(function (a) {
          h += '<tr class="lv4' + (abierto(oid) && abierto(cid) && abierto(jid) ? '' : ' hidden') + '"><td class="tx">' + esc(a.label) + (a.estado && a.estado !== 'ACTIVE' ? ' <span class="t-mute">' + esc(ESTADO_N[a.estado] || a.estado) + '</span>' : '') + '</td>' + tdMetricas(a, total) + '</tr>';
        });
      });
    });
  });
  if (tot.length) h += '<tr class="tr-total"><td>Total</td>' + tdMetricas(agg(tot), total) + '</tr>';
  $('tCamp').innerHTML = h || '<tr><td colspan="9">Sin campañas con ese filtro.</td></tr>';
  renderCampanas.ids = ids;
  $('hCamp').innerHTML = COLS_C.map(function (c) {
    return '<th class="sortable' + (c[2] ? ' num' : '') + (sortC.k === c[0] ? ' sort-act' : '') + '" data-k="' + c[0] + '">' + c[1] +
      (sortC.k === c[0] ? '<span class="sort-arrow">' + (sortC.dir > 0 ? '▲' : '▼') + '</span>' : '') + '</th>';
  }).join('');
}

/* ------------------------------------------------------------------ Anuncios */

var adLimite = 12, adLista = [];
function renderAnuncios(R) {
  if (!ADS) { $('adGrid').innerHTML = UI.sk('ads'); return; }
  var q = $('qAd').value.trim().toLowerCase(), activos = $('soloActivos').checked, m = {};
  filtra(ADS, R.a, R.b).forEach(function (r) {
    if (q && (r.ad + ' ' + r.camp + ' ' + r.conj).toLowerCase().indexOf(q) < 0) return;
    var o = m[r.id] || (m[r.id] = { id: r.id, ad: r.ad, camp: r.camp, conj: r.conj, obj: r.obj, estado: r.estado, url: r.url, rows: [] });
    o.rows.push(r);
    if (r.url.indexOf('preview_iframe') >= 0) o.url = r.url;
    if (r.estado) o.estado = r.estado;
  });
  var arr = Object.keys(m).map(function (k) { var o = m[k], c = agg(o.rows); Object.keys(c).forEach(function (x) { o[x] = c[x]; }); return o; })
    .filter(function (o) { return o.inv > 0 && (!activos || o.estado === 'ACTIVE'); });
  var ord = $('adOrden').value;
  if (ord === 'roas') arr = arr.filter(function (o) { return o.inv >= 100000 && o.roas != null; });
  arr.sort(function (a, b) { return (b[ord] || 0) - (a[ord] || 0); });
  adLista = arr;
  var tot = arr.reduce(function (t, o) { return t + o.inv; }, 0);
  $('adCaption').textContent = arr.length + ' anuncios con inversión · ' + cop(tot) + ' en total' + (activos ? ' · solo activos' : '') + '. El estado es el de hoy.';
  pintaAds(tot);
}
function pintaAds(tot) {
  var ver = adLista.slice(0, adLimite), max = ver.length ? Math.max.apply(null, ver.map(function (o) { return o.inv; })) : 1;
  $('adGrid').innerHTML = ver.map(function (o) {
    var est = ESTADO_N[o.estado] || o.estado || '—', cls = o.estado === 'ACTIVE' ? 'tag-act' : 'tag-pau';
    return '<div class="ad-card"><div class="ad-prev' + (o.url.indexOf('preview_iframe') >= 0 ? '' : ' sin') + '">' +
      (o.url.indexOf('preview_iframe') >= 0 ? '<iframe src="' + esc(o.url) + '" loading="lazy" scrolling="no" title="' + esc(o.ad) + '"></iframe>' : '<span class="ad-noprev">Meta no entregó vista previa para este anuncio (puede estar borrado).</span>') + '</div>' +
      '<div class="ad-body"><div class="ad-name"><span>' + esc(o.ad) + '</span><span class="tag ' + cls + '">' + esc(est) + '</span></div>' +
      '<div class="ad-meta">' + pillObj(o.obj) + ' ' + esc(o.camp) + ' · ' + esc(o.conj) + '</div>' +
      '<div class="ad-nums"><div><div class="nm-label">Inversión</div><div class="nm-value">' + copM(o.inv) + '</div></div>' +
      '<div><div class="nm-label">Compras</div><div class="nm-value">' + nf(Math.round(o.comp)) + '</div></div>' +
      '<div><div class="nm-label">ROAS</div><div class="nm-value">' + roasF(o.roas) + '</div></div>' +
      '<div><div class="nm-label">Costo/compra</div><div class="nm-value">' + (o.cpa == null ? '—' : copM(o.cpa)) + '</div></div>' +
      '<div><div class="nm-label">CTR enlace</div><div class="nm-value">' + pctF(o.ctr) + '</div></div>' +
      '<div><div class="nm-label">CPM</div><div class="nm-value">' + (o.cpm == null ? '—' : copM(o.cpm)) + '</div></div>' +
      '<div><div class="nm-label">% de la inversión</div><div class="nm-value">' + (tot > 0 ? nf(o.inv / tot * 100, 1) + '%' : '—') + '</div></div></div>' +
      '<div class="ad-share" title="Inversión frente al anuncio que más gastó"><div style="width:' + Math.max(2, o.inv / max * 100) + '%"></div></div></div></div>';
  }).join('') || '<div class="ad-empty">Sin anuncios con ese filtro.</div>';
  $('adMore').style.display = adLista.length > adLimite ? '' : 'none';
}

/* ------------------------------------------------------------------ control general */

var vista = 'resumen';
function render() {
  var R = rango();
  $('rangeLabel').textContent = lblRango(R.a, R.b) + (R.prev ? ' · se compara con ' + lblRango(R.prev.a, R.prev.b) : '') + ' · datos hasta ' + lblDia(MAXD) + ' ' + MAXD.slice(0, 4);
  $('customRange').classList.toggle('show', $('rangeSelect').value === 'custom');
  if (vista === 'resumen') renderResumen(R);
  else if (vista === 'campanas') renderCampanas(R);
  else renderAnuncios(R);
}
function ir(v) {
  vista = v;
  document.querySelectorAll('.main .view').forEach(function (e) { e.classList.toggle('active', e.id === 'view-' + v); });
  document.querySelectorAll('[data-view]').forEach(function (e) { e.classList.toggle('on', e.dataset.view === v); });
  window.scrollTo(0, 0);
  if (v !== 'resumen' && !ADS) {
    render();
    cargarAds().then(render).catch(function (e) {
      var msg = '<div class="error-box">No se pudieron cargar los anuncios: ' + esc(e.message) + '</div>';
      $('adGrid').innerHTML = msg; $('tCamp').innerHTML = '<tr><td colspan="9">' + msg + '</td></tr>';
    });
  } else render();
}
function marcaSeg() { document.querySelectorAll('#seg button').forEach(function (b) { b.classList.toggle('on', b.dataset.g === G); }); }

function init() {
  document.querySelectorAll('[data-view]').forEach(function (e) { e.addEventListener('click', function (ev) { ev.preventDefault(); ir(e.dataset.view); }); });
  ['rangeSelect', 'dateFrom', 'dateTo', 'fObj'].forEach(function (id) { $(id).addEventListener('change', function () { adLimite = 12; render(); }); });
  $('seg').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; G = b.dataset.g; marcaSeg(); render(); });
  $('tMeses').addEventListener('click', function (e) { var tr = e.target.closest('tr[data-id]'); if (!tr) return; OPEN[tr.dataset.id] = !OPEN[tr.dataset.id]; renderMeses(); });
  $('mesAbrir').addEventListener('click', function () { document.querySelectorAll('#tMeses tr[data-id]').forEach(function (tr) { OPEN[tr.dataset.id] = true; }); renderMeses(); });
  $('mesCerrar').addEventListener('click', function () { OPEN = {}; renderMeses(); });
  $('hCamp').addEventListener('click', function (e) {
    var th = e.target.closest('th'); if (!th) return;
    var k = th.dataset.k, numerica = COLS_C.filter(function (c) { return c[0] === k; })[0][2] === 1;
    sortC = { k: k, dir: sortC.k === k ? -sortC.dir : (numerica ? -1 : 1) }; render();
  });
  $('qCamp').addEventListener('input', render);
  $('tCamp').addEventListener('click', function (e) { var tr = e.target.closest('tr[data-id]'); if (!tr) return; OPENC[tr.dataset.id] = !OPENC[tr.dataset.id]; renderCampanas(rango()); });
  $('campAbrir').addEventListener('click', function () { (renderCampanas.ids || []).forEach(function (id) { OPENC[id] = true; }); renderCampanas(rango()); });
  $('campCerrar').addEventListener('click', function () { OPENC = {}; renderCampanas(rango()); });
  $('qAd').addEventListener('input', function () { adLimite = 12; render(); });
  $('soloActivos').addEventListener('change', function () { adLimite = 12; render(); });
  $('adOrden').addEventListener('change', function () { adLimite = 12; render(); });
  $('adMoreBtn').addEventListener('click', function () { adLimite += 12; pintaAds(adLista.reduce(function (t, o) { return t + o.inv; }, 0)); });
  var pi = $('presupuesto');
  if (PRESUPUESTO) pi.value = PRESUPUESTO;
  pi.addEventListener('input', function () {
    var v = parseFloat(String(pi.value).replace(/[^0-9.]/g, ''));
    PRESUPUESTO = v > 0 ? v : null;
    try { if (PRESUPUESTO) localStorage.setItem('mara_presupuesto', String(PRESUPUESTO)); else localStorage.removeItem('mara_presupuesto'); } catch (e) { /* sin almacenamiento */ }
    renderRitmo();
  });
  $('dateFrom').value = MIND; $('dateTo').value = MAXD;
  var dias = diasEntre(rango().a, rango().b);
  G = dias > 100 ? 'm' : dias > 35 ? 's' : 'd';
  marcaSeg();
}

cargarCamp().then(function () {
  init();
  render();
  $('loadScreen').style.display = 'none';
  $('app').style.display = '';
  render(); // con la carcasa visible las gráficas toman su tamaño real
}).catch(function (e) {
  $('loadScreen').innerHTML = '<div class="error-box">No se pudo leer la hoja de Mara: ' + esc(e.message) + '. Revisa que siga compartida con «cualquiera con el enlace».</div>';
});
})();
