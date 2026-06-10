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
  type LucideIcon,
} from 'lucide-react';

/** Icônes lucide-react disponibles comme avatar de profil (nom → composant). */
export const AVATAR_ICONS: Record<string, LucideIcon> = {
  User, Star, Heart, Zap, Sun, Moon, Rocket, Crown,
  Ghost, Smile, Music, Sparkles, Cat, Flower2, Gamepad2, Palette,
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
