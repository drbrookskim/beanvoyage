"""조각 임베딩(bge-m3), 이웃 목록, t-SNE·PCA 2차원 좌표를 만든다.
UMAP은 질문을 같은 모델로 변환(transform)하려고 브라우저에서 umap-js로 계산한다.

1) 배포된 /api/embed-corpus 로 조각 임베딩을 받는다 (API 토큰에 Workers AI 권한이 없어 Pages 함수의 AI 바인딩을 씀).
   글이 바뀌지 않은 조각은 embed_cache.npz 에서 재사용한다.
2) 조각마다 코사인 유사도가 가장 높은 이웃 5개를 구한다.
3) t-SNE(코사인)와 PCA 좌표를 계산한다. PCA는 평균·주성분도 저장해 브라우저가 질문을 그대로 사영한다.
출력: deploy/data/vectors.bin (Float32, 정규화), deploy/data/points.json

사용: python3 build_vectors.py [사이트 주소]   (기본 https://embedding-map.pages.dev)
"""
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

import numpy as np
from sklearn.manifold import TSNE

HERE = Path(__file__).resolve().parent
DATA = HERE / "deploy" / "data"
CACHE = HERE / "embed_cache.npz"
SITE = (sys.argv[1] if len(sys.argv) > 1 else "https://embedding-map.pages.dev").rstrip("/")
KEY = (HERE / ".build_key").read_text().strip()
BATCH = 24


def fetch(texts):
    req = urllib.request.Request(f"{SITE}/api/embed-corpus", data=json.dumps({"texts": texts}).encode(),
                                 headers={"Content-Type": "application/json", "X-Build-Key": KEY, "User-Agent": "build-vectors"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def main():
    chunks = json.loads((DATA / "chunks.json").read_text(encoding="utf-8"))
    hashes = [hashlib.sha1(c["text"].encode()).hexdigest() for c in chunks]
    cache = {}
    if CACHE.exists():
        z = np.load(CACHE)
        cache = dict(zip(z["hashes"].tolist(), z["vecs"]))
    todo = [i for i, h in enumerate(hashes) if h not in cache]
    print(f"{len(chunks)}개 중 새로 임베딩 {len(todo)}개")
    for s in range(0, len(todo), BATCH):
        idx = todo[s:s + BATCH]
        res = fetch([chunks[i]["text"] for i in idx])
        if len(res.get("vectors", [])) != len(idx):
            sys.exit(f"임베딩 응답 오류: {res.get('error', res)}")
        for i, v in zip(idx, res["vectors"]):
            cache[hashes[i]] = np.asarray(v, dtype=np.float32)
        print(f"  {min(s + BATCH, len(todo))}/{len(todo)}")
    np.savez(CACHE, hashes=np.array(list(cache)), vecs=np.stack(list(cache.values())))

    X = np.stack([cache[h] for h in hashes]).astype(np.float32)
    X /= np.linalg.norm(X, axis=1, keepdims=True)
    (DATA / "vectors.bin").write_bytes(X.tobytes())

    # 각 조각의 가장 가까운 이웃 5개 (지도에서 연결선 표시용)
    sims = X @ X.T
    np.fill_diagonal(sims, -1)
    nn = np.argsort(-sims, axis=1)[:, :5]
    def fit_box(Y):
        # 지도 좌표 [-1, 1]로 맞추는 중심과 반폭
        c = (Y.min(0) + Y.max(0)) / 2
        return c, float((Y.max(0) - Y.min(0)).max() / 2) or 1.0

    tsne = TSNE(n_components=2, metric="cosine", perplexity=20, init="pca", random_state=7, max_iter=2000).fit_transform(X)
    tc, th = fit_box(tsne)
    tsne = (tsne - tc) / th

    mean = X.mean(0)
    _, sv, vt = np.linalg.svd(X - mean, full_matrices=False)
    comps = vt[:2]
    pca = (X - mean) @ comps.T
    pc, ph = fit_box(pca)
    var_ratio = (sv[:2] ** 2 / (sv ** 2).sum()).tolist()

    r4 = lambda a: [round(float(v), 4) for v in a]
    points = [{"id": c["id"], "nn": nn[i].tolist(), "tsne": r4(tsne[i]), "pca": r4((pca[i] - pc) / ph)} for i, c in enumerate(chunks)]
    out = {"dim": int(X.shape[1]), "model": "@cf/baai/bge-m3", "points": points,
           "tsne": {"perplexity": 20},
           "pca": {"mean": [round(float(v), 6) for v in mean], "components": [[round(float(v), 6) for v in row] for row in comps],
                   "center": r4(pc), "half": round(ph, 6), "var_ratio": [round(v, 4) for v in var_ratio]}}
    (DATA / "points.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    print("PCA 설명 분산:", [f"{v:.1%}" for v in var_ratio])
    print("저장:", DATA / "vectors.bin", X.shape, DATA / "points.json")


if __name__ == "__main__":
    main()
