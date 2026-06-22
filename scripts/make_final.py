#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ColorRoom - presentation minimaliste (Inter + Bricolage Grotesque uniquement),
   icones Lucide officielles + logos des technos. Genere HTML puis PDF."""
import base64, pathlib, re

SHOTS="scripts/shots"; UML="scripts/uml"; LOGO="scripts/logos"; LUC="scripts/lucide"; PHOTO="scripts/photos"
def b64(path): return "data:image/png;base64,"+base64.b64encode(pathlib.Path(path).read_bytes()).decode()
def b64f(path):
    ext=pathlib.Path(path).suffix.lower().lstrip(".")
    mime="jpeg" if ext in ("jpg","jpeg") else ext
    return f"data:image/{mime};base64,"+base64.b64encode(pathlib.Path(path).read_bytes()).decode()
def shot(n): return b64f(f"{SHOTS}/{n}.jpg")
def uml(n):  return b64(f"{UML}/ColorRoom_{n}.png")
def logo(n): return "data:image/svg+xml;base64,"+base64.b64encode(pathlib.Path(f"{LOGO}/{n}.svg").read_bytes()).decode()
def photo(n): return b64f(f"{PHOTO}/{n}")

IMG={
 "home":shot("home"),"jeux":shot("jeux"),"gestion":shot("gestion"),"chroma":shot("chromaticite"),
 "aide":shot("aide"),"login":shot("login"),"cs":shot("colorspeed_run"),"p4":shot("puissance4"),"multi":shot("multi"),
 "config":shot("configuration"),"register":shot("register"),"editeur":shot("editeur"),"mesure":shot("mesure"),
 "uc":uml("UseCases"),"cls":uml("Classes"),"comp":uml("Composants"),"dep":uml("Deploiement"),
 "erd":uml("ERD"),"sauth":uml("Seq_Auth"),"sjeu":uml("Seq_Jeu"),"scs":uml("Seq_CS160"),
 "smp":uml("Seq_MP"),"ej":uml("Etats_Jeu"),"ecs":uml("Etats_CS160"),"remap":uml("Activite_Remap"),
}
LOGOS={n:logo(n) for n in ["react","nextdotjs","typescript","sqlite","docker","threedotjs","nodedotjs","raspberrypi","javascript","nodered","css","lucide","ollama"]}
PHO={"lumen":photo("lumen.jpg"),"map":photo("map.jpg"),"plaque":photo("plaque.jpg"),"gantt":photo("gantt.png"),
     "colorroom":photo("colorroom.jpg"),"labcouleur":photo("labcouleur.jpg"),"supervision":photo("supervision.jpg")}

# --- Sprite Lucide (icones officielles, ISC) ---
def luc_inner(name):
    t=pathlib.Path(f"{LUC}/{name}.svg").read_text()
    m=re.search(r"<svg[^>]*>(.*)</svg>", t, re.S)
    return m.group(1).strip()
LIST=["house","gamepad-2","bot","lock","database","share-2","palette","cpu","layout-dashboard",
      "target","users","code-xml","file-text","boxes","zap","circle-check","chart-column",
      "network","puzzle","eye","sparkles","flask-conical","wrench","circle-x","map-pin","circle-play"]
SPRITE='<svg width="0" height="0" style="position:absolute">'+"".join(
    f'<symbol id="ic-{n}" viewBox="0 0 24 24">{luc_inner(n)}</symbol>' for n in LIST)+'</svg>'
def ic(name): return f'<svg class="ic"><use href="#ic-{name}"></use></svg>'

CSS = """
:root{
  --ink:#11131a; --ink2:#3b4252; --muted:#8a93a6; --line:#e7eaf0;
  --accent:#6d4aff; --accent2:#1fb6a6; --ghost:#eef1f6;
  --r:#ef4444; --g:#10b981; --b:#3b6dff; --y:#f5a524;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--ghost);font-family:"Inter",Arial,sans-serif;color:var(--ink2);
     padding:30px 0 64px;-webkit-font-smoothing:antialiased}
