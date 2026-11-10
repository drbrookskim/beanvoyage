// 커피 그래프 챗봇 (Cloudflare Pages Function, 경로: /api/chat)
// 모델: Workers AI @cf/zai-org/glm-4.7-flash (Workers Free에서 사용 가능, 함수 호출 지원)
// 그래프 조회는 MCP 서버(/mcp)를 MCP JSON-RPC(initialize·tools/list·tools/call)로 호출한다.
// 같은 Pages 프로젝트 안이라 네트워크 대신 함수 호출로 MCP 메시지를 주고받는다.
import { onRequest as mcpEndpoint } from "../mcp.js";

const MODEL = "@cf/zai-org/glm-4.7-flash";
const FALLBACK_MODEL = "@cf/google/gemma-4-26b-a4b-it";
const MAX_STEPS = 5;               // 모델 ↔ 도구 왕복 최대 횟수
const MAX_MESSAGES = 12;           // 대화 기록에서 보내는 최대 메시지 수
const MAX_CHARS = 2000;            // 메시지 하나의 최대 길이
const MAX_TOOL_RESULT = 6000;      // 모델에 넘기는 도구 결과 최대 길이
const ID_RE = /\b(?:T|SP|V|CT|CO|R|P|RS|RL|EQ|BM|B|F)_[A-Za-z0-9_]+\b/g;

// 브라우저에서 실행되는 화면 도구 (서버는 요청만 모아 돌려준다)
const PAGE_TOOLS = [
  { name: "highlight_nodes", description: "답변과 관련된 노드들을 그래프에서 하이라이트합니다. 노드 id 배열을 넘기세요. 답변할 때 관련 노드가 있으면 항상 호출하세요.",
    parameters: { type: "object", properties: { ids: { type: "array", items: { type: "string" }, description: "노드 id 목록 (예: V_catuai)" },
      label: { type: "string", description: "하이라이트 이름 (예: 카투아이 계보)" } }, required: ["ids"] } },
  { name: "focus_node", description: "답변의 중심이 되는 노드 하나로 그래프를 이동하고 노트 패널을 엽니다.",
    parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "set_search_filter", description: "그래프를 검색어가 들어간 노드만 보이도록 거릅니다. 빈 문자열이면 필터를 지웁니다. 사용자가 '~만 보여 줘'라고 할 때 쓰세요.",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "fit_view", description: "그래프 전체가 화면에 들어오게 합니다.", parameters: { type: "object", properties: {} } },
  { name: "clear_highlight", description: "그래프 하이라이트를 지웁니다.", parameters: { type: "object", properties: {} } },
];
const PAGE_NAMES = new Set(PAGE_TOOLS.map((t) => t.name));

const SYSTEM = `당신은 커피 지식 그래프(종·품종·원산지·가공·로스팅·블렌딩) 도우미입니다. 한국어로 간결하게 답하세요.
- 사실은 반드시 도구로 확인한 뒤 답하세요. 그래프에 없는 내용은 "그래프에 없다"고 말하고 지어내지 마세요.
- 노드 id(V_bourbon 등)를 모르면 search_nodes로 먼저 찾으세요. 영어 품종명은 id로 찾기 쉽습니다.
- 품종 계보는 get_lineage 결과의 summary와 direct_parents를 그대로 따르세요. direct_parents가 직접 부모 전부입니다.
- 간선의 confidence가 claimed나 inferred이면 답에서 "주장" 또는 "추론"이라고 밝히세요.
- 답에 등장하는 핵심 노드는 highlight_nodes로 그래프에 표시하고, 중심 노드가 하나면 focus_node도 호출하세요.
- 답변 본문에는 노드를 한국어 라벨로 쓰세요. 목록과 **굵게** 정도의 마크다운만 쓰세요.`;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

