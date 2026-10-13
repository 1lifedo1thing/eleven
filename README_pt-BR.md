<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/icon-dark.png">
    <img src="docs/images/icon-light.png" width="128" alt="Eleven">
  </picture>
</p>

<h1 align="center">Eleven</h1>

<p align="center">Um aplicativo de engenharia reversa para macOS, centrado em agentes.</p>

<div align="center">

[English](README.md) · [简体中文](README_zh.md) · [繁體中文](README_zh-TW.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [Türkçe](README_tr.md) · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · [ไทย](README_th.md) · [Deutsch](README_de.md) · [Español](README_es.md) · [Français](README_fr.md) · [Українська](README_uk.md) · [Polski](README_pl.md) · **Português (Brasil)** · [العربية](README_ar.md) · [فارسی](README_fa.md) · [Bahasa Indonesia](README_id.md) · [Italiano](README_it.md)

</div>

<p align="center">
  <img src="docs/images/home.png" width="820" alt="Eleven home screen">
</p>

Eleven é um aplicativo de engenharia reversa construído em torno de agentes. Jogue um app, um binário, um shader ou um modelo e pergunte o que ele faz. Qualquer agente que fale o [Agent Client Protocol](https://agentclientprotocol.com) pode ler o código, seguir referências, renomear funções, deixar anotações e sugerir patches, enquanto você acompanha e aprova na mesma janela.

A análise roda sobre o [Ghidra](https://ghidra-sre.org) por meio do [REA](https://github.com/morluto/rea). A interface é React renderizado nativamente no GPUI pelo [GPUIX](https://www.npmjs.com/package/@gpuix/react).

## Recursos

- **Traga o seu próprio agente.** Aster, Claude, Codex, Gemini, Cursor, Copilot, OpenCode e qualquer outro agente ACP. Rode vários no mesmo projeto, cada um no seu próprio chat.
- **Os agentes conduzem a janela.** O Eleven expõe as próprias ferramentas MCP, então um agente pode abrir uma função, trocar de visão, renomear, adicionar anotações e propor patches.
- **Você continua no controle.** Toda mudança, sua ou de um agente, é registrada com o autor e pode ser desfeita. Patches de bytes vindos de agentes chegam como sugestões que você aceita ou recusa.
- **Mach-O, ELF e PE.** Funções, pseudocódigo, assembly, grafo de fluxo de controle, referências cruzadas, strings, segmentos e hexadecimal.
- **Projetos.** Um projeto é um app ou um binário. Seus chats, renomeações, favoritos, anotações e patches sobrevivem à reabertura.
- **Patch.** Edite bytes em um endereço e grave uma cópia corrigida. O original nunca é tocado.
- **Diff.** Compare duas builds por função e veja o que mudou no pseudocódigo.
- **Depuração.** Rode um programa sob o LLDB, pare na função que você está olhando, avance passo a passo e leia as variáveis locais.
- **Shaders, modelos e perfis de GPU.** Shaders Metal e arquivos de modelo de ML abrem na bancada de trabalho, ligados ao código que os carrega. Faça profiling com o Instruments.
- **Playbooks.** Habilidades embutidas, como primeiro olhar, nomear funções, rastrear um recurso e mapa de rede, funcionam com qualquer agente.
- **Exportação.** Pseudocódigo, assembly e inventários de classes Objective-C.

## Instalação

O Eleven roda no macOS 14 ou posterior em Apple Silicon.

```sh
curl -fsSL https://raw.githubusercontent.com/Zfinix/eleven/main/install.sh | sh
```

Isso instala o `Eleven.app` em `/Applications`. As builds ainda não são notarizadas, então o instalador remove a quarentena de download para você.

O Eleven também precisa de:

- **Ghidra 12.x.** Baixe em [ghidra-sre.org](https://ghidra-sre.org) e descompacte em `~/.local/share` ou `~/Applications`, ou defina `GHIDRA_INSTALL_DIR`.
- **Um JDK, 21 ou mais recente.** `brew install openjdk@21` funciona. O Eleven o encontra sozinho.
- **Um agente.** Escolha um na primeira execução. O Eleven instala adaptadores ACP para você quando necessário.

## Compilar a partir do código-fonte

Você precisa do [Bun](https://bun.sh), do Node 20 ou mais recente, do Ghidra e de um JDK como acima, e de um clone do REA 6.x ao lado deste repositório (`../rea`), ou de `ELEVEN_REA` apontando para um.

```sh
git clone https://github.com/Zfinix/eleven
git clone https://github.com/Zfinix/rea
cd eleven/app
bun install
bun run dev
```

| Comando | O que faz |
| --- | --- |
| `bun run dev [file]` | Roda o app com hot reload, abrindo um arquivo se você quiser |
| `bunx tsc --noEmit --noUnusedLocals` | Checa os tipos do app, dos testes e dos scripts |
| `./script/test` | Roda a suíte de testes um arquivo por vez |
| `./script/bundle-macos` | Compila `build/Eleven.app` |
| `./script/package` | Compila, assina e empacota uma release |

## Ambiente

Todas são opcionais. O Eleven encontra sozinho os locais de instalação usuais.

| Variável | Uso |
| --- | --- |
| `GHIDRA_INSTALL_DIR` | Instalação do Ghidra a usar |
| `JAVA_HOME` | JDK com o qual rodar o Ghidra |
| `ELEVEN_REA` | REA a usar em vez do embutido |
| `ELEVEN_LLDB_DAP` | `lldb-dap` para o depurador |
| `ELEVEN_SUPPORT` | Onde o Eleven guarda projetos e configurações |
| `ELEVEN_SIGN_IDENTITY` | Identidade de assinatura de código para `./script/package` |

## Documentação

- [Ferramentas MCP](docs/mcp-tools.md): todas as ferramentas que os agentes têm no Eleven, o que cada uma recebe e devolve, permissões e privacidade.
- [Skills](docs/skills.md): os playbooks integrados e como escrever os seus.

## Repositório

- `app/` é o aplicativo: React e TypeScript no GPUIX.
- `crates/` é um protótipo anterior em Rust, mantido como referência. O aplicativo não o usa.
- `launch/` é o vídeo de lançamento, feito com Remotion.
- `install.sh` é o instalador.

Veja [AGENTS.md](AGENTS.md) para saber como o código está organizado e quais regras ele segue.

## Licença

O Eleven é distribuído sob a [Apache License 2.0](LICENSE). Código de terceiros incluído está listado em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Os logotipos dos agentes pertencem aos seus donos e aparecem apenas para identificar esses agentes.
