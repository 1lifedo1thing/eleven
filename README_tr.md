<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/icon-dark.png">
    <img src="docs/images/icon-light.png" width="128" alt="Eleven">
  </picture>
</p>

<h1 align="center">Eleven</h1>

<p align="center">macOS için ajan öncelikli bir tersine mühendislik uygulaması.</p>

<div align="center">

[English](README.md) · [简体中文](README_zh.md) · [繁體中文](README_zh-TW.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · **Türkçe** · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · [ไทย](README_th.md) · [Deutsch](README_de.md) · [Español](README_es.md) · [Français](README_fr.md) · [Українська](README_uk.md) · [Polski](README_pl.md) · [Português (Brasil)](README_pt-BR.md) · [العربية](README_ar.md) · [فارسی](README_fa.md) · [Bahasa Indonesia](README_id.md) · [Italiano](README_it.md)

</div>

<p align="center">
  <img src="docs/images/home.png" width="820" alt="Eleven home screen">
</p>

Eleven, ajanlar etrafında kurulmuş bir tersine mühendislik uygulamasıdır. Bir uygulama, ikili dosya, shader veya model bırakın ve ne yaptığını sorun. [Agent Client Protocol](https://agentclientprotocol.com) konuşan herhangi bir ajan kodu okuyabilir, referansları takip edebilir, fonksiyonları yeniden adlandırabilir, not bırakabilir ve yama önerebilir; siz de aynı pencerede izleyip onaylarsınız.

Analiz, [REA](https://github.com/morluto/rea) üzerinden [Ghidra](https://ghidra-sre.org) üzerinde çalışır. Arayüz, [GPUIX](https://www.npmjs.com/package/@gpuix/react) ile GPUI üzerinde yerel olarak işlenen React'tir.

## Özellikler

- **Ajanınızı kendiniz getirin.** Aster, Claude, Codex, Gemini, Cursor, Copilot, OpenCode ve diğer tüm ACP ajanları. Aynı projede birkaçını çalıştırın, her biri kendi sohbetinde.
- **Pencereyi ajanlar yönetir.** Eleven kendi MCP araçlarını sunar, böylece bir ajan fonksiyon açabilir, görünüm değiştirebilir, yeniden adlandırabilir, not ekleyebilir ve yama önerebilir.
- **Kontrol sizde kalır.** Sizin veya bir ajanın yaptığı her değişiklik, yazarıyla birlikte kaydedilir ve geri alınabilir. Ajanlardan gelen bayt yamaları, kabul veya reddettiğiniz öneriler olarak gelir.
- **Mach-O, ELF ve PE.** Fonksiyonlar, sözde kod, assembly, denetim akışı grafiği, çapraz referanslar, string'ler, segmentler ve hex.
- **Projeler.** Bir proje tek bir uygulama veya ikili dosyadır. Sohbetleri, yeniden adlandırmaları, yer imleri, notları ve yamaları yeniden açıldığında korunur.
- **Yamalama.** Bir adresteki baytları düzenleyin ve yamalanmış bir kopya yazın. Orijinal asla değiştirilmez.
- **Fark alma.** İki derlemeyi fonksiyon bazında karşılaştırın ve sözde kodda neyin değiştiğini görün.
- **Hata ayıklama.** Bir programı LLDB altında çalıştırın, baktığınız fonksiyona breakpoint koyun, adım adım ilerleyin ve yerel değişkenleri okuyun.
- **Shader'lar, modeller ve GPU profilleri.** Metal shader'ları ve ML model dosyaları, onları yükleyen kodla bağlantılı olarak çalışma tezgahında açılır. Instruments ile profil çıkarın.
- **Playbook'lar.** İlk bakış, fonksiyonları adlandırma, bir özelliği izleme ve ağ haritası gibi yerleşik beceriler her ajanla çalışır.
- **Dışa aktarma.** Sözde kod, assembly ve Objective-C sınıf envanterleri.

## Kurulum

Eleven, Apple Silicon üzerinde macOS 14 veya üzerinde çalışır.

```sh
curl -fsSL https://raw.githubusercontent.com/Zfinix/eleven/main/install.sh | sh
```

Bu komut `Eleven.app` uygulamasını `/Applications` içine kurar. Derlemeler henüz noter onaylı değil, bu yüzden kurucu indirme karantinasını sizin için kaldırır.

Eleven ayrıca şunlara ihtiyaç duyar:

- **Ghidra 12.x.** [ghidra-sre.org](https://ghidra-sre.org) adresinden indirip `~/.local/share` veya `~/Applications` içine çıkarın ya da `GHIDRA_INSTALL_DIR` değişkenini ayarlayın.
- **JDK 21 veya üzeri.** `brew install openjdk@21` işe yarar. Eleven onu kendi bulur.
- **Bir ajan.** İlk çalıştırmada birini seçin. Gerektiğinde Eleven sizin için ACP bağdaştırıcılarını kurar.

## Kaynaktan derleme

[Bun](https://bun.sh), Node 20 veya üzeri, yukarıdaki gibi Ghidra ve bir JDK, ayrıca bu deponun yanında bir REA 6.x kopyası (`../rea`) ya da ona işaret eden `ELEVEN_REA` gerekir.

```sh
git clone https://github.com/Zfinix/eleven
git clone https://github.com/Zfinix/rea
cd eleven/app
bun install
bun run dev
```

| Komut | Ne yapar |
| --- | --- |
| `bun run dev [file]` | Uygulamayı sıcak yeniden yükleme ile çalıştırır, isteğe bağlı olarak bir dosya açar |
| `bunx tsc --noEmit --noUnusedLocals` | Uygulamanın, testlerin ve betiklerin tiplerini denetler |
| `./script/test` | Test paketini her seferinde bir dosya olacak şekilde çalıştırır |
| `./script/bundle-macos` | `build/Eleven.app` oluşturur |
| `./script/package` | Bir sürümü derler, imzalar ve sıkıştırır |

## Ortam değişkenleri

Bunların tümü isteğe bağlıdır. Eleven olağan kurulum konumlarını kendi bulur.

| Değişken | Kullanım |
| --- | --- |
| `GHIDRA_INSTALL_DIR` | Kullanılacak Ghidra kurulumu |
| `JAVA_HOME` | Ghidra'yı çalıştıracak JDK |
| `ELEVEN_REA` | Paketlenmiş olan yerine kullanılacak REA |
| `ELEVEN_LLDB_DAP` | Hata ayıklayıcı için `lldb-dap` |
| `ELEVEN_SUPPORT` | Eleven'ın projeleri ve ayarları sakladığı yer |
| `ELEVEN_SIGN_IDENTITY` | `./script/package` için kod imzalama kimliği |

## Belgeler

- [MCP araçları](docs/mcp-tools.md): Eleven’da ajanların eriştiği tüm araçlar, her birinin aldığı ve döndürdüğü şeyler, izinler ve gizlilik.
- [Beceriler](docs/skills.md): yerleşik playbooklar ve kendi becerinizi yazma yolu.

## Depo

- `app/` uygulamadır: GPUIX üzerinde React ve TypeScript.
- `crates/` referans için saklanan daha eski bir Rust prototipidir. Uygulama bunu kullanmaz.
- `launch/` Remotion ile yapılmış tanıtım videosudur.
- `install.sh` kurucudur.

Kodun nasıl düzenlendiğini ve hangi kurallara uyduğunu [AGENTS.md](AGENTS.md) dosyasında görebilirsiniz.

## Lisans

Eleven, [Apache License 2.0](LICENSE) altında yayımlanır. Pakete dahil edilen üçüncü taraf kodlar [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) dosyasında listelenmiştir. Ajan logoları sahiplerine aittir ve yalnızca o ajanları tanımlamak için görünür.
