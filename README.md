# pi-calm

A fork of the **Calm** extension for the [Pi](https://github.com/earendil-works/pi) coding agent, taken from [`kunchenguid/dotfiles`](https://github.com/kunchenguid/dotfiles) (Copyright (c) 2026 Kun Chen, MIT License).

## Concept

Calm is a presentation toggle for Pi's transcript: the `/calm` command hides collapsed thinking blocks and built-in tool-call shells, and replaces the stock "working" row with a small animation.
It only affects presentation: input, tool execution, model context, session storage and export data are never touched, and `/export` and `/share` still render the complete transcript.
Each presentation adapter probes the exact Pi API it patches, so if a future Pi release removes one, only that adapter degrades instead of the whole extension.

## Original repository

https://github.com/kunchenguid/dotfiles/tree/main/home/.pi/agent/extensions/calm
