// public/js/race-viewer.js - Trình chiếu Trận đua 6 Uma (Có Đếm ngược 10s / Xác nhận Mở Cổng 0/2 trước khi đua)

let raceAnimInterval = null;
let preRaceCountdownInterval = null;
let racePlaybackSpeed = 1;
let currentRacePacket = null;
let currentFrameIdx = 0;
let emittedLogIdx = 0;
let lastVisualPctByRunner = {};
let hasRacePlaybackStarted = false;

function setRacePlaybackSpeed(spd) {
  racePlaybackSpeed = spd;
  [1, 2, 4].forEach(s => {
    const btn = document.getElementById(`btn-race-spd-${s}`);
    if (btn) btn.classList.toggle('active', s === spd);
  });
}

function skipToRaceEnd() {
  if (!currentRacePacket) return;
  if (!hasRacePlaybackStarted) {
    startRacePlaybackNow();
  }
  currentFrameIdx = currentRacePacket.frames.length - 1;
  renderRaceFrame(currentFrameIdx);
  flushRemainingCommentary();
  showPostRaceSummary();
  if (raceAnimInterval) {
    clearInterval(raceAnimInterval);
    raceAnimInterval = null;
  }
}

function formatAptColor(rank) {
  if (rank === 'S') return `<b style="color:#facc15;">S</b>`;
  if (rank === 'A') return `<b style="color:#f43f5e;">A</b>`;
  if (rank === 'B') return `<b style="color:#ec4899;">B</b>`;
  if (rank === 'C') return `<b style="color:#22c55e;">C</b>`;
  return `<b style="color:#94a3b8;">${rank || 'G'}</b>`;
}

