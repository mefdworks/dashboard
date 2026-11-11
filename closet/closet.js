/* Panel de pauta Closet. Lee en vivo la hoja «[Closet] Fuente de datos» (gviz/tq, formato JSON: trae el valor crudo,
   no el texto con formato regional) y dibuja Resumen, Campañas y Anuncios. Sin datos embebidos. */
(function () {
'use strict';

var SHEET_ID = '1rjFUyzcgBB8x9KoTLDR-FYLDE9Njwt5fqU0r9Chc8gk';
var HOJA_RG = 'RESUMEN GENERAL';
var HOJA_ADS = 'ANUNCIOS GENERAL';
var HOJA_SHOP = 'SHOPIFY VENTAS';
var $ = function (id) { return document.getElementById(id); };

/* ------------------------------------------------------------------ datos */

function gviz(hoja, tq) {
  var url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:json&sheet=' + encodeURIComponent(hoja) +
    (tq ? '&tq=' + encodeURIComponent(tq) : '') + '&_cb=' + Date.now();
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

var RG = [];      // {d, camp, inv, conv, val, obj, cta, canal, orig}
var ADS = null;   // se carga al abrir Anuncios
var SHOP = [];    // ventas de Shopify por día, con las definiciones de Analytics (netas sin IVA)
var SHOP_DESDE = '';
var SHOPMES = []; // ventas mensuales de Shopify (reporte de Analytics) para los meses anteriores al diario
var MAXD = '', MIND = '';

function cargarRG() {
  return gviz(HOJA_RG).then(function (rows) {
    RG = rows.map(function (r) {
      return { d: fechaClave(r[0]), camp: String(r[1] || ''), inv: num(r[2]), conv: num(r[3]), val: num(r[4]),
        obj: r[6] || '', cta: r[7] || '', canal: r[8] || '', orig: r[9] || '' };
    }).filter(function (r) { return r.d; });
    RG.forEach(function (r) { if (!MAXD || r.d > MAXD) MAXD = r.d; if (!MIND || r.d < MIND) MIND = r.d; });
  });
}
function cargarShop() { // sin Shopify el tablero sigue funcionando: solo se oculta la sección
  return gviz(HOJA_SHOP).then(function (rows) {
    SHOP = rows.map(function (r) {
      return { d: fechaClave(r[0]), ped: num(r[1]), brutas: num(r[2]), desc: num(r[3]), rev: num(r[4]), neto: num(r[5]), envio: num(r[6]), imp: num(r[9]), total: num(r[10]) };
    }).filter(function (r) { return r.d; });
    SHOP.forEach(function (r) { if (!SHOP_DESDE || r.d < SHOP_DESDE) SHOP_DESDE = r.d; });
  }).catch(function () { SHOP = []; });
}
function cargarShopMes() {
  return gviz('SHOPIFY MENSUAL').then(function (rows) {
    SHOPMES = rows.map(function (r) { var f = fechaClave(r[0]); return f ? { m: f.slice(0, 7), ped: num(r[1]), neto: num(r[5]), total: num(r[10]) } : null; }).filter(Boolean);
  }).catch(function () { SHOPMES = []; });
}
function cargarAds() {
  if (ADS) return Promise.resolve();
  return gviz(HOJA_ADS, 'select A,B,C,E,F,G,H,I,J,K,M,N').then(function (rows) {
    ADS = rows.map(function (r) {
      return { d: fechaClave(r[0]), canal: r[1] || '', camp: String(r[2] || ''), ad: String(r[3] || ''), id: String(r[4] || ''),
        inv: num(r[5]), imp: num(r[6]), clics: num(r[7]), conv: num(r[8]), val: num(r[9]), cta: r[10] || '', prev: String(r[11] || '') };
    }).filter(function (r) { return r.d; });
  });
}

/* ------------------------------------------------------------------ formato */

var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var nf = function (n, d) { return n.toLocaleString('es-CO', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); };
var cop = function (n) { return (n < 0 ? '-' : '') + '$' + nf(Math.abs(Math.round(n))); };
var copM = function (n) { return Math.abs(n) >= 1e6 ? '$' + nf(n / 1e6, 1) + ' M' : cop(n); };
var roasF = function (n) { return n == null ? '—' : nf(n, 2) + 'x'; };
var MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function lblDia(k) { return +k.slice(8) + ' ' + MES[+k.slice(5, 7) - 1]; }
function lblMes(k) { return MES[+k.slice(5, 7) - 1] + ' ' + k.slice(2, 4); }
function lblRango(a, b) { return lblDia(a) + ' ' + a.slice(0, 4) + ' → ' + lblDia(b) + ' ' + b.slice(0, 4); }

/* ------------------------------------------------------------------ rango y filtros */

function claveDe(dt) { return dt.getFullYear() + '-' + p2(dt.getMonth() + 1) + '-' + p2(dt.getDate()); }
function sumaDias(k, n) { var dt = new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8) + n); return claveDe(dt); }
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
  var cta = $('fCuenta').value, canal = $('fCanal').value;
  return arr.filter(function (r) { return r.d >= a && r.d <= b && (!cta || r.cta === cta) && (!canal || r.canal === canal); });
}
function agg(rows) {
  var o = { inv: 0, conv: 0, val: 0 };
  rows.forEach(function (r) { o.inv += r.inv; o.conv += r.conv; o.val += r.val; });
  o.roas = o.inv > 0 ? o.val / o.inv : null;
  o.cpa = o.conv > 0 ? o.inv / o.conv : null;
  return o;
}

