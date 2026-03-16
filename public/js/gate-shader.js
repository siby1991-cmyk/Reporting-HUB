/* ── gate-shader.js — Aurora Borealis WebGL background for login gate ────────── */
(function () {
  const canvas = document.getElementById('gate-canvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl2');
  if (!gl) return; // fallback to CSS blobs silently

  // ── Shaders ───────────────────────────────────────────────────────────────────
  const VS = `#version 300 es
    in vec4 position;
    void main() { gl_Position = position; }
  `;

  const FS = `#version 300 es
    precision highp float;
    out vec4 fragColor;
    uniform vec2  iResolution;
    uniform float iTime;
    uniform vec2  iMouse;

    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(random(i),              random(i + vec2(1,0)), u.x),
        mix(random(i + vec2(0,1)),  random(i + vec2(1,1)), u.x),
        u.y
      );
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
      return v;
    }

    void main() {
      vec2 uv    = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
      vec2 mouse = (iMouse          - 0.5 * iResolution.xy) / iResolution.y;

      float t = iTime * 0.2;

      /* Aurora curtain layers */
      vec2 p = uv;
      p.y += 0.4;

      float f1 = fbm(vec2(p.x * 2.0,        p.y + t));
      float f2 = fbm(vec2(p.x * 1.5 + 0.8,  p.y * 1.2 + t * 0.7));
      float curtain  = smoothstep(0.1, 0.55, f1) * (1.0 - p.y * 1.2);
      float curtain2 = smoothstep(0.2, 0.6,  f2) * (0.8 - p.y);

      /* Mouse flare */
      float d     = length(uv - mouse);
      float flare = smoothstep(0.35, 0.0, d);

      /* Colours — lime ↔ purple, adapted to our design system */
      vec3 cLime    = vec3(0.42, 0.88, 0.15);   /* #6be026 — lime */
      vec3 cPurple  = vec3(0.38, 0.15, 0.82);   /* #6126d1 — purple */
      vec3 cCyan    = vec3(0.05, 0.70, 0.65);   /* teal accent */
      vec3 cFlare   = vec3(0.85, 1.00, 0.70);   /* bright lime-white */

      /* Blend across Y */
      vec3 aurora  = mix(cLime,   cPurple, clamp(p.y * 1.8 + 0.5, 0.0, 1.0)) * curtain;
          aurora  += mix(cCyan,   cPurple, clamp(p.y * 2.0 + 0.3, 0.0, 1.0)) * curtain2 * 0.6;
          aurora  += cFlare * flare * (curtain + curtain2) * 1.8;

      /* Dark base — matching our gate bg (#0a0f1a) */
      vec3 base = vec3(0.04, 0.06, 0.10);
      vec3 col  = base + aurora;

      /* Stars — tiny random specks */
      float star = step(0.994, random(floor(uv * 280.0)));
      col += vec3(star * 0.55);

      /* Vignette */
      float vig = 1.0 - dot(uv * 0.7, uv * 0.7);
      col *= clamp(vig, 0.0, 1.0);

      /* Tone map */
      col = col / (col + 0.6);
      col = pow(max(col, vec3(0.0)), vec3(0.80));

      fragColor = vec4(col, 1.0);
    }
  `;

  // ── Build program ─────────────────────────────────────────────────────────────
  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s); return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER,   VS));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog); gl.useProgram(prog);

  // ── Full-screen quad ──────────────────────────────────────────────────────────
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,1,-1,-1,1,1,1,-1]), gl.STATIC_DRAW);
  const posLoc = gl.getAttribLocation(prog, 'position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const uRes   = gl.getUniformLocation(prog, 'iResolution');
  const uTime  = gl.getUniformLocation(prog, 'iTime');
  const uMouse = gl.getUniformLocation(prog, 'iMouse');

  // ── Resize ────────────────────────────────────────────────────────────────────
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = window.innerWidth  * dpr;
    canvas.height = window.innerHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener('resize', resize);

  // ── Mouse ─────────────────────────────────────────────────────────────────────
  let mx = window.innerWidth / 2, my = window.innerHeight / 2;
  window.addEventListener('mousemove', e => {
    mx = e.clientX;
    my = window.innerHeight - e.clientY;
  });

  // ── Render loop ───────────────────────────────────────────────────────────────
  let running = true;
  function loop(now) {
    if (!running) return;
    gl.uniform2f(uRes,   canvas.width, canvas.height);
    gl.uniform1f(uTime,  now * 0.001);
    gl.uniform2f(uMouse, mx, my);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Pause when gate is hidden
  const gate = document.getElementById('role-gate');
  if (gate) {
    new MutationObserver(() => {
      running = gate.style.display !== 'none';
      if (running) requestAnimationFrame(loop);
    }).observe(gate, { attributes: true, attributeFilter: ['style'] });
  }
})();
