import {
  User, Star, Heart, Zap, Sun, Moon, Rocket, Crown,
  Ghost, Smile, Music, Sparkles, Cat, Flower2, Gamepad2, Palette,
  type LucideIcon,
} from 'lucide-react';

// Icônes lucide-react disponibles comme avatar de profil.
export const AVATAR_ICONS: Record<string, LucideIcon> = {
  User, Star, Heart, Zap, Sun, Moon, Rocket, Crown,
  Ghost, Smile, Music, Sparkles, Cat, Flower2, Gamepad2, Palette,
};

export const AVATAR_ICON_NAMES = Object.keys(AVATAR_ICONS);

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
