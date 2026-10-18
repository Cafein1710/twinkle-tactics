// server.js - Twinkle Tactics: Card Derby (Đã chuẩn hóa toàn bộ Cự ly & Giải đấu G1/G2 trong Map Pool)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const {
  addItemToInventory,
  rollRandomGlobalEvent,
  resolveEventChoice,
  useInventoryItem
} = require('./server-events');

const { simulateSixUmaRace } = require('./server-race');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
let UMA_POOL = [];
let SSR_SUPPORT_POOL = [];
let MAP_POOL = [];

// Phân loại cự ly chuẩn Uma Musume theo số mét thực tế
function getCanonicalDistanceType(lengthMeters) {
  const len = Number(lengthMeters) || 2000;
  if (len <= 1400) return 'Sprint';
  if (len <= 1800) return 'Mile';
  if (len <= 2400) return 'Medium';
  return 'Long';
}

// Bảng tra cứu chính xác Giải đấu (Famous Race) và Mùa (Season) theo đúng Trường đua + Mặt sân + Độ dài (m)
function resolveCanonicalRaceAndSeason(map) {
  const track = String(map.trackName || map.name || '').split(' ')[0].trim();
  const surf = map.surface === 'Dirt' ? 'Dirt' : 'Turf';
  const len = Number(map.length) || 2000;
  const tag = String(map.courseTag || map.courseVariant || '').toLowerCase();
  const key = `${track}_${surf}_${len}`;

  const CANONICAL_G1_G2 = {
    // NAKAYAMA
    'Nakayama_Turf_1200': { race: 'Sprinters Stakes (G1)', season: 'Fall', isCurated: true },
    'Nakayama_Turf_1600': { race: 'New Zealand Trophy (G2)', season: 'Spring', isCurated: false },
    'Nakayama_Turf_1800': { race: 'Nakayama Kinen (G2)', season: 'Spring', isCurated: false },
    'Nakayama_Turf_2000': { race: 'Satsuki Sho (G1)', season: 'Spring', isCurated: true },
    'Nakayama_Turf_2200': { race: 'All Comers (G2)', season: 'Fall', isCurated: false },
    'Nakayama_Turf_2500': { race: 'Arima Kinen (G1)', season: 'Winter', isCurated: true },
    'Nakayama_Turf_3600': { race: 'Stayers Stakes (G2)', season: 'Winter', isCurated: true },
    'Nakayama_Dirt_1200': { race: 'Capella Stakes (G3 Dirt)', season: 'Winter', isCurated: false },
    'Nakayama_Dirt_1800': { race: 'March Stakes (G3 Dirt)', season: 'Spring', isCurated: true },

    // TOKYO
    'Tokyo_Turf_1400': { race: 'Keio Hai Spring Cup (G2)', season: 'Spring', isCurated: true },
    'Tokyo_Turf_1600': { race: 'Yasuda Kinen (G1)', season: 'Spring', isCurated: true },
    'Tokyo_Turf_1800': { race: 'Mainichi Okan (G2)', season: 'Fall', isCurated: false },
    'Tokyo_Turf_2000': { race: 'Tenno Sho (Autumn) (G1)', season: 'Fall', isCurated: true },
    'Tokyo_Turf_2400': { race: 'Tokyo Yushun - Japanese Derby (G1)', season: 'Spring', isCurated: true },
    'Tokyo_Turf_2500': { race: 'Meguro Kinen (G2)', season: 'Spring', isCurated: true },
    'Tokyo_Turf_3400': { race: 'Diamond Stakes (G3)', season: 'Winter', isCurated: true },
    'Tokyo_Dirt_1400': { race: 'Negishi Stakes (G3 Dirt)', season: 'Winter', isCurated: false },
    'Tokyo_Dirt_1600': { race: 'February Stakes (G1 Dirt)', season: 'Winter', isCurated: true },
    'Tokyo_Dirt_2100': { race: 'Unicorn Stakes (G3 Dirt)', season: 'Summer', isCurated: false },

    // KYOTO
    'Kyoto_Turf_1200': { race: 'Silk Road Stakes (G3)', season: 'Winter', isCurated: false },
    'Kyoto_Turf_1400': { race: 'Swan Stakes (G2)', season: 'Fall', isCurated: false },
    'Kyoto_Turf_1600': { race: 'Mile Championship (G1)', season: 'Fall', isCurated: true },
    'Kyoto_Turf_1800': { race: 'Kyoto Shimbun Hai (G2)', season: 'Spring', isCurated: false },
    'Kyoto_Turf_2000': { race: 'Shuka Sho (G1)', season: 'Fall', isCurated: true },
    'Kyoto_Turf_2200': { race: 'Queen Elizabeth II Cup (G1)', season: 'Fall', isCurated: true },
    'Kyoto_Turf_2400': { race: 'Kyoto Daishoten (G2)', season: 'Fall', isCurated: true },
    'Kyoto_Turf_3000': { race: 'Kikuka Sho (G1)', season: 'Fall', isCurated: true },
    'Kyoto_Turf_3200': { race: 'Tenno Sho (Spring) (G1)', season: 'Spring', isCurated: true },
    'Kyoto_Dirt_1800': { race: 'Miyako Stakes (G3 Dirt)', season: 'Fall', isCurated: true },
    'Kyoto_Dirt_1900': { race: 'Heian Stakes (G3 Dirt)', season: 'Spring', isCurated: false },

    // HANSHIN
    'Hanshin_Turf_1200': { race: 'Centaur Stakes (G2)', season: 'Fall', isCurated: false },
    'Hanshin_Turf_1400': { race: 'Hanshin Cup (G2)', season: 'Winter', isCurated: true },
    'Hanshin_Turf_1600': { race: 'Oka Sho (G1)', season: 'Spring', isCurated: true },
    'Hanshin_Turf_1800': { race: 'Rose Stakes (G2)', season: 'Fall', isCurated: false },
    'Hanshin_Turf_2000': { race: 'Osaka Hai (G1)', season: 'Spring', isCurated: true },
    'Hanshin_Turf_2200': { race: 'Takarazuka Kinen (G1)', season: 'Summer', isCurated: true },
    'Hanshin_Turf_2400': { race: 'Kobe Shimbun Hai (G2)', season: 'Fall', isCurated: false },
    'Hanshin_Turf_2600': { race: 'Hanshin Turf Stakes (2600m)', season: 'Spring', isCurated: false },
    'Hanshin_Turf_3000': { race: 'Hanshin Daishoten (G2)', season: 'Spring', isCurated: true },
    'Hanshin_Dirt_1800': { race: 'Antares Stakes (G3 Dirt)', season: 'Spring', isCurated: true },
    'Hanshin_Dirt_2000': { race: 'Sirius Stakes (G3 Dirt)', season: 'Fall', isCurated: false },

    // CHUKYO
    'Chukyo_Turf_1200': { race: 'Takamatsunomiya Kinen (G1)', season: 'Spring', isCurated: true },
    'Chukyo_Turf_1600': { race: 'Chukyo Kinen (G3)', season: 'Summer', isCurated: false },
    'Chukyo_Turf_2000': { race: 'Kinko Sho (G2)', season: 'Spring', isCurated: true },
    'Chukyo_Turf_2200': { race: 'Tokai TV Hai (G2)', season: 'Winter', isCurated: false },
    'Chukyo_Dirt_1400': { race: 'Procyon Stakes (G3 Dirt)', season: 'Summer', isCurated: false },
    'Chukyo_Dirt_1800': { race: 'Champions Cup (G1 Dirt)', season: 'Winter', isCurated: true },

    // OI (TOKYO CITY KEIBA)
    'Oi_Dirt_1200': { race: 'JBC Sprint (G1 Dirt)', season: 'Fall', isCurated: true },
    'Oi_Dirt_1800': { race: 'JBC Ladies\' Classic (G1 Dirt)', season: 'Fall', isCurated: true },
    'Oi_Dirt_2000': { race: 'Tokyo Daishoten (G1 Dirt)', season: 'Winter', isCurated: true },

    // SAPPORO & HAKODATE
    'Sapporo_Turf_1200': { race: 'Keeneland Cup (G3)', season: 'Summer', isCurated: false },
    'Sapporo_Turf_2000': { race: 'Sapporo Kinen (G2)', season: 'Summer', isCurated: true },
    'Sapporo_Turf_2600': { race: 'Sapporo Stayers Stakes (2600m)', season: 'Summer', isCurated: true },
    'Hakodate_Turf_1200': { race: 'Hakodate Sprint Stakes (G3)', season: 'Summer', isCurated: false },
    'Hakodate_Turf_2000': { race: 'Hakodate Kinen (G3)', season: 'Summer', isCurated: false },
    'Hakodate_Turf_2600': { race: 'Hakodate Long Stakes (2600m)', season: 'Summer', isCurated: true }
  };

  if (CANONICAL_G1_G2[key]) {
    return CANONICAL_G1_G2[key];
  }

  const distType = getCanonicalDistanceType(len);
  const defaultSeason = (track === 'Sapporo' || track === 'Hakodate') ? 'Summer' : 'Spring';
  return {
    race: `${track} ${distType} Championship (${len}m)`,
    season: map.season || defaultSeason,
    isCurated: Boolean(map.isCurated)
  };
}

