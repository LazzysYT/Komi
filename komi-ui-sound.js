/* Komi Anime: a single, gentle sound for all interface controls.
   Keeps legacy playSound() calls working and honors a persistent mute setting. */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const preferenceKey = 'komi.ui.sound.enabled';
  const toggles = Array.from(document.querySelectorAll('[data-komi-sound-toggle]'));
  let enabled = true;
  let context = null;
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

  function playSoftClick() {
    if (!enabled) return;
    // Both legacy handlers and the global delegated listener can handle one click.
    // Limit the sound to one note per interaction.
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - lastClickAt < 90) return;
    lastClickAt = now;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!context) context = new AudioContextClass();
      if (context.state === 'suspended') {
        const result = context.resume();
        if (result && typeof result.catch === 'function') result.catch(() => {});
      }
      const at = context.currentTime;
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(455, at);
      oscillator.frequency.exponentialRampToValueAtTime(355, at + 0.105);
      envelope.gain.setValueAtTime(0.0001, at);
      envelope.gain.exponentialRampToValueAtTime(0.014, at + 0.009);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.115);
      oscillator.connect(envelope);
      envelope.connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.12);
      oscillator.onended = function () {
        oscillator.disconnect();
        envelope.disconnect();
      };
    } catch (_) {
      // Unsupported/restricted audio should never block a site interaction.
    }
  }

  // Old application handlers already call playSound(). Redirect them to the
  // same soft note rather than stacking the old, loud triangle oscillator.
  window.playSound = playSoftClick;

  document.addEventListener('click', function (event) {
    if (!event.target || typeof event.target.closest !== 'function') return;
    const control = event.target.closest(
      '[data-komi-sound-toggle], button, a[href], summary, select, [role="button"]'
    );
    if (!control || control.disabled || control.closest('[inert]')) return;

    if (control.hasAttribute('data-komi-sound-toggle')) {
      enabled = !enabled;
      try {
        window.localStorage.setItem(preferenceKey, enabled ? 'on' : 'off');
      } catch (_) {}
      updateButtons();
      return; // Never play a sound while enabling or disabling sound.
    }
    playSoftClick();
  }, true);

  updateButtons();
})();
