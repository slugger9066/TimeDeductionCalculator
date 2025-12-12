// Frontend logic: validates inputs, sends request to /api/calc, and displays results.
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('calcForm');
  const pctInput = document.getElementById('percentage');
  const pctRange = document.getElementById('pctRange');
  const pctDisplay = document.getElementById('pctDisplay');
  const pctError = document.getElementById('pctError');
  const calcBtn = document.getElementById('calcBtn');
  const resetBtn = document.getElementById('resetBtn');
  const results = document.getElementById('results');
  const origText = document.getElementById('origText');
  const newText = document.getElementById('newText');
  const savedText = document.getElementById('savedText');
  const compactText = document.getElementById('compactText');
  const copyHumanBtn = document.getElementById('copyHumanBtn');
  const copyCompactBtn = document.getElementById('copyCompactBtn');
  const randomBtn = document.getElementById('randomBtn');
  const totalSecondsEl = document.getElementById('totalSeconds');

  // client-side max to match server default; can be updated to fetch from server
  const MAX_PERCENTAGE = 10000;

  // debounce helper
  function debounce(fn, wait){
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(()=> fn(...args), wait);
    };
  }

  // Toast helper
  const toastEl = document.getElementById('toast');
  function showToast(msg, ms = 1500){
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.setAttribute('aria-hidden','false');
    toastEl.classList.add('show');
    setTimeout(()=>{ toastEl.classList.remove('show'); toastEl.setAttribute('aria-hidden','true'); }, ms);
  }

  function updatePctDisplay(val){
    if (!pctDisplay) return;
    pctDisplay.value = String(val) + '%';
    pctDisplay.textContent = String(val) + '%';
  }
  if (pctInput) pctInput.addEventListener('input', () => { pctRange.value = pctInput.value; updatePctDisplay(pctInput.value); if (pctError) { pctError.style.display = 'none'; pctError.textContent = ''; } });
  if (pctRange) pctRange.addEventListener('input', () => { pctInput.value = pctRange.value; updatePctDisplay(pctRange.value); if (pctError) { pctError.style.display = 'none'; pctError.textContent = ''; } });

  function readDuration() {
    const formData = new FormData(form);
    const days = Number(formData.get('days')) || 0;
    const hours = Number(formData.get('hours')) || 0;
    const minutes = Number(formData.get('minutes')) || 0;
    const seconds = Number(formData.get('seconds')) || 0;
    return { days, hours, minutes, seconds };
  }

  function humanize(breakdown) {
    const parts = [];
    if (breakdown.days) parts.push(breakdown.days + ' day' + (breakdown.days === 1 ? '' : 's'));
    if (breakdown.hours) parts.push(breakdown.hours + ' hour' + (breakdown.hours === 1 ? '' : 's'));
    if (breakdown.minutes) parts.push(breakdown.minutes + ' minute' + (breakdown.minutes === 1 ? '' : 's'));
    if (breakdown.seconds) parts.push(breakdown.seconds + ' second' + (breakdown.seconds === 1 ? '' : 's'));
    if (!parts.length) return '0 seconds';
    return parts.join(', ');
  }

  function compactFormat(b) {
    // e.g. "12d 13:58:57" or "0d 08:00:00"
    const d = b.days || 0;
    const hh = String(b.hours || 0).padStart(2, '0');
    const mm = String(b.minutes || 0).padStart(2, '0');
    const ss = String(b.seconds || 0).padStart(2, '0');
    return `${d}d ${hh}:${mm}:${ss}`;
  }

  // Breakdown seconds into days/hours/minutes/seconds (same logic as server)
  function breakdownSeconds(seconds) {
    let s = Math.max(0, Math.round(seconds));
    const days = Math.floor(s / 86400);
    s -= days * 86400;
    const hours = Math.floor(s / 3600);
    s -= hours * 3600;
    const minutes = Math.floor(s / 60);
    s -= minutes * 60;
    return { days, hours, minutes, seconds: s };
  }

  // Local computation to provide instant results; calls the same math as server.
  function computeLocal(duration, pct) {
    const days = Number(duration.days) || 0;
    const hours = Number(duration.hours) || 0;
    const minutes = Number(duration.minutes) || 0;
    const seconds = Number(duration.seconds) || 0;
    const original = Math.round(((days * 24 + hours) * 60 + minutes) * 60 + seconds);
    const divisor = 1 + (Number(pct) || 0) / 100;
    const nw = Math.round(original / divisor);
    const saved = Math.max(0, original - nw);
    return {
      original: { totalSeconds: original, breakdown: breakdownSeconds(original) },
      new: { totalSeconds: nw, breakdown: breakdownSeconds(nw) },
      saved: { totalSeconds: saved, breakdown: breakdownSeconds(saved) }
    };
  }

  function updateTotalPreview() {
    const d = readDuration();
    const total = ((d.days * 24 + d.hours) * 60 + d.minutes) * 60 + d.seconds;
    if (totalSecondsEl) totalSecondsEl.textContent = String(total);
  }

  // Live UI update (local compute) — debounced server validation is separate
  function updateLiveUI(){
    const duration = readDuration();
    const pct = Number(pctInput.value) || 0;
    const local = computeLocal(duration, pct);
    origText.textContent = humanize(local.original.breakdown) + ` (${local.original.totalSeconds} s)`;
    newText.textContent = humanize(local.new.breakdown) + ` (${local.new.totalSeconds} s)`;
    savedText.textContent = humanize(local.saved.breakdown) + ` (${local.saved.totalSeconds} s)`;
    compactText.textContent = compactFormat(local.new.breakdown);
    results.classList.remove('hidden');
    copyHumanBtn.dataset.copy = newText.textContent;
    copyCompactBtn.dataset.copy = compactText.textContent;
  }

  const debouncedServerValidate = debounce((duration, pct) => {
    // call server to validate and update results if necessary
    calculate({ percentage: pct, duration }).then((data) => {
      if (!data) return;
      origText.textContent = humanize(data.original.breakdown) + ` (${data.original.totalSeconds} s)`;
      newText.textContent = humanize(data.new.breakdown) + ` (${data.new.totalSeconds} s)`;
      savedText.textContent = humanize(data.saved.breakdown) + ` (${data.saved.totalSeconds} s)`;
      compactText.textContent = compactFormat(data.new.breakdown);
      copyHumanBtn.dataset.copy = newText.textContent;
      copyCompactBtn.dataset.copy = compactText.textContent;
    }).catch(()=>{});
  }, 600);

  async function calculate(payload) {
    try {
      const resp = await fetch('/api/calc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        const err = await resp.json().catch(()=>({error:resp.statusText}));
        throw new Error(err.error || resp.statusText);
      }
      return resp.json();
    } catch (err) {
      throw err;
    }
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    // Immediate local compute for responsive UI
    const duration = readDuration();
    const pct = Number(pctInput.value);
    if (!Number.isFinite(pct) || pct < 0) {
      if (pctError) { pctError.textContent = 'Enter a valid non-negative percentage'; pctError.style.display = 'block'; }
      return;
    }
    if (pct > MAX_PERCENTAGE) {
      if (pctError) { pctError.textContent = `Maximum percentage is ${MAX_PERCENTAGE}`; pctError.style.display = 'block'; }
      return;
    }

    // Show quick local result
    const local = computeLocal(duration, pct);
    origText.textContent = humanize(local.original.breakdown) + ` (${local.original.totalSeconds} s)`;
    newText.textContent = humanize(local.new.breakdown) + ` (${local.new.totalSeconds} s)`;
    savedText.textContent = humanize(local.saved.breakdown) + ` (${local.saved.totalSeconds} s)`;
    compactText.textContent = compactFormat(local.new.breakdown);
    results.classList.remove('hidden');
    copyHumanBtn.dataset.copy = newText.textContent;
    copyCompactBtn.dataset.copy = compactText.textContent;

    // Still call the server in background to validate and sync results.
    calcBtn.disabled = true;
    calcBtn.textContent = 'Calculating...';
    calculate({ percentage: pct, duration }).then((data) => {
      // Only update UI if server result differs from local (or to correct rounding)
      if (!data) return;
      const serverNew = data.new.totalSeconds;
      if (serverNew !== local.new.totalSeconds) {
        origText.textContent = humanize(data.original.breakdown) + ` (${data.original.totalSeconds} s)`;
        newText.textContent = humanize(data.new.breakdown) + ` (${data.new.totalSeconds} s)`;
        savedText.textContent = humanize(data.saved.breakdown) + ` (${data.saved.totalSeconds} s)`;
        compactText.textContent = compactFormat(data.new.breakdown);
        copyHumanBtn.dataset.copy = newText.textContent;
        copyCompactBtn.dataset.copy = compactText.textContent;
      }
    }).catch(err => {
      // background validation failed — keep local result but log
      console.warn('Server validation failed:', err && err.message ? err.message : err);
    }).finally(() => {
      calcBtn.disabled = false;
      calcBtn.textContent = 'Calculate';
    });
  });

  resetBtn.addEventListener('click', () => {
    form.reset();
    if (pctInput) pctInput.value = 20;
    if (pctRange) pctRange.value = 20;
    results.classList.add('hidden');
    updateTotalPreview();
  });

  // increment/decrement handlers for the field controls
  document.querySelectorAll('.numControl .inc, .numControl .dec').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const el = e.currentTarget;
      const fld = el.dataset.field;
      const input = form.elements[fld];
      if (!input) return;
      const step = Number(input.step) || 1;
      const min = input.hasAttribute('min') ? Number(input.min) : -Infinity;
      const max = input.hasAttribute('max') ? Number(input.max) : Infinity;
      const cur = Number(input.value) || 0;
      const delta = el.classList.contains('inc') ? step : -step;
      let next = cur + delta;
      if (next < min) next = min;
      if (next > max) next = max;
      input.value = next;
      updateTotalPreview();
    });
  });

  // update total preview when inputs change
  Array.from(form.querySelectorAll('input[type="number"]')).forEach(inp => {
    inp.addEventListener('input', () => { updateTotalPreview(); updateLiveUI(); debouncedServerValidate(readDuration(), Number(pctInput.value)); });
  });
  if (pctInput) pctInput.addEventListener('input', () => { updateLiveUI(); debouncedServerValidate(readDuration(), Number(pctInput.value)); });

  // Randomize original duration and percentage
  randomBtn.addEventListener('click', () => {
    // random realistic values: days 0-120, hours 0-23, minutes 0-59, seconds 0-59
    const rd = Math.floor(Math.random() * 121);
    const rh = Math.floor(Math.random() * 24);
    const rm = Math.floor(Math.random() * 60);
    const rs = Math.floor(Math.random() * 60);
    form.elements.days.value = rd;
    form.elements.hours.value = rh;
    form.elements.minutes.value = rm;
    form.elements.seconds.value = rs;
    // random percentage 0-500 with one decimal
    const rp = Math.round((Math.random() * 500) * 10) / 10;
    pctInput.value = rp;
    pctRange.value = rp;
    pctDisplay.textContent = rp + '%';
    updateLiveUI();
    updateTotalPreview();
  });

  if (copyHumanBtn) copyHumanBtn.addEventListener('click', async () => {
    const text = copyHumanBtn.dataset.copy || newText.textContent || '';
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied');
    } catch (err) {
      alert('Could not copy to clipboard');
    }
  });
  if (copyCompactBtn) copyCompactBtn.addEventListener('click', async () => {
    const text = copyCompactBtn.dataset.copy || compactText.textContent || '';
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied');
    } catch (err) {
      alert('Could not copy to clipboard');
    }
  });

  const shareBtn = document.getElementById('shareBtn');
  if (shareBtn) shareBtn.addEventListener('click', () => {
    // compact share format: days:hours:minutes:seconds|pct
    const d = readDuration();
    const pct = Number(pctInput.value) || 0;
    const compact = `${d.days}:${d.hours}:${d.minutes}:${d.seconds}|${pct}`;
    navigator.clipboard.writeText(compact).then(()=> showToast('Share string copied')).catch(()=> alert('Could not copy share string'));
  });

  // presets removed — keep random and manual inputs

  // initialize pct display and total preview
  if (pctDisplay && pctInput) updatePctDisplay(pctInput.value);
  updateTotalPreview();
});
