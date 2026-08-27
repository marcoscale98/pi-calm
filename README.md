# pi-calm

Fork dell'estensione **Calm** per l'agente di coding [Pi](https://github.com/earendil-works/pi), presa da [`kunchenguid/dotfiles`](https://github.com/kunchenguid/dotfiles) (Copyright (c) 2026 Kun Chen, licenza MIT).

## Concetto

Calm è un interruttore di presentazione per il transcript di Pi: il comando `/calm` nasconde i blocchi di thinking collassati e i gusci delle tool call built-in, sostituendo la riga "working" con una piccola animazione.
Agisce **solo** sulla presentazione: non tocca input, esecuzione dei tool, contesto del modello, dati di sessione o export, e `/export` e `/share` continuano a produrre il transcript completo.
Ogni adapter di presentazione verifica la specifica API di Pi che modifica, quindi se una versione futura la rimuove degrada solo quella parte, non l'intera estensione.

## Repository originale

https://github.com/kunchenguid/dotfiles/tree/main/home/.pi/agent/extensions/calm
