import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function nodeSupportsMake(node: any) {
  return node && node.type !== 'logic';
}

function getExecutionOrder(nodes: any[], edges: any[]) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));

  edges.forEach((edge) => {
    if (!nodeMap.has(edge.from) || !nodeMap.has(edge.to)) return;
    incoming.set(edge.to, (incoming.get(edge.to) || 0) + 1);
    outgoing.get(edge.from)?.push(edge.to);
  });

  const queue = nodes
    .filter((node) => (incoming.get(node.id) || 0) === 0)
    .sort((a, b) => a.column - b.column || a.lane - b.lane)
    .map((node) => node.id);

  const ordered: any[] = [];

  while (queue.length) {
    const nextId = queue.shift()!;
    ordered.push(nodeMap.get(nextId));
    (outgoing.get(nextId) || []).forEach((targetId) => {
      incoming.set(targetId, (incoming.get(targetId) || 0) - 1);
      if ((incoming.get(targetId) || 0) === 0) {
        queue.push(targetId);
      }
    });
  }

  return ordered.filter(Boolean);
}

async function executeMakeNode(node: any, context: any) {
  if (!node.makeConfig?.enabled || !node.makeConfig.webhookUrl) {
    return {
      nodeId: node.id,
      nodeTitle: node.title,
      status: 'Skipped',
      detail: 'No webhook configured',
    };
  }

  let payload = {};
  let headers = {};
  try {
    payload = node.makeConfig.payload ? JSON.parse(node.makeConfig.payload) : {};
  } catch (_error) {
    return {
      nodeId: node.id,
      nodeTitle: node.title,
      status: 'Payload error',
      detail: 'Invalid JSON payload',
    };
  }

  try {
    headers = node.makeConfig.headers ? JSON.parse(node.makeConfig.headers) : {};
  } catch (_error) {
    return {
      nodeId: node.id,
      nodeTitle: node.title,
      status: 'Header error',
      detail: 'Invalid JSON headers',
    };
  }

  const response = await fetch(node.makeConfig.webhookUrl, {
    method: node.makeConfig.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body:
      (node.makeConfig.method || 'POST') === 'GET'
        ? undefined
        : JSON.stringify({
            flowId: context.flowId,
            flowName: context.flowName,
            flowSummary: context.flowSummary,
            planName: context.planName,
            nodeId: node.id,
            nodeType: node.type,
            nodeTitle: node.title,
            payload,
          }),
  });

  const text = await response.text();
  const detail = text.slice(0, 180) || `${response.status} ${response.statusText}`;

  return {
    nodeId: node.id,
    nodeTitle: node.title,
    status: response.ok ? 'Connected' : `HTTP ${response.status}`,
    detail,
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return json({ error: 'Missing Supabase server credentials.' }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const body = await request.json();
    const mode = body.mode || 'path';
    const flowId = body.flowId || null;
    const flowName = body.flowName || 'Untitled flow';
    const flowSummary = body.flowSummary || '';
    const planName = body.planName || null;

    const { data: run, error: runError } = await supabase
      .from('automation_runs')
      .insert({
        flow_id: flowId,
        mode,
        plan_name: planName,
        flow_name: flowName,
        status: 'running',
        summary: flowSummary,
      })
      .select('id')
      .single();

    if (runError) throw runError;

    const context = { flowId, flowName, flowSummary, planName };
    const steps =
      mode === 'node'
        ? [await executeMakeNode(body.node, context)]
        : await (async () => {
            const orderedNodes = getExecutionOrder(body.nodes || [], body.edges || []);
            const results = [];
            for (const node of orderedNodes) {
              if (!nodeSupportsMake(node)) {
                results.push({
                  nodeId: node.id,
                  nodeTitle: node.title,
                  status: 'Logic',
                  detail: 'Routing step handled by builder graph',
                });
                continue;
              }
              results.push(await executeMakeNode(node, context));
            }
            return results;
          })();

    if (steps.length) {
      const runStepRows = steps.map((step) => ({
        run_id: run.id,
        node_id: step.nodeId,
        node_title: step.nodeTitle,
        status: step.status,
        response_preview: step.detail,
      }));
      await supabase.from('automation_run_steps').insert(runStepRows);
    }

    const failedStep = steps.find((step) => !['Connected', 'Skipped', 'Logic'].includes(step.status));
    await supabase
      .from('automation_runs')
      .update({
        status: failedStep ? 'error' : 'completed',
        finished_at: new Date().toISOString(),
      })
      .eq('id', run.id);

    return json({
      runId: run.id,
      status: failedStep ? 'error' : 'completed',
      steps,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Execution failed.' }, 500);
  }
});
