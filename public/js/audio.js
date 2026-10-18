// public/js/audio.js - Hệ thống Âm thanh & Nhạc nền theo từng Năm (Đặt gọn trên thanh Header cạnh mã phòng, không che nút)

const SoundManager = (() => {
  let ctx = null;
  let isMuted = localStorage.getItem('twinkle_audio_muted') === 'true';
  let bgmVolume = parseFloat(localStorage.getItem('twinkle_bgm_vol') ?? '0.35');
  let sfxVolume = parseFloat(localStorage.getItem('twinkle_sfx_vol') ?? '0.65');
  let isPanelExpanded = false;

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
    lobby:   'Sảnh Học Viện Tracen',
    pregame: 'Chiến Thuật Đội Hình (Pre-game)',
    train:   'Huấn Luyện Năm 1 (Junior Year)',
    train2:  'Huấn Luyện Năm 2 (Classic Year)',
    train3:  'Huấn Luyện Năm 3 (Senior Year)',
    summer:  'Trại Hè Quốc Gia (Summer Camp)',
    race:    'Giải Đua Năm 1 (Map 1 - 2)',
    race2:   'Giải Đua Năm 2 (Map 3 - 4)',
    race3:   'Giải Đua Năm 3 (Map 5 - 6)',
    tb:      'Quyết Chiến Tie-Break (Map 7)'
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

    if (currentBgmKey === trackKey && (synthTimer || activeHtmlAudio)) {
      if (activeHtmlAudio && activeHtmlAudio.paused && !isMuted) {
        activeHtmlAudio.play().catch(() => {});
      }
      return;
    }

    currentBgmKey = trackKey;
    stopCurrentBgm();
    updateMixerUIState();

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

  function getTrainingBgmKey(year, turn) {
    const y = Number(year) || 1;
    const t = Number(turn) || 1;
    if (y >= 2 && (t === 7 || t === 8)) return 'summer';
    if (y === 2) return 'train2';
    if (y >= 3) return 'train3';
    return 'train';
  }

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
  // 3. GIAO DIỆN ÂM LƯỢNG THU GỌN (ĐẶT Ở KHOẢNG TRỐNG CẠNH NÚT COPY MÃ PHÒNG)
  // =========================================================================
  function updateSliderTrackVisual(sliderEl, val, activeColor) {
    if (!sliderEl) return;
    const pct = Math.max(0, Math.min(100, Math.round(val * 100)));
    sliderEl.style.setProperty(
      'background',
      `linear-gradient(to right, ${activeColor} 0%, ${activeColor} ${pct}%, #334155 ${pct}%, #334155 100%)`,
      'important'
    );
  }

  function updateMixerUIState() {
    const lbl = document.getElementById('uma-audio-track-label');
    if (lbl) {
      lbl.innerText = isMuted
        ? 'Đang tắt tiếng (Muted)'
        : (TRACK_LABELS[currentBgmKey] || 'Twinkle Audio Ready');
    }

    const miniIcon = document.getElementById('uma-audio-mini-icon');
    const miniText = document.getElementById('uma-audio-mini-text');
    const miniPill = document.getElementById('uma-audio-collapsed-pill');
    if (miniIcon) miniIcon.innerText = isMuted ? '🔇' : '🔊';
    if (miniText) {
      const bgmPct = isMuted ? 0 : Math.round(bgmVolume * 100);
      miniText.innerText = isMuted ? 'Tắt' : `${bgmPct}%`;
    }
    if (miniPill) {
      miniPill.style.borderColor = isMuted ? '#ef4444' : '#38bdf8';
    }

    const muteBtn = document.getElementById('uma-audio-mute-btn');
    if (muteBtn) {
      muteBtn.innerText = isMuted ? '🔇 Đang Tắt Tiếng (Bấm để Bật)' : '🔊 Đang Bật Tiếng (Bấm để Tắt)';
      muteBtn.style.background = isMuted ? '#ef4444' : '#0284c7';
    }

    const bgmSlider = document.getElementById('uma-bgm-slider');
    const sfxSlider = document.getElementById('uma-sfx-slider');
    const bgmPctLabel = document.getElementById('uma-bgm-pct-val');
    const sfxPctLabel = document.getElementById('uma-sfx-pct-val');

    if (bgmSlider) {
      bgmSlider.value = String(bgmVolume);
      updateSliderTrackVisual(bgmSlider, isMuted ? 0 : bgmVolume, '#38bdf8');
    }
    if (sfxSlider) {
      sfxSlider.value = String(sfxVolume);
      updateSliderTrackVisual(sfxSlider, isMuted ? 0 : sfxVolume, '#facc15');
    }
    if (bgmPctLabel) bgmPctLabel.innerText = `${Math.round(bgmVolume * 100)}%`;
    if (sfxPctLabel) sfxPctLabel.innerText = `${Math.round(sfxVolume * 100)}%`;
  }

  function setMixerExpanded(expanded) {
    isPanelExpanded = Boolean(expanded);
    const panel = document.getElementById('uma-audio-expanded-panel');
    const miniArrow = document.getElementById('uma-audio-mini-arrow');
    if (panel) panel.style.display = isPanelExpanded ? 'flex' : 'none';
    if (miniArrow) miniArrow.innerText = isPanelExpanded ? '▲' : '▾';
  }

  function injectAudioControllerUI() {
    if (document.getElementById('uma-audio-mixer-widget')) return;

    if (!document.getElementById('uma-audio-mixer-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'uma-audio-mixer-styles';
      styleEl.innerHTML = `
        #uma-audio-mixer-widget {
          position: fixed;
          top: 12px;
          left: 172px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          font-family: sans-serif;
          user-select: none;
        }
        #uma-audio-collapsed-pill {
          display: flex;
          align-items: center;
          gap: 5px;
          background: rgba(15, 23, 42, 0.94);
          border: 1.5px solid #38bdf8;
          border-radius: 999px;
          padding: 4px 11px;
          color: #f8fafc;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(6px);
          transition: all 0.15s ease;
        }
        #uma-audio-collapsed-pill:hover {
          background: #1e293b;
          transform: translateY(-1px);
        }
        #uma-audio-expanded-panel {
          margin-top: 6px;
          width: 245px;
          background: rgba(15, 23, 42, 0.97);
          border: 1px solid #38bdf8;
          border-radius: 12px;
          padding: 12px 14px;
          display: none;
          flex-direction: column;
          gap: 10px;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          color: #f8fafc;
        }
        input[type="range"].uma-vol-slider {
          -webkit-appearance: none !important;
          appearance: none !important;
          width: 100% !important;
          min-width: 0 !important;
          height: 6px !important;
          padding: 0 !important;
          margin: 0 !important;
          border: none !important;
          border-radius: 999px !important;
          outline: none !important;
          box-sizing: border-box !important;
          cursor: pointer !important;
        }
        input[type="range"].uma-vol-slider::-webkit-slider-runnable-track {
          height: 6px !important;
          border-radius: 999px !important;
          background: transparent !important;
        }
        input[type="range"].uma-vol-slider::-webkit-slider-thumb {
          -webkit-appearance: none !important;
          appearance: none !important;
          width: 15px !important;
          height: 15px !important;
          border-radius: 50% !important;
          background: #ffffff !important;
          border: 2px solid #0284c7 !important;
          box-shadow: 0 1px 4px rgba(0,0,0,0.7) !important;
          margin-top: -4.5px !important;
          cursor: pointer !important;
        }
        input[type="range"].uma-vol-slider::-moz-range-thumb {
          width: 15px !important;
          height: 15px !important;
          border-radius: 50% !important;
          background: #ffffff !important;
          border: 2px solid #0284c7 !important;
          box-shadow: 0 1px 4px rgba(0,0,0,0.7) !important;
          cursor: pointer !important;
        }
      `;
      document.head.appendChild(styleEl);
    }

    const widget = document.createElement('div');
    widget.id = 'uma-audio-mixer-widget';

    widget.innerHTML = `
      <div id="uma-audio-collapsed-pill" title="Bấm để mở / thu gọn bảng điều chỉnh âm lượng">
        <span id="uma-audio-mini-icon">${isMuted ? '🔇' : '🔊'}</span>
        <span id="uma-audio-mini-text">${isMuted ? 'Tắt' : `${Math.round(bgmVolume * 100)}%`}</span>
        <span id="uma-audio-mini-arrow" style="font-size:10px; color:#94a3b8;">▾</span>
      </div>

      <div id="uma-audio-expanded-panel" onclick="event.stopPropagation()">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1e293b; padding-bottom:6px;">
          <div style="font-size:10.5px; font-weight:800; color:#38bdf8; letter-spacing:0.4px;">ĐIỀU CHỈNH ÂM THANH</div>
          <button id="uma-audio-close-panel" style="width:auto; margin:0; padding:2px 8px; font-size:10px; background:#1e293b; color:#cbd5e1; border:1px solid #475569; border-radius:4px; cursor:pointer;">
            Thu nhỏ ▲
          </button>
        </div>

        <div id="uma-audio-track-label" style="font-size:10.5px; color:#e2e8f0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          Twinkle Audio Ready
        </div>

        <div style="display:flex; flex-direction:column; gap:5px;">
          <div style="display:flex; justify-content:space-between; font-size:11px; color:#cbd5e1;">
            <span>Nhạc nền (BGM)</span>
            <strong id="uma-bgm-pct-val" style="color:#38bdf8;">${Math.round(bgmVolume * 100)}%</strong>
          </div>
          <input id="uma-bgm-slider" class="uma-vol-slider" type="range" min="0" max="1" step="0.01" value="${bgmVolume}">
        </div>

        <div style="display:flex; flex-direction:column; gap:5px;">
          <div style="display:flex; justify-content:space-between; font-size:11px; color:#cbd5e1;">
            <span>Hiệu ứng (SFX)</span>
            <strong id="uma-sfx-pct-val" style="color:#facc15;">${Math.round(sfxVolume * 100)}%</strong>
          </div>
          <input id="uma-sfx-slider" class="uma-vol-slider" type="range" min="0" max="1" step="0.01" value="${sfxVolume}">
        </div>

        <button id="uma-audio-mute-btn" style="width:100%; margin:2px 0 0 0; padding:7px 10px; border-radius:6px; border:none; cursor:pointer; background:${isMuted ? '#ef4444' : '#0284c7'}; color:#fff; font-size:11.5px; font-weight:bold;">
          ${isMuted ? '🔇 Đang Tắt Tiếng (Bấm để Bật)' : '🔊 Đang Bật Tiếng (Bấm để Tắt)'}
        </button>
      </div>
    `;

    document.body.appendChild(widget);
    updateMixerUIState();

    document.getElementById('uma-audio-collapsed-pill').onclick = (e) => {
      e.stopPropagation();
      ensureContext();
      setMixerExpanded(!isPanelExpanded);
    };

    document.getElementById('uma-audio-close-panel').onclick = (e) => {
      e.stopPropagation();
      setMixerExpanded(false);
    };

    document.addEventListener('click', (e) => {
      if (isPanelExpanded && !widget.contains(e.target)) {
        setMixerExpanded(false);
      }
    });

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
      updateMixerUIState();
      if (!isMuted) playSfx('click');
    };

    document.getElementById('uma-bgm-slider').oninput = (e) => {
      ensureContext();
      bgmVolume = parseFloat(e.target.value);
      if (bgmVolume > 0 && isMuted) {
        isMuted = false;
        localStorage.setItem('twinkle_audio_muted', 'false');
      }
      localStorage.setItem('twinkle_bgm_vol', String(bgmVolume));
      if (activeHtmlAudio) {
        activeHtmlAudio.volume = isMuted ? 0 : bgmVolume;
        if (!isMuted && activeHtmlAudio.paused) {
          activeHtmlAudio.play().catch(() => {});
        }
      }
      updateMixerUIState();
    };

    document.getElementById('uma-sfx-slider').oninput = (e) => {
      ensureContext();
      sfxVolume = parseFloat(e.target.value);
      if (sfxVolume > 0 && isMuted) {
        isMuted = false;
        localStorage.setItem('twinkle_audio_muted', 'false');
      }
      localStorage.setItem('twinkle_sfx_vol', String(sfxVolume));
      updateMixerUIState();
    };

    document.getElementById('uma-sfx-slider').onchange = () => {
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
      if (btn && !btn.id.startsWith('uma-audio-')) {
        playSfx('click');
      }
    });

    if (typeof socket !== 'undefined') {
      socket.on('enter_pregame', () => {
        isInRaceEventPhase = false;
        playBgm('pregame');
      });

      socket.on('race_started', (racePacket) => {
        isInRaceEventPhase = true;
        playBgm(getRaceBgmKey(racePacket));
      });

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