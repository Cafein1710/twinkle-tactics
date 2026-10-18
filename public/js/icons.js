// public/js/icons.js - Quản lý Icon Chỉ số, Icon Mood chuẩn Uma Musume & Tiện ích UI

const STAT_ICON_META = {
  Speed: {
    cdn: 'https://gametora.com/images/umamusume/icons/utx_ico_obtain_00.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0284c7"/><path d="M6 21h20l-2-5-5-1-3-5-3 2 1 4-6 1z" fill="#fff"/></svg>`
  },
  Stamina: {
    cdn: 'https://gametora.com/images/umamusume/icons/utx_ico_obtain_01.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#e11d48"/><path d="M16 25s-9-5.6-9-11.5A5.2 5.2 0 0 1 16 9a5.2 5.2 0 0 1 9 4.5C25 19.4 16 25 16 25z" fill="#fff"/></svg>`
  },
  Power: {
    cdn: 'https://gametora.com/images/umamusume/icons/utx_ico_obtain_02.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#ea580c"/><path d="M9 19c0-4 3-6 6-6h2l2-5 4 2-2 6a6 6 0 0 1-6 8H11a2 2 0 0 1-2-5z" fill="#fff"/></svg>`
  },
  Guts: {
    cdn: 'https://gametora.com/images/umamusume/icons/utx_ico_obtain_03.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#db2777"/><path d="M16 5c3 5 7 7 7 13a7 7 0 0 1-14 0c0-4 2-7 4-9 0 3 2 4 3-4z" fill="#fff"/></svg>`
  },
  Wit: {
    cdn: 'https://gametora.com/images/umamusume/icons/utx_ico_obtain_04.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#16a34a"/><path d="M16 7L4 13l12 6 10-5v7h2v-8L16 7zm-6 11v4c0 2 3 3 6 3s6-1 6-3v-4l-6 3-6-3z" fill="#fff"/></svg>`
  }
};

// BỘ 5 ICON MOOD (MOTIVATION) CHUẨN UMA MUSUME
const MOOD_ICON_META = {
  Great: {
    label: 'GREAT',
    cdn: 'https://gametora.com/images/umamusume/icons/utx_ico_motivation_04.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#ec4899" stroke="#fff" stroke-width="2"/><path d="M16 6l8 9h-5v11h-6V15H8z" fill="#fff"/></svg>`
  },
  Good: {
    label: 'GOOD',
    cdn: 'https://gametora.com/images/umamusume/icons/utx_ico_motivation_03.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#f97316" stroke="#fff" stroke-width="2"/><path d="M22 9l-2 11-3-3-6 6-3-3 6-6-3-3z" fill="#fff"/></svg>`
  },
  Normal: {
    label: 'NORMAL',
    cdn: 'https://gametora.com/images/umamusume/icons/utx_ico_motivation_02.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#eab308" stroke="#fff" stroke-width="2"/><path d="M25 16l-7-6v4H7v4h11v4z" fill="#0f172a"/></svg>`
  },
  Bad: {
    label: 'BAD',
    cdn: 'https://gametora.com/images/umamusume/icons/utx_ico_motivation_01.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#3b82f6" stroke="#fff" stroke-width="2"/><path d="M22 23l-11-2 3-3-6-6 3-3 6 6 3-3z" fill="#fff"/></svg>`
  },
  Awful: {
    label: 'AWFUL',
    cdn: 'https://gametora.com/images/umamusume/icons/utx_ico_motivation_00.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#9333ea" stroke="#fff" stroke-width="2"/><path d="M16 26l-8-9h5V6h6v11h5z" fill="#fff"/></svg>`
  }
};

function getStatFallbackUri(type) {
  const meta = STAT_ICON_META[type] || STAT_ICON_META.Speed;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(meta.svg);
}

function renderStatIconHTML(type, size = 20, extraClass = 'uma-stat-icon') {
  const meta = STAT_ICON_META[type];
  if (!meta) return '';
  const fallback = getStatFallbackUri(type);
  return `<img class="${extraClass}" style="width:${size}px; height:${size}px;" src="${meta.cdn}" title="${type}" onerror="this.src='${fallback}'">`;
}

// Render Huy hiệu Mood kèm Icon chuẩn Uma Musume
function renderMoodBadgeHTML(mood = 'Normal') {
  const meta = MOOD_ICON_META[mood] || MOOD_ICON_META.Normal;
  const fallback = 'data:image/svg+xml;utf8,' + encodeURIComponent(meta.svg);
  return `
    <span class="uma-mood-pill mood-${mood}" title="Mood: ${mood}">
      <img class="uma-mood-icon" src="${meta.cdn}" onerror="this.src='${fallback}'">
      <span>${meta.label}</span>
    </span>
  `;
}

function fallbackAvatar(name, color = '#3b82f6') {
  const initials = (name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">
    <rect width="100%" height="100%" fill="${color}"/>
    <text x="50%" y="55%" font-size="28" fill="#fff" font-family="sans-serif" font-weight="bold" text-anchor="middle" dominant-baseline="middle">${initials}</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

// Hàm Copy Room Code vào Clipboard
function copyRoomCodeToClipboard(codeStr, btnEl) {
  const code = (codeStr || '').trim();
  if (!code || code === '------') return;

  navigator.clipboard.writeText(code).then(() => {
    if (btnEl) {
      const oldText = btnEl.innerText;
      btnEl.innerText = 'Đã Copy!';
      btnEl.style.borderColor = '#4ade80';
      btnEl.style.color = '#4ade80';
      setTimeout(() => {
        btnEl.innerText = oldText;
        btnEl.style.borderColor = '';
        btnEl.style.color = '';
      }, 1600);
    }
    if (typeof showToast === 'function') {
      showToast(`Đã sao chép mã phòng: ${code}`);
    }
  });
}