function openRaceViewerModal(racePacket) {
  if (!racePacket) return;
  currentRacePacket = racePacket;
  currentFrameIdx = 0;
  emittedLogIdx = 0;
  lastVisualPctByRunner = {};
  hasRacePlaybackStarted = false;

  if (raceAnimInterval) {
    clearInterval(raceAnimInterval);
    raceAnimInterval = null;
  }
  if (preRaceCountdownInterval) {
    clearInterval(preRaceCountdownInterval);
    preRaceCountdownInterval = null;
  }

  const modal = document.getElementById('race-viewer-modal');
  const summaryPanel = document.getElementById('rv-post-race-panel');
  const nextBtn = document.getElementById('btn-confirm-race-next');
  if (!modal) return;

  summaryPanel.style.display = 'none';
  nextBtn.disabled = false;
  nextBtn.style.background = '#10b981';

  const m = racePacket.map;
  const D = Number(m.length) || 2000;

  document.getElementById('rv-header-title').innerText =
    `${m.slot.toUpperCase()}: ${m.name} (${m.famousRace || 'Championship Race'})`;
  document.getElementById('rv-header-meta').innerText =
    `Mặt sân: ${m.surface} • Cự ly: ${m.distanceType} (${D}m) • Mùa: ${m.season || 'Spring'} • Sân: ${m.condition || m.trueCondition || 'Firm'}`;

  const lateM = Math.round(D * (2 / 3));
  const spurtM = Math.round(D * (5 / 6));
  document.getElementById('rv-course-phases-bar').innerHTML = `
    <div class="mh-block" style="left:0%; width:16.67%; background:#059669; color:#fff; font-size:10px;">Opening (0-${Math.round(D/6)}m)</div>
    <div class="mh-block" style="left:16.67%; width:50%; background:#ca8a04; color:#000; font-size:10px;">Middle Leg (${Math.round(D/6)}-${lateM}m)</div>
    <div class="mh-block" style="left:66.67%; width:16.67%; background:#db2777; color:#fff; font-size:10px;">Final Leg (${lateM}-${spurtM}m)</div>
    <div class="mh-block" style="left:83.34%; width:16.66%; background:#e11d48; color:#fff; font-size:10px;">Last Spurt (${spurtM}-${D}m)</div>
  `;

  const lanesContainer = document.getElementById('rv-lanes-container');
  lanesContainer.innerHTML = '';

  // Thanh Xác Nhận Mở Cổng Xuất Phát (10 giây tự động bắt đầu)
  const gateBanner = document.createElement('div');
  gateBanner.id = 'rv-pre-race-gate-banner';
  gateBanner.style.cssText = 'background:linear-gradient(90deg,#0f172a,#1e293b,#0f172a); border:2px solid #facc15; border-radius:10px; padding:10px 16px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 6px 20px rgba(0,0,0,0.6);';
  gateBanner.innerHTML = `
    <div>
      <div style="color:#facc15; font-weight:bold; font-size:14px;">
        CẢ 6 UMA ĐÃ VÀO CỔNG XUẤT PHÁT!
      </div>
      <div style="color:#cbd5e1; font-size:12px; margin-top:2px;">
        Cuộc đua sẽ bắt đầu ngay khi cả 2 Trainer bấm sẵn sàng hoặc tự động mở cổng sau <b id="rv-gate-timer" style="color:#38bdf8; font-size:14px;">10s</b>
      </div>
    </div>
    <button id="btn-gate-ready-start" style="width:250px; background:#f59e0b; color:#0f172a; font-weight:bold; font-size:13px; margin:0; padding:9px 14px;">
      Sẵn Sàng Mở Cổng (0/2)
    </button>
  `;
  lanesContainer.appendChild(gateBanner);

  (racePacket.runnersMeta || []).forEach(rm => {
    const isMyUma = rm.ownerToken === sessionToken;
    const teamColor = isMyUma ? '#38bdf8' : '#f43f5e';
    const teamLabel = isMyUma ? 'BẠN' : 'ĐỐI THỦ';

    const laneDiv = document.createElement('div');
    laneDiv.className = 'rv-lane-row';
    laneDiv.innerHTML = `
      <div class="rv-lane-info" style="border-left: 4px solid ${teamColor};">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:${teamColor}; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px;">[${teamLabel}] ${rm.name}</strong>
          <span class="rv-rank-badge" id="rv-rank-${rm.runnerId}">#--</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:9.5px; color:#cbd5e1; margin-top:2px;">
          <span>${m.surface} ${formatAptColor(rm.surfRank)} | ${m.distanceType} ${formatAptColor(rm.distRank)} | ${rm.style} ${formatAptColor(rm.styleRank)}</span>
          <span id="rv-spd-${rm.runnerId}">Trong cổng</span>
        </div>
        <div class="rv-hp-bar-bg">
          <div class="rv-hp-bar-fill" id="rv-hp-${rm.runnerId}" style="width:100%; background:${teamColor};"></div>
        </div>
      </div>

      <div class="rv-track-strip">
        <div class="rv-finish-line"></div>
        <div class="rv-runner-token" id="rv-token-${rm.runnerId}" style="left:0%;">
          <div class="rv-skill-popup" id="rv-popup-${rm.runnerId}" style="display:none;"></div>
          <img class="rv-runner-avatar" id="rv-avatar-${rm.runnerId}" style="border-color:${teamColor};" src="${rm.icon}"
               onerror="if(this.src!=='${rm.fallbackIcon||''}' && '${rm.fallbackIcon||''}'){this.src='${rm.fallbackIcon}';}else{this.src='${fallbackAvatar(rm.name, teamColor)}';}">
        </div>
      </div>
    `;
    lanesContainer.appendChild(laneDiv);
  });

  document.getElementById('rv-distance-counter').innerText = `Chờ mở cổng: 0m / ${D}m (0.0s)`;
  document.getElementById('rv-commentary-feed').innerHTML = `
    <div class="rv-log-line log-phase">
      <span class="rv-speaker-badge blv-a">BLV A</span>
      <span>Cả 6 Uma đã tiến vào cổng xuất phát tại ${m.name} (${D}m • Mùa ${m.season || 'Spring'}). Đang chờ tín hiệu mở cổng từ 2 Trainer...</span>
    </div>
  `;
  modal.style.display = 'flex';

  // Xử lý nút Sẵn Sàng Mở Cổng & Đếm ngược 10 giây
  const btnGateReady = document.getElementById('btn-gate-ready-start');
  if (btnGateReady) {
    btnGateReady.onclick = () => {
      btnGateReady.disabled = true;
      btnGateReady.style.background = '#64748b';
      btnGateReady.style.color = '#fff';
      btnGateReady.innerText = 'Đã xác nhận! Chờ đối thủ...';
      socket.emit('confirm_race_gate_start', { roomCode: currentRoomCode, sessionToken });
    };
  }

  let countdownSec = 10;
  preRaceCountdownInterval = setInterval(() => {
    countdownSec--;
    const timerEl = document.getElementById('rv-gate-timer');
    if (timerEl) timerEl.innerText = `${Math.max(0, countdownSec)}s`;
    if (countdownSec <= 0) {
      startRacePlaybackNow();
    }
  }, 1000);
}

