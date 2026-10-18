// sync-glb-data.js - Đồng bộ chuẩn Pot Skills (Lv1-Lv5), Unique Skill & Bản đồ Sân đua
const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const SKILL_DATA_URL = 'https://raw.githubusercontent.com/alpha123/uma-skill-tools/master/data/skill_data.json';
const SKILL_NAMES_FALLBACK_URL = 'https://raw.githubusercontent.com/alpha123/uma-skill-tools/master/data/skillnames.json';
const COURSE_DATA_URL = 'https://raw.githubusercontent.com/alpha123/uma-skill-tools/master/data/course_data.json';

function downloadJson(url, destPath) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 1000) {
      try {
        return resolve(JSON.parse(fs.readFileSync(destPath, 'utf-8')));
      } catch (e) {}
    }
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          fs.writeFileSync(destPath, JSON.stringify(parsed, null, 2), 'utf-8');
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

function parseSkillMechanics(skillId, skillDataMap) {
  const raw = skillDataMap[String(skillId)];
  if (!raw || !Array.isArray(raw.alternatives) || raw.alternatives.length === 0) {
    return {
      skillId: String(skillId),
      rarity: 1,
      condition: 'phase>=1',
      durationSec: 2.4,
      effects: [{ stat: 'targetSpeed', value: 0.25 }]
    };
  }

  const alt = raw.alternatives[0];
  const durationSec = (Number(alt.baseDuration) || 20000) / 10000;

  const EFFECT_TYPE_MAP = {
    1: 'speedStat', 2: 'staminaStat', 3: 'powerStat', 4: 'gutsStat', 5: 'witStat',
    9: 'healHpRatio', 21: 'currentSpeed', 27: 'targetSpeed', 28: 'laneSpeed', 31: 'acceleration'
  };

  const parsedEffects = (alt.effects || []).map(ef => ({
    typeCode: ef.type,
    stat: EFFECT_TYPE_MAP[ef.type] || `effect_${ef.type}`,
    value: (Number(ef.modifier) || 0) / 10000,
    rawModifier: ef.modifier
  }));

  return {
    skillId: String(skillId),
    rarity: Number(raw.rarity || 1),
    precondition: alt.precondition || '',
    condition: alt.condition || '',
    durationSec,
    effects: parsedEffects
  };
}

function getOfficialSkillName(skillId, glbSkillsMap, fallbackNamesMap) {
  const sid = String(skillId || '');
  if (!sid) return null;
  if (glbSkillsMap[sid] && glbSkillsMap[sid].name) return glbSkillsMap[sid].name;
  const fb = fallbackNamesMap[sid];
  if (fb) return Array.isArray(fb) ? (fb[1] || fb[0]) : String(fb);
  return null;
}

function getSkillRarity(skillId, glbSkillsMap, skillDataMap) {
  const sid = String(skillId || '');
  if (skillDataMap[sid] && skillDataMap[sid].rarity !== undefined) return Number(skillDataMap[sid].rarity);
  if (glbSkillsMap[sid] && glbSkillsMap[sid].rarity !== undefined) return Number(glbSkillsMap[sid].rarity);
  return sid.endsWith('1') ? 2 : 1;
}

// Tìm chính xác Skill ID từ Tên Tiếng Anh Global để không bao giờ bị lệch ID số
function findSkillIdByEnglishName(skillName, glbSkillsMap, fallbackNamesMap, preferGold = true) {
  const target = String(skillName || '').toLowerCase().replace(/\s*○$/, '').trim();
  if (!target) return null;

  for (const [sid, obj] of Object.entries(glbSkillsMap)) {
    const n = String(obj.name || '').toLowerCase().replace(/\s*○$/, '').trim();
    if (n === target) {
      if (preferGold && Number(obj.rarity) >= 2) return sid;
      if (!preferGold && Number(obj.rarity) === 1) return sid;
    }
  }
  for (const [sid, obj] of Object.entries(glbSkillsMap)) {
    const n = String(obj.name || '').toLowerCase().replace(/\s*○$/, '').trim();
    if (n === target) return sid;
  }
  for (const [sid, arr] of Object.entries(fallbackNamesMap)) {
    const en = (Array.isArray(arr) ? (arr[1] || arr[0]) : String(arr)).toLowerCase().replace(/\s*○$/, '').trim();
    if (en === target) return sid;
  }
  return null;
}

