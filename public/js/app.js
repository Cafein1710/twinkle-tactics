// public/js/app.js - Giao diện Chuẩn Khung 3 Dòng (Không tràn viền, Gom nhóm Thích nghi 1 hàng & Phân vùng Bàn đấu)

const socket = io();
let currentRoomCode = '';
let umaPool = [];
let supportPool = [];
let currentMapsList = [];
let selectedUmaIds = [];   // Bắt đầu từ 0/3 Uma (người chơi tự chọn)
let selectedDeckUids = []; // Bắt đầu từ 0/40 Card (người chơi tự chọn hoặc bấm nút Chọn Nhanh)
let allocatedSparks = {};
let currentUmaFilter = 'ALL';
let currentCardTypeFilter = 'ALL';
let currentPreGameStep = 1;
let countdownInterval = null;
let revealTimers = [];
let draggedPayload = null;
let lastAnimatedUmaIndex = null;
let latestGameState = null;

let sessionToken = localStorage.getItem('twinkle_session_token');
if (!sessionToken) {
  sessionToken = 'user_' + Math.random().toString(36).substring(2, 11);
  localStorage.setItem('twinkle_session_token', sessionToken);
}

const RANKS = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S'];

const TYPE_THEME_COLORS = {
  Speed:   { main: '#38bdf8', bg: 'rgba(14, 165, 233, 0.12)', border: 'rgba(56, 189, 248, 0.45)', short: 'SPD' },
  Stamina: { main: '#fb7185', bg: 'rgba(244, 63, 94, 0.12)',  border: 'rgba(251, 113, 133, 0.45)', short: 'STA' },
  Power:   { main: '#fbbf24', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(251, 191, 36, 0.45)',  short: 'POW' },
  Guts:    { main: '#f472b6', bg: 'rgba(236, 72, 153, 0.12)', border: 'rgba(244, 114, 182, 0.45)', short: 'GUT' },
  Wit:     { main: '#34d399', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(52, 211, 153, 0.45)',  short: 'WIT' }
};

function splitEntityNameAndTitle(rawName) {
  const str = String(rawName || '').trim();
  const match = str.match(/^([^\(\[]+)[\(\[]([^\)\]]+)[\)\]]$/);
  if (match) {
    return { mainName: match[1].trim(), subTitle: match[2].trim() };
  }
  return { mainName: str, subTitle: '' };
}

// Gom nhóm Thích nghi thành đúng 3 Cụm gọn trên 1 dòng duy nhất (Mặt sân • Cự ly • Chiến thuật) để không bao giờ bị tràn khung
function renderStrongAptitudeBadges(aptitudes) {
  if (!aptitudes) return '';
  const shortMap = {
    Turf: 'Turf', Dirt: 'Dirt',
    Sprint: 'Spr', Mile: 'Mile', Medium: 'Med', Long: 'Long',
    Front: 'Front', Pace: 'Pace', Late: 'Late', End: 'End'
  };

  const buildGroupChip = (keys, bg, border, textCol) => {
    const sList = keys.filter(k => aptitudes[k] === 'S').map(k => shortMap[k]);
    const aList = keys.filter(k => aptitudes[k] === 'A').map(k => shortMap[k]);
    const bList = keys.filter(k => aptitudes[k] === 'B').map(k => shortMap[k]);

    const parts = [];
    if (sList.length > 0) {
      parts.push(`${sList.join('/')} <b style="color:#facc15;">S</b>`);
    }
    if (aList.length > 0) {
      parts.push(`${aList.join('/')} <b style="color:#fb7185;">A</b>`);
    }
    if (parts.length === 0 && bList.length > 0) {
      parts.push(`${bList.join('/')} <b style="color:#cbd5e1;">B</b>`);
    }
    if (parts.length === 0) return '';

    return `<span class="apt-compact-chip" style="background:${bg}; border-color:${border}; color:${textCol};">${parts.join(' • ')}</span>`;
  };

  const surfChip = buildGroupChip(['Turf', 'Dirt'], 'rgba(16, 185, 129, 0.14)', 'rgba(16, 185, 129, 0.4)', '#6ee7b7');
  const distChip = buildGroupChip(['Sprint', 'Mile', 'Medium', 'Long'], 'rgba(56, 189, 248, 0.14)', 'rgba(56, 189, 248, 0.4)', '#bae6fd');
  const styleChip = buildGroupChip(['Front', 'Pace', 'Late', 'End'], 'rgba(168, 85, 247, 0.14)', 'rgba(168, 85, 247, 0.4)', '#e9d5ff');

  return [surfChip, distChip, styleChip].filter(Boolean).join('');
}

const GOLD_TO_WHITE_PAIRS_UI = {
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

function normalizeSkillBaseNameUI(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\s*[◯◎○●★☆!！]+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isWhiteSupersededByOwnedGoldUI(whiteSkillName, ownedGoldBaseNamesSet) {
  const wNorm = normalizeSkillBaseNameUI(whiteSkillName);
  if (!wNorm) return false;
  if (ownedGoldBaseNamesSet.has(wNorm)) return true;
  for (const goldKey of ownedGoldBaseNamesSet) {
    const mappedWhite = GOLD_TO_WHITE_PAIRS_UI[goldKey];
    if (mappedWhite && (wNorm === mappedWhite || wNorm.includes(mappedWhite) || mappedWhite.includes(wNorm))) {
      return true;
    }
  }
  return false;
}

// =========================================================================
// BỘ NHẬN DIỆN TAG (STYLE / DISTANCE / DIRT) & CÔNG DỤNG KỸ NĂNG CHUẨN GAMETORA
// =========================================================================
function getSkillGameToraMeta(skillName, mechanicsObj) {
  const name = String(skillName || '').trim();
  const lower = name.toLowerCase();
  const m = mechanicsObj || {};
  const fullCond = `${m.precondition || ''}&${m.condition || ''}`;
  const rawEffects = m.effects || [];

  if (lower.includes('slipstream') || lower.includes('playtime\'s over') || lower.includes('perfect spot')) {
    return {
      name,
      parenText: '',
      roleShort: 'Velo•Mid',
      roleColor: '#38bdf8',
      tooltip: `${name}\n• Công dụng: Tăng tốc độ mục tiêu (Target Velocity) ở Giữa chặng (Middle Leg).\n• Dùng chung cho mọi Chiến thuật & Cự ly`
    };
  }

  if (lower.includes('stamina siphon') || lower.includes('stamina eater') || lower.includes('siphon')) {
    return {
      name,
      parenText: '',
      roleShort: 'Heal•Debuff',
      roleColor: '#34d399',
      tooltip: `${name}\n• Công dụng: Hồi +3.5% Thể lực cho bản thân đồng thời giảm -5.0% Thể lực của đối thủ ở Giữa chặng (Middle Leg).\n• Dùng chung cho mọi Chiến thuật & Cự ly`
    };
  }

  if (
    lower.includes('fast & furious') || lower.includes('fast and furious') ||
    lower.includes('position pilfer') || lower.includes('sharp streak') ||
    lower.includes('sharp gaze') || lower.includes('knifelike')
  ) {
    return {
      name,
      parenText: '(Late)',
      roleShort: 'Velo•Mid',
      roleColor: '#38bdf8',
      tooltip: `${name} (Late)\n• Công dụng: Tăng tốc độ mục tiêu (Target Velocity) ở Giữa chặng (Middle Leg).\n• Yêu cầu: Late`
    };
  }

  let styleTag = null;
  let distTag = null;
  let surfTag = null;

  const styleMatch = fullCond.match(/running_style==(\d)/);
  if (styleMatch) {
    styleTag = { 1: 'Front', 2: 'Pace', 3: 'Late', 4: 'End' }[Number(styleMatch[1])] || null;
  }
  const distMatch = fullCond.match(/distance_type==(\d)/);
  if (distMatch) {
    distTag = { 1: 'Sprint', 2: 'Mile', 3: 'Medium', 4: 'Long' }[Number(distMatch[1])] || null;
  }
  const surfMatch = fullCond.match(/ground_type==(\d)/);
  if (surfMatch && Number(surfMatch[1]) === 2) {
    surfTag = 'Dirt';
  }

  if (!styleTag) {
    if (
      lower.includes('front runner') || lower.includes('escape artist') || lower.includes('unrestrained') ||
      lower.includes('fast-paced') || lower.includes('final push') || lower.includes('lead the charge') ||
      lower.includes('top runner') || lower.includes('vanguard spirit') || lower.includes('angling and scheming') ||
      lower.includes('view from the lead') || lower.includes('g00 1st') || lower.includes('sparkling showtime') ||
      lower.includes('turbulent gale') || lower.includes('charting the course') || lower.includes('early lead') ||
      lower.includes('sparkly☆stardom') || lower.includes('taking the lead') || lower.includes('keep the lead') ||
      lower.includes('second wind') || lower.includes('frontline') || lower.includes('dodging danger')
    ) {
      styleTag = 'Front';
    } else if (
      lower.includes('pace chaser') || lower.includes('gourmand') || lower.includes('hydrate') ||
      lower.includes('speed star') || lower.includes('prepare to pass') || lower.includes('prepared to pass') ||
      lower.includes('race planner') || lower.includes('killer tunes') || lower.includes('up-tempo') ||
      lower.includes('shrewd step') || lower.includes('keen eye') || lower.includes('teio step') ||
      lower.includes('duty of dignity') || lower.includes('blue rose closer') || lower.includes('u=ma2') ||
      lower.includes('victoria por plancha') || lower.includes('stalker') || lower.includes('head-on')
    ) {
      styleTag = 'Pace';
    } else if (
      lower.includes('late surger') || lower.includes('on your left') || lower.includes('slick surge') ||
      lower.includes('rising dragon') || lower.includes('pump some iron') || lower.includes('get moving') ||
      lower.includes('furious feat') || lower.includes('updrafters') || lower.includes('xceleration') ||
      lower.includes('focused mind') || lower.includes('i can win sometimes') || lower.includes('blazing pride') ||
      lower.includes('between the lines') || lower.includes('outer swell') || lower.includes('1,500,000 cc') ||
      lower.includes('relax')
    ) {
      styleTag = 'Late';
    } else if (
      lower.includes('end closer') || lower.includes('encroaching shadow') || lower.includes('straightaway spurt') ||
      lower.includes('go-home specialist') || lower.includes('after-school stroll') || lower.includes('sleeping lion') ||
      lower.includes('nemesis') || lower.includes('warning shot') || lower.includes('one-on-one') ||
      lower.includes('strong heart') || lower.includes('visionary') || lower.includes('masterful gambit') ||
      lower.includes('stormy seas')
    ) {
      styleTag = 'End';
    }
  }

  if (!distTag) {
    if (
      lower.includes('sprint ') || lower.includes('sprinter') || lower.includes('sprint turbo') ||
      lower.includes('poise and preparation') || lower.includes('plan x') || lower.includes('countermeasure') ||
      lower.includes('huge lead') || lower.includes('breathless') || lower.includes('blinding flash')
    ) {
      distTag = 'Sprint';
    } else if (
      lower.includes('mile ') || lower.includes('miler') || lower.includes('mile maven') ||
      lower.includes('gear shift') || lower.includes('speed eater') || lower.includes('changing gears') ||
      lower.includes('shifting gears') || lower.includes('furious feat') || lower.includes('updrafters')
    ) {
      distTag = 'Mile';
    } else if (
      lower.includes('medium ') || lower.includes('clairvoyance') || lower.includes('mystifying murmur') ||
      lower.includes('thunderbolt step') || lower.includes('lightning step') || lower.includes('tempest')
    ) {
      distTag = 'Medium';
    } else if (
      lower.includes('long ') || lower.includes('stayer') || lower.includes('cooldown') ||
      lower.includes('deep breaths') || lower.includes('vanguard spirit') || lower.includes('lead the charge') ||
      lower.includes('inward experience') || lower.includes('passing pro') || lower.includes('pressure')
    ) {
      distTag = 'Long';
    }
  }

  if (!surfTag && (lower.includes('dirt') || lower.includes('sand') || lower.includes('dancer in the dirt'))) {
    surfTag = 'Dirt';
  }

  const restrictionParts = [styleTag, distTag, surfTag].filter(Boolean);
  const parenText = restrictionParts.length > 0 ? `(${restrictionParts.join('/')})` : '';

  let zoneShort = '';
  let zoneFull = 'Giữa chặng (Mid-Race)';
  if (
    lower.includes('homestretch') || lower.includes('in body and mind') ||
    lower.includes('straightaway spurt') || lower.includes('encroaching shadow') ||
    fullCond.includes('is_last_straight==1')
  ) {
    zoneShort = 'Final Straight';
    zoneFull = 'Đoạn thẳng cuối (Final Straight)';
  } else if (
    lower.includes('corner') || lower.includes('curvature') || lower.includes('maestro') ||
    lower.includes('prudent') || lower.includes('angling and scheming') ||
    lower.includes('pump some iron') || lower.includes('get moving') ||
    lower.includes('red shift') || lower.includes('shooting for victory') ||
    lower.includes('unrestrained') || lower.includes('final push') ||
    fullCond.includes('corner!=0') || fullCond.includes('corner_random') ||
    fullCond.includes('all_corner_random') || fullCond.includes('is_finalcorner==1')
  ) {
    zoneShort = 'Corner';
    zoneFull = 'Khúc cua (Corner)';
  } else if (
    lower.includes('straightaway') || lower.includes('beeline') ||
    lower.includes('rushing gale') ||
    fullCond.includes('straight_random==1')
  ) {
    zoneShort = 'Straight';
    zoneFull = 'Đoạn thẳng (Straightaway)';
  } else if (lower.includes('uphill') || lower.includes('highlander') || lower.includes('mountain climber') || fullCond.includes('slope==1')) {
    zoneShort = 'Uphill';
    zoneFull = 'Dốc lên (Uphill)';
  } else if (lower.includes('downhill') || lower.includes('descender') || fullCond.includes('slope==2')) {
    zoneShort = 'Downhill';
    zoneFull = 'Dốc xuống (Downhill)';
  }

  const passiveStatEffects = rawEffects.filter(e => [1, 2, 3, 4, 5].includes(Number(e.typeCode)));
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

  let roleShort = 'Velo';
  let roleColor = '#38bdf8';
  let fullDesc = '';

  if (passiveStatEffects.length > 0 || isGreenByKeyword) {
    roleShort = 'Passive';
    roleColor = '#4ade80';
    fullDesc = 'Kỹ năng bị động (Passive): Kích hoạt ngay lúc mở cổng (0.0s), cộng thẳng chỉ số cố định xuyên suốt trận đấu.';
  } else if (lower.includes('focus') || lower.includes('concentration') || lower.includes('gate')) {
    roleShort = 'Gate';
    roleColor = '#a855f7';
    fullDesc = 'Kỹ năng xuất phát (Gate): Tối ưu phản xạ lúc mở cổng, tăng gia tốc đầu trận và tránh xuất phát chậm (Late Start).';
  } else if (lower.includes('nothing ventured') || lower.includes('daredevil') || lower.includes('carefree')) {
    roleShort = 'Gacha Velo';
    roleColor = '#f97316';
    fullDesc = 'Tăng mạnh tốc độ mục tiêu (Velocity) ở Final Leg kèm xác suất tiêu hao thể lực (60% tốn 0% HP | 30% -2% HP | 10% -4% HP).';
  } else {
    const hpEffect = rawEffects.find(e => e.stat === 'healHpRatio' || e.typeCode === 9);
    const hasPositiveMove = rawEffects.some(e => (e.stat === 'targetSpeed' || e.stat === 'acceleration' || e.typeCode === 27 || e.typeCode === 31) && Number(e.value) > 0);
    const isTrueHeal = (hpEffect && Number(hpEffect.value) > 0) ||
      lower.includes('recovery') || lower.includes('maestro') || lower.includes('gourmand') ||
      lower.includes('hydrate') || lower.includes('breath of fresh air') || lower.includes('cooldown') ||
      lower.includes('deep breaths') || lower.includes('race planner') || lower.includes('go-home') ||
      lower.includes('stroll') || lower.includes('rest') || lower.includes('relax') ||
      lower.includes('indomitable') || lower.includes('lay low') || lower.includes('iron will') ||
      lower.includes('calm and collected') || lower.includes('pure heart') || lower.includes('sleeping lion') ||
      lower.includes('be still') || lower.includes('lie in wait') || lower.includes('rosy outlook') ||
      lower.includes('trackblazer') || lower.includes('heal');

    const hasNegativeSpeed = rawEffects.some(e => (e.stat === 'targetSpeed' || e.typeCode === 27) && Number(e.value) < 0) ||
      lower.includes('murmur') || lower.includes('tether') || lower.includes('hesitant') || lower.includes('flustered') || lower.includes('subdue');

    const hasAccelCode = rawEffects.some(e => (e.stat === 'acceleration' || e.typeCode === 31) && Number(e.value) > 0);
    const hasVeloCode = rawEffects.some(e => (e.stat === 'targetSpeed' || e.typeCode === 27) && Number(e.value) > 0);
    const hasAccel = (hasAccelCode && !hasVeloCode) ||
      lower.includes('acceleration') || lower.includes('connoisseur') ||
      lower.includes('pump some iron') || lower.includes('get moving') ||
      lower.includes('angling and scheming') || lower.includes('no stopping me') || lower.includes('nimble navigator') ||
      lower.includes('on your left') || lower.includes('slick surge') || lower.includes('furious feat') ||
      lower.includes('updrafters') || lower.includes('rushing gale') || lower.includes('sprint turbo') ||
      lower.includes('encroaching shadow') || lower.includes('straightaway spurt') || lower.includes('charting the course') ||
      lower.includes('plan x') || lower.includes('red shift') ||
      lower.includes('shooting for victory') || lower.includes('unrestrained') || lower.includes('final push') ||
      lower.includes('early lead') || lower.includes('taking the lead') || lower.includes('groundwork') ||
      lower.includes('head-on') || lower.includes('lightning step') || lower.includes('thunderbolt step');

    if (hpEffect && Number(hpEffect.value) < 0 && hasPositiveMove) {
      roleShort = 'Recoil Velo';
      roleColor = '#fb923c';
      fullDesc = 'Tiêu hao một phần nhỏ thể lực bản thân để tăng mạnh tốc độ mục tiêu (Velocity).';
    } else if (isTrueHeal) {
      roleShort = zoneShort ? `Heal•${zoneShort}` : 'Heal';
      roleColor = '#34d399';
      fullDesc = `Hồi phục thể lực (Stamina Recovery) tại ${zoneFull}.`;
    } else if (hasNegativeSpeed) {
      roleShort = 'Debuff';
      roleColor = '#f43f5e';
      fullDesc = 'Kỹ năng Debuff: Làm giảm tốc độ và tiêu hao thể lực của Uma đối phương.';
    } else if (hasAccel) {
      const isOpening = lower.includes('early lead') || lower.includes('taking the lead') || lower.includes('groundwork') || fullCond.includes('phase==0');
      const accZone = isOpening ? 'Opening' : (zoneShort || 'Final Leg');
      roleShort = `Accel•${accZone}`;
      roleColor = '#fb923c';
      fullDesc = isOpening
        ? 'Tăng mạnh gia tốc (Acceleration) ở chặng đầu (Opening Leg).'
        : (zoneShort
            ? `Tăng mạnh gia tốc (Acceleration) ở Final Leg — Chỉ kích hoạt tại ${zoneFull}.`
            : 'Tăng mạnh gia tốc (Acceleration) ngay đầu Final Leg (mốc 2/3 quãng đường).');
    } else {
      const veloZone = zoneShort || ((fullCond.includes('phase>=2') || fullCond.includes('phase==2') || fullCond.includes('is_lastspurt')) ? 'Final' : 'Mid');
      roleShort = `Velo•${veloZone}`;
      roleColor = '#38bdf8';
      fullDesc = `Tăng tốc độ mục tiêu (Target Velocity) tại ${zoneShort ? zoneFull : (veloZone === 'Final' ? 'Chặng cuối (Final Leg)' : 'Giữa chặng (Middle Leg)')}.`;
    }
  }

  const reqSummary = restrictionParts.length > 0
    ? `Yêu cầu: ${restrictionParts.join(' / ')}`
    : 'Dùng chung cho mọi Chiến thuật & Cự ly';

  return {
    name,
    parenText,
    roleShort,
    roleColor,
    tooltip: `${name} ${parenText}\n• Công dụng: ${fullDesc}\n• ${reqSummary}`
  };
}

function findSkillMechanicsByName(skillName) {
  if (!skillName) return null;
  const target = String(skillName).trim().toLowerCase();
  for (const c of (supportPool || [])) {
    if (String(c.whiteSkill || '').trim().toLowerCase() === target) return c.whiteSkillData || c.whiteMechanics || null;
    if (String(c.goldSkill || '').trim().toLowerCase() === target) return c.goldSkillData || c.goldMechanics || null;
  }
  for (const u of (umaPool || [])) {
    if (String(u.uniqueSkill || '').trim().toLowerCase() === target) return u.uniqueSkillData || null;
    for (const p of (u.potSkills || [])) {
      if (String(p.name || '').trim().toLowerCase() === target) return p.mechanics || null;
    }
  }
  return null;
}

function formatSkillInlineHTML(skillName, mechanicsObj, showRoleBadge = true) {
  const meta = getSkillGameToraMeta(skillName, mechanicsObj || findSkillMechanicsByName(skillName));
  const parenSpan = meta.parenText
    ? ` <span class="gt-cond-tag">${meta.parenText}</span>`
    : '';
  const roleSpan = showRoleBadge
    ? ` <span class="gt-role-tag" style="border-color:${meta.roleColor}66; color:${meta.roleColor};">${meta.roleShort}</span>`
    : '';
  return `<span title="${meta.tooltip.replace(/"/g, '&quot;')}">${meta.name}${parenSpan}${roleSpan}</span>`;
}

function formatCleanSkillRowHTML(badgeHtml, skillName, mechanicsObj) {
  const meta = getSkillGameToraMeta(skillName, mechanicsObj || findSkillMechanicsByName(skillName));
  const parenSpan = meta.parenText ? ` <span class="gt-cond-tag">${meta.parenText}</span>` : '';
  return `
    <div class="clean-skill-row" title="${meta.tooltip.replace(/"/g, '&quot;')}">
      <div class="clean-skill-left">
        ${badgeHtml}
        <span class="clean-skill-name">${meta.name}${parenSpan}</span>
      </div>
      <span class="gt-role-tag" style="border-color:${meta.roleColor}66; color:${meta.roleColor};">${meta.roleShort}</span>
    </div>
  `;
}

// =========================================================================
// GIAO DIỆN PHÂN VÙNG MÀU SẮC & CHỐNG TRÀN KHUNG TUYỆT ĐỐI
// =========================================================================
function injectModernTrainingTheme() {
  if (document.getElementById('twinkle-modern-training-theme')) return;
  const st = document.createElement('style');
  st.id = 'twinkle-modern-training-theme';
  st.innerHTML = `
    /* 1. TỔNG THỂ MÀN HÌNH ĐẤU & PHÂN VÙNG 4 KHU VỰC RÕ RỆT */
    #game-screen {
      background: #070b14 !important;
      gap: 10px !important;
      padding: 8px 10px !important;
    }

    .zone-opponent-board {
      background: linear-gradient(180deg, rgba(76, 5, 25, 0.38) 0%, rgba(15, 23, 42, 0.88) 100%) !important;
      border: 1px solid rgba(244, 63, 94, 0.38) !important;
      border-top: 3px solid #f43f5e !important;
      border-radius: 12px !important;
      padding: 8px 10px !important;
      box-shadow: inset 0 1px 16px rgba(244, 63, 94, 0.08), 0 6px 18px rgba(0, 0, 0, 0.45) !important;
    }

    .zone-player-board {
      background: linear-gradient(180deg, rgba(6, 78, 59, 0.32) 0%, rgba(12, 74, 110, 0.28) 50%, rgba(15, 23, 42, 0.94) 100%) !important;
      border: 1.5px solid rgba(16, 185, 129, 0.48) !important;
      border-top: 3px solid #10b981 !important;
      border-radius: 12px !important;
      padding: 8px 10px !important;
      box-shadow: inset 0 1px 22px rgba(16, 185, 129, 0.10), 0 8px 24px rgba(0, 0, 0, 0.55) !important;
    }

    .zone-left-maps {
      background: linear-gradient(180deg, #0b1120 0%, #090d16 100%) !important;
      border: 1px solid #1e293b !important;
      border-top: 3px solid #38bdf8 !important;
      border-radius: 12px !important;
      padding: 8px !important;
    }

    .zone-right-energy {
      background: linear-gradient(145deg, rgba(120, 53, 15, 0.34) 0%, rgba(15, 23, 42, 0.92) 100%) !important;
      border: 1px solid rgba(245, 158, 11, 0.45) !important;
      border-left: 4px solid #f59e0b !important;
      border-radius: 10px !important;
      padding: 8px 10px !important;
    }
    .zone-right-inventory {
      background: linear-gradient(145deg, rgba(6, 78, 59, 0.30) 0%, rgba(15, 23, 42, 0.92) 100%) !important;
      border: 1px solid rgba(16, 185, 129, 0.40) !important;
      border-left: 4px solid #10b981 !important;
      border-radius: 10px !important;
      padding: 8px 10px !important;
    }
    .zone-right-hand {
      background: linear-gradient(180deg, rgba(30, 27, 75, 0.38) 0%, rgba(9, 13, 22, 0.96) 100%) !important;
      border: 1px solid rgba(99, 102, 241, 0.40) !important;
      border-top: 3px solid #6366f1 !important;
      border-radius: 10px !important;
      padding: 8px 10px !important;
    }

    /* Nhãn gom nhóm Thích nghi 1 dòng siêu gọn */
    .apt-compact-chip {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 1px 5px;
      border-radius: 4px;
      border: 1px solid transparent;
      font-size: 9px;
      font-weight: 700;
      white-space: nowrap;
      flex-shrink: 0;
      line-height: 1.25;
    }

    .gt-cond-tag {
      color: #f472b6;
      font-weight: 700;
      font-size: 9.5px;
      margin-left: 2px;
    }
    .gt-role-tag {
      display: inline-block;
      padding: 1px 5px;
      border-radius: 4px;
      background: rgba(9, 13, 22, 0.9);
      border: 1px solid #38bdf866;
      font-size: 8.5px;
      font-weight: 700;
      letter-spacing: 0.2px;
      flex-shrink: 0;
      line-height: 1.3;
    }

    .clean-skill-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
      width: 100%;
      min-width: 0;
      margin-top: 2px;
    }
    .clean-skill-left {
      display: flex;
      align-items: center;
      gap: 5px;
      min-width: 0;
      flex: 1;
    }
    .clean-skill-name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 10.5px;
      font-weight: 600;
    }

    /* 2. THẺ UMA TRONG BÀN ĐẤU */
    #ui-opp-umas, #ui-my-umas {
      gap: 10px !important;
    }
    .uma-card-mini {
      border-radius: 10px !important;
      padding: 8px 10px !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      overflow: hidden !important;
      transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease !important;
    }
    .uma-card-mini.my-team-card {
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.92) 0%, rgba(9, 14, 26, 0.98) 100%) !important;
      border: 1px solid rgba(52, 211, 153, 0.35) !important;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45) !important;
    }
    .uma-card-mini.opp-team-card {
      background: linear-gradient(180deg, rgba(24, 16, 28, 0.88) 0%, rgba(13, 14, 24, 0.95) 100%) !important;
      border: 1px solid rgba(244, 63, 94, 0.28) !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35) !important;
    }
    .uma-card-mini.my-team-card:hover {
      border-color: #34d399 !important;
      box-shadow: 0 8px 22px rgba(16, 185, 129, 0.22) !important;
    }
    .uma-card-mini.drop-target-hover {
      border: 2px dashed #facc15 !important;
      background: rgba(250, 204, 21, 0.10) !important;
      transform: translateY(-2px) !important;
    }

    .uma-header-modern {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 5px;
    }
    .uma-avatar-modern {
      width: 42px;
      height: 42px;
      border-radius: 9px;
      object-fit: cover;
      background: #090d16;
      border: 1.5px solid #475569;
      flex-shrink: 0;
      box-shadow: 0 3px 8px rgba(0,0,0,0.5);
    }
    .uma-title-col {
      flex: 1;
      min-width: 0;
    }
    .uma-name-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 4px;
    }
    .uma-name-text {
      font-size: 12.5px;
      font-weight: 800;
      color: #ffffff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .uma-submeta-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 3px;
      gap: 4px;
    }
    .uma-style-pill {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 1px 6px;
      border-radius: 4px;
      background: rgba(14, 165, 233, 0.16);
      border: 1px solid rgba(56, 189, 248, 0.45);
      color: #bae6fd;
      font-size: 9px;
      font-weight: 700;
    }
    .uma-fail-pill {
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 800;
    }

    .uma-apt-strip {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: nowrap;
      overflow: hidden;
      background: rgba(9, 13, 22, 0.7);
      border: 1px solid rgba(51, 65, 85, 0.45);
      border-radius: 6px;
      padding: 3px 6px;
      margin-bottom: 5px;
    }

    .uma-slots-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(9, 13, 22, 0.65);
      border: 1px solid rgba(30, 41, 59, 0.95);
      border-radius: 7px;
      padding: 3px 7px;
      margin-bottom: 5px;
    }
    .uma-slots-label {
      font-size: 9px;
      font-weight: 800;
      color: #64748b;
      letter-spacing: 0.3px;
    }
    .uma-slots-grid {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .uma-empty-slot {
      width: 24px;
      height: 24px;
      border-radius: 5px;
      border: 1px dashed #334155;
      background: rgba(15, 23, 42, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #334155;
      font-size: 11px;
      font-weight: 700;
    }

    .uma-skills-box {
      display: flex;
      flex-direction: column;
      gap: 3px;
      margin-bottom: 5px;
      max-height: 70px;
      overflow-y: auto;
      padding-right: 2px;
    }
    .uma-skill-row-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
      padding: 2px 6px;
      border-radius: 5px;
      font-size: 10px;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(51, 65, 85, 0.5);
    }
    .uma-skill-row-item.uq-row {
      background: linear-gradient(90deg, rgba(168, 85, 247, 0.18) 0%, rgba(15, 23, 42, 0.85) 100%);
      border-color: rgba(192, 132, 252, 0.45);
      color: #f3e8ff;
    }
    .uma-skill-row-item.gold-row {
      background: linear-gradient(90deg, rgba(234, 179, 8, 0.16) 0%, rgba(15, 23, 42, 0.85) 100%);
      border-color: rgba(250, 204, 21, 0.45);
      color: #fef08a;
    }
    .uma-skill-row-item.white-row {
      background: rgba(12, 74, 110, 0.28);
      border-color: rgba(56, 189, 248, 0.35);
      color: #e0f2fe;
    }
    .sk-dot-uq {
      font-size: 8px;
      font-weight: 800;
      padding: 0px 3.5px;
      border-radius: 3px;
      background: #9333ea;
      color: #fff;
      flex-shrink: 0;
    }
    .sk-dot-gold { color: #facc15; font-size: 10px; flex-shrink: 0; }
    .sk-dot-white { color: #38bdf8; font-size: 9px; flex-shrink: 0; }

    .stat-grid-modern {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 4px;
      margin-top: auto;
    }
    .stat-box-modern {
      background: #070a12;
      border: 1px solid #1e293b;
      border-radius: 6px;
      padding: 3px 2px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1px;
    }
    .stat-box-modern strong {
      font-size: 11.5px;
      font-weight: 800;
      color: #f8fafc;
      line-height: 1.1;
    }
    .stat-box-modern.st-spd { border-top: 2.5px solid #38bdf8; }
    .stat-box-modern.st-sta { border-top: 2.5px solid #fb7185; }
    .stat-box-modern.st-pow { border-top: 2.5px solid #fbbf24; }
    .stat-box-modern.st-gut { border-top: 2.5px solid #f472b6; }
    .stat-box-modern.st-wit { border-top: 2.5px solid #34d399; }

    /* 3. CỘT MAP BÊN TRÁI */
    .map-item {
      background: rgba(15, 23, 42, 0.85) !important;
      border: 1px solid #1e293b !important;
      border-left: 3px solid #475569 !important;
      border-radius: 8px !important;
      padding: 7px 9px !important;
      margin-bottom: 6px !important;
      transition: all 0.15s ease !important;
    }
    .map-item.active-year-map {
      background: linear-gradient(90deg, rgba(234, 179, 8, 0.14) 0%, rgba(15, 23, 42, 0.95) 100%) !important;
      border: 1px solid rgba(250, 204, 21, 0.55) !important;
      border-left: 4px solid #facc15 !important;
      box-shadow: 0 4px 12px rgba(250, 204, 21, 0.12) !important;
    }
    .map-item.completed-map {
      opacity: 0.62;
      border-left-color: #10b981 !important;
    }
    .map-item.tiebreak {
      border-left-color: #f43f5e !important;
    }
    .map-item:hover {
      opacity: 1;
      background: #1e293b !important;
      transform: translateX(2px);
    }
    .map-meta-pills {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
      margin-top: 4px;
    }
    .map-mini-pill {
      font-size: 9.5px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 4px;
      background: #090d16;
      border: 1px solid #334155;
      color: #cbd5e1;
    }

    /* 4. BƯỚC 1 (CHỌN UMA) & BƯỚC 3 (CHỌN SUPPORT CARD): CỐ ĐỊNH 3 DÒNG GỌN TRONG KHUNG, KHÔNG TRÀN VIỀN */
    #uma-pool-container {
      grid-auto-rows: auto !important;
      align-items: stretch !important;
      gap: 9px !important;
    }
    .roster-item {
      height: auto !important;
      min-height: 68px !important;
      max-height: none !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
      background: linear-gradient(145deg, rgba(30, 41, 59, 0.86) 0%, rgba(15, 23, 42, 0.98) 100%) !important;
      border: 1px solid rgba(71, 85, 105, 0.55) !important;
      border-radius: 10px !important;
      padding: 8px 10px !important;
      display: flex !important;
      align-items: center !important;
      gap: 9px !important;
      transition: all 0.15s ease !important;
      position: relative !important;
    }
    .roster-item:hover {
      border-color: #38bdf8 !important;
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45);
    }
    .roster-item.selected {
      background: linear-gradient(145deg, rgba(6, 78, 59, 0.52) 0%, rgba(15, 23, 42, 0.98) 100%) !important;
      border: 2px solid #10b981 !important;
      box-shadow: 0 0 16px rgba(16, 185, 129, 0.3) !important;
    }

    /* Bước 3: Kho Thẻ Support SSR */
    #deck-pool-container {
      grid-auto-rows: auto !important;
      align-items: stretch !important;
      gap: 9px !important;
    }
    .deck-pool-card {
      height: auto !important;
      min-height: 70px !important;
      max-height: none !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
      border-radius: 10px !important;
      padding: 8px 10px !important;
      display: flex !important;
      align-items: center !important;
      gap: 9px !important;
      transition: all 0.14s ease !important;
      position: relative !important;
    }
    .deck-pool-card.card-theme-Speed {
      background: linear-gradient(135deg, rgba(14, 165, 233, 0.14) 0%, rgba(15, 23, 42, 0.96) 100%) !important;
      border: 1px solid rgba(56, 189, 248, 0.38) !important;
      border-left: 4px solid #38bdf8 !important;
    }
    .deck-pool-card.card-theme-Stamina {
      background: linear-gradient(135deg, rgba(244, 63, 94, 0.14) 0%, rgba(15, 23, 42, 0.96) 100%) !important;
      border: 1px solid rgba(251, 113, 133, 0.38) !important;
      border-left: 4px solid #fb7185 !important;
    }
    .deck-pool-card.card-theme-Power {
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.14) 0%, rgba(15, 23, 42, 0.96) 100%) !important;
      border: 1px solid rgba(251, 191, 36, 0.38) !important;
      border-left: 4px solid #fbbf24 !important;
    }
    .deck-pool-card.card-theme-Guts {
      background: linear-gradient(135deg, rgba(236, 72, 153, 0.14) 0%, rgba(15, 23, 42, 0.96) 100%) !important;
      border: 1px solid rgba(244, 114, 182, 0.38) !important;
      border-left: 4px solid #f472b6 !important;
    }
    .deck-pool-card.card-theme-Wit {
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.14) 0%, rgba(15, 23, 42, 0.96) 100%) !important;
      border: 1px solid rgba(52, 211, 153, 0.38) !important;
      border-left: 4px solid #34d399 !important;
    }
    .deck-pool-card:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5);
    }
    .deck-pool-card.in-deck {
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.28) 0%, rgba(15, 23, 42, 0.98) 100%) !important;
      border: 2px solid #4ade80 !important;
      box-shadow: 0 0 14px rgba(74, 222, 128, 0.25) !important;
    }

    /* Thẻ bài trên tay (Hand) */
    .support-card-item {
      border-radius: 9px !important;
      padding: 7px 9px !important;
      margin-bottom: 6px !important;
      border: 1px solid #334155 !important;
      border-left-width: 4px !important;
      overflow: hidden !important;
      transition: transform 0.14s ease, box-shadow 0.14s ease !important;
    }
    .support-card-item:hover {
      transform: translateX(-2px);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45);
    }
    .support-card-item.type-Speed {
      background: linear-gradient(90deg, rgba(14, 165, 233, 0.15) 0%, rgba(15, 23, 42, 0.95) 100%) !important;
      border-left-color: #38bdf8 !important;
    }
    .support-card-item.type-Stamina {
      background: linear-gradient(90deg, rgba(244, 63, 94, 0.15) 0%, rgba(15, 23, 42, 0.95) 100%) !important;
      border-left-color: #fb7185 !important;
    }
    .support-card-item.type-Power {
      background: linear-gradient(90deg, rgba(245, 158, 11, 0.15) 0%, rgba(15, 23, 42, 0.95) 100%) !important;
      border-left-color: #fbbf24 !important;
    }
    .support-card-item.type-Guts {
      background: linear-gradient(90deg, rgba(236, 72, 153, 0.15) 0%, rgba(15, 23, 42, 0.95) 100%) !important;
      border-left-color: #f472b6 !important;
    }
    .support-card-item.type-Wit {
      background: linear-gradient(90deg, rgba(16, 185, 129, 0.15) 0%, rgba(15, 23, 42, 0.95) 100%) !important;
      border-left-color: #34d399 !important;
    }

    #bottom-left-discard-zone {
      padding: 8px 10px !important;
      border-radius: 9px !important;
      background: rgba(120, 53, 15, 0.22) !important;
      border: 1.5px dashed #f59e0b !important;
    }
    #draggable-rest-token {
      background: linear-gradient(90deg, #0f172a 0%, #1e293b 100%) !important;
      border: 1px solid #38bdf8 !important;
      color: #e0f2fe !important;
      border-radius: 8px !important;
      font-weight: 700 !important;
      letter-spacing: 0.3px !important;
      padding: 8px 12px !important;
      text-align: center !important;
      cursor: grab !important;
    }
    #draggable-rest-token:hover {
      background: #0284c7 !important;
      color: #ffffff !important;
    }
  `;
  document.head.appendChild(st);
}

function applyDistinctZoneClasses() {
  const oppUmas = document.getElementById('ui-opp-umas');
  if (oppUmas && oppUmas.parentElement) {
    oppUmas.parentElement.classList.add('zone-opponent-board');
  }

  const myUmas = document.getElementById('ui-my-umas');
  if (myUmas && myUmas.parentElement) {
    myUmas.parentElement.classList.add('zone-player-board');
  }

  const mapList = document.getElementById('ui-map-list');
  if (mapList) {
    mapList.classList.add('zone-left-maps');
  }

  const energyEl = document.getElementById('ui-current-energy');
  if (energyEl && energyEl.parentElement) {
    energyEl.parentElement.classList.add('zone-right-energy');
  }

  const invEl = document.getElementById('ui-inventory-slots');
  if (invEl && invEl.parentElement) {
    invEl.parentElement.classList.add('zone-right-inventory');
  }

  const handEl = document.getElementById('ui-hand-list');
  if (handEl && handEl.parentElement) {
    handEl.parentElement.classList.add('zone-right-hand');
  }
}

// =========================================================================
// HỆ THỐNG CẨM NANG HƯỚNG DẪN TOÀN DIỆN & LIÊN HỆ DISCORD
// =========================================================================
const GAME_GUIDE_SECTIONS = [
  {
    id: 'overview',
    menuTitle: '1. Tổng Quan & Thể Thức',
    heading: 'Tổng Quan Trò Chơi & Thể Thức Thi Đấu',
    content: `
      <p><strong>Twinkle Tactics: Card Derby</strong> là trò chơi chiến thuật đối kháng thời gian thực (1v1), kết hợp giữa quy trình huấn luyện nhân vật của <em>Uma Musume: Pretty Derby</em> và cơ chế xây dựng, vận hành bộ bài hỗ trợ (Support Deck).</p>

      <h4>Mục Tiêu Chiến Thắng & Bảng Điểm</h4>
      <ul>
        <li>Mỗi người chơi quản lý một đội hình gồm <strong>3 Uma chủ lực</strong>, trải qua <strong>3 Năm huấn luyện</strong> (Junior, Classic, Senior).</li>
        <li>Cuối mỗi năm (sau lượt huấn luyện thứ 10), toàn bộ 6 Uma của hai người chơi sẽ bước vào tranh tài trực tiếp trên <strong>2 chặng đua liên tiếp</strong> (Năm 1 đua Map 1 và Map 2; Năm 2 đua Map 3 và Map 4; Năm 3 đua Map 5 và Map 6).</li>
        <li>Cơ chế tính điểm mỗi chặng đua:
          <ul>
            <li><strong>Hạng 1:</strong> Cộng 4 điểm</li>
            <li><strong>Hạng 2:</strong> Cộng 2 điểm</li>
            <li><strong>Hạng 3:</strong> Cộng 1 điểm</li>
            <li><strong>Hạng 4 đến Hạng 6:</strong> 0 điểm</li>
          </ul>
        </li>
        <li>Người chơi đầu tiên đạt hoặc vượt mốc <strong>25 điểm</strong> (và có điểm số cao hơn đối thủ) sẽ giành chiến thắng chung cuộc. Nếu sau 6 chặng đua chính thức vẫn chưa có ai chạm mốc 25 điểm hoặc hai bên bằng điểm nhau, trận đấu sẽ bước vào <strong>Chặng 7 (Tie-break)</strong> để phân định thắng thua.</li>
      </ul>

      <h4>Cơ Chế Giảm Tâm Trạng (Mood) Sau Mỗi Kỳ Đua</h4>
      <ul>
        <li>Các cấp độ Tâm trạng (Mood) theo thứ tự từ thấp đến cao gồm: <strong>Awful, Bad, Normal, Good, Great</strong>. Tâm trạng tác động trực tiếp đến hiệu suất thi đấu của toàn bộ chỉ số trên đường đua.</li>
        <li><strong>Giảm Mood khi chuyển năm:</strong> Sau khi hoàn thành 2 chặng đua cuối Năm 1 (bước sang Năm 2) và cuối Năm 2 (bước sang Năm 3), toàn bộ 3 Uma sẽ được đưa tỷ lệ thất bại (Fail Rate) về 0%, nhưng <strong>Tâm trạng (Mood) của cả 3 Uma sẽ tự động giảm đi 1 bậc</strong> do tiêu hao sức lực sau giải đấu.</li>
        <li><strong>Giảm Mood trước trận Tie-break:</strong> Nếu trận đấu kéo dài sang Chặng 7 (Tie-break), cả 3 Uma của hai đội cũng sẽ <strong>bị giảm 1 bậc Mood ngay trước khi bước vào cổng xuất phát Tie-break</strong>. Người chơi cần lưu ý duy trì Mood cao hoặc giữ lại vật phẩm tăng Mood cho giai đoạn cuối trận.</li>
      </ul>

      <div class="guide-diff-box">
        <div class="guide-diff-title">Điểm Khác Biệt So Với Bản Gốc</div>
        <p>Trong phiên bản gốc, người chơi huấn luyện từng nhân vật riêng lẻ qua một kịch bản dài trước khi đem đi thi đấu. Trong <em>Twinkle Tactics</em>, quá trình huấn luyện và thi đấu diễn ra song song trong cùng một trận đấu đối kháng. Bạn vừa phát triển chỉ số cho cả 3 nhân vật cùng lúc, vừa quan sát đội hình đối phương để điều chỉnh chiến thuật theo từng chặng đua.</p>
      </div>
    `
  },
  {
    id: 'pregame',
    menuTitle: '2. Giai Đoạn Chuẩn Bị',
    heading: 'Giai Đoạn Chuẩn Bị Trước Trận & Quy Tắc Sân Đua',
    content: `
      <p>Ngay khi hai người chơi vào phòng, hệ thống sẽ công bố danh sách <strong>7 Sân đua</strong> của trận đấu. Bạn có thể nhấp chuột trái hoặc chuột phải vào bất kỳ sân nào ở cột bên trái để mở bảng phân tích địa hình (Map Helper).</p>

      <h4>Quy Tắc Tạo Sân & Cơ Chế Ẩn Tình Trạng Sân</h4>
      <ul>
        <li><strong>Sự cân bằng trong 7 Sân đua:</strong> Hệ thống luôn chọn 7 sân sao cho mỗi loại cự ly (Sprint, Mile, Medium, Long) xuất hiện <strong>tối đa 2 lần</strong>, và mặt sân đất (Dirt) xuất hiện <strong>tối đa 1 lần</strong> trong suốt trận đấu.</li>
        <li><strong>Mở khóa dần Tình trạng mặt sân (Firm / Good / Soft / Heavy):</strong> Ở đầu trận (Năm 1), bạn chỉ nhìn thấy tình trạng mặt sân của <strong>Map 1 và Map 2</strong>; các sân từ Map 3 trở đi được ẩn dưới ký hiệu <strong>???</strong>. Khi bước sang Năm 2, hệ thống sẽ mở khóa tình trạng sân của <strong>Map 3 và Map 4</strong>; khi bước sang Năm 3 sẽ mở khóa toàn bộ các sân còn lại.</li>
        <li><strong>Chỉ số Thưởng Địa hình (Stat Bonus / Threshold):</strong> Trong bảng Map Helper của mỗi sân có ghi chú mục <em>STAT BONUS</em> (ví dụ: Speed, Stamina hoặc Power). Nếu nhân vật của bạn có chỉ số tương ứng đạt mốc từ 350 trở lên hoặc từ 600 trở lên, nhân vật đó sẽ được nhận thêm tốc độ cộng thưởng trên sân đua đó.</li>
      </ul>

      <h4>Quy Trình 3 Bước Chuẩn Bị</h4>
      <ul>
        <li><strong>Bước 1 — Chọn 3 Uma Chủ Lực:</strong> Lựa chọn 3 nhân vật phù hợp với các cự ly xuất hiện trong danh sách 7 sân đua. Nhấp chuột phải vào từng nhân vật để xem chi tiết chỉ số cơ bản, kỹ năng độc quyền (Unique Skill) và các kỹ năng tiềm năng có sẵn (Pot Skills).</li>
        <li><strong>Bước 2 — Phân Bổ 18 Spark Hồng:</strong> Mỗi nhân vật được cấp 18 điểm Spark Hồng để nâng cấp bậc thích nghi Mặt sân, Cự ly hoặc Chiến thuật chạy. Trước khi trận đấu bắt đầu, Spark Hồng có thể nâng bậc thích nghi tối đa lên mức <strong>A</strong> (1 Spark tăng 1 bậc, 4 Spark tăng 2 bậc, 7 Spark tăng 3 bậc, 10 Spark tăng 4 bậc).</li>
        <li><strong>Bước 3 — Xây Dựng Bộ Bài 40 Thẻ SSR:</strong> Chọn đủ 40 thẻ Hỗ trợ (Support Cards) từ kho thẻ. Mỗi hệ chỉ số (Speed, Stamina, Power, Guts, Wit) được phép lấy tối đa 12 thẻ.</li>
      </ul>

      <div class="guide-diff-box">
        <div class="guide-diff-title">Điểm Khác Biệt So Với Bản Gốc</div>
        <ul>
          <li><strong>Nâng cấp lên Bậc S nhờ Spark Hồng:</strong> Thay vì chọn ngựa bố mẹ có sẵn, bạn trực tiếp phân bổ 18 điểm Spark Hồng cho từng nhân vật. Mỗi điểm Spark được gán vào một hạng mục sẽ mang lại 8% xác suất nâng hạng mục đó lên <strong>Bậc S</strong> trong sự kiện Kế thừa vào đầu Năm 2 và Năm 3.</li>
          <li><strong>Bộ bài Hỗ trợ 40 lá:</strong> Thay vì chỉ mang 6 thẻ hỗ trợ cố định như bản gốc, bạn xây dựng một bộ bài 40 lá để rút dần qua từng lượt (khởi đầu Năm 1 với 5 lá bài trên tay).</li>
        </ul>
      </div>
    `
  },
  {
    id: 'training',
    menuTitle: '3. Giai Đoạn Huấn Luyện',
    heading: 'Giai Đoạn Huấn Luyện, Túi Năng Lượng & Quản Lý Thể Lực',
    content: `
      <p>Mỗi năm bao gồm <strong>10 lượt huấn luyện</strong>. Cấp độ cơ sở huấn luyện tự động tăng dần theo từng năm: Năm 1 tương ứng <strong>Lv.1</strong>, Năm 2 tương ứng <strong>Lv.3</strong>, và Năm 3 đạt mức tối đa <strong>Lv.5</strong>.</p>

      <h4>Quy Luật Túi Năng Lượng 10 Lượt (Yearly Energy Bag)</h4>
      <ul>
        <li>Năng lượng huấn luyện mỗi lượt được rút ra từ một <strong>Túi 10 viên cố định cho mỗi năm</strong>, bao gồm đúng: <strong>2 Speed, 2 Stamina, 2 Power, 2 Guts và 2 Wit</strong> được xáo trộn thứ tự.</li>
        <li>Nhờ thông báo <em>Tiếp theo</em> ở góc phải màn hình và quy luật túi 10 viên này, bạn có thể tính toán trước các hệ năng lượng còn lại sẽ xuất hiện trong những lượt cuối năm.</li>
        <li><strong>Bỏ bài đổi hệ Năng lượng:</strong> Nếu viên năng lượng hiện tại không đúng hệ bạn cần, hãy kéo 1 thẻ bài từ trên tay thả vào ô chuyển đổi ở góc dưới bên trái để đổi viên năng lượng của lượt đó sang đúng hệ của thẻ bài vừa bỏ.</li>
      </ul>

      <h4>Cơ Chế Luân Phiên Thể Lực & Đặc Quyền Của Hệ Wit</h4>
      <ul>
        <li><strong>Tăng chỉ số chính và phụ:</strong> Tập Speed tăng thêm Power; tập Stamina tăng thêm Guts; tập Power tăng thêm Stamina; tập Guts tăng thêm cả Speed và Power; tập Wit tăng thêm Speed.</li>
        <li><strong>Hồi phục tự động cho 2 Uma dự bị:</strong> Mỗi khi bạn kéo năng lượng huấn luyện cho 1 Uma, <strong>2 Uma còn lại không tập luyện trong lượt đó sẽ tự động được giảm tỷ lệ thất bại (Fail Rate)</strong> (giảm 10% nếu Fail Rate đang từ 20% trở lên, hoặc giảm 5% nếu dưới 20%). Luân phiên tập luyện giữa 3 nhân vật sẽ giúp bạn hạn chế phải dùng lệnh Nghỉ ngơi.</li>
        <li><strong>Đặc quyền khi tập luyện hệ Wit (Trí tuệ):</strong>
          <ul>
            <li>Huấn luyện hệ Wit <strong>an toàn tuyệt đối (không bao giờ thất bại)</strong> ngay cả khi nhân vật đang có tỷ lệ Fail Rate cao.</li>
            <li>Giúp nhân vật được tập <strong>giảm ngay 5% Fail Rate</strong>.</li>
            <li>Nếu nhân vật được tập Wit đang trang bị ít nhất 1 thẻ Hỗ trợ hệ Wit trên người, bạn sẽ được <strong>rút thêm 1 thẻ bài từ bộ bài</strong>.</li>
          </ul>
        </li>
      </ul>

      <h4>Nghỉ Ngơi (Rest) & Trại Hè (Summer Camp)</h4>
      <ul>
        <li><strong>Nghỉ ngơi (Rest):</strong> Kéo nút <strong>REST</strong> ở góc dưới bên phải thả vào 1 Uma (tiêu tốn viên năng lượng của lượt đó) để đưa Fail Rate của nhân vật về 0%, tăng 1 bậc Mood và rút thêm 1 thẻ bài từ bộ bài.</li>
        <li><strong>Trại hè (Summer Camp):</strong> Diễn ra cố định vào <strong>Lượt 7 và Lượt 8 của Năm 2 và Năm 3</strong>. Trong 2 lượt Trại hè, hiệu quả tăng chỉ số khi huấn luyện được nhân 1.5 lần, và nếu dùng lệnh Rest sẽ tăng liền 2 bậc Mood.</li>
      </ul>
    `
  },
  {
    id: 'cards_skills',
    menuTitle: '4. Thẻ Hỗ Trợ & Kỹ Năng',
    heading: 'Cơ Chế Thẻ Hỗ Trợ, Nâng Cấp Kỹ Năng Vàng & Thu Hồi Thẻ',
    content: `
      <p>Thẻ Hỗ trợ (Support Cards) vừa giúp tăng mạnh lượng chỉ số nhận được khi huấn luyện cùng hệ, vừa truyền dạy trực tiếp kỹ năng cho Uma. Giới hạn bài cầm trên tay là <strong>9 lá</strong> khi rút tự nhiên (và tối đa <strong>10 lá</strong> khi thu hồi thẻ từ nhân vật về tay).</p>

      <h4>Trang Bị Thẻ, Cộng Hưởng (Rainbow) & Ưu Tiên Kỹ Năng Vàng</h4>
      <ul>
        <li>Mỗi Uma có tối đa <strong>5 ô trang bị thẻ hỗ trợ</strong> (không được trang bị 2 thẻ trùng tên trên cùng một nhân vật).</li>
        <li>Khi kéo một thẻ từ tay thả vào Uma ở chế độ <strong>Trang bị (Equip)</strong>, nhân vật đó lập tức nhận được <strong>Kỹ năng Trắng (White Skill)</strong> của thẻ.</li>
        <li>Khi huấn luyện một chỉ số trùng với hệ của các thẻ đang gắn trên nhân vật, hiệu ứng <strong>Cộng hưởng (Rainbow)</strong> sẽ kích hoạt, cộng thêm lượng lớn chỉ số tương ứng với số thẻ cùng hệ đang trang bị.</li>
        <li><strong>Tự động ưu tiên Kỹ năng Vàng:</strong> Nếu nhân vật đang sở hữu phiên bản <strong>Kỹ năng Vàng (Gold Skill)</strong> (có sẵn từ Pot hoặc từ thẻ khác), hệ thống sẽ tự động ẩn và bỏ qua phiên bản Kỹ năng Trắng cấp thấp tương ứng (ví dụ: đã có <em>Professor of Curvature</em> thì sẽ chỉ kích hoạt kỹ năng vàng này và không kích hoạt <em>Corner Adept</em>).</li>
      </ul>

      <h4>Mở Khóa Kỹ Năng Vàng (Gold Awakening) & Thẻ Guts Đa Năng</h4>
      <ul>
        <li>Khi một Uma đã có thẻ hỗ trợ đang gắn trên người, bạn có thể kéo một thẻ khác từ trên tay có <strong>cùng hệ chỉ số</strong> thả đè lên nhân vật đó để thực hiện <strong>Gold Awakening</strong>.</li>
        <li>Thẻ dùng làm nguyên liệu sẽ mất đi, và thẻ đang trang bị sẽ được nâng cấp vĩnh viễn từ Kỹ năng Trắng lên <strong>Kỹ năng Vàng (Gold Skill)</strong> tương ứng.</li>
        <li><strong>Vai trò đặc biệt của thẻ hệ Guts (Wildcard):</strong> Thẻ hỗ trợ hệ Guts có thể dùng làm nguyên liệu nâng cấp Kỹ năng Vàng cho <strong>mọi hệ thẻ khác</strong> (Speed, Stamina, Power, Wit).</li>
      </ul>

      <h4>Thu Hồi Thẻ (Recall Card)</h4>
      <ul>
        <li>Đối với các thẻ đang trang bị nhưng <strong>chưa nâng cấp lên Kỹ năng Vàng</strong>, bạn có thể nhấp chuột trái vào biểu tượng thẻ nhỏ trên nhân vật (hoặc kéo ngược về tay) để tháo thẻ ra.</li>
        <li>Khi thu hồi thẻ, Kỹ năng Trắng đi kèm thẻ đó cũng sẽ được gỡ bỏ, cho phép bạn chuyển thẻ sang nhân vật khác để gom hiệu ứng Rainbow hoặc dùng thẻ đó làm nguyên liệu nâng cấp. Các thẻ đã nâng cấp Kỹ năng Vàng sẽ khóa cố định vào nhân vật.</li>
      </ul>

      <div class="guide-diff-box">
        <div class="guide-diff-title">Điểm Khác Biệt So Với Bản Gốc</div>
        <p>Trò chơi lược bỏ hoàn toàn hệ thống Điểm kỹ năng (Skill Points) và chờ dấu chấm than ngẫu nhiên (Skill Hints). Việc sở hữu Kỹ năng Trắng hay nâng cấp lên Kỹ năng Vàng hoàn toàn nằm trong quyền kiểm soát bài trên tay của người chơi.</p>
      </div>
    `
  },
  {
    id: 'events_items',
    menuTitle: '5. Sự Kiện & Vật Phẩm',
    heading: 'Sự Kiện Toàn Cục (Global Events) & Túi Vật Phẩm',
    content: `
      <p>Bên cạnh việc huấn luyện và đánh bài, người chơi còn nhận được sự hỗ trợ từ các nhân vật đồng hành học viện và hệ thống vật phẩm bổ trợ.</p>

      <h4>Sự Kiện Toàn Cục (Lượt 3, Lượt 6, Lượt 9)</h4>
      <ul>
        <li>Vào đúng các lượt 3, 6 và 9 của mỗi năm, một <strong>Sự kiện Hỗ trợ Toàn cục (Global Event)</strong> sẽ xuất hiện đồng thời cho cả hai người chơi.</li>
        <li>Mỗi sự kiện cung cấp 3 phương án lựa chọn với định hướng khác nhau: hồi phục thể lực và tăng Mood cho toàn đội, gia tăng mạnh chỉ số kèm rủi ro tăng Fail Rate, hoặc rút thêm thẻ bài và nhận vật phẩm vào túi đồ.</li>
      </ul>

      <h4>Túi Vật Phẩm (Inventory)</h4>
      <ul>
        <li>Mỗi người chơi có tối đa <strong>3 ô chứa vật phẩm</strong>. Khi bắt đầu Năm 1, mỗi người chơi được cấp sẵn 1 lọ <strong>Royal Bitter Juice</strong> (xóa toàn bộ Fail Rate cho 1 Uma) và có thể nhận thêm vật phẩm qua các Sự kiện Toàn cục.</li>
        <li>Sử dụng vật phẩm <strong>không tiêu tốn lượt huấn luyện</strong> và có thể dùng bất cứ lúc nào trong lượt.</li>
        <li><strong>Cách sử dụng:</strong> Đối với vật phẩm tác động lên một nhân vật đơn lẻ (như nước uống xóa Fail Rate, bánh ngọt tăng Mood, thịt nướng, sổ tay tăng chỉ số), bạn <strong>kéo thả trực tiếp vật phẩm vào Uma mục tiêu</strong>. Đối với vật phẩm tác động lên toàn đội hoặc lượt huấn luyện chung (như Tượng Nữ Thần hoặc Loa phóng thanh nhân 1.5 lần hiệu quả tập luyện tiếp theo), bạn chỉ cần nhấp chuột vào vật phẩm để kích hoạt.</li>
      </ul>
    `
  },
  {
    id: 'racing',
    menuTitle: '6. Cơ Chế Đường Đua',
    heading: 'Giai Đoạn Đua, Bậc Thích Nghi, Kỹ Năng & Trạng Thái Đường Đua',
    content: `
      <p>Khi bước vào giai đoạn đua cuối năm, 6 Uma của hai đội sẽ đứng trong cổng chờ xuất phát. Cuộc đua bắt đầu ngay khi cả hai người chơi nhấn xác nhận sẵn sàng hoặc tự động mở cổng sau 10 giây đếm ngược.</p>

      <h4>Tác Động Thực Tế Của Bậc Thích Nghi (S đến G) & Đổi Chiến Thuật</h4>
      <ul>
        <li><strong>Đổi chiến thuật chạy linh hoạt:</strong> Trước khi bước vào kỳ đua, bạn có thể nhấp chuột phải vào bất kỳ Uma nào của mình trên bàn đấu để chuyển đổi chiến thuật chạy giữa <strong>Front, Pace, Late và End</strong>.</li>
        <li><strong>Thích nghi Cự ly (Sprint / Mile / Medium / Long):</strong> Tác động trực tiếp lên tốc độ di chuyển và tốc độ nước rút. Đưa nhân vật có bậc thích nghi thấp (từ D đến G) vào cự ly không phù hợp sẽ làm giảm mạnh tốc độ nền.</li>
        <li><strong>Thích nghi Mặt sân (Turf / Dirt):</strong> Tác động trực tiếp lên khả năng tăng tốc (Power) và mức tiêu hao thể lực. Chạy trên mặt sân không phù hợp khiến nhân vật tăng tốc chậm và tốn thể lực nhanh hơn bình thường.</li>
        <li><strong>Thích nghi Chiến thuật (Front / Pace / Late / End):</strong> Tác động trực tiếp lên chỉ số Wit thực chiến, <strong>tỷ lệ kích hoạt kỹ năng</strong> và khả năng giữ bình tĩnh trên đường đua.</li>
      </ul>

      <h4>Phân Loại Kỹ Năng & Điều Kiện Kích Hoạt</h4>
      <ul>
        <li><strong>Ràng buộc Chiến thuật, Cự ly và Mặt sân:</strong> Các kỹ năng có ký hiệu <strong>(Front / Pace / Late / End)</strong>, <strong>(Sprint / Mile / Medium / Long)</strong> hoặc <strong>(Dirt)</strong> chỉ kích hoạt khi nhân vật đang thi đấu đúng chiến thuật, cự ly và mặt sân đó.</li>
        <li><strong>Kỹ năng Xanh lá (Passive) & Xuất phát (Gate):</strong> Kiểm tra điều kiện (mùa giải, hướng rẽ, cự ly chuẩn/phi chuẩn, mặt sân) ngay lúc mở cổng (0.0s). Nếu thành công sẽ cộng thẳng chỉ số cố định suốt cả trận hoặc tránh bị xuất phát chậm (Late Start).</li>
        <li><strong>Kỹ năng Khúc cua (Corner) & Đoạn thẳng (Straight):</strong> Chỉ kích hoạt khi nhân vật đang thực sự chạy trong phạm vi khúc cua hoặc đoạn thẳng của sân đua (bao gồm cả các kỹ năng gia tốc đặc trưng như <em>Let's Pump Some Iron!</em> chỉ bật ở khúc cua hay <em>Straightaway Spurt</em> chỉ bật ở đoạn thẳng cuối).</li>
        <li><strong>Kỹ năng Tăng tốc (Velo•Mid) & Hồi thể lực (Heal / Heal•Debuff):</strong> Kích hoạt ở giai đoạn Giữa chặng (Middle Leg) để cải thiện vị trí và duy trì thanh thể lực.</li>
        <li><strong>Kỹ năng Gia tốc không ràng buộc địa hình (Accel•Final Leg):</strong> Kích hoạt ngay khi bước vào mốc 2/3 quãng đường (Final Leg), giúp nhân vật đạt vận tốc nước rút tối đa nhanh nhất có thể.</li>
      </ul>

      <h4>Các Trạng Thái Đặc Biệt Trong Lúc Đua</h4>
      <ul>
        <li><strong>LATE START (Xuất phát chậm):</strong> Nhân vật bị khựng lại một nhịp ngay khi mở cổng, làm mất lợi thế chọn vị trí đầu chặng (chỉ số Wit cao hoặc có kỹ năng <em>Focus / Concentration</em> sẽ khắc phục tình trạng này).</li>
        <li><strong>RUSHED (Mất bình tĩnh / Kakari):</strong> Nhân vật mất kiểm soát nhịp độ ở giữa chặng, tự ý tăng tốc sớm nhưng tiêu hao thể lực gấp rưỡi bình thường (dễ xảy ra nếu chỉ số Wit thấp hoặc chạy chiến thuật có bậc thích nghi từ D đến G).</li>
        <li><strong>SPOT STRUGGLE & DUEL! (Đọ sức):</strong> Khi các Front Runner bám sát nhau ở đầu trận (Spot Struggle) hoặc khi các nhân vật kè vai nhau trên đường thẳng cuối (Duel / Oikurabe), các nhân vật sẽ tăng tốc mạnh mẽ dựa trên chỉ số Guts.</li>
        <li><strong>BLOCKED (Bị chắn đường):</strong> Bị các nhân vật phía trước cản đường ở giai đoạn cuối khiến không thể đạt tốc độ tối đa (chỉ số Power cao hoặc kích hoạt kỹ năng tăng gia tốc giúp dễ dàng vượt qua).</li>
        <li><strong>NO STA (Cạn thể lực):</strong> Khi thanh thể lực (HP) giảm về 0 trước vạch đích, nhân vật sẽ bị giảm tốc độ nghiêm trọng.</li>
      </ul>
    `
  }
];

function setLobbyDiscordVisible(isVisible) {
  const badge = document.getElementById('lobby-discord-contact');
  if (badge) {
    badge.style.display = isVisible ? 'flex' : 'none';
  }
}

function normalizeStaticDomLabels() {
  injectModernTrainingTheme();
  applyDistinctZoneClasses();

  const restBtn = document.getElementById('draggable-rest-token');
  if (restBtn) {
    restBtn.innerText = 'REST (Kéo thả vào Uma)';
  }
  document.querySelectorAll('button').forEach(btn => {
    const oc = btn.getAttribute('onclick') || '';
    if (oc.includes('balanced40') || btn.innerText.includes('Cân Bằng')) {
      btn.innerText = 'Chọn Nhanh 40 Thẻ (8 Thẻ / Hệ)';
    }
  });

  const dz = document.getElementById('bottom-left-discard-zone');
  if (dz && !dz.dataset.cleaned) {
    dz.dataset.cleaned = '1';
    dz.innerHTML = `
      <div style="font-size:11px; font-weight:800; color:#facc15; letter-spacing:0.3px;">ĐỔI HỆ NĂNG LƯỢNG</div>
      <div style="font-size:10px; color:#94a3b8; margin-top:2px;">Thả 1 thẻ bài vào đây để đổi hệ Train</div>
    `;
  }
}

function initLobbyGuideSystem() {
  normalizeStaticDomLabels();

  if (!document.getElementById('twinkle-guide-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'twinkle-guide-styles';
    styleEl.innerHTML = `
      .btn-open-guide-lobby {
        width: 100%;
        margin-top: 12px;
        padding: 10px 16px;
        background: #1e293b;
        border: 1px solid #38bdf8;
        color: #e0f2fe;
        border-radius: 8px;
        font-weight: 700;
        font-size: 13px;
        letter-spacing: 0.4px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .btn-open-guide-lobby:hover {
        background: #0284c7;
        color: #ffffff;
        box-shadow: 0 4px 14px rgba(56, 189, 248, 0.35);
      }
      #guide-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(2, 6, 23, 0.85);
        backdrop-filter: blur(5px);
        z-index: 9500;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }
      .guide-modal-container {
        width: 940px;
        max-width: 96vw;
        height: 620px;
        max-height: 88vh;
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.85);
      }
      .guide-modal-header {
        padding: 14px 20px;
        background: #090d16;
        border-bottom: 1px solid #1e293b;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .guide-modal-header h3 {
        margin: 0;
        font-size: 15px;
        font-weight: 800;
        color: #f8fafc;
        letter-spacing: 0.5px;
        text-transform: uppercase;
      }
      .guide-close-btn {
        width: auto;
        margin: 0;
        padding: 6px 14px;
        background: #1e293b;
        border: 1px solid #475569;
        color: #cbd5e1;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      .guide-close-btn:hover {
        background: #ef4444;
        border-color: #ef4444;
        color: #ffffff;
      }
      .guide-modal-body {
        flex: 1;
        display: grid;
        grid-template-columns: 240px 1fr;
        min-height: 0;
      }
      .guide-sidebar {
        background: #0b1120;
        border-right: 1px solid #1e293b;
        padding: 12px 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        overflow-y: auto;
      }
      .guide-nav-item {
        width: 100%;
        text-align: left;
        margin: 0;
        padding: 10px 12px;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 7px;
        color: #94a3b8;
        font-size: 12.5px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .guide-nav-item:hover {
        background: #1e293b;
        color: #f1f5f9;
      }
      .guide-nav-item.active {
        background: rgba(14, 165, 233, 0.15);
        border-color: #38bdf8;
        color: #38bdf8;
        font-weight: 700;
      }
      .guide-content-pane {
        padding: 22px 28px;
        overflow-y: auto;
        color: #cbd5e1;
        font-size: 13.5px;
        line-height: 1.68;
      }
      .guide-content-pane h2 {
        margin: 0 0 14px 0;
        font-size: 19px;
        color: #f8fafc;
        border-bottom: 1px solid #1e293b;
        padding-bottom: 10px;
      }
      .guide-content-pane h4 {
        margin: 18px 0 8px 0;
        font-size: 14.5px;
        color: #facc15;
      }
      .guide-content-pane p {
        margin: 0 0 12px 0;
      }
      .guide-content-pane ul {
        margin: 0 0 14px 0;
        padding-left: 20px;
      }
      .guide-content-pane li {
        margin-bottom: 7px;
      }
      .guide-content-pane strong {
        color: #f1f5f9;
      }
      .guide-diff-box {
        margin-top: 18px;
        padding: 14px 16px;
        background: rgba(15, 23, 42, 0.9);
        border-left: 3px solid #38bdf8;
        border-top: 1px solid #1e293b;
        border-right: 1px solid #1e293b;
        border-bottom: 1px solid #1e293b;
        border-radius: 6px;
      }
      .guide-diff-title {
        font-size: 12px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: #38bdf8;
        margin-bottom: 6px;
      }
    `;
    document.head.appendChild(styleEl);
  }

  const lobbyScreen = document.getElementById('lobby-screen');
  if (lobbyScreen && !document.getElementById('btn-open-game-guide')) {
    const lobbyCard = lobbyScreen.querySelector('.lobby-box, .card, div') || lobbyScreen;
    const guideBtn = document.createElement('button');
    guideBtn.id = 'btn-open-game-guide';
    guideBtn.className = 'btn-open-guide-lobby';
    guideBtn.innerText = 'Cẩm Nang Hướng Dẫn & Luật Đấu';
    guideBtn.onclick = () => openGameGuideModal('overview');
    lobbyCard.appendChild(guideBtn);
  }

  if (!document.getElementById('guide-modal-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'guide-modal-overlay';
    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.style.display = 'none';
    };

    overlay.innerHTML = `
      <div class="guide-modal-container" onclick="event.stopPropagation()">
        <div class="guide-modal-header">
          <h3>Cẩm Nang Hướng Dẫn — Twinkle Tactics: Card Derby</h3>
          <button class="guide-close-btn" id="btn-close-game-guide">Đóng Bảng</button>
        </div>
        <div class="guide-modal-body">
          <div class="guide-sidebar" id="guide-sidebar-menu"></div>
          <div class="guide-content-pane" id="guide-content-area"></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('btn-close-game-guide').onclick = () => {
      overlay.style.display = 'none';
    };
  }

  if (!document.getElementById('lobby-discord-contact')) {
    const discordBadge = document.createElement('div');
    discordBadge.id = 'lobby-discord-contact';
    discordBadge.title = 'Nhấp để sao chép ID Discord: cafe_1710';
    discordBadge.style.cssText = `
      position: fixed;
      bottom: 14px;
      left: 14px;
      z-index: 9999;
      background: rgba(15, 23, 42, 0.94);
      border: 1.5px solid #5865F2;
      border-radius: 10px;
      padding: 8px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.7);
      color: #f8fafc;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      backdrop-filter: blur(6px);
    `;

    discordBadge.onmouseenter = () => {
      discordBadge.style.background = '#5865F2';
      discordBadge.style.boxShadow = '0 6px 20px rgba(88, 101, 242, 0.5)';
    };
    discordBadge.onmouseleave = () => {
      discordBadge.style.background = 'rgba(15, 23, 42, 0.94)';
      discordBadge.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.7)';
    };

    discordBadge.onclick = () => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText('cafe_1710').catch(() => {});
      }
      showToast('Đã sao chép ID Discord liên hệ: cafe_1710');
    };

    discordBadge.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="#ffffff" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>
      <div style="display:flex; flex-direction:column; line-height:1.25;">
        <span style="font-size:10px; color:#94a3b8; font-weight:600;">LIÊN HỆ / GÓP Ý DISCORD</span>
        <strong style="font-size:13px; color:#ffffff; letter-spacing:0.3px;">cafe_1710</strong>
      </div>
    `;

    document.body.appendChild(discordBadge);
  }
}

function openGameGuideModal(sectionId = 'overview') {
  initLobbyGuideSystem();
  const overlay = document.getElementById('guide-modal-overlay');
  const sidebarEl = document.getElementById('guide-sidebar-menu');
  const contentEl = document.getElementById('guide-content-area');
  if (!overlay || !sidebarEl || !contentEl) return;

  const targetSection = GAME_GUIDE_SECTIONS.find(s => s.id === sectionId) || GAME_GUIDE_SECTIONS[0];

  sidebarEl.innerHTML = GAME_GUIDE_SECTIONS.map(sec => `
    <button class="guide-nav-item ${sec.id === targetSection.id ? 'active' : ''}" onclick="openGameGuideModal('${sec.id}')">
      ${sec.menuTitle}
    </button>
  `).join('');

  contentEl.innerHTML = `
    <h2>${targetSection.heading}</h2>
    ${targetSection.content}
  `;
  contentEl.scrollTop = 0;
  overlay.style.display = 'flex';
}

function playTurnBannerAnimation(title, subtitle) {
  const strip = document.getElementById('turn-banner-strip');
  if (!strip) return;
  document.getElementById('turn-banner-title').innerText = title;
  document.getElementById('turn-banner-sub').innerText = subtitle || '';
  strip.classList.remove('animate-banner');
  void strip.offsetWidth;
  strip.classList.add('animate-banner');
}

function showToast(msg, isError = false) {
  const el = document.getElementById('action-toast');
  if (!el) return;
  el.innerText = msg;
  el.style.borderColor = isError ? '#f43f5e' : '#facc15';
  el.style.color = isError ? '#fda4af' : '#fef08a';
  el.style.display = 'block';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.display = 'none'; }, 3400);
}

socket.on('action_error', (msg) => showToast('[LỖI] ' + msg, true));

function openCardZoom(card) {
  const wMeta = getSkillGameToraMeta(card.whiteSkill, card.whiteSkillData || card.whiteMechanics);
  const gMeta = getSkillGameToraMeta(card.goldSkill, card.goldSkillData || card.goldMechanics);

  document.getElementById('zoom-img').src = card.icon;
  document.getElementById('zoom-title').innerText = card.name;
  document.getElementById('zoom-type').innerHTML = `${renderStatIconHTML(card.type, 22)} <span>SSR ${card.type} Support</span>`;
  document.getElementById('zoom-white').innerHTML = formatSkillInlineHTML(card.whiteSkill, card.whiteSkillData || card.whiteMechanics, true);
  document.getElementById('zoom-gold').innerHTML = formatSkillInlineHTML(card.goldSkill, card.goldSkillData || card.goldMechanics, true);
  document.getElementById('zoom-desc').innerHTML = `
    <div style="margin-bottom:4px;">• <b>White:</b> ${wMeta.tooltip.split('\n')[1]?.replace('• ', '') || ''}</div>
    <div>• <b style="color:#facc15;">Gold:</b> ${gMeta.tooltip.split('\n')[1]?.replace('• ', '') || ''}</div>
  `;
  document.getElementById('card-zoom-modal').style.display = 'flex';
}

function enhanceUmaDetailModalSkills(uma) {
  if (!uma) return;
  const modal = document.getElementById('uma-detail-modal');
  if (!modal) return;

  const allSkills = [...(uma.potSkills || []), ...(uma.skills || [])];
  const seen = new Set();

  allSkills.forEach(sk => {
    if (!sk || !sk.name || seen.has(sk.name)) return;
    seen.add(sk.name);
    const meta = getSkillGameToraMeta(sk.name, sk.mechanics);

    modal.querySelectorAll('span, div, li, b, strong').forEach(el => {
      if (el.children.length === 0 && el.textContent && el.textContent.includes(sk.name) && !el.dataset.gtEnhanced) {
        el.dataset.gtEnhanced = '1';
        el.title = meta.tooltip;
        if (!el.textContent.includes(meta.roleShort)) {
          el.innerHTML = `${el.textContent} <span style="color:#f472b6; font-weight:bold;">${meta.parenText}</span> <span style="color:${meta.roleColor}; font-size:10px; font-weight:bold;">[${meta.roleShort}]</span>`;
        }
      }
    });
  });
}

window.addEventListener('DOMContentLoaded', () => {
  normalizeStaticDomLabels();
  if (typeof window.openUmaDetailModal === 'function' && !window.openUmaDetailModal._gtHooked) {
    const origOpenUmaModal = window.openUmaDetailModal;
    window.openUmaDetailModal = function (u, idx, isMyBoard) {
      const res = origOpenUmaModal.apply(this, arguments);
      setTimeout(() => enhanceUmaDetailModalSkills(u), 20);
      return res;
    };
    window.openUmaDetailModal._gtHooked = true;
  }
});

// =========================================================================
// HIỆU ỨNG LẬT MỞ TỪNG MAP (1 -> 7) KÈM MÙA GIẢI (SEASON)
// =========================================================================
function startDramaticMapReveal(maps) {
  revealTimers.forEach(t => clearTimeout(t));
  revealTimers = [];

  const overlay = document.getElementById('map-reveal-overlay');
  const container = document.getElementById('reveal-cards-container');
  const leftPreGameList = document.getElementById('pregame-map-list');

  container.innerHTML = '';
  leftPreGameList.innerHTML = '<div style="font-size:10px; color:#64748b; text-align:center; font-weight:600;">Click vào sân đua để mở Map Helper</div>';
  overlay.style.display = 'flex';

  maps.forEach((m, idx) => {
    const card = document.createElement('div');
    card.id = `reveal-card-${idx}`;
    card.className = 'reveal-map-card' + (m.slot === 'Tie break' ? ' tiebreak-card' : '');
    const surfColor = m.surface === 'Turf' ? '#4ade80' : '#fb923c';
    const seasonLabel = m.season || 'Spring';

    card.innerHTML = `
      <div style="font-size:11px; font-weight:bold; color:${m.slot === 'Tie break' ? '#f43f5e' : '#38bdf8'};">
        ${m.slot.toUpperCase()} • ${seasonLabel.toUpperCase()}
      </div>
      <div>
        <div style="font-size:15px; font-weight:bold; color:#fff; margin:6px 0;">${m.name}</div>
        <div style="font-size:10.5px; color:#94a3b8;">${m.famousRace || ''}</div>
      </div>
      <div>
        <span style="display:inline-block; padding:2px 8px; border-radius:4px; background:#0f172a; color:${surfColor}; font-size:11px; font-weight:bold;">
          ${m.surface} • ${m.distanceType}
        </span>
        <div style="font-size:11px; color:#facc15; margin-top:6px;">Mùa: ${seasonLabel} | Sân: ${m.condition}</div>
      </div>
    `;
    container.appendChild(card);
  });

  maps.forEach((m, idx) => {
    const t = setTimeout(() => {
      const seasonLabel = m.season || 'Spring';
      document.getElementById('reveal-current-slot').innerText = `CHẶNG ${idx + 1} / 7 — ${m.slot.toUpperCase()}`;
      document.getElementById('reveal-current-name').innerText = `${m.name} (${m.famousRace || 'G1 Track'})`;
      document.getElementById('reveal-current-meta').innerText =
        `${m.surface} | ${m.distanceType} (${m.length}m) | Mùa: ${seasonLabel} | Sân: ${m.condition}`;

      const cardEl = document.getElementById(`reveal-card-${idx}`);
      if (cardEl) cardEl.classList.add('revealed');
      appendSingleMapToPanel('pregame-map-list', m, idx);
    }, idx * 700 + 200);
    revealTimers.push(t);
  });

  const endTimer = setTimeout(() => finishMapReveal(maps), maps.length * 700 + 1400);
  revealTimers.push(endTimer);

  document.getElementById('btn-skip-reveal').onclick = () => finishMapReveal(maps);
}

function finishMapReveal(maps) {
  revealTimers.forEach(t => clearTimeout(t));
  revealTimers = [];
  document.getElementById('map-reveal-overlay').style.display = 'none';
  renderMapList('pregame-map-list', maps);
}

function appendSingleMapToPanel(containerId, m, idx = 0) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const curYear = latestGameState ? Number(latestGameState.year) : 0;
  const isCurrentYearMap = containerId === 'ui-map-list' && !m.raceResult && (
    (curYear === 1 && (idx === 0 || idx === 1)) ||
    (curYear === 2 && (idx === 2 || idx === 3)) ||
    (curYear === 3 && (idx === 4 || idx === 5))
  );
  const isCompleted = Boolean(m.raceResult);

  const div = document.createElement('div');
  div.className = 'map-item slam-anim'
    + (m.slot === 'Tie break' ? ' tiebreak' : '')
    + (isCurrentYearMap ? ' active-year-map' : '')
    + (isCompleted ? ' completed-map' : '');

  div.title = 'Click hoặc Chuột phải để mở Map Helper';
  div.onclick = () => openMapBlueprintModal(m);
  div.oncontextmenu = (e) => {
    e.preventDefault();
    openMapBlueprintModal(m);
  };

  const seasonLabel = m.season || 'Spring';
  const surfCol = m.surface === 'Turf' ? '#4ade80' : '#fb923c';
  const condCol = m.condition === '???' ? '#94a3b8' : '#facc15';

  const activeBadge = isCurrentYearMap
    ? `<span style="font-size:8.5px; background:#facc15; color:#090d16; padding:1px 5px; border-radius:3px; font-weight:800; letter-spacing:0.2px;">NĂM NAY</span>`
    : `<span style="font-size:9px; background:#090d16; border:1px solid #334155; color:#38bdf8; padding:1px 5px; border-radius:4px; font-weight:700; flex-shrink:0;">${seasonLabel}</span>`;

  const resultHtml = m.raceResult
    ? `<div style="font-size:10px; color:#4ade80; margin-top:4px; font-weight:bold; border-top:1px solid #1e293b; padding-top:3px;">
         Hạng 1: ${m.raceResult.winnerName} (${m.raceResult.ownerName})
       </div>`
    : '';

  div.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; gap:4px;">
      <strong style="font-size:11.5px; color:${isCurrentYearMap ? '#fef08a' : '#f8fafc'};">${m.slot}: ${m.name}</strong>
      ${activeBadge}
    </div>
    <div style="font-size:10px; color:#94a3b8; margin:2px 0;">${m.famousRace || ''} • Mùa ${seasonLabel}</div>
    <div class="map-meta-pills">
      <span class="map-mini-pill" style="color:${surfCol}; border-color:${surfCol}44;">${m.surface}</span>
      <span class="map-mini-pill">${m.distanceType} ${m.length}m</span>
      <span class="map-mini-pill" style="color:${condCol};">Sân: ${m.condition}</span>
    </div>
    ${resultHtml}
  `;
  el.appendChild(div);
}

function renderMapList(containerId, maps) {
  currentMapsList = maps || [];
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<div style="font-size:10px; color:#64748b; text-align:center; margin-bottom:4px; font-weight:600;">Click vào sân đua để mở Map Helper</div>';
  maps.forEach((m, idx) => appendSingleMapToPanel(containerId, m, idx));
}

// =========================================================================
// ĐIỀU HƯỚNG TỪNG BƯỚC PRE-GAME (STEP 1 -> STEP 2 -> STEP 3)
// =========================================================================
function goToPreGameStep(stepNum) {
  if (stepNum >= 2 && selectedUmaIds.length !== 3) {
    showToast('Hãy chọn đủ 3 Uma Chủ Lực ở Bước 1 trước khi tiếp tục!', true);
    return;
  }
  currentPreGameStep = stepNum;
  normalizeStaticDomLabels();

  [1, 2, 3].forEach(s => {
    const panel = document.getElementById(`pregame-step-${s}`);
    const tab = document.getElementById(`step-tab-${s}`);
    if (panel) panel.style.display = s === stepNum ? 'flex' : 'none';
    if (tab) {
      tab.classList.remove('active', 'completed');
      if (s === stepNum) tab.classList.add('active');
      else if (s < stepNum) tab.classList.add('completed');
    }
  });

  renderPreGameUI();
  renderDeckBuilderUI();
}

function computeRankFromSparks(baseRank, sparkCount) {
  const baseIdx = RANKS.indexOf(baseRank);
  let stepsGained = 0;
  if (sparkCount >= 10) stepsGained = 4;
  else if (sparkCount >= 7) stepsGained = 3;
  else if (sparkCount >= 4) stepsGained = 2;
  else if (sparkCount >= 1) stepsGained = 1;

  const maxInitialIdx = RANKS.indexOf('A');
  return RANKS[Math.min(maxInitialIdx, baseIdx + stepsGained)];
}

function getUsedSparks(umaId) {
  const map = allocatedSparks[umaId] || {};
  return Object.values(map).reduce((sum, val) => sum + (val || 0), 0);
}

function adjustSparkCount(umaId, aptKey, delta) {
  if (!allocatedSparks[umaId]) allocatedSparks[umaId] = {};
  const current = allocatedSparks[umaId][aptKey] || 0;
  const next = current + delta;
  if (next < 0 || next > 18) return;
  if (getUsedSparks(umaId) + delta > 18) return;

  allocatedSparks[umaId][aptKey] = next;
  renderPreGameUI();
}

function setUmaFilter(filterKey) {
  currentUmaFilter = filterKey;
  const btns = document.querySelectorAll('#uma-filter-bar .filter-btn');
  btns.forEach(b => {
    b.classList.toggle('active', b.innerText.includes(filterKey) || (filterKey === 'ALL' && b.innerText === 'Tất Cả'));
  });
  renderPreGameUI();
}

function setCardTypeFilter(typeKey) {
  currentCardTypeFilter = typeKey;
  renderDeckBuilderUI();
}

function applyDeckPreset(presetType) {
  if (presetType === 'balanced40') {
    const picked = [];
    ['Speed', 'Stamina', 'Power', 'Guts', 'Wit'].forEach(t => {
      supportPool.filter(c => c.type === t).slice(0, 8).forEach(c => picked.push(c.uid));
    });
    selectedDeckUids = picked;
    showToast('Đã chọn nhanh 40 thẻ SSR (8 thẻ mỗi hệ).');
  } else if (presetType === 'clear') {
    selectedDeckUids = [];
  }
  renderDeckBuilderUI();
}

// =========================================================================
// BƯỚC 3 PRE-GAME: CHỌN 40 THẺ SUPPORT SSR
// =========================================================================
function renderDeckBuilderUI() {
  normalizeStaticDomLabels();
  document.getElementById('deck-selected-count').innerText = selectedDeckUids.length;
  const counts = { Speed: 0, Stamina: 0, Power: 0, Guts: 0, Wit: 0 };
  selectedDeckUids.forEach(uid => {
    const c = supportPool.find(x => x.uid === uid);
    if (c && counts[c.type] !== undefined) counts[c.type]++;
  });

  document.getElementById('deck-type-breakdown').innerHTML = `
    Kho thẻ: <b>${supportPool.length} SSR</b> &nbsp;•&nbsp; Đã chọn: 
    <span style="color:#38bdf8;">Speed <b>${counts.Speed}/12</b></span> &nbsp;|&nbsp;
    <span style="color:#fb7185;">Stamina <b>${counts.Stamina}/12</b></span> &nbsp;|&nbsp;
    <span style="color:#fbbf24;">Power <b>${counts.Power}/12</b></span> &nbsp;|&nbsp;
    <span style="color:#f472b6;">Guts <b>${counts.Guts}/12</b></span> &nbsp;|&nbsp;
    <span style="color:#34d399;">Wit <b>${counts.Wit}/12</b></span>
  `;

  const filterBar = document.getElementById('card-filter-bar');
  const types = ['ALL', 'Speed', 'Stamina', 'Power', 'Guts', 'Wit'];
  filterBar.innerHTML = types.map(t => {
    const isActive = currentCardTypeFilter === t ? 'active' : '';
    if (t === 'ALL') {
      return `<button class="filter-btn ${isActive}" onclick="setCardTypeFilter('ALL')">Tất Cả (${supportPool.length})</button>`;
    }
    const totalOfType = supportPool.filter(c => c.type === t).length;
    return `<button class="filter-btn ${isActive}" onclick="setCardTypeFilter('${t}')">
      ${renderStatIconHTML(t, 16)} <span>${t} (${counts[t]}/12 — ${totalOfType})</span>
    </button>`;
  }).join('');

  const container = document.getElementById('deck-pool-container');
  container.innerHTML = '';
  supportPool
    .filter(c => currentCardTypeFilter === 'ALL' || c.type === currentCardTypeFilter)
    .forEach(card => {
      const isSelected = selectedDeckUids.includes(card.uid);
      const theme = TYPE_THEME_COLORS[card.type] || TYPE_THEME_COLORS.Speed;
      const { mainName, subTitle } = splitEntityNameAndTitle(card.name);

      const div = document.createElement('div');
      div.className = `deck-pool-card card-theme-${card.type}` + (isSelected ? ' in-deck' : '');
      div.title = `${card.name}\n• Click trái: Thêm / Bỏ khỏi Bộ bài\n• Chuột phải: Xem chi tiết thẻ`;

      div.onclick = () => {
        if (isSelected) {
          selectedDeckUids = selectedDeckUids.filter(id => id !== card.uid);
        } else {
          if (selectedDeckUids.length >= 40) return showToast('Bộ bài đã đủ 40 lá!', true);
          if (counts[card.type] >= 12) return showToast(`Hệ ${card.type} chỉ được tối đa 12 lá!`, true);
          selectedDeckUids.push(card.uid);
        }
        renderDeckBuilderUI();
      };
      div.oncontextmenu = (e) => {
        e.preventDefault();
        openCardZoom(card);
      };

      const wRow = formatCleanSkillRowHTML(
        `<span class="skill-tag-label tag-white" style="margin:0;">W</span>`,
        card.whiteSkill,
        card.whiteSkillData || card.whiteMechanics
      );
      const gRow = formatCleanSkillRowHTML(
        `<span class="skill-tag-label tag-gold" style="margin:0;">G</span>`,
        card.goldSkill,
        card.goldSkillData || card.goldMechanics
      );

      const statusBadge = isSelected
        ? `<span style="background:#10b981; color:#052e16; font-size:9px; font-weight:800; padding:1px 6px; border-radius:4px; flex-shrink:0;">✓ ĐÃ CHỌN</span>`
        : `<span style="background:rgba(15,23,42,0.8); border:1px solid ${theme.border}; color:${theme.main}; font-size:9px; font-weight:800; padding:1px 5px; border-radius:4px; flex-shrink:0;">${theme.short}</span>`;

      div.innerHTML = `
        <div class="card-thumb-wrap">
          <img class="support-card-icon" style="width:44px; height:44px; border-radius:8px; border:1.5px solid ${isSelected ? '#4ade80' : theme.main};" src="${card.icon}" onerror="this.src='${fallbackAvatar(card.type, '#475569')}'">
          ${renderStatIconHTML(card.type, 15, 'card-type-corner')}
        </div>
        <div style="min-width:0; flex:1;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
            <div style="font-weight:800; font-size:11.5px; color:#ffffff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${subTitle}">${mainName}</div>
            ${statusBadge}
          </div>
          <div style="color:#e2e8f0;">${wRow}</div>
          <div style="color:#facc15;">${gRow}</div>
        </div>
      `;
      container.appendChild(div);
    });
}

// =========================================================================
// XỬ LÝ KÉO THẢ THẺ BÀI VÀO UMA (TRANG BỊ vs GOLD AWAKENING)
// =========================================================================
function handleCardDropOnUma(cardUid, umaIndex) {
  if (!latestGameState) return;
  const card = latestGameState.myHand.find(c => c.uid === cardUid);
  const uma = latestGameState.myUmas[umaIndex];
  if (!card || !uma) return;

  const eligibleTargets = (uma.equippedCards || []).filter(
    eq => !eq.isGoldAwakened && (eq.type === card.type || card.type === 'Guts')
  );

  if (eligibleTargets.length === 0) {
    socket.emit('play_card_on_uma', {
      roomCode: currentRoomCode,
      sessionToken,
      cardUid: card.uid,
      umaIndex,
      mode: 'equip'
    });
    return;
  }
  openCardActionModal(card, uma, umaIndex, eligibleTargets);
}

function openCardActionModal(card, uma, umaIndex, eligibleTargets) {
  const modal = document.getElementById('card-choice-modal');
  document.getElementById('choice-modal-header').innerText = `Sử dụng Support Card lên ${uma.name}`;

  const wHtml = formatSkillInlineHTML(card.whiteSkill, card.whiteSkillData || card.whiteMechanics, true);
  const gHtml = formatSkillInlineHTML(card.goldSkill, card.goldSkillData || card.goldMechanics, true);

  document.getElementById('choice-dragged-card-preview').innerHTML = `
    <div class="card-thumb-wrap">
      <img class="support-card-icon" src="${card.icon}" onerror="this.src='${fallbackAvatar(card.type, '#475569')}'">
      ${renderStatIconHTML(card.type, 16, 'card-type-corner')}
    </div>
    <div style="font-size:12px;">
      <strong style="color:#facc15; font-size:14px;">${card.name}</strong>
      <span style="color:#94a3b8;">(${card.type === 'Guts' ? 'Guts - Wildcard' : card.type})</span><br>
      <span class="skill-tag-label tag-white">WHITE</span><b>${wHtml}</b><br>
      <span class="skill-tag-label tag-gold">GOLD</span><b style="color:#facc15;">${gHtml}</b>
    </div>
  `;

  const eqCards = uma.equippedCards || [];
  const isFull = eqCards.length >= 5;
  const isDuplicate = eqCards.some(eq => eq.baseId === card.baseId);
  const btnEquip = document.getElementById('btn-confirm-equip');
  const equipDesc = document.getElementById('choice-equip-desc');

  if (isFull) {
    equipDesc.innerHTML = `<span style="color:#f43f5e;">${uma.name} đã đầy 5/5 ô trang bị thẻ.</span>`;
    btnEquip.disabled = true;
  } else if (isDuplicate) {
    equipDesc.innerHTML = `<span style="color:#f43f5e;">${uma.name} đã trang bị thẻ [${card.name}] rồi.</span>`;
    btnEquip.disabled = true;
  } else {
    equipDesc.innerHTML = `Gắn vào ô Hỗ trợ (${eqCards.length + 1}/5) để nhận kỹ năng <b>${wHtml}</b> và +1 Rainbow ${renderStatIconHTML(card.type, 14)}.`;
    btnEquip.disabled = false;
    btnEquip.onclick = () => {
      modal.style.display = 'none';
      socket.emit('play_card_on_uma', {
        roomCode: currentRoomCode,
        sessionToken,
        cardUid: card.uid,
        umaIndex,
        mode: 'equip'
      });
    };
  }

  const listEl = document.getElementById('choice-eligible-list');
  listEl.innerHTML = '';
  eligibleTargets.forEach(targetCard => {
    const targetGoldHtml = formatSkillInlineHTML(targetCard.goldSkill, targetCard.goldSkillData || targetCard.goldMechanics, true);
    const item = document.createElement('div');
    item.className = 'eligible-target-item';
    item.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <div class="card-thumb-wrap">
          <img class="support-card-icon" src="${targetCard.icon}" onerror="this.src='${fallbackAvatar(targetCard.type, '#475569')}'">
          ${renderStatIconHTML(targetCard.type, 16, 'card-type-corner')}
        </div>
        <div style="font-size:12px;">
          <strong>${targetCard.name}</strong><br>
          <span style="color:#94a3b8; text-decoration:line-through;">${targetCard.whiteSkill}</span>
          <span style="color:#facc15; font-weight:bold;"> -> [GOLD] ${targetGoldHtml}</span>
        </div>
      </div>
      <button style="width:auto; padding:7px 14px; background:linear-gradient(90deg,#ca8a04,#eab308); color:#000; margin:0; font-size:12px;">
        Gold Awakening
      </button>
    `;
    item.onclick = () => {
      modal.style.display = 'none';
      socket.emit('play_card_on_uma', {
        roomCode: currentRoomCode,
        sessionToken,
        cardUid: card.uid,
        umaIndex,
        mode: 'awaken',
        targetEquippedUid: targetCard.uid
      });
    };
    listEl.appendChild(item);
  });

  modal.style.display = 'flex';
}

