// 질문을 임베딩해 후보 조각을 찾는다 (경로: /api/search)
// 응답: qvec(질문 임베딩), sims(모든 조각과의 코사인 유사도), candidates(RRF 상위 20개와 순위·점수)
import { json, loadData, embed, hybridSearch, EMBED_MODEL } from "../_lib.js";

export async function onRequestPost({ request, env }) {
  if (!env.AI) return json({ error: "Workers AI 바인딩(AI)이 설정되지 않았습니다." }, 500);
  const body = await request.json().catch(() => ({}));
  const query = typeof body.query === "string" ? body.query.trim().slice(0, 500) : "";
  if (!query) return json({ error: "질문이 비어 있습니다." }, 400);
  try {
    const data = await loadData(env, request);
    const [qvec] = await embed(env, [query]);
    // qvec: 브라우저가 같은 UMAP 모델로 질문 위치를 계산할 때 쓴다
    return json({ query, model: EMBED_MODEL, qvec: qvec.map((x) => Math.round(x * 1e5) / 1e5), ...hybridSearch(data, qvec, query, { topK: 20 }) });
  } catch (e) {
    const msg = String(e?.message || e);
    if (/4006|daily|quota|neuron/i.test(msg)) return json({ error: "오늘의 무료 AI 사용량(Workers AI 10,000 뉴런)을 모두 썼습니다. 내일(UTC 0시) 다시 시도해 주세요." }, 429);
    return json({ error: "검색에 실패했습니다: " + msg.slice(0, 200) }, 502);
  }
}