// BẢNG TÊN KỸ NĂNG POTENTIAL (2 GOLD POT LV3 & LV5 + 2 WHITE INNATE) CHUẨN GLOBAL THEO NHÂN VẬT
const CHARACTER_POT_NAMES_GLB = {
  '1001': { golds: ['Gourmand', 'In Body and Mind'], whites: ['Hydrate', 'Homestretch Haste'] },
  '1002': { golds: ['Unrestrained', 'Concentration'], whites: ['Final Push', 'Fast-Paced'] },
  '1003': { golds: ['Race Planner', 'Lightning Step'], whites: ['Position Pilfer', 'Pace Chaser Corners'] },
  '1004': { golds: ['Gear Shift', 'Mile Maven'], whites: ['Fast-Paced', 'Front Runner Corners'] },
  '1005': { golds: ['Mile Maven', 'Speed Star'], whites: ['Prepare to Pass', 'Mile Corners'] },
  '1006': { golds: ['Gourmand', 'Furious Feat'], whites: ['Hydrate', 'Updrafters'] },
  '1007': { golds: ['Go-Home Specialist', 'Visionary'], whites: ['After-School Stroll', 'End Closer Corners'] },
  '1008': { golds: ['Breath of Fresh Air', 'Furious Feat'], whites: ['Straightaway Recovery', 'Updrafters'] },
  '1009': { golds: ['Race Planner', 'Killer Tunes'], whites: ['Up-Tempo', 'Fast-Paced'] },
  '1010': { golds: ['Gear Shift', 'Mile Maven'], whites: ['Sprint Corners', 'Prepare to Pass'] },
  '1011': { golds: ['On Your Left!', 'Furious Feat'], whites: ['Slick Surge', 'Updrafters'] },
  '1012': { golds: ['Encroaching Shadow', 'Furious Feat'], whites: ['Straightaway Spurt', 'End Closer Corners'] },
  '1013': { golds: ['Cooldown', 'Vanguard Spirit'], whites: ['Deep Breaths', 'Long Corners'] },
  '1014': { golds: ['Killer Tunes', 'Rising Dragon'], whites: ['Up-Tempo', 'Hawk Eye'] },
  '1015': { golds: ['Speed Star', 'Cooldown'], whites: ['Prepare to Pass', 'Deep Breaths'] },
  '1016': { golds: ['Speed Star', 'On Your Left!'], whites: ['Medium Corners', 'Slick Surge'] },
  '1017': { golds: ['Professor of Curvature', 'Gourmand'], whites: ['Corner Adept', 'Late Surger Corners'] },
  '1018': { golds: ['Killer Tunes', 'On Your Left!'], whites: ['Up-Tempo', 'Slick Surge'] },
  '1019': { golds: ['Furious Feat', 'On Your Left!'], whites: ['Updrafters', 'Slick Surge'] },
  '1020': { golds: ['Escape Artist', 'Vanguard Spirit'], whites: ['Fast-Paced', 'Tail Held High'] },
  '1021': { golds: ['Lightning Step', 'On Your Left!'], whites: ['Nimble Navigator', 'Slick Surge'] },
  '1022': { golds: ['Speed Star', 'Gourmand'], whites: ['Prepare to Pass', 'Pace Chaser Corners'] },
  '1023': { golds: ['Race Planner', 'Cooldown'], whites: ['Deep Breaths', 'Pace Chaser Straightaways'] },
  '1024': { golds: ['Breath of Fresh Air', 'No Stopping Me!'], whites: ['Straightaway Recovery', 'Rampage'] },
  '1025': { golds: ['Cooldown', 'Mystifying Murmur'], whites: ['Deep Breaths', 'Long Straightaways'] },
  '1026': { golds: ['Escape Artist', 'Concentration'], whites: ['Fast-Paced', 'Front Runner Straightaways'] },
  '1027': { golds: ['On Your Left!', 'Killer Tunes'], whites: ['Slick Surge', 'Medium Corners'] },
  '1028': { golds: ['Sprint Turbo', 'Plan X'], whites: ['Sprint Straightaways', 'Countermeasure'] },
  '1029': { golds: ['No Stopping Me!', 'Speed Star'], whites: ['Rampage', 'Prepare to Pass'] },
  '1030': { golds: ['Cooldown', 'Gourmand'], whites: ['Deep Breaths', 'Hydrate'] },
  '1031': { golds: ['Turbulent Gale', 'Escape Artist'], whites: ['Fast-Paced', 'Front Runner Corners'] },
  '1032': { golds: ['Race Planner', 'Speed Star'], whites: ['Prepare to Pass', 'Medium Corners'] },
  '1033': { golds: ['Encroaching Shadow', 'On Your Left!'], whites: ['Straightaway Spurt', 'Slick Surge'] },
  '1035': { golds: ['On Your Left!', 'In Body and Mind'], whites: ['Slick Surge', 'Homestretch Haste'] },
  '1037': { golds: ['On Your Left!', 'Sharp Gaze'], whites: ['Slick Surge', 'Late Surger Straightaways'] },
  '1038': { golds: ['Sprint Turbo', 'Poise and Preparation'], whites: ['Sprint Corners', 'Prepare to Pass'] },
  '1040': { golds: ['Keen Eye', 'On Your Left!'], whites: ['Shrewd Step', 'Mile Corners'] },
  '1041': { golds: ['Sprint Turbo', 'Escape Artist'], whites: ['Sprint Straightaways', 'Fast-Paced'] },
  '1045': { golds: ['Swinging Maestro', 'Cooldown'], whites: ['Corner Recovery', 'Deep Breaths'] },
  '1046': { golds: ['Charting the Course', 'Escape Artist'], whites: ['Position Pilfer', 'Fast-Paced'] },
  '1048': { golds: ['Killer Tunes', 'Breath of Fresh Air'], whites: ['Up-Tempo', 'Straightaway Recovery'] },
  '1050': { golds: ['Encroaching Shadow', 'Sleeping Lion'], whites: ['Straightaway Spurt', 'End Closer Straightaways'] },
  '1051': { golds: ['Beeline Burst', 'Sprint Turbo'], whites: ['Straightaway Adept', 'Sprint Corners'] },
  '1052': { golds: ['Indomitable', 'Breath of Fresh Air'], whites: ['Lay Low', 'Straightaway Recovery'] },
  '1056': { golds: ['On Your Left!', 'Cooldown'], whites: ['Slick Surge', 'Deep Breaths'] },
  '1058': { golds: ['Killer Tunes', 'Cooldown'], whites: ['Up-Tempo', 'Deep Breaths'] },
  '1059': { golds: ['On Your Left!', 'Sharp Gaze'], whites: ['Slick Surge', 'Late Surger Corners'] },
  '1060': { golds: ['Mystifying Murmur', 'On Your Left!'], whites: ['Slick Surge', 'Late Surger Corners'] },
  '1061': { golds: ['Sprint Turbo', 'Corner Connoisseur'], whites: ['Sprint Straightaways', 'Corner Acceleration'] },
  '1062': { golds: ['Untapped Potential', 'Cooldown'], whites: ['Stamina to Spare', 'Deep Breaths'] },
  '1064': { golds: ['Escape Artist', 'Lead the Charge'], whites: ['Fast-Paced', 'Front Runner Savvy'] },
  '1067': { golds: ['Cooldown', 'Iron Will'], whites: ['Deep Breaths', 'Lay Low'] },
  '1068': { golds: ['Professor of Curvature', 'Escape Artist'], whites: ['Corner Adept', 'Fast-Paced'] },
  '1069': { golds: ['Speed Star', 'Breath of Fresh Air'], whites: ['Prepare to Pass', 'Mile Corners'] },
  '1071': { golds: ['Race Planner', 'Speed Star'], whites: ['Medium Corners', 'Prepare to Pass'] },
  '1072': { golds: ['No Stopping Me!', 'Rising Dragon'], whites: ['Rampage', 'Medium Straightaways'] }
};

