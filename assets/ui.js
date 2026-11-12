/* Comportamiento compartido de los dashboards: menú móvil, sección activa, valores por defecto de Chart.js,
   etiquetas accesibles en los canvas y tabla gemela de cada gráfica. No toca los datos de la página. */
(function(){
  var b=document.body, root=document.documentElement;
  var css=function(n){return getComputedStyle(root).getPropertyValue(n).trim()};

  /* Colores de datos: salen de ui.css para que gráficas y tarjetas hablen igual */
  window.UI={
    s1:css('--s1'),s2:css('--s2'),s3:css('--s3'),otro:css('--s-otro'),
    ramp:[css('--o1'),css('--o2'),css('--o3'),css('--o4')],
    ink:css('--ink'),ink2:css('--ink2'),ink3:css('--ink3'),grid:css('--grid'),
    alpha:function(hex,a){var n=parseInt(hex.slice(1),16);return 'rgba('+(n>>16&255)+','+(n>>8&255)+','+(n&255)+','+a+')'}
  };

  /* Menú lateral en móvil */
  function menu(o){b.classList.toggle('menu-open',o);var m=document.getElementById('mbtn');if(m)m.setAttribute('aria-expanded',String(o))}
  document.addEventListener('click',function(e){
    if(e.target.closest('#mbtn'))menu(!b.classList.contains('menu-open'));
    else if(e.target.closest('#mscrim')||e.target.closest('.side .nav'))menu(false);
  });
  document.addEventListener('keydown',function(e){if(e.key==='Escape')menu(false)});
  document.addEventListener('click',function(e){
    var f=e.target.closest('#fbtn');if(!f)return;
    var o=!b.classList.contains('filters-open');b.classList.toggle('filters-open',o);f.setAttribute('aria-expanded',String(o));
  });

  /* Sección activa al desplazarse: la última cuyo título ya pasó la parte alta de la pantalla */
  var links=[].slice.call(document.querySelectorAll('.nav[href^="#"],.mnav a[href^="#"]'));
  var secs=links.map(function(a){return document.getElementById(a.getAttribute('href').slice(1))}).filter(function(v,i,a){return v&&a.indexOf(v)===i});
  function spy(){
    if(!secs.length)return;
    var act=secs[0];
    secs.forEach(function(t){if(t.getBoundingClientRect().top<150)act=t});
    links.forEach(function(a){a.classList.toggle('on',a.getAttribute('href')==='#'+act.id)});
  }
  if(secs.length){window.addEventListener('scroll',spy,{passive:true});window.addEventListener('resize',spy);window.addEventListener('load',spy)}

  /* Etiqueta accesible en cada canvas, tomada del título de su tarjeta */
  document.addEventListener('DOMContentLoaded',function(){
    [].forEach.call(document.querySelectorAll('canvas:not([aria-label])'),function(c){
      var card=c.closest('.card'),t=card&&card.querySelector('.chart-title,h3,.chart-card-head');
      c.setAttribute('role','img');
      c.setAttribute('aria-label',(t&&t.textContent.trim().replace(/\s+/g,' '))||'Gráfica');
    });
  });

  /* ── Movimiento: entrada de las tarjetas KPI, contador, cambio de valor, esqueletos y sparklines ──
     Todo se engancha al DOM que ya pintan las páginas; ninguna necesita cambiar su render.
     Con «reducir movimiento» no hay animación. */
  var reducir=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
  UI.reducir=reducir;
  var EASE='cubic-bezier(.2,.7,.2,1)';

  /* Esqueleto de carga: UI.sk('ads' | 'filas') devuelve el HTML para el contenedor mientras llegan los datos */
  UI.sk=function(tipo){
    var i,h='';
    if(tipo==='ads'){for(i=0;i<6;i++)h+='<i class="sk-i sk-ad" aria-hidden="true"></i>';return h}
    for(i=0;i<5;i++)h+='<i class="sk-i sk-fila" aria-hidden="true"></i>';
    return '<div class="sk-filas" role="status" aria-label="Cargando">'+h+'</div>';
  };

  /* Sparkline de una serie (un solo color, sin ejes): se revela de izquierda a derecha */
  UI.spark=function(vals){
    var n=vals&&vals.length;if(!n||n<2)return '';
    var mn=Math.min.apply(null,vals),mx=Math.max.apply(null,vals),r=(mx-mn)||1,pts=vals.map(function(v,k){
      return [(k/(n-1)*100).toFixed(2),(27-(v-mn)/r*24).toFixed(2)];
    });
    var l='M'+pts.map(function(p){return p[0]+' '+p[1]}).join(' L');
    return '<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none" role="img" aria-label="Tendencia diaria del mes"><path class="ar" d="'+l+' L100 30 L0 30Z"/><path class="ln" d="'+l+'"/></svg>';
  };

  /* Contador: sube hasta el valor del primer número del texto (admite 1.234.567 y 1,2). Deja el texto original al final. */
  function contar(el){
    var tn=null,i,x;
    for(i=0;i<el.childNodes.length;i++){x=el.childNodes[i];if(x.nodeType===3&&/\d/.test(x.nodeValue)){tn=x;break}}
    if(!tn)return;
    var txt=tn.nodeValue,m=txt.match(/^(\D*?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?(\D*)$/);
    if(!m)return;
    var dec=m[3]?m[3].length:0,fin=parseFloat(m[2].replace(/\./g,'')+'.'+(m[3]||'0'));
    if(!isFinite(fin)||fin===0||(fin<2&&!dec))return;
    var t0=null;
    function fmt(v){var p=v.toFixed(dec).split('.');return p[0].replace(/\B(?=(\d{3})+(?!\d))/g,'.')+(p[1]?','+p[1]:'')}
    function paso(ts){
      if(t0===null)t0=ts;
      var p=Math.min(1,(ts-t0)/650);
      if(p<1){tn.nodeValue=m[1]+fmt(fin*(1-Math.pow(1-p,3)))+m[4];requestAnimationFrame(paso)}else tn.nodeValue=txt;
    }
    requestAnimationFrame(paso);
  }

  var KP='.kpi-grid,.kpis',KV='.kpi-value,.kpi>b,.kpi .vl',estado=new WeakMap();
  function valores(g){return [].slice.call(g.querySelectorAll(KV))}
  /* Primera vez que la rejilla se ve: las tarjetas entran en cascada y los números suben */
  function entrar(g){
    var st=estado.get(g);if(!st||st.ya)return;
    st.ya=true;
    if(reducir)return;
    [].forEach.call(g.children,function(c,k){
      if(c.animate)c.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:420,delay:Math.min(k,7)*55,easing:EASE,fill:'backwards'});
    });
    valores(g).forEach(contar);
  }
  var io='IntersectionObserver' in window?new IntersectionObserver(function(es){
    es.forEach(function(e){if(e.isIntersecting){io.unobserve(e.target);entrar(e.target)}});
  },{threshold:.1}):null;
  /* Cada vez que la página repinta la rejilla: si ya había entrado, los valores que cambiaron se deslizan */
  function ver(g){
    var st=estado.get(g)||{ya:false,prev:[]},ahora=valores(g);
    estado.set(g,st);
    if(!st.ya){if(io){io.unobserve(g);io.observe(g)}else entrar(g)}
    else if(!reducir)ahora.forEach(function(v,k){if(st.prev[k]!==undefined&&st.prev[k]!==v.textContent)v.classList.add('ui-cambio')});
    st.prev=ahora.map(function(v){return v.textContent});
  }
  document.addEventListener('animationend',function(e){if(e.target.classList&&e.target.classList.contains('ui-cambio'))e.target.classList.remove('ui-cambio')});

  /* Error con salida: todo aviso de error de carga ofrece reintentar */
  function reintento(b){
    if(b.querySelector('.eb'))return;
    var x=document.createElement('button');x.type='button';x.className='eb';x.textContent='Reintentar';
    x.onclick=function(){location.reload()};
    b.appendChild(document.createElement('br'));b.appendChild(x);
  }

  function revisa(n){
    if(n.nodeType!==1)return;
    if(n.matches&&n.matches(KP))ver(n);
    else if(n.closest&&n.closest(KP))ver(n.closest(KP));
    if(n.querySelectorAll)[].forEach.call(n.querySelectorAll(KP),ver);
    if(n.matches&&n.matches('.error-box'))reintento(n);
    if(n.querySelectorAll)[].forEach.call(n.querySelectorAll('.error-box'),reintento);
  }
  function arranca(){
    [].forEach.call(document.querySelectorAll('.loadscreen,#loading'),function(s){
      if(s.querySelector('.error-box')||s.querySelector('.sk-wrap'))return;
      var w=document.createElement('div'),k='<div class="sk-kpi"><i class="sk-i"></i><i class="sk-i"></i></div>';
      w.className='sk-wrap';w.setAttribute('aria-hidden','true');
      w.innerHTML='<div class="sk-kpis">'+k+k+k+k+'</div><div class="sk-card"><i class="sk-i"></i><i class="sk-i"></i><i class="sk-i"></i></div>';
      s.appendChild(w);s.classList.add('has-sk');
    });
    [].forEach.call(document.querySelectorAll(KP),ver);
    [].forEach.call(document.querySelectorAll('.error-box'),reintento);
    new MutationObserver(function(ms){
      var vistos=[];
      ms.forEach(function(m){
        [].forEach.call(m.addedNodes,revisa);
        var t=m.target&&m.target.nodeType===1?m.target:null;
        if(t&&t.closest){var g=t.closest(KP);if(g&&vistos.indexOf(g)<0){vistos.push(g);ver(g)}}
      });
    }).observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arranca);else arranca();

  if(typeof Chart==='undefined')return;

  /* Chart.js: la primera vez que una gráfica se ve «crece» (700 ms); al repintarla por un filtro solo se acomoda (260 ms) */
  Chart.defaults.animation.duration=700;Chart.defaults.animation.easing='easeOutQuart';
  Chart.defaults.transitions.active.animation.duration=140;
  Chart.register({id:'ui-entrada',beforeInit:function(ch){
    var c=ch.canvas;
    if(reducir){ch.options.animation=false;return}
    if(c.__uiVista||!c.offsetParent)ch.options.animation={duration:260,easing:'easeOutCubic'};
    else c.__uiVista=true;
  }});

  /* Chart.js: Inter, rejilla de línea fina y continua, barras delgadas con punta redondeada, líneas de 2 px */
  var D=Chart.defaults;
  D.font.family=css('--font');D.font.size=11;D.color=UI.ink3;
  D.borderColor=UI.grid;
  D.elements.bar.borderRadius=4;D.datasets.bar.maxBarThickness=24;
  D.elements.line.borderWidth=2;D.elements.line.tension=.3;
  D.elements.point.radius=0;D.elements.point.hoverRadius=5;D.elements.point.hitRadius=24;D.elements.point.borderWidth=2;D.elements.point.hoverBorderColor='#fff';
  D.interaction.mode='index';D.interaction.intersect=false;
  var L=D.plugins.legend.labels;L.boxWidth=10;L.boxHeight=10;L.useBorderRadius=true;L.borderRadius=2;L.padding=14;
  var T=D.plugins.tooltip;
  T.backgroundColor=UI.ink;T.titleColor='#fff';T.bodyColor='#fff';T.cornerRadius=10;T.padding=10;T.boxPadding=4;T.usePointStyle=true;
  T.titleFont={family:css('--font'),size:12,weight:600};T.bodyFont={family:css('--font'),size:11.5};

  /* Cruz vertical que sigue al puntero en las líneas */
  Chart.register({id:'ui-crosshair',afterDatasetsDraw:function(ch){
    if(ch.config.type!=='line')return;
    var a=ch.tooltip&&ch.tooltip.getActiveElements&&ch.tooltip.getActiveElements();
    if(!a||!a.length)return;
    var x=a[0].element.x,y=ch.chartArea,c=ch.ctx;
    c.save();c.beginPath();c.moveTo(x,y.top);c.lineTo(x,y.bottom);c.lineWidth=1;c.strokeStyle=UI.grid;c.stroke();c.restore();
  }});

  /* Tabla gemela: cada gráfica se puede leer como tabla (botón «Tabla» en la tarjeta) */
  function fill(card){
    var cv=card.querySelector('canvas'),ch=cv&&Chart.getChart(cv),tv=card.querySelector('.tv');
    if(!ch||!tv)return;
    var t=document.createElement('table'),h=t.createTHead().insertRow(),i;
    h.appendChild(document.createElement('th')).textContent='';
    ch.data.datasets.forEach(function(d){h.appendChild(document.createElement('th')).textContent=d.label||'Valor'});
    var tb=t.createTBody();
    (ch.data.labels||[]).forEach(function(l,k){
      var r=tb.insertRow();r.insertCell().textContent=l;
      ch.data.datasets.forEach(function(d){
        var v=d.data[k];if(v&&typeof v==='object')v=v.y;
        r.insertCell().textContent=(v==null||isNaN(v))?'-':Number(v).toLocaleString('es-CO',{maximumFractionDigits:2});
      });
    });
    tv.replaceChildren(t);
  }
  Chart.register({id:'ui-tv',afterUpdate:function(ch){var c=ch.canvas.closest('.card');if(c&&c.classList.contains('tv-on'))fill(c)}});
  document.addEventListener('click',function(e){
    var btn=e.target.closest('.tvbtn');if(!btn)return;
    var card=btn.closest('.card'),on=!card.classList.contains('tv-on');
    if(on&&!card.querySelector('.tv')){var d=document.createElement('div');d.className='tv';card.appendChild(d)}
    card.classList.toggle('tv-on',on);btn.setAttribute('aria-pressed',String(on));
    if(on)fill(card);
  });
})();
