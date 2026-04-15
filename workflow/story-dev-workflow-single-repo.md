# Story Development Workflow (Single Repo)

> For repositories with a parent + `backend` Git Submodule structure, use a separate submodule workflow.

This file applies to **single Git repositories** where code, BMAD artifacts, and documentation all reside in the same checkout root with no nested submodules.

---

## Startup Confirmation

When the workflow starts, present two confirmation prompts in sequence. Begin execution after the user responds.

### Step One: Optional Steps (Multi-select)

Use `AskUserQuestion` tool, **multiSelect: true**:

```
question: "Which optional steps should be included?"
header: "Optional"
multiSelect: true
options:
  - label: "Build Verification"
    description: "Run the project's build/compile step after development to verify no compilation errors"
  - label: "Unit Tests"
    description: "Run the project's test suite to ensure all tests pass"
  - label: "Code Review"
    description: "Run bmad-code-review to review code quality, then fix critical issues based on results"
  - label: "Worktree Mode"
    description: "Use git worktree to create an isolated working directory, enabling parallel Story development without interference"
  - label: "None of the above"
    description: "Skip all optional steps and proceed with the default flow"
```

If the user selects "None of the above" or only that option, all four optional steps are skipped. Otherwise, selected options take effect.

### Step Two: Confirmation Mode (Single-select)

Use `AskUserQuestion` tool, **multiSelect: false**:

```
question: "How should execution pauses be handled?"
header: "Confirm Mode"
multiSelect: false
options:
  - label: "AI Decides"
    description: "AI decides whether to pause for confirmation based on step risk level (Recommended)"
  - label: "Confirm All"
    description: "Pause after each step, show results, and wait for confirmation before continuing"
  - label: "Skip All"
    description: "Execute all steps automatically without pausing"
```

### AI Decides Rules

**Must confirm**: Step 2 (Story spec), Step 3 (implementation results), Step 6 (review results, if enabled), Step 8 (PR).

**May skip confirmation**: Steps 1, 4, 5, 7, 9; Step 10 is user-decided.

---

## Cross-stage Context (Authoritative)

This repository **recognizes only one directory**: `$BACKEND_ROOT` = **current repository root** (containing `.git`). Do not mix usage between the main clone and `worktrees/...`.

### Session Variables (Finalized after Step 1, carried throughout)

| Variable | Meaning |
|----------|---------|
| `BACKEND_ROOT` | Repository root directory. Normal mode: main clone root. Worktree mode: side directory `worktrees/<BRANCH>` (relative to main clone root: `../worktrees/<BRANCH>`). |
| `BACKEND_ROOT_ABS` | Absolute path of the above directory; **required for cross-session handoff**. |
| `BRANCH` | e.g. `story/4-5-move-in-inspection-pc`. |
| `WORKTREE_MODE` | `true` = worktree; `false` = normal. |

**Execution scope**: Build tools, `git`, `gh`, and code review all run within `$BACKEND_ROOT`; review uses the same path as dev.

**Handoff output**: Must include `BACKEND_ROOT_ABS`, `BRANCH`, `WORKTREE_MODE` (optionally also relative path `BACKEND_ROOT`).

### Cross-session Startup Phrases (Two locations only)

Trigger: `start story` / `dev story` + Story number; Agent reads this file and executes steps in order.

**Variables**: `{epic}-{story}`, `{BRANCH}`, `{BACKEND_ROOT}`, `{BACKEND_ROOT_ABS}`, `{WORKTREE_MODE}` are filled from session variables.

---

**Location One** -- Step 2 completed but session ends (does not enter Step 3)

```
[Cross-session handoff: Continue Story implementation]
dev story {epic}-{story} (or start story {epic}-{story})
Same message must include: Steps 1-2 already executed; next step starts from Step 3 (bmad-dev-story), do not repeat bmad-create-story;
BRANCH={BRANCH}; WORKTREE_MODE={WORKTREE_MODE}; BACKEND_ROOT={BACKEND_ROOT}; BACKEND_ROOT_ABS={BACKEND_ROOT_ABS}
Example: dev story {epic}-{story}. Create Story is done; continue from Step 3. BACKEND_ROOT_ABS=... BRANCH=... WORKTREE_MODE=...
```

---

**Location Two** -- Step 3 completed but session ends (Step 6 not run, or user ends session)

```
[Cross-session handoff: Code review only]
dev story {epic}-{story} (or start story {epic}-{story})
Same message must include: Steps 1-3 already executed; next step is only Step 6 (bmad-code-review) at BACKEND_ROOT_ABS;
BRANCH=...; WORKTREE_MODE=...; BACKEND_ROOT_ABS=...
Example: dev story {epic}-{story}. Implementation complete; review only. BACKEND_ROOT_ABS=... BRANCH=... WORKTREE_MODE=...
```

