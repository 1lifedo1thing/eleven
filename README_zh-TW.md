<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/icon-dark.png">
    <img src="docs/images/icon-light.png" width="128" alt="Eleven">
  </picture>
</p>

<h1 align="center">Eleven</h1>

<p align="center">一個以 agent 為核心的 macOS 逆向工程應用程式。</p>

<div align="center">

[English](README.md) · [简体中文](README_zh.md) · **繁體中文** · [日本語](README_ja.md) · [한국어](README_ko.md) · [Türkçe](README_tr.md) · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · [ไทย](README_th.md) · [Deutsch](README_de.md) · [Español](README_es.md) · [Français](README_fr.md) · [Українська](README_uk.md) · [Polski](README_pl.md) · [Português (Brasil)](README_pt-BR.md) · [العربية](README_ar.md) · [فارسی](README_fa.md) · [Bahasa Indonesia](README_id.md) · [Italiano](README_it.md)

</div>

<p align="center">
  <img src="docs/images/home.png" width="820" alt="Eleven home screen">
</p>

Eleven 是一個圍繞 agent 打造的反向工程應用程式。放入一個應用程式、一個二進位檔、一個著色器或一個模型，然後問它是做什麼的。任何支援 [Agent Client Protocol](https://agentclientprotocol.com) 的 agent 都能閱讀程式碼、追蹤參照、重新命名函式、留下筆記並提出修補建議，而你在同一個視窗中觀看並核准。

分析透過 [REA](https://github.com/morluto/rea) 在 [Ghidra](https://ghidra-sre.org) 上執行。介面以 React 撰寫，由 [GPUIX](https://www.npmjs.com/package/@gpuix/react) 在 GPUI 上原生呈現。

## 功能

- **自備 agent。** Aster、Claude、Codex、Gemini、Cursor、Copilot、OpenCode 以及任何其他 ACP agent。可以在同一個專案上執行多個，各自擁有獨立的對話。
- **Agent 能操控視窗。** Eleven 提供自己的 MCP 工具，讓 agent 可以開啟函式、切換檢視、重新命名、新增筆記並提出修補建議。
- **主控權始終在你手上。** 你或 agent 的每一次變更都會連同作者記錄下來，並且可以復原。來自 agent 的位元組修補會以建議的形式出現，由你接受或拒絕。
- **Mach-O、ELF 和 PE。** 函式、虛擬碼、組譯碼、控制流程圖、交互參照、字串、區段和十六進位。
- **專案。** 一個專案就是一個應用程式或二進位檔。它的對話、重新命名、書籤、筆記和修補在重新開啟後依然保留。
- **修補。** 編輯某個位址上的位元組並寫出修補後的副本。原始檔絕不會被更動。
- **差異比對。** 依函式比較兩個組建，看看虛擬碼中出現了什麼變化。
- **偵錯。** 在 LLDB 下執行程式，在你正在查看的函式上中斷，逐步執行並讀取區域變數。
- **著色器、模型和 GPU 剖析。** Metal 著色器和 ML 模型檔案在工作台中開啟，並與載入它們的程式碼連結。使用 Instruments 進行剖析。
- **Playbook。** 內建技能（例如初次檢視、命名函式、追蹤功能和網路地圖）可與任何 agent 搭配使用。
- **匯出。** 虛擬碼、組譯碼和 Objective-C 類別清單。

## 安裝

Eleven 可在搭載 Apple Silicon 的 macOS 14 或更新版本上執行。

```sh
curl -fsSL https://raw.githubusercontent.com/Zfinix/eleven/main/install.sh | sh
```

這會將 `Eleven.app` 安裝到 `/Applications`。組建尚未公證，因此安裝程式會替你清除下載隔離標記。

Eleven 還需要：

- **Ghidra 12.x。** 從 [ghidra-sre.org](https://ghidra-sre.org) 下載並解壓縮到 `~/.local/share` 或 `~/Applications`，或設定 `GHIDRA_INSTALL_DIR`。
- **一個 JDK，21 或更新版本。** `brew install openjdk@21` 即可。Eleven 會自己找到它。
- **一個 agent。** 首次執行時挑選一個。需要時 Eleven 會為你安裝 ACP 配接器。

## 從原始碼建置

你需要 [Bun](https://bun.sh)、Node 20 或更新版本、Ghidra 和一個 JDK（如上），以及在本儲存庫旁有一份 REA 6.x 的簽出（`../rea`），或讓 `ELEVEN_REA` 指向它。

```sh
git clone https://github.com/Zfinix/eleven
git clone https://github.com/Zfinix/rea
cd eleven/app
bun install
bun run dev
```

| 指令 | 作用 |
| --- | --- |
| `bun run dev [file]` | 以熱重載方式執行應用程式，可選擇開啟一個檔案 |
| `bunx tsc --noEmit --noUnusedLocals` | 對應用程式、測試和指令碼做型別檢查 |
| `./script/test` | 一次一個檔案地執行測試套件 |
| `./script/bundle-macos` | 建置 `build/Eleven.app` |
| `./script/package` | 建置、簽署並封裝發行版 |

## 環境變數

以下全部都是選用的。Eleven 會自己找到常見的安裝位置。

| 變數 | 用途 |
| --- | --- |
| `GHIDRA_INSTALL_DIR` | 要使用的 Ghidra 安裝位置 |
| `JAVA_HOME` | 用來執行 Ghidra 的 JDK |
| `ELEVEN_REA` | 使用 REA 而不是內建的那一份 |
| `ELEVEN_LLDB_DAP` | 供偵錯工具使用的 `lldb-dap` |
| `ELEVEN_SUPPORT` | Eleven 存放專案和設定的位置 |
| `ELEVEN_SIGN_IDENTITY` | 供 `./script/package` 使用的程式碼簽署身分 |

## 說明文件

- [MCP 工具](docs/mcp-tools.md)：Eleven 中代理可用的每一個工具、各自的輸入與回傳，以及權限與隱私。
- [技能](docs/skills.md)：內建的作戰手冊，以及如何撰寫自己的。

## 儲存庫結構

- `app/` 是應用程式本身：使用 React 和 TypeScript，基於 GPUIX。
- `crates/` 是早期的 Rust 原型，保留作為參考。應用程式並不使用它。
- `launch/` 是發布影片，以 Remotion 製作。
- `install.sh` 是安裝程式。

關於程式碼的組織方式以及它遵循的規則，請見 [AGENTS.md](AGENTS.md)。

## 授權條款

Eleven 以 [Apache License 2.0](LICENSE) 發布。隨附的第三方程式碼列於 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。Agent 標誌屬於其各自所有者，僅用於識別這些 agent。
