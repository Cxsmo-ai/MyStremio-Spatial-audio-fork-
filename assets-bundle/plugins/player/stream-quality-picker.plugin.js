/**
 * @name StreamQualityPicker
 * @description Groups streams by resolution with smart ranking, visual badges, seeder strength bars, and one-tap Best Pick buttons.
 * @updateUrl https://raw.githubusercontent.com/JZOnTheGit/stream-quality-picker/refs/heads/main/stream-quality-picker.plugin.js
 * @version 2.0.0
 * @author JZOnTheGit
 */

(function () {
  'use strict';

  const STYLE_ID  = 'sqp-styles';
  const CONT_ID   = 'sqp-root';
  const HIDE_CLS  = 'sqp-hidden';
  const PANEL_CLS = 'sqp-panel';

  const TIERS = {
    '4K':      { label: '4K',    color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.18)',  order: 0 },
    '1080p':   { label: '1080p', color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.18)',  order: 1 },
    '720p':    { label: '720p',  color: '#facc15', bg: 'rgba(250,204,21,0.12)',  border: 'rgba(250,204,21,0.18)',  order: 2 },
    'SD':      { label: 'SD',    color: '#a1a1aa', bg: 'rgba(161,161,170,0.10)', border: 'rgba(161,161,170,0.14)', order: 3 },
    'Unknown': { label: 'Other', color: '#71717a', bg: 'rgba(113,113,122,0.10)', border: 'rgba(113,113,122,0.14)', order: 4 },
  };

  const CHIP = {
    'DV':      { bg: 'rgba(192,132,252,0.14)', fg: '#c084fc', b: 'rgba(192,132,252,0.25)' },
    'HDR10+':  { bg: 'rgba(251,191,36,0.14)',  fg: '#fbbf24', b: 'rgba(251,191,36,0.25)' },
    'HDR10':   { bg: 'rgba(110,231,183,0.14)', fg: '#6ee7b7', b: 'rgba(110,231,183,0.25)' },
    'HDR':     { bg: 'rgba(110,231,183,0.14)', fg: '#6ee7b7', b: 'rgba(110,231,183,0.25)' },
    'ATMOS':   { bg: 'rgba(125,211,252,0.14)', fg: '#7dd3fc', b: 'rgba(125,211,252,0.25)' },
    'REMUX':   { bg: 'rgba(240,171,252,0.14)', fg: '#f0abfc', b: 'rgba(240,171,252,0.25)' },
    'WEB-DL':  { bg: 'rgba(209,213,219,0.10)', fg: '#d1d5db', b: 'rgba(209,213,219,0.16)' },
    'BluRay':  { bg: 'rgba(165,180,252,0.14)', fg: '#a5b4fc', b: 'rgba(165,180,252,0.25)' },
  };

  // ── CSS ────────────────────────────────────────────────────────────────────

  function injectCSS() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
.${HIDE_CLS}{display:none!important}

/* ── outer panel: float away from edges, no clipping ── */
.${PANEL_CLS}{
  margin:6px 12px 12px 6px!important;
  border-radius:18px!important;
  border:1px solid rgba(255,255,255,.06)!important;
  background:rgba(255,255,255,.018)!important;
  overflow:visible!important
}

/* ── inner scroll area ── */
#${CONT_ID}{
  overflow-y:auto;overflow-x:hidden;
  max-height:calc(100% - 4px);
  padding:16px 14px 18px;
  scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.08) transparent;
  animation:sqpIn .35s ease-out
}
#${CONT_ID}::-webkit-scrollbar{width:5px}
#${CONT_ID}::-webkit-scrollbar-track{background:transparent}
#${CONT_ID}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:4px}
@keyframes sqpIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes sqpCard{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}

