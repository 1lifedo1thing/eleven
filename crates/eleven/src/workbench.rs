use std::path::PathBuf;

use eleven_engine::{CodeView, Engine, Procedure, ProcedureKind, Target};
use gpui_kit::component::button::{Button, ButtonVariants as _};
use gpui_kit::component::input::{Editor, EditorState, Input, InputEvent, InputState};
use gpui_kit::component::list::ListItem;
use gpui_kit::component::resizable::{h_resizable, resizable_panel};
use gpui_kit::component::{ActiveTheme, Selectable as _, Sizable as _, h_flex, v_flex};
use gpui_kit::*;

use crate::Open;

enum Phase {
    Empty,
    Analyzing(String),
    Ready,
    Failed(String),
}

pub struct Workbench {
    engine: Engine,
    phase: Phase,
    target: Option<Target>,
    procedures: Vec<Procedure>,
    visible: Vec<usize>,
    selected: Option<usize>,
    view: CodeView,
    search: Entity<InputState>,
    code: Entity<EditorState>,
    focus: FocusHandle,
    _subscriptions: Vec<Subscription>,
}

impl Workbench {
    pub fn new(
        engine: Engine,
        initial: Option<PathBuf>,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) -> Self {
        let search = cx.new(|cx| InputState::new(window, cx).placeholder("Filter functions"));
        let code = cx.new(|cx| {
            EditorState::new(window, cx)
                .language("c")
                .line_number(true)
                .soft_wrap(false)
        });
        let _subscriptions =
            vec![
                cx.subscribe_in(&search, window, |this, _, event: &InputEvent, _, cx| {
                    if let InputEvent::Change = event {
                        this.refilter(cx);
                    }
                }),
            ];
        let mut workbench = Self {
            engine,
            phase: Phase::Empty,
            target: None,
            procedures: Vec::new(),
            visible: Vec::new(),
            selected: None,
            view: CodeView::Pseudocode,
            search,
            code,
            focus: cx.focus_handle(),
            _subscriptions,
        };
        if let Some(path) = initial {
            workbench.open_path(path, window, cx);
        }
        workbench
    }

    fn prompt_open(&mut self, _: &Open, window: &mut Window, cx: &mut Context<Self>) {
        let picked = cx.prompt_for_paths(PathPromptOptions {
            files: true,
            directories: false,
            multiple: false,
            prompt: Some("Open a binary".into()),
        });
        cx.spawn_in(window, async move |this, cx| {
            let path = picked.await.ok()?.ok()??.into_iter().next()?;
            this.update_in(cx, |this, window, cx| this.open_path(path, window, cx))
                .ok()
        })
        .detach();
    }

    fn open_path(&mut self, path: PathBuf, window: &mut Window, cx: &mut Context<Self>) {
        let name = path
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_default();
        self.phase = Phase::Analyzing(name);
        self.target = None;
        self.procedures.clear();
        self.visible.clear();
        self.selected = None;
        self.set_code(String::new(), window, cx);
        cx.notify();

        let engine = self.engine.clone();
        cx.spawn_in(window, async move |this, cx| {
            let loaded = async {
                let target = engine.open(path).await?;
                let procedures = engine.procedures(target.clone()).await?;
                Ok::<_, eleven_engine::EngineError>((target, procedures))
            }
            .await;
            this.update_in(cx, |this, window, cx| match loaded {
                Ok((target, procedures)) => {
                    this.target = Some(target);
                    this.procedures = procedures
                        .into_iter()
                        .filter(|procedure| procedure.kind != ProcedureKind::External)
                        .collect();
                    this.phase = Phase::Ready;
                    this.refilter(cx);
                    if let Some(&first) = this.visible.first() {
                        this.select(first, window, cx);
                    }
                }
                Err(err) => {
                    this.phase = Phase::Failed(err.to_string());
                    cx.notify();
                }
            })
        })
        .detach();
    }

