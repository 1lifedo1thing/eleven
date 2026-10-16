<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/icon-dark.png">
    <img src="docs/images/icon-light.png" width="128" alt="Eleven">
  </picture>
</p>

<h1 align="center">Eleven</h1>

<p align="center">Eine agentenorientierte Reverse-Engineering-App für macOS.</p>

<div align="center">

[English](README.md) · [简体中文](README_zh.md) · [繁體中文](README_zh-TW.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [Türkçe](README_tr.md) · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · [ไทย](README_th.md) · **Deutsch** · [Español](README_es.md) · [Français](README_fr.md) · [Українська](README_uk.md) · [Polski](README_pl.md) · [Português (Brasil)](README_pt-BR.md) · [العربية](README_ar.md) · [فارسی](README_fa.md) · [Bahasa Indonesia](README_id.md) · [Italiano](README_it.md)

</div>

<p align="center">
  <img src="docs/images/home.png" width="820" alt="Eleven home screen">
</p>

Eleven ist eine Reverse-Engineering-App, die um Agents herum gebaut ist. Wirf eine App, ein Binary, einen Shader oder ein Modell hinein und frag, was es tut. Jeder Agent, der das [Agent Client Protocol](https://agentclientprotocol.com) spricht, kann den Code lesen, Verweisen folgen, Funktionen umbenennen, Notizen hinterlassen und Patches vorschlagen, während du im selben Fenster zusiehst und zustimmst.

Die Analyse läuft auf [Ghidra](https://ghidra-sre.org) über [REA](https://github.com/morluto/rea). Die Oberfläche ist React, nativ auf GPUI gerendert von [GPUIX](https://www.npmjs.com/package/@gpuix/react).

## Funktionen

- **Bring deinen eigenen Agent mit.** Aster, Claude, Codex, Gemini, Cursor, Copilot, OpenCode und jeder andere ACP-Agent. Betreibe mehrere im selben Projekt, jeder in seinem eigenen Chat.
- **Agents steuern das Fenster.** Eleven stellt eigene MCP-Tools bereit, damit ein Agent eine Funktion öffnen, Ansichten wechseln, umbenennen, Notizen hinzufügen und Patches vorschlagen kann.
- **Du behältst die Kontrolle.** Jede Änderung von dir oder einem Agent wird mit ihrem Urheber protokolliert und kann rückgängig gemacht werden. Byte-Patches von Agents kommen als Vorschläge, die du annimmst oder ablehnst.
- **Mach-O, ELF und PE.** Funktionen, Pseudocode, Assembler, Kontrollflussgraph, Querverweise, Strings, Segmente und Hex.
- **Projekte.** Ein Projekt ist eine App oder ein Binary. Seine Chats, Umbenennungen, Lesezeichen, Notizen und Patches bleiben beim erneuten Öffnen erhalten.
- **Patchen.** Bearbeite Bytes an einer Adresse und schreibe eine gepatchte Kopie. Das Original wird nie angefasst.
- **Vergleichen.** Vergleiche zwei Builds nach Funktion und sieh, was sich im Pseudocode geändert hat.
- **Debuggen.** Führe ein Programm unter LLDB aus, halte an der Funktion an, die du gerade ansiehst, und lies Locals.
- **Shader, Modelle und GPU-Profile.** Metal-Shader und ML-Modelldateien öffnen in der Workbench, verknüpft mit dem Code, der sie lädt. Profiling mit Instruments.
- **Playbooks.** Eingebaute Skills wie first look, name functions, trace a feature und network map funktionieren mit jedem Agent.
- **Export.** Pseudocode, Assembler und Inventare von Objective-C-Klassen.

## Installation

Eleven läuft auf macOS 14 oder neuer auf Apple Silicon.

```sh
curl -fsSL https://raw.githubusercontent.com/Zfinix/eleven/main/install.sh | sh
```

Damit wird `Eleven.app` nach `/Applications` installiert. Builds sind noch nicht notarisiert, deshalb entfernt der Installer für dich die Download-Quarantäne.

Eleven braucht außerdem:

- **Ghidra 12.x.** Lade es von [ghidra-sre.org](https://ghidra-sre.org) herunter und entpacke es in `~/.local/share` oder `~/Applications`, oder setze `GHIDRA_INSTALL_DIR`.
- **Ein JDK, 21 oder neuer.** `brew install openjdk@21` funktioniert. Eleven findet es von selbst.
- **Einen Agent.** Wähle beim ersten Start einen aus. Eleven installiert ACP-Adapter für dich, wenn sie gebraucht werden.

## Aus dem Quellcode bauen

Du brauchst [Bun](https://bun.sh), Node 20 oder neuer, Ghidra und ein JDK wie oben sowie einen Checkout von REA 6.x neben diesem Repo (`../rea`) oder `ELEVEN_REA` mit einem Verweis darauf.

```sh
git clone https://github.com/Zfinix/eleven
git clone https://github.com/Zfinix/rea
cd eleven/app
bun install
bun run dev
```

| Befehl | Was er tut |
| --- | --- |
| `bun run dev [file]` | Startet die App mit Hot Reload und öffnet optional eine Datei |
| `bunx tsc --noEmit --noUnusedLocals` | Prüft die Typen von App, Tests und Skripten |
| `./script/test` | Führt die Testsuite Datei für Datei aus |
| `./script/bundle-macos` | Baut `build/Eleven.app` |
| `./script/package` | Baut, signiert und zippt ein Release |

## Umgebung

Alles hier ist optional. Eleven findet die üblichen Installationsorte von selbst.

| Variable | Verwendung |
| --- | --- |
| `GHIDRA_INSTALL_DIR` | Zu verwendende Ghidra-Installation |
| `JAVA_HOME` | JDK, mit dem Ghidra läuft |
| `ELEVEN_REA` | REA, das statt des mitgelieferten verwendet wird |
| `ELEVEN_LLDB_DAP` | `lldb-dap` für den Debugger |
| `ELEVEN_SUPPORT` | Wo Eleven Projekte und Einstellungen ablegt |
| `ELEVEN_SIGN_IDENTITY` | Code-Signing-Identität für `./script/package` |

## Dokumentation

- [MCP-Werkzeuge](docs/mcp-tools.md): alle Werkzeuge, die Agenten in Eleven bekommen, was jedes entgegennimmt und zurückgibt, Berechtigungen und Datenschutz.
- [Skills](docs/skills.md): die eingebauten Playbooks und wie du eigene schreibst.

## Projektstruktur

- `app/` ist die App: React und TypeScript auf GPUIX.
- `launch/` ist das Launch-Video, erstellt mit Remotion.
- `install.sh` ist der Installer.

Siehe [AGENTS.md](AGENTS.md) für den Aufbau des Codes und die Regeln, denen er folgt.

## Lizenz

Eleven steht unter der [Apache License 2.0](LICENSE). Mitgelieferter Code Dritter ist in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) aufgeführt. Agent-Logos gehören ihren jeweiligen Inhabern und erscheinen nur, um diese Agents zu kennzeichnen.
