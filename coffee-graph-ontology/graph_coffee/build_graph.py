#!/usr/bin/env python3
"""Coffee_원두_로스팅_원산지_블렌딩.md의 내용을 지식 그래프로 변환하고 온톨로지 규칙을 적용한다.

실행: python3 build_graph.py   (graph.json / nodes.csv / edges.csv /
validation_report.md / graph.html 을 이 폴더에 생성)
"""
import csv
import json
import os
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))

CLASSES = {
    "Technique": "기술 분야(가공·로스팅·블렌딩)",
    "Species": "커피 종", "Variety": "품종",
    "Continent": "대륙·권역", "Country": "국가", "Region": "산지(지역)",
    "Process": "가공 방식", "RoastStage": "로스팅 단계", "RoastLevel": "배전도",
    "Equipment": "로스터 장비", "BlendMethod": "블렌딩 방법", "Blend": "블렌드",
    "Flavor": "풍미·특성",
}
PLACE = ("Continent", "Country", "Region")
# 관계: (도메인, 레인지, 성질, 역관계)
RELATIONS = {
    "belongsTo": (("Variety",), ("Species",), "", None),
    "mutationOf": (("Variety",), ("Variety",), "", None),
    "selectedFrom": (("Variety",), ("Variety",), "", None),
    "crossOf": (("Variety",), ("Variety",), "", None),
    "descendsFrom": (("Variety",), ("Variety",), "derived", None),
    "originatesIn": (("Variety", "Process"), PLACE, "", None),
    "grownIn": (("Variety", "Species"), PLACE, "", None),
    "produces": (("Country",), ("Species",), "", None),
    "mainlyProducedIn": (("Species",), ("Continent",), "", None),
    "locatedIn": (("Country", "Region"), ("Country", "Continent"), "", None),
    "usesProcess": (PLACE, ("Process",), "", None),
    "partOf": (("Process", "RoastStage", "RoastLevel", "Equipment", "BlendMethod"), ("Technique",), "", None),
    "nextStage": (("RoastStage",), ("RoastStage",), "", None),
    "darkerThan": (("RoastLevel",), ("RoastLevel",), "derived", None),
    "reachedAfter": (("RoastLevel",), ("RoastStage",), "derived", None),
    "increases": (("Process", "RoastLevel"), ("Flavor",), "", None),
    "decreases": (("Process", "RoastLevel"), ("Flavor",), "", None),
    "emphasizes": (("RoastLevel", "Region", "Variety", "Process", "Blend"), ("Flavor",), "", None),
    "hasComponent": (("Blend",), ("Variety", "Region", "Continent"), "", None),
    "usesMethod": (("Blend",), ("BlendMethod",), "", None),
    "contrastsWith": (("BlendMethod",), ("BlendMethod",), "symmetric", None),
}
CONFIDENCE = ("confirmed", "claimed", "inferred")
SRC = {"1": "Wikipedia Coffee bean", "2": "Wikipedia List of coffee varieties",
       "3": "Wikipedia Coffee production", "4": "Wikipedia Coffee roasting",
       "5": "Wikipedia Coffee production in Indonesia", "6": "Wikipedia Espresso",
       "7": "웹 검색 요약(업계 자료)"}

nodes, edges = {}, []


def node(nid, cls, label, **a):
    assert nid not in nodes, nid
    nodes[nid] = dict(id=nid, cls=cls, label=label, **a)


def E(s, rel, d, src, conf="confirmed", **x):
    edges.append(dict(source=s, rel=rel, target=d, confidence=conf, src=src, derived=False, **x))


# ------------------------------------------------------------ 기술 분야
for k, v in [("process", "가공"), ("roasting", "로스팅"), ("blending", "블렌딩")]:
    node("T_" + k, "Technique", v)

# ------------------------------------------------------------ 종
node("SP_arabica", "Species", "아라비카 (C. arabica)", share_pct=60, caffeine_min=0.8, caffeine_max=1.4,
     temp_c="15-24", cga_mg_g=65)
node("SP_robusta", "Species", "로부스타 (C. canephora)", share_pct=40, caffeine_min=1.7, caffeine_max=4.0,
     temp_c="24-30", cga_mg_g=140)
node("SP_liberica", "Species", "리베리카 (C. liberica)")
node("SP_racemosa", "Species", "라세모사 (C. racemosa)")

