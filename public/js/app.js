// public/js/app.js - Điều khiển luồng trận đấu, Cẩm nang Hướng dẫn Toàn diện, Tag Kỹ năng GameTora & Liên hệ Discord

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

// BẢNG ĐỐI CHIẾU CẶP KỸ NĂNG VÀNG <-> TRẮNG ĐỂ ƯU TIÊN KỸ NĂNG VÀNG TRÊN GIAO DIỆN & ĐƯỜNG ĐUA
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
      tooltip: `${name}\n• Công dụng: Tăng Tốc độ mục tiêu (Target Velocity) tại Giữa chặng (Middle Leg).\n• Dùng chung cho mọi Chiến thuật & Cự ly`
    };
  }

  if (lower.includes('stamina siphon') || lower.includes('stamina eater') || lower.includes('siphon')) {
    return {
      name,
      parenText: '',
      roleShort: 'Heal•Debuff',
      roleColor: '#34d399',
      tooltip: `${name}\n• Công dụng: Hồi +3.5% Thể lực cho bản thân đồng thời rút -5.0% Thể lực của đối thủ tại Giữa chặng (Middle Leg).\n• Dùng chung cho mọi Chiến thuật & Cự ly`
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
      tooltip: `${name} (Late)\n• Công dụng: Tăng Tốc độ mục tiêu (Target Velocity) tại Giữa chặng (Middle Leg).\n• Yêu cầu: Late`
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
    fullDesc = 'Kỹ năng Xanh lá (Passive): Kích hoạt ngay lúc mở cổng (0.0s), cộng thẳng chỉ số cố định xuyên suốt trận đấu.';
  } else if (lower.includes('focus') || lower.includes('concentration') || lower.includes('gate')) {
    roleShort = 'Gate';
    roleColor = '#a855f7';
    fullDesc = 'Kỹ năng Xuất phát (Gate): Tối ưu phản xạ lúc mở cổng, tăng gia tốc đầu trận và miễn nhiễm Late Start.';
  } else if (lower.includes('nothing ventured') || lower.includes('daredevil') || lower.includes('carefree')) {
    roleShort = 'Gacha Velo';
    roleColor = '#f97316';
    fullDesc = 'Tăng mạnh Tốc độ mục tiêu (Velocity) ở Final Leg kèm Gacha Thể lực (60% tốn 0% HP | 30% -2% HP | 10% -4% HP).';
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
      fullDesc = 'Tiêu hao một phần nhỏ Thể lực bản thân để bứt tốc độ mục tiêu (Velocity) mạnh mẽ.';
    } else if (isTrueHeal) {
      roleShort = zoneShort ? `Heal•${zoneShort}` : 'Heal';
      roleColor = '#34d399';
      fullDesc = `Hồi phục Thể lực (Stamina Recovery) tại ${zoneFull}.`;
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
        ? 'Tăng mạnh Gia tốc (Acceleration) ngay chặng đầu (Opening Leg).'
        : (zoneShort
            ? `Tăng mạnh Gia tốc (Acceleration) ở Final Leg — Chỉ kích hoạt tại ${zoneFull}.`
            : 'Tăng mạnh Gia tốc (Acceleration) ngay đầu Final Leg (Accel Zone 2/3 quãng đường).');
    } else {
      const veloZone = zoneShort || ((fullCond.includes('phase>=2') || fullCond.includes('phase==2') || fullCond.includes('is_lastspurt')) ? 'Final' : 'Mid');
      roleShort = `Velo•${veloZone}`;
      roleColor = '#38bdf8';
      fullDesc = `Tăng Tốc độ mục tiêu (Target Velocity) tại ${zoneShort ? zoneFull : (veloZone === 'Final' ? 'Chặng cuối (Final Leg)' : 'Giữa chặng (Middle Leg)')}.`;
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
    ? ` <span style="color:#f472b6; font-weight:700; font-size:0.92em;">${meta.parenText}</span>`
    : '';
  const roleSpan = showRoleBadge
    ? ` <span style="display:inline-block; padding:0px 4px; border-radius:3px; background:rgba(15,23,42,0.75); border:1px solid ${meta.roleColor}; color:${meta.roleColor}; font-size:8.5px; font-weight:700; vertical-align:middle;">${meta.roleShort}</span>`
    : '';
  return `<span title="${meta.tooltip.replace(/"/g, '&quot;')}">${meta.name}${parenSpan}${roleSpan}</span>`;
}

// =========================================================================
// HỆ THỐNG CẨM NANG HƯỚNG DẪN TOÀN DIỆN (ĐÃ BỔ SUNG MOOD TUỘT SAU ĐUA & CÁC CƠ CHẾ ẨN)
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

      <h4>Cơ Chế Suy Giảm Tâm Trạng (Mood) Sau Mỗi Kỳ Đua</h4>
      <ul>
        <li>Các cấp độ Tâm trạng (Mood) theo thứ tự từ thấp đến cao gồm: <strong>Awful, Bad, Normal, Good, Great</strong>. Tâm trạng tác động trực tiếp đến hiệu suất thi đấu của toàn bộ chỉ số trên đường đua.</li>
        <li><strong>Tuột Mood khi chuyển năm:</strong> Sau khi hoàn thành 2 chặng đua cuối Năm 1 (bước sang Năm 2) và cuối Năm 2 (bước sang Năm 3), toàn bộ 3 Uma sẽ được đưa tỷ lệ chấn thương (Fail Rate) về 0%, nhưng <strong>Tâm trạng (Mood) của cả 3 Uma sẽ tự động bị giảm đi 1 bậc</strong> do tiêu hao sức lực sau giải đấu.</li>
        <li><strong>Tuột Mood trước trận Tie-break:</strong> Nếu trận đấu phải kéo dài sang Chặng 7 (Tie-break), cả 3 Uma của hai đội cũng sẽ <strong>bị giảm ngay 1 bậc Mood trước khi bước vào cổng xuất phát Tie-break</strong>. Người chơi cần lưu ý duy trì Mood cao hoặc giữ lại vật phẩm hồi Mood cho giai đoạn cuối trận.</li>
      </ul>

      <div class="guide-diff-box">
        <div class="guide-diff-title">Điểm Tinh Chỉnh So Với Bản Gốc</div>
        <p>Trong phiên bản gốc, người chơi huấn luyện từng nhân vật riêng lẻ qua một kịch bản dài trước khi đem đi thi đấu. Trong <em>Twinkle Tactics</em>, quá trình huấn luyện và thi đấu diễn ra song song trong cùng một trận đấu đối kháng. Bạn phải vừa phát triển chỉ số cho cả 3 nhân vật cùng lúc, vừa quan sát đội hình đối phương để điều chỉnh chiến thuật theo từng chặng đua.</p>
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
        <li><strong>Chỉ số Thưởng Địa hình (Stat Bonus / Threshold):</strong> Trong bảng Map Helper của mỗi sân có ghi chú mục <em>STAT BONUS</em> (ví dụ: Speed, Stamina hoặc Power). Nếu nhân vật của bạn có chỉ số tương ứng đạt mốc khá (từ 350 trở lên) hoặc mốc cao (từ 600 trở lên), nhân vật đó sẽ được nhận thêm phần trăm tốc độ cộng thưởng trên sân đua đó.</li>
      </ul>

      <h4>Quy Trình 3 Bước Chuẩn Bị</h4>
      <ul>
        <li><strong>Bước 1 — Chọn 3 Uma Chủ Lực:</strong> Lựa chọn 3 nhân vật phù hợp với các cự ly xuất hiện trong danh sách 7 sân đua. Nhấp chuột phải vào từng nhân vật để xem chi tiết chỉ số cơ bản, kỹ năng độc quyền (Unique Skill) và các kỹ năng tiềm năng có sẵn (Pot Skills).</li>
        <li><strong>Bước 2 — Phân Bổ 18 Spark Hồng:</strong> Mỗi nhân vật được cấp 18 điểm Spark Hồng để nâng cấp bậc thích nghi Mặt sân, Cự ly hoặc Chiến thuật chạy. Trước khi trận đấu bắt đầu, Spark Hồng có thể nâng bậc thích nghi tối đa lên mức <strong>A</strong> (1 Spark tăng 1 bậc, 4 Spark tăng 2 bậc, 7 Spark tăng 3 bậc, 10 Spark tăng 4 bậc).</li>
        <li><strong>Bước 3 — Xây Dựng Bộ Bài 40 Thẻ SSR:</strong> Chọn đủ 40 thẻ Hỗ trợ (Support Cards) từ kho thẻ. Mỗi hệ chỉ số (Speed, Stamina, Power, Guts, Wit) được phép lấy tối đa 12 thẻ.</li>
      </ul>

      <div class="guide-diff-box">
        <div class="guide-diff-title">Điểm Tinh Chỉnh So Với Bản Gốc</div>
        <ul>
          <li><strong>Đột phá Bậc S nhờ Spark Hồng:</strong> Thay vì chọn ngựa bố mẹ có sẵn, bạn trực tiếp phân bổ 18 điểm Spark Hồng cho từng nhân vật. Mỗi điểm Spark được gán vào một hạng mục sẽ mang lại 8% xác suất đột phá hạng mục đó lên <strong>Bậc S</strong> trong sự kiện Kế thừa vào đầu Năm 2 và Năm 3.</li>
          <li><strong>Bộ bài Hỗ trợ 40 lá:</strong> Thay vì chỉ mang 6 thẻ hỗ trợ cố định như bản gốc, bạn xây dựng một bộ bài 40 lá để rút dần qua từng lượt (khởi đầu Năm 1 với 5 lá bài trên tay), tạo chiều sâu chiến thuật tương tự các trò chơi thẻ bài đối kháng.</li>
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
        <li>Năng lượng huấn luyện mỗi lượt không xuất hiện ngẫu nhiên vô hạn mà được rút ra từ một <strong>Túi 10 viên cân bằng cho mỗi năm</strong>, bao gồm đúng: <strong>2 Speed, 2 Stamina, 2 Power, 2 Guts và 2 Wit</strong> được xáo trộn thứ tự.</li>
        <li>Nhờ thông báo <em>Tiếp theo</em> ở góc phải màn hình và quy luật túi 10 viên này, bạn hoàn toàn có thể dự đoán trước các hệ năng lượng còn lại sẽ xuất hiện trong những lượt cuối năm.</li>
        <li><strong>Bỏ bài đổi hệ Năng lượng (Discard for Energy):</strong> Nếu viên năng lượng hiện tại không đúng hệ bạn cần, hãy kéo 1 thẻ bài từ trên tay thả vào ô chuyển đổi ở góc dưới bên trái để đổi viên năng lượng của lượt đó sang đúng hệ của thẻ bài vừa bỏ.</li>
      </ul>

      <h4>Cơ Chế Luân Phiên Thể Lực & Đặc Quyền Của Hệ Wit</h4>
      <ul>
        <li><strong>Tăng chỉ số chính và phụ:</strong> Tập Speed tăng thêm Power; tập Stamina tăng thêm Guts; tập Power tăng thêm Stamina; tập Guts tăng thêm cả Speed và Power; tập Wit tăng thêm Speed.</li>
        <li><strong>Hồi phục thụ động cho 2 Uma dự bị:</strong> Mỗi khi bạn kéo năng lượng huấn luyện cho 1 Uma, <strong>2 Uma còn lại không tập luyện trong lượt đó sẽ tự động được giảm tỷ lệ thất bại (Fail Rate)</strong> (giảm 10% nếu Fail Rate đang từ 20% trở lên, hoặc giảm 5% nếu dưới 20%). Luân phiên tập luyện giữa 3 nhân vật sẽ giúp bạn hạn chế phải dùng lệnh Nghỉ ngơi.</li>
        <li><strong>Đặc quyền khi tập luyện hệ Wit (Trí tuệ):</strong>
          <ul>
            <li>Huấn luyện hệ Wit <strong>an toàn tuyệt đối (không bao giờ thất bại)</strong> ngay cả khi nhân vật đang có tỷ lệ Fail Rate cao.</li>
            <li>Giúp nhân vật được tập <strong>giảm ngay 5% Fail Rate</strong> thay vì bị tăng thêm mệt mỏi.</li>
            <li>Đặc biệt, nếu nhân vật được tập Wit đang trang bị ít nhất 1 thẻ Hỗ trợ hệ Wit trên người, bạn sẽ được <strong>rút thêm 1 thẻ bài từ bộ bài</strong>.</li>
          </ul>
        </li>
      </ul>

      <h4>Nghỉ Ngơi Chủ Động (Active Rest) & Trại Hè (Summer Camp)</h4>
      <ul>
        <li><strong>Nghỉ ngơi chủ động (Active Rest):</strong> Kéo thanh Nghỉ ngơi ở góc dưới bên phải thả vào 1 Uma (tiêu tốn viên năng lượng của lượt đó) để đưa Fail Rate của nhân vật về 0%, tăng 1 bậc Mood và rút thêm 1 thẻ bài từ bộ bài.</li>
        <li><strong>Trại hè (Summer Camp):</strong> Diễn ra cố định vào <strong>Lượt 7 và Lượt 8 của Năm 2 và Năm 3</strong>. Trong 2 lượt Trại hè, hiệu quả tăng chỉ số khi huấn luyện được nhân 1.5 lần, và nếu dùng lệnh Nghỉ ngơi sẽ tăng liền 2 bậc Mood.</li>
      </ul>
    `
  },
  {
    id: 'cards_skills',
    menuTitle: '4. Thẻ Hỗ Trợ & Kỹ Năng',
    heading: 'Cơ Chế Thẻ Hỗ Trợ, Thức Tỉnh Kỹ Năng & Thu Hồi Thẻ',
    content: `
      <p>Thẻ Hỗ trợ (Support Cards) đóng vai trò kép: vừa nhân mạnh lượng chỉ số nhận được khi huấn luyện cùng hệ, vừa truyền dạy trực tiếp kỹ năng cho Uma. Giới hạn bài cầm trên tay là <strong>9 lá</strong> khi rút tự nhiên (và tối đa <strong>10 lá</strong> khi thu hồi thẻ từ nhân vật về tay).</p>

      <h4>Trang Bị Thẻ, Cộng Hưởng (Rainbow) & Ưu Tiên Kỹ Năng Vàng</h4>
      <ul>
        <li>Mỗi Uma có tối đa <strong>5 ô trang bị thẻ hỗ trợ</strong> (không được trang bị 2 thẻ trùng tên trên cùng một nhân vật).</li>
        <li>Khi kéo một thẻ từ tay thả vào Uma ở chế độ <strong>Trang bị (Equip)</strong>, nhân vật đó lập tức nhận được <strong>Kỹ năng Trắng (White Skill)</strong> của thẻ.</li>
        <li>Khi huấn luyện một chỉ số trùng với hệ của các thẻ đang gắn trên nhân vật, hiệu ứng <strong>Cộng hưởng (Rainbow)</strong> sẽ kích hoạt, cộng thêm lượng lớn chỉ số tương ứng với số thẻ cùng hệ đang trang bị.</li>
        <li><strong>Tự động ưu tiên Kỹ năng Vàng:</strong> Nếu nhân vật đang sở hữu phiên bản <strong>Kỹ năng Vàng (Gold Skill)</strong> (có sẵn từ Pot hoặc từ thẻ khác), hệ thống sẽ tự động ẩn và bỏ qua phiên bản Kỹ năng Trắng cấp thấp tương ứng (ví dụ: đã có <em>Professor of Curvature</em> thì sẽ chỉ kích hoạt kỹ năng vàng này và không kích hoạt <em>Corner Adept</em>).</li>
      </ul>

      <h4>Thức Tỉnh Kỹ Năng Vàng (Gold Awakening) & Thẻ Guts Đa Năng</h4>
      <ul>
        <li>Khi một Uma đã có thẻ hỗ trợ đang gắn trên người, bạn có thể kéo một thẻ khác từ trên tay có <strong>cùng hệ chỉ số</strong> thả đè lên nhân vật đó để thực hiện <strong>Gold Awakening</strong>.</li>
        <li>Thẻ dùng làm nguyên liệu sẽ tiêu hao, và thẻ đang trang bị sẽ được nâng cấp vĩnh viễn từ Kỹ năng Trắng lên <strong>Kỹ năng Vàng (Gold Skill)</strong> tương ứng.</li>
        <li><strong>Vai trò đặc biệt của thẻ hệ Guts (Wildcard):</strong> Thẻ hỗ trợ hệ Guts có thể dùng làm nguyên liệu thức tỉnh Kỹ năng Vàng cho <strong>mọi hệ thẻ khác</strong> (Speed, Stamina, Power, Wit).</li>
      </ul>

      <h4>Thu Hồi Thẻ (Recall Card)</h4>
      <ul>
        <li>Đối với các thẻ đang trang bị nhưng <strong>chưa thức tỉnh Kỹ năng Vàng</strong>, bạn có thể nhấp chuột trái vào biểu tượng thẻ nhỏ trên nhân vật (hoặc kéo ngược về tay) để tháo thẻ ra.</li>
        <li>Khi thu hồi thẻ, Kỹ năng Trắng đi kèm thẻ đó cũng sẽ được gỡ bỏ, cho phép bạn chuyển thẻ sang nhân vật khác để gom Rainbow hoặc dùng thẻ đó làm nguyên liệu nâng cấp. Các thẻ đã thức tỉnh Kỹ năng Vàng sẽ khóa cố định vào nhân vật.</li>
      </ul>

      <div class="guide-diff-box">
        <div class="guide-diff-title">Điểm Tinh Chỉnh So Với Bản Gốc</div>
        <p>Trò chơi lược bỏ hoàn toàn hệ thống Điểm kỹ năng (Skill Points) và chờ dấu chấm than ngẫu nhiên (Skill Hints). Việc sở hữu Kỹ năng Trắng hay nâng cấp lên Kỹ năng Vàng hoàn toàn nằm trong quyền kiểm soát chiến thuật quản lý bài trên tay của người chơi.</p>
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
        <li><strong>Thích nghi Cự ly (Sprint / Mile / Medium / Long):</strong> Tác động trực tiếp lên tốc độ di chuyển và tốc độ nước rút. Đưa nhân vật có bậc thích nghi thấp (từ D đến G) vào cự ly không phù hợp sẽ làm suy giảm nghiêm trọng tốc độ nền.</li>
        <li><strong>Thích nghi Mặt sân (Turf / Dirt):</strong> Tác động trực tiếp lên khả năng tăng tốc (Power) và mức tiêu hao thể lực. Chạy trên mặt sân không phù hợp khiến nhân vật tăng tốc chậm và đốt thể lực nhanh hơn bình thường.</li>
        <li><strong>Thích nghi Chiến thuật (Front / Pace / Late / End):</strong> Tác động trực tiếp lên chỉ số Wit thực chiến, <strong>tỷ lệ kích hoạt kỹ năng</strong> và nguy cơ bị mất bình tĩnh trên đường đua.</li>
      </ul>

      <h4>Phân Loại Kỹ Năng & Điều Kiện Kích Hoạt</h4>
      <ul>
        <li><strong>Ràng buộc Chiến thuật, Cự ly và Mặt sân:</strong> Các kỹ năng có ký hiệu <strong>(Front / Pace / Late / End)</strong>, <strong>(Sprint / Mile / Medium / Long)</strong> hoặc <strong>(Dirt)</strong> chỉ kích hoạt khi nhân vật đang thi đấu đúng chiến thuật, cự ly và mặt sân đó.</li>
        <li><strong>Kỹ năng Xanh lá (Passive) & Xuất phát (Gate):</strong> Kiểm tra điều kiện (mùa giải, hướng rẽ, cự ly chuẩn/phi chuẩn, mặt sân) ngay lúc mở cổng (0.0s). Nếu thành công sẽ cộng thẳng chỉ số cố định suốt cả trận hoặc miễn nhiễm xuất phát chậm (Late Start).</li>
        <li><strong>Kỹ năng Khúc cua (Corner) & Đoạn thẳng (Straight):</strong> Chỉ kích hoạt khi nhân vật đang thực sự chạy trong phạm vi khúc cua hoặc đoạn thẳng của sân đua (bao gồm cả các kỹ năng gia tốc đặc trưng như <em>Let's Pump Some Iron!</em> chỉ bật ở khúc cua hay <em>Straightaway Spurt</em> chỉ bật ở đoạn thẳng cuối).</li>
        <li><strong>Kỹ năng Tăng tốc (Velo•Mid) & Hồi thể lực (Heal / Heal•Debuff):</strong> Kích hoạt ở giai đoạn Giữa chặng (Middle Leg) để cải thiện vị trí và duy trì cây thể lực.</li>
        <li><strong>Kỹ năng Gia tốc không ràng buộc địa hình (Accel•Final Leg):</strong> Kích hoạt ngay khi bước vào mốc 2/3 quãng đường (Final Leg), giúp nhân vật đạt vận tốc nước rút tối đa nhanh nhất có thể.</li>
      </ul>

      <h4>Các Trạng Thái Đặc Biệt Trong Lúc Đua</h4>
      <ul>
        <li><strong>LATE START (Xuất phát chậm):</strong> Nhân vật bị khựng lại một nhịp ngay khi mở cổng, làm mất lợi thế chọn vị trí đầu chặng (chỉ số Wit cao hoặc có kỹ năng <em>Focus / Concentration</em> sẽ khắc phục tình trạng này).</li>
        <li><strong>RUSHED (Hăng máu / Kakari):</strong> Nhân vật mất bình tĩnh ở giữa chặng, tự ý đôn tốc độ lên sớm nhưng tiêu hao thể lực gấp rưỡi bình thường (dễ xảy ra nếu chỉ số Wit thấp hoặc chạy chiến thuật có bậc thích nghi từ D đến G).</li>
        <li><strong>SPOT STRUGGLE & DUEL! (Đọ sức):</strong> Khi các Front Runner bám sát nhau ở đầu trận (Spot Struggle) hoặc khi các nhân vật kè vai nhau trên đường thẳng cuối (Duel / Oikurabe), các nhân vật sẽ bứt tốc mạnh mẽ dựa trên chỉ số Guts.</li>
        <li><strong>BLOCKED (Bị chắn đường):</strong> Bị các nhân vật phía trước vây kín ở giai đoạn cuối khiến không thể tăng tốc tối đa (chỉ số Power cao hoặc kích hoạt kỹ năng tăng gia tốc giúp dễ dàng thoát khỏi thế bị chặn).</li>
        <li><strong>NO STA (Cạn kiệt thể lực):</strong> Khi thanh thể lực (HP) giảm về 0 trước vạch đích, nhân vật sẽ bị tụt giảm tốc độ nghiêm trọng.</li>
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

function initLobbyGuideSystem() {
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

socket.on('action_error', (msg) => showToast('[ERROR] ' + msg, true));

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
// HIỆU ỨNG LẬT MỞ TỪNG MAP KỊCH TÍNH (1 -> 7) KÈM MÙA GIẢI (SEASON)
// =========================================================================
function startDramaticMapReveal(maps) {
  revealTimers.forEach(t => clearTimeout(t));
  revealTimers = [];

  const overlay = document.getElementById('map-reveal-overlay');
  const container = document.getElementById('reveal-cards-container');
  const leftPreGameList = document.getElementById('pregame-map-list');

  container.innerHTML = '';
  leftPreGameList.innerHTML = '<div style="font-size:10.5px; color:#38bdf8; text-align:center;">Click / Chuột phải vào Map để mở Map Helper</div>';
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
      appendSingleMapToPanel('pregame-map-list', m);
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

function appendSingleMapToPanel(containerId, m) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const div = document.createElement('div');
  div.className = 'map-item slam-anim' + (m.slot === 'Tie break' ? ' tiebreak' : '');
  div.title = 'Click hoặc Chuột phải để mở Map Helper';
  div.onclick = () => openMapBlueprintModal(m);
  div.oncontextmenu = (e) => {
    e.preventDefault();
    openMapBlueprintModal(m);
  };

  const seasonLabel = m.season || 'Spring';
  const resultHtml = m.raceResult
    ? `<div style="font-size:10px; color:#4ade80; margin-top:3px; font-weight:bold; border-top:1px solid #1e293b; padding-top:2px;">
         #1: ${m.raceResult.winnerName} (${m.raceResult.ownerName})
       </div>`
    : '';

  div.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <strong>${m.slot}: ${m.name}</strong>
      <span style="font-size:9.5px; background:#1e293b; color:#38bdf8; padding:1px 5px; border-radius:4px;">${seasonLabel}</span>
    </div>
    <div style="font-size:10px; color:#cbd5e1; margin:1px 0;">${m.famousRace || ''}</div>
    <span style="color:#94a3b8;">${m.surface} | ${m.distanceType} (${m.length}m)</span> | 
    <span style="color:#facc15;">Sân: ${m.condition}</span>
    ${resultHtml}
  `;
  el.appendChild(div);
}

function renderMapList(containerId, maps) {
  currentMapsList = maps || [];
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<div style="font-size:10.5px; color:#38bdf8; text-align:center; margin-bottom:2px;">Chuột phải / Click vào Map để mở Map Helper</div>';
  maps.forEach(m => appendSingleMapToPanel(containerId, m));
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
    showToast('Đã chọn nhanh 40 thẻ SSR cân bằng (8 lá mỗi hệ)!');
  } else if (presetType === 'clear') {
    selectedDeckUids = [];
  }
  renderDeckBuilderUI();
}

function renderDeckBuilderUI() {
  document.getElementById('deck-selected-count').innerText = selectedDeckUids.length;
  const counts = { Speed: 0, Stamina: 0, Power: 0, Guts: 0, Wit: 0 };
  selectedDeckUids.forEach(uid => {
    const c = supportPool.find(x => x.uid === uid);
    if (c && counts[c.type] !== undefined) counts[c.type]++;
  });

  document.getElementById('deck-type-breakdown').innerHTML = `
    Kho thẻ: <b>${supportPool.length} SSR</b> | Đã chọn: 
    Speed: <b>${counts.Speed}/12</b> | Stamina: <b>${counts.Stamina}/12</b> | 
    Power: <b>${counts.Power}/12</b> | Guts: <b>${counts.Guts}/12</b> | Wit: <b>${counts.Wit}/12</b>
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
      ${renderStatIconHTML(t, 16)} <span>${t} (${counts[t]}/12 — ${totalOfType} SSR)</span>
    </button>`;
  }).join('');

  const container = document.getElementById('deck-pool-container');
  container.innerHTML = '';
  supportPool
    .filter(c => currentCardTypeFilter === 'ALL' || c.type === currentCardTypeFilter)
    .forEach(card => {
      const isSelected = selectedDeckUids.includes(card.uid);
      const div = document.createElement('div');
      div.className = 'deck-pool-card' + (isSelected ? ' in-deck' : '');
      div.onclick = () => {
        if (isSelected) {
          selectedDeckUids = selectedDeckUids.filter(id => id !== card.uid);
        } else {
          if (selectedDeckUids.length >= 40) return showToast('Deck đã đủ 40 lá!', true);
          if (counts[card.type] >= 12) return showToast(`Hệ ${card.type} chỉ được tối đa 12 lá!`, true);
          selectedDeckUids.push(card.uid);
        }
        renderDeckBuilderUI();
      };
      div.oncontextmenu = (e) => {
        e.preventDefault();
        openCardZoom(card);
      };

      const wHtml = formatSkillInlineHTML(card.whiteSkill, card.whiteSkillData || card.whiteMechanics, true);
      const gHtml = formatSkillInlineHTML(card.goldSkill, card.goldSkillData || card.goldMechanics, true);

      div.innerHTML = `
        <div class="card-thumb-wrap">
          <img class="support-card-icon" src="${card.icon}" onerror="this.src='${fallbackAvatar(card.type, '#475569')}'">
          ${renderStatIconHTML(card.type, 15, 'card-type-corner')}
        </div>
        <div style="min-width:0;">
          <div style="font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${card.name}</div>
          <div style="color:#cbd5e1; font-size:9.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">[W] ${wHtml}</div>
          <div style="color:#facc15; font-size:9.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">[G] ${gHtml}</div>
          <div style="color:${isSelected ? '#4ade80' : '#94a3b8'}; font-size:9.5px;">${isSelected ? 'Đã chọn trong Deck' : 'Click để thêm'}</div>
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

function renderPreGameUI() {
  document.getElementById('selected-count').innerText = selectedUmaIds.length;
  const searchVal = (document.getElementById('uma-search-input')?.value || '').trim().toLowerCase();
  const poolEl = document.getElementById('uma-pool-container');
  poolEl.innerHTML = '';

  const filteredUmas = umaPool.filter(u => {
    if (searchVal && !u.name.toLowerCase().includes(searchVal)) return false;
    if (currentUmaFilter === 'ALL') return true;
    const rank = u.aptitudes[currentUmaFilter];
    return rank === 'A' || rank === 'B';
  });

  if (filteredUmas.length === 0) {
    poolEl.innerHTML = `<div style="grid-column: 1 / 5; padding: 20px; text-align: center; color: #94a3b8;">
      Không tìm thấy Uma nào khớp với "${searchVal}".
    </div>`;
  } else {
    filteredUmas.forEach(u => {
      const isSel = selectedUmaIds.includes(u.id);
      const item = document.createElement('div');
      item.className = 'roster-item' + (isSel ? ' selected' : '');
      item.title = 'Click trái để Chọn | Chuột phải để xem Full Thông tin & Pot Skills';

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

      const goldPots = (u.potSkills || [])
        .filter(p => p.isGold)
        .map(p => formatSkillInlineHTML(p.name, p.mechanics, true))
        .join(' • ');

      const aptBar = typeof renderCompactAptitudesBar === 'function'
        ? renderCompactAptitudesBar(u.aptitudes)
        : `Turf ${u.aptitudes.Turf} | Dirt ${u.aptitudes.Dirt}`;

      item.innerHTML = `
        <img class="uma-avatar" src="${u.icon}" onerror="if(this.src!=='${u.fallbackIcon||''}' && '${u.fallbackIcon||''}'){this.src='${u.fallbackIcon}';}else{this.src='${fallbackAvatar(u.name, u.color)}';}">
        <div style="min-width:0;">
          <div style="font-weight:bold; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${u.name}</div>
          <div style="font-size:9.5px; color:#facc15; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="Kỹ năng Vàng có sẵn trong Pot">[POT★] ${goldPots || 'Standard Pot'}</div>
          <div style="font-size:9px; color:#cbd5e1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${aptBar}</div>
        </div>
      `;
      poolEl.appendChild(item);
    });
  }

  const sparkEl = document.getElementById('spark-editor-container');
  sparkEl.innerHTML = '';
  selectedUmaIds.forEach((id, idx) => {
    const u = umaPool.find(x => x.id === id);
    if (!u) return;
    const used = getUsedSparks(u.id);
    const card = document.createElement('div');
    card.className = 'spark-card';
    let aptRowsHTML = '';

    Object.entries(u.aptitudes).forEach(([aptKey, baseRank]) => {
      const sparks = (allocatedSparks[u.id] && allocatedSparks[u.id][aptKey]) || 0;
      const finalRank = computeRankFromSparks(baseRank, sparks);
      const inheritChance = sparks * 8;

      aptRowsHTML += `
        <div class="apt-row">
          <span><b>${aptKey}</b> <span style="color:#94a3b8; font-size:10px;">(Gốc ${baseRank})</span></span>
          <div style="display:flex; align-items:center; gap:4px;">
            <span style="font-size:10px; color:#f472b6;">${sparks} Spark (${inheritChance}% nổ)</span>
            <span class="rank-badge rank-${finalRank}">${finalRank}</span>
            <button class="apt-btn" onclick="adjustSparkCount('${u.id}','${aptKey}',-1)">-</button>
            <button class="apt-btn" onclick="adjustSparkCount('${u.id}','${aptKey}',1)">+</button>
          </div>
        </div>
      `;
    });

    card.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; cursor:context-menu;" title="Chuột phải để xem chi tiết Uma" oncontextmenu="event.preventDefault(); if(typeof openUmaDetailModal==='function'){ const uObj = umaPool.find(x=>x.id==='${u.id}'); openUmaDetailModal(uObj, null, false); setTimeout(()=>enhanceUmaDetailModalSkills(uObj), 25); }">
        <img class="uma-avatar" style="width:40px; height:40px;" src="${u.icon}" onerror="if(this.src!=='${u.fallbackIcon||''}' && '${u.fallbackIcon||''}'){this.src='${u.fallbackIcon}';}else{this.src='${fallbackAvatar(u.name, u.color)}';}">
        <div>
          <strong>Uma ${idx + 1}: ${u.name}</strong><br>
          <span style="font-size:11px; color:#f472b6;">Spark Hồng còn lại: <strong>${18 - used}/18</strong></span>
        </div>
      </div>
      ${aptRowsHTML}
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
// KÉO THẢ NĂNG LƯỢNG, ACTIVE REST & Ô BỎ BÀI ĐỔI NĂNG LƯỢNG
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
restTokenEl.ondragstart = (e) => {
  if (energyOrbEl.classList.contains('used')) {
    showToast('[ERROR] Bạn đã dùng Năng lượng lượt này rồi.', true);
    e.preventDefault();
    return;
  }
  draggedPayload = { kind: 'rest' };
  e.dataTransfer.setData('text/plain', 'rest');
};

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
// RENDER BÀN ĐẤU CHÍNH (3 UMA CỦA MÌNH & 3 UMA ĐỐI THỦ)
// =========================================================================
socket.on('match_start', (data) => {
  finishMapReveal(data.maps || []);
  setLobbyDiscordVisible(false);
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
    div.className = 'uma-card-mini' + (isMyBoard && lastAnimatedUmaIndex === idx ? ' slam-anim' : '');
    div.title = 'Chuột phải vào Uma để xem Full Thông tin, Pot Skills & Đổi Style chạy';

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

    const failColor = u.failRate >= 25 ? '#f43f5e' : u.failRate > 0 ? '#facc15' : '#4ade80';
    const eqCards = u.equippedCards || [];
    const skills = u.skills || [];
    const aptBar = typeof renderCompactAptitudesBar === 'function'
      ? renderCompactAptitudesBar(u.aptitudes)
      : `Sân: <b>${u.aptitudes.Turf}/${u.aptitudes.Dirt}</b>`;

    const uqHtml = formatSkillInlineHTML(u.uniqueSkill, u.uniqueSkillData, true);

    div.innerHTML = `
      <div>
        <div class="uma-board-top">
          <img class="uma-board-avatar" src="${u.icon}" onerror="if(this.src!=='${u.fallbackIcon||''}' && '${u.fallbackIcon||''}'){this.src='${u.fallbackIcon}';}else{this.src='${fallbackAvatar(u.name, u.color)}';}">
          <div style="flex:1; min-width:0;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:4px;">
              <strong style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${u.name}</strong>
              ${renderMoodBadgeHTML(u.mood || 'Normal')}
            </div>
            <div class="unique-skill-badge" title="Unique Skill">[UNIQUE] ${uqHtml}</div>
            <div style="font-size:9.5px; color:#cbd5e1; margin-top:2px; display:flex; justify-content:space-between; align-items:center;">
              <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${aptBar}</span>
              <span style="color:${failColor}; font-weight:bold; flex-shrink:0; margin-left:4px;">Fail: ${u.failRate || 0}%</span>
            </div>
          </div>
        </div>

        <div class="equipped-strip" id="eq-strip-${containerId}-${idx}">
          <span style="font-size:9.5px; color:#64748b;">Support (${eqCards.length}/5):</span>
        </div>

        <div class="skills-list-mini">
          ${(() => {
            const ownedGoldSet = new Set();
            skills.forEach(s => {
              if (s && s.name && (s.isGold || String(s.name).includes('◎'))) {
                ownedGoldSet.add(normalizeSkillBaseNameUI(s.name));
              }
            });

            const learnedCardSkills = skills.filter(s => !s.fromPot && (s.isGold || !isWhiteSupersededByOwnedGoldUI(s.name, ownedGoldSet)));
            const goldPotSkills = skills.filter(s => s.fromPot && s.isGold);
            const displaySkills = [...learnedCardSkills, ...goldPotSkills];

            if (displaySkills.length === 0) {
              return '<span style="font-size:9.5px; color:#64748b;">Chưa có kỹ năng phụ</span>';
            }

            return displaySkills.map(s => {
              const skMeta = getSkillGameToraMeta(s.name, s.mechanics);
              const skFormatted = formatSkillInlineHTML(s.name, s.mechanics, true);
              if (!s.fromPot) {
                return `<span class="skill-pill ${s.isGold ? 'gold' : ''}" title="${skMeta.tooltip.replace(/"/g, '&quot;')}" style="${!s.isGold ? 'border-color:#38bdf8; color:#bae6fd; background:#0c4a6e;' : ''}">
                  ${s.isGold ? '[GOLD★] ' : '[CARD] '}${skFormatted}
                </span>`;
              }
              return `<span class="skill-pill gold" title="${skMeta.tooltip.replace(/"/g, '&quot;')}" style="opacity:0.92;">[POT★] ${skFormatted}</span>`;
            }).join('');
          })()}
        </div>
      </div>

      <div class="stat-grid-mini">
        <div class="stat-cell" title="Speed">${renderStatIconHTML('Speed', 19)}<strong>${u.baseStats.spd}</strong></div>
        <div class="stat-cell" title="Stamina">${renderStatIconHTML('Stamina', 19)}<strong>${u.baseStats.sta}</strong></div>
        <div class="stat-cell" title="Power">${renderStatIconHTML('Power', 19)}<strong>${u.baseStats.pow}</strong></div>
        <div class="stat-cell" title="Guts">${renderStatIconHTML('Guts', 19)}<strong>${u.baseStats.gut}</strong></div>
        <div class="stat-cell" title="Wit">${renderStatIconHTML('Wit', 19)}<strong>${u.baseStats.wit}</strong></div>
      </div>
    `;
    container.appendChild(div);

    const stripEl = document.getElementById(`eq-strip-${containerId}-${idx}`);
    eqCards.forEach(eq => {
      const wrap = document.createElement('div');
      const canRecall = isMyBoard && !eq.isGoldAwakened;
      wrap.className = 'mini-eq-wrapper' + (canRecall ? ' recallable' : '');

      const tipText = canRecall
        ? `${eq.name}\n• Click trái (hoặc kéo về Tay): Thu hồi thẻ về lại trên tay\n• Chuột phải: Xem Full Art`
        : `${eq.name} (Đã khóa Gold Skill — Chuột phải xem Full Art)`;

      wrap.innerHTML = `
        <img class="mini-eq-icon ${eq.isGoldAwakened ? 'gold-awakened' : ''}" src="${eq.icon}" onerror="this.src='${fallbackAvatar(eq.type, '#475569')}'" title="${tipText}">
        ${renderStatIconHTML(eq.type, 13, 'mini-eq-type-badge')}
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
    });
  });
}

