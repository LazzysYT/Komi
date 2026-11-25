/* Keep the existing publisher SDK behind critical content and app startup.
 * https://web.dev/articles/optimizing-content-efficiency-loading-third-party-javascript
 */
(function (root) {
  'use strict';
  const document = root.document;
  if (!document || root.komiAdsStartupScheduled) return;
  root.komiAdsStartupScheduled = true;
  const source = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4262066374546613';
  function hasSDK() {
    return [...document.querySelectorAll('script[src]')].some(script => {
      try {
        const url = new URL(script.src,document.baseURI);
        return url.origin === 'https://pagead2.googlesyndication.com' &&
          url.pathname === '/pagead/js/adsbygoogle.js';
      } catch { return false; }
    });
  }
  if (hasSDK()) return;

  let domReady = false, imageReady = false, framesStarted = false;
  let paintReady = false, inserted = false;
  let domTimer = null, frameTimer = null, firstFrame = null, secondFrame = null;
  let idle = null, task = null;
  function removeDOMListeners() {
    document.removeEventListener('DOMContentLoaded',onDOMReady);
    root.removeEventListener('load',onDOMReady);
    if (domTimer !== null) { root.clearTimeout(domTimer); domTimer = null; }
  }
  function clearFrames() {
    if (frameTimer !== null) { root.clearTimeout(frameTimer); frameTimer = null; }
    if (firstFrame !== null) { root.cancelAnimationFrame?.(firstFrame); firstFrame = null; }
    if (secondFrame !== null) { root.cancelAnimationFrame?.(secondFrame); secondFrame = null; }
  }
  function loadSDK() {
    if (inserted) return;
    inserted = true;
    removeDOMListeners();
    clearFrames();
    if (idle !== null) { root.cancelIdleCallback?.(idle); idle = null; }
    if (task !== null) { root.clearTimeout(task); task = null; }
    if (hasSDK()) return;
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = source;
    document.head.append(script);
  }
  function afterPaint() {
    if (paintReady) return;
    paintReady = true;
    clearFrames();
    if (typeof root.requestIdleCallback === 'function')
      idle = root.requestIdleCallback(loadSDK,{timeout:1000});
    else task = root.setTimeout(loadSDK,0);
  }
  function preparePaint() {
    if (framesStarted || !domReady || !imageReady) return;
    framesStarted = true;
    // Hidden documents can suspend RAF; this fallback never waits indefinitely.
    frameTimer = root.setTimeout(afterPaint,1000);
    if (typeof root.requestAnimationFrame === 'function') {
      firstFrame = root.requestAnimationFrame(() => {
        firstFrame = null;
        secondFrame = root.requestAnimationFrame(() => { secondFrame = null; afterPaint(); });
      });
    } else afterPaint();
  }
  function onDOMReady() {
    if (domReady) return;
    domReady = true;
    removeDOMListeners();
    preparePaint();
  }

  // A deferred loader runs while readyState is interactive, before the rest of
  // the deferred queue finishes. Wait for the actual DOMContentLoaded event.
  if (document.readyState === 'complete') onDOMReady();
  else {
    document.addEventListener('DOMContentLoaded',onDOMReady,{once:true});
    root.addEventListener('load',onDOMReady,{once:true});
    domTimer = root.setTimeout(onDOMReady,5000);
  }
  // The boot image promise has its own 4200ms deadline. Failures release this
  // gate too; other routes have no hero image and proceed after app startup.
  Promise.resolve(root.KomiHeroDaily?.firstImage?.promise).catch(() => {}).then(() => {
    imageReady = true;
    preparePaint();
  });
})(globalThis);