# ------------------------------------------------------------ 장소
for k, v in [("latam", "중남미"), ("asia", "아시아"), ("africa", "아프리카"), ("europe", "유럽"),
             ("oceania", "오세아니아"), ("namerica", "북미")]:
    node("CT_" + k, "Continent", v)
COUNTRIES = {  # id: (이름, 대륙)
    "brazil": ("브라질", "latam"), "colombia": ("콜롬비아", "latam"), "honduras": ("온두라스", "latam"),
    "mexico": ("멕시코", "latam"), "nicaragua": ("니카라과", "latam"), "guatemala": ("과테말라", "latam"),
    "elsalvador": ("엘살바도르", "latam"), "costarica": ("코스타리카", "latam"), "panama": ("파나마", "latam"),
    "peru": ("페루", "latam"), "jamaica": ("자메이카", "latam"),
    "vietnam": ("베트남", "asia"), "india": ("인도", "asia"), "indonesia": ("인도네시아", "asia"),
    "yemen": ("예멘", "asia"), "china": ("중국", "asia"), "timor": ("동티모르(티모르)", "asia"),
    "ethiopia": ("에티오피아", "africa"), "uganda": ("우간다", "africa"), "kenya": ("케냐", "africa"),
    "rwanda": ("르완다", "africa"), "tanzania": ("탄자니아", "africa"), "cameroon": ("카메룬", "africa"),
    "ivorycoast": ("코트디부아르", "africa"), "ghana": ("가나", "africa"), "madagascar": ("마다가스카르", "africa"),
    "portugal": ("포르투갈", "europe"), "france": ("프랑스", "europe"), "usa": ("미국", "namerica"),
}
for k, (v, c) in COUNTRIES.items():
    node("CO_" + k, "Country", v)
    E("CO_" + k, "locatedIn", "CT_" + c, "3")
REGIONS = {  # id: (이름, 국가, 출처)
    "mandheling": ("만델링 (수마트라)", "indonesia", "5"), "java": ("자바 이젠 고원", "indonesia", "5"),
    "toraja": ("토라자 (술라웨시)", "indonesia", "5"), "kintamani": ("킨타마니 (발리)", "indonesia", "5"),
    "sumatra_low": ("수마트라 저지대", "indonesia", "5"), "bahia": ("바이아", "brazil", "2"),
    "hawaii": ("하와이 빅아일랜드", "usa", "2"), "reunion": ("레위니옹", "france", "2"),
    "yirgacheffe": ("예가체프", "ethiopia", "2"), "sidamo": ("시다모", "ethiopia", "2"),
    "harar": ("하라르", "ethiopia", "2"), "malabar": ("말라바르 해안", "india", "3"),
    "campinas": ("캄피나스 (IAC)", "brazil", "3"), "mocha_port": ("모카 항", "yemen", "3"),
}
for k, (v, c, s) in REGIONS.items():
    node("R_" + k, "Region", v)
    E("R_" + k, "locatedIn", "CO_" + c, s)

# ------------------------------------------------------------ 종 × 생산국 (③)
for c, sp, rank in [("brazil", "arabica", 1), ("colombia", "arabica", 2), ("ethiopia", "arabica", 3),
                    ("honduras", "arabica", 4), ("vietnam", "robusta", 1), ("brazil", "robusta", 2),
                    ("indonesia", "robusta", 3), ("india", "robusta", 4)]:
    E("CO_" + c, "produces", "SP_" + sp, "3", rank=rank)
for c in ("vietnam", "india", "indonesia", "uganda"):
    E("CO_" + c, "produces", "SP_arabica", "3")
E("CO_uganda", "produces", "SP_robusta", "3")
for c in ("mexico", "nicaragua", "guatemala"):
    E("CO_" + c, "produces", "SP_arabica", "3")
    E("CO_" + c, "produces", "SP_robusta", "3", note="최근 재배 시작")
for c in ("cameroon", "ivorycoast", "ghana", "madagascar"):
    E("CO_" + c, "produces", "SP_robusta", "3", conf="claimed", note="재배 부활 시도")
E("SP_arabica", "mainlyProducedIn", "CT_latam", "3")
E("SP_robusta", "mainlyProducedIn", "CT_asia", "3")
E("SP_arabica", "grownIn", "CT_africa", "3", note="주로 동부")
E("SP_robusta", "grownIn", "CT_africa", "3", note="동부·서부")
E("SP_robusta", "grownIn", "R_sumatra_low", "5")

