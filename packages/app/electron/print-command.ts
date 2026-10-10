// FIX (revue sécurité, Finding 1 CRITICAL) — construction SÛRE de la commande
// d'impression PowerShell.
//
// `powershell.exe -Command <argv…>` RE-CONCATÉNE les éléments du tableau en une
// seule chaîne de SCRIPT que PowerShell relit et interprète : un chemin de
// dossier NTFS-légal contenant `$(…)`, des backticks, etc. (le nom du PDF
// dérive du projectName) devient de l'exécution arbitraire dès que l'utilisateur
// clique « Imprimer ». Passer le chemin en ARGUMENT DE TABLEAU à execFile ne
// protège PAS : la protection s'arrête à la frontière du processus, pas dans
// l'espace de script de PowerShell.
//
// Parade : `-EncodedCommand`. PowerShell accepte un UNIQUE token argv — le
// script complet, encodé en base64 d'UTF-16LE. Aucune recaténation/shell n'a
// lieu : le chemin n'atteint JAMAIS l'espace de script en clair. Le script est
// construit ICI avec la sémantique des littéraux PowerShell à guillemets
// simples (tout est littéral, seule l'apostrophe s'échappe en `''`), donc même
// `$(…)`, backticks, accents et espaces restent des données inertes.
//
// Module PUR, AUCUN import Electron : testable sous vitest (packages/app/test).
import { Buffer } from 'node:buffer';

const PRINT_SCRIPT_PREFIX = 'Start-Process -FilePath ';
const PRINT_SCRIPT_SUFFIX = ' -Verb Print';

/**
 * Construit le tableau d'arguments `execFile('powershell.exe', …)` pour
 * imprimer `pdfPath` via `Start-Process -Verb Print`, en sécurisant le chemin
 * contre l'injection dans l'espace de script PowerShell (`-EncodedCommand`).
 *
 * @param pdfPath chemin du PDF (déjà validé côté appelant : `.pdf` + existence)
 * @returns exactement `['-NoProfile', '-EncodedCommand', <base64 utf16le>]`
 */
export function buildPrintCommand(pdfPath: string): string[] {
  // Sémantique littérale PowerShell : entre guillemets simples, RIEN n'est
  // interpolé ; la seule échappement requis est l'apostrophe doublée.
  const escaped = pdfPath.replace(/'/g, "''");
  const script = `${PRINT_SCRIPT_PREFIX}'${escaped}'${PRINT_SCRIPT_SUFFIX}`;
  // -EncodedCommand exige UN seul token argv : base64(UTF-16LE), insensible au
  // shell et à la relecture de script.
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return ['-NoProfile', '-EncodedCommand', encoded];
}
