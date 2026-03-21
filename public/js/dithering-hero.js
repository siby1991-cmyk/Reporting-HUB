/**
 * DitheringCard — vanilla JS port of hero-dithering-card.tsx
 * WebGL2 Bayer 4×4 ordered dithering with warp FBM animation.
 *
 * Call: DitheringCard.init(opts)
 *   opts.container   — DOM element to append the section into (default: document.body)
 *   opts.badgeText   — badge label (default: 'Reporting HUB')
 *   opts.title       — first line of headline
 *   opts.titleSub    — second line of headline (dimmed)
 *   opts.description — paragraph below headline
 *   opts.buttonText  — CTA button label
 *   opts.buttonHref  — CTA button href
 *
 * Returns { stop() } handle.
 */
(function () {
  'use strict';

  // ── CSS (injected once) ──────────────────────────────────────────────────────
  var CSS_ID = 'dithering-card-css';

  function injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    var s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = `
      .dh-section {
        padding: 48px 16px;
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .dh-wrapper {
        width: 100%;
        max-width: 1280px;
        position: relative;
      }
      .dh-card {
        position: relative;
        overflow: hidden;
        border-radius: 48px;
        border: 1px solid var(--border, rgba(0,0,0,0.08));
        background: var(--bg2, #fff);
        box-shadow: var(--shadow-card, 0 2px 16px rgba(0,0,0,0.07));
        min-height: 600px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        transition: box-shadow 0.5s ease;
      }

      /* ── Dithering canvas layer ── */
      .dh-canvas-wrap {
        position: absolute;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        opacity: 0.4;
        mix-blend-mode: multiply;
      }
      [data-theme="dark"] .dh-canvas-wrap {
        opacity: 0.3;
        mix-blend-mode: screen;
      }
      .dh-canvas {
        width: 100%;
        height: 100%;
        display: block;
      }

      /* ── Content ── */
      .dh-content {
        position: relative;
        z-index: 10;
        padding: 48px 24px;
        max-width: 896px;
        margin: 0 auto;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      /* Badge */
      .dh-badge {
        margin-bottom: 32px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        border: 1px solid rgba(170,235,61,0.15);
        background: rgba(170,235,61,0.06);
        padding: 6px 16px;
        font-size: 14px;
        font-weight: 500;
        color: var(--accent, #aaeb3d);
        backdrop-filter: blur(4px);
      }
      .dh-badge-dot {
        position: relative;
        width: 8px;
        height: 8px;
        flex-shrink: 0;
      }
      .dh-badge-dot-ping {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: var(--accent, #aaeb3d);
        opacity: 0.75;
        animation: dh-ping 1.5s ease-in-out infinite;
      }
      .dh-badge-dot-solid {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: var(--accent, #aaeb3d);
      }
      @keyframes dh-ping {
        0%   { transform: scale(1);   opacity: 0.75; }
        60%  { transform: scale(1.9); opacity: 0;    }
        100% { transform: scale(1);   opacity: 0;    }
      }

      /* Headline */
      .dh-title {
        font-family: 'Instrument Serif', Georgia, serif;
        font-size: clamp(38px, 7vw, 96px);
        font-weight: 500;
        letter-spacing: -0.02em;
        color: var(--text, #0d1117);
        margin-bottom: 32px;
        line-height: 1.05;
      }
      .dh-title-dim {
        color: var(--muted2, #6b7280);
      }

      /* Description */
      .dh-desc {
        color: var(--muted, #6b7280);
        font-size: clamp(16px, 1.5vw, 20px);
        max-width: 672px;
        margin-bottom: 48px;
        line-height: 1.65;
      }

      /* CTA Button */
      .dh-btn {
        display: inline-flex;
        height: 56px;
        align-items: center;
        justify-content: center;
        gap: 10px;
        border-radius: 999px;
        background: var(--accent2, #1a1a1a);
        padding: 0 48px;
        font-size: 15px;
        font-weight: 700;
        color: #fff;
        text-decoration: none;
        border: none;
        cursor: pointer;
        font-family: 'Plus Jakarta Sans', sans-serif;
        transition: background 0.3s, transform 0.15s ease, box-shadow 0.3s;
      }
      .dh-btn:hover {
        transform: scale(1.04);
        box-shadow: 0 0 0 4px rgba(26,26,26,0.14);
      }
      .dh-btn:active { transform: scale(0.97); }
      .dh-btn .dh-arrow {
        transition: transform 0.3s ease;
      }
      .dh-btn:hover .dh-arrow {
        transform: translateX(4px);
      }
      [data-theme="dark"] .dh-btn {
        background: var(--accent, #a8e63d);
        color: var(--accent-text, #1a1a1a);
      }
      [data-theme="dark"] .dh-btn:hover {
        background: #c4ff4a;
        box-shadow: 0 0 0 4px rgba(168,230,61,0.22);
      }
    `;
    document.head.appendChild(s);
  }

  // ── GLSL ─────────────────────────────────────────────────────────────────────
  var VERT_SRC = `#version 300 es
precision highp float;
in vec4 position;
void main() { gl_Position = position; }`;

  var FRAG_SRC = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2  resolution;
uniform float time;
uniform float speed;

/* ── Noise helpers ── */
float hash(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i),          hash(i + vec2(1,0)), u.x),
             mix(hash(i+vec2(0,1)),hash(i + vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
  return v;
}

/* ── Bayer 4×4 ordered dithering ── */
float bayer(ivec2 p) {
  float b[16] = float[16](
     0., 8., 2.,10.,
    12., 4.,14., 6.,
     3.,11., 1., 9.,
    15., 7.,13., 5.
  );
  return b[(p.y & 3) * 4 + (p.x & 3)] / 16.0;
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  float t  = time * speed;

  /* Two-level domain warp (warp shape) */
  vec2 q = vec2(fbm(uv * 3.0 + vec2(t * 0.31, t * 0.12)),
                fbm(uv * 3.0 + vec2(t * 0.22, t * 0.41) + 5.2));
  vec2 r = vec2(fbm(uv * 4.0 + q * 1.6 + vec2(1.7, 9.2) + t * 0.15),
                fbm(uv * 4.0 + q * 1.6 + vec2(8.3, 2.8) + t * 0.12));

  float value = fbm(uv * 3.0 + r * 2.0);
  value = clamp(value * 1.5 - 0.25, 0.0, 1.0);   /* stretch contrast */

  /* Bayer threshold → binary dither */
  float d = step(bayer(ivec2(gl_FragCoord.xy)), value);

  /* colorFront = #EC4E02, colorBack = transparent */
  fragColor = vec4(0.925, 0.306, 0.008, d);
}`;

  // ── WebGL2 Renderer ──────────────────────────────────────────────────────────
  function DitheringRenderer(canvas) {
    this.canvas    = canvas;
    this.gl        = canvas.getContext('webgl2', { premultipliedAlpha: false, alpha: true });
    if (!this.gl) throw new Error('WebGL2 not supported');
    this.program   = null;
    this.buffer    = null;
    this.uniforms  = {};
    this.speed     = 0.2;
    this.startTime = performance.now();
  }

  DitheringRenderer.prototype._sh = function (type, src) {
    var gl = this.gl;
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
      console.error('DitheringCard shader error:', gl.getShaderInfoLog(sh));
    return sh;
  };

  DitheringRenderer.prototype.setup = function () {
    var gl = this.gl;
    var vs = this._sh(gl.VERTEX_SHADER,   VERT_SRC);
    var fs = this._sh(gl.FRAGMENT_SHADER, FRAG_SRC);
    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('DitheringCard link error:', gl.getProgramInfoLog(this.program));
      return;
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1,1, -1,-1, 1,1, 1,-1]), gl.STATIC_DRAW);
    var pos = gl.getAttribLocation(this.program, 'position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    this.uniforms = {
      resolution: gl.getUniformLocation(this.program, 'resolution'),
      time:       gl.getUniformLocation(this.program, 'time'),
      speed:      gl.getUniformLocation(this.program, 'speed'),
    };

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  };

  DitheringRenderer.prototype.resize = function () {
    var dpr = Math.max(1, window.devicePixelRatio || 1);
    this.canvas.width  = this.canvas.offsetWidth  * dpr;
    this.canvas.height = this.canvas.offsetHeight * dpr;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  };

  DitheringRenderer.prototype.render = function () {
    var gl = this.gl, p = this.program, u = this.uniforms;
    if (!p) return;
    var now = (performance.now() - this.startTime) * 0.001;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(p);
    gl.uniform2f(u.resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.time,  now);
    gl.uniform1f(u.speed, this.speed);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  DitheringRenderer.prototype.destroy = function () {
    var gl = this.gl;
    if (this.program) gl.deleteProgram(this.program);
    if (this.buffer)  gl.deleteBuffer(this.buffer);
  };

  // ── Arrow SVG (lucide ArrowRight) ────────────────────────────────────────────
  var ARROW_SVG = '<svg class="dh-arrow" xmlns="http://www.w3.org/2000/svg" '
    + 'width="20" height="20" viewBox="0 0 24 24" fill="none" '
    + 'stroke="currentColor" stroke-width="2" stroke-linecap="round" '
    + 'stroke-linejoin="round" aria-hidden="true">'
    + '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';

  // ── Public API ───────────────────────────────────────────────────────────────
  window.DitheringCard = {
    init: function (opts) {
      opts = opts || {};
      injectCSS();

      var container   = opts.container   || document.body;
      var badgeText   = opts.badgeText   || 'Reporting HUB';
      var title       = opts.title       || 'Your dashboards,';
      var titleSub    = opts.titleSub    || 'always in reach.';
      var description = opts.description || 'One place for every report, every team, every insight. Organised by department, secured by role.';
      var buttonText  = opts.buttonText  || 'Get Started';
      var buttonHref  = opts.buttonHref  || '#';

      var uid = 'dc-' + Math.random().toString(36).slice(2, 7);

      var section = document.createElement('section');
      section.className = 'dh-section';
      section.innerHTML =
        '<div class="dh-wrapper">' +
          '<div class="dh-card" id="' + uid + '-card">' +
            '<div class="dh-canvas-wrap">' +
              '<canvas class="dh-canvas" id="' + uid + '-canvas"></canvas>' +
            '</div>' +
            '<div class="dh-content">' +
              '<div class="dh-badge">' +
                '<span class="dh-badge-dot">' +
                  '<span class="dh-badge-dot-ping"></span>' +
                  '<span class="dh-badge-dot-solid"></span>' +
                '</span>' +
                badgeText +
              '</div>' +
              '<h2 class="dh-title">' + title + '<br>' +
                '<span class="dh-title-dim">' + titleSub + '</span>' +
              '</h2>' +
              '<p class="dh-desc">' + description + '</p>' +
              '<a href="' + buttonHref + '" class="dh-btn">' +
                '<span>' + buttonText + '</span>' +
                ARROW_SVG +
              '</a>' +
            '</div>' +
          '</div>' +
        '</div>';

      container.appendChild(section);

      var canvas   = document.getElementById(uid + '-canvas');
      var cardEl   = document.getElementById(uid + '-card');
      var renderer;

      try {
        renderer = new DitheringRenderer(canvas);
        renderer.setup();
      } catch (e) {
        console.warn('DitheringCard: WebGL2 init failed.', e);
        section.remove();
        return null;
      }

      // Resize: use ResizeObserver for accurate first-paint sizing
      if (window.ResizeObserver) {
        var ro = new ResizeObserver(function () { renderer.resize(); });
        ro.observe(canvas);
      } else {
        window.addEventListener('resize', function () { renderer.resize(); });
        // Defer first resize until after layout
        requestAnimationFrame(function () { renderer.resize(); });
      }

      // Hover → speed up shader
      cardEl.addEventListener('mouseenter', function () { renderer.speed = 0.6; });
      cardEl.addEventListener('mouseleave', function () { renderer.speed = 0.2; });

      var running = true;
      function loop() {
        if (!running) return;
        renderer.render();
        requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);

      return {
        stop: function () {
          running = false;
          renderer.destroy();
        }
      };
    }
  };
})();