# ------------------------------------------------------------ 품종 (②)
V = {
    "typica": "티피카", "bourbon": "버번", "caturra": "카투라", "mundonovo": "문도 노보",
    "catuai": "카투아이", "geisha": "게이샤", "sl28": "SL28", "sl34": "SL34", "pacas": "파카스",
    "maragogipe": "마라고지페", "pacamara": "파카마라", "villasarchi": "비야 사르치", "kent": "켄트",
    "s795": "S795", "s288": "S.288", "timor": "티모르 하이브리드", "catimor": "카티모르",
    "sarchimor": "사르치모르", "heirloom": "에티오피아 토착종 (하라르·시다모·예가체프)",
    "kona": "코나", "bluemountain": "블루마운틴", "javastyle": "자바 (지역 스타일)", "mocha": "모카",
    "tanzania_dr": "탄자니아 가뭄 저항 품종", "frenchmission": "프렌치 미션", "criollo": "크리올로",
    "robusta_v": "로부스타 (재배종)",
}
for k, v in V.items():
    node("V_" + k, "Variety", v)
nodes["V_geisha"]["note"] = "경매 최고가 US$803/lb (2018)"
nodes["V_bourbon"]["note"] = "티피카보다 열매 20~30% 많음"
nodes["V_caturra"]["note"] = "키 작고 수확량↑, 컵 품질↓"
nodes["V_timor"]["interspecific"] = True
nodes["V_javastyle"]["interspecific"] = True
nodes["V_catimor"]["interspecific"] = True   # ②: Interspecific
nodes["V_sarchimor"]["interspecific"] = True
nodes["V_javastyle"]["note"] = "단일 품종이 아닌 지역 스타일(②)"

# 명시된 종 (나머지는 규칙 R4로 계보에서 도출)
for k in ("typica", "bourbon", "geisha", "sl28", "sl34", "heirloom", "mocha", "kent", "s288",
          "tanzania_dr", "frenchmission"):
    E("V_" + k, "belongsTo", "SP_arabica", "2",
      conf="confirmed" if k not in ("s288", "tanzania_dr", "frenchmission") else "inferred")
E("V_timor", "belongsTo", "SP_arabica", "2")
E("V_timor", "belongsTo", "SP_robusta", "2")
E("V_javastyle", "belongsTo", "SP_arabica", "2", conf="claimed")
E("V_javastyle", "belongsTo", "SP_robusta", "2", conf="claimed")
E("V_robusta_v", "belongsTo", "SP_robusta", "2")

# 계보
for child, parent in [("caturra", "bourbon"), ("pacas", "bourbon"), ("villasarchi", "bourbon"),
                      ("maragogipe", "typica"), ("kona", "typica"), ("bluemountain", "typica"),
                      ("kent", "typica"), ("criollo", "typica")]:
    E("V_" + child, "mutationOf", "V_" + parent, "2")
for child, parent in [("sl28", "tanzania_dr"), ("sl34", "frenchmission")]:
    E("V_" + child, "selectedFrom", "V_" + parent, "2")
for child, (a, b) in {"mundonovo": ("bourbon", "typica"), "catuai": ("mundonovo", "caturra"),
                      "pacamara": ("pacas", "maragogipe"), "catimor": ("timor", "caturra"),
                      "sarchimor": ("villasarchi", "timor"), "s795": ("kent", "s288")}.items():
    E("V_" + child, "crossOf", "V_" + a, "2")
    E("V_" + child, "crossOf", "V_" + b, "2")

# 기원·재배지
for v, p in [("typica", "CO_yemen"), ("pacas", "CO_elsalvador"), ("pacamara", "CO_elsalvador"),
             ("catuai", "CO_brazil"), ("maragogipe", "R_bahia"), ("timor", "CO_timor"),
             ("catimor", "CO_portugal"), ("mocha", "R_mocha_port"), ("heirloom", "CO_ethiopia")]:
    E("V_" + v, "originatesIn", p, "2")
