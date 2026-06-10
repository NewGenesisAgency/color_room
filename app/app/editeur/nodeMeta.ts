/**
 * @file nodeMeta.ts
 * @brief Métadonnées de recherche pour la palette de blocs de l'éditeur.
 *
 * Pour chaque `kind` du NODE_CATALOG (page.tsx), on fournit :
 *  - `desc` : une description d'une phrase, en français simple, affichée
 *    sous le titre dans le menu d'ajout ;
 *  - `syn`  : des synonymes de recherche (mots du quotidien) pour que le
 *    menu trouve le bloc même si l'utilisateur ne connaît pas son nom exact.
 *
 * La recherche est insensible aux accents et à la casse : voir
 * `normaliserRecherche()`.
 */

/**
 * @brief Métadonnées d'un bloc : description courte + synonymes de recherche.
 */
export type NodeMeta = {
  /** Description d'une phrase, en français simple. */
  desc: string;
  /** Synonymes / mots-clés de recherche (3 à 6 par bloc). */
  syn: string[];
};

/**
 * @brief Normalise un texte pour la recherche : minuscules, sans accents.
 * @param texte Texte brut saisi ou indexé.
 * @return Texte en minuscules, débarrassé des signes diacritiques.
 */
export function normaliserRecherche(texte: string): string {
  return texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/**
 * @brief Description + synonymes pour chaque `kind` du catalogue de blocs.
 */
export const NODE_META: Record<string, NodeMeta> = {
  // ─── Évènements ─────────────────────────────────────────────────────────
  event_begin: { desc: "Point de départ : se déclenche au lancement du jeu", syn: ['debut', 'demarrage', 'start', 'lancement', 'depart'] },
  on_score_reached: { desc: "Se déclenche quand le score atteint une valeur", syn: ['score', 'points', 'objectif', 'atteint', 'seuil'] },
  on_plate_click: { desc: "Se déclenche quand un joueur appuie sur une dalle", syn: ['appui', 'toucher', 'dalle', 'clic', 'pression'] },
  on_key: { desc: "Se déclenche quand une touche du clavier est pressée", syn: ['clavier', 'touche', 'fleche', 'appui', 'keyboard'] },
  on_timer: { desc: "Se déclenche à intervalle régulier (minuteur)", syn: ['minuteur', 'intervalle', 'repeter', 'horloge', 'periodique'] },
  on_click: { desc: "Se déclenche au clic sur une dalle précise", syn: ['clic', 'souris', 'dalle', 'appui', 'toucher'] },
  on_tick: { desc: "Se déclenche en boucle à chaque battement du jeu", syn: ['boucle', 'cadence', 'battement', 'cycle', 'horloge'] },
  on_tile_click: { desc: "Se déclenche au clic sur une dalle (ou n'importe laquelle)", syn: ['clic', 'dalle', 'tuile', 'appui', 'toucher'] },
  on_ui_click: { desc: "Se déclenche au clic sur un bouton de l'interface", syn: ['bouton', 'interface', 'clic', 'menu', 'ui'] },
  on_countdown_end: { desc: "Se déclenche quand un compte à rebours arrive à zéro", syn: ['chrono', 'compte a rebours', 'fini', 'temps ecoule', 'zero'] },
  on_submit_answer: { desc: "Se déclenche quand le joueur valide sa réponse", syn: ['valider', 'reponse', 'soumettre', 'envoyer', 'confirmer'] },

  // ─── Flux ───────────────────────────────────────────────────────────────
  wait: { desc: "Met le jeu en pause pendant quelques secondes", syn: ['pause', 'attendre', 'delai', 'temporiser', 'patienter'] },
  sequence: { desc: "Enchaîne plusieurs blocs l'un après l'autre", syn: ['enchainer', 'suite', 'ordre', 'etapes', 'chaine'] },
  while: { desc: "Répète un bloc tant qu'une condition est vraie", syn: ['boucle', 'repeter', 'tant que', 'condition', 'continuer'] },
  if: { desc: "Choisit un chemin selon une condition vraie ou fausse", syn: ['condition', 'choix', 'sinon', 'test', 'branche'] },
  loop_count: { desc: "Répète la suite un nombre précis de fois", syn: ['repeter', 'boucle', 'fois', 'compter', 'iteration'] },
  wait_event: { desc: "Attend qu'un évènement précis arrive avant de continuer", syn: ['attendre', 'evenement', 'signal', 'patienter', 'synchroniser'] },
  emit_event: { desc: "Envoie un signal que d'autres blocs peuvent attendre", syn: ['signal', 'envoyer', 'declencher', 'message', 'emettre'] },
  define_sub: { desc: "Définit un sous-programme réutilisable ailleurs", syn: ['fonction', 'sous programme', 'definir', 'routine', 'procedure'] },
  call_sub: { desc: "Lance un sous-programme défini ailleurs", syn: ['appeler', 'fonction', 'lancer', 'routine', 'executer'] },

  // ─── Rendu ──────────────────────────────────────────────────────────────
  fill: { desc: "Allume toutes les dalles d'une couleur", syn: ['allumer', 'couleur', 'remplir', 'fond', 'eclairer'] },
  pulse: { desc: "Fait battre la lumière entre deux couleurs", syn: ['battre', 'clignoter', 'respiration', 'pulser', 'rythme'] },
  tile: { desc: "Force la couleur d'une seule dalle", syn: ['dalle', 'tuile', 'couleur', 'forcer', 'une seule'] },

  // ─── Dalles ─────────────────────────────────────────────────────────────
  tile_get: { desc: "Lit la couleur actuelle d'une dalle", syn: ['lire', 'dalle', 'couleur', 'etat', 'recuperer'] },
  tile_set: { desc: "Donne une couleur et une intensité à une dalle", syn: ['ecrire', 'dalle', 'couleur', 'changer', 'peindre'] },
  clear_tiles: { desc: "Éteint toutes les dalles d'un coup", syn: ['eteindre', 'effacer', 'noir', 'vider', 'reset'] },
  tile_set_var: { desc: "Colore la dalle dont le numéro est dans une variable", syn: ['dalle', 'variable', 'couleur', 'indice', 'dynamique'] },
  tile_get_var: { desc: "Lit la couleur de la dalle pointée par une variable", syn: ['lire', 'dalle', 'variable', 'indice', 'couleur'] },
  tiles_from_array: { desc: "Affiche un tableau de couleurs sur les dalles", syn: ['tableau', 'dalles', 'afficher', 'liste', 'image'] },

  // ─── Constantes ─────────────────────────────────────────────────────────
  const_number: { desc: "Fournit un nombre fixe", syn: ['nombre', 'valeur', 'chiffre', 'constante', 'fixe'] },
  const_bool: { desc: "Fournit vrai ou faux", syn: ['vrai', 'faux', 'booleen', 'oui', 'non'] },
  const_color: { desc: "Fournit une couleur fixe", syn: ['couleur', 'teinte', 'constante', 'hex', 'fixe'] },

  // ─── Maths ──────────────────────────────────────────────────────────────
  math_add: { desc: "Additionne deux nombres", syn: ['plus', 'somme', 'ajouter', 'addition', 'total'] },
  math_sub: { desc: "Soustrait un nombre d'un autre", syn: ['moins', 'enlever', 'difference', 'soustraire', 'retirer'] },
  math_mul: { desc: "Multiplie deux nombres", syn: ['fois', 'produit', 'multiplier', 'doubler', 'multiplication'] },
  math_div: { desc: "Divise un nombre par un autre", syn: ['diviser', 'quotient', 'partager', 'division', 'fraction'] },
  math_clamp01: { desc: "Garde un nombre entre 0 et 1", syn: ['borner', 'limiter', 'entre', 'plafonner', 'clamp'] },
  math_lerp: { desc: "Calcule une valeur intermédiaire entre deux nombres", syn: ['interpoler', 'entre', 'transition', 'melange', 'progressif'] },
  math_mod: { desc: "Donne le reste de la division de a par b", syn: ['reste', 'modulo', 'division', 'cycle', 'pair impair'] },
  math_floor: { desc: "Arrondit un nombre vers le bas", syn: ['arrondir', 'inferieur', 'entier', 'plancher', 'tronquer'] },
  math_ceil: { desc: "Arrondit un nombre vers le haut", syn: ['arrondir', 'superieur', 'entier', 'plafond', 'haut'] },
  math_round: { desc: "Arrondit un nombre au plus proche", syn: ['arrondir', 'proche', 'entier', 'round', 'approcher'] },
  math_abs: { desc: "Rend un nombre toujours positif", syn: ['absolu', 'positif', 'distance', 'signe', 'valeur absolue'] },
  math_min: { desc: "Garde le plus petit de deux nombres", syn: ['minimum', 'plus petit', 'moindre', 'inferieur', 'min'] },
  math_max: { desc: "Garde le plus grand de deux nombres", syn: ['maximum', 'plus grand', 'superieur', 'max', 'plafond'] },
  math_pow: { desc: "Élève un nombre à la puissance d'un autre", syn: ['puissance', 'exposant', 'carre', 'cube', 'eleve'] },
  math_sqrt: { desc: "Calcule la racine carrée d'un nombre", syn: ['racine', 'carre', 'sqrt', 'radical', 'inverse puissance'] },

  // ─── Logique ────────────────────────────────────────────────────────────
  compare_eq: { desc: "Vérifie si deux valeurs sont égales", syn: ['egal', 'identique', 'comparer', 'meme', 'egalite'] },
  compare_gt: { desc: "Vérifie si une valeur est plus grande qu'une autre", syn: ['superieur', 'plus grand', 'comparer', 'depasse', 'au dessus'] },
  compare_lt: { desc: "Vérifie si une valeur est plus petite qu'une autre", syn: ['inferieur', 'plus petit', 'comparer', 'moins', 'en dessous'] },
  logic_and: { desc: "Vrai seulement si les deux conditions sont vraies", syn: ['et', 'deux', 'ensemble', 'toutes', 'and'] },
  logic_or: { desc: "Vrai si au moins une des conditions est vraie", syn: ['ou', 'soit', 'au moins', 'alternative', 'or'] },
  logic_not: { desc: "Inverse vrai en faux et faux en vrai", syn: ['non', 'inverser', 'contraire', 'negation', 'not'] },

  // ─── Temps / Aléatoire ──────────────────────────────────────────────────
  time_seconds: { desc: "Donne le temps écoulé en secondes", syn: ['temps', 'secondes', 'horloge', 'chrono', 'duree'] },
  random_01: { desc: "Tire un nombre au hasard entre 0 et 1", syn: ['hasard', 'aleatoire', 'tirage', 'random', 'chance'] },
  random_int: { desc: "Tire un nombre entier au hasard entre min et max", syn: ['hasard', 'entier', 'tirage', 'aleatoire', 'des'] },

  // ─── Jeux natifs ────────────────────────────────────────────────────────
  game_tetris: { desc: "Lance le jeu Tetris Lumière sur les dalles", syn: ['tetris', 'blocs', 'lignes', 'chute', 'puzzle'] },
  game_simon: { desc: "Lance le jeu Simon : mémoriser une suite de couleurs", syn: ['simon', 'memoire', 'sequence', 'suite', 'repeter'] },
  game_memory: { desc: "Lance le jeu Mémoire : retrouver les paires de couleurs", syn: ['memoire', 'paires', 'memory', 'retrouver', 'cartes'] },
  game_spectrum: { desc: "Lance le jeu Spectre : reproduire une couleur de mémoire", syn: ['spectre', 'couleur', 'deviner', 'reproduire', 'manche'] },
  game_color_speed: { desc: "Lance Color Speed : toucher la bonne couleur le plus vite", syn: ['vitesse', 'rapidite', 'reflexe', 'couleur', 'course'] },
  game_maitre_blanc: { desc: "Lance Le Maître du Blanc : composer un blanc parfait", syn: ['blanc', 'equilibre', 'rgb', 'precision', 'maitre'] },
  game_puissance4: { desc: "Lance Puissance 4 : aligner 4 couleurs sur la grille", syn: ['puissance 4', 'aligner', 'grille', 'duel', 'quatre'] },
  game_chasseur_gamut: { desc: "Lance Chasseur de Gamut : identifier des couleurs précises", syn: ['gamut', 'identifier', 'chasse', 'couleur', 'precision'] },
  game_metamere: { desc: "Lance Métamérie : distinguer des couleurs presque identiques", syn: ['metamerie', 'identique', 'distinguer', 'illusion', 'nuance'] },
  game_canal_mix: { desc: "Lance Mix de Canaux : doser les canaux rouge, vert et bleu", syn: ['canaux', 'rgb', 'melange', 'doser', 'mix'] },
  game_intrus: { desc: "Lance L'Intrus : trouver la dalle de couleur différente", syn: ['intrus', 'different', 'trouver', 'sniper', 'unique'] },
  game_chromaticite: { desc: "Lance Chromaticité CIE : viser un point du diagramme couleur", syn: ['cie', 'chromaticite', 'diagramme', 'science', 'viser'] },
  game_snake: { desc: "Lance Snake Lumière : guider le serpent sur les dalles", syn: ['snake', 'serpent', 'guider', 'pomme', 'classique'] },
  game_libre_rgb: { desc: "Mode libre : piloter les dalles avec des curseurs RGB", syn: ['libre', 'rgb', 'curseurs', 'manuel', 'exploration'] },
  game_tetris_block: { desc: "Lance Tetris Blocs : variante de Tetris construite en blocs", syn: ['tetris', 'blocs', 'variante', 'grille', 'chute'] },

  // ─── Audio ──────────────────────────────────────────────────────────────
  play_sound: { desc: "Joue un effet sonore", syn: ['son', 'bruit', 'audio', 'musique', 'jouer'] },

  // ─── Multijoueur ────────────────────────────────────────────────────────
  mp_session: { desc: "Ouvre une partie à plusieurs joueurs", syn: ['multijoueur', 'partie', 'session', 'plusieurs', 'lobby'] },
  mp_wait_players: { desc: "Attend que suffisamment de joueurs aient rejoint", syn: ['attendre', 'joueurs', 'rejoindre', 'minimum', 'lobby'] },
  mp_broadcast: { desc: "Envoie une couleur à tous les joueurs en même temps", syn: ['diffuser', 'tous', 'envoyer', 'couleur', 'partager'] },
  mp_player_input: { desc: "Attend l'action d'un joueur précis", syn: ['joueur', 'action', 'tour', 'attendre', 'saisie'] },

  // ─── Couleur ────────────────────────────────────────────────────────────
  color_mix: { desc: "Mélange deux couleurs selon un dosage", syn: ['melanger', 'fusion', 'doser', 'entre deux', 'degrade'] },
  color_hsl: { desc: "Crée une couleur à partir de teinte, saturation, luminosité", syn: ['teinte', 'saturation', 'luminosite', 'hsl', 'creer couleur'] },
  color_complement: { desc: "Donne la couleur opposée sur le cercle chromatique", syn: ['opposee', 'complementaire', 'contraire', 'cercle', 'inverse'] },
  color_temperature: { desc: "Crée une couleur de blanc chaud ou froid en kelvins", syn: ['kelvin', 'chaud', 'froid', 'blanc', 'temperature'] },
  gen_target_color: { desc: "Tire une couleur cible que le joueur devra retrouver", syn: ['cible', 'objectif', 'tirage', 'couleur', 'generer'] },
  color_distance: { desc: "Mesure l'écart entre deux couleurs (Delta E)", syn: ['ecart', 'difference', 'delta e', 'distance', 'comparer'] },
  color_match_score: { desc: "Transforme un écart de couleur en points de score", syn: ['score', 'points', 'precision', 'note', 'correspondance'] },
  show_target_on_plates: { desc: "Affiche la couleur cible sur les dalles", syn: ['afficher', 'cible', 'dalles', 'montrer', 'apercu'] },
  get_player_rgb: { desc: "Lit la couleur réglée par le joueur sur ses curseurs", syn: ['curseurs', 'joueur', 'lire', 'rgb', 'sliders'] },

  // ─── Animation ──────────────────────────────────────────────────────────
  anim_fade: { desc: "Fait monter ou descendre la lumière en douceur", syn: ['fondu', 'doucement', 'progressif', 'apparaitre', 'disparaitre'] },
  anim_strobe: { desc: "Fait clignoter les dalles très vite", syn: ['clignoter', 'flash', 'stroboscope', 'rapide', 'eclair'] },
  anim_rainbow: { desc: "Fait défiler un arc-en-ciel sur les dalles", syn: ['arc en ciel', 'multicolore', 'defiler', 'rainbow', 'cycle'] },
  anim_wave: { desc: "Fait passer une vague de couleur sur les dalles", syn: ['vague', 'onde', 'balayage', 'defilement', 'direction'] },

  // ─── Variables / Score ──────────────────────────────────────────────────
  variable_set: { desc: "Range une valeur dans une variable nommée", syn: ['variable', 'enregistrer', 'memoriser', 'stocker', 'definir'] },
  variable_get: { desc: "Lit la valeur rangée dans une variable", syn: ['variable', 'lire', 'recuperer', 'memoire', 'valeur'] },
  add_score: { desc: "Ajoute des points au score", syn: ['points', 'score', 'gagner', 'ajouter', 'augmenter'] },
  get_score: { desc: "Lit le score actuel", syn: ['score', 'points', 'lire', 'actuel', 'total'] },
  score_reset: { desc: "Remet le score à zéro", syn: ['zero', 'remettre', 'reinitialiser', 'effacer', 'reset'] },
  score_set: { desc: "Fixe le score à une valeur précise", syn: ['score', 'fixer', 'definir', 'valeur', 'imposer'] },
  score_get: { desc: "Range le score actuel dans une variable", syn: ['score', 'variable', 'lire', 'copier', 'recuperer'] },
  var_color_set: { desc: "Range une couleur dans une variable nommée", syn: ['couleur', 'variable', 'memoriser', 'stocker', 'enregistrer'] },
  var_color_get: { desc: "Lit la couleur rangée dans une variable", syn: ['couleur', 'variable', 'lire', 'recuperer', 'memoire'] },
  string_concat: { desc: "Colle deux textes bout à bout", syn: ['texte', 'coller', 'assembler', 'concatener', 'phrase'] },
  string_from_num: { desc: "Transforme un nombre en texte affichable", syn: ['nombre', 'texte', 'convertir', 'afficher', 'decimales'] },

  // ─── Blocs Tetris ───────────────────────────────────────────────────────
  tetris_on_line_clear: { desc: "Se déclenche quand une ligne de Tetris est effacée", syn: ['ligne', 'effacee', 'tetris', 'completee', 'bonus'] },
  tetris_on_level_up: { desc: "Se déclenche quand le niveau de Tetris augmente", syn: ['niveau', 'monter', 'tetris', 'progression', 'level'] },
  tetris_on_game_over: { desc: "Se déclenche quand la partie de Tetris est perdue", syn: ['perdu', 'fin', 'tetris', 'game over', 'defaite'] },
  tetris_set_speed: { desc: "Change la vitesse de chute des blocs Tetris", syn: ['vitesse', 'chute', 'tetris', 'accelerer', 'ralentir'] },

  // ─── Blocs Simon ────────────────────────────────────────────────────────
  simon_on_success: { desc: "Se déclenche quand la suite Simon est bien répétée", syn: ['reussi', 'simon', 'sequence', 'bravo', 'correct'] },
  simon_on_fail: { desc: "Se déclenche quand le joueur se trompe au Simon", syn: ['erreur', 'rate', 'simon', 'tromper', 'faux'] },
  simon_on_complete: { desc: "Se déclenche quand la partie de Simon est finie", syn: ['fini', 'simon', 'termine', 'complet', 'fin'] },
  simon_set_speed: { desc: "Change la vitesse de la suite au Simon", syn: ['vitesse', 'simon', 'accelerer', 'ralentir', 'rythme'] },

  // ─── Blocs Mémoire ──────────────────────────────────────────────────────
  memory_on_match: { desc: "Se déclenche quand une paire est trouvée au Memory", syn: ['paire', 'trouvee', 'memory', 'match', 'reussi'] },
  memory_on_fail: { desc: "Se déclenche quand les deux cartes ne vont pas ensemble", syn: ['erreur', 'mauvaise', 'memory', 'rate', 'paire'] },
  memory_on_complete: { desc: "Se déclenche quand toutes les paires sont trouvées", syn: ['fini', 'memory', 'complet', 'toutes', 'termine'] },

  // ─── Blocs Spectre ──────────────────────────────────────────────────────
  spectrum_on_submit: { desc: "Se déclenche quand un joueur envoie sa couleur au Spectre", syn: ['reponse', 'envoyer', 'spectre', 'soumettre', 'valider'] },
  spectrum_on_round_end: { desc: "Se déclenche à la fin d'une manche du Spectre", syn: ['manche', 'fin', 'spectre', 'round', 'etape'] },
  spectrum_on_game_over: { desc: "Se déclenche à la fin de la partie de Spectre", syn: ['fin', 'partie', 'spectre', 'termine', 'game over'] },

  // ─── Blocs Color Speed ──────────────────────────────────────────────────
  cspeed_on_hit: { desc: "Se déclenche quand le joueur touche la bonne dalle", syn: ['bonne', 'touche', 'reussi', 'correct', 'vitesse'] },
  cspeed_on_miss: { desc: "Se déclenche quand le joueur touche la mauvaise dalle", syn: ['mauvaise', 'rate', 'erreur', 'manque', 'faux'] },
  cspeed_on_time_up: { desc: "Se déclenche quand le temps de Color Speed est écoulé", syn: ['temps', 'ecoule', 'fini', 'chrono', 'fin'] },

  // ─── Blocs Puissance 4 ──────────────────────────────────────────────────
  p4_on_win: { desc: "Se déclenche quand un joueur aligne 4 couleurs", syn: ['victoire', 'gagne', 'aligne', 'puissance 4', 'vainqueur'] },
  p4_on_draw: { desc: "Se déclenche quand la grille est pleine sans vainqueur", syn: ['nul', 'egalite', 'pleine', 'match nul', 'personne'] },
  p4_set_color: { desc: "Change la couleur des jetons d'un joueur", syn: ['couleur', 'joueur', 'jeton', 'personnaliser', 'puissance 4'] },

  // ─── Blocs Chasseur Gamut ───────────────────────────────────────────────
  gamut_on_hit: { desc: "Se déclenche quand la couleur est bien identifiée", syn: ['trouve', 'identifie', 'reussi', 'gamut', 'correct'] },
  gamut_on_miss: { desc: "Se déclenche quand la couleur n'est pas identifiée", syn: ['manque', 'rate', 'erreur', 'gamut', 'faux'] },
  gamut_on_complete: { desc: "Se déclenche à la fin du Chasseur de Gamut", syn: ['fini', 'termine', 'gamut', 'fin', 'complet'] },

  // ─── Interface ──────────────────────────────────────────────────────────
  ui_button: { desc: "Ajoute un bouton cliquable à l'écran du joueur", syn: ['bouton', 'cliquer', 'interface', 'action', 'ecran'] },
  ui_label: { desc: "Affiche un texte fixe à l'écran", syn: ['texte', 'etiquette', 'afficher', 'message', 'titre'] },
  ui_counter: { desc: "Affiche un compteur (score, vies...) à l'écran", syn: ['compteur', 'score', 'nombre', 'afficher', 'vies'] },
  ui_timer_display: { desc: "Affiche un minuteur qui décompte à l'écran", syn: ['minuteur', 'chrono', 'decompte', 'temps', 'afficher'] },
  ui_progress: { desc: "Affiche une barre de progression (vie, avancement...)", syn: ['barre', 'progression', 'vie', 'jauge', 'avancement'] },
  ui_show: { desc: "Rend visible un élément d'interface caché", syn: ['afficher', 'montrer', 'visible', 'apparaitre', 'reveler'] },
  ui_hide: { desc: "Cache un élément d'interface", syn: ['cacher', 'masquer', 'invisible', 'disparaitre', 'retirer'] },

  // ─── Colorimètre CS160 ──────────────────────────────────────────────────
  cs160_connect: { desc: "Connecte le colorimètre CS160 à l'application", syn: ['connecter', 'brancher', 'appareil', 'usb', 'sonde'] },
  cs160_measure: { desc: "Lance une mesure de lumière avec le CS160", syn: ['mesurer', 'capter', 'sonde', 'lumiere', 'analyse'] },
  cs160_read_xyz: { desc: "Lit les valeurs XYZ mesurées par le CS160", syn: ['xyz', 'lire', 'mesure', 'tristimulus', 'valeurs'] },
  cs160_read_lvxy: { desc: "Lit la luminance et la chromaticité (Lvxy) du CS160", syn: ['luminance', 'chromaticite', 'lvxy', 'lire', 'mesure'] },
  cs160_set_backlight: { desc: "Allume ou éteint le rétroéclairage du CS160", syn: ['retroeclairage', 'ecran', 'allumer', 'eteindre', 'lumiere'] },
  cs160_set_calib_ch: { desc: "Choisit le canal de calibration du CS160", syn: ['canal', 'calibration', 'choisir', 'reglage', 'channel'] },
  cs160_rgb_calib: { desc: "Calibre le CS160 avec trois mesures rouge, vert, bleu", syn: ['calibrer', 'rgb', 'etalonnage', 'reference', 'trois points'] },
  cs160_single_calib: { desc: "Calibre le CS160 avec une seule mesure de référence", syn: ['calibrer', 'un point', 'etalonnage', 'reference', 'simple'] },

  // ─── Mesure dans les jeux ───────────────────────────────────────────────
  measure_start: { desc: "Demande une mesure de couleur pendant le jeu", syn: ['mesurer', 'lancer', 'sonde', 'capteur', 'demander'] },
  measure_on_result: { desc: "Se déclenche quand le résultat de mesure arrive", syn: ['resultat', 'mesure', 'recu', 'reponse', 'capteur'] },
  measure_compare: { desc: "Compare la mesure à une couleur cible avec tolérance", syn: ['comparer', 'cible', 'tolerance', 'ecart', 'verifier'] },
  measure_show_cie: { desc: "Affiche le diagramme CIE 1931 avec cible et résultat", syn: ['diagramme', 'cie', 'afficher', 'graphique', 'chromaticite'] },
  measure_target_xy: { desc: "Définit le point de couleur à viser sur le diagramme", syn: ['cible', 'point', 'viser', 'objectif', 'coordonnees'] },

  // ─── Logique de jeu ─────────────────────────────────────────────────────
  round_start: { desc: "Démarre une nouvelle manche de jeu", syn: ['manche', 'demarrer', 'round', 'commencer', 'partie'] },
  round_end: { desc: "Termine la manche en cours", syn: ['manche', 'finir', 'terminer', 'round', 'cloturer'] },
  next_round: { desc: "Passe à la manche suivante", syn: ['suivante', 'manche', 'passer', 'prochaine', 'continuer'] },
  get_round: { desc: "Lit le numéro de la manche en cours", syn: ['numero', 'manche', 'lire', 'round', 'actuel'] },
  countdown_start: { desc: "Démarre un compte à rebours en secondes", syn: ['chrono', 'compte a rebours', 'demarrer', 'minuteur', 'temps'] },
  countdown_stop: { desc: "Arrête un compte à rebours en cours", syn: ['arreter', 'chrono', 'stopper', 'compte a rebours', 'annuler'] },

  // ─── Hardware ───────────────────────────────────────────────────────────
  hardware_flash: { desc: "Fait flasher brièvement les dalles physiques", syn: ['flash', 'eclair', 'bref', 'dalles', 'clignoter'] },
  hardware_send_color: { desc: "Envoie directement une couleur aux dalles physiques", syn: ['envoyer', 'direct', 'dalles', 'couleur', 'materiel'] },

  // ─── Tableaux ───────────────────────────────────────────────────────────
  array_create: { desc: "Crée un tableau (liste de valeurs) d'une taille donnée", syn: ['tableau', 'liste', 'creer', 'collection', 'array'] },
  array_get: { desc: "Lit la valeur du tableau à une position donnée", syn: ['lire', 'tableau', 'position', 'element', 'indice'] },
  array_set: { desc: "Écrit une valeur dans le tableau à une position donnée", syn: ['ecrire', 'tableau', 'position', 'modifier', 'indice'] },
  array_fill: { desc: "Remplit tout le tableau avec la même valeur", syn: ['remplir', 'tableau', 'tout', 'initialiser', 'meme valeur'] },
  array_length: { desc: "Donne le nombre d'éléments du tableau", syn: ['longueur', 'taille', 'nombre', 'compter', 'elements'] },
  array_push: { desc: "Ajoute une valeur à la fin du tableau", syn: ['ajouter', 'fin', 'empiler', 'push', 'inserer'] },
  array_pop: { desc: "Retire et lit la dernière valeur du tableau", syn: ['retirer', 'dernier', 'depiler', 'pop', 'enlever'] },
  array_shuffle: { desc: "Mélange les éléments du tableau au hasard", syn: ['melanger', 'hasard', 'aleatoire', 'battre', 'desordre'] },
  array_contains: { desc: "Vérifie si une valeur est présente dans le tableau", syn: ['contient', 'chercher', 'present', 'existe', 'verifier'] },
  array_index_of: { desc: "Trouve la position d'une valeur dans le tableau", syn: ['position', 'chercher', 'indice', 'trouver', 'index'] },
  array_literal: { desc: "Crée un tableau à partir d'une liste de valeurs écrites", syn: ['tableau', 'valeurs', 'fixe', 'liste', 'ecrire'] },

  // ─── Boucles ────────────────────────────────────────────────────────────
  for_range: { desc: "Répète un bloc pour chaque nombre de N à M", syn: ['boucle', 'pour', 'compter', 'repeter', 'iteration'] },
  for_each_array: { desc: "Répète un bloc pour chaque élément d'un tableau", syn: ['boucle', 'chaque', 'tableau', 'parcourir', 'elements'] },
  break_loop: { desc: "Sort immédiatement de la boucle en cours", syn: ['sortir', 'arreter', 'boucle', 'interrompre', 'break'] },

  // ─── Grille ─────────────────────────────────────────────────────────────
  grid_create: { desc: "Crée une grille 2D (colonnes x lignes) de valeurs", syn: ['grille', 'creer', '2d', 'colonnes', 'lignes'] },
  grid_get: { desc: "Lit la case de la grille à une colonne et une ligne", syn: ['lire', 'case', 'grille', 'cellule', 'position'] },
  grid_set: { desc: "Écrit une valeur dans une case de la grille", syn: ['ecrire', 'case', 'grille', 'modifier', 'cellule'] },
  grid_clear: { desc: "Vide toutes les cases de la grille", syn: ['vider', 'effacer', 'grille', 'reinitialiser', 'reset'] },
  grid_sync_tiles: { desc: "Affiche le contenu de la grille sur les dalles LED", syn: ['afficher', 'grille', 'dalles', 'synchroniser', 'led'] },
  grid_check_4_in_row: { desc: "Vérifie si 4 cases identiques sont alignées dans la grille", syn: ['aligner', 'quatre', 'verifier', 'victoire', 'puissance 4'] },
};
