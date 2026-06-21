#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genere la presentation ColorRoom (minimaliste, blanc, Bricolage Grotesque + Inter)
   puis exporte un PDF. Tous les diagrammes sont des slides normales (pas d'annexes)."""
import base64, pathlib

SHOTS="scripts/shots"; UML="scripts/uml"
def b64(path):
    return "data:image/png;base64,"+base64.b64encode(pathlib.Path(path).read_bytes()).decode()
def shot(n): return b64(f"{SHOTS}/{n}.png")
def uml(n):  return b64(f"{UML}/ColorRoom_{n}.png")

IMG={
 "home":shot("home"),"jeux":shot("jeux"),"gestion":shot("gestion"),"chroma":shot("chromaticite"),
 "aide":shot("aide"),"login":shot("login"),"cs":shot("colorspeed_run"),"p4":shot("puissance4"),
 "multi":shot("multi"),"mesure":shot("mesure"),
 "uc":uml("UseCases"),"cls":uml("Classes"),"comp":uml("Composants"),"dep":uml("Deploiement"),
 "erd":uml("ERD"),"sauth":uml("Seq_Auth"),"sjeu":uml("Seq_Jeu"),"scs":uml("Seq_CS160"),
 "smp":uml("Seq_MP"),"ej":uml("Etats_Jeu"),"ecs":uml("Etats_CS160"),"remap":uml("Activite_Remap"),
}

CSS = """
:root{
  --ink:#11131a; --ink2:#3b4252; --muted:#8a93a6; --line:#e7eaf0;
  --accent:#6d4aff; --accent2:#1fb6a6; --paper:#ffffff; --ghost:#eef1f6;
  --r:#ef4444; --g:#10b981; --b:#3b6dff; --y:#f5a524;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--ghost);font-family:"Inter",system-ui,sans-serif;color:var(--ink2);
     padding:30px 0 64px;-webkit-font-smoothing:antialiased}
.deck{display:flex;flex-direction:column;align-items:center;gap:26px}
.slide{width:min(1180px,95vw);aspect-ratio:16/9;background:var(--paper);border-radius:20px;
       overflow:hidden;position:relative;display:flex;flex-direction:column;
       box-shadow:0 1px 0 rgba(17,19,26,.04),0 18px 50px rgba(17,19,26,.10);
       border:1px solid #edf0f5}
h1,h2,h3,.disp{font-family:"Bricolage Grotesque","Inter",sans-serif;letter-spacing:-.02em}
.head{padding:30px 46px 0}
.kick{font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--accent)}
.head h2{font-size:33px;font-weight:700;color:var(--ink);margin-top:7px;line-height:1.05}
.rule{height:3px;width:52px;background:var(--accent);border-radius:2px;margin:13px 46px 0}
.me{position:absolute;top:30px;right:46px;font-size:11px;font-weight:700;color:var(--accent);
    border:1px solid var(--accent);border-radius:30px;padding:4px 11px;letter-spacing:.05em}
.body{flex:1;padding:22px 46px 40px;display:flex;gap:30px;min-height:0}
.col{flex:1;min-width:0}
ul{list-style:none;display:flex;flex-direction:column;gap:12px}
li{font-size:16.5px;line-height:1.4;color:var(--ink2);display:flex;gap:11px;align-items:flex-start}
li::before{content:"";width:7px;height:7px;border-radius:2px;background:var(--accent);margin-top:8px;flex-shrink:0}
li.sub{font-size:14.5px;color:var(--muted);margin-left:18px}
li.sub::before{width:5px;height:5px;background:var(--muted);margin-top:8px}
b{color:var(--ink);font-weight:650}
code{font-family:"JetBrains Mono",Consolas,monospace;font-size:.92em;background:#f3f4f8;color:#4b3bbf;padding:1px 6px;border-radius:6px}
.pageno{position:absolute;bottom:16px;right:20px;font-size:11.5px;color:#aeb6c6;font-weight:500}
.diagram{max-height:100%;max-width:100%;width:auto;display:block;margin:auto;border:1px solid var(--line);border-radius:10px;background:#fff}
.shot{width:100%;border-radius:12px;border:1px solid var(--line);box-shadow:0 10px 30px rgba(17,19,26,.12);display:block}
.media{flex:1;display:flex;align-items:center;justify-content:center;min-width:0}
/* titre */
.cover{justify-content:center;padding:0 70px;gap:46px}
.cover .l{flex:1.25}
.cover .kick{font-size:13px}
.cover h1{font-size:78px;font-weight:800;color:var(--ink);line-height:.95;margin:10px 0}
.cover .sub{font-size:20px;color:var(--ink2);font-weight:500;max-width:560px}
.cover .meta{margin-top:26px;font-size:15px;color:var(--ink2)}
.cover .meta b{color:var(--ink)}
.cover .meta small{color:var(--muted)}
.dash{display:flex;gap:6px;margin:14px 0}
.dash i{width:42px;height:6px;border-radius:3px}
/* sommaire */
.toc{display:grid;grid-template-columns:1fr 1fr;gap:13px 46px;width:100%;align-content:center}
.toc .it{display:flex;gap:14px;align-items:baseline;font-size:17px;color:var(--ink);font-weight:600}
.toc .it .n{font-family:"Bricolage Grotesque";font-size:20px;font-weight:700;color:var(--accent);min-width:30px}
.toc .it small{color:var(--muted);font-weight:500;font-size:13px;margin-left:auto}
/* chiffres */
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);
       border:1px solid var(--line);border-radius:16px;overflow:hidden;width:100%;align-self:center}
.stat{background:#fff;padding:24px 22px;display:flex;flex-direction:column;gap:4px}
.stat .num{font-family:"Bricolage Grotesque";font-size:42px;font-weight:800;color:var(--ink);line-height:1}
.stat .lbl{font-size:13.5px;color:var(--muted);font-weight:500}
.stat .num.a{color:var(--accent)} .stat .num.t{color:var(--accent2)}
/* equipe */
.roles{display:grid;grid-template-columns:1fr 1fr;gap:14px;width:100%}
.role{border:1px solid var(--line);border-radius:14px;padding:15px 17px;background:#fff}
.role.me2{border-color:var(--accent);background:#f7f5ff;box-shadow:0 6px 18px rgba(109,74,255,.12)}
.role b{font-size:15.5px;color:var(--ink)}
.role .tag{font-size:10px;font-weight:800;color:#fff;background:var(--accent);border-radius:20px;padding:2px 9px;margin-left:7px;letter-spacing:.04em}
.role span{display:block;font-size:13px;color:var(--muted);margin-top:4px;line-height:1.35}
/* deux colonnes legendes */
.split{display:flex;gap:30px;width:100%}
.lab{font-family:"Bricolage Grotesque";font-weight:700;color:var(--ink);font-size:17px;margin-bottom:9px}
.lab.a{color:var(--accent)} .lab.b{color:var(--accent2)}
/* fix difficultes */
.fix{display:flex;gap:12px;align-items:stretch;margin-bottom:12px}
.fix .pb{flex:1;border:1px solid #f1d6d6;background:#fdf4f4;color:#b4434b;border-radius:12px;padding:12px 15px;font-weight:600;font-size:14px;display:flex;align-items:center}
.fix .ar{display:grid;place-items:center;color:var(--muted);font-size:18px}
.fix .so{flex:1.15;border:1px solid #cfeee2;background:#f2fbf7;color:#15795f;border-radius:12px;padding:12px 15px;font-weight:600;font-size:13.5px;display:flex;align-items:center}
/* cover/section centre */
.center{align-items:center;justify-content:center;text-align:center;flex-direction:column;gap:8px}
.big{font-family:"Bricolage Grotesque";font-size:52px;font-weight:800;color:var(--ink)}
.quote{border-left:4px solid var(--accent);background:#f7f5ff;border-radius:0 12px 12px 0;
       padding:16px 20px;font-size:18px;font-weight:600;color:var(--ink);line-height:1.4}
@media print{
  @page{size:1180px 663.75px;margin:0}
  body{background:#fff;padding:0}
  .deck{gap:0}
  .slide{width:1180px;height:663.75px;aspect-ratio:auto;border-radius:0;border:none;
         box-shadow:none;break-after:page;page-break-after:always}
}
"""

def head(num,kick,title,me=False):
    return (f'<div class="head"><div class="kick">{kick}</div><h2>{title}</h2></div>'
            f'<div class="rule"></div>'+('<div class="me">MA PARTIE · E2</div>' if me else ''))

def slide(inner,cls=""):
    return f'<section class="slide {cls}">{inner}<div class="pageno"></div></section>'

def diagram(num,kick,title,img,me=False):
    return slide(head(num,kick,title,me)+
        f'<div class="body" style="padding:18px 40px 36px;align-items:center;justify-content:center"><img class="diagram" src="{img}"></div>')

def media_slide(num,kick,title,bullets_html,img,me=True,ratio="0 0 40%"):
    return slide(head(num,kick,title,me)+
        f'<div class="body"><div class="col" style="flex:{ratio};display:flex;flex-direction:column;justify-content:center">{bullets_html}</div>'
        f'<div class="media"><img class="shot" src="{img}"></div></div>')

S=[]

# 1 COVER
S.append(slide(f'''<div class="body cover">
  <div class="l">
    <div class="kick">BTS CIEL · OPTION A INFORMATIQUE ET RÉSEAUX · ÉPREUVE E6-2 · 2026</div>
    <h1>ColorRoom</h1>
    <div class="dash"><i style="background:var(--r)"></i><i style="background:var(--y)"></i><i style="background:var(--g)"></i><i style="background:var(--b)"></i><i style="background:var(--accent)"></i></div>
    <div class="sub">Serious games pédagogiques sur les plaques lumineuses de la ColorRoom</div>
    <div class="meta"><b>Téo Trompier</b> &nbsp;·&nbsp; partie E2<br>
      <small>Équipe JavaScript · Lycée Édouard Branly, Lyon<br>Partenaires : LUMEN – La Cité de la Lumière · ENTPE / LTDS / BPMNP</small></div>
  </div>
  <div class="media" style="flex:1"><img class="shot" src="{IMG['home']}"></div>
</div>'''))

# 2 SOMMAIRE
toc_items=[("01","Contexte et système"),("02","Cas d'utilisation"),("03","Équipe · ma partie E2"),
 ("04","Architecture et classes"),("05","Choix techniques"),("06","Réseau et déploiement"),
 ("07","Interface et base de données"),("08","Sécurité et comptes"),("09","Jeux solo, IA, multijoueur"),
 ("10","Mesure et chromaticité"),("11","Documentation et qualité"),("12","Bilan et démonstration")]
toc="".join(f'<div class="it"><span class="n">{n}</span>{t}</div>' for n,t in toc_items)
S.append(slide(f'<div class="head"><div class="kick">Plan de la présentation</div><h2>Sommaire</h2></div><div class="rule"></div><div class="body"><div class="toc">{toc}</div></div>'))

# 3 CONTEXTE
S.append(media_slide(1,"Le projet et son commanditaire","Contexte et partenaire",
 '''<ul>
   <li>Commanditaire : laboratoire de recherche <b>ENTPE / LTDS / BPMNP</b></li>
   <li>ColorRoom hébergée à <b>LUMEN – La Cité de la Lumière</b> (Lyon Confluence)</li>
   <li>Équipement scientifique : <b>2 cellules jumelles</b> d'analyse des effets colorés</li>
   <li>Éclairages à spectres précis et hautes intensités</li>
   <li class="sub">Contacts : M. Labayrade, M. Vella · Professeur : M. Delbosc</li>
 </ul>''',IMG['home'],me=False))

# 4 SYSTEME / CHIFFRES
S.append(slide(head(1,"Une installation lumineuse unique","Le système ColorRoom")+
 '''<div class="body"><div class="stats">
   <div class="stat"><div class="num">42</div><div class="lbl">plaques lumineuses</div></div>
   <div class="stat"><div class="num a">32</div><div class="lbl">canaux LED par dalle</div></div>
   <div class="stat"><div class="num t">404–780</div><div class="lbl">spectre couvert (nm)</div></div>
   <div class="stat"><div class="num">2</div><div class="lbl">cellules jumelles</div></div>
   <div class="stat"><div class="num a">1</div><div class="lbl">Raspberry Pi 5 autonome</div></div>
   <div class="stat"><div class="num t">7+</div><div class="lbl">jeux éducatifs</div></div>
 </div></div>'''))

# 5 PROBLEMATIQUE
S.append(slide(head(2,"Le besoin","Problématique et objectifs")+
 '''<div class="body" style="flex-direction:column;gap:16px">
   <div class="quote">Le logiciel de recherche de la ColorRoom est trop complexe pour l'initiation. Comment rendre la salle accessible aux apprenants, de façon ludique et pédagogique ?</div>
   <div class="split">
     <div class="col"><div class="lab a">Objectifs</div><ul>
       <li>Une série de <b>serious games</b> sur la lumière et la couleur</li>
       <li>Accessible depuis un navigateur, sans installation</li>
       <li>Adaptable à une seule plaque lumineuse</li></ul></div>
     <div class="col"><div class="lab b">Contraintes</div><ul>
       <li><b>Raspberry Pi 5</b> + SSD, Docker imposé</li>
       <li>Fonctionnement <b>hors-ligne</b> (réseau local)</li>
       <li>Latence des plaques à compenser</li></ul></div>
   </div>
 </div>'''))

# 6 USE CASES (UML)
S.append(diagram(2,"Acteurs et fonctions attendues","Diagramme de cas d'utilisation",IMG['uc']))

# 7 EQUIPE
S.append(slide(head(3,"8 étudiants · sous-équipes JavaScript et Python","Équipe et répartition",me=True)+
 '''<div class="body" style="flex-direction:column;gap:14px">
   <div class="roles">
     <div class="role"><b>E1 · Maxime Bonnevay</b><span>Infrastructure Pi & Docker, CI/CD, intégration colorimètre, sécurité</span></div>
     <div class="role me2"><b>E2 · Téo Trompier<span class="tag">MOI</span></b><span>Base de données, API, UI/UX, jeux solo + multijoueur, proxy LED, documentation</span></div>
     <div class="role"><b>E3 · Ilyes Arbadji</b><span>Éditeur de jeux (hors de mon périmètre)</span></div>
     <div class="role"><b>E4 · Hasan Akyuz</b><span>Tests de l'API, simulateur de plaques, Swagger / Postman</span></div>
   </div>
 </div>'''))

# 8 ARCHITECTURE (composants)
S.append(slide(head(4,"Vue d'ensemble · diagramme de composants","Architecture logicielle",me=True)+
 f'''<div class="body"><div class="col" style="flex:0 0 33%;display:flex;flex-direction:column;justify-content:center"><ul>
   <li>Serveur unique <b>Next.js</b> (App Router) conteneurisé</li>
   <li><b>Route Handlers</b> + couche <b>lib/</b> (auth, db, services)</li>
   <li>Proxy HTTP de <b>supervision</b> ; pont <b>.NET</b> du CS-160</li>
   <li class="sub">SQLite (better-sqlite3) · 100 % hors-ligne</li></ul></div>
   <div class="media"><img class="diagram" src="{IMG['comp']}"></div></div>'''))

# 9 CLASSES (UML)
S.append(diagram(4,"Conception orientée objet","Diagramme de classes",IMG['cls'],me=True))

# 10 CHOIX TECHNIQUES
S.append(slide(head(5,"React / Next.js / TypeScript vs JS + Node-RED","Choix techniques",me=True)+
 '''<div class="body"><div class="col"><div class="lab">Piste initiale : Node-RED</div><ul>
   <li>Modèle <b>flow-based</b> : mal adapté à une appli multi-pages</li>
   <li>Pas de composants visuels pour une UI/UX riche</li>
   <li>Flux illisibles à grande échelle, rendu limité</li></ul></div>
   <div class="col"><div class="lab a">Choix retenu : Next.js + React + TS</div><ul>
   <li><b>React</b> : composants réutilisables, DOM virtuel, état réactif</li>
   <li><b>TypeScript strict</b> : erreurs à la compilation (tsc + ESLint)</li>
   <li><b>Next.js</b> : Route Handlers natifs, un seul runtime Node</li>
   <li class="sub">Next.js 16.2 · TS 5.5 · better-sqlite3 11.5 · Three.js 0.160</li></ul></div></div>'''))

# 11 RESEAU (deploiement)
S.append(slide(head(6,"Docker · Raspberry Pi 5 · diagramme de déploiement","Réseau et déploiement")+
 f'''<div class="body"><div class="col" style="flex:0 0 38%;display:flex;flex-direction:column;justify-content:center"><ul>
   <li>Image <b>Docker multi-stage</b> (deps → builder → runner), <b>arm64</b></li>
   <li>App sur le <b>port 8080</b>, supervisée par <b>Portainer</b></li>
   <li>Wi-Fi local <b>ColorRoom_WiFI</b> ; <b>CS-160 en USB</b></li>
   <li class="sub">SQLite en volume · git pull puis docker compose up</li></ul></div>
   <div class="media"><img class="diagram" src="{IMG['dep']}"></div></div>'''))

# 12 INTERFACE
S.append(media_slide(7,"Ma partie · interface","Interface et design system",
 '''<ul>
   <li>Design system « <b>verre dépoli</b> » : variables CSS partagées</li>
   <li>Pages : accueil 3D, /jeux, /mesure, /chromaticite, /gestion, /aide</li>
   <li><b>Menu dynamique</b> selon le rôle</li>
   <li><b>Vue 3D</b> (Three.js : WebGLRenderer, Room3D, 2 cellules)</li>
   <li class="sub">forceContextLoss au démontage · pause via Page Visibility API</li>
 </ul>''',IMG['jeux'],ratio="0 0 42%"))

# 13 BDD (ERD)
S.append(slide(head(7,"Ma partie · données · modèle relationnel","Base de données SQLite",me=True)+
 f'''<div class="body"><div class="col" style="flex:0 0 32%;display:flex;flex-direction:column;justify-content:center"><ul>
   <li><b>better-sqlite3</b> (API synchrone, requêtes préparées)</li>
   <li>Clés étrangères <b>ON DELETE CASCADE</b></li>
   <li>Migrations <b>idempotentes</b> au démarrage</li>
   <li><b>journal_mode=WAL</b> + busy_timeout</li></ul></div>
   <div class="media"><img class="diagram" src="{IMG['erd']}"></div></div>'''))

# 14 SECURITE
S.append(media_slide(8,"Ma partie · sécurité","Authentification et données personnelles",
 '''<ul>
   <li><b>3 rôles</b> : admin (via .env), enseignant, apprenant</li>
   <li>Hachage <b>PBKDF2-HMAC-SHA512</b> (100 000 itér., sel 16 o, clé 64 o)</li>
   <li>Session en <b>cookie HttpOnly + SameSite=lax</b> (anti-XSS / CSRF)</li>
   <li><b>Données 100 % locales</b> ; minimisation, effacement en cascade</li>
 </ul>''',IMG['login'],ratio="0 0 50%"))

# 15 SEQ AUTH
S.append(diagram(8,"Séquence · connexion","Authentification (PBKDF2 + cookie)",IMG['sauth'],me=True))

# 16 GESTION
S.append(media_slide(8,"Ma partie · gestion","Comptes, classes, scores et tableau de bord",
 '''<ul>
   <li><b>Classes</b> : code 6 caractères (sans 0/O, 1/I)</li>
   <li><b>Niveaux</b> assignés par l'enseignant</li>
   <li><b>Scores</b> : JOIN scores × users ; <code>all=1</code> réservé (HTTP 403)</li>
   <li class="sub">Tableau de bord /gestion · export CSV (Blob, BOM UTF-8)</li>
 </ul>''',IMG['gestion'],ratio="0 0 44%"))

# 17 JEUX SOLO
S.append(media_slide(9,"Ma partie · jeux solo","Les jeux et le pilotage des dalles",
 '''<ul>
   <li><b>Tetris</b>, <b>Simon</b>, <b>Maître du Blanc</b>, <b>Color Speed</b>…</li>
   <li>Pilotage des <b>32 canaux/dalle</b> en parallèle (Promise.all)</li>
   <li>Timeout via <b>AbortController</b> ; couleur écran = couleur dalle</li>
   <li class="sub">CHANNEL_PROFILES calés sur la longueur d'onde réelle</li>
 </ul>''',IMG['cs'],ratio="0 0 40%"))

# 18 SEQ JEU
S.append(diagram(9,"Séquence · exécution d'un jeu","Du clic joueur aux dalles",IMG['sjeu'],me=True))

# 19 ETATS JEU
S.append(diagram(9,"Diagramme d'états","Cycle de vie d'une partie",IMG['ej'],me=True))

# 20 PUISSANCE 4 IA
S.append(media_slide(9,"Ma partie · intelligence artificielle","Puissance 4 et son IA minimax",
 '''<ul>
   <li>Grille 7×6 sur les 42 dalles ; 2 joueurs ou contre l'ordinateur</li>
   <li>IA <b>hors-ligne</b> : <b>minimax</b> + <b>élagage alpha-bêta</b> (7 plies)</li>
   <li>Heuristique + <b>move ordering</b> central</li>
   <li><b>5 niveaux</b> ; décision ~70 ms</li>
 </ul>''',IMG['p4'],ratio="0 0 44%"))

# 21 MULTIJOUEUR
S.append(media_slide(9,"Ma partie · jeux en réseau","Les jeux multijoueur",
 '''<ul>
   <li>État persisté <b>en base</b>, récupéré par <b>polling</b> de <code>/state</code></li>
   <li><b>Spectre Chromatique</b> : jusqu'à 8 joueurs (score = distance)</li>
   <li><b>Morpion en réseau</b> : 2 joueurs, détection de victoire</li>
   <li><b>Heartbeat</b> de présence · jetons <b>UUID</b> · hôte = siège 1</li>
 </ul>''',IMG['multi'],ratio="0 0 48%"))

# 22 SEQ MP
S.append(diagram(9,"Séquence · multijoueur","État partagé et interrogation périodique",IMG['smp'],me=True))

# 23 MESURE / CHROMA
S.append(media_slide(10,"Ma partie · physique de la lumière","Mesure colorimétrique et chromaticité",
 '''<ul>
   <li>Colorimètre <b>Konica Minolta CS-150/160</b> via pont .NET (<code>/api/CS160</code>)</li>
   <li>Tristimulus <b>CIE XYZ</b>, luminance <b>Lv (cd/m²)</b>, chromaticité <b>(x, y)</b></li>
   <li>Tracé sur le <b>diagramme CIE 1931</b> ; écart <b>ΔE</b> pour le score</li>
   <li>32 canaux = <b>18 spectrales</b> (404–780 nm) + <b>14 phosphore</b></li>
 </ul>''',IMG['chroma'],ratio="0 0 42%"))

# 24 SEQ CS160
S.append(diagram(10,"Séquence · mesure","Pilotage du colorimètre CS-160",IMG['scs'],me=True))

# 25 ETATS CS160
S.append(diagram(10,"Diagramme d'états","Cycle de mesure du CS-160",IMG['ecs'],me=True))

# 26 ACTIVITE REMAP
S.append(diagram(10,"Diagramme d'activité","Remappage des canaux LED",IMG['remap'],me=True))

# 27 DOC / ROBUSTESSE
S.append(media_slide(11,"Ma partie · qualité","Documentation et robustesse",
 '''<ul>
   <li>Notice apprenant intégrée (page /aide)</li>
   <li>Manuel d'installation (README) : Docker, dev, service permanent</li>
   <li>Migrations idempotentes · <b>transactions ACID</b></li>
   <li class="sub">Connexion SQLite en singleton · exports UTF-8 + BOM</li>
 </ul>''',IMG['aide'],ratio="0 0 46%"))

# 28 DIFFICULTES
S.append(slide(head(12,"Démarche d'ingénieur","Difficultés rencontrées et solutions",me=True)+
 '''<div class="body" style="flex-direction:column;justify-content:center">
   <div class="fix"><div class="pb">Latence des plaques (32 canaux)</div><div class="ar">→</div><div class="so">Envoi parallèle (Promise.all) + timeout (AbortController)</div></div>
   <div class="fix"><div class="pb">Couleur écran ≠ couleur dalle</div><div class="ar">→</div><div class="so">Rendu unifié + profils calés sur les longueurs d'onde</div></div>
   <div class="fix"><div class="pb">Accès concurrents (SQLITE_BUSY)</div><div class="ar">→</div><div class="so">Mode WAL + busy_timeout + connexion singleton</div></div>
   <div class="fix"><div class="pb">Multijoueur temps réel sur Pi</div><div class="ar">→</div><div class="so">État en base + polling /state (plus simple que WebSockets)</div></div>
 </div>'''))

# 29 BILAN
S.append(slide(head(12,"Conclusion","Bilan et perspectives")+
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

# 30 DEMO
S.append(slide('<div class="body center"><div class="kick" style="color:var(--accent)">Place à la</div><div class="big">Démonstration</div><p style="color:var(--muted);font-size:16px;margin-top:14px;max-width:760px;line-height:1.8">Connexion · catalogue et un jeu sur les dalles · Puissance 4 contre l’IA · un jeu multijoueur · mesure CS-160 et diagramme CIE · tableau de bord enseignant</p></div>'))

# 31 MERCI
S.append(slide('<div class="body center"><div class="dash" style="justify-content:center"><i style="background:var(--r)"></i><i style="background:var(--y)"></i><i style="background:var(--g)"></i><i style="background:var(--b)"></i><i style="background:var(--accent)"></i></div><div class="big" style="margin-top:8px">Merci de votre attention</div><div style="color:var(--accent);font-weight:700;font-size:21px;margin-top:12px;font-family:Bricolage Grotesque">Avez-vous des questions ?</div><div style="position:absolute;bottom:28px;left:0;right:0;text-align:center;color:var(--muted);font-size:13px">ColorRoom · Téo Trompier (E2) · BTS CIEL option IR · Session 2026</div></div>'))

HTML=f'''<!DOCTYPE html><html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>ColorRoom · Téo Trompier (E2)</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>{CSS}</style></head><body>
<div class="deck">
{chr(10).join(S)}
</div>
<script>
(function(){{
  const sl=[...document.querySelectorAll('.slide')];
  sl.forEach((s,i)=>{{const p=s.querySelector('.pageno'); if(p) p.textContent=(i+1)+' / '+sl.length;}});
}})();
</script>
</body></html>'''

pathlib.Path("ColorRoom_Presentation.html").write_text(HTML,encoding="utf-8")
print("HTML OK · slides:",len(S),"· taille:",round(len(HTML)/1024/1024,2),"Mo · tirets:",HTML.count("—"))