GROWN = {
    "typica": [], "bourbon": ["R_reunion", "CO_rwanda", "CT_latam"], "caturra": ["CT_latam"],
    "catuai": ["CT_latam"], "mundonovo": ["CT_latam"],
    "geisha": ["CO_ethiopia", "CO_panama", "CO_colombia", "CO_peru"], "sl28": ["CO_kenya"],
    "sl34": ["CO_kenya"], "pacas": ["CO_elsalvador"], "pacamara": ["CO_elsalvador"],
    "maragogipe": ["R_bahia"], "villasarchi": ["CO_costarica"], "kent": ["CO_india", "CO_indonesia"],
    "s795": ["CO_india", "CO_indonesia"], "timor": ["CO_timor", "CO_indonesia"],
    "catimor": ["CT_latam", "CO_indonesia", "CO_india", "CO_vietnam", "CO_china"],
    "sarchimor": ["CO_costarica", "CO_india"],
    "heirloom": ["R_harar", "R_sidamo", "R_yirgacheffe"], "kona": ["R_hawaii"],
    "bluemountain": ["CO_jamaica", "CO_kenya", "R_hawaii"], "javastyle": ["CO_indonesia"],
    "mocha": ["CO_yemen"], "robusta_v": ["CO_vietnam"],
}
for v, ps in GROWN.items():
    for p in ps:
        E("V_" + v, "grownIn", p, "2")

# ------------------------------------------------------------ 풍미·특성
for k, v in [("acidity", "산미"), ("body", "바디"), ("sweet", "단맛"), ("origin", "원산지 특성"),
             ("roast", "로스팅 풍미"), ("caramel", "캐러멜"), ("burnt", "탄 맛"),
             ("bittersweet", "쌉싸름한 단맛"), ("grassy", "풀 냄새"), ("fruity", "과일향"),
             ("cocoa", "코코아·흙·담배·삼나무"), ("spice", "견과·향신료"), ("citrus", "시트러스"),
             ("floral", "꽃향"), ("chocolate", "다크 초콜릿·흙"), ("mild", "순하고 단 여운"),
             ("mochanote", "모카 같은 풍미")]:
    node("F_" + k, "Flavor", v)
E("R_mandheling", "emphasizes", "F_cocoa", "5")
E("R_toraja", "emphasizes", "F_spice", "5")
E("R_kintamani", "emphasizes", "F_citrus", "5")
E("R_java", "emphasizes", "F_body", "5")
E("V_heirloom", "emphasizes", "F_fruity", "2", note="하라르")
E("V_s795", "emphasizes", "F_mochanote", "2")

# ------------------------------------------------------------ 가공 (①③⑤)
P = {"washed": "워시드 (습식)", "natural": "내추럴 (건식)", "honey": "허니 (펄프드 내추럴)",
     "wethulled": "웻헐링 (기링 바사)", "civet": "코피 루왁 (사향고양이)", "monsoon": "몬순 처리",
     "aging": "숙성 (Old Java)"}
for k, v in P.items():
    node("P_" + k, "Process", v)
    E("P_" + k, "partOf", "T_process", "1")
E("CT_latam", "usesProcess", "P_washed", "1", note="중미, 역사적")
E("CO_brazil", "usesProcess", "P_natural", "1", note="역사적")
E("CT_africa", "usesProcess", "P_natural", "1", note="아프리카 대부분, 역사적")
E("R_kintamani", "usesProcess", "P_washed", "5")
E("R_mandheling", "usesProcess", "P_wethulled", "3")
E("CO_indonesia", "usesProcess", "P_wethulled", "5")
E("CO_indonesia", "usesProcess", "P_civet", "5")
E("R_malabar", "usesProcess", "P_monsoon", "3")
E("R_java", "usesProcess", "P_aging", "5")
E("P_honey", "originatesIn", "R_campinas", "3")
E("P_wethulled", "decreases", "F_acidity", "5")
E("P_wethulled", "increases", "F_body", "5")
E("P_civet", "emphasizes", "F_mild", "5")
nodes["P_washed"]["note"] = "과육 제거 → 약 2일 수중 발효 → 점액질 세척. 역사적으로 중미·아프리카 일부"
nodes["P_natural"]["note"] = "체리째 2~3주 햇볕 건조. 역사적으로 브라질·아프리카 대부분"

# ------------------------------------------------------------ 로스팅 (④)
STAGES = [("drying", "건조 (옐로잉)", 175), ("browning", "갈변 (마이야르·캐러멜화)", None),
          ("expansion", "팽창", None), ("first", "1차 크랙", 196), ("second", "2차 크랙", 224),
          ("cooling", "냉각", None)]
for i, (k, v, t) in enumerate(STAGES):
    node("RS_" + k, "RoastStage", v, order=i + 1, **({"temp_c": t} if t else {}))
    E("RS_" + k, "partOf", "T_roasting", "4")
    if i:
        E("RS_" + STAGES[i - 1][0], "nextStage", "RS_" + k, "4")