// Hàm chính thức mở cổng và bắt đầu chạy mô phỏng
function startRacePlaybackNow() {
  if (hasRacePlaybackStarted || !currentRacePacket) return;
  hasRacePlaybackStarted = true;

  if (preRaceCountdownInterval) {
    clearInterval(preRaceCountdownInterval);
    preRaceCountdownInterval = null;
  }

  const gateBanner = document.getElementById('rv-pre-race-gate-banner');
  if (gateBanner) gateBanner.style.display = 'none';

  document.getElementById('rv-commentary-feed').innerHTML = '';
  emitCommentaryUpToTime(0.3);

  if (raceAnimInterval) clearInterval(raceAnimInterval);
  raceAnimInterval = setInterval(() => {
    if (!currentRacePacket) return;
    currentFrameIdx = Math.min(
      currentRacePacket.frames.length - 1,
      currentFrameIdx + racePlaybackSpeed
    );

    renderRaceFrame(currentFrameIdx);
    const curTime = currentRacePacket.frames[currentFrameIdx]?.t || 0;
    emitCommentaryUpToTime(curTime);

    if (currentFrameIdx >= currentRacePacket.frames.length - 1) {
      clearInterval(raceAnimInterval);
      raceAnimInterval = null;
      flushRemainingCommentary();
      setTimeout(() => showPostRaceSummary(), 450);
    }
  }, 85);
}

// Lắng nghe tín hiệu đồng bộ mở cổng từ Server
if (typeof socket !== 'undefined') {
  socket.on('race_gate_ready_update', ({ readyCount, total }) => {
    const btn = document.getElementById('btn-gate-ready-start');
    if (btn && !btn.disabled) {
      btn.innerText = `Sẵn Sàng Mở Cổng (${readyCount}/${total})`;
    } else if (btn && btn.disabled) {
      btn.innerText = `Đã sẵn sàng (${readyCount}/${total})...`;
    }
  });

  socket.on('race_gate_open', () => {
    startRacePlaybackNow();
  });
}

function renderRaceFrame(fIdx) {
  if (!currentRacePacket || !currentRacePacket.frames[fIdx]) return;
  const frame = currentRacePacket.frames[fIdx];
  const D = Number(currentRacePacket.map.length) || 2000;
  const leadPos = frame.leadPos || Math.max(...frame.runners.map(r => r.pos));

  frame.runners.forEach(r => {
    const gapM = Math.max(0, leadPos - r.pos);
    const trueTrackPct = (r.pos / D) * 94.5;
    const subtleFormationOffset = Math.min(4.5, gapM * 0.22);
    const rawVisualPct = r.pos >= D ? 94.5 : Math.max(0, trueTrackPct - subtleFormationOffset);

    const prevPct = lastVisualPctByRunner[r.id] || 0;
    const visualPct = Math.min(94.5, Math.max(prevPct, rawVisualPct));
    lastVisualPctByRunner[r.id] = visualPct;

    const tokenEl = document.getElementById(`rv-token-${r.id}`);
    const avatarEl = document.getElementById(`rv-avatar-${r.id}`);
    const rankEl = document.getElementById(`rv-rank-${r.id}`);
    const spdEl = document.getElementById(`rv-spd-${r.id}`);
    const hpEl = document.getElementById(`rv-hp-${r.id}`);
    const popupEl = document.getElementById(`rv-popup-${r.id}`);

    if (tokenEl) tokenEl.style.left = `${visualPct.toFixed(2)}%`;

    if (avatarEl) {
      if (r.surging) {
        avatarEl.style.boxShadow = '0 0 12px #facc15, -8px 0 14px #f97316';
        avatarEl.style.transform = 'scale(1.12)';
      } else {
        avatarEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.7)';
        avatarEl.style.transform = 'scale(1)';
      }
    }

    if (rankEl) {
      let gapText = '';
      if (r.finished && r.finishTime) {
        gapText = `${r.finishTime.toFixed(1)}s`;
      } else {
        gapText = r.order === 1 ? 'Lead' : `-${gapM.toFixed(1)}m`;
      }
      rankEl.innerText = `#${r.order} (${gapText})`;
      rankEl.style.background = r.order === 1 ? '#facc15' : (r.order <= 3 ? '#38bdf8' : '#334155');
      rankEl.style.color = r.order <= 3 ? '#0f172a' : '#cbd5e1';
    }

    if (spdEl) {
      const surgeArrow = r.surging ? ' ▲' : '';
      spdEl.innerHTML = `<span style="color:${r.surging ? '#facc15' : '#cbd5e1'}; font-weight:${r.surging ? 'bold' : 'normal'};">${r.spd} m/s${surgeArrow}</span> ${r.status ? `<b style="color:#f43f5e;">[${r.status}]</b>` : ''}`;
    }

    if (hpEl) {
      hpEl.style.width = `${r.hpPct}%`;
      if (r.hpPct < 20) hpEl.style.background = '#ef4444';
    }

    if (popupEl) {
      if (r.activeSkill) {
        popupEl.innerText = `★ ${r.activeSkill}`;
        popupEl.style.display = 'block';
      } else {
        popupEl.style.display = 'none';
      }
    }
  });

  document.getElementById('rv-distance-counter').innerText =
    `Dẫn đầu: ${Math.round(leadPos)}m / ${D}m (${frame.t}s)`;
}

