#!/usr/bin/env node
/**
 * PreToolUse guard: deny `git push` in every form that can be detected statically.
 *
 * The permission patterns `Bash(git push:*)` / `PowerShell(git push*)` are prefix
 * matches, so they only catch a literal leading "git push". This hook parses the
 * command instead and covers:
 *
 *   git push                          plain
 *   git    push                       extra whitespace
 *   git.exe push / /usr/bin/git push  path or extension on the binary
 *   g"it" pu"sh"                      quote splitting
 *   git -C /repo push                 global flags with separate values
 *   git -c http.proxy=x push          global flags with attached values
 *   GIT_DIR=. git push                leading environment assignments
 *   echo hi && git push               chained / piped / sequenced segments
 *   $(git push) and `git push`        command substitution
 *   bash -c "git push"                interpreter wrappers, recursively
 *   xargs git push                    argument forwarders
 *   git p        (alias.p = push)     git aliases, resolved from git config
 *   git deploy   (alias.deploy = !git push origin main)   shell-form git aliases
 *   gp           (alias gp='git push' in ~/.bashrc etc.)  shell aliases
 *   alias x='git push'; x             shell aliases defined inline
 *   npm run deploy  (script pushes)   package.json script bodies
 *   git $SUBCMD                       unverifiable indirection -> denied
 *
 * It fails CLOSED: when the effective subcommand cannot be determined but the word
 * `push` is present, the command is denied. A false denial costs one rephrase; a
 * false pass costs an unwanted push to a remote.
 *
 * What it cannot see (documented, not pretended away):
 *   - a value that only exists at runtime: `git $(cat /tmp/x)`, `eval "$B64"`
 *   - a push inside a script file the command merely executes: `bash deploy.sh`
 *   - a git alias defined in a repository this hook cannot read config from
 *
 * Output contract: silence + exit 0 to let the normal permission flow continue;
 * a PreToolUse deny decision to block. It never emits "allow", so it can only ever
 * subtract permission, never grant it.
 */

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const MAX_DEPTH = 6;

/** Wrappers whose remaining arguments are themselves a command. */
const FORWARDERS = new Set(['env', 'sudo', 'doas', 'nohup', 'time', 'command', 'exec', 'xargs', 'nice', 'stdbuf']);

/** Interpreters that take a command string after -c / -Command / /c. */
const INTERPRETERS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh', 'fish', 'pwsh', 'powershell', 'cmd']);

/** git global options that consume the NEXT token as their value. */
const GIT_GLOBAL_WITH_VALUE = new Set([
  '-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--super-prefix', '--config-env'
]);

/**
 * Subcommands where a bare `push` argument is ordinary prose or a ref name, so the
 * defensive "bare push token" check must not fire (`git commit -m push`).
 */
const WORDY_SUBCOMMANDS = new Set([
  'commit', 'log', 'grep', 'tag', 'branch', 'config', 'notes', 'stash', 'merge', 'revert',
  'cherry-pick', 'describe', 'show', 'rev-parse', 'checkout', 'switch', 'restore', 'rebase',
  'diff', 'blame', 'bisect', 'worktree', 'help', 'shortlog', 'reflog', 'reset'
]);

function main() {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    process.exit(0); // unparseable stdin: stay out of the way
  }

  const command = payload?.tool_input?.command;
  if (typeof command !== 'string' || !command.trim()) process.exit(0);

  let reason = null;
  try {
    reason = scan(command, 0, new Map());
  } catch {
    process.exit(0); // a bug in this guard must not wedge every Bash call
  }

  if (reason) deny(reason);
  process.exit(0);
}

function deny(reason) {
  const text =
    `Blocked by the git-push guard: ${reason}\n` +
    `Pushing is a human step in this repository (see AGENTS.md and policy/sprint-window.json). ` +
    `Ask the user to run the push themselves.`;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: text
      }
    })
  );
  process.exit(0);
}

