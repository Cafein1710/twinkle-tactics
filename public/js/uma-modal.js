// public/js/uma-modal.js - Hiển thị Bậc Thích Nghi tối giản & Modal Chuột Phải Xem Chi Tiết Uma chuẩn GameTora

function getRankColorHex(rank) {
  if (rank === 'S') return '#facc15';
  if (rank === 'A') return '#f43f5e';
  if (rank === 'B') return '#ec4899';
  if (rank === 'C') return '#22c55e';
  return '#64748b';
}

function renderColoredRankChar(rank) {
  const col = getRankColorHex(rank);
  return `<b style="color:${col};">${rank || 'G'}</b>`;
}

// 1. HIỂN THỊ TỐI GIẢN Ở BÊN NGOÀI (TRÊN THẺ UMA Ở PRE-GAME & BÀN ĐẤU)
// Hiển thị đủ cả 3 nhóm: Sân (T/D) • Cự ly (S/M/M/L) • Style chạy (F/P/L/E)
function renderCompactAptitudesBar(apt) {
  if (!apt) return '';
  return `
    <span title="Surface: Turf / Dirt">Sân ${renderColoredRankChar(apt.Turf)}/${renderColoredRankChar(apt.Dirt)}</span>
    <span style="color:#475569;">|</span>
    <span title="Distance: Sprint / Mile / Medium / Long">Cự ly ${renderColoredRankChar(apt.Sprint)}/${renderColoredRankChar(apt.Mile)}/${renderColoredRankChar(apt.Medium)}/${renderColoredRankChar(apt.Long)}</span>
    <span style="color:#475569;">|</span>
    <span title="Running Style: Front / Pace / Late / End">Style ${renderColoredRankChar(apt.Front)}/${renderColoredRankChar(apt.Pace)}/${renderColoredRankChar(apt.Late)}/${renderColoredRankChar(apt.End)}</span>
  `;
}

// Tìm Style chạy có bậc cao nhất của Uma làm mặc định
function getBestDefaultStyle(apt) {
  if (!apt) return 'Pace';
  const order = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S'];
  const styles = ['Front', 'Pace', 'Late', 'End'];
  let best = 'Pace';
  let bestScore = -1;
  styles.forEach(st => {
    const score = order.indexOf(apt[st] || 'G');
    if (score > bestScore) {
      bestScore = score;
      best = st;
    }
  });
  return best;
}

