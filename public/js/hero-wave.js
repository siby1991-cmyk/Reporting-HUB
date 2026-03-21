/**
 * HeroWave — vanilla JS port of dynamic-wave-canvas-background.tsx
 * Per-pixel canvas 2D wave animation. Dark blue/purple tones.
 * Call: HeroWave.init(opts)
 *   opts.container — DOM element to inject into (default: document.body)
 */
(function () {
  'use strict';

  // Pre-computed sin/cos lookup tables for performance
  var SIN_TABLE = new Float32Array(1024);
  var COS_TABLE = new Float32Array(1024);
  for (var i = 0; i < 1024; i++) {
    var angle = (i / 1024) * Math.PI * 2;
    SIN_TABLE[i] = Math.sin(angle);
    COS_TABLE[i] = Math.cos(angle);
  }

  function fastSin(x) {
    var idx = Math.floor(((x % (Math.PI * 2)) / (Math.PI * 2)) * 1024) & 1023;
    if (idx < 0) idx += 1024;
    return SIN_TABLE[idx];
  }

  function fastCos(x) {
    var idx = Math.floor(((x % (Math.PI * 2)) / (Math.PI * 2)) * 1024) & 1023;
    if (idx < 0) idx += 1024;
    return COS_TABLE[idx];
  }

  window.HeroWave = {
    init: function (opts) {
      opts = opts || {};
      if (document.getElementById('hw-canvas')) return;

      var container = opts.container || document.body;
      var isBody    = (container === document.body);

      var canvas = document.createElement('canvas');
      canvas.id  = 'hw-canvas';
      canvas.style.cssText = isBody
        ? 'position:fixed;inset:0;width:100%;height:100%;display:block;z-index:0;pointer-events:none;'
        : 'position:absolute;inset:0;width:100%;height:100%;display:block;z-index:0;pointer-events:none;';

      container.insertBefore(canvas, container.firstChild);

      var ctx = canvas.getContext('2d');
      var SCALE = 2;
      var width, height, imageData, data;

      function resize() {
        canvas.width  = container === document.body ? window.innerWidth  : container.offsetWidth;
        canvas.height = container === document.body ? window.innerHeight : container.offsetHeight;
        width     = Math.floor(canvas.width  / SCALE);
        height    = Math.floor(canvas.height / SCALE);
        imageData = ctx.createImageData(width, height);
        data      = imageData.data;
      }

      window.addEventListener('resize', resize);
      resize();

      var startTime = Date.now();
      var running   = true;

      function render() {
        if (!running) return;

        var time = (Date.now() - startTime) * 0.001;

        for (var y = 0; y < height; y++) {
          for (var x = 0; x < width; x++) {
            var u_x = (2 * x - width)  / height;
            var u_y = (2 * y - height) / height;

            var a = 0, d = 0;
            for (var k = 0; k < 4; k++) {
              a += fastCos(k - d + time * 0.5 - a * u_x);
              d += fastSin(k * u_y + a);
            }

            var wave         = (fastSin(a) + fastCos(d)) * 0.5;
            var intensity    = 0.3 + 0.4 * wave;
            var baseVal      = 0.1 + 0.15 * fastCos(u_x + u_y + time * 0.3);
            var blueAccent   = 0.2  * fastSin(a * 1.5 + time * 0.2);
            var purpleAccent = 0.15 * fastCos(d * 2   + time * 0.1);

            var r = Math.max(0, Math.min(1, baseVal + purpleAccent * 0.8)) * intensity;
            var g = Math.max(0, Math.min(1, baseVal + blueAccent   * 0.6)) * intensity;
            var b = Math.max(0, Math.min(1, baseVal + blueAccent   * 1.2 + purpleAccent * 0.4)) * intensity;

            var idx = (y * width + x) * 4;
            data[idx]     = r * 255;
            data[idx + 1] = g * 255;
            data[idx + 2] = b * 255;
            data[idx + 3] = 255;
          }
        }

        ctx.putImageData(imageData, 0, 0);
        if (SCALE > 1) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(canvas, 0, 0, width, height, 0, 0, canvas.width, canvas.height);
        }

        requestAnimationFrame(render);
      }

      render();

      // Expose stop handle if needed
      return { stop: function () { running = false; } };
    }
  };
})();
