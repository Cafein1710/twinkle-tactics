// public/js/map-helper.js - Render bản đồ kỹ thuật Map Helper (Tương thích hoàn toàn với data/maps.json & Hiển thị Mùa giải)

function openMapBlueprintModal(mapObj) {
  if (!mapObj) return;
  const modal = document.getElementById('map-zoom-modal');
  if (!modal) return;

  // Đảm bảo cấu trúc DOM bên trong #map-zoom-modal luôn đầy đủ (tránh lỗi null innerText/innerHTML)
  if (!document.getElementById('mh-title') || !document.getElementById('mh-elevation-container')) {
    modal.innerHTML = `
      <div class="mh-card-box" onclick="event.stopPropagation()" style="width:760px; max-width:95vw; background:#0f172a; border:1px solid #334155; border-radius:14px; padding:20px 24px; box-shadow:0 20px 50px rgba(0,0,0,0.85); color:#f8fafc; position:relative;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
          <div>
            <div style="font-size:10px; font-weight:bold; color:#64748b; letter-spacing:1px;">MAP HELPER</div>
            <div id="mh-title" style="font-size:22px; font-weight:800; color:#fff; margin-top:2px;"></div>
            <div id="mh-subtitle" style="font-size:12px; color:#94a3b8; margin-top:2px;"></div>
          </div>
          <div id="mh-top-badges" style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;"></div>
        </div>

        <div style="background:#090d16; border:1px solid #1e293b; border-radius:10px; overflow:hidden; padding-bottom:8px;">
          <div id="mh-elevation-container" style="height:110px; width:100%; position:relative;"></div>
          <div id="mh-slope-row" style="height:22px; width:100%; position:relative; background:#1e1035; border-top:1px solid #1e293b;"></div>
          <div id="mh-segment-row" style="height:26px; width:100%; position:relative; background:#1e293b; border-top:1px solid #0f172a;"></div>
          <div id="mh-leg-row" style="height:26px; width:100%; position:relative; border-top:1px solid #0f172a;"></div>
          <div id="mh-ruler-row" style="height:28px; width:100%; position:relative; margin-top:4px;"></div>
        </div>

        <div id="mh-bottom-badges" style="display:flex; justify-content:center; gap:8px; flex-wrap:wrap; margin-top:14px;"></div>
      </div>
    `;
    modal.onclick = () => { modal.style.display = 'none'; };
  }

  const D = Number(mapObj.length) || 2000;
  const season = mapObj.season || 'Spring';
  const seasonColors = {
    Spring: { bg: '#f472b622', border: '#f472b6', text: '#fbcfe8', label: '🌸 SPRING' },
    Summer: { bg: '#38bdf822', border: '#38bdf8', text: '#bae6fd', label: '☀️ SUMMER' },
    Fall:   { bg: '#fb923c22', border: '#fb923c', text: '#fed7aa', label: '🍁 FALL' },
    Winter: { bg: '#94a3b822', border: '#cbd5e1', text: '#f1f5f9', label: '❄️ WINTER' }
  }[season] || { bg: '#f472b622', border: '#f472b6', text: '#fbcfe8', label: `SEASON: ${season.toUpperCase()}` };

  const tCode = Number(mapObj.turnCode) || 1;
  const turnText = mapObj.turn || (tCode === 2 ? 'Left' : (tCode === 4 ? 'Straight' : 'Right'));
  const courseTag = mapObj.courseTag || mapObj.courseVariant || '';

  document.getElementById('mh-title').innerText = mapObj.name;
  document.getElementById('mh-subtitle').innerText =
    `${mapObj.trackName || mapObj.name.split(' ')[0]} ${mapObj.surface} course - ${turnText} (${mapObj.famousRace || 'Championship Track'})`;

  const surfBadgeClass = mapObj.surface === 'Turf' ? 'mh-pill-green' : 'mh-pill-amber';
  const turnArrow = turnText === 'Left' ? '← LEFT' : (turnText === 'Straight' ? '↑ STRAIGHT' : '→ RIGHT');

  document.getElementById('mh-top-badges').innerHTML = `
    <span class="mh-pill ${surfBadgeClass}">${mapObj.surface.toUpperCase()}</span>
    <span class="mh-pill mh-pill-blue">${turnArrow}</span>
    ${courseTag && courseTag !== 'Main'
      ? `<span class="mh-pill mh-pill-purple">${courseTag.toUpperCase()}</span>`
      : ''}
    <span class="mh-pill" style="background:${seasonColors.bg}; border:1px solid ${seasonColors.border}; color:${seasonColors.text};">
      ${seasonColors.label}
    </span>
  `;

  // Chuẩn hóa dữ liệu dốc (slopes) từ data/maps.json (hỗ trợ cả s.slope và s.type/s.grad)
  const rawSlopes = mapObj.slopes || [];
  const slopes = rawSlopes.map(s => {
    const isUp = s.type ? (s.type === 'uphill') : (Number(s.slope) > 0);
    const rawGrad = s.grad !== undefined
      ? Math.abs(Number(s.grad))
      : (s.slope !== undefined ? Math.abs(Number(s.slope)) / 10000 : 1.4);
    return {
      start: Number(s.start) || 0,
      end: Number(s.end) || 0,
      isUp,
      grad: Math.max(0.4, rawGrad || 1.2)
    };
  });

  // 1. Vẽ SVG độ cao mặt cắt (Elevation Profile)
  const elevContainer = document.getElementById('mh-elevation-container');
  const keyPoints = new Set([0, D]);
  slopes.forEach(s => {
    keyPoints.add(Math.max(0, Math.min(D, s.start)));
    keyPoints.add(Math.max(0, Math.min(D, s.end)));
  });
  const sortedX = Array.from(keyPoints).sort((a, b) => a - b);

  let currentHeight = 0;
  const coords = sortedX.map((x, idx) => {
    if (idx > 0) {
      const prevX = sortedX[idx - 1];
      const midX = (prevX + x) / 2;
      const activeSlope = slopes.find(s => midX >= s.start && midX <= s.end);
      if (activeSlope) {
        const len = x - prevX;
        const deltaH = (len / 100) * activeSlope.grad;
        currentHeight += activeSlope.isUp ? deltaH : -deltaH;
      }
    }
    return { x, h: currentHeight };
  });

  const minH = Math.min(...coords.map(c => c.h), -1);
  const maxH = Math.max(...coords.map(c => c.h), 3.5);
  const hSpan = Math.max(4, maxH - minH);

  const svgW = 1000;
  const svgH = 110;
  const toSvgX = x => ((x / D) * svgW).toFixed(1);
  const toSvgY = h => (svgH - 18 - ((h - minH) / hSpan) * (svgH - 36)).toFixed(1);

  let polyPoints = `0,${svgH} `;
  coords.forEach(pt => {
    polyPoints += `${toSvgX(pt.x)},${toSvgY(pt.h)} `;
  });
  polyPoints += `${svgW},${svgH}`;

  let slopeZonesSvg = '';
  slopes.forEach(s => {
    const x1 = (s.start / D) * svgW;
    const x2 = (s.end / D) * svgW;
    const fillCol = s.isUp ? 'rgba(250, 204, 21, 0.28)' : 'rgba(56, 189, 248, 0.28)';
    slopeZonesSvg += `<rect x="${x1.toFixed(1)}" y="0" width="${Math.max(2, x2 - x1).toFixed(1)}" height="${svgH}" fill="${fillCol}" />`;
    slopeZonesSvg += `<line x1="${x1.toFixed(1)}" y1="0" x2="${x1.toFixed(1)}" y2="${svgH}" stroke="#0f172a" stroke-width="1.2" opacity="0.6" />`;
    slopeZonesSvg += `<line x1="${x2.toFixed(1)}" y1="0" x2="${x2.toFixed(1)}" y2="${svgH}" stroke="#0f172a" stroke-width="1.2" opacity="0.6" />`;
  });

  elevContainer.innerHTML = `
    <svg viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none" style="width:100%; height:100%; display:block;">
      <polygon points="${polyPoints}" fill="#84cc16" opacity="0.88" />
      ${slopeZonesSvg}
      <rect x="0" y="${svgH - 12}" width="${svgW}" height="12" fill="#65a30d" />
      <line x1="${svgW - 2}" y1="6" x2="${svgW - 2}" y2="${svgH}" stroke="#facc15" stroke-width="3" />
      <text x="${svgW - 8}" y="16" fill="#fef08a" font-size="11" font-weight="bold" text-anchor="end">Finish</text>
    </svg>
  `;

  // 2. Dải Dốc (Uphill / Downhill)
  const slopeRow = document.getElementById('mh-slope-row');
  slopeRow.innerHTML = '';
  slopes.forEach(s => {
    const leftPct = (s.start / D) * 100;
    const widthPct = ((s.end - s.start) / D) * 100;
    const block = document.createElement('div');
    block.className = 'mh-block';
    block.style.left = `${leftPct}%`;
    block.style.width = `${widthPct}%`;
    block.style.background = s.isUp ? '#d97706' : '#0284c7';
    block.style.color = '#fff';
    block.title = `${s.isUp ? 'Dốc lên (Uphill)' : 'Dốc xuống (Downhill)'}: ${s.start}m - ${s.end}m`;
    block.innerText = s.isUp ? '↗' : '↘';
    slopeRow.appendChild(block);
  });

  // 3. Dải Đoạn thẳng (Straight) và Khúc cua (Corner)
  const segRow = document.getElementById('mh-segment-row');
  segRow.innerHTML = '';
  (mapObj.straights || []).forEach(st => {
    const block = document.createElement('div');
    block.className = 'mh-block';
    block.style.left = `${(st.start / D) * 100}%`;
    block.style.width = `${((st.end - st.start) / D) * 100}%`;
    block.style.background = '#0c4a6e';
    block.style.color = '#bae6fd';
    block.innerText = 'Straight →';
    segRow.appendChild(block);
  });
  (mapObj.corners || []).forEach((c, idx) => {
    const block = document.createElement('div');
    block.className = 'mh-block';
    block.style.left = `${(c.start / D) * 100}%`;
    block.style.width = `${((c.end - c.start) / D) * 100}%`;
    block.style.background = '#78350f';
    block.style.color = '#fde68a';
    const cornerLabel = c.name
      ? String(c.name).replace(/Corner\s*/i, '↺')
      : `↺${c.cornerNumber || c.corner || (idx + 1)}`;
    block.innerText = cornerLabel;
    segRow.appendChild(block);
  });

  // 4. Dải 4 Giai đoạn đường đua
  const legRow = document.getElementById('mh-leg-row');
  const midEnd = Math.round((D * 2) / 3);

  legRow.innerHTML = `
    <div class="mh-block" style="left:0%; width:16.67%; background:#10b981; color:#064e3b;">Opening leg</div>
    <div class="mh-block" style="left:16.67%; width:50%; background:#eab308; color:#422006;">Middle leg</div>
    <div class="mh-block" style="left:66.67%; width:16.67%; background:#ec4899; color:#fff;">Final leg</div>
    <div class="mh-block" style="left:83.34%; width:16.66%; background:#be185d; color:#fff;">Last spurt</div>
  `;

  // 5. Thước đo cự ly (Ruler)
  const rulerRow = document.getElementById('mh-ruler-row');
  rulerRow.innerHTML = '';
  const step = D <= 1400 ? 200 : 500;
  for (let m = 0; m <= D; m += step) {
    if (D - m < 120 && m !== D) continue;
    const pct = (m / D) * 100;
    rulerRow.innerHTML += `
      <div class="mh-ruler-tick" style="left:${pct}%;"></div>
      <div class="mh-ruler-label" style="left:${pct}%;">${m}m</div>
    `;
  }
  if (D % step !== 0) {
    rulerRow.innerHTML += `
      <div class="mh-ruler-tick" style="left:100%;"></div>
      <div class="mh-ruler-label" style="left:98%;">${D}m</div>
    `;
  }

  // 6. Các Tag tổng hợp phía dưới (Hiển thị rõ MÙA GIẢI, Tình trạng sân, Vị trí Final Leg & Stat Threshold)
  const finalLegType = mapObj.lateStartSegment
    ? String(mapObj.lateStartSegment).toUpperCase()
    : ((mapObj.corners || []).some(c => midEnd >= c.start && midEnd <= c.end) ? 'CORNER' : 'STRAIGHT');

  const threshText = (mapObj.thresholdStats && mapObj.thresholdStats.length > 0)
    ? `STAT BONUS: ${mapObj.thresholdStats.join(' & ').toUpperCase()}`
    : 'NO STAT THRESHOLD';

  document.getElementById('mh-bottom-badges').innerHTML = `
    <span class="mh-pill mh-pill-purple">${(mapObj.slot || 'RACE').toUpperCase()}</span>
    <span class="mh-pill" style="background:${seasonColors.bg}; border:1px solid ${seasonColors.border}; color:${seasonColors.text};">
      ${seasonColors.label}
    </span>
    <span class="mh-pill mh-pill-blue">TRACK: ${(mapObj.condition || 'FIRM').toUpperCase()}</span>
    <span class="mh-pill mh-pill-green">FINAL LEG (${midEnd}M): ${finalLegType}</span>
    <span class="mh-pill mh-pill-amber">${threshText}</span>
  `;

  modal.style.display = 'flex';
}