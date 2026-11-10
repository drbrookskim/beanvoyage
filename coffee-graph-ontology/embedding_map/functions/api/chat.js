// 검색된 조각을 근거로 답한다 (경로: /api/chat)
// 요청: { messages: [{role, content}], ids: [문맥으로 쓸 조각 id] }
// 응답: { reply, cited: [답에서 인용한 조각 id], model }
import { json, loadData } from "../_lib.js";

const MODEL = "@cf/zai-org/glm-4.7-flash";
const FALLBACK_MODEL = "@cf/google/gemma-4-26b-a4b-it";
const MAX_CONTEXT = 8;
const MAX_MESSAGES = 8;
const MAX_CHARS = 1500;

const SYSTEM = `당신은 커피(종·품종·원산지·가공·로스팅·블렌딩) 자료를 검색해 답하는 도우미입니다.
- 아래 [자료]에 있는 내용만으로 한국어로 간결하게 답하세요. 자료에 없으면 "자료에 없다"고 말하고 지어내지 마세요.
- 문장 끝에 근거 자료 번호를 [1], [2]처럼 붙이세요.
- 먼저 1~3문장으로 핵심을 답하고, 필요하면 목록으로 덧붙이세요. 목록과 **굵게** 정도의 마크다운만 쓰세요.`;

function contentOf(res) {
  if (Array.isArray(res?.choices)) return String(res.choices[0]?.message?.content || "");
  return typeof res?.response === "string" ? res.response : "";
}

export async function onRequestPost({ request, env }) {
  if (!env.AI) return json({ error: "Workers AI 바인딩(AI)이 설정되지 않았습니다." }, 500);
  const body = await request.json().catch(() => ({}));
  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  if (!history.length || history[history.length - 1].role !== "user") return json({ error: "질문이 비어 있습니다." }, 400);

  const { chunks } = await loadData(env, request, { vectors: false });
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const ctx = (Array.isArray(body.ids) ? body.ids : []).map((id) => byId.get(id)).filter(Boolean).slice(0, MAX_CONTEXT);
  const refs = ctx.map((c, i) => `[${i + 1}] (${c.title}) ${c.text}`).join("\n");
  const messages = [{ role: "system", content: `${SYSTEM}\n\n[자료]\n${refs || "(검색된 자료 없음)"}` }, ...history];

  let reply = "", model = MODEL;
  for (const m of [MODEL, FALLBACK_MODEL]) {
    model = m;
    try {
      reply = contentOf(await env.AI.run(m, { messages, max_completion_tokens: 1200, temperature: 0.2 })).trim();
      if (reply) break;
    } catch (e) {
      const msg = String(e?.message || e);
      if (/4006|daily|quota|neuron/i.test(msg)) return json({ error: "오늘의 무료 AI 사용량(Workers AI 10,000 뉴런)을 모두 썼습니다. 내일(UTC 0시) 다시 시도해 주세요." }, 429);
      if (m === FALLBACK_MODEL) return json({ error: "AI 모델 호출에 실패했습니다: " + msg.slice(0, 200) }, 502);
    }
  }
  reply = reply.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/\[\s*\d{0,2}\s*$/, "").trim(); // 끝에 남은 짝 없는 "["도 지운다
  const cited = [...new Set([...reply.matchAll(/\[(\d{1,2})\]/g)].map((m) => Number(m[1])))]
    .filter((n) => n >= 1 && n <= ctx.length).map((n) => ctx[n - 1].id);
  return json({ reply: reply || "(답변을 만들지 못했습니다. 질문을 바꿔 다시 시도해 주세요.)", cited, context: ctx.map((c) => c.id), model });
}

export async function onRequest({ request }) {
  return json({ error: "POST로 { messages, ids }를 보내세요.", model: MODEL }, request.method === "GET" ? 200 : 405);
}
