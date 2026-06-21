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
 "uc":uml("UseCases"),"cls":uml("Classes"),"comp":uml("Composants"),"dep":uml("Deploiement"),
 "erd":uml("ERD"),"sauth":uml("Seq_Auth"),"sjeu":uml("Seq_Jeu"),"scs":uml("Seq_CS160"),
 "smp":uml("Seq_MP"),"ej":uml("Etats_Jeu"),"ecs":uml("Etats_CS160"),"remap":uml("Activite_Remap"),
}
LOGOS={n:logo(n) for n in ["react","nextdotjs","typescript","sqlite","docker","threedotjs","nodedotjs","raspberrypi"]}
PHO={"lumen":photo("lumen.jpg"),"map":photo("map.jpg"),"plaque":photo("plaque.jpg"),"gantt":photo("gantt.png")}

# --- Sprite Lucide (icones officielles, ISC) ---
def luc_inner(name):
    t=pathlib.Path(f"{LUC}/{name}.svg").read_text()
    m=re.search(r"<svg[^>]*>(.*)</svg>", t, re.S)
    return m.group(1).strip()
LIST=["house","gamepad-2","bot","lock","database","share-2","palette","cpu","layout-dashboard",
      "target","users","code-xml","file-text","boxes","zap","circle-check","chart-column",
      "network","puzzle","eye","sparkles","flask-conical","wrench"]
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
.shot{width:100%;border-radius:12px;border:1px solid var(--line);box-shadow:0 10px 30px rgba(17,19,26,.12);display:block}
.photo{border-radius:14px;border:1px solid rgba(255,255,255,.7);display:block;object-fit:cover;
    box-shadow:0 14px 38px rgba(17,19,26,.16),inset 0 1px 0 rgba(255,255,255,.4)}
.photostack{display:flex;flex-direction:column;gap:12px;width:100%;height:100%;justify-content:center}
.cap{font-size:11.5px;color:var(--muted);font-weight:500;margin-top:6px;display:flex;align-items:center;gap:6px}
.media{flex:1;display:flex;align-items:center;justify-content:center;min-width:0}
.cover{justify-content:center;padding:0 70px;gap:46px}
.cover .l{flex:1.25}
.cover h1{font-size:80px;font-weight:800;color:var(--ink);line-height:.95;margin:10px 0;font-family:"Bricolage Grotesque","Inter",sans-serif}
.cover .sub{font-size:20px;color:var(--ink2);font-weight:500;max-width:560px}
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
.src{font-size:11.5px;color:var(--muted);margin-top:11px;display:flex;align-items:center;gap:8px;line-height:1.4}
.src .ic{width:16px;height:16px;color:var(--accent);flex-shrink:0}
.src b{color:var(--accent);font-weight:600}
.vargrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:13px;width:100%}
.varc{border:1px solid rgba(255,255,255,.7);border-radius:13px;padding:14px 15px;
    background:rgba(255,255,255,.82);
    box-shadow:0 8px 22px rgba(17,19,26,.07),inset 0 1px 0 rgba(255,255,255,.7)}