function emitCommentaryUpToTime(curTime) {
  if (!currentRacePacket) return;
  const logs = currentRacePacket.commentary || [];
  const feedEl = document.getElementById('rv-commentary-feed');

  while (emittedLogIdx < logs.length && logs[emittedLogIdx].time <= curTime) {
    const item = logs[emittedLogIdx];
    emittedLogIdx++;

    const row = document.createElement('div');
    row.className = `rv-log-line log-${item.highlightType}`;
    const isBlvB = item.speaker === 'BLV B';
    const speakerBadge = `<span class="rv-speaker-badge ${isBlvB ? 'blv-b' : 'blv-a'}">${item.speaker}</span>`;

    row.innerHTML = `<span style="color:#64748b; font-size:10.5px; margin-right:6px;">[${item.time}s]</span>${speakerBadge} <span>${item.text}</span>`;
    feedEl.appendChild(row);
    feedEl.scrollTop = feedEl.scrollHeight;
  }
}

function flushRemainingCommentary() {
  if (!currentRacePacket) return;
  emitCommentaryUpToTime(9999);
}

function showPostRaceSummary() {
  if (!currentRacePacket) return;
  const panel = document.getElementById('rv-post-race-panel');
  const podiumEl = document.getElementById('rv-podium-list');
  const scoreSummaryEl = document.getElementById('rv-score-summary');
  const nextBtn = document.getElementById('btn-confirm-race-next');

  const results = currentRacePacket.resultsTable || [];
  podiumEl.innerHTML = results.map(r => {
    const isMe = r.ownerToken === sessionToken;
    const badgeCol = r.rank === 1 ? '#facc15' : (r.rank === 2 ? '#e2e8f0' : (r.rank === 3 ? '#fb923c' : '#475569'));
    const ptsText = r.pointsEarned > 0 ? `<b style="color:#4ade80;">+${r.pointsEarned} PTS</b>` : `<span style="color:#64748b;">+0 PTS</span>`;
    return `
      <div class="rv-podium-row" style="border-left: 4px solid ${isMe ? '#38bdf8' : '#f43f5e'};">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="background:${badgeCol}; color:#0f172a; font-weight:bold; padding:2px 7px; border-radius:4px; font-size:11px;">#${r.rank}</span>
          <img src="${r.icon}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;" onerror="this.src='${r.fallbackIcon || ''}'">
          <div>
            <strong style="font-size:12px; color:${isMe ? '#38bdf8' : '#fda4af'};">${r.name}</strong>
            <span style="font-size:10.5px; color:#94a3b8;">(${r.ownerName} • ${r.style} [${r.styleRank}] • ${r.finishTime})</span>
            <div style="font-size:9.5px; color:#facc15;">Skills nổ (${r.activatedSkills.length}): ${r.activatedSkills.join(', ') || 'Không có'}</div>
          </div>
        </div>
        <div style="font-size:13px;">${ptsText}</div>
      </div>
    `;
  }).join('');

  const myDelta = currentRacePacket.scoreDelta?.[sessionToken] || 0;
  const oppToken = Object.keys(currentRacePacket.scoreDelta || {}).find(t => t !== sessionToken);
  const oppDelta = oppToken ? currentRacePacket.scoreDelta[oppToken] : 0;

  const myTotal = currentRacePacket.totalScores?.[sessionToken] || 0;
  const oppTotal = oppToken ? (currentRacePacket.totalScores?.[oppToken] || 0) : 0;

  let statusHeader = `TỔNG ĐIỂM HIỆN TẠI: <b style="color:#38bdf8;">BẠN ${myTotal} PTS (+${myDelta})</b>  vs  <b style="color:#f43f5e;">ĐỐI THỦ ${oppTotal} PTS (+${oppDelta})</b>`;
  if (currentRacePacket.matchWinner) {
    statusHeader += `<br><span style="color:#facc15; font-size:16px;">CHUNG CUỘC: ${currentRacePacket.matchWinner.toUpperCase()} GIÀNH CHIẾN THẮNG!</span>`;
    nextBtn.innerText = 'Kết Thúc Trận Đấu (Về Sảnh Chính)';
  } else {
    nextBtn.innerText = currentRacePacket.nextStepLabel || 'Xác Nhận Kết Quả & Tiếp Tục (0/2)';
  }

  scoreSummaryEl.innerHTML = statusHeader;
  panel.style.display = 'block';

  nextBtn.onclick = () => {
    if (currentRacePacket.matchWinner) {
      localStorage.removeItem('twinkle_current_room');
      location.reload();
      return;
    }
    nextBtn.disabled = true;
    nextBtn.style.background = '#64748b';
    nextBtn.innerText = 'Đang chờ đối thủ xác nhận...';
    socket.emit('confirm_race_Watched', { roomCode: currentRoomCode, sessionToken });
  };
}