LEVELS = [("cinnamon", "시나몬", "light", 196, ["acidity", "grassy"], []),
          ("newengland", "뉴잉글랜드", "light", 205, ["origin", "acidity"], []),
          ("american", "아메리칸", "medium", 210, ["origin"], ["acidity"]),
          ("city", "시티", "medium", 219, ["origin"], []),
          ("fullcity", "풀 시티", "dark", 225, ["roast", "body"], []),
          ("vienna", "비엔나", "dark", 230, ["bittersweet", "caramel"], ["acidity"]),
          ("french", "프렌치", "dark", 240, ["caramel"], ["origin"]),
          ("italian", "이탈리안", "dark", 245, ["burnt"], ["acidity", "body"])]
for k, v, cat, t, emph, dec in LEVELS:
    node("RL_" + k, "RoastLevel", v, category=cat, temp_c=t)
    E("RL_" + k, "partOf", "T_roasting", "4")
    for f in emph:
        E("RL_" + k, "emphasizes", "F_" + f, "4")
    for f in dec:
        E("RL_" + k, "decreases", "F_" + f, "4")
nodes["RL_city"]["note"] = "스페셜티 커피에서 흔한 배전도"
for k, v in [("drum", "드럼 로스터"), ("hotair", "열풍(유동층) 로스터"), ("packed", "패킹 베드 로스터"),
             ("tangential", "탄젠셜 로스터"), ("centrifugal", "원심식 로스터")]:
    node("EQ_" + k, "Equipment", v)
    E("EQ_" + k, "partOf", "T_roasting", "4")
nodes["EQ_drum"]["note"] = "수평 회전 드럼, 대부분 간접 가열"

# ------------------------------------------------------------ 블렌딩 (⑤⑦)
node("BM_pre", "BlendMethod", "선블렌딩 (Pre-roast)", pros="효율, 색 균일성", cons="밀도·크기 차이로 불균일 배전")
node("BM_post", "BlendMethod", "후블렌딩 (Post-roast)", pros="성분 비율 조정·교체 쉬움, 스페셜티 선호", cons="(출처에 없음)")
for k in ("pre", "post"):
    E("BM_" + k, "partOf", "T_blending", "7", conf="claimed")
E("BM_pre", "contrastsWith", "BM_post", "7", conf="claimed")
node("B_mochajava", "Blend", "모카 자바 (전통)")
node("B_mochajava_modern", "Blend", "모카 자바 (현대 변형)")
E("B_mochajava", "hasComponent", "V_mocha", "5")
E("B_mochajava", "hasComponent", "V_javastyle", "5")
E("B_mochajava_modern", "hasComponent", "CT_africa", "7", conf="claimed", note="동아프리카 원두")
E("B_mochajava_modern", "hasComponent", "R_kintamani", "7", conf="claimed", note="한 로스터: 발리 원두")
E("B_mochajava_modern", "usesMethod", "BM_post", "7", conf="claimed")
E("B_mochajava_modern", "emphasizes", "F_floral", "7", conf="claimed")
E("B_mochajava_modern", "emphasizes", "F_chocolate", "7", conf="claimed")

# ------------------------------------------------------------ 원산지 이미지 (fetch_origin_images.py가 만든 캐시)
_img_path = os.path.join(HERE, "origin_images.json")
if os.path.exists(_img_path):
    with open(_img_path, encoding="utf-8") as f:
        for nid, im in json.load(f).items():
            if nid not in nodes:
                continue
            title = im.get("wiki_title", "")
            coffee = title.startswith(("Coffee production", "Kona coffee", "Monsooned Malabar", "Instituto Agronômico"))
            nodes[nid].update({
                "image": im["image"].split("?")[0], "image_file": im.get("image_file", ""),
                "image_source": "Wikipedia · " + title, "image_kind": "coffee" if coffee else "general",
                "wiki_url": im.get("wiki_url", ""),
            })

# ------------------------------------------------------------ 규칙: 추론
log = defaultdict(int)


def add(s, rel, d, rule, **x):
    if any(e["source"] == s and e["rel"] == rel and e["target"] == d for e in edges):
        return False
    edges.append(dict(source=s, rel=rel, target=d, confidence="inferred", src="derived",
                      derived=True, rule=rule, **x))
    log[rule] += 1
    return True