// 2. MỞ CỬA SỔ CHI TIẾT UMA KHI CHUỘT PHẢI VÀO ICON/THẺ UMA (CHUẨN GAMETORA)
function openUmaDetailModal(uma, umaIndex = null, isMyBoard = false) {
  if (!uma) return;
  const modal = document.getElementById('uma-zoom-modal');
  if (!modal) return;

  const apt = uma.aptitudes || {};
  const stats = uma.baseStats || { spd: 180, sta: 180, pow: 180, gut: 180, wit: 180 };
  const activeStyle = uma.activeStyle || getBestDefaultStyle(apt);

  // Header: Avatar, Tên, Mood & Chọn Style chạy
  const avatarImg = document.getElementById('uz-avatar');
  avatarImg.src = uma.icon;
  avatarImg.onerror = () => {
    avatarImg.src = uma.fallbackIcon || fallbackAvatar(uma.name, uma.color);
  };

  document.getElementById('uz-name').innerText = uma.name;
  document.getElementById('uz-mood-wrap').innerHTML = renderMoodBadgeHTML(uma.mood || 'Normal');

  // Nút chọn Chiến thuật chạy (Running Style) nếu là Uma của bạn trong trận
  const styleSelectorEl = document.getElementById('uz-style-selector');
  const styles = ['Front', 'Pace', 'Late', 'End'];
  if (isMyBoard && umaIndex !== null) {
    styleSelectorEl.innerHTML = `
      <span style="font-size:11.5px; color:#94a3b8; margin-right:4px;">Chiến thuật chạy:</span>
      ${styles.map(st => {
        const isCur = activeStyle === st;
        return `<button onclick="selectUmaActiveStyle(${umaIndex}, '${st}')"
          style="width:auto; padding:4px 10px; margin:0 2px; font-size:11.5px; background:${isCur ? '#facc15' : '#1e293b'}; color:${isCur ? '#000' : '#cbd5e1'}; border:1px solid ${isCur ? '#fef08a' : '#475569'};">
          ${st} (${apt[st] || 'G'})
        </button>`;
      }).join('')}
    `;
  } else {
    styleSelectorEl.innerHTML = `<span style="font-size:12px; color:#38bdf8;">Style sở trường: <b>${activeStyle} (${apt[activeStyle] || 'A'})</b></span>`;
  }

  // 5 Chỉ số kèm Icon Uma Musume
  document.getElementById('uz-stats-bar').innerHTML = `
    <div class="stat-cell">${renderStatIconHTML('Speed', 22)}<span>Speed</span><strong style="font-size:14px; color:#38bdf8;">${stats.spd}</strong></div>
    <div class="stat-cell">${renderStatIconHTML('Stamina', 22)}<span>Stamina</span><strong style="font-size:14px; color:#fb7185;">${stats.sta}</strong></div>
    <div class="stat-cell">${renderStatIconHTML('Power', 22)}<span>Power</span><strong style="font-size:14px; color:#fb923c;">${stats.pow}</strong></div>
    <div class="stat-cell">${renderStatIconHTML('Guts', 22)}<span>Guts</span><strong style="font-size:14px; color:#f472b6;">${stats.gut}</strong></div>
    <div class="stat-cell">${renderStatIconHTML('Wit', 22)}<span>Wit</span><strong style="font-size:14px; color:#4ade80;">${stats.wit}</strong></div>
  `;

  // BẢNG 10 BẬC THÍCH NGHI CHIA 3 HÀNG CHUẨN GAMETORA (SURFACE / DISTANCE / STRATEGY)
  const renderAptCell = (label, key) => {
    const r = apt[key] || 'G';
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; background:#0f172a; padding:6px 10px; border-radius:6px; border:1px solid #334155;">
        <span style="font-size:12px; color:#cbd5e1;">${label}</span>
        <span class="rank-badge rank-${r}" style="width:24px; font-size:12px;">${r}</span>
      </div>
    `;
  };

  document.getElementById('uz-aptitudes-table').innerHTML = `
    <div style="font-size:11px; color:#94a3b8; font-weight:bold; margin-bottom:4px;">SURFACE APTITUDE (MẶT SÂN)</div>
    <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:8px; margin-bottom:10px;">
      ${renderAptCell('Turf (Sân cỏ)', 'Turf')}
      ${renderAptCell('Dirt (Sân đất)', 'Dirt')}
    </div>

    <div style="font-size:11px; color:#94a3b8; font-weight:bold; margin-bottom:4px;">DISTANCE APTITUDE (CỰ LY)</div>
    <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; margin-bottom:10px;">
      ${renderAptCell('Sprint', 'Sprint')}
      ${renderAptCell('Mile', 'Mile')}
      ${renderAptCell('Medium', 'Medium')}
      ${renderAptCell('Long', 'Long')}
    </div>

    <div style="font-size:11px; color:#facc15; font-weight:bold; margin-bottom:4px;">STRATEGY / RUNNING STYLE (CHIẾN THUẬT CHẠY)</div>
    <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px;">
      ${renderAptCell('Front (Nige)', 'Front')}
      ${renderAptCell('Pace (Senkou)', 'Pace')}
      ${renderAptCell('Late (Sashi)', 'Late')}
      ${renderAptCell('End (Oikomi)', 'End')}
    </div>
  `;

  // DANH SÁCH KỸ NĂNG: UNIQUE + POTENTIAL (POT LV1-LV5) + SUPPORT SKILLS
  const potSkills = uma.potSkills || [];
  const runtimeSkills = (uma.skills || []).filter(s => !s.fromPot);
  const uqCond = uma.uniqueSkillData?.condition || 'Auto';

  let skillsHTML = `
    <div style="background:#0f172a; border-left:4px solid #facc15; padding:8px 12px; border-radius:6px; margin-bottom:8px;">
      <div style="font-size:13px; font-weight:bold; color:#fef08a;">[UNIQUE SKILL] ${uma.uniqueSkill}</div>
      <div style="font-size:11px; color:#94a3b8; margin-top:2px;">Điều kiện kích hoạt: <code>${uqCond}</code></div>
    </div>

    <div style="font-size:11.5px; color:#38bdf8; font-weight:bold; margin:8px 0 6px;">
      KỸ NĂNG CÓ SẴN TRONG POTENTIAL (POT LV1 – LV5):
    </div>
    <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:6px;">
      ${potSkills.length === 0 ? '<div style="color:#64748b; font-size:12px;">Chưa có dữ liệu Pot</div>' :
        potSkills.map(ps => `
          <div style="background:#0f172a; border:1px solid ${ps.isGold ? '#eab308' : '#334155'}; border-radius:6px; padding:6px 10px; display:flex; align-items:center; justify-content:space-between;">
            <div>
              <span class="skill-tag-label ${ps.isGold ? 'tag-gold' : 'tag-white'}">${ps.isGold ? 'POT GOLD' : 'INNATE'}</span>
              <strong style="font-size:12px; color:${ps.isGold ? '#facc15' : '#e2e8f0'};">${ps.name}</strong>
            </div>
          </div>
        `).join('')}
    </div>
  `;

  if (runtimeSkills.length > 0) {
    skillsHTML += `
      <div style="font-size:11.5px; color:#4ade80; font-weight:bold; margin:10px 0 6px;">
        KỸ NĂNG HỌC TỪ SUPPORT CARD TRONG TRẬN (${runtimeSkills.length}):
      </div>
      <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:6px;">
        ${runtimeSkills.map(rs => `
          <div style="background:#0f172a; border:1px solid ${rs.isGold ? '#eab308' : '#38bdf8'}; border-radius:6px; padding:6px 10px;">
            <span class="skill-tag-label ${rs.isGold ? 'tag-gold' : 'tag-white'}">${rs.isGold ? 'GOLD' : 'WHITE'}</span>
            <strong style="font-size:12px; color:${rs.isGold ? '#facc15' : '#e2e8f0'};">${rs.name}</strong>
          </div>
        `).join('')}
      </div>
    `;
  }

  document.getElementById('uz-skills-section').innerHTML = skillsHTML;
  modal.style.display = 'flex';
}

function selectUmaActiveStyle(umaIndex, newStyle) {
  socket.emit('change_uma_style', {
    roomCode: currentRoomCode,
    sessionToken,
    umaIndex,
    newStyle
  });
  document.getElementById('uma-zoom-modal').style.display = 'none';
}