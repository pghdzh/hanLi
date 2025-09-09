// three-bg.ts
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

type CleanupFn = () => void;

/**
 * threeRef: Vue ref 指向容器 DOM 元素（threeRef.value）
 * 如果 threeRef.value 为空，会自动挂到 document.body
 * 返回 { cleanup }，在组件卸载时调用 cleanup() 清理资源
 */
export default (threeRef: any) => {
  const mountTarget = (threeRef && threeRef.value) || document.body;
  if (!mountTarget) {
    console.warn("three-bg: no mount target");
    return { cleanup: () => {} };
  }

  // 若已有旧 canvas（data-three-bg），移除避免重复
  try {
    const existing =
      mountTarget.querySelector &&
      (mountTarget.querySelector("[data-three-bg]") as HTMLElement | null);
    if (existing) existing.remove();
  } catch (e) {}

  // ---------- 场景、相机、渲染器 ----------
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 1.6, 14);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  const DPR = Math.min(window.devicePixelRatio || 1, 1.6);
  renderer.setPixelRatio(DPR);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0x000000, 0); // 透明背景
  renderer.outputEncoding = THREE.SRGBColorSpace;

  // 放在页面后面但不太极端，避免被其他负 z-index 组件覆盖

  renderer.domElement.style.pointerEvents = "none";
  renderer.domElement.setAttribute("data-three-bg", "true");

  mountTarget.appendChild(renderer.domElement);

  // Controls（用于内部平滑；默认禁用用户交互）
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enabled = false;
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.autoRotate = false;

  // 轻柔环境光
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.12);
  dirLight.position.set(3, 6, 4);
  scene.add(dirLight);

  // ---------- 设备与偏好检测 ----------
  const ua = navigator.userAgent || "";
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  const deviceMem = (navigator as any).deviceMemory || 4;
  const prefersReduced =
    typeof window !== "undefined" &&
    !!window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 根据设备选择粒子数量（保守）
  const BASE_PARTICLES = isMobile ? 1000 : deviceMem <= 2 ? 1000 : 2000;
  const PARTICLES = prefersReduced
    ? Math.max(120, Math.floor(BASE_PARTICLES * 0.35))
    : BASE_PARTICLES;

  // 稳定随机数（确定性外观）
  function mulberry32(seed: number) {
    return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(123456789);

  // ---------- 背景 Quad（渐变 + 中心柔光） ----------
  const bgGeo = new THREE.PlaneGeometry(2, 2);
  const bgMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      u_time: { value: 0 },
      u_resolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
      },
      u_center: { value: new THREE.Vector2(0.5, 0.46) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision mediump float;
      varying vec2 vUv;
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_center;

      // 低调渐变 + 轻微雾
      void main() {
        vec2 uv = vUv;
        float aspect = u_resolution.x / u_resolution.y;
        vec2 pos = (uv - u_center) * vec2(aspect, 1.0);
        float d = length(pos);

        vec3 base = mix(vec3(0.03,0.05,0.07), vec3(0.04,0.06,0.09), uv.y);
        float glow = exp(-pow(d * 2.0, 2.0));
        vec3 warm = vec3(0.94, 0.82, 0.50) * 0.14 * glow;

        // 轻微流动的薄雾
        float t = u_time * 0.03;
        float fog = 0.02 * (sin((uv.x + t)*6.0) * 0.5 + 0.5) + 0.01 * (cos((uv.y - t)*4.0)*0.5 + 0.5);

        vec3 col = base + warm + fog;
        gl_FragColor = vec4(col, 0.96);
      }
    `,
  });
  const bgMesh = new THREE.Mesh(bgGeo, bgMat);
  bgMesh.frustumCulled = false;
  scene.add(bgMesh);

  // ---------- 点纹理生成（Canvas -> Texture） ----------
  function makeDotTexture(size = 64, color = "rgba(255,255,255,1)") {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, size, size);
    const g = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2
    );
    g.addColorStop(0, color);
    g.addColorStop(0.4, "rgba(255,255,255,0.6)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.encoding = THREE.SRGBColorSpace;
    return tex;
  }

  const whiteTex = makeDotTexture(isMobile ? 36 : 96, "rgba(220,235,255,1)");
  const goldTex = makeDotTexture(isMobile ? 28 : 72, "rgba(245,220,140,1)");

  // ---------- 粒子 Geometry ----------
  const pGeo = new THREE.BufferGeometry();
  const count = Math.max(10, Math.floor(PARTICLES));
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const tone = new Float32Array(count); // 0 white, 1 gold

  for (let i = 0; i < count; i++) {
    const r = 6 + rand() * 36;
    const ang = rand() * Math.PI * 2;
    positions[i * 3 + 0] = Math.cos(ang) * r * (0.6 + rand() * 0.9);
    positions[i * 3 + 1] = (rand() - 0.45) * 6.0;
    positions[i * 3 + 2] = Math.sin(ang) * r * (0.6 + rand() * 0.9);

    sizes[i] = 0.6 + rand() * 1.9;
    phases[i] = rand() * Math.PI * 2;
    tone[i] = rand() < 0.07 ? 1.0 : 0.0; // 大约 7% 金色点缀
  }

  pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  pGeo.setAttribute("a_size", new THREE.BufferAttribute(sizes, 1));
  pGeo.setAttribute("a_phase", new THREE.BufferAttribute(phases, 1));
  pGeo.setAttribute("a_tone", new THREE.BufferAttribute(tone, 1));

  // ---------- 粒子 Shader（稳健的点大小计算） ----------
  const particleMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      u_time: { value: 0 },
      u_pointWhite: { value: whiteTex },
      u_pointGold: { value: goldTex },
    },
    vertexShader: `
      attribute float a_size;
      attribute float a_phase;
      attribute float a_tone;
      uniform float u_time;
      varying float vPhase;
      varying float vTone;
      varying float vDepth;
      void main() {
        vPhase = a_phase;
        vTone = a_tone;
        vec3 p = position;
        float t = u_time * 1.32;
        p.x += 0.26 * sin(a_phase + t * 0.18);
        p.y += 0.22 * cos(a_phase * 0.7 + t * 0.21);
        p.z += 0.16 * sin(a_phase * 0.6 + t * 0.15);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);

        // 避免 -mv.z 过小或正值
        float depth = max(0.0001, -mv.z);
        float scale = 110.0;
        float psize = a_size * (scale / (depth + 6.0));
        gl_PointSize = clamp(psize, 1.0, 44.0);

        gl_Position = projectionMatrix * mv;
        vDepth = depth;
      }
    `,
    fragmentShader: `
      uniform sampler2D u_pointWhite;
      uniform sampler2D u_pointGold;
      varying float vPhase;
      varying float vTone;
      varying float vDepth;
      void main() {
        vec4 w = texture2D(u_pointWhite, gl_PointCoord);
        vec4 g = texture2D(u_pointGold, gl_PointCoord);
        vec4 col = mix(w, g, vTone);

        // 深度淡化
        float df = smoothstep(10.0, 60.0, vDepth);
        float alpha = col.a * (1.0 - df * 0.55);

        // 更低的阈值，避免全部被 discard
        if (alpha < 0.01) discard;

        float flick = 0.72 + 0.38 * sin(vPhase * 1.6 + vDepth * 0.02);
        vec3 color = col.rgb * flick * 0.95;
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });

  const particles = new THREE.Points(pGeo, particleMat);
  scene.add(particles);

  // ---------- 轻微拖尾效果（更简单、低成本） ----------
  // 原理：用半透明平面在屏幕上覆盖上一帧（低成本模拟短拖尾）
  // 仅在桌面且非 reduce 动作时开启
  const enableTrail = !prefersReduced && !isMobile;
  let trailMesh: THREE.Mesh | null = null;
  if (enableTrail) {
    const trailGeo = new THREE.PlaneGeometry(2, 2);
    const trailMat = new THREE.ShaderMaterial({
      uniforms: {
        u_amount: { value: 0.72 }, // 越小拖尾时间越短（0.12 是非常轻微）
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position,1.0); }`,
      fragmentShader: `
        precision mediump float;
        varying vec2 vUv;
        uniform float u_amount;
        void main(){
          // 以半透明黑做覆盖，模拟前帧残影残留（不破坏当前帧颜色）
          gl_FragColor = vec4(0.0,0.0,0.0,u_amount);
        }
      `,
      transparent: true,
      depthWrite: false,
    });
    trailMesh = new THREE.Mesh(trailGeo, trailMat);
    // trailScene 会在每帧先渲染 trailMesh 再渲染主场景（使上一帧渐隐）
    // 我们不需要把它加入主 scene，以便在渲染到屏幕后单独绘制
  }

  // ---------- 指针视差（桌面启用） ----------
  let tx = 0,
    ty = 0,
    cx = 0,
    cy = 0;
  function onPointer(e: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    tx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ty = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }
  if (!prefersReduced && !isMobile) {
    window.addEventListener("pointermove", onPointer, { passive: true });
  }

  // ---------- 初始 render（保证首帧） ----------
  bgMat.uniforms.u_time.value = 0;
  bgMat.uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
  particleMat.uniforms.u_time.value = 0;
  renderer.render(scene, camera);

  // ---------- 动画循环 ----------
  const clock = new THREE.Clock();
  let rafId: number | null = null;

  function animate() {
    const t = clock.getElapsedTime();

    // 视差平滑
    cx += (tx - cx) * 0.06;
    cy += (ty - cy) * 0.06;

    camera.position.x +=
      (cx * (isMobile ? 0.5 : 1.0) - camera.position.x) * 0.04;
    camera.position.y +=
      (cy * (isMobile ? 0.2 : 0.46) + 1.6 - camera.position.y) * 0.04;
    camera.lookAt(0, 0.2, 0);

    bgMat.uniforms.u_time.value = t;
    particleMat.uniforms.u_time.value = t;

    // 先渲染背景与粒子
    renderer.setRenderTarget(null);

    if (enableTrail && trailMesh) {
      // 轻微拖尾：先绘制 trailMesh 覆盖（半透明黑），让上一帧残留渐隐
      // 使用 scene2 渲染单独的平面，再渲染主场景
      const trailScene = new THREE.Scene();
      const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      trailScene.add(trailMesh);
      renderer.render(trailScene, quadCam);
    }

    renderer.render(scene, camera);

    if (!prefersReduced) {
      rafId = requestAnimationFrame(animate);
    } else {
      // 降帧（每秒 1 帧）以节省能耗
      setTimeout(() => {
        rafId = requestAnimationFrame(animate);
      }, 1000);
    }
  }
  rafId = requestAnimationFrame(animate);

  // ---------- 响应式 resize ----------
  function onResize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (bgMat.uniforms.u_resolution)
      (bgMat.uniforms.u_resolution.value as THREE.Vector2).set(w, h);
  }
  window.addEventListener("resize", onResize, { passive: true });

  // ---------- Cleanup ----------
  const cleanup: CleanupFn = () => {
    try {
      if (rafId) cancelAnimationFrame(rafId);
    } catch (e) {}
    try {
      window.removeEventListener("resize", onResize);
    } catch (e) {}
    try {
      if (!prefersReduced && !isMobile)
        window.removeEventListener("pointermove", onPointer);
    } catch (e) {}

    try {
      scene.remove(particles);
    } catch (e) {}
    try {
      scene.remove(bgMesh);
    } catch (e) {}
    try {
      pGeo.dispose();
    } catch (e) {}
    try {
      particleMat.dispose();
    } catch (e) {}
    try {
      whiteTex.dispose();
    } catch (e) {}
    try {
      goldTex.dispose();
    } catch (e) {}
    try {
      bgGeo.dispose();
    } catch (e) {}
    try {
      bgMat.dispose();
    } catch (e) {}
    try {
      controls.dispose();
    } catch (e) {}
    try {
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    } catch (e) {}
    try {
      renderer.dispose();
    } catch (e) {}
  };

  return { cleanup };
};
