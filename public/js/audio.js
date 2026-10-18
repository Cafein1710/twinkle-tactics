// public/js/audio.js - Hệ thống Âm thanh & Nhạc nền theo từng Năm (Year 1/2/3, Summer Camp & Tie-Break)

const SoundManager = (() => {
  let ctx = null;
  let isMuted = localStorage.getItem('twinkle_audio_muted') === 'true';
  let bgmVolume = parseFloat(localStorage.getItem('twinkle_bgm_vol') ?? '0.35');
  let sfxVolume = parseFloat(localStorage.getItem('twinkle_sfx_vol') ?? '0.65');

  let currentBgmKey = null;
  let synthTimer = null;
  let stepIndex = 0;
  let activeHtmlAudio = null;
  let isInRaceEventPhase = false;

  // Đường dẫn các file nhạc nền BGM (.mp3) trong thư mục public/assets/audio/
  const CUSTOM_BGM_PATHS = {
    lobby:   '/assets/audio/bgm_lobby.mp3',
    pregame: '/assets/audio/bgm_pregame.mp3',
    train:   '/assets/audio/bgm_train.mp3',   // Huấn luyện Năm 1
    train2:  '/assets/audio/bgm_train2.mp3',  // Huấn luyện Năm 2
    train3:  '/assets/audio/bgm_train3.mp3',  // Huấn luyện Năm 3
    summer:  '/assets/audio/bgm_summer.mp3',  // Trại hè (Lượt 7-8 Năm 2 & 3)
    race:    '/assets/audio/bgm_race.mp3',    // Đua Năm 1 (Map 1 & Map 2)
    race2:   '/assets/audio/bgm_race2.mp3',   // Đua Năm 2 (Map 3 & Map 4)
    race3:   '/assets/audio/bgm_race3.mp3',   // Đua Năm 3 (Map 5 & Map 6)
    tb:      '/assets/audio/bgm_tb.mp3'       // Đua Tie-break (Map 7)
  };

  // Đường dẫn file SFX (.mp3) tùy chọn trong public/assets/audio/
  const CUSTOM_SFX_PATHS = {
    click:         '/assets/audio/sfx_click.mp3',
    card_recall:   '/assets/audio/sfx_card_recall.mp3',
    train_normal:  '/assets/audio/sfx_train_normal.mp3',
    train_rainbow: '/assets/audio/sfx_train_rainbow.mp3',
    train_fail:    '/assets/audio/sfx_train_fail.mp3',
    rest:          '/assets/audio/sfx_rest.mp3',
    item_use:      '/assets/audio/sfx_item_use.mp3',
    event_popup:   '/assets/audio/sfx_event_popup.mp3'
  };

  // Các BGM chỉ phát từ file MP3 (tuyệt đối không phát nhạc Synth miễn phí)
  const NO_SYNTH_FALLBACK_BGM = new Set(['race', 'race2', 'race3', 'tb']);

  const missingMp3Cache = {};

  const TRACK_LABELS = {
    lobby:   '🎵 Sảnh Học Viện Tracen',
    pregame: '🎵 Lựa Chọn Đội Hình (Pre-game)',
    train:   '🎵 Huấn Luyện Năm 1 (Junior Year)',
    train2:  '🎵 Huấn Luyện Năm 2 (Classic Year)',
    train3:  '🎵 Huấn Luyện Năm 3 (Senior Year)',
    summer:  '🌴 Trại Hè (Summer Camp)',
    race:    '🏇 Giải Đua Năm 1 (Map 1 - 2)',
    race2:   '🏇 Giải Đua Năm 2 (Map 3 - 4)',
    race3:   '🏇 Giải Đua Năm 3 (Map 5 - 6)',
    tb:      '🔥 Quyết Chiến Tie-Break (Map 7)'
  };

  function ensureContext() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) ctx = new AudioCtx();
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function playTone(freq, type, duration, startTimeOffset = 0, volMult = 1.0, slideToFreq = null) {
    if (isMuted || !freq) return;
    const audioCtx = ensureContext();
    if (!audioCtx) return;

    const now = audioCtx.currentTime + startTimeOffset;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type || 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    if (slideToFreq) {
      osc.frequency.exponentialRampToValueAtTime(slideToFreq, now + duration);
    }

    const peakGain = Math.max(0.001, volMult);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  // =========================================================================
  // 1. HIỆU ỨNG ÂM THANH (SFX) - ĐÃ BỎ TOÀN BỘ SFX ĐUA & SFX SKILL THẺ BÀI
  // =========================================================================
  function playSynthSfxFallback(sfxName) {
    if (isMuted || sfxVolume <= 0.01) return;
    const v = sfxVolume * 0.28;

    switch (sfxName) {
      case 'click':
        playTone(660, 'sine', 0.05, 0, v * 0.5, 880);
        break;

      case 'card_recall':
        playTone(659.25, 'sine', 0.08, 0, v * 0.7);
        playTone(523.25, 'sine', 0.12, 0.06, v * 0.7);
        break;

      case 'train_normal':
        playTone(1174.66, 'sine', 0.08, 0, v * 0.6);
        playTone(1174.66, 'sine', 0.18, 0.10, v * 0.7);
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
          playTone(f, 'triangle', 0.16, 0.22 + i * 0.05, v * 0.8);
        });
        break;

      case 'train_rainbow':
        [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1567.98].forEach((f, i) => {
          playTone(f, 'sine', 0.22, i * 0.045, v * 0.85);
          playTone(f * 0.5, 'triangle', 0.20, i * 0.045, v * 0.55);
        });
        break;

      case 'train_fail':
        playTone(392.00, 'sawtooth', 0.22, 0, v * 0.7, 369.99);
        playTone(349.23, 'sawtooth', 0.22, 0.22, v * 0.7, 329.63);
        playTone(311.13, 'sawtooth', 0.45, 0.44, v * 0.8, 220.00);
        break;

      case 'rest':
        [392.00, 493.88, 587.33, 783.99].forEach((f, i) => {
          playTone(f, 'sine', 0.28, i * 0.09, v * 0.7);
        });
        break;

      case 'item_use':
        playTone(587.33, 'triangle', 0.09, 0, v * 0.75);
        playTone(880.00, 'sine', 0.18, 0.08, v * 0.85);
        break;

      case 'event_popup':
        playTone(440, 'triangle', 0.12, 0, v * 0.7);
        playTone(554.37, 'triangle', 0.12, 0.08, v * 0.7);
        playTone(659.25, 'sine', 0.28, 0.16, v * 0.85);
        break;

      default:
        break;
    }
  }

  function playSfx(sfxName) {
    if (isMuted || sfxVolume <= 0.01) return;

    const customUrl = CUSTOM_SFX_PATHS[sfxName];
    if (customUrl && !missingMp3Cache[customUrl]) {
      const sfxAudio = new Audio(customUrl);
      sfxAudio.volume = sfxVolume;

      sfxAudio.onerror = () => {
        missingMp3Cache[customUrl] = true;
        playSynthSfxFallback(sfxName);
      };

      sfxAudio.play().catch((err) => {
        if (err && err.name !== 'NotAllowedError' && missingMp3Cache[customUrl]) {
          playSynthSfxFallback(sfxName);
        }
      });
      return;
    }

    playSynthSfxFallback(sfxName);
  }

  // =========================================================================
  // 2. HỆ THỐNG PHÁT BGM THEO NĂM & GIAI ĐOẠN (ƯU TIÊN TUYỆT ĐỐI FILE MP3)
  // =========================================================================
  const SYNTH_PATTERNS = {
    lobby: {
      tempoMs: 320,
      wave: 'sine',
      bassWave: 'triangle',
      notes: [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 783.99, 698.46, 523.25, 659.25, 880.00, 783.99, 659.25, 587.33, 523.25, 0],
      bass:  [261.63, 0, 196.00, 0, 293.66, 0, 196.00, 0, 261.63, 0, 220.00, 0, 196.00, 246.94, 261.63, 0]
    },
    pregame: {
      tempoMs: 240,
      wave: 'triangle',
      bassWave: 'triangle',
      notes: [440, 0, 523.25, 587.33, 659.25, 0, 587.33, 523.25, 440, 0, 392, 440, 493.88, 523.25, 587.33, 659.25],
      bass:  [220, 220, 196, 196, 174.61, 174.61, 196, 196, 220, 220, 196, 196, 164.81, 164.81, 196, 220]
    },
    train: {
      tempoMs: 210,
      wave: 'triangle',
      bassWave: 'sine',
      notes: [
        523.25, 587.33, 659.25, 783.99, 659.25, 783.99, 880.00, 0,
        783.99, 698.46, 659.25, 587.33, 659.25, 523.25, 587.33, 0
      ],
      bass: [
        261.63, 0, 392.00, 0, 329.63, 0, 440.00, 0,
        293.66, 0, 392.00, 0, 261.63, 329.63, 392.00, 0
      ]
    },
    summer: {
      tempoMs: 185,
      wave: 'sine',
      bassWave: 'triangle',
      notes: [
        659.25, 783.99, 0, 880.00, 783.99, 659.25, 587.33, 659.25,
        0, 783.99, 880.00, 1046.50, 880.00, 783.99, 659.25, 0
      ],
      bass: [
        261.63, 329.63, 392.00, 329.63, 293.66, 349.23, 440.00, 349.23,
        329.63, 392.00, 493.88, 392.00, 349.23, 440.00, 523.25, 440.00
      ]
    }
  };
  SYNTH_PATTERNS.train2 = SYNTH_PATTERNS.train;
  SYNTH_PATTERNS.train3 = SYNTH_PATTERNS.train;

  function stopSynthOnly() {
    if (synthTimer) {
      clearInterval(synthTimer);
      synthTimer = null;
    }
  }

  function stopCurrentBgm() {
    stopSynthOnly();
    if (activeHtmlAudio) {
      activeHtmlAudio.onended = null;
      activeHtmlAudio.onerror = null;
      activeHtmlAudio.pause();
      activeHtmlAudio.currentTime = 0;
      activeHtmlAudio = null;
    }
  }

  function startSynthPattern(trackKey) {
    if (NO_SYNTH_FALLBACK_BGM.has(trackKey) || activeHtmlAudio) return;
    const pat = SYNTH_PATTERNS[trackKey];
    if (!pat) return;

    stopSynthOnly();
    stepIndex = 0;
    const stepSec = pat.tempoMs / 1000;

    synthTimer = setInterval(() => {
      if (isMuted || bgmVolume <= 0.01 || activeHtmlAudio) return;
      const idx = stepIndex % pat.notes.length;
      const leadNote = pat.notes[idx];
      const bassNote = pat.bass[idx];
      const v = bgmVolume * 0.16;

      if (leadNote > 0) playTone(leadNote, pat.wave, stepSec * 0.88, 0, v);
      if (bassNote > 0) playTone(bassNote, pat.bassWave, stepSec * 0.92, 0, v * 0.75);
      stepIndex++;
    }, pat.tempoMs);
  }

  function playBgm(trackKey) {
    if (!trackKey) return;

    // Nếu cùng 1 bản BGM đang chạy (VD: chuyển từ Map 1 sang Map 2 trong cùng Năm 1) -> Giữ mạch nhạc liên tục
    if (currentBgmKey === trackKey && (synthTimer || activeHtmlAudio)) {
      if (activeHtmlAudio && activeHtmlAudio.paused && !isMuted) {
        activeHtmlAudio.play().catch(() => {});
      }
      return;
    }

    currentBgmKey = trackKey;
    stopCurrentBgm();
    updateMixerTrackLabel();

    const customUrl = CUSTOM_BGM_PATHS[trackKey];
    if (customUrl && !missingMp3Cache[customUrl]) {
      const audio = new Audio(customUrl);
      audio.loop = true;
      audio.volume = isMuted ? 0 : bgmVolume;
      activeHtmlAudio = audio;

      audio.onerror = () => {
        missingMp3Cache[customUrl] = true;
        if (activeHtmlAudio === audio) {
          activeHtmlAudio = null;
        }
        if (currentBgmKey === trackKey && !NO_SYNTH_FALLBACK_BGM.has(trackKey)) {
          startSynthPattern(trackKey);
        }
      };

      audio.play().catch(() => {});
      return;
    }

    if (!NO_SYNTH_FALLBACK_BGM.has(trackKey)) {
      startSynthPattern(trackKey);
    }
  }

  // Xác định đúng bài nhạc Huấn luyện theo Năm (Year 1 / 2 / 3) và Trại Hè
  function getTrainingBgmKey(year, turn) {
    const y = Number(year) || 1;
    const t = Number(turn) || 1;
    if (y >= 2 && (t === 7 || t === 8)) return 'summer';
    if (y === 2) return 'train2';
    if (y >= 3) return 'train3';
    return 'train';
  }

  // Xác định đúng bài nhạc Đua theo Năm (race / race2 / race3) hoặc Tie-break (tb)
  function getRaceBgmKey(racePacket) {
    const slot = String(racePacket?.map?.slot || '').toLowerCase();
    if (slot.includes('tie')) return 'tb';
    if (slot.includes('map 5') || slot.includes('map 6')) return 'race3';
    if (slot.includes('map 3') || slot.includes('map 4')) return 'race2';
    if (slot.includes('map 1') || slot.includes('map 2')) return 'race';

    const curYear = Number(window.latestGameState?.year) || 1;
    if (curYear === 2) return 'race2';
    if (curYear >= 3) return 'race3';
    return 'race';
  }

  // =========================================================================
  // 3. THANH ĐIỀU KHIỂN ÂM LƯỢNG NỔI (MINI AUDIO MIXER)
  // =========================================================================
  function updateMixerTrackLabel() {
    const lbl = document.getElementById('uma-audio-track-label');
    if (lbl) {
      lbl.innerText = isMuted ? '🔇 Đang tắt tiếng' : (TRACK_LABELS[currentBgmKey] || '🎵 Twinkle Audio Ready');
    }
    const muteBtn = document.getElementById('uma-audio-mute-btn');
    if (muteBtn) {
      muteBtn.innerText = isMuted ? '🔇' : '🔊';
      muteBtn.style.background = isMuted ? '#ef4444' : '#0284c7';
    }
  }

  function injectAudioControllerUI() {
    if (document.getElementById('uma-audio-mixer-widget')) return;

    const widget = document.createElement('div');
    widget.id = 'uma-audio-mixer-widget';
    widget.style.cssText = `
      position: fixed;
      bottom: 12px;
      right: 12px;
      z-index: 9999;
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid #38bdf8;
      border-radius: 10px;
      padding: 6px 10px;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.65);
      color: #f8fafc;
      font-size: 11px;
      backdrop-filter: blur(6px);
    `;

    widget.innerHTML = `
      <button id="uma-audio-mute-btn" title="Bật / Tắt âm thanh" style="width:28px; height:28px; padding:0; margin:0; border-radius:6px; border:none; cursor:pointer; background:${isMuted ? '#ef4444' : '#0284c7'}; color:#fff; font-size:14px;">
        ${isMuted ? '🔇' : '🔊'}
      </button>
      <div style="display:flex; flex-direction:column; gap:2px; min-width:155px;">
        <div id="uma-audio-track-label" style="font-weight:bold; color:#38bdf8; font-size:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:170px;">
          🎵 Twinkle Audio Ready
        </div>
        <div style="display:flex; align-items:center; gap:6px; font-size:9.5px; color:#cbd5e1;">
          <span>BGM</span>
          <input id="uma-bgm-slider" type="range" min="0" max="1" step="0.05" value="${bgmVolume}" style="width:52px; accent-color:#38bdf8; cursor:pointer;">
          <span>SFX</span>
          <input id="uma-sfx-slider" type="range" min="0" max="1" step="0.05" value="${sfxVolume}" style="width:52px; accent-color:#facc15; cursor:pointer;">
        </div>
      </div>
    `;

    document.body.appendChild(widget);

    document.getElementById('uma-audio-mute-btn').onclick = () => {
      ensureContext();
      isMuted = !isMuted;
      localStorage.setItem('twinkle_audio_muted', String(isMuted));
      if (activeHtmlAudio) {
        activeHtmlAudio.volume = isMuted ? 0 : bgmVolume;
        if (!isMuted && activeHtmlAudio.paused) {
          activeHtmlAudio.play().catch(() => {});
        }
      }
      updateMixerTrackLabel();
      if (!isMuted) playSfx('click');
    };

    document.getElementById('uma-bgm-slider').oninput = (e) => {
      ensureContext();
      bgmVolume = parseFloat(e.target.value);
      localStorage.setItem('twinkle_bgm_vol', String(bgmVolume));
      if (activeHtmlAudio) {
        activeHtmlAudio.volume = isMuted ? 0 : bgmVolume;
        if (!isMuted && activeHtmlAudio.paused) {
          activeHtmlAudio.play().catch(() => {});
        }
      }
    };

    document.getElementById('uma-sfx-slider').oninput = (e) => {
      ensureContext();
      sfxVolume = parseFloat(e.target.value);
      localStorage.setItem('twinkle_sfx_vol', String(sfxVolume));
      playSfx('click');
    };
  }

  // =========================================================================
  // 4. GẮN KẾT (HOOKS) VÀO LUỒNG GAME
  // =========================================================================
  function installGameHooks() {
    injectAudioControllerUI();

    document.addEventListener('click', (e) => {
      ensureContext();
      if (!currentBgmKey) {
        playBgm('lobby');
      } else if (activeHtmlAudio && activeHtmlAudio.paused && !isMuted) {
        activeHtmlAudio.play().catch(() => {});
      }

      const btn = e.target.closest('button, .filter-btn, .roster-item, .deck-pool-card, .map-item');
      if (btn && btn.id !== 'uma-audio-mute-btn') {
        playSfx('click');
      }
    });

    if (typeof socket !== 'undefined') {
      socket.on('enter_pregame', () => {
        isInRaceEventPhase = false;
        playBgm('pregame');
      });

      // Ngay khi sự kiện đua bắt đầu (đếm ngược 10s): Phát nhạc đua tương ứng Năm 1 / 2 / 3 hoặc Tie-break
      socket.on('race_started', (racePacket) => {
        isInRaceEventPhase = true;
        playBgm(getRaceBgmKey(racePacket));
      });

      // Khi cả 2 người chơi ấn xác nhận kết thúc kỳ đua để sang năm tiếp theo -> Chuyển về nhạc Train của năm mới
      socket.on('close_race_modal', () => {
        isInRaceEventPhase = false;
        const nextYear = Number(window.latestGameState?.year) || 1;
        const nextTurn = Number(window.latestGameState?.turn) || 1;
        playBgm(getTrainingBgmKey(nextYear, nextTurn));
      });
    }

    if (typeof window.updateGameState === 'function') {
      const origUpdateGameState = window.updateGameState;
      window.updateGameState = function (data) {
        origUpdateGameState.apply(this, arguments);
        if (!data) return;

        const raceModal = document.getElementById('race-viewer-modal');
        const isRaceModalVisible = raceModal && raceModal.style.display === 'flex';

        if (!isInRaceEventPhase && !isRaceModalVisible && !data.activeRacePacket) {
          playBgm(getTrainingBgmKey(data.year, data.turn));
        }

        // Chỉ phát SFX cho Huấn luyện, Nghỉ ngơi, Thu hồi/Bỏ bài và Dùng Item (Đã bỏ SFX nhận skill trắng/vàng)
        if (data.actionToast) {
          const t = String(data.actionToast).toUpperCase();
          if (t.includes('TRAINING FAILED')) {
            playSfx('train_fail');
          } else if (t.includes('RAINBOW')) {
            playSfx('train_rainbow');
          } else if (t.includes('[TRAIN ')) {
            playSfx('train_normal');
          } else if (t.includes('[RECALL CARD]') || t.includes('DISCARD FOR ENERGY')) {
            playSfx('card_recall');
          } else if (t.includes('[ACTIVE REST]')) {
            playSfx('rest');
          } else if (t.includes('ITEM') || t.includes('ROYAL') || t.includes('PARFAIT') || t.includes('MEGAPHONE')) {
            playSfx('item_use');
          }
        }
      };
    }

    if (typeof window.triggerGlobalEventModal === 'function') {
      const origTriggerEvent = window.triggerGlobalEventModal;
      window.triggerGlobalEventModal = function (eventObj) {
        origTriggerEvent.apply(this, arguments);
        if (eventObj) playSfx('event_popup');
      };
    }

    if (typeof window.openRaceViewerModal === 'function') {
      const origOpenRace = window.openRaceViewerModal;
      window.openRaceViewerModal = function (racePacket) {
        isInRaceEventPhase = true;
        playBgm(getRaceBgmKey(racePacket));
        return origOpenRace.apply(this, arguments);
      };
    }
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', installGameHooks);
  } else {
    setTimeout(installGameHooks, 50);
  }

  return {
    playBgm,
    playSfx,
    stopCurrentBgm
  };
})();