function sanitizeAndFixMapsPool(rawMaps) {
  const fixedMaps = (rawMaps || []).map(m => {
    const track = String(m.trackName || (m.name ? m.name.split(' ')[0] : 'Tokyo')).trim();
    let len = Number(m.length) || 2000;
    let name = String(m.name || `${track} ${len}m`);
    let courseTag = m.courseTag || m.courseVariant || '';

    // Nếu một map Nakayama bị ghi nhầm là 2400m hoặc mang tên Arima Kinen nhưng lệch số mét -> Đưa về đúng chuẩn Nakayama 2500m (Inner)
    if (
      (track === 'Nakayama' && m.surface === 'Turf' && len === 2400) ||
      (String(m.famousRace || '').toLowerCase().includes('arima kinen') && track === 'Nakayama' && len !== 2500)
    ) {
      len = 2500;
      courseTag = 'Inner';
      name = 'Nakayama 2500m (Inner)';
      m.phases = { openingEnd: 417, middleEnd: 1667, finalEnd: 2083 };
    }

    const distType = getCanonicalDistanceType(len);
    const canonicalInfo = resolveCanonicalRaceAndSeason({
      ...m,
      trackName: track,
      length: len,
      courseTag
    });

    const tCode = Number(m.turnCode) || 1;
    const turnStr = m.turn || (tCode === 2 ? 'Left' : (tCode === 4 ? 'Straight' : 'Right'));

    return {
      ...m,
      trackName: track,
      name,
      length: len,
      distanceType: distType,
      courseTag,
      courseVariant: courseTag || 'Main',
      turnCode: tCode,
      turn: turnStr,
      famousRace: canonicalInfo.race,
      season: canonicalInfo.season,
      isCurated: canonicalInfo.isCurated
    };
  });

  // Đảm bảo luôn có sân Nakayama 2500m (Inner) - Arima Kinen (G1) chuẩn trong Pool
  const hasArimaKinen = fixedMaps.some(m => m.trackName === 'Nakayama' && m.surface === 'Turf' && m.length === 2500);
  if (!hasArimaKinen) {
    fixedMaps.push({
      courseId: 10506,
      trackName: 'Nakayama',
      name: 'Nakayama 2500m (Inner)',
      famousRace: 'Arima Kinen (G1)',
      surface: 'Turf',
      distanceType: 'Long',
      length: 2500,
      courseTag: 'Inner',
      courseVariant: 'Inner',
      turnCode: 1,
      turn: 'Right',
      season: 'Winter',
      isCurated: true,
      thresholdStats: ['Stamina', 'Power'],
      phases: { openingEnd: 417, middleEnd: 1667, finalEnd: 2083 },
      corners: [
        { start: 350, end: 650, cornerNumber: 1 },
        { start: 650, end: 950, cornerNumber: 2 },
        { start: 1750, end: 1970, cornerNumber: 3 },
        { start: 1970, end: 2190, cornerNumber: 4 }
      ],
      straights: [
        { start: 0, end: 350 },
        { start: 950, end: 1400 },
        { start: 2190, end: 2500 }
      ],
      slopes: [
        { start: 180, end: 310, slope: 22000 },
        { start: 1600, end: 1850, slope: -14000 },
        { start: 2280, end: 2460, slope: 24000 }
      ],
      lateStartSegment: 'Corner',
      lateStartOnUphill: false
    });
  }

  return fixedMaps;
}

