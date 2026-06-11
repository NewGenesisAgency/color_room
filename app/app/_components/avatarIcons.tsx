/**
 * @file app/_components/avatarIcons.tsx
 * @brief Catalogue d'icônes lucide-react utilisables comme avatar de profil.
 *
 * Expose la table {@link AVATAR_ICONS} (nom → composant d'icône), la liste des
 * noms disponibles {@link AVATAR_ICON_NAMES}, et le composant {@link AvatarIcon}
 * qui rend l'icône correspondant à un nom (avec repli sur `User` si le nom est
 * absent ou inconnu). Utilisé partout où un avatar de joueur/utilisateur est affiché.
 */

import {
  User, Star, Heart, Zap, Sun, Moon, Rocket, Crown,
  Ghost, Smile, Music, Sparkles, Cat, Flower2, Gamepad2, Palette,
  Dog, Bird, Fish, Squirrel, Bug, Atom, Brain, Flame,
  Snowflake, Cloud, Droplet, Leaf, Gem, Trophy, Target, Wand2,
  Rainbow, Bot, Skull, Dice5, Anchor, Bell, Camera, Compass,
  type LucideIcon,
} from 'lucide-react';

/** Icônes lucide-react disponibles comme avatar de profil (nom → composant). */
export const AVATAR_ICONS: Record<string, LucideIcon> = {
  User, Star, Heart, Zap, Sun, Moon, Rocket, Crown,
  Ghost, Smile, Music, Sparkles, Cat, Flower2, Gamepad2, Palette,
  Dog, Bird, Fish, Squirrel, Bug, Atom, Brain, Flame,
  Snowflake, Cloud, Droplet, Leaf, Gem, Trophy, Target, Wand2,
  Rainbow, Bot, Skull, Dice5, Anchor, Bell, Camera, Compass,
};

/** Liste des noms d'avatars disponibles (clés de {@link AVATAR_ICONS}). */
export const AVATAR_ICON_NAMES = Object.keys(AVATAR_ICONS);

/**
 * Rend l'icône d'avatar correspondant à un nom.
 *
 * @param name Nom de l'icône (clé de {@link AVATAR_ICONS}) ; repli sur `User` si absent/inconnu.
 * @param size Taille de l'icône en pixels (défaut : 18).
 * @param color Couleur de l'icône (défaut : '#fff').
 * @returns Le composant d'icône lucide correspondant.
 */
export function AvatarIcon({
  name,
  size = 18,
  color = '#fff',
}: {
  name?: string | null;
  size?: number;
  color?: string;
}) {
  const Ico = (name && AVATAR_ICONS[name]) || User;
  return <Ico size={size} color={color} />;
}

/**
 * Avatar stylé : pastille ronde en dégradé (couleur du profil) avec l'icône
 * lucide au centre, un reflet "glass" et un anneau lumineux subtil.
 *
 * @param icon  Nom de l'icône lucide (repli sur `User`).
 * @param color Couleur de base du dégradé (défaut bleu indigo).
 * @param size  Diamètre de la pastille en pixels (défaut 40).
 * @param ring  Affiche un anneau clair autour (défaut true).
 */
export function Avatar({
  icon,
  color = '#4361ee',
  size = 40,
  ring = true,
}: {
  icon?: string | null;
  color?: string;
  size?: number;
  ring?: boolean;
}) {
  // Dégradé diagonal : couleur du profil -> variante plus claire/violacée.
  const grad = `linear-gradient(135deg, ${color} 0%, ${mix(color, '#a855f7', 0.45)} 100%)`;
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-grid',
        placeItems: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        background: grad,
        boxShadow: ring
          ? `0 4px 14px ${color}55, inset 0 1px 0 rgba(255,255,255,0.55), 0 0 0 2px rgba(255,255,255,0.85)`
          : `0 3px 10px ${color}44, inset 0 1px 0 rgba(255,255,255,0.5)`,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Reflet glass diagonal en haut */}
      <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(150deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 48%)', pointerEvents: 'none' }} />
      <AvatarIcon name={icon} size={Math.round(size * 0.5)} color="#fff" />
    </span>
  );
}

/** Mélange deux couleurs hex (#rrggbb) selon un ratio 0..1 (t=0 -> a, t=1 -> b). */
function mix(a: string, b: string, t: number): string {
  const pa = hex(a), pb = hex(b);
  const c = (i: number) => Math.round(pa[i] + (pb[i] - pa[i]) * t);
  return `rgb(${c(0)}, ${c(1)}, ${c(2)})`;
}

function hex(s: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(s.trim());
  if (!m) return [67, 97, 238];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
