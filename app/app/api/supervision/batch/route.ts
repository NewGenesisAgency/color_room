import { NextResponse } from 'next/server';

const DEFAULT_BASE_URL = 'http://172.17.50.136:18080';
const DEFAULT_TIMEOUT_MS = 3000;
const GAME_TIMEOUT_MS = 500; // Fast timeout for game lighting

function getBaseUrl(): string {
  const v = process.env.SUPERVISION_API_URL?.trim();
  return v && v.length > 0 ? v.replace(/\/$/, '') : DEFAULT_BASE_URL;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { plateId, channels, plates, fast } = body;

    // Support for multi-plate batch updates (for animateAllPlates)
    if (plates && Array.isArray(plates)) {
      const timeoutMs = fast ? GAME_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
      const baseUrl = getBaseUrl();
      
      // Send all plate updates in parallel
      const platePromises = plates.map(async (plate: { plateId: number; channels: { index: number; value: number }[] }) => {
        const channelPromises = plate.channels.map(async (ch: { index: number; value: number }) => {
          const url = `${baseUrl}/state/plaque/${plate.plateId}/canal/${ch.index}/${ch.value}`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), timeoutMs);

          try {
            const res = await fetch(url, {
              method: 'PUT',
              cache: 'no-store',
              signal: controller.signal,
            });
            return { channel: ch.index, ok: res.ok };
          } catch {
            return { channel: ch.index, ok: false };
          } finally {
            clearTimeout(timeout);
          }
        });

        const settled = await Promise.allSettled(channelPromises);
        const results = settled.map((r, i) => 
          r.status === 'fulfilled' ? r.value : { channel: plate.channels[i]?.index ?? i, ok: false }
        );
        
        return {
          plateId: plate.plateId,
          ok: results.every((r) => r.ok),
          updatedChannels: results.filter((r) => r.ok).length,
        };
      });

      const plateResults = await Promise.allSettled(platePromises);
      const allOk = plateResults.every((r) => r.status === 'fulfilled' && r.value.ok);

      return NextResponse.json({
        ok: allOk,
        plates: plateResults.map((r) => r.status === 'fulfilled' ? r.value : { ok: false }),
      });
    }

    // Single plate batch update (original behavior)
    if (!plateId || !Array.isArray(channels)) {
      return NextResponse.json(
        { ok: false, error: 'MISSING_PARAMS', message: 'plateId and channels array required' },
        { status: 400 }
      );
    }

    const timeoutMs = fast ? GAME_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
    const baseUrl = getBaseUrl();
    const results: { channel: number; ok: boolean }[] = [];

    // Send all channel updates in parallel for maximum speed
    const promises = channels.map(async (ch: { index: number; value: number }) => {
      const url = `${baseUrl}/state/plaque/${plateId}/canal/${ch.index}/${ch.value}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(url, {
          method: 'PUT',
          cache: 'no-store',
          signal: controller.signal,
        });
        return { channel: ch.index, ok: res.ok };
      } catch {
        return { channel: ch.index, ok: false };
      } finally {
        clearTimeout(timeout);
      }
    });

    const settled = await Promise.allSettled(promises);
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        results.push(r.value);
      } else {
        results.push({ channel: channels[i]?.index ?? i, ok: false });
      }
    });

    const allOk = results.every((r) => r.ok);

    return NextResponse.json({
      ok: allOk,
      plateId,
      updatedChannels: results.filter((r) => r.ok).length,
      totalChannels: channels.length,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
