use std::sync::LazyLock;

use gpui_kit::*;
use regex::Regex;

use crate::theme::{MONO, Palette};

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Syntax {
    C,
    Assembly,
}

static C_TOKENS: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(concat!(
        r"(?P<comment>/\*.*?\*/|//.*$)",
        r#"|(?P<string>"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')"#,
        r"|\b(?P<keyword>if|else|while|do|return|goto|for|break|switch|case)\b",
        r"|\b(?P<kind>void|int|uint|char|long|ulong|short|ushort|byte|bool|BOOL|undefined\d*|code|FILE|FTS|FTSENT|uid_t|size_t)\b",
        r"|\b(?P<local>FUN_[0-9a-f]+)\b",
        r"|\b(?P<number>0x[0-9a-fA-F]+|\d+)\b",
        r"|\b(?P<data>DAT_[0-9a-f]+|PTR_\w+|LAB_[0-9a-f]+)\b",
        r"|\b(?P<call>_\w+)\(",
    ))
    .expect("valid C token pattern")
});

static ASM_TOKENS: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(concat!(
        r"^(?P<address>0x[0-9a-f]+:)",
        r"|\b(?P<branch>bl|b\.\w+|b|ret|cbz|cbnz)\b",
        r"|\b(?P<target>0x[0-9a-f]{9,})\b",
        r"|\b(?P<register>[wx]\d+|sp|xzr|wzr)\b",
        r"|(?P<immediate>#-?0x[0-9a-f]+|#-?\d+)",
    ))
    .expect("valid assembly token pattern")
});

fn highlights(line: &str, syntax: Syntax, p: &Palette) -> Vec<(std::ops::Range<usize>, HighlightStyle)> {
    let style = |color: Hsla, italic: bool| HighlightStyle {
        color: Some(color),
        font_style: italic.then_some(FontStyle::Italic),
        ..Default::default()
    };
    let (pattern, groups): (&Regex, &[(&str, Hsla, bool)]) = match syntax {
        Syntax::C => (
            &C_TOKENS,
            &[
                ("comment", p.comment, true),
                ("string", p.string, false),
                ("keyword", p.keyword, false),
                ("kind", p.kind, false),
                ("local", p.link, false),
                ("number", p.number, false),
                ("data", p.data, false),
                ("call", p.call, false),
            ],
        ),
        Syntax::Assembly => (
            &ASM_TOKENS,
            &[
                ("address", p.comment, false),
                ("branch", p.keyword, false),
                ("target", p.link, false),
                ("register", p.error, false),
                ("immediate", p.number, false),
            ],
        ),
    };
    pattern
        .captures_iter(line)
        .filter_map(|caps| {
            groups.iter().find_map(|(name, color, italic)| {
                caps.name(name)
                    .map(|m| (m.range(), style(*color, *italic)))
            })
        })
        .collect()
}

/// Renders code the way the Eleven canvas does: a quiet gutter and One Dark/Light colors.
pub fn code_view(text: &str, syntax: Syntax, focus_line: Option<usize>, p: &Palette) -> Div {
    div()
        .flex()
        .flex_col()
        .pt(px(10.))
        .pb(px(24.))
        .font_family(MONO)
        .text_size(px(12.5))
        .line_height(px(20.))
        .text_color(p.text3)
        .children(text.lines().enumerate().map(|(ix, line)| {
            let focused = focus_line == Some(ix);
            div()
                .flex()
                .when(focused, |row| row.bg(p.fill))
                .child(
                    div()
                        .w(px(46.))
                        .flex_shrink_0()
                        .pr(px(16.))
                        .flex()
                        .justify_end()
                        .text_color(if focused { p.text } else { p.gutter })
                        .child((ix + 1).to_string()),
                )
                .child(
                    div().whitespace_nowrap().child(
                        StyledText::new(SharedString::from(line.to_string()))
                            .with_highlights(highlights(line, syntax, p)),
                    ),
                )
        }))
}
