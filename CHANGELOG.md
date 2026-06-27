# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-27

### Added

- Initial release.
- A framework-agnostic council that reviews agent steps via `createCouncil` and
  `createSession`, returning a decision: `allow`, `warn`, `escalate`, or `block`.
- Three built-in members, each with a free heuristic and an LLM prompt:
  `on-task` (drift), `grounded` (hallucinated tool results and missing
  references), and `safe` (destructive, secret, and irreversible actions).
  Custom members are supported.
- Judges: a deterministic, dependency-free `heuristic` judge (default) plus
  `ollama`, `openai`, and `anthropic` LLM judges.
- Confidence-based aggregation (`minConfidence`, `blockConfidence`,
  `concernQuorum`).
- CLI `review` (replay a transcript), `members`, and `init`, with pretty/JSON
  output, an interactive HTML session report, and a `--strict` CI gate.
- Programmatic API and a pluggable `Judge` interface.
- Zero runtime dependencies.

[0.1.0]: https://github.com/rxNxkolai/quorum/releases/tag/v0.1.0
