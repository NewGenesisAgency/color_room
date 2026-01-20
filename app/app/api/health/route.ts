import { NextResponse } from 'next/server';

/**
 * @file Route santé.
 * @brief Permet au Docker healthcheck de vérifier que le serveur répond.
 */

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
