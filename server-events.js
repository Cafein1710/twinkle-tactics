// server-events.js - Module quản lý Global Events (Đã cố định chuẩn ID 30052 cho Light Hello & 30080 cho Sasami)

const ITEMS_DB = {
  royal_juice: {
    id: 'royal_juice',
    name: 'Royal Bitter Juice',
    targetType: 'single_uma',
    badge: '0% FAIL',
    color: '#22c55e',
    desc: 'Đặc sản đắng nghét của Tracen: Đưa tỉ lệ Fail của 1 Uma về 0% ngay lập tức (Không tốn lượt).'
  },
  sweet_parfait: {
    id: 'sweet_parfait',
    name: 'Sweet Berry Parfait',
    targetType: 'single_uma',
    badge: '+2 MOOD',
    color: '#ec4899',
    desc: 'Ly kem trái cây thượng hạng: Tăng 2 bậc Mood cho 1 Uma chỉ định.'
  },
  carrot_bbq: {
    id: 'carrot_bbq',
    name: 'Carrot BBQ Set',
    targetType: 'all_umas',
    badge: 'TEAM MOOD',
    color: '#f97316',
    desc: 'Tiệc thịt nướng cà rốt: Tăng +1 bậc Mood và giảm 10% Fail cho toàn bộ 3 Uma.'
  },
  stat_notepad: {
    id: 'stat_notepad',
    name: 'Secret Training Notepad',
    targetType: 'single_uma',
    badge: '+25 ALL',
    color: '#38bdf8',
    desc: 'Sổ tay bí kíp huấn luyện: Cộng +25 vào cả 5 chỉ số (SPD/STA/POW/GUT/WIT) cho 1 Uma.'
  },
  goddess_statue: {
    id: 'goddess_statue',
    name: 'Mini Goddess Statue',
    targetType: 'single_uma',
    badge: 'AWAKEN',
    color: '#eab308',
    desc: 'Tượng Ba Nữ Thần thu nhỏ: Nâng cấp miễn phí 1 kỹ năng Trắng đang gắn trên Uma lên Gold Skill!'
  },
  megaphone: {
    id: 'megaphone',
    name: 'Coaching Megaphone',
    targetType: 'global_buff',
    badge: 'x1.5 TRAIN',
    color: '#a855f7',
    desc: 'Loa phóng thanh huấn luyện: Tăng thêm +50% lượng chỉ số nhận được ở lần Train tiếp theo trong lượt này.'
  }
};