function resolveUmaPotSkills(uma, glbSkillsMap, fallbackNamesMap, skillDataMap) {
  const charaId = String(uma.charaId || String(uma.id).slice(0, 4));
  const awkIds = Array.isArray(uma.rawAwakeningSkills) ? uma.rawAwakeningSkills.map(String) : [];
  const innIds = Array.isArray(uma.rawInnateSkills) ? uma.rawInnateSkills.map(String) : [];

  // TRƯỜNG HỢP 1: File umas.json có sẵn mảng skills_awakening & skills_innate trực tiếp từ GameTora
  if (awkIds.length >= 4) {
    // Trong GameTora: awkIds[1] (Pot Lv3) và awkIds[3] (Pot Lv5) LUÔN LUÔN là 2 Gold Skill
    const potEntries = [
      { id: awkIds[1], isGold: true },
      { id: awkIds[3], isGold: true },
      ...innIds.slice(0, 3).map(id => ({ id, isGold: false }))
    ].filter(x => x.id);

    return potEntries.map(entry => {
      const name = getOfficialSkillName(entry.id, glbSkillsMap, fallbackNamesMap) || `Pot Skill #${entry.id}`;
      return {
        skillId: entry.id,
        name,
        isGold: entry.isGold,
        fromPot: true,
        mechanics: parseSkillMechanics(entry.id, skillDataMap)
      };
    });
  }

  // TRƯỜNG HỢP 2: Tra cứu theo tên Tiếng Anh Global chuẩn xác của từng nhân vật
  let preset = CHARACTER_POT_NAMES_GLB[charaId];
  if (!preset) {
    const apt = uma.aptitudes || {};
    if (apt.Front === 'A') preset = { golds: ['Escape Artist', 'Unrestrained'], whites: ['Fast-Paced', 'Corner Adept'] };
    else if (apt.End === 'A') preset = { golds: ['Encroaching Shadow', 'Go-Home Specialist'], whites: ['Straightaway Spurt', 'Corner Adept'] };
    else if (apt.Late === 'A') preset = { golds: ['On Your Left!', 'No Stopping Me!'], whites: ['Slick Surge', 'Rampage'] };
    else if (apt.Long === 'A') preset = { golds: ['Swinging Maestro', 'Cooldown'], whites: ['Corner Recovery', 'Deep Breaths'] };
    else preset = { golds: ['Speed Star', 'Gourmand'], whites: ['Prepare to Pass', 'Hydrate'] };
  }

  const results = [];

  // 2 Kỹ năng Vàng Pot Lv3 & Lv5 (Luôn đánh dấu isGold: true)
  (preset.golds || []).forEach(gName => {
    const sid = findSkillIdByEnglishName(gName, glbSkillsMap, fallbackNamesMap, true) || '200011';
    const officialName = getOfficialSkillName(sid, glbSkillsMap, fallbackNamesMap) || gName;
    results.push({
      skillId: sid,
      name: officialName,
      isGold: true,
      fromPot: true,
      mechanics: parseSkillMechanics(sid, skillDataMap)
    });
  });

  // 2 Kỹ năng Trắng Innate Pot Lv1 (Luôn đánh dấu isGold: false)
  (preset.whites || []).forEach(wName => {
    const sid = findSkillIdByEnglishName(wName, glbSkillsMap, fallbackNamesMap, false) || '200012';
    const officialName = getOfficialSkillName(sid, glbSkillsMap, fallbackNamesMap) || wName;
    results.push({
      skillId: sid,
      name: officialName,
      isGold: false,
      fromPot: true,
      mechanics: parseSkillMechanics(sid, skillDataMap)
    });
  });

  return results;
}