// =========================================================================
// CẬP NHẬT TRẠNG THÁI BÀN ĐẤU MỖI LƯỢT
// =========================================================================
function updateGameState(data) {
  latestGameState = data;
  setLobbyDiscordVisible(false);
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
  let specialTag = ` | [Training ${lvLabel}]`;
  if ([3, 6, 9].includes(data.turn)) specialTag += ' | [GLOBAL EVENT]';
  if (data.year >= 2 && [7, 8].includes(data.turn)) specialTag += ' | [SUMMER CAMP x1.5]';

  document.getElementById('ui-stage-title').innerText =
    `Giai đoạn: Năm ${data.year} - Lượt ${data.turn}/10${specialTag}`;

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

    const wHtml = formatSkillInlineHTML(card.whiteSkill, card.whiteSkillData || card.whiteMechanics, true);
    const gHtml = formatSkillInlineHTML(card.goldSkill, card.goldSkillData || card.goldMechanics, true);

    cardDiv.innerHTML = `
      <div class="card-thumb-wrap">
        <img class="support-card-icon" src="${card.icon}" onerror="this.src='${fallbackAvatar(card.type, '#475569')}'">
        ${renderStatIconHTML(card.type, 17, 'card-type-corner')}
      </div>
      <div style="flex:1; min-width:0;">
        <div style="font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${card.name}</div>
        <div style="color:#cbd5e1; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><span class="skill-tag-label tag-white">W</span>${wHtml}</div>
        <div style="color:#facc15; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><span class="skill-tag-label tag-gold">G</span>${gHtml}</div>
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