import { onRequest } from "./functions/mcp.js";
const U = "https://example.test/mcp";
async function rpc(body, headers = {}) {
  const r = await onRequest({ request: new Request(U, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...headers }, body: JSON.stringify(body) }) });
  return [r.status, r.status === 202 ? null : await r.json()];
}
let [s, d] = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } } });
console.log("initialize", s, d.result.protocolVersion, d.result.serverInfo.name);
[s, d] = await rpc({ jsonrpc: "2.0", method: "notifications/initialized" }); console.log("notification", s);
[s, d] = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }); console.log("tools", d.result.tools.map(t => t.name).join(","));
const call = async (name, args) => { const [, r] = await rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name, arguments: args } }); return r.result; };
let r = await call("get_lineage", { variety: "카투아이" });
const anc = (n) => n.map(x => x.label + "(" + x.via + ")" + (x.parents && x.parents.length ? "[" + anc(x.parents) + "]" : "")).join(" ");
console.log("lineage", r.structuredContent.species.map(x => x.species), anc(r.structuredContent.ancestors));
r = await call("find_path", { from: "게이샤", to: "인도네시아", include_derived: true }); console.log("path", r.structuredContent.path);
r = await call("search_nodes", { query: "bourbon" }); console.log("search", r.structuredContent.results.map(x => x.label));
r = await call("get_node", { id: "웻헐링" }); console.log("get_node", r.structuredContent.label, r.structuredContent.outgoing.length, r.structuredContent.incoming.length);
r = await call("get_node", { id: "없는노드" }); console.log("error case", r.isError, r.content[0].text);
r = await call("get_roast_levels", {}); console.log("roast", r.structuredContent.levels.map(l => l.label + l.temp_c).join(" "));
r = await call("query_edges", { relation: "crossOf" }); console.log("crossOf", r.structuredContent.total);
r = await call("get_overview", {}); console.log("overview", r.structuredContent.nodes, r.structuredContent.edges);
[s, d] = await rpc({ jsonrpc: "2.0", id: 9, method: "resources/read", params: { uri: "coffee://ontology" } }); console.log("resource", d.result.contents[0].text.slice(0, 30));
[s, d] = await rpc({ jsonrpc: "2.0", id: 10, method: "nope" }); console.log("unknown", d.error.code);
const g = await onRequest({ request: new Request(U, { headers: { Accept: "text/event-stream" } }) }); console.log("GET sse", g.status);
const h = await onRequest({ request: new Request(U, { headers: { Accept: "text/html" } }) }); console.log("GET html", h.status, h.headers.get("location"));
