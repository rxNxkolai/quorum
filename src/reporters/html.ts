import type { Decision, MemberVerdict, SessionReport, SessionStepResult } from '../types.js';

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function esc(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (ch) => ENTITIES[ch] ?? ch);
}

function decisionTone(d: Decision): string {
  return d === 'allow' ? 'ok' : d === 'warn' ? 'warn' : d === 'escalate' ? 'esc' : 'bad';
}

function severityTone(s: MemberVerdict['severity']): string {
  return s === 'ok' ? 'ok' : s === 'concern' ? 'warn' : 'bad';
}

function stat(label: string, value: string | number, tone = ''): string {
  return `<div class="stat ${tone}"><div class="num">${esc(value)}</div><div class="lbl">${esc(label)}</div></div>`;
}

function renderVotes(votes: MemberVerdict[]): string {
  return votes
    .map(
      (v) =>
        `<div class="vote ${severityTone(v.severity)}">` +
        `<span class="mk">${v.severity === 'ok' ? '✓' : v.severity === 'concern' ? '!' : '✗'}</span>` +
        `<span class="vm">${esc(v.member)}</span>` +
        `<span class="vs">${esc(v.severity)} · ${Math.round(v.confidence * 100)}%</span>` +
        `<span class="vr">${esc(v.reason)}</span></div>`,
    )
    .join('');
}

function renderStep(s: SessionStepResult, i: number): string {
  const tone = decisionTone(s.review.decision);
  const kind = s.step.tool ? `${s.step.kind ?? 'step'} · ${s.step.tool}` : (s.step.kind ?? 'step');
  const ctx = s.step.context
    ? `<div class="blk"><div class="bl">context</div><pre>${esc(s.step.context)}</pre></div>`
    : '';
  return `
    <details class="step ${tone}" style="--i:${i}">
      <summary>
        <span class="badge ${tone}">${esc(s.review.decision)}</span>
        <span class="idx">#${i + 1}</span>
        <span class="kind">${esc(kind)}</span>
        <span class="ct">${esc(s.step.content)}</span>
        <span class="chev" aria-hidden="true">›</span>
      </summary>
      <div class="body">
        <div class="votes">${renderVotes(s.review.votes)}</div>
        <div class="blk"><div class="bl">step</div><pre>${esc(s.step.content)}</pre></div>
        ${ctx}
      </div>
    </details>`;
}

const MARK = `<svg class="mark" viewBox="0 0 108 108" aria-hidden="true"><g stroke="#a371f7" stroke-opacity="0.3" stroke-width="1.6"><line x1="54" y1="54" x2="54" y2="20"/><line x1="54" y1="54" x2="80.6" y2="32.8"/><line x1="54" y1="54" x2="87.1" y2="61.6"/><line x1="54" y1="54" x2="68.8" y2="84.6"/><line x1="54" y1="54" x2="39.2" y2="84.6"/><line x1="54" y1="54" x2="20.9" y2="61.6"/><line x1="54" y1="54" x2="27.4" y2="32.8"/></g><g fill="#a371f7"><circle cx="80.6" cy="32.8" r="4.2" fill-opacity="0.72"/><circle cx="87.1" cy="61.6" r="4.2" fill-opacity="0.72"/><circle cx="68.8" cy="84.6" r="4.2" fill-opacity="0.72"/><circle cx="39.2" cy="84.6" r="4.2" fill-opacity="0.72"/><circle cx="20.9" cy="61.6" r="4.2" fill-opacity="0.72"/><circle cx="27.4" cy="32.8" r="4.2" fill-opacity="0.72"/><circle cx="54" cy="20" r="5.6"/></g><circle cx="54" cy="54" r="8.5" fill="#0b0e14" stroke="#e8edf5" stroke-width="2"/><circle cx="54" cy="54" r="2.6" fill="#e8edf5"/></svg>`;

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%230b0e14'/%3E%3Ccircle cx='16' cy='16' r='9' fill='none' stroke='%23a371f7' stroke-width='2.4'/%3E%3Ccircle cx='16' cy='16' r='2.6' fill='%23e8edf5'/%3E%3C/svg%3E";