def asserted(rel):
    return [(e["source"], e["target"]) for e in edges if e["rel"] == rel and not e["derived"]]


# R3 대칭
for rel, (_, _, prop, _) in RELATIONS.items():
    if prop == "symmetric":
        for s, d in asserted(rel):
            add(d, rel, s, "R3 대칭(%s)" % rel)

# R4 종 상속: 돌연변이·선발 품종은 부모의 종을, 교배종은 두 부모의 종 합집합을 물려받는다
parents = defaultdict(set)
for rel in ("mutationOf", "selectedFrom", "crossOf"):
    for s, d in asserted(rel):
        parents[s].add(d)


def species_of(v):
    return {e["target"] for e in edges if e["rel"] == "belongsTo" and e["source"] == v}


changed = True
while changed:
    changed = False
    for v, ps in parents.items():
        for p in ps:
            for sp in species_of(p):
                if add(v, "belongsTo", sp, "R4 계보로 종 상속"):
                    changed = True

# R5 계보 이행: descendsFrom = (mutationOf ∪ selectedFrom ∪ crossOf)+
for v in list(parents):
    stack, seen = list(parents[v]), set()
    while stack:
        p = stack.pop()
        if p in seen:
            continue
        seen.add(p)
        add(v, "descendsFrom", p, "R5 계보 이행(descendsFrom)")
        stack.extend(parents.get(p, ()))

# R6 지리 상향: 지역에서 재배·가공되면 그 지역이 속한 국가에서도 재배·가공된다
loc = dict(asserted("locatedIn"))
for s, d in asserted("grownIn"):
    if nodes[d]["cls"] == "Region":
        add(s, "grownIn", loc[d], "R6 지역 → 국가 상향(grownIn)")
for s, d in asserted("usesProcess"):
    if nodes[s]["cls"] == "Region":
        add(loc[s], "usesProcess", d, "R6 지역 → 국가 상향(usesProcess)")

# R7 배전도 순서: 온도가 높은 배전도가 더 진하다 (인접한 단계만 연결)
lv = sorted([n for n in nodes.values() if n["cls"] == "RoastLevel"], key=lambda n: n["temp_c"])
for a, b in zip(lv, lv[1:]):
    add(b["id"], "darkerThan", a["id"], "R7 온도 순 배전도 순서(darkerThan)")
# R8 배전도는 자신의 온도 이하의 크랙 단계를 지난다
for n in lv:
    for st in [s for s in nodes.values() if s["cls"] == "RoastStage" and s.get("temp_c")]:
        if n["temp_c"] >= st["temp_c"]:
            add(n["id"], "reachedAfter", st["id"], "R8 온도 기준 단계 도달(reachedAfter)")

# R9 품종 재배국은 그 품종의 종을 생산한다
for s, d in [(e["source"], e["target"]) for e in edges if e["rel"] == "grownIn" and nodes[e["source"]]["cls"] == "Variety"]:
    if nodes[d]["cls"] != "Country" or nodes[s].get("interspecific"):
        continue
    for sp in species_of(s):
        add(d, "produces", sp, "R9 재배 품종 ⇒ 국가의 종 생산")

# ------------------------------------------------------------ 규칙: 검증
viol, checks = [], []


def check(rule, desc, bad):
    checks.append((rule, desc, len(bad)))
    viol.extend((rule, b) for b in bad)


bad = []
for e in edges:
    s, d = nodes.get(e["source"]), nodes.get(e["target"])
    if not s or not d or e["rel"] not in RELATIONS:
        bad.append("정의되지 않은 노드/관계: %s -%s-> %s" % (e["source"], e["rel"], e["target"]))
        continue
    dom, ran, _, _ = RELATIONS[e["rel"]]
    if s["cls"] not in dom or d["cls"] not in ran:
        bad.append("%s(%s) -%s-> %s(%s)" % (s["label"], s["cls"], e["rel"], d["label"], d["cls"]))
check("R1", "관계의 도메인/레인지 클래스 일치", bad)
check("R2", "모든 간선에 confidence가 있고 직접 변환 간선은 출처(①~⑦)가 있음",
      [e["rel"] for e in edges if e["confidence"] not in CONFIDENCE or (not e["derived"] and e["src"] not in SRC)])
check("R10", "모든 품종은 종이 하나 이상 결정됨(직접 또는 R4)",
      [n["label"] for n in nodes.values() if n["cls"] == "Variety" and not species_of(n["id"])])
