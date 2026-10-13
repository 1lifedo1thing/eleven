use gpui_kit::*;

pub const MONO: &str = "Geist Mono";
pub const SANS: &str = ".SystemUIFont";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Appearance {
    Dark,
    Light,
    System,
}

/// The design tokens from the Eleven canvas, one set per appearance.
#[derive(Debug, Clone, Copy)]
pub struct Palette {
    pub win: Hsla,
    pub card: Hsla,
    pub deep: Hsla,
    pub deep2: Hsla,
    pub raised: Hsla,
    pub raised2: Hsla,
    pub fill: Hsla,
    pub fill2: Hsla,
    pub sel: Hsla,
    pub sel2: Hsla,
    pub line2: Hsla,
    pub line3: Hsla,
    pub text: Hsla,
    pub text2: Hsla,
    pub text3: Hsla,
    pub text4: Hsla,
    pub muted: Hsla,
    pub faint: Hsla,
    pub gutter: Hsla,
    pub primary: Hsla,
    pub on_primary: Hsla,
    pub link: Hsla,
    pub keyword: Hsla,
    pub string: Hsla,
    pub number: Hsla,
    pub kind: Hsla,
    pub call: Hsla,
    pub data: Hsla,
    pub error: Hsla,
    pub comment: Hsla,
    pub warn_bg: Hsla,
    pub warn_line: Hsla,
    pub on_warn: Hsla,
}

fn c(hex: u32) -> Hsla {
    rgb(hex).into()
}

const DARK: fn() -> Palette = || Palette {
    win: c(0x171717),
    card: c(0x0f0f0f),
    deep: c(0x0b0b0b),
    deep2: c(0x0d0d0d),
    raised: c(0x141414),
    raised2: c(0x1c1c1c),
    fill: c(0x1f1f1f),
    fill2: c(0x222222),
    sel: c(0x262626),
    sel2: c(0x2e2e2e),
    line2: c(0x2a2a2a),
    line3: c(0x3a3a3a),
    text: c(0xededed),
    text2: c(0xdcdcdc),
    text3: c(0xc8c8c8),
    text4: c(0xa8a8a8),
    muted: c(0x8f8f8f),
    faint: c(0x6b6b6b),
    gutter: c(0x4a4a4a),
    primary: c(0xededed),
    on_primary: c(0x0a0a0a),
    link: c(0x73ade9),
    keyword: c(0xc678dd),
    string: c(0x98c379),
    number: c(0xd19a66),
    kind: c(0x56b6c2),
    call: c(0x61afef),
    data: c(0xe5c07b),
    error: c(0xe06c75),
    comment: c(0x5c6370),
    warn_bg: c(0x15130d),
    warn_line: c(0x3d3522),
    on_warn: c(0x1a1406),
};

const LIGHT: fn() -> Palette = || Palette {
    win: c(0xf3f3f1),
    card: c(0xffffff),
    deep: c(0xf6f6f5),
    deep2: c(0xfafaf9),
    raised: c(0xf7f7f6),
    raised2: c(0xf1f1ef),
    fill: c(0xececea),
    fill2: c(0xe9e9e7),
    sel: c(0xe6e6e4),
    sel2: c(0xdfdfdc),
    line2: c(0xdededb),
    line3: c(0xcbcbc8),
    text: c(0x171717),
    text2: c(0x262626),
    text3: c(0x3a3a3a),
    text4: c(0x525252),
    muted: c(0x6b6b6b),
    faint: c(0x8f8f8f),
    gutter: c(0xb8b8b8),
    primary: c(0x171717),
    on_primary: c(0xffffff),
    link: c(0x2f6fd0),
    keyword: c(0xa626a4),
    string: c(0x50a14f),
    number: c(0x986801),
    kind: c(0x0184bc),
    call: c(0x4078f2),
    data: c(0xc18401),
    error: c(0xe45649),
    comment: c(0xa0a1a7),
    warn_bg: c(0xfff8e6),
    warn_line: c(0xefd9a6),
    on_warn: c(0x1a1406),
};

pub struct Theme {
    pub choice: Appearance,
    pub dark: bool,
    pub p: Palette,
}

impl Global for Theme {}

pub fn init(window: &Window, cx: &mut App) {
    cx.set_global(Theme {
        choice: Appearance::System,
        dark: true,
        p: DARK(),
    });
    apply(Appearance::System, window, cx);
}

pub fn apply(choice: Appearance, window: &Window, cx: &mut App) {
    let dark = match choice {
        Appearance::Dark => true,
        Appearance::Light => false,
        Appearance::System => matches!(
            window.appearance(),
            WindowAppearance::Dark | WindowAppearance::VibrantDark
        ),
    };
    cx.set_global(Theme {
        choice,
        dark,
        p: if dark { DARK() } else { LIGHT() },
    });
    let mode = if dark {
        gpui_kit::component::ThemeMode::Dark
    } else {
        gpui_kit::component::ThemeMode::Light
    };
    gpui_kit::component::Theme::change(mode, None, cx);
    cx.refresh_windows();
}

pub fn palette(cx: &App) -> Palette {
    cx.global::<Theme>().p
}

pub fn icon(name: &str, size: f32, color: Hsla) -> Svg {
    svg()
        .path(SharedString::from(format!("eleven/icons/{name}.svg")))
        .size(px(size))
        .flex_shrink_0()
        .text_color(color)
}
