// public/js/events.js - Xử lý Global Event & Render Inline SVG cho Item (Hỗ trợ kéo thả chính xác vào từng Uma)

let activeGlobalEventId = null;

function renderItemInlineSvg(itemId) {
  const svgs = {
    royal_juice: `
      <svg class="inv-item-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">
        <rect width="36" height="36" rx="8" fill="#064e3b" stroke="#10b981" stroke-width="1.5"/>
        <rect x="14" y="4" width="8" height="4" rx="1" fill="#facc15"/>
        <path d="M13 8h10l2 5v16a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V13l2-5z" fill="#22c55e"/>
        <rect x="11" y="16" width="14" height="8" fill="#fef08a"/>
        <path d="M18 17l1.5 3h3l-2.4 1.8.9 2.9-3-2-3 2 .9-2.9-2.4-1.8h3z" fill="#15803d"/>
      </svg>`,
    sweet_parfait: `
      <svg class="inv-item-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">
        <rect width="36" height="36" rx="8" fill="#500724" stroke="#f472b6" stroke-width="1.5"/>
        <path d="M10 16h16l-3.5 12h-9z" fill="#fce7f3"/>
        <path d="M11.5 20h13l-1.2 4h-10.6z" fill="#f472b6"/>
        <circle cx="14" cy="13" r="4" fill="#fff"/>
        <circle cx="22" cy="13" r="4" fill="#fbcfe8"/>
        <circle cx="18" cy="9" r="3.8" fill="#ef4444"/>
        <rect x="13" y="28" width="10" height="3" rx="1.5" fill="#f9a8d4"/>
      </svg>`,
    carrot_bbq: `
      <svg class="inv-item-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">
        <rect width="36" height="36" rx="8" fill="#431407" stroke="#fb923c" stroke-width="1.5"/>
        <line x1="7" y1="29" x2="29" y2="7" stroke="#e2e8f0" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M23 7l6 6-10 4-4-4z" fill="#f97316"/>
        <circle cx="14" cy="22" r="4.5" fill="#b45309" stroke="#fde047" stroke-width="1"/>
        <path d="M27 5l3-2M29 7l2-3" stroke="#4ade80" stroke-width="2" stroke-linecap="round"/>
      </svg>`,
    stat_notepad: `
      <svg class="inv-item-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">
        <rect width="36" height="36" rx="8" fill="#0c4a6e" stroke="#38bdf8" stroke-width="1.5"/>
        <rect x="9" y="6" width="18" height="24" rx="2.5" fill="#e0f2fe"/>
        <rect x="9" y="6" width="4" height="24" rx="1" fill="#0284c7"/>
        <rect x="15" y="11" width="9" height="2.2" rx="1" fill="#0369a1"/>
        <rect x="15" y="16" width="9" height="2.2" rx="1" fill="#0369a1"/>
        <rect x="15" y="21" width="6" height="2.2" rx="1" fill="#0369a1"/>
      </svg>`,
    goddess_statue: `
      <svg class="inv-item-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">
        <rect width="36" height="36" rx="8" fill="#422006" stroke="#facc15" stroke-width="1.5"/>
        <circle cx="18" cy="10" r="3.5" fill="#fef08a"/>
        <path d="M12 26l3-11h6l3 11H12z" fill="#eab308"/>
        <path d="M9 15l5 3v5l-5-4V15zm18 0l-5 3v5l5-4V15z" fill="#fef08a"/>
        <rect x="9" y="26" width="18" height="4" rx="1.5" fill="#ca8a04"/>
      </svg>`,
    megaphone: `
      <svg class="inv-item-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">
        <rect width="36" height="36" rx="8" fill="#3b0764" stroke="#c084fc" stroke-width="1.5"/>
        <path d="M7 15h6l11-6v18l-11-6H7v-6z" fill="#e879f9"/>
        <rect x="9" y="21" width="3.5" height="6" rx="1" fill="#f3e8ff"/>
        <path d="M27 13a6 6 0 0 1 0 10" fill="none" stroke="#fef08a" stroke-width="2.2" stroke-linecap="round"/>
      </svg>`
  };
  return svgs[itemId] || svgs.stat_notepad;
}