// DANH SÁCH GLOBAL EVENTS VỚI MÃ ID THẺ PAL & GROUP CỐ ĐỊNH CHÍNH XÁC 100%
const GLOBAL_EVENTS_POOL = [
  {
    id: 'ev_tazuna',
    character: 'Tazuna Hayakawa',
    cardTitle: '[Welcome to Tracen Academy!] (SSR Pal)',
    cardArt: 'https://gametora.com/images/umamusume/supports/tex_support_card_30021.png',
    fallbackArt: 'https://gametora.com/images/umamusume/supports/tex_support_card_30021.png',
    eventTitle: 'Buổi Kiểm Tra Định Kỳ Của Thư Ký Tazuna',
    loreText: 'Thư ký Tazuna xuất hiện trên đường piste để theo dõi tiến độ huấn luyện của đội bạn. Cô ấy mỉm cười đưa ra các phương án hỗ trợ y tế hoặc rèn luyện tốc độ nước rút.',
    choices: [
      {
        id: 'safe',
        tone: 'green',
        title: '1. Nhờ Tazuna tư vấn lịch trình chăm sóc sức khỏe',
        preview: 'An toàn: Nhận 1 [Sweet Berry Parfait] (+2 Mood) và 1 [Royal Bitter Juice] (0% Fail) vào Hành trang.'
      },
      {
        id: 'tactical',
        tone: 'yellow',
        title: '2. Cùng Tazuna rà soát lại giáo án chiến thuật',
        preview: 'Chiến thuật: Rút thêm 2 lá bài từ Deck và tăng +1 bậc Mood cho 1 Uma ngẫu nhiên.'
      },
      {
        id: 'gamble',
        tone: 'red',
        title: '3. Tập bài bứt tốc cường độ cao theo hướng dẫn của Tazuna (Tỉ lệ 55/45)',
        preview: 'Thành công (55%): Cả 3 Uma nhận +35 Speed & +35 Wit | Thất bại (45%): Cả đội mất sức (+15% Fail).'
      }
    ]
  },
  {
    id: 'ev_riko',
    character: 'Riko Kashimoto',
    cardTitle: '[Planned Perfection] (SSR Pal)',
    cardArt: 'https://gametora.com/images/umamusume/supports/tex_support_card_30036.png',
    fallbackArt: 'https://gametora.com/images/umamusume/supports/tex_support_card_30036.png',
    eventTitle: 'Giáo Án Kỷ Luật Thép Của Riko Kashimoto',
    loreText: 'Riko Kashimoto cầm bảng hồ sơ bước vào sân tập với ánh mắt nghiêm khắc: "Quản lý thể lực lỏng lẻo sẽ dẫn đến thất bại. Hãy chứng minh giáo án của bạn thực sự hiệu quả!"',
    choices: [
      {
        id: 'safe',
        tone: 'green',
        title: '1. Tuân thủ nghiêm ngặt quy chuẩn thể lực của Riko',
        preview: 'An toàn: Cả 3 Uma nhận +25 Stamina, +25 Guts và đưa Fail Rate về 0%.'
      },
      {
        id: 'tactical',
        tone: 'yellow',
        title: '2. Đề xuất giáo án huấn luyện nâng cao',
        preview: 'Chiến thuật: Nhận 1 [Coaching Megaphone] (x1.5 Train) và 1 [Secret Training Notepad] (+25 All Stat).'
      },
      {
        id: 'gamble',
        tone: 'red',
        title: '3. Thực hiện bài kiểm tra vượt giới hạn cho 1 Uma ngẫu nhiên (Tỉ lệ 50/50)',
        preview: 'Thành công (50%): Nhận [Mini Goddess Statue] & 1 Uma ngẫu nhiên +55 Power | Thất bại (50%): Uma đó giảm 1 Mood & +15% Fail.'
      }
    ]
  },
  {
    id: 'ev_aoi',
    character: 'Aoi Kiryuin',
    cardTitle: '[Trainer\'s Teamwork] (SR Pal)',
    cardArt: 'https://gametora.com/images/umamusume/supports/tex_support_card_20021.png',
    fallbackArt: 'https://gametora.com/images/umamusume/supports/tex_support_card_20021.png',
    eventTitle: 'Cuốn Sổ Tay Gia Truyền Nhà Kiryuin',
    loreText: 'Nữ Trainer đồng nghiệp Aoi Kiryuin ôm chồng sổ tay chạy tới: "Đội của mình vừa tổng hợp được dữ liệu địa hình mới! Hai đội chúng ta cử đại diện đấu tập đối kháng nhé!"',
    choices: [
      {
        id: 'safe',
        tone: 'green',
        title: '1. Cùng Aoi trao đổi kinh nghiệm ghi chép sổ tay',
        preview: 'An toàn: Nhận 1 [Secret Training Notepad] (+25 All Stat) và rút thêm 1 lá bài.'
      },
      {
        id: 'tactical',
        tone: 'yellow',
        title: '2. Tổ chức buổi tiệc nướng giao lưu giữa hai đội',
        preview: 'Chiến thuật: Nhận 1 [Carrot BBQ Set] (+1 Mood toàn đội) và +20 Wit cho cả 3 Uma.'
      },
      {
        id: 'gamble',
        tone: 'red',
        title: '3. Cử 1 Uma ngẫu nhiên đấu tập nước rút với đội của Aoi (Tỉ lệ 55/45)',
        preview: 'Thành công (55%): 1 Uma ngẫu nhiên nhận +50 Speed, +50 Power & +1 Mood | Thất bại (45%): Uma đó bị +25% Fail.'
      }
    ]
  },
  {
    id: 'ev_throne',
    character: 'Heirs to the Throne',
    cardTitle: '[Heirs to the Throne] (SSR Group)',
    cardArt: 'https://gametora.com/images/umamusume/supports/tex_support_card_30067.png',
    fallbackArt: 'https://gametora.com/images/umamusume/supports/tex_support_card_30067.png',
    eventTitle: 'Ý Chí Kế Thừa Ngôi Vương',
    loreText: 'Hoàng đế Symboli Rudolf cùng Tokai Teio và Tsurumaru Tsuyoshi tổ chức một buổi tập huấn đặc biệt. Dù thể trạng của Tsuyoshi khá mỏng manh, ý chí kiên cường không bỏ cuộc của cô ấy dưới sự dẫn dắt của Rudolf và Teio đã truyền cảm hứng mạnh mẽ cho đội bạn.',
    choices: [
      {
        id: 'safe',
        tone: 'green',
        title: '1. Tập bài hồi phục thể lực và dưỡng sức cùng Tsurumaru Tsuyoshi',
        preview: 'An toàn: Nhận 1 [Royal Bitter Juice] (0% Fail), 1 [Sweet Berry Parfait] (+2 Mood) và +20 Guts toàn đội.'
      },
      {
        id: 'tactical',
        tone: 'yellow',
        title: '2. Rèn luyện bước chạy Teio Step cường độ cao cùng Tokai Teio',
        preview: 'Chiến thuật: 1 Uma ngẫu nhiên nhận +45 Speed & +45 Power, nhưng tăng +15% Fail do mất sức.'
      },
      {
        id: 'gamble',
        tone: 'red',
        title: '3. Đón nhận bài kiểm tra Uy Quyền Hoàng Đế của Symboli Rudolf (Tỉ lệ 50/50)',
        preview: 'Thành công (50%): Nhận [Mini Goddess Statue] + Cả đội +30 All Stat | Thất bại (50%): Cả 3 Uma giảm 1 bậc Mood & +15% Fail.'
      }
    ]
  },
  {
    id: 'ev_grandlive',
    character: 'Light Hello',
    cardTitle: '[From Here on Out] (SSR Pal)',
    // ĐÃ GÁN CỨNG ID 30052 CHUẨN XÁC CHO LIGHT HELLO
    cardArt: 'https://gametora.com/images/umamusume/supports/tex_support_card_30052.png',
    fallbackArt: 'https://gametora.com/images/umamusume/supports/tex_support_card_30052.png',
    eventTitle: 'Ánh Đèn Sân Khấu Grand Live Cùng Light Hello',
    loreText: 'Nhà sản xuất sự kiện Light Hello mời đội của bạn tham gia buổi tổng duyệt Winning Live trước giải đấu lớn. Âm nhạc sôi động giúp tinh thần của các Uma dâng cao.',
    choices: [
      {
        id: 'safe',
        tone: 'green',
        title: '1. Thưởng thức buổi diễn và nhận lời khuyên từ Light Hello',
        preview: 'An toàn: Tăng +1 bậc Mood cho cả 3 Uma và nhận 1 [Sweet Berry Parfait].'
      },
      {
        id: 'tactical',
        tone: 'yellow',
        title: '2. Luyện tập vũ đạo tăng độ dẻo dai trên sân khấu',
        preview: 'Chiến thuật: Cả 3 Uma nhận +25 Speed, +25 Guts và nhận 1 [Coaching Megaphone].'
      },
      {
        id: 'gamble',
        tone: 'red',
        title: '3. Đề cử 1 Uma ngẫu nhiên biểu diễn tiết mục tâm điểm (Tỉ lệ 50/50)',
        preview: 'Thành công (50%): Nhận [Mini Goddess Statue] + Uma đó +40 Wit & Rút 2 bài | Thất bại (50%): Uma đó giảm 2 bậc Mood.'
      }
    ]
  },
  {
    id: 'ev_sasami',
    character: 'Sasami Anshinzawa',
    cardTitle: '[Just an Acupuncturist, No Need to Worry!] (SSR Pal)',
    // ĐÃ GÁN CỨNG ID 30080 CHUẨN XÁC CHO SASAMI ANSHINZAWA
    cardArt: 'https://gametora.com/images/umamusume/supports/tex_support_card_30080.png',
    fallbackArt: 'https://gametora.com/images/umamusume/supports/tex_support_card_30080.png',
    eventTitle: 'Liệu Pháp Châm Cứu Của Sasami Anshinzawa',
    loreText: 'Chuyên gia châm cứu Sasami Anshinzawa xuất hiện với bộ kim châm quen thuộc và đề nghị kích hoạt các huyệt đạo tiềm ẩn (Chakra) cho một học trò ngẫu nhiên trong đội của bạn.',
    choices: [
      {
        id: 'safe',
        tone: 'green',
        title: '1. Lịch sự từ chối (Politely Decline)',
        preview: 'An toàn (100%): Không mạo hiểm, nhận 1 [Royal Bitter Juice] (0% Fail) và 1 [Sweet Berry Parfait] (+2 Mood).'
      },
      {
        id: 'tactical',
        tone: 'yellow',
        title: '2. Kích hoạt Huyệt Sức Mạnh (Activate Strength Chakra - Tỉ lệ 60/40)',
        preview: 'Thành công (60%): 1 Uma ngẫu nhiên nhận +40 vào cả 5 chỉ số | Thất bại (40%): Uma đó giảm 1 Mood & +15% Fail.'
      },
      {
        id: 'gamble',
        tone: 'red',
        title: '3. Kích hoạt Huyệt Chiến Thắng (Activate Winning Chakra - Tỉ lệ 50/50)',
        preview: 'Thành công (50%): Nhận [Mini Goddess Statue] + [Secret Training Notepad] | Thất bại (50%): 1 Uma ngẫu nhiên giảm 2 bậc Mood.'
      }
    ]
  }
];