check("R11", "종이 둘 이상인 품종은 interspecific(종간 교잡)으로 표시됨",
      [n["label"] for n in nodes.values() if n["cls"] == "Variety" and len(species_of(n["id"])) > 1
       and not n.get("interspecific")])
cross = defaultdict(int)
for s, _ in asserted("crossOf"):
    cross[s] += 1
check("R12", "교배종(crossOf)은 부모가 정확히 2개", [nodes[k]["label"] for k, v in cross.items() if v != 2])
check("R13", "품종 계보에 순환이 없음 (자기 자신의 후손이 아님)",
      [nodes[e["source"]]["label"] for e in edges if e["rel"] == "descendsFrom" and e["source"] == e["target"]])
check("R14", "지역(Region)은 정확히 하나의 국가에 속하고, 국가는 하나의 대륙에 속함",
      [n["label"] for n in nodes.values() if n["cls"] in ("Region", "Country")
       and len([1 for s, _ in asserted("locatedIn") if s == n["id"]]) != 1])
order = {"light": 0, "medium": 1, "dark": 2}
bad = [f"{a['label']}({a['category']},{a['temp_c']}) → {b['label']}({b['category']},{b['temp_c']})"
       for a, b in zip(lv, lv[1:]) if order[a["category"]] > order[b["category"]] or a["temp_c"] == b["temp_c"]]
check("R15", "배전도 온도가 서로 다르고, 온도 순서가 라이트 < 미디엄 < 다크 구분과 일치", bad)
bad = []
st = sorted([n for n in nodes.values() if n["cls"] == "RoastStage"], key=lambda n: n["order"])
temps = [n["temp_c"] for n in st if n.get("temp_c")]
if temps != sorted(temps):
    bad.append("단계 순서와 온도 순서 불일치")
check("R16", "로스팅 단계의 순서(nextStage)와 온도가 일치", bad)
a, r = nodes["SP_arabica"], nodes["SP_robusta"]
bad = []
if a["share_pct"] + r["share_pct"] > 100:
    bad.append("아라비카+로부스타 비중 > 100%")
if not a["caffeine_max"] < r["caffeine_min"]:
    bad.append("아라비카 카페인 범위가 로부스타와 겹침")
if not a["cga_mg_g"] < r["cga_mg_g"]:
    bad.append("클로로젠산: 아라비카 ≥ 로부스타")
check("R17", "종 수치 일관성: 생산 비중 합 ≤ 100%, 카페인·클로로젠산 아라비카 < 로부스타", bad)
check("R18", "블렌드는 구성 요소가 2개 이상",
      [n["label"] for n in nodes.values() if n["cls"] == "Blend"
       and len([1 for s, _ in asserted("hasComponent") if s == n["id"]]) < 2])
bad = []
for s, d in asserted("increases"):
    if (s, d) in set(asserted("decreases")):
        bad.append("%s가 %s를 동시에 증가·감소" % (nodes[s]["label"], nodes[d]["label"]))
check("R19", "같은 대상이 같은 풍미를 동시에 increases·decreases 하지 않음", bad)
check("R20", "자기 참조 간선 없음", [e["rel"] for e in edges if e["source"] == e["target"]])

# ------------------------------------------------------------ 출력
out_nodes = list(nodes.values())
with open(os.path.join(HERE, "graph.json"), "w", encoding="utf-8") as f:
    json.dump({"classes": CLASSES,
               "relations": {k: {"domain": v[0], "range": v[1], "property": v[2], "inverse": v[3]}
                             for k, v in RELATIONS.items()},
               "nodes": out_nodes, "edges": edges}, f, ensure_ascii=False, indent=1)
with open(os.path.join(HERE, "nodes.csv"), "w", encoding="utf-8", newline="") as f:
    w = csv.writer(f)
    w.writerow(["id", "class", "label", "attrs"])
    for n in out_nodes:
        w.writerow([n["id"], n["cls"], n["label"],
                    json.dumps({k: v for k, v in n.items() if k not in ("id", "cls", "label")}, ensure_ascii=False)])
with open(os.path.join(HERE, "edges.csv"), "w", encoding="utf-8", newline="") as f:
    w = csv.writer(f)
    w.writerow(["source", "relation", "target", "confidence", "source_doc", "derived", "rule", "note"])
    for e in edges:
        w.writerow([e["source"], e["rel"], e["target"], e["confidence"], SRC.get(e["src"], ""),
                    e["derived"], e.get("rule", ""), e.get("note", "")])