/* ------------------------------------------------------------------ Resumen */

var G = 'm';           // agrupación de las gráficas: d / s / m
var charts = {};
var OPEN = {};         // filas abiertas de la tabla mes a mes
var MARGEN = null;     // margen bruto estimado (%), solo en este navegador
try { var mg = parseFloat(localStorage.getItem('closet_margen')); if (mg > 0 && mg < 100) MARGEN = mg; } catch (e) { /* sin almacenamiento */ }
var MESES_N = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
var DIAS_N = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
var mesNombre = function (k) { return MESES_N[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4); };

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

function serie(rows) {
  var m = {};
  rows.forEach(function (r) {
    var b = bucket(r.d), o = m[b] || (m[b] = { META: 0, GOOGLE: 0, otro: 0, inv: 0, conv: 0, val: 0 });
    if (r.canal === 'META' || r.canal === 'GOOGLE') o[r.canal] += r.inv; else o.otro += r.inv;
    o.inv += r.inv; o.conv += r.conv; o.val += r.val;
  });
  var ks = Object.keys(m).sort();
  return { ks: ks, lbl: ks.map(lblBucket), m: m };
}

function dibuja(id, cfg) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart($(id), cfg);
}
function quita(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }
var ejeY = function (fmt) { return { beginAtZero: true, grid: { color: UI.grid }, border: { display: false }, ticks: { callback: fmt } }; };
var ejeX = { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } };
var opcBase = function (y, extra) { return Object.assign({ responsive: true, maintainAspectRatio: false, scales: { x: ejeX, y: y } }, extra || {}); };
var tipo = function (fmt) { return { tooltip: { callbacks: { label: function (c) { return ' ' + c.dataset.label + ': ' + fmt(c.parsed.y); } } } }; };

/* Inversión por canal (sí respeta los filtros de cuenta y canal) */
function renderGraficas(rows) {
  var s = serie(rows), conMeta = rows.some(function (r) { return r.canal === 'META'; }), conGoogle = rows.some(function (r) { return r.canal === 'GOOGLE'; });
  var ds = [];
  if (conMeta) ds.push({ label: 'Meta', data: s.ks.map(function (k) { return s.m[k].META; }), backgroundColor: UI.s1, stack: 'a' });
  if (conGoogle) ds.push({ label: 'Google', data: s.ks.map(function (k) { return s.m[k].GOOGLE; }), backgroundColor: UI.s2, stack: 'a' });
  dibuja('chInv', { type: 'bar', data: { labels: s.lbl, datasets: ds },
    options: { responsive: true, maintainAspectRatio: false, scales: { x: Object.assign({ stacked: true }, ejeX), y: Object.assign(ejeY(copM), { stacked: true }) }, plugins: tipo(cop) } });
}

function tablaGrupo(rows, keyFn) {
  var m = {};
  rows.forEach(function (r) {
    var k = keyFn(r), o = m[k] || (m[k] = { k: k, r: r, inv: 0, conv: 0, val: 0 });
    o.inv += r.inv; o.conv += r.conv; o.val += r.val;
  });
  return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.inv - a.inv; });
}
function filaMetricas(o, total) {
  var roas = o.inv > 0 ? o.val / o.inv : null, cpa = o.conv > 0 ? o.inv / o.conv : null;
  return '<td class="num">' + cop(o.inv) + '</td><td class="num">' + (total > 0 ? nf(o.inv / total * 100, 1) + '%' : '—') + '</td><td class="num">' + nf(Math.round(o.conv)) +
    '</td><td class="num">' + cop(o.val) + '</td><td class="num">' + roasF(roas) + '</td><td class="num">' + (cpa == null ? '—' : cop(cpa)) + '</td>';
}
var pillCanal = function (c) { return '<span class="pill-c ' + String(c).toLowerCase() + '">' + esc(c || '—') + '</span>'; };

function renderTablas(rows) {
  var tot = agg(rows).inv;
  var g1 = tablaGrupo(rows, function (r) { return r.cta + '|' + r.canal; });
  $('tCuenta').innerHTML = g1.map(function (o) { return '<tr><td><b>' + esc(o.r.cta || 'Sin cuenta') + '</b></td><td>' + pillCanal(o.r.canal) + '</td>' + filaMetricas(o, tot) + '</tr>'; }).join('') +
    (g1.length ? '<tr class="tr-total"><td>Total</td><td></td>' + filaMetricas(agg(rows), tot) + '</tr>' : '<tr><td colspan="8">Sin datos en este periodo.</td></tr>');
  var g2 = tablaGrupo(rows, function (r) { return r.obj; });
  $('tObj').innerHTML = g2.map(function (o) { return '<tr><td><b>' + esc(o.r.obj || 'Sin objetivo') + '</b></td>' + filaMetricas(o, tot) + '</tr>'; }).join('') ||
    '<tr><td colspan="7">Sin datos en este periodo.</td></tr>';
}

/* ------------------------------------------------------------------ Ventas reales (Shopify) */

/* Salen del reporte «Ventas totales» de Shopify Analytics (netas = sin IVA). Shopify no separa por cuenta ni por canal: el ROAS real divide por la
   inversión de Meta y Google juntas, y el filtro de cuenta oculta estas secciones. */
