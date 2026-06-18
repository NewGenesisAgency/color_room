#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Présentation orale BTS CIEL IR - projet ColorRoom (16:9, icônes + images)."""
import os
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

A = os.path.join(os.path.dirname(__file__), "assets")
def asset(n): return os.path.join(A, n)

# ── Palette ──────────────────────────────────────────────────────────────────
INDIGO=RGBColor(0x43,0x61,0xEE); VIOLET=RGBColor(0x7C,0x3A,0xED); PINK=RGBColor(0xEC,0x48,0x99)
DARK=RGBColor(0x0F,0x17,0x2A);   SLATE=RGBColor(0x33,0x41,0x55); GREY=RGBColor(0x64,0x74,0x8B)
LIGHT=RGBColor(0xF1,0xF4,0xFB);  WHITE=RGBColor(0xFF,0xFF,0xFF); GREEN=RGBColor(0x06,0xD6,0xA0)
AMBER=RGBColor(0xF5,0x9E,0x0B);  CARD=RGBColor(0xE9,0xED,0xF7); RED=RGBColor(0xB9,0x1C,0x1C)
CLEAR=RGBColor(0xCB,0xD5,0xE1)

prs = Presentation(); prs.slide_width=Inches(13.333); prs.slide_height=Inches(7.5)
SW, SH = prs.slide_width, prs.slide_height
BLANK = prs.slide_layouts[6]

def add(): return prs.slides.add_slide(BLANK)
def rect(s,x,y,w,h,color,line=None,rad=False):
    shp = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if rad else MSO_SHAPE.RECTANGLE,x,y,w,h)
    shp.fill.solid(); shp.fill.fore_color.rgb=color
    if line is None: shp.line.fill.background()
    else: shp.line.color.rgb=line; shp.line.width=Pt(1.5)
    shp.shadow.inherit=False; return shp
def tb(s,x,y,w,h,lines,align=PP_ALIGN.LEFT,anchor=MSO_ANCHOR.TOP):
    box=s.shapes.add_textbox(x,y,w,h); f=box.text_frame; f.word_wrap=True; f.vertical_anchor=anchor
    for i,(txt,sz,col,bold,sb) in enumerate(lines):
        p=f.paragraphs[0] if i==0 else f.add_paragraph(); p.alignment=align
        if sb:p.space_before=Pt(sb)
        p.space_after=Pt(2)
        r=p.add_run(); r.text=txt; r.font.size=Pt(sz); r.font.bold=bold; r.font.color.rgb=col; r.font.name="Calibri"
    return box
def notes(s,t): s.notes_slide.notes_text_frame.text=t
def pic(s,name,x,y,w,h=None):
    return s.shapes.add_picture(asset(name),x,y,width=w,height=h if h else w)
def bullets(s,x,y,w,h,items,size=18,color=SLATE,gap=10):
    box=s.shapes.add_textbox(x,y,w,h); f=box.text_frame; f.word_wrap=True
    for i,it in enumerate(items):
        text,lvl=(it if isinstance(it,tuple) else (it,0))
        p=f.paragraphs[0] if i==0 else f.add_paragraph(); p.space_after=Pt(gap); p.level=lvl
        r=p.add_run(); r.text=("▸ " if lvl==0 else "•  ")+text
        r.font.size=Pt(size-(2 if lvl else 0)); r.font.color.rgb=(color if lvl==0 else GREY)
        r.font.name="Calibri"
    return box
def header(s,num,title,kicker,icon=None):
    rect(s,0,0,SW,Inches(1.25),DARK); rect(s,0,Inches(1.25),SW,Pt(4),VIOLET)
    badge=s.shapes.add_shape(MSO_SHAPE.OVAL,Inches(0.45),Inches(0.33),Inches(0.6),Inches(0.6))
    badge.fill.solid(); badge.fill.fore_color.rgb=VIOLET; badge.line.fill.background(); badge.shadow.inherit=False
    bp=badge.text_frame.paragraphs[0]; bp.alignment=PP_ALIGN.CENTER
    br=bp.add_run(); br.text=str(num); br.font.size=Pt(21); br.font.bold=True; br.font.color.rgb=WHITE
    tb(s,Inches(1.25),Inches(0.20),Inches(10.4),Inches(0.95),[(kicker,12,GREEN,True,0),(title,25,WHITE,True,0)])
    if icon: pic(s,icon,Inches(12.05),Inches(0.33),Inches(0.78))
def card(s,x,y,w,h,fill=WHITE,line=None):
    c=s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE,x,y,w,h)
    c.fill.solid(); c.fill.fore_color.rgb=fill
    if line is None: c.line.fill.background()
    else: c.line.color.rgb=line; c.line.width=Pt(1.5)
    c.shadow.inherit=False; return c

