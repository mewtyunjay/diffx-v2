---
description: Open interactive Diffx review and send annotations back to this chat
argument-hint: [optional diffx review args]
allowed-tools: Bash(diffx:*)
---

## Diffx Review

!`diffx review $ARGUMENTS`

## Your task

If the user is asking a question or asking why something changed, answer directly and do not edit files.
Only make code edits when the user explicitly asks for an edit or implementation.
If the user explicitly asks for edits and the review output above contains requested changes, address them in this session.