function sumaShop(x, y) {
  var o = { ped: 0, brutas: 0, desc: 0, rev: 0, neto: 0, envio: 0, imp: 0, total: 0 };
  SHOP.forEach(function (r) { if (r.d >= x && r.d <= y) Object.keys(o).forEach(function (k) { o[k] += r[k]; }); });
  return o;
}
function bloqueDe(x, y) { // ventas de Shopify + pauta total de Meta y Google en [x, y]
  var s = sumaShop(x, y), p = agg(RG.filter(function (r) { return r.d >= x && r.d <= y; }));
  s.inv = p.inv; s.val = p.val; s.conv = p.conv;
  s.roas = p.inv > 0 ? s.neto / p.inv : null; s.roasPl = p.inv > 0 ? p.val / p.inv : null;
  s.ticket = s.ped > 0 ? s.neto / s.ped : null; s.cpp = s.ped > 0 ? p.inv / s.ped : null; s.pct = s.neto > 0 ? p.inv / s.neto * 100 : null;
  return s;
}
var pctF = function (n) { return n == null ? '—' : nf(n, 1) + '%'; };

function renderRentab(c) {
  var out = $('rentabOut');
  if (!c) { out.innerHTML = ''; return; }
  if (!MARGEN) { out.innerHTML = '<div class="nota" style="margin:0">Escribe tu margen bruto para ver el ROAS de equilibrio y la utilidad después de pauta. Se guarda solo en este navegador.</div>'; return; }
  var be = 100 / MARGEN, util = c.neto * MARGEN / 100 - c.inv;
  out.innerHTML = '<div class="kpi-grid">' +
    kpiCard('ROAS de equilibrio', roasF(be), '<div class="kpi-sub">Con ' + nf(MARGEN, 0) + '% de margen, por debajo de esto la pauta pierde plata. El ROAS real es ' + roasF(c.roas) + '.</div>') +
    kpiCard('Utilidad bruta después de pauta', copM(util), '<div class="kpi-sub">Ventas netas × margen − inversión, del periodo.</div>') +
    kpiCard('Utilidad por pedido', c.ped > 0 ? cop(util / c.ped) : '—', '<div class="kpi-sub">Después de pagar la pauta.</div>') +
    kpiCard('Margen después de pauta', c.neto > 0 ? pctF(util / c.neto * 100) : '—', '<div class="kpi-sub">Sobre ventas netas.</div>') + '</div>';
}

