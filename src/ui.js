import http from 'node:http';
import { createDecision, createExperimentStore, createNewExperimentStore, createSavepoint, findVariant, loadCurrentStore, startVariant } from './store.js';
import { appendEvent } from './events.js';
import { exportExperiment } from './export.js';
import { renderTree } from './render.js';
import { runDoctor } from './doctor.js';
import { setStrategy } from './strategy.js';

export async function createUiServer(repoPath, options = {}) {
  const host = options.host ?? '127.0.0.1';
  const port = Number(options.port ?? 8787);
  const server = http.createServer((request, response) => {
    handleRequest(repoPath, request, response).catch((error) => {
      sendJson(response, 500, { ok: false, error: error.message });
    });
  });

  await new Promise((resolve) => server.listen(port, host, resolve));
  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  return {
    server,
    url: `http://${host}:${actualPort}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}

async function handleRequest(repoPath, request, response) {
  const url = new URL(request.url, 'http://localhost');
  if (request.method === 'GET' && url.pathname === '/') {
    sendHtml(response, renderUiHtml());
    return;
  }
  if (request.method === 'GET' && url.pathname === '/favicon.ico') {
    sendNoContent(response);
    return;
  }
  if (request.method === 'GET' && url.pathname === '/api/state') {
    sendJson(response, 200, await buildState(repoPath));
    return;
  }
  if (request.method === 'GET' && url.pathname === '/api/events') {
    await streamEvents(repoPath, request, response);
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/case-study-init') {
    const body = await readJsonBody(request);
    const create = await isInitialized(repoPath) ? createNewExperimentStore : createExperimentStore;
    const experiment = await create(repoPath, {
      title: body.title,
      description: body.description ?? '',
    });
    const decision = await createDecision(repoPath, {
      title: body.decision ?? 'Agent collaboration strategy',
      rationale: body.rationale ?? '',
    });
    const savepoint = await createSavepoint(repoPath, {
      title: body.savepoint ?? 'Before UI task',
      decision: decision.id,
    });
    sendJson(response, 200, { ok: true, experiment, decision, savepoint });
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/variants') {
    const body = await readJsonBody(request);
    const variant = await startVariant(repoPath, {
      name: body.name,
      from: body.from,
      createBranch: true,
      createWorktree: body.worktree === true,
      contextPolicy: body.contextPolicy,
    });
    await setStrategy(repoPath, {
      variant: variant.id,
      from: body.from ?? variant.savepointId,
      contextPolicy: body.contextPolicy ?? 'unspecified',
      hypothesis: body.hypothesis ?? '',
    });
    sendJson(response, 200, { ok: true, variant });
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/log-note') {
    const body = await readJsonBody(request);
    const store = await loadCurrentStore(repoPath);
    const variant = body.variant ? findVariant(store, body.variant) : null;
    const event = await appendEvent(repoPath, {
      type: 'note',
      body: body.body,
      variantId: variant?.id,
      actor: body.actor ?? 'human',
    });
    sendJson(response, 200, { ok: true, event });
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/export') {
    const body = await readJsonBody(request);
    const format = body.format ?? 'html';
    const out = body.out ?? `.agent-lab/exports/ui-report.${format === 'markdown' ? 'md' : format}`;
    await exportExperiment(repoPath, { format, out });
    sendJson(response, 200, { ok: true, out, format });
    return;
  }
  sendJson(response, 404, { ok: false, error: 'Not found' });
}

async function buildState(repoPath) {
  const doctor = await runDoctor(repoPath);
  try {
    const store = await loadCurrentStore(repoPath);
    return {
      ok: true,
      initialized: true,
      doctor,
      experiment: store.experiment,
      counts: {
        decisions: store.tree.nodes.filter((node) => node.type === 'decision').length,
        savepoints: store.savepoints.length,
        variants: store.variants.length,
        events: store.events.length,
        evaluations: store.evaluations.length,
      },
      treeText: await renderTree(repoPath),
      variants: store.variants,
      savepoints: store.savepoints,
      events: store.events.slice(-30).map((event) => ({
        id: event.id,
        type: event.type,
        variantId: event.variantId,
        createdAt: event.createdAt,
        actor: event.actor,
        bodySummary: summarize(event.body),
      })),
      privacy: store.experiment.privacy,
    };
  } catch (error) {
    return {
      ok: true,
      initialized: false,
      doctor,
      error: error.message,
    };
  }
}

async function streamEvents(repoPath, request, response) {
  response.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });
  const send = async () => {
    response.write(`event: state\n`);
    response.write(`data: ${JSON.stringify(await buildState(repoPath))}\n\n`);
  };
  await send();
  const timer = setInterval(() => {
    send().catch(() => {});
  }, 1000);
  request.on('close', () => clearInterval(timer));
}

function renderUiHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Agent Decision Lab</title>
<style>
:root{color-scheme:light;--bg:#f7f8fa;--panel:#ffffff;--ink:#17202a;--muted:#657080;--line:#d9dee7;--blue:#2264d1;--green:#16845b;--amber:#9a6400;--red:#bd2f2f;--shadow:0 10px 24px rgba(20,30,50,.08)}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.4 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button,input,textarea,select{font:inherit}button{border:1px solid var(--line);background:#fff;border-radius:6px;padding:8px 10px;cursor:pointer}button.primary{background:var(--blue);border-color:var(--blue);color:#fff}.shell{display:grid;grid-template-columns:240px minmax(380px,1fr) 360px;grid-template-rows:auto 1fr 220px;min-height:100vh}.top{grid-column:1/4;display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line);background:#fff}.brand{font-weight:760}.status-dot{width:9px;height:9px;border-radius:50%;background:var(--amber);display:inline-block}.status-dot.live{background:var(--green)}.left,.right,.events{background:#fff}.left{border-right:1px solid var(--line);padding:14px}.right{border-left:1px solid var(--line);padding:14px;overflow:auto}.main{padding:16px;overflow:auto}.events{grid-column:1/4;border-top:1px solid var(--line);padding:12px 16px;overflow:auto}.metric{display:grid;grid-template-columns:1fr auto;gap:8px;padding:7px 0;border-bottom:1px solid #edf0f5}.panel{background:var(--panel);border:1px solid var(--line);border-radius:8px;box-shadow:var(--shadow);padding:14px;margin-bottom:14px}.tree{white-space:pre;overflow:auto;background:#101722;color:#e8edf5;border-radius:8px;padding:14px;min-height:360px}.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.field{display:grid;gap:5px;margin:8px 0}.field input,.field textarea,.field select{width:100%;border:1px solid var(--line);border-radius:6px;padding:8px;background:#fff}.field.checkbox{grid-template-columns:auto 1fr;align-items:center}.field.checkbox input{width:auto}.label{font-size:12px;color:var(--muted);font-weight:650;text-transform:uppercase}.item{border:1px solid var(--line);border-radius:6px;padding:8px;margin:7px 0}.ok{color:var(--green)}.warn{color:var(--amber)}.fail{color:var(--red)}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
</style>
</head>
<body>
<div class="shell">
  <header class="top"><span class="brand">Agent Decision Lab</span><span id="live" class="status-dot"></span><span id="liveText">connecting</span><button id="refresh">Refresh</button><button id="export" class="primary">Export HTML</button></header>
  <aside class="left">
    <div class="label">Experiment</div>
    <h2 id="title">Loading</h2>
    <div id="metrics"></div>
    <div class="panel">
      <div class="label">Init Case Study</div>
      <div class="field"><input id="initTitle" placeholder="Case study title"></div>
      <div class="field"><input id="initDecision" placeholder="Decision"></div>
      <div class="field"><input id="initSavepoint" placeholder="Savepoint"></div>
      <button id="initBtn">Init</button>
    </div>
  </aside>
  <main class="main">
    <div class="panel"><div class="label">Decision Tree</div><pre id="tree" class="tree"></pre></div>
  </main>
  <aside class="right">
    <div class="panel">
      <div class="label">Add Variant</div>
      <div class="field"><input id="variantName" placeholder="variant-name"></div>
      <div class="field"><input id="variantFrom" placeholder="savepoint title or id"></div>
      <div class="field"><input id="variantPolicy" placeholder="context policy"></div>
      <label class="field checkbox"><input id="variantWorktree" type="checkbox"> <span>Create worktree</span></label>
      <button id="variantBtn">Add Variant</button>
    </div>
    <div class="panel">
      <div class="label">Log Note</div>
      <div class="field"><select id="noteVariant"></select></div>
      <div class="field"><textarea id="noteBody" rows="4" placeholder="Write an observation"></textarea></div>
      <button id="noteBtn">Log Note</button>
    </div>
    <div class="panel"><div class="label">Doctor</div><div id="doctor"></div></div>
    <div class="panel"><div class="label">Variants</div><div id="variants"></div></div>
  </aside>
  <section class="events"><div class="label">Event Stream</div><div id="events"></div></section>
</div>
<script>
const stateUrl='/api/state';
let latest={};
const escapeMap={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>escapeMap[ch]);}
function statusClass(value){return ['ok','warn','fail'].includes(value)?value:'fail';}
async function api(path, body){const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return response.json();}
async function refresh(){render(await (await fetch(stateUrl)).json());}
function render(state){latest=state;document.querySelector('#live').classList.add('live');document.querySelector('#liveText').textContent='live';document.querySelector('#title').textContent=state.initialized?state.experiment.title:'No lab initialized';document.querySelector('#tree').textContent=state.treeText||state.error||'Initialize a case study to see the tree.';renderMetrics(state);renderDoctor(state.doctor);renderVariants(state.variants||[]);renderEvents(state.events||[]);}
function renderMetrics(state){const counts=state.counts||{};document.querySelector('#metrics').innerHTML=['decisions','savepoints','variants','events','evaluations'].map(k=>'<div class="metric"><span>'+esc(k)+'</span><strong>'+esc(counts[k]??0)+'</strong></div>').join('');}
function renderDoctor(doctor){document.querySelector('#doctor').innerHTML=(doctor?.checks||[]).map(c=>'<div class="item"><strong>'+esc(c.label)+'</strong><br><span class="'+statusClass(c.status)+'">'+esc(c.status)+'</span> '+esc(c.message)+'</div>').join('');}
function renderVariants(variants){document.querySelector('#variants').innerHTML=variants.map(v=>'<div class="item"><strong>'+esc(v.name)+'</strong><br><code>'+esc(v.branch)+'</code><br>'+ esc(v.worktreePath||'base lab') +'</div>').join('');const select=document.querySelector('#noteVariant');select.innerHTML='<option value="">No variant</option>'+variants.map(v=>'<option value="'+esc(v.name)+'">'+esc(v.name)+'</option>').join('');}
function renderEvents(events){document.querySelector('#events').innerHTML=events.slice().reverse().map(e=>'<div class="item"><strong>'+esc(e.type)+'</strong> <code>'+esc(e.variantId||'no variant')+'</code><br>'+esc(e.bodySummary)+'</div>').join('');}
document.querySelector('#refresh').onclick=refresh;
document.querySelector('#export').onclick=async()=>{await api('/api/export',{format:'html'});await refresh();};
document.querySelector('#initBtn').onclick=async()=>{await api('/api/case-study-init',{title:initTitle.value||'UI Case Study',decision:initDecision.value||'Context strategy',savepoint:initSavepoint.value||'Before UI task'});await refresh();};
document.querySelector('#variantBtn').onclick=async()=>{await api('/api/variants',{name:variantName.value,from:variantFrom.value,contextPolicy:variantPolicy.value,worktree:variantWorktree.checked});await refresh();};
document.querySelector('#noteBtn').onclick=async()=>{await api('/api/log-note',{variant:noteVariant.value,body:noteBody.value});noteBody.value='';await refresh();};
const source=new EventSource('/api/events');source.addEventListener('state',event=>render(JSON.parse(event.data)));refresh();
</script>
</body>
</html>`;
}

async function isInitialized(repoPath) {
  const state = await buildState(repoPath);
  return state.initialized;
}

async function readJsonBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
  }
  return body ? JSON.parse(body) : {};
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(`${JSON.stringify(body)}\n`);
}

function sendHtml(response, body) {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(body);
}

function sendNoContent(response) {
  response.writeHead(204);
  response.end();
}

function summarize(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}