    fn refilter(&mut self, cx: &mut Context<Self>) {
        let query = self.search.read(cx).value().to_lowercase();
        self.visible = self
            .procedures
            .iter()
            .enumerate()
            .filter(|(_, procedure)| {
                query.is_empty()
                    || procedure.name.to_lowercase().contains(&query)
                    || procedure.address.contains(&query)
            })
            .map(|(ix, _)| ix)
            .collect();
        cx.notify();
    }

    fn select(&mut self, ix: usize, window: &mut Window, cx: &mut Context<Self>) {
        self.selected = Some(ix);
        self.load_code(window, cx);
    }

    fn show(&mut self, view: CodeView, window: &mut Window, cx: &mut Context<Self>) {
        self.view = view;
        self.load_code(window, cx);
    }

    fn load_code(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        let (Some(target), Some(procedure)) = (
            self.target.clone(),
            self.selected
                .and_then(|ix| self.procedures.get(ix))
                .cloned(),
        ) else {
            return;
        };
        let view = self.view;
        let wanted = (procedure.address.clone(), view);
        let request = self.engine.code(target, procedure, view);
        cx.notify();
        cx.spawn_in(window, async move |this, cx| {
            let code = request.await;
            this.update_in(cx, |this, window, cx| {
                let current = this
                    .selected
                    .and_then(|ix| this.procedures.get(ix))
                    .map(|procedure| (procedure.address.clone(), this.view));
                if current.as_ref() != Some(&wanted) {
                    return;
                }
                let text = code.unwrap_or_else(|err| format!("// {err}"));
                this.set_code(text, window, cx);
            })
        })
        .detach();
    }

    fn set_code(&mut self, text: String, window: &mut Window, cx: &mut Context<Self>) {
        let language = match self.view {
            CodeView::Pseudocode => "c",
            CodeView::Assembly => "text",
        };
        self.code.update(cx, |code, cx| {
            code.set_highlighter(language, cx);
            code.set_value(text, window, cx);
        });
    }

    fn drop_paths(&mut self, paths: &ExternalPaths, window: &mut Window, cx: &mut Context<Self>) {
        if let Some(path) = paths.paths().first() {
            self.open_path(path.clone(), window, cx);
        }
    }

    fn render_header(&self, cx: &Context<Self>) -> impl IntoElement {
        let status = match &self.phase {
            Phase::Empty => String::new(),
            Phase::Analyzing(name) => {
                format!("Analyzing {name}. The first open takes a few seconds.")
            }
            Phase::Ready => format!("{} functions", self.procedures.len()),
            Phase::Failed(_) => "Couldn't open that file".into(),
        };
        let subject = self.target.as_ref().map(|target| {
            format!(
                "{}  ·  {} {}",
                target.name(),
                target.format,
                target.architecture
            )
        });
        h_flex()
            .h_10()
            .px_3()
            .gap_3()
            .border_b_1()
            .border_color(cx.theme().border)
            .child(div().font_weight(FontWeight::SEMIBOLD).child("Eleven"))
            .children(subject.map(|subject| div().text_sm().child(subject)))
            .child(div().flex_1())
            .child(
                div()
                    .text_sm()
                    .text_color(cx.theme().muted_foreground)
                    .child(status),
            )
            .child(
                Button::new("open")
                    .small()
                    .ghost()
                    .label("Open…")
                    .on_click(|_, window, cx| window.dispatch_action(Box::new(Open), cx)),
            )
    }

    fn render_message(&self, cx: &Context<Self>) -> impl IntoElement {
        let (title, detail) = match &self.phase {
            Phase::Failed(err) => ("Couldn't open that file".to_string(), err.clone()),
            Phase::Analyzing(name) => (
                format!("Analyzing {name}"),
                "Ghidra is reading the binary. Next time it opens from cache.".into(),
            ),
            Phase::Empty | Phase::Ready => (
                "Drop a binary here".to_string(),
                "Or press ⌘O to pick one.".into(),
            ),
        };
        v_flex()
            .size_full()
            .items_center()
            .justify_center()
            .gap_2()
            .child(
                div()
                    .text_lg()
                    .font_weight(FontWeight::SEMIBOLD)
                    .child(title),
            )
            .child(
                div()
                    .max_w(px(520.))
                    .text_sm()
                    .text_center()
                    .text_color(cx.theme().muted_foreground)
                    .child(detail),
            )
    }