function renderShop(R) {
  var bloque = $('bloqueShop'), tabla = $('bloqueVentas');
  var setEvol = function (v) { $('evolShop').style.display = v; $('evolShop2').style.display = v; };
  if (!SHOP.length) { bloque.style.display = 'none'; setEvol('none'); tabla.style.display = 'none'; renderRentab(null); return; }
  bloque.style.display = '';
  var cta = $('fCuenta').value, canal = $('fCanal').value, a = R.a > SHOP_DESDE ? R.a : SHOP_DESDE, nota = $('notaShop');
  var oculta = function (msg) {
    $('kpisShop').innerHTML = ''; $('tVentas').innerHTML = ''; nota.innerHTML = msg; setEvol('none'); tabla.style.display = 'none';
    ['chReal', 'chRoasReal', 'chPedidos', 'chCpp', 'chDow'].forEach(quita); renderRentab(null);
  };
  if (cta) { oculta('<b>Shopify no separa por cuenta.</b> Las ventas de la tienda no distinguen Closet, Kids y Women: elige «Todas las cuentas» para ver las ventas reales y el ROAS real.'); return; }
  if (a > R.b) { oculta('Shopify solo tiene datos desde el ' + lblDia(SHOP_DESDE) + ' ' + SHOP_DESDE.slice(0, 4) + '; este rango es anterior.'); return; }
  setEvol('contents'); tabla.style.display = '';
  var c = bloqueDe(a, R.b), pv = (R.prev && R.prev.a >= SHOP_DESDE) ? bloqueDe(R.prev.a, R.prev.b) : null;
  $('kpisShop').innerHTML =
    kpiCard('Ventas netas', copM(c.neto), cmpHTML(c.neto, pv && pv.neto, copM, 'sube')) +
    kpiCard('Pedidos', nf(c.ped), cmpHTML(c.ped, pv && pv.ped, nf, 'sube')) +
    kpiCard('Ticket promedio', c.ticket == null ? '—' : cop(c.ticket), cmpHTML(c.ticket, pv && pv.ticket, cop, null)) +
    kpiCard('ROAS real', roasF(c.roas), cmpHTML(c.roas, pv && pv.roas, roasF, 'sube')) +
    kpiCard('Pauta como % de las ventas', pctF(c.pct), cmpHTML(c.pct, pv && pv.pct, pctF, 'baja')) +
    kpiCard('Costo por pedido', c.cpp == null ? '—' : cop(c.cpp), cmpHTML(c.cpp, pv && pv.cpp, cop, 'baja'));
  var texto = '<b>ROAS real = ventas netas de Shopify ÷ inversión de pauta (Meta y Google juntas).</b> Las cifras son las del reporte «Ventas totales» de Shopify Analytics: ' +
    'las ventas netas van sin IVA (brutas menos descuentos y reversiones) y las ventas totales suman envío e impuestos. ' +
    'Con estas ventas, las plataformas reportan un ROAS de <b>' + roasF(c.roasPl) + '</b>' +
    (c.roas && c.roasPl ? ', ' + nf(Math.abs(c.roasPl / c.roas - 1) * 100, 0) + '% ' + (c.roasPl > c.roas ? 'por encima' : 'por debajo') + ' del real.' : '.');
  if (a > R.a) texto += ' <b>Shopify solo cubre desde el ' + lblDia(SHOP_DESDE) + ' ' + SHOP_DESDE.slice(0, 4) + '</b>: estas cifras y la pauta con la que se comparan empiezan ahí.';
  if (canal) texto += ' El filtro de canal no aplica a estas cifras: Shopify no distingue por canal.';
  nota.innerHTML = texto;
  renderRentab(c);

  var filas = [['Ventas brutas', 'brutas'], ['Descuentos', 'desc'], ['Reversiones de ventas', 'rev'], ['Ventas netas', 'neto'], ['Cargos de envío', 'envio'], ['Impuestos', 'imp'], ['Ventas totales', 'total']];
  $('tVentas').innerHTML = filas.map(function (f) {
    var k = f[1], v = c[k], pr = pv ? pv[k] : null, d = pr ? (Math.abs(v) - Math.abs(pr)) / Math.abs(pr) * 100 : null, fuerte = (k === 'neto' || k === 'total'); // cambio sobre el monto: descuentos y reversiones son negativos
    return '<tr' + (fuerte ? ' class="tr-total"' : '') + '><td>' + f[0] + '</td><td class="num">' + cop(v) + '</td><td class="num">' + (pr == null ? '—' : cop(pr)) +
      '</td><td class="num">' + (d == null ? '—' : (d > 0 ? '▲ ' : d < 0 ? '▼ ' : '') + nf(Math.abs(d), 0) + '%') + '</td></tr>';
  }).join('');

  // gráficas por día, semana o mes
  var m = {};
  var cel = function (b) { return m[b] || (m[b] = { neto: 0, ped: 0, val: 0, inv: 0, conv: 0 }); };
  SHOP.forEach(function (r) { if (r.d >= a && r.d <= R.b) { var o = cel(bucket(r.d)); o.neto += r.neto; o.ped += r.ped; } });
  RG.forEach(function (r) { if (r.d >= a && r.d <= R.b) { var o = cel(bucket(r.d)); o.val += r.val; o.inv += r.inv; o.conv += r.conv; } });
  var ks = Object.keys(m).sort(), lbl = ks.map(lblBucket);
  dibuja('chReal', { type: 'bar', data: { labels: lbl, datasets: [
    { label: 'Ventas netas Shopify', data: ks.map(function (k) { return m[k].neto; }), backgroundColor: UI.s1 },
    { label: 'Valor según plataformas', data: ks.map(function (k) { return m[k].val; }), backgroundColor: UI.s2 }] },
    options: opcBase(ejeY(copM), { plugins: tipo(cop) }) });
  var dsRoas = [
    { label: 'ROAS real', data: ks.map(function (k) { return m[k].inv > 0 ? m[k].neto / m[k].inv : null; }), borderColor: UI.s1, backgroundColor: UI.s1, spanGaps: true },
    { label: 'ROAS plataformas', data: ks.map(function (k) { return m[k].inv > 0 ? m[k].val / m[k].inv : null; }), borderColor: UI.s2, backgroundColor: UI.s2, spanGaps: true }];
  if (MARGEN) dsRoas.push({ label: 'ROAS de equilibrio (' + nf(MARGEN, 0) + '% de margen)', data: ks.map(function () { return 100 / MARGEN; }), borderColor: UI.s3, backgroundColor: UI.s3, borderDash: [6, 4], pointRadius: 0, pointHoverRadius: 0 });
  dibuja('chRoasReal', { type: 'line', data: { labels: lbl, datasets: dsRoas }, options: opcBase(ejeY(function (v) { return nf(v, 1) + 'x'; }), { plugins: tipo(roasF) }) });
  dibuja('chPedidos', { type: 'bar', data: { labels: lbl, datasets: [
    { label: 'Pedidos Shopify', data: ks.map(function (k) { return m[k].ped; }), backgroundColor: UI.s1 },
    { label: 'Compras según plataformas', data: ks.map(function (k) { return Math.round(m[k].conv); }), backgroundColor: UI.s2 }] },
    options: opcBase(ejeY(function (v) { return nf(v); }), { plugins: tipo(nf) }) });
  dibuja('chCpp', { type: 'line', data: { labels: lbl, datasets: [
    { label: 'Costo por pedido', data: ks.map(function (k) { return m[k].ped > 0 ? m[k].inv / m[k].ped : null; }), borderColor: UI.s1, backgroundColor: UI.s1, spanGaps: true }] },
    options: opcBase(ejeY(copM), { plugins: Object.assign({ legend: { display: false } }, tipo(cop)) }) });
  // ventas netas promedio por día de la semana
  var sum = [0, 0, 0, 0, 0, 0, 0], cnt = [0, 0, 0, 0, 0, 0, 0];
  SHOP.forEach(function (r) {
    if (r.d < a || r.d > R.b) return;
    var dow = (new Date(+r.d.slice(0, 4), +r.d.slice(5, 7) - 1, +r.d.slice(8)).getDay() + 6) % 7;
    sum[dow] += r.neto; cnt[dow]++;
  });
  dibuja('chDow', { type: 'bar', data: { labels: DIAS_N, datasets: [{ label: 'Ventas netas promedio por día', data: sum.map(function (v, i) { return cnt[i] ? v / cnt[i] : 0; }), backgroundColor: UI.s1 }] },
    options: opcBase(ejeY(copM), { plugins: Object.assign({ legend: { display: false } }, tipo(cop)) }) });
}

