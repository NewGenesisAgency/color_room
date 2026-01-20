import fs from 'node:fs/promises';
import path from 'node:path';

import { defaultFlow } from './defaultFlow';
import type { FlowDocument } from './types';

/**
 * @file Stockage des flows.
 * @brief Stockage V1 en fichier JSON.
 * @details Objectif: simple et robuste pour démarrer. Ensuite on migrera vers SQLite.
 */

function flowFilePath(): string {
  return path.join(process.cwd(), 'data', 'flows.json');
}

export async function loadFlow(): Promise<FlowDocument> {
  try {
    const raw = await fs.readFile(flowFilePath(), 'utf-8');
    return JSON.parse(raw) as FlowDocument;
  } catch {
    return defaultFlow();
  }
}

export async function saveFlow(flow: FlowDocument): Promise<void> {
  const file = flowFilePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(flow, null, 2), 'utf-8');
}
