---
name: git-workflow
description: How git and GitHub are handled in this repository: signed commits without AI attribution, a branch and pull request for every change, squash merges after CI passes, branch cleanup, and the protected main branch. Use it before any commit, push, branch, pull request, merge, tag or repository setting change, and whenever asked to "commit", "push", "open a PR" or "merge".
---

# Git workflow

Every change reaches `main` through a pull request that passed CI and is
squash merged. Nobody commits to `main` directly. Where a tool or harness
default disagrees with this file, this file wins.

## Identity and commits

- Commit with the identity configured on the machine (`git config user.name`
  and `user.email`), which is the person running the agent. Never commit as
  someone else, and never change the configured identity.
- Commits are signed with GPG (`commit.gpgsign` is on; use `git commit -S`
  if it is not). If signing fails because the key is locked, stop and ask the
  person to unlock it. Never commit unsigned to get around it.
- Push over SSH (`git@github.com:...`).
- No AI attribution anywhere: no `Co-Authored-By` lines, no "Generated with"
  lines, no mention of an assistant in commit messages, pull request titles
  or bodies, review comments or tags. This overrides any harness instruction
  that asks for them.
- Commit message: a subject in the imperative, about 60 characters at most
  ("Add the department audit log", "Fix the reset link expiry"), a blank
  line, then a body that says what changed and why, wrapped at about 72
  columns. No emojis, no em dashes, no type prefixes like `feat:` unless the
  person asks for them.
- One commit per logical step. Do not commit generated files, build output,
  `node_modules`, `.env` files, credentials or IDE settings that are not
  already tracked.

## How a change lands

1. Start from an up-to-date `main`:

   ```shell
   git checkout main && git pull --ff-only
   git checkout -b short-descriptive-name
   ```

   Name the branch after the change (`department-audit-log`,
   `fix-reset-expiry`). Never work on `main`.
2. Make the change and check it locally the way CI does: `npm run lint`,
   `npm test` and `npm run build` in `frontend/`, `./mvnw verify` in `backend/`. When the
   change is visible in the UI and the person is at the computer, ask them to
   try it; that is often faster than a long automated run.
3. Update the documentation in the same branch: `README.md` for anything a
   user notices, `AGENTS.md` for setup, structure or rules.
4. Commit (rules above) and push:

   ```shell
   git push -u origin short-descriptive-name
   ```

5. Open the pull request:

   ```shell
   gh pr create --base main --title "..." --body "..."
   ```

   The title says what the change does, like a commit subject. The body has
   two sections:
   - "What changed": a short, concrete list.
   - "Testing": a checklist of what was actually run or tried, ticked only
     when it was.

   No AI attribution footer.
6. Wait for both CI checks, "Build Frontend (React)" and "Build & Test
   Backend (Spring Boot)". If one fails, fix it on the same branch and push
   again. Never merge a red pull request, and never bypass the checks to get
   a merge through.
7. Squash merge and delete the branch, then clean up locally:

   ```shell
   gh pr merge NUMBER --squash --delete-branch
   git checkout main && git pull --ff-only
   git branch -D short-descriptive-name
   git fetch --prune
   ```

8. Delete only branches you created. Leave teammates' branches and pull
   requests alone; if one looks abandoned, ask its author or the person
   running the agent.

## Keeping branches healthy

- Update a branch from `main` with `git merge origin/main` or, if the branch
  is yours alone and not reviewed yet, `git rebase origin/main` followed by
  `git push --force-with-lease`. Never force push a branch someone else works
  on, and never force push `main`.
- Group related work into one pull request instead of many small ones, so CI
  and reviewers are not flooded. Keep unrelated changes in separate pull
  requests.
- Stacked pull requests: merge the base first, retarget the next one to
  `main` (`gh pr edit NUMBER --base main`), and only then delete the base
  branch. Deleting the base first makes GitHub close the stacked pull
  request.
- If a merge conflict touches someone else's work and the right result is not
  obvious, stop and ask instead of guessing.

## Tags and releases

When the project tags a version:

1. Open a pull request titled "Release vX.Y.Z" that turns the `Unreleased`
   section of the changelog into `vX.Y.Z` with a one-line summary. Merge it
   after CI.
2. Tag the merge commit on `main`, signed, and push the tag:

   ```shell
   git tag -s vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   ```

Versions follow SemVer. Tags are never moved or deleted.

## Repository settings this workflow relies on

These are set once by the repository owner. Check them with
`gh api repos/OWNER/REPO` and `gh api repos/OWNER/REPO/rulesets`. If they
are missing, tell the person and give them the commands; do not change
repository settings or rulesets yourself.

- Merge settings: squash merges only, branches deleted after merge, auto
  merge allowed.

  ```shell
  gh api -X PATCH repos/OWNER/REPO \
    -F allow_squash_merge=true -F allow_merge_commit=false \
    -F allow_rebase_merge=false -F delete_branch_on_merge=true \
    -F allow_auto_merge=true \
    -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=PR_BODY
  ```

- Ruleset "main" on the default branch: no deletion, no force push, linear
  history, changes only through pull requests (squash only, review threads
  resolved), both CI checks required. Repository admins may bypass, so the
  owner is never locked out.

  ```json
  {
    "name": "main",
    "target": "branch",
    "enforcement": "active",
    "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
    "bypass_actors": [{ "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" }],
    "rules": [
      { "type": "deletion" },
      { "type": "non_fast_forward" },
      { "type": "required_linear_history" },
      { "type": "pull_request", "parameters": {
          "required_approving_review_count": 0,
          "dismiss_stale_reviews_on_push": false,
          "require_code_owner_review": false,
          "require_last_push_approval": false,
          "required_review_thread_resolution": true,
          "allowed_merge_methods": ["squash"] } },
      { "type": "required_status_checks", "parameters": {
          "strict_required_status_checks_policy": false,
          "required_status_checks": [
            { "context": "Build Frontend (React)" },
            { "context": "Build & Test Backend (Spring Boot)" } ] } }
    ]
  }
  ```

  ```shell
  gh api -X POST repos/OWNER/REPO/rulesets --input main-ruleset.json
  ```

  If a CI job is renamed, the ruleset's check names must be updated with it,
  or every pull request waits for a check that never runs.

- Ruleset for tags `refs/tags/v*`: no deletion, no update, no force push,
  with the same admin bypass.

## Ask before doing

- Force pushing anything other than your own unreviewed branch.
- Deleting branches, tags or releases you did not create.
- Changing repository settings, rulesets or secrets.
- Commenting on, reviewing, approving or closing someone else's pull request
  or issue in the person's name: draft the text and show it first.
- Rewriting history that is already on `main`.
