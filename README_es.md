<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/icon-dark.png">
    <img src="docs/images/icon-light.png" width="128" alt="Eleven">
  </picture>
</p>

<h1 align="center">Eleven</h1>

<p align="center">Una aplicación de ingeniería inversa centrada en agentes para macOS.</p>

<div align="center">

[English](README.md) · [简体中文](README_zh.md) · [繁體中文](README_zh-TW.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [Türkçe](README_tr.md) · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · [ไทย](README_th.md) · [Deutsch](README_de.md) · **Español** · [Français](README_fr.md) · [Українська](README_uk.md) · [Polski](README_pl.md) · [Português (Brasil)](README_pt-BR.md) · [العربية](README_ar.md) · [فارسی](README_fa.md) · [Bahasa Indonesia](README_id.md) · [Italiano](README_it.md)

</div>

<p align="center">
  <img src="docs/images/home.png" width="820" alt="Pantalla de inicio de Eleven">
</p>

Eleven es una aplicación de ingeniería inversa construida en torno a agentes. Suelta una app, un binario, un shader o un modelo y pregunta qué hace. Cualquier agente que hable el [Agent Client Protocol](https://agentclientprotocol.com) puede leer el código, seguir referencias, renombrar funciones, dejar notas y proponer parches, mientras tú observas y apruebas en la misma ventana.

El análisis se ejecuta en [Ghidra](https://ghidra-sre.org) a través de [REA](https://github.com/morluto/rea). La interfaz es React renderizado de forma nativa sobre GPUI mediante [GPUIX](https://www.npmjs.com/package/@gpuix/react).

## Características

- **Trae tu propio agente.** Aster, Claude, Codex, Gemini, Cursor, Copilot, OpenCode y cualquier otro agente ACP. Ejecuta varios sobre el mismo proyecto, cada uno en su propio chat.
- **Los agentes manejan la ventana.** Eleven expone sus propias herramientas MCP para que un agente pueda abrir una función, cambiar de vista, renombrar, añadir notas y proponer parches.
- **Tú mantienes el control.** Todo cambio, tuyo o de un agente, queda registrado con su autor y se puede deshacer. Los parches de bytes que proponen los agentes llegan como sugerencias que aceptas o rechazas.
- **Mach-O, ELF y PE.** Funciones, pseudocódigo, ensamblador, grafo de flujo de control, referencias cruzadas, cadenas, segmentos y hexadecimal.
- **Proyectos.** Un proyecto es una app o un binario. Sus chats, renombrados, marcadores, notas y parches sobreviven al reabrirlo.
- **Parcheo.** Edita bytes en una dirección y escribe una copia parcheada. El original nunca se toca.
- **Comparación.** Compara dos compilaciones por función y observa qué cambió en el pseudocódigo.
- **Depuración.** Ejecuta un programa bajo LLDB, pon un punto de ruptura en la función que estás viendo, avanza paso a paso y lee las variables locales.
- **Shaders, modelos y perfiles de GPU.** Los shaders Metal y los archivos de modelos de ML se abren en el banco de trabajo, enlazados con el código que los carga. Perfila con Instruments.
- **Playbooks.** Habilidades integradas como el primer vistazo, nombrar funciones, rastrear una característica y el mapa de red funcionan con cualquier agente.
- **Exportación.** Inventarios de pseudocódigo, ensamblador y clases de Objective-C.

## Instalación

Eleven se ejecuta en macOS 14 o posterior sobre Apple Silicon.

```sh
curl -fsSL https://raw.githubusercontent.com/Zfinix/eleven/main/install.sh | sh
```

Esto instala `Eleven.app` en `/Applications`. Las compilaciones aún no están notarizadas, así que el instalador borra por ti la cuarentena de descarga.

Eleven también necesita:

- **Ghidra 12.x.** Descárgalo de [ghidra-sre.org](https://ghidra-sre.org) y descomprímelo en `~/.local/share` o `~/Applications`, o define `GHIDRA_INSTALL_DIR`.
- **Un JDK, 21 o posterior.** `brew install openjdk@21` funciona. Eleven lo encuentra por su cuenta.
- **Un agente.** Elige uno en la primera ejecución. Eleven instala los adaptadores ACP por ti cuando hacen falta.

## Compilar desde el código fuente

Necesitas [Bun](https://bun.sh), Node 20 o posterior, Ghidra y un JDK como se indica arriba, y una copia de REA 6.x junto a este repositorio (`../rea`), o `ELEVEN_REA` apuntando a una.

```sh
git clone https://github.com/Zfinix/eleven
git clone https://github.com/Zfinix/rea
cd eleven/app
bun install
bun run dev
```

| Comando | Qué hace |
| --- | --- |
| `bun run dev [file]` | Ejecuta la aplicación con recarga en caliente y, opcionalmente, abre un archivo |
| `bunx tsc --noEmit --noUnusedLocals` | Comprueba los tipos de la aplicación, las pruebas y los scripts |
| `./script/test` | Ejecuta la suite de pruebas archivo por archivo |
| `./script/bundle-macos` | Compila `build/Eleven.app` |
| `./script/package` | Compila, firma y comprime una versión de lanzamiento |

## Entorno

Todas son opcionales. Eleven encuentra por su cuenta las ubicaciones habituales de instalación.

| Variable | Uso |
| --- | --- |
| `GHIDRA_INSTALL_DIR` | Instalación de Ghidra que se debe usar |
| `JAVA_HOME` | JDK con el que ejecutar Ghidra |
| `ELEVEN_REA` | REA que se debe usar en lugar del incluido |
| `ELEVEN_LLDB_DAP` | `lldb-dap` para el depurador |
| `ELEVEN_SUPPORT` | Dónde guarda Eleven los proyectos y la configuración |
| `ELEVEN_SIGN_IDENTITY` | Identidad de firma de código para `./script/package` |

## Documentación

- [Herramientas MCP](docs/mcp-tools.md): todas las herramientas que reciben los agentes en Eleven, qué acepta y devuelve cada una, permisos y privacidad.
- [Skills](docs/skills.md): los playbooks integrados y cómo escribir los tuyos.

## Estructura del repositorio

- `app/` es la aplicación: React y TypeScript sobre GPUIX.
- `launch/` es el vídeo de lanzamiento, hecho con Remotion.
- `install.sh` es el instalador.

Consulta [AGENTS.md](AGENTS.md) para saber cómo está organizado el código y las reglas que sigue.

## Licencia

Eleven se publica bajo la [Apache License 2.0](LICENSE). El código de terceros incluido se detalla en [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Los logotipos de los agentes pertenecen a sus propietarios y aparecen solo para identificarlos.