/* Ritmo del mes en curso: acumulado, proyección al ritmo diario y mes anterior. No depende del rango ni de los filtros. */
function renderRitmo() {
  var el = $('ritmo');
  if (!SHOP.length) { el.innerHTML = ''; return; }
  var mes = MAXD.slice(0, 7), dia = +MAXD.slice(8), dim = new Date(+mes.slice(0, 4), +mes.slice(5, 7), 0).getDate();
  var pm = new Date(+mes.slice(0, 4), +mes.slice(5, 7) - 2, 1), pk = pm.getFullYear() + '-' + p2(pm.getMonth() + 1), pdim = new Date(pm.getFullYear(), pm.getMonth() + 1, 0).getDate();
  var cur = bloqueDe(mes + '-01', MAXD), prv = pk >= SHOP_DESDE.slice(0, 7) ? bloqueDe(pk + '-01', pk + '-' + p2(pdim)) : null, f = dim / dia;
  var pInv = cur.inv * f, pNeto = cur.neto * f, pPed = cur.ped * f;
  el.innerHTML =
    kpiCard(mesNombre(mes) + ' acumulado', copM(cur.neto), '<div class="kpi-sub">Ventas netas · ' + dia + ' de ' + dim + ' días</div><div class="ritmo-bar"><div style="width:' + (dia / dim * 100) + '%"></div></div>' +
      '<div class="kpi-cmp">Inversión <b>' + copM(cur.inv) + '</b> · ROAS real <b>' + roasF(cur.roas) + '</b> · ' + nf(cur.ped) + ' pedidos</div>') +
    kpiCard('Proyección a fin de mes', copM(pNeto), '<div class="kpi-sub">Ventas netas al ritmo de los ' + dia + ' días</div>' +
      '<div class="kpi-cmp">Inversión <b>' + copM(pInv) + '</b> · ' + nf(Math.round(pPed)) + ' pedidos</div>' +
      (prv ? cmpHTML(pNeto, prv.neto, copM, 'sube', 'Frente a ' + mesNombre(pk).split(' ')[0].toLowerCase()) : '')) +
    kpiCard(prv ? mesNombre(pk) + ' completo' : 'Mes anterior', prv ? copM(prv.neto) : '—', prv ? '<div class="kpi-sub">Ventas netas</div><div class="kpi-cmp">Inversión <b>' + copM(prv.inv) + '</b> · ROAS real <b>' + roasF(prv.roas) + '</b> · ' + nf(prv.ped) + ' pedidos</div>' : '');
}

/* ------------------------------------------------------------------ Tabla mes a mes (desplegable: mes → canal → cuenta) */

function renderMeses() {
  var M = {};
  RG.forEach(function (r) {
    var m = r.d.slice(0, 7), o = M[m] || (M[m] = { inv: 0, conv: 0, val: 0, c: {}, first: r.d });
    o.inv += r.inv; o.conv += r.conv; o.val += r.val; if (r.d < o.first) o.first = r.d;
    var c = o.c[r.canal] || (o.c[r.canal] = { inv: 0, conv: 0, val: 0, a: {} }); c.inv += r.inv; c.conv += r.conv; c.val += r.val;
    var a = c.a[r.cta] || (c.a[r.cta] = { inv: 0, conv: 0, val: 0 }); a.inv += r.inv; a.conv += r.conv; a.val += r.val;
  });
  var S = {}; // ventas de Shopify por mes: diario desde SHOP_DESDE; antes, el reporte mensual
  SHOP.forEach(function (r) { var m = r.d.slice(0, 7), o = S[m] || (S[m] = { ped: 0, neto: 0, total: 0 }); o.ped += r.ped; o.neto += r.neto; o.total += r.total; });
  SHOPMES.forEach(function (r) { if (r.m < SHOP_DESDE.slice(0, 7)) S[r.m] = { ped: r.ped, neto: r.neto, total: r.total }; });
  var meses = Object.keys(M).sort().reverse();
  if (!meses.length) { $('tMeses').innerHTML = '<tr><td colspan="11">Sin datos.</td></tr>'; return; }
  if (!renderMeses.listo) { OPEN['M' + meses[0]] = true; renderMeses.listo = true; }

  var num2 = function (v) { return v == null ? '<td class="num t-mute">—</td>' : '<td class="num">' + v + '</td>'; };
  var pl = function (o) { return '<td class="num">' + cop(o.inv) + '</td>'; };
  var plRest = function (o) { return '<td class="num">' + nf(Math.round(o.conv)) + '</td><td class="num">' + cop(o.val) + '</td><td class="num">' + roasF(o.inv > 0 ? o.val / o.inv : null) + '</td>'; };
  var vacio = '<td class="num t-mute">—</td><td class="num t-mute">—</td><td class="num t-mute">—</td><td class="num t-mute">—</td><td class="num t-mute">—</td>';
  var sh = function (s, inv) {
    if (!s) return vacio;
    return '<td class="num">' + cop(s.neto) + '</td><td class="num">' + cop(s.total) + '</td><td class="num">' + nf(s.ped) + '</td><td class="num">' + roasF(inv > 0 ? s.neto / inv : null) + '</td><td class="num">' + pctF(s.neto > 0 ? inv / s.neto * 100 : null) + '</td>';
  };
  var tog = function (id) { return '<span class="tog' + (OPEN[id] ? ' open' : '') + '">▶</span>'; };
  var tG = { inv: 0, conv: 0, val: 0 }, tS = { neto: 0, total: 0, ped: 0, inv: 0 }, h = '';
  meses.forEach(function (mes) {
    var o = M[mes], id = 'M' + mes, s = S[mes], dim = new Date(+mes.slice(0, 4), +mes.slice(5, 7), 0).getDate(), nota = '';
    if (mes === MAXD.slice(0, 7) && +MAXD.slice(8) < dim) nota = ' <span class="t-mute">(al ' + (+MAXD.slice(8)) + ')</span>';
    else if (+o.first.slice(8) > 1) nota = ' <span class="t-mute">(pauta desde el ' + (+o.first.slice(8)) + ')</span>';
    tG.inv += o.inv; tG.conv += o.conv; tG.val += o.val;
    if (s) { tS.neto += s.neto; tS.total += s.total; tS.ped += s.ped; tS.inv += o.inv; }
    h += '<tr class="lv1" data-id="' + id + '"><td>' + tog(id) + mesNombre(mes) + nota + '</td>' + pl(o) + '<td class="num t-mute">—</td>' + plRest(o) + sh(s, o.inv) + '</tr>';
    ['META', 'GOOGLE'].concat(Object.keys(o.c).filter(function (k) { return k !== 'META' && k !== 'GOOGLE'; })).forEach(function (cn) {
      var c = o.c[cn]; if (!c) return;
      var cid = id + '|' + cn, oc = !!OPEN[id];
      h += '<tr class="lv2' + (oc ? '' : ' hidden') + '" data-id="' + cid + '"><td>' + tog(cid) + pillCanal(cn) + '</td>' + pl(c) + '<td class="num">' + nf(o.inv > 0 ? c.inv / o.inv * 100 : 0, 1) + '%</td>' + plRest(c) + vacio + '</tr>';
      Object.keys(c.a).sort(function (x, y) { return c.a[y].inv - c.a[x].inv; }).forEach(function (cu) {
        var a = c.a[cu];
        h += '<tr class="lv3' + (oc && OPEN[cid] ? '' : ' hidden') + '"><td>' + esc(cu || 'Sin cuenta') + '</td>' + pl(a) + '<td class="num">' + nf(o.inv > 0 ? a.inv / o.inv * 100 : 0, 1) + '%</td>' + plRest(a) + vacio + '</tr>';
      });
    });
  });
  var conS = tS.inv > 0;
  h += '<tr class="tr-total"><td>Total</td>' + pl(tG) + '<td class="num"></td>' + plRest(tG) +
    (conS ? '<td class="num">' + cop(tS.neto) + '</td><td class="num">' + cop(tS.total) + '</td><td class="num">' + nf(tS.ped) + '</td><td class="num">' + roasF(tS.neto / tS.inv) + '</td><td class="num">' + pctF(tS.inv / tS.neto * 100) + '</td>' : vacio) + '</tr>';
  $('tMeses').innerHTML = h;
}