// =========================================================================
// KẾT NỐI PHÒNG & KHỞI TẠO NÚT HƯỚNG DẪN + DISCORD TẠI SẢNH CHÍNH
// =========================================================================
initLobbyGuideSystem();

window.onload = () => {
  initLobbyGuideSystem();
  const savedRoom = localStorage.getItem('twinkle_current_room');
  if (savedRoom && document.getElementById('join-code-input')) {
    document.getElementById('join-code-input').value = savedRoom;
  }
};

document.getElementById('btn-create').onclick = () => {
  socket.emit('create_room', { playerName: document.getElementById('player-name').value, sessionToken });
};

socket.on('room_created', ({ roomCode }) => {
  currentRoomCode = roomCode;
  localStorage.setItem('twinkle_current_room', roomCode);
  document.getElementById('created-code-area').style.display = 'block';
  document.getElementById('display-room-code').innerText = roomCode;
});

document.getElementById('btn-join').onclick = () => {
  const code = document.getElementById('join-code-input').value.trim().toUpperCase();
  currentRoomCode = code;
  localStorage.setItem('twinkle_current_room', code);
  socket.emit('join_room', { roomCode: code, playerName: document.getElementById('player-name').value, sessionToken });
};

socket.on('error_msg', msg => document.getElementById('lobby-error').innerText = msg);

