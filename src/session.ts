import type {
  Council,
  Decision,
  Review,
  SessionReport,
  SessionStepResult,
  Step,
  Transcript,
} from './types.js';

/** Build a {@link SessionReport} from already-reviewed steps. */
export function buildSessionReport(task: string, steps: SessionStepResult[]): SessionReport {
  const counts: Record<Decision, number> = { allow: 0, warn: 0, block: 0, escalate: 0 };
  for (const s of steps) counts[s.review.decision] += 1;
  return {
    task,
    steps,
    counts,
    flagged: steps.filter((s) => s.review.decision !== 'allow').length,
    total: steps.length,
  };
}

/**
 * A live session for wrapping your own agent loop. Call `review(step)` after each
 * agent step; history accumulates automatically. Call `report()` at the end.
 */
export function createSession(council: Council, task: string) {
  const steps: SessionStepResult[] = [];
  const history: Step[] = [];
  return {
    async review(step: Step): Promise<Review> {
      const review = await council.review({ task, history: [...history], step });
      steps.push({ step, review });
      history.push(step);
      return review;
    },
    report(): SessionReport {
      return buildSessionReport(task, steps);
    },
  };
}

/** Replay a whole transcript through a council and return the session report. */
export async function reviewTranscript(
  council: Council,
  transcript: Transcript,
): Promise<SessionReport> {
  const session = createSession(council, transcript.task);
  for (const step of transcript.steps) await session.review(step);
  return session.report();
}
