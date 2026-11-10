// 커피 지식 그래프 MCP 서버 (Cloudflare Pages Function, 경로: /mcp)
// 전송: Streamable HTTP, 상태 없음(stateless), JSON 응답. 읽기 전용, 인증 없음.
import DATA from "../mcp_data.js";
import { createGraphTools } from "../tools_core.js";

const SERVER = { name: "coffee-graph", title: "커피 지식 그래프", version: "1.0.0" };
const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};
const INSTRUCTIONS =
  "커피(종·품종·원산지·가공·로스팅·블렌딩) 지식 그래프입니다. 노드 id는 V_bourbon처럼 영어, 라벨은 한국어입니다. " +
  "먼저 get_overview로 클래스와 관계를 보고, search_nodes로 id를 찾은 뒤 get_node·get_neighbors·find_path·get_lineage를 쓰세요. " +
  "간선의 confidence는 confirmed(출처 직접 서술)·claimed(업계 자료 등 주장)·inferred(암시 또는 규칙 도출)이고, derived=true는 온톨로지 규칙으로 추론된 간선입니다. " +
  "답할 때 claimed·inferred 정보는 그렇다고 밝혀 주세요.";

const G = DATA.graph;
const { TOOLS, call, ToolError } = createGraphTools(DATA);

const RESOURCES = [
  { uri: "coffee://ontology", name: "ontology", title: "온톨로지 정의", mimeType: "text/markdown", text: () => DATA.ontology },
  { uri: "coffee://validation-report", name: "validation-report", title: "검증 보고서", mimeType: "text/markdown", text: () => DATA.report },
  { uri: "coffee://summary", name: "summary", title: "수집 문서(원두·로스팅·원산지·블렌딩)", mimeType: "text/markdown", text: () => DATA.summary },
  { uri: "coffee://graph.json", name: "graph", title: "그래프 전체 (JSON)", mimeType: "application/json", text: () => JSON.stringify(G) },
];

// ---------------------------------------------------------------- JSON-RPC
const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
const fail = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

function handle(m) {
  const p = m.params || {};
  switch (m.method) {
    case "initialize":
      return ok(m.id, {
        protocolVersion: PROTOCOLS.includes(p.protocolVersion) ? p.protocolVersion : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false }, resources: { listChanged: false } },
        serverInfo: SERVER,
        instructions: INSTRUCTIONS,
      });
    case "ping":
      return ok(m.id, {});
    case "tools/list":
      return ok(m.id, { tools: TOOLS });
    case "tools/call": {
      if (!TOOLS.some((t) => t.name === p.name)) return fail(m.id, -32602, `알 수 없는 도구: ${p.name}`);
      try {
        const result = call(p.name, p.arguments || {});
        return ok(m.id, { content: [{ type: "text", text: JSON.stringify(result, null, 1) }], structuredContent: result });
      } catch (e) {
        if (e instanceof ToolError) return ok(m.id, { content: [{ type: "text", text: e.message }], isError: true });
        return fail(m.id, -32603, "서버 내부 오류");
      }
    }
    case "resources/list":
      return ok(m.id, { resources: RESOURCES.map(({ text, ...r }) => r) });
    case "resources/read": {
      const r = RESOURCES.find((x) => x.uri === p.uri);
      if (!r) return fail(m.id, -32002, `리소스를 찾을 수 없습니다: ${p.uri}`);
      return ok(m.id, { contents: [{ uri: r.uri, mimeType: r.mimeType, text: r.text() }] });
    }
    case "prompts/list":
      return ok(m.id, { prompts: [] });
    case "resources/templates/list":
      return ok(m.id, { resourceTemplates: [] });
    default:
      return fail(m.id, -32601, `지원하지 않는 메서드: ${m.method}`);
  }
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });

export async function onRequest({ request }) {
  const method = request.method;
  if (method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (method === "GET") {
    const accept = request.headers.get("accept") || "";
    if (accept.includes("text/html")) return Response.redirect(new URL("/connect", request.url).toString(), 302);
    // 서버 → 클라이언트 SSE 스트림은 제공하지 않음 (Streamable HTTP 규격상 405 허용)
    return new Response("Method Not Allowed: 이 서버는 POST(JSON 응답)만 지원합니다.", { status: 405, headers: { ...CORS, Allow: "POST, OPTIONS" } });
  }
  if (method !== "POST") return new Response(null, { status: 405, headers: { ...CORS, Allow: "POST, GET, OPTIONS" } });

  let body;
  try {
    body = await request.json();
  } catch {
    return json(fail(null, -32700, "Parse error"), 400);
  }
  const batch = Array.isArray(body);
  const out = [];
  for (const m of batch ? body : [body]) {
    if (!m || m.jsonrpc !== "2.0" || typeof m.method !== "string") {
      if (m && (m.result !== undefined || m.error !== undefined)) continue; // 클라이언트의 응답 메시지는 무시
      out.push(fail(m && m.id !== undefined ? m.id : null, -32600, "Invalid Request"));
      continue;
    }
    if (m.id === undefined || m.id === null) continue; // 알림(notification)
    out.push(handle(m));
  }
  if (!out.length) return new Response(null, { status: 202, headers: CORS });
  return json(batch ? out : out[0]);
}
