<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/icon-dark.png">
    <img src="docs/images/icon-light.png" width="128" alt="Eleven">
  </picture>
</p>

<h1 align="center">Eleven</h1>

<p align="center">Ứng dụng dịch ngược lấy agent làm trung tâm cho macOS.</p>

<div align="center">

[English](README.md) · [简体中文](README_zh.md) · [繁體中文](README_zh-TW.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [Türkçe](README_tr.md) · [Русский](README_ru.md) · **Tiếng Việt** · [ไทย](README_th.md) · [Deutsch](README_de.md) · [Español](README_es.md) · [Français](README_fr.md) · [Українська](README_uk.md) · [Polski](README_pl.md) · [Português (Brasil)](README_pt-BR.md) · [العربية](README_ar.md) · [فارسی](README_fa.md) · [Bahasa Indonesia](README_id.md) · [Italiano](README_it.md)

</div>

<p align="center">
  <img src="docs/images/home.png" width="820" alt="Eleven home screen">
</p>

Eleven là một ứng dụng dịch ngược được xây dựng xoay quanh các agent. Thả vào một ứng dụng, một binary, một shader hay một model rồi hỏi nó làm gì. Bất kỳ agent nào nói được [Agent Client Protocol](https://agentclientprotocol.com) đều có thể đọc mã, lần theo tham chiếu, đổi tên hàm, để lại ghi chú và đề xuất bản vá, trong khi bạn quan sát và phê duyệt ngay trong cùng một cửa sổ.

Phân tích chạy trên [Ghidra](https://ghidra-sre.org) thông qua [REA](https://github.com/morluto/rea). Giao diện là React, được render native trên GPUI bởi [GPUIX](https://www.npmjs.com/package/@gpuix/react).

## Tính năng

- **Mang theo agent của bạn.** Aster, Claude, Codex, Gemini, Cursor, Copilot, OpenCode và bất kỳ agent ACP nào khác. Chạy nhiều agent trên cùng một project, mỗi agent có chat riêng.
- **Agent điều khiển cửa sổ.** Eleven cung cấp các MCP tool của riêng mình để agent có thể mở một hàm, chuyển view, đổi tên, thêm ghi chú và đề xuất bản vá.
- **Bạn vẫn nắm quyền kiểm soát.** Mọi thay đổi của bạn hay của agent đều được ghi log kèm tác giả và có thể hoàn tác. Byte patch từ agent đến dưới dạng đề xuất để bạn chấp nhận hoặc từ chối.
- **Mach-O, ELF và PE.** Hàm, pseudocode, assembly, đồ thị luồng điều khiển, tham chiếu chéo, chuỗi, segment và hex.
- **Project.** Một project là một ứng dụng hoặc một binary. Chat, tên đã đổi, bookmark, ghi chú và bản vá của nó vẫn còn sau khi mở lại.
- **Vá.** Sửa byte tại một địa chỉ và ghi ra bản sao đã vá. Bản gốc không bao giờ bị đụng tới.
- **So sánh.** So sánh hai bản build theo hàm và xem pseudocode đã thay đổi những gì.
- **Gỡ lỗi.** Chạy chương trình dưới LLDB, dừng tại hàm bạn đang xem, step và đọc biến cục bộ.
- **Shader, model và GPU profile.** Metal shader và file model ML mở trong workbench, liên kết với đoạn mã nạp chúng. Profile bằng Instruments.
- **Playbook.** Các skill có sẵn như first look, name functions, trace a feature và network map hoạt động với mọi agent.
- **Xuất.** Pseudocode, assembly và danh mục class Objective-C.

## Cài đặt

Eleven chạy trên macOS 14 trở lên trên Apple Silicon.

```sh
curl -fsSL https://raw.githubusercontent.com/Zfinix/eleven/main/install.sh | sh
```

Lệnh này cài `Eleven.app` vào `/Applications`. Các bản build chưa được notarize, nên trình cài đặt tự xóa thuộc tính quarantine khi tải về cho bạn.

Eleven cũng cần:

- **Ghidra 12.x.** Tải từ [ghidra-sre.org](https://ghidra-sre.org) và giải nén vào `~/.local/share` hoặc `~/Applications`, hay đặt `GHIDRA_INSTALL_DIR`.
- **Một JDK, 21 hoặc mới hơn.** `brew install openjdk@21` là được. Eleven tự tìm thấy nó.
- **Một agent.** Chọn một cái ở lần chạy đầu tiên. Eleven cài ACP adapter cho bạn khi cần.

## Build từ mã nguồn

Bạn cần [Bun](https://bun.sh), Node 20 trở lên, Ghidra và một JDK như trên, cùng một bản checkout REA 6.x nằm cạnh repo này (`../rea`), hoặc `ELEVEN_REA` trỏ tới một bản như vậy.

```sh
git clone https://github.com/Zfinix/eleven
git clone https://github.com/Zfinix/rea
cd eleven/app
bun install
bun run dev
```

| Lệnh | Công dụng |
| --- | --- |
| `bun run dev [file]` | Chạy ứng dụng với hot reload, tùy chọn mở một file |
| `bunx tsc --noEmit --noUnusedLocals` | Kiểm tra kiểu cho app, test và script |
| `./script/test` | Chạy bộ test từng file một |
| `./script/bundle-macos` | Build `build/Eleven.app` |
| `./script/package` | Build, ký và nén thành bản release |

## Môi trường

Tất cả đều là tùy chọn. Eleven tự tìm các vị trí cài đặt thông thường.

| Biến | Công dụng |
| --- | --- |
| `GHIDRA_INSTALL_DIR` | Bản Ghidra để dùng |
| `JAVA_HOME` | JDK để chạy Ghidra |
| `ELEVEN_REA` | REA để dùng thay cho bản đi kèm |
| `ELEVEN_LLDB_DAP` | `lldb-dap` cho trình gỡ lỗi |
| `ELEVEN_SUPPORT` | Nơi Eleven lưu project và cài đặt |
| `ELEVEN_SIGN_IDENTITY` | Danh tính ký mã cho `./script/package` |

## Tài liệu

- [Công cụ MCP](docs/mcp-tools.md): mọi công cụ mà agent có trong Eleven, mỗi công cụ nhận và trả về gì, quyền và quyền riêng tư.
- [Kỹ năng](docs/skills.md): các playbook có sẵn và cách tự viết.

## Kho mã

- `app/` là ứng dụng: React và TypeScript trên GPUIX.
- `launch/` là video ra mắt, làm bằng Remotion.
- `install.sh` là trình cài đặt.

Xem [AGENTS.md](AGENTS.md) để biết mã được tổ chức thế nào và những quy tắc nó tuân theo.

## Giấy phép

Eleven được phát hành theo [Apache License 2.0](LICENSE). Mã bên thứ ba đi kèm được liệt kê trong [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Logo của các agent thuộc về chủ sở hữu của chúng và chỉ xuất hiện để nhận diện các agent đó.
