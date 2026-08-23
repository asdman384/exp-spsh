// PreToolUse-хук: единственная точка принуждения.
//
// Закрывает ровно то, чего permission-паттерны не умеют:
//   1. путь внутри инструмента — "генерировать можно, но только в src/app/features/";
//   2. содержимое файла — секрет в теле компонента, а не в имени файла;
//   3. состояние во времени — срок разрешения перечитывается В МОМЕНТ ВЫЗОВА;
//   4. аудит каждого перехваченного вызова.
//
// Контракт: stdin = JSON события, stdout = ТОЛЬКО решение в JSON, exit 0.
// Логи идут в файл: посторонний вывод в stdout сломает разбор решения.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const AUDIT = path.join(ROOT, 'logs', 'audit.log');
const POLICY = path.join(ROOT, 'policy', 'sprint-window.json');

const SECRET_PATTERNS = [
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bsk-(live|test)?[-_]?[A-Za-z0-9]{16,}\b/,
  /\bghp_[A-Za-z0-9]{20,}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}\b/,
];

// Схематики Angular, создающие файлы в дереве исходников.
const SCHEMATICS = 'component|c|service|s|guard|g|directive|d|pipe|p|interceptor|module|m|class|interface|enum|resolver';

const norm = (p) => String(p ?? '').replace(/\\/g, '/').replace(/^\.\//, '');

// Claude Code передаёт file_path АБСОЛЮТНЫМ ("C:/dev/proj/src/core/x.ts").
// Без приведения к пути внутри проекта ни одна проверка области не сработает.
// Возвращает null, если путь ведёт за пределы проекта — это отдельный отказ.
const PROJECT_ROOT = norm(ROOT).replace(/\/+$/, '');
const sameCase = (s) => (process.platform === 'win32' ? s.toLowerCase() : s);

function toProjectPath(p) {
  const t = norm(p);
  if (!t) return null;
  const isAbsolute = /^[A-Za-z]:\//.test(t) || t.startsWith('/');
  if (!isAbsolute) return t.replace(/^(\.\/)+/, '');
  if (sameCase(t) === sameCase(PROJECT_ROOT)) return '';
  if (sameCase(t).startsWith(sameCase(PROJECT_ROOT) + '/')) return t.slice(PROJECT_ROOT.length + 1);
  return null;   // за пределами проекта
}

function audit(entry) {
  try {
    fs.mkdirSync(path.dirname(AUDIT), { recursive: true });
    fs.appendFileSync(AUDIT, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
  } catch { /* аудит не должен ронять хук */ }
}

function decide(decision, reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,          // "deny" | "ask"
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

const pass = () => process.exit(0);   // решения нет → обычный permission flow

async function readStdin() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  return raw;
}

const ev = JSON.parse((await readStdin().catch(() => '')) || '{}');
const tool = ev.tool_name ?? 'unknown';
const input = ev.tool_input ?? {};
const identity = `${process.env.USERNAME || process.env.USER || 'unknown'}@w3-assessment`;
const base = { tool, session: ev.session_id, identity, mode: ev.permission_mode };

let policy;
try {
  policy = JSON.parse(fs.readFileSync(POLICY, 'utf8'));
} catch (e) {
  audit({ ...base, decision: 'deny', rule: 'policy-unreadable' });
  decide('deny', `Заблокировано хуком: policy/sprint-window.json не читается (${e.message}). `
    + `Без действующей политики действие не выполняется — fail closed.`);
}

const now = new Date();
const expired = !(now < new Date(policy.not_after));
const ctx = { policy_id: policy.policy_id, not_after: policy.not_after };

const expiredReason = () =>
  `Заблокировано хуком: разрешение ${policy.policy_id} истекло ${policy.not_after} `
  + `(сейчас ${now.toISOString()}). Нужно новое решение владельца, а не повтор.`;

const identityReason = () =>
  `Заблокировано хуком: разрешение выдано ${policy.actor}, действует ${identity}. `
  + `Полномочие непереносимо между личностями.`;

const inScope = (target) =>
  (policy.allowed_write_paths ?? []).some((p) => norm(target).startsWith(norm(p)));

// ─────────── Write / Edit: содержимое и путь ───────────
if (tool === 'Write' || tool === 'Edit' || tool === 'MultiEdit' || tool === 'NotebookEdit') {
  const raw = norm(input.file_path ?? input.notebook_path);
  const target = toProjectPath(raw);
  const body = [
    input.content,
    input.new_string,
    input.new_str,
    input.new_source,
    ...(Array.isArray(input.edits) ? input.edits.map((e) => e?.new_string ?? e?.new_str) : []),
  ].filter(Boolean).join('\n');

  // Fail closed: путь вне проекта либо неразобран — отказ, а не пропуск.
  if (target === null) {
    audit({ ...base, ...ctx, target: raw, decision: 'deny', rule: 'path-outside-project' });
    decide('deny', `Заблокировано хуком: "${raw}" находится за пределами проекта `
      + `(${PROJECT_ROOT}). Запись за пределы рабочего дерева не разрешена.`);
  }

  const hit = SECRET_PATTERNS.find((re) => re.test(body));
  if (hit) {
    audit({ ...base, ...ctx, target, decision: 'deny', rule: 'secret-in-content' });
    decide('deny', `Заблокировано хуком: содержимое похоже на действующий секрет (${hit}). `
      + `Проверка по телу файла, а не по имени — permission-паттерн такое не ловит.`);
  }

  const denied = (policy.denied_write_paths ?? []).find((p) => target.startsWith(norm(p)));
  if (denied) {
    audit({ ...base, ...ctx, target, decision: 'deny', rule: 'path-explicitly-denied' });
    decide('deny', `Заблокировано хуком: "${target}" — защищённый путь ("${denied}"). `
      + `Эти файлы правит человек.`);
  }

  // Path scoping внутри инструмента: под src/ пишем только в разрешённые пути.
  // target здесь уже относительный, так что проверка работает и для
  // абсолютных путей, которые приходят от Claude Code.
  if (target === 'src' || target.startsWith('src/')) {
    if (!inScope(target)) {
      audit({ ...base, ...ctx, target, decision: 'deny', rule: 'path-out-of-scope' });
      decide('deny', `Заблокировано хуком: запись в "${target}" вне области `
        + `${JSON.stringify(policy.allowed_write_paths)}. Инструмент Write разрешён целиком — `
        + `границу пути задаёт хук, а не permissions.`);
    }
    if (expired) {
      audit({ ...base, ...ctx, target, decision: 'deny', rule: 'permission-expired' });
      decide('deny', expiredReason());
    }
  }

  audit({ ...base, ...ctx, target, decision: 'pass', rule: 'within-envelope' });
  pass();
}

if (tool !== 'Bash') {
  audit({ ...base, decision: 'pass', rule: 'not-guarded-tool' });
  pass();
}

const command = String(input.command ?? '');

// ─────────── Читающие сверки: полномочий не требуют ───────────
// Возможность узнать, что произошло, не должна отключаться вместе с правом действовать.
if (/scripts[\\/](verify-scaffold|verify-dist|doctor)\.mjs/.test(command)
    || /\bng\s+version\b/.test(command)) {
  audit({ ...base, ...ctx, target: 'reconcile', decision: 'pass', rule: 'read-only-reconcile' });
  pass();
}

// ─────────── Генерация через настоящий Angular CLI ───────────
// Ловит: ng g c x, npx ng generate component x, npm run gen -- x,
//        node scripts/guarded-scaffold.mjs base c1 c2, repair-scaffold.
const generateRe = new RegExp(`\\bng\\s+(?:g|generate)\\s+(?:${SCHEMATICS})\\b`);
const scaffoldRe = /scripts[\\/](guarded-scaffold|repair-scaffold)\.mjs/;

if (generateRe.test(command) || scaffoldRe.test(command)) {
  if (policy.actor !== identity) {
    audit({ ...base, ...ctx, decision: 'deny', rule: 'identity-mismatch' });
    decide('deny', identityReason());
  }
  if (expired) {
    audit({ ...base, ...ctx, decision: 'deny', rule: 'permission-expired' });
    decide('deny', expiredReason());
  }

  // repair-scaffold работает строго по ранее зафиксированному плану,
  // а план уже был проверен при создании — целевой путь берём оттуда.
  let targets = [];
  if (/repair-scaffold/.test(command)) {
    try {
      const st = JSON.parse(fs.readFileSync(path.join(ROOT, '.w3', 'scaffold-intent.json'), 'utf8'));
      targets = [`src/app/${String(st.base).replace(/^src\/app\//, '')}`];
    } catch {
      audit({ ...base, ...ctx, decision: 'deny', rule: 'plan-unreadable' });
      decide('deny', 'Заблокировано хуком: план .w3/scaffold-intent.json не читается. '
        + 'Восстановление без зафиксированного плана не выполняется.');
    }
  } else {
    // Цепочки (&&, ;, |) могут содержать несколько вызовов. Берём ВСЕ:
    // одного разрешённого пути в начале команды недостаточно.
    const collect = (re) => [...command.matchAll(re)].map((m) => m[1]);
    const rawTargets = [
      ...collect(/guarded-scaffold\.mjs\s+([^\s"'-][^\s"']*)/g),
      ...collect(new RegExp(`\\bng\\s+(?:g|generate)\\s+(?:${SCHEMATICS})\\s+([^\\s"']+)`, 'g')),
    ];
    targets = rawTargets.map((t) => {
      const rel = toProjectPath(t);
      if (rel === null) return null;                       // за пределами проекта
      return rel.startsWith('src/') ? rel : `src/app/${rel}`;
    });
  }

  // Fail closed: хотя бы одна неразобранная цель — отказ всей команды.
  if (targets.includes(null)) {
    audit({ ...base, ...ctx, decision: 'deny', rule: 'path-outside-project' });
    decide('deny', 'Заблокировано хуком: одна из целей генерации ведёт за пределы проекта.');
  }

  if (!targets.length) {
    audit({ ...base, ...ctx, decision: 'deny', rule: 'target-unparsed' });
    decide('deny', 'Заблокировано хуком: не удалось определить целевой путь генерации. '
      + 'Цель должна быть указана явно.');
  }

  const bad = targets.map(norm).find((t) => !inScope(t));
  if (bad) {
    audit({ ...base, ...ctx, target: bad, decision: 'deny', rule: 'path-out-of-scope' });
    decide('deny', `Заблокировано хуком: генерация в "${bad}" вне области `
      + `${JSON.stringify(policy.allowed_write_paths)}.`);
  }

  audit({ ...base, ...ctx, target: targets.join(','), decision: 'pass', rule: 'within-envelope' });
  pass();
}

// ─────────── Сборка ───────────
if (/\bng\s+build\b/.test(command) || /scripts[\\/]guarded-build\.mjs/.test(command)) {
  if (policy.actor !== identity) {
    audit({ ...base, ...ctx, decision: 'deny', rule: 'identity-mismatch' });
    decide('deny', identityReason());
  }
  if (expired) {
    audit({ ...base, ...ctx, decision: 'deny', rule: 'permission-expired' });
    decide('deny', expiredReason());
  }

  const cfg = (command.match(/--configuration[\s=]+([A-Za-z0-9_-]+)/) ?? [])[1]
    ?? (/--prod\b/.test(command) ? 'production' : 'development');
  const target = `build:${cfg}`;

  if ((policy.approval_required_configurations ?? []).includes(cfg)) {
    audit({ ...base, ...ctx, target, decision: 'ask', rule: 'approval-required' });
    decide('ask', `Требуется одобрение человека: конфигурация "${cfg}" помечена как `
      + `approval_required в ${policy.policy_id}. Подтвердите ровно эту сборку.`);
  }
  if (!(policy.allowed_build_configurations ?? []).includes(cfg)) {
    audit({ ...base, ...ctx, target, decision: 'deny', rule: 'configuration-out-of-scope' });
    decide('deny', `Заблокировано хуком: конфигурация "${cfg}" вне области `
      + `${JSON.stringify(policy.allowed_build_configurations)}. `
      + `Продакшн-сборка агенту не разрешена.`);
  }

  audit({ ...base, ...ctx, target, decision: 'pass', rule: 'within-envelope' });
  pass();
}

audit({ ...base, ...ctx, target: command.slice(0, 120), decision: 'pass', rule: 'not-guarded-command' });
pass();
