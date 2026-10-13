<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/icon-dark.png">
    <img src="docs/images/icon-light.png" width="128" alt="Eleven">
  </picture>
</p>

<h1 align="center">Eleven</h1>

<p align="center">エージェントを中心に据えた macOS 向けリバースエンジニアリングアプリ。</p>

<div align="center">

[English](README.md) · [简体中文](README_zh.md) · [繁體中文](README_zh-TW.md) · **日本語** · [한국어](README_ko.md) · [Türkçe](README_tr.md) · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · [ไทย](README_th.md) · [Deutsch](README_de.md) · [Español](README_es.md) · [Français](README_fr.md) · [Українська](README_uk.md) · [Polski](README_pl.md) · [Português (Brasil)](README_pt-BR.md) · [العربية](README_ar.md) · [فارسی](README_fa.md) · [Bahasa Indonesia](README_id.md) · [Italiano](README_it.md)

</div>

<p align="center">
  <img src="docs/images/home.png" width="820" alt="Eleven home screen">
</p>

Eleven はエージェントを中心に据えたリバースエンジニアリングアプリです。アプリ、バイナリ、シェーダー、モデルを放り込み、それが何をするのかを尋ねられます。[Agent Client Protocol](https://agentclientprotocol.com) を話すエージェントならどれでも、コードを読み、参照をたどり、関数の名前を変更し、メモを残し、パッチを提案できます。あなたは同じウィンドウで見守り、承認します。

解析は [REA](https://github.com/morluto/rea) を通じて [Ghidra](https://ghidra-sre.org) 上で実行されます。UI は React で書かれ、[GPUIX](https://www.npmjs.com/package/@gpuix/react) によって GPUI 上にネイティブに描画されます。

## 機能

- **エージェントは持ち込み。** Aster、Claude、Codex、Gemini、Cursor、Copilot、OpenCode など、あらゆる ACP エージェント。同じプロジェクトで複数を同時に動かせ、それぞれが独立したチャットを持ちます。
- **エージェントがウィンドウを操作します。** Eleven は独自の MCP ツールを提供するので、エージェントは関数を開き、ビューを切り替え、名前を変更し、メモを追加し、パッチを提案できます。
- **主導権はあなたにあります。** あなたやエージェントによる変更はすべて実行者とともに記録され、元に戻せます。エージェントからのバイトパッチは提案として届き、あなたが承認するか却下します。
- **Mach-O、ELF、PE。** 関数、擬似コード、アセンブリ、制御フローグラフ、相互参照、文字列、セグメント、16 進表示。
- **プロジェクト。** プロジェクトは 1 つのアプリまたはバイナリです。そのチャット、名前の変更、ブックマーク、メモ、パッチは開き直しても残ります。
- **パッチ適用。** アドレス上のバイトを編集し、パッチ済みのコピーを書き出します。元のファイルは決して変更されません。
- **差分比較。** 2 つのビルドを関数単位で比較し、擬似コードのどこが変わったかを確認します。
- **デバッグ。** LLDB の下でプログラムを実行し、見ている関数でブレークし、ステップ実行してローカル変数を読みます。
- **シェーダー、モデル、GPU プロファイル。** Metal シェーダーと ML モデルファイルはワークベンチで開き、それらを読み込むコードに紐づきます。プロファイルは Instruments で行います。
- **Playbook。** 初回調査、関数の命名、機能の追跡、ネットワークマップといった組み込みスキルは、どのエージェントでも使えます。
- **エクスポート。** 擬似コード、アセンブリ、Objective-C のクラス一覧。

## インストール

Eleven は Apple Silicon 上の macOS 14 以降で動作します。

```sh
curl -fsSL https://raw.githubusercontent.com/Zfinix/eleven/main/install.sh | sh
```

これにより `Eleven.app` が `/Applications` にインストールされます。ビルドはまだ公証されていないため、インストーラがダウンロード隔離属性を代わりに解除します。

Eleven には次のものも必要です。

- **Ghidra 12.x。** [ghidra-sre.org](https://ghidra-sre.org) からダウンロードし、`~/.local/share` または `~/Applications` に展開するか、`GHIDRA_INSTALL_DIR` を設定します。
- **JDK 21 以降。** `brew install openjdk@21` で構いません。Eleven は自分で見つけます。
- **エージェント。** 初回起動時に 1 つ選びます。必要になれば Eleven が ACP アダプタをインストールします。

## ソースからのビルド

[Bun](https://bun.sh)、Node 20 以降、前述の Ghidra と JDK、そしてこのリポジトリの隣に REA 6.x のチェックアウト（`../rea`）があるか、それを指す `ELEVEN_REA` が必要です。

```sh
git clone https://github.com/Zfinix/eleven
git clone https://github.com/Zfinix/rea
cd eleven/app
bun install
bun run dev
```

| コマンド | 内容 |
| --- | --- |
| `bun run dev [file]` | ホットリロード付きでアプリを実行し、任意でファイルを開く |
| `bunx tsc --noEmit --noUnusedLocals` | アプリ、テスト、スクリプトの型チェックを行う |
| `./script/test` | テストスイートを 1 ファイルずつ実行する |
| `./script/bundle-macos` | `build/Eleven.app` をビルドする |
| `./script/package` | リリースをビルド、署名、zip 化する |

## 環境変数

以下はすべて任意です。Eleven はよくあるインストール先を自分で見つけます。

| 変数 | 用途 |
| --- | --- |
| `GHIDRA_INSTALL_DIR` | 使用する Ghidra のインストール先 |
| `JAVA_HOME` | Ghidra の実行に使う JDK |
| `ELEVEN_REA` | 同梱のものではなく使用する REA |
| `ELEVEN_LLDB_DAP` | デバッガ用の `lldb-dap` |
| `ELEVEN_SUPPORT` | Eleven がプロジェクトと設定を保存する場所 |
| `ELEVEN_SIGN_IDENTITY` | `./script/package` 用のコード署名 ID |

## ドキュメント

- [MCP ツール](docs/mcp-tools.md)：Eleven でエージェントが使えるすべてのツール、各ツールの入出力、権限とプライバシー。
- [スキル](docs/skills.md)：組み込みのプレイブックと、独自のスキルの書き方。

## リポジトリ構成

- `app/` はアプリ本体です。GPUIX 上の React と TypeScript。
- `crates/` は初期の Rust プロトタイプで、参考として残しています。アプリはこれを使用しません。
- `launch/` は Remotion で制作したローンチ動画です。
- `install.sh` はインストーラです。

コードの構成と従うルールについては [AGENTS.md](AGENTS.md) を参照してください。

## ライセンス

Eleven は [Apache License 2.0](LICENSE) の下で公開されています。同梱のサードパーティコードは [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) に記載されています。エージェントのロゴはそれぞれの所有者に帰属し、それらのエージェントを識別するためだけに表示されています。