(async () => {
  try {
    console.log('1. Đang chuẩn hóa lại toàn bộ Potential Skills (2 Gold + 2 White) cho Uma...');
    const skillDataMap = await downloadJson(SKILL_DATA_URL, path.join(DATA_DIR, 'skill_data.json'));
    const fallbackNamesMap = await downloadJson(SKILL_NAMES_FALLBACK_URL, path.join(DATA_DIR, 'skillnames.json'));
    await downloadJson(COURSE_DATA_URL, path.join(DATA_DIR, 'course_data.json'));

    let glbSkillsMap = {};
    const glbSkillsPath = path.join(DATA_DIR, 'skills_glb.json');
    if (fs.existsSync(glbSkillsPath)) {
      glbSkillsMap = JSON.parse(fs.readFileSync(glbSkillsPath, 'utf-8'));
    }

    const umasPath = path.join(DATA_DIR, 'umas.json');
    if (fs.existsSync(umasPath)) {
      const umas = JSON.parse(fs.readFileSync(umasPath, 'utf-8'));
      const updatedUmas = umas.map(u => {
        const cid = String(u.id || '');
        const charaId = String(u.charaId || cid.slice(0, 4));
        const thumbUrl = 'https://gametora.com/images/umamusume/characters/thumb/chara_stand_' + charaId + '_' + cid + '.png';

        let uniqueId = null;
        if (Array.isArray(u.rawUniqueSkills) && u.rawUniqueSkills.length > 0) {
          uniqueId = String(u.rawUniqueSkills[0]);
        } else if (u.uniqueSkillId) {
          uniqueId = String(u.uniqueSkillId);
        } else {
          const charNum = charaId.slice(1);
          const variant = Number(cid.slice(4, 6)) || 1;
          const prefix = String(10 + (variant - 1));
          uniqueId = skillDataMap[`${prefix}${charNum}1`] ? `${prefix}${charNum}1` : `10${charNum}1`;
        }

        const officialUqName = getOfficialSkillName(uniqueId, glbSkillsMap, fallbackNamesMap) || u.uniqueSkill;
        const potSkills = resolveUmaPotSkills(u, glbSkillsMap, fallbackNamesMap, skillDataMap);

        return {
          ...u,
          id: cid,
          charaId,
          icon: thumbUrl,
          fallbackIcon: 'https://gametora.com/images/umamusume/characters/thumb/chara_stand_' + charaId + '_' + charaId + '01.png',
          uniqueSkillId: uniqueId,
          uniqueSkill: officialUqName,
          uniqueSkillData: parseSkillMechanics(uniqueId, skillDataMap),
          potSkills
        };
      });

      fs.writeFileSync(umasPath, JSON.stringify(updatedUmas, null, 2), 'utf-8');
      console.log(`✔ Đã đồng bộ chính xác Pot Skills cho ${updatedUmas.length} Uma trong data/umas.json!`);
    }
  } catch (err) {
    console.error('Lỗi:', err.message);
  }
})();