<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/icon-dark.png">
    <img src="docs/images/icon-light.png" width="128" alt="Eleven">
  </picture>
</p>

<h1 align="center">Eleven</h1>

<p align="center">แอป reverse engineering ที่ให้ agent เป็นศูนย์กลางสำหรับ macOS</p>

<div align="center">

[English](README.md) · [简体中文](README_zh.md) · [繁體中文](README_zh-TW.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [Türkçe](README_tr.md) · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · **ไทย** · [Deutsch](README_de.md) · [Español](README_es.md) · [Français](README_fr.md) · [Українська](README_uk.md) · [Polski](README_pl.md) · [Português (Brasil)](README_pt-BR.md) · [العربية](README_ar.md) · [فارسی](README_fa.md) · [Bahasa Indonesia](README_id.md) · [Italiano](README_it.md)

</div>

<p align="center">
  <img src="docs/images/home.png" width="820" alt="Eleven home screen">
</p>

Eleven เป็นแอป reverse engineering ที่สร้างขึ้นโดยมี agent เป็นศูนย์กลาง วางแอป ไฟล์ไบนารี shader หรือโมเดลลงไป แล้วถามว่ามันทำอะไร agent ตัวใดก็ตามที่พูด [Agent Client Protocol](https://agentclientprotocol.com) ได้ สามารถอ่านโค้ด ตามการอ้างอิง เปลี่ยนชื่อฟังก์ชัน ทิ้งโน้ต และเสนอแพตช์ ในขณะที่คุณดูและอนุมัติในหน้าต่างเดียวกัน

การวิเคราะห์ทำงานบน [Ghidra](https://ghidra-sre.org) ผ่าน [REA](https://github.com/morluto/rea) ส่วน UI เป็น React ที่เรนเดอร์แบบเนทีฟบน GPUI ด้วย [GPUIX](https://www.npmjs.com/package/@gpuix/react)

## ฟีเจอร์

- **ใช้ agent ของคุณเอง** Aster, Claude, Codex, Gemini, Cursor, Copilot, OpenCode และ agent ACP ตัวอื่น ๆ รันหลายตัวบนโปรเจกต์เดียวกัน แต่ละตัวมีแชตของตัวเอง
- **Agent ขับเคลื่อนหน้าต่าง** Eleven ให้บริการ MCP tool ของตัวเอง เพื่อให้ agent เปิดฟังก์ชัน สลับมุมมอง เปลี่ยนชื่อ เพิ่มโน้ต และเสนอแพตช์ได้
- **คุณยังควบคุมอยู่** ทุกการเปลี่ยนแปลงของคุณหรือของ agent ถูกบันทึกพร้อมผู้ทำและย้อนกลับได้ แพตช์ระดับไบต์จาก agent มาในรูปข้อเสนอที่คุณตอบรับหรือปฏิเสธ
- **Mach-O, ELF และ PE** ฟังก์ชัน pseudocode แอสเซมบลี กราฟควบคุมการไหล การอ้างอิงข้าม สตริง เซกเมนต์ และ hex
- **โปรเจกต์** หนึ่งโปรเจกต์คือหนึ่งแอปหรือหนึ่งไบนารี แชต ชื่อที่เปลี่ยน บุ๊กมาร์ก โน้ต และแพตช์ยังอยู่หลังเปิดใหม่
- **การแพตช์** แก้ไบต์ที่แอดเดรสหนึ่งและเขียนสำเนาที่แพตช์แล้ว ต้นฉบับไม่ถูกแตะต้อง
- **การเทียบต่าง** เทียบสองบิลด์ตามฟังก์ชันและดูว่า pseudocode เปลี่ยนตรงไหน
- **การดีบัก** รันโปรแกรมใต้ LLDB หยุดที่ฟังก์ชันที่คุณกำลังดู step และอ่านค่าตัวแปรโลคัล
- **Shader โมเดล และ GPU profile** Metal shader และไฟล์โมเดล ML เปิดในเวิร์กเบนช์ เชื่อมกับโค้ดที่โหลดมัน โปรไฟล์ด้วย Instruments
- **Playbook** สกิลในตัว เช่น first look, name functions, trace a feature และ network map ใช้ได้กับ agent ทุกตัว
- **การส่งออก** pseudocode แอสเซมบลี และรายการคลาส Objective-C

## การติดตั้ง

Eleven ทำงานบน macOS 14 ขึ้นไปบน Apple Silicon

```sh
curl -fsSL https://raw.githubusercontent.com/Zfinix/eleven/main/install.sh | sh
```

คำสั่งนี้ติดตั้ง `Eleven.app` ไว้ใน `/Applications` บิลด์ยังไม่ได้ทำ notarization ตัวติดตั้งจึงล้าง quarantine ของไฟล์ดาวน์โหลดให้

Eleven ยังต้องมี:

- **Ghidra 12.x** ดาวน์โหลดได้จาก [ghidra-sre.org](https://ghidra-sre.org) แล้วแตกไฟล์ไว้ใน `~/.local/share` หรือ `~/Applications` หรือตั้งค่า `GHIDRA_INSTALL_DIR`
- **JDK เวอร์ชัน 21 ขึ้นไป** ใช้ `brew install openjdk@21` ก็ได้ Eleven หาเจอเอง
- **Agent** เลือกหนึ่งตัวตอนเปิดครั้งแรก Eleven ติดตั้ง ACP adapter ให้เมื่อจำเป็น

## บิลด์จากซอร์ส

คุณต้องมี [Bun](https://bun.sh) Node 20 ขึ้นไป Ghidra และ JDK ตามข้างบน รวมทั้งเช็กเอาต์ของ REA 6.x ที่วางไว้ข้าง repo นี้ (`../rea`) หรือ `ELEVEN_REA` ที่ชี้ไปยังเช็กเอาต์นั้น

```sh
git clone https://github.com/Zfinix/eleven
git clone https://github.com/Zfinix/rea
cd eleven/app
bun install
bun run dev
```

| คำสั่ง | สิ่งที่ทำ |
| --- | --- |
| `bun run dev [file]` | รันแอปพร้อม hot reload และเลือกเปิดไฟล์ได้ |
| `bunx tsc --noEmit --noUnusedLocals` | ตรวจชนิดให้ app, เทสต์ และสคริปต์ |
| `./script/test` | รันชุดเทสต์ทีละไฟล์ |
| `./script/bundle-macos` | บิลด์ `build/Eleven.app` |
| `./script/package` | บิลด์ เซ็น และบีบอัดเป็นรีลีส |

## ตัวแปรสภาพแวดล้อม

ทั้งหมดนี้เป็นทางเลือก Eleven หาตำแหน่งติดตั้งตามปกติเจอเอง

| ตัวแปร | การใช้ |
| --- | --- |
| `GHIDRA_INSTALL_DIR` | Ghidra ที่จะใช้ |
| `JAVA_HOME` | JDK ที่ใช้รัน Ghidra |
| `ELEVEN_REA` | REA ที่จะใช้แทนตัวที่มาพร้อมแอป |
| `ELEVEN_LLDB_DAP` | `lldb-dap` สำหรับดีบักเกอร์ |
| `ELEVEN_SUPPORT` | ที่เก็บโปรเจกต์และการตั้งค่าของ Eleven |
| `ELEVEN_SIGN_IDENTITY` | ตัวตนสำหรับเซ็นโค้ดของ `./script/package` |

## เอกสาร

- [เครื่องมือ MCP](docs/mcp-tools.md): เครื่องมือทั้งหมดที่เอเจนต์ใช้ได้ใน Eleven แต่ละตัวรับและคืนอะไร รวมถึงสิทธิ์และความเป็นส่วนตัว
- [สกิล](docs/skills.md): เพลย์บุ๊กที่มีมาให้ และวิธีเขียนของคุณเอง

## รีโพซิทอรี

- `app/` คือตัวแอป: React และ TypeScript บน GPUIX
- `launch/` คือวิดีโอเปิดตัว ทำด้วย Remotion
- `install.sh` คือตัวติดตั้ง

ดู [AGENTS.md](AGENTS.md) ว่าโค้ดถูกจัดวางอย่างไรและมีกฎอะไรที่มันยึดถือ

## สัญญาอนุญาต

Eleven เผยแพร่ภายใต้ [Apache License 2.0](LICENSE) โค้ดของบุคคลที่สามที่มาด้วยถูกระบุไว้ใน [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) โลโก้ของ agent เป็นของเจ้าของแต่ละราย และปรากฏขึ้นเพียงเพื่อระบุตัว agent เท่านั้น
