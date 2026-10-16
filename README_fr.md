<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/icon-dark.png">
    <img src="docs/images/icon-light.png" width="128" alt="Eleven">
  </picture>
</p>

<h1 align="center">Eleven</h1>

<p align="center">Une application de rétro-ingénierie centrée sur les agents pour macOS.</p>

<div align="center">

[English](README.md) · [简体中文](README_zh.md) · [繁體中文](README_zh-TW.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [Türkçe](README_tr.md) · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · [ไทย](README_th.md) · [Deutsch](README_de.md) · [Español](README_es.md) · **Français** · [Українська](README_uk.md) · [Polski](README_pl.md) · [Português (Brasil)](README_pt-BR.md) · [العربية](README_ar.md) · [فارسی](README_fa.md) · [Bahasa Indonesia](README_id.md) · [Italiano](README_it.md)

</div>

<p align="center">
  <img src="docs/images/home.png" width="820" alt="Écran d'accueil d'Eleven">
</p>

Eleven est une application de rétro-ingénierie construite autour des agents. Déposez une app, un binaire, un shader ou un modèle et demandez ce qu'il fait. Tout agent qui parle l'[Agent Client Protocol](https://agentclientprotocol.com) peut lire le code, suivre les références, renommer des fonctions, laisser des notes et proposer des correctifs, pendant que vous observez et approuvez dans la même fenêtre.

L'analyse s'exécute sur [Ghidra](https://ghidra-sre.org) via [REA](https://github.com/morluto/rea). L'interface est en React, rendue nativement sur GPUI par [GPUIX](https://www.npmjs.com/package/@gpuix/react).

## Fonctionnalités

- **Apportez votre propre agent.** Aster, Claude, Codex, Gemini, Cursor, Copilot, OpenCode et tout autre agent ACP. Faites-en tourner plusieurs sur le même projet, chacun dans son propre chat.
- **Les agents pilotent la fenêtre.** Eleven expose ses propres outils MCP pour qu'un agent puisse ouvrir une fonction, changer de vue, renommer, ajouter des notes et proposer des correctifs.
- **Vous gardez le contrôle.** Chaque modification, la vôtre ou celle d'un agent, est enregistrée avec son auteur et peut être annulée. Les correctifs d'octets proposés par les agents arrivent sous forme de suggestions que vous acceptez ou refusez.
- **Mach-O, ELF et PE.** Fonctions, pseudocode, assembleur, graphe de flot de contrôle, références croisées, chaînes, segments et hexadécimal.
- **Projets.** Un projet correspond à une app ou à un binaire. Ses chats, renommages, signets, notes et correctifs survivent à la réouverture.
- **Application de correctifs.** Modifiez des octets à une adresse et écrivez une copie corrigée. L'original n'est jamais touché.
- **Comparaison.** Comparez deux versions par fonction et voyez ce qui a changé dans le pseudocode.
- **Débogage.** Exécutez un programme sous LLDB, posez un point d'arrêt sur la fonction que vous consultez, avancez pas à pas et lisez les variables locales.
- **Shaders, modèles et profils GPU.** Les shaders Metal et les fichiers de modèles ML s'ouvrent dans l'atelier, liés au code qui les charge. Profilez avec Instruments.
- **Playbooks.** Des compétences intégrées comme le premier coup d'œil, nommer les fonctions, tracer une fonctionnalité et la cartographie du réseau fonctionnent avec n'importe quel agent.
- **Export.** Inventaires de pseudocode, d'assembleur et de classes Objective-C.

## Installation

Eleven fonctionne sur macOS 14 ou version ultérieure sur Apple Silicon.

```sh
curl -fsSL https://raw.githubusercontent.com/Zfinix/eleven/main/install.sh | sh
```

Cela installe `Eleven.app` dans `/Applications`. Les versions ne sont pas encore notariées, l'installeur lève donc lui-même la quarantaine de téléchargement.

Eleven a aussi besoin de :

- **Ghidra 12.x.** Téléchargez-le depuis [ghidra-sre.org](https://ghidra-sre.org) et décompressez-le dans `~/.local/share` ou `~/Applications`, ou définissez `GHIDRA_INSTALL_DIR`.
- **Un JDK, 21 ou plus récent.** `brew install openjdk@21` fonctionne. Eleven le trouve tout seul.
- **Un agent.** Choisissez-en un au premier lancement. Eleven installe les adaptateurs ACP pour vous quand ils sont nécessaires.

## Compiler depuis les sources

Il vous faut [Bun](https://bun.sh), Node 20 ou plus récent, Ghidra et un JDK comme ci-dessus, ainsi qu'une copie de REA 6.x à côté de ce dépôt (`../rea`), ou `ELEVEN_REA` qui pointe vers l'une d'elles.

```sh
git clone https://github.com/Zfinix/eleven
git clone https://github.com/Zfinix/rea
cd eleven/app
bun install
bun run dev
```

| Commande | Ce qu'elle fait |
| --- | --- |
| `bun run dev [file]` | Lance l'application avec rechargement à chaud et ouvre éventuellement un fichier |
| `bunx tsc --noEmit --noUnusedLocals` | Vérifie les types de l'application, des tests et des scripts |
| `./script/test` | Lance la suite de tests fichier par fichier |
| `./script/bundle-macos` | Construit `build/Eleven.app` |
| `./script/package` | Construit, signe et compresse une version de publication |

## Environnement

Toutes sont facultatives. Eleven trouve tout seul les emplacements d'installation habituels.

| Variable | Utilisation |
| --- | --- |
| `GHIDRA_INSTALL_DIR` | Installation de Ghidra à utiliser |
| `JAVA_HOME` | JDK avec lequel exécuter Ghidra |
| `ELEVEN_REA` | REA à utiliser à la place de celui fourni |
| `ELEVEN_LLDB_DAP` | `lldb-dap` pour le débogueur |
| `ELEVEN_SUPPORT` | Emplacement où Eleven conserve les projets et les réglages |
| `ELEVEN_SIGN_IDENTITY` | Identité de signature de code pour `./script/package` |

## Documentation

- [Outils MCP](docs/mcp-tools.md) : tous les outils dont disposent les agents dans Eleven, ce que chacun prend et renvoie, les permissions et la confidentialité.
- [Skills](docs/skills.md) : les playbooks intégrés et comment écrire les vôtres.

## Structure du dépôt

- `app/` est l'application : React et TypeScript sur GPUIX.
- `launch/` est la vidéo de lancement, réalisée avec Remotion.
- `install.sh` est l'installeur.

Voir [AGENTS.md](AGENTS.md) pour la façon dont le code est organisé et les règles qu'il suit.

## Licence

Eleven est publié sous la [Apache License 2.0](LICENSE). Le code tiers inclus est listé dans [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Les logos des agents appartiennent à leurs propriétaires et ne servent qu'à les identifier.
