#!/usr/bin/env node
/**
 * Regression tests for the git-push guard.
 *
 *   node .claude/hooks/deny-git-push.test.mjs
 *
 * Each case runs the hook exactly the way Claude Code does: the PreToolUse payload
 * on stdin, the decision read back from stdout. Exits non-zero if any case fails.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), 'deny-git-push.mjs');

function decide(command) {
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    encoding: 'utf8'
  });
  const out = (res.stdout || '').trim();
  if (!out) return { decision: 'pass' };
  try {
    return { decision: JSON.parse(out).hookSpecificOutput.permissionDecision, raw: out };
  } catch {
    return { decision: 'malformed', raw: out };
  }
}

const MUST_DENY = [
  'git push',
  'git    push',
  'git push origin master',
  'git push --dry-run',
  'git.exe push',
  '/usr/bin/git push',
  '"C:\\Program Files\\Git\\bin\\git.exe" push',
  'C:\\Program Files\\Git\\bin\\git.exe push', // unquoted; caught by the mid-command net
  'C:/Progra~1/Git/bin/git.exe push',
  'g"it" pu"sh"',
  "'git' 'push'",
  'git -C /repo push',
  'git --git-dir /x --work-tree /y push',
  'git --git-dir=/x push',
  'git -c http.proxy=x push',
  'git --no-pager push',
  'git -c a=b -C . --no-pager push origin HEAD',
  'GIT_DIR=. git push',
  'GIT_SSH_COMMAND="ssh -i k" git push',
  'echo hi && git push',
  'npm test; git push',
  'true | git push',
  'git status || git push',
  'npm test &&\ngit push',
  'bash -c "git push"',
  "sh -c 'git push origin main'",
  'pwsh -Command "git push"',
  'bash -c "bash -c \'git push\'"',
  'echo $(git push)',
  'echo `git push`',
  'echo "$(git push)"',
  'xargs git push',
  'env git push',
  'sudo git push',
  'sudo -n git push',
  'nohup time git push',
  'git-push',
  'git $SUB',
  'git ${SUBCMD}',
  'alias gp=\'git push\'; gp',
  'alias deploy="git push origin main" ; deploy',
  'bash -EncodedCommand ZwBpAHQAIABwAHUAcwBoAA=='
];

const MUST_PASS = [
  'git status',
  'git log --oneline -5',
  'git diff --stat',
  'git commit -m push',
  'git commit -m "push the button"',
  'git log --grep=push',
  'git add -A && git commit -m "wip"',
  'npm test',
  'npm run build',
  'bash scripts/harness.sh',
  'ls -la',
  'echo "do not git push"',
  'git remote -v',
  'git fetch origin',
  'git branch -a',
  'cat docs/specs/push-notifications.md',
  'grep -r "push" src/',
  'node -e "console.log(1)"'
];

let failures = 0;

console.log('--- must DENY ---');
for (const cmd of MUST_DENY) {
  const { decision } = decide(cmd);
  const ok = decision === 'deny';
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${JSON.stringify(cmd)}${ok ? '' : `  (got ${decision})`}`);
}

console.log('\n--- must PASS ---');
for (const cmd of MUST_PASS) {
  const { decision } = decide(cmd);
  const ok = decision === 'pass';
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${JSON.stringify(cmd)}${ok ? '' : `  (got ${decision})`}`);
}

console.log(
  `\n${failures === 0 ? 'all green' : `${failures} failing`} ` +
    `(${MUST_DENY.length} deny cases, ${MUST_PASS.length} pass cases)`
);
process.exit(failures === 0 ? 0 : 1);
