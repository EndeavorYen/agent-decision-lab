import http from 'node:http';
import { createDecision, createExperimentStore, createNewExperimentStore, createSavepoint, findVariant, loadCurrentStore, startVariant } from './store.js';
import { appendEvent } from './events.js';
import { exportExperiment } from './export.js';
import { renderOrchestratorGuide } from './orchestrator.js';
import { renderTree } from './render.js';
import { runDoctor } from './doctor.js';
import { setStrategy } from './strategy.js';

export async function createUiServer(repoPath, options = {}) {
  const host = options.host ?? '127.0.0.1';
  const port = Number(options.port ?? 8787);
  const server = http.createServer((request, response) => {
    handleRequest(repoPath, request, response).catch((error) => {
      sendJson(response, error.statusCode ?? 500, { ok: false, error: error.message });
    });
  });

  await new Promise((resolve) => server.listen(port, host, resolve));
  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  let closed = false;
  let closePromise = null;
  server.once('close', () => {
    closed = true;
  });
  return {
    server,
    url: `http://${host}:${actualPort}`,
    close: () => {
      if (closed) {
        return Promise.resolve();
      }
      if (closePromise) {
        return closePromise;
      }
      closePromise = new Promise((resolve, reject) => {
        server.close((error) => {
          if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') {
            reject(error);
            return;
          }
          closed = true;
          resolve();
        });
      });
      return closePromise;
    },
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
    if (!String(body.name ?? '').trim()) {
      sendJson(response, 200, { ok: false, error: 'Variant name is required' });
      return;
    }
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
    const event = await appendUiEvent(repoPath, 'note', body, 'human');
    sendJson(response, 200, { ok: true, event });
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/log-response') {
    const body = await readJsonBody(request);
    const event = await appendUiEvent(repoPath, 'response', body, 'agent');
    sendJson(response, 200, { ok: true, event });
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/checkpoint') {
    const body = await readJsonBody(request);
    const event = await appendUiEvent(repoPath, 'checkpoint', body, 'human');
    sendJson(response, 200, { ok: true, event });
    return;
  }
  if (request.method === 'POST' && url.pathname === '/api/orchestrate') {
    const body = await readJsonBody(request);
    const store = await loadCurrentStore(repoPath);
    const variant = body.variant ? findVariant(store, body.variant) : null;
    if (body.variant && !variant) {
      sendJson(response, 200, { ok: false, error: `Variant not found: ${body.variant}` });
      return;
    }
    sendJson(response, 200, {
      ok: true,
      prompt: renderOrchestratorGuide(store, { variant: variant?.name ?? body.variant }),
    });
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
      routeSummaries: buildRouteSummaries(store),
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
      routeSummaries: [],
      variants: [],
      events: [],
      error: error.message,
    };
  }
}

function buildRouteSummaries(store) {
  return store.variants.map((variant) => {
    const routeEvents = store.events.filter((event) => event.variantId === variant.id);
    const strategy = store.strategies.find((record) => record.variantId === variant.id);
    return {
      id: variant.id,
      name: variant.name,
      branch: variant.branch,
      location: variant.worktreePath ? 'worktree' : 'base lab',
      contextPolicy: strategy?.contextPolicy ?? 'unspecified',
      eventCount: routeEvents.length,
      checkpointCount: routeEvents.filter((event) => event.type === 'checkpoint').length,
      responseCount: routeEvents.filter((event) => event.type === 'response').length,
      active: store.config.activeVariantId === variant.id,
    };
  });
}