/* ── header ── */
.sqp-hdr{display:flex;align-items:center;justify-content:space-between;padding:0 2px 14px}
.sqp-title{font-size:12px;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:1.2px}
.sqp-bwrap{display:flex;gap:8px}
.sqp-bp{
  padding:7px 18px;border:none;border-radius:20px;font-size:11.5px;font-weight:700;
  cursor:pointer;color:#fff;transition:all .2s;letter-spacing:.3px
}
.sqp-bp:hover:not(:disabled){filter:brightness(1.15);transform:translateY(-1px);box-shadow:0 4px 14px rgba(0,0,0,.35)}
.sqp-bp:active:not(:disabled){transform:translateY(0)}
.sqp-bp[data-t="4K"]{background:linear-gradient(135deg,#3b82f6 0%,#6366f1 100%)}
.sqp-bp[data-t="1080p"]{background:linear-gradient(135deg,#22c55e 0%,#14b8a6 100%)}
.sqp-bp:disabled{opacity:.2;cursor:default;filter:none;transform:none;box-shadow:none}

/* ── group ── */
.sqp-g{margin-bottom:4px}
.sqp-g+.sqp-g{margin-top:8px}
.sqp-gh{
  display:flex;align-items:center;gap:10px;padding:8px 6px;
  cursor:pointer;user-select:none;border-radius:8px;transition:background .15s
}
.sqp-gh:hover{background:rgba(255,255,255,.03)}
.sqp-tier{padding:3px 12px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:.5px}
.sqp-gc{font-size:12px;color:rgba(255,255,255,.3);font-weight:500}
.sqp-ga{margin-left:auto;font-size:10px;color:rgba(255,255,255,.2);transition:transform .25s ease}
.sqp-g.shut .sqp-ga{transform:rotate(-90deg)}
.sqp-gb{overflow:hidden;transition:max-height .3s ease}
.sqp-g.shut .sqp-gb{max-height:0!important}

/* ── card ── */
.sqp-c{
  padding:14px 16px;margin-bottom:6px;border-radius:12px;cursor:pointer;
  background:rgba(255,255,255,.03);
  border:1px solid rgba(255,255,255,.05);
  transition:all .2s ease;
  animation:sqpCard .28s ease-out both;animation-delay:calc(var(--i)*20ms)
}
.sqp-c:hover{
  background:rgba(255,255,255,.065);
  border-color:rgba(255,255,255,.1);
  transform:translateY(-1px);
  box-shadow:0 6px 20px rgba(0,0,0,.25)
}
.sqp-c:active{transform:translateY(0);box-shadow:none}

.sqp-r1{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.sqp-name{font-size:14px;font-weight:600;color:rgba(255,255,255,.9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-right:12px}
.sqp-seed{display:flex;align-items:center;gap:6px;flex-shrink:0}
.sqp-sig{display:flex;align-items:flex-end;gap:2px;height:16px}
.sqp-bar{width:3.5px;border-radius:1.5px;background:rgba(255,255,255,.08)}
.sqp-bar:nth-child(1){height:4px}
.sqp-bar:nth-child(2){height:8px}
.sqp-bar:nth-child(3){height:12px}
.sqp-bar:nth-child(4){height:16px}
.sqp-bar.on{background:currentColor}
.sqp-sn{font-size:12px;font-weight:600;min-width:28px;text-align:right;font-variant-numeric:tabular-nums}

.sqp-r2{display:flex;flex-wrap:wrap;align-items:center;gap:5px;margin-bottom:8px}
.sqp-pill{padding:3px 10px;border-radius:6px;font-size:10px;font-weight:700;letter-spacing:.4px}
.sqp-chip{padding:2px 8px;border-radius:5px;font-size:9.5px;font-weight:600;letter-spacing:.2px}

.sqp-r3{display:flex;align-items:center;gap:6px;font-size:11.5px;color:rgba(255,255,255,.35);font-weight:400}
.sqp-r3 span{white-space:nowrap}
.sqp-dot{color:rgba(255,255,255,.15)}

/* ── fallback ── */
.sqp-fb{
  padding:14px 16px;margin-bottom:6px;border-radius:12px;cursor:pointer;
  background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);
  font-size:12px;color:rgba(255,255,255,.45);transition:all .2s;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  animation:sqpCard .28s ease-out both;animation-delay:calc(var(--i)*20ms)
}
.sqp-fb:hover{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.1)}
`;
    document.head.appendChild(s);
  }

  // ── Parser ─────────────────────────────────────────────────────────────────

  function parse(el) {
    try {
      const aEl = el.querySelector('[class*="addon-name-"]');
      const dEl = el.querySelector('[class*="description-container-"]');
      const aT  = aEl ? aEl.textContent.trim() : '';
      const dT  = dEl ? dEl.textContent.trim() : '';
      const all = aT + '\n' + dT;

      if (all.replace(/\s/g, '').length < 3) return fb(el);

      const sm = all.match(/\[([A-Za-z][A-Za-z0-9+\-]*)\]/);
      const source = sm ? sm[0] : '';

      let name = aT.split('\n')[0];
      if (source) name = name.replace(source, '');
      name = name
        .replace(/\b(4k|2160p|1080p|720p|480p|576p)\b/gi, '')
        .replace(/\b(HDR10\+?|HDR|DV|Dolby[\s.]?Vision|SDR|ATMOS|REMUX|WEB[- ]?DL|Blu[- ]?Ray)\b/gi, '')
        .replace(/[|]/g, '').trim() || 'Unknown';

      let res = 'Unknown';
      if (/\b(4k|2160p)\b/i.test(all))                             res = '4K';
      else if (/\b1080p\b/i.test(all))                              res = '1080p';
      else if (/\b720p\b/i.test(all))                               res = '720p';
      else if (/\b(480p|576p|SD|DVDRip|BDRip|BRRip)\b/i.test(all)) res = 'SD';

      const fmt = [];
      if (/\bDV\b|Dolby[\s.]?Vision/i.test(all))  fmt.push('DV');
      if (/\bHDR10\+/i.test(all))                  fmt.push('HDR10+');
      else if (/\bHDR10\b/i.test(all))             fmt.push('HDR10');
      else if (/\bHDR\b/i.test(all))               fmt.push('HDR');
      if (/\bAtmos\b/i.test(all))                   fmt.push('ATMOS');
      if (/\bREMUX\b/i.test(all))                   fmt.push('REMUX');
      if (/\bWEB[- ]?DL\b/i.test(all))             fmt.push('WEB-DL');
      if (/\bBlu[- ]?Ray\b/i.test(all))            fmt.push('BluRay');

      const seedM = dT.match(/👤\s*(\d[\d,]*)/);
      const seeds = seedM ? parseInt(seedM[1].replace(/,/g, ''), 10) : -1;
      const sizeM = dT.match(/💾\s*([\d.]+\s*(?:KB|MB|GB|TB))/i);
      const size  = sizeM ? sizeM[1] : '';
      const provM = dT.match(/⚙️\s*(.+?)(?:\n|$)/);
      const prov  = provM ? provM[1].trim() : '';

      return { source, name, res, fmt, seeds, size, prov, el, ok: true };
    } catch (_) { return fb(el); }
  }

  function fb(el) {
    return { source:'', name:'Unknown', res:'Unknown', fmt:[], seeds:-1, size:'', prov:'', el, ok:false };
  }

  // ── Score ──────────────────────────────────────────────────────────────────

  function score(s) {
    let v = 0;
    if (s.seeds > 0) v += Math.min(s.seeds, 3000) * 10;
    if (/\[.+\+\]/.test(s.source)) v += 5000;
    if (s.fmt.includes('DV'))       v += 300;
    if (s.fmt.includes('HDR10+'))   v += 250;
    else if (s.fmt.includes('HDR10')) v += 200;
    else if (s.fmt.includes('HDR'))   v += 150;
    if (s.fmt.includes('ATMOS'))    v += 100;
    if (s.fmt.includes('REMUX'))    v += 200;
    return v;
  }

  // ── UI builders ────────────────────────────────────────────────────────────

  function esc(t) { const d = document.createElement('span'); d.textContent = t; return d.innerHTML; }

  function bars(seeds) {
    const lvl = seeds >= 500 ? 4 : seeds >= 200 ? 3 : seeds >= 50 ? 2 : seeds >= 1 ? 1 : 0;
    const pal = ['#ef4444','#f97316','#eab308','#4ade80'];
    const c = lvl ? pal[lvl - 1] : '#52525b';
    let h = `<div class="sqp-sig" style="color:${c}">`;
    for (let i = 0; i < 4; i++) h += `<div class="sqp-bar${i < lvl ? ' on' : ''}"></div>`;
    return h + '</div>';
  }

  function cardHTML(s, idx, ci) {
    const t = TIERS[s.res] || TIERS.Unknown;

    let chips = `<span class="sqp-pill" style="background:${t.bg};color:${t.color};border:1px solid ${t.border}">${t.label}</span>`;
    for (const f of s.fmt) {
      const c = CHIP[f] || { bg:'rgba(255,255,255,.06)', fg:'#a1a1aa', b:'rgba(255,255,255,.1)' };
      chips += `<span class="sqp-chip" style="background:${c.bg};color:${c.fg};border:1px solid ${c.b}">${esc(f)}</span>`;
    }

    const label = esc([s.source, s.name].filter(Boolean).join(' '));

    let seedHTML = '';
    if (s.seeds >= 0) {
      const sc = s.seeds >= 500 ? '#4ade80' : s.seeds >= 200 ? '#facc15' : s.seeds >= 50 ? '#fb923c' : '#f87171';
      seedHTML = `<div class="sqp-seed">${bars(s.seeds)}<span class="sqp-sn" style="color:${sc}">${s.seeds.toLocaleString()}</span></div>`;
    }

    const meta = [];
    if (s.size) meta.push(`<span>${esc(s.size)}</span>`);
    if (s.prov) meta.push(`<span>${esc(s.prov)}</span>`);
    const metaHTML = meta.join('<span class="sqp-dot">·</span>');

    return `<div class="sqp-c" data-sqp="${idx}" style="--i:${ci}">
  <div class="sqp-r1"><div class="sqp-name">${label}</div>${seedHTML}</div>
  <div class="sqp-r2">${chips}</div>
  ${metaHTML ? `<div class="sqp-r3">${metaHTML}</div>` : ''}
</div>`;
  }

  function fbHTML(s, idx, ci) {
    const txt = esc(s.el.textContent.trim().replace(/\n+/g, '  ·  '));
    return `<div class="sqp-fb" data-sqp="${idx}" style="--i:${ci}">${txt}</div>`;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  function render(streams, parent, original) {
    const groups = {};
    streams.forEach((s, i) => { s._i = i; (groups[s.res] || (groups[s.res] = [])).push(s); });

    const tierKeys = Object.keys(groups).sort((a, b) => (TIERS[a]?.order ?? 99) - (TIERS[b]?.order ?? 99));
    for (const k of tierKeys) groups[k].sort((a, b) => score(b) - score(a));

    const b4  = groups['4K']?.[0];
    const b10 = groups['1080p']?.[0];

    let h = `<div id="${CONT_ID}">`;

    h += `<div class="sqp-hdr"><span class="sqp-title">Streams</span><div class="sqp-bwrap">`;
    h += `<button class="sqp-bp" data-t="4K" ${b4 ? `data-sqp="${b4._i}"` : 'disabled'}>⚡ Best 4K</button>`;
    h += `<button class="sqp-bp" data-t="1080p" ${b10 ? `data-sqp="${b10._i}"` : 'disabled'}>⚡ Best 1080p</button>`;
    h += `</div></div>`;

    let ci = 0;
    for (const k of tierKeys) {
      const g  = groups[k];
      const td = TIERS[k] || TIERS.Unknown;
      h += `<div class="sqp-g">`;
      h += `<div class="sqp-gh"><span class="sqp-tier" style="background:${td.bg};color:${td.color};border:1px solid ${td.border}">${td.label}</span>`;
      h += `<span class="sqp-gc">${g.length} stream${g.length !== 1 ? 's' : ''}</span>`;
      h += `<span class="sqp-ga">▾</span></div>`;
      h += `<div class="sqp-gb">`;
      for (const s of g) { h += s.ok ? cardHTML(s, s._i, ci) : fbHTML(s, s._i, ci); ci++; }
      h += `</div></div>`;
    }
    h += '</div>';

    const w = document.createElement('div');
    w.innerHTML = h;
    const picker = w.firstElementChild;
    parent.insertBefore(picker, original);

    picker.addEventListener('click', (e) => {
      const t = e.target.closest('[data-sqp]');
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      const stream = streams[parseInt(t.getAttribute('data-sqp'), 10)];
      if (stream?.el) stream.el.click();
    });

    picker.querySelectorAll('.sqp-gh').forEach(gh => {
      gh.addEventListener('click', () => gh.parentElement.classList.toggle('shut'));
    });

    return picker;
  }

  // ── DOM hook ───────────────────────────────────────────────────────────────

  let active = false, lastN = 0, timer = null, obs = null, prevUrl = '';

  function check() {
    const list = document.querySelector('[class*="streams-list-"]');
    if (!list) { if (active) teardown(); return; }

    const box = list.querySelector('[class*="streams-container-"]');
    if (!box) return;

    const links = Array.from(box.querySelectorAll('a'));
    if (!links.length || !links.some(l => l.textContent.trim().length > 5)) return;
    if (active && links.length === lastN) return;

    if (timer) clearTimeout(timer);
    timer = setTimeout(() => build(list, box), active ? 600 : 250);
  }

  function build(list, box) {
    const links = Array.from(box.querySelectorAll('a'));
    lastN = links.length;

    const old = document.getElementById(CONT_ID);
    if (old) old.remove();

    const streams = links.map(parse);

    box.classList.add(HIDE_CLS);

    const parent = box.parentElement;

    // Hide FilterStreams dropdowns if present
    parent.querySelectorAll('.filter-streams, .dropdown.observer-ignore').forEach(
      el => el.classList.add(HIDE_CLS)
    );

    // Float the outer stream panel away from edges
    list.classList.add(PANEL_CLS);

    render(streams, parent, box);

    if (!obs) {
      obs = new MutationObserver(() => {
        if (Array.from(box.querySelectorAll('a')).length !== lastN) {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => build(list, box), 600);
        }
      });
      obs.observe(box, { childList: true, subtree: true });
    }

    active = true;
  }

  function teardown() {
    active = false; lastN = 0;
    if (timer) { clearTimeout(timer); timer = null; }
    if (obs) { obs.disconnect(); obs = null; }
    const p = document.getElementById(CONT_ID);
    if (p) p.remove();
    document.querySelectorAll('.' + HIDE_CLS).forEach(e => e.classList.remove(HIDE_CLS));
    document.querySelectorAll('.' + PANEL_CLS).forEach(e => e.classList.remove(PANEL_CLS));
  }

  // ── Boot ───────────────────────────────────────────────────────────────────

  injectCSS();

  setInterval(() => {
    if (window.stremioCustomSuspendBackground?.()) return;
    const u = location.hash || location.href;
    if (u !== prevUrl) { teardown(); prevUrl = u; }
    check();
  }, 300);
})();