# ════════ 1. TITRE ════════
s=add(); rect(s,0,0,SW,SH,DARK)
pic(s,"led_grid.png",Inches(9.05),Inches(0.0),Inches(4.3),Inches(7.5))
rect(s,Inches(8.6),0,Inches(0.5),SH,DARK)  # léger masque bord gauche image
rect(s,0,Inches(3.0),Inches(9),Inches(0.09),INDIGO)
rect(s,0,Inches(3.09),Inches(9),Inches(0.09),VIOLET)
rect(s,0,Inches(3.18),Inches(9),Inches(0.09),PINK)
tb(s,Inches(0.9),Inches(1.25),Inches(8),Inches(1.6),[
    ("PROJET BTS CIEL  ·  OPTION INFORMATIQUE & RÉSEAUX",13,GREEN,True,0),
    ("ColorRoom",58,WHITE,True,6)])
tb(s,Inches(0.9),Inches(3.45),Inches(8),Inches(1.4),[
    ("Serious games interactifs sur 42 dalles LED pilotées en réseau",20,CLEAR,False,0),
    ("Application web embarquée sur Raspberry Pi  ·  pilotage et mesure de la lumière",15,GREY,False,6)])
tb(s,Inches(0.9),Inches(5.5),Inches(8),Inches(1.5),[
    ("Présenté par : [Ton Prénom NOM]",16,WHITE,True,0),
    ("Session 2026  ·  Lycée Édouard Branly",14,GREY,False,4),
    ("Partenaires : LUMEN Campus Lumière  ·  ENTPE / LTDS",13,GREY,False,2)])
notes(s,"Bonjour, je m'appelle [...], 2e annee de BTS CIEL option Informatique et Reseaux. "
        "Je presente ColorRoom : une application qui transforme une salle de 42 dalles LED en plateforme "
        "de jeux educatifs sur la couleur. 20 min de presentation, puis demonstration, puis questions.")

# ════════ 2. SOMMAIRE ════════
s=add(); rect(s,0,0,SW,SH,WHITE); rect(s,0,0,Inches(0.22),SH,VIOLET)
tb(s,Inches(0.8),Inches(0.45),Inches(11),Inches(1),[("Sommaire",34,DARK,True,0)])
items=[("play","Contexte et commanditaire"),("target","Problématique et objectifs"),
       ("gear","Cahier des charges"),("network","Architecture et réseau"),
       ("code","Choix techniques et stack"),("puzzle","Fonctionnalités du projet"),
       ("robot","Éditeur, IA et mesure"),("lock","Sécurité"),
       ("doc","Gestion de projet"),("chart","Bilan et perspectives")]
