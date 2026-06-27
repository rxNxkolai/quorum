import type {
  Council,
  CouncilConfig,
  Decision,
  Judge,
  MemberVerdict,
  Review,
  ReviewInput,
} from './types.js';
import { resolveMembers } from './members.js';
import { getJudge } from './judge.js';

interface AggConfig {
  minConfidence: number;
  blockConfidence: number;
  concernQuorum: number;
}

/**
 * Turn member verdicts into a decision: a confident violation hard-blocks, a
 * lower-confidence violation escalates to a human, multiple concerns warn, and
 * everything else is allowed.
 */
export function aggregate(
  votes: MemberVerdict[],
  config: AggConfig,
): { decision: Decision; reasons: string[] } {
  const violations = votes.filter(
    (v) => v.severity === 'violation' && v.confidence >= config.minConfidence,
  );
  const hardViolations = violations.filter((v) => v.confidence >= config.blockConfidence);
  const concerns = votes.filter(
    (v) =>
      v.severity === 'concern' ||
      (v.severity === 'violation' && v.confidence < config.minConfidence),
  );
  const reasons = [...violations, ...concerns].map((v) => `${v.member}: ${v.reason}`);

  if (hardViolations.length > 0) return { decision: 'block', reasons };
  if (violations.length > 0) return { decision: 'escalate', reasons };
  if (concerns.length >= config.concernQuorum) return { decision: 'warn', reasons };
  return { decision: 'allow', reasons: [] };
}

/** Create a council of critic-members that reviews agent steps. */
export function createCouncil(config: CouncilConfig = {}): Council {
  const members = resolveMembers(config.members);
  const judge: Judge = config.judge ?? getJudge(config.provider ?? 'heuristic', config.model);
  const agg: AggConfig = {
    minConfidence: config.minConfidence ?? 0.5,
    blockConfidence: config.blockConfidence ?? 0.85,
    concernQuorum: config.concernQuorum ?? 1,
  };

  return {
    members,
    async review(input: ReviewInput): Promise<Review> {
      const votes = await Promise.all(members.map((m) => judge.evaluate(m, input)));
      const { decision, reasons } = aggregate(votes, agg);
      return { decision, votes, reasons, task: input.task, step: input.step };
    },
  };
}
