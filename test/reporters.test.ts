import { describe, it, expect } from 'vitest';
import { renderHtml, formatConsole, formatJson } from '../src/reporters/index.js';
import { buildSessionReport } from '../src/session.js';
import type { SessionReport, SessionStepResult } from '../src/types.js';

function sample(): SessionReport {
  const steps: SessionStepResult[] = [
    {
      step: { kind: 'thought', content: 'a fine step' },
      review: {
        decision: 'allow',
        votes: [{ member: 'safe', severity: 'ok', confidence: 0.7, reason: 'fine' }],
        reasons: [],
        task: 't',
        step: { kind: 'thought', content: 'a fine step' },
      },
    },
    {
      step: { kind: 'action', content: '<script>alert(1)</script> rm -rf /' },
      review: {
        decision: 'block',
        votes: [{ member: 'safe', severity: 'violation', confidence: 0.9, reason: 'destructive' }],
        reasons: ['safe: destructive'],
        task: 't',
        step: { kind: 'action', content: '<script>alert(1)</script> rm -rf /' },
      },
    },
  ];
  return buildSessionReport('t', steps);
}

describe('reporters', () => {
  it('renders self-contained HTML, escaping step content', () => {
    const html = renderHtml(sample());
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('Quorum');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders console output with no ANSI when color is off', () => {
    const out = formatConsole(sample(), { color: false, all: true });
    // eslint-disable-next-line no-control-regex
    expect(out).not.toMatch(/\x1b\[/);
    expect(out).toContain('BLOCK');
  });

  it('renders JSON that parses with counts', () => {
    const parsed = JSON.parse(formatJson(sample()));
    expect(parsed.total).toBe(2);
    expect(parsed.counts.block).toBe(1);
  });
});