x0,y0=Inches(0.9),Inches(1.7)
for i,(ic,txt) in enumerate(items):
    cx=x0+(i%2)*Inches(6.2); cy=y0+(i//2)*Inches(1.05)
    pic(s,f"ic_{ic}.png",cx,cy,Inches(0.62))
    tb(s,cx+Inches(0.8),cy+Inches(0.05),Inches(5.2),Inches(0.6),[(f"{i+1}.  {txt}",18,SLATE,True,0)],anchor=MSO_ANCHOR.MIDDLE)
notes(s,"Voici le deroule : contexte, objectifs, cahier des charges, architecture et reseau, choix techniques, "
        "fonctionnalites, les points forts (editeur, IA, mesure), securite, gestion de projet, et bilan.")

# ════════ 3. CONTEXTE ════════
s=add(); rect(s,0,0,SW,SH,LIGHT); header(s,1,"Contexte et commanditaire","LE PROJET","ic_play.png")
bullets(s,Inches(0.7),Inches(1.7),Inches(7.2),Inches(5),[
    "La ColorRoom : une salle équipée de 42 dalles LED RVB pilotables une par une",
    "Commanditaire : LUMEN Campus Lumière (Lyon), avec l'ENTPE et le laboratoire LTDS",
    "But : des serious games pour sensibiliser à la couleur, la lumière et la perception",
    ("Public : étudiants, visiteurs, démonstrations pédagogiques",1),
    "Le matériel existait : il fallait le logiciel pour l'animer et le rendre utile"],size=17,gap=14)
pic(s,"led_grid.png",Inches(8.35),Inches(1.75),Inches(4.3),Inches(5.4))
notes(s,"La ColorRoom est une installation physique de 42 dalles LED commandees une par une. "
        "Le commanditaire voulait des jeux educatifs sur la couleur. Le materiel etait la, sans logiciel ludique : "
        "c'est l'objet de mon projet.")

# ════════ 4. CHIFFRES CLÉS ════════
s=add(); rect(s,0,0,SW,SH,DARK); rect(s,0,Inches(1.25),SW,Pt(4),VIOLET)
tb(s,Inches(0.7),Inches(0.35),Inches(11),Inches(0.9),[("EN BREF",12,GREEN,True,0),("Chiffres clés du projet",25,WHITE,True,0)])
stats=[("42","dalles LED RVB","cube"),("4","conteneurs Docker","container"),
       ("190","blocs dans l'éditeur","puzzle"),("2","moteurs d'IA (cloud + local)","robot"),
       ("6","jeux intégrés","play"),("0","tiret long dans ce deck ;)","check")]
for i,(num,lbl,ic) in enumerate(stats):
    cx=Inches(0.7)+(i%3)*Inches(4.05); cy=Inches(1.7)+(i//3)*Inches(2.5)
    card(s,cx,cy,Inches(3.8),Inches(2.25),RGBColor(0x17,0x21,0x38))
    pic(s,f"ic_{ic}.png",cx+Inches(0.25),cy+Inches(0.35),Inches(0.95))
    tb(s,cx+Inches(1.35),cy+Inches(0.25),Inches(2.3),Inches(1.8),[
        (num,40,WHITE,True,0),(lbl,13,CLEAR,False,2)])
notes(s,"Quelques chiffres : 42 dalles, 4 conteneurs Docker, environ 190 blocs dans l'editeur, "
        "2 moteurs d'IA cloud et local, 6 jeux integres.")

# ════════ 5. PROBLÉMATIQUE ════════
s=add(); rect(s,0,0,SW,SH,LIGHT); header(s,2,"Problématique et objectifs","LE BESOIN","ic_target.png")
rect(s,Inches(0.7),Inches(1.6),Inches(11.9),Inches(1.15),VIOLET,rad=True)
tb(s,Inches(1.0),Inches(1.72),Inches(11.4),Inches(1),[
    ("Comment piloter et mesurer la lumière de 42 dalles LED, tout en proposant",17,WHITE,True,0),
    ("des jeux éducatifs créables facilement, sur un système autonome et hors ligne ?",17,WHITE,True,2)])
objs=[("network","Piloter les dalles en temps réel via le réseau (couleur, intensité)"),
      ("palette","Mesurer réellement la lumière émise (colorimètre Konica CS-160)"),
      ("puzzle","Offrir des jeux et un éditeur pour en créer sans coder"),
      ("container","Fonctionner 100 % en local sur Raspberry Pi"),
      ("phone","Multijoueur : chaque joueur pilote une dalle depuis son téléphone")]
for i,(ic,txt) in enumerate(objs):
    cy=Inches(3.05)+i*Inches(0.78)
    pic(s,f"ic_{ic}.png",Inches(0.8),cy,Inches(0.6))
    tb(s,Inches(1.6),cy+Inches(0.02),Inches(11),Inches(0.6),[(txt,16,SLATE,False,0)],anchor=MSO_ANCHOR.MIDDLE)
notes(s,"La problematique : piloter ET mesurer la lumiere, avec des jeux creables facilement, sur un systeme autonome. "
        "J'en tire 5 objectifs concrets.")

# ════════ 6. CAHIER DES CHARGES ════════
s=add(); rect(s,0,0,SW,SH,LIGHT); header(s,3,"Cahier des charges et contraintes","CADRE TECHNIQUE","ic_gear.png")
pic(s,"ic_puzzle.png",Inches(0.7),Inches(1.55),Inches(0.55))
tb(s,Inches(1.35),Inches(1.6),Inches(5),Inches(0.5),[("Exigences fonctionnelles",18,VIOLET,True,0)],anchor=MSO_ANCHOR.MIDDLE)
bullets(s,Inches(0.7),Inches(2.3),Inches(6),Inches(4.5),[
    "Jeux jouables sur les dalles et la tablette","Éditeur low-code (blocs) + Python / JS",
    "Mode multijoueur en réseau local","Mesure colorimétrique et diagramme CIE",
    "Administration (comptes, classes, scores)"],size=15,gap=12)
pic(s,"ic_lock.png",Inches(6.9),Inches(1.55),Inches(0.55))
tb(s,Inches(7.55),Inches(1.6),Inches(5),Inches(0.5),[("Contraintes techniques",18,PINK,True,0)],anchor=MSO_ANCHOR.MIDDLE)
bullets(s,Inches(6.9),Inches(2.3),Inches(5.9),Inches(4.5),[
    "Cible : Raspberry Pi (ressources limitées)","Fonctionnement hors ligne possible",
    "API Supervision imposée pour les dalles","Colorimètre Konica Minolta CS-160 (SDK)",
    "Déploiement reproductible et maintenable"],size=15,gap=12)
notes(s,"Cote fonctionnel : jeux, editeur, multijoueur, mesure, admin. Cote contraintes : tenir sur un Pi, "
        "marcher hors ligne, utiliser l'API Supervision imposee et le SDK du CS-160.")

# ════════ 7. ARCHITECTURE ════════
s=add(); rect(s,0,0,SW,SH,WHITE); header(s,4,"Architecture générale","VUE D'ENSEMBLE","ic_network.png")
def box(x,y,w,h,title,sub,color):
    sp=s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE,x,y,w,h)
    sp.fill.solid(); sp.fill.fore_color.rgb=color; sp.line.fill.background(); sp.shadow.inherit=False
    f=sp.text_frame; f.word_wrap=True; f.vertical_anchor=MSO_ANCHOR.MIDDLE
    p=f.paragraphs[0]; p.alignment=PP_ALIGN.CENTER
    r=p.add_run(); r.text=title; r.font.size=Pt(15); r.font.bold=True; r.font.color.rgb=WHITE
    p2=f.add_paragraph(); p2.alignment=PP_ALIGN.CENTER
    r2=p2.add_run(); r2.text=sub; r2.font.size=Pt(10); r2.font.color.rgb=CLEAR
def arrow(x,y):
    a=s.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW,x,y,Inches(0.6),Inches(0.45))
    a.fill.solid(); a.fill.fore_color.rgb=GREY; a.line.fill.background(); a.shadow.inherit=False