/** Render a full, self-contained interactive HTML report for an agent session. */
export function renderHtml(report: SessionReport): string {
  const c = report.counts;
  const stats =
    stat('steps', report.total) +
    stat('allowed', c.allow, 'ok') +
    stat('warned', c.warn, c.warn ? 'warn' : '') +
    stat('escalated', c.escalate, c.escalate ? 'esc' : '') +
    stat('blocked', c.block, c.block ? 'bad' : '');

  const steps = report.steps.map(renderStep).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Quorum session report</title>
<link rel="icon" href="${FAVICON}" />
<style>
  :root {
    --bg:#0b0e14; --surface:#12161f; --surface-2:#1a1f2b; --border:#2a3140;
    --ink:#e8edf5; --muted:#9aa4b2; --faint:#6b7480;
    --accent:#a371f7; --ok:#3fb950; --bad:#f85149; --warn:#d29922; --esc:#bc8cff;
  }
  * { box-sizing:border-box; }
  html { -webkit-text-size-adjust:100%; }
  body {
    margin:0; background:
      radial-gradient(900px 380px at 82% -8%, rgba(163,113,247,0.10), transparent 60%),
      var(--bg);
    color:var(--ink); line-height:1.5;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    font-feature-settings:"cv02","ss01"; -webkit-font-smoothing:antialiased;
  }
  .wrap { max-width:940px; margin:0 auto; padding:40px 22px 72px; animation:rise .5s cubic-bezier(.2,.7,.2,1) both; }
  @keyframes rise { from { opacity:0; transform:translateY(8px); } }
  header { display:flex; align-items:center; gap:14px; margin-bottom:6px; }
  .mark { width:42px; height:42px; flex:none; }
  header h1 { margin:0; font-size:21px; font-weight:700; letter-spacing:-0.02em; }
  header .tag { color:var(--faint); font-size:12.5px; text-transform:uppercase; letter-spacing:0.12em; margin-top:1px; }
  .task { color:var(--muted); font-size:14px; margin:0 0 22px 56px; text-wrap:pretty; }
  .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(108px,1fr)); gap:10px; margin-bottom:22px; }
  .stat { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:14px 16px; }
  .num { font-size:26px; font-weight:680; font-variant-numeric:tabular-nums; letter-spacing:-0.02em; }
  .lbl { color:var(--muted); font-size:12px; margin-top:2px; }
  .stat.ok .num{color:var(--ok)} .stat.bad .num{color:var(--bad)} .stat.warn .num{color:var(--warn)} .stat.esc .num{color:var(--esc)}
  .filters { display:flex; gap:8px; margin:0 0 16px; }
  .fb { background:var(--surface); color:var(--muted); border:1px solid var(--border); border-radius:999px;
    padding:6px 15px; font-size:13px; font-weight:500; cursor:pointer; transition:color .15s, border-color .15s; }
  .fb:hover { color:var(--ink); }
  .fb.active { color:var(--ink); border-color:var(--accent); background:rgba(163,113,247,0.10); }
  details.step { background:var(--surface); border:1px solid var(--border); border-radius:12px; margin-bottom:9px;
    overflow:hidden; animation:rise .5s cubic-bezier(.2,.7,.2,1) both; animation-delay:calc(var(--i) * 40ms + 120ms); }
  details.step.bad { border-color:rgba(248,81,73,0.45); }
  details.step.esc { border-color:rgba(188,140,255,0.45); }
  details.step.warn { border-color:rgba(210,153,34,0.4); }
  details.step[open] { background:var(--surface-2); }
  summary { cursor:pointer; padding:13px 16px; display:flex; align-items:center; gap:11px; list-style:none; }
  summary::-webkit-details-marker { display:none; }
  .badge { font-size:10.5px; font-weight:800; padding:3px 9px; border-radius:6px; text-transform:uppercase;
    letter-spacing:0.05em; white-space:nowrap; min-width:74px; text-align:center; }
  .badge.ok { background:rgba(63,185,80,0.16); color:var(--ok); }
  .badge.bad { background:rgba(248,81,73,0.16); color:var(--bad); }
  .badge.warn { background:rgba(210,153,34,0.16); color:var(--warn); }
  .badge.esc { background:rgba(188,140,255,0.18); color:var(--esc); }
  .idx { color:var(--faint); font-size:12px; font-variant-numeric:tabular-nums; }
  .kind { color:var(--muted); font-size:12px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; white-space:nowrap; }
  .ct { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:14.5px; }
  .chev { color:var(--faint); transition:transform .2s ease; }
  details[open] .chev { transform:rotate(90deg); }
  .body { padding:4px 16px 16px; border-top:1px solid var(--border); }
  .votes { margin:12px 0; display:grid; gap:7px; }
  .vote { display:grid; grid-template-columns:18px auto auto 1fr; align-items:baseline; gap:8px; font-size:13.5px; }
  .vote .mk { font-weight:800; text-align:center; }
  .vote.ok .mk{color:var(--ok)} .vote.warn .mk{color:var(--warn)} .vote.bad .mk{color:var(--bad)}
  .vm { color:var(--accent); font-family:ui-monospace,monospace; font-size:12.5px; }
  .vs { color:var(--faint); font-size:11px; text-transform:uppercase; letter-spacing:0.04em; }
  .vr { color:var(--muted); }
  .vote.bad .vr { color:#ffc7c2; } .vote.warn .vr { color:#f1d59a; }
  .blk { margin-top:12px; }
  .bl { color:var(--faint); font-size:11px; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:5px; }
  pre { margin:0; background:#0a0d13; border:1px solid var(--border); border-radius:8px; padding:11px 13px;
    font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12.5px; white-space:pre-wrap; word-break:break-word; color:#c9d2de; }
  footer { margin-top:34px; color:var(--faint); font-size:12px; text-align:center; }
  footer a { color:var(--accent); text-decoration:none; }
  body[data-filter="flagged"] details.step.ok { display:none; }
  @media (prefers-reduced-motion: reduce) { .wrap, details.step { animation:none; } }
</style>
</head>
<body data-filter="all">
  <div class="wrap">
    <header>
      ${MARK}
      <div><h1>Quorum</h1><div class="tag">session report</div></div>
    </header>
    <p class="task">${esc(report.task)}</p>
    <div class="stats">${stats}</div>
    <div class="filters">
      <button class="fb active" data-f="all" onclick="setFilter('all')">All steps</button>
      <button class="fb" data-f="flagged" onclick="setFilter('flagged')">Flagged only</button>
    </div>
    ${steps || '<p class="task">No steps were reviewed.</p>'}
    <footer>Generated by <a href="https://github.com/rxNxkolai/quorum">Quorum</a> · the council for your AI agent</footer>
  </div>
  <script>
    function setFilter(f) {
      document.body.setAttribute('data-filter', f);
      for (const b of document.querySelectorAll('.fb')) b.classList.toggle('active', b.getAttribute('data-f') === f);
    }
  </script>
</body>
</html>`;
}
