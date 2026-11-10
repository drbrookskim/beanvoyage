// 빌드 전용: 조각 글의 임베딩을 계산해 돌려준다 (경로: /api/embed-corpus)
// API 토큰에 Workers AI 권한이 없어 Pages 함수의 AI 바인딩을 빌린다. BUILD_KEY 비밀값이 맞아야 동작한다.
import { json, embed, EMBED_MODEL } from "../_lib.js";

const MAX_BATCH = 24;
const MAX_CHARS = 2000;

export async function onRequestPost({ request, env }) {
  if (!env.BUILD_KEY || request.headers.get("X-Build-Key") !== env.BUILD_KEY) return json({ error: "권한이 없습니다." }, 403);
  const { texts = [] } = await request.json().catch(() => ({}));
  const part = (Array.isArray(texts) ? texts : []).slice(0, MAX_BATCH).map((t) => String(t).slice(0, MAX_CHARS));
  const vectors = part.length ? await embed(env, part) : [];
  return json({ model: EMBED_MODEL, count: part.length, vectors });
}
