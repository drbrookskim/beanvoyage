// 임베딩 지도 공용 코드 (Pages Functions)
// - 조각 데이터: /data/chunks.json, 임베딩: /data/vectors.bin (Float32, 행마다 정규화된 DIM차원)
// - 검색: bge-m3 의미 검색(코사인) + BM25 키워드 검색(한글 2글자 단위) → RRF로 합침
export const EMBED_MODEL = "@cf/baai/bge-m3";
export const DIM = 1024;
const RRF_K = 60;

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

// ---------------------------------------------------------------- 데이터 (isolate마다 한 번 읽음)
let cache = null;
export async function loadData(env, request, { vectors = true } = {}) {
  if (cache && (!vectors || cache.vecs)) return cache;
  const get = (p) => env.ASSETS.fetch(new Request(new URL(p, request.url)));
  const chunks = cache?.chunks || (await (await get("/data/chunks.json")).json());
  let vecs = cache?.vecs || null;
  if (vectors && !vecs) {
    const res = await get("/data/vectors.bin");
    if (!res.ok) throw new Error("임베딩 파일(vectors.bin)이 없습니다.");
    vecs = new Float32Array(await res.arrayBuffer());
    if (vecs.length !== chunks.length * DIM) throw new Error("임베딩 수와 조각 수가 맞지 않습니다.");
  }
  cache = { chunks, vecs, bm25: cache?.bm25 || buildBm25(chunks) };
  return cache;
}

// ---------------------------------------------------------------- 임베딩
export async function embed(env, texts) {
  const out = await env.AI.run(EMBED_MODEL, { text: texts });
  const rows = out?.data || out?.response;
  if (!Array.isArray(rows) || rows.length !== texts.length) throw new Error("임베딩 응답 형식이 예상과 다릅니다.");
  return rows.map(normalizeVec);
}
function normalizeVec(v) {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}

// ---------------------------------------------------------------- BM25
export function tokenize(s) {
  const toks = [];
  for (const w of String(s).toLowerCase().match(/[가-힣]+|[a-z0-9]+/g) || []) {
    if (/^[가-힣]+$/.test(w)) {
      if (w.length === 1) toks.push(w);
      for (let i = 0; i + 1 < w.length; i++) toks.push(w.slice(i, i + 2));
    } else if (w.length > 1 || /\d/.test(w)) toks.push(w);
  }
  return toks;
}
function buildBm25(chunks) {
  const docs = chunks.map((c) => {
    const tf = new Map();
    for (const t of tokenize(c.text)) tf.set(t, (tf.get(t) || 0) + 1);
    let len = 0;
    for (const v of tf.values()) len += v;
    return { tf, len };
  });
  const df = new Map();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) || 0) + 1);
  const avg = docs.reduce((a, d) => a + d.len, 0) / docs.length;
  return { docs, df, avg, n: docs.length };
}
function bm25Scores(bm, query, k1 = 1.2, b = 0.75) {
  const q = [...new Set(tokenize(query))];
  return bm.docs.map((d) => {
    let s = 0;
    for (const t of q) {
      const f = d.tf.get(t);
      if (!f) continue;
      const df = bm.df.get(t);
      const idf = Math.log(1 + (bm.n - df + 0.5) / (df + 0.5));
      s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.len / bm.avg));
    }
    return s;
  });
}

// ---------------------------------------------------------------- 하이브리드 검색
function ranks(scores) {
  const order = scores.map((s, i) => i).sort((a, b) => scores[b] - scores[a]);
  const r = new Array(scores.length);
  order.forEach((i, k) => (r[i] = k + 1));
  return r;
}
export function hybridSearch(data, qvec, query, { topK = 20 } = {}) {
  const { chunks, vecs, bm25 } = data;
  const dense = chunks.map((_, i) => {
    let s = 0;
    const o = i * DIM;
    for (let j = 0; j < DIM; j++) s += vecs[o + j] * qvec[j];
    return s;
  });
  const lex = bm25Scores(bm25, query);
  const dr = ranks(dense), lr = ranks(lex);
  const rrf = chunks.map((_, i) => 1 / (RRF_K + dr[i]) + (lex[i] > 0 ? 1 / (RRF_K + lr[i]) : 0));
  const lexMax = Math.max(...lex) || 1;
  const order = rrf.map((s, i) => i).sort((a, b) => rrf[b] - rrf[a]).slice(0, topK);
  return {
    sims: dense.map((s) => Math.round(s * 1000) / 1000),
    candidates: order.map((i, k) => ({
      idx: i, id: chunks[i].id, rank: k + 1,
      dense: Math.round(dense[i] * 1000) / 1000, denseRank: dr[i],
      lex: Math.round((lex[i] / lexMax) * 1000) / 1000, lexRank: lex[i] > 0 ? lr[i] : null,
      rrf: Math.round(rrf[i] * 100000) / 100000,
    })),
  };
}
