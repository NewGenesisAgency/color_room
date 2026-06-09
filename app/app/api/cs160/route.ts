import { NextRequest, NextResponse } from 'next/server';
import { cs160Bridge } from './bridge';

export async function GET(req: NextRequest) {
  const action = new URL(req.url).searchParams.get('action');
  try {
    switch (action) {
      case 'status': {
        const r = await cs160Bridge.health();
        // Health response: { nodeApi, bridge: { connected, status, device, port } }
        const bridge = r.data?.bridge;
        const connected = r.success && (bridge?.connected === true);
        return NextResponse.json({
          success: r.success,
          connected,
          device: bridge?.device ?? r.data?.device,
          port:   bridge?.port,
          error:  r.error,
        });
      }
      case 'samples':
        return NextResponse.json(await cs160Bridge.getSamples());
      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json();
    switch (action) {
      case 'connect':    return NextResponse.json(await cs160Bridge.connect());
      case 'disconnect': return NextResponse.json(await cs160Bridge.disconnect());
      case 'measure': {
        let r = await cs160Bridge.measure();
        if (!r.success) {
          // Auto-connexion : contrairement à /mesure (bouton « Connecter »), les
          // jeux mesurent directement. Si l'appareil n'est pas ouvert, on le
          // connecte puis on réessaie une fois.
          await cs160Bridge.connect();
          r = await cs160Bridge.measure();
        }
        if (!r.success) return NextResponse.json(r);
        // Measure response is direct: { timestamp, xyz, lvxy }
        // Normalise into { success, data: { timestamp, xyz, lvxy } }
        const d = r.data;
        const normalised = d?.data ?? d; // handle both wrapped and unwrapped
        return NextResponse.json({ success: true, data: normalised });
      }
      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
