<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/icon-dark.png">
    <img src="docs/images/icon-light.png" width="128" alt="Eleven">
  </picture>
</p>

<h1 align="center">Eleven</h1>

<p align="center">یک برنامهٔ مهندسی معکوس با محوریت عامل‌ها برای macOS.</p>

<div align="center">

[English](README.md) · [简体中文](README_zh.md) · [繁體中文](README_zh-TW.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [Türkçe](README_tr.md) · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · [ไทย](README_th.md) · [Deutsch](README_de.md) · [Español](README_es.md) · [Français](README_fr.md) · [Українська](README_uk.md) · [Polski](README_pl.md) · [Português (Brasil)](README_pt-BR.md) · [العربية](README_ar.md) · **فارسی** · [Bahasa Indonesia](README_id.md) · [Italiano](README_it.md)

</div>

<p align="center">
  <img src="docs/images/home.png" width="820" alt="Eleven home screen">
</p>

Eleven یک برنامهٔ مهندسی معکوس است که حول عامل‌ها ساخته شده است. یک اپلیکیشن، یک باینری، یک شیدر یا یک مدل را داخل آن بیندازید و بپرسید چه کاری انجام می‌دهد. هر عاملی که [Agent Client Protocol](https://agentclientprotocol.com) را پشتیبانی کند می‌تواند کد را بخواند، ارجاع‌ها را دنبال کند، توابع را تغییر نام دهد، یادداشت بگذارد و پچ پیشنهاد دهد، در حالی که شما در همان پنجره تماشا می‌کنید و تأیید می‌کنید.

تحلیل از طریق [REA](https://github.com/morluto/rea) روی [Ghidra](https://ghidra-sre.org) اجرا می‌شود. رابط کاربری React است که به‌صورت بومی روی GPUI توسط [GPUIX](https://www.npmjs.com/package/@gpuix/react) رندر می‌شود.

## ویژگی‌ها

- **عامل خودتان را بیاورید.** Aster، Claude، Codex، Gemini، Cursor، Copilot، OpenCode و هر عامل ACP دیگری. چند عامل را روی یک پروژه اجرا کنید، هر کدام در چت خودش.
- **عامل‌ها پنجره را هدایت می‌کنند.** Eleven ابزارهای MCP خودش را ارائه می‌دهد تا یک عامل بتواند تابعی را باز کند، نماها را عوض کند، نام‌گذاری کند، یادداشت اضافه کند و پچ پیشنهاد دهد.
- **کنترل دست شماست.** هر تغییری، از سوی شما یا یک عامل، همراه با نویسنده‌اش ثبت می‌شود و قابل بازگردانی است. پچ‌های بایتی عامل‌ها به‌صورت پیشنهادهایی می‌رسند که می‌پذیرید یا رد می‌کنید.
- **Mach-O، ELF و PE.** توابع، شبه‌کد، اسمبلی، گراف جریان کنترل، ارجاع‌های متقابل، رشته‌ها، سگمنت‌ها و هگزا.
- **پروژه‌ها.** هر پروژه یک اپلیکیشن یا باینری است. چت‌ها، تغییر نام‌ها، نشان‌ها، یادداشت‌ها و پچ‌هایش پس از باز کردن دوباره باقی می‌مانند.
- **پچ زدن.** بایت‌های یک آدرس را ویرایش کنید و یک نسخهٔ پچ‌شده بنویسید. نسخهٔ اصلی هرگز دست نمی‌خورد.
- **تفاوت‌گیری.** دو بیلد را بر اساس تابع مقایسه کنید و ببینید در شبه‌کد چه چیزی تغییر کرده است.
- **اشکال‌زدایی.** برنامه‌ای را زیر LLDB اجرا کنید، روی تابعی که در حال مشاهدهٔ آن هستید توقف کنید، گام‌به‌گام پیش بروید و متغیرهای محلی را بخوانید.
- **شیدرها، مدل‌ها و پروفایل‌های GPU.** شیدرهای Metal و فایل‌های مدل ML در میزکار باز می‌شوند و به کدی که آن‌ها را بارگذاری می‌کند پیوند دارند. با Instruments پروفایل بگیرید.
- **کتاب‌های راهنما.** مهارت‌های داخلی مانند نگاه اول، نام‌گذاری توابع، ردیابی یک ویژگی و نقشهٔ شبکه با هر عاملی کار می‌کنند.
- **خروجی گرفتن.** شبه‌کد، اسمبلی و فهرست کلاس‌های Objective-C.

## نصب

Eleven روی macOS 14 یا بالاتر روی Apple Silicon اجرا می‌شود.

```sh
curl -fsSL https://raw.githubusercontent.com/Zfinix/eleven/main/install.sh | sh
```

این فرمان `Eleven.app` را در `/Applications` نصب می‌کند. بیلدها هنوز نوتاریزه نشده‌اند، بنابراین نصب‌کننده قرنطینهٔ دانلود را برای شما پاک می‌کند.

Eleven همچنین به این‌ها نیاز دارد:

- **Ghidra 12.x.** آن را از [ghidra-sre.org](https://ghidra-sre.org) دانلود کنید و در `~/.local/share` یا `~/Applications` باز کنید، یا `GHIDRA_INSTALL_DIR` را تنظیم کنید.
- **یک JDK، نسخهٔ 21 یا جدیدتر.** `brew install openjdk@21` کار می‌کند. Eleven خودش آن را پیدا می‌کند.
- **یک عامل.** در اولین اجرا یکی را انتخاب کنید. Eleven در صورت نیاز آداپتورهای ACP را برای شما نصب می‌کند.

## ساخت از سورس

به [Bun](https://bun.sh)، Node 20 یا جدیدتر، Ghidra و یک JDK همان‌طور که بالا گفته شد، و یک checkout از REA 6.x در کنار این مخزن (`../rea`) نیاز دارید، یا `ELEVEN_REA` که به آن اشاره کند.

```sh
git clone https://github.com/Zfinix/eleven
git clone https://github.com/Zfinix/rea
cd eleven/app
bun install
bun run dev
```

| دستور | کاری که می‌کند |
| --- | --- |
| `bun run dev [file]` | برنامه را با بازخوانی سریع اجرا می‌کند و به‌طور اختیاری یک فایل را باز می‌کند |
| `bunx tsc --noEmit --noUnusedLocals` | برنامه، تست‌ها و اسکریپت‌ها را از نظر نوع بررسی می‌کند |
| `./script/test` | مجموعهٔ تست را یک فایل در هر نوبت اجرا می‌کند |
| `./script/bundle-macos` | `build/Eleven.app` را می‌سازد |
| `./script/package` | یک نسخهٔ انتشار را می‌سازد، امضا و فشرده می‌کند |

## متغیرهای محیطی

همهٔ این‌ها اختیاری‌اند. Eleven مسیرهای معمول نصب را خودش پیدا می‌کند.

| متغیر | کاربرد |
| --- | --- |
| `GHIDRA_INSTALL_DIR` | نصب Ghidra که استفاده می‌شود |
| `JAVA_HOME` | JDK برای اجرای Ghidra |
| `ELEVEN_REA` | REA که به‌جای نسخهٔ همراه استفاده می‌شود |
| `ELEVEN_LLDB_DAP` | `lldb-dap` برای اشکال‌زدا |
| `ELEVEN_SUPPORT` | جایی که Eleven پروژه‌ها و تنظیمات را نگه می‌دارد |
| `ELEVEN_SIGN_IDENTITY` | هویت امضای کد برای `./script/package` |

## مستندات

- [ابزارهای MCP](docs/mcp-tools.md): همه ابزارهایی که ایجنتها در Eleven دارند، هر کدام چه میگیرد و چه برمیگرداند، مجوزها و حریم خصوصی.
- [مهارتها](docs/skills.md): پلیبوکهای داخلی و اینکه چطور پلیبوک خودتان را بنویسید.

## مخزن

- `app/` خود برنامه است: React و TypeScript روی GPUIX.
- `crates/` یک نمونهٔ اولیهٔ Rust قدیمی‌تر است که برای مرجع نگه داشته شده. برنامه از آن استفاده نمی‌کند.
- `launch/` ویدیوی معرفی است که با Remotion ساخته شده.
- `install.sh` نصب‌کننده است.

برای اینکه کد چگونه چیده شده و از چه قواعدی پیروی می‌کند [AGENTS.md](AGENTS.md) را ببینید.

## مجوز

Eleven تحت [Apache License 2.0](LICENSE) منتشر می‌شود. کدهای شخص ثالث همراه در [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) فهرست شده‌اند. لوگوهای عامل‌ها متعلق به صاحبانشان است و فقط برای شناسایی آن عامل‌ها نمایش داده می‌شوند.
