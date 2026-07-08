import type { AISurfaceDefinition, AISurfaceSnapshot } from '../types/aiSurface';

const surfaces = new Map<string, AISurfaceDefinition>();

export function registerAISurface(def: AISurfaceDefinition): void {
  surfaces.set(def.id, def);
}

export function unregisterAISurface(id: string): void {
  surfaces.delete(id);
}

export function getAISurface(id: string): AISurfaceDefinition | undefined {
  return surfaces.get(id);
}

export function getAllAISurfaces(): AISurfaceDefinition[] {
  return Array.from(surfaces.values());
}

export async function readAllAISurfaces(): Promise<AISurfaceSnapshot[]> {
  const defs = getAllAISurfaces();
  const snapshots = await Promise.all(
    defs.map(async (def) => ({
      id: def.id,
      domain: def.domain,
      label: def.label,
      data: await def.read(),
    })),
  );
  return snapshots;
}
