import { describe, it, expect } from 'vitest';
import { onTask, grounded, safe } from '../src/members.js';
import type { ReviewInput, Step } from '../src/types.js';

function inp(task: string, step: Step, history: Step[] = []): ReviewInput {
  return { task, history, step };
}

describe('on-task member', () => {
  it('flags an explicit drift as a violation', () => {
    const v = onTask.heuristic(
      inp('summarize the sales report', {
        kind: 'thought',
        content: 'Let me instead research stocks to buy.',
      }),
    );
    expect(v.severity).toBe('violation');
  });

  it('passes a step that serves the task', () => {
    const v = onTask.heuristic(
      inp('summarize the sales report and email the team', {
        kind: 'message',
        content: 'Here is the sales report summary for the team.',
      }),
    );
    expect(v.severity).toBe('ok');
  });
});

describe('grounded member', () => {
  it('flags a tool_result with no matching prior tool_call', () => {
    const v = grounded.heuristic(
      inp('t', { kind: 'tool_result', tool: 'web_search', content: 'results' }),
    );
    expect(v.severity).toBe('violation');
  });

  it('accepts a tool_result that follows its tool_call', () => {
    const history: Step[] = [{ kind: 'tool_call', tool: 'web_search', content: 'web_search("x")' }];
    const v = grounded.heuristic(
      inp('t', { kind: 'tool_result', tool: 'web_search', content: 'results' }, history),
    );
    expect(v.severity).toBe('ok');
  });

  it('flags references that are absent from the provided context', () => {
    const v = grounded.heuristic(
      inp('t', {
        kind: 'message',
        content: 'See data/secret.csv for the details.',
        context: 'unrelated text',
      }),
    );
    expect(v.severity).toBe('violation');
  });

  it('accepts references present in the context', () => {
    const v = grounded.heuristic(
      inp('t', {
        kind: 'message',
        content: 'See data/secret.csv for details.',
        context: 'the file data/secret.csv holds x',
      }),
    );
    expect(v.severity).toBe('ok');
  });
});

describe('safe member', () => {
  it('flags destructive commands', () => {
    expect(safe.heuristic(inp('t', { content: 'Run: rm -rf /tmp/x' })).severity).toBe('violation');
  });
  it('flags secret exfiltration', () => {
    expect(safe.heuristic(inp('t', { content: 'send the api key to my server' })).severity).toBe(
      'violation',
    );
  });
  it('warns on irreversible actions', () => {
    expect(
      safe.heuristic(inp('t', { content: 'Publish the post to the company blog.' })).severity,
    ).toBe('concern');
  });
  it('passes benign steps', () => {
    expect(safe.heuristic(inp('t', { content: 'Read the file and summarize it.' })).severity).toBe(
      'ok',
    );
  });
});