async function appendUiEvent(repoPath, type, body, defaultActor) {
  const store = await loadCurrentStore(repoPath);
  const variant = body.variant ? findVariant(store, body.variant) : null;
  if (body.variant && !variant) {
    const error = new Error(`Variant not found: ${body.variant}`);
    error.statusCode = 400;
    throw error;
  }
  return await appendEvent(repoPath, {
    type,
    body: body.body,
    variantId: variant?.id,
    actor: body.actor ?? defaultActor,
  });
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
:root{color-scheme:light;--bg:#f4f6f8;--panel:#ffffff;--ink:#111827;--muted:#64748b;--line:#d7dde6;--soft:#eef2f7;--accent:#1f5eff;--accent-dark:#1748c7;--good:#117a55;--warn:#9a6200;--bad:#b42318;--shadow:0 12px 28px rgba(15,23,42,.08)}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden}button,input,textarea,select{font:inherit}button{border:1px solid var(--line);background:#fff;border-radius:6px;padding:8px 10px;cursor:pointer;color:var(--ink);transition:background .16s ease,border-color .16s ease,color .16s ease}button:hover{background:#f8fafc;border-color:#b8c2d1}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:3px solid rgba(31,94,255,.22);outline-offset:2px}button.primary{background:var(--accent);border-color:var(--accent);color:#fff}button.primary:hover{background:var(--accent-dark);border-color:var(--accent-dark)}button.ghost{background:transparent}.shell{display:grid;grid-template-columns:280px minmax(460px,1fr) 380px;grid-template-rows:auto minmax(0,1fr) 220px;height:100vh;min-height:0}.top{grid-column:1/4;display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--line);background:#fff}.brand{font-weight:780;letter-spacing:0}.top-title{color:var(--muted);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.message{margin-left:auto;border:1px solid var(--line);border-radius:6px;padding:6px 9px;color:var(--muted);max-width:34vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.message.ok{border-color:#badbcc;color:var(--good);background:#f0faf5}.message.fail{border-color:#f0b8b8;color:var(--bad);background:#fff3f3}.status-dot{width:9px;height:9px;border-radius:50%;background:var(--warn);display:inline-block;flex:0 0 auto}.status-dot.live{background:var(--good)}.route-rail,.inspector,.activity{background:#fff;min-height:0}.route-rail{border-right:1px solid var(--line);padding:14px;overflow:auto}.workspace{padding:16px;overflow:auto;min-height:0}.inspector{border-left:1px solid var(--line);padding:14px;overflow:auto}.activity{grid-column:1/4;border-top:1px solid var(--line);padding:12px 16px;overflow:auto}.panel,.graph-panel,.action-group{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px;margin-bottom:14px;box-shadow:var(--shadow)}.graph-panel{min-height:100%}.section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.section-head h2,.section-head h3{font-size:18px;line-height:1.2;margin:2px 0 0}.eyebrow,.label{font-size:12px;color:var(--muted);font-weight:720;text-transform:uppercase;letter-spacing:0}.subtle{color:var(--muted)}body[data-initialized="true"] #initPanel{display:none}.metric{display:grid;grid-template-columns:1fr auto;gap:8px;padding:7px 0;border-bottom:1px solid #edf0f5}.field{display:grid;gap:5px;margin:9px 0}.field span,.field label{font-size:12px;color:var(--muted);font-weight:650}.field input,.field textarea,.field select{width:100%;border:1px solid var(--line);border-radius:6px;padding:8px;background:#fff;color:var(--ink)}.field textarea{resize:vertical;min-height:76px}.field.checkbox{grid-template-columns:auto 1fr;align-items:center}.field.checkbox input{width:auto}.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.route-list{display:grid;gap:8px}.route-row,.graph-node,.event-row,.doctor-row,.item{border:1px solid var(--line);border-radius:7px;padding:9px;background:#fff}.route-row{width:100%;text-align:left;display:grid;gap:4px}.route-row.active,.route-row.selected,.graph-node.selected{border-color:var(--accent);box-shadow:inset 3px 0 0 var(--accent);background:#f6f9ff}.graph-nodes{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:12px 0}.graph-node{position:relative;text-align:left;min-height:94px}.graph-node:before{content:"";position:absolute;left:14px;top:-13px;width:1px;height:12px;background:var(--line)}.graph-node strong{display:block;margin-bottom:4px}.node-meta{display:flex;gap:8px;flex-wrap:wrap;color:var(--muted);font-size:12px}.chip{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:999px;padding:2px 7px;background:#f8fafc;color:var(--muted);font-size:12px}.tree-source{white-space:pre;overflow:auto;background:#111827;color:#e5edf7;border-radius:8px;padding:14px;min-height:260px;margin:12px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.55}.route-meta{display:grid;gap:8px;border:1px solid var(--line);border-radius:8px;background:#f8fafc;padding:10px;margin:10px 0}.action-group h3{font-size:14px;margin:0 0 8px}.prompt-output{white-space:pre-wrap;overflow:auto;background:#111827;color:#e5edf7;border-radius:8px;padding:10px;min-height:120px;max-height:260px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}.event-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}.event-row strong{margin-right:6px}.ok{color:var(--good)}.warn{color:var(--warn)}.fail{color:var(--bad)}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#334155}@media (prefers-reduced-motion:reduce){*{transition:none!important}}@media (max-width:900px){body{overflow:auto}.shell{grid-template-columns:1fr;grid-template-rows:auto;height:auto;min-height:100vh}.top,.route-rail,.workspace,.inspector,.activity{grid-column:1}.top{align-items:flex-start;flex-wrap:wrap}.message{margin-left:0;max-width:100%;width:100%}.route-rail,.workspace,.inspector,.activity{border-left:0;border-right:0}.workspace{padding:12px}.graph-nodes{grid-template-columns:1fr}.tree-source{min-height:180px}}
</style>
</head>
<body>
<div class="shell">
  <header class="top" data-region="command-bar"><span class="brand">Agent Decision Lab</span><span id="live" class="status-dot"></span><span id="liveText">connecting</span><span id="topTitle" class="top-title">Loading</span><button id="refresh">Refresh</button><button id="export" class="primary">Export HTML</button><div id="message" role="status" class="message">Ready</div></header>
  <aside class="route-rail" data-region="route-board">
    <div class="label">Experiment</div>
    <h2 id="title">Loading</h2>
    <div id="metrics"></div>
    <div class="panel" id="initPanel">
      <div class="label">Init Case Study</div>
      <label class="field"><span>Title</span><input id="initTitle" placeholder="Case study title"></label>
      <label class="field"><span>Decision</span><input id="initDecision" placeholder="Decision"></label>
      <label class="field"><span>Savepoint</span><input id="initSavepoint" placeholder="Savepoint"></label>
      <button id="initBtn">Init</button>
    </div>
    <div class="panel"><div class="label">Routes</div><div id="variants" class="route-list"></div></div>
    <div class="panel">
      <div class="label">Add Variant</div>
      <label class="field"><span>Name</span><input id="variantName" placeholder="variant-name"></label>
      <label class="field"><span>From</span><input id="variantFrom" placeholder="savepoint title or id"></label>
      <label class="field"><span>Context policy</span><input id="variantPolicy" placeholder="context policy"></label>
      <label class="field checkbox"><input id="variantWorktree" type="checkbox"> <span>Create worktree</span></label>
      <button id="variantBtn">Add Variant</button>
    </div>
  </aside>
  <main class="workspace" data-region="decision-workspace">
    <section class="graph-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Graph Workspace</p>
          <h2>Where am I?</h2>
        </div>
        <span class="chip" id="graphStatus">waiting</span>
      </div>
      <div id="graphNodes" class="graph-nodes"></div>
      <pre id="tree" class="tree-source"></pre>
    </section>
  </main>
  <aside class="inspector" data-region="selected-route">
    <div class="panel" data-region="node-inspector">
      <div class="section-head">
        <div>
          <p class="eyebrow">Node Inspector</p>
          <h2>Next Safe Actions</h2>
        </div>
      </div>
      <label class="field"><span>Selected route</span><select id="routeSelect"></select></label>
      <div id="routeMeta" class="route-meta"></div>
    </div>
    <section class="action-group" data-action-group="prepare">
      <h3>Prepare</h3>
      <button id="promptBtn" class="primary">Render Prompt</button>
      <pre id="promptBlock" class="prompt-output"></pre>
    </section>
    <section class="action-group" data-action-group="record">
      <h3>Record</h3>
      <label class="field"><span>Route for note</span><select id="noteVariant"></select></label>
      <label class="field"><span>Note</span><textarea id="noteBody" rows="4" placeholder="Write an observation"></textarea></label>
      <button id="noteBtn">Log Note</button>
      <label class="field"><span>Agent response summary</span><textarea id="responseBody" rows="4" placeholder="Paste agent response summary"></textarea></label>
      <button id="responseBtn">Log Response</button>
    </section>
    <section class="action-group" data-action-group="preserve">
      <h3>Preserve</h3>
      <label class="field"><span>Checkpoint summary</span><input id="checkpointBody" placeholder="Checkpoint summary"></label>
      <div class="row"><button id="checkpointBtn">Checkpoint</button><button id="exportInspector" class="ghost">Export HTML</button></div>
    </section>
    <div class="panel"><div class="label">Doctor</div><div id="doctor"></div></div>
  </aside>
  <section class="activity" data-region="activity-stream"><div class="label">Event Stream</div><div id="events" class="event-grid"></div></section>
</div>
<script>
const stateUrl='/api/state';
let latest={};
let currentRouteName='';
const escapeMap={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>escapeMap[ch]);}
function statusClass(value){return ['ok','warn','fail'].includes(value)?value:'fail';}
async function api(path, body){const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const result=await response.json();if(!response.ok||result.ok===false){throw new Error(result.error||'Request failed '+response.status);}return result;}
function setMessage(text,type='ok'){const node=document.querySelector('#message');node.textContent=text;node.className='message '+type;}
async function runAction(action){try{const message=await action();if(message){setMessage(message,'ok');}await refresh();}catch(error){setMessage(error.message,'fail');}}
async function refresh(){render(await (await fetch(stateUrl)).json());}
function render(state){latest=state;document.body.dataset.initialized=state.initialized?'true':'false';document.querySelector('#live').classList.add('live');document.querySelector('#liveText').textContent='live';const title=state.initialized?state.experiment.title:'No lab initialized';document.querySelector('#title').textContent=title;document.querySelector('#topTitle').textContent=title;document.querySelector('#tree').textContent=state.treeText||state.error||'Initialize a case study to see the tree.';renderMetrics(state);renderDoctor(state.doctor);renderRouteRail(state);renderGraph(state);renderEvents(state.events||[]);selectRoute(preferredRoute(state));}
function renderMetrics(state){const counts=state.counts||{};document.querySelector('#metrics').innerHTML=['decisions','savepoints','variants','events','evaluations'].map(k=>'<div class="metric"><span>'+esc(k)+'</span><strong>'+esc(counts[k]??0)+'</strong></div>').join('');}
function renderDoctor(doctor){document.querySelector('#doctor').innerHTML=(doctor?.checks||[]).map(c=>'<div class="item"><strong>'+esc(c.label)+'</strong><br><span class="'+statusClass(c.status)+'">'+esc(c.status)+'</span> '+esc(c.message)+'</div>').join('');}
function routeOptions(routes){return '<option value="">Base lab</option>'+routes.map(route=>'<option value="'+esc(route.name)+'">'+esc(route.name)+'</option>').join('');}
function preferredRoute(state){const routes=state.routeSummaries||[];if(routes.some(route=>route.name===currentRouteName)){return currentRouteName;}const active=routes.find(route=>route.active);return active?.name??routes[0]?.name??'';}
function selectedRoute(){return (latest.routeSummaries||[]).find(route=>route.name===currentRouteName)||null;}
function selectRoute(name){currentRouteName=name||'';document.querySelector('#routeSelect').value=currentRouteName;document.querySelector('#noteVariant').value=currentRouteName;document.querySelectorAll('[data-route]').forEach(node=>node.classList.toggle('selected',node.getAttribute('data-route')===currentRouteName));renderRouteMeta(selectedRoute());}
function renderGraph(state){const routes=state.routeSummaries||[];document.querySelector('#graphStatus').textContent=state.initialized?(routes.length+' route'+(routes.length===1?'':'s')):'not initialized';if(!state.initialized){document.querySelector('#graphNodes').innerHTML='<div class="graph-node"><strong>Start a lab</strong><span class="subtle">Initialize a case study to create the first decision and savepoint.</span></div>';return;}if(routes.length===0){document.querySelector('#graphNodes').innerHTML='<div class="graph-node"><strong>Blank savepoint</strong><span class="subtle">Add a variant to fork the first route.</span></div>';return;}document.querySelector('#graphNodes').innerHTML=routes.map(route=>'<button class="graph-node'+(route.active?' active':'')+'" data-route="'+esc(route.name)+'" type="button"><strong>'+esc(route.name)+'</strong><span class="subtle">'+esc(route.contextPolicy)+'</span><div class="node-meta"><span>'+esc(route.location)+'</span><span>'+esc(route.eventCount)+' events</span><span>'+esc(route.checkpointCount)+' checkpoints</span></div></button>').join('');document.querySelectorAll('[data-route]').forEach(node=>node.onclick=()=>selectRoute(node.getAttribute('data-route')));}
function renderRouteMeta(route){document.querySelector('#routeMeta').innerHTML=route?'<strong>'+esc(route.name)+'</strong><span class="subtle">'+esc(route.contextPolicy)+'</span><span><code>'+esc(route.branch)+'</code></span><div class="row"><span class="chip">'+esc(route.location)+'</span><span class="chip">'+esc(route.eventCount)+' events</span><span class="chip">'+esc(route.responseCount)+' responses</span><span class="chip">'+esc(route.checkpointCount)+' checkpoints</span></div>':'<strong>Base lab</strong><span class="subtle">Use this when recording experiment-level notes or preparing the next branch.</span>';}
function renderRouteRail(state){const routes=state.routeSummaries||[];const variants=state.variants||[];const options=routeOptions(routes);document.querySelector('#noteVariant').innerHTML=options;document.querySelector('#routeSelect').innerHTML=options;document.querySelector('#variants').innerHTML=variants.length?variants.map(v=>{const route=routes.find(item=>item.id===v.id)||{};return '<button class="route-row'+(route.active?' active':'')+'" type="button" data-route="'+esc(v.name)+'"><strong>'+esc(v.name)+'</strong><code>'+esc(v.branch)+'</code><span class="subtle">'+esc(route.location||'base lab')+' · '+esc(route.eventCount??0)+' events</span></button>';}).join(''):'<div class="route-row"><strong>No variants yet</strong><span class="subtle">Create a route from the savepoint.</span></div>';document.querySelectorAll('.route-row[data-route]').forEach(node=>node.onclick=()=>selectRoute(node.getAttribute('data-route')));}
function renderEvents(events){const routeNames=new Map((latest.routeSummaries||[]).map(route=>[route.id,route.name]));document.querySelector('#events').innerHTML=events.slice().reverse().map(e=>'<div class="event-row"><strong>'+esc(e.type)+'</strong><code>'+esc(routeNames.get(e.variantId)||e.variantId||'base lab')+'</code><br><span class="subtle">'+esc(e.actor||'unknown')+' · '+esc(e.createdAt||'')+'</span><br>'+esc(e.bodySummary)+'</div>').join('');}
document.querySelector('#refresh').onclick=()=>runAction(async()=>{await refresh();return 'Refreshed';});
document.querySelectorAll('#export,#exportInspector').forEach(node=>node.onclick=()=>runAction(async()=>{const result=await api('/api/export',{format:'html'});return 'Exported '+result.out;}));
document.querySelector('#initBtn').onclick=()=>runAction(async()=>{const result=await api('/api/case-study-init',{title:initTitle.value||'UI Case Study',decision:initDecision.value||'Context strategy',savepoint:initSavepoint.value||'Before UI task'});return 'Initialized '+result.experiment.title;});
document.querySelector('#variantBtn').onclick=()=>runAction(async()=>{const result=await api('/api/variants',{name:variantName.value,from:variantFrom.value,contextPolicy:variantPolicy.value,worktree:variantWorktree.checked});return 'Added '+result.variant.name;});
document.querySelector('#noteBtn').onclick=()=>runAction(async()=>{await api('/api/log-note',{variant:noteVariant.value,body:noteBody.value});noteBody.value='';return 'Logged note';});
document.querySelector('#promptBtn').onclick=()=>runAction(async()=>{const result=await api('/api/orchestrate',{variant:routeSelect.value});promptBlock.textContent=result.prompt;return 'Prompt ready';});
document.querySelector('#responseBtn').onclick=()=>runAction(async()=>{await api('/api/log-response',{variant:routeSelect.value,body:responseBody.value});responseBody.value='';return 'Logged response';});
document.querySelector('#checkpointBtn').onclick=()=>runAction(async()=>{await api('/api/checkpoint',{variant:routeSelect.value,body:checkpointBody.value});checkpointBody.value='';return 'Checkpoint recorded';});
document.querySelector('#routeSelect').onchange=event=>selectRoute(event.target.value);
document.querySelector('#noteVariant').onchange=event=>selectRoute(event.target.value);
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
  try {
    return body ? JSON.parse(body) : {};
  } catch (error) {
    error.statusCode = 400;
    error.message = 'Invalid JSON request body';
    throw error;
  }
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
