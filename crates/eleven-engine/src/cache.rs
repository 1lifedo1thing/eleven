use std::path::PathBuf;

use crate::{CodeView, EngineError, Procedure, Result};

const PROVIDER_DIR: &str = "ghidra";

/// Analysis results on disk, keyed by the binary's SHA-256, so a second open skips Ghidra.
pub(crate) struct Cache {
    root: PathBuf,
}

impl Cache {
    pub(crate) fn new(root: PathBuf) -> Self {
        Self { root }
    }

    pub(crate) fn procedures(&self, sha256: &str) -> Result<Option<Vec<Procedure>>> {
        let path = self.dir(sha256).join("procedures.json");
        let Some(text) = read(&path)? else {
            return Ok(None);
        };
        Ok(serde_json::from_str(&text).ok())
    }

    pub(crate) fn store_procedures(&self, sha256: &str, procedures: &[Procedure]) -> Result<()> {
        let json = serde_json::to_string(procedures).expect("procedures always serialize");
        write(self.dir(sha256).join("procedures.json"), &json)
    }

    pub(crate) fn code(
        &self,
        sha256: &str,
        address: &str,
        view: CodeView,
    ) -> Result<Option<String>> {
        read(&self.code_path(sha256, address, view))
    }

    pub(crate) fn store_code(
        &self,
        sha256: &str,
        address: &str,
        view: CodeView,
        code: &str,
    ) -> Result<()> {
        write(self.code_path(sha256, address, view), code)
    }

    fn dir(&self, sha256: &str) -> PathBuf {
        self.root.join(sha256).join(PROVIDER_DIR)
    }

    fn code_path(&self, sha256: &str, address: &str, view: CodeView) -> PathBuf {
        let file = address.replace([':', '/'], "_");
        let (dir, ext) = match view {
            CodeView::Pseudocode => ("pseudocode", "c"),
            CodeView::Assembly => ("assembly", "s"),
        };
        self.dir(sha256).join(dir).join(format!("{file}.{ext}"))
    }
}

fn read(path: &PathBuf) -> Result<Option<String>> {
    match std::fs::read_to_string(path) {
        Ok(text) => Ok(Some(text)),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(source) => Err(EngineError::Cache {
            path: path.clone(),
            source,
        }),
    }
}

fn write(path: PathBuf, contents: &str) -> Result<()> {
    let result = path
        .parent()
        .map_or(Ok(()), std::fs::create_dir_all)
        .and_then(|()| std::fs::write(&path, contents));
    result.map_err(|source| EngineError::Cache { path, source })
}
