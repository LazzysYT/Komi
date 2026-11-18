/* Keep secondary anime details in the existing watch-screen disclosure. */
(function (root) {
  'use strict';
  if (typeof root.KomiPlayerUX?.mount !== 'function') return;

  const previousMount = root.KomiPlayerUX.mount;
  root.KomiPlayerUX.mount = function mountWatchDetails(settings = {}) {
    const context = previousMount(settings);
    const layout = context?.content.querySelector('.watch-cinema-layout');
    const stage = layout?.querySelector('.komi-watch-stage');
    if (!stage) return context;

    const details = document.createElement('details');
    details.className = 'komi-clean-extras';
    const summary = document.createElement('summary');
    summary.textContent = 'Об аниме, списки и комментарии';
    const body = document.createElement('div');
    body.className = 'komi-clean-extras-body';
    for (const child of Array.from(layout.children)) {
      if (child !== stage) body.append(child);
    }
    details.append(summary, body);
    layout.append(details);
    return context;
  };
})(globalThis);