socket.on('enter_pregame', (data) => {
  currentRoomCode = data.roomCode;
  umaPool = data.umaPool || [];
  supportPool = data.supportPool || [];
  currentMapsList = data.maps || [];

  selectedUmaIds = [];
  selectedDeckUids = [];
  umaPool.forEach(u => { allocatedSparks[u.id] = {}; });

  const lockBtn = document.getElementById('btn-lock-pregame');
  if (lockBtn) {
    lockBtn.disabled = false;
    lockBtn.innerText = 'Chốt Đội Hình & Bắt Đầu Trận Đấu';
  }

  const guideModal = document.getElementById('guide-modal-overlay');
  if (guideModal) guideModal.style.display = 'none';
  setLobbyDiscordVisible(false);
  normalizeStaticDomLabels();

  document.getElementById('lobby-screen').style.display = 'none';
  document.getElementById('pregame-screen').style.display = 'grid';
  document.getElementById('uma-total-count').innerText = umaPool.length;

  goToPreGameStep(1);

  if (!data.isReconnect) {
    startDramaticMapReveal(data.maps);
  } else {
    renderMapList('pregame-map-list', data.maps);
  }
});

// =========================================================================
// BƯỚC 1 & BƯỚC 2 PRE-GAME: CHỌN 3 UMA (CỐ ĐỊNH 3 DÒNG TRONG KHUNG, KHÔNG TRÀN VIỀN)
// =========================================================================
function renderPreGameUI() {
  document.getElementById('selected-count').innerText = selectedUmaIds.length;
  const searchVal = (document.getElementById('uma-search-input')?.value || '').trim().toLowerCase();
  const poolEl = document.getElementById('uma-pool-container');
  poolEl.innerHTML = '';

  const filteredUmas = umaPool.filter(u => {
    if (searchVal && !u.name.toLowerCase().includes(searchVal)) return false;
    if (currentUmaFilter === 'ALL') return true;
    const rank = u.aptitudes[currentUmaFilter];
    return rank === 'A' || rank === 'B' || rank === 'S';
  });

  if (filteredUmas.length === 0) {
    poolEl.innerHTML = `<div style="grid-column: 1 / 5; padding: 20px; text-align: center; color: #94a3b8;">
      Không tìm thấy Uma nào khớp với "${searchVal}".
    </div>`;
  } else {
    filteredUmas.forEach(u => {
      const selIndex = selectedUmaIds.indexOf(u.id);
      const isSel = selIndex !== -1;
      const { mainName, subTitle } = splitEntityNameAndTitle(u.name);

      const item = document.createElement('div');
      item.className = 'roster-item' + (isSel ? ' selected' : '');
      item.title = `${u.name}\n• Click trái: Chọn / Bỏ chọn Uma\n• Chuột phải: Xem toàn bộ chỉ số & kỹ năng`;

      item.onclick = () => {
        if (isSel) selectedUmaIds = selectedUmaIds.filter(id => id !== u.id);
        else if (selectedUmaIds.length < 3) selectedUmaIds.push(u.id);
        else showToast('Bạn đã chọn đủ 3 Uma!', true);
        renderPreGameUI();
      };

      item.oncontextmenu = (e) => {
        e.preventDefault();
        if (typeof openUmaDetailModal === 'function') {
          openUmaDetailModal(u, null, false);
          setTimeout(() => enhanceUmaDetailModalSkills(u), 25);
        }
      };

      const goldPotNames = (u.potSkills || []).filter(p => p.isGold).map(p => p.name);
      const goldPotsLine = goldPotNames.length > 0
        ? `★ ${goldPotNames.join(' • ')}`
        : '★ Standard Pot';

      const strongAptPills = renderStrongAptitudeBadges(u.aptitudes);
      const selBadge = isSel
        ? `<span style="background:#10b981; color:#052e16; font-size:8.5px; font-weight:800; padding:1px 5px; border-radius:4px; flex-shrink:0;">#${selIndex + 1}</span>`
        : '';

      item.innerHTML = `
        <img class="uma-avatar" style="width:44px; height:44px; border-radius:9px; border:2px solid ${isSel ? '#10b981' : '#475569'}; flex-shrink:0; object-fit:cover;" src="${u.icon}" onerror="if(this.src!=='${u.fallbackIcon||''}' && '${u.fallbackIcon||''}'){this.src='${u.fallbackIcon}';}else{this.src='${fallbackAvatar(u.name, u.color)}';}">
        <div style="min-width:0; flex:1; display:flex; flex-direction:column; gap:3px;">
          <!-- Dòng 1: Tên chính + Phụ đề trang phục + Nhãn chọn -->
          <div style="display:flex; justify-content:space-between; align-items:baseline; gap:4px;">
            <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              <strong style="font-size:12px; color:#ffffff;">${mainName}</strong>
              ${subTitle ? `<span style="font-size:9px; color:#94a3b8; margin-left:4px;">${subTitle}</span>` : ''}
            </div>
            ${selBadge}
          </div>
          <!-- Dòng 2: 3 Nhãn Thích nghi gộp gọn trên 1 hàng duy nhất -->
          <div style="display:flex; align-items:center; gap:4px; flex-wrap:nowrap; overflow:hidden;">
            ${strongAptPills}
          </div>
          <!-- Dòng 3: Kỹ năng Vàng có sẵn trong Pot trên 1 hàng duy nhất -->
          <div style="font-size:9.5px; color:#facc15; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${goldPotsLine}
          </div>
        </div>
      `;
      poolEl.appendChild(item);
    });
  }

  // Bước 2: Phân bổ 18 Spark Hồng
  const sparkEl = document.getElementById('spark-editor-container');
  sparkEl.innerHTML = '';
  const APT_GROUPS = [
    { label: 'MẶT SÂN (SURFACE)', keys: ['Turf', 'Dirt'], color: '#34d399' },
    { label: 'CỰ LY (DISTANCE)', keys: ['Sprint', 'Mile', 'Medium', 'Long'], color: '#38bdf8' },
    { label: 'CHIẾN THUẬT (STYLE)', keys: ['Front', 'Pace', 'Late', 'End'], color: '#c084fc' }
  ];

  selectedUmaIds.forEach((id, idx) => {
    const u = umaPool.find(x => x.id === id);
    if (!u) return;
    const used = getUsedSparks(u.id);
    const { mainName, subTitle } = splitEntityNameAndTitle(u.name);

    const card = document.createElement('div');
    card.className = 'spark-card';
    card.style.cssText = 'background:linear-gradient(180deg, rgba(30,41,59,0.85) 0%, rgba(15,23,42,0.96) 100%); border:1px solid #334155; border-top:3px solid #f472b6; border-radius:12px; padding:12px;';

    let groupsHTML = '';
    APT_GROUPS.forEach(grp => {
      let rowsHTML = '';
      grp.keys.forEach(aptKey => {
        const baseRank = u.aptitudes[aptKey] || 'G';
        const sparks = (allocatedSparks[u.id] && allocatedSparks[u.id][aptKey]) || 0;
        const finalRank = computeRankFromSparks(baseRank, sparks);
        const inheritChance = sparks * 8;

        rowsHTML += `
          <div class="apt-row" style="padding:3px 6px; border-radius:5px; background:${sparks > 0 ? 'rgba(244, 114, 182, 0.12)' : 'transparent'};">
            <span><b>${aptKey}</b> <span style="color:#64748b; font-size:10px;">(Gốc ${baseRank})</span></span>
            <div style="display:flex; align-items:center; gap:5px;">
              <span style="font-size:10px; color:${sparks > 0 ? '#f472b6' : '#64748b'}; font-weight:${sparks > 0 ? '700' : '400'};">${sparks} Spark (${inheritChance}%)</span>
              <span class="rank-badge rank-${finalRank}">${finalRank}</span>
              <button class="apt-btn" onclick="adjustSparkCount('${u.id}','${aptKey}',-1)">-</button>
              <button class="apt-btn" onclick="adjustSparkCount('${u.id}','${aptKey}',1)">+</button>
            </div>
          </div>
        `;
      });

      groupsHTML += `
        <div style="margin-top:8px; background:rgba(9,13,22,0.55); border:1px solid #1e293b; border-radius:8px; padding:6px 8px;">
          <div style="font-size:9.5px; font-weight:800; color:${grp.color}; letter-spacing:0.4px; margin-bottom:4px;">${grp.label}</div>
          ${rowsHTML}
        </div>
      `;
    });

    card.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding-bottom:8px; border-bottom:1px solid #1e293b; cursor:context-menu;" title="Chuột phải để xem chi tiết Uma" oncontextmenu="event.preventDefault(); if(typeof openUmaDetailModal==='function'){ const uObj = umaPool.find(x=>x.id==='${u.id}'); openUmaDetailModal(uObj, null, false); setTimeout(()=>enhanceUmaDetailModalSkills(uObj), 25); }">
        <div style="display:flex; align-items:center; gap:9px; min-width:0;">
          <img class="uma-avatar" style="width:44px; height:44px; border-radius:10px; border:2px solid #f472b6;" src="${u.icon}" onerror="if(this.src!=='${u.fallbackIcon||''}' && '${u.fallbackIcon||''}'){this.src='${u.fallbackIcon}';}else{this.src='${fallbackAvatar(u.name, u.color)}';}">
          <div style="min-width:0;">
            <strong style="font-size:13px; color:#fff;">Uma ${idx + 1}: ${mainName}</strong>
            ${subTitle ? `<div style="font-size:10px; color:#94a3b8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${subTitle}</div>` : ''}
          </div>
        </div>
        <div style="background:rgba(244,114,182,0.16); border:1px solid #f472b6; border-radius:6px; padding:4px 8px; text-align:right; flex-shrink:0;">
          <div style="font-size:9px; color:#fbcfe8; font-weight:700;">SPARK CÒN LẠI</div>
          <strong style="font-size:13px; color:#f472b6;">${18 - used} / 18</strong>
        </div>
      </div>
      ${groupsHTML}
    `;
    sparkEl.appendChild(card);
  });
}

document.getElementById('btn-lock-pregame').onclick = () => {
  if (selectedUmaIds.length !== 3) return showToast('Hãy chọn đủ 3 Uma!', true);
  if (selectedDeckUids.length !== 40) return showToast('Bộ bài (Deck) phải có đủ 40 lá (Hiện tại: ' + selectedDeckUids.length + '/40)!', true);

  const chosenUmas = selectedUmaIds.map(id => {
    const u = JSON.parse(JSON.stringify(umaPool.find(x => x.id === id)));
    u.pinkSparks = allocatedSparks[id] || {};
    Object.keys(u.aptitudes).forEach(k => {
      const sp = u.pinkSparks[k] || 0;
      u.aptitudes[k] = computeRankFromSparks(u.aptitudes[k], sp);
    });
    return u;
  });
  document.getElementById('btn-lock-pregame').innerText = 'Đang chờ đối thủ...';
  document.getElementById('btn-lock-pregame').disabled = true;
  socket.emit('submit_pregame', {
    roomCode: currentRoomCode,
    sessionToken,
    chosenUmas,
    chosenDeckUids: selectedDeckUids
  });
};

// =========================================================================
// KÉO THẢ NĂNG LƯỢNG, REST & Ô BỎ BÀI ĐỔI NĂNG LƯỢNG
// =========================================================================
const energyOrbEl = document.getElementById('ui-current-energy');
energyOrbEl.ondragstart = (e) => {
  if (energyOrbEl.classList.contains('used')) {
    e.preventDefault();
    return;
  }
  draggedPayload = { kind: 'energy' };
  e.dataTransfer.setData('text/plain', 'energy');
};

const restTokenEl = document.getElementById('draggable-rest-token');
if (restTokenEl) {
  restTokenEl.innerText = 'REST (Kéo thả vào Uma)';
  restTokenEl.ondragstart = (e) => {
    if (energyOrbEl.classList.contains('used')) {
      showToast('[LỖI] Bạn đã dùng Năng lượng lượt này rồi.', true);
      e.preventDefault();
      return;
    }
    draggedPayload = { kind: 'rest' };
    e.dataTransfer.setData('text/plain', 'rest');
  };
}

const discardZone = document.getElementById('bottom-left-discard-zone');
discardZone.ondragover = (e) => {
  if (draggedPayload && draggedPayload.kind === 'card') {
    e.preventDefault();
    discardZone.classList.add('drop-target-hover');
  }
};
discardZone.ondragleave = () => discardZone.classList.remove('drop-target-hover');
discardZone.ondrop = (e) => {
  e.preventDefault();
  discardZone.classList.remove('drop-target-hover');
  if (draggedPayload && draggedPayload.kind === 'card') {
    socket.emit('convert_energy_with_card', {
      roomCode: currentRoomCode,
      sessionToken,
      cardUid: draggedPayload.cardUid
    });
  }
  draggedPayload = null;
};

// =========================================================================
// RENDER BÀN ĐẤU CHÍNH (PHÂN VÙNG RÕ RỆT & SẠCH ĐẸP)
// =========================================================================
socket.on('match_start', (data) => {
  finishMapReveal(data.maps || []);
  setLobbyDiscordVisible(false);
  normalizeStaticDomLabels();
  document.getElementById('lobby-screen').style.display = 'none';
  document.getElementById('pregame-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'grid';
  document.getElementById('ui-room-code').innerText = data.roomCode;
  updateGameState(data);
});

function renderUmasToContainer(containerId, umas, isMyBoard) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  if (!umas || umas.length === 0) {
    container.innerHTML = '<div style="font-size:11px; color:#94a3b8; padding:10px;">Chưa chọn Uma</div>';
    return;
  }

  umas.forEach((u, idx) => {
    const div = document.createElement('div');
    const teamClass = isMyBoard ? 'my-team-card' : 'opp-team-card';
    const { mainName, subTitle } = splitEntityNameAndTitle(u.name);

    div.className = `uma-card-mini ${teamClass}` + (isMyBoard && lastAnimatedUmaIndex === idx ? ' slam-anim' : '');
    div.title = 'Chuột phải vào Uma để xem chi tiết chỉ số, kỹ năng & đổi chiến thuật chạy';

    div.oncontextmenu = (e) => {
      if (e.target.classList.contains('mini-eq-icon')) return;
      e.preventDefault();
      if (typeof openUmaDetailModal === 'function') {
        openUmaDetailModal(u, idx, isMyBoard);
        setTimeout(() => enhanceUmaDetailModalSkills(u), 25);
      }
    };

    if (isMyBoard) {
      div.ondragover = (e) => {
        e.preventDefault();
        div.classList.add('drop-target-hover');
      };
      div.ondragleave = () => div.classList.remove('drop-target-hover');
      div.ondrop = (e) => {
        e.preventDefault();
        div.classList.remove('drop-target-hover');
        lastAnimatedUmaIndex = idx;
        if (!draggedPayload) return;

        if (draggedPayload.kind === 'card') {
          handleCardDropOnUma(draggedPayload.cardUid, idx);
        } else if (draggedPayload.kind === 'energy') {
          socket.emit('train_uma_with_energy', { roomCode: currentRoomCode, sessionToken, umaIndex: idx });
        } else if (draggedPayload.kind === 'rest') {
          socket.emit('rest_uma', { roomCode: currentRoomCode, sessionToken, umaIndex: idx });
        } else if (draggedPayload.kind === 'item') {
          socket.emit('use_inventory_item', {
            roomCode: currentRoomCode,
            sessionToken,
            itemUid: draggedPayload.itemUid,
            umaIndex: idx
          });
        }
        draggedPayload = null;
      };
    }

    const fRate = u.failRate || 0;
    const failBg = fRate >= 25 ? 'rgba(244, 63, 94, 0.2)' : (fRate > 0 ? 'rgba(250, 204, 21, 0.18)' : 'rgba(74, 222, 128, 0.15)');
    const failBorder = fRate >= 25 ? '#f43f5e' : (fRate > 0 ? '#facc15' : '#4ade80');
    const failColor = fRate >= 25 ? '#fda4af' : (fRate > 0 ? '#fef08a' : '#86efac');

    const eqCards = u.equippedCards || [];
    const skills = u.skills || [];
    const activeStyle = u.activeStyle || 'Pace';
    const activeStyleRank = (u.aptitudes && u.aptitudes[activeStyle]) || 'A';

    const strongAptPills = renderStrongAptitudeBadges(u.aptitudes);
    const uqMeta = getSkillGameToraMeta(u.uniqueSkill, u.uniqueSkillData);
    const uqParen = uqMeta.parenText ? ` <span class="gt-cond-tag">${uqMeta.parenText}</span>` : '';

    const ownedGoldSet = new Set();
    skills.forEach(s => {
      if (s && s.name && (s.isGold || String(s.name).includes('◎'))) {
        ownedGoldSet.add(normalizeSkillBaseNameUI(s.name));
      }
    });
    const learnedCardSkills = skills.filter(s => !s.fromPot && (s.isGold || !isWhiteSupersededByOwnedGoldUI(s.name, ownedGoldSet)));
    const goldPotSkills = skills.filter(s => s.fromPot && s.isGold);
    const displaySkills = [...learnedCardSkills, ...goldPotSkills];

    const subSkillsRowsHTML = displaySkills.map(s => {
      const meta = getSkillGameToraMeta(s.name, s.mechanics);
      const pSpan = meta.parenText ? ` <span class="gt-cond-tag">${meta.parenText}</span>` : '';
      const rowCls = s.isGold ? 'gold-row' : 'white-row';
      const dotHtml = s.isGold
        ? `<span class="sk-dot-gold">★</span>`
        : `<span class="sk-dot-white">●</span>`;
      return `
        <div class="uma-skill-row-item ${rowCls}" title="${meta.tooltip.replace(/"/g, '&quot;')}">
          <div class="clean-skill-left">
            ${dotHtml}
            <span class="clean-skill-name">${meta.name}${pSpan}</span>
          </div>
          <span class="gt-role-tag" style="border-color:${meta.roleColor}66; color:${meta.roleColor};">${meta.roleShort}</span>
        </div>
      `;
    }).join('');

    div.innerHTML = `
      <div>
        <div class="uma-header-modern">
          <img class="uma-avatar-modern" style="border-color:${isMyBoard ? '#10b981' : '#f43f5e'};" src="${u.icon}" onerror="if(this.src!=='${u.fallbackIcon||''}' && '${u.fallbackIcon||''}'){this.src='${u.fallbackIcon}';}else{this.src='${fallbackAvatar(u.name, u.color)}';}">
          <div class="uma-title-col">
            <div class="uma-name-row">
              <span class="uma-name-text" title="${u.name}">${mainName}</span>
              ${renderMoodBadgeHTML(u.mood || 'Normal')}
            </div>
            <div class="uma-submeta-row">
              <span class="uma-style-pill" title="Chiến thuật chạy hiện tại (Chuột phải vào Uma để đổi)">
                Chạy: ${activeStyle} (${activeStyleRank})
              </span>
              <span class="uma-fail-pill" style="background:${failBg}; border:1px solid ${failBorder}66; color:${failColor};">
                Fail ${fRate}%
              </span>
            </div>
          </div>
        </div>

        <div class="uma-apt-strip">
          ${strongAptPills}
        </div>

        <div class="uma-slots-bar">
          <span class="uma-slots-label">THẺ HỖ TRỢ (${eqCards.length}/5)</span>
          <div class="uma-slots-grid" id="eq-strip-${containerId}-${idx}"></div>
        </div>

        <div class="uma-skills-box">
          <div class="uma-skill-row-item uq-row" title="${uqMeta.tooltip.replace(/"/g, '&quot;')}">
            <div class="clean-skill-left">
              <span class="sk-dot-uq">UQ</span>
              <span class="clean-skill-name">${uqMeta.name}${uqParen}</span>
            </div>
            <span class="gt-role-tag" style="border-color:${uqMeta.roleColor}66; color:${uqMeta.roleColor};">${uqMeta.roleShort}</span>
          </div>
          ${subSkillsRowsHTML}
        </div>
      </div>

      <div class="stat-grid-modern">
        <div class="stat-box-modern st-spd" title="Speed">${renderStatIconHTML('Speed', 16)}<strong>${u.baseStats.spd}</strong></div>
        <div class="stat-box-modern st-sta" title="Stamina">${renderStatIconHTML('Stamina', 16)}<strong>${u.baseStats.sta}</strong></div>
        <div class="stat-box-modern st-pow" title="Power">${renderStatIconHTML('Power', 16)}<strong>${u.baseStats.pow}</strong></div>
        <div class="stat-box-modern st-gut" title="Guts">${renderStatIconHTML('Guts', 16)}<strong>${u.baseStats.gut}</strong></div>
        <div class="stat-box-modern st-wit" title="Wit">${renderStatIconHTML('Wit', 16)}<strong>${u.baseStats.wit}</strong></div>
      </div>
    `;
    container.appendChild(div);

    const stripEl = document.getElementById(`eq-strip-${containerId}-${idx}`);
    for (let slotIdx = 0; slotIdx < 5; slotIdx++) {
      const eq = eqCards[slotIdx];
      if (eq) {
        const wrap = document.createElement('div');
        const canRecall = isMyBoard && !eq.isGoldAwakened;
        wrap.className = 'mini-eq-wrapper' + (canRecall ? ' recallable' : '');

        const tipText = canRecall
          ? `${eq.name}\n• Click trái (hoặc kéo về Tay): Thu hồi thẻ về lại trên tay\n• Chuột phải: Xem chi tiết thẻ`
          : `${eq.name} (Đã nâng cấp Kỹ năng Vàng — Chuột phải xem chi tiết thẻ)`;

        wrap.innerHTML = `
          <img class="mini-eq-icon ${eq.isGoldAwakened ? 'gold-awakened' : ''}" src="${eq.icon}" onerror="this.src='${fallbackAvatar(eq.type, '#475569')}'" title="${tipText}">
          ${renderStatIconHTML(eq.type, 12, 'mini-eq-type-badge')}
        `;

        if (canRecall) {
          wrap.onclick = (e) => {
            e.stopPropagation();
            socket.emit('unequip_card_from_uma', {
              roomCode: currentRoomCode,
              sessionToken,
              umaIndex: idx,
              cardUid: eq.uid
            });
          };
          wrap.draggable = true;
          wrap.ondragstart = (e) => {
            draggedPayload = { kind: 'recall_card', umaIndex: idx, cardUid: eq.uid };
            e.dataTransfer.setData('text/plain', eq.uid);
          };
        }

        wrap.oncontextmenu = (e) => {
          e.preventDefault();
          e.stopPropagation();
          openCardZoom(eq);
        };
        stripEl.appendChild(wrap);
      } else {
        const emptySlot = document.createElement('div');
        emptySlot.className = 'uma-empty-slot';
        emptySlot.title = 'Ô trang bị thẻ hỗ trợ còn trống';
        emptySlot.innerText = '+';
        stripEl.appendChild(emptySlot);
      }
    }
  });
}

// =========================================================================
// CẬP NHẬT TRẠNG THÁI BÀN ĐẤU MỖI LƯỢT
// =========================================================================
function updateGameState(data) {
  latestGameState = data;
  setLobbyDiscordVisible(false);
  normalizeStaticDomLabels();
  document.getElementById('lobby-screen').style.display = 'none';
  document.getElementById('pregame-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'grid';

  if (data.turnBanner) playTurnBannerAnimation(data.turnBanner.title, data.turnBanner.subtitle);
  if (data.actionToast) showToast(data.actionToast);

  const myScoreEl = document.getElementById('ui-my-score');
  const oppScoreEl = document.getElementById('ui-opp-score');
  if (myScoreEl) myScoreEl.innerText = data.myScore || 0;
  if (oppScoreEl && data.opponent) oppScoreEl.innerText = data.opponent.score || 0;

  if (typeof renderInventoryBag === 'function') {
    renderInventoryBag(data.myInventory, data.megaphoneBuff);
  }
  if (data.pendingGlobalEvent && typeof triggerGlobalEventModal === 'function') {
    triggerGlobalEventModal(data.pendingGlobalEvent);
  }

  const lvLabel = data.year === 1 ? 'Lv.1' : (data.year === 2 ? 'Lv.3' : 'Lv.5 MAX');
  let specialTag = ` • Training ${lvLabel}`;
  if ([3, 6, 9].includes(data.turn)) specialTag += ' • SỰ KIỆN TOÀN CỤC';
  if (data.year >= 2 && [7, 8].includes(data.turn)) specialTag += ' • TRẠI HÈ x1.5';

  document.getElementById('ui-stage-title').innerText =
    `Năm ${data.year} — Lượt ${data.turn}/10${specialTag}`;

  const orb = document.getElementById('ui-current-energy');
  if (data.energyUsed) {
    orb.innerHTML = `${renderStatIconHTML(data.currentEnergy, 22)} <span>Đã Dùng (${data.currentEnergy} ${lvLabel})</span>`;
    orb.classList.add('used');
  } else {
    orb.innerHTML = `${renderStatIconHTML(data.currentEnergy, 24)} <span>TRAIN ${data.currentEnergy.toUpperCase()} (${lvLabel})</span>`;
    orb.classList.remove('used');
  }

  const nextEl = document.getElementById('ui-next-energy');
  if (STAT_ICON_META[data.nextEnergy]) {
    nextEl.innerHTML = `${renderStatIconHTML(data.nextEnergy, 18)} <span>${data.nextEnergy}</span>`;
  } else {
    nextEl.innerText = data.nextEnergy;
  }

  document.getElementById('ui-deck-count').innerText = data.deckCount;

  renderMapList('ui-map-list', data.maps);
  renderUmasToContainer('ui-my-umas', data.myUmas, true);

  if (data.opponent) {
    document.getElementById('ui-opp-name').innerText = data.opponent.name;
    document.getElementById('ui-opp-hand-count').innerText = data.opponent.handCount;
    document.getElementById('ui-opp-deck-count').innerText = data.opponent.deckCount;
    renderUmasToContainer('ui-opp-umas', data.opponent.umas, false);

    const statusEl = document.getElementById('ui-opp-status');
    statusEl.innerText = data.opponent.connected ? '(Online)' : '(Disconnected)';
    statusEl.style.color = data.opponent.connected ? '#4ade80' : '#f87171';
  }

  const handEl = document.getElementById('ui-hand-list');
  handEl.ondragover = (e) => {
    if (draggedPayload && draggedPayload.kind === 'recall_card') e.preventDefault();
  };
  handEl.ondrop = (e) => {
    if (draggedPayload && draggedPayload.kind === 'recall_card') {
      e.preventDefault();
      socket.emit('unequip_card_from_uma', {
        roomCode: currentRoomCode,
        sessionToken,
        umaIndex: draggedPayload.umaIndex,
        cardUid: draggedPayload.cardUid
      });
      draggedPayload = null;
    }
  };

  handEl.innerHTML = '';
  data.myHand.forEach(card => {
    const cardDiv = document.createElement('div');
    const theme = TYPE_THEME_COLORS[card.type] || TYPE_THEME_COLORS.Speed;
    const { mainName, subTitle } = splitEntityNameAndTitle(card.name);

    cardDiv.className = `support-card-item type-${card.type}`;
    cardDiv.draggable = true;

    cardDiv.ondragstart = (e) => {
      cardDiv.classList.add('dragging-card');
      draggedPayload = { kind: 'card', cardUid: card.uid };
      e.dataTransfer.setData('text/plain', card.uid);
    };
    cardDiv.ondragend = () => cardDiv.classList.remove('dragging-card');
    cardDiv.oncontextmenu = (e) => {
      e.preventDefault();
      openCardZoom(card);
    };

    const wRow = formatCleanSkillRowHTML(
      `<span class="skill-tag-label tag-white" style="margin:0;">W</span>`,
      card.whiteSkill,
      card.whiteSkillData || card.whiteMechanics
    );
    const gRow = formatCleanSkillRowHTML(
      `<span class="skill-tag-label tag-gold" style="margin:0;">G</span>`,
      card.goldSkill,
      card.goldSkillData || card.goldMechanics
    );

    cardDiv.innerHTML = `
      <div class="card-thumb-wrap">
        <img class="support-card-icon" style="border:1.5px solid ${theme.main};" src="${card.icon}" onerror="this.src='${fallbackAvatar(card.type, '#475569')}'">
        ${renderStatIconHTML(card.type, 16, 'card-type-corner')}
      </div>
      <div style="flex:1; min-width:0;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:4px; margin-bottom:2px;">
          <div style="font-weight:800; font-size:11.5px; color:#ffffff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${subTitle}">${mainName}</div>
          <span style="font-size:8.5px; font-weight:800; color:${theme.main}; background:rgba(9,13,22,0.8); border:1px solid ${theme.border}; padding:0px 4px; border-radius:3px; flex-shrink:0;">${theme.short}</span>
        </div>
        <div style="color:#cbd5e1;">${wRow}</div>
        <div style="color:#facc15;">${gRow}</div>
      </div>
    `;
    handEl.appendChild(cardDiv);
  });
}

function sendEndTurnRequest() {
  const btn = document.getElementById('btn-request-turn');
  btn.innerText = 'Đang chờ đối thủ...';
  btn.style.background = '#64748b';
  btn.disabled = true;
  lastAnimatedUmaIndex = null;
  socket.emit('request_next_turn', { roomCode: currentRoomCode, sessionToken });
}

document.getElementById('btn-request-turn').onclick = () => {
  if (latestGameState && !latestGameState.energyUsed) {
    document.getElementById('skip-warning-modal').style.display = 'flex';
    return;
  }
  sendEndTurnRequest();
};

document.getElementById('btn-force-end-turn').onclick = () => {
  document.getElementById('skip-warning-modal').style.display = 'none';
  sendEndTurnRequest();
};

socket.on('turn_ready_update', ({ confirmedCount, total }) => {
  const btn = document.getElementById('btn-request-turn');
  btn.innerText = `Kết Thúc Lượt (${confirmedCount}/${total})`;
  if (confirmedCount === total) {
    setTimeout(() => {
      btn.innerText = `Kết Thúc Lượt (0/2)`;
      btn.style.background = '#f59e0b';
      btn.disabled = false;
    }, 200);
  }
});

socket.on('state_updated', (data) => updateGameState(data));

socket.on('race_started', (racePacket) => {
  if (typeof openRaceViewerModal === 'function') {
    openRaceViewerModal(racePacket);
  }
});

socket.on('race_confirm_update', ({ readyCount, total }) => {
  const btn = document.getElementById('btn-confirm-race-next');
  if (btn && !currentRacePacket?.matchWinner) {
    btn.innerText = `Xác Nhận & Tiếp Tục (${readyCount}/${total})`;
  }
});

socket.on('close_race_modal', () => {
  const modal = document.getElementById('race-viewer-modal');
  if (modal) modal.style.display = 'none';
  const btnTurn = document.getElementById('btn-request-turn');
  if (btnTurn) {
    btnTurn.innerText = 'Kết Thúc Lượt (0/2)';
    btnTurn.style.background = '#f59e0b';
    btnTurn.disabled = false;
  }
});

socket.on('opponent_disconnected', ({ name }) => {
  const modal = document.getElementById('disconnect-modal');
  document.getElementById('modal-title').innerText = 'ĐỐI THỦ MẤT KẾT NỐI';
  document.getElementById('modal-desc').innerText = `${name} đã ngắt kết nối. Đang chờ kết nối lại...`;
  document.getElementById('btn-modal-ok').style.display = 'none';
  const timerEl = document.getElementById('countdown-timer');
  modal.style.display = 'flex';

  let timeLeft = 30;
  timerEl.innerText = timeLeft + 's';
  timerEl.style.display = 'block';
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    timeLeft--;
    timerEl.innerText = timeLeft + 's';
    if (timeLeft <= 0) clearInterval(countdownInterval);
  }, 1000);
});

socket.on('opponent_reconnected', () => {
  if (countdownInterval) clearInterval(countdownInterval);
  document.getElementById('disconnect-modal').style.display = 'none';
  const statusEl = document.getElementById('ui-opp-status');
  if (statusEl) {
    statusEl.innerText = '(Online)';
    statusEl.style.color = '#4ade80';
  }
});

socket.on('match_aborted', (msg) => {
  if (countdownInterval) clearInterval(countdownInterval);
  const modal = document.getElementById('disconnect-modal');
  document.getElementById('modal-title').innerText = 'TRẬN ĐẤU ĐÃ BỊ HỦY';
  document.getElementById('modal-desc').innerText = msg;
  document.getElementById('countdown-timer').style.display = 'none';
  document.getElementById('btn-modal-ok').style.display = 'block';
  modal.style.display = 'flex';
  localStorage.removeItem('twinkle_current_room');
});