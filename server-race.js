// server-race.js - Engine Mô phỏng Đua 6 Uma (Chuẩn hóa Accel Corner/Straight, Stamina Siphon & Ưu tiên Gold Skill)

const DIST_APT_SPEED_MOD = { S: 1.10, A: 1.00, B: 0.90, C: 0.80, D: 0.60, E: 0.40, F: 0.20, G: 0.10 };
const DIST_BASE_SPEED_PENALTY = { S: 1.015, A: 1.000, B: 0.985, C: 0.960, D: 0.920, E: 0.870, F: 0.820, G: 0.760 };

const SURF_APT_POWER_MOD = { S: 1.05, A: 1.00, B: 0.90, C: 0.80, D: 0.70, E: 0.50, F: 0.30, G: 0.10 };
const SURF_DRAIN_PENALTY = { S: 0.98, A: 1.00, B: 1.05, C: 1.12, D: 1.20, E: 1.30, F: 1.42, G: 1.55 };

const STYLE_APT_WIT_MOD = { S: 1.10, A: 1.00, B: 0.85, C: 0.75, D: 0.60, E: 0.40, F: 0.20, G: 0.10 };
const STYLE_SKILL_RATE_MOD = { S: 5, A: 0, B: -8, C: -16, D: -25, E: -35, F: -45, G: -55 };

const MOOD_MOD = { Great: 1.10, Good: 1.05, Normal: 1.00, Bad: 0.95, Awful: 0.90 };

const STYLE_COEFF = {
  Front: {
    p0: 1.018, p1: 0.996, p2: 0.968, spurtMult: 1.000,
    a0: 1.200, a1: 1.000, a2: 0.990,
    startDashBonus: 5.5, hpMod: 0.950,
    gapMin: 0.8, gapMax: 2.5
  },
  Pace: {
    p0: 0.990, p1: 0.988, p2: 0.982, spurtMult: 1.018,
    a0: 1.020, a1: 1.000, a2: 0.998,
    startDashBonus: 3.8, hpMod: 0.920,
    gapMin: 4.0, gapMax: 7.5
  },
  Late: {
    p0: 0.968, p1: 0.980, p2: 1.002, spurtMult: 1.042,
    a0: 0.920, a1: 0.980, a2: 1.018,
    startDashBonus: 2.4, hpMod: 1.000,
    gapMin: 8.5, gapMax: 13.0
  },
  End: {
    p0: 0.952, p1: 0.974, p2: 1.012, spurtMult: 1.060,
    a0: 0.860, a1: 0.960, a2: 1.032,
    startDashBonus: 1.5, hpMod: 0.995,
    gapMin: 13.5, gapMax: 18.5
  }
};

const RUNNING_STYLE_CODE = { Front: 1, Pace: 2, Late: 3, End: 4 };
const DIST_TYPE_CODE = { Sprint: 1, Mile: 2, Medium: 3, Long: 4 };
const SEASON_CODE = { Spring: 1, Summer: 2, Fall: 3, Autumn: 3, Winter: 4 };

// BẢNG ĐỐI CHIẾU CẶP KỸ NĂNG VÀNG (GOLD) <-> TRẮNG (WHITE) CHUẨN GAMETORA
// Nếu Uma sở hữu kỹ năng Vàng, kỹ năng Trắng tương ứng sẽ bị khóa để chỉ kích hoạt bản Vàng
const GOLD_TO_WHITE_PAIRS = {
  'professor of curvature': 'corner adept',
  'beeline burst': 'straightaway adept',
  'swinging maestro': 'corner recovery',
  'breath of fresh air': 'straightaway recovery',
  'corner connoisseur': 'corner acceleration',
  'rushing gale!': 'straightaway acceleration',
  'rushing gale': 'straightaway acceleration',
  'no stopping me!': 'nimble navigator',
  'no stopping me': 'nimble navigator',
  'on your left!': 'slick surge',
  'on your left': 'slick surge',
  'encroaching shadow': 'straightaway spurt',
  'it\'s on!': 'ramp up',
  'it\'s on': 'ramp up',
  'playtime\'s over!': 'slipstream',
  'playtime\'s over': 'slipstream',
  'perfect spot': 'slipstream',
  'fast & furious': 'position pilfer',
  'fast and furious': 'position pilfer',
  'sharp streak': 'sharp gaze',
  'killer tunes': 'up-tempo',
  'escape artist': 'fast-paced',
  'unrestrained': 'final push',
  'top runner': 'early lead',
  'taking the lead': 'early lead',
  'vanguard spirit': 'lead the charge',
  'speed star': 'prepared to pass',
  'gourmand': 'hydrate',
  'race planner': 'preferred position',
  'go-home specialist': 'after-school stroll',
  'concentration': 'focus',
  'in body and mind': 'homestretch haste',
  'cooldown': 'deep breaths',
  'furious feat': 'updrafters',
  'rising dragon': 'outer swell',
  'sprint turbo': 'sprint acceleration',
  'plan x': 'countermeasure',
  'mile maven': 'shifting gears',
  'speed eater': 'gear shift',
  'clairvoyance': 'hawk eye',
  'mystifying murmur': 'charming',
  'dazzling disorientation': 'flustered',
  'nothing ventured': 'daredevil',
  'givin\' it 1000%': 'mad dash',
  'trackblazer': 'rosy outlook',
  'lie in wait': 'be still',
  'calm and collected': 'stamina siphon',
  'sleeping lion': 'stamina siphon',
  'indomitable': 'pace strategy',
  'iron will': 'blocked front',
  'big-sisterly': 'competitive spirit',
  'dancer in the dirt': 'dirt adept',
  'super lucky seven': 'lucky seven'
};

function normalizeSkillBaseName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\s*[◯◎○●★☆!！]+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isWhiteSupersededByOwnedGold(whiteSkillName, ownedGoldBaseNamesSet) {
  const wNorm = normalizeSkillBaseName(whiteSkillName);
  if (!wNorm) return false;
  // 1. Nếu trùng tên gốc (VD: bản ◎ đè bản ◯)
  if (ownedGoldBaseNamesSet.has(wNorm)) return true;
  // 2. Tra trong từ điển Gold -> White
  for (const goldKey of ownedGoldBaseNamesSet) {
    const mappedWhite = GOLD_TO_WHITE_PAIRS[goldKey];
    if (mappedWhite && (wNorm === mappedWhite || wNorm.includes(mappedWhite) || mappedWhite.includes(wNorm))) {
      return true;
    }
  }
  return false;
}

