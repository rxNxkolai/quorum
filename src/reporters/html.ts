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

function card(label: string, value: string | number, tone = ''): string {
  return `<div class="card ${tone}"><div class="card-value">${esc(value)}</div><div class="card-label">${esc(label)}</div></div>`;
}

function renderVotes(votes: MemberVerdict[]): string {
  return votes
    .map(
      (v) =>
        `<div class="vote ${severityTone(v.severity)}">` +
        `<span class="mark">${v.severity === 'ok' ? '✓' : v.severity === 'concern' ? '!' : '✗'}</span> ` +
        `<span class="vmember">${esc(v.member)}</span> ` +
        `<span class="vsev">${esc(v.severity)} ${Math.round(v.confidence * 100)}%</span> ` +
        `${esc(v.reason)}</div>`,
    )
    .join('');
}

function renderStep(s: SessionStepResult, i: number): string {
  const tone = decisionTone(s.review.decision);
  const kind = s.step.tool ? `${s.step.kind ?? 'step'} · ${s.step.tool}` : (s.step.kind ?? 'step');
  const ctx = s.step.context
    ? `<div class="block"><div class="block-label">context</div><pre>${esc(s.step.context)}</pre></div>`
    : '';
  return `
    <details class="step ${tone}">
      <summary>
        <span class="badge ${tone}">${esc(s.review.decision)}</span>
        <span class="idx">#${i + 1}</span>
        <span class="kind">${esc(kind)}</span>
        <span class="content">${esc(s.step.content)}</span>
      </summary>
      <div class="step-body">
        <div class="votes">${renderVotes(s.review.votes)}</div>
        <div class="block"><div class="block-label">step</div><pre>${esc(s.step.content)}</pre></div>
        ${ctx}
      </div>
    </details>`;
}

/** Render a full, self-contained interactive HTML report for an agent session. */
export function renderHtml(report: SessionReport): string {
  const c = report.counts;
  const cards =
    card('steps', report.total) +
    card('allowed', c.allow, 'ok') +
    card('warned', c.warn, c.warn ? 'warn' : '') +
    card('escalated', c.escalate, c.escalate ? 'esc' : '') +
    card('blocked', c.block, c.block ? 'bad' : '');

  const steps = report.steps.map(renderStep).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Quorum session report</title>
<style>
  :root {
    --bg:#0d1117; --panel:#161b22; --panel-2:#1c2230; --border:#30363d;
    --text:#e6edf3; --muted:#8b949e; --ok:#3fb950; --bad:#f85149; --warn:#d29922; --esc:#bc8cff; --accent:#58a6ff;
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; line-height:1.5; }
  .wrap { max-width:940px; margin:0 auto; padding:32px 20px 64px; }
  h1 { margin:0 0 4px; font-size:23px; letter-spacing:-0.01em; }
  h1 .dot { color:var(--accent); }
  .sub { color:var(--muted); font-size:13px; margin-bottom:20px; }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(110px,1fr)); gap:10px; margin-bottom:18px; }
  .card { background:var(--panel); border:1px solid var(--border); border-radius:10px; padding:13px 15px; }
  .card-value { font-size:22px; font-weight:650; }
  .card-label { color:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:0.04em; }
  .card.ok .card-value { color:var(--ok); } .card.bad .card-value { color:var(--bad); }
  .card.warn .card-value { color:var(--warn); } .card.esc .card-value { color:var(--esc); }
  .filters { display:flex; gap:8px; margin:4px 0 14px; }
  .filter-btn { background:var(--panel); color:var(--muted); border:1px solid var(--border);
    border-radius:999px; padding:5px 14px; font-size:13px; cursor:pointer; }
  .filter-btn.active { color:var(--text); border-color:var(--accent); }
  details.step { background:var(--panel); border:1px solid var(--border); border-radius:8px; margin-bottom:8px; overflow:hidden; }
  details.step.bad { border-color:rgba(248,81,73,0.4); }
  details.step.esc { border-color:rgba(188,140,255,0.4); }
  details.step.warn { border-color:rgba(210,153,34,0.35); }
  details.step[open] { background:var(--panel-2); }
  summary { cursor:pointer; padding:10px 14px; display:flex; align-items:center; gap:10px; list-style:none; }
  summary::-webkit-details-marker { display:none; }
  .badge { font-size:11px; font-weight:700; padding:2px 8px; border-radius:5px; text-transform:uppercase; letter-spacing:0.03em; white-space:nowrap; }
  .badge.ok { background:rgba(63,185,80,0.16); color:var(--ok); }
  .badge.bad { background:rgba(248,81,73,0.16); color:var(--bad); }
  .badge.warn { background:rgba(210,153,34,0.16); color:var(--warn); }
  .badge.esc { background:rgba(188,140,255,0.16); color:var(--esc); }
  .idx { color:var(--muted); font-size:12px; font-variant-numeric:tabular-nums; }
  .kind { color:var(--muted); font-size:12px; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; white-space:nowrap; }
  .content { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .step-body { padding:2px 14px 14px; border-top:1px solid var(--border); }
  .votes { margin:10px 0; display:flex; flex-direction:column; gap:5px; }
  .vote { font-size:13px; }
  .vote .mark { display:inline-block; width:15px; font-weight:700; }
  .vote.ok .mark { color:var(--ok); } .vote.warn { color:#ffd9a6; } .vote.warn .mark { color:var(--warn); }
  .vote.bad { color:#ffb4ae; } .vote.bad .mark { color:var(--bad); }
  .vmember { color:var(--accent); font-family:ui-monospace,monospace; font-size:12px; }
  .vsev { color:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:0.03em; }
  .block { margin-top:10px; }
  .block-label { color:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px; }
  pre { margin:0; background:var(--bg); border:1px solid var(--border); border-radius:6px; padding:10px 12px;
    font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12.5px; white-space:pre-wrap; word-break:break-word; }
  footer { margin-top:30px; color:var(--muted); font-size:12px; text-align:center; }
  footer a { color:var(--accent); text-decoration:none; }
  body[data-filter="flagged"] details.step.ok { display:none; }
</style>
</head>
<body data-filter="all">
  <div class="wrap">
    <h1>Quorum<span class="dot">.</span> session report</h1>
    <div class="sub">task: ${esc(report.task)}</div>
    <div class="cards">${cards}</div>
    <div class="filters">
      <button class="filter-btn active" data-f="all" onclick="setFilter('all')">All steps</button>
      <button class="filter-btn" data-f="flagged" onclick="setFilter('flagged')">Flagged only</button>
    </div>
    ${steps || '<p class="sub">No steps were reviewed.</p>'}
    <footer>Generated by <a href="https://github.com/rxNxkolai/quorum">Quorum</a></footer>
  </div>
  <script>
    function setFilter(f) {
      document.body.setAttribute('data-filter', f);
      var b = document.querySelectorAll('.filter-btn');
      for (var i = 0; i < b.length; i++) b[i].classList.toggle('active', b[i].getAttribute('data-f') === f);
    }
  </script>
</body>
</html>`;
}