function addItemToInventory(player, itemId) {
  if (!player.inventory) player.inventory = [];
  if (player.inventory.length >= 3) return false;
  const template = ITEMS_DB[itemId];
  if (!template) return false;
  player.inventory.push({
    uid: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ...template
  });
  return true;
}

function rollRandomGlobalEvent() {
  const idx = Math.floor(Math.random() * GLOBAL_EVENTS_POOL.length);
  return GLOBAL_EVENTS_POOL[idx];
}

function pickRandomUma(umas) {
  if (!umas || umas.length === 0) return null;
  const randIdx = Math.floor(Math.random() * umas.length);
  return umas[randIdx];
}

function resolveEventChoice(player, eventId, choiceId, changeMoodFn, drawCardFn) {
  const umas = player.selectedUmas || [];
  const randUma = pickRandomUma(umas);
  let summary = '';

  if (eventId === 'ev_tazuna') {
    if (choiceId === 'safe') {
      addItemToInventory(player, 'sweet_parfait');
      addItemToInventory(player, 'royal_juice');
      summary = 'Tazuna trao tặng [Sweet Berry Parfait] và [Royal Bitter Juice].';
    } else if (choiceId === 'tactical') {
      drawCardFn(player, 2);
      if (randUma) randUma.mood = changeMoodFn(randUma.mood, 1);
      summary = `Cùng Tazuna lập kế hoạch: Rút 2 lá bài & ${randUma?.name || 'Uma'} tăng +1 Mood.`;
    } else {
      if (Math.random() < 0.55) {
        umas.forEach(u => { u.baseStats.spd += 35; u.baseStats.wit += 35; });
        summary = '[THÀNH CÔNG] Bài tập của Tazuna giúp cả 3 Uma nhận +35 Speed & +35 Wit.';
      } else {
        umas.forEach(u => { u.failRate = Math.min(70, u.failRate + 15); });
        summary = '[THẤT BẠI] Bài tập quá sức khiến cả 3 Uma bị +15% Fail Rate.';
      }
    }
  } else if (eventId === 'ev_riko') {
    if (choiceId === 'safe') {
      umas.forEach(u => { u.baseStats.sta += 25; u.baseStats.gut += 25; u.failRate = 0; });
      summary = 'Giáo án của Riko: Cả 3 Uma +25 Stamina, +25 Guts & Fail về 0%.';
    } else if (choiceId === 'tactical') {
      addItemToInventory(player, 'megaphone');
      addItemToInventory(player, 'stat_notepad');
      summary = 'Riko cấp cho bạn [Coaching Megaphone] và [Secret Training Notepad].';
    } else {
      if (Math.random() < 0.5) {
        addItemToInventory(player, 'goddess_statue');
        if (randUma) randUma.baseStats.pow += 55;
        summary = `[THÀNH CÔNG] ${randUma?.name || 'Uma'} vượt bài kiểm tra của Riko: +55 Power & Nhận [Mini Goddess Statue].`;
      } else {
        if (randUma) {
          randUma.mood = changeMoodFn(randUma.mood, -1);
          randUma.failRate = Math.min(70, randUma.failRate + 15);
        }
        summary = `[THẤT BẠI] ${randUma?.name || 'Uma'} không vượt qua bài kiểm tra (-1 Mood, +15% Fail).`;
      }
    }
  } else if (eventId === 'ev_aoi') {
    if (choiceId === 'safe') {
      addItemToInventory(player, 'stat_notepad');
      drawCardFn(player, 1);
      summary = 'Trao đổi với Aoi Kiryuin: Nhận [Secret Training Notepad] & Rút 1 lá bài.';
    } else if (choiceId === 'tactical') {
      addItemToInventory(player, 'carrot_bbq');
      umas.forEach(u => { u.baseStats.wit += 20; });
      summary = 'Giao lưu cùng đội Aoi: Nhận [Carrot BBQ Set] & +20 Wit toàn đội.';
    } else {
      if (Math.random() < 0.55) {
        if (randUma) {
          randUma.baseStats.spd += 50;
          randUma.baseStats.pow += 50;
          randUma.mood = changeMoodFn(randUma.mood, 1);
        }
        summary = `[THÀNH CÔNG] ${randUma?.name || 'Uma'} thắng đấu tập: +50 Speed, +50 Power & +1 Mood.`;
      } else {
        if (randUma) randUma.failRate = Math.min(70, randUma.failRate + 25);
        summary = `[THẤT BẠI] ${randUma?.name || 'Uma'} mất sức sau buổi đấu tập (+25% Fail).`;
      }
    }
  } else if (eventId === 'ev_throne') {
    if (choiceId === 'safe') {
      addItemToInventory(player, 'royal_juice');
      addItemToInventory(player, 'sweet_parfait');
      umas.forEach(u => { u.baseStats.gut += 20; });
      summary = 'Tập hồi phục cùng Tsurumaru Tsuyoshi: +20 Guts toàn đội & Nhận 2 vật phẩm hồi phục.';
    } else if (choiceId === 'tactical') {
      if (randUma) {
        randUma.baseStats.spd += 45;
        randUma.baseStats.pow += 45;
        randUma.failRate = Math.min(70, randUma.failRate + 15);
      }
      summary = `${randUma?.name || 'Uma'} tập Teio Step cùng Tokai Teio: +45 Speed/Power (+15% Fail).`;
    } else {
      if (Math.random() < 0.5) {
        addItemToInventory(player, 'goddess_statue');
        umas.forEach(u => {
          u.baseStats.spd += 30; u.baseStats.sta += 30; u.baseStats.pow += 30;
          u.baseStats.gut += 30; u.baseStats.wit += 30;
        });
        summary = '[THÀNH CÔNG] Vượt thử thách của Symboli Rudolf: Cả đội +30 All Stat & Nhận [Mini Goddess Statue].';
      } else {
        umas.forEach(u => {
          u.mood = changeMoodFn(u.mood, -1);
          u.failRate = Math.min(70, u.failRate + 15);
        });
        summary = '[THẤT BẠI] Áp lực từ bài tập của Rudolf khiến cả 3 Uma giảm 1 Mood & +15% Fail.';
      }
    }
  } else if (eventId === 'ev_grandlive') {
    if (choiceId === 'safe') {
      umas.forEach(u => { u.mood = changeMoodFn(u.mood, 1); });
      addItemToInventory(player, 'sweet_parfait');
      summary = 'Sân khấu Grand Live: +1 Mood toàn đội & Nhận [Sweet Berry Parfait].';
    } else if (choiceId === 'tactical') {
      umas.forEach(u => { u.baseStats.spd += 25; u.baseStats.gut += 25; });
      addItemToInventory(player, 'megaphone');
      summary = 'Tổng duyệt vũ đạo: +25 Speed/Guts toàn đội & Nhận [Coaching Megaphone].';
    } else {
      if (Math.random() < 0.5) {
        addItemToInventory(player, 'goddess_statue');
        if (randUma) randUma.baseStats.wit += 40;
        drawCardFn(player, 2);
        summary = `[THÀNH CÔNG] ${randUma?.name || 'Uma'} tỏa sáng trên sân khấu: +40 Wit, Rút 2 bài & Nhận [Mini Goddess Statue].`;
      } else {
        if (randUma) randUma.mood = changeMoodFn(randUma.mood, -2);
        summary = `[THẤT BẠI] ${randUma?.name || 'Uma'} gặp sự cố sân khấu (-2 bậc Mood).`;
      }
    }
  } else {
    // Sasami Anshinzawa (ID 30080)
    if (choiceId === 'safe') {
      addItemToInventory(player, 'royal_juice');
      addItemToInventory(player, 'sweet_parfait');
      summary = 'Lịch sự từ chối châm cứu: Nhận [Royal Bitter Juice] và [Sweet Berry Parfait].';
    } else if (choiceId === 'tactical') {
      if (Math.random() < 0.6) {
        if (randUma) {
          randUma.baseStats.spd += 40;
          randUma.baseStats.sta += 40;
          randUma.baseStats.pow += 40;
          randUma.baseStats.gut += 40;
          randUma.baseStats.wit += 40;
        }
        summary = `[THÀNH CÔNG] Kích hoạt Strength Chakra cho ${randUma?.name || 'Uma'}: +40 toàn bộ 5 chỉ số.`;
      } else {
        if (randUma) {
          randUma.mood = changeMoodFn(randUma.mood, -1);
          randUma.failRate = Math.min(70, randUma.failRate + 15);
        }
        summary = `[THẤT BẠI] Châm lệch Strength Chakra: ${randUma?.name || 'Uma'} bị -1 Mood và +15% Fail.`;
      }
    } else {
      if (Math.random() < 0.5) {
        addItemToInventory(player, 'goddess_statue');
        addItemToInventory(player, 'stat_notepad');
        summary = '[THÀNH CÔNG] Kích hoạt Winning Chakra: Nhận [Mini Goddess Statue] và [Secret Training Notepad].';
      } else {
        if (randUma) randUma.mood = changeMoodFn(randUma.mood, -2);
        summary = `[THẤT BẠI] Winning Chakra phản tác dụng: ${randUma?.name || 'Uma'} bị giảm 2 bậc Mood.`;
      }
    }
  }

  return summary;
}

