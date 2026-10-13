<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/icon-dark.png">
    <img src="docs/images/icon-light.png" width="128" alt="Eleven">
  </picture>
</p>

<h1 align="center">Eleven</h1>

<p align="center">Aplikasi reverse engineering yang mengutamakan agen untuk macOS.</p>

<div align="center">

[English](README.md) · [简体中文](README_zh.md) · [繁體中文](README_zh-TW.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [Türkçe](README_tr.md) · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · [ไทย](README_th.md) · [Deutsch](README_de.md) · [Español](README_es.md) · [Français](README_fr.md) · [Українська](README_uk.md) · [Polski](README_pl.md) · [Português (Brasil)](README_pt-BR.md) · [العربية](README_ar.md) · [فارسی](README_fa.md) · **Bahasa Indonesia** · [Italiano](README_it.md)

</div>

<p align="center">
  <img src="docs/images/home.png" width="820" alt="Eleven home screen">
</p>

Eleven adalah aplikasi reverse engineering yang dibangun di sekitar agen. Masukkan sebuah aplikasi, biner, shader, atau model lalu tanyakan apa fungsinya. Agen apa pun yang berbicara [Agent Client Protocol](https://agentclientprotocol.com) dapat membaca kode, mengikuti referensi, mengganti nama fungsi, meninggalkan catatan, dan menyarankan patch, sementara Anda menonton dan menyetujuinya di jendela yang sama.

Analisis berjalan di [Ghidra](https://ghidra-sre.org) melalui [REA](https://github.com/morluto/rea). Antarmuka penggunanya adalah React yang dirender secara native di GPUI oleh [GPUIX](https://www.npmjs.com/package/@gpuix/react).

## Fitur

- **Pakai agen Anda sendiri.** Aster, Claude, Codex, Gemini, Cursor, Copilot, OpenCode dan agen ACP lain mana pun. Jalankan beberapa agen pada proyek yang sama, masing-masing di chatnya sendiri.
- **Agen yang mengendalikan jendela.** Eleven menyediakan alat MCP-nya sendiri sehingga agen dapat membuka sebuah fungsi, berganti tampilan, mengganti nama, menambahkan catatan dan mengusulkan patch.
- **Kendali tetap di tangan Anda.** Setiap perubahan, baik dari Anda maupun dari agen, dicatat beserta penulisnya dan dapat dibatalkan. Patch byte dari agen datang sebagai saran yang Anda terima atau tolak.
- **Mach-O, ELF dan PE.** Fungsi, pseudocode, assembly, graf alur kendali, referensi silang, string, segmen dan hex.
- **Proyek.** Satu proyek adalah satu aplikasi atau biner. Chat, penggantian nama, bookmark, catatan dan patch-nya tetap ada saat dibuka kembali.
- **Patching.** Edit byte pada sebuah alamat dan tulis salinan yang sudah dipatch. Berkas aslinya tidak pernah disentuh.
- **Diffing.** Bandingkan dua build berdasarkan fungsi dan lihat apa yang berubah pada pseudocode.
- **Debugging.** Jalankan program di bawah LLDB, berhenti pada fungsi yang sedang Anda lihat, jalankan per langkah dan baca variabel lokal.
- **Shader, model dan profil GPU.** Shader Metal dan berkas model ML terbuka di workbench, tertaut ke kode yang memuatnya. Profilkan dengan Instruments.
- **Playbook.** Keterampilan bawaan seperti tinjauan awal, penamaan fungsi, penelusuran fitur dan peta jaringan berfungsi dengan agen apa pun.
- **Ekspor.** Pseudocode, assembly dan inventaris kelas Objective-C.

## Instalasi

Eleven berjalan di macOS 14 atau lebih baru pada Apple Silicon.

```sh
curl -fsSL https://raw.githubusercontent.com/Zfinix/eleven/main/install.sh | sh
```

Perintah ini memasang `Eleven.app` ke `/Applications`. Build-nya belum dinotarisasi, jadi installer membersihkan karantina unduhan untuk Anda.

Eleven juga memerlukan:

- **Ghidra 12.x.** Unduh dari [ghidra-sre.org](https://ghidra-sre.org) dan ekstrak di `~/.local/share` atau `~/Applications`, atau setel `GHIDRA_INSTALL_DIR`.
- **JDK, versi 21 atau lebih baru.** `brew install openjdk@21` bisa dipakai. Eleven menemukannya sendiri.
- **Sebuah agen.** Pilih satu saat pertama kali dijalankan. Eleven memasang adapter ACP untuk Anda bila diperlukan.

## Build dari sumber

Anda memerlukan [Bun](https://bun.sh), Node 20 atau lebih baru, Ghidra dan JDK seperti di atas, serta salinan REA 6.x di sebelah repo ini (`../rea`), atau `ELEVEN_REA` yang menunjuk ke salah satunya.

```sh
git clone https://github.com/Zfinix/eleven
git clone https://github.com/Zfinix/rea
cd eleven/app
bun install
bun run dev
```

| Perintah | Fungsinya |
| --- | --- |
| `bun run dev [file]` | Menjalankan aplikasi dengan hot reload, dan opsional membuka sebuah berkas |
| `bunx tsc --noEmit --noUnusedLocals` | Memeriksa tipe aplikasi, tes dan skrip |
| `./script/test` | Menjalankan rangkaian tes satu berkas setiap kali |
| `./script/bundle-macos` | Membangun `build/Eleven.app` |
| `./script/package` | Membangun, menandatangani dan memaketkan rilis |

## Variabel lingkungan

Semua ini opsional. Eleven menemukan lokasi pemasangan yang umum dengan sendirinya.

| Variabel | Kegunaan |
| --- | --- |
| `GHIDRA_INSTALL_DIR` | Instalasi Ghidra yang dipakai |
| `JAVA_HOME` | JDK untuk menjalankan Ghidra |
| `ELEVEN_REA` | REA yang dipakai sebagai ganti versi bawaan |
| `ELEVEN_LLDB_DAP` | `lldb-dap` untuk debugger |
| `ELEVEN_SUPPORT` | Tempat Eleven menyimpan proyek dan pengaturan |
| `ELEVEN_SIGN_IDENTITY` | Identitas penandatanganan kode untuk `./script/package` |

## Dokumentasi

- [Alat MCP](docs/mcp-tools.md): semua alat yang didapat agen di Eleven, apa yang diterima dan dikembalikan setiap alat, izin dan privasi.
- [Skill](docs/skills.md): playbook bawaan dan cara menulis milikmu sendiri.

## Repositori

- `app/` adalah aplikasinya: React dan TypeScript di atas GPUIX.
- `crates/` adalah prototipe Rust yang lebih awal, disimpan sebagai referensi. Aplikasi tidak memakainya.
- `launch/` adalah video peluncuran, dibuat dengan Remotion.
- `install.sh` adalah installer.

Lihat [AGENTS.md](AGENTS.md) untuk mengetahui bagaimana kode ditata dan aturan yang diikutinya.

## Lisensi

Eleven dirilis di bawah [Apache License 2.0](LICENSE). Kode pihak ketiga yang dibundel terdaftar di [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Logo agen milik pemiliknya masing-masing dan hanya ditampilkan untuk mengidentifikasi agen tersebut.
