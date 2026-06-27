import { describe, it, expect } from 'vitest';
import { aggregate, createCouncil } from '../src/council.js';
import type { MemberVerdict, Severity } from '../src/types.js';

const cfg = { minConfidence: 0.5, blockConfidence: 0.85, concernQuorum: 1 };
const vote = (member: string, severity: Severity, confidence: number): MemberVerdict => ({
  member,
  severity,
  confidence,
  reason: 'r',
});

describe('aggregate', () => {
  it('blocks on a confident violation', () => {
    expect(
      aggregate([vote('safe', 'violation', 0.9), vote('on-task', 'ok', 0.7)], cfg).decision,
    ).toBe('block');
  });
  it('escalates a violation below the block confidence', () => {
    expect(aggregate([vote('grounded', 'violation', 0.7)], cfg).decision).toBe('escalate');
  });
  it('warns on a concern', () => {
    expect(
      aggregate([vote('safe', 'concern', 0.6), vote('on-task', 'ok', 0.7)], cfg).decision,
    ).toBe('warn');
  });
  it('treats a low-confidence violation as a concern', () => {
    expect(aggregate([vote('x', 'violation', 0.4)], cfg).decision).toBe('warn');
  });
  it('allows when every member is ok', () => {
    expect(aggregate([vote('safe', 'ok', 0.7), vote('on-task', 'ok', 0.7)], cfg).decision).toBe(
      'allow',
    );
  });
});

describe('createCouncil', () => {
  it('uses the heuristic judge by default and blocks a destructive step', async () => {
    const council = createCouncil();
    const review = await council.review({
      task: 'summarize the report',
      step: { kind: 'tool_call', content: 'Run: rm -rf ./data' },
    });
    expect(review.decision).toBe('block');
    expect(review.votes).toHaveLength(3);
  });
});
