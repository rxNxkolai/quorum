import type { SessionReport } from '../types.js';
import { formatConsole, type ConsoleOptions } from './console.js';
import { formatJson } from './json.js';
import { renderHtml } from './html.js';

export type ReportFormat = 'pretty' | 'json';

/** Render a session report to a terminal string ('pretty') or machine JSON ('json'). */
export function report(format: ReportFormat, value: SessionReport, opts: ConsoleOptions): string {
  return format === 'json' ? formatJson(value) : formatConsole(value, opts);
}

export { formatConsole, formatJson, renderHtml };
export type { ConsoleOptions };
