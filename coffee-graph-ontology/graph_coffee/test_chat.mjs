// /api/chat 로컬 테스트: Workers AI를 가짜 모델로 바꿔 MCP 도구 호출 흐름만 검증한다
import { onRequestPost } from "./functions/api/chat.js";
let calls = 0;
const env = { AI: { async run(model, input) {
  calls++;
  if (calls === 1) {
    if (!input.tools.some((t) => t.function.name === "get_lineage")) throw new Error("MCP 도구가 모델에 전달되지 않음");
    return { choices: [{ message: { content: "", tool_calls: [
      { id: "c1", type: "function", function: { name: "get_lineage", arguments: JSON.stringify({ variety: "카투아이" }) } },
      { id: "c2", type: "function", function: { name: "highlight_nodes", arguments: JSON.stringify({ ids: ["V_catuai", "V_mundonovo", "V_caturra"], label: "카투아이 계보" }) } },
    ] } }] };
  }
  const toolMsg = input.messages.find((m) => m.role === "tool" && m.tool_call_id === "c1");
  if (!toolMsg || !toolMsg.content.includes("V_mundonovo")) throw new Error("MCP 결과가 모델에 전달되지 않음");
  return { choices: [{ message: { content: "카투아이는 **문도 노보**와 카투라의 교배종이고 종은 아라비카입니다." } }] };
} } };
const req = new Request("https://x/api/chat", { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ messages: [{ role: "user", content: "카투아이 계보 알려줘" }], view: { selected: "" } }) });
const res = await onRequestPost({ request: req, env });
const d = await res.json();
console.log("status", res.status, "model calls", calls);
console.log("reply", d.reply);
console.log("trace", d.trace.map((t) => t.via + ":" + t.tool).join(", "));
console.log("actions", JSON.stringify(d.actions));
console.log("mentioned", d.mentioned.slice(0, 8).join(","), "…", d.mentioned.length);
