import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.ELEVEN_SUPPORT = mkdtempSync(join(tmpdir(), "eleven-projects-"));

const { listProjects, projectId, rememberProject } = await import("../src/engine/project");
const { prepareTarget } = await import("../src/engine/target");
const { listThreads, loadThread, saveThread } = await import("../src/chat/history");

const ls = prepareTarget("/bin/ls");
const threads = join(process.env.ELEVEN_SUPPORT, "threads");

function oldThread(id: string, target: string | null, updatedAt: number): void {
  mkdirSync(threads, { recursive: true });
  writeFileSync(join(threads, `${id}.json`), JSON.stringify({ id, title: id, target, messages: [], updatedAt }));
}

test("projects: opening a file adds it to the project list once, most recent first", () => {
  const id = rememberProject(ls, 1000);
  expect(id).toBe(projectId(ls));
  expect(id).toMatch(/^[0-9a-f]{64}$/);
  rememberProject(ls, 2000);
  const projects = listProjects();
  expect(projects.filter((project) => project.id === id)).toHaveLength(1);
  expect(projects[0]).toEqual({ id, name: "ls", original: "/bin/ls", arch: ls.arch, kind: "binary", openedAt: 2000 });
});

test("projects: an older open never moves a project back", () => {
  rememberProject(ls, 500);
  expect(listProjects()[0]?.openedAt).toBe(2000);
});

test("projects: a saved chat keeps the project it was saved with", () => {
  saveThread({ id: "with-project", title: "hi", target: "/bin/ls", project: projectId(ls), messages: [], updatedAt: 3000 });
  expect(loadThread("with-project")?.project).toBe(projectId(ls));
  saveThread({ id: "lobby", title: "hi", target: null, project: null, messages: [], updatedAt: 3000 });
  expect(loadThread("lobby")?.project).toBeNull();
});

test("projects: chats saved before projects existed join their file's project", () => {
  oldThread("old-ls", "/bin/ls", 4000);
  oldThread("old-gone", "/nowhere/missing-binary", 4000);
  oldThread("old-lobby", null, 4000);
  const byId = new Map(listThreads().map((thread) => [thread.id, thread.project]));
  expect(byId.get("old-ls")).toBe(projectId(ls));
  expect(byId.get("old-gone")).toBeNull();
  expect(byId.get("old-lobby")).toBeNull();
  const written: unknown = JSON.parse(readFileSync(join(threads, "old-ls.json"), "utf8"));
  expect(written).toMatchObject({ project: projectId(ls) });
  expect(listProjects()[0]).toMatchObject({ id: projectId(ls), openedAt: 4000 });
});

test("projects: deleting one tells listeners, drops its chats and saved work, and leaves the binary alone", async () => {
  const { deleteProject, loadProject, onProjectListChange, updateProject } = await import("../src/engine/project");
  const { deleteDocument } = await import("../src/engine/document");
  const id = rememberProject(ls, 4000);
  updateProject(id, (project) => ({ ...project, names: new Map([["0x1", "start"]]) }), null);
  saveThread({ id: "doomed", title: "bye", target: "/bin/ls", project: id, messages: [], updatedAt: 4000 });
  saveThread({ id: "kept", title: "stay", target: null, project: null, messages: [], updatedAt: 4000 });
  let heard = 0;
  const stop = onProjectListChange(() => { heard += 1; });
  deleteDocument(id);
  deleteProject(id);
  stop();
  expect(heard).toBeGreaterThan(0);
  expect(listProjects().some((project) => project.id === id)).toBe(false);
  expect(loadThread("doomed")).toBeNull();
  expect(loadThread("kept")?.title).toBe("stay");
  expect(loadProject(id).names.size).toBe(0);
  expect(readFileSync("/bin/ls").length).toBeGreaterThan(0);
});
