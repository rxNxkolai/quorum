/**
 * Core data model for Quorum.
 *
 * A {@link Council} is a set of {@link Member} critics. For each agent
 * {@link Step}, every member is evaluated by a {@link Judge} (free heuristic by
 * default, or an LLM) into a {@link MemberVerdict}. The council aggregates those
 * votes into a {@link Review} with a {@link Decision}. A {@link SessionReport}
 * collects reviews across a whole agent run.
 */

export type Severity = 'ok' | 'concern' | 'violation';

export type Decision = 'allow' | 'warn' | 'block' | 'escalate';

export type StepKind = 'thought' | 'tool_call' | 'tool_result' | 'message' | 'action';

/** A single thing the agent did or produced, to be reviewed. */
export interface Step {
  kind?: StepKind;
  content: string;
  /** Tool name, for `tool_call` / `tool_result` steps. */
  tool?: string;
  /** Evidence/context actually available to the agent, used for grounding checks. */
  context?: string;
}

/** What a member is asked to review: the goal, prior steps, and the current step. */
export interface ReviewInput {
  task: string;
  history?: Step[];
  step: Step;
}

export interface JudgeResult {
  severity: Severity;
  /** 0-1 confidence in the verdict. */
  confidence: number;
  reason: string;
}

/** A council member: one critic with a single lens (on-task, grounded, safe, ...). */
export interface Member {
  id: string;
  description: string;
  /** Relative weight (reserved for weighted aggregation). */
  weight?: number;
  /** Build the LLM prompt for judging this step. */
  prompt(input: ReviewInput): string;
  /** Deterministic, dependency-free heuristic verdict (the free/offline judge). */
  heuristic(input: ReviewInput): JudgeResult;
}

export interface MemberVerdict extends JudgeResult {
  member: string;
}

/** The council's decision about one step, with the votes behind it. */
export interface Review {
  decision: Decision;
  votes: MemberVerdict[];
  reasons: string[];
  task: string;
  step: Step;
}

export type JudgeProvider = 'heuristic' | 'ollama' | 'openai' | 'anthropic';

/** Evaluates a member against a step. Backed by heuristics or an LLM. */
export interface Judge {
  name: JudgeProvider;
  evaluate(member: Member, input: ReviewInput): Promise<MemberVerdict>;
}

export interface CouncilConfig {
  /** Built-in member ids ('on-task', 'grounded', 'safe') or custom Member objects. */
  members?: (string | Member)[];
  /** Provide a judge directly (overrides `provider`). */
  judge?: Judge;
  /** Pick a built-in judge. Defaults to 'heuristic' (free, offline, deterministic). */
  provider?: JudgeProvider;
  model?: string;
  /** Minimum confidence for a `violation` to count at all (default 0.5). */
  minConfidence?: number;
  /** A violation at or above this confidence hard-`block`s; below it `escalate`s to a human (default 0.85). */
  blockConfidence?: number;
  /** Number of `concern` votes needed to `warn` (default 1). */
  concernQuorum?: number;
}

export interface Council {
  members: Member[];
  review(input: ReviewInput): Promise<Review>;
}

export interface SessionStepResult {
  step: Step;
  review: Review;
}

export interface SessionReport {
  task: string;
  steps: SessionStepResult[];
  counts: Record<Decision, number>;
  /** Steps whose decision was not `allow`. */
  flagged: number;
  total: number;
}

/** A transcript that can be replayed through a council. */
export interface Transcript {
  task: string;
  steps: Step[];
}