na = len([e for e in edges if not e["derived"]])
bc = defaultdict(int)
for n in out_nodes:
    bc[n["cls"]] += 1
with open(os.path.join(HERE, "validation_report.md"), "w", encoding="utf-8") as f:
    f.write("# 온톨로지 규칙 검증 보고서 — 커피\n\n")
    f.write("- 노드 %d개 (%s)\n" % (len(out_nodes), ", ".join("%s %d" % kv for kv in bc.items())))
    f.write("- 간선 %d개 = 문서에서 직접 변환 %d + 규칙으로 도출 %d\n\n" % (len(edges), na, len(edges) - na))
    f.write("## 검증 결과\n\n| 규칙 | 내용 | 위반 |\n|---|---|---|\n")
    for r_, d_, n_ in checks:
        f.write("| %s | %s | %d |\n" % (r_, d_, n_))
    f.write("\n## 위반 목록\n\n" + ("\n".join("- %s: %s" % v for v in viol) if viol else "없음") + "\n")
    f.write("\n## 규칙별 도출 간선 수\n\n| 규칙 | 간선 수 |\n|---|---|\n")
    for r_, n_ in sorted(log.items()):
        f.write("| %s | %d |\n" % (r_, n_))
    f.write("\n## 데이터 완결성 경고\n\n- 블렌딩 방법·현대 모카 자바는 웹 검색 요약(⑦)만 근거라 `claimed`\n"
            "- 워시드·내추럴·허니 가공의 풍미 영향은 출처에 없어 간선 없음\n"
            "- `inferred`/`claimed` 간선은 시각화에서 점선\n")

with open(os.path.join(HERE, "graph.json"), encoding="utf-8") as f:
    payload = f.read()
with open(os.path.join(HERE, "graph_template.html"), encoding="utf-8") as f:
    html = f.read().replace("/*__DATA__*/", payload.replace("</", "<\\/"))
# WebMCP: 공통 조회 도구(tools_core.js)와 온톨로지 문서를 페이지에 넣는다
with open(os.path.join(HERE, "tools_core.js"), encoding="utf-8") as f:
    core_js = f.read().replace("export function createGraphTools", "function createGraphTools", 1)
with open(os.path.join(HERE, "ontology.md"), encoding="utf-8") as f:
    _onto = f.read()
with open(os.path.join(HERE, "validation_report.md"), encoding="utf-8") as f:
    _rep = f.read()
meta = json.dumps({"ontology": _onto, "report": _rep, "sources": SRC}, ensure_ascii=False)
html = html.replace("/*__META__*/", meta.replace("</", "<\\/"), 1).replace("/*__CORE__*/", core_js.replace("</", "<\\/"), 1)
with open(os.path.join(HERE, "graph.html"), "w", encoding="utf-8") as f:
    f.write(html)

# 배포 폴더(deploy/)와 MCP 서버 데이터(mcp_data.js) 갱신
import shutil
os.makedirs(os.path.join(HERE, "deploy"), exist_ok=True)
shutil.copyfile(os.path.join(HERE, "graph.html"), os.path.join(HERE, "deploy", "index.html"))
shutil.copyfile(os.path.join(HERE, "connect.html"), os.path.join(HERE, "deploy", "connect.html"))
with open(os.path.join(HERE, "ontology.md"), encoding="utf-8") as f:
    ontology_md = f.read()
with open(os.path.join(HERE, "validation_report.md"), encoding="utf-8") as f:
    report_md = f.read()
with open(os.path.join(HERE, "..", "Coffee_원두_로스팅_원산지_블렌딩.md"), encoding="utf-8") as f:
    summary_md = f.read()
with open(os.path.join(HERE, "mcp_data.js"), "w", encoding="utf-8") as f:
    f.write("// build_graph.py가 생성하는 파일. 직접 고치지 말 것.\nexport default ")
    json.dump({"graph": json.loads(payload), "ontology": ontology_md, "report": report_md,
               "summary": summary_md, "sources": SRC}, f, ensure_ascii=False)
    f.write(";\n")

print("nodes", len(out_nodes), "edges", len(edges), "asserted", na)
for r_, d_, n_ in checks:
    print(r_, "OK" if n_ == 0 else "VIOLATION x%d" % n_, d_)
for v in viol:
    print("  -", v)
