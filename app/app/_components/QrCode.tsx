'use client';

/**
 * @file app/_components/QrCode.tsx
 * @brief QR code 100 % offline rendu en SVG côté client.
 *
 * Encapsule `QRCodeSVG` (qrcode.react) pour afficher un QR code sans aucune
 * requête réseau, avec une légende optionnelle. Sert typiquement à encoder une URL
 * sur le réseau local (Raspberry Pi) afin qu'un téléphone du même Wi-Fi puisse
 * rejoindre une classe ou une partie. Props : `value` (contenu encodé), `size`,
 * `caption`, `fgColor`, `bgColor`.
 */

import { QRCodeSVG } from 'qrcode.react';

interface Props {
  /** Valeur encodée dans le QR code (URL idéalement). */
  value: string;
  /** Taille en px du QR (carré). */
  size?: number;
  /** Texte affiché sous le QR (ex. le code de la classe). */
  caption?: string;
  /** Couleur des modules. */
  fgColor?: string;
  /** Couleur de fond. */
  bgColor?: string;
}

/**
 * QR code 100 % offline (rendu SVG côté client, aucune requête réseau).
 * Encode généralement une URL sur le réseau local (Raspberry Pi) afin
 * qu'un téléphone du même Wi-Fi puisse rejoindre une classe ou une partie.
 */
export default function QrCode({
  value,
  size = 150,
  caption,
  fgColor = '#1a1a2e',
  bgColor = '#ffffff',
}: Props) {
  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        background: bgColor,
        borderRadius: 14,
        border: '1px solid rgba(0,0,0,0.12)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      }}
    >
      <QRCodeSVG value={value} size={size} level="M" marginSize={2} fgColor={fgColor} bgColor={bgColor} />
      {caption && (
        <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.55)', fontWeight: 700, letterSpacing: '0.04em' }}>
          {caption}
        </span>
      )}
    </div>
  );
}
