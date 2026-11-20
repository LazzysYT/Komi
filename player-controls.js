(function (root) {
    'use strict';

    const preferences = {volume: 1, muted: false, rate: 1};

    function formatTime(seconds) {
        if (!Number.isFinite(seconds)) return '00:00';
        const total = Math.max(0, Math.floor(seconds));
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor(total / 60) % 60;
        const tail = String(total % 60).padStart(2, '0');
        const clock = String(minutes).padStart(2, '0') + ':' + tail;
        return hours ? hours + ':' + clock : clock;
    }

    root.mountKomiPlaybackControls = function (video) {
        const lifecycle = new AbortController();
        const {signal} = lifecycle;
        const listen = (target, event, handler) => target.addEventListener(event, handler, {signal});
        const panel = document.createElement('div');
        panel.className = 'komi-playback';
        panel.setAttribute('role', 'group');
        panel.setAttribute('aria-label', 'Управление видео');
        panel.innerHTML = `
            <div class="komi-playback-row">
                <button type="button" data-control="play" aria-label="Воспроизвести" title="Воспроизвести"><span aria-hidden="true"></span></button>
                <input class="komi-playback-seek" type="range" min="0" max="0" step="any" value="0" aria-label="Позиция видео" disabled>
                <span class="komi-playback-time">00:00/00:00</span>
                <button type="button" data-control="mute" aria-label="Выключить звук" title="Выключить звук">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M12 5 7 9H3v6h4l5 4z"/>
                        <path class="komi-sound-waves" d="M15 9a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12"/>
                        <path class="komi-sound-off" d="m16 10 5 5m0-5-5 5"/>
                    </svg>
                </button>
                <details class="komi-playback-settings">
                    <summary aria-label="Настройки видео" title="Настройки видео">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">
                            <path d="M9.6 3h4.8l.6 2.4 1.7 1 2.4-.7 2.4 4.2-1.8 1.7v2l1.8 1.7-2.4 4.2-2.4-.7-1.7 1-.6 2.4H9.6L9 19.8l-1.7-1-2.4.7-2.4-4.2 1.8-1.7v-2L2.5 9.9l2.4-4.2 2.4.7 1.7-1z"/>
                            <circle cx="12" cy="12.5" r="3.1"/>
                        </svg>
                    </summary>
                    <div class="komi-playback-menu">
                        <label>Громкость <input class="komi-playback-volume" type="range" min="0" max="1" step="0.05" value="1"></label>
                        <label data-caption-setting hidden>Субтитры <select data-control="captions"></select></label>
                        <label>Скорость <select data-control="rate" aria-label="Скорость воспроизведения">
                            <option value="0.5">0,5×</option><option value="0.75">0,75×</option>
                            <option value="1" selected>1×</option><option value="1.25">1,25×</option>
                            <option value="1.5">1,5×</option><option value="2">2×</option>
                        </select></label>
                        <div class="komi-playback-jump" role="group" aria-label="Перемотка">
                            <button type="button" data-control="back" aria-label="Назад на 10 секунд" disabled>−10 с</button>
                            <button type="button" data-control="forward" aria-label="Вперёд на 10 секунд" disabled>+10 с</button>
                        </div>
                    </div>
                </details>
                <button type="button" data-control="pip" aria-label="Картинка в картинке" title="Картинка в картинке" aria-pressed="false" hidden>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><rect x="12" y="12" width="9" height="7" rx="1"/></svg>
                </button>
            </div>`;
        const status = document.createElement('div');
        status.className = 'komi-playback-state';
        status.setAttribute('role', 'status');
        const message = document.createElement('span');
        message.textContent = 'Загрузка видео…';
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = 'Повторить';
        retry.hidden = true;
        status.append(message, retry);
        const control = name => panel.querySelector('[data-control="' + name + '"]');
        const play = control('play');
        const back = control('back');
        const forward = control('forward');
        const mute = control('mute');
        const pip = control('pip');
        const captions = control('captions');
        const captionSetting = panel.querySelector('[data-caption-setting]');
        const settings = panel.querySelector('details');
        const settingsToggle = settings.querySelector('summary');
        const rate = control('rate');
        const seek = panel.querySelector('.komi-playback-seek');
        const volume = panel.querySelector('.komi-playback-volume');
        const time = panel.querySelector('.komi-playback-time');
        const wrapper = video.closest('.player-wrapper');
        let tracks = [];
        let failed = false;

        function renderTimeline() {
            const duration = video.duration;
            const canSeek = Number.isFinite(duration) && duration > 0 && !failed;
            seek.disabled = back.disabled = forward.disabled = !canSeek;
            seek.max = canSeek ? duration : 0;
            seek.value = canSeek ? video.currentTime : 0;
            seek.style.setProperty('--komi-played', canSeek ? Math.min(100, video.currentTime / duration * 100) + '%' : '0%');
            const label = duration === Infinity ? 'Прямой эфир' : formatTime(video.currentTime) + '/' + formatTime(duration);
            time.textContent = label;
            seek.setAttribute('aria-valuetext', label);
        }

        function renderPlayback() {
            const paused = video.paused || video.ended;
            play.dataset.playing = String(!paused);
            play.title = paused ? 'Воспроизвести' : 'Пауза';
            play.setAttribute('aria-label', play.title);
            wrapper.classList.toggle('komi-playback-running', !paused && !failed);
        }

        function renderVolume() {
            const silent = video.muted || video.volume === 0;
            mute.dataset.muted = String(silent);
            mute.title = silent ? 'Включить звук' : 'Выключить звук';
            mute.setAttribute('aria-label', mute.title);
            volume.value = video.muted ? 0 : video.volume;
        }

        function renderCaptions() {
            tracks = Array.from(video.textTracks).filter(track => ['subtitles', 'captions'].includes(track.kind));
            captionSetting.hidden = !tracks.length;
            captions.replaceChildren(new Option('Без субтитров', 'off'));
            tracks.forEach((track, index) => captions.add(new Option(
                track.label || track.language || 'Дорожка ' + (index + 1), String(index)
            )));
            const showing = tracks.findIndex(track => track.mode === 'showing');
            captions.value = showing === -1 ? 'off' : String(showing);
        }

        function seekTo(seconds) {
            if (!seek.disabled) video.currentTime = Math.max(0, Math.min(video.duration, seconds));
        }

        listen(play, 'click', () => {
            if (!video.paused) { video.pause(); return; }
            video.play().catch(error => {
                if (signal.aborted || failed || !video.paused || error.name === 'AbortError') return;
                message.textContent = 'Не удалось начать воспроизведение.';
                status.hidden = false;
            });
        });
        listen(back, 'click', () => seekTo(video.currentTime - 10));
        listen(forward, 'click', () => seekTo(video.currentTime + 10));
        listen(seek, 'input', () => seekTo(seek.valueAsNumber));
        listen(mute, 'click', () => {
            if (video.volume === 0) { video.volume = 1; video.muted = false; }
            else video.muted = !video.muted;
        });
        listen(volume, 'input', () => {
            video.volume = volume.valueAsNumber;
            video.muted = false;
            renderVolume();
        });
        const standardPiP = document.pictureInPictureEnabled === true &&
            typeof video.requestPictureInPicture === 'function';
        const safariPiP = typeof video.webkitSupportsPresentationMode === 'function' &&
            typeof video.webkitSetPresentationMode === 'function' &&
            video.webkitSupportsPresentationMode('picture-in-picture');
        pip.hidden = !standardPiP && !safariPiP;
        listen(pip, 'click', async () => {
            try {
                if (standardPiP) {
                    if (document.pictureInPictureElement === video) await document.exitPictureInPicture();
                    else await video.requestPictureInPicture();
                } else if (safariPiP) {
                    video.webkitSetPresentationMode(
                        video.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture');
                    pip.setAttribute('aria-pressed', String(video.webkitPresentationMode === 'picture-in-picture'));
                }
            } catch {
                if (signal.aborted || failed) return;
                message.textContent = 'Режим «Картинка в картинке» сейчас недоступен.';
                status.hidden = false;
            }
        });
        listen(video, 'enterpictureinpicture', () => pip.setAttribute('aria-pressed', 'true'));
        listen(video, 'leavepictureinpicture', () => pip.setAttribute('aria-pressed', 'false'));
        listen(video, 'webkitpresentationmodechanged', () =>
            pip.setAttribute('aria-pressed', String(video.webkitPresentationMode === 'picture-in-picture')));
        listen(document, 'pointerdown', event => {
            if (settings.open && !settings.contains(event.target)) settings.open = false;
        });
        listen(settings, 'keydown', event => {
            if (event.key !== 'Escape' || !settings.open) return;
            event.stopPropagation();
            event.preventDefault();
            settings.open = false;
            settingsToggle.focus();
        });
        listen(captions, 'change', () => {
            tracks.forEach((track, index) => { track.mode = captions.value === String(index) ? 'showing' : 'disabled'; });
        });
        listen(rate, 'change', () => { video.playbackRate = Number(rate.value); });
        listen(retry, 'click', () => document.getElementById('komiRetryPlayer')?.click());

        for (const event of ['loadedmetadata', 'durationchange', 'timeupdate', 'seeked'])
            listen(video, event, renderTimeline);
        for (const event of ['play', 'pause', 'ended'])
            listen(video, event, renderPlayback);
        for (const event of ['loadedmetadata', 'canplay', 'playing'])
            listen(video, event, () => { if (!failed) status.hidden = true; });
        listen(video, 'waiting', () => {
            if (failed || video.paused) return;
            message.textContent = 'Загрузка видео…';
            status.hidden = false;
        });
        listen(video, 'volumechange', () => {
            preferences.volume = video.volume;
            preferences.muted = video.muted;
            renderVolume();
        });
        listen(video, 'ratechange', () => { rate.value = preferences.rate = video.playbackRate; });
        for (const event of ['addtrack', 'removetrack', 'change'])
            listen(video.textTracks, event, renderCaptions);

        video.volume = preferences.volume;
        video.muted = preferences.muted;
        video.defaultPlaybackRate = preferences.rate;
        video.playbackRate = preferences.rate;
        rate.value = preferences.rate;
        renderCaptions();
        renderVolume();
        renderPlayback();
        video.parentElement.append(status, panel);
        wrapper.classList.add('komi-playback-custom');
        video.controls = false;

        return {
            showError() {
                failed = true;
                wrapper.classList.add('komi-playback-failed');
                play.disabled = true;
                renderTimeline();
                renderPlayback();
                status.hidden = false;
                retry.hidden = false;
                message.textContent = 'Видео недоступно.';
            },
            dispose() { lifecycle.abort(); }
        };
    };
})(globalThis);
