'use client';

// The "signal field": a slow phosphor-green aurora rendered with a tiny
// hand-written WebGL shader (no three.js — ~zero bundle cost). It sits
// behind hero sections and gives the whole site its living, expensive feel.
//
// It is careful about being a good citizen:
//   - pauses when scrolled off screen or the tab is hidden
//   - renders ONE static frame if the user prefers reduced motion
//   - falls back to a CSS gradient when WebGL is unavailable
//   - caps device-pixel-ratio so it stays cheap on retina screens

import { useEffect, useRef, useState } from 'react';

const FRAG = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;

// Cheap value noise + fbm — enough for smoke-like drift.
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = uv;
  p.x *= u_res.x / u_res.y;
  float t = u_time * 0.045;

  // Two drifting aurora bodies, distorted by fbm.
  float n1 = fbm(p * 1.6 + vec2(t, -t * 0.6));
  float n2 = fbm(p * 2.3 - vec2(t * 0.8, t * 0.4) + 4.0);
  float body1 = smoothstep(0.45, 0.9, n1) * smoothstep(1.05, 0.35, uv.y);
  float body2 = smoothstep(0.5, 0.95, n2) * smoothstep(-0.1, 0.55, uv.y) * smoothstep(1.2, 0.5, uv.y);

  vec3 mint = vec3(0.212, 0.886, 0.659);   // #36e2a8
  vec3 icy  = vec3(0.486, 0.961, 0.796);   // #7cf5cb
  vec3 deep = vec3(0.059, 0.643, 0.478);   // #0fa47a

  vec3 col = vec3(0.0);
  col += mint * body1 * 0.32;
  col += icy  * body2 * 0.16;
  col += deep * fbm(p * 0.9 + t) * 0.10;

  // A faint scanline that sweeps down every ~9 seconds — the product motif.
  float sweep = fract(u_time / 9.0);
  float line = exp(-pow((uv.y - (1.0 - sweep)) * 60.0, 2.0));
  col += icy * line * 0.06;

  // Vignette so edges dissolve into the obsidian page background.
  float vig = smoothstep(1.25, 0.35, length(uv - vec2(0.5, 0.55)));
  col *= vig;

  float alpha = clamp(max(max(col.r, col.g), col.b) * 1.6, 0.0, 0.85);
  gl_FragColor = vec4(col, alpha);
}
`;

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

export function SignalField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { alpha: true, antialias: false });
    if (!gl) {
      setFailed(true);
      return;
    }

    function compile(type: number, src: string) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      return s;
    }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      setFailed(true);
      return;
    }
    gl.useProgram(prog);

    // One full-screen triangle pair.
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'u_res');
    const uTime = gl.getUniformLocation(prog, 'u_time');
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let raf = 0;
    let visible = true;
    const start = performance.now();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = canvas!.clientWidth * dpr;
      const h = canvas!.clientHeight * dpr;
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
        gl!.viewport(0, 0, w, h);
      }
    }

    function frame(now: number) {
      resize();
      gl!.uniform2f(uRes, canvas!.width, canvas!.height);
      gl!.uniform1f(uTime, (now - start) / 1000);
      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.drawArrays(gl!.TRIANGLES, 0, 6);
    }

    function loop(now: number) {
      frame(now);
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    }

    if (reduceMotion) {
      // Single beautiful still frame — no loop at all.
      requestAnimationFrame(() => frame(start + 20000));
      return () => void 0;
    }

    const io = new IntersectionObserver(([entry]) => {
      const wasVisible = visible;
      visible = entry.isIntersecting;
      if (visible && !wasVisible) raf = requestAnimationFrame(loop);
    });
    io.observe(canvas);

    function onVisibility() {
      if (!document.hidden && visible) raf = requestAnimationFrame(loop);
    }
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  if (failed) {
    // No WebGL: a quiet static glow keeps the composition intact.
    return (
      <div
        aria-hidden
        className={className}
        style={{
          background:
            'radial-gradient(60% 50% at 50% 30%, rgba(54,226,168,0.14), transparent 70%)',
        }}
      />
    );
  }

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
