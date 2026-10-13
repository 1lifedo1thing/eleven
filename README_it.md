<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/icon-dark.png">
    <img src="docs/images/icon-light.png" width="128" alt="Eleven">
  </picture>
</p>

<h1 align="center">Eleven</h1>

<p align="center">Un'app di reverse engineering incentrata sugli agenti per macOS.</p>

<div align="center">

[English](README.md) · [简体中文](README_zh.md) · [繁體中文](README_zh-TW.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [Türkçe](README_tr.md) · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · [ไทย](README_th.md) · [Deutsch](README_de.md) · [Español](README_es.md) · [Français](README_fr.md) · [Українська](README_uk.md) · [Polski](README_pl.md) · [Português (Brasil)](README_pt-BR.md) · [العربية](README_ar.md) · [فارسی](README_fa.md) · [Bahasa Indonesia](README_id.md) · **Italiano**

</div>

<p align="center">
  <img src="docs/images/home.png" width="820" alt="Eleven home screen">
</p>

Eleven è un'app di reverse engineering costruita attorno agli agenti. Carica un'app, un binario, uno shader o un modello e chiedi cosa fa. Qualsiasi agente che parli l'[Agent Client Protocol](https://agentclientprotocol.com) può leggere il codice, seguire i riferimenti, rinominare le funzioni, lasciare note e proporre patch, mentre tu osservi e approvi nella stessa finestra.

L'analisi viene eseguita su [Ghidra](https://ghidra-sre.org) tramite [REA](https://github.com/morluto/rea). L'interfaccia è React, renderizzata in modo nativo su GPUI da [GPUIX](https://www.npmjs.com/package/@gpuix/react).

## Funzionalità

- **Porta il tuo agente.** Aster, Claude, Codex, Gemini, Cursor, Copilot, OpenCode e qualsiasi altro agente ACP. Esegui più agenti sullo stesso progetto, ognuno nella propria chat.
- **Gli agenti guidano la finestra.** Eleven espone i propri strumenti MCP, così un agente può aprire una funzione, cambiare vista, rinominare, aggiungere note e proporre patch.
- **Il controllo resta a te.** Ogni modifica, tua o di un agente, viene registrata con il suo autore e può essere annullata. Le patch sui byte proposte dagli agenti arrivano come suggerimenti che accetti o rifiuti.
- **Mach-O, ELF e PE.** Funzioni, pseudocodice, assembly, grafo del flusso di controllo, riferimenti incrociati, stringhe, segmenti ed esadecimale.
- **Progetti.** Un progetto è un'app o un binario. Le sue chat, rinomine, segnalibri, note e patch sopravvivono alla riapertura.
- **Patching.** Modifica i byte a un indirizzo e scrivi una copia modificata. L'originale non viene mai toccato.
- **Diffing.** Confronta due build per funzione e vedi cosa è cambiato nello pseudocodice.
- **Debugging.** Esegui un programma sotto LLDB, imposta un break sulla funzione che stai guardando, procedi passo passo e leggi le variabili locali.
- **Shader, modelli e profili GPU.** Gli shader Metal e i file dei modelli ML si aprono nel workbench, collegati al codice che li carica. Profila con Instruments.
- **Playbook.** Le competenze integrate, come primo sguardo, rinomina funzioni, traccia una funzionalità e mappa di rete, funzionano con qualsiasi agente.
- **Esportazione.** Pseudocodice, assembly e inventari delle classi Objective-C.

## Installazione

Eleven gira su macOS 14 o successivo su Apple Silicon.

```sh
curl -fsSL https://raw.githubusercontent.com/Zfinix/eleven/main/install.sh | sh
```

Questo installa `Eleven.app` in `/Applications`. Le build non sono ancora notarizzate, quindi l'installer rimuove per te la quarantena del download.

Eleven richiede anche:

- **Ghidra 12.x.** Scaricalo da [ghidra-sre.org](https://ghidra-sre.org) e scompattalo in `~/.local/share` o `~/Applications`, oppure imposta `GHIDRA_INSTALL_DIR`.
- **Un JDK, versione 21 o successiva.** `brew install openjdk@21` va bene. Eleven lo trova da solo.
- **Un agente.** Scegline uno al primo avvio. Eleven installa gli adattatori ACP per te quando servono.

## Compilare dai sorgenti

Servono [Bun](https://bun.sh), Node 20 o successivo, Ghidra e un JDK come sopra, e un checkout di REA 6.x accanto a questo repo (`../rea`), oppure `ELEVEN_REA` che ne indichi uno.

```sh
git clone https://github.com/Zfinix/eleven
git clone https://github.com/Zfinix/rea
cd eleven/app
bun install
bun run dev
```

| Comando | Cosa fa |
| --- | --- |
| `bun run dev [file]` | Avvia l'app con hot reload, aprendo facoltativamente un file |
| `bunx tsc --noEmit --noUnusedLocals` | Controlla i tipi di app, test e script |
| `./script/test` | Esegue la suite di test un file alla volta |
| `./script/bundle-macos` | Compila `build/Eleven.app` |
| `./script/package` | Compila, firma e comprime una release |

## Ambiente

Tutte queste variabili sono facoltative. Eleven trova da solo le posizioni di installazione consuete.

| Variabile | Uso |
| --- | --- |
| `GHIDRA_INSTALL_DIR` | Installazione di Ghidra da usare |
| `JAVA_HOME` | JDK con cui eseguire Ghidra |
| `ELEVEN_REA` | REA da usare al posto di quello incluso |
| `ELEVEN_LLDB_DAP` | `lldb-dap` per il debugger |
| `ELEVEN_SUPPORT` | Dove Eleven conserva progetti e impostazioni |
| `ELEVEN_SIGN_IDENTITY` | Identità di firma del codice per `./script/package` |

## Documentazione

- [Strumenti MCP](docs/mcp-tools.md): tutti gli strumenti che gli agenti hanno in Eleven, cosa accetta e restituisce ciascuno, permessi e privacy.
- [Skill](docs/skills.md): i playbook integrati e come scriverne di tuoi.

## Struttura del repository

- `app/` è l'app: React e TypeScript su GPUIX.
- `crates/` è un prototipo Rust precedente, conservato come riferimento. L'app non lo usa.
- `launch/` è il video di lancio, realizzato con Remotion.
- `install.sh` è l'installer.

Vedi [AGENTS.md](AGENTS.md) per come è organizzato il codice e per le regole che segue.

## Licenza

Eleven è distribuito con la [Apache License 2.0](LICENSE). Il codice di terze parti incluso è elencato in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). I loghi degli agenti appartengono ai rispettivi proprietari e compaiono solo per identificare quegli agenti.