**Do not output Location Two**: if Step 6 was already executed in this session and no handoff was requested.

---

## Prerequisites

- `_bmad-output/implementation-artifacts/sprint-status.yaml` exists (path may vary by project); Story is `backlog` or `ready-for-dev`
- Have read `_bmad-output/project-context.md` and the project's coding standards documentation (if applicable)

---

## Workflow Steps

### 1. Sync Code & Create Branch

> Precedes Step 2 to ensure `bmad-create-story` scans code on the target branch.

In the main clone root directory:

```bash
git checkout main && git pull origin main
```

- Branch name: `story/{epic}-{story}-{slug}`
- **Base point**: Check sprint dependencies via `gh pr list`; if merged, base on `main`; if unmerged, base on the dependency branch (PR target matches)

#### Normal Mode

```bash
git checkout -b story/{epic}-{story}-{slug} [base-branch]
```

`BACKEND_ROOT` = main clone root; `WORKTREE_MODE=false`. `BACKEND_ROOT_ABS`: result of `pwd`.

#### Worktree Mode (when selected at startup)

Run in the main clone root (creates `worktrees/` **alongside** the main repo to avoid file conflicts with the main working tree):

```bash
BRANCH="story/{epic}-{story}-{slug}"
WORKTREE_DIR="../worktrees/$BRANCH"
git fetch origin
git branch $BRANCH [base-branch]
git worktree add "$WORKTREE_DIR" "$BRANCH"
```

`BACKEND_ROOT` = resolved path of `WORKTREE_DIR`; `WORKTREE_MODE=true`; `BACKEND_ROOT_ABS`: `cd "$WORKTREE_DIR" && pwd`. Do not return to the main clone to modify the same branch.

Push: `cd "$BACKEND_ROOT" && git push -u origin "$BRANCH"`

Cleanup (run in **main clone root**, `BRANCH` matches creation):

```bash
git worktree remove "../worktrees/story/{epic}-{story}-{slug}"
git branch -d story/{epic}-{story}-{slug}
```

### 2. Create Story File

When Story is `backlog`, run `bmad-create-story` (working directory is the repository root where `_bmad-output/` resides); the branch is the current `BRANCH` in `$BACKEND_ROOT`.

### 3. Implement Story

In **`$BACKEND_ROOT`**, run `bmad-dev-story`; follow `project-context.md` conventions.

### 4. Build Verification (Optional)

Execute only if selected at startup; otherwise skip.

Run the project's build or compilation step in `$BACKEND_ROOT`. The specific command depends on the project's build system:
- Detect the build system from project files (e.g. `package.json`, `build.gradle`, `Makefile`, `Cargo.toml`, `pom.xml`)
- Execute the appropriate build/compile command

### 5. Unit Tests (Optional)

Execute only if selected at startup; otherwise skip.

Run the project's test suite in `$BACKEND_ROOT`. The specific command depends on the project's test framework:
- Detect the test runner from project configuration
- Execute all tests and ensure they pass

### 6. Code Review (Optional)

Execute only if selected at startup; otherwise skip. In **`$BACKEND_ROOT`**, run `bmad-code-review` and fix mandatory items based on results.

### 7. Commit Code

In **`$BACKEND_ROOT`**, commit changes (code, sprint status, and documentation can be committed together or split per team convention). Check the project's git author convention (e.g. `git config user.name` / `git config user.email`, or project documentation) and use it consistently. Follow Conventional Commits format: `<type>(<scope>): <subject>`.

### 8. Push & Create PR

In **`$BACKEND_ROOT`**, run `git push` and `gh`.

**Issue (optional)**: `gh issue list --search "{epic}-{story} in:title" --state open --limit 20`; if none found, try `in:title,body`; if multiple, determine the correct `#N` via web. PR body includes **`Closes #N`**; when Issue and PR are in the **same repo**, merging into the default branch usually auto-closes the Issue; if no Issue exists, omit. If Issue is in a **different GitHub repo**, auto-close does not work -- handle manually or migrate the Issue.

**PR**: `gh pr create`; body: Summary, Test plan; include `Closes #N` if applicable. Target: `main` or dependency branch.

### 9. Update Sprint Status

Update the Story to `done` in `_bmad-output/implementation-artifacts/sprint-status.yaml`.

### 10. Merge & Cleanup

User decides merge timing; after merge, delete the branch; for worktree cleanup see Step 1.

---

## Quick Reference Rules

| Item | Rule |
|------|------|
| Branch | `story/{epic}-{story}-{slug}` |
| Commit | Conventional Commits |
| Build / Test / Review | Optional, selected at startup; build and test commands determined by project context |
| Worktree | Optional; path `../worktrees/<BRANCH>` (relative to main clone root) |
| PR | Target `main` or dependency branch |
| Issue | `gh` in `$BACKEND_ROOT`; `Closes #N`; see Step 8 |
