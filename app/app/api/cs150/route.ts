import { NextRequest, NextResponse } from 'next/server';
import { cs160Bridge } from './bridge';

// CS-160 Colorimeter API
// Communicates with Konica Minolta CS-160 via HTTP REST API
// API Documentation:
// - POST /api/connect - Connect the colorimeter
// - POST /api/disconnect - Disconnect the colorimeter  
// - POST /api/measure - Launch measurement (returns XYZ and Lv/x/y)
// - GET /api/samples - Get stored sample data
// - GET /api/health - Health check

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'status':
        const statusResult = await cs160Bridge.health();
        return NextResponse.json(statusResult);

      case 'samples':
        const samplesResult = await cs160Bridge.getSamples();
        return NextResponse.json(samplesResult);

      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'connect':
        return NextResponse.json(await cs160Bridge.connect());

      case 'disconnect':
        return NextResponse.json(await cs160Bridge.disconnect());

      case 'measure':
        return NextResponse.json(await cs160Bridge.measure());

      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
