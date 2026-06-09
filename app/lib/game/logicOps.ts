/**
 * @file Opérations logiques / mathématiques partagées par les deux runtimes
 * (aperçu de l'éditeur et exécution réelle dans /jeux).
 *
 * Modèle : chaque bloc lit des opérandes (variable nommée OU nombre littéral)
 * et écrit le résultat dans une variable de sortie (`out`). Cela rend
 * fonctionnels les blocs jusqu'ici « morts » (defaults vides) sans système de
 * ports dataflow.
 */

export const LOGIC_OP_KINDS: ReadonlySet<string> = new Set([
  'const_number', 'const_bool', 'const_color',
  'math_add', 'math_sub', 'math_mul', 'math_div', 'math_mod', 'math_min', 'math_max', 'math_pow',
  'math_floor', 'math_ceil', 'math_round', 'math_abs', 'math_sqrt', 'math_clamp01', 'math_lerp',
  'compare_eq', 'compare_gt', 'compare_lt', 'logic_and', 'logic_or', 'logic_not',
  'time_seconds', 'random_01',
]);

/** Catégorie de schéma de paramètres, pour adapter l'inspecteur. */
export function logicOpShape(kind: string): 'const_num' | 'const_bool' | 'const_color' | 'unary' | 'lerp' | 'binary' | 'nullary' {
  if (kind === 'const_number') return 'const_num';
  if (kind === 'const_bool') return 'const_bool';
  if (kind === 'const_color') return 'const_color';
  if (kind === 'time_seconds' || kind === 'random_01') return 'nullary';
  if (kind === 'math_lerp') return 'lerp';
  if (['math_floor', 'math_ceil', 'math_round', 'math_abs', 'math_sqrt', 'math_clamp01', 'logic_not'].includes(kind)) return 'unary';
  return 'binary';
}

// Résout un opérande : nombre littéral si la chaîne est numérique, sinon valeur de variable.
function operand(raw: unknown, getNum: (name: string) => number): number {
  if (typeof raw === 'number') return raw;
  const s = String(raw ?? '').trim();
  if (s === '') return 0;
  if (/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return Number(s); // littéral
  return getNum(s); // variable
}

/**
 * Exécute une opération logique/maths. Écrit le résultat dans la variable `out`.
 * @param tSeconds secondes écoulées depuis le démarrage (pour time_seconds).
 */
export function applyLogicOp(
  kind: string,
  params: Record<string, unknown>,
  getNum: (name: string) => number,
  setVar: (name: string, value: number | string) => void,
  tSeconds: number,
): void {
  const out = String(params.out ?? params.outVar ?? 'result');
  const a = () => operand(params.a, getNum);
  const b = () => operand(params.b, getNum);
  let v: number | string;
  switch (kind) {
    case 'const_number': v = Number(params.value ?? 0); break;
    case 'const_bool': v = (params.value === true || params.value === 'true' || Number(params.value) === 1) ? 1 : 0; break;
    case 'const_color': setVar(out, String(params.value ?? '#ffffff')); return;
    case 'math_add': v = a() + b(); break;
    case 'math_sub': v = a() - b(); break;
    case 'math_mul': v = a() * b(); break;
    case 'math_div': { const d = b(); v = d !== 0 ? a() / d : 0; break; }
    case 'math_mod': { const d = b(); v = d !== 0 ? a() % d : 0; break; }
    case 'math_min': v = Math.min(a(), b()); break;
    case 'math_max': v = Math.max(a(), b()); break;
    case 'math_pow': v = Math.pow(a(), b()); break;
    case 'math_floor': v = Math.floor(a()); break;
    case 'math_ceil': v = Math.ceil(a()); break;
    case 'math_round': v = Math.round(a()); break;
    case 'math_abs': v = Math.abs(a()); break;
    case 'math_sqrt': v = Math.sqrt(Math.max(0, a())); break;
    case 'math_clamp01': v = Math.max(0, Math.min(1, a())); break;
    case 'math_lerp': { const t = operand(params.t, getNum); v = a() + (b() - a()) * t; break; }
    case 'compare_eq': v = a() === b() ? 1 : 0; break;
    case 'compare_gt': v = a() > b() ? 1 : 0; break;
    case 'compare_lt': v = a() < b() ? 1 : 0; break;
    case 'logic_and': v = (a() && b()) ? 1 : 0; break;
    case 'logic_or': v = (a() || b()) ? 1 : 0; break;
    case 'logic_not': v = a() ? 0 : 1; break;
    case 'time_seconds': v = Math.round(tSeconds * 100) / 100; break;
    case 'random_01': v = Math.random(); break;
    default: return;
  }
  setVar(out, v);
}