function renderResumen(R) {
  var rows = filtra(RG, R.a, R.b), cur = agg(rows);
  var prev = R.prev ? agg(filtra(RG, R.prev.a, R.prev.b)) : null;
  $('kpis').innerHTML =
    kpiCard('Inversión', copM(cur.inv), cmpHTML(cur.inv, prev && prev.inv, copM, null)) +
    kpiCard('Compras', nf(Math.round(cur.conv)), cmpHTML(cur.conv, prev && prev.conv, function (v) { return nf(Math.round(v)); }, 'sube')) +
    kpiCard('Valor de compras', copM(cur.val), cmpHTML(cur.val, prev && prev.val, copM, 'sube')) +
    kpiCard('ROAS de plataforma', roasF(cur.roas), cmpHTML(cur.roas, prev && prev.roas, roasF, 'sube')) +
    kpiCard('Costo por compra', cur.cpa == null ? '—' : cop(cur.cpa), cmpHTML(cur.cpa, prev && prev.cpa, cop, 'baja'));
  // En Google, las filas de la hoja anterior (Porter) cuentan todas las conversiones, no solo compras: el ROAS de esa parte sobrestima.
  var viejoG = rows.some(function (r) { return r.orig === 'VIEJA' && r.canal === 'GOOGLE'; });
  var n = $('notaGoogle');
  n.style.display = viejoG ? '' : 'none';
  n.innerHTML = viejoG ? '<b>Ojo con Google antes del 17 de mayo.</b> Esos días vienen de la hoja anterior, que contaba todas las conversiones y no solo las compras; el ROAS y el costo por compra de Google en ese tramo no son comparables con los de después.' : '';
  renderGraficas(rows);
  renderTablas(rows);
  renderShop(R);
  renderRitmo();
  renderMeses();
}

/* ------------------------------------------------------------------ Campañas */

