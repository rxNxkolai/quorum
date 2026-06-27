import type { SessionReport } from '../types.js';

/** Render the session report as stable JSON. */
export function formatJson(report: SessionReport): string {
  return JSON.stringify(report, null, 2);
}
