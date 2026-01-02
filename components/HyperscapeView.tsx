import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import WorldLoadingOverlay from './WorldLoadingOverlay';

interface Props {
  onExit: () => void;
  customAssetUrl?: string;
}

interface GameObject {
  id: string;
  type: 'tree' | 'rock' | 'grass' | 'magic_tree' | 'anchor' | 'landmark';
  position: THREE.Vector3;
  mesh: THREE.Group | THREE.Mesh;
  alive: boolean;
  respawnTick: number;
}

interface ParticleSystem {
  group: THREE.Group;
  life: number;
  maxLife: number;
  velocities: THREE.Vector3[];
  targetPos?: THREE.Vector3;
}

const AIKO_MAIN_GLB = "https://raw.githubusercontent.com/meowscles69/NeuraPay/main/12_31_2025%20(1).glb";

const noise = (x: number, y: number) => {
    return Math.sin(x * 0.1) * Math.sin(y * 0.1) + Math.sin(x * 0.02) * Math.cos(y * 0.02) * 2;
};

const LETTER_MAPS: { [key: string]: number[][] } = {
  'A': [[0,1,1,0],[1,0,0,1],[1,1,1,1],[1,0,0,1],[1,0,0,1]],
  'I': [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[1,1,1]],
  'K': [[1,0,0,1],[1,0,1,0],[1,1,0,0],[1,0,1,0],[1,0,0,1]],
  'O': [[0,1,1,0],[1,0,0,1],[1,0,0,1],[1,0,0,1],[0,1,1,0]],
  'S': [[0,1,1,1],[1,0,0,0],[0,1,1,0],[0,0,0,1],[1,1,1,0]],
  'W': [[1,0,0,0,1],[1,0,0,0,1],[1,0,1,0,1],[1,1,0,1,1],[1,0,0,0,1]],
  'R': [[1,1,1,0],[1,0,0,1],[1,1,1,0],[1,0,1,0],[1,0,0,1]],
  'L': [[1,0,0,0],[1,0,0,0],[1,0,0,0],[1,0,0,0],[1,1,1,1]],
  'D': [[1,1,1,0],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,1,1,0]],
  "'": [[1],[1],[0],[0],[0]],
};

