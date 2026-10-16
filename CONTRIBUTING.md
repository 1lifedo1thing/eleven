# Contributing to Eleven

Thanks for helping. Eleven is a small project with one maintainer, so these guidelines keep reviews quick and the app coherent.

## What we welcome

- Bug fixes, with steps to reproduce.
- Windows and Linux fixes, especially ones you've run on that platform.
- Engine edge cases: binaries that fail to open, REA, Ghidra, Rizin or jadx problems.
- New agents for the picker, added through the registry.
- Tests that cover something untested.

## Open an issue first

Ask in an issue before starting any of these. The maintainer leads them, and a PR that arrives unannounced may be closed even if the idea is good:

- New features or screens
- UI and design changes. The app follows a set of design boards, and changes start there.
- Architecture changes: storage, workers, the REA client, the agent bridge
- New settings
- Translations and other work that needs long-term upkeep

## Keep PRs small

- One change per PR. Split refactors, formatting and features into separate PRs.
- Don't reformat code you didn't change. Eleven doesn't use Prettier, and long lines are intentional.
- Say what you tested and on which OS. "Not run on Windows" is fine, just say so.

## Before you open a PR

Run these in `app/`:

```sh
bunx tsc --noEmit --noUnusedLocals
./script/test
```

Add or update a test in `app/tests/` for the change. Tests whose names end in `.live.test.tsx` call a real agent and are optional.

## Code style

Read [AGENTS.md](AGENTS.md). It has the full rules. In short:

- TypeScript: no `any`, no `as` casts (except `as const`), no `.then`, readonly props, explicit return types, exhaustive switches.
- Comments only where they explain something the code can't. No section divider comments.
- UI copy is plain language. No em dashes anywhere.
- Shortcuts are commands in `src/keys/`, never raw key handlers.
- Match the existing screens and `src/components/` before adding new UI patterns.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org): `type(scope): summary`, in lowercase and imperative, with no trailing period. For example: `fix(windows): start .cmd launchers through cmd.exe`.

## How reviews work

When a PR has the right idea but doesn't fit as written, the maintainer may rebuild it in a smaller form and credit you in the commit. That's not a rejection of your work. It keeps the codebase consistent.
