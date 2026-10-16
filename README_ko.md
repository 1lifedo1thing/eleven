<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/icon-dark.png">
    <img src="docs/images/icon-light.png" width="128" alt="Eleven">
  </picture>
</p>

<h1 align="center">Eleven</h1>

<p align="center">macOS를 위한 에이전트 우선 리버스 엔지니어링 앱.</p>

<div align="center">

[English](README.md) · [简体中文](README_zh.md) · [繁體中文](README_zh-TW.md) · [日本語](README_ja.md) · **한국어** · [Türkçe](README_tr.md) · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · [ไทย](README_th.md) · [Deutsch](README_de.md) · [Español](README_es.md) · [Français](README_fr.md) · [Українська](README_uk.md) · [Polski](README_pl.md) · [Português (Brasil)](README_pt-BR.md) · [العربية](README_ar.md) · [فارسی](README_fa.md) · [Bahasa Indonesia](README_id.md) · [Italiano](README_it.md)

</div>

<p align="center">
  <img src="docs/images/home.png" width="820" alt="Eleven home screen">
</p>

Eleven은 에이전트를 중심으로 만들어진 리버스 엔지니어링 앱입니다. 앱, 바이너리, 셰이더 또는 모델을 넣고 무엇을 하는지 물어보세요. [Agent Client Protocol](https://agentclientprotocol.com)을 지원하는 에이전트라면 무엇이든 코드를 읽고, 참조를 따라가고, 함수 이름을 바꾸고, 노트를 남기고, 패치를 제안할 수 있으며, 여러분은 같은 창에서 그것을 지켜보고 승인합니다.

분석은 [REA](https://github.com/morluto/rea)를 통해 [Ghidra](https://ghidra-sre.org)에서 실행됩니다. UI는 [GPUIX](https://www.npmjs.com/package/@gpuix/react)로 GPUI 위에 네이티브로 렌더링되는 React입니다.

## 기능

- **에이전트는 직접 고르세요.** Aster, Claude, Codex, Gemini, Cursor, Copilot, OpenCode 그리고 그 밖의 모든 ACP 에이전트. 같은 프로젝트에서 여러 개를 동시에 실행할 수 있고, 각각 자체 채팅을 가집니다.
- **에이전트가 창을 조작합니다.** Eleven은 자체 MCP 도구를 제공하므로 에이전트가 함수를 열고, 뷰를 전환하고, 이름을 바꾸고, 노트를 추가하고, 패치를 제안할 수 있습니다.
- **통제권은 여러분에게 있습니다.** 여러분이나 에이전트가 만든 모든 변경은 작성자와 함께 기록되며 되돌릴 수 있습니다. 에이전트의 바이트 패치는 수락하거나 거절하는 제안으로 도착합니다.
- **Mach-O, ELF, PE.** 함수, 의사코드, 어셈블리, 제어 흐름 그래프, 상호 참조, 문자열, 세그먼트, 16진수.
- **프로젝트.** 프로젝트는 앱 또는 바이너리 하나입니다. 채팅, 이름 변경, 북마크, 노트, 패치는 다시 열어도 그대로 남습니다.
- **패칭.** 주소의 바이트를 편집하고 패치된 사본을 씁니다. 원본은 절대 건드리지 않습니다.
- **디핑.** 두 빌드를 함수별로 비교하고 의사코드에서 무엇이 바뀌었는지 확인합니다.
- **디버깅.** LLDB에서 프로그램을 실행하고, 보고 있는 함수에 중단점을 걸고, 단계별로 실행하고, 로컬 변수를 읽습니다.
- **셰이더, 모델, GPU 프로파일.** Metal 셰이더와 ML 모델 파일이 워크벤치에서 열리고, 이를 로드하는 코드와 연결됩니다. Instruments로 프로파일링하세요.
- **플레이북.** 첫 살펴보기, 함수 이름 짓기, 기능 추적, 네트워크 맵 같은 내장 스킬이 모든 에이전트와 함께 동작합니다.
- **내보내기.** 의사코드, 어셈블리, Objective-C 클래스 목록.

## 설치

Eleven은 Apple Silicon에서 macOS 14 이상에서 실행됩니다.

```sh
curl -fsSL https://raw.githubusercontent.com/Zfinix/eleven/main/install.sh | sh
```

이 명령은 `Eleven.app`을 `/Applications`에 설치합니다. 빌드는 아직 공증되지 않았으므로, 설치 프로그램이 다운로드 격리 속성을 대신 해제해 줍니다.

Eleven에는 다음도 필요합니다.

- **Ghidra 12.x.** [ghidra-sre.org](https://ghidra-sre.org)에서 내려받아 `~/.local/share` 또는 `~/Applications`에 압축을 풀거나, `GHIDRA_INSTALL_DIR`을 설정하세요.
- **JDK 21 이상.** `brew install openjdk@21`이면 됩니다. Eleven이 알아서 찾습니다.
- **에이전트.** 첫 실행 때 하나를 고르세요. 필요할 때 Eleven이 ACP 어댑터를 대신 설치해 줍니다.

## 소스에서 빌드

[Bun](https://bun.sh), Node 20 이상, 위에서 말한 Ghidra와 JDK, 그리고 이 저장소 옆에 있는 REA 6.x 체크아웃(`../rea`) 또는 그것을 가리키는 `ELEVEN_REA`가 필요합니다.

```sh
git clone https://github.com/Zfinix/eleven
git clone https://github.com/Zfinix/rea
cd eleven/app
bun install
bun run dev
```

| 명령 | 하는 일 |
| --- | --- |
| `bun run dev [file]` | 핫 리로드로 앱을 실행하고, 선택적으로 파일을 엽니다 |
| `bunx tsc --noEmit --noUnusedLocals` | 앱, 테스트, 스크립트의 타입을 검사합니다 |
| `./script/test` | 테스트 모음을 한 번에 한 파일씩 실행합니다 |
| `./script/bundle-macos` | `build/Eleven.app`을 빌드합니다 |
| `./script/package` | 빌드하고 서명하고 릴리스용으로 압축합니다 |

## 환경 변수

모두 선택 사항입니다. Eleven이 일반적인 설치 위치를 알아서 찾습니다.

| 변수 | 용도 |
| --- | --- |
| `GHIDRA_INSTALL_DIR` | 사용할 Ghidra 설치 |
| `JAVA_HOME` | Ghidra를 실행할 JDK |
| `ELEVEN_REA` | 번들된 것 대신 사용할 REA |
| `ELEVEN_LLDB_DAP` | 디버거용 `lldb-dap` |
| `ELEVEN_SUPPORT` | Eleven이 프로젝트와 설정을 보관하는 위치 |
| `ELEVEN_SIGN_IDENTITY` | `./script/package`용 코드 서명 ID |

## 문서

- [MCP 도구](docs/mcp-tools.md): Eleven에서 에이전트가 쓰는 모든 도구, 각 도구가 받고 돌려주는 것, 권한과 개인정보 처리.
- [스킬](docs/skills.md): 내장 플레이북과 직접 작성하는 방법.

## 저장소 구조

- `app/`은 앱입니다. GPUIX 위의 React와 TypeScript.
- `launch/`는 Remotion으로 만든 시작 영상입니다.
- `install.sh`는 설치 프로그램입니다.

코드가 어떻게 배치되어 있고 어떤 규칙을 따르는지는 [AGENTS.md](AGENTS.md)를 참고하세요.

## 라이선스

Eleven은 [Apache License 2.0](LICENSE)에 따라 배포됩니다. 함께 포함된 서드파티 코드는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에 나열되어 있습니다. 에이전트 로고는 각 소유자의 것이며 해당 에이전트를 식별하기 위한 목적으로만 표시됩니다.
