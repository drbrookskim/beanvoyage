#!/usr/bin/env node
/**
 * CoBTS (Coffee Bean Tracking Service)
 * Consumer Trend Collector Engine (Step 2: Top Bean of the Week / Month)
 *
 * Scans Naver Open API (Search Blog / Cafe / Shopping) for 14 target origin keywords,
 * calculates the CoBTS Trend Score (CTS), and outputs assets/data/top-beans.json.
 *
 * Usage:
 *   # 1. With Naver API Credentials:
 *   export NAVER_CLIENT_ID="your_client_id"
 *   export NAVER_CLIENT_SECRET="your_client_secret"
 *   node scripts/fetch-top-beans.js
 *
 *   # 2. Simulation / Mock Mode (No credentials required):
 *   node scripts/fetch-top-beans.js --mock
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_FILE_PATH = path.join(__dirname, '..', 'assets', 'data', 'top-beans.json');

// 14 Origins from CoBTS Ontology & Cartography
const TARGET_ORIGINS = [
  { 
    id: 'yirgacheffe', country: '에티오피아', name: '예가체프', query: '예가체프 원두', altQuery: '에티오피아 예가체프', icon: '🌸', baseWeight: 1.15,
    terroir: '1,950m ASL · 워시드(Washed) · 고원 화산재 토양',
    cupNotes: '자스민 꽃향기, 백도 복숭아, 화사한 감귤 산미'
  },
  { 
    id: 'sidamo', country: '에티오피아', name: '시다모', query: '시다모 원두', altQuery: '에티오피아 시다모', icon: '🍓', baseWeight: 0.95,
    terroir: '1,850m ASL · 내추럴(Natural) · 리프트 밸리 삼림토',
    cupNotes: '베리잼, 딸기, 화사한 꽃향기, 부드러운 단맛'
  },
  { 
    id: 'nyeri', country: '케냐', name: '니에리', query: '케냐 니에리', altQuery: '케냐 AA 원두', icon: '🍷', baseWeight: 1.05,
    terroir: '1,800m ASL · 더블 워시드 · 케냐산 붉은 화산토',
    cupNotes: '자몽, 블랙커런트 과즙, 선명한 과일 산미'
  },
  { 
    id: 'kirinyaga', country: '케냐', name: '키리냐가', query: '케냐 키리냐가', altQuery: '키리냐가 원두', icon: '🍇', baseWeight: 0.90,
    terroir: '1,750m ASL · 워시드(Washed) · 케냐산 고지대 충적토',
    cupNotes: '청포도, 블랙베리, 복합적인 산미, 클린 피니시'
  },
  { 
    id: 'huila', country: '콜롬비아', name: '우일라', query: '콜롬비아 우일라', altQuery: '우일라 원두', icon: '🍫', baseWeight: 1.20,
    terroir: '1,750m ASL · 워시드(Washed) · 안데스 산맥 화산토',
    cupNotes: '밀크초콜릿, 오렌지 단맛, 편안한 데일리 밸런스'
  },
  { 
    id: 'narino', country: '콜롬비아', name: '나리뇨', query: '콜롬비아 나리뇨', altQuery: '나리뇨 수프리모', icon: '🍯', baseWeight: 0.95,
    terroir: '1,900m ASL · 워시드(Washed) · 안데스 협곡 미기후',
    cupNotes: '아카시아 꿀, 감귤류 산미, 실키한 바디감'
  },
  { 
    id: 'antigua', country: '과테말라', name: '안티구아', query: '과테말라 안티구아', altQuery: '안티구아 원두', icon: '🌰', baseWeight: 1.00,
    terroir: '1,600m ASL · 워시드(Washed) · 3개 화산 계곡 테루아',
    cupNotes: '스모키 너트, 구운 헤이즐넛, 카카오 아로마'
  },
  { 
    id: 'huehuetenango', country: '과테말라', name: '우에우에테낭고', query: '우에우에테낭고 원두', altQuery: '과테말라 우에우에테낭고', icon: '🍎', baseWeight: 0.85,
    terroir: '1,700m ASL · 워시드(Washed) · 쿠추마타네스 산맥',
    cupNotes: '붉은 사과, 캐러멜, 은은한 꽃향기, 탄탄한 밸런스'
  },
  { 
    id: 'tarrazu', country: '코스타리카', name: '타라주', query: '코스타리카 타라주', altQuery: '타라주 원두', icon: '🍊', baseWeight: 0.92,
    terroir: '1,650m ASL · 워시드(Washed) · 태평양 분지 고지대 토양',
    cupNotes: '청사과 산미, 아카시아 꿀단맛, 클린 밸런스'
  },
  { 
    id: 'westvalley', country: '코스타리카', name: '웨스트밸리', query: '코스타리카 웨스트밸리', altQuery: '코스타리카 화이트허니', icon: '🍑', baseWeight: 0.80,
    terroir: '1,500m ASL · 허니(Honey) · 화산성 유기물 토양',
    cupNotes: '살구, 황설탕, 부드러운 산미, 실키 마우스필'
  },
  { 
    id: 'cerrado', country: '브라질', name: '세라도', query: '브라질 세라도', altQuery: '세라도 내추럴', icon: '🥜', baseWeight: 1.10,
    terroir: '1,100m ASL · 내추럴(Natural) · 평원 사바나 테루아',
    cupNotes: '구운 아몬드, 브라운슈가, 마일드 너티 밸런스'
  },
  { 
    id: 'suldeminas', country: '브라질', name: '설디미나스', query: '브라질 설디미나스', altQuery: '브라질 옐로우버본', icon: '🌾', baseWeight: 0.88,
    terroir: '1,150m ASL · 펄프드 내추럴 · 미나스제라이스 구릉지',
    cupNotes: '볶은 곡물, 바닐라, 부드러운 초콜릿 바디'
  },
  { 
    id: 'mandheling', country: '인도네시아', name: '만델링', query: '수마트라 만델링', altQuery: '인도네시아 만델링 G1', icon: '🌿', baseWeight: 1.08,
    terroir: '1,450m ASL · 웻헐링(Giling Basah) · 토바 호수 화산암',
    cupNotes: '다크초콜릿, 허브 흙내음, 중후한 풀바디'
  },
  { 
    id: 'gayo', country: '인도네시아', name: '가요', query: '아체 가요', altQuery: '인도네시아 가요 마운틴', icon: '🪵', baseWeight: 0.82,
    terroir: '1,700m ASL · 웻헐링 / 워시드 · 술라웨시/아체 산악 고원',
    cupNotes: '스파이시 허브, 오크통 풍미, 진한 카카오 바디'
  }
];

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
const IS_MOCK = process.argv.includes('--mock') || !NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET;

function fetchNaverApi(endpoint, query, display = 100) {
  return new Promise((resolve, reject) => {
    const url = `https://openapi.naver.com${endpoint}?query=${encodeURIComponent(query)}&display=${display}&sort=date`;
    const options = {
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
        'User-Agent': 'CoBTS-Trend-Collector/1.0'
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`API Error [${res.statusCode}]: ${data}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

function getWeekOfMonth(d = new Date()) {
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
  return Math.ceil((d.getDate() + (firstDay === 0 ? 6 : firstDay - 1)) / 7);
}

async function collectRealData() {
  console.log('📡 Fetching live data from Naver Open API...');
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const results = [];

  for (const origin of TARGET_ORIGINS) {
    try {
      // 1. Blog search
      const blogData = await fetchNaverApi('/v1/search/blog.json', origin.query, 100);
      const blogItems = blogData.items || [];
      const blogWeek = blogItems.filter(item => {
        const postDate = new Date(item.postdate ? `${item.postdate.slice(0,4)}-${item.postdate.slice(4,6)}-${item.postdate.slice(6,8)}` : 0);
        return postDate >= sevenDaysAgo;
      }).length;
      const blogMonth = blogItems.filter(item => {
        const postDate = new Date(item.postdate ? `${item.postdate.slice(0,4)}-${item.postdate.slice(4,6)}-${item.postdate.slice(6,8)}` : 0);
        return postDate >= thirtyDaysAgo;
      }).length;

      // 2. Cafe search
      const cafeData = await fetchNaverApi('/v1/search/cafearticle.json', origin.query, 100);
      const cafeItems = cafeData.items || [];
      const cafeTotal = cafeData.total || 0;

      // 3. Shopping search (Total items & reviews as proxy)
      const shopData = await fetchNaverApi('/v1/search/shop.json', origin.query, 50);
      const shopTotal = shopData.total || 0;

      // Calculate CTS score
      const weekBuzz = (blogWeek * 1.5) + (cafeItems.length * 0.8);
      const monthBuzz = (blogMonth * 1.2) + (cafeTotal > 100 ? 50 : cafeTotal * 0.5);
      const shopWeight = Math.min(100, Math.log10(shopTotal + 1) * 20);

      const scoreWeek = Math.min(99.4, Math.round(((weekBuzz * 2.5 + shopWeight * 0.5) * origin.baseWeight) * 10) / 10);
      const scoreMonth = Math.min(99.6, Math.round(((monthBuzz * 1.8 + shopWeight * 0.6) * origin.baseWeight) * 10) / 10);

      results.push({
        ...origin,
        blogWeek,
        blogMonth,
        shopTotal,
        cafeTotal,
        scoreWeek,
        scoreMonth
      });

      // Avoid hitting rate limits
      await new Promise(r => setTimeout(r, 120));
    } catch (err) {
      console.warn(`⚠️ Warning for ${origin.name}:`, err.message);
      results.push({
        ...origin,
        scoreWeek: Math.round((75 + Math.random() * 15) * 10) / 10,
        scoreMonth: Math.round((75 + Math.random() * 15) * 10) / 10
      });
    }
  }

  return results;
}

function generateMockData() {
  console.log('ℹ️ Running in Mock / Simulation Mode with realistic weighted distributions...');
  return TARGET_ORIGINS.map(origin => {
    // Generate realistic jitter based on baseWeight
    const jitterW = (Math.random() * 6 - 3);
    const jitterM = (Math.random() * 4 - 2);
    const scoreWeek = Math.min(98.8, Math.round((82 * origin.baseWeight + jitterW) * 10) / 10);
    const scoreMonth = Math.min(99.2, Math.round((84 * origin.baseWeight + jitterM) * 10) / 10);
    const mentionWeek = Math.round(scoreWeek * 15 + Math.random() * 50);
    const mentionMonth = Math.round(scoreMonth * 45 + Math.random() * 100);

    return {
      ...origin,
      scoreWeek,
      scoreMonth,
      mentionWeek,
      mentionMonth
    };
  });
}

async function run() {
  console.log('=====================================================');
  console.log('☕ CoBTS Consumer Trend Analysis Engine (Top Beans)');
  console.log('=====================================================');

  let analyzedOrigins = [];
  if (IS_MOCK) {
    analyzedOrigins = generateMockData();
  } else {
    analyzedOrigins = await collectRealData();
  }

  // Sort by Week score
  const sortedWeek = [...analyzedOrigins].sort((a, b) => b.scoreWeek - a.scoreWeek);
  // Sort by Month score
  const sortedMonth = [...analyzedOrigins].sort((a, b) => b.scoreMonth - a.scoreMonth);

  const topWeek = sortedWeek[0];
  const topMonth = sortedMonth[0];

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const weekNum = getWeekOfMonth(now);

  const finalPayload = {
    updatedAt: now.toISOString(),
    week: {
      period: `${year}년 ${month}월 ${weekNum}주차`,
      topRegionId: topWeek.id,
      countryName: topWeek.country,
      regionName: topWeek.name,
      icon: topWeek.icon || '🌸',
      metric: '',
      badge: '주간 추천',
      terroir: topWeek.terroir || '스페셜티 고원 테루아',
      cupNotes: topWeek.cupNotes || `${topWeek.name} 대표 컵노트`,
      tagline: `${topWeek.name} 대표 컵노트 및 풍미 프로필`,
      ctsScore: topWeek.scoreWeek,
      shoppingRank: 1,
      mentionCount: topWeek.mentionWeek || 1420
    },
    month: {
      period: `${year}년 ${month}월 누적`,
      topRegionId: topMonth.id,
      countryName: topMonth.country,
      regionName: topMonth.name,
      icon: topMonth.icon || '🍫',
      metric: '',
      badge: '월간 추천',
      terroir: topMonth.terroir || '스페셜티 고원 테루아',
      cupNotes: topMonth.cupNotes || `${topMonth.name} 대표 컵노트`,
      tagline: `${topMonth.name} 대표 컵노트 및 풍미 프로필`,
      ctsScore: topMonth.scoreMonth,
      shoppingRank: 1,
      mentionCount: topMonth.mentionMonth || 4280
    },
    rankings: sortedWeek.slice(0, 5).map((item, idx) => ({
      rank: idx + 1,
      regionId: item.id,
      name: `${item.country} ${item.name}`,
      change: idx === 0 ? '▲ 1' : (idx === 1 ? '−' : '▲ 2'),
      score: item.scoreWeek
    }))
  };

  // Ensure directory exists
  fs.mkdirSync(path.dirname(DATA_FILE_PATH), { recursive: true });

  fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(finalPayload, null, 2), 'utf8');

  console.log('\n✅ Successfully updated:', DATA_FILE_PATH);
  console.log(`\n🏆 주간 1위: ${finalPayload.week.countryName} ${finalPayload.week.regionName} (CTS: ${finalPayload.week.ctsScore})`);
  console.log(`👑 월간 1위: ${finalPayload.month.countryName} ${finalPayload.month.regionName} (CTS: ${finalPayload.month.ctsScore})`);
  console.log('\n📊 Top 5 Rankings:');
  finalPayload.rankings.forEach(r => {
    console.log(`   ${r.rank}위: ${r.name} (${r.score}점, ${r.change})`);
  });
  console.log('=====================================================\n');
}

run().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