.deck{display:flex;flex-direction:column;align-items:center;gap:26px}
.slide{width:min(1180px,95vw);aspect-ratio:16/9;border-radius:20px;
       overflow:hidden;position:relative;display:flex;flex-direction:column;background:#fcfcff;
       box-shadow:0 1px 0 rgba(17,19,26,.04),0 18px 50px rgba(17,19,26,.10);border:1px solid #edf0f5}
.slide>*{position:relative;z-index:1}
h1,h2,h3,.disp,.big,.num,.lab,.toc .n{font-family:"Bricolage Grotesque","Inter",Arial,sans-serif;letter-spacing:-.02em}
.ic{width:22px;height:22px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;display:block}
.head{padding:28px 46px 0;display:flex;align-items:center;gap:15px}
.hicon{width:48px;height:48px;border-radius:14px;color:var(--accent);
       display:grid;place-items:center;flex-shrink:0;
       background:linear-gradient(150deg,rgba(109,74,255,.18),rgba(109,74,255,.07));
       border:1px solid rgba(255,255,255,.7);
       box-shadow:0 6px 16px rgba(109,74,255,.16),inset 0 1px 0 rgba(255,255,255,.8);}
.hicon .ic{width:25px;height:25px}
.kick{font-size:12px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;color:var(--accent)}
.head h2{font-size:32px;font-weight:700;color:var(--ink);margin-top:5px;line-height:1.05}
.rule{height:3px;width:52px;background:var(--accent);border-radius:2px;margin:13px 0 0 109px}
.me{position:absolute;top:30px;right:46px;font-size:11px;font-weight:700;color:var(--accent);z-index:2;
    border:1px solid rgba(109,74,255,.5);border-radius:30px;padding:4px 11px;letter-spacing:.05em;
    background:rgba(255,255,255,.85);
    box-shadow:0 4px 14px rgba(109,74,255,.14),inset 0 1px 0 rgba(255,255,255,.8)}
.body{flex:1;padding:22px 46px 40px;display:flex;gap:30px;min-height:0}
.col{flex:1;min-width:0}
ul{list-style:none;display:flex;flex-direction:column;gap:12px}
li{font-size:16.5px;line-height:1.45;color:var(--ink2);position:relative;padding-left:18px}
li::before{content:"";position:absolute;left:0;top:9px;width:7px;height:7px;border-radius:2px;background:var(--accent)}
li.sub{font-size:14.5px;color:var(--muted);margin-left:18px}
li.sub::before{width:5px;height:5px;background:var(--muted);top:8px}
b{color:var(--ink);font-weight:650}
code{font-family:"Inter",Arial,sans-serif;font-size:.9em;font-weight:600;background:#f3f1ff;color:#5a43d6;padding:1px 7px;border-radius:6px}
.pageno{position:absolute;bottom:16px;right:20px;font-size:11.5px;color:#aeb6c6;font-weight:500}
.diagram{max-height:100%;max-width:100%;width:auto;display:block;margin:auto;border:none;border-radius:8px;background:#fff}
.dcard{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px;display:flex;align-items:center;justify-content:center;width:100%;height:100%;box-shadow:0 10px 28px rgba(17,19,26,.07)}
.fullwrap{flex:1;display:flex;align-items:center;justify-content:center;padding:8px 10px 6px;position:relative;min-height:0}
.fullimg{max-width:100%;max-height:100%;width:auto;height:auto;border-radius:10px;border:1px solid var(--line);background:#fff}
.fulltag{position:absolute;top:12px;left:18px;z-index:2;display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--ink);background:rgba(255,255,255,.88);border:1px solid var(--line);border-radius:30px;padding:5px 13px}
.fulltag .ic{width:15px;height:15px;color:var(--accent)}
.fulltag b{color:var(--ink)}
.shot{width:100%;border-radius:12px;border:1px solid var(--line);box-shadow:0 10px 30px rgba(17,19,26,.12);display:block}
.photo{border-radius:14px;border:1px solid rgba(255,255,255,.7);display:block;object-fit:cover;
    box-shadow:0 14px 38px rgba(17,19,26,.16),inset 0 1px 0 rgba(255,255,255,.4)}
.photostack{display:flex;flex-direction:column;gap:12px;width:100%;height:100%;justify-content:center}
.cap{font-size:11.5px;color:var(--muted);font-weight:500;margin-top:6px;display:flex;align-items:center;gap:6px}
.loccard{background:rgba(255,255,255,.85);border:1px solid var(--line);border-radius:13px;padding:12px 14px;display:flex;flex-direction:column;gap:10px;box-shadow:0 8px 22px rgba(17,19,26,.06)}
.locrow{display:flex;gap:11px;align-items:center}
.locrow .lp{width:32px;height:32px;border-radius:9px;background:#f1eeff;color:var(--accent);display:grid;place-items:center;flex-shrink:0}
.locrow .lp .ic{width:17px;height:17px}
.locrow.b .lp{background:#e6f7f3;color:var(--accent2)}
.locrow b{font-size:13.5px;color:var(--ink)}
.locrow small{display:block;font-size:11.5px;color:var(--muted);margin-top:1px}
.dbtables{display:flex;flex-direction:column;gap:7px;width:100%}
.dbrow{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.7);border:1px solid var(--line);border-radius:10px;padding:7px 11px}
.dbrow code{font-size:11.5px;font-weight:700;white-space:nowrap}
.dbrow span{font-size:12px;color:var(--ink2)}
.dbrow.rel{border-left:3px solid var(--accent2)}
.media{flex:1;display:flex;align-items:center;justify-content:center;min-width:0}
.cover{justify-content:center;align-items:center;padding:0 64px;gap:48px}
.cover .l{flex:1.15}
.cover h1{font-size:84px;font-weight:800;color:var(--ink);line-height:.92;margin:12px 0 4px;font-family:"Bricolage Grotesque","Inter",sans-serif}
.cover .sub{font-size:19px;color:var(--ink2);font-weight:500;max-width:520px;line-height:1.45}
.coverbadge{display:inline-flex;align-items:center;gap:7px;font-size:11.5px;font-weight:700;letter-spacing:.06em;
   color:var(--accent);background:linear-gradient(150deg,rgba(109,74,255,.13),rgba(109,74,255,.05));
   border:1px solid rgba(109,74,255,.28);border-radius:30px;padding:6px 14px}
.covermeta{margin:24px 0 4px;display:flex;flex-direction:column;gap:11px}
.cmrow{display:flex;align-items:center;gap:10px;font-size:14px;color:var(--ink2)}
.cmrow .ci{width:30px;height:30px;border-radius:9px;flex-shrink:0;display:grid;place-items:center;color:var(--accent);
   background:linear-gradient(150deg,rgba(109,74,255,.14),rgba(109,74,255,.05));border:1px solid rgba(255,255,255,.7)}
.cmrow .ci .ic{width:16px;height:16px}
.cmrow b{color:var(--ink)}
.coverlogos{margin-top:22px}
.coverlogos .ll{font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:9px}
.cover .meta{margin-top:26px;font-size:15px;color:var(--ink2)}
.cover .meta small{color:var(--muted)}
.dash{display:flex;gap:6px;margin:14px 0}
.dash i{width:42px;height:6px;border-radius:3px}
.toc{display:grid;grid-template-columns:1fr 1fr;gap:14px 46px;width:100%;align-content:center}
.toc .it{display:flex;gap:13px;align-items:center;font-size:16.5px;color:var(--ink);font-weight:600;
    border-radius:14px;padding:12px 15px;
    background:rgba(255,255,255,.85);border:1px solid rgba(255,255,255,.7);
    box-shadow:0 8px 26px rgba(17,19,26,.07),inset 0 1px 0 rgba(255,255,255,.7)}
.toc .it .ico{width:38px;height:38px;border-radius:11px;color:var(--accent);display:grid;place-items:center;flex-shrink:0;
    background:linear-gradient(150deg,rgba(109,74,255,.16),rgba(109,74,255,.06));border:1px solid rgba(255,255,255,.7)}
.toc .it .tn{font-family:"Bricolage Grotesque",Inter,sans-serif;font-weight:800;font-size:13px;color:var(--accent);opacity:.65;min-width:20px}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;width:100%;align-self:center}
.stat{border:1px solid rgba(255,255,255,.7);border-radius:16px;padding:20px 22px;display:flex;flex-direction:column;gap:5px;
    background:rgba(255,255,255,.82);
    box-shadow:0 10px 30px rgba(17,19,26,.08),inset 0 1px 0 rgba(255,255,255,.75)}
.stat .si{width:38px;height:38px;border-radius:11px;color:var(--accent);display:grid;place-items:center;margin-bottom:6px;
    background:linear-gradient(150deg,rgba(109,74,255,.16),rgba(109,74,255,.06));border:1px solid rgba(255,255,255,.7)}
.stat .num{font-size:38px;font-weight:800;color:var(--ink);line-height:1}
.stat .lbl{font-size:13px;color:var(--muted);font-weight:500}
.roles{display:grid;grid-template-columns:1fr 1fr;gap:14px;width:100%}
.role{border:1px solid rgba(255,255,255,.7);border-radius:14px;padding:15px 17px;
    background:rgba(255,255,255,.82);
    box-shadow:0 8px 24px rgba(17,19,26,.07),inset 0 1px 0 rgba(255,255,255,.7)}
.role.me2{border-color:rgba(109,74,255,.55);background:linear-gradient(150deg,rgba(247,245,255,.75),rgba(255,255,255,.5));box-shadow:0 10px 28px rgba(109,74,255,.18),inset 0 1px 0 rgba(255,255,255,.8)}
.role b{font-size:15px;color:var(--ink)}
.role .tag{display:inline-block;font-size:10px;font-weight:800;color:#fff;background:var(--accent);border-radius:20px;padding:2px 9px;margin-left:7px;vertical-align:middle}
.role span{display:block;font-size:12.5px;color:var(--muted);margin-top:4px;line-height:1.35}
/* carte membre avec avatar + icone */
.role.mb{display:flex;gap:13px;align-items:flex-start;padding:14px 16px}
.role .ava{width:44px;height:44px;border-radius:13px;flex-shrink:0;display:grid;place-items:center;
    font-family:"Bricolage Grotesque",Inter,sans-serif;font-weight:800;font-size:16px;color:#fff;letter-spacing:.02em}
.role .rico{margin-left:auto;color:var(--accent);align-self:center;opacity:.85}
.role .rico .ic{width:24px;height:24px}
.role.me2 .rico{color:var(--accent)}
.teams{display:flex;gap:14px;width:100%}
.teamchip{flex:1;display:flex;align-items:center;gap:11px;border:1px solid var(--line);border-radius:13px;padding:11px 15px;background:#fff}
.teamchip.on{border-color:rgba(109,74,255,.4);background:#f7f5ff}
.teamchip .tci{width:34px;height:34px;border-radius:10px;background:#f1eeff;color:var(--accent);display:grid;place-items:center;flex-shrink:0}
.teamchip b{font-size:14px;color:var(--ink)}
.teamchip small{display:block;font-size:11.5px;color:var(--muted);margin-top:1px}
.lab{font-weight:700;color:var(--ink);font-size:17px;margin-bottom:9px;display:flex;align-items:center;gap:8px}
.lab .ic{width:19px;height:19px}
.lab.a{color:var(--accent)} .lab.b{color:var(--accent2)}
/* lignes d'objectifs/contraintes avec pastille d'icone */
.feat{display:flex;flex-direction:column;gap:12px}
.frow{display:flex;gap:12px;align-items:flex-start}
.frow .fi{width:32px;height:32px;border-radius:10px;background:#f1eeff;color:var(--accent);display:grid;place-items:center;flex-shrink:0}
.frow .fi .ic{width:18px;height:18px}
.frow.b .fi{background:#e6f7f3;color:var(--accent2)}
.frow .ft{font-size:15px;line-height:1.4;color:var(--ink2);padding-top:5px}
.split{display:flex;gap:30px;width:100%}
.fix{display:flex;gap:12px;align-items:stretch;margin-bottom:12px}
.fix .pb{flex:1;border:1px solid #f1d6d6;background:#fdf4f4;color:#b4434b;border-radius:12px;padding:12px 15px;font-weight:600;font-size:14px;display:flex;align-items:center;gap:9px}
.fix .ar{display:grid;place-items:center;color:var(--muted)}
.fix .so{flex:1.15;border:1px solid #cfeee2;background:#f2fbf7;color:#15795f;border-radius:12px;padding:12px 15px;font-weight:600;font-size:13.5px;display:flex;align-items:center;gap:9px}
.center{align-items:center;justify-content:center;text-align:center;flex-direction:column;gap:8px}
.big{font-size:52px;font-weight:800;color:var(--ink)}
.quote{border-left:4px solid var(--accent);border-radius:0 14px 14px 0;
       padding:16px 20px;font-size:18px;font-weight:600;color:var(--ink);line-height:1.4;
       background:linear-gradient(120deg,rgba(247,245,255,.8),rgba(255,255,255,.45));
       box-shadow:0 8px 24px rgba(109,74,255,.10),inset 0 1px 0 rgba(255,255,255,.6)}
.stackgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;width:100%;align-self:center}
.tech{border:1px solid rgba(255,255,255,.7);border-radius:16px;padding:20px 16px;display:flex;flex-direction:column;
      align-items:center;gap:10px;text-align:center;
      background:rgba(255,255,255,.82);
      box-shadow:0 10px 28px rgba(17,19,26,.08),inset 0 1px 0 rgba(255,255,255,.75)}
.tech img{height:46px;width:auto}
.tech b{font-size:14.5px;color:var(--ink)}
.tech small{font-size:11.5px;color:var(--muted)}
.logorow{display:flex;gap:14px;align-items:center;margin-top:16px;flex-wrap:wrap}
.logorow img{height:26px;width:auto}
.foot{position:absolute;bottom:15px;left:26px;font-size:11px;color:#aeb6c6;font-weight:600;letter-spacing:.02em}
.code{background:#0e1018;border-radius:12px;overflow:hidden;border:1px solid #1b1f2c;width:100%}
.codebar{display:flex;align-items:center;gap:7px;padding:9px 13px;background:#161a26;border-bottom:1px solid #222838}
.codebar .dot{width:10px;height:10px;border-radius:50%}
.codebar .file{margin-left:8px;font-size:12px;color:#aeb6c6;font-weight:600}
.code pre{padding:14px 16px;font-family:"Inter",Arial,sans-serif;font-size:12.5px;line-height:1.6;color:#d6def0;white-space:pre-wrap;word-break:break-word;font-feature-settings:"tnum"}
.code .kw{color:#c792ea} .code .st{color:#86e0ad} .code .cm{color:#737d92} .code .fn{color:#82aaff} .code .nb{color:#f7c668}
.src{font-size:11px;color:var(--muted);margin-top:11px;display:flex;align-items:flex-start;gap:8px;line-height:1.45;min-width:0}
.src .ic{width:16px;height:16px;color:var(--accent);flex-shrink:0;margin-top:1px}
.src span{min-width:0;word-break:break-all;overflow-wrap:anywhere}
.src b{color:var(--accent);font-weight:600;word-break:normal}
.vargrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:13px;width:100%}
.varc{border:1px solid rgba(255,255,255,.7);border-radius:13px;padding:14px 15px;
    background:rgba(255,255,255,.82);
    box-shadow:0 8px 22px rgba(17,19,26,.07),inset 0 1px 0 rgba(255,255,255,.7)}
.varc .vt{font-weight:700;color:var(--ink);font-size:14.5px;display:flex;align-items:center;gap:8px}
.varc .vt .ic{width:18px;height:18px;color:var(--accent)}
.varc p{font-size:12px;color:var(--muted);margin-top:5px;line-height:1.4}
.varc code{font-size:10.5px}
.codetrio{display:flex;gap:12px;width:100%;margin-top:4px}
.codetrio .mc{flex:1;background:#0e1018;border:1px solid #1b1f2c;border-radius:11px;overflow:hidden}
.codetrio .mc .mch{font-size:11px;font-weight:700;color:#aeb9d6;padding:7px 12px 0;letter-spacing:.02em}
.codetrio .mc pre{margin:0;padding:7px 12px 11px;font-family:"Inter",Arial,sans-serif;font-size:10.5px;line-height:1.55;color:#d6def0;white-space:pre-wrap;word-break:break-word}
.codetrio .mc .kw{color:#c792ea} .codetrio .mc .st{color:#86e0ad} .codetrio .mc .cm{color:#737d92} .codetrio .mc .fn{color:#82aaff} .codetrio .mc .nb{color:#f7c668}
/* tableau comparatif Node-RED vs stack retenue */
.cmptbl{display:grid;grid-template-columns:0.82fr 1.1fr 1.1fr;gap:10px;width:100%;align-self:center}
.cmph{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:13px 10px;border-radius:14px;
    background:rgba(255,255,255,.85);border:1px solid var(--line);box-shadow:0 10px 26px rgba(17,19,26,.08),inset 0 1px 0 rgba(255,255,255,.7)}
.cmph.bad{background:linear-gradient(150deg,#fdf1f1,#fff);border-color:#f1d4d4}
.cmph.good{background:linear-gradient(150deg,#eefbf4,#fff);border-color:#c6ecd8;box-shadow:0 12px 30px rgba(31,180,135,.16),inset 0 1px 0 rgba(255,255,255,.8)}
.cmph .lg{display:flex;gap:9px;align-items:center;height:30px}
.cmph .lg img{height:26px;width:auto}
.cmph b{font-size:13.5px;color:var(--ink)}
.cmph .st{font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
.cmph.bad .st{color:#cf5560} .cmph.good .st{color:#1aa074}
.crit{display:flex;align-items:center;font-size:13px;font-weight:700;color:var(--ink);padding:4px 12px;line-height:1.25}
.cell{display:flex;gap:9px;align-items:flex-start;padding:11px 13px;border-radius:12px;font-size:12.5px;line-height:1.34;font-weight:500;
    box-shadow:0 6px 16px rgba(17,19,26,.05),inset 0 1px 0 rgba(255,255,255,.6)}
.cell.bad{background:rgba(253,242,242,.92);color:#9c3a42;border:1px solid #f1dada}
.cell.good{background:rgba(238,250,243,.92);color:#1a6f4f;border:1px solid #cdebda}
.cell .ci{width:18px;height:18px;flex-shrink:0;margin-top:1px}
.cell.bad .ci{color:#e05660} .cell.good .ci{color:#1fb487}
.cell b{color:inherit;font-weight:750}
@media print{
  @page{size:1180px 663.75px;margin:0}
  body{background:#fff;padding:0}.deck{gap:0}
  .slide{width:1180px;height:663.75px;aspect-ratio:auto;border-radius:0;border:none;box-shadow:none;page-break-after:always}
  /* PDF leger : on retire les ombres rasterisees (gardees a l'ecran) et on rend les cartes opaques */
  .slide *{box-shadow:none !important}
  .stat,.role,.tech,.varc,.toc .it,.hicon,.stat .si,.toc .it .ico,.me{background:#fff !important;border-color:#e7eaf0 !important}
  .role.me2{background:#f7f5ff !important;border-color:#cfc2ff !important}
  .hicon,.stat .si,.toc .it .ico{background:#f1eeff !important;border-color:#e7eaf0 !important}
  .quote{background:#f7f5ff !important}
  .shot,.photo,.diagram{box-shadow:none !important}
  /* effet verre conserve sur les 2 en-tetes du comparatif (leger, pour rester <1Mo) */
  .cmph.good{box-shadow:0 7px 16px rgba(31,180,135,.13) !important}
}
"""

def head(kick,title,icon,me=False):
    return (f'<div class="head"><div class="hicon">{ic(icon)}</div>'
            f'<div><div class="kick">{kick}</div><h2>{title}</h2></div></div>'
            f'<div class="rule"></div>'+('<div class="me">MA PARTIE · E2</div>' if me else ''))

def slide(inner,cls=""):
    return f'<section class="slide {cls}">{inner}<div class="foot">Téo Trompier</div><div class="pageno"></div></section>'

GH="github.com/NewGenesisAgency/color_room/blob/main"
def code_slide(kick,title,icon,bullets,filelabel,pre,ghpath,lines):
    src=(f'<div class="src">{ic("code-xml")}<span><b>{filelabel}</b><br>{GH}/{ghpath}#{lines}</span></div>')
    codecard=(f'<div class="code"><div class="codebar">'
              f'<span class="dot" style="background:#ff5f57"></span><span class="dot" style="background:#febc2e"></span>'
              f'<span class="dot" style="background:#28c840"></span><span class="file">{filelabel}</span></div>'
              f'<pre>{pre}</pre></div>')
    return slide(head(kick,title,icon,me=True)+
        f'<div class="body"><div class="col" style="flex:0 0 36%;min-width:0;display:flex;flex-direction:column;justify-content:center">{bullets}{src}</div>'
        f'<div class="col" style="flex:1;min-width:0;display:flex;align-items:center">{codecard}</div></div>')

def diagram(kick,title,img,icon,me=False,notes=None):
    if not notes:
        return slide(head(kick,title,icon,me)+
            f'<div class="body" style="padding:16px 40px 34px;align-items:center;justify-content:center"><div class="dcard">'
            f'<img class="diagram" src="{img}"></div></div>')
    return slide(head(kick,title,icon,me)+
        f'<div class="body"><div class="col" style="flex:0 0 36%;display:flex;flex-direction:column;justify-content:center">{notes}</div>'
        f'<div class="media"><div class="dcard"><img class="diagram" src="{img}"></div></div></div>')

def nl(*items): return "<ul>"+"".join(f"<li>{x}</li>" for x in items)+"</ul>"

def fullshot(kick,title,img,icon,me=False):
    tag=(f'<div class="fulltag">{ic(icon)}<b>{title}</b><span style="color:var(--muted)">· {kick}</span></div>')
    badge='<div class="me">MA PARTIE · E2</div>' if me else ''
    return slide(f'<div class="fullwrap">{tag}{badge}<img class="fullimg" src="{img}"></div>')

def media_slide(kick,title,bullets,img,icon,me=True,ratio="0 0 40%"):
    return slide(head(kick,title,icon,me)+
        f'<div class="body"><div class="col" style="flex:{ratio};display:flex;flex-direction:column;justify-content:center">{bullets}</div>'
        f'<div class="media"><img class="shot" src="{img}"></div></div>')

S=[]

# 1 COVER (version simple, sans icônes)
S.append(slide(f'''<div class="body cover">
  <div class="l">
    <div class="coverbadge">BTS CIEL · OPTION A · INFORMATIQUE ET RÉSEAUX · E6-2 · 2026</div>
    <h1>ColorRoom</h1>
    <div class="sub">Serious games pédagogiques sur les plaques lumineuses de la ColorRoom</div>
    <div class="covermeta">
      <div class="cmrow"><b>Téo Trompier</b> · candidat E2 · sous-équipe JavaScript</div>
      <div class="cmrow">Lycée Édouard Branly · Lyon</div>
      <div class="cmrow"><b>LUMEN</b> – Cité de la Lumière · <b>ENTPE / LTDS</b> · labo BPMNP</div>
    </div>
    <div class="coverlogos">
      <div class="ll">Pile technique</div>
      <div class="logorow">
        <img src="{LOGOS['nextdotjs']}"><img src="{LOGOS['react']}"><img src="{LOGOS['typescript']}"><img src="{LOGOS['sqlite']}"><img src="{LOGOS['docker']}"><img src="{LOGOS['raspberrypi']}">
      </div>
    </div>
  </div>
  <div class="media" style="flex:1"><img class="shot" src="{IMG['home']}"></div>
</div>'''))

# 2 SOMMAIRE (aligné sur le déroulé réel des diapositives)
toc=[("target","Contexte et commanditaire"),("cpu","Le système ColorRoom"),
 ("puzzle","Besoin et cas d'utilisation"),("users","Équipe et planification"),
 ("network","Architecture et conception"),("code-xml","Choix techniques et pile"),
 ("share-2","Réseau et déploiement"),("layout-dashboard","Interface et base de données"),
 ("lock","Sécurité et comptes"),("gamepad-2","Jeux, IA et multijoueur"),
 ("palette","Mesure et chromaticité"),("chart-column","Qualité, bilan et démo")]
toc_html="".join(f'<div class="it"><span class="ico">{ic(i)}</span><span class="tn">{n:02d}</span>{t}</div>' for n,(i,t) in enumerate(toc,1))
S.append(slide(head("Plan de la présentation","Sommaire","layout-dashboard")+f'<div class="body"><div class="toc">{toc_html}</div></div>'))

# 3 CONTEXTE (vraies photos : bâtiment LUMEN + carte Lyon)
S.append(slide(head("Le projet et son commanditaire","Contexte et partenaire","target")+
 f'''<div class="body"><div class="col" style="flex:0 0 44%;display:flex;flex-direction:column;justify-content:center"><ul>
   <li>Commanditaire : laboratoire de recherche <b>ENTPE / LTDS</b>, équipe <b>BPMNP</b></li>
   <li>ColorRoom hébergée à <b>LUMEN – La Cité de la Lumière</b> (Lyon Confluence)</li>
   <li>Équipement scientifique : <b>2 cellules jumelles</b> d'analyse des effets colorés</li>
   <li class="sub">Contacts : M. Labayrade, M. Vella · Professeur : M. Delbosc</li></ul>
   <div style="margin-top:10px;font-size:11px;color:var(--muted);line-height:1.6">
     <b>ENTPE</b> (École Nationale des Travaux Publics de l'État) · <b>LTDS</b> (Lab. de Tribologie et Dynamique des Systèmes)<br>
     <b>BPMNP</b> (Bio-ingénierie, Perception, Mécanique Numérique) · <b>LUMEN</b> (Cité de la Lumière)
   </div></div>
   <div class="media"><div class="photostack">
     <div><img class="photo" src="{PHO['lumen']}" style="width:100%;height:212px"><div class="cap">{ic("target")} LUMEN · Cité de la Lumière (Lyon Confluence)</div></div>
     <div><img class="photo" src="{PHO['map']}" style="width:100%;height:150px"><div class="cap">{ic("map-pin")} Implantation : LUMEN (Confluence) &amp; ENTPE (agglomération lyonnaise)</div></div>
   </div></div></div>'''))

# 3b LA COLORROOM (vraies photos : cellules murs + plafond)
S.append(media_slide("L'équipement existant : la ColorRoom","Deux cellules jumelles à visualiser",
 f'''<ul><li><b>2 cellules jumelles</b> (2 salles d'analyse identiques)</li>
   <li>Chaque cellule est tapissée de plaques sur les <b>murs</b> ET le <b>plafond</b></li>
   <li><b>42 plaques</b> au total (<b>21 par cellule</b>) pilotées indépendamment</li>
   <li>Permet de recréer des <b>ambiances lumineuses</b> à spectres précis</li>
   <li class="sub">Photo réelle : panneaux allumés sur murs et plafond</li></ul>
   <div style="margin-top:10px"><img class="photo" src="{PHO['labcouleur']}" style="width:100%;max-height:150px;object-fit:cover">
   <div class="cap">{ic("target")} Laboratoire de la couleur · Campus Lumière</div></div>''',
 PHO['colorroom'],"cpu",me=False,ratio="0 0 40%"))

# 4 PLAQUE LUMINEUSE (photo + dimensions + specs)
S.append(slide(head("La plaque lumineuse","Dimensions et caractéristiques","cpu")+
 f'''<div class="body"><div class="col" style="flex:0 0 34%;display:flex;flex-direction:column;justify-content:center">
   <img class="photo" src="{PHO['plaque']}" style="width:100%;height:300px">
   <div class="cap">{ic("zap")} LED en bandes sur les bords · dimensions <b>80 × 80 cm</b>, épaisseur ~<b>23 cm</b></div></div>
   <div class="col" style="flex:1"><div class="stats" style="grid-template-columns:repeat(2,1fr);gap:13px">
   <div class="stat"><div class="si">'''+ic("cpu")+'''</div><div class="num">42</div><div class="lbl">plaques (21 par cellule)</div></div>
   <div class="stat"><div class="si">'''+ic("palette")+'''</div><div class="num">32</div><div class="lbl">canaux = 24 spectres étroits + 8 blancs</div></div>
   <div class="stat"><div class="si">'''+ic("zap")+'''</div><div class="num">2360</div><div class="lbl">LED par plaque (~300 W max)</div></div>
   <div class="stat"><div class="si">'''+ic("boxes")+'''</div><div class="num">80×80</div><div class="lbl">cm par plaque (ép. ~23 cm)</div></div>
 </div>
 <div style="margin-top:13px;font-size:13px;color:var(--ink2);line-height:1.5">Pilotage en <b>RS-485</b> · spectre du <b>proche UV au proche IR</b> ; chaque plaque produit couleurs et intensités variées.</div></div></div>'''))

# 4b APPLICATION DE SUPERVISION ACTUELLE
S.append(media_slide("L'existant : l'application de supervision","Pourquoi un nouveau logiciel ?",
 f'''<ul><li>Logiciel actuel <b>réservé aux chercheurs</b> de l'ENTPE</li>
   <li>Pilotage brut : grille des plaques, <b>32 sliders</b> de canaux, courbe de <b>spectre</b></li>
   <li><b>Trop complexe</b> pour une initiation : aucune dimension pédagogique</li>
   <li class="sub">D'où ColorRoomGames : une couche <b>simple et ludique</b> par-dessus le matériel</li></ul>''',
 PHO['supervision'],"flask-conical",me=False,ratio="0 0 38%"))

# 5 PROBLEMATIQUE
def frow(icon,text,b=False):
    return f'<div class="frow{" b" if b else ""}"><div class="fi">{ic(icon)}</div><div class="ft">{text}</div></div>'
S.append(slide(head("Le besoin","Problématique et objectifs","puzzle")+
 '<div class="body" style="flex-direction:column;gap:20px;justify-content:center">'
 '<div class="quote">Le logiciel de recherche de la ColorRoom est trop complexe pour l\'initiation. Comment rendre la salle accessible aux apprenants, de façon ludique et pédagogique ?</div>'
 '<div class="split">'
 f'<div class="col"><div class="lab a">{ic("target")}Objectifs</div><div class="feat">'
 +frow("gamepad-2","Une série de <b>serious games</b> sur la lumière et la couleur")
 +frow("eye","Accessible depuis un <b>navigateur</b>, sans installation")
 +frow("cpu","Adaptable à une <b>seule plaque</b> lumineuse")
 +'</div></div>'
 f'<div class="col"><div class="lab b">{ic("lock")}Contraintes</div><div class="feat">'
 +frow("boxes","<b>Raspberry Pi 5</b> + SSD, Docker imposé",b=True)
 +frow("share-2","Fonctionnement <b>hors-ligne</b> (réseau local)",b=True)
 +frow("zap","<b>Latence</b> des plaques à compenser",b=True)
 +'</div></div>'
 '</div></div>'))

# 6 USE CASES
S.append(fullshot("Acteurs et fonctions attendues","Diagramme de cas d'utilisation",IMG['uc'],"users"))

# 7 EQUIPE
def member(ini,name,role,icon,bg,me=False):
    tag='<span class="tag">MOI</span>' if me else ''
    return (f'<div class="role mb{" me2" if me else ""}">'
            f'<div class="ava" style="background:{bg}">{ini}</div>'
            f'<div style="min-width:0"><b>{name}{tag}</b><span>{role}</span></div>'
            f'<div class="rico">{ic(icon)}</div></div>')
S.append(slide(head("8 étudiants · sous-équipes JavaScript et Python","Équipe et répartition","users",me=True)+
 '<div class="body" style="flex-direction:column;gap:16px;justify-content:center">'
 '<div class="teams">'
 f'<div class="teamchip on"><div class="tci">{ic("code-xml")}</div><div><b>Équipe JavaScript · React</b><small>E1 → E4 · dont moi (E2)</small></div></div>'
 f'<div class="teamchip"><div class="tci">{ic("boxes")}</div><div><b>Équipe Python · NiceGUI</b><small>E5 → E8</small></div></div>'
 '</div>'
 '<div class="roles">'
 +member("MB","E1 · Maxime Bonnevay","Infrastructure Pi &amp; Docker, CI/CD, intégration colorimètre, sécurité","wrench","#1fb6a6")
 +member("TT","E2 · Téo Trompier","Base de données, API, UI/UX, jeux solo + multijoueur, proxy LED, documentation","code-xml","#6d4aff",me=True)
 +member("IA","E3 · Ilyes Arbadji","Éditeur de jeux no-code (hors de mon périmètre)","puzzle","#3b6dff")
 +member("HA","E4 · Hasan Akyuz","Tests de l'API, simulateur de plaques, Swagger / Postman","circle-check","#f5a524")
 +'</div></div>'))

# 7b PLANIFICATION (Gantt réel)
S.append(fullshot("Planification du projet · jalons par étudiant (E2 suivie tout du long)","Diagramme de Gantt",PHO['gantt'],"chart-column"))

# 7c GESTION DE PROJET (agile, client, git, docs)
def frow2(icon,text,b=False):
    return f'<div class="frow{" b" if b else ""}"><div class="fi">{ic(icon)}</div><div class="ft">{text}</div></div>'
S.append(slide(head("Gestion de projet · méthode et outils","Agile, suivi client et versionnement","users",me=True)+
 '<div class="body" style="flex-direction:column;justify-content:center;gap:18px">'
 '<div class="split">'
 f'<div class="col"><div class="lab a">{ic("target")}Méthode &amp; suivi</div><div class="feat">'
 +frow2("flask-conical","Démarche <b>agile</b> : développement <b>incrémental</b>, livraisons régulières, ajustements")
 +frow2("layout-dashboard","Suivi des tâches via un <b>tableau Kanban</b> (À faire / En cours / Terminé)")
 +frow2("users","Échanges réguliers avec le <b>client M. Labayrade</b> (directeur du labo <b>BPMNP</b>)")
 +frow2("file-text","<b>Documentation</b> du projet rédigée par moi (guide technique, 15 diagrammes UML, notice)")
 +'</div></div>'
 f'<div class="col"><div class="lab b">{ic("code-xml")}Versionnement</div><div class="feat">'
 +frow2("share-2","<b>Git / GitHub</b> : commits clairs (~280), historique lisible",b=True)
 +frow2("boxes","Travail sur la branche <b>ux-last</b> (intégration) puis <b>merge sur main</b> (stable)",b=True)
 +frow2("circle-check","Chaîne <b>CI/CD</b> GitLab → build Docker → déploiement sur le Pi",b=True)
 +'</div></div>'
 '</div></div>'))

# 7d TRANSITION : début de ma contribution (E2)
S.append(slide('<div class="body center">'
 '<div class="hicon" style="width:72px;height:72px;border-radius:22px;margin-bottom:8px">'+ic("code-xml")+'</div>'
 '<div class="kick">Partie 2 · de la présentation générale à ma contribution</div>'
 '<div class="big">Ma contribution · E2</div>'
 '<p style="color:var(--muted);font-size:16px;margin-top:12px;max-width:780px;line-height:1.8">'
 'Architecture &amp; choix techniques · base de données · sécurité · interface 3D · jeux solo, IA et multijoueur · mesure colorimétrique</p>'
 '<div class="dash" style="justify-content:center;margin-top:18px"><i style="background:var(--r)"></i><i style="background:var(--y)"></i><i style="background:var(--g)"></i><i style="background:var(--b)"></i><i style="background:var(--accent)"></i></div>'
 '</div>'))

# 8 ARCHITECTURE
S.append(slide(head("Vue d'ensemble · diagramme de composants","Architecture logicielle","network",me=True)+
 f'''<div class="body"><div class="col" style="flex:0 0 33%;display:flex;flex-direction:column;justify-content:center"><ul>
   <li>Serveur unique <b>Next.js</b> (App Router) conteneurisé</li>
   <li><b>Route Handlers</b> + couche <b>lib/</b> (auth, db, services)</li>
   <li>Proxy HTTP de <b>supervision</b> ; pont <b>.NET</b> du CS-160</li>
   <li class="sub">SQLite (better-sqlite3) · 100 % hors-ligne</li>
   <li class="sub">Diagramme <b>logiciel</b> : le matériel (Raspberry Pi) figure sur le diagramme de <b>déploiement</b></li></ul></div>
   <div class="media"><img class="diagram" src="{IMG['comp']}"></div></div>'''))

# 10 CHOIX TECHNIQUES
def cmprow(crit,bad,good):
    return (f'<div class="crit">{crit}</div>'
            f'<div class="cell bad">{ic("circle-x")}<div>{bad}</div></div>'
            f'<div class="cell good">{ic("circle-check")}<div>{good}</div></div>')
S.append(slide(head("React / Next.js / TypeScript vs JS + Node-RED","Choix techniques · étude comparative","code-xml",me=True)+
 '<div class="body" style="align-items:center"><div class="cmptbl">'
 # ligne d'en-tete
 '<div class="crit" style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em">Critère</div>'
 f'<div class="cmph bad"><div class="lg"><img src="{LOGOS["javascript"]}"><img src="{LOGOS["nodered"]}"></div><b>JS + Node-RED</b><span class="st">Piste écartée</span></div>'
 f'<div class="cmph good"><div class="lg"><img src="{LOGOS["react"]}"><img src="{LOGOS["nextdotjs"]}"><img src="{LOGOS["typescript"]}"></div><b>Next.js + React + TS</b><span class="st">Retenu</span></div>'
 # lignes de comparaison
 +cmprow("Paradigme",
   "Programmation <b>par flux</b> (dataflow) : peu adapté à une appli multi-pages",
   "<b>Composants déclaratifs</b> (JSX/TSX) + routage <b>App Router</b>")
 +cmprow("Rendu / UI",
   "Pas de composants ni de <b>Virtual DOM</b>",
   "<b>Virtual DOM</b> + <b>réconciliation</b> : mise à jour minimale du DOM, état réactif")
 +cmprow("Typage",
   "<b>JavaScript</b> dynamique : erreurs au <b>runtime</b>",
   "<b>TypeScript</b> : typage statique, erreurs à la <b>compilation</b> (tsc + ESLint)")
 +cmprow("Maintenabilité",
   "Flux <b>JSON</b> peu lisibles en revue de code / Git",
   "Code <b>modulaire</b> et <b>versionnable</b> (diffs Git, revue de code)")
 +cmprow("Back-end",
   "Logique couplée au <b>moteur de flux</b>",
   "<b>Route Handlers</b> + <b>Server Components</b> : un seul <b>runtime</b> Node (SSR)")
 +'</div></div>'))

# 11 STACK (logos)
def tech(l,name,ver): return f'<div class="tech"><img src="{LOGOS[l]}"><b>{name}</b><small>{ver}</small></div>'
S.append(slide(head("Technologies mises en œuvre","La pile technique","boxes",me=True)+
 '<div class="body"><div class="stackgrid">'+
 tech("nextdotjs","Next.js","16.2 · App Router")+tech("react","React","19 · composants")+
 tech("typescript","TypeScript","5.5 · strict")+tech("nodedotjs","Node.js","runtime serveur")+
 tech("sqlite","SQLite","better-sqlite3 11.5")+tech("threedotjs","Three.js","0.160 · vue 3D")+
 tech("docker","Docker","multi-stage arm64")+tech("raspberrypi","Raspberry Pi","5 · cible")+
 tech("css","CSS","langage de style")+tech("lucide","Lucide","icônes")+
 tech("ollama","Ollama","exécution de modèles IA en local")+
 '</div>'
 '</div>'))

# 12 RESEAU
S.append(slide(head("Docker · Raspberry Pi 5 · diagramme de déploiement","Réseau et déploiement","share-2")+
 f'''<div class="body"><div class="col" style="flex:0 0 38%;display:flex;flex-direction:column;justify-content:center"><ul>
   <li><b>Raspberry Pi 5</b> + <b>Docker</b> (image arm64)</li>
   <li><b>Dalles</b> : bus <b>RS-485</b></li>
   <li><b>CS-160</b> : <b>USB</b> + API</li>
   <li><b>Clients</b> : <b>Wi-Fi local</b> (ColorRoom_WiFI)</li>
   <li><b>Accès</b> : <b>http://172.17.40.39:8080</b></li></ul></div>
   <div class="media"><img class="diagram" src="{IMG['dep']}"></div></div>'''))

# 12b CONFIGURATION
S.append(media_slide("Ma partie · configuration","Adresses des API et canaux LED",
 '''<ul><li>Réglage des <b>URL d'API à chaud</b> (Supervision, CS-160) sans redémarrer le serveur</li>
   <li>Stockées en base ; repli sur les <b>variables d'environnement</b></li>
   <li>Bouton <b>Tester (/health)</b> pour vérifier la liaison matériel</li>
   <li>Banc de test des <b>32 canaux LED</b> (0-255) par dalle, debounce 200 ms</li></ul>''',IMG['config'],"wrench",ratio="0 0 42%"))

# 13 INTERFACE
S.append(media_slide("Ma partie · interface","Interface et design system",
 '''<ul><li>Design system « <b>verre dépoli</b> » : variables CSS partagées</li>
   <li>Pages : accueil 3D, /jeux, /mesure, /chromaticite, /gestion, /aide</li>
   <li><b>Menu dynamique</b> selon le rôle</li>
   <li><b>Vue 3D</b> (Three.js : WebGLRenderer, Room3D, 2 cellules)</li>
   <li class="sub">forceContextLoss au démontage · pause via Page Visibility API</li></ul>''',IMG['jeux'],"layout-dashboard",ratio="0 0 42%"))

# 13b THREE.JS (code)
S.append(code_slide("Extrait de code · 3D temps réel","Vue 3D de la salle (Three.js)","boxes",
 '''<ul><li><b>WebGLRenderer</b> → rendu <b>GPU</b></li>
   <li><b>Scène</b> + <b>caméra</b></li>
   <li>Dalle = <b>Box</b> + matériau <b>émissif</b></li>
   <li><code>emissive.set(color)</code> : couleur en direct</li>
   <li><code>requestAnimationFrame</code> : boucle</li>
   <li><code>forceContextLoss</code> : nettoyage</li></ul>''',
 "app/app/_components/Room3D.tsx",
 '''<span class="cm">// rendu de la scène 3D via le GPU</span>
<span class="kw">const</span> renderer = <span class="kw">new</span> THREE.<span class="fn">WebGLRenderer</span>({ antialias: <span class="kw">true</span> });
<span class="kw">const</span> scene  = <span class="kw">new</span> THREE.<span class="fn">Scene</span>();
<span class="kw">const</span> camera = <span class="kw">new</span> THREE.<span class="fn">PerspectiveCamera</span>(CAM_FOV, W/H, <span class="nb">0.05</span>, <span class="nb">80</span>);

<span class="cm">// une dalle = un panneau 3D qui émet sa couleur</span>
<span class="kw">const</span> mat   = <span class="kw">new</span> THREE.<span class="fn">MeshStandardMaterial</span>({ emissive: <span class="nb">0x000000</span> });
<span class="kw">const</span> plate = <span class="kw">new</span> THREE.<span class="fn">Mesh</span>(<span class="kw">new</span> THREE.<span class="fn">BoxGeometry</span>(PS, PS, PT), mat);
mat.emissive.<span class="fn">set</span>(color);   <span class="cm">// la dalle s'allume</span>
scene.<span class="fn">add</span>(plate);

<span class="cm">// boucle de rendu</span>
<span class="kw">function</span> <span class="fn">loop</span>() { renderer.<span class="fn">render</span>(scene, camera); <span class="fn">requestAnimationFrame</span>(loop); }
<span class="fn">loop</span>();

<span class="kw">return</span> () =&gt; renderer.<span class="fn">forceContextLoss</span>();   <span class="cm">// nettoyage</span>''',
 "app/app/_components/Room3D.tsx","L255-L545"))

# 14 BDD
S.append(slide(head("Ma partie · données · modèle relationnel","Base de données SQLite","database",me=True)+
 f'''<div class="body"><div class="col" style="flex:0 0 37%;display:flex;flex-direction:column;justify-content:center"><ul>
   <li><b>better-sqlite3</b> · requêtes <b>préparées</b> (anti-injection)</li>
   <li>Tables <b>créées automatiquement</b> au démarrage : on peut <b>relancer sans rien casser</b></li>
   <li><b>WAL</b> : on peut <b>lire pendant qu'on écrit</b> (pas de blocage)</li>
   <li>Si la base est occupée, l'app <b>réessaie</b> quelques secondes au lieu d'échouer</li>
   <li>Suppression d'un compte = ses données liées <b>supprimées en cascade</b></li></ul></div>
   <div class="col" style="flex:1"><div class="dbtables">
   <div class="dbrow"><code>crg_users</code><span>comptes : pseudo, mot de passe haché, rôle</span></div>
   <div class="dbrow"><code>crg_classes</code><span>classes (code + QR), créées par un enseignant</span></div>
   <div class="dbrow rel"><code>crg_class_members</code><span>lien élève ↔ classe (users ↔ classes)</span></div>
   <div class="dbrow rel"><code>crg_sessions</code><span>jetons de connexion → users</span></div>
   <div class="dbrow rel"><code>crg_scores</code><span>scores par jeu → users</span></div>
   <div class="dbrow"><code>crg_games</code><span>jeux (natifs + créés dans l'éditeur)</span></div>
   <div class="dbrow rel"><code>crg_mp_sessions / mp_players</code><span>parties multijoueur (players → session)</span></div>
   <div class="dbrow"><code>crg_app_config</code><span>réglages (URL des API)</span></div>
   </div></div></div>'''))

# 14c VARIABLES / PERSISTANCE
def varc(i,t,d): return f'<div class="varc"><div class="vt">{ic(i)}{t}</div><p>{d}</p></div>'
S.append(slide(head("Typologie des variables et de la persistance","Gestion de l'état","database",me=True)+
 '<div class="body" style="flex-direction:column;align-items:center;gap:10px"><div class="vargrid">'
 +varc("database","Persistante","Stockée durablement en SQLite (survit aux redémarrages, volume Docker). <code>lib/db</code>")
 +varc("circle-check","Transactionnelle · atomique","<code>db.transaction()</code> : ACID, tout-ou-rien (user + classe). <code>register</code>")
 +varc("zap","Volatile (en mémoire)","<code>useRef</code> : état runtime des dalles/jeux, perdu au rechargement. <code>app/jeux</code>")
 +varc("lock","Environnement","<code>process.env</code> : secrets (clé, mot de passe admin) via <code>.env</code>, hors Git.")
 +varc("share-2","Réactive","<code>useState</code> : déclenche le re-rendu de l'interface à chaque changement.")
 +varc("network","Concurrente","Sémaphore <code>HW_CONCURRENCY=2</code> : sérialise les accès au matériel. <code>batch</code>")
 +'</div><div class="codetrio">'
 '<div class="mc"><div class="mch">Transactionnelle</div><pre>'
 '<span class="cm">// tout-ou-rien (ACID)</span>\n'
 '<span class="kw">const</span> tx = db.<span class="fn">transaction</span>(() =&gt; {\n'
 '  insertUser.<span class="fn">run</span>(...);  <span class="cm">// + adhésion classe</span>\n'
 '});\n'
 '<span class="fn">tx</span>();   <span class="cm">// BEGIN … COMMIT / ROLLBACK</span></pre></div>'
 '<div class="mc"><div class="mch">Atomique</div><pre>'
 '<span class="kw">let</span> hwInFlight = <span class="nb">0</span>;     <span class="cm">// compteur</span>\n'
 '<span class="kw">if</span> (hwInFlight &lt; <span class="nb">2</span>)       <span class="cm">// 2 slots max</span>\n'
 '  hwInFlight++;          <span class="cm">// accès matériel</span>\n'
 '<span class="kw">else await</span> <span class="fn">waitQueue</span>();  <span class="cm">// sinon : file</span></pre></div>'
 '<div class="mc"><div class="mch">Volatile</div><pre>'
 '<span class="kw">const</span> [score, setScore] = <span class="fn">useState</span>(<span class="nb">0</span>); <span class="cm">// réactif</span>\n'
 '<span class="kw">const</span> comboRef = <span class="fn">useRef</span>(<span class="nb">0</span>);  <span class="cm">// pur, sans re-render</span>\n'
 'comboRef.current++;          <span class="cm">// mutation directe</span></pre></div>'
 '</div></div>'))

# 16 SEQ AUTH
S.append(diagram("Séquence · connexion","Authentification (PBKDF2 + cookie)",IMG['sauth'],"lock",me=True,
 notes=nl("L'apprenant saisit identifiant + mot de passe",
   "L'API recalcule le hash via <b>verifyPassword</b> (PBKDF2)",
   "Si valide, création d'une <b>session</b> (token aléatoire)",
   "Renvoi d'un cookie <b>HttpOnly + SameSite</b> (30 j glissants)")))

# 21 P4 IA (minimax + alpha-beta, fusionne)
S.append(code_slide("Ma partie · intelligence artificielle","Puissance 4 et son IA minimax","bot",
 '''<ul><li>Grille 6 × 7 ; 2 joueurs ou IA <b>hors-ligne</b></li>
   <li><b>minimax</b> + <b>élagage alpha-bêta</b> : on coupe les branches inutiles (<code>alpha &gt;= beta</code>)</li>
   <li>Feuilles évaluées par <code>evaluateBoard</code> : fenêtres de 4, <b>défense &gt; attaque</b> + poids central</li>
   <li>Coups triés <b>centre d'abord</b> (<code>orderColumns</code>) pour élaguer plus tôt</li>
   <li><b>5 niveaux</b> réglés par <code>depth</code> et <code>noise</code> ; victoire = <code>WIN_SCORE</code></li></ul>''',
 "app/app/_components/GamePuissance4.tsx",
 '''<span class="cm">// 1) Heuristique : note une fenêtre de 4 (défense &gt; attaque)</span>
<span class="kw">function</span> <span class="fn">scoreWindow</span>(me, opp) {
  <span class="kw">if</span> (me === <span class="nb">4</span>)  <span class="kw">return</span> WIN_SCORE; <span class="cm">// 4 à moi = victoire (1 000 000)</span>
  <span class="kw">if</span> (opp === <span class="nb">3</span>) <span class="kw">return</span> -<span class="nb">170</span>;      <span class="cm">// menace adverse : DANGER → défense</span>
  <span class="kw">if</span> (me === <span class="nb">3</span>)  <span class="kw">return</span> <span class="nb">130</span>;       <span class="cm">// ma menace : bon, mais moins</span>
  <span class="kw">return</span> me - opp;                  <span class="cm">// léger avantage sinon</span>
}

<span class="cm">// 2) minimax + élagage alpha-bêta (depth = coups d'avance)</span>
<span class="kw">function</span> <span class="fn">minimax</span>(grid, depth, alpha, beta, iaJoue) {
  <span class="kw">if</span> (depth === <span class="nb">0</span>) <span class="kw">return</span> <span class="fn">evaluateBoard</span>(grid); <span class="cm">// feuille : on note</span>
  <span class="kw">let</span> best = iaJoue ? -Infinity : Infinity;
  <span class="kw">for</span> (<span class="kw">const</span> c <span class="kw">of</span> <span class="fn">orderColumns</span>(coups)) {   <span class="cm">// centre d'abord → coupe + tôt</span>
    <span class="kw">const</span> v = <span class="fn">minimax</span>(<span class="fn">joue</span>(grid, c), depth-<span class="nb">1</span>, alpha, beta, !iaJoue);
    <span class="kw">if</span> (iaJoue) { best = Math.<span class="fn">max</span>(best, v); alpha = Math.<span class="fn">max</span>(alpha, best); } <span class="cm">// IA maximise</span>
    <span class="kw">else</span>       { best = Math.<span class="fn">min</span>(best, v); beta  = Math.<span class="fn">min</span>(beta,  best); } <span class="cm">// joueur minimise</span>
    <span class="kw">if</span> (alpha &gt;= beta) <span class="kw">break</span>;            <span class="cm">// coupure : branche inutile</span>
  }
  <span class="kw">return</span> best;
}''',
 "app/app/_components/GamePuissance4.tsx","L116-L199"))

# 22 MULTIJOUEUR
S.append(media_slide("Ma partie · jeux en réseau","Les jeux multijoueur",
 '''<ul><li>État persisté <b>en base</b>, récupéré par <b>polling</b> de <code>/state</code></li>
   <li><b>Spectre Chromatique</b> : jusqu'à 8 joueurs (score = distance)</li>
   <li><b>Morpion en réseau</b> : 2 joueurs, détection de victoire</li>
   <li><b>Heartbeat</b> de présence · jetons <b>UUID</b> · hôte = siège 1</li></ul>''',IMG['multi'],"users",ratio="0 0 48%"))

# 23c EDITEUR + IA GENERATIVE
S.append(media_slide("Exploration · éditeur &amp; génération par IA","Créer un jeu sans coder",
 '''<ul><li>Éditeur <b>no-code</b> (partie E3) : graphe de <b>nœuds</b> + aperçu 3D live</li>
   <li>Mon exploration : <b>« Créer avec l'IA »</b> génère un jeu complet depuis une phrase</li>
   <li>Route <code>/api/ai/generate-game</code> → <b>Ollama</b> (local) ou Gemini (cloud, optionnel)</li>
   <li class="sub">Garde-fous : reste <b>éducatif</b> ; intègre les nœuds CS-160 et dalles</li></ul>''',IMG['editeur'],"sparkles",ratio="0 0 40%"))

# 27b AIDE + QUALITE (fusion : une seule slide, image /aide)
S.append(media_slide("Ma partie · aide &amp; qualité","Documentation et robustesse",
 '''<ul><li>Page <b>/aide</b> embarquée (hors-ligne) : comment jouer, mesurer, lire le diagramme CIE</li>
   <li><b>Documentation</b> rédigée par moi : guide technique, <b>15 diagrammes UML</b>, README d'installation</li>
   <li>Robustesse : <b>migrations idempotentes</b>, <b>transactions ACID</b>, connexion SQLite en <b>singleton</b></li>
   <li class="sub">Vérif <b>types (tsc)</b> + build prod à chaque étape · exports CSV UTF-8 + BOM · tests API (E4)</li></ul>''',IMG['aide'],"file-text",ratio="0 0 48%"))

# 29 DIFFICULTES
S.append(slide(head("Démarche d'ingénieur","Difficultés rencontrées et solutions","flask-conical",me=True)+
 '<div class="body" style="flex-direction:column;justify-content:center">'+
 ''.join(f'<div class="fix"><div class="pb">{p}</div><div class="ar">'+ic("share-2")+f'</div><div class="so">'+ic("circle-check")+f'<span>{s}</span></div></div>' for p,s in [
   ("CORS &amp; pare-feu bloquant l'API Supervision","En-têtes CORS + ouverture du port Windows + portproxy"),
   ("Latence des plaques (32 canaux)","Envoi parallèle (Promise.all) + timeout (AbortController)"),
   ("Couleur écran différente des dalles","Rendu unifié + profils calés sur les longueurs d'onde"),
 ])+'</div>'))

# 31 DEMO (slide-pont vers la démonstration)
S.append(slide('<div class="body center"><div class="hicon" style="width:64px;height:64px;border-radius:18px;margin-bottom:6px">'+ic("eye")+'</div><div class="kick">Place à la</div><div class="big">Démonstration</div><p style="color:var(--muted);font-size:16px;margin-top:12px;max-width:760px;line-height:1.8">Connexion · catalogue et un jeu sur les dalles · Puissance 4 contre l’IA · un jeu multijoueur · mesure CS-160 et diagramme CIE · tableau de bord enseignant</p></div>'))

# 33 VIDEO (a lancer en fin de presentation)
S.append(slide('<div class="body center">'
 '<div class="hicon" style="width:84px;height:84px;border-radius:26px;margin-bottom:10px">'+ic("circle-play")+'</div>'
 '<div class="kick">Démonstration</div>'
 '<div class="big">Vidéo du projet</div>'
 '<p style="color:var(--muted);font-size:16px;margin-top:10px;max-width:680px;line-height:1.7">Présentation filmée de la ColorRoom en fonctionnement · ≈ 2 min</p>'
 '<div style="margin-top:18px;display:inline-flex;align-items:center;gap:9px;background:rgba(109,74,255,.10);border:1px solid rgba(109,74,255,.35);color:var(--accent);font-weight:700;border-radius:30px;padding:9px 18px;font-size:14px">'
 +ic("circle-play")+'<span style="font-family:Bricolage Grotesque,Inter,sans-serif">video_demo.mov</span></div>'
 '</div>'))


# ===== ANNEXES (après la vidéo) =====
S.append(slide('<div class="body center"><div class="hicon" style="width:64px;height:64px;border-radius:18px;margin-bottom:6px">'+ic("file-text")+'</div><div class="kick">Pour les questions du jury</div><div class="big">Annexes</div><p style="color:var(--muted);font-size:15px;margin-top:10px;max-width:780px;line-height:1.7">Code détaillé (variables transactionnelle / atomique / volatile, sécurité) et architecture des dossiers.</p></div>'))
# 14b CODE transaction atomique
S.append(code_slide("Extrait de code · données","Variable transactionnelle (ACID)","circle-check",
 '''<ul><li><span style="font-size:12px;color:var(--muted)">(ACID = Atomicité, Cohérence, Isolation, Durabilité : les garanties d'une transaction)</span></li>
   <li><code>db.transaction()</code> encapsule un <b>BEGIN / COMMIT / ROLLBACK</b></li>
   <li>L'inscription = INSERT utilisateur <b>+</b> jonction de classe, en <b>une seule unité</b></li>
   <li><b>Atomicité</b> : exception &rarr; <b>ROLLBACK</b> total, jamais de compte « à moitié créé »</li>
   <li>Requêtes <b>préparées</b> (<code>prepare</code>) = anti-injection SQL</li></ul>''',
 "app/app/api/auth/register/route.ts",
 '''<span class="cm">// Variable transactionnelle : tout-ou-rien (ACID).</span>
<span class="kw">const</span> insertAll = db.<span class="fn">transaction</span>(() =&gt; {
  db.<span class="fn">prepare</span>(<span class="st">"INSERT INTO crg_users (id, name,</span>
    <span class="st">user_type, password_hash, …) VALUES (?,…)"</span>)
    .<span class="fn">run</span>(id, name, <span class="st">'apprenant'</span>, hash, …);

  <span class="kw">if</span> (classCode?.<span class="fn">trim</span>()) {            <span class="cm">// jonction optionnelle</span>
    <span class="kw">const</span> cls = db.<span class="fn">prepare</span>(<span class="st">"SELECT id FROM</span>
      <span class="st">crg_classes WHERE code = ?"</span>).<span class="fn">get</span>(code);
    <span class="kw">if</span> (cls) db.<span class="fn">prepare</span>(<span class="st">"INSERT OR IGNORE INTO</span>
      <span class="st">crg_class_members …"</span>).<span class="fn">run</span>(rid, cls.id, id);
  }
});
<span class="fn">insertAll</span>();   <span class="cm">// BEGIN … COMMIT (ROLLBACK si throw)</span>''',
 "app/app/api/auth/register/route.ts","L47-L62"))

# 14d CODE compteur atomique / semaphore materiel
S.append(code_slide("Extrait de code · concurrence","Variable atomique · sémaphore matériel","cpu",
 '''<ul><li><code>hwInFlight</code> = <b>compteur atomique</b> des accès au matériel en cours</li>
   <li><b>Atomique</b> de fait : la boucle d'événements de Node est <b>mono-thread</b> (pas d'accès simultané réel)</li>
   <li>Au-delà de <b>2 slots</b>, les requêtes attendent dans une <b>file</b> (Promises)</li>
   <li>supervision.exe est <b>quasi-série</b> : on borne pour ne pas le saturer</li></ul>''',
 "app/app/api/supervision/batch/route.ts",
 '''<span class="kw">const</span> HW_CONCURRENCY = <span class="nb">2</span>;   <span class="cm">// quasi-série</span>
<span class="kw">let</span> hwInFlight = <span class="nb">0</span>;          <span class="cm">// variable atomique</span>
<span class="kw">const</span> hwWaiters: Waiter[] = [];  <span class="cm">// file d'attente</span>

<span class="kw">async function</span> <span class="fn">acquireHwSlot</span>() {
  <span class="kw">if</span> (hwInFlight &lt; HW_CONCURRENCY) {
    hwInFlight++; <span class="kw">return</span> <span class="kw">true</span>;     <span class="cm">// slot libre</span>
  }
  <span class="kw">return new</span> <span class="fn">Promise</span>(r =&gt; hwWaiters.<span class="fn">push</span>({ resolve: r }));
}
<span class="kw">function</span> <span class="fn">releaseHwSlot</span>() {
  hwInFlight--;                  <span class="cm">// libère un slot</span>
  <span class="fn">drainWaiters</span>();              <span class="cm">// réveille le suivant</span>
}''',
 "app/app/api/supervision/batch/route.ts","L39-L80"))

# 15b CODE variable volatile (useRef) - apres securite
S.append(code_slide("Extrait de code · variable volatile","État temporaire en mémoire (useRef)","zap",
 '''<ul><li>Une variable <b>volatile</b> vit en <b>mémoire vive</b> le temps de la partie : <b>perdue au rechargement</b></li>
   <li><code>useRef</code> : valeur mutable <b>sans re-rendu</b> (rapide : état de jeu haute fréquence)</li>
   <li><code>useState</code> : volatile <b>réactif</b> (re-dessine l'écran quand ça change)</li>
   <li>On ne <b>persiste</b> (SQLite) que le <b>résultat final</b> : le score</li></ul>''',
 "app/app/_components/GameColorSpeed.tsx",
 '''<span class="cm">// Volatile RÉACTIF : re-affiche l'écran quand ça change</span>
<span class="kw">const</span> [score, setScore]       = <span class="fn">useState</span>(<span class="nb">0</span>);
<span class="kw">const</span> [timeLeft, setTimeLeft] = <span class="fn">useState</span>(cfg.duration);

<span class="cm">// Volatile PUR : en mémoire, NE déclenche PAS de re-rendu (rapide)</span>
<span class="kw">const</span> comboRef     = <span class="fn">useRef</span>(<span class="nb">0</span>);   <span class="cm">// combo en cours</span>
<span class="kw">const</span> lightRef     = <span class="fn">useRef</span>(<span class="nb">0</span>);   <span class="cm">// dalle allumée</span>
<span class="kw">const</span> tileStartRef = <span class="fn">useRef</span>(<span class="nb">0</span>);   <span class="cm">// instant d'allumage</span>

comboRef.current++;            <span class="cm">// mutation directe, sans re-render</span>
<span class="cm">// ... en fin de partie SEULEMENT, on persiste le score en base.</span>''',
 "app/app/_components/GameColorSpeed.tsx","L160-L181"))


# ANNEXE CODE PBKDF2
S.append(code_slide("Annexe · sécurité","Hachage des mots de passe (PBKDF2)","lock",
 '''<ul><li>Dérivation lente <b>PBKDF2-HMAC-SHA512</b>, 100 000 itérations</li>
   <li><b>Sel aléatoire</b> de 16 octets par compte (anti rainbow-tables)</li>
   <li>Vérification : on <b>recalcule</b> avec le même sel et on compare</li></ul>''',
 "app/lib/auth.ts",
 '''<span class="kw">export function</span> <span class="fn">hashPassword</span>(password) {
  <span class="kw">const</span> salt = <span class="fn">randomBytes</span>(<span class="nb">16</span>).toString(<span class="st">'hex'</span>);
  <span class="kw">const</span> hash = <span class="fn">pbkdf2Sync</span>(password, salt, <span class="nb">100_000</span>, <span class="nb">64</span>, <span class="st">'sha512'</span>);
  <span class="kw">return</span> salt + <span class="st">':'</span> + hash.toString(<span class="st">'hex'</span>);  <span class="cm">// format sel:hash</span>
}
<span class="kw">export function</span> <span class="fn">verifyPassword</span>(pw, stored) {
  <span class="kw">const</span> [salt, hash] = stored.<span class="fn">split</span>(<span class="st">':'</span>);
  <span class="kw">const</span> calc = <span class="fn">pbkdf2Sync</span>(pw, salt, <span class="nb">100_000</span>, <span class="nb">64</span>, <span class="st">'sha512'</span>);
  <span class="kw">return</span> calc.toString(<span class="st">'hex'</span>) === hash;   <span class="cm">// recalcule + compare</span>
}''',
 "app/lib/auth.ts","L19-L36"))

# ANNEXE ARBORESCENCE DES DOSSIERS
S.append(slide(head("Annexe · architecture des dossiers","Où se trouve chaque partie","boxes")+
 '''<div class="body"><div class="col" style="display:flex;align-items:center"><div class="code" style="width:100%"><div class="codebar"><span class="dot" style="background:#ff5f57"></span><span class="dot" style="background:#febc2e"></span><span class="dot" style="background:#28c840"></span><span class="file">arborescence</span></div><pre>app/
&#9500; app/                <span class="cm"># Next.js (App Router)</span>
&#9474;  &#9500; _components/      <span class="cm"># UI + jeux (Room3D, P4)</span>
&#9474;  &#9500; api/              <span class="cm"># routes serveur</span>
&#9474;  &#9474;   &#9500; auth/  supervision/  cs160/
&#9474;  &#9474;   &#9492; multiplayer/  scores/  games/
&#9474;  &#9492; jeux/ editeur/ mesure/ gestion/   <span class="cm"># pages</span>
&#9500; lib/                 <span class="cm"># logique partagée</span>
&#9474;  &#9500; db/               <span class="cm"># SQLite + migrations</span>
&#9474;  &#9500; auth.ts           <span class="cm"># hachage + sessions</span>
&#9474;  &#9492; multiplayer.ts  settings.ts
&#9492; public/  Dockerfile  package.json</pre></div></div>
 <div class="col" style="flex:0 0 36%;display:flex;flex-direction:column;justify-content:center"><ul>
   <li><b>app/app/api/</b> : tout le <b>back</b> (mes Route Handlers)</li>
   <li><b>app/app/_components/</b> : l'<b>interface</b> et les <b>jeux</b></li>
   <li><b>app/lib/</b> : <b>base de données</b>, <b>auth</b>, services</li>
   <li class="sub">Un seul projet = front + back ensemble</li></ul></div></div>'''))
HTML=f'''<!DOCTYPE html><html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>ColorRoom · Téo Trompier (E2)</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>{CSS}</style></head><body>
{SPRITE}
<div class="deck">
{chr(10).join(S)}
</div>
<script>
(function(){{const sl=[...document.querySelectorAll('.slide')];
 sl.forEach((s,i)=>{{const p=s.querySelector('.pageno'); if(p) p.textContent=(i+1)+' / '+sl.length;}});}})();
</script></body></html>'''
pathlib.Path("ColorRoom_Presentation.html").write_text(HTML,encoding="utf-8")
print("HTML OK · slides:",len(S),"· taille:",round(len(HTML)/1024/1024,2),"Mo · tirets:",HTML.count("—"),"· serif:",("serif" in HTML and "sans-serif" not in HTML))
