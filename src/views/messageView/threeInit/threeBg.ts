import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Water } from "three/addons/objects/Water.js";
import { Sky } from "three/addons/objects/Sky.js";

export default (threeRef) => {
  const container = threeRef.value;
  if (!container) {
    console.warn("threeRef.value 为空");
    return { cleanup: () => {} };
  }

  // --- 渲染器（限制 pixelRatio、可选关闭 antialias） ---
  const maxPixelRatio = Math.min(window.devicePixelRatio || 1, 2); // 上限 2
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(maxPixelRatio);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.5;
  renderer.outputEncoding = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // --- 场景与相机 ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0b10);

  const camera = new THREE.PerspectiveCamera(
    55,
    container.clientWidth / container.clientHeight,
    1,
    2000
  );
  camera.position.set(30, 30, 100);

  // --- 控制器（保留但关闭阻尼，避免每帧 update 开销） ---
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.enablePan = false;
  controls.enableZoom = true;
  controls.enableRotate = true;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.target.set(0, 10, 0);
  controls.minDistance = 40.0;
  controls.maxDistance = 200.0;
  controls.update();

  // --- 光源 / 环境贴图准备（PMREMGenerator） ---
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader(); // 预编译

  // --- Sky（只创建一次） ---
  const sky = new Sky();
  sky.scale.setScalar(10000);
  scene.add(sky);

  const skyUniforms = sky.material.uniforms;
  skyUniforms["turbidity"].value = 10;
  skyUniforms["rayleigh"].value = 2;
  skyUniforms["mieCoefficient"].value = 0.005;
  skyUniforms["mieDirectionalG"].value = 0.8;

  // --- 水面（texture loader 只调用一次） ---
  const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
  const waterNormals = new THREE.TextureLoader().load(
    "threeImg/waternormals.jpg",
    (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
    }
  );

  const water = new Water(waterGeometry, {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: waterNormals,
    sunDirection: new THREE.Vector3(),
    sunColor: 0xffffff,
    waterColor: 0x001e0f,
    distortionScale: 3.7,
    fog: scene.fog !== undefined,
  });
  water.rotation.x = -Math.PI / 2;
  scene.add(water);

  // --- 初始 Sun 参数与环境预计算（只在参数变化时更新 renderTarget） ---
  const parameters = { elevation: 2, azimuth: 180 };
  const sun = new THREE.Vector3();
  let envRenderTarget = null;

  function updateSun() {
    const phi = THREE.MathUtils.degToRad(90 - parameters.elevation);
    const theta = THREE.MathUtils.degToRad(parameters.azimuth);
    sun.setFromSphericalCoords(1, phi, theta);

    sky.material.uniforms["sunPosition"].value.copy(sun);
    water.material.uniforms["sunDirection"].value.copy(sun).normalize();

    // 释放旧的 renderTarget 并从 sky 生成新的 environment map（节流/只在参数改变时调用）
    if (envRenderTarget) {
      try {
        envRenderTarget.dispose();
      } catch (e) {}
      envRenderTarget = null;
    }
    // 使用 pmremGenerator 生成 environment
    envRenderTarget = pmremGenerator.fromScene(sky);
    scene.environment = envRenderTarget.texture;
  }

  updateSun();

  // --- 测试立方体（保持，若不需要可删除） ---
  const geometry = new THREE.BoxGeometry(30, 30, 30);
  const material = new THREE.MeshStandardMaterial({ roughness: 0 });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // --- 性能优化：仅在页面可见时渲染 ---
  let running = true;
  function handleVisibilityChange() {
    running = document.visibilityState === "visible";
  }
  document.addEventListener("visibilitychange", handleVisibilityChange);

  // --- resize 节流（使用 rAF） ---
  let resizePending = false;
  function onResize() {
    if (resizePending) return;
    resizePending = true;
    requestAnimationFrame(() => {
      resizePending = false;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      // pmremGenerator 可能需在极端大小变化下重新编译，但一般不用
    });
  }
  window.addEventListener("resize", onResize);

  // --- 渲染循环（使用 clock.delta 更新 water.time） ---
  const clock = new THREE.Clock();
  let accumTime = 0;
  function renderLoop() {
    if (!running) {
      // 不主动 render，但仍继续 schedule 下一帧以便恢复后继续工作
      requestAnimationFrame(renderLoop);
      return;
    }

    const delta = clock.getDelta();
    accumTime += delta;

    // 动画逻辑（尽量少每帧分配）
    mesh.position.y = Math.sin(accumTime * 1.0) * 20 + 5;
    mesh.rotation.x += delta * 0.5;
    mesh.rotation.y += delta * 0.51;

    // 使用 delta 来驱动 water time（稳定且与帧率无关）
    if (
      water.material &&
      water.material.uniforms &&
      water.material.uniforms["time"]
    ) {
      water.material.uniforms["time"].value += delta;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(renderLoop);
  }
  // 启动循环
  requestAnimationFrame(renderLoop);

  // --- public API: 允许外部更新太阳参数（如果需要） ---
  function setSunParams(next) {
    parameters.elevation = next.elevation ?? parameters.elevation;
    parameters.azimuth = next.azimuth ?? parameters.azimuth;
    updateSun();
  }

  // --- Cleanup（务必释放资源） ---
  const cleanup = () => {
    // 停止渲染
    running = false;
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("resize", onResize);

    // dispose scene objects
    scene.traverse((obj) => {
      if (obj.geometry) {
        try {
          obj.geometry.dispose();
        } catch (e) {}
      }
      if (obj.material) {
        const mat = obj.material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => {
            try {
              m.dispose();
            } catch (e) {}
          });
        } else {
          try {
            mat.dispose();
          } catch (e) {}
        }
      }
      // texture 一般随 material.dispose 一并释放，但有时需要手动
      if (obj.isSprite && obj.material && obj.material.map) {
        try {
          obj.material.map.dispose();
        } catch (e) {}
      }
    });

    // water / sky 特殊资源
    try {
      water.geometry.dispose();
    } catch (e) {}
    try {
      water.material.dispose();
    } catch (e) {}
    try {
      sky.geometry && sky.geometry.dispose();
    } catch (e) {}
    try {
      sky.material && sky.material.dispose();
    } catch (e) {}
    try {
      waterNormals && waterNormals.dispose();
    } catch (e) {}
    try {
      envRenderTarget && envRenderTarget.dispose();
    } catch (e) {}

    // pmrem generator
    try {
      pmremGenerator.dispose();
    } catch (e) {}

    // remove dom
    if (renderer.domElement && renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }

    try {
      renderer.dispose();
    } catch (e) {}
  };

  // 返回可用 API（移除了 GUI）
  return { cleanup, setSunParams };
};