Y=Inches(2.4)
box(Inches(0.6),Y,Inches(2.6),Inches(1.4),"Tablette / PC","Navigateur",INDIGO); arrow(Inches(3.3),Inches(2.85))
box(Inches(4.05),Y,Inches(3.0),Inches(1.4),"App ColorRoom","Next.js · Docker · Pi",VIOLET); arrow(Inches(7.2),Inches(2.85))
box(Inches(7.95),Y,Inches(2.4),Inches(1.4),"API Supervision","HTTP local",SLATE); arrow(Inches(10.5),Inches(2.85))
box(Inches(11.2),Y,Inches(1.6),Inches(1.4),"42 dalles","LED RVB",GREEN)
box(Inches(0.6),Inches(4.45),Inches(2.6),Inches(1.1),"SQLite","jeux · scores · users",AMBER)
box(Inches(4.05),Inches(4.45),Inches(3.0),Inches(1.1),"IA","Gemini ou Ollama",PINK)
box(Inches(7.95),Inches(4.45),Inches(2.4),Inches(1.1),"CS-160","colorimètre USB",SLATE)
tb(s,Inches(0.6),Inches(5.85),Inches(12),Inches(1),[
    ("Tout est conteneurisé (Docker Compose) et tourne en local sur le Pi. L'IA cloud (Gemini) est optionnelle : le local (Ollama) prend le relais hors ligne.",14,GREY,False,0)])
notes(s,"Schema global : l'utilisateur ouvre l'app dans un navigateur ; l'app, en Next.js et conteneurisee, tourne sur le Pi ; "
        "pour allumer les dalles elle parle a l'API Supervision en HTTP. A cote : SQLite, le colorimetre CS-160 en USB, et l'IA cloud ou locale.")

# ════════ 8. CHOIX TECHNIQUES ════════
s=add(); rect(s,0,0,SW,SH,LIGHT); header(s,5,"Choix techniques justifiés","LA STACK","ic_code.png")
rows=[("cube","Next.js / React + TypeScript","Front et back dans un seul projet, typage strict, moins de bugs"),
      ("container","SQLite (better-sqlite3)","Base embarquée, zéro serveur à installer, idéale sur Pi"),
      ("gear","Docker Compose","Déploiement reproductible : une commande lance toute la stack"),
      ("cube","Three.js","Vue 3D de la salle en temps réel dans le navigateur"),
      ("robot","Ollama (IA locale)","Génération de jeux 100 % hors ligne, données privées")]
y=Inches(1.65)
for i,(ic,t,why) in enumerate(rows):
    rect(s,Inches(0.7),y,Inches(11.9),Inches(0.92),WHITE if i%2==0 else CARD,rad=True)
    pic(s,f"ic_{ic}.png",Inches(0.9),y+Inches(0.16),Inches(0.6))
    tb(s,Inches(1.7),y,Inches(3.9),Inches(0.92),[(t,15,VIOLET,True,0)],anchor=MSO_ANCHOR.MIDDLE)
    tb(s,Inches(5.6),y,Inches(6.8),Inches(0.92),[(why,14,SLATE,False,0)],anchor=MSO_ANCHOR.MIDDLE)
    y+=Inches(1.0)
notes(s,"Chaque choix est justifie : Next.js + TypeScript pour un code type et un projet unique ; SQLite embarquee ; "
        "Docker pour un deploiement reproductible ; Three.js pour la 3D ; Ollama pour une IA locale.")

# ════════ 9. POURQUOI CETTE STACK vs Node-RED/JS ════════
s=add(); rect(s,0,0,SW,SH,LIGHT); header(s,5,"Pourquoi cette stack ?","REACT / NEXT.JS / NODE / TS  vs  JS PUR + NODE-RED","ic_code.png")
rect(s,Inches(0.7),Inches(1.6),Inches(5.85),Inches(0.6),SLATE,rad=True)
tb(s,Inches(0.95),Inches(1.66),Inches(5.4),Inches(0.5),[("Approche initiale : Node-RED + JS pur",15,WHITE,True,0)],anchor=MSO_ANCHOR.MIDDLE)
bullets(s,Inches(0.8),Inches(2.35),Inches(5.7),Inches(4.4),[
    "Node-RED : top pour prototyper l'IoT, mais limité pour une vraie UI riche (3D, éditeur)",
    "Flux en JSON difficiles à versionner et relire dans Git",
    "JS pur : aucun typage, erreurs vues seulement à l'exécution",
    "Refactorisation risquée, autocomplétion faible",
    "Complexité vite ingérable sur un gros projet"],size=13.5,gap=10)