var plural = function (n, a, b) { return n + ' ' + (n === 1 ? a : b); };
var sortC = { k: 'inv', dir: -1 };
var OPENC = {};   // filas abiertas de la tabla de campañas
var COLS_C = [['label', 'Medio · marca · campaña', 0], ['obj', 'Objetivo', 0], ['inv', 'Inversión', 1], ['pct', '% del total', 1], ['conv', 'Compras', 1], ['val', 'Valor', 1], ['roas', 'ROAS', 1], ['cpa', 'Costo/compra', 1]];
function renderCampanas(R) {
  var q = $('qCamp').value.trim().toLowerCase(), T = {}, tot = { inv: 0, conv: 0, val: 0 }, ids = [];
  filtra(RG, R.a, R.b).forEach(function (r) {
    if (q && r.camp.toLowerCase().indexOf(q) < 0) return;
    var c = T[r.canal] || (T[r.canal] = { label: r.canal, inv: 0, conv: 0, val: 0, h: {} });
    var m = c.h[r.cta] || (c.h[r.cta] = { label: r.cta || 'Sin marca', inv: 0, conv: 0, val: 0, h: {} });
    var k = m.h[r.camp] || (m.h[r.camp] = { label: r.camp, obj: r.obj, inv: 0, conv: 0, val: 0 });
    [c, m, k, tot].forEach(function (o) { o.inv += r.inv; o.conv += r.conv; o.val += r.val; });
  });
  var fin = function (o) { o.roas = o.inv > 0 ? o.val / o.inv : -1; o.cpa = o.conv > 0 ? o.inv / o.conv : Infinity; o.pct = tot.inv > 0 ? o.inv / tot.inv * 100 : 0; return o; };
  var ordena = function (obj) {
    return Object.keys(obj).map(function (k) { return fin(obj[k]); }).sort(function (a, b) {
      var x = a[sortC.k], y = b[sortC.k];
      if (typeof x === 'string') return sortC.dir * x.localeCompare(y);
      return sortC.dir * ((x == null ? 0 : x) - (y == null ? 0 : y));
    });
  };
  var canales = ordena(T), buscando = !!q, h = '';
  var tdM = function (o) {
    return '<td class="num">' + cop(o.inv) + '</td><td class="num">' + nf(o.pct, 1) + '%</td><td class="num">' + nf(Math.round(o.conv)) + '</td><td class="num">' + cop(o.val) +
      '</td><td class="num">' + (o.roas < 0 ? '—' : roasF(o.roas)) + '</td><td class="num">' + (o.cpa === Infinity ? '—' : cop(o.cpa)) + '</td>';
  };
  var tog = function (id) { return '<span class="tog' + (buscando || OPENC[id] ? ' open' : '') + '">▶</span>'; };
  canales.forEach(function (c) {
    var cid = 'C' + c.label, oc = buscando || !!OPENC[cid];
    ids.push(cid);
    h += '<tr class="lv1" data-id="' + cid + '"><td>' + tog(cid) + pillCanal(c.label) + ' <span class="t-mute">' + plural(Object.keys(c.h).length, 'marca', 'marcas') + '</span></td><td></td>' + tdM(c) + '</tr>';
    ordena(c.h).forEach(function (m) {
      var mid = cid + '|' + m.label;
      ids.push(mid);
      h += '<tr class="lv2' + (oc ? '' : ' hidden') + '" data-id="' + mid + '"><td>' + tog(mid) + esc(m.label) + ' <span class="t-mute">' + plural(Object.keys(m.h).length, 'campaña', 'campañas') + '</span></td><td></td>' + tdM(m) + '</tr>';
      ordena(m.h).forEach(function (k) {
        h += '<tr class="lv3' + (oc && (buscando || OPENC[mid]) ? '' : ' hidden') + '"><td class="tx">' + esc(k.label) + '</td><td>' + esc(k.obj) + '</td>' + tdM(k) + '</tr>';
      });
    });
  });
  if (canales.length) h += '<tr class="tr-total"><td>Total</td><td></td>' + tdM(fin(tot)) + '</tr>';
  $('tCamp').innerHTML = h || '<tr><td colspan="8">Sin campañas con ese filtro.</td></tr>';
  renderCampanas.ids = ids;
  $('hCamp').innerHTML = COLS_C.map(function (c) {
    return '<th class="sortable' + (c[2] ? ' num' : '') + (sortC.k === c[0] ? ' sort-act' : '') + '" data-k="' + c[0] + '">' + c[1] +
      (sortC.k === c[0] ? '<span class="sort-arrow">' + (sortC.dir > 0 ? '▲' : '▼') + '</span>' : '') + '</th>';
  }).join('');
}

/* ------------------------------------------------------------------ Anuncios */

