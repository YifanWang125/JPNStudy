/* ============================================================================
 *  scene-art.js — hand-drawn SVG illustrations for 🎴 看图说话 (real art, not emoji).
 *  Vector, tiny, offline, theme-independent. みけ (calico) stars in 言の葉の国.
 *  window.SCENE_ART.byDay[n] when authored, else window.SCENE_ART.fallback.
 *  Later these can be swapped for AI/Draw-Things art at the same call site.
 * ==========================================================================*/
(function(){
  // みけ — a calico (三毛) cat, sitting, front-facing. (x,y)=base, s=scale.
  function mike(x,y,s){ s=s||1; return `<g transform="translate(${x},${y}) scale(${s})">
    <ellipse cx="0" cy="66" rx="44" ry="10" fill="#000" opacity=".10"/>
    <path d="M37 42 q38 8 25 -38" fill="none" stroke="#eea24a" stroke-width="13" stroke-linecap="round"/>
    <path d="M-37 58 q-6 -57 37 -57 q43 0 37 57 z" fill="#f7f2e7"/>
    <path d="M9 3 q30 9 27 53 l-22 0 q5 -37 -16 -47 z" fill="#eea24a"/>
    <g transform="translate(0,-32)">
      <path d="M-27 -6 l-9 -27 l23 15 z" fill="#f7f2e7"/>
      <path d="M27 -6 l9 -27 l-23 15 z" fill="#3a352f"/>
      <path d="M-25 -8 l-4 -14 l13 9 z" fill="#f7b070"/>
      <circle cx="0" cy="2" r="31" fill="#f7f2e7"/>
      <path d="M3 -28 q27 5 27 30 l-30 0 q1 -18 3 -30 z" fill="#eea24a"/>
      <ellipse cx="-12" cy="2" rx="3.8" ry="5.4" fill="#2b2b2b"/>
      <ellipse cx="12" cy="2" rx="3.8" ry="5.4" fill="#2b2b2b"/>
      <circle cx="-10.6" cy="-0.2" r="1.3" fill="#fff"/><circle cx="13.4" cy="-0.2" r="1.3" fill="#fff"/>
      <path d="M0 9 l-3 4 h6 z" fill="#e98a86"/>
      <path d="M0 13 q-5 5 -9 2 M0 13 q5 5 9 2" fill="none" stroke="#2b2b2b" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M-15 9 l-20 -3 M-15 13 l-20 4 M15 9 l20 -3 M15 13 l20 4" stroke="#cbbfa9" stroke-width="1"/>
      <circle cx="-19" cy="11" r="3.6" fill="#f4a98f" opacity=".55"/>
      <circle cx="19" cy="11" r="3.6" fill="#f4a98f" opacity=".55"/>
    </g></g>`; }
  function quaver(x,y,c){ return `<g transform="translate(${x},${y})" fill="${c||'#7a5cc0'}"><rect x="6" y="-28" width="2.6" height="28"/><path d="M8 -28 q12 1 10 13 q-1 -9 -10 -9z"/><ellipse cx="2" cy="0" rx="6" ry="4.2" transform="rotate(-18 2 0)"/></g>`; }
  const wrap=(inner)=>`<svg viewBox="0 0 640 320" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="scene">${inner}</svg>`;

  // ---- default: 言の葉の国 (rolling hills + a great word-tree) ----
  const fallback = wrap(`
    <defs><linearGradient id="skyF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bcd6f2"/><stop offset="1" stop-color="#eaf3ff"/></linearGradient></defs>
    <rect width="640" height="320" fill="url(#skyF)"/>
    <circle cx="92" cy="74" r="30" fill="#fff3c9"/><circle cx="92" cy="74" r="44" fill="#fff6d6" opacity=".4"/>
    <g fill="#fff" opacity=".9"><circle cx="470" cy="70" r="16"/><circle cx="492" cy="64" r="13"/><circle cx="452" cy="74" r="12"/></g>
    <path d="M0 222 q170 -46 340 -8 q160 36 300 -2 v108 H0Z" fill="#c7e6bf"/>
    <path d="M0 256 q210 -26 420 2 q120 16 220 4 v58 H0Z" fill="#aedba0"/>
    <g transform="translate(470,150)"><rect x="-7" y="20" width="14" height="60" fill="#9c6b4a"/><circle cx="0" cy="0" r="46" fill="#6fb86a"/><circle cx="-34" cy="14" r="30" fill="#7cc676"/><circle cx="34" cy="12" r="28" fill="#7cc676"/>
      <text x="0" y="6" font-size="22" text-anchor="middle" fill="#f7f2e7" font-family="serif">言</text></g>
    ${mike(248,196,1.3)}
    <g fill="#f7d774" opacity=".9"><path d="M150 120 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z"/><path d="M548 150 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z"/><path d="M120 200 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z"/></g>`);

  // ---- Day 1: morning · self-intro ----
  const d1 = wrap(`
    <defs><linearGradient id="sky1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9c8ef"/><stop offset=".5" stop-color="#ffd9b0"/><stop offset="1" stop-color="#ffe9cf"/></linearGradient></defs>
    <rect width="640" height="320" fill="url(#sky1)"/>
    <circle cx="512" cy="92" r="44" fill="#ffb86b"/><circle cx="512" cy="92" r="62" fill="#ffce8e" opacity=".35"/>
    <g fill="#fff" opacity=".85"><circle cx="150" cy="74" r="15"/><circle cx="170" cy="68" r="12"/><circle cx="133" cy="78" r="11"/></g>
    <path d="M0 232 q170 -42 340 -6 q160 34 300 -4 v98 H0Z" fill="#cfe6c8"/>
    <path d="M0 264 q210 -22 420 2 q120 14 220 2 v54 H0Z" fill="#bcdcb2"/>
    <g opacity=".9"><rect x="138" y="206" width="92" height="48" rx="3" fill="#eef2ec"/><polygon points="138,206 184,182 230,206" fill="#d98a5a"/><rect x="176" y="226" width="16" height="28" fill="#c4b9a2"/><rect x="150" y="216" width="13" height="13" fill="#bcd3ec"/><rect x="205" y="216" width="13" height="13" fill="#bcd3ec"/></g>
    <g fill="#c75b4a"><rect x="384" y="204" width="7" height="50"/><rect x="424" y="204" width="7" height="50"/><rect x="372" y="194" width="72" height="8" rx="2"/><rect x="380" y="208" width="56" height="6"/></g>
    ${mike(300,200,1.28)}
    <g transform="translate(356,150)"><path d="M0 18 q0 -18 22 -18 h40 q22 0 22 18 v8 q0 18 -22 18 h-40 l-14 12 4 -14 q-12 -4 -12 -16z" fill="#fff" opacity=".95"/><text x="44" y="30" font-size="18" text-anchor="middle" fill="#e8943f" font-family="serif">はじめまして</text></g>`);

  // ---- Day 2: hobby · music at home ----
  const d2 = wrap(`
    <defs><linearGradient id="wall2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3550"/><stop offset="1" stop-color="#4b4466"/></linearGradient></defs>
    <rect width="640" height="320" fill="url(#wall2)"/>
    <rect x="0" y="232" width="640" height="88" fill="#7a5a44"/>
    <rect x="0" y="232" width="640" height="10" fill="#8a684f"/>
    <g><rect x="60" y="56" width="150" height="110" rx="6" fill="#1d2138"/><rect x="70" y="66" width="130" height="90" rx="3" fill="#2a2f4f"/><circle cx="170" cy="92" r="14" fill="#ffd98a" opacity=".8"/><rect x="134" y="56" width="3" height="110" fill="#11142a"/><rect x="60" y="109" width="150" height="3" fill="#11142a"/></g>
    <ellipse cx="320" cy="300" rx="250" ry="18" fill="#000" opacity=".18"/>
    <g transform="translate(430,150)"><path d="M0 60 q-34 0 -34 -32 q0 -28 24 -28 q14 0 16 12 q4 -42 30 -42 q26 0 26 30 q0 60 -40 60z" fill="#caa15f"/><rect x="40" y="-66" width="9" height="64" rx="3" fill="#7a5a3a"/><rect x="38" y="-70" width="13" height="10" rx="2" fill="#5e442c"/><circle cx="10" cy="20" r="13" fill="#2c2218"/><path d="M44 -60 l-30 76 M50 -58 l-30 76" stroke="#e9dcc3" stroke-width="1"/></g>
    ${mike(250,196,1.3)}
    <g transform="translate(250,150)"><path d="M-44 6 q0 -30 44 -30 q44 0 44 30" fill="none" stroke="#3a352f" stroke-width="6"/><rect x="-56" y="2" width="18" height="26" rx="6" fill="#c75b4a"/><rect x="38" y="2" width="18" height="26" rx="6" fill="#c75b4a"/></g>
    ${quaver(330,110,'#f2a65a')}${quaver(372,86,'#7ec0e8')}${quaver(410,118,'#f0d066')}`);

  window.SCENE_ART = { fallback:fallback, byDay:{ 1:d1, 2:d2 } };
})();
