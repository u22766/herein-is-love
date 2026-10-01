// Text size: an "Aa" control in the menu that scales the reading text.
// The choice is remembered on each device. On iPhone and iPad, the starting size
// follows the system Text Size setting (Settings > Display & Brightness > Text Size).
(function () {
  const STEPS = [0.9, 1, 1.15, 1.3, 1.5, 1.75, 2];
  const root = document.documentElement;
  const clampStep = v => STEPS.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a, 1);

  function systemScale() {
    // Safari exposes the iOS Dynamic Type size through this system font keyword.
    try {
      if (!(window.CSS && CSS.supports && CSS.supports('font', '-apple-system-body'))) return 1;
      const probe = document.createElement('span');
      probe.style.cssText = 'font:-apple-system-body;position:absolute;visibility:hidden';
      (document.body || root).appendChild(probe);
      const px = parseFloat(getComputedStyle(probe).fontSize) || 17;
      probe.remove();
      return clampStep(px / 17);   // 17px is the iOS default body size
    } catch (e) { return 1; }
  }

  let saved = null;
  try { saved = parseFloat(localStorage.getItem('text-size')); } catch (e) {}
  let scale = saved > 0 ? clampStep(saved) : 1;
  const apply = () => root.style.setProperty('--ts', String(scale));
  apply();   // runs in <head>, before the page draws, so there is no jump

  function build() {
    if (!(saved > 0)) { scale = systemScale(); apply(); }
    const nav = document.querySelector('.nav');
    if (!nav || document.querySelector('.ts-wrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'ts-wrap';
    wrap.innerHTML = `
      <button type="button" class="ts-btn" aria-haspopup="true" aria-expanded="false" aria-label="Text size">Aa</button>
      <div class="ts-pop" role="group" aria-label="Text size" hidden>
        <button type="button" class="ts-small" data-d="-1" aria-label="Smaller text">A−</button>
        <output aria-live="polite"></output>
        <button type="button" class="ts-big" data-d="1" aria-label="Larger text">A+</button>
        <button type="button" class="ts-reset" data-d="0">Reset</button>
      </div>`;
    nav.appendChild(wrap);
    const btn = wrap.querySelector('.ts-btn'), pop = wrap.querySelector('.ts-pop'), out = pop.querySelector('output');
    const [smaller, bigger] = pop.querySelectorAll('[data-d="-1"], [data-d="1"]');
    const show = () => {
      out.textContent = Math.round(scale * 100) + '%';
      const i = STEPS.indexOf(scale);
      smaller.disabled = i <= 0; bigger.disabled = i >= STEPS.length - 1;
    };
    const open = on => { pop.hidden = !on; btn.setAttribute('aria-expanded', on); if (on) show(); };
    btn.addEventListener('click', e => { e.stopPropagation(); open(pop.hidden); });
    pop.addEventListener('click', e => {
      e.stopPropagation();
      const b = e.target.closest('button'); if (!b) return;
      const d = +b.dataset.d;
      if (d === 0) { scale = 1; try { localStorage.removeItem('text-size'); } catch (x) {} }
      else {
        scale = STEPS[Math.max(0, Math.min(STEPS.length - 1, STEPS.indexOf(scale) + d))];
        try { localStorage.setItem('text-size', String(scale)); } catch (x) {}
      }
      apply(); show();
    });
    document.addEventListener('click', () => open(false));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') open(false); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