function loadGameDatabase() {
  try {
    const rawUmas = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'umas.json'), 'utf-8'));
    const rawSupports = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'supports.json'), 'utf-8'));
    const rawMaps = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'maps.json'), 'utf-8'));

    UMA_POOL = rawUmas.map(u => {
      const cid = String(u.id || '');
      const charaId = String(u.charaId || cid.slice(0, 4));
      return {
        ...u,
        charaId,
        icon: u.icon || ('https://gametora.com/images/umamusume/characters/thumb/chara_stand_' + charaId + '_' + cid + '.png'),
        fallbackIcon: u.fallbackIcon || ('https://gametora.com/images/umamusume/characters/thumb/chara_stand_' + charaId + '_' + charaId + '01.png')
      };
    });

    SSR_SUPPORT_POOL = rawSupports;
    MAP_POOL = sanitizeAndFixMapsPool(rawMaps);

    // Lưu đè bản Map đã chuẩn hóa vào lại data/maps.json để dữ liệu trên đĩa luôn sạch chuẩn
    try {
      fs.writeFileSync(path.join(DATA_DIR, 'maps.json'), JSON.stringify(MAP_POOL, null, 2), 'utf-8');
    } catch (writeErr) {
      // Bỏ qua nếu file đang bị khóa đọc
    }

    console.log(`Đã nạp ${UMA_POOL.length} Uma, ${SSR_SUPPORT_POOL.length} thẻ SSR và ${MAP_POOL.length} Sân đua chuẩn (Đã chuẩn hóa Arima Kinen 2500m & hệ thống G1).`);
  } catch (err) {
    console.error('Chưa tìm thấy dữ liệu trong data/. Hãy chạy: node sync-glb-data.js trước!', err);
    process.exit(1);
  }
}
loadGameDatabase();

const rooms = {};
const MOOD_LIST = ['Awful', 'Bad', 'Normal', 'Good', 'Great'];
const FAIL_STEPS = [0, 10, 25, 45, 70];
const RANKS = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S'];

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  } while (rooms[code]);
  return code;
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function rollTrackCondition() {
  const r = Math.random() * 100;
  if (r < 50) return 'Firm';
  if (r < 75) return 'Good';
  if (r < 90) return 'Soft';
  return 'Heavy';
}

function generateSevenMaps() {
  const curatedPool = MAP_POOL.filter(m => m.isCurated);
  const sourcePool = curatedPool.length >= 12 ? curatedPool : MAP_POOL;
  const shuffledPool = shuffleArray(sourcePool);

  const selectedMaps = [];
  const usedNames = new Set();
  const distanceCount = { Sprint: 0, Mile: 0, Medium: 0, Long: 0 };
  let dirtCount = 0;

  // Vòng 1: Chọn từ Curated Pool đảm bảo cân bằng tối đa 2 map mỗi cự ly và tối đa 1 sân Dirt
  for (const map of shuffledPool) {
    if (selectedMaps.length === 7) break;
    if (usedNames.has(map.name)) continue;
    if (distanceCount[map.distanceType] >= 2) continue;
    if (map.surface === 'Dirt' && dirtCount >= 1) continue;

    usedNames.add(map.name);
    distanceCount[map.distanceType]++;
    if (map.surface === 'Dirt') dirtCount++;

    const mapIndex = selectedMaps.length + 1;
    const trueCond = rollTrackCondition();
    selectedMaps.push({
      ...map,
      slot: mapIndex === 7 ? 'Tie break' : `Map ${mapIndex}`,
      season: map.season || 'Spring',
      trueCondition: trueCond,
      visibleCondition: mapIndex <= 2 ? trueCond : '???',
      raceResult: null
    });
  }

  // Vòng 2: Nếu vẫn chưa đủ 7 map (ví dụ thiếu Long từ curated), lấy bổ sung từ toàn bộ MAP_POOL
  if (selectedMaps.length < 7) {
    for (const map of shuffleArray(MAP_POOL)) {
      if (selectedMaps.length === 7) break;
      if (usedNames.has(map.name)) continue;
      if (distanceCount[map.distanceType] >= 2) continue;
      if (map.surface === 'Dirt' && dirtCount >= 1) continue;

      usedNames.add(map.name);
      distanceCount[map.distanceType]++;
      if (map.surface === 'Dirt') dirtCount++;

      const mapIndex = selectedMaps.length + 1;
      const trueCond = rollTrackCondition();
      selectedMaps.push({
        ...map,
        slot: mapIndex === 7 ? 'Tie break' : `Map ${mapIndex}`,
        season: map.season || 'Spring',
        trueCondition: trueCond,
        visibleCondition: mapIndex <= 2 ? trueCond : '???',
        raceResult: null
      });
    }
  }

  return selectedMaps;
}

function serializeMapsForClient(roomMaps) {
  return (roomMaps || []).map(m => {
    const tCode = Number(m.turnCode) || 1;
    const turnStr = m.turn || (tCode === 2 ? 'Left' : (tCode === 4 ? 'Straight' : 'Right'));
    return {
      slot: m.slot,
      courseId: m.courseId,
      trackName: m.trackName || (m.name ? m.name.split(' ')[0] : 'Track'),
      name: m.name,
      famousRace: m.famousRace,
      surface: m.surface,
      distanceType: getCanonicalDistanceType(m.length),
      length: m.length,
      courseTag: m.courseTag || m.courseVariant || '',
      courseVariant: m.courseTag || m.courseVariant || 'Main',
      turnCode: tCode,
      turn: turnStr,
      thresholdStats: m.thresholdStats || [],
      phases: m.phases,
      corners: m.corners || [],
      straights: m.straights || [],
      slopes: m.slopes || [],
      lateStartSegment: m.lateStartSegment || 'Corner',
      lateStartOnUphill: Boolean(m.lateStartOnUphill),
      condition: m.visibleCondition,
      season: m.season || 'Spring',
      raceResult: m.raceResult || null
    };
  });
}

function generateYearlyEnergyBag() {
  return shuffleArray([
    'Speed', 'Speed', 'Stamina', 'Stamina',
    'Power', 'Power', 'Guts', 'Guts', 'Wit', 'Wit'
  ]);
}