var adLimite = 12, adLista = [];
function renderAnuncios(R) {
  if (!ADS) { $('adGrid').innerHTML = '<div class="ad-empty">Cargando anuncios…</div>'; return; }
  var q = $('qAd').value.trim().toLowerCase(), m = {};
  filtra(ADS, R.a, R.b).forEach(function (r) {
    if (q && (r.ad + ' ' + r.camp).toLowerCase().indexOf(q) < 0) return;
    var k = r.canal + '|' + (r.id || r.camp + '|' + r.ad), o = m[k] || (m[k] = { canal: r.canal, camp: r.camp, ad: r.ad, cta: r.cta, prev: '', inv: 0, imp: 0, clics: 0, conv: 0, val: 0 });
    o.inv += r.inv; o.imp += r.imp; o.clics += r.clics; o.conv += r.conv; o.val += r.val;
    if (r.prev.indexOf('preview_iframe') >= 0) o.prev = r.prev; // los enlaces fb.me antiguos no se pueden incrustar
  });
  var arr = Object.keys(m).map(function (k) { return m[k]; }).filter(function (o) { return o.inv > 0; });
  arr.forEach(function (o) { o.roas = o.inv > 0 ? o.val / o.inv : 0; });
  var ord = $('adOrden').value;
  if (ord === 'roas') arr = arr.filter(function (o) { return o.inv >= 200000; });
  arr.sort(function (a, b) { return b[ord] - a[ord]; });
  adLista = arr;
  var tot = arr.reduce(function (t, o) { return t + o.inv; }, 0);
  $('adCaption').textContent = arr.length + ' anuncios con inversión · ' + cop(tot) + ' en total. Las vistas previas solo existen para Meta; Google no entrega una.';
  pintaAds(tot);
}
function pintaAds(tot) {
  var ver = adLista.slice(0, adLimite), max = ver.length ? ver[0].inv : 1;
  $('adGrid').innerHTML = ver.map(function (o) {
    var ctr = o.imp > 0 ? o.clics / o.imp * 100 : null;
    return '<div class="ad-card"><div class="ad-prev' + (o.prev ? '' : ' sin') + '">' +
      (o.prev ? '<iframe src="' + esc(o.prev) + '" loading="lazy" scrolling="no" title="' + esc(o.ad) + '"></iframe>'
        : '<span class="ad-noprev">' + (o.canal === 'GOOGLE' ? 'Google no entrega vista previa de sus anuncios.' : 'Vista previa aún no disponible: se genera en la próxima actualización de la fuente.') + '</span>') + '</div>' +
      '<div class="ad-body"><div class="ad-name"><span>' + esc(o.ad) + '</span></div>' +
      '<div class="ad-meta">' + pillCanal(o.canal) + ' ' + esc(o.cta) + ' · ' + esc(o.camp) + '</div>' +
      '<div class="ad-nums"><div><div class="nm-label">Inversión</div><div class="nm-value">' + copM(o.inv) + '</div></div>' +
      '<div><div class="nm-label">Compras</div><div class="nm-value">' + nf(Math.round(o.conv)) + '</div></div>' +
      '<div><div class="nm-label">ROAS</div><div class="nm-value">' + (o.inv > 0 && o.val > 0 ? roasF(o.roas) : '—') + '</div></div>' +
      '<div><div class="nm-label">CTR</div><div class="nm-value">' + (ctr == null ? '—' : nf(ctr, 2) + '%') + '</div></div>' +
      '<div><div class="nm-label">Costo/compra</div><div class="nm-value">' + (o.conv > 0 ? copM(o.inv / o.conv) : '—') + '</div></div>' +
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
  if (v === 'anuncios' && !ADS) {
    render();
    cargarAds().then(render).catch(function (e) { $('adGrid').innerHTML = '<div class="error-box">No se pudieron cargar los anuncios: ' + esc(e.message) + '</div>'; });
  } else render();
}

function init() {
  document.querySelectorAll('[data-view]').forEach(function (e) {
    e.addEventListener('click', function (ev) { ev.preventDefault(); ir(e.dataset.view); });
  });
  ['rangeSelect', 'dateFrom', 'dateTo', 'fCuenta', 'fCanal'].forEach(function (id) {
    $(id).addEventListener('change', function () { adLimite = 12; render(); });
  });
  $('seg').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    G = b.dataset.g; marcaSeg(); render();
  });
  $('hCamp').addEventListener('click', function (e) {
    var th = e.target.closest('th'); if (!th) return;
    var k = th.dataset.k, numerica = COLS_C.filter(function (c) { return c[0] === k; })[0][2] === 1;
    sortC = { k: k, dir: sortC.k === k ? -sortC.dir : (numerica ? -1 : 1) };
    render();
  });
  $('qCamp').addEventListener('input', render);
  $('tCamp').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-id]'); if (!tr) return;
    OPENC[tr.dataset.id] = !OPENC[tr.dataset.id]; renderCampanas(rango());
  });
  $('campAbrir').addEventListener('click', function () { (renderCampanas.ids || []).forEach(function (id) { OPENC[id] = true; }); renderCampanas(rango()); });
  $('campCerrar').addEventListener('click', function () { OPENC = {}; renderCampanas(rango()); });
  $('qAd').addEventListener('input', function () { adLimite = 12; render(); });
  $('adOrden').addEventListener('change', function () { adLimite = 12; render(); });
  $('adMoreBtn').addEventListener('click', function () { adLimite += 12; pintaAds(adLista.reduce(function (t, o) { return t + o.inv; }, 0)); });
  $('tMeses').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-id]'); if (!tr) return;
    OPEN[tr.dataset.id] = !OPEN[tr.dataset.id]; renderMeses();
  });
  $('mesAbrir').addEventListener('click', function () {
    document.querySelectorAll('#tMeses tr[data-id]').forEach(function (tr) { OPEN[tr.dataset.id] = true; });
    renderMeses(); // abre meses; una segunda pasada abre los canales que acaban de aparecer
    document.querySelectorAll('#tMeses tr[data-id]').forEach(function (tr) { OPEN[tr.dataset.id] = true; }); renderMeses();
  });
  $('mesCerrar').addEventListener('click', function () { OPEN = {}; renderMeses(); });
  var mi = $('margen');
  if (MARGEN) mi.value = MARGEN;
  mi.addEventListener('input', function () {
    var v = parseFloat(mi.value);
    MARGEN = v > 0 && v < 100 ? v : null;
    try { if (MARGEN) localStorage.setItem('closet_margen', String(MARGEN)); else localStorage.removeItem('closet_margen'); } catch (e) { /* sin almacenamiento */ }
    render();
  });
  $('dateFrom').value = MIND; $('dateTo').value = MAXD;
  var dias = diasEntre(rango().a, rango().b);
  G = dias > 100 ? 'm' : dias > 35 ? 's' : 'd';
  marcaSeg();
}
function marcaSeg() { document.querySelectorAll('#seg button').forEach(function (b) { b.classList.toggle('on', b.dataset.g === G); }); }

Promise.all([cargarRG(), cargarShop(), cargarShopMes()]).then(function () {
  init();
  render();
  $('loadScreen').style.display = 'none';
  $('app').style.display = '';
  render(); // con la carcasa visible las gráficas toman su tamaño real
}).catch(function (e) {
  $('loadScreen').innerHTML = '<div class="error-box">No se pudo leer la hoja de Closet: ' + esc(e.message) + '. Revisa que siga compartida con «cualquiera con el enlace».</div>';
});
})();
