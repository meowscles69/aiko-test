import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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

const HyperscapeView: React.FC<Props> = ({ onExit, customAssetUrl }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [booting, setBooting] = useState(true);
  const [gameTick, setGameTick] = useState(0);
  const [assetLoading, setAssetLoading] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(30); 
  
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
  
  const interactionAnimRef = useRef<number>(0);
  
  // Animation System Refs
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<{ [key: string]: THREE.AnimationAction }>({});
  const activeActionRef = useRef<THREE.AnimationAction | null>(null);

  const camState = useRef({
    targetYaw: Math.PI / 4,
    currentYaw: Math.PI / 4,
    targetPitch: Math.PI / 6,
    currentPitch: Math.PI / 6,
    targetRadius: 40,
    currentRadius: 40,
    isRotating: false,
    lastMouseX: 0,
    lastMouseY: 0
  });

  const [popups, setPopups] = useState<{ id: number; text: string; x: number; y: number; color?: string }[]>([]);

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
    const timer = setTimeout(() => setBooting(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (booting || !mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffd1dc);
    scene.fog = new THREE.Fog(0xffd1dc, 80, 300);
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

    const ambient = new THREE.AmbientLight(0xffffff, 0.8); 
    scene.add(ambient);

    const hemiLight = new THREE.HemisphereLight(0xffd1dc, 0x4d2a15, 1.2); 
    scene.add(hemiLight);

    const sun = new THREE.DirectionalLight(0xffffff, 2.0); 
    sun.position.set(20, 100, 40); 
    sun.castShadow = true;
    sun.shadow.mapSize.width = 4096; 
    sun.shadow.mapSize.height = 4096;
    sun.shadow.camera.left = -200; sun.shadow.camera.right = 200;
    sun.shadow.camera.top = 200; sun.shadow.camera.bottom = -200;
    sun.shadow.camera.far = 1000;
    scene.add(sun);

    const headlight = new THREE.PointLight(0xffffff, 0.8, 100);
    camera.add(headlight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.6);
    rimLight.position.set(-20, 20, -40);
    scene.add(rimLight);

    const title = create3DText("AIKO'S WORLD");
    title.position.set(0, 12, -40);
    title.scale.set(1.5, 1.5, 1.5);
    scene.add(title);
    worldTitleRef.current = title;

    const fireLight = new THREE.PointLight(0xff8c00, 5, 40);
    fireLight.position.set(0, 6, -40);
    scene.add(fireLight);

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x555555, flatShading: true, roughness: 1.0 });
    const pillarGeom = new THREE.CylinderGeometry(1.4, 1.8, 15, 6);
    const leftPillar = new THREE.Mesh(pillarGeom, pillarMat);
    leftPillar.position.set(-15, 3.5, -40);
    leftPillar.castShadow = true;
    leftPillar.receiveShadow = true;
    scene.add(leftPillar);
    const rightPillar = new THREE.Mesh(pillarGeom, pillarMat);
    rightPillar.position.set(15, 3.5, -40);
    rightPillar.castShadow = true;
    rightPillar.receiveShadow = true;
    scene.add(rightPillar);

    const terrainSize = 600;
    const terrainRes = 120;
    const terrainGeom = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainRes, terrainRes);
    terrainGeom.rotateX(-Math.PI / 2);
    const posAttr = terrainGeom.attributes.position;
    const colorsAttr = new Float32Array(posAttr.count * 3);
    for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i); const z = posAttr.getZ(i);
        const h = noise(x, z); posAttr.setY(i, h);
        let color = new THREE.Color(0x567d46); 
        if (h < -0.2) color.set(0x76a066); 
        if (h > 1.2) color.set(0xec4899).lerp(new THREE.Color(0xffffff), 0.5); 
        colorsAttr[i * 3] = color.r; colorsAttr[i * 3 + 1] = color.g; colorsAttr[i * 3 + 2] = color.b;
    }
    terrainGeom.setAttribute('color', new THREE.BufferAttribute(colorsAttr, 3));
    terrainGeom.computeVertexNormals();
    const terrain = new THREE.Mesh(terrainGeom, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
    terrain.receiveShadow = true;
    scene.add(terrain);

    const player = new THREE.Group();
    player.position.set(0, 1.5, 0);
    scene.add(player);
    playerRef.current = player;
    
    const playerModel = new THREE.Group();
    player.add(playerModel);
    playerModelRef.current = playerModel;

    const playerPointLight = new THREE.PointLight(0xffffff, 1.0, 15);
    playerPointLight.position.set(0, 2, 2);
    player.add(playerPointLight);

    const loader = new GLTFLoader();
    loader.load(customAssetUrl || AIKO_MAIN_GLB, (gltf) => {
      const model = gltf.scene;
      model.traverse(c => { 
        if ((c as THREE.Mesh).isMesh) { 
          const mesh = c as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          if (mesh.material instanceof THREE.MeshStandardMaterial) {
            mesh.material.roughness = 0.5;
            mesh.material.metalness = 0.1;
            mesh.material.emissiveIntensity = 0.1; 
          }
        }
      });
      const box = new THREE.Box3().setFromObject(model);
      // Increased character scale to ~1.4x (from 2.8 to 4.0 target height units)
      const scale = 4.0 / (Math.max(...box.getSize(new THREE.Vector3()).toArray()) || 1);
      model.scale.set(scale, scale, scale);
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

        // Even slower time scale for OSRS "heavy" feel
        idleAction.setEffectiveTimeScale(0.8);
        walkAction.setEffectiveTimeScale(0.65); 

        actionsRef.current['idle'] = idleAction;
        actionsRef.current['walk'] = walkAction;

        idleAction.play();
        activeActionRef.current = idleAction;
      }

      setAssetLoading(false);
      initAudio(camera);
    });

    const spawn = (type: 'tree' | 'rock' | 'grass' | 'magic_tree', x: number, z: number) => {
      const y = noise(x, z); if (y < -0.3) return; 
      const g = new THREE.Group();
      if (type === 'tree' || type === 'magic_tree') {
        const trunkHeight = type === 'magic_tree' ? 7.5 : 6.0;
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.4, 1.1, trunkHeight, 6), 
          new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 1.0, flatShading: true })
        );
        trunk.position.y = trunkHeight / 2;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        g.add(trunk);

        const leafColor = type === 'magic_tree' ? 0xdb839d : 0x4a5d23;
        const leafMaterial = new THREE.MeshStandardMaterial({ 
          color: leafColor, 
          flatShading: true,
          emissive: type === 'magic_tree' ? 0xdb839d : 0x000000,
          emissiveIntensity: 0.2
        });

        const levels = type === 'magic_tree' ? 4 : 3;
        for (let i = 0; i < levels; i++) {
          const levelGroup = new THREE.Group();
          const levelY = trunkHeight * 0.8 + (i * 1.5);
          const clusterCount = 3 + Math.floor(Math.random() * 2);
          const baseRadius = 2.5 - (i * 0.4);

          for (let j = 0; j < clusterCount; j++) {
            const clusterGeom = new THREE.OctahedronGeometry(baseRadius * (0.8 + Math.random() * 0.4), 0);
            const cluster = new THREE.Mesh(clusterGeom, leafMaterial);
            
            const angle = (j / clusterCount) * Math.PI * 2;
            const dist = baseRadius * 0.5;
            cluster.position.set(
              Math.cos(angle) * dist + (Math.random() - 0.5) * 0.5,
              (Math.random() - 0.5) * 0.5,
              Math.sin(angle) * dist + (Math.random() - 0.5) * 0.5
            );
            cluster.rotation.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
            cluster.scale.set(1, 0.7 + Math.random() * 0.3, 1); 
            cluster.castShadow = true;
            cluster.receiveShadow = true;
            levelGroup.add(cluster);
          }
          levelGroup.position.y = levelY;
          g.add(levelGroup);
        }
      } else if (type === 'rock') {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), new THREE.MeshStandardMaterial({ color: 0x777777, flatShading: true }));
        rock.position.y = 0.35; rock.castShadow = true; rock.receiveShadow = true;
        g.add(rock);
      }
      g.position.set(x, y, z);
      scene.add(g);
      const obj: GameObject = { id: Math.random().toString(), type, position: new THREE.Vector3(x,y,z), mesh: g, alive: true, respawnTick: 0 };
      objectsRef.current.push(obj);
    };

    const gridStep = 28; 
    for(let i = -terrainSize/2; i < terrainSize/2; i += gridStep) {
        for(let j = -terrainSize/2; j < terrainSize/2; j += gridStep) {
            const x = i + (Math.random() - 0.5) * gridStep; const z = j + (Math.random() - 0.5) * gridStep;
            if (Math.abs(x) < 15 && Math.abs(z) < 15) continue; 
            const h = noise(x, z); const rand = Math.random();
            if (h > 1.2) { 
              if (rand > 0.6) spawn('magic_tree', x, z); 
              else if (rand > 0.4) spawn('rock', x, z); 
            }
            else if (h > -0.2) { 
              if (rand > 0.85) spawn('tree', x, z); 
              else if (rand > 0.3) spawn('grass', x, z); 
            }
        }
    }

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 1) { 
        camState.current.isRotating = true;
        camState.current.lastMouseX = e.clientX;
        camState.current.lastMouseY = e.clientY;
        e.preventDefault();
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (camState.current.isRotating) {
        const deltaX = e.clientX - camState.current.lastMouseX;
        const deltaY = e.clientY - camState.current.lastMouseY;
        camState.current.targetYaw -= deltaX * 0.007;
        camState.current.targetPitch += deltaY * 0.007;
        camState.current.targetPitch = Math.max(0.1, Math.min(Math.PI / 2.3, camState.current.targetPitch));
        camState.current.lastMouseX = e.clientX;
        camState.current.lastMouseY = e.clientY;
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 1) camState.current.isRotating = false;
    };

    const onWheel = (e: WheelEvent) => {
      camState.current.targetRadius = Math.min(Math.max(camState.current.targetRadius + e.deltaY * 0.05, 15), 180);
      setZoomLevel(Math.round(100 - ((camState.current.targetRadius - 15) / (180 - 15)) * 100));
      e.preventDefault();
    };

    const onKeyDown = (e: KeyboardEvent) => { keysRef.current[e.code] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const animate = () => {
      requestAnimationFrame(animate);
      const delta = 0.016;
      const time = performance.now() * 0.001;

      if (mixerRef.current) mixerRef.current.update(delta);

      if (playerRef.current && cameraRef.current) {
        // Keep move speed but character is larger, giving a heavier OSRS feel
        const speed = 10 * delta; 
        const moveDir = new THREE.Vector3(0, 0, 0);

        if (keysRef.current['KeyW']) moveDir.z -= 1;
        if (keysRef.current['KeyS']) moveDir.z += 1;
        if (keysRef.current['KeyA']) moveDir.x -= 1;
        if (keysRef.current['KeyD']) moveDir.x += 1;

        const isMoving = moveDir.length() > 0;

        if (isMoving) {
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
             
             // Reset bounce during walk
             playerModelRef.current.position.y = 0;
          }

          if (actionsRef.current['walk'] && activeActionRef.current !== actionsRef.current['walk']) {
            const nextAction = actionsRef.current['walk'];
            const prevAction = activeActionRef.current;
            if (prevAction) prevAction.fadeOut(0.2);
            nextAction.reset().setEffectiveWeight(1).fadeIn(0.2).play();
            activeActionRef.current = nextAction;
          }
        } else {
          // Subtle idle bounce (OSRS style breathing/stance)
          if (playerModelRef.current) {
            playerModelRef.current.position.y = Math.sin(time * 3.5) * 0.05;
          }

          if (actionsRef.current['idle'] && activeActionRef.current !== actionsRef.current['idle']) {
            const nextAction = actionsRef.current['idle'];
            const prevAction = activeActionRef.current;
            if (prevAction) prevAction.fadeOut(0.2);
            nextAction.reset().setEffectiveWeight(1).fadeIn(0.2).play();
            activeActionRef.current = nextAction;
          }
        }

        playerRef.current.position.y = THREE.MathUtils.lerp(
            playerRef.current.position.y, 
            noise(playerRef.current.position.x, playerRef.current.position.z) + 0.5, 
            0.1
        );
      }

      if (worldTitleRef.current) {
        worldTitleRef.current.position.y = 12 + Math.sin(time * 0.4) * 1.2;
        const pulse = 1.0 + Math.sin(time * 1.5) * 0.4;
        worldTitleRef.current.children.forEach(c => {
          const mesh = c as THREE.Mesh;
          if (mesh.material && (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity !== undefined) {
            (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
          }
        });
      }

      if (playerRef.current && cameraRef.current) {
        const cam = camState.current;
        cam.currentYaw = THREE.MathUtils.lerp(cam.currentYaw, cam.targetYaw, 0.08);
        cam.currentPitch = THREE.MathUtils.lerp(cam.currentPitch, cam.targetPitch, 0.08);
        cam.currentRadius = THREE.MathUtils.lerp(cam.currentRadius, cam.targetRadius, 0.08);

        const yaw = cam.currentYaw; const pitch = cam.currentPitch; const radius = cam.currentRadius;
        
        cameraRef.current.position.set(
          playerRef.current.position.x + Math.sin(yaw) * radius * Math.cos(pitch),
          playerRef.current.position.y + Math.sin(pitch) * radius,
          playerRef.current.position.z + Math.cos(yaw) * radius * Math.cos(pitch)
        );
        cameraRef.current.lookAt(playerRef.current.position.clone().add(new THREE.Vector3(0, 2.0, 0))); // Adjusted lookAt for larger scale
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (audioContextRef.current) audioContextRef.current.close();
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
          const inRange = objectsRef.current.filter(obj => obj.alive && obj.type !== 'anchor' && obj.type !== 'grass' && playerRef.current!.position.distanceTo(obj.position) < 5.0);
          if (inRange.length > 0) {
            let target = (currentActivity === 'Woodcutting' ? inRange.find(o => o.type.includes('tree')) : currentActivity === 'Mining' ? inRange.find(o => o.type === 'rock') : undefined) || inRange.sort((a,b) => playerRef.current!.position.distanceTo(a.position) - playerRef.current!.position.distanceTo(b.position))[0];
            if (target) handleInteraction(target);
          }
        }
        return next;
      });
    }, 600);
    return () => clearInterval(interval);
  }, [booting, currentActivity]);

  const showXpPopup = (text: string, color: number) => {
    const id = Date.now() + Math.random();
    setPopups(prev => [...prev, { id, text, x: window.innerWidth / 2, y: window.innerHeight / 2, color: `#${color.toString(16).padStart(6, '0')}` }]);
    setTimeout(() => setPopups(p => p.filter(x => x.id !== id)), 1000);
  };

  const handleInteraction = (obj: GameObject) => {
    interactionAnimRef.current = 1.0;
    const group = new THREE.Group(); group.position.copy(obj.position).add(new THREE.Vector3(0, 1, 0));
    const vels: THREE.Vector3[] = [];
    const color = obj.type.includes('tree') ? 0xec4899 : 0x696969;
    for (let i = 0; i < 6; i++) { group.add(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), new THREE.MeshStandardMaterial({ color }))); vels.push(new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 6 + 2, (Math.random() - 0.5) * 6)); }
    sceneRef.current?.add(group); particlesRef.current.push({ group, life: 0.8, maxLife: 0.8, velocities: vels });
    
    if (obj.type.includes('tree')) {
      const xp = obj.type === 'magic_tree' ? 100 : 25;
      setStats(s => ({ ...s, wc_xp: s.wc_xp + xp, total_xp: s.total_xp + xp })); showXpPopup(`+${xp} WC`, 0xec4899);
      setActionLog(prev => [`You harvest the ${obj.type.replace('_',' ')}.`, ...prev.slice(0, 5)]);
      obj.alive = false; obj.mesh.visible = false; obj.respawnTick = gameTick + 20;
    } else if (obj.type === 'rock') {
      setStats(s => ({ ...s, m_xp: s.m_xp + 35, total_xp: s.total_xp + 35 })); showXpPopup("+35 MN", 0xcccccc);
      setActionLog(prev => ["You mine the ore.", ...prev.slice(0, 5)]);
      obj.alive = false; obj.mesh.visible = false; obj.respawnTick = gameTick + 20;
    }
  };

  if (booting) return <div className="fixed inset-0 bg-black flex items-center justify-center font-mono text-pink-500 tracking-[0.5em] animate-pulse text-xl uppercase">Reality Manifold Initializing...</div>;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden flex flex-col font-sans">
      <div className="absolute inset-0" ref={mountRef}></div>
      <div className="relative z-10 p-10 flex justify-between pointer-events-none w-full h-full flex-col">
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
              <div 
                onClick={() => setCurrentActivity(currentActivity === 'Woodcutting' ? 'Idle' : 'Woodcutting')}
                className={`p-3 rounded-xl border cursor-pointer transition-colors ${currentActivity === 'Woodcutting' ? 'bg-pink-500/20 border-pink-500/50' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
              >
                <div className="text-[8px] text-white/30 uppercase font-black">Woodcutting</div>
                <div className="text-sm font-mono text-white/90">{stats.wc_xp} <span className="text-[9px] text-pink-400">XP</span></div>
              </div>
              <div 
                onClick={() => setCurrentActivity(currentActivity === 'Mining' ? 'Idle' : 'Mining')}
                className={`p-3 rounded-xl border cursor-pointer transition-colors ${currentActivity === 'Mining' ? 'bg-pink-500/20 border-pink-500/50' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
              >
                <div className="text-[8px] text-white/30 uppercase font-black">Mining</div>
                <div className="text-sm font-mono text-white/90">{stats.m_xp} <span className="text-[9px] text-pink-400">XP</span></div>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-4 pointer-events-auto">
            <button onClick={onExit} className="bg-white/10 hover:bg-pink-500/20 px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.3em] text-white border border-white/10 transition-all shadow-xl backdrop-blur-md">Logout</button>
            <div className="bg-black/60 backdrop-blur-lg border border-white/5 p-4 rounded-2xl w-60 shadow-xl overflow-hidden">
              <div className="text-[9px] font-bold text-white/20 uppercase mb-2 border-b border-white/5 pb-1">Chat Window</div>
              <div className="h-24 overflow-y-auto scrollbar-hide flex flex-col-reverse gap-1">
                {actionLog.map((log, i) => <div key={i} className="text-[10px] text-pink-100/70 font-mono"><span className="opacity-30 mr-1">[{gameTick}]</span> {log}</div>)}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-auto flex flex-col items-center gap-4">
           <div className="bg-black/80 backdrop-blur-2xl px-8 py-4 rounded-full border border-white/10 flex items-center gap-6 shadow-2xl pointer-events-auto">
              <div className="flex flex-col items-center">
                <span className="text-[8px] font-bold text-white/30 uppercase tracking-[0.3em] mb-1">Controls</span>
                <div className="flex gap-2 items-center">
                  <div className="flex gap-1">{['W','A','S','D'].map(k => <div key={k} className="w-5 h-5 rounded bg-white/10 border border-white/10 flex items-center justify-center text-[9px] text-white/60 font-bold">{k}</div>)}</div>
                  <div className="w-[1px] h-4 bg-white/10"></div>
                  <div className="w-6 h-6 rounded bg-white/10 border border-white/10 flex items-center justify-center">🖱️ Wheel Click</div>
                </div>
              </div>
              <div className="w-[1px] h-6 bg-white/10"></div>
              <div className="flex flex-col items-center">
                <span className="text-[8px] font-bold text-white/30 uppercase tracking-[0.3em] mb-1">Current Task</span>
                <div className="text-[10px] font-bold text-pink-400 uppercase tracking-widest">{currentActivity}</div>
              </div>
              <div className="w-[1px] h-6 bg-white/10"></div>
              <div className="flex flex-col items-center"><span className="text-[8px] font-bold text-white/30 uppercase tracking-[0.3em] mb-1">Orbital Zoom</span><div className="flex items-center gap-2 text-pink-400 font-mono text-[10px] font-bold">{zoomLevel}%</div></div>
           </div>
        </div>
      </div>
      {popups.map(p => <div key={p.id} className="fixed pointer-events-none font-black text-2xl animate-xp-popup z-[1000] -translate-x-1/2 -translate-y-1/2" style={{ left: p.x, top: p.y - 120, color: p.color }}>{p.text}</div>)}
      <style>{`
        @keyframes xp-popup { 0% { transform: translateY(0); opacity: 0; scale: 0.5; } 20% { opacity: 1; scale: 1.2; } 80% { opacity: 1; } 100% { transform: translateY(-120px); opacity: 0; scale: 0.8; } }
        .animate-xp-popup { animation: xp-popup 1.0s cubic-bezier(0.19, 1, 0.22, 1) forwards; }
        @keyframes tick-pulse { 0%, 100% { transform: scale(1); background-color: rgba(236, 72, 153, 0.1); } 50% { transform: scale(1.05); background-color: rgba(236, 72, 153, 0.2); } }
        .tick-pulse { animation: tick-pulse 0.6s infinite; }
      `}</style>
    </div>
  );
};

export default HyperscapeView;