mod cache;
mod rea;

use std::future::Future;
use std::path::PathBuf;
use std::pin::Pin;
use std::sync::Arc;

use tokio::sync::Mutex;

pub use rea::ReaLaunch;

#[derive(Debug, thiserror::Error)]
pub enum EngineError {
    #[error(
        "Couldn't start REA, the analysis engine. Install it with `npm install -g rea-agents` or set ELEVEN_REA to its path."
    )]
    ReaUnavailable(#[source] std::io::Error),
    #[error("{message} {action}")]
    Rea { message: String, action: String },
    #[error("REA sent a reply Eleven didn't understand ({0}). Update REA and try again.")]
    Protocol(String),
    #[error("Couldn't use Eleven's cache at {path}. Check the folder is writable.")]
    Cache {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
}

pub type Result<T> = std::result::Result<T, EngineError>;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Target {
    pub path: PathBuf,
    pub sha256: String,
    pub format: String,
    pub architecture: String,
}

impl Target {
    pub fn name(&self) -> String {
        self.path
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_default()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct Procedure {
    pub address: String,
    pub name: String,
    pub kind: ProcedureKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum ProcedureKind {
    Function,
    Thunk,
    External,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CodeView {
    Pseudocode,
    Assembly,
}

pub struct EngineConfig {
    pub rea: ReaLaunch,
    pub cache_dir: PathBuf,
}

/// Runs analysis on its own tokio runtime, so every future it returns can be
/// awaited from any executor, including GPUI's.
#[derive(Clone)]
pub struct Engine {
    runtime: Arc<tokio::runtime::Runtime>,
    state: Arc<Mutex<State>>,
}

struct State {
    rea: ReaLaunch,
    cache: cache::Cache,
    session: Option<rea::Session>,
    open: Option<Target>,
}

impl Engine {
    pub fn new(config: EngineConfig) -> std::io::Result<Self> {
        let runtime = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .thread_name("eleven-engine")
            .enable_all()
            .build()?;
        Ok(Self {
            runtime: Arc::new(runtime),
            state: Arc::new(Mutex::new(State {
                rea: config.rea,
                cache: cache::Cache::new(config.cache_dir),
                session: None,
                open: None,
            })),
        })
    }

    pub fn open(&self, path: PathBuf) -> impl Future<Output = Result<Target>> + Send + 'static {
        self.run(move |state| Box::pin(state.open(path)))
    }

    pub fn procedures(
        &self,
        target: Target,
    ) -> impl Future<Output = Result<Vec<Procedure>>> + Send + 'static {
        self.run(move |state| {
            Box::pin(async move {
                if let Some(cached) = state.cache.procedures(&target.sha256)? {
                    return Ok(cached);
                }
                let procedures = state.session_for(&target).await?.procedures().await?;
                state.cache.store_procedures(&target.sha256, &procedures)?;
                Ok(procedures)
            })
        })
    }

    pub fn code(
        &self,
        target: Target,
        procedure: Procedure,
        view: CodeView,
    ) -> impl Future<Output = Result<String>> + Send + 'static {
        self.run(move |state| {
            Box::pin(async move {
                if let Some(cached) = state.cache.code(&target.sha256, &procedure.address, view)? {
                    return Ok(cached);
                }
                let code = state
                    .session_for(&target)
                    .await?
                    .code(&procedure.address, view)
                    .await?;
                state
                    .cache
                    .store_code(&target.sha256, &procedure.address, view, &code)?;
                Ok(code)
            })
        })
    }

    fn run<T: Send + 'static>(
        &self,
        work: impl for<'a> FnOnce(&'a mut State) -> Pin<Box<dyn Future<Output = Result<T>> + Send + 'a>>
        + Send
        + 'static,
    ) -> impl Future<Output = Result<T>> + Send + 'static {
        let state = self.state.clone();
        let handle = self.runtime.spawn(async move {
            let mut state = state.lock().await;
            work(&mut state).await
        });
        async move {
            handle
                .await
                .map_err(|err| EngineError::Protocol(err.to_string()))?
        }
    }
}

impl State {
    async fn open(&mut self, path: PathBuf) -> Result<Target> {
        let session = self.session().await?;
        let target = session.open_binary(&path).await?;
        self.open = Some(target.clone());
        Ok(target)
    }

    async fn session(&mut self) -> Result<&rea::Session> {
        if self.session.is_none() {
            self.session = Some(rea::Session::start(&self.rea).await?);
        }
        Ok(self.session.as_ref().expect("session was just started"))
    }

    async fn session_for(&mut self, target: &Target) -> Result<&rea::Session> {
        if self.open.as_ref() != Some(target) {
            self.open(target.path.clone()).await?;
        }
        self.session().await
    }
}
