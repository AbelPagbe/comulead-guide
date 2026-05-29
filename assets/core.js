/* ============================================================
   COMULEAD — GUIDE UTILISATEUR INTERACTIF
   core.js — Moteur bilingue + progression + navigation
   ============================================================ */

/* ── LANGUE ──────────────────────────────────────────────────── */
const Lang = (() => {
  const STORAGE_KEY = 'cml_guide_lang';
  let current = localStorage.getItem(STORAGE_KEY) || 'fr';

  const set = (lang) => {
    current = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.setAttribute('lang', lang);
    // Re-render all translatable elements
    document.querySelectorAll('[data-fr]').forEach(el => {
      el.textContent = lang === 'fr' ? el.dataset.fr : el.dataset.en;
    });
    document.querySelectorAll('[data-fr-html]').forEach(el => {
      el.innerHTML = lang === 'fr' ? el.dataset.frHtml : el.dataset.enHtml;
    });
    // Sync buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
  };

  const get = () => current;
  const t = (obj) => obj[current] || obj['fr'];

  const init = () => {
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => set(btn.dataset.lang));
    });
    set(current); // apply on load
  };

  return { set, get, t, init };
})();

/* ── PROGRESSION ─────────────────────────────────────────────── */
const Progress = (() => {
  const STORAGE_KEY = 'cml_guide_progress';

  const load = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  };

  const save = (data) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  // moduleId: string (ex: 'module-01')
  // stepIndex: number (0-based)
  const markStep = (moduleId, stepIndex) => {
    const data = load();
    if (!data[moduleId]) data[moduleId] = { completedSteps: [] };
    if (!data[moduleId].completedSteps.includes(stepIndex)) {
      data[moduleId].completedSteps.push(stepIndex);
    }
    save(data);
  };

  const markModuleDone = (moduleId) => {
    const data = load();
    if (!data[moduleId]) data[moduleId] = { completedSteps: [] };
    data[moduleId].done = true;
    save(data);
    unlockNext(moduleId);
  };

  const unlockNext = (moduleId) => {
    const data = load();
    const num = parseInt(moduleId.split('-')[1]);
    const nextId = `module-${String(num + 1).padStart(2, '0')}`;
    if (!data[nextId]) data[nextId] = {};
    data[nextId].unlocked = true;
    save(data);
  };

  const isModuleDone = (moduleId) => {
    const data = load();
    return !!(data[moduleId]?.done);
  };

  const isModuleUnlocked = (moduleId) => {
    if (moduleId === 'module-01') return true; // premier toujours débloqué
    const data = load();
    return !!(data[moduleId]?.unlocked);
  };

  const getCompletedSteps = (moduleId) => {
    const data = load();
    return data[moduleId]?.completedSteps || [];
  };

  const getGlobalPercent = (totalModules) => {
    const data = load();
    const done = Object.values(data).filter(m => m.done).length;
    return Math.round((done / totalModules) * 100);
  };

  const reset = () => { localStorage.removeItem(STORAGE_KEY); };

  return {
    markStep, markModuleDone, isModuleDone, isModuleUnlocked,
    getCompletedSteps, getGlobalPercent, reset, load
  };
})();

/* ── CAPSULE ENGINE ──────────────────────────────────────────── */
const Capsule = (() => {
  let moduleId   = '';
  let totalSteps = 0;
  let currentStep = 0;

  const init = (config) => {
    moduleId   = config.moduleId;
    totalSteps = config.totalSteps;
    currentStep = 0;

    // Restore last step if module not done
    const completed = Progress.getCompletedSteps(moduleId);
    if (!Progress.isModuleDone(moduleId) && completed.length > 0) {
      currentStep = Math.min(completed.length, totalSteps - 1);
    }

    renderStep(currentStep);
    renderSidebar();
    renderProgress();
  };

  const goToStep = (index) => {
    if (index < 0 || index >= totalSteps) return;
    currentStep = index;
    Progress.markStep(moduleId, index);
    renderStep(index);
    renderSidebar();
    renderProgress();
    // Scroll top
    document.querySelector('.capsule-main')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const next = () => {
    if (currentStep < totalSteps - 1) {
      goToStep(currentStep + 1);
    } else {
      // Dernière étape → marquer module complet
      Progress.markModuleDone(moduleId);
      renderCompletion();
    }
  };

  const prev = () => { if (currentStep > 0) goToStep(currentStep - 1); };

  // Ces fonctions sont injectées par chaque capsule
  let _renderStepFn    = null;
  let _renderSidebarFn = null;

  const registerRenderers = (stepFn, sidebarFn) => {
    _renderStepFn    = stepFn;
    _renderSidebarFn = sidebarFn;
  };

  const renderStep = (index) => {
    if (_renderStepFn) _renderStepFn(index);
  };

  const renderSidebar = () => {
    if (_renderSidebarFn) _renderSidebarFn(currentStep);
  };

  const renderProgress = () => {
    const pct = Math.round(((currentStep + 1) / totalSteps) * 100);
    const fill = document.querySelector('.progress-fill');
    const pctEl = document.querySelector('.sidebar-progress-pct');
    if (fill) fill.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
  };

  const renderCompletion = () => {
    const main = document.querySelector('.capsule-main');
    if (!main) return;
    const lang = Lang.get();
    // Calcul dynamique du module suivant
    const num = parseInt(moduleId.split('-')[1]);
    const nextNum = String(num + 1).padStart(2, '0');
    const nextFile = `module-${nextNum}.html`;
    main.innerHTML = `
      <div class="completion-banner step-content">
        <div class="completion-icon">🎉</div>
        <h2 class="completion-title">${lang === 'fr'
          ? 'Module complété !'
          : 'Module complete!'}</h2>
        <p class="completion-text">${lang === 'fr'
          ? 'Excellent travail ! Tu as terminé ce module et débloqué le prochain. Continue ton parcours.'
          : 'Excellent work! You have completed this module and unlocked the next one. Continue your journey.'}</p>
        <div class="completion-actions">
          <a href="index.html" class="btn btn-ghost">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
            ${lang === 'fr' ? 'Retour au hub' : 'Back to hub'}
          </a>
          <a href="${nextFile}" class="btn btn-success">
            ${lang === 'fr' ? 'Module suivant' : 'Next module'}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
        </div>
      </div>
    `;
    // Update sidebar all done
    document.querySelectorAll('.step-indicator').forEach(el => {
      el.className = 'step-indicator done';
      el.innerHTML = svgCheck();
    });
    document.querySelectorAll('.sidebar-step').forEach(el => {
      el.classList.remove('active', 'locked');
      el.classList.add('done');
    });
    const fill = document.querySelector('.progress-fill');
    const pctEl = document.querySelector('.sidebar-progress-pct');
    if (fill) fill.style.width = '100%';
    if (pctEl) pctEl.textContent = '100%';
  };

  const getCurrent = () => currentStep;

  return { init, goToStep, next, prev, registerRenderers, getCurrent };
})();

/* ── UTILS ───────────────────────────────────────────────────── */
const svgCheck = () =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width:12px;height:12px"><path d="M20 6L9 17l-5-5"/></svg>`;

const svgArrowRight = () =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;

const svgArrowLeft = () =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5m7 7-7-7 7-7"/></svg>`;

const svgHome = () =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>`;

const svgLock = () =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`;

/* ── INIT GLOBAL ─────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  Lang.init();
});
