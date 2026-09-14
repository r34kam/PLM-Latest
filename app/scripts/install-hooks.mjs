/**
 * Point this clone's git at the repo's versioned hooks (`.githooks/`), so the
 * pre-push core-stack check runs.
 *
 * Run from the app's `prepare` script, which `bun install` / `npm install` execute —
 * so cloning and installing dependencies is all a user has to do. (`.git/hooks` is
 * not versioned, which is why the hook cannot simply ship in place.)
 *
 * Skipped when UNIFY_SKIP_GIT_HOOKS is set: the ENGINE also runs `bun install` in
 * every branch tree, and installing hooks there would make the engine's own
 * post-turn push run the check — an agent edit that tripped it would fail the
 * session's git sync rather than the user's push, which is not what this is for.
 *
 * Never fails the install: hooks are a convenience, and a missing git or a
 * non-repo directory must not stop dependencies from installing.
 */
import { execFileSync } from "node:child_process";

if (process.env.UNIFY_SKIP_GIT_HOOKS) process.exit(0);

try {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();

  // Relative to the working-tree root, so the setting survives the clone being moved.
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
    cwd: root,
    stdio: "ignore",
  });
} catch {
  // not a git repo, or git unavailable — nothing to install, nothing to report
}
