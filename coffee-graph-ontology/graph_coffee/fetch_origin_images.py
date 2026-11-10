#!/usr/bin/env python3
"""원산지 노드(대륙·국가·산지)의 대표 이미지를 위키백과 REST API(page/summary)에서 받아 origin_images.json에 저장한다.

한 번만 실행하면 되고, build_graph.py는 저장된 파일만 읽는다(빌드 때 네트워크를 쓰지 않음).
국가는 커피 관련 사진이 나오도록 'Coffee production in ○○' 문서를 먼저 찾고, 없으면 국가 문서를 쓴다.
실행: python3 fetch_origin_images.py
"""
import json
import os
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "origin_images.json")
UA = "coffee-graph-builder/1.0 (https://coffee-graph.pages.dev; knowledge-graph thumbnails)"

# 노드 id: 시도할 영어 위키백과 문서 제목 (앞에서부터)
TITLES = {
    "CT_latam": ["Latin America"], "CT_asia": ["Asia"], "CT_africa": ["Africa"], "CT_europe": ["Europe"],
    "CT_oceania": ["Oceania"], "CT_namerica": ["North America"],
    "R_mandheling": ["Mandailing Natal Regency", "Sumatra"], "R_java": ["Ijen", "Java"],
    "R_toraja": ["Tana Toraja Regency", "Toraja"], "R_kintamani": ["Kintamani", "Bali"],
    "R_sumatra_low": ["Sumatra"], "R_bahia": ["Bahia"], "R_hawaii": ["Kona coffee", "Hawaii (island)"],
    "R_reunion": ["Réunion"], "R_yirgacheffe": ["Yirgacheffe"], "R_sidamo": ["Sidama Region", "Sidamo Province"],
    "R_harar": ["Harar"], "R_malabar": ["Monsooned Malabar", "Malabar Coast"],
    "R_campinas": ["Instituto Agronômico de Campinas", "Campinas"], "R_mocha_port": ["Mocha, Yemen"],
}
COUNTRIES = {
    "brazil": "Brazil", "colombia": "Colombia", "honduras": "Honduras", "mexico": "Mexico", "nicaragua": "Nicaragua",
    "guatemala": "Guatemala", "elsalvador": "El Salvador", "costarica": "Costa Rica", "panama": "Panama", "peru": "Peru",
    "jamaica": "Jamaica", "vietnam": "Vietnam", "india": "India", "indonesia": "Indonesia", "yemen": "Yemen",
    "china": "China", "timor": "Timor-Leste", "ethiopia": "Ethiopia", "uganda": "Uganda", "kenya": "Kenya",
    "rwanda": "Rwanda", "tanzania": "Tanzania", "cameroon": "Cameroon", "ivorycoast": "Ivory Coast", "ghana": "Ghana",
    "madagascar": "Madagascar", "portugal": "Portugal", "france": "France", "usa": "United States",
}
for k, name in COUNTRIES.items():
    TITLES["CO_" + k] = [f"Coffee production in {name}", f"Coffee in {name}", name]


def summary(title):
    url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote(title.replace(" ", "_"), safe="")
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.load(r)
    except Exception:
        return None


def main():
    out = {}
    for nid, titles in TITLES.items():
        for t in titles:
            d = summary(t)
            time.sleep(0.25)
            if not d or d.get("type") == "disambiguation" or "thumbnail" not in d:
                continue
            src = d["thumbnail"]["source"]
            fname = urllib.parse.unquote(src.split("/")[-1])
            # 썸네일 URL(…/thumb/a/ab/File.jpg/320px-File.jpg)에서 원본 파일 이름을 뽑는다
            parts = src.split("/")
            if "thumb" in parts:
                fname = urllib.parse.unquote(parts[parts.index("thumb") + 3])
            out[nid] = {
                "image": src,
                "image_file": "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(fname),
                "wiki_title": d.get("title", t),
                "wiki_url": d.get("content_urls", {}).get("desktop", {}).get("page", ""),
                "wiki_desc": d.get("description", ""),
            }
            break
        print(nid, "→", out.get(nid, {}).get("wiki_title", "(이미지 없음)"))
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(len(out), "/", len(TITLES), "saved to", OUT)


if __name__ == "__main__":
    main()
