## What does this PR do?

<!-- 1–3 sentences: the change and why it exists. Link the issue if any. -->

## Type of change

- [ ] Bug fix
- [ ] Feature
- [ ] Refactor / internal quality
- [ ] Documentation / packaging / release chore

## Checklist (all gates must be green)

- [ ] `npm test` — core unit tests pass (report the count)
- [ ] `npm run typecheck` — clean
- [ ] `npm run lint` — clean (Biome)
- [ ] `npm -w @repowiki-pdf/app run build:renderer` — builds
- [ ] `npm -w @repowiki-pdf/app run test:window` — `SMOKE OK window loaded`
- [ ] `npm -w @repowiki-pdf/app run test:integration` — all 12 checks pass
- [ ] UI change? Screenshots before/after attached (EN and 中文 if strings touched)
- [ ] Behavior/decision change? Release notes / changelog updated (+ ADR if architectural)
- [ ] User-visible strings localized in **both** `renderer/i18n/en.ts` and `zh.ts`
- [ ] No secrets, no client wiki content, no large binaries committed

## Notes for the reviewer

<!-- Known trade-offs, follow-up ideas, things you deliberately did not do. -->
