import { T } from '@/theme/tokens'

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;450;600;700&display=swap');
*{box-sizing:border-box}
html,body,#root{margin:0;padding:0;background:${T.brand};min-height:100vh}
.tp{font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:13px;line-height:1.5;color:#0a2233;
  background:${T.brand};min-height:100vh;-webkit-font-smoothing:antialiased}
.tp button{font:inherit;cursor:pointer;border:none;background:none;color:inherit}
.tp a{color:${T.brand};text-decoration:none;cursor:pointer}
.tp h1{font-size:24px;font-weight:600;margin:0;letter-spacing:-.018em;line-height:1.25}
.tp h2{font-size:15px;font-weight:600;margin:0;letter-spacing:-.008em;line-height:1.35}
.tp h3{font-size:13px;font-weight:600;margin:0;line-height:1.35}
.tp :focus-visible{outline:2px solid ${T.b400};outline-offset:2px;border-radius:6px}
.sub{color:#486581;font-size:11px}
.mut{color:#7993a8}
.mini{font-size:11px;color:#7993a8}
.hr{height:1px;background:#d9e2ec;border:0;margin:0}
.stack{display:flex;flex-direction:column;gap:12px}
.row{display:flex;align-items:center;gap:8px}
.bet{display:flex;align-items:center;justify-content:space-between;gap:10px;border:none}
.scrollx{overflow-x:auto}

/* ---- left rail ---- */
.side{position:fixed;top:0;left:0;bottom:0;width:240px;background:transparent;border:none;
  display:flex;flex-direction:column;z-index:40;transition:width .16s ease}
.side.collapsed{width:48px;background:transparent}
.sidebrand{display:flex;align-items:center;height:52px;padding:0 14px;flex:none;width:100%;
  border:none;background:transparent;text-align:left;position:relative}
.sidenav{flex:1;overflow-y:auto;padding:12px 10px;display:flex;flex-direction:column;gap:3px}
.sidelbl{font-size:11px;font-weight:600;color:#B9DCFF;padding:14px 12px 6px;white-space:nowrap;letter-spacing:.04em;text-transform:uppercase}
.sideitem{display:flex;align-items:center;gap:12px;height:36px;padding:0 12px;border-radius:10px;width:100%;
  color:#FFFFFF !important;font-size:13px;font-weight:600;white-space:nowrap;flex:none;opacity:.92;transition:background .12s,color .12s,opacity .12s}
.sideitem svg{color:#D1E6FF;flex-shrink:0}
.sideitem .lbl{color:#FFFFFF}
.sideitem:hover{background:rgba(255,255,255,.14);color:#FFFFFF !important;opacity:1}
.sideitem:hover svg{color:#FFFFFF}
.sideitem.on{background:rgba(255,255,255,.24);color:#FFFFFF !important;font-weight:600;opacity:1}
.sideitem.on svg{color:#FFFFFF}
.sideitem .cnt{margin-left:auto;background:rgba(255,255,255,.24);color:#FFFFFF;border-radius:10px;min-width:20px;height:18px;
  display:grid;place-items:center;font-size:11px;font-weight:600;padding:0 6px;border:none}
.sidesubmenu{display:flex;flex-direction:column;position:relative;margin:3px 0 6px 20px;padding-left:14px;border-left:1.5px solid rgba(255,255,255,0.3);gap:1px}
.sidesubitem{display:flex;align-items:center;height:30px;padding:0 6px;border-radius:4px;width:100%;
  color:rgba(255,255,255,0.8) !important;font-size:12.5px;font-weight:450;white-space:nowrap;cursor:pointer;background:transparent !important;border:none;text-align:left;transition:color .12s ease, font-weight .12s ease}
.sidesubitem:hover{color:#FFFFFF !important;background:transparent !important}
.sidesubitem.on{color:#FFFFFF !important;background:transparent !important;font-weight:700}
.side.collapsed .sidesubmenu{display:none}
.sidefoot{flex:none;border:none;padding:10px 10px}
.sideuser{display:flex;align-items:center;gap:10px;padding:8px 10px;width:100%;border-radius:10px;text-align:left;color:#FFFFFF !important}
.sideuser:hover{background:rgba(255,255,255,.12)}
.side.collapsed .lbl,.side.collapsed .sidelbl,.side.collapsed .cnt{display:none}
.side.collapsed .sideitem,.side.collapsed .sideuser{justify-content:center;padding:0;gap:0}
.side.collapsed .sidebrand{padding:0;justify-content:center}
.avatar{width:32px;height:32px;border-radius:999px;background:rgba(255,255,255,.22);border:none;
  display:grid;place-items:center;font-size:11px;font-weight:600;color:#FFFFFF;flex:none}

/* ---- top bar (contextual, inside the content region) ---- */
.main{margin-left:240px;transition:margin-left .16s ease;height:calc(100vh - 12px);display:flex;flex-direction:column;background:#EEF2F7;border-radius:12px;overflow:hidden;margin-top:6px;margin-right:6px;margin-bottom:6px}
.main.collapsed{margin-left:48px}
.topbar{height:52px;background:#fff;border:none;display:flex;align-items:center;justify-content:space-between;padding:0 24px;position:sticky;top:0;z-index:30;flex:none}
.iconbtn{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;color:#486581;position:relative;background:#fff;border:none}
.iconbtn:hover{background:#f0f4f8;color:#0a2233}
.iconbtn .dotr{position:absolute;top:6px;right:7px;width:7px;height:7px;border-radius:50%;background:${T.bad};
  border:none}
.content-layout{display:flex;flex:1;min-width:0;min-height:0;width:100%;align-items:stretch}
.wrap{flex:1;min-width:0;min-height:0;padding:22px 24px 40px;box-sizing:border-box;overflow-y:auto}
.rightrail{position:fixed;top:0;right:0;bottom:0;width:380px;height:100vh;background:#fff;border-radius:10px 0 0 10px;box-shadow:0 1px 2px rgba(2,42,66,.05), -10px 0 26px -14px rgba(2,42,66,.18);border:none;display:flex;flex-direction:column;overflow:hidden;z-index:70}
.rightrail-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border:none;background:#fff;flex:none}
.rightrail-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:14px}
.tbl tr.inspected-row{background:${T.b50} !important}
.crumb{display:flex;align-items:center;gap:4px;font-size:12px;color:${T.g500};margin-bottom:6px;user-select:none}.crumb a,.crumb button.crumb-link{color:${T.g500};text-decoration:none;cursor:pointer}.crumb a:hover,.crumb button.crumb-link:hover{color:${T.brand};text-decoration:none}.crumb svg{flex-shrink:0;opacity:.6}
.crumb-link{background:none;border:none;padding:0;font-size:inherit;color:inherit;cursor:pointer;text-decoration:none}
.crumb-link:hover{color:#055aaf;text-decoration:underline}

/* ---- surfaces ---- */
.card{min-width:0;background:#ffffff;border:none;border-radius:10px;box-shadow:0 1px 2px rgba(2,42,66,.05), 0 10px 26px -14px rgba(2,42,66,.18);overflow:hidden}
.card>.ch{padding:14px 20px;border:none;display:flex;align-items:center;gap:10px;
  border-radius:10px 10px 0 0}
.card>.cb{padding:16px 20px}

/* ---- buttons ----
   Primary (.btn.pri) = brand blue — the main call to action on every page.
   Default (.btn)     = white with a subtle shadow — secondary actions.
   Ghost (.btn.gh)    = borderless white — low-emphasis actions (row actions, etc).
   ---- */
.btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:10px;
  font-size:13px;font-weight:600;border:1px solid #d4dee9;background:#ffffff;color:#0a2233;white-space:nowrap;
  box-shadow:0 1px 2px rgba(2,42,66,.06);transition:background .1s,box-shadow .1s,border-color .1s}
.btn:hover{background:#f8fafc;border-color:#b6c6d8;box-shadow:0 1px 3px rgba(2,42,66,.10)}
.btn.pri{background:${T.brand};border-color:${T.brand};color:#ffffff;box-shadow:0 1px 2px rgba(0,95,168,.20)}
.btn.pri:hover{background:${T.b700};border-color:${T.b700};box-shadow:0 2px 4px rgba(0,95,168,.28)}
.btn.dan{background:#ffffff;border-color:#f2c5c0;color:${T.bad};box-shadow:0 1px 2px rgba(2,42,66,.06)}
.btn.dan:hover{background:#fcebe9;border-color:${T.bad};box-shadow:0 1px 3px rgba(2,42,66,.10)}
.btn.ok{background:${T.brand};border-color:${T.brand};color:#ffffff;box-shadow:0 1px 2px rgba(0,95,168,.20)}
.btn.ok:hover{background:${T.b700};border-color:${T.b700}}
.btn.gh{border:none;background:transparent;color:#486581;box-shadow:none}
.btn.gh:hover{background:#f0f4f8;color:#0a2233;box-shadow:none}
.btn.sm{height:28px;padding:0 9px;font-size:11px;border-radius:10px}
.btn.lg{height:36px;padding:0 16px;font-size:13px;border-radius:10px}
.btn:disabled{opacity:.42;cursor:not-allowed}

/* ---- chips ---- */
.chip{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:6px;font-size:11px;
  font-weight:600;border:none;white-space:nowrap;line-height:17px}
.c-gray{background:#f0f4f8;border:none;color:#486581}
.c-slate{background:#f0f4f8;border:none;color:#486581}
.c-blue{background:${T.b50};border:none;color:${T.brand}}
.c-teal{background:${T.tealBg};border:none;color:${T.teal}}
.c-ok{background:${T.okBg};border:none;color:${T.ok}}
.c-warn{background:${T.warnBg};border:none;color:${T.warn}}
.c-bad{background:${T.badBg};border:none;color:${T.bad}}
.c-vio{background:${T.vioBg};border:none;color:${T.vio}}

/* ---- tables ---- */
/* table — thead blends into the page background (#EEF2F7) so left/right/top edges are "fused";
   only the white tbody rows sit inside the card's white surface. */
table.tbl{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
.tbl th{text-align:left;font-size:11px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:0.04em;text-transform:uppercase;color:#7993a8;padding:12px 20px;
  border-bottom:none;background:#F4F7FA;white-space:nowrap}
.tbl.inactivate-tbl th{padding:14px 20px}
.tbl th:first-child{padding-left:20px}
.tbl th:last-child{padding-right:20px}
.tbl td{height:40px;padding:9px 20px;border-bottom:1px solid #f0f4f8;vertical-align:middle;color:#0a2233;font-size:13px;font-variant-numeric:tabular-nums}
.tbl.inactivate-tbl td{padding:11px 20px}
.tbl td:first-child{padding-left:20px}
.tbl td:last-child{padding-right:20px}
.tbl tr:last-child td{border-bottom:none}
.tbl tbody tr:hover{background:#F5F8FC}
.tbl tr.sel{background:#e6f2fb}

/* ---- pagination ---- */
.pagn{display:flex;align-items:center;justify-content:space-between;padding:10px 20px;border-top:1px solid #f0f4f8;background:#fff;gap:12px;flex-wrap:wrap}
.pagn-info{font-size:12px;color:#7993a8;white-space:nowrap}
.pagn-btns{display:flex;align-items:center;gap:4px}
.pagn-btn{height:28px;min-width:28px;padding:0 6px;border-radius:6px;font:inherit;font-size:12px;font-weight:500;color:#486581;background:#fff;border:1px solid #D4DEE9;cursor:pointer;display:grid;place-items:center;transition:background .1s,color .1s,border-color .1s}
.pagn-btn:hover:not(:disabled){background:#f0f4f8;border-color:#9fb3c8;color:#0a2233}
.pagn-btn:disabled{opacity:.4;cursor:default}
.pagn-btn.on{background:#005fa8;border-color:#005fa8;color:#fff;font-weight:600}

.pn{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-size:11px;color:${T.brand};font-weight:600;font-variant-numeric:tabular-nums}
a.pn:hover{text-decoration:underline}
.lnk{color:${T.brand};font-weight:600;cursor:pointer}
.lnk:hover{text-decoration:underline}

/* ---- tabs ---- */
.tabs{display:flex;gap:2px;border-bottom:none;border:none;overflow-x:auto;padding:0 8px}
.tab{padding:10px 14px;font-size:13px;font-weight:600;color:#486581;border-bottom:2px solid transparent;white-space:nowrap;transition:color .1s,border-color .1s}
.tab:hover{color:#0a2233}
.tab.on{color:${T.brand};border-bottom-color:${T.brand};font-weight:600}

/* ---- fields ---- */
.fl{display:block;font-size:11px;font-weight:600;color:#486581;margin-bottom:5px}
.inp{width:100%;height:32px;padding:0 10px;border:1px solid #D4DEE9;border-radius:10px;background:#fff;
  font:inherit;font-size:13px;color:#0a2233;outline:none;transition:border-color .12s,box-shadow .12s}
.inp:hover{border-color:#B6C6D8}
.inp:focus{border-color:#0A4F8F;outline:2px solid #0A4F8F;outline-offset:0px;box-shadow:none}
textarea.inp{height:auto;padding:8px 10px;line-height:1.5;resize:vertical}
.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.grid4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.grid6{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px}
@media(max-width:1400px){.grid6{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:1000px){.grid2,.grid3,.grid4{grid-template-columns:1fr}.grid6{grid-template-columns:repeat(2,minmax(0,1fr))}}

/* ---- spec rows ---- */
.spec{display:grid;grid-template-columns:190px 1fr;gap:0}
.spec dt{padding:9px 0;color:#627D98;font-size:12px;font-weight:450;border-bottom:1px solid #EDF2F7;display:flex;align-items:center}
.spec dd{padding:9px 0;margin:0;font-size:13px;font-weight:600;color:#0A2233;border-bottom:1px solid #EDF2F7;display:flex;align-items:center;min-height:36px}
.spec-kv-form{display:grid;grid-template-columns:200px 1fr;gap:0;background:#FFFFFF;border-radius:10px;border:1px solid #E2E8F0;box-shadow:0 1px 2px rgba(2,42,66,.04);overflow:hidden}
.spec-kv-label{padding:12px 18px;background:#F8FAFC;border-bottom:1px solid #EDF2F7;display:flex;align-items:center}
.spec-kv-label-text{font-size:12px;font-weight:600;color:#334E68}
.spec-kv-input{padding:10px 18px;border-bottom:1px solid #EDF2F7;display:flex;align-items:center}
.spec-kv-input:last-of-type, .spec-kv-label:last-of-type{border-bottom:none}
@media(max-width:768px){.spec-kv-form{grid-template-columns:1fr}.spec-kv-label{padding:10px 14px 4px;border-bottom:none}.spec-kv-input{padding:0 14px 10px;border-bottom:1px solid #EDF2F7}}

/* ---- lifecycle ---- */
.lcx{display:flex;align-items:flex-start;width:100%;padding:4px 0 2px}
.lc-milestone{display:flex;align-items:center;flex:1;min-width:0}
.lc-milestone:last-child{flex:none}
.lc-node-wrap{display:flex;flex-direction:column;align-items:center;min-width:48px}
.lc-node{flex-shrink:0}
.lc-label{text-align:center;line-height:1.3}
.lc-connector{flex:1;display:flex;align-items:center;padding:0 4px;margin-bottom:22px}
.lc-line{flex:1;height:2px;border-top:2px dashed #CBD5E1;width:100%}
.lc-line.lc-line-done{border-top-color:#0A4F8F}
.submarks span{flex:1;font-size:11px;color:${T.g500};font-weight:600}
.submarks span:last-child{text-align:right}

/* ---- stepper ---- */
.steps{display:flex;align-items:center;padding:14px 18px;background:#fff;border:none;
  border-radius:10px;overflow-x:auto;box-shadow:0 1px 2px rgba(2,42,66,.05), 0 10px 26px -14px rgba(2,42,66,.20)}
.stp{display:flex;align-items:center;gap:9px;font-size:11px;font-weight:600;color:${T.g500};white-space:nowrap}
.stp .n{width:22px;height:22px;border-radius:50%;background:#E3EAF2;color:#486581;border:none;display:grid;
  place-items:center;font-size:11px;font-weight:600;flex:none}
.stp.on{color:${T.g900};font-weight:600} .stp.on .n{background:#0A4F8F;color:#fff}
.stp.dn{color:${T.g700}} .stp.dn .n{background:#35A65B;color:#fff;border:none}
.stpline{height:1px;background:${T.g200};flex:1;margin:0 14px;min-width:16px}

/* ---- eco wizard 2-column layout & sub-navigation ---- */
/* eco-wizard-layout: now single-column — subnav flows horizontally above content */
.eco-wizard-layout{display:flex;flex-direction:column;gap:16px}
/* Inline kit picker — expands in the right pane */
.eco-kit-inline-picker{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:8px;animation:fadeIn .15s ease}
.eco-kit-inline-results{max-height:280px;overflow:auto;border:1px solid #e2e8f0;border-radius:6px;background:#fff}
.eco-subnav{display:flex;flex-direction:row;align-items:center;gap:2px;border-bottom:1px solid ${T.g200};padding-bottom:0;background:transparent;box-shadow:none;border-radius:0;padding:0}
.eco-subnav-btn{display:flex;align-items:center;gap:7px;padding:9px 14px;border-radius:0;font-size:13px;font-weight:500;color:${T.g600};background:transparent;border:none;border-bottom:2px solid transparent;text-align:left;cursor:pointer;transition:color .12s ease,border-color .12s ease;white-space:nowrap;flex-shrink:0}
.eco-subnav-btn:hover{color:${T.g900};border-bottom-color:${T.g300}}
.eco-subnav-btn.on{color:${T.brand};font-weight:600;border-bottom-color:${T.brand}}
.eco-subnav-btn .sub-badge{font-size:11px;font-weight:600;padding:1px 6px;border-radius:10px;background:${T.g100};color:${T.g700}}
.eco-subnav-btn.on .sub-badge{background:${T.brand};color:#fff}
.eco-subnav-btn .sub-check{width:16px;height:16px;border-radius:50%;background:#E8F5EE;color:#0B7A4B;display:grid;place-items:center;flex-shrink:0}
.eco-subnav-btn .sub-pending{width:16px;height:16px;border-radius:50%;background:#FDF4E3;color:#9A6206;display:grid;place-items:center;flex-shrink:0}

/* ---- key value form grid ---- */
.kv-form{display:flex;flex-direction:column}
.kv-row{display:grid;grid-template-columns:190px 1fr;gap:16px;align-items:center;padding:12px 14px;border-bottom:1px solid ${T.g100}}
.kv-row:last-child{border-bottom:none}
.kv-key{display:flex;flex-direction:column;gap:3px}
.kv-label{font-size:12px;font-weight:600;color:${T.g700}}
.kv-hint{font-size:11px;color:${T.g500};line-height:1.3}
.kv-val{min-width:0}
@media(max-width:768px){.kv-row{grid-template-columns:1fr;gap:8px}}

/* ---- kpi ---- */
.kpi{border:none;border-radius:12px;padding:14px 16px;text-align:left;width:100%;
  background:#ffffff !important;position:relative;overflow:hidden;
  transition:transform .12s,box-shadow .12s;box-shadow:0 1px 2px rgba(2,42,66,.04), 0 4px 14px -4px rgba(2,42,66,.08);
  display:flex;flex-direction:column;gap:10px}
.kpi:hover{transform:translateY(-1px);box-shadow:0 1px 3px rgba(2,42,66,.06), 0 8px 22px -6px rgba(2,42,66,.14)}
.kpi .kpi-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.kpi .l{font-size:11px;font-weight:600;color:#627d98;text-transform:uppercase;letter-spacing:.04em;line-height:1.2}
.kpi .kpi-body{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.kpi .kpi-main{display:flex;align-items:center;gap:10px}
.kpi .kicon{width:26px;height:26px;border-radius:6px;background:#f0f4f8;display:grid;place-items:center;flex:none;color:#627d98}
.kpi .v{font-size:28px;font-weight:700;letter-spacing:-.03em;line-height:1;color:#0a2233;font-variant-numeric:tabular-nums}
.kpi .kpi-extra{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600}

/* segmented control / filter pills — matches reference design:
   Group sits on a soft-gray "track". Active pill is white + shadow (raised).
   Inactive pills are transparent/borderless — they just live on the track.
   Count badges hidden. */
.seg{display:inline-flex;align-items:center;gap:2px;background:#e2e8f0;border-radius:10px;padding:3px}
.seg button{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 12px;border-radius:8px;
  font-size:12px;font-weight:600;color:#627d98;background:transparent;border:none;white-space:nowrap;cursor:pointer;
  transition:all .1s ease}
.seg button:hover{color:#0a2233}
.seg button.on{background:#ffffff;color:#0a2233;box-shadow:0 1px 3px rgba(2,42,66,.14)}
.seg button .n{display:none}
/* toolbar: floats above the table card on the page background — no card, no background.
   Left side = filter pills / selects. Right edge = search + actions. */
.toolbar{display:flex;align-items:center;gap:12px;padding:0 0 12px;border:none;min-width:0;background:transparent}
.toolbar-right{display:flex;align-items:center;gap:8px;margin-left:auto;flex-shrink:0}
.srch{position:relative;display:flex;align-items:center;flex-shrink:0}
.srch input{padding-left:30px;padding-right:10px;height:32px;border-radius:10px;width:240px;border:1px solid #D4DEE9;outline:none;background:#fff;font:inherit;font-size:13px;color:#0a2233;transition:border-color .12s,box-shadow .12s}
.srch input:hover{border-color:#B6C6D8}
.srch input:focus{border-color:#0A4F8F;outline:2px solid #0A4F8F;outline-offset:0px;box-shadow:none}
.srch svg{position:absolute;left:10px;pointer-events:none}
.srch .clr{position:absolute;right:8px;width:18px;height:18px;border-radius:50%;display:grid;place-items:center;
  background:#d9e2ec;color:#486581}
.srch .clr:hover{background:#bcccdc;color:#0a2233}
.seltray{margin-left:auto;display:flex;align-items:center;gap:9px;background:${T.b50};border:none;
  border-radius:10px;padding:5px 6px 5px 13px}
.seltray>span{font-size:11px;font-weight:600;color:${T.b700}}
.okbox{display:flex;align-items:flex-start;gap:10px;background:${T.okBg};border:none;border-radius:10px;
  padding:11px 13px;font-size:11px;color:${T.ok};line-height:1.55}
.tree{position:relative;padding-left:18px}
.tree:before{content:"";position:absolute;left:6px;top:0;bottom:12px;width:1px;background:${T.g300}}
.tree>span{position:absolute;left:6px;top:11px;width:10px;height:1px;background:${T.g300}}

/* ---- charts ---- */
.legend{display:flex;flex-wrap:wrap;gap:9px 14px;margin-top:12px}
.legend span{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:${T.g700}}
.legend b{font-variant-numeric:tabular-nums}
.sw{width:9px;height:9px;border-radius:6px;flex:none}
.hbar{height:9px;border-radius:6px;background:${T.g100};overflow:hidden}
.hbar i{display:block;height:100%;border-radius:6px}

/* ---- callouts ---- */
.note{background:${T.b25};border:none;border-radius:10px;padding:11px 13px;font-size:11px;color:${T.b800};line-height:1.55}
.warnbox{background:${T.warnBg};border:none;border-radius:10px;padding:11px 13px;font-size:11px;color:${T.warn};line-height:1.55}
.aibox{background:linear-gradient(135deg,${T.vioBg},${T.b25});border:none;border-radius:10px;padding:14px}
.drop{border:1px dashed #D4DEE9;border-radius:10px;padding:30px;text-align:center;background:#ffffff;box-shadow:0 1px 2px rgba(2,42,66,.05);transition:border-color .15s}
.drop:hover{border-color:#B6C6D8;background:${T.b25}}
.drop:focus,.drop:focus-within{border-color:#0A4F8F;outline:2px solid #0A4F8F;outline-offset:0px}

/* ---- overlays ---- */
/* ── wizard modal ────────────────────────────────────────────────────
   Two-panel creation journey: left = numbered step list, right = form.
   Matches the reference (wide, 88 vh tall, left panel 240px fixed).     */
.modal-wizard{background:#ffffff;border-radius:14px;width:100%;max-width:1152px;height:88vh;max-height:860px;
  overflow:hidden;display:flex;flex-direction:column;box-shadow:0 4px 32px rgba(2,42,66,.22)}
.modal-wizard-body{display:flex;flex:1;min-height:0}
.modal-wizard-steps{width:240px;min-width:240px;border-right:1px solid #e2e8f0;padding:28px 16px;
  display:flex;flex-direction:column;gap:4px;background:#fafbfc}
.modal-wizard-step{display:flex;align-items:flex-start;gap:12px;padding:12px 10px;border-radius:10px;
  cursor:pointer;border:none;background:transparent;text-align:left;width:100%;transition:background .1s}
.modal-wizard-step:hover{background:#f0f4f8}
.modal-wizard-step.active{background:#EEF4FF}
.modal-wizard-step .mws-num{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;
  font-size:12px;font-weight:700;flex-shrink:0;margin-top:1px;
  background:#e2e8f0;color:#627d98;transition:all .12s}
.modal-wizard-step.active .mws-num{background:#0A4F8F;color:#ffffff}
.modal-wizard-step.done .mws-num{background:#35A65B;color:#ffffff}
.modal-wizard-step .mws-label{font-size:13px;font-weight:600;color:#486581;line-height:1.2;margin-bottom:2px}
.modal-wizard-step.active .mws-label{color:#0a2233}
.modal-wizard-step.done .mws-label{color:#0a2233}
.modal-wizard-step .mws-sub{font-size:11px;color:#7993a8;line-height:1.3}
.modal-wizard-content{flex:1;min-width:0;overflow-y:auto;padding:32px 36px;background:#f5f7fa}
.modal-wizard-head{display:flex;align-items:center;justify-content:space-between;padding:18px 24px;
  border-bottom:1px solid #e2e8f0;flex-shrink:0}
.modal-wizard-head h2{margin:0;font-size:16px;font-weight:700;color:#0a2233}
.modal-wizard-foot{display:flex;align-items:center;justify-content:space-between;padding:14px 24px;
  background:#f8fafc;border-top:1px solid #e2e8f0;flex-shrink:0;border-radius:0 0 14px 14px}

.modalbg{position:fixed;inset:0;background:rgba(2,42,66,.45);z-index:80;display:grid;place-items:center;padding:24px;
  backdrop-filter:blur(2px)}
.modal{background:#ffffff;border-radius:12px;width:100%;max-width:640px;max-height:86vh;overflow:hidden;display:flex;flex-direction:column;
  box-shadow:0 20px 60px rgba(2,42,66,.25);border:none}
.modalhead{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 20px;
  background:#F8FAFC;border-bottom:1px solid #E2E8F0;border-radius:12px 12px 0 0}
.modalhead h2{margin:0;font-size:15px;font-weight:600;color:#0a2233}
.modalbody{padding:20px;overflow-y:auto;flex:1;background:#ffffff}
.modalinnercard{background:#F8FAFC;border-radius:10px;padding:14px 16px;border:none;margin-bottom:14px}
.modalfoot{display:flex;align-items:center;padding:12px 20px;background:#F8FAFC;border-top:1px solid #E2E8F0;border-radius:0 0 12px 12px}
.drawer{position:fixed;top:0;right:0;bottom:0;width:460px;max-width:94vw;background:#f8fafc;z-index:70;
  border-radius:10px 0 0 10px;box-shadow:-10px 0 40px rgba(2,42,66,.2);overflow:auto}
.drawerhead{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:16px 16px 14px;
  background:#fff;border:none;position:sticky;top:0;z-index:2}
.notifcard{background:#fff;border:none;border-radius:10px;overflow:hidden;box-shadow:0 1px 2px rgba(2,42,66,.05), 0 10px 26px -14px rgba(2,42,66,.20)}
.notifhead{display:flex;align-items:flex-start;gap:11px;padding:13px 13px 11px}
.notificon{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;flex:none}
.notificon.bad{background:${T.badBg};color:${T.bad}}
.notificon.warn{background:${T.warnBg};color:${T.warn}}
.notificon.vio{background:${T.vioBg};color:${T.vio}}
.notificon.blue{background:${T.b50};color:${T.brand}}
.notifbody{padding:0 13px 11px;display:flex;flex-direction:column;gap:9px}
.notifrow{display:grid;grid-template-columns:72px 1fr;gap:10px;align-items:start}
.notiflbl{font-size:11px;font-weight:600;color:#7993a8;padding-top:2px}
.notiffoot{display:flex;gap:8px;padding:10px 13px;border:none;background:#ffffff}
.del{text-decoration:line-through;color:${T.bad}}
.add{color:${T.ok};font-weight:600}
.bulletlist{margin:0;padding-left:16px;line-height:1.75;font-size:13px;color:#486581}

/* ---- admin / editor patterns ---- */
.ava2{width:28px;height:28px;border-radius:999px;background:${T.b50};color:${T.b700};display:grid;place-items:center;
  font-size:11px;font-weight:600;flex:none;border:none}
.ava2.sm{width:24px;height:24px;font-size:11px;margin-right:-6px}
.chipx{width:14px;height:14px;border-radius:999px;display:grid;place-items:center;background:${T.b100};color:${T.b700}}
.chipx:hover{background:${T.b300};color:#fff}
.secthead{font-size:11px;font-weight:600;color:${T.b700};text-transform:none;letter-spacing:.01em;margin:0 0 8px;
  padding-bottom:6px;border:none}
.fieldrow{display:flex;align-items:center;gap:10px;padding:9px 11px;border:none;box-shadow:0 1px 2px rgba(2,42,66,.05);border-radius:10px;
  background:#fff;margin-bottom:7px}
.fieldrow:hover{background:${T.b25}}
.handle{display:flex;flex-direction:column;gap:1px}
.handle button{width:18px;height:14px;display:grid;place-items:center;color:#7993a8;border-radius:6px}
.handle button:hover{background:#f0f4f8;color:#0a2233}
.optcards{display:flex;flex-direction:column;gap:8px}
.optcard{text-align:left;border:none;box-shadow:0 1px 2px rgba(2,42,66,.05);border-radius:10px;padding:11px 13px;background:#fff;width:100%}
.optcard:hover{background:${T.b25}}
.optcard.on{background:${T.b50};box-shadow:0 0 0 3px ${T.b25}}
.radio{width:16px;height:16px;border-radius:999px;border:1.5px solid #9fb3c8;flex:none;display:inline-block}
.radio.on{border:5px solid ${T.brand}}
.togglerow{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 13px;
  border:none;box-shadow:0 1px 2px rgba(2,42,66,.05);border-radius:10px;margin-bottom:8px}
.togglerow input{width:16px;height:16px}
.stagepill{background:${T.b700};color:#fff;border-radius:10px;padding:2px 9px;font-size:11px;font-weight:600}
.menu{position:absolute;top:38px;right:0;z-index:50;background:#fff;border:none;border-radius:10px;
  padding:5px;min-width:218px;box-shadow:0 12px 32px rgba(2,42,66,.18)}
.menu button{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border-radius:10px;font-size:13px;
  color:#0a2233;text-align:left}
.menu button:hover{background:${T.b25};color:${T.brand}}
.menu button.dang{color:${T.bad}} .menu button.dang:hover{background:${T.badBg}}
.menusep{height:1px;background:#d9e2ec;margin:5px 0}

/* ---- form builder canvas & preview styling ---- */
.fb-canvas{background:#F4F7FA;min-height:560px;border-radius:12px;padding:24px;display:flex;flex-direction:column;gap:18px;border:1px dashed #D4DEE9}
.fb-section-card{background:#FFFFFF;border-radius:10px;border:1px solid #E2E8F0;box-shadow:0 1px 3px rgba(2,42,66,.05);overflow:hidden;transition:box-shadow .15s ease}
.fb-section-card:hover{box-shadow:0 4px 12px rgba(2,42,66,.08)}
.fb-section-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;background:#F8FAFC;border-bottom:1px solid #EDF2F7;cursor:pointer;user-select:none}
.fb-section-header:hover{background:#F1F5F9}
.fb-section-body{padding:14px 16px;display:flex;flex-direction:column;gap:8px;min-height:48px}
.fb-field-card{display:flex;align-items:center;gap:12px;padding:10px 14px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:8px;transition:all .12s ease}
.fb-field-card:hover{background:${T.b25};border-color:#B3D7F7}
.fb-empty-section{padding:20px;text-align:center;border:1px dashed #CBD5E1;border-radius:8px;background:#F8FAFC;color:#627D98;font-size:12px}
.fb-zero-state{padding:56px 24px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#FFFFFF;border-radius:12px;border:1px dashed #BCCCDC;box-shadow:0 1px 3px rgba(2,42,66,.04)}
.switch-toggle-wrap{display:inline-flex;align-items:center;gap:10px;user-select:none;cursor:pointer;padding:4px 8px;border-radius:8px;transition:background .12s ease}
.switch-toggle-wrap:hover{background:rgba(0,95,168,.04)}
.switch-track{width:42px;height:24px;background:#CBD5E1;border-radius:999px;position:relative;transition:background .2s ease;cursor:pointer;flex-shrink:0}
.switch-track.on{background:${T.brand}}
.switch-thumb{width:18px;height:18px;background:#FFFFFF;border-radius:50%;position:absolute;top:3px;left:3px;transition:transform .2s cubic-bezier(.16,1,.3,1);box-shadow:0 1px 3px rgba(0,0,0,.25)}
.switch-track.on .switch-thumb{transform:translateX(18px)}
.sectionhead{display:flex;align-items:center;gap:11px;padding:12px 14px;background:${T.b25};border:none;
  border-radius:10px}
.secnum{width:24px;height:24px;border-radius:10px;background:${T.brand};color:#fff;display:grid;place-items:center;
  font-size:11px;font-weight:600;flex:none}
.ring{width:46px;height:46px;border-radius:999px;display:grid;place-items:center;flex:none}
.ring span{width:36px;height:36px;border-radius:999px;background:#fff;display:grid;place-items:center;
  font-size:11px;font-weight:600;font-variant-numeric:tabular-nums;color:${T.brand}}
.apgroup{border:none;box-shadow:0 1px 2px rgba(2,42,66,.05);border-radius:10px;overflow:hidden;background:#fff}
.apgroup.done{}
.apgroup.opt{opacity:.72}
.apgroup.locked{background:#ffffff}
.apghead{display:flex;align-items:center;gap:9px;padding:12px 20px;background:#f8fafc;border-bottom:1px solid #E2E8F0}
.apgroup.done .apghead{background:${T.okBg};border-bottom-color:${T.okBd}}
.apgdot{width:19px;height:19px;border-radius:999px;display:grid;place-items:center;flex:none;background:#fff}
.apgroup.done .apgdot{background:${T.ok}}
.ava2.ok{background:${T.okBg};color:${T.ok}}
.gatebar{display:flex;align-items:center;gap:12px;padding:2px 0}
.gateline{flex:1;height:1px;background:#bcccdc}
.gatepill{display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:600;color:#486581;
  background:#fff;border:none;box-shadow:0 1px 2px rgba(2,42,66,.05);border-radius:10px;padding:5px 13px}
.checklist{display:flex;flex-direction:column;gap:9px}
.sumhead{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 18px;
  background:linear-gradient(135deg,${T.b50},#fff);border:none;box-shadow:0 1px 2px rgba(2,42,66,.05);border-radius:10px}
.eco-summary-unified-card{background:#ffffff;border-radius:10px;box-shadow:0 1px 2px rgba(2,42,66,.05), 0 10px 26px -14px rgba(2,42,66,.18);border:1px solid #E2E8F0;overflow:hidden}
.eco-summary-sec{padding:26px 28px;border-top:1px solid #E2E8F0}
.eco-summary-sec-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}
.eco-summary-sec-title{font-size:13px;font-weight:700;color:#0a2233;text-transform:uppercase;letter-spacing:0.04em}
.eco-summary-sec-sub{font-size:12px;color:#627D98;margin-top:2px}
.eco-exec-top{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding:26px 28px 24px;background:linear-gradient(180deg,#F8FAFC 0%,#FFFFFF 100%)}
.eco-exec-left{min-width:0;flex:1}
.eco-exec-metrics{display:flex;align-items:center;gap:20px;flex-shrink:0}
.eco-exec-metric-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:88px;padding:10px 16px;background:#ffffff;border:1px solid #E2E8F0;border-radius:8px;box-shadow:0 1px 2px rgba(2,42,66,.04)}
.eco-exec-instructions{padding:20px 28px 24px;background:#ffffff;border-top:1px solid #E2E8F0}
/* ── Summary step redesign ─── */
.eco-summary-header-card{display:flex;align-items:center;gap:0;background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(2,42,66,.05)}
.eco-summary-header-left{flex:1;min-width:0;padding:18px 22px}
.eco-summary-stats{display:flex;flex-shrink:0;border-left:1px solid #e2e8f0}
.eco-summary-stat-box{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:88px;padding:16px 20px;border-left:1px solid #e2e8f0}
.eco-summary-stat-box:first-child{border-left:none}
.eco-draft-chip{background:#f1f5f9;border:none;color:#627d98;font-size:11px;font-weight:600;letter-spacing:0.04em;padding:2px 7px;border-radius:3px;text-transform:uppercase;display:inline-block}
.eco-summary-section{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:18px 22px;margin-top:12px;box-shadow:0 1px 2px rgba(2,42,66,.03)}
.eco-summary-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
.eco-summary-section-title{font-size:14px;font-weight:700;color:#0a2233}
.eco-summary-edit-link{background:none;border:none;cursor:pointer;font-size:13px;color:#3b6ea8;font-weight:600;padding:0;line-height:1}
.eco-summary-edit-link:hover{text-decoration:underline}
.eco-summary-stage-row{padding:14px 18px;border:1px solid #e5eaf1;border-radius:8px;margin-bottom:8px;background:#fafbfd}
.eco-summary-stage-row:last-child{margin-bottom:0}
.eco-summary-kv-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 36px}
@media(max-width:840px){.eco-summary-kv-grid{grid-template-columns:1fr;gap:12px}}
.eco-summary-kv-item{display:flex;flex-direction:column;gap:5px;padding-bottom:10px;border-bottom:1px solid #F1F5F9}
.eco-summary-kv-label{font-size:11.5px;font-weight:600;color:#627D98;text-transform:uppercase;letter-spacing:0.03em}
.eco-summary-kv-value{font-size:13.5px;font-weight:600;color:#0A2233;word-break:break-word}
.approval-choices-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:14px}
@media(max-width:900px){.approval-choices-grid{grid-template-columns:1fr}}
/* Approval method cards — radio-style, subtle, matching reference */
.approval-choice-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:16px;width:100%}
.approval-choice-card{position:relative;display:flex;flex-direction:column;padding:22px 20px 20px;background:#ffffff;border:1px solid #e2e6ef;border-radius:16px;cursor:pointer;transition:border-color .18s,box-shadow .18s;outline:none;width:100%;text-align:left;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.approval-choice-card:hover{border-color:#cbd5e1;box-shadow:0 4px 16px rgba(0,0,0,.10)}
.approval-choice-card.selected{border-color:#3b6ea8;box-shadow:0 0 0 2px rgba(59,110,168,.15)}
.approval-choice-radio{position:absolute;top:16px;right:16px;width:22px;height:22px;border-radius:50%;border:1.5px solid #d1d5db;background:#fff;display:grid;place-items:center;flex-shrink:0;transition:border-color .12s}
.approval-choice-card.selected .approval-choice-radio{border-color:#0A4F8F}
.approval-choice-radio-dot{width:9px;height:9px;border-radius:50%;background:#0A4F8F;opacity:0;transition:opacity .12s}
.approval-choice-card.selected .approval-choice-radio-dot{opacity:1}
.approval-choice-icon-wrap{display:none}
.approval-choice-title{font-size:15px;font-weight:700;color:#1e2d3d;margin-bottom:10px;line-height:1.25;padding-right:32px}
.approval-choice-desc{font-size:13px;color:#64748b;line-height:1.55;flex:1}
.approval-choice-badge{display:none}
.approval-choice-badge.badge-ai{display:none}
.approval-choice-badge.badge-routing{display:none}
.approval-tip-card{padding:10px 14px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;box-shadow:0 1px 2px rgba(2,42,66,.02)}
.routeline{display:flex;align-items:center;gap:12px;padding:11px 0;border:none}
.routeline:last-child{border:none}
.saverouting{border:none;box-shadow:0 1px 2px rgba(2,42,66,.05);background:${T.b25};border-radius:10px;padding:14px}
.stagecard{border:none;border-radius:10px;margin-bottom:12px;overflow:hidden;background:#fff;box-shadow:0 1px 2px rgba(2,42,66,.05), 0 10px 26px -14px rgba(2,42,66,.20)}
.stagehead{display:flex;align-items:center;gap:10px;padding:10px 12px;background:${T.b25};border:none}
.stagename{border:none;background:none;font:inherit;font-weight:600;font-size:13px;color:#0a2233;outline:none;
  padding:3px 6px;border-radius:6px;min-width:180px}
.stagename:hover,.stagename:focus{background:#fff;box-shadow:0 0 0 1px ${T.b200}}
.rb{display:grid;grid-template-columns:262px 1fr;min-height:560px}
.rbfields{border:none;padding:14px;overflow-y:auto;max-height:720px;background:#ffffff}
.rbmain{padding:14px;display:flex;flex-direction:column;gap:12px;min-width:0}
.fieldchip{display:flex;align-items:center;gap:8px;padding:7px 9px;border:none;box-shadow:0 1px 2px rgba(2,42,66,.05);border-radius:6px;
  background:#fff;font-size:11px;margin-bottom:5px;cursor:grab;user-select:none}
.fieldchip:hover{background:${T.b25}}
.fieldchip:active{cursor:grabbing}
.fieldchip.on{background:${T.b50};color:${T.brand};font-weight:600}
.fieldchip button.chip-del{width:16px;height:16px;border-radius:999px;display:grid;place-items:center;background:${T.b100};color:${T.brand};margin-left:auto;flex:none}
.fieldchip button.chip-del:hover{background:${T.b300};color:#fff}
.grip{color:#9fb3c8;display:grid;place-items:center;flex:none}
.shelf{border:none;box-shadow:0 1px 2px rgba(2,42,66,.05);border-radius:10px;background:#f8fafc}
.shelf:hover{background:#f0f4f8}
.shelfhead{display:flex;align-items:center;gap:7px;padding:8px 12px;font-size:11px;font-weight:600;color:#486581;
  border:none}
.shelfhead .n{background:${T.b50};color:${T.brand};border-radius:10px;padding:0 6px;font-size:11px;font-variant-numeric:tabular-nums}
.shelfbody{padding:10px 12px;display:flex;flex-wrap:wrap;gap:7px;align-items:center;min-height:44px}
.pill{display:inline-flex;align-items:center;gap:6px;background:${T.b50};border:none;color:${T.brand};
  border-radius:10px;padding:4px 6px 4px 10px;font-size:11px;font-weight:600}
.pill.static{padding:4px 10px}
.pill button{width:15px;height:15px;border-radius:999px;display:grid;place-items:center;background:${T.b100};color:${T.brand}}
.pill button:hover{background:${T.b300};color:#fff}
.filterrow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
@media(max-width:1100px){.rb{grid-template-columns:1fr}.rbfields{max-height:280px;border:none}}
.optlist{display:flex;flex-direction:column;gap:7px}
.optrow{display:flex;align-items:center;gap:8px}
.ordinal{width:20px;height:20px;border-radius:6px;background:#f0f4f8;color:#7993a8;display:grid;place-items:center;
  font-size:11px;font-weight:600;font-variant-numeric:tabular-nums;flex:none}
.itemcard{display:flex;align-items:center;gap:12px;border:none;box-shadow:0 1px 2px rgba(2,42,66,.05);background:${T.b25};
  border-radius:10px;padding:12px}
.emptyslot{border:none;box-shadow:0 1px 2px rgba(2,42,66,.05);border-radius:10px;padding:18px;text-align:center;font-size:11px;color:#7993a8;background:#ffffff}
@media(max-width:1150px){.fb{grid-template-columns:1fr !important}}
@keyframes spin{to{transform:rotate(360deg)}}
.choice-centered-wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;min-height:320px;padding:40px 0;text-align:center}
.item-choice-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px;width:100%}
.item-choice-card{min-height:130px}
.item-choice-card:disabled{opacity:.5;cursor:not-allowed;pointer-events:none}
/* ── Flat stacked form (Basic Details) ─── */
.eco-flat-form{display:flex;flex-direction:column;gap:20px}
.eco-flat-field{display:flex;flex-direction:column;gap:6px}
.eco-flat-label{font-size:13px;font-weight:500;color:#374151}

/* ── Back link ─── */
.eco-back-link{background:none;border:none;cursor:pointer;font-size:13px;color:#627d98;padding:0;display:inline-flex;align-items:center;gap:4px;font-weight:500}
.eco-back-link:hover{color:#0a2233}

/* ── Kit catalog panel (empty dashed + search results) ─── */
/* ── Kit card (Add Items step) ─── */
.eco-kit-card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(2,42,66,.04)}
.eco-kit-card-head{display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;user-select:none;border-bottom:1px solid #e2e8f0;background:#fff}
.eco-kit-card-head:hover{background:#f8fafc}
.eco-kit-remove-btn{margin-left:auto}
.eco-kit-card-body{padding:20px 20px 16px}
.eco-kit-section-label{font-size:11px;font-weight:700;letter-spacing:0.06em;color:#7993a8;text-transform:uppercase;margin-bottom:10px}
.eco-kit-input-label{font-size:12px;color:#6b7280;margin-bottom:4px}
.eco-edit-mode-card{display:flex;flex-direction:column;align-items:flex-start;padding:14px 16px;background:#fff;border:1.5px solid #d1dde8;border-radius:8px;cursor:pointer;text-align:left;transition:border-color .14s,background .14s}
.eco-edit-mode-card:hover{border-color:#3b6ea8}
.eco-edit-mode-card.selected{border-color:#3b6ea8;background:#eff6ff}
.eco-kit-bom-table{width:100%;border-collapse:collapse;margin-bottom:4px}
.eco-kit-bom-table th{font-size:11px;font-weight:700;letter-spacing:0.05em;color:#7993a8;text-transform:uppercase;text-align:left;padding:0 10px 8px;border-bottom:1px solid #e2e8f0}
.eco-kit-bom-table td{padding:10px 10px;border-bottom:1px solid #f1f5f9;font-size:13px}
.eco-kit-bom-table tr:last-child td{border-bottom:none}
.eco-kit-delete-link{background:none;border:none;cursor:pointer;font-size:13px;color:#6b7280;font-weight:500;padding:0}
.eco-kit-delete-link:hover{color:#dc2626}
.eco-kit-edit-form{padding:12px 14px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-top:12px}
.eco-kit-dropzone{border:2px dashed #c8d8e8;border-radius:8px;padding:24px 16px;text-align:center;cursor:pointer;background:#f8fafc}
.eco-kit-dropzone:hover{border-color:#3b6ea8}
.eco-kit-catalog-panel{border:1.5px dashed #c8d8e8;border-radius:10px;overflow:hidden;background:#fff}
.eco-kit-empty-dashed{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;text-align:center}

/* ── New stage cards (Approvals routing) ─── */
.eco-stage-card{border:1.5px solid #d1dde8;border-radius:10px;margin-bottom:12px;overflow:hidden;background:#fff}
.eco-stage-head{display:flex;align-items:center;gap:10px;padding:14px 16px;cursor:pointer;user-select:none;border-bottom:1px solid #e9eef4}
.eco-stage-head:hover{background:#f8fafc}
.eco-stage-body{padding:0 16px 12px}
.eco-role-row{display:flex;align-items:center;gap:0;padding:12px 0;border-bottom:1px solid #f1f5f9}
.eco-role-row:last-of-type{border-bottom:none}
.eco-add-role-link{background:none;border:none;cursor:pointer;font-size:13px;color:#3b6ea8;font-weight:600;padding:8px 0 4px;display:block;text-align:left}
.eco-add-role-link:hover{color:#0a2233}

/* ── Summary redesign ─── */
.eco-info-tip{position:relative;display:inline-flex;align-items:center;color:#94a3b8;cursor:default;line-height:0}
.eco-info-tip:hover{color:#64748b}
.eco-info-tip-bubble{visibility:hidden;opacity:0;pointer-events:none;position:absolute;left:calc(100% + 8px);top:50%;transform:translateY(-50%);background:#1e293b;color:#f1f5f9;font-size:12px;font-weight:400;line-height:1.5;padding:7px 10px;border-radius:6px;white-space:normal;width:200px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.2);transition:opacity .12s ease,visibility .12s ease}
.eco-info-tip-bubble::before{content:'';position:absolute;right:100%;top:50%;transform:translateY(-50%);border:5px solid transparent;border-right-color:#1e293b}
.eco-info-tip:hover .eco-info-tip-bubble{visibility:visible;opacity:1}
@keyframes fadeSlideUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.spin{animation:spin 0.8s linear infinite}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}

/* Remove the blue focus ring / background that the copilot SDK adds to its composer */
[data-test-id="ask-panel"] textarea:focus,
[data-test-id="ask-panel"] input:focus,
[data-test-id="ask-panel"] [contenteditable]:focus,
[data-test-id="reports-copilot-page"] textarea:focus,
[data-test-id="reports-copilot-page"] input:focus,
[data-test-id="reports-copilot-page"] [contenteditable]:focus {
  outline: none !important;
  box-shadow: none !important;
  border-color: transparent !important;
  background: transparent !important;
}
[data-test-id="ask-panel"] [class*="composer"] *:focus,
[data-test-id="ask-panel"] [class*="input-wrapper"]:focus-within,
[data-test-id="reports-copilot-page"] [class*="composer"] *:focus,
[data-test-id="reports-copilot-page"] [class*="input-wrapper"]:focus-within {
  outline: none !important;
  box-shadow: none !important;
  border-color: var(--border) !important;
  background-color: transparent !important;
}
`;

export { CSS }


