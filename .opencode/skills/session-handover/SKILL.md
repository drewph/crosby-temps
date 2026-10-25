---
name: Session handover
description: Update docs/HANDOVER.md when the user wraps up, hands over, or ends a session; keep it accurate, concise and sanitized.
---

## Use when

- The user says "wrap up", "handover", "end of session", or asks what a new chat needs to know.
- A PR has merged, a decision was made, or context is nearly full.

## Procedure

1. Read `docs/HANDOVER.md`, `git status --short`, and the recent commits or merged PRs.
2. Update:
   - **Last updated** to today's date (Europe/London).
   - **Live**: what is deployed, test count, snapshot coverage.
   - **Open items**: move shipped work out, add new work, keep at most seven, ordered.
   - **Decisions**: durable choices with a one-line reason; do not log transient details.
   - **Recent**: append two to four bullets with PR numbers or commit hashes.
3. Run `git diff -- docs/HANDOVER.md` and remove secrets, tokens, personal data, absolute paths, session IDs, and speculation.
4. Do not commit unless asked.
5. Reply with what changed and the next open item.