function pickRandomLine(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 1. NHẬN DIỆN ĐIỀU KIỆN STYLE CHẠY, CỰ LY & MẶT SÂN CỦA KỸ NĂNG CHUẨN GAMETORA
function inferSkillRestrictions(skillName, condStr, precondStr) {
  const lower = String(skillName || '').toLowerCase();
  const fullCond = `${precondStr || ''}&${condStr || ''}`;

  // Slipstream & Playtime's Over! / Perfect Spot là kỹ năng chung (Generic), không giới hạn Style/Distance
  if (lower.includes('slipstream') || lower.includes('playtime\'s over') || lower.includes('perfect spot')) {
    return { reqStyleCode: null, reqDistCode: null, reqSurfaceCode: null };
  }

  let reqStyleCode = null;
  let reqDistCode = null;
  let reqSurfaceCode = null; // 1: Turf, 2: Dirt

  const styleMatch = fullCond.match(/running_style==(\d)/);
  if (styleMatch) reqStyleCode = Number(styleMatch[1]);

  const distMatch = fullCond.match(/distance_type==(\d)/);
  if (distMatch) reqDistCode = Number(distMatch[1]);

  const surfMatch = fullCond.match(/ground_type==(\d)/);
  if (surfMatch) reqSurfaceCode = Number(surfMatch[1]);

  if (!reqStyleCode) {
    if (
      lower.includes('front runner') || lower.includes('escape artist') || lower.includes('unrestrained') ||
      lower.includes('fast-paced') || lower.includes('final push') || lower.includes('lead the charge') ||
      lower.includes('top runner') || lower.includes('vanguard spirit') || lower.includes('angling and scheming') ||
      lower.includes('view from the lead') || lower.includes('g00 1st') || lower.includes('sparkling showtime') ||
      lower.includes('turbulent gale') || lower.includes('charting the course') || lower.includes('early lead') ||
      lower.includes('sparkly☆stardom') || lower.includes('taking the lead') || lower.includes('keep the lead') ||
      lower.includes('second wind') || lower.includes('frontline') || lower.includes('dodging danger')
    ) {
      reqStyleCode = 1; // Front
    } else if (
      lower.includes('pace chaser') || lower.includes('gourmand') || lower.includes('hydrate') ||
      lower.includes('speed star') || lower.includes('prepare to pass') || lower.includes('prepared to pass') ||
      lower.includes('race planner') || lower.includes('killer tunes') || lower.includes('up-tempo') ||
      lower.includes('shrewd step') || lower.includes('keen eye') || lower.includes('teio step') ||
      lower.includes('duty of dignity') || lower.includes('blue rose closer') || lower.includes('u=ma2') ||
      lower.includes('victoria por plancha') || lower.includes('stalker') || lower.includes('head-on')
    ) {
      reqStyleCode = 2; // Pace
    } else if (
      lower.includes('late surger') || lower.includes('on your left') || lower.includes('slick surge') ||
      lower.includes('rising dragon') || lower.includes('sharp gaze') || lower.includes('sharp streak') ||
      lower.includes('fast & furious') || lower.includes('fast and furious') || lower.includes('position pilfer') ||
      lower.includes('pump some iron') || lower.includes('get moving') ||
      lower.includes('furious feat') || lower.includes('updrafters') || lower.includes('xceleration') ||
      lower.includes('focused mind') || lower.includes('i can win sometimes') || lower.includes('blazing pride') ||
      lower.includes('between the lines') || lower.includes('outer swell') || lower.includes('1,500,000 cc') ||
      lower.includes('relax')
    ) {
      reqStyleCode = 3; // Late
    } else if (
      lower.includes('end closer') || lower.includes('encroaching shadow') || lower.includes('straightaway spurt') ||
      lower.includes('go-home specialist') || lower.includes('after-school stroll') || lower.includes('sleeping lion') ||
      lower.includes('nemesis') || lower.includes('warning shot') || lower.includes('one-on-one') ||
      lower.includes('strong heart') || lower.includes('visionary') || lower.includes('masterful gambit') ||
      lower.includes('stormy seas')
    ) {
      reqStyleCode = 4; // End
    }
  }

  if (!reqDistCode) {
    if (
      lower.includes('sprint ') || lower.includes('sprinter') || lower.includes('sprint turbo') ||
      lower.includes('poise and preparation') || lower.includes('plan x') || lower.includes('countermeasure') ||
      lower.includes('huge lead') || lower.includes('breathless') || lower.includes('blinding flash')
    ) {
      reqDistCode = 1; // Sprint
    } else if (
      lower.includes('mile ') || lower.includes('miler') || lower.includes('mile maven') ||
      lower.includes('gear shift') || lower.includes('speed eater') || lower.includes('changing gears') ||
      lower.includes('shifting gears') || lower.includes('furious feat') || lower.includes('updrafters')
    ) {
      reqDistCode = 2; // Mile
    } else if (
      lower.includes('medium ') || lower.includes('clairvoyance') || lower.includes('mystifying murmur') ||
      lower.includes('thunderbolt step') || lower.includes('lightning step') || lower.includes('tempest')
    ) {
      reqDistCode = 3; // Medium
    } else if (
      lower.includes('long ') || lower.includes('stayer') || lower.includes('cooldown') ||
      lower.includes('deep breaths') || lower.includes('vanguard spirit') || lower.includes('lead the charge') ||
      lower.includes('inward experience') || lower.includes('passing pro') || lower.includes('pressure')
    ) {
      reqDistCode = 4; // Long
    }
  }

  if (!reqSurfaceCode) {
    if (lower.includes('dirt') || lower.includes('sand') || lower.includes('dancer in the dirt') || lower.includes('mud')) {
      reqSurfaceCode = 2; // Dirt
    }
  }

  return { reqStyleCode, reqDistCode, reqSurfaceCode };
}

// 2. PHÂN LOẠI TÁC DỤNG & ĐỊA HÌNH KÍCH HOẠT CHUẨN XÁC
function classifySkillAction(skillName, isUnique, isGold, rawEffects, condStr) {
  const lower = String(skillName || '').toLowerCase();
  const sCond = String(condStr || '');

  // A. STAMINA SIPHON / STAMINA EATER: Heal 0.035 (3.5%) bản thân + Debuff -0.05 (5.0%) Stamina đối thủ ở Mid-Race
  if (lower.includes('stamina siphon') || lower.includes('stamina eater') || lower.includes('siphon')) {
    return {
      category: 'siphon',
      terrainReq: null,
      healRatio: isGold ? 0.055 : 0.035,
      drainEnemyHpRatio: isGold ? 0.070 : 0.050,
      speedBoost: 0.08,
      accelBoost: 0
    };
  }

  // B. NHÓM VELOCITY MID-RACE CỐ ĐỊNH (Slipstream, Perfect Spot, Playtime's Over!, Fast & Furious, Position Pilfer, Sharp Streak, Sharp Gaze, Ramp Up, It's On!)
  if (
    lower.includes('slipstream') || lower.includes('playtime\'s over') || lower.includes('perfect spot') ||
    lower.includes('fast & furious') || lower.includes('fast and furious') || lower.includes('position pilfer') ||
    lower.includes('sharp streak') || lower.includes('sharp gaze') || lower.includes('knifelike') ||
    lower.includes('ramp up') || lower.includes('it\'s on') ||
    lower.includes('tail held high') || lower.includes('killer tunes') || lower.includes('up-tempo') ||
    lower.includes('escape artist') || lower.includes('fast-paced') ||
    lower.includes('speed eater') || lower.includes('gear shift') || lower.includes('big-sisterly') ||
    lower.includes('risk-maker')
  ) {
    return {
      category: 'velocity',
      terrainReq: null,
      forceMidRaceVelo: true,
      speedBoost: isUnique ? 0.85 : (isGold ? 0.56 : 0.32),
      accelBoost: isUnique ? 0.60 : (isGold ? 0.40 : 0.24),
      healRatio: 0
    };
  }

  // Nhận diện yêu cầu địa hình (Corner / Straight / Final Straight / Uphill / Downhill)
  let terrainReq = null;
  if (
    lower.includes('homestretch') || lower.includes('in body and mind') ||
    lower.includes('straightaway spurt') || lower.includes('encroaching shadow') ||
    sCond.includes('is_last_straight==1') || sCond.includes('is_last_straight_onetime==1')
  ) {
    terrainReq = 'final_straight';
  } else if (
    lower.includes('corner') || lower.includes('curvature') || lower.includes('maestro') ||
    lower.includes('prudent') || lower.includes('angling and scheming') ||
    lower.includes('pump some iron') || lower.includes('get moving') ||
    lower.includes('red shift') || lower.includes('shooting for victory') ||
    lower.includes('unrestrained') || lower.includes('final push') ||
    sCond.includes('corner!=0') || sCond.includes('corner_random') ||
    sCond.includes('all_corner_random') || sCond.includes('is_finalcorner==1')
  ) {
    terrainReq = 'corner';
  } else if (
    lower.includes('straightaway') || lower.includes('beeline') || lower.includes('straight line') ||
    lower.includes('rushing gale') ||
    sCond.includes('straight_random==1')
  ) {
    terrainReq = 'straight';
  } else if (lower.includes('uphill') || lower.includes('highlander') || lower.includes('mountain climber') || sCond.includes('slope==1')) {
    terrainReq = 'uphill';
  } else if (lower.includes('downhill') || lower.includes('descender') || sCond.includes('slope==2')) {
    terrainReq = 'downhill';
  }

  // C. NHÓM KỸ NĂNG XANH LÁ (PASSIVE SKILLS - Cộng thẳng Stat lúc mở cổng 0.0s)
  const passiveStatEffects = (rawEffects || []).filter(e => [1, 2, 3, 4, 5].includes(Number(e.typeCode)));
  const isGreenByKeyword =
    lower.includes('runner ◯') || lower.includes('runner ◎') ||
    lower.includes('spring runner') || lower.includes('summer runner') || lower.includes('fall runner') || lower.includes('winter runner') ||
    lower.includes('right-handed') || lower.includes('left-handed') ||
    lower.includes('standard distance') || lower.includes('non-standard distance') ||
    lower.includes('firm conditions') || lower.includes('wet conditions') ||
    lower.includes('racecourse') || lower.includes('savvy') ||
    lower.includes('sunny days') || lower.includes('cloudy days') || lower.includes('rainy days') || lower.includes('snowy days') ||
    lower.includes('lone wolf') || lower.includes('competitive spirit') || lower.includes('target in sight') ||
    lower.includes('inner post') || lower.includes('outer post') || lower.includes('sympathy') ||
    lower.includes('lucky seven') || lower.includes('super lucky seven') || lower.includes('thoroughbred');

  if (!isUnique && (passiveStatEffects.length > 0 || isGreenByKeyword)) {
    const bonusAmount = isGold || lower.includes('◎') || lower.includes('super') ? 60 : 40;
    let statBonuses = {};

    if (passiveStatEffects.length > 0) {
      passiveStatEffects.forEach(ef => {
        const keyMap = { 1: 'spd', 2: 'sta', 3: 'pow', 4: 'gut', 5: 'wit' };
        const k = keyMap[ef.typeCode] || 'spd';
        statBonuses[k] = bonusAmount;
      });
    } else if (lower.includes('standard distance') || lower.includes('non-standard') || lower.includes('racecourse')) {
      statBonuses.sta = bonusAmount;
    } else if (lower.includes('firm conditions') || lower.includes('wet conditions')) {
      statBonuses.pow = bonusAmount;
    } else if (lower.includes('savvy')) {
      statBonuses.wit = bonusAmount;
    } else if (lower.includes('lucky seven')) {
      statBonuses.spd = bonusAmount;
      statBonuses.sta = bonusAmount;
      statBonuses.pow = bonusAmount;
    } else {
      statBonuses.spd = bonusAmount;
    }

    return { category: 'passive', terrainReq: null, statBonuses, speedBoost: 0, accelBoost: 0, healRatio: 0 };
  }

  // D. NHÓM KỸ NĂNG CỔNG XUẤT PHÁT: FOCUS / CONCENTRATION / GATE
  if (lower.includes('focus') || lower.includes('concentration') || lower.includes('gate')) {
    return { category: 'gate', terrainReq: null, speedBoost: 0, accelBoost: isGold ? 1.6 : 0.9, healRatio: 0 };
  }

  // E. KỸ NĂNG ĐẶC THÙ ĐẦU TRẬN: UMA STAN / EARLY LEAD / TAKING THE LEAD
  if (
    lower.includes('uma stan') || lower.includes('superfan') ||
    lower.includes('early lead') || lower.includes('taking the lead') ||
    lower.includes('fast start') || lower.includes('groundwork')
  ) {
    const isEarlyAccel = lower.includes('early lead') || lower.includes('taking the lead') || lower.includes('groundwork');
    return {
      category: 'early_boost',
      terrainReq: null,
      speedBoost: isEarlyAccel ? (isGold ? 0.30 : 0.15) : (isGold ? 0.55 : 0.35),
      accelBoost: isEarlyAccel ? (isGold ? 1.15 : 0.65) : 0.25,
      healRatio: 0
    };
  }

  // F. KỸ NĂNG GACHA THỂ LỰC: NOTHING VENTURED / DAREDEVIL / CAREFREE
  if (lower.includes('nothing ventured') || lower.includes('daredevil') || lower.includes('carefree')) {
    return { category: 'gacha_boost', terrainReq, speedBoost: isGold ? 0.78 : 0.45, accelBoost: isGold ? 0.50 : 0.28, healRatio: 0 };
  }

  // G. KỸ NĂNG ĐỐT THỂ LỰC ĐỂ BỨT TỐC (RECOIL BOOST)
  const hpEffect = (rawEffects || []).find(e => e.stat === 'healHpRatio' || e.typeCode === 9);
  const hasPositiveMove = (rawEffects || []).some(e => (e.stat === 'targetSpeed' || e.stat === 'acceleration' || e.typeCode === 27 || e.typeCode === 31) && Number(e.value) > 0);

  if (
    (hpEffect && Number(hpEffect.value) < 0 && hasPositiveMove) ||
    lower.includes('full throttle') || lower.includes('mad dash') || lower.includes('givin\' it 1000%') ||
    lower.includes('reckless') || lower.includes('overwhelming lead') || lower.includes('supreme commander')
  ) {
    const drainPct = hpEffect && Number(hpEffect.value) < 0 ? Math.min(0.04, Math.abs(Number(hpEffect.value))) : 0.02;
    return {
      category: 'recoil_boost',
      terrainReq,
      selfHpCostRatio: drainPct,
      speedBoost: isGold ? 0.68 : 0.42,
      accelBoost: isGold ? 0.45 : 0.25,
      healRatio: 0
    };
  }

  // H. KỸ NĂNG HỒI PHỤC THỂ LỰC (HEAL)
  const isTrueHealCode = hpEffect && Number(hpEffect.value) > 0;
  if (
    isTrueHealCode ||
    lower.includes('recovery') || lower.includes('maestro') || lower.includes('gourmand') ||
    lower.includes('hydrate') || lower.includes('breath of fresh air') || lower.includes('cooldown') ||
    lower.includes('deep breaths') || lower.includes('race planner') || lower.includes('go-home') ||
    lower.includes('stroll') || lower.includes('rest') || lower.includes('relax') ||
    lower.includes('indomitable') || lower.includes('lay low') || lower.includes('iron will') ||
    lower.includes('calm and collected') || lower.includes('pure heart') || lower.includes('sleeping lion') ||
    lower.includes('be still') || lower.includes('lie in wait') || lower.includes('rosy outlook') ||
    lower.includes('trackblazer') || lower.includes('miraculous') || lower.includes('heal')
  ) {
    return {
      category: 'heal',
      terrainReq,
      speedBoost: isUnique ? 0.35 : 0.10,
      accelBoost: 0.10,
      healRatio: isUnique ? 0.075 : (isGold ? 0.055 : 0.020)
    };
  }

  // I. KỸ NĂNG DEBUFF ĐỐI THỦ
  const hasNegativeSpeed = (rawEffects || []).some(e => (e.stat === 'targetSpeed' || e.typeCode === 27) && Number(e.value) < 0);
  if (hasNegativeSpeed || lower.includes('murmur') || lower.includes('tether') || lower.includes('hesitant') || lower.includes('flustered') || lower.includes('subdue') || lower.includes('dazzling')) {
    return {
      category: 'debuff',
      terrainReq,
      speedBoost: 0.12,
      accelBoost: 0,
      healRatio: 0,
      debuffSpeed: isGold ? 0.42 : 0.24
    };
  }

  // J. KỸ NĂNG GIA TỐC (ACCELERATION) - Giữ nguyên đặc trưng terrainReq ('corner', 'straight', 'final_straight') nếu có!
  const hasAccelCode = (rawEffects || []).some(e => (e.stat === 'acceleration' || e.typeCode === 31) && Number(e.value) > 0);
  const hasVeloCode = (rawEffects || []).some(e => (e.stat === 'targetSpeed' || e.typeCode === 27) && Number(e.value) > 0);
  if (
    (hasAccelCode && !hasVeloCode) ||
    lower.includes('acceleration') || lower.includes('connoisseur') ||
    lower.includes('pump some iron') || lower.includes('get moving') ||
    lower.includes('angling and scheming') || lower.includes('no stopping me') || lower.includes('nimble navigator') ||
    lower.includes('on your left') || lower.includes('slick surge') || lower.includes('furious feat') ||
    lower.includes('updrafters') || lower.includes('rushing gale') || lower.includes('sprint turbo') ||
    lower.includes('encroaching shadow') || lower.includes('straightaway spurt') || lower.includes('charting the course') ||
    lower.includes('plan x') || lower.includes('red shift') ||
    lower.includes('shooting for victory') || lower.includes('unrestrained') || lower.includes('final push') ||
    lower.includes('head-on') || lower.includes('lightning step') || lower.includes('thunderbolt step')
  ) {
    return {
      category: 'accel',
      terrainReq,
      speedBoost: isUnique ? 0.55 : (isGold ? 0.28 : 0.14),
      accelBoost: isUnique ? 1.45 : (isGold ? 1.05 : 0.60),
      healRatio: 0
    };
  }

  // K. KỸ NĂNG TỐC ĐỘ (VELOCITY)
  let forceMidRaceVelo = false;
  if (
    sCond.includes('change_order') || sCond.includes('overtake') ||
    sCond.includes('blocked_side') || sCond.includes('near_count') ||
    sCond.includes('bashin_diff')
  ) {
    forceMidRaceVelo = true;
  }

  return {
    category: 'velocity',
    terrainReq,
    forceMidRaceVelo,
    speedBoost: isUnique ? 0.85 : (isGold ? 0.56 : 0.32),
    accelBoost: isUnique ? 0.60 : (isGold ? 0.40 : 0.24),
    healRatio: 0
  };
}

function checkPassiveGreenCondition(sk, runner, mapObj) {
  if (sk.reqStyleCode && sk.reqStyleCode !== runner.styleCode) return false;
  if (sk.reqDistCode && sk.reqDistCode !== DIST_TYPE_CODE[mapObj.distanceType]) return false;
  if (sk.reqSurfaceCode && sk.reqSurfaceCode !== (mapObj.surface === 'Dirt' ? 2 : 1)) return false;

  const lower = String(sk.name || '').toLowerCase();
  const season = mapObj.season || 'Spring';
  const cond = mapObj.trueCondition || mapObj.condition || 'Firm';
  const D = Number(mapObj.length) || 2000;
  const trackNameLower = String(mapObj.trackName || mapObj.name || '').toLowerCase();

  if (lower.includes('spring runner') && season !== 'Spring') return false;
  if (lower.includes('summer runner') && season !== 'Summer') return false;
  if ((lower.includes('fall runner') || lower.includes('autumn runner')) && season !== 'Fall') return false;
  if (lower.includes('winter runner') && season !== 'Winter') return false;

  if (lower.includes('right-handed') && mapObj.turnCode !== 1) return false;
  if (lower.includes('left-handed') && mapObj.turnCode !== 2) return false;

  if (lower.includes('non-standard distance') && D % 400 === 0) return false;
  if (lower.includes('standard distance') && !lower.includes('non-standard') && D % 400 !== 0) return false;

  if (lower.includes('firm conditions') && cond !== 'Firm') return false;
  if (lower.includes('wet conditions') && cond === 'Firm') return false;

  const tracks = ['tokyo', 'nakayama', 'hanshin', 'kyoto', 'chukyo', 'sapporo', 'hakodate', 'fukushima', 'niigata', 'kokura', 'oi'];
  for (const tr of tracks) {
    if (lower.includes(`${tr} racecourse`) && !trackNameLower.includes(tr)) {
      return false;
    }
  }

  return true;
}

// 3. CHỌN MỐC KÍCH HOẠT (TRIGGER MARK) TÔN TRỌNG TUYỆT ĐỐI RÀNG BUỘC CORNER / STRAIGHT
function pickRandomMeterInSegments(segments, minM, maxM, fallbackMinM, fallbackMaxM) {
  const validRanges = [];
  (segments || []).forEach(seg => {
    const s = Math.max(minM, Number(seg.start) || 0);
    const e = Math.min(maxM, Number(seg.end) || 0);
    if (e - s >= 12) {
      validRanges.push({ start: s + 4, end: e - 4 });
    }
  });

  if (validRanges.length > 0) {
    const picked = validRanges[Math.floor(Math.random() * validRanges.length)];
    return Math.round(picked.start + Math.random() * Math.max(4, picked.end - picked.start));
  }
  return Math.round(fallbackMinM + Math.random() * Math.max(10, fallbackMaxM - fallbackMinM));
}

function assignSkillTriggerMark(condStr, mapObj, isUnique, action) {
  const D = Number(mapObj.length) || 2000;
  const corners = mapObj.corners || [];
  const straights = mapObj.straights || [];
  const slopes = mapObj.slopes || [];
  const category = action.category;
  const terrainReq = action.terrainReq;
  const s = String(condStr || '');
  const lateStartM = Math.round((D * 2) / 3);

  if (category === 'passive' || category === 'gate') return 0;
  if (category === 'early_boost') return Math.round(D * (0.03 + Math.random() * 0.08));
  if (category === 'gacha_boost') return Math.round(D * (0.67 + Math.random() * 0.12));

  // A. Kỹ năng yêu cầu Đoạn thẳng cuối (Final Straight: Straightaway Spurt, Encroaching Shadow, Homestretch Haste...)
  if (terrainReq === 'final_straight') {
    const lastSt = straights.length > 0 ? straights[straights.length - 1] : { start: D * 0.72, end: D };
    const stStart = Math.max(lateStartM, Number(lastSt.start) || D * 0.72);
    const stEnd = Math.min(D * 0.92, Number(lastSt.end) || D * 0.92);
    // Đặt ngay đầu đoạn thẳng cuối (hoặc đầu Final Leg nếu Final Leg đã nằm trên đoạn thẳng)
    return Math.round(stStart + Math.random() * Math.min(45, Math.max(10, (stEnd - stStart) * 0.35)));
  }

  // B. Kỹ năng GIA TỐC (Accel): Phân biệt rõ có ràng buộc Corner / Straight hay không ràng buộc!
  if (category === 'accel') {
    if (s.includes('phase==0') || s.includes('phase_random==0')) {
      return Math.round(D * (0.03 + Math.random() * 0.08));
    }
    // Accel chỉ bật ở Corner (VD: Pump Some Iron của Ryan, Get Moving của Dober, Angling & Scheming, Corner Connoisseur, Unrestrained...)
    if (terrainReq === 'corner') {
      const lateCorners = corners.filter(c => Number(c.end) > lateStartM);
      if (lateCorners.length > 0) {
        const firstLateCorner = lateCorners[0];
        const cStart = Math.max(lateStartM, Number(firstLateCorner.start) || lateStartM);
        const cEnd = Math.min(D * 0.92, Number(firstLateCorner.end) || (cStart + 80));
        return Math.round(cStart + Math.random() * Math.min(40, Math.max(8, (cEnd - cStart) * 0.35)));
      }
      // Nếu từ 2/3 quãng đường trở đi không có khúc cua nào, lấy khúc cua gần nhất (nếu là Corner Acceleration chung)
      return pickRandomMeterInSegments(corners, D * 0.18, D * 0.92, lateStartM, D * 0.76);
    }
    // Accel chỉ bật ở Straightaway (VD: Straightaway Acceleration, Rushing Gale!)
    if (terrainReq === 'straight') {
      const lateStraights = straights.filter(st => Number(st.end) > lateStartM);
      if (lateStraights.length > 0) {
        const firstLateSt = lateStraights[0];
        const stStart = Math.max(lateStartM, Number(firstLateSt.start) || lateStartM);
        const stEnd = Math.min(D * 0.92, Number(firstLateSt.end) || (stStart + 80));
        return Math.round(stStart + Math.random() * Math.min(40, Math.max(8, (stEnd - stStart) * 0.35)));
      }
      return pickRandomMeterInSegments(straights, D * 0.18, D * 0.92, lateStartM, D * 0.76);
    }
    // Accel KHÔNG có ràng buộc địa hình (Nimble Navigator / No Stopping Me!, Slick Surge / On Your Left!, Updrafters / Furious Feat...):
    // Luôn nổ ngay đầu Final Leg (Accel Zone 66.7% -> 74% D)
    return Math.round(D * (0.667 + Math.random() * 0.075));
  }

  // C. Kỹ năng Velocity / Heal có ràng buộc Địa hình: Corner / Straight / Uphill / Downhill
  if (terrainReq === 'corner') {
    const minPhaseM = (s.includes('phase>=2') || s.includes('phase==2') || s.includes('is_finalcorner')) ? lateStartM : D * 0.167;
    const maxPhaseM = (s.includes('phase==1') || category === 'heal') ? lateStartM : D * 0.88;
    return pickRandomMeterInSegments(corners, minPhaseM, maxPhaseM, D * 0.25, D * 0.65);
  }

  if (terrainReq === 'straight') {
    const minPhaseM = (s.includes('phase>=2') || s.includes('phase==2')) ? lateStartM : D * 0.15;
    const maxPhaseM = (s.includes('phase==1') || category === 'heal') ? lateStartM : D * 0.88;
    return pickRandomMeterInSegments(straights, minPhaseM, maxPhaseM, D * 0.22, D * 0.64);
  }

  if (terrainReq === 'uphill') {
    const upSlopes = slopes.filter(sl => sl.type === 'uphill' || Number(sl.slope) > 0 || Number(sl.grad) > 0);
    return pickRandomMeterInSegments(upSlopes, D * 0.10, D * 0.90, D * 0.35, D * 0.75);
  }

  if (terrainReq === 'downhill') {
    const downSlopes = slopes.filter(sl => sl.type === 'downhill' || Number(sl.slope) < 0);
    return pickRandomMeterInSegments(downSlopes, D * 0.10, D * 0.90, D * 0.40, D * 0.70);
  }

  // D. Kỹ năng Unique (Velocity)
  if (isUnique) {
    if (s.includes('phase==1') || s.includes('distance_rate<=50')) {
      return Math.round(D * (0.35 + Math.random() * 0.25));
    }
    return Math.round(D * (0.667 + Math.random() * 0.15));
  }

  // E. Kỹ năng Siphon, Heal & Velocity Mid-Race (Slipstream, Fast & Furious, Sharp Streak, Ramp Up...):
  if (category === 'siphon' || category === 'heal' || action.forceMidRaceVelo) {
    return Math.round(D * (0.18 + Math.random() * 0.45));
  }

  if (s.includes('phase==0') || s.includes('phase_random==0')) {
    return Math.round(D * (0.05 + Math.random() * 0.10));
  }
  if (s.includes('phase>=2') || s.includes('phase==2') || s.includes('is_lastspurt') || s.includes('is_finalcorner')) {
    return Math.round(D * (0.67 + Math.random() * 0.16));
  }

  return Math.round(D * (0.20 + Math.random() * 0.44));
}

// 4. KIỂM TRA KÍCH HOẠT KỸ NĂNG TRONG ĐUA (GIỮ CHẶT ĐẶC TRƯNG CORNER / STRAIGHT CHO MỌI KỸ NĂNG CÓ RÀNG BUỘC)
function checkSkillCondition(sk, state) {
  // 1. Bắt buộc khớp 100% Style chạy, Cự ly và Mặt sân
  if (sk.reqStyleCode && sk.reqStyleCode !== state.styleCode) return false;
  if (sk.reqDistCode && sk.reqDistCode !== state.distTypeCode) return false;
  if (sk.reqSurfaceCode && sk.reqSurfaceCode !== state.surfaceCode) return false;

  // 2. Chưa tới mốc mét triggerMarkM thì chưa xét
  if (state.pos < sk.triggerMarkM) return false;

  // 3. Kiểm tra kỹ năng đầu trận & Gacha
  if (sk.category === 'early_boost') {
    return state.phase === 0;
  }
  if (sk.category === 'gacha_boost') {
    return state.phase >= 2;
  }

  // 4. RÀNG BUỘC ĐỊA HÌNH NGHIÊM NGẶT (Tuyệt đối không cho nổ sai địa hình!)
  if (sk.terrainReq === 'corner') {
    if (!state.onCorner) return false;
  } else if (sk.terrainReq === 'straight') {
    if (!state.onStraight) return false;
  } else if (sk.terrainReq === 'final_straight') {
    if (state.phase < 2 || !state.onStraight) return false;
  } else if (sk.terrainReq === 'uphill') {
    if (state.slopeCode !== 1) return false;
  } else if (sk.terrainReq === 'downhill') {
    if (state.slopeCode !== 2) return false;
  }

  // 5. Kỹ năng GIA TỐC (Accel):
  // - Nếu có terrainReq ('corner', 'straight', 'final_straight'), ở bước 4 đã kiểm tra đúng địa hình, giờ kiểm tra đúng giai đoạn (Final Leg phase >= 2).
  // - Nếu không có terrainReq (Nimble Navigator / No Stopping Me!, Slick Surge / On Your Left!...), nổ ngay khi vào Final Leg (phase >= 2).
  if (sk.category === 'accel') {
    const s = String(sk.condition || '');
    if (s.includes('phase==0') || s.includes('phase_random==0')) {
      return state.phase === 0;
    }
    return state.phase >= 2;
  }

  // 6. Kỹ năng SIPHON, HEAL & VELOCITY MID-RACE (Slipstream, Fast & Furious, Sharp Streak, Ramp Up...):
  if (sk.category === 'siphon' || sk.category === 'heal' || sk.forceMidRaceVelo) {
    return state.phase >= 1;
  }

  // 7. Các kỹ năng Unique & Velocity cuối trận
  const s = String(sk.condition || '');
  if (s.includes('phase>=2') || s.includes('phase==2') || s.includes('is_lastspurt') || s.includes('is_finalcorner')) {
    return state.phase >= 2;
  }

  return state.phase >= 1;
}

function simulateSixUmaRace(mapObj, player1, player2) {
  const D = Number(mapObj.length) || 2000;
  const baseSpeed = 20.0 - (D - 2000) / 1000;
  const dt = 0.25;
  const cond = mapObj.trueCondition || mapObj.condition || 'Firm';
  const season = mapObj.season || 'Spring';
  const seasonCode = SEASON_CODE[season] || 1;
  const isTieBreak = String(mapObj.slot || '').toLowerCase().includes('tie');

  const condMods = {
    Firm:  { spd: 1.05, pow: 1.00, gut: 1.00, drain: 1.00 },
    Good:  { spd: 1.00, pow: 0.95, gut: 1.00, drain: 1.00 },
    Soft:  { spd: 1.00, pow: 0.90, gut: 1.00, drain: 1.10 },
    Heavy: { spd: 0.95, pow: 0.85, gut: 1.15, drain: 1.20 }
  }[cond] || { spd: 1.00, pow: 1.00, gut: 1.00, drain: 1.00 };

  const rawParticipants = [
    ...(player1.selectedUmas || []).map((u, i) => ({ u, ownerToken: player1.sessionToken, ownerName: player1.name, teamSlot: 1, lane: i + 1 })),
    ...(player2.selectedUmas || []).map((u, i) => ({ u, ownerToken: player2.sessionToken, ownerName: player2.name, teamSlot: 2, lane: i + 4 }))
  ];

  const distTypeCode = DIST_TYPE_CODE[mapObj.distanceType] || 3;
  const surfaceCode = mapObj.surface === 'Dirt' ? 2 : 1;

  // 1. Khởi tạo 6 Uma
  const runners = rawParticipants.map((item, idx) => {
    const u = item.u;
    const apt = u.aptitudes || {};
    const style = u.activeStyle || 'Pace';
    const styleCode = RUNNING_STYLE_CODE[style] || 2;

    const surfRank = apt[mapObj.surface] || 'A';
    const distRank = apt[mapObj.distanceType] || 'A';
    const styleRank = apt[style] || 'A';

    const moodMod = MOOD_MOD[u.mood || 'Normal'] || 1.0;
    const distSpdMod = DIST_APT_SPEED_MOD[distRank] || 1.0;
    const distBasePenalty = DIST_BASE_SPEED_PENALTY[distRank] || 1.0;
    const surfPowMod = SURF_APT_POWER_MOD[surfRank] || 1.0;
    const surfDrainPenalty = SURF_DRAIN_PENALTY[surfRank] || 1.0;
    const styleWitMod = STYLE_APT_WIT_MOD[styleRank] || 1.0;
    const styleSkillRateBonus = STYLE_SKILL_RATE_MOD[styleRank] || 0;

    const rawStats = {
      spd: u.baseStats?.spd || 180,
      sta: u.baseStats?.sta || 180,
      pow: u.baseStats?.pow || 180,
      gut: u.baseStats?.gut || 180,
      wit: u.baseStats?.wit || 180
    };

    const stCoeff = STYLE_COEFF[style] || STYLE_COEFF.Pace;
    const desiredGapM = stCoeff.gapMin + Math.random() * (stCoeff.gapMax - stCoeff.gapMin);

    const skillBook = [];
    const seenSkillNames = new Set();

    // Tập hợp tên chuẩn của toàn bộ Kỹ năng Vàng (Gold) mà Uma đang sở hữu để khóa các bản Trắng (White) tương ứng
    const ownedGoldBaseNames = new Set();
    (u.skills || []).forEach(sk => {
      if (sk && sk.name && (sk.isGold || String(sk.name).includes('◎'))) {
        ownedGoldBaseNames.add(normalizeSkillBaseName(sk.name));
      }
    });

    if (u.uniqueSkill) {
      const uqData = u.uniqueSkillData || {};
      const action = classifySkillAction(u.uniqueSkill, true, true, uqData.effects, uqData.condition);
      const restrict = inferSkillRestrictions(u.uniqueSkill, uqData.condition, uqData.precondition);
      seenSkillNames.add(u.uniqueSkill);

      skillBook.push({
        id: u.uniqueSkillId || `uq_${idx}`,
        name: u.uniqueSkill,
        isUnique: true,
        isGold: true,
        category: action.category,
        terrainReq: action.terrainReq,
        forceMidRaceVelo: false,
        speedBoost: action.speedBoost,
        accelBoost: action.accelBoost,
        healRatio: action.healRatio,
        reqStyleCode: restrict.reqStyleCode,
        reqDistCode: restrict.reqDistCode,
        reqSurfaceCode: restrict.reqSurfaceCode,
        condition: uqData.condition || 'phase>=2&order<=4',
        durationSec: Math.max(3.6, Number(uqData.durationSec) || 4.0),
        triggerMarkM: assignSkillTriggerMark(uqData.condition, mapObj, true, action),
        checked: false,
        used: false
      });
    }

    // Sắp xếp để nạp Kỹ năng Vàng vào trước, Kỹ năng Trắng vào sau
    const sortedInputSkills = [...(u.skills || [])].sort((a, b) => Number(Boolean(b?.isGold)) - Number(Boolean(a?.isGold)));

    sortedInputSkills.forEach((sk, sIdx) => {
      if (!sk || !sk.name || seenSkillNames.has(sk.name)) return;
      const isGold = Boolean(sk.isGold);

      // NẾU LÀ KỸ NĂNG TRẮNG MÀ UMA ĐÃ CÓ BẢN VÀNG TƯƠNG ỨNG -> BỎ QUA KHÔNG NẠP ĐỂ ƯU TIÊN BẬT KỸ NĂNG VÀNG!
      if (!isGold && isWhiteSupersededByOwnedGold(sk.name, ownedGoldBaseNames)) {
        return;
      }

      seenSkillNames.add(sk.name);

      const m = sk.mechanics || {};
      const action = classifySkillAction(sk.name, false, isGold, m.effects, m.condition);
      const restrict = inferSkillRestrictions(sk.name, m.condition, m.precondition);

      skillBook.push({
        id: sk.skillId || `sk_${idx}_${sIdx}`,
        name: sk.name,
        isUnique: false,
        isGold,
        category: action.category,
        terrainReq: action.terrainReq,
        forceMidRaceVelo: Boolean(action.forceMidRaceVelo),
        statBonuses: action.statBonuses || null,
        selfHpCostRatio: action.selfHpCostRatio || 0,
        drainEnemyHpRatio: action.drainEnemyHpRatio || 0,
        speedBoost: action.speedBoost,
        accelBoost: action.accelBoost,
        healRatio: action.healRatio,
        debuffSpeed: action.debuffSpeed || 0,
        reqStyleCode: restrict.reqStyleCode,
        reqDistCode: restrict.reqDistCode,
        reqSurfaceCode: restrict.reqSurfaceCode,
        condition: m.condition || 'phase>=1',
        durationSec: Math.max(2.6, Number(m.durationSec) || 2.5),
        triggerMarkM: assignSkillTriggerMark(m.condition, mapObj, false, action),
        checked: false,
        used: false
      });
    });

    const runnerObj = {
      runnerId: `r_${idx}`,
      lane: item.lane,
      ownerToken: item.ownerToken,
      ownerName: item.ownerName,
      teamSlot: item.teamSlot,
      umaId: u.id,
      name: u.name,
      icon: u.icon,
      fallbackIcon: u.fallbackIcon,
      color: u.color || (item.teamSlot === 1 ? '#38bdf8' : '#f43f5e'),
      style,
      styleCode,
      surfRank,
      distRank,
      styleRank,
      moodMod,
      distSpdMod,
      distBasePenalty,
      surfPowMod,
      surfDrainPenalty,
      styleWitMod,
      styleSkillRateBonus,
      rawStats,
      mood: u.mood || 'Normal',
      effSpd: 180, effSta: 180, effPow: 180, effGut: 180, effWit: 180,
      skillActRate: 75,
      desiredGapM,
      maxHp: 2000,
      hp: 2000,
      pos: 0,
      speed: 3.0,
      order: idx + 1,
      prevOrder: idx + 1,
      finished: false,
      finishTime: 999,
      isPacemaker: false,
      rushedTimer: 0,
      downhillTimer: 0,
      dueling: false,
      blocked: false,
      outOfStamina: false,
      activeBuffs: [],
      skillBook,
      activatedSkillsLog: []
    };

    recalculateRunnerEffectiveStats(runnerObj, mapObj, condMods, D);
    return runnerObj;
  });

  function recalculateRunnerEffectiveStats(r, map, cMods, trackLen) {
    let thresholdSpeedBonus = 1.0;
    (map.thresholdStats || []).forEach(stName => {
      const key = { Speed: 'spd', Stamina: 'sta', Power: 'pow', Guts: 'gut', Wit: 'wit' }[stName];
      const val = r.rawStats[key] || 180;
      if (val >= 600) thresholdSpeedBonus += 0.10;
      else if (val >= 350) thresholdSpeedBonus += 0.05;
    });

    r.effSpd = Math.max(50, r.rawStats.spd * r.moodMod * r.distSpdMod * cMods.spd * thresholdSpeedBonus);
    r.effSta = Math.max(50, r.rawStats.sta * r.moodMod);
    r.effPow = Math.max(50, r.rawStats.pow * r.moodMod * r.surfPowMod * cMods.pow);
    r.effGut = Math.max(50, r.rawStats.gut * r.moodMod * cMods.gut);
    r.effWit = Math.max(50, r.rawStats.wit * r.moodMod * r.styleWitMod);

    const rawActRate = 75 + Math.max(0, r.effWit - 150) * 0.05 + r.styleSkillRateBonus;
    r.skillActRate = Math.min(98, Math.max(20, Number(rawActRate.toFixed(1))));

    const stCoeff = STYLE_COEFF[r.style] || STYLE_COEFF.Pace;
    r.maxHp = trackLen + 1.9 * r.effSta * stCoeff.hpMod;
    r.hp = r.maxHp;
  }

  const commentary = [];
  const frames = [];

  const pushLog = (timeSec, speaker, text, highlightType = 'normal', runnerId = null) => {
    commentary.push({
      time: Number(timeSec.toFixed(1)),
      speaker,
      text,
      highlightType,
      runnerId
    });
  };

  // 2. KÍCH HOẠT KỸ NĂNG XANH LÁ (PASSIVE CỘNG THẲNG STAT XUYÊN SUỐT TRẬN) LÚC MỞ CỔNG 0.0s
  runners.forEach(r => {
    const passiveSkills = r.skillBook.filter(sk => sk.category === 'passive');
    passiveSkills.forEach(sk => {
      sk.checked = true;
      if (checkPassiveGreenCondition(sk, r, mapObj)) {
        const roll = Math.random() * 100;
        if (roll <= r.skillActRate) {
          sk.used = true;
          r.activatedSkillsLog.push(sk.name);

          const bonusLabels = [];
          const nameMap = { spd: 'Speed', sta: 'Stamina', pow: 'Power', gut: 'Guts', wit: 'Wit' };
          Object.entries(sk.statBonuses || {}).forEach(([k, val]) => {
            r.rawStats[k] = (r.rawStats[k] || 180) + val;
            bonusLabels.push(`+${val} ${nameMap[k] || k}`);
          });

          recalculateRunnerEffectiveStats(r, mapObj, condMods, D);

          pushLog(
            0.0,
            'BLV A',
            `${r.name} bắt nhịp hoàn hảo với điều kiện sân thông qua kỹ năng "${sk.name}" (${bonusLabels.join(', ')}) xuyên suốt cả chặng đua!`,
            'skill',
            r.runnerId
          );
        }
      }
    });
  });

  // 3. Chọn Pacemaker
  for (const st of ['Front', 'Pace', 'Late', 'End']) {
    const candidates = runners.filter(r => r.style === st);
    if (candidates.length > 0) {
      candidates.sort((a, b) => (b.effWit + b.effSpd * 0.5) - (a.effWit + a.effSpd * 0.5));
      candidates[0].isPacemaker = true;
      candidates[0].desiredGapM = 0;
      break;
    }
  }

  const pmRunner = runners.find(r => r.isPacemaker);
  if (isTieBreak) {
    pushLog(
      0.0,
      'BLV B',
      `CỔNG XUẤT PHÁT ĐÃ BẬT MỞ CHO TRẬN TIE-BREAK SINH TỬ TẠI ${mapObj.name.toUpperCase()} (${D}m • Mùa ${season})! Ngay từ những bước chân đầu tiên, ${pmRunner.name} đã phóng vọt lên dẫn đầu đoàn đua!`,
      'phase'
    );
  } else {
    pushLog(
      0.0,
      'BLV B',
      `VÀ CỔNG XUẤT PHÁT ĐÃ MỞ TẠI ${mapObj.name.toUpperCase()} (${mapObj.famousRace || `${D}m`} • Mùa ${season} • Sân ${cond})! ${pmRunner.name} lập tức vươn lên chiếm lĩnh vị trí dẫn nhịp đoàn đua!`,
      'phase'
    );
  }

  runners.forEach(r => {
    if (r.distRank === 'S' || r.surfRank === 'S' || r.styleRank === 'S') {
      pushLog(0.1, 'BLV A', `Đáng chú ý! ${r.name} bước vào sân với độ thích nghi đạt cảnh giới Bậc S (${mapObj.surface}: ${r.surfRank} | ${mapObj.distanceType}: ${r.distRank} | ${r.style}: ${r.styleRank}), hứa hẹn một màn bứt tốc cực kỳ đáng gờm!`, 'gold', r.runnerId);
    } else if (['D', 'E', 'F', 'G'].includes(r.distRank) || ['D', 'E', 'F', 'G'].includes(r.surfRank) || ['D', 'E', 'F', 'G'].includes(r.styleRank)) {
      pushLog(0.1, 'BLV A', `Một thử thách đầy cam go cho ${r.name} khi phải thi đấu trái sở trường (${mapObj.surface}: ${r.surfRank} | ${mapObj.distanceType}: ${r.distRank} | ${r.style}: ${r.styleRank}) trên mặt sân hôm nay!`, 'warning', r.runnerId);
    }
  });

  // 4. Kiểm tra FOCUS / CONCENTRATION & Late Start lúc 0s
  runners.forEach(r => {
    const gateSkill = r.skillBook.find(sk => sk.category === 'gate');
    let focusedStart = false;

    if (gateSkill) {
      gateSkill.checked = true;
      if (Math.random() * 100 <= r.skillActRate) {
        gateSkill.used = true;
        focusedStart = true;
        r.activatedSkillsLog.push(gateSkill.name);
        r.activeBuffs.push({
          stat: 'accel',
          value: gateSkill.accelBoost,
          speedBonus: 0,
          remaining: 1.25,
          skillName: gateSkill.name
        });
        pushLog(0.2, 'BLV A', `Phản xạ tuyệt vời! ${r.name} kích hoạt "${gateSkill.name}", lao ra khỏi cổng xuất phát mượt như một mũi tên!`, 'skill', r.runnerId);
      }
    }

    if (!focusedStart) {
      const lateChance = Math.max(2, 13 - (r.effWit / 95));
      if (Math.random() * 100 < lateChance) {
        r.speed = 1.2;
        pushLog(0.3, 'BLV B', `Ối! ${r.name} vừa bị giật mình xuất phát chậm một nhịp (Late Start) ngay tại cổng! Liệu cô ấy có kịp lấy lại thế trận?`, 'warning', r.runnerId);
      }
    }
  });

  let t = 0;
  let announcedMid = false;
  let announcedLate = false;
  let announcedSpurt = false;
  let announcedSpotStruggle = false;
  let announcedDuel = false;
  let lastOvertakeAnnounceTime = -99;
  let currentLeaderId = pmRunner.runnerId;

  const corners = mapObj.corners || [];
  const straights = mapObj.straights || [];
  const slopes = mapObj.slopes || [];

  // 5. VÒNG LẶP MÔ PHỎNG TỪNG KHUNG HÌNH (dt = 0.25s)
  while (t < 260 && runners.some(r => !r.finished)) {
    t += dt;

    const sortedByPos = [...runners].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      return b.pos - a.pos;
    });

    sortedByPos.forEach((r, idx) => {
      const newOrder = idx + 1;
      if (t > 4.0 && !r.finished && newOrder < r.prevOrder && (t - lastOvertakeAnnounceTime >= 2.2)) {
        const overtakenRunner = sortedByPos[idx + 1];
        if (newOrder === 1 && r.runnerId !== currentLeaderId) {
          currentLeaderId = r.runnerId;
          lastOvertakeAnnounceTime = t;
          pushLog(
            t,
            'BLV B',
            pickRandomLine([
              `NGÔI ĐẦU ĐỔI CHỦ! ${r.name} đã bất ngờ tăng tốc vượt mặt ${overtakenRunner ? overtakenRunner.name : 'đối thủ'} để vươn lên chiếm lĩnh vị trí dẫn đầu đoàn đua!`,
              `Không thể cản phá! ${r.name} lao lên như một cơn lốc, chính thức cướp lấy vị trí thứ nhất từ tay ${overtakenRunner ? overtakenRunner.name : 'đối thủ'}!`,
              `Một pha bứt lên quá ấn tượng! ${r.name} đã vượt qua ${overtakenRunner ? overtakenRunner.name : 'nhóm đầu'} để độc chiếm ngôi đầu bảng!`
            ]),
            'gold',
            r.runnerId
          );
        } else if (newOrder <= 3 && r.prevOrder - newOrder >= 1 && t > 10.0) {
          lastOvertakeAnnounceTime = t;
          pushLog(
            t,
            'BLV A',
            pickRandomLine([
              `${r.name} đã bất ngờ vượt lên giành lấy vị trí thứ ${newOrder} sau pha tăng tốc sắc bén!`,
              `Bước chạy đầy uy lực! ${r.name} vừa lách qua ${overtakenRunner ? overtakenRunner.name : 'đối thủ'} để tiến vào Top ${newOrder}!`,
              `Thứ hạng liên tục xáo trộn! ${r.name} đã vươn lên vị trí thứ ${newOrder} và đang bám sát nhóm dẫn đầu!`
            ]),
            'info',
            r.runnerId
          );
        }
      }
      r.prevOrder = newOrder;
      r.order = newOrder;
    });

    const pacemaker = runners.find(r => r.isPacemaker && !r.finished) || sortedByPos[0];
    const leadPos = sortedByPos[0].pos;

    if (!announcedMid && leadPos >= D / 6) {
      announcedMid = true;
      pushLog(
        t,
        'BLV A',
        `Đoàn đua chính thức bước vào Giữa chặng (Middle Leg — ${Math.round(D / 6)}m). ${sortedByPos[0].name} vẫn đang làm chủ nhịp độ phía trước, trong khi các nhóm sau âm thầm tích lũy thể lực chờ thời cơ!`,
        'phase'
      );
    }
    if (!announcedLate && leadPos >= (D * 2) / 3) {
      announcedLate = true;
      pushLog(
        t,
        'BLV A',
        `ĐÃ CHẠM MỐC 2/3 QUÃNG ĐƯỜNG (${Math.round((D * 2) / 3)}m — Final Leg)! Mọi toan tính giữ sức đã khép lại, tất cả các Uma từ nhóm sau bắt đầu tung hết tốc lực tràn lên!`,
        'phase'
      );
    }
    if (!announcedSpurt && leadPos >= (D * 5) / 6) {
      announcedSpurt = true;
      pushLog(
        t,
        'BLV B',
        `CHẶNG NƯỚC RÚT CUỐI CÙNG (LAST SPURT)! Chỉ còn chưa đầy ${Math.round(D / 6)} mét nữa thôi! Khán đài đang nổ tung trước màn nước rút tốc độ cực đại về phía vạch đích!`,
        'phase'
      );
    }

    if (!announcedSpotStruggle && leadPos > 45 && leadPos < D * 0.28) {
      const frontRunners = runners.filter(r => r.style === 'Front' && r.order <= 2);
      if (frontRunners.length >= 2 && Math.abs(frontRunners[0].pos - frontRunners[1].pos) < 3.5) {
        announcedSpotStruggle = true;
        frontRunners.forEach(fr => {
          fr.activeBuffs.push({ stat: 'speed', value: 0.32, remaining: 3.0, skillName: 'Spot Struggle' });
        });
        pushLog(
          t,
          'BLV B',
          `Không ai chịu nhường ai! Hai Front Runner ${frontRunners[0].name} và ${frontRunners[1].name} đang lao vào thế giằng co quyết liệt (Spot Struggle) để tranh giành quyền dẫn đầu!`,
          'info'
        );
      }
    }

    for (const r of runners) {
      if (r.finished) continue;

      const phase = r.pos < D / 6 ? 0 : (r.pos < (D * 2) / 3 ? 1 : (r.pos < (D * 5) / 6 ? 2 : 3));
      const onCorner = corners.some(c => r.pos >= c.start && r.pos <= c.end);
      const onStraight = straights.some(s => r.pos >= s.start && r.pos <= s.end) || !onCorner;
      const activeSlope = slopes.find(sl => r.pos >= sl.start && r.pos <= sl.end);
      const isUphill = activeSlope && (activeSlope.type === 'uphill' || Number(activeSlope.slope) > 0 || Number(activeSlope.grad) > 0);
      const slopeCode = activeSlope ? (isUphill ? 1 : 2) : 0;

      if (phase === 1 && !r.checkedKakari && r.pos > D * 0.25) {
        r.checkedKakari = true;
        const lowStylePenalty = ['D', 'E', 'F', 'G'].includes(r.styleRank) ? 14 : 0;
        const kakariChance = Math.max(2, 14 - r.effWit / 45 + lowStylePenalty);
        if (Math.random() * 100 < kakariChance) {
          r.rushedTimer = 4.0;
          pushLog(
            t,
            'BLV B',
            `Nguy rồi! ${r.name} đang mất bình tĩnh và rơi vào trạng thái hăng máu (Rushed), tự ý lao vọt lên sớm nhưng đang đốt sạch thể lực!`,
            'warning',
            r.runnerId
          );
        }
      }

      if (slopeCode === 2 && r.downhillTimer <= 0 && Math.random() < 0.14 + r.effWit * 0.0002) {
        r.downhillTimer = 3.0;
      }

      r.dueling = false;
      if (phase >= 2 && onStraight && r.pos > D * 0.72) {
        const rival = runners.find(other => other.runnerId !== r.runnerId && !other.finished && Math.abs(other.pos - r.pos) < 3.0);
        if (rival) {
          r.dueling = true;
          if (!announcedDuel && r.order <= 3) {
            announcedDuel = true;
            pushLog(
              t,
              'BLV B',
              `MÀN ĐỌ SỨC NGHẸT THỞ (OIKURABE)! ${r.name} và ${rival.name} đang kè sát vai nhau từng xăng-ti-mét cỏ trên đường thẳng cuối! Ai sẽ là người bứt lên?!`,
              'gold',
              r.runnerId
            );
          }
        }
      }

      const stateForSkill = {
        pos: r.pos,
        trackLen: D,
        phase,
        distRate: Math.round((r.pos / D) * 100),
        remainDist: Math.round(D - r.pos),
        onCorner,
        onStraight,
        slopeCode,
        order: r.order,
        orderRate: Math.round((r.order / 6) * 100),
        styleCode: r.styleCode,
        distTypeCode,
        surfaceCode,
        seasonCode
      };

      for (const sk of r.skillBook) {
        if (sk.used || sk.checked || sk.category === 'passive' || sk.category === 'gate') continue;

        if (checkSkillCondition(sk, stateForSkill)) {
          sk.checked = true;
          const roll = Math.random() * 100;
          if (roll <= r.skillActRate) {
            sk.used = true;
            r.activatedSkillsLog.push(sk.name);

            let commentaryText = '';

            if (sk.category === 'siphon') {
              // STAMINA SIPHON: Hồi +3.5% HP bản thân & Rút -5.0% HP của đối thủ dẫn đầu
              const healPct = sk.healRatio || 0.035;
              const drainPct = sk.drainEnemyHpRatio || 0.050;
              r.hp = Math.min(r.maxHp, r.hp + r.maxHp * healPct);
              r.outOfStamina = false;
              r.activeBuffs.push({ stat: 'speed', value: sk.speedBoost || 0.08, accelBonus: 0.05, remaining: 2.0, skillName: sk.name });

              const enemyTarget = sortedByPos.find(o => o.teamSlot !== r.teamSlot && !o.finished);
              if (enemyTarget) {
                enemyTarget.hp = Math.max(10, enemyTarget.hp - enemyTarget.maxHp * drainPct);
                commentaryText = `Một pha rút sức bền cực kỳ lợi hại! ${r.name} kích hoạt "${sk.name}", tự hồi phục +${(healPct * 100).toFixed(1)}% Thể lực đồng thời hút đi -${(drainPct * 100).toFixed(1)}% Thể lực của ${enemyTarget.name}!`;
              } else {
                commentaryText = `${r.name} kích hoạt "${sk.name}", hồi phục +${(healPct * 100).toFixed(1)}% Thể lực và gây sức ép lên đối phương!`;
              }
            } else if (sk.category === 'gacha_boost') {
              const gachaRoll = Math.random() * 100;
              r.activeBuffs.push({
                stat: 'speed',
                value: sk.speedBoost,
                accelBonus: sk.accelBoost,
                remaining: sk.durationSec,
                skillName: sk.name
              });

              if (gachaRoll < 60) {
                commentaryText = `Canh bạc tất tay của ${r.name}! Cô ấy tung kỹ năng "${sk.name}" lao vút đi mà KHÔNG hề tiêu hao thêm chút thể lực nào (Trúng Gacha 60%)!`;
              } else if (gachaRoll < 90) {
                r.hp = Math.max(0, r.hp - r.maxHp * 0.02);
                commentaryText = `${r.name} quyết định chơi lớn với "${sk.name}", chấp nhận đánh đổi 2% Thể lực (Gacha 30%) để đổi lấy cú bứt tốc cực gắt ở Hạng ${r.order}!`;
              } else {
                r.hp = Math.max(0, r.hp - r.maxHp * 0.04);
                commentaryText = `Một pha liều mạng thực sự! ${r.name} kích hoạt "${sk.name}" bứt tốc điên cuồng dù phải trả giá bằng 4% Thể lực (Gacha 10%)!`;
              }
            } else if (sk.category === 'recoil_boost') {
              const costPct = sk.selfHpCostRatio || 0.02;
              r.hp = Math.max(0, r.hp - r.maxHp * costPct);
              r.activeBuffs.push({
                stat: 'speed',
                value: sk.speedBoost,
                accelBonus: sk.accelBoost,
                remaining: sk.durationSec,
                skillName: sk.name
              });
              commentaryText = `${r.name} đốt cháy ${(costPct * 100).toFixed(0)}% Thể lực bằng kỹ năng "${sk.name}", đẩy tốc độ lên ngưỡng cực hạn!`;
            } else if (sk.category === 'heal') {
              r.hp = Math.min(r.maxHp, r.hp + r.maxHp * sk.healRatio);
              r.outOfStamina = false;
              r.activeBuffs.push({ stat: 'speed', value: sk.speedBoost, accelBonus: 0.10, remaining: 2.0, skillName: sk.name });
              commentaryText = pickRandomLine([
                `Nhịp thở của ${r.name} đã ổn định trở lại nhờ "${sk.name}" (+${(sk.healRatio * 100).toFixed(1)}% Thể lực), sẵn sàng cho màn nước rút quyết định!`,
                `Đúng vào thời điểm quan trọng, ${r.name} kích hoạt "${sk.name}" hồi phục nguồn thể lực dồi dào (+${(sk.healRatio * 100).toFixed(1)}% HP)!`
              ]);
            } else if (sk.category === 'debuff') {
              const enemyTarget = sortedByPos.find(o => o.teamSlot !== r.teamSlot && !o.finished);
              if (enemyTarget) {
                enemyTarget.hp = Math.max(10, enemyTarget.hp - enemyTarget.maxHp * 0.03);
                enemyTarget.activeBuffs.push({ stat: 'speed', value: -sk.debuffSpeed, remaining: 2.8, skillName: sk.name });
                commentaryText = `Đòn tâm lý chiến sắc lạnh! ${r.name} tung "${sk.name}" gây áp lực trực tiếp làm chùn bước chạy của ${enemyTarget.name}!`;
              } else {
                commentaryText = `${r.name} tung kỹ năng "${sk.name}" gây sức ép lên đối thủ!`;
              }
            } else if (sk.category === 'accel') {
              r.activeBuffs.push({
                stat: 'accel',
                value: sk.accelBoost,
                speedBonus: sk.speedBoost,
                remaining: sk.durationSec,
                skillName: sk.name
              });
              const accLoc = sk.terrainReq === 'corner'
                ? 'ngay tại khúc cua quyết định'
                : (sk.terrainReq === 'straight' || sk.terrainReq === 'final_straight' ? 'trên đoạn đường thẳng' : 'ở đầu Final Leg');
              commentaryText = pickRandomLine([
                `Cú đạp đất bùng nổ ${accLoc}! ${r.name} kích hoạt "${sk.name}", gia tốc tăng vọt giúp cô ấy phóng lên như một viên đạn từ vị trí thứ ${r.order}!`,
                `Thời cơ bứt phá đã điểm! ${r.name} bung kỹ năng gia tốc "${sk.name}" ${accLoc} và lập tức thu hẹp khoảng cách với nhóm dẫn đầu!`
              ]);
            } else {
              r.activeBuffs.push({
                stat: 'speed',
                value: sk.speedBoost,
                accelBonus: sk.accelBoost,
                remaining: sk.durationSec,
                skillName: sk.name
              });

              const locText = sk.terrainReq === 'corner' ? 'ngay tại khúc cua' : (sk.terrainReq === 'straight' || sk.terrainReq === 'final_straight' ? 'trên đoạn đường thẳng' : 'trên đường đua');

              if (sk.isUnique) {
                commentaryText = pickRandomLine([
                  `TUYỆT KỸ ĐỘC QUYỀN BÙNG NỔ! Hào quang rực sáng quanh ${r.name} khi cô ấy tung ra "${sk.name}", xé gió lao thẳng về phía trước!`,
                  `ĐÂY RỒI! "${sk.name}" đã được ${r.name} kích hoạt! Những sải chân thần tốc đang cuốn phăng mọi khoảng cách ${locText}!`
                ]);
              } else if (sk.isGold) {
                commentaryText = pickRandomLine([
                  `Ánh kim rực sáng! ${r.name} bung kỹ năng vàng "${sk.name}" ${locText}, guồng chân tăng tốc mạnh mẽ ở vị trí thứ ${r.order}!`,
                  `Pha bứt tốc đẳng cấp từ ${r.name} với kỹ năng vàng "${sk.name}" ${locText}! Tốc độ của cô ấy đang tăng lên trông thấy!`
                ]);
              } else {
                commentaryText = `${r.name} kích hoạt "${sk.name}" ${locText}, dồn lực tăng tốc bám đuổi quyết liệt ở vị trí thứ ${r.order}!`;
              }
            }

            const speaker = (sk.isUnique || sk.isGold || sk.category === 'gacha_boost') ? 'BLV B' : 'BLV A';
            const highlight = sk.isUnique ? 'unique' : (sk.isGold ? 'gold' : 'skill');

            pushLog(t, speaker, commentaryText, highlight, r.runnerId);
          }
        }
      }

      // 6. TÍNH TARGET SPEED & POSITION KEEP
      const stCoeff = STYLE_COEFF[r.style] || STYLE_COEFF.Pace;
      const effCoeff = r.isPacemaker ? STYLE_COEFF.Front : stCoeff;

      let activeSpdBuff = 0;
      let activeAccBuff = 0;
      r.activeBuffs = r.activeBuffs.filter(b => {
        b.remaining -= dt;
        if (b.remaining > 0) {
          if (b.stat === 'speed') {
            activeSpdBuff += b.value;
            activeAccBuff += (b.accelBonus || 0);
          } else if (b.stat === 'accel') {
            activeAccBuff += b.value;
            activeSpdBuff += (b.speedBonus || 0);
          }
          return true;
        }
        return false;
      });

      const witJitter = (r.effWit / 5500) * 0.25;
      let targetSpeed = baseSpeed * r.distBasePenalty;

      if (phase === 0) {
        targetSpeed = baseSpeed * effCoeff.p0 * r.distBasePenalty + witJitter;
      } else if (phase === 1) {
        targetSpeed = baseSpeed * effCoeff.p1 * r.distBasePenalty + witJitter;
      } else if (phase === 2) {
        const speedStatBonus = Math.sqrt(500 * r.effSpd) * 0.0028 + (r.effSpd / 520);
        targetSpeed = (baseSpeed * stCoeff.p2 * r.distBasePenalty + speedStatBonus) * stCoeff.spurtMult;
      } else {
        const speedStatBonus = Math.sqrt(500 * r.effSpd) * 0.0032 + (r.effSpd / 440);
        const gutsBonus = Math.pow(450 * r.effGut, 0.597) * 0.0003 + (r.effGut / 1400);
        targetSpeed = ((baseSpeed * stCoeff.p2 * r.distBasePenalty + 0.30) * 1.035 + speedStatBonus + gutsBonus) * stCoeff.spurtMult;
      }

      if (phase <= 1 && !r.isPacemaker && pacemaker) {
        const currentGap = pacemaker.pos - r.pos;
        const minGap = r.desiredGapM - 1.5;
        const maxGap = r.desiredGapM + 2.5;

        if (activeSpdBuff <= 0.05 && r.rushedTimer <= 0) {
          if (currentGap < minGap) {
            targetSpeed = Math.max(baseSpeed * 0.92, pacemaker.speed - 0.42);
          } else if (currentGap > maxGap) {
            targetSpeed = Math.min(baseSpeed * 1.04, pacemaker.speed + 0.45);
          } else {
            targetSpeed = pacemaker.speed + (currentGap - r.desiredGapM) * 0.06;
          }
          targetSpeed *= r.distBasePenalty;
        }
      }

      if (slopeCode === 1) {
        targetSpeed -= 220 / Math.max(110, r.effPow);
      } else if (r.downhillTimer > 0) {
        targetSpeed += 0.35;
        r.downhillTimer -= dt;
      }

      if (r.rushedTimer > 0) {
        targetSpeed += 0.35;
        r.rushedTimer -= dt;
      }
      if (r.dueling) {
        targetSpeed += 0.28 + (r.effGut / 1100);
        activeAccBuff += 0.45;
      }

      targetSpeed += activeSpdBuff;

      r.blocked = false;
      if (phase >= 2 && r.order >= 3 && activeAccBuff <= 0.4) {
        const blockersAhead = runners.filter(o => o.runnerId !== r.runnerId && o.pos > r.pos && o.pos - r.pos < 1.6);
        if (blockersAhead.length >= 2 && Math.random() * 100 > 60 + r.effPow / 16) {
          r.blocked = true;
          targetSpeed = Math.min(targetSpeed, blockersAhead[0].speed * 0.98);
        }
      }

      if (r.hp <= 0) {
        if (!r.outOfStamina) {
          r.outOfStamina = true;
          pushLog(
            t,
            'BLV A',
            `Không ổn rồi! ${r.name} đã cạn kiệt toàn bộ Thể lực ngay trước vạch đích, bước chạy đang chững lại thấy rõ!`,
            'warning',
            r.runnerId
          );
        }
        targetSpeed = baseSpeed * 0.84;
      }

      targetSpeed = Math.max(baseSpeed * 0.75, targetSpeed);

      const accStyleMod = phase === 0 ? effCoeff.a0 : (phase === 1 ? effCoeff.a1 : stCoeff.a2);
      const startDashAcc = r.pos < 25 ? effCoeff.startDashBonus : 0.0;
      const powerAcc = (0.32 + Math.sqrt(r.effPow) * 0.036) * accStyleMod;
      const totalAcc = powerAcc + startDashAcc + activeAccBuff;

      if (r.speed < targetSpeed) {
        r.speed = Math.min(targetSpeed, r.speed + totalAcc * dt);
      } else {
        const decelRate = phase <= 1 ? 0.95 : 0.75;
        r.speed = Math.max(targetSpeed, r.speed - decelRate * dt);
      }

      const speedFactor = Math.pow(Math.max(1, r.speed - baseSpeed + 12.0), 2) / 144.0;
      const statusDrainMod = (r.rushedTimer > 0 ? 1.6 : 1.0) * (r.downhillTimer > 0 ? 0.4 : 1.0);
      const spurtDrainMod = phase >= 2 ? (1.0 + 180 / Math.sqrt(600 * r.effGut)) : 1.0;

      const hpDrain = 20.0 * speedFactor * condMods.drain * r.surfDrainPenalty * statusDrainMod * spurtDrainMod * dt;
      r.hp = Math.max(0, r.hp - hpDrain);

      r.pos += r.speed * dt;
      if (r.pos >= D) {
        const overshoot = r.pos - D;
        r.finishTime = Number((t - overshoot / Math.max(1, r.speed)).toFixed(3));
        r.pos = D;
        r.finished = true;
      }
    }

    const frameMaxPos = Math.max(...runners.map(r => r.pos));
    frames.push({
      t: Number(t.toFixed(2)),
      leadPos: Number(frameMaxPos.toFixed(1)),
      runners: runners.map(r => {
        const gapM = r.finished ? 0 : Math.max(0, frameMaxPos - r.pos);
        const hasActiveSkill = r.activeBuffs.length > 0;
        return {
          id: r.runnerId,
          pos: Number(r.pos.toFixed(1)),
          gapM: Number(gapM.toFixed(1)),
          finished: r.finished,
          finishTime: r.finished ? r.finishTime : null,
          spd: Number(r.speed.toFixed(1)),
          hpPct: Math.round((r.hp / r.maxHp) * 100),
          order: r.order,
          surging: hasActiveSkill || r.dueling,
          activeSkill: hasActiveSkill ? r.activeBuffs[r.activeBuffs.length - 1].skillName : null,
          status: r.outOfStamina ? 'NO STA' : (r.dueling ? 'DUEL!' : (r.rushedTimer > 0 ? 'RUSHED' : (r.blocked ? 'BLOCKED' : '')))
        };
      })
    });
  }

  // 7. XẾP HẠNG CHUNG CUỘC & BÌNH LUẬN KHOẢNH KHẮC CÁN ĐÍCH
  const finalStandings = [...runners].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    return b.pos - a.pos;
  });

  const POINT_TABLE = [4, 2, 1, 0, 0, 0];
  const scoreDelta = {
    [player1.sessionToken]: 0,
    [player2.sessionToken]: 0
  };

  const resultsTable = finalStandings.map((r, idx) => {
    const rank = idx + 1;
    const pts = POINT_TABLE[idx] || 0;
    scoreDelta[r.ownerToken] = (scoreDelta[r.ownerToken] || 0) + pts;
    return {
      rank,
      pointsEarned: pts,
      runnerId: r.runnerId,
      name: r.name,
      icon: r.icon,
      fallbackIcon: r.fallbackIcon,
      style: r.style,
      surfRank: r.surfRank,
      distRank: r.distRank,
      styleRank: r.styleRank,
      ownerToken: r.ownerToken,
      ownerName: r.ownerName,
      teamSlot: r.teamSlot,
      finishTime: r.finishTime < 900 ? `${r.finishTime.toFixed(2)}s` : 'DNF',
      finishTimeSec: r.finishTime,
      activatedSkills: r.activatedSkillsLog
    };
  });

  const winner = resultsTable[0];
  const second = resultsTable[1];
  const third = resultsTable[2];
  const endTime = frames[frames.length - 1]?.t || t;
  const timeDiff = Math.max(0.01, (second.finishTimeSec || endTime) - (winner.finishTimeSec || endTime));

  if (timeDiff <= 0.12) {
    pushLog(
      endTime,
      'BLV B',
      `SO KÈ ĐẾN TỪNG MILI-GIÂY CUỐI CÙNG! VÀ ${winner.name.toUpperCase()} ĐÃ CÁN ĐÍCH Ở VỊ TRÍ THỨ NHẤTTTTTTTTTTT!!!! Chỉ nhỉnh hơn ${second.name} đúng một cái đầu mũi (${timeDiff.toFixed(2)}s)!`,
      'finish',
      winner.runnerId
    );
  } else {
    pushLog(
      endTime,
      'BLV B',
      `${winner.name.toUpperCase()} ĐÃ CÁN ĐÍCH Ở VỊ TRÍ THỨ NHẤTTTTTTTTTTT!!!! Một cú nước rút quá đỗi hoàn hảo để bỏ lại ${second.name} (Hạng 2) và ${third.name} (Hạng 3) phía sau!`,
      'finish',
      winner.runnerId
    );
  }

  const p1Before = Number(player1.score) || 0;
  const p2Before = Number(player2.score) || 0;
  const p1After = p1Before + (scoreDelta[player1.sessionToken] || 0);
  const p2After = p2Before + (scoreDelta[player2.sessionToken] || 0);

  if (isTieBreak) {
    pushLog(
      endTime,
      'BLV A',
      `${winner.name} đã thành công giúp đội của ${winner.ownerName} lật ngược thế cờ và giành chiến thắng chung cuộc ở trận đấu Tie-break nghẹt thở!`,
      'gold',
      winner.runnerId
    );
  } else if (p1After >= 25 || p2After >= 25) {
    const champ = p1After >= p2After ? player1 : player2;
    const loser = p1After >= p2After ? player2 : player1;
    const wasBehind = (champ.sessionToken === player1.sessionToken && p1Before < p2Before) ||
                      (champ.sessionToken === player2.sessionToken && p2Before < p1Before);
    if (wasBehind) {
      pushLog(
        endTime,
        'BLV A',
        `MỘT CÚ LỘI NGƯỢC DÒNG LỊCH SỬ! ${winner.name} đã giúp đội của ${champ.name} lật ngược thế cờ, chính thức vượt mốc 25 điểm để đăng quang ngôi vô địch!`,
        'gold',
        winner.runnerId
      );
    } else {
      pushLog(
        endTime,
        'BLV A',
        `Chiến thắng tại ${mapObj.name} đã chính thức đưa ${champ.name} chạm mốc điểm chiến thắng (${Math.max(p1After, p2After)} - ${Math.min(p1After, p2After)}) trước ${loser.name}!`,
        'gold',
        winner.runnerId
      );
    }
  } else {
    const winTrainerAfter = winner.ownerToken === player1.sessionToken ? p1After : p2After;
    const oppTrainerAfter = winner.ownerToken === player1.sessionToken ? p2After : p1After;
    const winTrainerBefore = winner.ownerToken === player1.sessionToken ? p1Before : p2Before;
    const oppTrainerBefore = winner.ownerToken === player1.sessionToken ? p2Before : p1Before;

    if (winTrainerBefore < oppTrainerBefore && winTrainerAfter >= oppTrainerAfter) {
      pushLog(
        endTime,
        'BLV A',
        `Cục diện trận đấu đã đảo chiều! Nhờ màn tỏa sáng của ${winner.name}, đội của ${winner.ownerName} đã lật ngược thế cờ vươn lên dẫn điểm (${winTrainerAfter} - ${oppTrainerAfter})!`,
        'info',
        winner.runnerId
      );
    } else {
      pushLog(
        endTime,
        'BLV A',
        `Khép lại chặng ${mapObj.slot}, ${winner.name} mang về 4 điểm quý giá cho ${winner.ownerName} (Tỉ số hiện tại: ${player1.name} ${p1After} - ${p2After} ${player2.name}).`,
        'info',
        winner.runnerId
      );
    }
  }

  return {
    map: mapObj,
    runnersMeta: runners.map(r => ({
      runnerId: r.runnerId,
      lane: r.lane,
      name: r.name,
      icon: r.icon,
      fallbackIcon: r.fallbackIcon,
      style: r.style,
      surfRank: r.surfRank,
      distRank: r.distRank,
      styleRank: r.styleRank,
      ownerToken: r.ownerToken,
      ownerName: r.ownerName,
      teamSlot: r.teamSlot,
      skillActRate: r.skillActRate
    })),
    frames,
    commentary,
    resultsTable,
    scoreDelta
  };
}

module.exports = {
  simulateSixUmaRace
};