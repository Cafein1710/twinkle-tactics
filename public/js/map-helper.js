// public/js/map-helper.js - Render bản đồ kỹ thuật chuẩn GameTora (Hiển thị mốc mét từng đoạn, 24 Sections & Mùa giải)

function openMapBlueprintModal(mapObj) {
  if (!mapObj) return;
  const modal = document.getElementById('map-zoom-modal');
  if (!modal) return;

  if (!document.getElementById('mh-title') || !document.getElementById('mh-elevation-container')) {
    modal.innerHTML = `
      <div class="mh-card-box" onclick="event.stopPropagation()" style="width:820px; max-width:96vw; background:#0f172a; border:1px solid #334155; border-radius:14px; padding:20px 24px; box-shadow:0 20px 50px rgba(0,0,0,0.85); color:#f8fafc; position:relative;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
          <div>
            <div style="font-size:10px; font-weight:bold; color:#64748b; letter-spacing:1px;">MAP HELPER</div>
            <div id="mh-title" style="font-size:22px; font-weight:800; color:#fff; margin-top:2px;"></div>
            <div id="mh-subtitle" style="font-size:12px; color:#94a3b8; margin-top:2px;"></div>
          </div>
          <div id="mh-top-badges" style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;"></div>
        </div>

        <div style="background:#090d16; border:1px solid #1e293b; border-radius:10px; overflow:hidden;">
          <div id="mh-elevation-container" style="height:115px; width:100%; position:relative; background:#090d16;"></div>
          <div id="mh-slope-row" style="height:36px; width:100%; position:relative; background:#1e1035; border-top:1px solid #334155;"></div>
          <div id="mh-segment-row" style="height:38px; width:100%; position:relative; background:#1e293b; border-top:1px solid #334155;"></div>
          <div id="mh-leg-row" style="height:34px; width:100%; position:relative; border-top:1px solid #0f172a;"></div>
          <div id="mh-ruler-row" style="height:32px; width:100%; position:relative; background:#cbd5e1; border-top:2px solid #475569;"></div>
        </div>

        <div id="mh-bottom-badges" style="display:flex; justify-content:center; gap:8px; flex-wrap:wrap; margin-top:14px;"></div>
      </div>
    `;
    modal.onclick = () => { modal.style.display = 'none'; };
  }

  const D = Number(mapObj.length) || 2000;
  const season = mapObj.season || 'Spring';
  const seasonColors = {
    Spring: { bg: '#f472b622', border: '#f472b6', text: '#fbcfe8', label: 'SPRING' },
    Summer: { bg: '#38bdf822', border: '#38bdf8', text: '#bae6fd', label: 'SUMMER' },
    Fall:   { bg: '#fb923c22', border: '#fb923c', text: '#fed7aa', label: 'FALL' },
    Winter: { bg: '#94a3b822', border: '#cbd5e1', text: '#f1f5f9', label: 'WINTER' }
  }[season] || { bg: '#f472b622', border: '#f472b6', text: '#fbcfe8', label: season.toUpperCase() };

  const tCode = Number(mapObj.turnCode) || 1;
  const turnText = mapObj.turn || (tCode === 2 ? 'Left' : (tCode === 4 ? 'Straight' : 'Right'));
  const dirLabel = turnText === 'Left' ? 'counterclockwise' : (turnText === 'Straight' ? 'straight' : 'clockwise');
  const courseTag = mapObj.courseTag || mapObj.courseVariant || '';

  document.getElementById('mh-title').innerText = mapObj.name;
  document.getElementById('mh-subtitle').innerText =
    `${mapObj.trackName || mapObj.name.split(' ')[0]} ${mapObj.surface} ${D}m ${courseTag && courseTag !== 'Main' ? `(${courseTag.toLowerCase()}) ` : ''}(${dirLabel}) — ${mapObj.famousRace || 'Championship Track'}`;

  const surfBadgeClass = mapObj.surface === 'Turf' ? 'mh-pill-green' : 'mh-pill-amber';
  const turnArrow = turnText === 'Left' ? '← LEFT' : (turnText === 'Straight' ? '↑ STRAIGHT' : '→ RIGHT');

  document.getElementById('mh-top-badges').innerHTML = `
    <span class="mh-pill ${surfBadgeClass}">${mapObj.surface.toUpperCase()}</span>
    <span class="mh-pill mh-pill-blue">${turnArrow}</span>
    ${courseTag && courseTag !== 'Main'
      ? `<span class="mh-pill mh-pill-purple">${courseTag.toUpperCase()}</span>`
      : ''}
    <span class="mh-pill" style="background:${seasonColors.bg}; border:1px solid ${seasonColors.border}; color:${seasonColors.text}; padding:3px 9px; border-radius:6px; font-weight:bold; font-size:11px;">
      ${seasonColors.label}
    </span>
  `;

  // Chuẩn hóa dữ liệu dốc (slopes)
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
      grad: Math.max(0.3, rawGrad || 1.2)
    };
  }).sort((a, b) => a.start - b.start);

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

  const minH = Math.min(...coords.map(c => c.h), 0);
  const maxH = Math.max(...coords.map(c => c.h), 2.5);
  const hSpan = Math.max(3.5, maxH - minH);

  const svgW = 1000;
  const svgH = 115;
  const baseLineY = svgH - 12;
  const toSvgX = x => ((x / D) * svgW).toFixed(1);
  const toSvgY = h => (baseLineY - 22 - ((h - minH) / hSpan) * (svgH - 46)).toFixed(1);

  let polyPoints = `0,${baseLineY} `;
  coords.forEach(pt => {
    polyPoints += `${toSvgX(pt.x)},${toSvgY(pt.h)} `;
  });
  polyPoints += `${svgW},${baseLineY}`;

  let verticalLinesSvg = '';
  slopes.forEach(s => {
    const x1 = ((s.start / D) * svgW).toFixed(1);
    const x2 = ((s.end / D) * svgW).toFixed(1);
    verticalLinesSvg += `<line x1="${x1}" y1="0" x2="${x1}" y2="${baseLineY}" stroke="#334155" stroke-width="1" stroke-dasharray="2,2" opacity="0.75" />`;
    verticalLinesSvg += `<line x1="${x2}" y1="0" x2="${x2}" y2="${baseLineY}" stroke="#334155" stroke-width="1" stroke-dasharray="2,2" opacity="0.75" />`;
  });

  elevContainer.innerHTML = `
    <svg viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none" style="width:100%; height:100%; display:block;">
      <polygon points="${polyPoints}" fill="#a3e635" opacity="0.92" />
      ${verticalLinesSvg}
      <rect x="0" y="${baseLineY}" width="${svgW}" height="12" fill="#65a30d" />
      <line x1="${svgW - 2}" y1="4" x2="${svgW - 2}" y2="${svgH}" stroke="#facc15" stroke-width="3" />
      <text x="${svgW - 8}" y="15" fill="#fef08a" font-size="11" font-weight="bold" text-anchor="end">Finish</text>
    </svg>
  `;

  // Hàm phụ trợ tạo nhãn mốc mét nhỏ gọn ngay tại vạch chia giống GameTora
  const makeBoundaryLabel = (meterVal, leftPct) => {
    if (meterVal <= 0 || meterVal >= D) return '';
    return `
      <div style="position:absolute; left:${leftPct}%; bottom:2px; transform:translateX(-50%); z-index:5; background:rgba(15,23,42,0.88); color:#f8fafc; font-size:9px; font-weight:700; padding:0px 3px; border-radius:3px; border:1px solid #475569; pointer-events:none; white-space:nowrap;">
        ${meterVal}m
      </div>
    `;
  };

  // 2. Dải Dốc (Uphill / Downhill) kèm mốc mét
  const slopeRow = document.getElementById('mh-slope-row');
  slopeRow.style.height = '36px';
  slopeRow.innerHTML = `<div style="position:absolute; left:0; right:0; bottom:0; height:4px; background:#a855f7;"></div>`;
  const slopeMarks = new Set();

  slopes.forEach(s => {
    const leftPct = (s.start / D) * 100;
    const widthPct = ((s.end - s.start) / D) * 100;
    const bgCol = s.isUp ? '#d97706' : '#0d9488';
    const bottomBarCol = s.isUp ? '#b45309' : '#0f766e';

    const block = document.createElement('div');
    block.style.cssText = `position:absolute; left:${leftPct}%; width:${widthPct}%; top:0; bottom:0; background:${bgCol}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold; border-left:1px solid #0f172a; border-right:1px solid #0f172a; box-sizing:border-box;`;
    block.title = `${s.isUp ? 'Uphill (Dốc lên)' : 'Downhill (Dốc xuống)'}: ${s.start}m - ${s.end}m`;
    block.innerHTML = `
      <span style="margin-bottom:4px;">${s.isUp ? '↗' : '↘'}</span>
      <div style="position:absolute; left:0; right:0; bottom:0; height:4px; background:${bottomBarCol};"></div>
    `;
    slopeRow.appendChild(block);

    slopeMarks.add(s.start);
    slopeMarks.add(s.end);
  });

  slopeMarks.forEach(mVal => {
    slopeRow.insertAdjacentHTML('beforeend', makeBoundaryLabel(mVal, (mVal / D) * 100));
  });

  // 3. Dải Đoạn thẳng (Straight) và Khúc cua (Corner) kèm mốc mét
  const segRow = document.getElementById('mh-segment-row');
  segRow.style.height = '38px';
  segRow.innerHTML = '';
  const segMarks = new Set();

  (mapObj.straights || []).forEach(st => {
    const startM = Number(st.start) || 0;
    const endM = Number(st.end) || 0;
    const leftPct = (startM / D) * 100;
    const widthPct = ((endM - startM) / D) * 100;

    const block = document.createElement('div');
    block.style.cssText = `position:absolute; left:${leftPct}%; width:${widthPct}%; top:0; bottom:0; background:#0c4a6e; color:#e0f2fe; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold; border-left:1px solid #0f172a; border-right:1px solid #0f172a; box-sizing:border-box; overflow:hidden;`;
    block.title = `Straight: ${startM}m - ${endM}m`;
    block.innerHTML = `
      <span style="margin-bottom:5px;">${widthPct > 11 ? 'Straight →' : '→'}</span>
      <div style="position:absolute; left:0; right:0; bottom:0; height:4px; background:#0284c7;"></div>
    `;
    segRow.appendChild(block);
    segMarks.add(startM);
    segMarks.add(endM);
  });

  (mapObj.corners || []).forEach((c, idx) => {
    const startM = Number(c.start) || 0;
    const endM = Number(c.end) || 0;
    const leftPct = (startM / D) * 100;
    const widthPct = ((endM - startM) / D) * 100;
    const cornerLabel = c.name
      ? String(c.name).replace(/Corner\s*/i, '↺')
      : `↺${c.cornerNumber || c.corner || (idx + 1)}`;

    const block = document.createElement('div');
    block.style.cssText = `position:absolute; left:${leftPct}%; width:${widthPct}%; top:0; bottom:0; background:#78350f; color:#fef08a; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold; border-left:1px solid #0f172a; border-right:1px solid #0f172a; box-sizing:border-box; overflow:hidden;`;
    block.title = `Corner ${cornerLabel}: ${startM}m - ${endM}m`;
    block.innerHTML = `
      <span style="margin-bottom:5px;">${cornerLabel}</span>
      <div style="position:absolute; left:0; right:0; bottom:0; height:4px; background:#ea580c;"></div>
    `;
    segRow.appendChild(block);
    segMarks.add(startM);
    segMarks.add(endM);
  });

  segMarks.forEach(mVal => {
    segRow.insertAdjacentHTML('beforeend', makeBoundaryLabel(mVal, (mVal / D) * 100));
  });

  // 4. Dải 4 Giai đoạn đường đua (Opening / Middle / Final / Last Spurt) kèm mốc mét
  const legRow = document.getElementById('mh-leg-row');
  legRow.style.height = '34px';
  const openEnd = mapObj.phases?.openingEnd || Math.round(D / 6);
  const midEnd = mapObj.phases?.middleEnd || Math.round((D * 2) / 3);
  const finalEnd = mapObj.phases?.finalEnd || Math.round((D * 5) / 6);

  legRow.innerHTML = `
    <div style="position:absolute; left:0%; width:16.67%; top:0; bottom:0; background:#059669; color:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold; border-right:1px solid #064e3b;">Opening Leg</div>
    <div style="position:absolute; left:16.67%; width:50%; top:0; bottom:0; background:#eab308; color:#1e293b; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold; border-right:1px solid #713f12;">Middle Leg</div>
    <div style="position:absolute; left:66.67%; width:16.67%; top:0; bottom:0; background:#db2777; color:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold; border-right:1px solid #831843;">Final Leg</div>
    <div style="position:absolute; left:83.34%; width:16.66%; top:0; bottom:0; background:#be185d; color:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold;">Last Spurt</div>
    ${makeBoundaryLabel(openEnd, 16.67)}
    ${makeBoundaryLabel(midEnd, 66.67)}
    ${makeBoundaryLabel(finalEnd, 83.34)}
  `;

  // 5. Thước đo 24 Đoạn (Sections 1 -> 24 chuẩn GameTora, định vị tuyệt đối không bị rớt dòng)
  const rulerRow = document.getElementById('mh-ruler-row');
  rulerRow.style.height = '30px';
  let rulerHtml = '';
  for (let sec = 1; sec <= 24; sec++) {
    const leftPct = ((sec - 1) / 24) * 100;
    const widthPct = 100 / 24;
    rulerHtml += `
      <div style="position:absolute; left:${leftPct}%; width:${widthPct}%; top:0; bottom:0; border-right:1px solid #94a3b8; display:flex; align-items:center; justify-content:center; color:#334155; font-size:10px; font-weight:700; box-sizing:border-box;">
        ${sec}
      </div>
    `;
  }
  rulerRow.innerHTML = rulerHtml;

  // 6. Các Tag tổng hợp phía dưới
  const isFinalCorner = (mapObj.corners || []).some(c => midEnd >= c.start && midEnd <= c.end);
  const finalLegType = isFinalCorner ? 'CORNER' : 'STRAIGHT';

  const threshText = (mapObj.thresholdStats && mapObj.thresholdStats.length > 0)
    ? `STAT BONUS: ${mapObj.thresholdStats.join(' & ').toUpperCase()}`
    : 'NO STAT THRESHOLD';

  document.getElementById('mh-bottom-badges').innerHTML = `
    <span class="mh-pill mh-pill-purple">${(mapObj.slot || 'RACE').toUpperCase()}</span>
    <span class="mh-pill" style="background:${seasonColors.bg}; border:1px solid ${seasonColors.border}; color:${seasonColors.text}; padding:3px 9px; border-radius:6px; font-weight:bold; font-size:11px;">
      SEASON: ${seasonColors.label}
    </span>
    <span class="mh-pill mh-pill-blue">TRACK: ${(mapObj.condition || 'FIRM').toUpperCase()}</span>
    <span class="mh-pill mh-pill-green">FINAL LEG (${midEnd}M): ${finalLegType}</span>
    <span class="mh-pill mh-pill-amber">${threshText}</span>
  `;

  modal.style.display = 'flex';
}