rect(s,Inches(6.75),Inches(1.6),Inches(5.85),Inches(0.6),VIOLET,rad=True)
tb(s,Inches(7.0),Inches(1.66),Inches(5.4),Inches(0.5),[("Choix retenu : Next.js + React + Node + TS",15,WHITE,True,0)],anchor=MSO_ANCHOR.MIDDLE)
bullets(s,Inches(6.85),Inches(2.35),Inches(5.7),Inches(4.4),[
    "React : interface en composants réutilisables, idéale pour une UI complexe",
    "Next.js : front et back (API) dans un seul projet, routing intégré",
    "Node.js : même langage côté serveur et navigateur",
    "TypeScript : typage strict, bugs attrapés à la compilation",
    "Du code texte : versionnable, testable (tsc + build)"],size=13.5,gap=10)
notes(s,"Question classique : pourquoi pas Node-RED et du JS pur ? Node-RED est genial pour prototyper de l'IoT par flux, "
        "mais limite des qu'on veut une UI riche (3D, editeur, multijoueur), et ses flux JSON sont durs a versionner. "
        "Le JS pur n'a pas de typage : les bugs sortent a l'execution. D'ou React (composants), Next.js (front+back), "
        "Node.js (un seul langage) et TypeScript (bugs attrapes a la compilation, refacto sure). Le tout versionnable et testable.")

# ════════ 10. RÉSEAU & DÉPLOIEMENT ════════
s=add(); rect(s,0,0,SW,SH,LIGHT); header(s,6,"Réseau et déploiement","DOCKER / RASPBERRY PI","ic_container.png")
bullets(s,Inches(0.7),Inches(1.7),Inches(6.4),Inches(5),[
    "Orchestration via docker-compose.yml (4 services)",
    ("color-room : l'application (port 8080)",1),
    ("ollama + ollama-pull : IA locale (port 11434)",1),
    ("portainer : supervision des conteneurs (9000)",1),
    "Réseau local : tablettes et téléphones sur le même Wi-Fi",
    "Secrets isolés dans un fichier .env (non versionné)",
    "Mise à jour : git pull puis docker compose up"],size=15,gap=10)
card(s,Inches(7.5),Inches(1.9),Inches(5.1),Inches(4.2),DARK)
tb(s,Inches(7.8),Inches(2.15),Inches(4.6),Inches(3.8),[
    ("# déploiement sur le Pi",13,GREEN,True,0),
    ("git pull origin main",14,WHITE,False,8),
    ("docker compose up -d --build",14,WHITE,False,4),
    ("",8,WHITE,False,4),
    ("# 4 conteneurs démarrent",13,GREEN,True,6),
    ("color-room   :8080",13,CLEAR,False,4),
    ("ollama       :11434",13,CLEAR,False,2),
    ("portainer    :9000",13,CLEAR,False,2)])
notes(s,"Le deploiement est gere par Docker Compose : 4 services (app 8080, Ollama, Portainer). Les telephones rejoignent "
        "par le Wi-Fi local. Les secrets sont dans un .env hors Git. Mettre a jour = git pull puis docker compose up.")

# ════════ 11. FONCTIONNALITÉS ════════
s=add(); rect(s,0,0,SW,SH,WHITE); header(s,7,"Fonctionnalités du projet","CE QUE FAIT L'APPLI","ic_puzzle.png")
feats=[("play","Jeux intégrés","Color Speed, Simon, Puissance 4, Mémoire, mesure",INDIGO),
       ("puzzle","Éditeur low-code","Relier des blocs, ou coder en Python / JS",VIOLET),
       ("robot","Génération par IA","Décrire un jeu en une phrase, il est créé",PINK),
       ("phone","Multijoueur","1 joueur = 1 dalle, rejoint par QR code",GREEN),
       ("palette","Mesure CS-160","Colorimètre réel + diagramme CIE 1931",AMBER),
       ("lock","Administration","Comptes, classes, scores, niveaux",SLATE)]
