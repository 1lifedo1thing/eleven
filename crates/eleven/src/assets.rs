use std::borrow::Cow;

use gpui_kit::{App, AssetSource, SharedString};

#[derive(rust_embed::RustEmbed)]
#[folder = "assets"]
struct Bundled;

/// Eleven's own icons, images and fonts, falling back to gpui-kit's assets.
pub struct ElevenAssets;

impl AssetSource for ElevenAssets {
    fn load(&self, path: &str) -> anyhow::Result<Option<Cow<'static, [u8]>>> {
        match Bundled::get(path) {
            Some(file) => Ok(Some(file.data)),
            None => gpui_kit::assets::Assets.load(path),
        }
    }

    fn list(&self, path: &str) -> anyhow::Result<Vec<SharedString>> {
        let mut paths: Vec<SharedString> = Bundled::iter()
            .filter(|file| file.starts_with(path))
            .map(|file| SharedString::from(file.to_string()))
            .collect();
        paths.extend(gpui_kit::assets::Assets.list(path)?);
        Ok(paths)
    }
}

pub fn load_fonts(cx: &mut App) {
    let fonts = Bundled::iter()
        .filter(|file| file.ends_with(".ttf"))
        .filter_map(|file| Bundled::get(&file).map(|font| font.data))
        .collect();
    if let Err(err) = cx.text_system().add_fonts(fonts) {
        eprintln!("eleven: couldn't load bundled fonts: {err}");
    }
}