/* ------------------------------------------------------------------ scanning */

function scan(command, depth, localAliases) {
  if (depth > MAX_DEPTH) return null;

  const { segments, substitutions } = split(command);

  for (const body of substitutions) {
    const hit = scan(body, depth + 1, localAliases);
    if (hit) return hit;
  }

  for (const segment of segments) {
    const hit = scanSegment(segment, depth, localAliases);
    if (hit) return hit;
  }
  return null;
}

function scanSegment(segment, depth, localAliases) {
  let tokens = tokenize(segment);
  if (tokens.length === 0) return null;

  // `alias gp='git push'` — register, then let later segments resolve it.
  if (normalizeName(tokens[0]) === 'alias') {
    for (const t of tokens.slice(1)) {
      const eq = t.indexOf('=');
      if (eq > 0) localAliases.set(t.slice(0, eq), t.slice(eq + 1));
    }
    return null;
  }

  // Drop leading VAR=value assignments and command forwarders.
  let sawForwarder = false;
  while (tokens.length > 0) {
    const head = tokens[0];
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(head)) { tokens = tokens.slice(1); continue; }
    if (FORWARDERS.has(normalizeName(head))) { tokens = tokens.slice(1); sawForwarder = true; continue; }
    break;
  }
  if (tokens.length === 0) return null;

  // `sudo -n git push`, `sudo -u bob git push`, `xargs -n1 git push`: the forwarder's
  // own flags sit between it and the real command, and their arity is unknown here.
  // Skip ahead to the next token that names a command we can reason about.
  if (sawForwarder && tokens[0].startsWith('-')) {
    const at = tokens.findIndex((t) => isCommandName(normalizeName(t)));
    if (at === -1) return null;
    tokens = tokens.slice(at);
  }

  const name = normalizeName(tokens[0]);
  const args = tokens.slice(1);

  // bash -c "…" / pwsh -Command "…" / cmd /c "…"
  if (INTERPRETERS.has(name)) {
    const i = args.findIndex((a) => /^(-c|-Command|-EncodedCommand|\/c|\/k)$/i.test(a));
    if (i !== -1 && args[i + 1] !== undefined) {
      if (/EncodedCommand/i.test(args[i])) {
        return 'an encoded interpreter command, whose contents cannot be inspected';
      }
      return scan(args.slice(i + 1).join(' '), depth + 1, localAliases);
    }
    return null;
  }

  // npm run <script> / yarn <script> / pnpm run <script>
  if (['npm', 'pnpm', 'yarn', 'bun'].includes(name)) {
    const scriptName = name === 'yarn' ? args[0] : args[0] === 'run' ? args[1] : undefined;
    const body = scriptName && lookupNpmScript(scriptName);
    if (body) {
      const hit = scan(body, depth + 1, localAliases);
      if (hit) return `\`${name} run ${scriptName}\` runs a script that ${hit}`;
    }
    return null;
  }

  // The historical dashed form is a direct hit.
  if (name === 'git-push') return 'it invokes git-push directly';

  if (name === 'git') return inspectGit(args, depth, localAliases);

  // A shell alias, defined inline in this command or in a login profile.
  const aliasBody = localAliases.get(tokens[0]) ?? shellAliases().get(tokens[0]);
  if (aliasBody) {
    const hit = scan(aliasBody, depth + 1, localAliases);
    if (hit) return `the shell alias \`${tokens[0]}\` expands to a command that ${hit}`;
  }

  // Defensive net: a git binary that is not the head of the segment (an unquoted
  // path with a space, a construct this guard does not model) followed by a bare
  // `push`. Starts at index 1 because a leading `git` was already judged above --
  // that is what keeps `git commit -m push` passing.
  for (let i = 1; i < tokens.length - 1; i++) {
    const n = normalizeName(tokens[i]);
    if ((n === 'git' || n === 'git-push') && tokens.slice(i + 1).some((t) => t === 'push')) {
      return 'a git binary appears mid-command followed by a bare `push` argument';
    }
  }

  return null;
}