for i,(ic,t,d,c) in enumerate(feats):
    cx=Inches(0.7)+(i%3)*Inches(4.05); cy=Inches(1.7)+(i//3)*Inches(2.5)
    card(s,cx,cy,Inches(3.8),Inches(2.25),LIGHT,line=c)
    pic(s,f"ic_{ic}.png",cx+Inches(0.25),cy+Inches(0.3),Inches(0.85))
    tb(s,cx+Inches(1.25),cy+Inches(0.3),Inches(2.4),Inches(1.7),[(t,16,c,True,0),(d,12.5,SLATE,False,6)])
notes(s,"Six fonctionnalites : jeux prets a jouer, editeur low-code (ou Python/JS), generation par IA, multijoueur "
        "(une dalle par telephone via QR), mesure reelle au colorimetre avec diagramme CIE, et administration des comptes.")

# ════════ 12. FOCUS ÉDITEUR ════════
s=add(); rect(s,0,0,SW,SH,LIGHT); header(s,8,"Focus : l'éditeur de jeux","POINT FORT 1 / 3","ic_puzzle.png")
bullets(s,Inches(0.7),Inches(1.7),Inches(7.2),Inches(5),[
    "Programmation visuelle par noeuds reliés (style blueprint)",
    ("Évènements (clic dalle, timer) puis actions (allumer, score, son)",1),
    "Catalogue d'environ 190 blocs : logique, maths, rendu, animations, multijoueur",
    "Bloc Script : code Python ou JavaScript exécuté dans le jeu",
    "Aperçu en direct sur la vue 3D et sur les vraies dalles",
    "Les jeux créés sont sauvegardés et jouables par tous"],size=15,gap=12)
card(s,Inches(8.2),Inches(1.9),Inches(4.4),Inches(4.3),WHITE)
tb(s,Inches(8.5),Inches(2.15),Inches(3.9),Inches(4),[
    ("EXEMPLE DE FLUX",12,VIOLET,True,0),
    ("Démarrer",15,INDIGO,True,12),("↓",13,GREY,False,2),
    ("Dalle aléatoire",15,VIOLET,True,2),("↓",13,GREY,False,2),
    ("Clic du joueur ?",15,PINK,True,2),("↓",13,GREY,False,2),
    ("+1 point et son",15,GREEN,True,2)])
notes(s,"Le coeur technique : l'editeur, de la programmation visuelle par blocs relies, comme dans Unreal. "
        "On part d'un evenement et on enchaine des actions. Environ 190 blocs. Un bloc Script permet d'ecrire du Python ou du JS. "
        "Tout s'affiche en direct sur la 3D et les vraies dalles.")

# ════════ 13. FOCUS IA ════════
s=add(); rect(s,0,0,SW,SH,LIGHT); header(s,9,"Focus : génération par IA","POINT FORT 2 / 3","ic_robot.png")
bullets(s,Inches(0.7),Inches(1.7),Inches(7.2),Inches(5),[
    "L'utilisateur décrit le jeu en langage naturel",
    "Cascade intelligente : Gemini (cloud) puis repli Ollama (local)",
    ("Marche hors ligne grâce au modèle local sur le Pi",1),
    "L'IA renvoie un JSON strict, converti en blocs et interface",
    "Garde-fou : refuse poliment les jeux impossibles (Forza, GTA)",
    "Validation et nettoyage systématiques de la sortie"],size=15,gap=12)
card(s,Inches(8.2),Inches(1.9),Inches(4.4),Inches(4.3),DARK)
tb(s,Inches(8.5),Inches(2.15),Inches(3.9),Inches(4),[
    ("CASCADE IA",12,GREEN,True,0),
    ("1. Clé Gemini présente ?",14,WHITE,True,12),("oui : Gemini Flash",12,CLEAR,False,2),
    ("2. Échec ou hors ligne ?",14,WHITE,True,10),("repli : Ollama (Pi)",12,CLEAR,False,2),
    ("3. Sortie JSON validée",14,WHITE,True,10),("blocs + UI générés",12,CLEAR,False,2)])
notes(s,"L'IA : on decrit un jeu en une phrase, elle le construit. Cascade : Gemini en cloud si une cle existe, "
        "sinon repli automatique sur Ollama en local sur le Pi, donc hors ligne. La sortie est du JSON strict, valide et nettoye. "
        "Un garde-fou refuse poliment les jeux irrealisables.")

# ════════ 14. FOCUS MESURE ════════
s=add(); rect(s,0,0,SW,SH,LIGHT); header(s,10,"Focus : mesure colorimétrique","POINT FORT 3 / 3","ic_palette.png")
bullets(s,Inches(0.7),Inches(1.7),Inches(7.0),Inches(5),[
    "Colorimètre Konica Minolta CS-160 piloté via une API",
    "Mesure réelle de la lumière émise (X Y Z, x y Lv)",
    "Affichage sur le diagramme de chromaticité CIE 1931",
    "Jeux basés sur la mesure (reconnaître une couleur, métamérie)",
    "Écart de couleur (delta E) pour scorer la précision",
    "Lien direct entre le virtuel et le réel mesuré"],size=15,gap=12)
pic(s,"cie.png",Inches(8.1),Inches(1.7),Inches(4.5),Inches(4.5))
notes(s,"La mesure, tres metier lumiere : le CS-160 mesure reellement la lumiere emise. On l'affiche sur le diagramme CIE 1931, "
        "le standard de la colorimetrie. Certains jeux notent le joueur selon l'ecart de couleur delta E. C'est ce qui relie le virtuel au reel.")

# ════════ 15. MULTIJOUEUR ════════
s=add(); rect(s,0,0,SW,SH,WHITE); header(s,11,"Multijoueur en réseau local","UNE DALLE PAR JOUEUR","ic_phone.png")
pic(s,"phones.png",Inches(6.7),Inches(1.7),Inches(6.2))
bullets(s,Inches(0.7),Inches(1.9),Inches(6.0),Inches(5),[
    "Chaque joueur ouvre la page sur son téléphone",
    "Il scanne un QR code ou tape l'adresse locale",
    "Il reçoit une dalle (un siège) et choisit sa couleur",
    "Sa dalle s'allume en temps réel dans la Color Room",
    "L'animateur peut jouer aussi depuis la tablette",
    "Tout passe par le réseau Wi-Fi local (pas d'Internet)"],size=15,gap=13)
notes(s,"Le multijoueur : chaque joueur ouvre la page sur son telephone, scanne un QR ou tape l'adresse locale, "
        "recoit une dalle et choisit sa couleur, qui s'allume en temps reel. L'animateur peut jouer aussi depuis la tablette. "
        "Tout reste sur le Wi-Fi local.")

# ════════ 16. SÉCURITÉ ════════
s=add(); rect(s,0,0,SW,SH,LIGHT); header(s,12,"Sécurité","BONNES PRATIQUES","ic_lock.png")
sec=[("lock","Mots de passe hachés (PBKDF2-SHA512, 100 000 itérations, sel) : jamais en clair"),
     ("network","Sessions par cookie httpOnly + rôles (élève, enseignant, admin)"),
     ("gear","Secrets dans .env, exclu de Git via .gitignore"),
     ("check","Transactions SQL atomiques (ACID) pour des états cohérents"),
     ("container","Réseau local isolé : pas d'exposition Internet, IA hors ligne possible"),
     ("doc","Retour d'expérience : secret committé par erreur, purgé de l'historique Git")]
for i,(ic,txt) in enumerate(sec):
    cy=Inches(1.7)+i*Inches(0.85)
    pic(s,f"ic_{ic}.png",Inches(0.8),cy,Inches(0.6))
    tb(s,Inches(1.6),cy+Inches(0.02),Inches(11),Inches(0.7),[(txt,15,SLATE,False,0)],anchor=MSO_ANCHOR.MIDDLE)
notes(s,"La securite, importante en CIEL : mots de passe haches PBKDF2 jamais en clair, sessions par cookie et roles, "
        "secrets dans un .env hors Git, transactions atomiques. Retour d'experience : j'ai purge de l'historique Git un secret "
        "committe par erreur, ce qui montre que je connais les bonnes pratiques.")

# ════════ 17. GESTION DE PROJET ════════
s=add(); rect(s,0,0,SW,SH,LIGHT); header(s,13,"Gestion de projet","MÉTHODE ET OUTILS","ic_doc.png")
bullets(s,Inches(0.7),Inches(1.7),Inches(6.2),Inches(5),[
    "Versioning Git et GitHub (branches, commits clairs)",
    "Développement incrémental, fonctionnalité par fonctionnalité",
    "Tests à chaque étape : typage (tsc) et build de production",
    "Documentation : 15 diagrammes UML et un guide technique",
    "Conteneurisation pour des déploiements fiables"],size=15,gap=13)
card(s,Inches(7.2),Inches(1.9),Inches(5.4),Inches(4.2),WHITE)
tb(s,Inches(7.5),Inches(2.15),Inches(4.9),Inches(3.9),[
    ("OUTILS UTILISÉS",12,VIOLET,True,0),
    ("Code         VS Code / TypeScript",14,SLATE,False,12),
    ("Versions     Git + GitHub",14,SLATE,False,7),
    ("Conteneurs   Docker Compose",14,SLATE,False,7),
    ("Supervision  Portainer",14,SLATE,False,7),
    ("Modélisation UML (PlantUML)",14,SLATE,False,7),
    ("Cible        Raspberry Pi",14,SLATE,False,7)])
notes(s,"Cote gestion : tout est versionne sur Git et GitHub avec branches et commits clairs. Developpement incremental, "
        "teste a chaque etape (types et build). Documente avec 15 diagrammes UML et un guide. Tout est conteneurise.")

# ════════ 18. DIFFICULTÉS ════════
s=add(); rect(s,0,0,SW,SH,WHITE); header(s,14,"Difficultés rencontrées et solutions","DÉMARCHE D'INGÉNIEUR","ic_gear.png")
probs=[("Lag de la vue 3D sur tablette","Textures allégées, pixel ratio plafonné, snapshots dédupliqués"),
       ("Contextes WebGL bloqués (crash)","Libération explicite du contexte + repli gracieux"),
       ("Son d'un jeu joué sans fin","Bug d'unité ms / secondes corrigé dans l'audio"),
       ("Tetris injouable sur 6x7","Refonte en jeu de combinaison de couleurs (pièces 1-2 cases)")]
y=Inches(1.75)
for i,(p,sol) in enumerate(probs):
    rect(s,Inches(0.7),y,Inches(5.7),Inches(1.0),RGBColor(0xFE,0xE2,0xE2),rad=True)
    tb(s,Inches(0.95),y,Inches(5.3),Inches(1.0),[("!  "+p,14,RED,True,0)],anchor=MSO_ANCHOR.MIDDLE)
    a=s.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW,Inches(6.5),y+Inches(0.32),Inches(0.4),Inches(0.36))
    a.fill.solid(); a.fill.fore_color.rgb=GREY; a.line.fill.background(); a.shadow.inherit=False
    rect(s,Inches(7.0),y,Inches(5.6),Inches(1.0),RGBColor(0xDC,0xFC,0xE7),rad=True)
    pic(s,"ic_check.png",Inches(7.15),y+Inches(0.2),Inches(0.6))
    tb(s,Inches(7.85),y,Inches(4.6),Inches(1.0),[(sol,13,RGBColor(0x15,0x80,0x3D),True,0)],anchor=MSO_ANCHOR.MIDDLE)
    y+=Inches(1.15)
