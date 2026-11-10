"""임베딩할 조각(chunk)을 만든다.

입력: 상위 폴더의 커피 문서(.md)와 커피 지식 그래프(graph.json)
출력: deploy/data/chunks.json  — [{id, group, topic, kind, title, text}]

- 문서: 표는 행 하나, 본문은 문단 하나를 조각으로
- 그래프: 노드 하나를 조각으로 (관계·속성 이름은 한국어로 풀어 씀)
- 두 종류 모두 "대상 — 분류. 항목: 값. …" 한 가지 형식으로 쓴다. 형식이 다르면 임베딩이
  내용보다 글 형식을 먼저 구분해 지도에서 문서와 노드가 따로 모이기 때문이다.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(__file__).resolve().parent / "deploy" / "data" / "chunks.json"
MAX_CHARS = 700

# 관계 이름 → (나가는 쪽 항목명, 들어오는 쪽 항목명). A rel B 이면 A에는 "앞 이름: B", B에는 "뒤 이름: A"
REL_KO = {
    "belongsTo": ("종", "속한 품종"),
    "mutationOf": ("돌연변이 원품종", "돌연변이 품종"),
    "selectedFrom": ("선발 원품종", "선발된 품종"),
    "crossOf": ("교배 부모", "교배 자손"),
    "descendsFrom": ("계보상 조상", "계보상 후손"),
    "originatesIn": ("기원지", "기원한 품종·가공"),
    "grownIn": ("재배지", "재배되는 품종·종"),
    "produces": ("생산하는 종", "주요 생산지"),
    "mainlyProducedIn": ("주 생산 권역", "주로 생산되는 종"),
    "locatedIn": ("위치", "포함 지역"),
    "usesProcess": ("주요 가공 방식", "쓰는 지역"),
    "partOf": ("분야", "하위 항목"),
    "nextStage": ("다음 단계", "이전 단계"),
    "darkerThan": ("더 밝은 배전도", "더 진한 배전도"),
    "reachedAfter": ("거치는 로스팅 단계", "이 단계 뒤의 배전도"),
    "increases": ("강해지는 풍미", "강하게 하는 요인"),
    "decreases": ("약해지는 풍미", "약하게 하는 요인"),
    "emphasizes": ("두드러지는 풍미", "이 특성이 두드러지는 것"),
    "hasComponent": ("구성 원두", "들어가는 블렌드"),
    "usesMethod": ("블렌딩 방법", "쓰는 블렌드"),
    "contrastsWith": ("대비되는 방법", "대비되는 방법"),
}
TRANSITIVE = {"descendsFrom", "darkerThan"}
ATTR_KO = {"temp_c": "온도(°C)", "note": "특징", "category": "배전 구분", "order": "순서", "interspecific": "종간 교잡",
           "share_pct": "세계 생산 비중(%)", "cga_mg_g": "클로로겐산(mg/g)", "pros": "장점", "cons": "단점"}
VALUE_KO = {"light": "라이트", "medium": "미디엄", "dark": "다크", True: "예", False: "아니오"}

DOCS = [
    ("coffee", ROOT / "Coffee_원두_로스팅_원산지_블렌딩.md"),
]
GRAPHS = [
    ("coffee", ROOT / "graph_coffee" / "graph.json"),
]


def clean(s):
    s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s)  # 링크는 글자만
    s = s.replace("**", "")
    return re.sub(r"\s+", " ", s).strip()


def category(heading):
    # "2. 품종 (Variety)과 계보 — ②" → "품종 (Variety)과 계보"
    h = re.sub(r"^\d+\.\s*", "", heading)
    h = re.sub(r"\s*—\s*[①-⑳,\s]+$", "", h)
    h = re.sub(r"\s*\([①-⑳][^)]*\)", "", h)
    return h.strip()


def entry(subject, cat, facts):
    """공통 형식: 대상 — 분류. 항목: 값. …"""
    head = subject if not cat or cat == subject else f"{subject} — {cat}"
    body = " ".join(f if f.endswith((".", "다", "…")) else f + "." for f in facts if f)
    return f"{head}. {body}".strip()


def split_long(text):
    if len(text) <= MAX_CHARS:
        return [text]
    parts, cur = [], ""
    for sent in re.split(r"(?<=[.!?다요])\s+", text):
        if cur and len(cur) + len(sent) + 1 > MAX_CHARS:
            parts.append(cur)
            cur = sent
        else:
            cur = f"{cur} {sent}".strip()
    if cur:
        parts.append(cur)
    return parts


def doc_chunks(topic, path):
    lines = path.read_text(encoding="utf-8").splitlines()
    heads = ["", "", ""]
    out = []
    block, table = [], []

    def where():
        return " > ".join(h for h in heads if h)

    def flush_block():
        if block:
            bold = re.match(r"^\*\*([^*]+)\*\*$", block[0])
            text = clean(" ".join(block[1:] if bold else block))
            cat = category(heads[2] or heads[1] or heads[0])
            title = clean(bold.group(1)) if bold else cat
            if len(text) >= 15:
                for t in split_long(text):
                    out.append({"title": title, "section": cat, "text": entry(title, cat, [t])})
            block.clear()

    def flush_table():
        if len(table) >= 3:
            header = [clean(c) for c in table[0].strip("|").split("|")]
            for row in table[2:]:
                cells = [clean(c) for c in row.strip("|").split("|")]
                facts = [f"{h}: {c}" for h, c in zip(header[1:], cells[1:]) if c and c not in ("—", "-")]
                if cells[0]:
                    cat = category(heads[2] or heads[1] or heads[0])
                    subject = f"출처 {cells[0]}" if re.fullmatch(r"[①-⑳]", cells[0]) else cells[0][:40]
                    out.append({"title": subject, "section": cat, "text": entry(subject, cat, facts)})
        table.clear()

    for line in lines:
        s = line.strip()
        m = re.match(r"^(#{1,3})\s+(.*)", s)
        if m:
            flush_block(); flush_table()
            lvl = len(m.group(1)) - 1
            heads[lvl] = clean(m.group(2))
            for i in range(lvl + 1, 3):
                heads[i] = ""
            continue
        if s.startswith("|"):
            flush_block()
            table.append(s)
            continue
        flush_table()
        if not s or s.startswith(">") and not block:
            flush_block()
            continue
        # 에피소드 줄거리처럼 굵은 소제목으로 시작하는 줄은 새 문단
        if re.match(r"^\*\*[^*]+\*\*$", s):
            flush_block()
        block.append(s.lstrip("-* ").strip() if s.startswith(("- ", "* ")) else s)
    flush_block(); flush_table()

    for i, c in enumerate(out):
        c.update(id=f"{topic}-doc-{i:03d}", topic=topic, kind="doc", group=f"{topic}-doc")
    return out


def graph_chunks(topic, path):
    g = json.loads(path.read_text(encoding="utf-8"))
    nodes = {n["id"]: n for n in g["nodes"]}
    outgoing, incoming = {}, {}
    for e in g["edges"]:
        outgoing.setdefault(e["source"], []).append(e)
        incoming.setdefault(e["target"], []).append(e)
    out = []
    for n in g["nodes"]:
        cls_desc = g["classes"].get(n["cls"], n["cls"])
        facts = []
        if "caffeine_min" in n:
            facts.append(f"카페인(%): {n['caffeine_min']}~{n.get('caffeine_max', '')}")
        for k, v in n.items():
            if k in ATTR_KO and str(v) != "":
                facts.append(f"{ATTR_KO[k]}: {VALUE_KO.get(v, v) if isinstance(v, (str, bool)) else v}")
        # 관계는 항목별로 묶는다. 이행적으로 유도한 계보·배전도 간선은 목록이 길어지므로 뺀다
        grouped = {}
        lab = lambda i: nodes.get(i, {}).get("label", i)
        for e in outgoing.get(n["id"], []):
            if not (e.get("derived") and e["rel"] in TRANSITIVE):
                grouped.setdefault(REL_KO.get(e["rel"], (e["rel"],))[0], []).append(lab(e["target"]))
        for e in incoming.get(n["id"], []):
            if not (e.get("derived") and e["rel"] in TRANSITIVE):
                grouped.setdefault(REL_KO.get(e["rel"], ("", e["rel"]))[1], []).append(lab(e["source"]))
        facts += [f"{k}: {', '.join(dict.fromkeys(v))}" for k, v in grouped.items()]
        text = entry(n["label"], cls_desc, facts)
        if len(text) > MAX_CHARS:
            text = text[:MAX_CHARS].rsplit(".", 1)[0] + ". …"
        out.append({"id": f"{topic}-node-{n['id']}", "topic": topic, "kind": "node", "group": f"{topic}-node",
                    "title": n["label"], "section": cls_desc, "cls": n["cls"], "node_id": n["id"], "text": text})
    return out


def main():
    chunks = []
    for topic, p in DOCS:
        chunks += doc_chunks(topic, p)
    for topic, p in GRAPHS:
        chunks += graph_chunks(topic, p)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(chunks, ensure_ascii=False, indent=0), encoding="utf-8")
    from collections import Counter
    print(len(chunks), "chunks", dict(Counter(c["group"] for c in chunks)))
    print("max len", max(len(c["text"]) for c in chunks))


if __name__ == "__main__":
    main()