function renderInventoryBag(inventory, megaphoneActive) {
  const container = document.getElementById('ui-inventory-slots');
  const countEl = document.getElementById('ui-inventory-count');
  const buffBadge = document.getElementById('ui-megaphone-active');
  if (!container) return;

  const items = inventory || [];
  if (countEl) countEl.innerText = `${items.length}/3`;
  if (buffBadge) buffBadge.style.display = megaphoneActive ? 'inline-block' : 'none';

  container.innerHTML = '';

  for (let i = 0; i < 3; i++) {
    const item = items[i];
    const slot = document.createElement('div');

    if (!item) {
      slot.className = 'inv-slot empty';
      slot.innerHTML = `<span style="font-size:10px; color:#475569;">Trống</span>`;
    } else {
      const itemId = item.id || item.itemId || 'stat_notepad';
      const isSingleUmaItem = item.targetType === 'single_uma' || (itemId !== 'megaphone' && item.targetType !== 'team' && item.targetType !== 'global');

      slot.className = 'inv-slot filled';
      slot.style.borderColor = item.color || '#facc15';
      slot.title = `${item.name}: ${item.desc}\n(${isSingleUmaItem ? 'Kéo thả vào 1 Uma để dùng' : 'Click hoặc kéo thả để kích hoạt ngay'})`;

      // Luôn cho phép kéo thả mọi Item
      slot.draggable = true;
      slot.ondragstart = (e) => {
        draggedPayload = { kind: 'item', itemUid: item.uid };
        e.dataTransfer.setData('text/plain', item.uid);
      };

      // Với Item đơn mục tiêu: Nếu người chơi lỡ click chuột trái thì nhắc kéo thả vào Uma, KHÔNG tự ý dùng vào Uma 0
      slot.onclick = () => {
        if (isSingleUmaItem) {
          if (typeof showToast === 'function') {
            showToast(`Hãy KÉO THẢ [${item.name}] vào Uma bạn muốn sử dụng!`);
          }
        } else {
          socket.emit('use_inventory_item', {
            roomCode: currentRoomCode,
            sessionToken,
            itemUid: item.uid,
            umaIndex: 0
          });
        }
      };

      slot.innerHTML = `
        ${renderItemInlineSvg(itemId)}
        <div class="inv-item-info" style="width:100%;">
          <div class="inv-item-name">${item.name}</div>
          <span class="inv-item-badge" style="background:${item.color};">${item.badge}</span>
        </div>
      `;
    }
    container.appendChild(slot);
  }
}

function triggerGlobalEventModal(eventObj) {
  if (!eventObj) return;
  const eventKey = `${eventObj.id}_${latestGameState?.year}_${latestGameState?.turn}`;
  if (activeGlobalEventId === eventKey) return;
  activeGlobalEventId = eventKey;

  const overlay = document.getElementById('global-event-overlay');
  const stage = document.getElementById('ge-stage-box');
  const cardImg = document.getElementById('ge-pal-card-img');
  const charTag = document.getElementById('ge-char-tag');
  const titleEl = document.getElementById('ge-event-title');
  const loreEl = document.getElementById('ge-event-lore');
  const choicesEl = document.getElementById('ge-choices-container');
  if (!overlay || !stage) return;

  stage.classList.remove('slid-up');
  if (cardImg) {
    cardImg.src = eventObj.cardArt || eventObj.cardImg || '';
    cardImg.onerror = () => {
      if (eventObj.fallbackArt) cardImg.src = eventObj.fallbackArt;
    };
  }

  if (charTag) {
    charTag.innerText = eventObj.character
      ? `${eventObj.character} —${eventObj.cardTitle || 'SSR Pal'}`
      : (eventObj.charName || 'Global Support Event');
  }
  if (titleEl) titleEl.innerText = eventObj.eventTitle || eventObj.title || 'Sự Kiện Học Viện';
  if (loreEl) loreEl.innerText = eventObj.loreText || eventObj.lore || '';

  if (choicesEl) {
    choicesEl.innerHTML = '';
    (eventObj.choices || []).forEach(ch => {
      const btn = document.createElement('div');
      btn.className = `ge-choice-bar tone-${ch.tone || 'blue'}`;
      btn.innerHTML = `
        <div class="ge-choice-title">${ch.title || ch.label || ''}</div>
        <div class="ge-choice-preview">${ch.preview || ch.effectText || ''}</div>
      `;
      btn.onclick = () => {
        overlay.style.display = 'none';
        socket.emit('select_global_event_choice', {
          roomCode: currentRoomCode,
          sessionToken,
          choiceId: ch.id
        });
      };
      choicesEl.appendChild(btn);
    });
  }

  overlay.style.display = 'flex';

  setTimeout(() => {
    stage.classList.add('slid-up');
  }, 1150);
}