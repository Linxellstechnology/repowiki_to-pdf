import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { buildPrintCommand } from '../electron/print-command.js';

// Chemin « méchant » NTFS-légal : substitution `$(…)`, backticks, apostrophe
// (échapée `''`), espace et accents. Le nom du PDF dérive du projectName, donc
// ce genre de chemin est réaliste. En `-Command` il deviendrait de l'exécution
// PowerShell arbitraire ; en `-EncodedCommand` il doit rester de la DATA.
const NASTY = "C:\\Projets\\$(evil) `tick` l'équipe café.pdf";

// Le script PowerShell attendu, construit À LA MAIN (indépendant de
// l'implémentation) avec la sémantique des littéraux à guillemets simples :
// apostrophe doublée, tout le reste littéral.
const NASTY_SCRIPT =
  "Start-Process -FilePath 'C:\\Projets\\$(evil) `tick` l''équipe café.pdf' -Verb Print";

function decode(argv: string[]): string {
  const encoded = argv[2] ?? '';
  return Buffer.from(encoded, 'base64').toString('utf16le');
}

describe('buildPrintCommand', () => {
  it('retourne exactement [NoProfile, -EncodedCommand, base64] pour un chemin simple', () => {
    const argv = buildPrintCommand('/tmp/rapport.pdf');
    expect(argv).toHaveLength(3);
    expect(argv[0]).toBe('-NoProfile');
    expect(argv[1]).toBe('-EncodedCommand');
    expect(decode(argv)).toBe(
      "Start-Process -FilePath '/tmp/rapport.pdf' -Verb Print",
    );
  });

  it('borne le chemin méchant à exactement trois tokens argv', () => {
    const argv = buildPrintCommand(NASTY);
    expect(argv).toHaveLength(3);
    expect(argv[0]).toBe('-NoProfile');
    expect(argv[1]).toBe('-EncodedCommand');
  });

  it('décode le base64 UTF-16LE en littéral PowerShell à apostrophes doublées', () => {
    const argv = buildPrintCommand(NASTY);
    expect(decode(argv)).toBe(NASTY_SCRIPT);
  });

  it("n'expose JAMAIS le chemin brut en clair dans un token argv", () => {
    const argv = buildPrintCommand(NASTY);
    expect(argv).not.toContain(NASTY);
    for (const token of argv) {
      expect(token).not.toContain(NASTY);
      // ni l'injection, ni le nom dérivé ne fuient en clair :
      expect(token).not.toContain('$(evil)');
      expect(token).not.toContain('café');
    }
  });
});
