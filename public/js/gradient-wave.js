/**
 * GradientWave — vanilla JS port of the React/WebGL GradientWave component.
 * Creates an animated noise-deformed gradient mesh (Stripe-style background).
 * Call: GradientWave.init(canvasEl, options)
 */
(function () {
  'use strict';

  function normalizeColor(hex) {
    return [
      ((hex >> 16) & 255) / 255,
      ((hex >> 8)  & 255) / 255,
      ( hex        & 255) / 255,
    ];
  }

  // ── MiniGl ──────────────────────────────────────────────────────────────────
  function MiniGl(canvas) {
    this.canvas  = canvas;
    this.meshes  = [];
    const gl     = canvas.getContext('webgl', { antialias: true });
    if (!gl) throw new Error('WebGL not supported');
    this.gl = gl;

    const context = gl;
    const _self   = this;

    // ── Uniform ──────────────────────────────────────────────────────────────
    this.Uniform = function (opts) {
      Object.assign(this, opts);
      const map = { float:'1f', int:'1i', vec2:'2fv', vec3:'3fv', vec4:'4fv', mat4:'Matrix4fv' };
      this.typeFn = map[this.type] || '1f';
    };
    this.Uniform.prototype.update = function (loc) {
      if (this.value === undefined || loc === null) return;
      const isMatrix = this.typeFn.indexOf('Matrix') === 0;
      if (isMatrix) context['uniform' + this.typeFn](loc, this.transpose || false, this.value);
      else          context['uniform' + this.typeFn](loc, this.value);
    };
    this.Uniform.prototype.getDeclaration = function (name, shaderType, length) {
      if (this.excludeFrom === shaderType) return '';
      if (this.type === 'array') {
        return this.value[0].getDeclaration(name, shaderType, this.value.length) +
               '\nconst int ' + name + '_length = ' + this.value.length + ';';
      }
      if (this.type === 'struct') {
        let nameNoPrefix = name.replace('u_', '');
        nameNoPrefix = nameNoPrefix.charAt(0).toUpperCase() + nameNoPrefix.slice(1);
        const fields = Object.entries(this.value)
          .map(([n, u]) => u.getDeclaration(n, shaderType).replace(/^uniform/, ''))
          .join('');
        return 'uniform struct ' + nameNoPrefix + ' {\n' + fields + '\n} ' + name +
               (length ? '[' + length + ']' : '') + ';';
      }
      return 'uniform ' + this.type + ' ' + name + (length ? '[' + length + ']' : '') + ';';
    };

    // ── Attribute ─────────────────────────────────────────────────────────────
    this.Attribute = function (opts) {
      this.type       = context.FLOAT;
      this.normalized = false;
      this.buffer     = context.createBuffer();
      Object.assign(this, opts);
    };
    this.Attribute.prototype.update = function () {
      if (this.values) {
        context.bindBuffer(this.target, this.buffer);
        context.bufferData(this.target, this.values, context.STATIC_DRAW);
      }
    };
    this.Attribute.prototype.attach = function (name, program) {
      const loc = context.getAttribLocation(program, name);
      if (this.target === context.ARRAY_BUFFER) {
        context.bindBuffer(this.target, this.buffer);
        context.enableVertexAttribArray(loc);
        context.vertexAttribPointer(loc, this.size, this.type, this.normalized, 0, 0);
      }
      return loc;
    };
    this.Attribute.prototype.use = function (loc) {
      context.bindBuffer(this.target, this.buffer);
      if (this.target === context.ARRAY_BUFFER) {
        context.enableVertexAttribArray(loc);
        context.vertexAttribPointer(loc, this.size, this.type, this.normalized, 0, 0);
      }
    };

    // ── Material ──────────────────────────────────────────────────────────────
    this.Material = function (vertSrc, fragSrc, uniforms) {
      uniforms = uniforms || {};
      this.uniforms         = uniforms;
      this.uniformInstances = [];

      function compileShader(type, src) {
        const s = context.createShader(type);
        context.shaderSource(s, src);
        context.compileShader(s);
        if (!context.getShaderParameter(s, context.COMPILE_STATUS)) {
          console.error(context.getShaderInfoLog(s));
          throw new Error('Shader compile error');
        }
        return s;
      }

      function uniformDecls(uniforms, type) {
        return Object.entries(uniforms)
          .map(([name, u]) => u.getDeclaration(name, type))
          .join('\n');
      }

      const prefix = 'precision highp float;';
      const vSrc = prefix + '\nattribute vec4 position;\nattribute vec2 uv;\nattribute vec2 uvNorm;\n' +
                   uniformDecls(_self.commonUniforms, 'vertex') + '\n' +
                   uniformDecls(uniforms, 'vertex') + '\n' + vertSrc;
      const fSrc = prefix + '\n' +
                   uniformDecls(_self.commonUniforms, 'fragment') + '\n' +
                   uniformDecls(uniforms, 'fragment') + '\n' + fragSrc;

      this.program = context.createProgram();
      context.attachShader(this.program, compileShader(context.VERTEX_SHADER,   vSrc));
      context.attachShader(this.program, compileShader(context.FRAGMENT_SHADER, fSrc));
      context.linkProgram(this.program);
      if (!context.getProgramParameter(this.program, context.LINK_STATUS)) {
        console.error(context.getProgramInfoLog(this.program));
        throw new Error('Program link error');
      }
      context.useProgram(this.program);
      this.attachUniforms(undefined, _self.commonUniforms);
      this.attachUniforms(undefined, this.uniforms);
    };
    this.Material.prototype.attachUniforms = function (name, uniforms) {
      if (name === undefined) {
        Object.entries(uniforms).forEach(([n, u]) => this.attachUniforms(n, u));
      } else if (uniforms.type === 'array') {
        uniforms.value.forEach((u, i) => this.attachUniforms(name + '[' + i + ']', u));
      } else if (uniforms.type === 'struct') {
        Object.entries(uniforms.value).forEach(([u, v]) => this.attachUniforms(name + '.' + u, v));
      } else {
        this.uniformInstances.push({
          uniform:  uniforms,
          location: context.getUniformLocation(this.program, name),
        });
      }
    };

    // ── PlaneGeometry ─────────────────────────────────────────────────────────
    this.PlaneGeometry = function () {
      this.width      = 1;
      this.height     = 1;
      this.vertexCount = 0;
      this.xSegCount  = 0;
      this.ySegCount  = 0;
      this.attributes = {
        position: new _self.Attribute({ target: context.ARRAY_BUFFER,         size: 3 }),
        uv:       new _self.Attribute({ target: context.ARRAY_BUFFER,         size: 2 }),
        uvNorm:   new _self.Attribute({ target: context.ARRAY_BUFFER,         size: 2 }),
        index:    new _self.Attribute({ target: context.ELEMENT_ARRAY_BUFFER, size: 3, type: context.UNSIGNED_SHORT }),
      };
    };
    this.PlaneGeometry.prototype.setTopology = function (xSegs, ySegs) {
      xSegs = xSegs || 1; ySegs = ySegs || 1;
      this.xSegCount   = xSegs;
      this.ySegCount   = ySegs;
      this.vertexCount = (xSegs + 1) * (ySegs + 1);
      const quadCount  = xSegs * ySegs * 2;
      this.attributes.uv.values     = new Float32Array(2 * this.vertexCount);
      this.attributes.uvNorm.values = new Float32Array(2 * this.vertexCount);
      this.attributes.index.values  = new Uint16Array(3 * quadCount);
      for (let y = 0; y <= ySegs; y++) {
        for (let x = 0; x <= xSegs; x++) {
          const i = y * (xSegs + 1) + x;
          this.attributes.uv.values[2*i]     = x / xSegs;
          this.attributes.uv.values[2*i + 1] = 1 - y / ySegs;
          this.attributes.uvNorm.values[2*i]     = (x / xSegs) * 2 - 1;
          this.attributes.uvNorm.values[2*i + 1] = 1 - (y / ySegs) * 2;
          if (x < xSegs && y < ySegs) {
            const s = y * xSegs + x;
            this.attributes.index.values[6*s]     = i;
            this.attributes.index.values[6*s + 1] = i + 1 + xSegs;
            this.attributes.index.values[6*s + 2] = i + 1;
            this.attributes.index.values[6*s + 3] = i + 1;
            this.attributes.index.values[6*s + 4] = i + 1 + xSegs;
            this.attributes.index.values[6*s + 5] = i + 2 + xSegs;
          }
        }
      }
      this.attributes.uv.update();
      this.attributes.uvNorm.update();
      this.attributes.index.update();
    };
    this.PlaneGeometry.prototype.setSize = function (w, h) {
      this.width  = w; this.height = h;
      this.attributes.position.values = new Float32Array(3 * this.vertexCount);
      const ox = w / -2, oy = h / -2, sw = w / this.xSegCount, sh = h / this.ySegCount;
      for (let y = 0; y <= this.ySegCount; y++) {
        const py = oy + y * sh;
        for (let x = 0; x <= this.xSegCount; x++) {
          const i = y * (this.xSegCount + 1) + x;
          this.attributes.position.values[3*i]     = ox + x * sw;
          this.attributes.position.values[3*i + 1] = -py;
          this.attributes.position.values[3*i + 2] = 0;
        }
      }
      this.attributes.position.update();
    };

    // ── Mesh ──────────────────────────────────────────────────────────────────
    this.Mesh = function (geometry, material) {
      this.geometry           = geometry;
      this.material           = material;
      this.attributeInstances = [];
      Object.entries(geometry.attributes).forEach(([name, attr]) => {
        this.attributeInstances.push({
          attribute: attr,
          location:  attr.attach(name, material.program),
        });
      });
      _self.meshes.push(this);
    };
    this.Mesh.prototype.draw = function () {
      context.useProgram(this.material.program);
      this.material.uniformInstances.forEach(({ uniform, location }) => uniform.update(location));
      this.attributeInstances.forEach(({ attribute, location }) => attribute.use(location));
      context.drawElements(context.TRIANGLES,
        this.geometry.attributes.index.values.length,
        context.UNSIGNED_SHORT, 0);
    };

    // ── Common uniforms ───────────────────────────────────────────────────────
    const I = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
    this.commonUniforms = {
      projectionMatrix: new this.Uniform({ type: 'mat4',  value: I }),
      modelViewMatrix:  new this.Uniform({ type: 'mat4',  value: I }),
      resolution:       new this.Uniform({ type: 'vec2',  value: [1,1] }),
      aspectRatio:      new this.Uniform({ type: 'float', value: 1 }),
    };
  }

  MiniGl.prototype.setSize = function (w, h) {
    this.width = w; this.height = h;
    this.canvas.width = w; this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
    this.commonUniforms.resolution.value = [w, h];
    this.commonUniforms.aspectRatio.value = w / h;
  };
  MiniGl.prototype.setOrthographicCamera = function () {
    this.commonUniforms.projectionMatrix.value = [
      2/this.width, 0, 0, 0,
      0, 2/this.height, 0, 0,
      0, 0, -0.001, 0,
      0, 0, 0, 1,
    ];
  };
  MiniGl.prototype.render = function () {
    this.gl.clearColor(0,0,0,0);
    this.gl.clearDepth(1);
    this.meshes.forEach(m => m.draw());
  };

  // ── Gradient ────────────────────────────────────────────────────────────────
  function Gradient(canvas, opts) {
    opts = opts || {};
    const colors        = opts.colors        || ['#0a0f1a','#6be026','#6126d1','#0bc5ea','#0a0f1a'];
    const shadowPower   = opts.shadowPower   !== undefined ? opts.shadowPower   : 5;
    const darkenTop     = opts.darkenTop     !== undefined ? opts.darkenTop     : false;
    const noiseFreq     = opts.noiseFrequency || [0.0001, 0.0002];
    const noiseSpeed    = opts.noiseSpeed    !== undefined ? opts.noiseSpeed    : 0.000005;
    const deform        = opts.deform        || { incline: 0.2, noiseAmp: 100, noiseFlow: 2 };

    this.minigl = new MiniGl(canvas);
    this.time   = 0;
    this.last   = 0;
    this.animId = null;
    this.isPlaying = false;

    const sectionColors = colors.map(hex =>
      normalizeColor(parseInt(hex.replace('#',''), 16))
    );

    const U = this.minigl.Uniform.bind(this.minigl.Uniform);

    const uniforms = {
      u_time:          new U({ value: 0 }),
      u_shadow_power:  new U({ value: shadowPower }),
      u_darken_top:    new U({ value: darkenTop ? 1 : 0 }),
      u_active_colors: new U({ value: [1,1,1,1], type: 'vec4' }),
      u_global:        new U({ value: {
        noiseFreq:  new U({ value: noiseFreq, type: 'vec2' }),
        noiseSpeed: new U({ value: noiseSpeed }),
      }, type: 'struct' }),
      u_vertDeform: new U({ value: {
        incline:      new U({ value: deform.incline      !== undefined ? deform.incline      : 0.2 }),
        offsetTop:    new U({ value: -0.5 }),
        offsetBottom: new U({ value: -0.5 }),
        noiseFreq:    new U({ value: [3, 4], type: 'vec2' }),
        noiseAmp:     new U({ value: deform.noiseAmp     !== undefined ? deform.noiseAmp     : 100 }),
        noiseSpeed:   new U({ value: 10 }),
        noiseFlow:    new U({ value: deform.noiseFlow    !== undefined ? deform.noiseFlow    : 2 }),
        noiseSeed:    new U({ value: 5 }),
      }, type: 'struct', excludeFrom: 'fragment' }),
      u_baseColor: new U({ value: sectionColors[0], type: 'vec3', excludeFrom: 'fragment' }),
      u_waveLayers: new U({ value: [], excludeFrom: 'fragment', type: 'array' }),
    };

    for (let i = 1; i < sectionColors.length; i++) {
      uniforms.u_waveLayers.value.push(new U({ value: {
        color:      new U({ value: sectionColors[i], type: 'vec3' }),
        noiseFreq:  new U({ value: [2 + i/sectionColors.length, 3 + i/sectionColors.length], type: 'vec2' }),
        noiseSpeed: new U({ value: 11 + 0.3 * i }),
        noiseFlow:  new U({ value: 6.5 + 0.3 * i }),
        noiseSeed:  new U({ value: 5 + 10 * i }),
        noiseFloor: new U({ value: 0.1 }),
        noiseCeil:  new U({ value: 0.63 + 0.07 * i }),
      }, type: 'struct' }));
    }

    const vertexShader = `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);
  const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;
  vec4 s1=floor(b1)*2.+1.;
  vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
  m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
vec3 blendNormal(vec3 base,vec3 blend){return blend;}
vec3 blendNormal(vec3 base,vec3 blend,float opacity){return blend*opacity+base*(1.-opacity);}
varying vec3 v_color;
void main(){
  float time=u_time*u_global.noiseSpeed;
  vec2 noiseCoord=resolution*uvNorm*u_global.noiseFreq;
  float tilt=resolution.y/2.*uvNorm.y;
  float incline=resolution.x*uvNorm.x/2.*u_vertDeform.incline;
  float offset=resolution.x/2.*u_vertDeform.incline*mix(u_vertDeform.offsetBottom,u_vertDeform.offsetTop,uv.y);
  float noise=snoise(vec3(
    noiseCoord.x*u_vertDeform.noiseFreq.x+time*u_vertDeform.noiseFlow,
    noiseCoord.y*u_vertDeform.noiseFreq.y,
    time*u_vertDeform.noiseSpeed+u_vertDeform.noiseSeed
  ))*u_vertDeform.noiseAmp;
  noise*=1.-pow(abs(uvNorm.y),2.);
  noise=max(0.,noise);
  vec3 pos=vec3(position.x,position.y+tilt+incline+noise-offset,position.z);
  v_color=u_baseColor;
  for(int i=0;i<u_waveLayers_length;i++){
    if(u_active_colors[i+1]==1.){
      WaveLayers layer=u_waveLayers[i];
      float layerNoise=smoothstep(
        layer.noiseFloor,layer.noiseCeil,
        snoise(vec3(
          noiseCoord.x*layer.noiseFreq.x+time*layer.noiseFlow,
          noiseCoord.y*layer.noiseFreq.y,
          time*layer.noiseSpeed+layer.noiseSeed
        ))/2.+.5
      );
      v_color=blendNormal(v_color,layer.color,pow(layerNoise,4.));
    }
  }
  gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.);
}`;

    const fragmentShader = `
varying vec3 v_color;
void main(){
  vec3 color=v_color;
  if(u_darken_top==1.){
    vec2 st=gl_FragCoord.xy/resolution.xy;
    color.g-=pow(st.y+sin(-12.)*st.x,u_shadow_power)*0.4;
  }
  gl_FragColor=vec4(color,1.);
}`;

    const material = new this.minigl.Material(vertexShader, fragmentShader, uniforms);
    const geometry = new this.minigl.PlaneGeometry();
    this.mesh = new this.minigl.Mesh(geometry, material);

    this._resize();
    const self = this;
    window.addEventListener('resize', function () { self._resize(); });
  }

  Gradient.prototype._resize = function () {
    const w = window.innerWidth, h = window.innerHeight;
    this.minigl.setSize(w, h);
    this.minigl.setOrthographicCamera();
    const xSeg = Math.ceil(w * 0.02);
    const ySeg = Math.ceil(h * 0.05);
    this.mesh.geometry.setTopology(xSeg, ySeg);
    this.mesh.geometry.setSize(w, h);
    this.mesh.material.uniforms.u_shadow_power.value = w < 600 ? 5 : 6;
  };

  Gradient.prototype.start = function () {
    this.isPlaying = true;
    const self = this;
    const tick = function (ts) {
      if (!self.isPlaying) return;
      self.time += Math.min(ts - self.last, 1000 / 15);
      self.last = ts;
      self.mesh.material.uniforms.u_time.value = self.time;
      self.minigl.render();
      self.animId = requestAnimationFrame(tick);
    };
    this.animId = requestAnimationFrame(tick);
  };

  Gradient.prototype.stop = function () {
    this.isPlaying = false;
    if (this.animId) cancelAnimationFrame(this.animId);
  };

  // ── Public API ───────────────────────────────────────────────────────────────
  window.GradientWave = {
    /**
     * Injects an animated gradient wave canvas.
     * opts.container  — DOM element to inject into (default: document.body)
     *                   When a container is given the canvas is position:absolute
     *                   so it fills that element. The container needs overflow:hidden.
     * opts.colors     — array of hex strings
     * opts.deform     — { incline, noiseAmp, noiseFlow }
     */
    init: function (opts) {
      opts = opts || {};
      if (document.getElementById('gw-canvas')) return;

      var container = opts.container || document.body;
      var isBody    = (container === document.body);

      var canvas = document.createElement('canvas');
      canvas.id  = 'gw-canvas';
      canvas.style.cssText = isBody
        ? 'position:fixed;inset:0;width:100%;height:100%;display:block;z-index:0;pointer-events:none;'
        : 'position:absolute;inset:0;width:100%;height:100%;display:block;z-index:0;pointer-events:none;';

      container.insertBefore(canvas, container.firstChild);

      try {
        var g = new Gradient(canvas, opts);
        g.start();
      } catch (e) {
        console.warn('GradientWave: WebGL init failed, using CSS fallback.', e);
        canvas.remove();
      }
    },
  };
})();