/** Walk git's global options to find the effective subcommand, then judge it. */
function inspectGit(args, depth, localAliases) {
  let i = 0;
  while (i < args.length) {
    const a = args[i];
    if (!a.startsWith('-')) break;
    if (GIT_GLOBAL_WITH_VALUE.has(a)) { i += 2; continue; }   // -C <path>
    i += 1;                                                    // --bare, --git-dir=x, …
  }

  const subcommand = args[i];
  const rest = args.slice(i + 1);

  if (subcommand === undefined) {
    return args.some((a) => a === 'push') ? 'a git invocation whose arguments include `push`' : null;
  }

  if (/[$`]/.test(subcommand)) {
    return `the git subcommand is built from a variable (\`${subcommand}\`), so it cannot be verified as safe`;
  }

  if (subcommand === 'push') return 'it runs `git push`';

  const resolved = resolveGitAlias(subcommand, depth, localAliases);
  if (resolved) return resolved;

  // Defensive net for a global flag this guard does not know about.
  const effective = gitAliasTarget(subcommand) ?? subcommand;
  if (!WORDY_SUBCOMMANDS.has(effective) && rest.some((a) => a === 'push')) {
    return `a git invocation with a bare \`push\` argument that could not be ruled out (subcommand \`${subcommand}\`)`;
  }

  return null;
}

/** Follow alias.<name> through git config, including the `!shell command` form. */
function resolveGitAlias(subcommand, depth, localAliases) {
  const body = gitAliases().get(subcommand);
  if (!body) return null;

  if (body.startsWith('!')) {
    const hit = scan(body.slice(1), depth + 1, localAliases);
    return hit ? `the git alias \`${subcommand}\` runs a shell command that ${hit}` : null;
  }

  const hit = inspectGit(tokenize(body), depth + 1, localAliases);
  return hit ? `the git alias \`${subcommand}\` expands to a command that ${hit}` : null;
}

function gitAliasTarget(subcommand) {
  const body = gitAliases().get(subcommand);
  if (!body || body.startsWith('!')) return null;
  return tokenize(body)[0];
}

/* -------------------------------------------------------------- lexing */

/**
 * Split on top-level shell operators, respecting quotes, and collect the bodies of
 * $( … ) and ` … ` substitutions for separate scanning.
 */
function split(s) {
  const segments = [];
  const substitutions = [];
  let cur = '';
  let quote = null;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];

    if (quote) {
      // Command substitution still expands inside double quotes.
      if (quote === '"' && c === '$' && s[i + 1] === '(') {
        const end = matchParen(s, i + 1);
        if (end !== -1) { substitutions.push(s.slice(i + 2, end)); i = end; continue; }
      }
      // Quote marks are preserved verbatim; only operators are split on here, and
      // tokenize() does the quote handling. Dropping them would break both
      // `g"it" pu"sh"` and `alias gp='git push'`.
      if (c === quote) quote = null;
      cur += c;
      continue;
    }

    if (c === '\\' && isEscapable(s[i + 1])) { cur += c + s[i + 1]; i += 1; continue; }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }

    if (c === '$' && s[i + 1] === '(') {
      const end = matchParen(s, i + 1);
      if (end !== -1) { substitutions.push(s.slice(i + 2, end)); i = end; continue; }
    }
    if (c === '`') {
      const end = s.indexOf('`', i + 1);
      if (end !== -1) { substitutions.push(s.slice(i + 1, end)); i = end; continue; }
    }

    if (c === '&' || c === '|' || c === ';' || c === '\n' || c === '(' || c === ')' || c === '{' || c === '}') {
      segments.push(cur);
      cur = '';
      continue;
    }

    cur += c;
  }

  segments.push(cur);
  return { segments: segments.filter((x) => x.trim()), substitutions };
}