function changeMood(currentMood, delta) {
  const idx = MOOD_LIST.indexOf(currentMood);
  const nextIdx = Math.max(0, Math.min(MOOD_LIST.length - 1, idx + delta));
  return MOOD_LIST[nextIdx];
}

function getBestDefaultStyle(apt) {
  if (!apt) return 'Pace';
  const styles = ['Front', 'Pace', 'Late', 'End'];
  let best = 'Pace';
  let bestScore = -1;
  styles.forEach(st => {
    const score = RANKS.indexOf(apt[st] || 'G');
    if (score > bestScore) {
      bestScore = score;
      best = st;
    }
  });
  return best;
}

function runInheritanceRollForPlayer(player) {
  const logs = [];
  player.selectedUmas.forEach(uma => {
    const sparksMap = uma.pinkSparks || {};
    Object.entries(sparksMap).forEach(([aptKey, sparkCount]) => {
      if (sparkCount <= 0) return;
      const currentRank = uma.aptitudes[aptKey];
      const rankIdx = RANKS.indexOf(currentRank);
      if (rankIdx >= RANKS.indexOf('S')) return;

      const chance = sparkCount * 8;
      if (Math.random() * 100 < chance) {
        const nextRank = RANKS[rankIdx + 1];
        uma.aptitudes[aptKey] = nextRank;
        logs.push(`${uma.name}: ${aptKey} đột phá lên [${nextRank}]`);
      }
    });
  });
  return logs;
}

function getClientGameState(room, sessionToken, actionToast = null, turnBanner = null) {
  const myPlayer = room.players[sessionToken];
  const opponentToken = Object.keys(room.players).find(t => t !== sessionToken);
  const oppPlayer = opponentToken ? room.players[opponentToken] : null;

  const clientMaps = serializeMapsForClient(room.maps);
  const energyIdx = room.turn - 1;
  const baseTurnEnergy = room.energyBag[energyIdx] || 'Speed';

  return {
    roomCode: room.code,
    phase: room.phase,
    year: room.year,
    turn: room.turn,
    maps: clientMaps,
    currentEnergy: myPlayer.turnEnergyOverride || baseTurnEnergy,
    energyUsed: myPlayer.energyUsed || false,
    nextEnergy: room.energyBag[energyIdx + 1] || 'Race Phase',
    myScore: myPlayer.score || 0,
    myUmas: myPlayer.selectedUmas,
    myHand: myPlayer.hand,
    deckCount: myPlayer.deck.length,
    myInventory: myPlayer.inventory || [],
    megaphoneBuff: Boolean(myPlayer.megaphoneBuff),
    pendingGlobalEvent: !myPlayer.eventResolvedThisTurn ? room.activeGlobalEvent : null,
    activeRacePacket: room.activeRacePacket || null,
    actionToast,
    turnBanner,
    opponent: oppPlayer ? {
      name: oppPlayer.name,
      connected: oppPlayer.connected,
      score: oppPlayer.score || 0,
      umas: oppPlayer.selectedUmas,
      handCount: oppPlayer.hand.length,
      deckCount: oppPlayer.deck.length
    } : null
  };
}

function broadcastRoomState(room, toastMap = {}, bannerMap = {}) {
  Object.values(room.players).forEach(p => {
    io.to(p.socketId).emit(
      'state_updated',
      getClientGameState(room, p.sessionToken, toastMap[p.sessionToken] || null, bannerMap[p.sessionToken] || null)
    );
  });
}

function triggerNextQueuedRace(room) {
  if (!room.raceQueue || room.raceQueue.length === 0) return;
  const mapIdx = room.raceQueue.shift();
  const mapObj = room.maps[mapIdx];
  const allPlayers = Object.values(room.players);
  if (allPlayers.length < 2 || !mapObj) return;

  const [p1, p2] = allPlayers;
  mapObj.visibleCondition = mapObj.trueCondition;
  room.gateReadySet = new Set();

  const simResult = simulateSixUmaRace(mapObj, p1, p2);

  allPlayers.forEach(p => {
    p.score = (p.score || 0) + (simResult.scoreDelta[p.sessionToken] || 0);
    p.raceConfirmReady = false;
  });

  const totalScores = {
    [p1.sessionToken]: p1.score,
    [p2.sessionToken]: p2.score
  };

  const top1 = simResult.resultsTable[0];
  mapObj.raceResult = {
    winnerName: top1.name,
    ownerName: top1.ownerName,
    scoreDelta: simResult.scoreDelta
  };

  let matchWinner = null;
  if ((p1.score >= 25 || p2.score >= 25) && p1.score !== p2.score) {
    matchWinner = p1.score > p2.score ? p1.name : p2.name;
  } else if (mapIdx === 5 && room.raceQueue.length === 0) {
    room.raceQueue.push(6);
    if (room.maps[6]) room.maps[6].visibleCondition = room.maps[6].trueCondition;
    allPlayers.forEach(p => {
      p.selectedUmas.forEach(u => { u.mood = changeMood(u.mood, -1); });
    });
  } else if (mapIdx === 6) {
    if (p1.score !== p2.score) {
      matchWinner = p1.score > p2.score ? p1.name : p2.name;
    } else {
      matchWinner = top1 ? top1.ownerName : p1.name;
    }
  }

  let nextStepLabel = 'Xác Nhận Kết Quả & Tiếp Tục (0/2)';
  if (!matchWinner && room.raceQueue.length > 0) {
    const nextMap = room.maps[room.raceQueue[0]];
    nextStepLabel = `Đua Chặng Tiếp Theo: ${nextMap.slot} (${nextMap.name}) (0/2)`;
  } else if (!matchWinner) {
    nextStepLabel = `Bước Sang Năm ${room.year + 1} (Kế Thừa & Mở Thời Tiết) (0/2)`;
  }

  room.activeRacePacket = {
    ...simResult,
    totalScores,
    matchWinner,
    nextStepLabel
  };

  io.to(room.code).emit('race_started', room.activeRacePacket);
  broadcastRoomState(room);
}

