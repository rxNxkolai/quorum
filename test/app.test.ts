import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { run, type RunIO } from '../src/app.js';

function capture(): { io: RunIO; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { out: (s) => out.push(s), err: (s) => err.push(s) }, out, err };
}

const TRANSCRIPT = resolve('examples/transcript.json');

describe('cli run()', () => {
  let cwd0: string;
  let dir: string;
  beforeEach(() => {
    cwd0 = process.cwd();
    dir = mkdtempSync(join(tmpdir(), 'quorum-'));
    process.chdir(dir);
  });
  afterEach(() => {
    process.chdir(cwd0);
    rmSync(dir, { recursive: true, force: true });
  });

  it('prints help by default', async () => {
    const c = capture();
    expect(await run([], c.io)).toBe(0);
    expect(c.out.join('\n')).toContain('quorum');
  });

  it('prints a semver version', async () => {
    const c = capture();
    expect(await run(['--version'], c.io)).toBe(0);
    expect(c.out.join('\n')).toMatch(/\d+\.\d+\.\d+/);
  });

  it('lists members', async () => {
    const c = capture();
    expect(await run(['members'], c.io)).toBe(0);
    expect(c.out.join('\n')).toContain('on-task');
  });

  it('reviews the example transcript', async () => {
    const c = capture();
    expect(await run(['review', TRANSCRIPT, '--no-color'], c.io)).toBe(0);
    expect(c.out.join('\n')).toMatch(/steps/);
  });

  it('emits JSON with counts', async () => {
    const c = capture();
    await run(['review', TRANSCRIPT, '--json'], c.io);
    const parsed = JSON.parse(c.out.join('\n'));
    expect(typeof parsed.total).toBe('number');
    expect(parsed.counts).toBeDefined();
  });

  it('fails the --strict gate when steps are blocked or escalated', async () => {
    const c = capture();
    expect(await run(['review', TRANSCRIPT, '--no-color', '--strict'], c.io)).toBe(1);
  });

  it('init writes a starter transcript and refuses to overwrite', async () => {
    const c1 = capture();
    expect(await run(['init'], c1.io)).toBe(0);
    expect(existsSync(join(dir, 'transcript.json'))).toBe(true);
    const c2 = capture();
    expect(await run(['init'], c2.io)).toBe(1);
  });

  it('exits 2 on usage errors', async () => {
    expect(await run(['review'], capture().io)).toBe(2);
    expect(await run(['bogus'], capture().io)).toBe(2);
    expect(await run(['review', join(dir, 'missing.json')], capture().io)).toBe(2);
  });
});
