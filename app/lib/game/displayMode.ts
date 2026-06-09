/**
 * @file Mode d'affichage des jeux.
 *
 * SHOW_SCREEN_BOARD = false : le plateau de jeu n'est PAS dupliqué à l'écran
 * (tablette / PC). Les jeux de type grille (Snake, Tetris, Puissance 4…) se
 * jouent en regardant les DALLES de la Color Room ; l'écran ne montre que le
 * score et les contrôles. Mettre `true` pour réafficher le plateau à l'écran
 * (utile en développement sans matériel).
 */
export const SHOW_SCREEN_BOARD = false;