function useInventoryItem(player, itemUid, umaIndex, changeMoodFn) {
  if (!player.inventory) return { ok: false, error: 'Hành trang trống.' };
  const idx = player.inventory.findIndex(it => it.uid === itemUid);
  if (idx === -1) return { ok: false, error: 'Không tìm thấy vật phẩm này.' };

  const item = player.inventory[idx];
  const umas = player.selectedUmas || [];
  const targetUma = umas[umaIndex];

  if (item.targetType === 'single_uma' && !targetUma) {
    return { ok: false, error: 'Hãy kéo thả vật phẩm này vào 1 trong 3 Uma!' };
  }

  let toast = '';

  if (item.id === 'royal_juice') {
    targetUma.failRate = 0;
    toast = `[ITEM] Dùng ${item.name} lên ${targetUma.name}: Tỉ lệ Fail về 0%.`;
  } else if (item.id === 'sweet_parfait') {
    targetUma.mood = changeMoodFn(targetUma.mood, 2);
    toast = `[ITEM] Dùng ${item.name} lên ${targetUma.name}: Mood tăng lên [${targetUma.mood}].`;
  } else if (item.id === 'carrot_bbq') {
    umas.forEach(u => {
      u.mood = changeMoodFn(u.mood, 1);
      u.failRate = Math.max(0, u.failRate - 10);
    });
    toast = `[ITEM] Dùng ${item.name}: Toàn bộ 3 Uma +1 Mood và -10% Fail.`;
  } else if (item.id === 'stat_notepad') {
    targetUma.baseStats.spd += 25;
    targetUma.baseStats.sta += 25;
    targetUma.baseStats.pow += 25;
    targetUma.baseStats.gut += 25;
    targetUma.baseStats.wit += 25;
    toast = `[ITEM] Dùng ${item.name} lên ${targetUma.name}: +25 vào toàn bộ 5 chỉ số.`;
  } else if (item.id === 'goddess_statue') {
    const unawakenedCard = (targetUma.equippedCards || []).find(eq => !eq.isGoldAwakened);
    if (!unawakenedCard) {
      return { ok: false, error: `${targetUma.name} chưa có kỹ năng Trắng nào để nâng lên Gold Skill!` };
    }
    unawakenedCard.isGoldAwakened = true;
    const skObj = (targetUma.skills || []).find(s => s.cardUid === unawakenedCard.uid);
    if (skObj) {
      skObj.name = unawakenedCard.goldSkill;
      skObj.skillId = unawakenedCard.goldSkillId;
      skObj.mechanics = unawakenedCard.goldSkillData;
      skObj.isGold = true;
    }
    toast = `[ITEM] Tượng Nữ Thần mở khóa [GOLD] ${unawakenedCard.goldSkill} cho ${targetUma.name}.`;
  } else if (item.id === 'megaphone') {
    player.megaphoneBuff = true;
    toast = `[ITEM] Đã bật ${item.name}: Lần Train tiếp theo trong lượt này được x1.5 chỉ số.`;
  }

  player.inventory.splice(idx, 1);
  return { ok: true, toast };
}

module.exports = {
  ITEMS_DB,
  GLOBAL_EVENTS_POOL,
  addItemToInventory,
  rollRandomGlobalEvent,
  resolveEventChoice,
  useInventoryItem
};