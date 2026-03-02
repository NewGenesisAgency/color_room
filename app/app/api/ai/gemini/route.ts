import { NextResponse } from 'next/server';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

type AiAction =
  | { type: 'create_game'; name?: string }
  | { type: 'rename_game'; gameId?: string; name: string }
  | {
      type: 'add_node';
      kind: string;
      gameId?: string;
      id?: string;
      x?: number;
      y?: number;
      name?: string;
      params?: Record<string, unknown>;
    }
  | { type: 'add_edge'; gameId?: string; from: string; to: string };

type GeminiRequest = {
  messages: ChatMessage[];
  context?: unknown;
};

function getApiKey(): string {
  const v = process.env.GEMINI_API_KEY?.trim();
  if (!v) throw new Error('MISSING_GEMINI_API_KEY');
  return v;
}

function coerceJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

async function fetchGeminiText(args: { apiKey: string; contents: any[]; temperature: number }): Promise<{ ok: true; text: string } | { ok: false; status: number; data: any }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${encodeURIComponent(args.apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: args.contents,
      generationConfig: {
        temperature: args.temperature,
        maxOutputTokens: 1024,
      },
    }),
    cache: 'no-store',
  });

  const data = (await res.json()) as any;
  if (!res.ok) return { ok: false, status: res.status, data };
  const text: string = data?.candidates?.[0]?.content?.parts?.map((p: any) => String(p?.text ?? '')).join('') ?? '';
  return { ok: true, text };
}

export async function GET() {
  const configured = Boolean(process.env.GEMINI_API_KEY?.trim());
  return NextResponse.json({
    ok: true,
    route: '/api/ai/gemini',
    configured,
    message: 'Utilise POST pour appeler Gemini (chat).',
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      allow: 'GET,POST,OPTIONS',
    },
  });
}

export async function POST(req: Request) {
  let body: GeminiRequest | null = null;
  try {
    body = (await req.json()) as GeminiRequest;
  } catch {
    return NextResponse.json({ ok: false, error: 'BAD_JSON' }, { status: 400 });
  }

  if (!body || !Array.isArray(body.messages)) {
    return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 });
  }

  let apiKey = '';
  try {
    apiKey = getApiKey();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: 'MISSING_GEMINI_API_KEY',
        message: 'Ajoute GEMINI_API_KEY dans ton .env (server-side) puis redémarre le serveur.',
      },
      { status: 500 },
    );
  }

  const system =
    "Tu es un assistant pour un éditeur de jeux type Unreal. Tu dois répondre en JSON uniquement.\n" +
    "Schéma attendu: {\"assistant_text\": string, \"actions\": AiAction[]}\n" +
    "AiAction possibles: create_game{name?}, rename_game{gameId?,name}, add_node{gameId?,id?,kind,x?,y?,name?,params?}, add_edge{gameId?,from,to}.\n" +
    "Règle importante: si le contexte ne contient AUCUN jeu (games=[]), ta première action doit être create_game (avec un nom).\n" +
    "Kinds autorisés (UNIQUEMENT): event_begin, wait, sequence, while, if, fill, pulse, tile, const_number, const_bool, const_color, math_add, math_sub, math_mul, math_div.\n" +
    "Important: pour add_node, fournis toujours un id stable (ex: n1, n2, n3...). Pour relier, add_edge doit utiliser ces ids. Tu peux aussi utiliser from:'begin' (event_begin) et from/to:'last' (dernier noeud créé).\n" +
    "Si tu n'es pas sûr, renvoie actions: [].";

  const contents = [
    {
      role: 'user',
      parts: [
        { text: system },
        { text: `CONTEXTE_EDITEUR_JSON: ${JSON.stringify(body.context ?? null)}` },
        { text: `CONVERSATION: ${JSON.stringify(body.messages)}` },
      ],
    },
  ];

  try {
    const first = await fetchGeminiText({ apiKey, contents, temperature: 0.4 });
    if (!first.ok) {
      const data = first.data;
      const apiMessage =
        typeof data?.error?.message === 'string'
          ? data.error.message
          : typeof data?.message === 'string'
            ? data.message
            : 'Erreur Gemini.';

      const hint =
        first.status === 400
          ? 'Requête invalide (prompt trop long ou format inattendu).'
          : first.status === 401 || first.status === 403
            ? 'Clé API invalide ou accès refusé (vérifie GEMINI_API_KEY).'
            : first.status === 429
              ? 'Quota dépassé / rate limit (réessaie plus tard).'
              : first.status >= 500
                ? 'Gemini est en erreur côté serveur.'
                : undefined;

      return NextResponse.json(
        {
          ok: false,
          error: 'GEMINI_HTTP_ERROR',
          status: first.status,
          message: hint ?? apiMessage,
          details: data,
        },
        { status: first.status },
      );
    }

    let text = first.text;
    let parsed = coerceJsonObject(text);

    // Si Gemini répond en texte libre, on fait une 2e tentative avec une instruction de format strict.
    if (!parsed) {
      const fixSystem =
        system +
        "\n\nIMPORTANT: tu as répondu hors format. Réponds à nouveau avec UN SEUL objet JSON valide, sans markdown, sans backticks, sans texte hors JSON.";

      const fixedContents = [
        {
          role: 'user',
          parts: [
            { text: fixSystem },
            { text: `CONTEXTE_EDITEUR_JSON: ${JSON.stringify(body.context ?? null)}` },
            { text: `CONVERSATION: ${JSON.stringify(body.messages)}` },
          ],
        },
      ];

      const second = await fetchGeminiText({ apiKey, contents: fixedContents, temperature: 0.2 });
      if (second.ok) {
        text = second.text;
        parsed = coerceJsonObject(text);
      }
    }

    const assistantText = (parsed as any)?.assistant_text;
    const actions = (parsed as any)?.actions;

    return NextResponse.json({
      ok: true,
      raw: text,
      assistant_text: typeof assistantText === 'string' ? assistantText : text,
      actions: Array.isArray(actions) ? (actions as AiAction[]) : [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    return NextResponse.json(
      {
        ok: false,
        error: 'GEMINI_FETCH_ERROR',
        message: `${message} (réseau/proxy/firewall possible : accès à generativelanguage.googleapis.com)` ,
      },
      { status: 502 },
    );
  }
}
