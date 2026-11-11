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

  if(typeof Chart==='undefined')return;

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
