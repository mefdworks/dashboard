# Dashboard

Dashboards de pauta de clientes freelance. Se sirven en https://maicolespinosa.com/dashboard/<cliente>/.

- `index.html`: índice de todos los dashboards.
- `altavista/`: Grupo Altavista (índice y `dash-altavista.html`).
- `atlab/`: ATLAB (`dashboard.html` con el embudo, `estrategia-atlab.html` con la propuesta; incluye `apps-script/cruce-embudo.gs`, fuente del script del Sheet).
- `closet/`: Closet (`dashboard.html` + `closet.js`: resumen con ventas de Shopify, tabla desplegable mes → canal → cuenta, ritmo del mes y rentabilidad estimada; campañas; anuncios con vista previa; lee en vivo `RESUMEN GENERAL` y `ANUNCIOS GENERAL` de la hoja «[Closet] Fuente de datos» con gviz en JSON, que entrega el valor crudo y no el texto con formato regional). Ventas de Shopify desde `SHOPIFY VENTAS` (diario) y `SHOPIFY MENSUAL` (antes de 2026).
- `riderlab/`: RiderLab (`dashboard.html` + `riderlab.js`: resumen con resultados, tabla desplegable mes → objetivo → campaña, ritmo del mes con presupuesto opcional, embudo de compras y gráficas; campañas desplegable objetivo → campaña → conjunto → anuncio; anuncios con vista previa). Lee en vivo `Campañas` y `Anuncios` de la hoja «[RideLab] Fuente de datos», que debe estar compartida con «cualquiera con el enlace».
- `assets/`: la visual del portal de vida (app.maicolespinosa.com), compartida por todas las páginas.
  - `ui.css`: tokens del portal (Inter, tinta, lavanda, amarillo), carcasa con barra lateral y barra superior, menú ☰ y barra inferior en móvil, tarjetas, tablas, chips y los colores de las gráficas.
  - `ui.js`: menú móvil, sección activa, valores por defecto de Chart.js, etiqueta accesible en cada gráfica y botón «Tabla» (tabla gemela de la gráfica).
  - Movimiento (sin tocar el render de cada página; con «reducir movimiento» se apaga todo): las rejillas `.kpi-grid` / `.kpis` entran en cascada y sus números suben la primera vez que se ven, y los valores que cambian al filtrar se deslizan; la primera vez que una gráfica se ve «crece» y al repintarla solo se acomoda; `.loadscreen` muestra un esqueleto; todo `.error-box` ofrece «Reintentar». Ayudas para las páginas: `UI.spark(serie)` (línea de tendencia de un solo color) y `UI.sk('ads' | 'filas')` (esqueleto del contenedor mientras llegan los datos).
  - `logo-michael-espinosa.png`, `logos/` e `icons/`: copias de `app/assets/`.

## Reglas de diseño

- Solo modo claro, igual que el portal.
- Series de gráficas: `UI.s1`, `UI.s2`, `UI.s3` en ese orden (lavanda, ámbar, verde azulado; validadas con el validador de dataviz). Embudos y etapas: `UI.ramp` (un solo tono, de claro a oscuro). Una sola serie lleva un solo color. Nunca doble eje: dos medidas de distinta escala van en dos gráficas.
- Una página nueva enlaza `assets/ui.css`, carga `assets/ui.js` después de Chart.js y usa la carcasa `.win > .side + .col > .topbar + .main`.
- Probar con datos reales en escritorio y en 390 px; los Sheets solo cargan desde http(s), no desde `file://`.
