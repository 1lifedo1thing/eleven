mod home;
mod workbench;

use std::path::PathBuf;

use eleven_engine::{Engine, EngineConfig, ReaLaunch};
use gpui_kit::assets::Assets;
use gpui_kit::*;

use crate::home::Home;

actions!(eleven, [Open, Quit]);

fn main() {
    let rea = std::env::var_os("ELEVEN_REA").map_or_else(|| PathBuf::from("rea"), PathBuf::from);
    let cache_dir = dirs::cache_dir()
        .unwrap_or_else(std::env::temp_dir)
        .join("eleven");
    let rea = ReaLaunch::from_path(rea);
    let engine = Engine::new(EngineConfig {
        rea: rea.clone(),
        cache_dir,
    })
    .expect("start the analysis runtime");
    let initial = std::env::args_os().nth(1).map(PathBuf::from);

    gpui_kit::application().with_assets(Assets).run(move |cx| {
        gpui_kit::init(cx);
        cx.bind_keys([
            KeyBinding::new("cmd-o", Open, None),
            KeyBinding::new("cmd-q", Quit, None),
        ]);
        cx.on_action(|_: &Quit, cx| cx.quit());
        cx.on_window_closed(|cx, _| cx.quit()).detach();

        let options = WindowOptions {
            window_bounds: Some(WindowBounds::centered(size(px(1280.), px(800.)), cx)),
            titlebar: Some(TitlebarOptions {
                title: Some("Eleven".into()),
                ..Default::default()
            }),
            ..Default::default()
        };
        gpui_kit::open_window(options, cx, |window, cx| {
            cx.new(|cx| Home::new(engine, rea, initial, window, cx))
        })
        .expect("open the main window");
        cx.activate(true);
    });
}
