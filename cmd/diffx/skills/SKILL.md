---
name: diffx
description: Launch Diffx interactive review, receive annotation feedback via stdout, and continue implementation in the same thread.
allowed-tools: Bash(diffx:*)
---

# Diffx Review

Use this skill when the user wants interactive annotation-based code review with Diffx and expects feedback to return into the current thread.

## Workflow

1. Run `diffx review` with any explicit arguments provided by the user.
2. Wait for the UI review to be submitted via "Send to agent".
3. Read stdout from the command. Diffx exits after feedback is submitted.
4. Route by user intent:
   - If the user is asking a question or asking why something changed, answer directly and do not edit files.
   - Only make code edits when the user explicitly asks for an edit or implementation.
5. If the user explicitly asked for edits and stdout includes requested fixes, implement them now.
6. If stdout says no changes were requested, acknowledge and continue.

## Notes

- Diffx review mode is one-shot: after feedback submission, the process exits.
- Treat returned review feedback as blocking only when the user explicitly asked for edits.
