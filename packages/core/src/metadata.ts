import fs from 'node:fs/promises';

/**
 * Les versions récentes de Qoder n'écrivent plus `wiki_plan.yaml` mais un
 * `<lang>/meta/repowiki-metadata.json` dont `wiki_catalogs` est la liste des
 * pages du wiki dans l'ordre de création interne Qoder (champ `name` = titre
 * de page ; la hiérarchie y est chiffrée — non exploitable, voir ADR-0007).
 * On n'en extrait QUE la liste ordonnée des titres ; toute erreur (fichier
 * absent, JSON invalide, forme inattendue) retourne null → fallback ordre
 * des fichiers, conformément à la spec §6 (« plan illisible → fallback »).
 */
interface RawMetaShape {
  wiki_catalogs?: unknown;
}

const nameOf = (entry: unknown): string | null => {
  if (typeof entry !== 'object' || entry === null) return null;
  const name: unknown = (entry as { name?: unknown }).name;
  return typeof name === 'string' ? name : null;
};

export async function parseWikiMeta(
  metaPath: string | null,
): Promise<{ titles: string[] } | null> {
  if (!metaPath) return null;
  try {
    const raw = JSON.parse(
      await fs.readFile(metaPath, 'utf8'),
    ) as RawMetaShape | null;
    const catalogs = raw?.wiki_catalogs;
    if (!Array.isArray(catalogs)) return null;
    const titles = catalogs.map(nameOf).filter((t): t is string => t !== null);
    return { titles };
  } catch {
    return null;
  }
}
