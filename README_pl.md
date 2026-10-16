<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/icon-dark.png">
    <img src="docs/images/icon-light.png" width="128" alt="Eleven">
  </picture>
</p>

<h1 align="center">Eleven</h1>

<p align="center">Aplikacja do reverse engineeringu dla macOS, zbudowana wokół agentów.</p>

<div align="center">

[English](README.md) · [简体中文](README_zh.md) · [繁體中文](README_zh-TW.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [Türkçe](README_tr.md) · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · [ไทย](README_th.md) · [Deutsch](README_de.md) · [Español](README_es.md) · [Français](README_fr.md) · [Українська](README_uk.md) · **Polski** · [Português (Brasil)](README_pt-BR.md) · [العربية](README_ar.md) · [فارسی](README_fa.md) · [Bahasa Indonesia](README_id.md) · [Italiano](README_it.md)

</div>

<p align="center">
  <img src="docs/images/home.png" width="820" alt="Eleven home screen">
</p>

Eleven to aplikacja do reverse engineeringu zbudowana wokół agentów. Wrzuć aplikację, plik binarny, shader albo model i zapytaj, co robi. Każdy agent, który mówi w [Agent Client Protocol](https://agentclientprotocol.com), może czytać kod, podążać za odwołaniami, zmieniać nazwy funkcji, zostawiać notatki i proponować poprawki, a Ty patrzysz na to i zatwierdzasz w tym samym oknie.

Analiza działa na [Ghidra](https://ghidra-sre.org) przez [REA](https://github.com/morluto/rea). Interfejs to React renderowany natywnie na GPUI przez [GPUIX](https://www.npmjs.com/package/@gpuix/react).

## Funkcje

- **Przynieś własnego agenta.** Aster, Claude, Codex, Gemini, Cursor, Copilot, OpenCode i każdy inny agent ACP. Uruchom kilku w tym samym projekcie, każdy w osobnym czacie.
- **Agenci sterują oknem.** Eleven udostępnia własne narzędzia MCP, więc agent może otworzyć funkcję, przełączyć widok, zmienić nazwę, dodać notatki i zaproponować poprawki.
- **Ty zachowujesz kontrolę.** Każda zmiana, Twoja lub agenta, jest zapisywana wraz z autorem i można ją cofnąć. Poprawki bajtów od agentów przychodzą jako sugestie, które przyjmujesz albo odrzucasz.
- **Mach-O, ELF i PE.** Funkcje, pseudokod, asembler, graf przepływu sterowania, odwołania krzyżowe, łańcuchy, segmenty i hex.
- **Projekty.** Projekt to jedna aplikacja albo jeden plik binarny. Jego czaty, zmiany nazw, zakładki, notatki i poprawki przetrwają ponowne otwarcie.
- **Patchowanie.** Edytuj bajty pod adresem i zapisz załatany plik. Oryginał nigdy nie jest ruszany.
- **Porównywanie.** Porównaj dwa buildy funkcja po funkcji i zobacz, co zmieniło się w pseudokodzie.
- **Debugowanie.** Uruchom program pod LLDB, ustaw breakpoint na funkcji, którą oglądasz, wykonuj kroki i czytaj zmienne lokalne.
- **Shadery, modele i profile GPU.** Shadery Metal i pliki modeli ML otwierają się w workbenchu, powiązane z kodem, który je ładuje. Profiluj z Instruments.
- **Playbooki.** Wbudowane umiejętności, takie jak pierwsze spojrzenie, nazywanie funkcji, śledzenie funkcji i mapa sieci, działają z każdym agentem.
- **Eksport.** Pseudokod, asembler i spisy klas Objective-C.

## Instalacja

Eleven działa na macOS 14 lub nowszym na Apple Silicon.

```sh
curl -fsSL https://raw.githubusercontent.com/Zfinix/eleven/main/install.sh | sh
```

To instaluje `Eleven.app` do `/Applications`. Buildy nie są jeszcze notaryzowane, więc instalator samodzielnie zdejmuje kwarantannę pobierania.

Eleven potrzebuje też:

- **Ghidra 12.x.** Pobierz ją z [ghidra-sre.org](https://ghidra-sre.org) i rozpakuj w `~/.local/share` lub `~/Applications`, albo ustaw `GHIDRA_INSTALL_DIR`.
- **JDK, w wersji 21 lub nowszej.** `brew install openjdk@21` wystarczy. Eleven znajdzie go sam.
- **Agenta.** Wybierz jednego przy pierwszym uruchomieniu. Eleven sam instaluje adaptery ACP, gdy są potrzebne.

## Budowanie ze źródeł

Potrzebujesz [Bun](https://bun.sh), Node 20 lub nowszego, Ghidry i JDK jak wyżej, a także kopii REA 6.x obok tego repozytorium (`../rea`) albo `ELEVEN_REA` wskazującego na nią.

```sh
git clone https://github.com/Zfinix/eleven
git clone https://github.com/Zfinix/rea
cd eleven/app
bun install
bun run dev
```

| Polecenie | Co robi |
| --- | --- |
| `bun run dev [file]` | Uruchamia aplikację z hot reloadem, opcjonalnie otwierając plik |
| `bunx tsc --noEmit --noUnusedLocals` | Sprawdza typy w aplikacji, testach i skryptach |
| `./script/test` | Uruchamia testy, plik po pliku |
| `./script/bundle-macos` | Buduje `build/Eleven.app` |
| `./script/package` | Buduje, podpisuje i pakuje wydanie |

## Zmienne środowiskowe

Wszystkie są opcjonalne. Eleven sam znajduje typowe miejsca instalacji.

| Zmienna | Zastosowanie |
| --- | --- |
| `GHIDRA_INSTALL_DIR` | Instalacja Ghidry do użycia |
| `JAVA_HOME` | JDK, z którym ma działać Ghidra |
| `ELEVEN_REA` | REA do użycia zamiast dołączonego |
| `ELEVEN_LLDB_DAP` | `lldb-dap` dla debuggera |
| `ELEVEN_SUPPORT` | Gdzie Eleven trzyma projekty i ustawienia |
| `ELEVEN_SIGN_IDENTITY` | Tożsamość do podpisywania kodu dla `./script/package` |

## Dokumentacja

- [Narzędzia MCP](docs/mcp-tools.md): wszystkie narzędzia, które agenci dostają w Eleven, co każde przyjmuje i zwraca, uprawnienia i prywatność.
- [Skille](docs/skills.md): wbudowane playbooki i jak napisać własne.

## Repozytorium

- `app/` to aplikacja: React i TypeScript na GPUIX.
- `launch/` to film premierowy, zrobiony w Remotion.
- `install.sh` to instalator.

Zobacz [AGENTS.md](AGENTS.md), żeby poznać układ kodu i zasady, których przestrzega.

## Licencja

Eleven jest wydany na [Apache License 2.0](LICENSE). Dołączony kod osób trzecich jest wymieniony w [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Logotypy agentów należą do ich właścicieli i pojawiają się wyłącznie po to, by zidentyfikować tych agentów.
