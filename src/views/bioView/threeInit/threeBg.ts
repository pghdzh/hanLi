import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

type CleanupFn = () => void;

/**
 * threeRef: Vue ref 指向容器 DOM 元素（threeRef.value）
 * 返回：{ cleanup }  在组件卸载时调用 cleanup() 清理资源
 *
 * 增强版：为让“凡人修仙传·韩立”主题更明显，做出以下加强：
 * - 更暖的宣纸底色 + 视差更明显的山脉层次
 * - 更明亮、发光感强的烛灯（用叠加半透明 Sprite 模拟光晕）
 * - 会浮动的“书法字”精灵（CanvasTexture 绘制汉字，形象化传记）
 * - 更明显的墨点/灵气粒子，尺寸与色调增强
 * - 更粗的“修行绸带”、更明显的移动轨迹
 */
export default (threeRef: any) => {
  const dom = threeRef.value as HTMLElement;
  if (!dom) {
    console.warn("threeRef.value 为空");
    return { cleanup: () => {} };
  }

  let width = dom.clientWidth;
  let height = dom.clientHeight;

  const scene = new THREE.Scene();
  // 背景：暖宣纸到暗墨的垂直渐变
  scene.background = new THREE.Color(0x12080a);
  scene.fog = new THREE.FogExp2(0x0b0710, 0.0045);

  const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 600);
  camera.position.set(0, 5.2, 26);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  dom.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 10;
  controls.maxDistance = 80;
  controls.maxPolarAngle = Math.PI * 0.52;

  // 工具：生成简单渐变纹理
  function createGradientTexture(
    w: number,
    h: number,
    stops: Array<{ pos: number; color: string }>
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    for (const s of stops) g.addColorStop(s.pos, s.color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return { tex, canvas };
  }

  // 远景宣纸底色纹理（用于山体 & 叠加）
  const paperTex = createGradientTexture(32, 256, [
    { pos: 0, color: "#1a0f12" },
    { pos: 0.45, color: "#2b1922" },
    { pos: 1, color: "#080407" },
  ]).tex;

  // 分层山脉：加强对比与视差
  const mountainGroup = new THREE.Group();
  const mountainLayers: { mesh: THREE.Mesh; speed: number }[] = [];
  const layerConfigs = [
    {
      depth: -8,
      height: 14,
      opacity: 0.96,
      speed: 0.035,
      colorA: "#24161f",
      colorB: "#0d0607",
    },
    {
      depth: -14,
      height: 12,
      opacity: 0.78,
      speed: 0.02,
      colorA: "#180d15",
      colorB: "#070305",
    },
    {
      depth: -22,
      height: 10,
      opacity: 0.62,
      speed: 0.012,
      colorA: "#0f0a0c",
      colorB: "#020102",
    },
  ];

  layerConfigs.forEach((cfg, i) => {
    const w = 2048;
    const h = 256;
    const { tex } = createGradientTexture(w, h, [
      { pos: 0, color: cfg.colorA },
      { pos: 1, color: cfg.colorB },
    ]);

    const geom = new THREE.PlaneGeometry(120, cfg.height, 160, 1);
    const pos = geom.attributes.position as THREE.BufferAttribute;
    // 更强的轮廓扰动
    for (let vi = 0; vi < pos.count; vi++) {
      const x = pos.getX(vi);
      const noise =
        Math.sin((x + i * 18) * 0.12) * (1.8 + i * 0.9) +
        (Math.random() - 0.5) * 0.8;
      pos.setY(vi, noise - i * 1.6);
    }
    pos.needsUpdate = true;

    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: cfg.opacity,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, -2 - i * 0.8, cfg.depth);
    mountainGroup.add(mesh);
    mountainLayers.push({ mesh, speed: cfg.speed });
  });
  scene.add(mountainGroup);

  // 月亮（发光圆盘）
  function createDiscTexture(size = 256, color = "#fff8dc") {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
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
    g.addColorStop(0.5, "rgba(255,240,200,0.6)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }
  const moonTex = createDiscTexture(256, "#fff3d6");
  const moonMat = new THREE.SpriteMaterial({
    map: moonTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
  });
  const moon = new THREE.Sprite(moonMat);
  moon.scale.set(8, 8, 1);
  moon.position.set(-14, 8, -40);
  scene.add(moon);

  // 墨点 / 灵气粒子（更明显）
  function createInkTexture(size = 128, tint = "rgba(200,140,255,1)") {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, size, size);
    const g = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2
    );
    g.addColorStop(0, tint);
    g.addColorStop(0.4, "rgba(120,70,220,0.6)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }

  const inkTex = createInkTexture(128, "rgba(255,200,120,1)");
  const inkTex2 = createInkTexture(128, "rgba(200,120,255,1)");

  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(
    navigator.userAgent || ""
  );
  const PARTICLE_COUNT = isMobile ? 5000 : 18000;
  const partPos = new Float32Array(PARTICLE_COUNT * 3);
  const partScale = new Float32Array(PARTICLE_COUNT);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    partPos[i * 3 + 0] = (Math.random() - 0.5) * 120;
    partPos[i * 3 + 1] = Math.random() * 18 - 6;
    partPos[i * 3 + 2] = -Math.random() * 80 - 0.5;
    partScale[i] = Math.random() * 2.5 + 0.8;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(partPos, 3));
  pGeo.setAttribute("aScale", new THREE.BufferAttribute(partScale, 1));

  const pMat = new THREE.PointsMaterial({
    size: 0.3,
    map: inkTex,
    transparent: true,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    alphaTest: 0.01,
  });
  const inkPoints = new THREE.Points(pGeo, pMat);
  scene.add(inkPoints);

  // 更暖的烛灯（并加重光晕）
  function createLightTex(size = 128) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2
    );
    g.addColorStop(0, "rgba(255,245,200,1)");
    g.addColorStop(0.18, "rgba(255,200,120,0.9)");
    g.addColorStop(0.45, "rgba(255,140,60,0.28)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }

  const lightTex = createLightTex(256);
  const lanternMaterial = new THREE.SpriteMaterial({
    map: lightTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
  });

  const lanterns: THREE.Sprite[] = [];
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Sprite(lanternMaterial.clone());
    const scale = 3 + Math.random() * 1.8;
    s.scale.set(scale, scale, 1);
    s.position.set(
      (Math.random() - 0.5) * 40,
      Math.random() * 6 - 1,
      -6 - Math.random() * 40
    );
    scene.add(s);
    // 在 sprite material 中轻微改变 tint
    (s.material as THREE.SpriteMaterial).color.setHSL(
      0.08,
      0.9,
      0.65 - Math.random() * 0.18
    );
    lanterns.push(s);

    // 叠加一层柔和光晕（更明显的发光感）
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: lightTex,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthTest: false,
      })
    );
    glow.scale.set(scale * 2.6, scale * 2.6, 1);
    glow.position.copy(s.position);
    scene.add(glow);
  }



 

  // 修行绸带（加粗、发光弱色）
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-22, -3.5, -6),
    new THREE.Vector3(-10, -2.0, -14),
    new THREE.Vector3(0, 0.8, -22),
    new THREE.Vector3(10, 2.2, -34),
    new THREE.Vector3(24, 5.0, -46),
  ]);
  const tubeGeom = new THREE.TubeGeometry(curve, 160, 0.46, 12, false);
  const tubeMat = new THREE.MeshPhongMaterial({
    color: 0x2b1a22,
    emissive: 0x1a0b14,
    shininess: 12,
    transparent: true,
    opacity: 0.96,
  });
  const ribbon = new THREE.Mesh(tubeGeom, tubeMat);
  ribbon.rotation.x = -Math.PI / 12;
  scene.add(ribbon);

  // 轻弱环境光与定向主光模拟月色
  const hemi = new THREE.HemisphereLight(0xfff4e6, 0x060408, 0.18);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xfff0d6, 0.22);
  dir.position.set(8, 24, 8);
  scene.add(dir);

  // 渲染循环
  const clock = new THREE.Clock();

  function tick() {
    controls.update();
    const t = clock.getElapsedTime();

    // 山脉更明显的视差
    mountainLayers.forEach((layer, idx) => {
      const m = layer.mesh;
      m.position.x = Math.sin(t * (0.07 + idx * 0.02)) * (1.2 + idx * 0.8);
      m.position.y = -2 - idx * 0.8 + Math.cos(t * (0.06 + idx * 0.01)) * 0.12;
      m.rotation.z = Math.sin(t * 0.01 + idx) * 0.003;
    });

    // 粒子上升并增强闪烁
    const posAttr = inkPoints.geometry.getAttribute(
      "position"
    ) as THREE.BufferAttribute;
    const count = posAttr.count;
    for (let i = 0; i < count; i++) {
      let y = posAttr.getY(i);
      let x = posAttr.getX(i);
      let z = posAttr.getZ(i);
      y += 0.0035 + Math.sin((i % 17) + t * 0.9) * 0.0012;
      x += Math.sin(t * 0.14 + i * 0.23) * 0.0016;
      if (y > 18) {
        y = -8 - Math.random() * 3;
        z = -10 - Math.random() * 90;
      }
      posAttr.setY(i, y);
      posAttr.setX(i, x);
      posAttr.setZ(i, z);
    }
    posAttr.needsUpdate = true;

    // 烛灯漂浮、缩放呼吸
    lanterns.forEach((s, idx) => {
      s.position.y += 0.004 + Math.sin(t * 0.6 + idx) * 0.0012;
      s.position.x += Math.sin(t * 0.42 + idx * 0.9) * 0.003;
      if (s.position.y > 12) s.position.y = -1 - Math.random() * 2;
      const scale = 3.0 + Math.sin(t * 1.1 + idx) * 0.22;
      s.scale.setScalar(scale * (1 + idx * 0.06));
    });

    // 绸带细微脉动
    const tubePos = tubeGeom.attributes.position as THREE.BufferAttribute;
    for (let vi = 0; vi < tubePos.count; vi++) {
      const oy = tubePos.getY(vi);
      tubePos.setY(vi, oy + Math.sin(t * 0.5 + vi * 0.02) * 0.0012);
    }
    tubePos.needsUpdate = true;

  

    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(tick);

  function handleResize() {
    width = dom.clientWidth;
    height = dom.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }
  window.addEventListener("resize", handleResize);

  // Cleanup
  const cleanup: CleanupFn = () => {
    renderer.setAnimationLoop(null);
    window.removeEventListener("resize", handleResize);
    controls.dispose();

    scene.traverse((obj) => {
      if ((obj as any).geometry)
        try {
          (obj as any).geometry.dispose();
        } catch (e) {}
      if ((obj as any).material) {
        const mat = (obj as any).material;
        if (Array.isArray(mat))
          mat.forEach((m) => {
            try {
              m.dispose();
            } catch (e) {}
          });
        else
          try {
            mat.dispose();
          } catch (e) {}
      }
      if ((obj as any).texture)
        try {
          (obj as any).texture.dispose();
        } catch (e) {}
    });

    try {
      inkTex.dispose();
    } catch (e) {}
    try {
      inkTex2.dispose();
    } catch (e) {}
    try {
      paperTex.dispose();
    } catch (e) {}
    try {
      moonTex.dispose();
    } catch (e) {}
    try {
      lightTex.dispose();
    } catch (e) {}

    if (renderer.domElement && renderer.domElement.parentNode === dom) {
      dom.removeChild(renderer.domElement);
    }
    try {
      renderer.dispose();
    } catch (e) {}
  };

  return { cleanup };
};