// ---------------------------------------------------------------- MCP 클라이언트
let rpcId = 0;
async function mcp(method, params) {
  const req = new Request("https://internal/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "Mcp-Protocol-Version": "2025-06-18" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  const res = await mcpEndpoint({ request: req });
  const data = await res.json();
  if (data.error) throw new Error(`MCP ${method} 오류: ${data.error.message}`);
  return data.result;
}
let mcpTools = null;
async function loadMcpTools() {
  if (mcpTools) return mcpTools;
  await mcp("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "coffee-graph-chat", version: "1.0.0" } });
  const { tools } = await mcp("tools/list", {});
  mcpTools = tools;
  return tools;
}

// ---------------------------------------------------------------- 모델 호출
function normalize(res) {
  // OpenAI 호환 형식(choices)과 예전 Workers AI 형식(response, tool_calls)을 모두 받는다
  if (res && Array.isArray(res.choices)) {
    const m = res.choices[0]?.message || {};
    return {
      content: typeof m.content === "string" ? m.content : "",
      toolCalls: (m.tool_calls || []).map((c, i) => ({
        id: c.id || `call_${i}`, name: c.function?.name, args: parseArgs(c.function?.arguments) })),
    };
  }
  return {
    content: typeof res?.response === "string" ? res.response : "",
    toolCalls: (res?.tool_calls || []).map((c, i) => ({ id: c.id || `call_${i}`, name: c.name, args: parseArgs(c.arguments) })),
  };
}
function parseArgs(a) {
  if (a && typeof a === "object") return a;
  try { return JSON.parse(a || "{}"); } catch { return {}; }
}
async function runModel(env, model, messages, tools) {
  const input = { messages, tools, max_completion_tokens: 900, temperature: 0.3 };
  return normalize(await env.AI.run(model, input));
}

// ---------------------------------------------------------------- 요청 처리
export async function onRequestPost({ request, env }) {
  if (!env.AI) return json({ error: "Workers AI 바인딩(AI)이 설정되지 않았습니다." }, 500);
  let body;
  try { body = await request.json(); } catch { return json({ error: "잘못된 요청입니다." }, 400); }
  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  if (!history.length || history[history.length - 1].role !== "user") return json({ error: "질문이 비어 있습니다." }, 400);

  const view = body.view && typeof body.view === "object" ? body.view : {};
  const ctxLine = [view.selected ? `현재 선택한 노드: ${String(view.selected).slice(0, 80)}` : "", view.search ? `현재 그래프 검색 필터: ${String(view.search).slice(0, 80)}` : ""]
    .filter(Boolean).join(" / ");

  let tools;
  try { tools = await loadMcpTools(); } catch (e) { return json({ error: "MCP 서버에 연결하지 못했습니다: " + e.message }, 502); }
  const modelTools = tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.inputSchema } }))
    .concat(PAGE_TOOLS.map((t) => ({ type: "function", function: t })));

  const messages = [{ role: "system", content: SYSTEM + (ctxLine ? `\n${ctxLine}` : "") }, ...history];
  const trace = [], actions = [], mentioned = new Set();
  let model = MODEL, reply = "";

  for (let step = 0; step < MAX_STEPS; step++) {
    let out;
    try { out = await runModel(env, model, messages, modelTools); }
    catch (e) {
      const msg = String(e && e.message || e);
      if (/4006|daily|quota|neuron/i.test(msg)) return json({ error: "오늘의 무료 AI 사용량(Workers AI 10,000 뉴런)을 모두 썼습니다. 내일(UTC 0시) 다시 시도해 주세요." }, 429);
      if (model === MODEL) { model = FALLBACK_MODEL; step--; continue; } // 주 모델 실패 시 한 번 대체 모델로
      return json({ error: "AI 모델 호출에 실패했습니다: " + msg.slice(0, 200) }, 502);
    }
    if (!out.toolCalls.length) {
      reply = out.content;
      if (!reply.trim() && step > 0) {
        // 도구 결과를 받은 뒤 빈 답을 내는 경우가 있어, 도구 없이 정리를 한 번 더 요청한다
        try { reply = (await runModel(env, model, messages.concat([{ role: "user", content: "위 도구 결과를 바탕으로 질문에 한국어로 답해 주세요." }]), undefined)).content; } catch {}
      }
      break;
    }

    messages.push({ role: "assistant", content: out.content || "",
      tool_calls: out.toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.args) } })) });
    for (const c of out.toolCalls) {
      let result;
      if (PAGE_NAMES.has(c.name)) {
        actions.push({ tool: c.name, args: sanitizeAction(c.name, c.args) });
        trace.push({ tool: c.name, args: c.args, via: "page" });
        result = JSON.stringify({ ok: true, note: "사용자 화면의 그래프에 적용됩니다." });
      } else if (tools.some((t) => t.name === c.name)) {
        try {
          const r = await mcp("tools/call", { name: c.name, arguments: c.args });
          result = (r.content || []).map((p) => p.text || "").join("\n");
          if (r.isError) trace.push({ tool: c.name, args: c.args, via: "mcp", error: result.slice(0, 200) });
          else trace.push({ tool: c.name, args: c.args, via: "mcp" });
          for (const id of result.match(ID_RE) || []) if (mentioned.size < 60) mentioned.add(id);
        } catch (e) { result = "도구 오류: " + e.message; trace.push({ tool: c.name, args: c.args, via: "mcp", error: e.message }); }
      } else {
        result = `알 수 없는 도구: ${c.name}`;
      }
      if (result.length > MAX_TOOL_RESULT) result = result.slice(0, MAX_TOOL_RESULT) + "\n…(결과가 길어 잘림)";
      messages.push({ role: "tool", tool_call_id: c.id, name: c.name, content: result });
    }
    if (step === MAX_STEPS - 1) {
      // 도구 호출이 끝나지 않으면 도구 없이 한 번 더 요약을 받는다
      try { reply = (await runModel(env, model, messages.concat([{ role: "user", content: "지금까지 확인한 내용으로 답을 정리해 주세요." }]), undefined)).content; } catch {}
    }
  }
  for (const id of reply.match(ID_RE) || []) mentioned.add(id);
  return json({ reply: reply || "(답변을 만들지 못했습니다. 질문을 조금 바꿔 다시 시도해 주세요.)", actions, trace, mentioned: [...mentioned], model });
}

function sanitizeAction(name, a) {
  a = a || {};
  if (name === "highlight_nodes") return { ids: (Array.isArray(a.ids) ? a.ids : []).filter((x) => typeof x === "string").slice(0, 80), label: typeof a.label === "string" ? a.label.slice(0, 60) : "" };
  if (name === "focus_node") return { id: typeof a.id === "string" ? a.id.slice(0, 80) : "" };
  if (name === "set_search_filter") return { query: typeof a.query === "string" ? a.query.slice(0, 80) : "" };
  return {};
}

export async function onRequest({ request }) {
  // POST 이외의 메서드
  return json({ error: "POST로 { messages: [{role, content}] }를 보내세요.", model: MODEL }, request.method === "GET" ? 200 : 405);
}
