import type { Decision, MemberVerdict, SessionReport } from '../types.js';

const RESET = '\x1b[0m';
const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

export interface ConsoleOptions {
  color: boolean;
  all?: boolean;
}

function paint(text: string, code: string, on: boolean): string {
  return on ? `${code}${text}${RESET}` : text;
}

function decisionColor(d: Decision): string {
  return d === 'allow' ? C.green : d === 'warn' ? C.yellow : d === 'escalate' ? C.magenta : C.red;
}

function truncate(text: string, n = 84): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat;
}

function flagged(votes: MemberVerdict[]): MemberVerdict[] {
  return votes.filter((v) => v.severity !== 'ok');
}

/** Render a session report for the terminal. */
export function formatConsole(report: SessionReport, opts: ConsoleOptions): string {
  const { color } = opts;
  const lines: string[] = [];

  lines.push(`${paint('task:', C.dim, color)} ${report.task}`);
  const c = report.counts;
  lines.push(
    paint(
      `${report.total} steps: ${c.allow} allow, ${c.warn} warn, ${c.escalate} escalate, ${c.block} block`,
      C.dim,
      color,
    ),
  );
  lines.push('');

  report.steps.forEach((s, i) => {
    if (!opts.all && s.review.decision === 'allow') return;
    const tag = paint(
      s.review.decision.toUpperCase().padEnd(9),
      decisionColor(s.review.decision),
      color,
    );
    const kind = s.step.tool ? `${s.step.kind ?? 'step'}:${s.step.tool}` : (s.step.kind ?? 'step');
    lines.push(
      `  ${tag} ${paint(`#${i + 1}`, C.dim, color)} ${paint(kind, C.dim, color)}  ${truncate(s.step.content)}`,
    );
    for (const v of flagged(s.review.votes)) {
      const mark = v.severity === 'violation' ? '✗' : '!';
      lines.push(
        `            ${paint(`${mark} ${v.member}: ${v.reason}`, decisionColor(s.review.decision), color)}`,
      );
    }
  });

  if (!opts.all) {
    const hidden = report.steps.filter((s) => s.review.decision === 'allow').length;
    if (hidden > 0)
      lines.push(paint(`  (+${hidden} allowed steps hidden; use --all)`, C.dim, color));
  }

  lines.push('');
  const summary = `${report.flagged} of ${report.total} steps flagged by the council`;
  lines.push(paint(summary, report.flagged ? C.yellow : C.green, color));
  return lines.join('\n');
}