    fn render_functions(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let rows: Vec<(usize, Procedure)> = self
            .visible
            .iter()
            .map(|&ix| (ix, self.procedures[ix].clone()))
            .collect();
        let selected = self.selected;
        let view = cx.entity();
        let mono = cx.theme().mono_font_family.clone();
        let muted = cx.theme().muted_foreground;
        v_flex()
            .size_full()
            .child(div().p_2().child(Input::new(&self.search).small()))
            .child(
                uniform_list("functions", rows.len(), move |range, _, _| {
                    range
                        .map(|row| {
                            let (ix, procedure) = &rows[row];
                            let ix = *ix;
                            let view = view.clone();
                            ListItem::new(ix)
                                .selected(selected == Some(ix))
                                .px_3()
                                .child(
                                    h_flex()
                                        .w_full()
                                        .gap_2()
                                        .child(
                                            div()
                                                .flex_1()
                                                .min_w_0()
                                                .truncate()
                                                .text_sm()
                                                .child(procedure.name.clone()),
                                        )
                                        .child(
                                            div()
                                                .text_xs()
                                                .font_family(mono.clone())
                                                .text_color(muted)
                                                .child(procedure.address.clone()),
                                        ),
                                )
                                .on_click(move |_, window, cx| {
                                    view.update(cx, |this, cx| this.select(ix, window, cx));
                                })
                        })
                        .collect()
                })
                .flex_1(),
            )
    }

    fn render_code(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let tab = |id: &'static str, label: &'static str, view: CodeView, current: CodeView| {
            Button::new(id)
                .small()
                .ghost()
                .label(label)
                .selected(view == current)
                .on_click(cx.listener(move |this, _, window, cx| this.show(view, window, cx)))
        };
        let title = self
            .selected
            .and_then(|ix| self.procedures.get(ix))
            .map(|procedure| format!("{}  {}", procedure.name, procedure.address))
            .unwrap_or_default();
        v_flex()
            .size_full()
            .child(
                h_flex()
                    .h_9()
                    .px_2()
                    .gap_1()
                    .border_b_1()
                    .border_color(cx.theme().border)
                    .child(tab(
                        "pseudocode",
                        "Pseudocode",
                        CodeView::Pseudocode,
                        self.view,
                    ))
                    .child(tab("assembly", "Assembly", CodeView::Assembly, self.view))
                    .child(div().flex_1())
                    .child(
                        div()
                            .text_xs()
                            .font_family(cx.theme().mono_font_family.clone())
                            .text_color(cx.theme().muted_foreground)
                            .child(title),
                    ),
            )
            .child(
                Editor::new(&self.code)
                    .readonly(true)
                    .bordered(false)
                    .p_0()
                    .h(relative(1.))
                    .font_family(cx.theme().mono_font_family.clone())
                    .text_size(cx.theme().mono_font_size),
            )
    }
}

impl Render for Workbench {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let body = match self.phase {
            Phase::Ready => h_resizable("workbench")
                .child(
                    resizable_panel()
                        .size(px(300.))
                        .child(self.render_functions(cx)),
                )
                .child(self.render_code(cx).into_any_element())
                .into_any_element(),
            Phase::Empty | Phase::Analyzing(_) | Phase::Failed(_) => {
                self.render_message(cx).into_any_element()
            }
        };
        v_flex()
            .id("workbench-root")
            .track_focus(&self.focus)
            .key_context("Workbench")
            .on_action(cx.listener(Self::prompt_open))
            .on_drop(cx.listener(Self::drop_paths))
            .size_full()
            .bg(cx.theme().background)
            .text_color(cx.theme().foreground)
            .child(self.render_header(cx))
            .child(div().flex_1().min_h_0().child(body))
    }
}
