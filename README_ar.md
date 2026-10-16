<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/icon-dark.png">
    <img src="docs/images/icon-light.png" width="128" alt="Eleven">
  </picture>
</p>

<h1 align="center">Eleven</h1>

<p align="center">تطبيق هندسة عكسية موجّه بالوكلاء لنظام macOS.</p>

<div align="center">

[English](README.md) · [简体中文](README_zh.md) · [繁體中文](README_zh-TW.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [Türkçe](README_tr.md) · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · [ไทย](README_th.md) · [Deutsch](README_de.md) · [Español](README_es.md) · [Français](README_fr.md) · [Українська](README_uk.md) · [Polski](README_pl.md) · [Português (Brasil)](README_pt-BR.md) · **العربية** · [فارسی](README_fa.md) · [Bahasa Indonesia](README_id.md) · [Italiano](README_it.md)

</div>

<p align="center">
  <img src="docs/images/home.png" width="820" alt="Eleven home screen">
</p>

Eleven تطبيق هندسة عكسية مبني حول الوكلاء. ألقِ تطبيقًا أو ملفًا ثنائيًا أو shader أو نموذجًا واسأل عمّا يفعله. أي وكيل يتحدث [Agent Client Protocol](https://agentclientprotocol.com) يستطيع قراءة الشيفرة وتتبّع المراجع وإعادة تسمية الدوال وترك ملاحظات واقتراح تعديلات، بينما تشاهد أنت وتوافق في النافذة نفسها.

يجري التحليل على [Ghidra](https://ghidra-sre.org) عبر [REA](https://github.com/morluto/rea). الواجهة مكتوبة بـ React وتُعرض أصلًا على GPUI بواسطة [GPUIX](https://www.npmjs.com/package/@gpuix/react).

## المزايا

- **أحضر وكيلك الخاص.** Aster وClaude وCodex وGemini وCursor وCopilot وOpenCode وأي وكيل ACP آخر. شغّل عدة وكلاء على المشروع نفسه، كل واحد في محادثته.
- **الوكلاء يديرون النافذة.** يوفّر Eleven أدوات MCP الخاصة به، فيستطيع الوكيل فتح دالة والتنقل بين العروض وإعادة التسمية وإضافة ملاحظات واقتراح تعديلات.
- **تبقى أنت المتحكم.** كل تغيير، منك أو من وكيل، يُسجّل مع صاحبه ويمكن التراجع عنه. تعديلات البايتات الواردة من الوكلاء تصل كاقتراحات تقبلها أو ترفضها.
- **‏Mach-O وELF وPE.** الدوال والشيفرة الزائفة ولغة التجميع ومخطط تدفق التحكم والمراجع المتقاطعة والسلاسل النصية والمقاطع والتمثيل السادس عشري.
- **المشاريع.** المشروع هو تطبيق أو ملف ثنائي واحد. تبقى محادثاته وإعادة التسميات والعلامات والملاحظات والتعديلات بعد إعادة الفتح.
- **التعديل.** حرّر البايتات عند عنوان واكتب نسخة معدّلة. الأصل لا يُمس أبدًا.
- **المقارنة.** قارن بين إصدارين دالة بدالة وانظر ما تغيّر في الشيفرة الزائفة.
- **التنقيح.** شغّل برنامجًا تحت LLDB، وتوقف عند الدالة التي تنظر إليها، وتنقّل خطوة بخطوة واقرأ المتغيرات المحلية.
- **الـ shaders والنماذج وملفات تعريف GPU.** تُفتح shaders الـ Metal وملفات نماذج تعلّم الآلة في مساحة العمل، مرتبطة بالشيفرة التي تحمّلها. وقِس الأداء باستخدام Instruments.
- **الأدلة التطبيقية.** مهارات مدمجة مثل النظرة الأولى وتسمية الدوال وتتبّع ميزة وخريطة الشبكة تعمل مع أي وكيل.
- **التصدير.** الشيفرة الزائفة ولغة التجميع وقوائم أصناف Objective-C.

## التثبيت

يعمل Eleven على macOS 14 أو أحدث على Apple Silicon.

```sh
curl -fsSL https://raw.githubusercontent.com/Zfinix/eleven/main/install.sh | sh
```

يثبّت هذا الأمر `Eleven.app` في `/Applications`. الإصدارات ليست موقّعة بعد، لذا يزيل المثبّت حجر التنزيل عنك.

يحتاج Eleven أيضًا إلى:

- **‏Ghidra 12.x.** نزّله من [ghidra-sre.org](https://ghidra-sre.org) وفك ضغطه في `~/.local/share` أو `~/Applications`، أو اضبط `GHIDRA_INSTALL_DIR`.
- **‏JDK بإصدار 21 أو أحدث.** الأمر `brew install openjdk@21` يكفي. يعثر عليه Eleven بنفسه.
- **وكيل.** اختر واحدًا عند أول تشغيل. يثبّت Eleven محوّلات ACP لك عند الحاجة.

## البناء من الشيفرة المصدرية

تحتاج إلى [Bun](https://bun.sh) وNode 20 أو أحدث وGhidra وJDK كما سبق، وإلى نسخة من REA 6.x بجوار هذا المستودع (`../rea`)، أو متغير `ELEVEN_REA` يشير إلى واحدة.

```sh
git clone https://github.com/Zfinix/eleven
git clone https://github.com/Zfinix/rea
cd eleven/app
bun install
bun run dev
```

| الأمر | ما يفعله |
| --- | --- |
| `bun run dev [file]` | يشغّل التطبيق مع إعادة التحميل الفورية، ويفتح ملفًا إن أردت |
| `bunx tsc --noEmit --noUnusedLocals` | يفحص أنواع التطبيق والاختبارات والسكربتات |
| `./script/test` | يشغّل مجموعة الاختبارات ملفًا ملفًا |
| `./script/bundle-macos` | يبني `build/Eleven.app` |
| `./script/package` | يبني ويوقّع ويضغط إصدارًا للنشر |

## المتغيرات البيئية

كلها اختيارية. يعثر Eleven بنفسه على أماكن التثبيت المعتادة.

| المتغير | الاستخدام |
| --- | --- |
| `GHIDRA_INSTALL_DIR` | تثبيت Ghidra المراد استخدامه |
| `JAVA_HOME` | الـ JDK الذي يعمل به Ghidra |
| `ELEVEN_REA` | نسخة REA المستخدمة بدل المدمجة |
| `ELEVEN_LLDB_DAP` | `lldb-dap` الخاص بالمنقّح |
| `ELEVEN_SUPPORT` | المكان الذي يحفظ فيه Eleven المشاريع والإعدادات |
| `ELEVEN_SIGN_IDENTITY` | هوية توقيع الشيفرة الخاصة بـ `./script/package` |

## الوثائق

- [أدوات MCP](docs/mcp-tools.md): كل الأدوات المتاحة للوكلاء في Eleven، وما يأخذه كل منها ويعيده، والأذونات والخصوصية.
- [المهارات](docs/skills.md): الأدلة المدمجة وكيفية كتابة أدلتك.

## المستودع

- `app/` هو التطبيق: React وTypeScript على GPUIX.
- `launch/` فيديو الإطلاق، صُنع بـ Remotion.
- `install.sh` هو المثبّت.

راجع [AGENTS.md](AGENTS.md) لمعرفة كيفية تنظيم الشيفرة والقواعد التي تتبعها.

## الترخيص

يُصدر Eleven تحت [Apache License 2.0](LICENSE). الشيفرة الخارجية المضمّنة مدرجة في [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). شعارات الوكلاء ملك لأصحابها وتظهر فقط للتعريف بهؤلاء الوكلاء.
