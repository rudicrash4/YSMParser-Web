import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';

const FACE_KEYS = ['east', 'west', 'up', 'down', 'south', 'north'];
const FACE_GROUPS = [0, 1, 2, 3, 4, 5];
const deg = (v) => THREE.MathUtils.degToRad(Number(v) || 0);
const vec3 = (v, fallback=[0,0,0]) => Array.isArray(v) && v.length >= 3 ? v.map(Number) : fallback;

export function createYSMPreview(container, modelFiles, textureFiles, selectedModelPath, selectedTexturePath) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101722);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 5000);
  camera.position.set(30, 24, 34);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.domElement.setAttribute('aria-label', 'Model 3D hasil konversi');
  container.replaceChildren(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.target.set(0, 8, 0);
  controls.minDistance = 4;
  controls.maxDistance = 500;

  scene.add(new THREE.HemisphereLight(0xdcecff, 0x303744, 2.0));
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(35, 55, 45); scene.add(key);
  const fill = new THREE.DirectionalLight(0x9bc8ff, 1.0);
  fill.position.set(-35, 15, -30); scene.add(fill);
  const grid = new THREE.GridHelper(80, 20, 0x52647a, 0x293648);
  grid.position.y = -0.02; scene.add(grid);
  const axes = new THREE.AxesHelper(8); scene.add(axes);

  let modelRoot = null;
  let textureObjectUrls = [];
  const textureLoader = new THREE.TextureLoader();
  const textureMap = new Map();
  for (const item of textureFiles) {
    const url = URL.createObjectURL(item.blob);
    textureObjectUrls.push(url);
    textureMap.set(item.path.toLowerCase(), url);
  }

  function findTexture(path) {
    if (!path) return textureObjectUrls[0] || null;
    const normalized = String(path).replace(/^\.?\//, '').toLowerCase();
    for (const [name, url] of textureMap) if (name === normalized || name.endsWith('/' + normalized)) return url;
    return textureObjectUrls[0] || null;
  }

  function loadTexture(url) {
    return new Promise((resolve) => {
      if (!url) return resolve(null);
      textureLoader.load(url, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestMipmapNearestFilter;
        texture.generateMipmaps = true;
        resolve(texture);
      }, undefined, () => resolve(null));
    });
  }

  function makeCubeMaterialSet(texture, faceUV, texW, texH) {
    const mats = [];
    for (let i=0; i<6; i++) {
      const key = FACE_KEYS[i];
      const face = faceUV && faceUV[key];
      let map = texture;
      if (texture && face && Array.isArray(face.uv) && Array.isArray(face.uv_size)) {
        map = texture.clone();
        const u = Number(face.uv[0]) || 0;
        const v = Number(face.uv[1]) || 0;
        const uw = Number(face.uv_size[0]) || 0;
        const vh = Number(face.uv_size[1]) || 0;
        map.repeat.set(uw / Math.max(1, texW), vh / Math.max(1, texH));
        map.offset.set(u / Math.max(1, texW), 1 - ((v + vh) / Math.max(1, texH)));
        map.needsUpdate = true;
      }
      mats.push(new THREE.MeshStandardMaterial({
        map, color: texture ? 0xffffff : 0xb5c8d9,
        roughness: 0.88, metalness: 0.0,
        side: THREE.DoubleSide
      }));
    }
    return mats;
  }

  function addCube(parent, cube, texture, texW, texH, bonePivot) {
    const origin = vec3(cube.origin);
    const size = vec3(cube.size, [1,1,1]);
    if (size.some(v => !Number.isFinite(v) || Math.abs(v) < 0.0001)) return;
    const pivot = vec3(cube.pivot, origin.map((v,i) => v + size[i]/2));
    const cubeGroup = new THREE.Group();
    cubeGroup.position.set(pivot[0] - bonePivot[0], pivot[1] - bonePivot[1], pivot[2] - bonePivot[2]);
    const rotation = vec3(cube.rotation);
    cubeGroup.rotation.set(deg(rotation[0]), deg(rotation[1]), deg(rotation[2]), 'ZYX');
    const geometry = new THREE.BoxGeometry(Math.abs(size[0]), Math.abs(size[1]), Math.abs(size[2]));
    const mats = makeCubeMaterialSet(texture, cube.uv, texW, texH);
    const mesh = new THREE.Mesh(geometry, mats);
    mesh.position.set(origin[0] + size[0]/2 - pivot[0], origin[1] + size[1]/2 - pivot[1], origin[2] + size[2]/2 - pivot[2]);
    cubeGroup.add(mesh);
    parent.add(cubeGroup);
  }

  function geometryRoot(json) {
    let geometries = json['minecraft:geometry'] || json.geometry || json;
    if (!Array.isArray(geometries)) geometries = [geometries];
    const geom = geometries.find(g => g && Array.isArray(g.bones)) || geometries[0];
    if (!geom || !Array.isArray(geom.bones)) throw new Error('JSON model tidak memiliki daftar bones yang dikenali.');
    const description = geom.description || {};
    const texW = Number(description.texture_width) || 64;
    const texH = Number(description.texture_height) || 64;
    const root = new THREE.Group();
    root.name = description.identifier || 'YSM model';
    const boneMap = new Map();
    const pending = [];
    for (const bone of geom.bones) {
      const pivot = vec3(bone.pivot);
      const group = new THREE.Group();
      group.name = bone.name || `bone_${boneMap.size}`;
      group.position.set(...pivot);
      const rot = vec3(bone.rotation);
      group.rotation.set(deg(rot[0]), deg(rot[1]), deg(rot[2]), 'ZYX');
      boneMap.set(group.name, { group, bone, pivot });
      pending.push({ group, bone, pivot });
    }
    for (const item of pending) {
      const parentName = item.bone.parent;
      const parent = parentName && boneMap.get(parentName);
      if (parent) {
        item.group.position.sub(new THREE.Vector3(...parent.pivot));
        parent.group.add(item.group);
      } else root.add(item.group);
    }
    for (const item of pending) {
      const { group, bone, pivot } = item;
      for (const cube of (bone.cubes || [])) addCube(group, cube, activeTexture, texW, texH, pivot);
    }
    return root;
  }

  let activeTexture = null;
  async function loadModel(modelPath, texturePath) {
    if (modelRoot) { scene.remove(modelRoot); disposeTree(modelRoot); modelRoot = null; }
    if (activeTexture) { activeTexture.dispose(); activeTexture = null; }
    const model = modelFiles.find(x => x.path === modelPath) || modelFiles[0];
    if (!model) throw new Error('Tidak ditemukan file geometri model untuk pratinjau.');
    const raw = await model.blob.text();
    const json = JSON.parse(raw);
    activeTexture = await loadTexture(findTexture(texturePath));
    modelRoot = geometryRoot(json);
    scene.add(modelRoot);
    const box = new THREE.Box3().setFromObject(modelRoot);
    if (!box.isEmpty()) {
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      modelRoot.position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z, 8);
      const distance = maxDim * 1.75;
      camera.position.set(distance, distance * 0.72, distance);
      camera.near = Math.max(0.01, maxDim / 1000);
      camera.far = maxDim * 100;
      camera.updateProjectionMatrix();
      controls.target.set(0,0,0);
      controls.update();
      grid.position.y = -size.y/2 - 0.05;
      grid.scale.setScalar(Math.max(1, maxDim / 80));
    }
  }

  function disposeTree(obj) {
    obj.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        const list = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of list) { if (mat.map && mat.map !== activeTexture) mat.map.dispose(); mat.dispose(); }
      }
    });
  }

  let width = 0, height = 0;
  const resize = () => {
    const rect = container.getBoundingClientRect();
    width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height; camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize); observer.observe(container); resize();
  let raf = 0;
  const animate = () => { raf = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
  animate();

  return {
    loadModel,
    reset() { if (modelRoot) { const box = new THREE.Box3().setFromObject(modelRoot); const size = box.getSize(new THREE.Vector3()); const d = Math.max(size.x,size.y,size.z,8)*1.75; camera.position.set(d,d*.72,d); controls.target.set(0,0,0); controls.update(); } },
    dispose() { cancelAnimationFrame(raf); observer.disconnect(); controls.dispose(); if (modelRoot) disposeTree(modelRoot); if (activeTexture) activeTexture.dispose(); textureObjectUrls.forEach(URL.revokeObjectURL); renderer.dispose(); renderer.domElement.remove(); }
  };
}
