/**
 * Background Paths — vanilla JS port of the React/framer-motion component.
 * Creates two mirrored layers of 36 animated flowing SVG curves.
 * Uses position:fixed so it works on any page regardless of container stacking.
 * Call: BackgroundPaths.init()
 */
(function () {
  'use strict';

  const STYLE_ID = 'bg-paths-style';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #bg-paths-root {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 1;
        overflow: hidden;
      }
      #bg-paths-root svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        color: rgba(255,255,255,1);
      }
    `;
    document.head.appendChild(style);
  }

  function buildSVG(position) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 696 316');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');
    // Allow paths that start/end outside the viewBox to still be visible
    svg.setAttribute('overflow', 'visible');

    for (let i = 0; i < 36; i++) {
      const p = position;
      const d =
        `M${-(380 - i * 5 * p)} ${-(189 - i * 6)}` +
        `C${-(380 - i * 5 * p)} ${-(189 - i * 6)} ` +
        `${-(312 - i * 5 * p)} ${216 - i * 6} ` +
        `${152 - i * 5 * p} ${343 - i * 6}` +
        `C${616 - i * 5 * p} ${470 - i * 6} ` +
        `${684 - i * 5 * p} ${875 - i * 6} ` +
        `${684 - i * 5 * p} ${875 - i * 6}`;

      // Stroke appearance
      const opacity = 0.08 + i * 0.022;
      const width   = 0.5 + i * 0.03;

      // Seamless loop: dashoffset must animate by exactly (dashLen + gapLen)
      const dashLen  = 260 + i * 6;
      const gapLen   = 1800;
      const cycle    = dashLen + gapLen; // dashoffset animates by this amount

      // Duration spread across paths so they don't all move in sync
      const duration = 18 + (i % 12) * 1.2;
      // Negative delay = start partway through so not all paths begin at 0
      const delay    = -((i * 3.3) % duration);

      // Inject a unique keyframe per path so each has its own cycle distance
      const animName = `bpf_${position < 0 ? 'r' : 'l'}_${i}`;
      const styleTag = document.getElementById(STYLE_ID);
      // Append keyframe only once
      if (!styleTag.textContent.includes(animName)) {
        styleTag.textContent += `
          @keyframes ${animName} {
            0%   { stroke-dashoffset: 0;        opacity: ${opacity * 0.5}; }
            40%  { opacity: ${Math.min(opacity * 1.4, 1)}; }
            100% { stroke-dashoffset: ${-cycle}; opacity: ${opacity * 0.5}; }
          }
        `;
      }

      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', d);
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', String(width));
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-dasharray', `${dashLen} ${gapLen}`);
      path.style.animation = `${animName} ${duration}s linear ${delay}s infinite`;

      svg.appendChild(path);
    }

    return svg;
  }

  window.BackgroundPaths = {
    init: function () {
      // Prevent double-init
      if (document.getElementById('bg-paths-root')) return;

      const root = document.createElement('div');
      root.id = 'bg-paths-root';

      root.appendChild(buildSVG(1));   // left-to-right sweep
      root.appendChild(buildSVG(-1));  // mirrored sweep

      // Insert as first child of body — position:fixed keeps it out of flow
      document.body.insertBefore(root, document.body.firstChild);
    }
  };
})();
