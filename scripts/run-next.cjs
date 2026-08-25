const { execFileSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const script = process.argv[2] || "dev:next";
const args = process.argv.slice(3);
const projectRoot = process.cwd();
const needsAlias = process.platform === "win32" && projectRoot.includes("#");

function normalizeWinPath(value) {
  return path.resolve(value).toLowerCase();
}

function currentSubstMappings() {
  try {
    const output = execFileSync("subst", { encoding: "utf8" });
    return output
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z]:)\\:\s=>\s(.+)$/i))
      .filter(Boolean)
      .map((match) => ({
        drive: match[1].slice(0, 1).toUpperCase() + ":\\",
        target: normalizeWinPath(match[2]),
      }));
  } catch {
    return [];
  }
}

function findOrCreateAlias() {
  const target = normalizeWinPath(projectRoot);
  const existing = currentSubstMappings().find((mapping) => mapping.target === target);
  if (existing) {
    return existing.drive;
  }

  for (const letter of "ZYXWVUTSRQPONMLKJIHGFEDCBA") {
    const drive = letter + ":";
    if (!fs.existsSync(drive + "\\")) {
      execFileSync("subst", [drive, projectRoot], { stdio: "inherit" });
      return drive + "\\";
    }
  }

  throw new Error("Could not find a free drive letter for a Next.js path alias.");
}

function quoteCmdArg(value) {
  return '"' + String(value).replace(/"/g, '\\"') + '"';
}

function npmRunCommand() {
  return ["npm", "run", script, "--", ...args.map(quoteCmdArg)].join(" ");
}

const cwd = needsAlias ? findOrCreateAlias() : projectRoot;
const childEnv = { ...process.env, INIT_CWD: cwd, PWD: cwd };

if (needsAlias) {
  console.log("Running Next.js from " + cwd + " to avoid # in the Windows project path.");
}

const child = process.platform === "win32"
  ? spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", npmRunCommand()], {
      cwd,
      env: childEnv,
      stdio: "inherit",
      shell: false,
    })
  : spawn("npm", ["run", script, "--", ...args], {
      cwd,
      env: childEnv,
      stdio: "inherit",
      shell: false,
    });

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code || 0);
});