io.on('connection', (socket) => {
  socket.on('create_room', ({ playerName, sessionToken }) => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = {
      code: roomCode,
      phase: 'WAITING',
      year: 1,
      turn: 1,
      maps: [],
      energyBag: [],
      raceQueue: [],
      gateReadySet: new Set(),
      activeRacePacket: null,
      activeGlobalEvent: null,
      disconnectTimer: null,
      players: {
        [sessionToken]: {
          socketId: socket.id,
          sessionToken,
          name: playerName || 'Trainer 1',
          score: 0,
          connected: true,
          ready: false,
          nextTurnReady: false,
          raceConfirmReady: false,
          energyUsed: false,
          turnEnergyOverride: null,
          megaphoneBuff: false,
          eventResolvedThisTurn: true,
          inventory: [],
          selectedUmas: [],
          hand: [],
          deck: []
        }
      }
    };
    socket.join(roomCode);
    socket.emit('room_created', { roomCode, sessionToken });
  });

  socket.on('join_room', ({ roomCode, playerName, sessionToken }) => {
    const code = (roomCode || '').trim().toUpperCase();
    const room = rooms[code];
    if (!room) return socket.emit('error_msg', 'Không tìm thấy phòng với mã này.');

    if (room.players[sessionToken]) {
      const player = room.players[sessionToken];
      player.socketId = socket.id;
      player.connected = true;
      socket.join(code);

      if (room.disconnectTimer) {
        clearTimeout(room.disconnectTimer);
        room.disconnectTimer = null;
      }
      io.to(code).emit('opponent_reconnected');

      if (room.phase === 'PRE_GAME') {
        socket.emit('enter_pregame', {
          roomCode: code,
          maps: serializeMapsForClient(room.maps),
          umaPool: UMA_POOL,
          supportPool: SSR_SUPPORT_POOL,
          isReconnect: true
        });
      } else {
        socket.emit('match_start', getClientGameState(room, sessionToken));
        if (room.activeRacePacket) {
          socket.emit('race_started', room.activeRacePacket);
        }
      }
      return;
    }

    const playerTokens = Object.keys(room.players);
    if (playerTokens.length >= 2) {
      return socket.emit('error_msg', 'Phòng này đã đầy hoặc trận đấu đang diễn ra.');
    }

    room.players[sessionToken] = {
      socketId: socket.id,
      sessionToken,
      name: playerName || 'Trainer 2',
      score: 0,
      connected: true,
      ready: false,
      nextTurnReady: false,
      raceConfirmReady: false,
      energyUsed: false,
      turnEnergyOverride: null,
      megaphoneBuff: false,
      eventResolvedThisTurn: true,
      inventory: [],
      selectedUmas: [],
      hand: [],
      deck: []
    };
    socket.join(code);

    room.phase = 'PRE_GAME';
    if (room.maps.length === 0) room.maps = generateSevenMaps();

    io.to(code).emit('enter_pregame', {
      roomCode: code,
      maps: serializeMapsForClient(room.maps),
      umaPool: UMA_POOL,
      supportPool: SSR_SUPPORT_POOL,
      isReconnect: false
    });
  });

  socket.on('submit_pregame', ({ roomCode, sessionToken, chosenUmas, chosenDeckUids }) => {
    const room = rooms[roomCode];
    if (!room || !room.players[sessionToken]) return;

    const initializedUmas = (chosenUmas || []).map(u => {
      const potSkills = Array.isArray(u.potSkills) ? u.potSkills : [];
      return {
        ...u,
        mood: 'Normal',
        failRate: 0,
        activeStyle: u.activeStyle || getBestDefaultStyle(u.aptitudes),
        equippedCards: [],
        potSkills,
        skills: potSkills.map(ps => ({
          cardUid: `pot_${ps.skillId}`,
          skillId: ps.skillId,
          name: ps.name,
          mechanics: ps.mechanics,
          isGold: ps.isGold,
          fromPot: true
        }))
      };
    });

    const uniqueUids = Array.from(new Set(chosenDeckUids || []));
    let playerDeckCards = [];
    uniqueUids.forEach((uid, idx) => {
      const found = SSR_SUPPORT_POOL.find(c => c.uid === uid);
      if (found) {
        playerDeckCards.push({ ...found, uid: `${found.uid}_p_${idx}` });
      }
    });

    if (playerDeckCards.length !== 40) {
      playerDeckCards = SSR_SUPPORT_POOL.slice(0, 40).map((c, idx) => ({ ...c, uid: `${c.uid}_def_${idx}` }));
    }

    const fullDeck = shuffleArray(playerDeckCards);
    const p = room.players[sessionToken];
    p.ready = true;
    p.selectedUmas = initializedUmas;
    p.hand = fullDeck.slice(0, 5);
    p.deck = fullDeck.slice(5);

    const allPlayers = Object.values(room.players);
    const readyCount = allPlayers.filter(pl => pl.ready).length;
    io.to(roomCode).emit('pregame_status', { readyCount });

    if (readyCount === 2) {
      room.phase = 'YEAR_1';
      room.year = 1;
      room.turn = 1;
      room.energyBag = generateYearlyEnergyBag();

      const startBanner = {
        title: 'NĂM 1 (JUNIOR YEAR) — LƯỢT 1 / 10',
        subtitle: `Năng lượng khởi đầu: ${room.energyBag[0].toUpperCase()} (Training Lv.1)`
      };

      allPlayers.forEach(pl => {
        pl.score = 0;
        pl.inventory = [];
        addItemToInventory(pl, 'royal_juice');
        io.to(pl.socketId).emit('match_start', getClientGameState(room, pl.sessionToken, null, startBanner));
      });
    }
  });

  socket.on('play_card_on_uma', ({ roomCode, sessionToken, cardUid, umaIndex, mode, targetEquippedUid }) => {
    const room = rooms[roomCode];
    if (!room || !room.players[sessionToken]) return;
    const player = room.players[sessionToken];
    const uma = player.selectedUmas[umaIndex];
    const cardIdx = player.hand.findIndex(c => c.uid === cardUid);
    if (!uma || cardIdx === -1) return;

    const card = player.hand[cardIdx];
    let toastMsg = '';

    if (mode === 'awaken') {
      const awakenTarget = uma.equippedCards.find(
        eq => eq.uid === targetEquippedUid && !eq.isGoldAwakened && (eq.type === card.type || card.type === 'Guts')
      );

      if (!awakenTarget) {
        return socket.emit('action_error', 'Thẻ mục tiêu không hợp lệ để thực hiện Gold Awakening.');
      }

      player.hand.splice(cardIdx, 1);
      awakenTarget.isGoldAwakened = true;
      const skillObj = uma.skills.find(s => s.cardUid === awakenTarget.uid);
      if (skillObj) {
        skillObj.name = awakenTarget.goldSkill;
        skillObj.skillId = awakenTarget.goldSkillId;
        skillObj.mechanics = awakenTarget.goldSkillData;
        skillObj.isGold = true;
      }
      toastMsg = `[GOLD AWAKENING] ${uma.name} mở khóa kỹ năng [${awakenTarget.goldSkill}]`;
    } else {
      if (uma.equippedCards.length >= 5) {
        return socket.emit('action_error', `${uma.name} đã trang bị tối đa 5 thẻ Support.`);
      }
      if (uma.equippedCards.some(eq => eq.baseId === card.baseId)) {
        return socket.emit('action_error', `${uma.name} đã trang bị thẻ [${card.name}] rồi.`);
      }

      player.hand.splice(cardIdx, 1);
      uma.equippedCards.push({
        ...card,
        isGoldAwakened: false
      });
      uma.skills.push({
        cardUid: card.uid,
        skillId: card.whiteSkillId,
        name: card.whiteSkill,
        goldName: card.goldSkill,
        mechanics: card.whiteSkillData,
        type: card.type,
        isGold: false
      });
      toastMsg = `[EQUIP] Trang bị ${card.name} cho ${uma.name} (+Kỹ năng: ${card.whiteSkill})`;
    }

    broadcastRoomState(room, { [sessionToken]: toastMsg });
  });

  socket.on('unequip_card_from_uma', ({ roomCode, sessionToken, umaIndex, cardUid }) => {
    const room = rooms[roomCode];
    if (!room || !room.players[sessionToken]) return;
    const player = room.players[sessionToken];
    const uma = player.selectedUmas[umaIndex];
    if (!uma || !Array.isArray(uma.equippedCards)) return;

    const eqIdx = uma.equippedCards.findIndex(c => c.uid === cardUid);
    if (eqIdx === -1) return;

    const equippedCard = uma.equippedCards[eqIdx];
    if (equippedCard.isGoldAwakened) {
      return socket.emit('action_error', 'Thẻ đã thực hiện Gold Awakening không thể thu hồi về tay!');
    }
    if (player.hand.length >= 10) {
      return socket.emit('action_error', 'Bài trên tay đã đầy (Tối đa 10 lá), không thể thu hồi thêm!');
    }

    uma.equippedCards.splice(eqIdx, 1);
    uma.skills = (uma.skills || []).filter(s => s.cardUid !== cardUid);

    const cleanCard = { ...equippedCard };
    delete cleanCard.isGoldAwakened;
    player.hand.push(cleanCard);

    const toastMsg = `[RECALL CARD] Đã thu hồi thẻ [${cleanCard.name}] từ ${uma.name} về lại trên tay.`;
    broadcastRoomState(room, { [sessionToken]: toastMsg });
  });

  socket.on('convert_energy_with_card', ({ roomCode, sessionToken, cardUid }) => {
    const room = rooms[roomCode];
    if (!room || !room.players[sessionToken]) return;
    const player = room.players[sessionToken];
    if (player.energyUsed) {
      return socket.emit('action_error', 'Bạn đã sử dụng Năng lượng của lượt này rồi.');
    }

    const cardIdx = player.hand.findIndex(c => c.uid === cardUid);
    if (cardIdx === -1) return;

    const card = player.hand[cardIdx];
    player.hand.splice(cardIdx, 1);
    player.turnEnergyOverride = card.type;

    const toastMsg = `[DISCARD FOR ENERGY] Đã bỏ thẻ ${card.name} -> Nhận Năng lượng [${card.type}]`;
    broadcastRoomState(room, { [sessionToken]: toastMsg });
  });

  socket.on('train_uma_with_energy', ({ roomCode, sessionToken, umaIndex }) => {
    const room = rooms[roomCode];
    if (!room || !room.players[sessionToken]) return;
    const player = room.players[sessionToken];
    if (player.energyUsed) {
      return socket.emit('action_error', 'Mỗi lượt chỉ có 1 Năng lượng Huấn luyện.');
    }

    const uma = player.selectedUmas[umaIndex];
    if (!uma) return;

    const energyIdx = room.turn - 1;
    const energyType = player.turnEnergyOverride || room.energyBag[energyIdx] || 'Speed';
    const isSummerCamp = room.year >= 2 && (room.turn === 7 || room.turn === 8);
    const megaphoneMult = player.megaphoneBuff ? 1.5 : 1.0;
    const campMultiplier = (isSummerCamp ? 1.5 : 1.0) * megaphoneMult;
    player.megaphoneBuff = false;

    const YEAR_SCALING = {
      1: { lvName: 'Lv.1', main: 22, sub: 8, rb: 14, gutMain: 15, gutSub: 8, gutRb: 11, witMain: 18, witSub: 4, witRb: 14 },
      2: { lvName: 'Lv.3', main: 32, sub: 12, rb: 22, gutMain: 22, gutSub: 12, gutRb: 16, witMain: 26, witSub: 6, witRb: 20 },
      3: { lvName: 'Lv.5', main: 45, sub: 18, rb: 30, gutMain: 30, gutSub: 16, gutRb: 22, witMain: 36, witSub: 10, witRb: 28 }
    };
    const scale = YEAR_SCALING[room.year] || YEAR_SCALING[1];

    player.energyUsed = true;

    const roll = Math.random() * 100;
    const isFailed = energyType !== 'Wit' && roll < uma.failRate;

    let toastMsg = '';

    if (isFailed) {
      const statKeyMap = { Speed: 'spd', Stamina: 'sta', Power: 'pow', Guts: 'gut', Wit: 'wit' };
      const targetKey = statKeyMap[energyType] || 'spd';
      uma.baseStats[targetKey] = Math.max(50, uma.baseStats[targetKey] - 20);
      uma.mood = changeMood(uma.mood, -1);
      uma.failRate = Math.max(0, uma.failRate - 15);
      toastMsg = `[TRAINING FAILED] ${uma.name} tập thất bại: -20 ${energyType}, Mood giảm xuống ${uma.mood}`;
    } else {
      const matchingCards = uma.equippedCards.filter(c => c.type === energyType).length;
      const rainbowText = matchingCards > 0 ? ` [RAINBOW x${matchingCards}]` : '';

      if (energyType === 'Speed') {
        const gainSpd = Math.round((scale.main + matchingCards * scale.rb) * campMultiplier);
        const gainPow = Math.round(scale.sub * campMultiplier);
        uma.baseStats.spd += gainSpd;
        uma.baseStats.pow += gainPow;
        toastMsg = `[TRAIN SPEED ${scale.lvName}] ${uma.name}${rainbowText}: +${gainSpd} Speed, +${gainPow} Power`;
      } else if (energyType === 'Stamina') {
        const gainSta = Math.round((scale.main + matchingCards * scale.rb) * campMultiplier);
        const gainGut = Math.round(scale.sub * campMultiplier);
        uma.baseStats.sta += gainSta;
        uma.baseStats.gut += gainGut;
        toastMsg = `[TRAIN STAMINA ${scale.lvName}] ${uma.name}${rainbowText}: +${gainSta} Stamina, +${gainGut} Guts`;
      } else if (energyType === 'Power') {
        const gainPow = Math.round((scale.main + matchingCards * scale.rb) * campMultiplier);
        const gainSta = Math.round(scale.sub * campMultiplier);
        uma.baseStats.pow += gainPow;
        uma.baseStats.sta += gainSta;
        toastMsg = `[TRAIN POWER ${scale.lvName}] ${uma.name}${rainbowText}: +${gainPow} Power, +${gainSta} Stamina`;
      } else if (energyType === 'Guts') {
        const gainGut = Math.round((scale.gutMain + matchingCards * scale.gutRb) * campMultiplier);
        const gainSub = Math.round((scale.gutSub + matchingCards * 5) * campMultiplier);
        uma.baseStats.gut += gainGut;
        uma.baseStats.spd += gainSub;
        uma.baseStats.pow += gainSub;
        toastMsg = `[TRAIN GUTS ${scale.lvName}] ${uma.name}${rainbowText}: +${gainGut} Guts, +${gainSub} Speed/Power`;
      } else if (energyType === 'Wit') {
        const gainWit = Math.round((scale.witMain + matchingCards * scale.witRb) * campMultiplier);
        const gainSpd = Math.round(scale.witSub * campMultiplier);
        uma.baseStats.wit += gainWit;
        uma.baseStats.spd += gainSpd;
        uma.failRate = Math.max(0, uma.failRate - 5);
        let drawText = '';
        if (matchingCards > 0 && player.deck.length > 0 && player.hand.length < 9) {
          player.hand.push(player.deck.shift());
          drawText = ' (+1 Card Draw)';
        }
        toastMsg = `[TRAIN WIT ${scale.lvName}] ${uma.name}${rainbowText}: +${gainWit} Wit, +${gainSpd} Speed${drawText}`;
      }

      if (energyType !== 'Wit') {
        const curStepIdx = FAIL_STEPS.findIndex(val => val >= uma.failRate);
        const nextStepIdx = Math.min(FAIL_STEPS.length - 1, (curStepIdx === -1 ? 0 : curStepIdx) + 1);
        uma.failRate = FAIL_STEPS[nextStepIdx];
      }
    }

    player.selectedUmas.forEach((otherUma, idx) => {
      if (idx !== umaIndex && otherUma.failRate > 0) {
        const healAmount = otherUma.failRate >= 20 ? 10 : 5;
        otherUma.failRate = Math.max(0, otherUma.failRate - healAmount);
      }
    });

    broadcastRoomState(room, { [sessionToken]: toastMsg });
  });

  socket.on('rest_uma', ({ roomCode, sessionToken, umaIndex }) => {
    const room = rooms[roomCode];
    if (!room || !room.players[sessionToken]) return;
    const player = room.players[sessionToken];
    if (player.energyUsed) {
      return socket.emit('action_error', 'Bạn đã dùng Năng lượng của lượt này.');
    }

    const uma = player.selectedUmas[umaIndex];
    if (!uma) return;

    player.energyUsed = true;
    const isSummerCamp = room.year >= 2 && (room.turn === 7 || room.turn === 8);
    const moodGain = isSummerCamp ? 2 : 1;

    uma.failRate = 0;
    uma.mood = changeMood(uma.mood, moodGain);
    if (player.deck.length > 0 && player.hand.length < 9) {
      player.hand.push(player.deck.shift());
    }

    const toastMsg = `[ACTIVE REST] ${uma.name}: Fail về 0%, Mood lên [${uma.mood}] và rút thêm 1 thẻ`;
    broadcastRoomState(room, { [sessionToken]: toastMsg });
  });

  socket.on('request_next_turn', ({ roomCode, sessionToken }) => {
    const room = rooms[roomCode];
    if (!room || !room.players[sessionToken]) return;

    room.players[sessionToken].nextTurnReady = true;
    const allPlayers = Object.values(room.players);
    const confirmedCount = allPlayers.filter(p => p.nextTurnReady).length;

    io.to(roomCode).emit('turn_ready_update', { confirmedCount, total: allPlayers.length });

    if (confirmedCount === allPlayers.length) {
      allPlayers.forEach(p => {
        p.nextTurnReady = false;
        p.energyUsed = false;
        p.turnEnergyOverride = null;
      });

      if (room.turn >= 10) {
        if (room.year === 1) room.raceQueue = [0, 1];
        else if (room.year === 2) room.raceQueue = [2, 3];
        else room.raceQueue = [4, 5];

        triggerNextQueuedRace(room);
        return;
      }

      room.turn++;

      if ([3, 6, 9].includes(room.turn)) {
        room.activeGlobalEvent = rollRandomGlobalEvent();
        allPlayers.forEach(p => { p.eventResolvedThisTurn = false; });
      } else {
        room.activeGlobalEvent = null;
        allPlayers.forEach(p => { p.eventResolvedThisTurn = true; });
      }

      const bannerMap = {};
      const curEnergy = room.energyBag[room.turn - 1] || 'Speed';
      const yearName = room.year === 1 ? 'NĂM 1 (JUNIOR - LV.1)' : room.year === 2 ? 'NĂM 2 (CLASSIC - LV.3)' : 'NĂM 3 (SENIOR - LV.5 MAX)';

      allPlayers.forEach(p => {
        if (p.deck.length > 0 && p.hand.length < 9) {
          p.hand.push(p.deck.shift());
        }

        let extraTag = '';
        if ([3, 6, 9].includes(room.turn)) extraTag = ' — GLOBAL EVENT';
        if (room.year >= 2 && [7, 8].includes(room.turn)) extraTag = ' — SUMMER CAMP (x1.5 STAT)';

        bannerMap[p.sessionToken] = {
          title: `${yearName} — LƯỢT ${room.turn} / 10${extraTag}`,
          subtitle: `Năng lượng lượt này: ${curEnergy.toUpperCase()}`
        };
      });

      broadcastRoomState(room, {}, bannerMap);
    }
  });

  socket.on('confirm_race_gate_start', ({ roomCode, sessionToken }) => {
    const room = rooms[roomCode];
    if (!room || !room.players[sessionToken]) return;

    if (!room.gateReadySet) room.gateReadySet = new Set();
    room.gateReadySet.add(sessionToken);

    const allPlayers = Object.values(room.players);
    io.to(roomCode).emit('race_gate_ready_update', {
      readyCount: room.gateReadySet.size,
      total: allPlayers.length
    });

    if (room.gateReadySet.size >= allPlayers.length) {
      io.to(roomCode).emit('race_gate_open');
    }
  });

  socket.on('confirm_race_Watched', ({ roomCode, sessionToken }) => {
    const room = rooms[roomCode];
    if (!room || !room.players[sessionToken]) return;

    room.players[sessionToken].raceConfirmReady = true;
    const allPlayers = Object.values(room.players);
    const readyCount = allPlayers.filter(p => p.raceConfirmReady).length;

    io.to(roomCode).emit('race_confirm_update', { readyCount, total: allPlayers.length });

    if (readyCount === allPlayers.length) {
      allPlayers.forEach(p => { p.raceConfirmReady = false; });

      if (room.raceQueue && room.raceQueue.length > 0) {
        triggerNextQueuedRace(room);
        return;
      }

      room.activeRacePacket = null;
      if (room.year < 3) {
        room.year++;
        room.turn = 1;
        room.energyBag = generateYearlyEnergyBag();
        room.maps.forEach((m, idx) => {
          if (room.year === 2 && (idx === 2 || idx === 3)) m.visibleCondition = m.trueCondition;
          if (room.year === 3 && idx >= 4) m.visibleCondition = m.trueCondition;
        });

        const bannerMap = {};
        const toastMap = {};
        const curEnergy = room.energyBag[0] || 'Speed';
        const yearName = room.year === 2 ? 'NĂM 2 (CLASSIC - LV.3)' : 'NĂM 3 (SENIOR - LV.5 MAX)';

        allPlayers.forEach(p => {
          p.selectedUmas.forEach(u => {
            u.failRate = 0;
            u.mood = changeMood(u.mood, -1);
          });
          if (p.deck.length > 0 && p.hand.length < 9) p.hand.push(p.deck.shift());

          const logs = runInheritanceRollForPlayer(p);
          const inheritSummary = logs.length > 0 ? ' | KẾ THỪA: ' + logs.join(', ') : ' | Sự kiện Kế thừa hoàn tất';
          if (logs.length > 0) toastMap[p.sessionToken] = `[INHERITANCE BREAKTHROUGH] ${logs.join(' | ')}`;

          bannerMap[p.sessionToken] = {
            title: `${yearName} — LƯỢT 1 / 10`,
            subtitle: `Năng lượng lượt này: ${curEnergy.toUpperCase()}${inheritSummary}`
          };
        });

        io.to(roomCode).emit('close_race_modal');
        broadcastRoomState(room, toastMap, bannerMap);
      }
    }
  });

  const handleSelectGlobalEvent = ({ roomCode, sessionToken, choiceId }) => {
    const room = rooms[roomCode];
    if (!room || !room.players[sessionToken] || !room.activeGlobalEvent) return;
    const player = room.players[sessionToken];
    if (player.eventResolvedThisTurn) return;

    player.eventResolvedThisTurn = true;
    const drawCardHelper = (pl, count) => {
      for (let i = 0; i < count; i++) {
        if (pl.deck.length > 0 && pl.hand.length < 9) pl.hand.push(pl.deck.shift());
      }
    };

    const resultToast = resolveEventChoice(
      player,
      room.activeGlobalEvent.id,
      choiceId,
      changeMood,
      drawCardHelper
    );

    const oppToken = Object.keys(room.players).find(t => t !== sessionToken);
    const toastMap = { [sessionToken]: resultToast };
    if (oppToken) {
      toastMap[oppToken] = `[ĐỐI THỦ] ${player.name} vừa hoàn thành sự kiện ${room.activeGlobalEvent.character}!`;
    }
    broadcastRoomState(room, toastMap);
  };

  socket.on('select_global_event_choice', handleSelectGlobalEvent);
  socket.on('resolve_global_event', handleSelectGlobalEvent);

  socket.on('use_inventory_item', ({ roomCode, sessionToken, itemUid, umaIndex }) => {
    const room = rooms[roomCode];
    if (!room || !room.players[sessionToken]) return;
    const player = room.players[sessionToken];

    const res = useInventoryItem(player, itemUid, umaIndex, changeMood);
    if (!res.ok) {
      return socket.emit('action_error', res.error);
    }
    broadcastRoomState(room, { [sessionToken]: res.toast });
  });

  socket.on('change_uma_style', ({ roomCode, sessionToken, umaIndex, newStyle }) => {
    const room = rooms[roomCode];
    if (!room || !room.players[sessionToken]) return;
    const player = room.players[sessionToken];
    const uma = player.selectedUmas[umaIndex];
    if (!uma) return;

    uma.activeStyle = newStyle;
    broadcastRoomState(room, {
      [sessionToken]: `Đã đổi chiến thuật chạy của ${uma.name} sang [${newStyle}] (Bậc ${uma.aptitudes[newStyle]}).`
    });
  });

  socket.on('disconnect', () => {
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      for (const token in room.players) {
        const player = room.players[token];
        if (player.socketId === socket.id) {
          player.connected = false;
          io.to(roomCode).emit('opponent_disconnected', { name: player.name });

          if (!room.disconnectTimer) {
            room.disconnectTimer = setTimeout(() => {
              io.to(roomCode).emit('match_aborted', 'Đối thủ không kết nối lại trong 30 giây. Trận đấu đã bị hủy.');
              delete rooms[roomCode];
            }, 30000);
          }
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Twinkle Tactics: Card Derby đang chạy tại cổng ${PORT}`);
});