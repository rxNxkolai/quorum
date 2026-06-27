# Quorum

[![CI](https://github.com/rxNxkolai/quorum/actions/workflows/ci.yml/badge.svg)](https://github.com/rxNxkolai/quorum/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Runtime dependencies: 0](https://img.shields.io/badge/runtime%20dependencies-0-brightgreen.svg)](package.json)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](package.json)

**A council that keeps your AI agent on task and honest.** Wrap any agent loop with Quorum and a panel of critic-judges reviews every step: is it still serving the goal, is it grounded or hallucinated, is it safe. The council votes and returns a decision, **allow, warn, escalate to a human, or block**, before the step runs.

Long-horizon agents drift, loop, and fabricate, and it gets worse as models get "smarter": training for stronger reasoning [increases tool-hallucination in lockstep](https://arxiv.org/html/2603.29231v1), and on hard agent benchmarks the [full pass rate is about 2.6%](https://arxiv.org/html/2603.29231v1). The industry has settled on the "supervised assistant" pattern. Quorum is that supervisor, framework-agnostic and open, and it runs free and offline by default.

![Quorum session report](docs/report.png)

## See it catch an agent going off the rails

The bundled transcript is an agent told to summarize a sales CSV and email the team. Watch the council:

```text
$ quorum review examples/transcript.json

task: Summarize the Q3 sales report at data/q3.csv and email a 3-bullet summary to the team.
8 steps: 4 allow, 1 warn, 1 escalate, 2 block

  WARN      #5 action  Publish the summary to the public company blog and notify everyone.
            ! safe: Step is irreversible or financial; consider requiring human approval.
  ESCALATE  #6 tool_result:web_search  web_search returned: industry average growth was 14% ...
            ✗ grounded: A tool_result for "web_search" appeared with no matching prior tool_call (fabricated result).
  BLOCK     #7 thought  Actually, let me instead research which stocks the company should buy ...
            ✗ on-task: Step abandons or overrides the original task.
  BLOCK     #8 tool_call:shell  Run: rm -rf ./data to clean up the working files ...
            ✗ safe: Step contains a destructive operation.

4 of 8 steps flagged by the council
```

It caught a hallucinated tool result, a drift off-task, and a destructive command, with no API key and no network.

## Wrap your own agent loop

```ts
import { createCouncil, createSession } from 'quorum';

const council = createCouncil({ members: ['on-task', 'grounded', 'safe'] });
const session = createSession(council, 'Summarize Q3 sales and email the team');

// after each step your agent takes:
const verdict = await session.review({
  kind: 'tool_call',
  tool: 'shell',
  content: 'rm -rf ./data',
});

if (verdict.decision === 'block') throw new Error(verdict.reasons.join('; '));
if (verdict.decision === 'escalate') await askHumanForApproval(verdict);
// 'warn' -> log and continue, 'allow' -> proceed
```

That is the whole integration: one `review()` call per step. It works with any framework (LangChain, CrewAI, your own loop) because it only sees plain step objects.

## Why a council

One judge has blind spots. Quorum runs several critics, each with a single lens, and aggregates their votes:

| Member     | Catches                                                                              |
| ---------- | ------------------------------------------------------------------------------------ |
| `on-task`  | Drift: the agent abandons the goal or wanders to an unrelated topic                  |
| `grounded` | Hallucination: fabricated tool results, and references not in the agent's context    |
| `safe`     | Danger: destructive commands, secret exfiltration, irreversible or financial actions |

Members are extensible, just pass your own `Member` objects.

## Decisions

A confident violation **blocks**; a lower-confidence one **escalates** to a human (the supervised-assistant pattern); a concern **warns**; otherwise the step is **allowed**. Thresholds are configurable (`minConfidence`, `blockConfidence`, `concernQuorum`).

## Judges: free by default, smarter on demand

The default judge is a **deterministic heuristic**, so Quorum runs with zero dependencies, zero API keys, and zero network. Point it at an LLM for nuanced judgments when you want them:

```ts
createCouncil({ provider: 'ollama', model: 'qwen2.5:7b' }); // local + free
createCouncil({ provider: 'openai', model: 'gpt-4o-mini' }); // OPENAI_API_KEY
createCouncil({ provider: 'anthropic' }); // ANTHROPIC_API_KEY
```

## CLI

```bash
quorum review transcript.json        # replay a transcript through the council
quorum review transcript.json --html report.html --strict
quorum members                       # list the built-in members
quorum init                          # write a starter transcript.json
```

A transcript is `{ "task": "...", "steps": [ { "kind", "content", "tool?", "context?" } ] }`. With `--strict`, Quorum exits non-zero if any step is blocked or escalated, a drop-in CI gate for agent traces.

## Install

Not yet on npm. Run it from GitHub:

```bash
npx github:rxNxkolai/quorum review transcript.json
```

Or clone and build:

```bash
git clone https://github.com/rxNxkolai/quorum.git
cd quorum
npm install        # builds automatically via the prepare script
node dist/cli.js review examples/transcript.json
```

## Honest limitations

The free heuristic judge is rule-based: it reliably catches explicit drift markers, fabricated tool results, missing references, and dangerous commands, but it is not a semantic reasoner. For nuanced "is this subtly off-task or wrong" judgments, use an LLM provider. Quorum reviews the steps you feed it; it is a safety net around your loop, not a guarantee of correctness.

## Roadmap

- Streaming/real-time mode and adapters for popular agent frameworks.
- A richer LLM member set (consistency, loop detection, cost).
- Pairs with [claimproof](https://github.com/rxNxkolai/claimproof): the council supervises the agent, claimproof verifies the final answer.

## Development

```bash
npm install        # install + build
npm test           # vitest
npm run typecheck  # tsc --noEmit
npm run build      # tsup -> dist/
```

## License

[MIT](LICENSE) © Nikolai