function matchParen(s, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === '(') depth += 1;
    else if (s[i] === ')') { depth -= 1; if (depth === 0) return i; }
  }
  return -1;
}

/** Whitespace split that keeps quoted runs together and drops the quote marks. */
function tokenize(s) {
  const out = [];
  let cur = '';
  let quote = null;
  let started = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === quote) quote = null;
      else cur += c;
      started = true;
      continue;
    }
    // Only treat a backslash as an escape before a character it could plausibly
    // escape. Otherwise it is a Windows path separator: C:\Program Files\git.exe
    if (c === '\\' && isEscapable(s[i + 1])) { cur += s[i + 1]; i += 1; started = true; continue; }
    if (c === '"' || c === "'") { quote = c; started = true; continue; }
    if (/\s/.test(c)) { if (cur || started) { out.push(cur); cur = ''; started = false; } continue; }
    cur += c;
  }
  if (cur || started) out.push(cur);
  return out;
}

/** Names this guard knows how to reason about as the head of a command. */
function isCommandName(name) {
  return name === 'git' || name === 'git-push' || INTERPRETERS.has(name) ||
    ['npm', 'pnpm', 'yarn', 'bun'].includes(name);
}

/** Characters a backslash meaningfully escapes in a shell word. */
function isEscapable(c) {
  return c !== undefined && (c === '"' || c === "'" || c === '`' || c === '$' || c === '\\' || /\s/.test(c));
}

/** `/usr/bin/git.exe` -> `git` */
function normalizeName(token) {
  if (!token) return '';
  const base = token.split(/[\\/]/).pop() ?? token;
  return base.replace(/\.(exe|cmd|bat|ps1)$/i, '').toLowerCase();
}

/* ------------------------------------------------------------ lazy lookups */

let gitAliasCache = null;
function gitAliases() {
  if (gitAliasCache) return gitAliasCache;
  gitAliasCache = new Map();
  try {
    const out = execFileSync('git', ['config', '--get-regexp', '^alias\\.'], {
      encoding: 'utf8',
      timeout: 4000,
      stdio: ['ignore', 'pipe', 'ignore']
    });
    for (const line of out.split('\n')) {
      const m = /^alias\.(\S+)\s+([\s\S]*)$/.exec(line.trim());
      if (m) gitAliasCache.set(m[1], m[2].trim());
    }
  } catch {
    /* no git, no repo, or no aliases */
  }
  return gitAliasCache;
}

let shellAliasCache = null;
function shellAliases() {
  if (shellAliasCache) return shellAliasCache;
  shellAliasCache = new Map();
  const home = homedir();
  const files = ['.bashrc', '.bash_profile', '.bash_aliases', '.profile', '.zshrc', '.zprofile'];
  for (const f of files) {
    const p = join(home, f);
    try {
      if (!existsSync(p)) continue;
      for (const line of readFileSync(p, 'utf8').split('\n')) {
        const m = /^\s*alias\s+([A-Za-z0-9_.-]+)=(.+)$/.exec(line);
        if (!m) continue;
        let body = m[2].trim().replace(/\s+#.*$/, '');
        if ((body.startsWith("'") && body.endsWith("'")) || (body.startsWith('"') && body.endsWith('"'))) {
          body = body.slice(1, -1);
        }
        shellAliasCache.set(m[1], body);
      }
    } catch {
      /* unreadable profile: skip it */
    }
  }
  return shellAliasCache;
}

let npmScriptCache = null;
function lookupNpmScript(name) {
  if (!npmScriptCache) {
    npmScriptCache = new Map();
    try {
      const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
      for (const [k, v] of Object.entries(pkg.scripts ?? {})) {
        if (typeof v === 'string') npmScriptCache.set(k, v);
      }
    } catch {
      /* no package.json here */
    }
  }
  return npmScriptCache.get(name);
}

main();
