import { NextResponse } from 'next/server';

type GeminiRequestBody = {
  prompt: string;
  flow?: unknown;
};

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY manquante. Configure-la dans les variables d\'environnement.' },
      { status: 500 },
    );
  }

  const body = (await req.json()) as GeminiRequestBody;
  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: 'Prompt vide' }, { status: 400 });
  }

  const system =
    "Tu es un assistant pour l'application Color Room. Réponds en français. " +
    "Quand c'est pertinent, propose des modifications du flow sous forme d'un bloc ```json``` contenant { nodes, edges }.";

  const user =
    `Demande utilisateur:\n${prompt}\n\n` +
    `Flow courant (JSON):\n${JSON.stringify(body.flow ?? {}, null, 2)}\n`;

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent' +
    `?key=${encodeURIComponent(apiKey)}`;

  const geminiRes = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [
        { role: 'user', parts: [{ text: system }] },
        { role: 'user', parts: [{ text: user }] },
      ],
      generationConfig: {
        temperature: 0.4,
      },
    }),
  });

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    return NextResponse.json(
      { error: 'Erreur Gemini', details: errText },
      { status: 502 },
    );
  }

  const data = (await geminiRes.json()) as any;
  const text: string =
    data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ??
    '';

  return NextResponse.json({ text });
}