notes(s,"Un projet, c'est resoudre des problemes : la 3D ramait (textures allegees, rendu reduit) ; des crashs WebGL "
        "(liberation explicite du contexte) ; un son sans fin (confusion ms/secondes corrigee) ; le Tetris injouable sur 6x7 "
        "(transforme en jeu de combinaison de couleurs). C'est la demarche d'ingenieur : diagnostiquer puis corriger.")

# ════════ 19. BILAN ════════
s=add(); rect(s,0,0,SW,SH,LIGHT); header(s,15,"Bilan et perspectives","CONCLUSION TECHNIQUE","ic_chart.png")
pic(s,"ic_check.png",Inches(0.7),Inches(1.55),Inches(0.55))
tb(s,Inches(1.35),Inches(1.6),Inches(5),Inches(0.5),[("Objectifs atteints",18,GREEN,True,0)],anchor=MSO_ANCHOR.MIDDLE)
bullets(s,Inches(0.7),Inches(2.3),Inches(6),Inches(4.5),[
    "Pilotage temps réel des 42 dalles","Mesure réelle au colorimètre + CIE",
    "Éditeur et génération IA fonctionnels","Multijoueur en réseau local",
    "Déploiement automatisé sur Pi"],size=15,gap=12)
pic(s,"ic_bolt.png",Inches(6.9),Inches(1.55),Inches(0.55))
tb(s,Inches(7.55),Inches(1.6),Inches(5),Inches(0.5),[("Perspectives",18,VIOLET,True,0)],anchor=MSO_ANCHOR.MIDDLE)
bullets(s,Inches(6.9),Inches(2.3),Inches(5.9),Inches(4.5),[
    "Vrai système de salons multijoueurs (codes)","Streaming de la génération IA en temps réel",
    "Plus de jeux pédagogiques et de tutoriels","Tableau de bord enseignant enrichi",
    "Tests automatisés (CI / CD)"],size=15,gap=12)
