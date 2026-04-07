// ─── Power-Up Configuration ───
// Powers have flat params; no levels. Improvement comes from modifiers.

export type PowerCategory = 'activePower' | 'passivePower' | 'passive';

export interface PowerUpDefinition {
  id: string;
  name: string;
  element: string;
  category: PowerCategory;
  needsTarget?: boolean;
  requires?: string;
  description: string;
  params: Record<string, number>;
}

// ─── Registry ───

const registry: PowerUpDefinition[] = [];

export function registerPowerUps(defs: PowerUpDefinition[]): void {
  for (const def of defs) {
    registry.push(def);
  }
}

export function getAllPowerUps(): PowerUpDefinition[] {
  return [...registry];
}

export function getPowerUpDef(id: string): PowerUpDefinition | undefined {
  return registry.find(p => p.id === id);
}

export function getPowerUpsByElement(element: string): PowerUpDefinition[] {
  return registry.filter(p => p.element === element);
}

export function getPowerUpsByCategory(category: PowerCategory): PowerUpDefinition[] {
  return registry.filter(p => p.category === category);
}