const Minimap: React.FC<{ 
  playerPos: THREE.Vector3; 
  yaw: number; 
  objects: GameObject[];
  zoom: number;
}> = ({ playerPos, yaw, objects, zoom }) => {
  const mapRadius = 80;
  const visibleObjects = useMemo(() => {
    return objects.filter(obj => 
      obj.alive && 
      obj.position.distanceTo(playerPos) < (mapRadius / (zoom * 0.5)) &&
      (obj.type === 'tree' || obj.type === 'magic_tree' || obj.type === 'rock')
    );
  }, [objects, playerPos, zoom]);

  return (
    <div className="relative w-40 h-40 rounded-full border-4 border-[#3a332a] bg-[#4a5d23] shadow-2xl overflow-hidden pointer-events-auto cursor-crosshair group">
      <div 
        className="absolute inset-0 transition-transform duration-75 ease-out"
        style={{ transform: `rotate(${yaw}rad)` }}
      >
        {visibleObjects.map(obj => {
          const dx = (obj.position.x - playerPos.x) * zoom;
          const dz = (obj.position.z - playerPos.z) * zoom;
          return (
            <div
              key={obj.id}
              className={`absolute w-1.5 h-1.5 rounded-full ${obj.type.includes('tree') ? 'bg-green-400' : 'bg-gray-400'}`}
              style={{
                left: `calc(50% + ${dx}px)`,
                top: `calc(50% + ${dz}px)`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          );
        })}
      </div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
        <div className="w-2.5 h-2.5 bg-white border border-black rounded-full shadow-glow-white"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white/10 rounded-full blur-sm"></div>
      </div>
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none transition-transform duration-75"
        style={{ transform: `rotate(${yaw}rad)` }}
      >
        <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white drop-shadow-md">N</div>
      </div>
    </div>
  );
};

const HyperscapeView: React.FC<Props> = ({ onExit, customAssetUrl }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [booting, setBooting] = useState(true);
  const [gameTick, setGameTick] = useState(0);
  const [assetLoading, setAssetLoading] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(30); 
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [playerWorldPos, setPlayerWorldPos] = useState(new THREE.Vector3());
  const [cameraYaw, setCameraYaw] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  
  const [stats, setStats] = useState({ 
    woodcutting: 1, mining: 1,
    wc_xp: 0, m_xp: 0, 
    hp: 99, max_hp: 99,
    total_xp: 0 
  });
  const [actionLog, setActionLog] = useState<string[]>(["Welcome to AIKO'S WORLD.", "OSRS Protocol: Active."]);
  const [currentActivity, setCurrentActivity] = useState<'Woodcutting' | 'Mining' | 'Idle'>('Idle');

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerRef = useRef<THREE.Group | null>(null);
  const playerModelRef = useRef<THREE.Group | null>(null); 
  const objectsRef = useRef<GameObject[]>([]);
  const particlesRef = useRef<ParticleSystem[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const worldTitleRef = useRef<THREE.Group | null>(null);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  
  const isMovingRef = useRef<boolean>(false);
  const introFinishedRef = useRef<boolean>(false);
  
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<{ [key: string]: THREE.AnimationAction }>({});

  const camState = useRef({
    targetYaw: Math.PI / 4,
    currentYaw: Math.PI / 4,
    targetPitch: Math.PI / 6,
    currentPitch: Math.PI / 6,
    targetRadius: 400,
    currentRadius: 400,
    isRotating: false,
    lastMouseX: 0,
    lastMouseY: 0
  });

  const [popups, setPopups] = useState<{ id: number; text: string; x: number; y: number; color?: string }[]>([]);

  const CA_ADDRESS = "2tgZJ6N7buMDq9HZWbzXvSPFq6MYWbrAGCoDD22Ypump";

  const initAudio = (camera: THREE.Camera) => {
    const listener = new THREE.AudioListener();
    camera.add(listener);
    const audioCtx = listener.context;
    audioContextRef.current = audioCtx;

    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

    const windSource = audioCtx.createBufferSource();
    windSource.buffer = noiseBuffer;
    windSource.loop = true;
    const windFilter = audioCtx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.setValueAtTime(400, audioCtx.currentTime);
    const windGain = audioCtx.createGain();
    windGain.gain.setValueAtTime(0, audioCtx.currentTime);
    windGain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 3);
    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(audioCtx.destination);
    windSource.start();
  };

  const create3DText = (text: string) => {
    const group = new THREE.Group();
    const boxGeom = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    let currentX = 0;
    const spacing = 1.2;
    const bottomColor = new THREE.Color(0x4d0f00); 
    const topColor = new THREE.Color(0xff8c00);    
    const copperBase = new THREE.Color(0x4d2a15); 
    text.split('').forEach(char => {
      const map = LETTER_MAPS[char.toUpperCase()];
      if (map) {
        map.forEach((row, y) => {
          row.forEach((active, x) => {
            if (active) {
              const h = (4 - y) / 5; 
              const material = new THREE.MeshStandardMaterial({ 
                color: copperBase.clone().lerp(topColor, h * 0.5), 
                emissive: bottomColor.clone().lerp(topColor, h), 
                emissiveIntensity: 1.0, 
                roughness: 0.9,
                metalness: 0.3
              });
              const cube = new THREE.Mesh(boxGeom, material);
              cube.position.set(currentX + x * 0.8, (4 - y) * 0.8, 0);
              cube.castShadow = true;
              group.add(cube);
            }
          });
        });
        currentX += (map[0].length * 0.8) + spacing;
      } else if (char === ' ') {
        currentX += spacing * 2;
      }
    });
    const box = new THREE.Box3().setFromObject(group);
    const center = new THREE.Vector3();
    box.getCenter(center);
    group.children.forEach(c => c.position.sub(center));
    return group;
  };

  useEffect(() => {
    if (booting || !mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffd1dc);
    scene.fog = new THREE.Fog(0xffd1dc, 80, 400);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    scene.add(camera);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambient = new THREE.AmbientLight(0xffffff, 0.7); 
    scene.add(ambient);

    const hemiLight = new THREE.HemisphereLight(0xffd1dc, 0x4d2a15, 1.0); 
    scene.add(hemiLight);

    const sun = new THREE.DirectionalLight(0xffffff, 1.8); 
    sun.position.set(30, 100, 50); 
    sun.castShadow = true;
    sun.shadow.mapSize.width = 4096; 
    sun.shadow.mapSize.height = 4096;
    sun.shadow.camera.left = -300; sun.shadow.camera.right = 300;
    sun.shadow.camera.top = 300; sun.shadow.camera.bottom = -300;
    sun.shadow.camera.far = 1000;
    scene.add(sun);

    const title = create3DText("AIKO'S WORLD");
    title.position.set(0, 15, -50);
    title.scale.set(1.8, 1.8, 1.8);
    scene.add(title);
    worldTitleRef.current = title;

    const fireLight = new THREE.PointLight(0xff8c00, 5, 60);
    fireLight.position.set(0, 8, -50);
    scene.add(fireLight);

    const terrainSize = 600;
    const terrainRes = 100;
    const terrainGeom = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainRes, terrainRes);
    terrainGeom.rotateX(-Math.PI / 2);
    const posAttr = terrainGeom.attributes.position;
    const colorsAttr = new Float32Array(posAttr.count * 3);
    for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i); const z = posAttr.getZ(i);
        const h = noise(x, z); posAttr.setY(i, h);
        let color = new THREE.Color(0x5e7c48); 
        if (h < -0.2) color.set(0x76a066); 
        if (h > 1.2) color.set(0xdb839d).lerp(new THREE.Color(0xffffff), 0.3); 
        colorsAttr[i * 3] = color.r; colorsAttr[i * 3 + 1] = color.g; colorsAttr[i * 3 + 2] = color.b;
    }
    terrainGeom.setAttribute('color', new THREE.BufferAttribute(colorsAttr, 3));
    terrainGeom.computeVertexNormals();
    const terrain = new THREE.Mesh(terrainGeom, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1.0 }));
    terrain.receiveShadow = true;
    scene.add(terrain);

    const player = new THREE.Group();
    player.position.set(0, 1.5, 0);
    scene.add(player);
    playerRef.current = player;
    
    const playerModel = new THREE.Group();
    player.add(playerModel);
    playerModelRef.current = playerModel;

    const loader = new GLTFLoader();
    loader.load(customAssetUrl || AIKO_MAIN_GLB, (gltf) => {
      const model = gltf.scene;
      model.traverse(c => { 
        if ((c as THREE.Mesh).isMesh) { 
          const mesh = c as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          if (mesh.material instanceof THREE.MeshStandardMaterial) {
            mesh.material.roughness = 0.6;
          }
        }
      });
      const box = new THREE.Box3().setFromObject(model);
      const targetHeight = 4.0;
      const currentHeight = (box.max.y - box.min.y) || 1;
      const scale = targetHeight / currentHeight;
      model.scale.set(scale * 1.1, scale, scale * 1.1); 
      model.position.y = -box.min.y * scale;
      playerModel.add(model); 

      const mixer = new THREE.AnimationMixer(model);
      mixerRef.current = mixer;
      
      const clips = gltf.animations;
      if (clips && clips.length) {
        const idleClip = clips.find(c => c.name.toLowerCase().includes('idle')) || clips[0];
        const walkClip = clips.find(c => c.name.toLowerCase().includes('walk')) || clips[1] || clips[0];
        const idleAction = mixer.clipAction(idleClip);
        const walkAction = mixer.clipAction(walkClip);
        walkAction.setEffectiveTimeScale(0.8);
        actionsRef.current['idle'] = idleAction;
        actionsRef.current['walk'] = walkAction;
        idleAction.play();
      }
      setAssetLoading(false);
      initAudio(camera);
      setTimeout(() => {
        camState.current.targetRadius = 45;
        introFinishedRef.current = true;
      }, 500);
    });

    const spawn = (type: 'tree' | 'rock' | 'grass' | 'magic_tree', x: number, z: number) => {
      const y = noise(x, z); if (y < -0.3) return; 
      const g = new THREE.Group();
      
      if (type === 'tree' || type === 'magic_tree') {
        const trunkHeight = type === 'magic_tree' ? 12.0 : 10.0;
        const trunkBaseWidth = type === 'magic_tree' ? 1.8 : 1.5;
        const trunkTopWidth = type === 'magic_tree' ? 1.0 : 0.8;
        
        const trunkMaterial = new THREE.MeshStandardMaterial({ 
          color: type === 'magic_tree' ? 0x2d1a12 : 0x5d4037, 
          roughness: 1.0, 
          flatShading: true 
        });
        
        const trunk1 = new THREE.Mesh(
          new THREE.CylinderGeometry(trunkTopWidth, trunkBaseWidth, trunkHeight, 6),
          trunkMaterial
        );
        trunk1.position.y = trunkHeight / 2;
        trunk1.rotation.y = Math.PI / 12;
        trunk1.castShadow = true;
        trunk1.receiveShadow = true;
        g.add(trunk1);

        const trunk2 = new THREE.Mesh(
          new THREE.CylinderGeometry(trunkTopWidth * 0.9, trunkBaseWidth * 0.9, trunkHeight, 6),
          trunkMaterial
        );
        trunk2.position.y = trunkHeight / 2;
        trunk2.position.x = 0.2;
        trunk2.rotation.y = -Math.PI / 12;
        trunk2.rotation.x = 0.05;
        trunk2.castShadow = true;
        trunk2.receiveShadow = true;
        g.add(trunk2);

        for(let i=0; i<3; i++) {
          const root = new THREE.Mesh(
            new THREE.BoxGeometry(trunkBaseWidth * 1.5, 0.8, trunkBaseWidth * 0.8),
            trunkMaterial
          );
          root.rotation.y = (i / 3) * Math.PI * 2;
          root.position.y = 0.4;
          g.add(root);
        }

        const leafColorPrimary = type === 'magic_tree' ? 0x48bb78 : 0x2d4c1e;
        const leafColorSecondary = type === 'magic_tree' ? 0x81e6d9 : 0x4a6a38;
        
        const leafMaterial = new THREE.MeshStandardMaterial({ 
          color: leafColorPrimary, 
          flatShading: true, 
          roughness: 1.0 
        });

        const tiers = type === 'magic_tree' ? 4 : 3;
        for (let i = 0; i < tiers; i++) {
          const tierY = trunkHeight * 0.6 + (i * 2.5);
          const tierRadius = (type === 'magic_tree' ? 6.5 : 5.5) - (i * 1.0);
          
          const tierGroup = new THREE.Group();
          tierGroup.position.y = tierY;
          
          const clusterCount = 3 + i;
          for (let j = 0; j < clusterCount; j++) {
            const clusterWidth = tierRadius * (0.7 + Math.random() * 0.4);
            const clusterHeight = 1.2 + Math.random() * 0.8;
            const clusterGeom = new THREE.CylinderGeometry(clusterWidth * 0.8, clusterWidth, clusterHeight, 6);
            const cluster = new THREE.Mesh(clusterGeom, leafMaterial.clone());
            if (Math.random() > 0.5) (cluster.material as THREE.MeshStandardMaterial).color.set(leafColorSecondary);
            const angle = (j / clusterCount) * Math.PI * 2;
            const dist = tierRadius * 0.4;
            cluster.position.set(
              Math.cos(angle) * dist,
              (Math.random() - 0.5) * 0.5,
              Math.sin(angle) * dist
            );
            cluster.rotation.y = Math.random() * Math.PI;
            cluster.castShadow = true;
            cluster.receiveShadow = true;
            tierGroup.add(cluster);
          }
          g.add(tierGroup);
        }
      } else if (type === 'rock') {
        const rock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(1.2, 0), 
          new THREE.MeshStandardMaterial({ color: 0x888888, flatShading: true, roughness: 1.0 })
        );
        rock.position.y = 0.6; 
        rock.rotation.set(Math.random(), Math.random(), Math.random());
        rock.castShadow = true; 
        rock.receiveShadow = true;
        g.add(rock);
      } else if (type === 'grass') {
        const grass = new THREE.Mesh(
          new THREE.BoxGeometry(0.4, 0.4, 0.4),
          new THREE.MeshStandardMaterial({ color: 0x76a066, flatShading: true })
        );
        grass.position.y = 0.2;
        g.add(grass);
      }
      
      g.position.set(x, y, z);
      scene.add(g);
      objectsRef.current.push({ id: Math.random().toString(), type, position: new THREE.Vector3(x,y,z), mesh: g, alive: true, respawnTick: 0 });
    };

    const gridStep = 32; 
    for(let i = -terrainSize/2; i < terrainSize/2; i += gridStep) {
        for(let j = -terrainSize/2; j < terrainSize/2; j += gridStep) {
            const x = i + (Math.random() - 0.5) * gridStep * 0.8; 
            const z = j + (Math.random() - 0.5) * gridStep * 0.8;
            if (Math.abs(x) < 25 && Math.abs(z) < 25) continue; 
            const h = noise(x, z); const rand = Math.random();
            if (h > 1.2) { 
              if (rand > 0.6) spawn('magic_tree', x, z); 
              else if (rand > 0.3) spawn('rock', x, z); 
            }
            else if (h > -0.2) { 
              if (rand > 0.8) spawn('tree', x, z); 
              else if (rand > 0.4) spawn('grass', x, z); 
            }
        }
    }

    const onKeyDown = (e: KeyboardEvent) => { keysRef.current[e.key.toLowerCase()] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key.toLowerCase()] = false; };
    const onWheel = (e: WheelEvent) => {
      if (!introFinishedRef.current) return;
      camState.current.targetRadius = Math.min(Math.max(camState.current.targetRadius + e.deltaY * 0.05, 20), 200);
      setZoomLevel(Math.round(100 - ((camState.current.targetRadius - 20) / (180)) * 100));
      e.preventDefault();
    };
    const onMouseDown = (e: MouseEvent) => { if (e.button === 1) camState.current.isRotating = true; };
    const onMouseUp = (e: MouseEvent) => { if (e.button === 1) camState.current.isRotating = false; };
    const onMouseMove = (e: MouseEvent) => {
      if (camState.current.isRotating) {
        camState.current.targetYaw -= (e.movementX || 0) * 0.007;
        camState.current.targetPitch += (e.movementY || 0) * 0.007;
        camState.current.targetPitch = Math.max(0.1, Math.min(Math.PI / 2.3, camState.current.targetPitch));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);

    const animate = () => {
      requestAnimationFrame(animate);
      const delta = 0.016;
      const time = performance.now() * 0.001;
      if (mixerRef.current) mixerRef.current.update(delta);

      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const ps = particlesRef.current[i];
        ps.life -= delta;
        if (playerRef.current) {
          const playerPos = playerRef.current.position.clone().add(new THREE.Vector3(0, 2, 0));
          ps.group.children.forEach((child, j) => {
            const vel = ps.velocities[j];
            const age = ps.maxLife - ps.life;
            if (age > 0.3) {
              const dirToPlayer = playerPos.clone().sub(child.position).normalize();
              vel.lerp(dirToPlayer.multiplyScalar(15), 0.1);
            } else {
              vel.y -= 9.8 * delta; 
            }
            child.position.add(vel.clone().multiplyScalar(delta));
            child.rotation.x += delta * 5;
            child.rotation.y += delta * 5;
          });
        }
        if (ps.life <= 0) {
          sceneRef.current?.remove(ps.group);
          particlesRef.current.splice(i, 1);
        }
      }

      if (playerRef.current && cameraRef.current) {
        let moving = false;
        const speed = 7.5 * delta; 
        const moveDir = new THREE.Vector3(0, 0, 0);

        if (keysRef.current['w']) { moveDir.z -= 1; moving = true; }
        if (keysRef.current['s']) { moveDir.z += 1; moving = true; }
        if (keysRef.current['a']) { moveDir.x -= 1; moving = true; }
        if (keysRef.current['d']) { moveDir.x += 1; moving = true; }

        if (moving) {
          moveDir.normalize();
          const angle = camState.current.currentYaw;
          const rotatedDir = new THREE.Vector3(
            moveDir.x * Math.cos(angle) + moveDir.z * Math.sin(angle),
            0,
            -moveDir.x * Math.sin(angle) + moveDir.z * Math.cos(angle)
          );
          playerRef.current.position.add(rotatedDir.multiplyScalar(speed));

          if (playerModelRef.current) {
             const targetRotation = Math.atan2(rotatedDir.x, rotatedDir.z);
             let diff = targetRotation - playerModelRef.current.rotation.y;
             while (diff < -Math.PI) diff += Math.PI * 2;
             while (diff > Math.PI) diff -= Math.PI * 2;
             playerModelRef.current.rotation.y += diff * 0.15;
             playerModelRef.current.position.y = 0;
          }

          if (!isMovingRef.current) {
            actionsRef.current['idle']?.fadeOut(0.2);
            actionsRef.current['walk']?.reset().fadeIn(0.2).play();
            isMovingRef.current = true;
          }
        } else {
          if (playerModelRef.current) {
            playerModelRef.current.position.y = Math.sin(time * 3.5) * 0.08; 
          }
          if (isMovingRef.current) {
            actionsRef.current['walk']?.fadeOut(0.2);
            actionsRef.current['idle']?.reset().fadeIn(0.2).play();
            isMovingRef.current = false;
          }
        }
        playerRef.current.position.y = THREE.MathUtils.lerp(playerRef.current.position.y, noise(playerRef.current.position.x, playerRef.current.position.z) + 0.5, 0.1);
        setPlayerWorldPos(playerRef.current.position.clone());
      }

      if (worldTitleRef.current) {
        worldTitleRef.current.position.y = 15 + Math.sin(time * 0.5) * 1.5;
        const pulse = 1.0 + Math.sin(time * 2.0) * 0.3;
        worldTitleRef.current.children.forEach(c => {
          const mesh = c as THREE.Mesh;
          if (mesh.material instanceof THREE.MeshStandardMaterial) mesh.material.emissiveIntensity = pulse;
        });
      }

      if (playerRef.current && cameraRef.current) {
        const cam = camState.current;
        const zoomSpeed = introFinishedRef.current ? 0.08 : 0.01; 
        cam.currentYaw = THREE.MathUtils.lerp(cam.currentYaw, cam.targetYaw, 0.08);
        cam.currentPitch = THREE.MathUtils.lerp(cam.currentPitch, cam.targetPitch, 0.08);
        cam.currentRadius = THREE.MathUtils.lerp(cam.currentRadius, cam.targetRadius, zoomSpeed);

        cameraRef.current.position.set(
          playerRef.current.position.x + Math.sin(cam.currentYaw) * cam.currentRadius * Math.cos(cam.currentPitch),
          playerRef.current.position.y + Math.sin(cam.currentPitch) * cam.currentRadius,
          playerRef.current.position.z + Math.cos(cam.currentYaw) * cam.currentRadius * Math.cos(cam.currentPitch)
        );
        cameraRef.current.lookAt(playerRef.current.position.clone().add(new THREE.Vector3(0, 2.5, 0))); 
        setCameraYaw(cam.currentYaw);
      }
      renderer.render(scene!, camera!);
    };
    animate();

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      renderer.dispose();
    };
  }, [booting, customAssetUrl]);

  useEffect(() => {
    if (booting) return;
    const interval = setInterval(() => {
      setGameTick(t => {
        const next = t + 1;
        objectsRef.current.forEach(obj => { if (!obj.alive && obj.respawnTick <= next) { obj.alive = true; obj.mesh.visible = true; } });
        if (playerRef.current) {
          const inRange = objectsRef.current.filter(obj => obj.alive && obj.type !== 'anchor' && obj.type !== 'grass' && playerRef.current!.position.distanceTo(obj.position) < 6.5);
          if (inRange.length > 0) {
            let target = (currentActivity === 'Woodcutting' ? inRange.find(o => o.type.includes('tree')) : currentActivity === 'Mining' ? inRange.find(o => o.type === 'rock') : undefined) || inRange[0];
            if (target && gameTick % 2 === 0) handleInteraction(target);
          }
        }
        return next;
      });
    }, 600);
    return () => clearInterval(interval);
  }, [booting, currentActivity, gameTick]);

  const projectToScreen = (pos: THREE.Vector3) => {
    if (!cameraRef.current || !rendererRef.current) return { x: 0, y: 0 };
    const vector = pos.clone();
    vector.project(cameraRef.current);
    return {
      x: (vector.x * 0.5 + 0.5) * window.innerWidth,
      y: (-(vector.y * 0.5) + 0.5) * window.innerHeight
    };
  };

  const showXpPopup = (text: string, color: number) => {
    if (!playerRef.current) return;
    const id = Date.now() + Math.random();
    const pos = projectToScreen(playerRef.current.position.clone().add(new THREE.Vector3(0, 4, 0)));
    setPopups(prev => [...prev, { id, text, x: pos.x, y: pos.y, color: `#${color.toString(16).padStart(6, '0')}` }]);
    setTimeout(() => setPopups(p => p.filter(x => x.id !== id)), 1000);
  };

  const handleInteraction = (obj: GameObject) => {
    const group = new THREE.Group(); 
    group.position.copy(obj.position).add(new THREE.Vector3(0, 2, 0));
    const vels: THREE.Vector3[] = [];
    const color = obj.type.includes('tree') ? 0xec4899 : 0x777777;
    const particleCount = 8;
    for (let i = 0; i < particleCount; i++) { 
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), new THREE.MeshStandardMaterial({ color, roughness: 1.0, flatShading: true }));
      group.add(mesh); 
      vels.push(new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 6 + 3, (Math.random() - 0.5) * 4)); 
    }
    sceneRef.current?.add(group); 
    particlesRef.current.push({ group, life: 1.2, maxLife: 1.2, velocities: vels });
    if (obj.type.includes('tree')) {
      const xp = obj.type === 'magic_tree' ? 100 : 25;
      setStats(s => ({ ...s, wc_xp: s.wc_xp + xp, total_xp: s.total_xp + xp })); 
      showXpPopup(`+${xp} WC`, 0xec4899);
      setActionLog(prev => [`You harvest the ${obj.type.replace('_',' ')}.`, ...prev.slice(0, 5)]);
      obj.alive = false; obj.mesh.visible = false; obj.respawnTick = gameTick + 15;
    } else if (obj.type === 'rock') {
      const xp = 35;
      setStats(s => ({ ...s, m_xp: s.m_xp + xp, total_xp: s.total_xp + xp })); 
      showXpPopup(`+${xp} MN`, 0xaaaaaa);
      setActionLog(prev => ["You mine the ore.", ...prev.slice(0, 5)]);
      obj.alive = false; obj.mesh.visible = false; obj.respawnTick = gameTick + 15;
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  if (booting) return <WorldLoadingOverlay onComplete={() => setBooting(false)} />;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden flex flex-col font-sans animate-in fade-in zoom-in duration-1000">
      <div className="absolute inset-0" ref={mountRef}></div>
      
      <div className="relative z-10 p-6 md:p-10 flex justify-between pointer-events-none w-full h-full flex-col">
        
        <div className="flex justify-between items-start">
          <div className="bg-black/70 backdrop-blur-2xl border border-white/10 p-6 rounded-[2rem] pointer-events-auto h-fit shadow-2xl min-w-[280px]">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 rounded bg-pink-500/10 border border-pink-500/40 flex items-center justify-center text-pink-400 font-bold tick-pulse">{gameTick % 100}</div>
              <div className="flex-1">
                <div className="text-[10px] font-black text-pink-500 uppercase tracking-[0.3em]">OSRS Core</div>
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden mt-2">
                   <div className="h-full bg-green-500 transition-all" style={{ width: `100%` }}></div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div onClick={() => setCurrentActivity('Woodcutting')} className={`p-3 rounded-xl border cursor-pointer transition-colors ${currentActivity === 'Woodcutting' ? 'bg-pink-500/20 border-pink-500/50' : 'bg-white/5 border-white/5'}`}>
                <div className="text-[8px] text-white/30 uppercase font-black">Woodcutting</div>
                <div className="text-sm font-mono text-white/90">{stats.wc_xp} XP</div>
              </div>
              <div onClick={() => setCurrentActivity('Mining')} className={`p-3 rounded-xl border cursor-pointer transition-colors ${currentActivity === 'Mining' ? 'bg-pink-500/20 border-pink-500/50' : 'bg-white/5 border-white/5'}`}>
                <div className="text-[8px] text-white/30 uppercase font-black">Mining</div>
                <div className="text-sm font-mono text-white/90">{stats.m_xp} XP</div>
              </div>
            </div>
          </div>

          <div className="flex gap-4 items-start pointer-events-auto">
            {/* Primary Action Bar */}
            <div className="flex flex-col gap-2 mt-4">
              {[
                { id: 'character', icon: '👤', label: 'Character' },
                { id: 'inventory', icon: '🎒', label: 'Inventory' },
                { id: 'skills', icon: '🧠', label: 'Skills' },
                { id: 'combat', icon: '⚔️', label: 'Combat' },
                { id: 'settings', icon: '⚙️', label: 'Settings' }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setActivePanel(activePanel === item.id ? null : item.id)}
                  title={item.label}
                  className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center text-lg shadow-lg ${activePanel === item.id ? 'bg-pink-500 border-white text-white scale-110' : 'bg-[#3a332a]/90 border-[#5e5343] text-[#d4af37] hover:border-pink-500 hover:scale-105'}`}
                >
                  {item.icon}
                </button>
              ))}

              <div className="h-[1px] bg-white/10 my-1 w-full" />

              {/* Social / Info Buttons */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(CA_ADDRESS);
                  showToast("Contract copied");
                }}
                title="Copy CA"
                className="w-10 h-10 rounded-full border-2 bg-[#3a332a]/90 border-[#5e5343] text-[#d4af37] flex items-center justify-center shadow-lg transition-all hover:border-pink-500 hover:scale-105 active:scale-95 text-xs font-bold"
              >
                CA
              </button>
              <button
                onClick={() => window.open('https://x.com/ai16zaiko', '_blank')}
                title="X Profile"
                className="w-10 h-10 rounded-full border-2 bg-[#3a332a]/90 border-[#5e5343] text-[#d4af37] flex items-center justify-center shadow-lg transition-all hover:border-pink-500 hover:scale-105 active:scale-95 text-lg"
              >
                𝕏
              </button>
              <button
                onClick={() => window.open('https://x.com/i/communities/2004459771244827038', '_blank')}
                title="Community"
                className="w-10 h-10 rounded-full border-2 bg-[#3a332a]/90 border-[#5e5343] text-[#d4af37] flex items-center justify-center shadow-lg transition-all hover:border-pink-500 hover:scale-105 active:scale-95 text-lg"
              >
                👥
              </button>
            </div>

            <div className="relative">
               <Minimap 
                  playerPos={playerWorldPos} 
                  yaw={cameraYaw} 
                  objects={objectsRef.current}
                  zoom={zoomLevel * 0.15 + 1.5}
                />
                <div 
                  className="absolute -top-2 -left-2 w-8 h-8 rounded-full bg-[#3a332a] border-2 border-[#5e5343] flex items-center justify-center text-[10px] font-bold text-white shadow-lg pointer-events-none transition-transform duration-75"
                  style={{ transform: `rotate(${cameraYaw}rad)` }}
                >
                  N
                </div>
            </div>
          </div>
        </div>

        {activePanel && (
          <div className="absolute top-48 right-10 w-64 bg-[#3a332a]/95 backdrop-blur-md border-4 border-[#5e5343] rounded-[1.5rem] p-5 pointer-events-auto shadow-2xl animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex justify-between items-center mb-4 border-b border-[#5e5343] pb-2">
              <h3 className="text-[#d4af37] font-bold uppercase tracking-widest text-xs">{activePanel}</h3>
              <button onClick={() => setActivePanel(null)} className="text-[#d4af37] hover:text-white">✕</button>
            </div>
            
            {activePanel === 'skills' && (
              <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto scrollbar-hide">
                <div className="bg-[#4d4438] p-2 rounded border border-[#5e5343] text-center">
                  <div className="text-[10px] text-[#d4af37]">Woodcutting</div>
                  <div className="text-sm text-white font-bold">{stats.wc_xp}</div>
                </div>
                <div className="bg-[#4d4438] p-2 rounded border border-[#5e5343] text-center">
                  <div className="text-[10px] text-[#d4af37]">Mining</div>
                  <div className="text-sm text-white font-bold">{stats.m_xp}</div>
                </div>
              </div>
            )}

            {activePanel === 'inventory' && (
              <div className="grid grid-cols-4 gap-2">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="w-12 h-12 bg-[#2b251e] rounded border border-[#5e5343] flex items-center justify-center text-white/20">
                    {i === 0 ? '🪵' : ''}
                  </div>
                ))}
              </div>
            )}

            {(activePanel === 'character' || activePanel === 'settings' || activePanel === 'combat') && (
              <div className="text-white/40 text-[10px] font-mono italic text-center py-8">
                Panel interface expanding in future update...
              </div>
            )}
          </div>
        )}
        
        <div className="mt-auto flex flex-col items-center gap-6">
          <div className="flex justify-center w-full">
            <button onClick={onExit} className="bg-[#3a332a] hover:bg-pink-500 px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.3em] text-white border-2 border-[#5e5343] transition-all shadow-xl pointer-events-auto backdrop-blur-md flex items-center gap-2">
              <span>🚪</span> Logout
            </button>
          </div>

          <div className="bg-black/80 backdrop-blur-2xl px-8 py-4 rounded-full border border-white/10 flex items-center gap-6 shadow-2xl pointer-events-auto">
             <div className="flex flex-col items-center">
               <span className="text-[8px] font-bold text-white/30 uppercase mb-1">WASD Movement</span>
               <div className="flex gap-1">
                 {['W','A','S','D'].map(k => <div key={k} className="w-5 h-5 rounded bg-white/10 border border-white/10 flex items-center justify-center text-[9px] text-white/60 font-bold">{k}</div>)}
               </div>
             </div>
             <div className="w-[1px] h-6 bg-white/10"></div>
             <div className="flex flex-col items-center">
               <span className="text-[8px] font-bold text-white/30 uppercase mb-1">Activity</span>
               <div className="text-[10px] font-bold text-pink-400 uppercase tracking-widest">{currentActivity}</div>
             </div>
             <div className="w-[1px] h-6 bg-white/10"></div>
             <div className="flex flex-col items-center">
               <span className="text-[8px] font-bold text-white/30 uppercase mb-1">World Zoom</span>
               <div className="text-pink-400 font-mono text-[10px] font-bold">{zoomLevel}%</div>
             </div>
          </div>
        </div>
      </div>

      {/* World Interaction Popups */}
      {popups.map(p => (
        <div 
          key={p.id} 
          className="fixed pointer-events-none font-black text-2xl animate-xp-popup z-[1000] drop-shadow-lg" 
          style={{ left: p.x, top: p.y, color: p.color, transform: 'translate(-50%, -100%)' }}
        >
          {p.text}
        </div>
      ))}

      {/* OSRS Style Toast Notification */}
      {toast && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[2000] px-6 py-2 bg-[#3a332a] border-2 border-[#d4af37]/40 text-[#d4af37] font-bold uppercase tracking-widest text-[10px] shadow-2xl rounded-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
          {toast}
        </div>
      )}

      <style>{`
        @keyframes xp-popup { 
          0% { transform: translate(-50%, 0); opacity: 0; scale: 0.5; } 
          20% { opacity: 1; scale: 1.2; } 
          80% { opacity: 1; } 
          100% { transform: translate(-50%, -100px); opacity: 0; scale: 0.8; } 
        }
        .animate-xp-popup { animation: xp-popup 1.0s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards; }
        @keyframes heartbeat { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        .tick-pulse { animation: heartbeat 0.6s infinite; }
        .shadow-glow-white { box-shadow: 0 0 10px rgba(255,255,255,0.8); }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default HyperscapeView;