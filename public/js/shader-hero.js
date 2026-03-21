/**
 * ShaderHero — vanilla JS port of animated-shader-hero.tsx
 * WebGL2 nebula/galaxy shader with pointer interaction.
 * Call: ShaderHero.init(opts)
 *   opts.container — DOM element to inject into (default: document.body)
 */
(function () {
  'use strict';

  // ── GLSL Fragment Shader (exact from original component) ─────────────────────
  var FRAG_SRC = `#version 300 es
/*
 * made by Matthias Hurrle (@atzedent)
 */
precision highp float;
out vec4 O;
uniform vec2 resolution;
uniform float time;
uniform vec2 move;
uniform vec2 touch;
uniform int pointerCount;
uniform vec2 pointers;
#define FC gl_FragCoord.xy
#define T time
#define R resolution
#define MN min(R.x,R.y)

float rnd(vec2 p) {
  p=fract(p*vec2(12.9898,78.233));
  p+=dot(p,p+34.56);
  return fract(p.x*p.y);
}

float noise(in vec2 p) {
  vec2 i=floor(p), f=fract(p), u=f*f*(3.-2.*f);
  float
  a=rnd(i),
  b=rnd(i+vec2(1,0)),
  c=rnd(i+vec2(0,1)),
  d=rnd(i+1.);
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}

float fbm(vec2 p) {
  float t=.0, a=1.; mat2 m=mat2(1.,-.5,.2,1.2);
  for (int i=0; i<5; i++) {
    t+=a*noise(p);
    p*=2.*m;
    a*=.5;
  }
  return t;
}

float clouds(vec2 p) {
  float d=1., t=.0;
  for (float i=.0; i<3.; i++) {
    float a=d*fbm(i*10.+p.x*.2+.2*(1.+i)*p.y+d+i*i+p);
    t=mix(t,d,a);
    d=a;
    p*=2./(i+1.);
  }
  return t;
}

void main(void) {
  vec2 uv=(FC-.5*R)/MN, st=uv*vec2(2,1);
  vec3 col=vec3(0);
  float bg=clouds(vec2(st.x+T*.5,-st.y));
  uv*=1.-.3*(sin(T*.2)*.5+.5);
  for (float i=1.; i<12.; i++) {
    uv+=.1*cos(i*vec2(.1+.01*i, .8)+i*i+T*.5+.1*uv.x);
    vec2 p=uv;
    float d=length(p);
    col+=.00125/d*(cos(sin(i)*vec3(2,2,2))*.4+.55);
    float b=noise(i+p+bg*1.731);
    col+=.002*b/length(max(p,vec2(b*p.x*.02,p.y)));
    col=mix(col,vec3(bg*.18,bg*.18,bg*.18),d);
  }
  O=vec4(col,1);
}`;

  var VERT_SRC = `#version 300 es
precision highp float;
in vec4 position;
void main(){ gl_Position = position; }`;

  // ── WebGL Renderer ───────────────────────────────────────────────────────────
  function Renderer(canvas) {
    this.canvas  = canvas;
    this.gl      = canvas.getContext('webgl2');
    if (!this.gl) throw new Error('WebGL2 not supported');
    this.program = null;
    this.vs      = null;
    this.fs      = null;
    this.buffer  = null;
    this.uniforms = {};
    this.mouseMove    = [0, 0];
    this.mouseCoords  = [0, 0];
    this.pointerCoords = [0, 0];
    this.nbrPointers  = 0;
  }

  Renderer.prototype._compile = function (shader, src) {
    var gl = this.gl;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader error:', gl.getShaderInfoLog(shader));
    }
  };

  Renderer.prototype.setup = function () {
    var gl = this.gl;
    this.vs = gl.createShader(gl.VERTEX_SHADER);
    this.fs = gl.createShader(gl.FRAGMENT_SHADER);
    this._compile(this.vs, VERT_SRC);
    this._compile(this.fs, FRAG_SRC);
    this.program = gl.createProgram();
    gl.attachShader(this.program, this.vs);
    gl.attachShader(this.program, this.fs);
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(this.program));
      return;
    }

    // Geometry
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,1,-1,-1,1,1,1,-1]), gl.STATIC_DRAW);
    var pos = gl.getAttribLocation(this.program, 'position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    // Uniforms
    this.uniforms = {
      resolution:   gl.getUniformLocation(this.program, 'resolution'),
      time:         gl.getUniformLocation(this.program, 'time'),
      move:         gl.getUniformLocation(this.program, 'move'),
      touch:        gl.getUniformLocation(this.program, 'touch'),
      pointerCount: gl.getUniformLocation(this.program, 'pointerCount'),
      pointers:     gl.getUniformLocation(this.program, 'pointers'),
    };
  };

  Renderer.prototype.resize = function () {
    var dpr = Math.max(1, 0.5 * window.devicePixelRatio);
    var w   = (this.canvas.parentElement === document.body
      ? window.innerWidth  : this.canvas.parentElement.offsetWidth);
    var h   = (this.canvas.parentElement === document.body
      ? window.innerHeight : this.canvas.parentElement.offsetHeight);
    this.canvas.width  = w * dpr;
    this.canvas.height = h * dpr;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  };

  Renderer.prototype.render = function (now) {
    var gl = this.gl, p = this.program, u = this.uniforms;
    if (!p) return;
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(p);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.uniform2f(u.resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.time, now * 0.0003);
    gl.uniform2f(u.move,   this.mouseMove[0],    this.mouseMove[1]);
    gl.uniform2f(u.touch,  this.mouseCoords[0],  this.mouseCoords[1]);
    gl.uniform1i(u.pointerCount, this.nbrPointers);
    gl.uniform2fv(u.pointers, this.pointerCoords);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  Renderer.prototype.destroy = function () {
    var gl = this.gl;
    if (this.vs) gl.deleteShader(this.vs);
    if (this.fs) gl.deleteShader(this.fs);
    if (this.program) gl.deleteProgram(this.program);
    if (this.buffer)  gl.deleteBuffer(this.buffer);
  };

  // ── Pointer Handler ──────────────────────────────────────────────────────────
  function PointerHandler(element, renderer) {
    this.pointers   = new Map();
    this.lastCoords = [0, 0];
    this.moves      = [0, 0];
    this.active     = false;
    var self = this;

    function map(x, y) {
      var r   = element.getBoundingClientRect();
      var dpr = Math.max(1, 0.5 * window.devicePixelRatio);
      return [(x - r.left) * dpr, element.height - (y - r.top) * dpr];
    }

    element.addEventListener('pointerdown', function (e) {
      self.active = true;
      self.pointers.set(e.pointerId, map(e.clientX, e.clientY));
      renderer.nbrPointers = self.pointers.size;
    });

    element.addEventListener('pointerup', function (e) {
      if (self.pointers.size === 1) self.lastCoords = self._first();
      self.pointers.delete(e.pointerId);
      self.active = self.pointers.size > 0;
      renderer.nbrPointers = self.pointers.size;
    });

    element.addEventListener('pointerleave', function (e) {
      if (self.pointers.size === 1) self.lastCoords = self._first();
      self.pointers.delete(e.pointerId);
      self.active = self.pointers.size > 0;
      renderer.nbrPointers = self.pointers.size;
    });

    element.addEventListener('pointermove', function (e) {
      if (!self.active) return;
      self.pointers.set(e.pointerId, map(e.clientX, e.clientY));
      self.moves = [self.moves[0] + e.movementX, self.moves[1] + e.movementY];
      renderer.mouseMove   = self.moves;
      renderer.mouseCoords = self._first();
      renderer.pointerCoords = self.pointers.size > 0
        ? Array.from(self.pointers.values()).flat()
        : [0, 0];
    });
  }

  PointerHandler.prototype._first = function () {
    var val = this.pointers.values().next().value;
    return val || this.lastCoords;
  };

  // ── Public API ───────────────────────────────────────────────────────────────
  window.ShaderHero = {
    init: function (opts) {
      opts = opts || {};
      if (document.getElementById('sh-canvas')) return;

      var container = opts.container || document.body;
      var isBody    = (container === document.body);

      var canvas = document.createElement('canvas');
      canvas.id  = 'sh-canvas';
      canvas.style.cssText = isBody
        ? 'position:fixed;inset:0;width:100%;height:100%;display:block;z-index:0;pointer-events:none;touch-action:none;'
        : 'position:absolute;inset:0;width:100%;height:100%;display:block;z-index:0;pointer-events:all;touch-action:none;';

      container.insertBefore(canvas, container.firstChild);

      var renderer;
      try {
        renderer = new Renderer(canvas);
        renderer.setup();
        renderer.resize();
      } catch (e) {
        console.warn('ShaderHero: WebGL2 init failed.', e);
        canvas.remove();
        return;
      }

      new PointerHandler(canvas, renderer);

      var running = true;
      function loop(now) {
        if (!running) return;
        renderer.render(now);
        requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);

      window.addEventListener('resize', function () { renderer.resize(); });

      return {
        stop: function () {
          running = false;
          renderer.destroy();
        }
      };
    }
  };
})();