notes(s,"Bilan : les 5 objectifs sont atteints. Pour la suite : salons multijoueurs avec codes, streaming de l'IA en temps reel, "
        "plus de jeux, un tableau de bord enseignant, et de l'integration continue.")

# ════════ 20. DÉMO ════════
s=add(); rect(s,0,0,SW,SH,DARK); rect(s,0,Inches(3.5),SW,Pt(4),VIOLET)
pic(s,"ic_play.png",Inches(5.9),Inches(1.2),Inches(1.5))
tb(s,Inches(1),Inches(2.85),Inches(11.3),Inches(1.4),[
    ("PLACE À LA",16,GREEN,True,0),("Démonstration",48,WHITE,True,6)],align=PP_ALIGN.CENTER)
tb(s,Inches(1),Inches(4.45),Inches(11.3),Inches(2.2),[
    ("1. Lancer un jeu sur les dalles    2. Créer un jeu (éditeur)",16,CLEAR,False,0),
    ("3. Générer un jeu avec l'IA    4. Multijoueur (QR + téléphone)",16,CLEAR,False,8),
    ("5. Mesure CS-160 + diagramme CIE    6. Portainer / Docker",16,CLEAR,False,8)],align=PP_ALIGN.CENTER)
notes(s,"Demo, ordre conseille : 1) Color Speed sur les dalles, 2) creer un jeu dans l'editeur, 3) en generer un avec l'IA, "
        "4) multijoueur avec QR et telephone, 5) mesure CS-160 sur le diagramme CIE, 6) Portainer pour montrer les conteneurs. "
        "Prevois une video de secours au cas ou le materiel bug.")

# ════════ 21. MERCI ════════
s=add(); rect(s,0,0,SW,SH,DARK)
rect(s,0,Inches(2.0),SW,Inches(0.08),INDIGO); rect(s,0,Inches(2.08),SW,Inches(0.08),VIOLET); rect(s,0,Inches(2.16),SW,Inches(0.08),PINK)
tb(s,Inches(1),Inches(2.8),Inches(11.3),Inches(2),[
    ("Merci de votre attention",44,WHITE,True,0),("Avez-vous des questions ?",22,GREEN,True,14)],align=PP_ALIGN.CENTER)
tb(s,Inches(1),Inches(6.4),Inches(11.3),Inches(0.6),[
    ("ColorRoom  ·  BTS CIEL option IR  ·  Session 2026",13,GREY,False,0)],align=PP_ALIGN.CENTER)
notes(s,"Merci. Je suis a votre disposition pour vos questions. Questions probables : pourquoi Next.js plutot que Node-RED, "
        "comment securises-tu le reseau, comment ca marche hors ligne, que se passe-t-il si une dalle tombe en panne, "
        "combien d'utilisateurs simultanes.")

prs.save("ColorRoom_Presentation_BTS_CIEL.pptx")
print("OK -", len(prs.slides._sldIdLst), "slides")
