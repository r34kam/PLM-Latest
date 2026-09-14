/**
 * Core-stack guard.
 *
 * This app is built in the cloud by an agent that runs `bun run build` — a Vite +
 * React build, nothing else. Swapping the stack (dropping React, replacing Vite with
 * another bundler, deleting vite.config.ts) leaves a repo the cloud builder cannot
 * build at all, and the failure shows up there rather than here. This check runs
 * before a push so it is caught locally, while the change is still yours to undo.
 *
 * Adding packages is entirely fine — that is expected. Only REMOVING the pieces the
 * cloud build stands on is refused.
 *
 * Usage:
 *   node scripts/check-core-stack.mjs             # check the working tree
 *   node scripts/check-core-stack.mjs --ref <sha> # check a commit being pushed
 *
 * Exit 0 = fine, 1 = would break the cloud build.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

// Present in dependencies OR devDependencies — the split is not what matters.
const REQUIRED_PACKAGES = [
  "react",
  "react-dom",
  "vite",
  "@vitejs/plugin-react",
  "tailwindcss",
  "typescript",
  "@tanstack/react-query",
];

// Files the build cannot start without.
const REQUIRED_FILES = ["app/vite.config.ts", "app/index.html"];

const ref = process.argv.includes("--ref")
  ? process.argv[process.argv.indexOf("--ref") + 1]
  : null;

/** File contents at `ref`, or from disk when checking the working tree. */
function read(path) {
  if (!ref) return existsSync(path) ? readFileSync(path, "utf8") : null;
  try {
    return execFileSync("git", ["show", `${ref}:${path}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null; // absent at that commit
  }
}

const problems = [];
const manifestRaw = read("app/package.json");

if (manifestRaw === null) {
  problems.push("app/package.json is missing");
} else {
  let manifest;
  try {
    manifest = JSON.parse(manifestRaw);
  } catch (error) {
    problems.push(`app/package.json is not valid JSON (${error.message})`);
  }

  if (manifest) {
    const declared = {
      ...(manifest.dependencies ?? {}),
      ...(manifest.devDependencies ?? {}),
    };
    const missing = REQUIRED_PACKAGES.filter((name) => !(name in declared));
    if (missing.length > 0) {
      problems.push(`removed from app/package.json: ${missing.join(", ")}`);
    }

    const build = manifest.scripts?.build;
    if (!build) {
      problems.push("app/package.json has no `build` script");
    } else if (!/\bvite\b/.test(build)) {
      problems.push(
        `the \`build\` script no longer runs vite (found: ${build.trim()})`,
      );
    }
  }
}

for (const file of REQUIRED_FILES) {
  if (read(file) === null) problems.push(`${file} is missing`);
}

if (problems.length === 0) process.exit(0);

const where = ref ? `commit ${ref.slice(0, 8)}` : "your working tree";
console.error(`
✖ This push would break the cloud build.

The app is built in the cloud with Vite + React. ${where} removes something that
build depends on:

${problems.map((p) => `  • ${p}`).join("\n")}

Adding packages is fine — this only refuses removing the core stack. Restore the
items above and push again.

If you are certain (and accept that the cloud builder may stop working for this app):
  git push --no-verify
`);
process.exit(1);
