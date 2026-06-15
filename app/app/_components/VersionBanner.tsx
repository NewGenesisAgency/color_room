'use client';

/**
 * @file app/_components/VersionBanner.tsx
 * @brief Affiche un bandeau de version dans la console du navigateur.
 *
 * Logue, une seule fois au montage, le numéro de version de l'application et la
 * date/heure de la dernière mise à jour. Pratique pour vérifier d'un coup d'œil
 * (F12 → Console) si un poste utilise bien la dernière version déployée.
 */

import { useEffect } from 'react';

/** Version courante de l'application ColorRoom. */
export const APP_VERSION = '3.9';
/** Date et heure de la dernière version (mise à jour à chaque release). */
export const APP_BUILD_DATE = '15/06/2026 11:43 (CEST)';

export default function VersionBanner() {
  useEffect(() => {
    // Bandeau stylé dans la console (une seule fois au chargement).
    console.log(
      `%c ColorRoom %c v${APP_VERSION} %c ${APP_BUILD_DATE} `,
      'background:#7c3aed;color:#fff;font-weight:800;border-radius:6px 0 0 6px;padding:3px 8px;',
      'background:#a855f7;color:#fff;font-weight:800;padding:3px 8px;',
      'background:#0f172a;color:#06d6a0;font-weight:700;border-radius:0 6px 6px 0;padding:3px 8px;',
    );
  }, []);

  return null;
}