.varc .vt{font-weight:700;color:var(--ink);font-size:14.5px;display:flex;align-items:center;gap:8px}
.varc .vt .ic{width:18px;height:18px;color:var(--accent)}
.varc p{font-size:12px;color:var(--muted);margin-top:5px;line-height:1.4}
.varc code{font-size:10.5px}
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
}
"""

def head(kick,title,icon,me=False):
    return (f'<div class="head"><div class="hicon">{ic(icon)}</div>'
            f'<div><div class="kick">{kick}</div><h2>{title}</h2></div></div>'
            f'<div class="rule"></div>'+('<div class="me">MA PARTIE · E2</div>' if me else ''))

def slide(inner,cls=""):
    return f'<section class="slide {cls}">{inner}<div class="foot">Téo Trompier</div><div class="pageno"></div></section>'

GH="github.com/NewGenesisAgency/color_room/blob/main/app"
def code_slide(kick,title,icon,bullets,filelabel,pre,ghpath,lines):
    src=(f'<div class="src">{ic("code-xml")}<span><b>{filelabel}</b><br>{GH}/{ghpath}#{lines}</span></div>')
    codecard=(f'<div class="code"><div class="codebar">'
              f'<span class="dot" style="background:#ff5f57"></span><span class="dot" style="background:#febc2e"></span>'
              f'<span class="dot" style="background:#28c840"></span><span class="file">{filelabel}</span></div>'
              f'<pre>{pre}</pre></div>')
    return slide(head(kick,title,icon,me=True)+
        f'<div class="body"><div class="col" style="flex:0 0 38%;display:flex;flex-direction:column;justify-content:center">{bullets}{src}</div>'
        f'<div class="col" style="flex:1;display:flex;align-items:center">{codecard}</div></div>')

def diagram(kick,title,img,icon,me=False,notes=None):
    if not notes:
        return slide(head(kick,title,icon,me)+
            f'<div class="body" style="padding:16px 40px 34px;align-items:center;justify-content:center"><div class="dcard">'
            f'<img class="diagram" src="{img}"></div></div>')
    return slide(head(kick,title,icon,me)+
        f'<div class="body"><div class="col" style="flex:0 0 36%;display:flex;flex-direction:column;justify-content:center">{notes}</div>'
        f'<div class="media"><div class="dcard"><img class="diagram" src="{img}"></div></div></div>')

def nl(*items): return "<ul>"+"".join(f"<li>{x}</li>" for x in items)+"</ul>"

def media_slide(kick,title,bullets,img,icon,me=True,ratio="0 0 40%"):
    return slide(head(kick,title,icon,me)+
        f'<div class="body"><div class="col" style="flex:{ratio};display:flex;flex-direction:column;justify-content:center">{bullets}</div>'
        f'<div class="media"><img class="shot" src="{img}"></div></div>')

S=[]

# 1 COVER
S.append(slide(f'''<div class="body cover">
  <div class="l">
    <div class="kick" style="font-size:13px">BTS CIEL · OPTION A INFORMATIQUE ET RÉSEAUX · ÉPREUVE E6-2 · 2026</div>
    <h1>ColorRoom</h1>
    <div class="dash"><i style="background:var(--r)"></i><i style="background:var(--y)"></i><i style="background:var(--g)"></i><i style="background:var(--b)"></i><i style="background:var(--accent)"></i></div>
    <div class="sub">Serious games pédagogiques sur les plaques lumineuses de la ColorRoom</div>
    <div class="meta"><b>Téo Trompier</b> &nbsp;·&nbsp; partie E2<br>
      <small>Équipe JavaScript · Lycée Édouard Branly, Lyon<br>Partenaires : LUMEN – La Cité de la Lumière · ENTPE / LTDS / BPMNP</small></div>
    <div class="logorow">
      <img src="{LOGOS['nextdotjs']}"><img src="{LOGOS['react']}"><img src="{LOGOS['typescript']}"><img src="{LOGOS['sqlite']}"><img src="{LOGOS['docker']}"><img src="{LOGOS['raspberrypi']}">
    </div>
  </div>
  <div class="media" style="flex:1"><img class="shot" src="{IMG['home']}"></div>
</div>'''))

# 2 SOMMAIRE
toc=[("target","Contexte et système"),("users","Cas d'utilisation et équipe"),("network","Architecture et classes"),
 ("code-xml","Choix techniques et stack"),("share-2","Réseau et déploiement"),("layout-dashboard","Interface et données"),
 ("lock","Sécurité et comptes"),("gamepad-2","Jeux, IA et multijoueur"),("palette","Mesure et chromaticité"),
 ("file-text","Documentation et qualité"),("chart-column","Bilan"),("eye","Démonstration")]
toc_html="".join(f'<div class="it"><span class="ico">{ic(i)}</span>{t}</div>' for i,t in toc)
S.append(slide(head("Plan de la présentation","Sommaire","layout-dashboard")+f'<div class="body"><div class="toc">{toc_html}</div></div>'))

# 3 CONTEXTE (vraies photos : bâtiment LUMEN + carte Lyon)
S.append(slide(head("Le projet et son commanditaire","Contexte et partenaire","target")+
 f'''<div class="body"><div class="col" style="flex:0 0 44%;display:flex;flex-direction:column;justify-content:center"><ul>
   <li>Commanditaire : laboratoire de recherche <b>ENTPE / LTDS</b>, équipe <b>BPMNP</b></li>
   <li>ColorRoom hébergée à <b>LUMEN – La Cité de la Lumière</b> (Lyon Confluence)</li>
   <li>Équipement scientifique : <b>2 cellules jumelles</b> d'analyse des effets colorés</li>
   <li>Éclairages à <b>spectres précis</b> et hautes intensités</li>
   <li class="sub">Contacts : M. Labayrade, M. Vella · Professeur : M. Delbosc</li></ul></div>
   <div class="media"><div class="photostack">
     <div><img class="photo" src="{PHO['lumen']}" style="width:100%;height:215px"><div class="cap">{ic("target")} LUMEN · Cité de la Lumière (Lyon Confluence)</div></div>
     <div><img class="photo" src="{PHO['map']}" style="width:100%;height:150px"><div class="cap">{ic("network")} Implantation : LUMEN &amp; ENTPE, agglomération lyonnaise</div></div>
   </div></div></div>'''))

# 4 SYSTEME (vraie photo de la plaque + stats + RS-485)
S.append(slide(head("Une installation lumineuse unique","Le système ColorRoom","cpu")+
 f'''<div class="body"><div class="col" style="flex:0 0 34%;display:flex;flex-direction:column;justify-content:center">
   <img class="photo" src="{PHO['plaque']}" style="width:100%;height:330px">
   <div class="cap">{ic("zap")} LED en bandes sur les bords d'une plaque · 2360 LED, ~300 W</div></div>
   <div class="col" style="flex:1"><div class="stats" style="grid-template-columns:repeat(2,1fr);gap:13px">
   <div class="stat"><div class="si">'''+ic("cpu")+'''</div><div class="num">42</div><div class="lbl">plaques (21 par cellule)</div></div>
   <div class="stat"><div class="si">'''+ic("palette")+'''</div><div class="num">32</div><div class="lbl">canaux = 24 spectres étroits + 8 blancs</div></div>
   <div class="stat"><div class="si">'''+ic("zap")+'''</div><div class="num">2360</div><div class="lbl">LED par plaque (~300 W max)</div></div>
   <div class="stat"><div class="si">'''+ic("share-2")+'''</div><div class="num">RS-485</div><div class="lbl">bus de pilotage des dalles</div></div>
 </div></div></div>'''))

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
S.append(diagram("Acteurs et fonctions attendues","Diagramme de cas d'utilisation",IMG['uc'],"users",
 notes=nl("Deux acteurs : <b>Enseignant</b> (crée et génère des jeux) et <b>Apprenant</b> (joue)",
   "Les deux peuvent <b>Mesurer</b> avec le colorimètre CS-160",
   "<i>Créer un jeu</i> <b>inclut</b> <i>Générer par IA</i>",
   "<i>Jouer</i> et <i>Mesurer</i> <b>incluent</b> <i>Allumer les dalles</i>")))

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
S.append(slide(head("Planification du projet","Diagramme de Gantt","chart-column")+
 f'''<div class="body" style="padding:14px 40px 30px;flex-direction:column;align-items:center;justify-content:center;gap:8px">
   <img class="photo" src="{PHO['gantt']}" style="max-height:430px;max-width:100%;width:auto;background:#fff">
   <div class="cap">{ic("flask-conical")} Jalons par étudiant · ma contribution (E2) suivie tout au long du projet</div></div>'''))

# 8 ARCHITECTURE
S.append(slide(head("Vue d'ensemble · diagramme de composants","Architecture logicielle","network",me=True)+
 f'''<div class="body"><div class="col" style="flex:0 0 33%;display:flex;flex-direction:column;justify-content:center"><ul>
   <li>Serveur unique <b>Next.js</b> (App Router) conteneurisé</li>
   <li><b>Route Handlers</b> + couche <b>lib/</b> (auth, db, services)</li>
   <li>Proxy HTTP de <b>supervision</b> ; pont <b>.NET</b> du CS-160</li>
   <li class="sub">SQLite (better-sqlite3) · 100 % hors-ligne</li></ul></div>
   <div class="media"><img class="diagram" src="{IMG['comp']}"></div></div>'''))

# 9 CLASSES
S.append(diagram("Conception orientée objet","Diagramme de classes",IMG['cls'],"boxes",me=True,
 notes=nl("Entités métier modélisées et <b>typées en TypeScript</b>",
   "Utilisateur, Classe, Jeu, Score, Session…",
   "Relations <b>1-N</b> (une classe regroupe plusieurs apprenants)",
   "Vue <b>objet</b> du domaine, complémentaire du modèle relationnel")))

# 10 CHOIX TECHNIQUES
S.append(slide(head("React / Next.js / TypeScript vs JS + Node-RED","Choix techniques","code-xml",me=True)+
 '''<div class="body"><div class="col"><div class="lab">Piste initiale : Node-RED</div><ul>
   <li>Modèle <b>flow-based</b> : mal adapté à une appli multi-pages</li>
   <li>Pas de composants visuels pour une UI/UX riche</li>
   <li>Flux illisibles à grande échelle</li></ul></div>
   <div class="col"><div class="lab a">Choix retenu : Next.js + React + TS</div><ul>
   <li><b>React</b> : composants réutilisables, DOM virtuel, état réactif</li>
   <li><b>TypeScript strict</b> : erreurs à la compilation (tsc + ESLint)</li>
   <li><b>Next.js</b> : Route Handlers natifs, un seul runtime Node</li></ul></div></div>'''))

# 11 STACK (logos)
def tech(l,name,ver): return f'<div class="tech"><img src="{LOGOS[l]}"><b>{name}</b><small>{ver}</small></div>'
S.append(slide(head("Technologies mises en œuvre","La pile technique","boxes",me=True)+
 '<div class="body"><div class="stackgrid">'+
 tech("nextdotjs","Next.js","16.2 · App Router")+tech("react","React","19 · composants")+
 tech("typescript","TypeScript","5.5 · strict")+tech("nodedotjs","Node.js","runtime serveur")+
 tech("sqlite","SQLite","better-sqlite3 11.5")+tech("threedotjs","Three.js","0.160 · vue 3D")+
 tech("docker","Docker","multi-stage arm64")+tech("raspberrypi","Raspberry Pi","5 · cible")+
 '</div></div>'))

# 12 RESEAU
S.append(slide(head("Docker · Raspberry Pi 5 · diagramme de déploiement","Réseau et déploiement","share-2")+
 f'''<div class="body"><div class="col" style="flex:0 0 38%;display:flex;flex-direction:column;justify-content:center"><ul>
   <li>Image <b>Docker multi-stage</b> (deps → builder → runner), <b>arm64</b></li>
   <li>App supervisée par <b>Portainer</b> · dalles pilotées en <b>RS-485</b></li>
   <li>Wi-Fi local <b>ColorRoom_WiFI</b> ; <b>CS-160 en USB</b></li>
   <li>Accès depuis tout appareil : <b>http://172.17.40.39/</b></li>
   <li class="sub">SQLite en volume · git pull puis docker compose up</li></ul></div>
   <div class="media"><img class="diagram" src="{IMG['dep']}"></div></div>'''))

# 13 INTERFACE
S.append(media_slide("Ma partie · interface","Interface et design system",
 '''<ul><li>Design system « <b>verre dépoli</b> » : variables CSS partagées</li>
   <li>Pages : accueil 3D, /jeux, /mesure, /chromaticite, /gestion, /aide</li>
   <li><b>Menu dynamique</b> selon le rôle</li>
   <li><b>Vue 3D</b> (Three.js : WebGLRenderer, Room3D, 2 cellules)</li>
   <li class="sub">forceContextLoss au démontage · pause via Page Visibility API</li></ul>''',IMG['jeux'],"layout-dashboard",ratio="0 0 42%"))

# 14 BDD
S.append(slide(head("Ma partie · données · modèle relationnel","Base de données SQLite","database",me=True)+
 f'''<div class="body"><div class="col" style="flex:0 0 32%;display:flex;flex-direction:column;justify-content:center"><ul>
   <li><b>better-sqlite3</b> (API synchrone, requêtes préparées)</li>
   <li>Clés étrangères <b>ON DELETE CASCADE</b></li>
   <li>Migrations <b>idempotentes</b> au démarrage</li>
   <li><b>journal_mode=WAL</b> + busy_timeout</li></ul></div>
   <div class="media"><img class="diagram" src="{IMG['erd']}"></div></div>'''))

# 14b CODE transaction atomique
S.append(code_slide("Extrait de code · données","Transaction atomique (ACID)","circle-check",
 '''<ul><li>L'inscription crée l'utilisateur <b>et</b> son adhésion de classe</li>
   <li><b>Tout-ou-rien</b> : si une étape échoue, rien n'est écrit (pas de compte « à moitié créé »)</li>
   <li>Garanti par <code>db.transaction()</code> de better-sqlite3</li></ul>''',
 "app/api/auth/register/route.ts",
 '''<span class="cm">// Tout-ou-rien : si la jonction de classe échoue,</span>
<span class="cm">// l'utilisateur n'est pas créé non plus.</span>
<span class="kw">const</span> insertAll = db.<span class="fn">transaction</span>(() =&gt; {
  db.<span class="fn">prepare</span>(<span class="st">"INSERT INTO crg_users …"</span>).<span class="fn">run</span>(…);
  <span class="kw">if</span> (classCode) db.<span class="fn">prepare</span>(<span class="st">"INSERT OR IGNORE</span>
        <span class="st">INTO crg_class_members …"</span>).<span class="fn">run</span>(…);
});
<span class="fn">insertAll</span>();   <span class="cm">// exécution atomique (ACID)</span>''',
 "api/auth/register/route.ts","L47-L58"))

# 14c VARIABLES / PERSISTANCE
def varc(i,t,d): return f'<div class="varc"><div class="vt">{ic(i)}{t}</div><p>{d}</p></div>'
S.append(slide(head("Typologie des variables et de la persistance","Gestion de l'état","database",me=True)+
 '<div class="body" style="align-items:center"><div class="vargrid">'
 +varc("database","Persistante","Stockée durablement en SQLite (survit aux redémarrages, volume Docker). <code>lib/db</code>")
 +varc("circle-check","Transactionnelle · atomique","<code>db.transaction()</code> : ACID, tout-ou-rien (user + classe). <code>register</code>")
 +varc("zap","Volatile (en mémoire)","<code>useRef</code> : état runtime des dalles/jeux, perdu au rechargement. <code>app/jeux</code>")
 +varc("lock","Environnement","<code>process.env</code> : secrets (clé, mot de passe admin) via <code>.env</code>, hors Git.")
 +varc("share-2","Réactive","<code>useState</code> : déclenche le re-rendu de l'interface à chaque changement.")
 +varc("network","Concurrente","Sémaphore <code>HW_CONCURRENCY=2</code> : sérialise les accès au matériel. <code>batch</code>")
 +'</div></div>'))

# 15 SECURITE
S.append(media_slide("Ma partie · sécurité","Authentification et données personnelles",
 '''<ul><li><b>3 rôles</b> : admin (via .env), enseignant, apprenant</li>
   <li>Hachage <b>PBKDF2-HMAC-SHA512</b> (100 000 itér., sel 16 o, clé 64 o)</li>
   <li>Session en <b>cookie HttpOnly + SameSite=lax</b> (anti-XSS / CSRF)</li>
   <li><b>Données 100 % locales</b> ; minimisation, effacement en cascade</li></ul>''',IMG['login'],"lock",ratio="0 0 50%"))

# 15b CODE PBKDF2
S.append(code_slide("Extrait de code · sécurité","Hachage des mots de passe (PBKDF2)","lock",
 '''<ul><li>Dérivation lente <b>PBKDF2-HMAC-SHA512</b>, 100 000 itérations</li>
   <li><b>Sel aléatoire</b> de 16 octets par compte (anti rainbow-tables)</li>
   <li>Stockage au format <code>sel:hash</code> ; le clair n'est jamais conservé</li></ul>''',
 "app/lib/auth.ts",
 '''<span class="kw">export function</span> <span class="fn">hashPassword</span>(password: string) {
  <span class="kw">const</span> salt = <span class="fn">randomBytes</span>(<span class="nb">16</span>).toString(<span class="st">'hex'</span>);
  <span class="kw">const</span> hash = <span class="fn">pbkdf2Sync</span>(password, salt,
              <span class="nb">100_000</span>, <span class="nb">64</span>, <span class="st">'sha512'</span>).toString(<span class="st">'hex'</span>);
  <span class="kw">return</span> <span class="st">`${salt}:${hash}`</span>;  <span class="cm">// format sel:hash</span>
}''',
 "lib/auth.ts","L19-L23"))

# 16 SEQ AUTH
S.append(diagram("Séquence · connexion","Authentification (PBKDF2 + cookie)",IMG['sauth'],"lock",me=True,
 notes=nl("L'apprenant saisit identifiant + mot de passe",
   "L'API recalcule le hash via <b>verifyPassword</b> (PBKDF2)",
   "Si valide, création d'une <b>session</b> (token aléatoire)",
   "Renvoi d'un cookie <b>HttpOnly + SameSite</b> (30 j glissants)")))

# 17 GESTION
S.append(media_slide("Ma partie · gestion","Comptes, classes, scores et tableau de bord",
 '''<ul><li><b>Classes</b> : code 6 caractères (sans 0/O, 1/I)</li>
   <li><b>Niveaux</b> assignés par l'enseignant</li>
   <li><b>Scores</b> : JOIN scores × users ; <code>all=1</code> réservé (HTTP 403)</li>
   <li class="sub">Tableau de bord /gestion · export CSV (Blob, BOM UTF-8)</li></ul>''',IMG['gestion'],"users",ratio="0 0 44%"))

# 18 JEUX SOLO
S.append(media_slide("Ma partie · jeux solo","Les jeux et le pilotage des dalles",
 '''<ul><li><b>Tetris</b>, <b>Simon</b>, <b>Maître du Blanc</b>, <b>Color Speed</b>…</li>
   <li>Pilotage des <b>32 canaux/dalle</b> en parallèle (Promise.all)</li>
   <li>Timeout via <b>AbortController</b> ; couleur écran = couleur dalle</li>
   <li class="sub">CHANNEL_PROFILES calés sur la longueur d'onde réelle</li></ul>''',IMG['cs'],"gamepad-2",ratio="0 0 40%"))

# 19 SEQ JEU
S.append(diagram("Séquence · exécution d'un jeu","Du clic joueur aux dalles",IMG['sjeu'],"gamepad-2",me=True,
 notes=nl("Le joueur lance une partie depuis le catalogue",
   "Le <b>runtime</b> parcourt le graphe de nœuds du jeu",
   "Chaque nœud couleur appelle <b>/api/supervision</b>",
   "Les <b>dalles</b> s'allument ; le score remonte à l'écran")))

# 20 ETATS JEU
S.append(diagram("Diagramme d'états","Cycle de vie d'une partie",IMG['ej'],"gamepad-2",me=True,
 notes=nl("États : <b>Prête</b> → <b>En cours</b> → <b>Terminée</b>",
   "Transitions : démarrer, jouer un coup, fin de partie",
   "Calcul et enregistrement du <b>score</b> en fin de partie",
   "Réinitialisation pour <b>rejouer</b>")))

# 21 P4 IA
S.append(media_slide("Ma partie · intelligence artificielle","Puissance 4 et son IA minimax",
 '''<ul><li>Grille 6 colonnes × 7 lignes (42 cases) ; 2 joueurs ou contre l'ordinateur</li>
   <li>IA <b>hors-ligne</b> : <b>minimax</b> + <b>élagage alpha-bêta</b>, anti-piège</li>
   <li>Heuristique par <b>fenêtres de 4</b> (défense pondérée &gt; attaque) + poids central</li>
   <li><b>5 niveaux</b> : profondeur <b>1 / 2 / 5 / 9 / 12</b> + bruit décroissant</li></ul>''',IMG['p4'],"bot",ratio="0 0 44%"))

# 21b CODE minimax
S.append(code_slide("Extrait de code · IA","Évaluation minimax (alpha-bêta)","bot",
 '''<ul><li>Chaque fenêtre de 4 cases est notée du point de vue de l'IA</li>
   <li><b>Défense &gt; attaque</b> : un alignement adverse de 3 vaut -170, le mien +130</li>
   <li>Victoire = <code>WIN_SCORE</code> (1 000 000) ; recherche bornée en profondeur</li></ul>''',
 "app/_components/GamePuissance4.tsx",
 '''<span class="cm">// Note d'une fenêtre de 4 (défense &gt; attaque)</span>
<span class="kw">function</span> <span class="fn">scoreWindow</span>(me, opp) {
  <span class="kw">if</span> (me&gt;<span class="nb">0</span> &amp;&amp; opp&gt;<span class="nb">0</span>) <span class="kw">return</span> <span class="nb">0</span>;   <span class="cm">// fenêtre morte</span>
  <span class="kw">if</span> (me===<span class="nb">4</span>)  <span class="kw">return</span> WIN_SCORE; <span class="cm">// 1 000 000</span>
  <span class="kw">if</span> (me===<span class="nb">3</span>)  <span class="kw">return</span> <span class="nb">130</span>;
  <span class="kw">if</span> (opp===<span class="nb">3</span>) <span class="kw">return</span> -<span class="nb">170</span>;    <span class="cm">// bloque la menace</span>
  ...
}
<span class="cm">// minimax + alpha-bêta · profondeur 1 → 12</span>''',
 "_components/GamePuissance4.tsx","L116-L128"))

# 22 MULTIJOUEUR
S.append(media_slide("Ma partie · jeux en réseau","Les jeux multijoueur",
 '''<ul><li>État persisté <b>en base</b>, récupéré par <b>polling</b> de <code>/state</code></li>
   <li><b>Spectre Chromatique</b> : jusqu'à 8 joueurs (score = distance)</li>
   <li><b>Morpion en réseau</b> : 2 joueurs, détection de victoire</li>
   <li><b>Heartbeat</b> de présence · jetons <b>UUID</b> · hôte = siège 1</li></ul>''',IMG['multi'],"users",ratio="0 0 48%"))

# 23 SEQ MP
S.append(diagram("Séquence · multijoueur","État partagé et interrogation périodique",IMG['smp'],"share-2",me=True,
 notes=nl("L'hôte crée une session et obtient un <b>code</b>",
   "Les invités rejoignent en saisissant ce code",
   "L'état est <b>persisté en base</b> (state_json)",
   "Chaque client interroge <b>/state</b> en <b>polling</b> → écrans synchronisés")))

# 24 MESURE
S.append(media_slide("Ma partie · physique de la lumière","Mesure colorimétrique et chromaticité",
 '''<ul><li>Colorimètre <b>Konica Minolta CS-150/160</b> via pont .NET (<code>/api/CS160</code>)</li>
   <li>Tristimulus <b>CIE XYZ</b>, luminance <b>Lv (cd/m²)</b>, chromaticité <b>(x, y)</b></li>
   <li>Tracé sur le <b>diagramme CIE 1931</b> ; écart <b>ΔE</b> pour le score</li>
   <li>32 canaux = <b>24 spectres étroits</b> (proche UV → proche IR) + <b>8 blancs</b></li></ul>''',IMG['chroma'],"palette",ratio="0 0 42%"))

# 25 SEQ CS160
S.append(diagram("Séquence · mesure","Pilotage du colorimètre CS-160",IMG['scs'],"palette",me=True,
 notes=nl("Connexion au CS-160 via le <b>pont .NET</b> (/api/CS160)",
   "Allumage de la <b>dalle cible</b> à mesurer",
   "Mesure : <b>tristimulus XYZ</b>, <b>Lv</b>, chromaticité <b>(x, y)</b>",
   "Tracé du point sur le <b>diagramme CIE 1931</b>")))

# 26 ETATS CS160
S.append(diagram("Diagramme d'états","Cycle de mesure du CS-160",IMG['ecs'],"palette",me=True,
 notes=nl("États : <b>Déconnecté</b> → <b>Connecté</b>",
   "<b>Mesure en cours</b> → <b>Résultat</b> disponible",
   "Gestion des <b>erreurs</b> (timeout, appareil absent)",
   "Retour à l'état prêt pour une nouvelle mesure")))

# 27 ACTIVITE REMAP
S.append(diagram("Diagramme d'activité","Remappage des canaux LED",IMG['remap'],"share-2",me=True,
 notes=nl("Entrée : une couleur <b>RGB</b> demandée par le jeu",
   "Conversion vers les <b>32 canaux</b> de la plaque",
   "Application des <b>profils</b> (longueur d'onde réelle)",
   "Envoi de la trame au matériel (proxy supervision)")))

# 28 DOC
S.append(media_slide("Ma partie · qualité","Documentation et robustesse",
 '''<ul><li>Notice apprenant intégrée (page /aide)</li>
   <li>Manuel d'installation (README) : Docker, dev, service permanent</li>
   <li>Migrations idempotentes · <b>transactions ACID</b></li>
   <li class="sub">Connexion SQLite en singleton · exports UTF-8 + BOM</li></ul>''',IMG['aide'],"file-text",ratio="0 0 46%"))

# 29 DIFFICULTES
S.append(slide(head("Démarche d'ingénieur","Difficultés rencontrées et solutions","flask-conical",me=True)+
 '<div class="body" style="flex-direction:column;justify-content:center">'+
 ''.join(f'<div class="fix"><div class="pb">{p}</div><div class="ar">'+ic("share-2")+f'</div><div class="so">'+ic("circle-check")+f'<span>{s}</span></div></div>' for p,s in [
   ("Latence des plaques (32 canaux)","Envoi parallèle (Promise.all) + timeout (AbortController)"),
   ("Couleur écran différente des dalles","Rendu unifié + profils calés sur les longueurs d'onde"),
   ("Accès concurrents (SQLITE_BUSY)","Mode WAL + busy_timeout + connexion singleton"),
   ("Multijoueur temps réel sur Pi","État en base + polling /state (vs WebSockets)"),
 ])+'</div>'))

# 30 BILAN
S.append(slide(head("Conclusion","Bilan et perspectives","chart-column")+
 '''<div class="body"><div class="col"><div class="lab a">Objectifs E2 atteints</div><ul>
   <li>Interface, base de données et comptes opérationnels</li>
   <li>Jeux solo, IA Puissance 4 et multijoueur</li>
   <li>Mesure CS-160 et diagramme CIE</li>
   <li>Documentation et déploiement Docker</li></ul></div>
   <div class="col"><div class="lab b">Perspectives</div><ul>
   <li>Salons multijoueur avec codes de partie</li>
   <li>Nouveaux jeux pédagogiques et tutoriels</li>
   <li>Tests automatisés (CI/CD)</li>
   <li class="sub">Exploration : génération de jeux par IA locale (Ollama)</li></ul></div></div>'''))

# 31 DEMO
S.append(slide('<div class="body center"><div class="hicon" style="width:64px;height:64px;border-radius:18px;margin-bottom:6px">'+ic("eye")+'</div><div class="kick">Place à la</div><div class="big">Démonstration</div><p style="color:var(--muted);font-size:16px;margin-top:12px;max-width:760px;line-height:1.8">Connexion · catalogue et un jeu sur les dalles · Puissance 4 contre l’IA · un jeu multijoueur · mesure CS-160 et diagramme CIE · tableau de bord enseignant</p></div>'))

# 32 MERCI
S.append(slide('<div class="body center"><div class="dash" style="justify-content:center"><i style="background:var(--r)"></i><i style="background:var(--y)"></i><i style="background:var(--g)"></i><i style="background:var(--b)"></i><i style="background:var(--accent)"></i></div><div class="big" style="margin-top:8px">Merci de votre attention</div><div style="color:var(--accent);font-weight:700;font-size:21px;margin-top:12px;font-family:Bricolage Grotesque,Inter,sans-serif">Avez-vous des questions ?</div><div style="position:absolute;bottom:28px;left:0;right:0;text-align:center;color:var(--muted);font-size:13px">ColorRoom · Téo Trompier (E2) · BTS CIEL option IR · Session 2026</div></div>'))

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
