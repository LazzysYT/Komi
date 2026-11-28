/* Komi Anime interaction audio. Pack cues share the interface preference and context. */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const preferenceKey = 'komi.ui.sound.enabled';
  const toggles = Array.from(document.querySelectorAll('[data-komi-sound-toggle]'));
  let enabled = true;
  let context = null;
  let noise = null;
  let lastClickAt = -1000;

  try {
    enabled = window.localStorage.getItem(preferenceKey) !== 'off';
  } catch (_) {
    // Browsers with blocked storage can still use the sound toggle this session.
  }

  function updateButtons() {
    for (const button of toggles) {
      button.setAttribute('aria-pressed', String(enabled));
      const text = enabled ? 'Звук: включён' : 'Звук: выключен';
      button.title = enabled ? 'Выключить звук интерфейса' : 'Включить звук интерфейса';
      button.setAttribute('aria-label', button.title);
      const label = button.querySelector('.komi-sound-label');
      if (label) label.textContent = text;
      button.classList.toggle('is-muted', !enabled);
    }
  }

  function getContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!context) context = new AudioContextClass();
    if (context.state === 'suspended') context.resume()?.catch(() => {});
    return context;
  }

  function play(source, at, duration, gain, filter = null) {
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(gain, at + Math.min(0.026, duration * 0.22));
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    if (filter) {
      source.connect(filter);
      filter.connect(envelope);
    } else source.connect(envelope);
    envelope.connect(context.destination);
    source.start(at);
    source.stop(at + duration + 0.005);
    source.onended = () => {
      source.disconnect();
      filter?.disconnect();
      envelope.disconnect();
    };
  }

  function note(type, start, end, at, duration, gain) {
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(start, at);
    oscillator.frequency.exponentialRampToValueAtTime(end, at + duration);
    play(oscillator, at, duration, gain);
  }

  function rustle(type, frequency, duration, gain) {
    if (!noise) {
      noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.68), context.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource(), filter = context.createBiquadFilter();
    source.buffer = noise;
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = 0.65;
    play(source, context.currentTime, duration, gain, filter);
  }

  const worldCues = {
    ghoul: [164, 1280, 'sine', 1.12], jujutsu: [232, 1780, 'triangle', 0.83],
    frieren: [418, 2470, 'sine', 1.48], alchemist: [330, 3150, 'triangle', 1.33],
    demon: [280, 2050, 'sine', 1.50], aot: [121, 680, 'sine', 1.14],
    naruto: [354, 2850, 'sine', 1.21], bleach: [440, 2640, 'triangle', 1.20],
    onepiece: [292, 2240, 'triangle', 1.27], chainsaw: [146, 1120, 'triangle', 0.79],
    hunter: [374, 3050, 'sine', 1.36], deathnote: [201, 2260, 'sine', 0.95],
    heroacademia: [493, 1920, 'triangle', 1.50], sololeveling: [176, 930, 'sine', 0.62]
  };
  function playPackCue(world, cue, strength = 0.5) {
    if (!enabled || !Object.hasOwn(worldCues, world)) return;
    try {
      if (!getContext()) return;
      const [pitch, texture, wave, interval] = worldCues[world], at = context.currentTime;
      if (cue === 'crease') {
        rustle('bandpass', texture * (0.7 + strength * 0.6), 0.12, 0.018 + strength * 0.012);
      } else if (cue === 'tear') {
        rustle('highpass', texture, 0.24, 0.06);
        note('sine', pitch, pitch * 0.67, at, 0.18, 0.025);
      } else if (cue === 'place') {
        note('sine', pitch * 1.3, pitch * 0.88, at, 0.11, 0.025);
      } else if (cue === 'flip') {
        if (world === 'aot') rustle('lowpass', 550, 0.60, 0.045);
        if (world === 'deathnote') rustle('highpass', 2420, 0.42, 0.046);
        note(wave, pitch, pitch * interval, at, 0.36, 0.042);
        note('sine', pitch * interval, pitch * interval * 0.93, at + 0.13, 0.31, 0.022);
        if (world === 'sololeveling') note('sine', pitch * interval, pitch * 0.48, at + 0.26, 0.39, 0.015);
      }
    } catch (_) {
      // Optional audio must never block a pack or a purchase.
    }
  }

  function playSoftClick() {
    if (!enabled) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - lastClickAt < 90) return;
    lastClickAt = now;
    try {
      if (getContext()) note('sine', 455, 355, context.currentTime, 0.115, 0.014);
    } catch (_) {}
  }

  window.playSound = playSoftClick;
  window.KomiUISound = Object.freeze({playPackCue});

  document.addEventListener('click', function (event) {
    if (!event.target || typeof event.target.closest !== 'function') return;
    const control = event.target.closest('[data-komi-sound-toggle], button, a[href], summary, select, [role="button"]');
    if (!control || control.disabled || control.closest('[inert]')) return;
    if (control.hasAttribute('data-komi-sound-toggle')) {
      enabled = !enabled;
      try {
        window.localStorage.setItem(preferenceKey, enabled ? 'on' : 'off');
      } catch (_) {}
      updateButtons();
      return;
    }
    if (control.matches('[data-kc-action="peel"], [data-kc-action^="pick-card-"]')) return;
    playSoftClick();
  }, true);

  updateButtons();
})();
