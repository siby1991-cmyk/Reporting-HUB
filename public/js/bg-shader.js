/* ── bg-shader.js — Animated mesh gradient background for the main app ───────── */
(function () {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl2');
  if (!gl) return;

  const VS = `#version 300 es
    in vec4 position;
    void main() { gl_Position = position; }
  `;

  const FS = `#version 300 es
    precision highp float;
    out vec4 O;
    uniform vec2  resolution;
    uniform float time;
    uniform float isDark;   /* 0.0 = light, 1.0 = dark */

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float snoise(vec2 p) {
      vec2 i = floor(p), f = fract(p), u = f*f*(3.-2.*f);
      return mix(mix(hash(i), hash(i+vec2(1,0)), u.x),
                 mix(hash(i+vec2(0,1)), hash(i+1.), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v=0., a=.5;
      for(int i=0;i<4;i++){v+=a*snoise(p);p*=2.;a*=.5;}
      return v;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / resolution;
      float T = time * 0.12;

      /* Floating colour blobs — 4 attractors */
      vec2 b1 = vec2(cos(T * 0.7)  * 0.38 + 0.50, sin(T * 0.50) * 0.30 + 0.52);
      vec2 b2 = vec2(sin(T * 0.45) * 0.40 + 0.48, cos(T * 0.65) * 0.38 + 0.48);
      vec2 b3 = vec2(cos(T * 0.9 + 1.2) * 0.32 + 0.50, sin(T * 0.30 + 2.1) * 0.32 + 0.50);
      vec2 b4 = vec2(sin(T * 0.55 + 0.8) * 0.35 + 0.50, cos(T * 0.80 + 1.5) * 0.28 + 0.48);

      /* Soft distance weights */
      float w1 = 1. / (pow(length(uv - b1), 1.5) + 0.30);
      float w2 = 1. / (pow(length(uv - b2), 1.5) + 0.30);
      float w3 = 1. / (pow(length(uv - b3), 1.5) + 0.30);
      float w4 = 1. / (pow(length(uv - b4), 1.5) + 0.30);
      float wSum = w1 + w2 + w3 + w4;

      /* Colours — lime / purple / teal / amber */
      vec3 cLime   = vec3(0.42, 0.88, 0.15);
      vec3 cPurple = vec3(0.27, 0.15, 0.68);
      vec3 cTeal   = vec3(0.03, 0.55, 0.55);
      vec3 cAmber  = vec3(0.75, 0.42, 0.05);

      vec3 mesh = (cLime*w1 + cPurple*w2 + cTeal*w3 + cAmber*w4) / wSum;

      /* Add subtle fbm texture */
      float n = fbm(uv * 3.5 + T * 0.3) * 0.15;
      mesh += n;

      /* Dark mode bg vs light mode bg */
      vec3 darkBg  = vec3(0.11, 0.12, 0.15);  /* #1c1f26 */
      vec3 lightBg = vec3(0.96, 0.96, 0.97);  /* #f4f5f7 */
      vec3 bg = mix(lightBg, darkBg, isDark);

      /* Blend: vivid in dark, subtle in light */
      float strength = mix(0.09, 0.28, isDark);
      vec3 col = mix(bg, mesh, strength);

      O = vec4(col, 1.0);
    }
  `;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s); return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER,   VS));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog); gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,1,-1,-1,1,1,1,-1]), gl.STATIC_DRAW);
  const posLoc = gl.getAttribLocation(prog, 'position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const uRes    = gl.getUniformLocation(prog, 'resolution');
  const uTime   = gl.getUniformLocation(prog, 'time');
  const uIsDark = gl.getUniformLocation(prog, 'isDark');

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width  = window.innerWidth  * dpr;
    canvas.height = window.innerHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener('resize', resize);

  function loop(now) {
    const dark = document.body.dataset.theme === 'dark' ? 1.0 : 0.0;
    gl.uniform2f(uRes,   canvas.width, canvas.height);
    gl.uniform1f(uTime,  now * 0.001);
    gl.uniform1f(uIsDark, dark);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
