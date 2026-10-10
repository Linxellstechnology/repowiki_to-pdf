# Security Policy

RepoWiki to PDF is a **private commercial application** distributed to clients of
Hello Dati. This policy explains how to report a security concern.

## Reporting a vulnerability

Please report suspected security issues **privately by email**:

> **contact@hellodati.com**

Include:

- a description of the issue and the affected version (Help → About, e.g. v0.1.7),
- steps or a minimal repro,
- the potential impact you see.

You will get an acknowledgement within a few business days and, for valid
reports, a remediation plan and timeline.

## What we expect from reporters

Because this is a commercial product, we ask that you:

- **do not post vulnerabilities, exploits or repro material in public issues,
  PRs or discussions** — give us the chance to fix first;
- do not test against installations or wikis you are not allowed to touch;
- allow a reasonable coordination window before any public disclosure.

## What the app already guarantees

- **100% offline** — no network calls, no telemetry, no update pings; your wiki
  never leaves your machine.
- **Contained rendering** — Mermaid runs in an isolated offscreen window with no
  IPC bridge, and the preview iframe is fully `sandbox=""` (decision recorded as
  ADR-0005, available on request).
- **Input safety** — decoded file content is guarded against malformed encodings
  and non-string structures rather than trusted.

## Scope note

Generated Repo Wiki content (Markdown authored inside Qoder) is user input. If a
crafted wiki can make the app write files outside the chosen output folder,
render hidden executable content, or escape the sandbox — that is a bug we want
to hear about, by email.
