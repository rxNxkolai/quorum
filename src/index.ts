/**
 * Quorum — a council of critic-judges that supervises any AI agent loop.
 *
 * Public API:
 *   import { createCouncil, createSession } from 'quorum';
 *   const council = createCouncil({ members: ['on-task', 'grounded', 'safe'] });
 *   const verdict = await council.review({ task, history, step });
 */

export { createCouncil, aggregate } from './council.js';
export { createSession, reviewTranscript, buildSessionReport } from './session.js';
export { getJudge, heuristicJudge } from './judge.js';
export { onTask, grounded, safe, BUILTIN_MEMBERS, resolveMembers } from './members.js';
export { formatConsole, formatJson, renderHtml } from './reporters/index.js';
export type { ConsoleOptions, ReportFormat } from './reporters/index.js';
export type {
  Severity,
  Decision,
  StepKind,
  Step,
  ReviewInput,
  JudgeResult,
  Member,
  MemberVerdict,
  Review,
  Judge,
  JudgeProvider,
  CouncilConfig,
  Council,
  SessionStepResult,
  SessionReport,
  Transcript,
} from './types.js';

/** Current Quorum version. */
export const version = '0.1.0';
