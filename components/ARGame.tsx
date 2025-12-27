
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { audioService } from '../services/audioService';
import { Disc, HandData, Particle, DiscType, TrailParticle } from '../types';

declare const Hands: any;
declare const Camera: any;

interface ARGameProps {
  onLoaded: () => void;
  onError: (msg: string) => void;
  isActive: boolean;
  onScoreUpdate: (points: number) => void;
  onComboUpdate: (combo: number) => void;
  onHandStatus: (status: { isPistol: boolean, isTrigger: boolean, isPresent: boolean }) => void;
  comboCount: number;
}

interface FloatingVFX {
  mesh: THREE.Sprite;
  velocity: THREE.Vector3;
  life: number;
}

const ARGame: React.FC<ARGameProps> = ({ onLoaded, onError, isActive, onScoreUpdate, onComboUpdate, onHandStatus, comboCount }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [trackingLost, setTrackingLost] = useState(false);
  
  const onHandStatusRef = useRef(onHandStatus);
  const onScoreUpdateRef = useRef(onScoreUpdate);
  const onComboUpdateRef = useRef(onComboUpdate);
  const isActiveRef = useRef(isActive);
  const comboCountRef = useRef(comboCount);

  useEffect(() => { onHandStatusRef.current = onHandStatus; }, [onHandStatus]);
  useEffect(() => { onScoreUpdateRef.current = onScoreUpdate; }, [onScoreUpdate]);
  useEffect(() => { onComboUpdateRef.current = onComboUpdate; }, [onComboUpdate]);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => { comboCountRef.current = comboCount; }, [comboCount]);

  const lastDetectionTimeRef = useRef<number>(0);
  const smoothedAimRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
  const triggerReadyRef = useRef<boolean>(true); // For stateful trigger logic
  
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    discs: Disc[];
    particles: Particle[];
    trailParticles: TrailParticle[];
    floatingVFX: FloatingVFX[];
    handData: HandData | null;
    laser: THREE.Line;
    crosshair: THREE.Group;
    muzzleFlash: THREE.Mesh;
    lastTriggerState: boolean;
    shake: number;
  } | null>(null);

  const TRACKING_TIMEOUT_MS = 2500;
  const MAX_DISCS = 5;
  const SPAWN_RADIUS = 30;
  
  // Smoothing configs
  const MIN_SMOOTHING = 0.08; 
  const MAX_SMOOTHING = 0.45;

  const createTextTexture = (text: string, color: string) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = 512;
    canvas.height = 256;
    ctx.font = 'bold 90px Arial Black';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 10;
    ctx.strokeText(text, 256, 128);
    ctx.fillText(text, 256, 128);
    return new THREE.CanvasTexture(canvas);
  };

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);

    const laserGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-1)]);
    const laserMat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.6 });
    const laser = new THREE.Line(laserGeom, laserMat);
    scene.add(laser);

    const flashGeom = new THREE.SphereGeometry(0.3, 16, 16);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xfff000, transparent: true, opacity: 0 });
    const muzzleFlash = new THREE.Mesh(flashGeom, flashMat);
    scene.add(muzzleFlash);

    const crosshair = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 16, 32), ringMat);
    const bracketGroup = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const bGeom = new THREE.RingGeometry(0.25, 0.32, 32, 1, (i * Math.PI / 2) - 0.2, 0.4);
      const bMesh = new THREE.Mesh(bGeom, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
      bracketGroup.add(bMesh);
    }
    const centerDot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff00ff }));
    crosshair.add(ring, centerDot, bracketGroup);
    scene.add(crosshair);

    sceneRef.current = {
      scene, camera, renderer, discs: [], particles: [], trailParticles: [], floatingVFX: [],
      handData: null, laser, crosshair, muzzleFlash, lastTriggerState: false, shake: 0
    };

    const hands = new Hands({ locateFile: (f: string) => `https://unpkg.com/@mediapipe/hands@0.4.1646424915/${f}` });
    hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });
    
    hands.onResults((res: any) => {
      try {
        const isPresent = res.multiHandLandmarks?.length > 0;
        if (isPresent) {
          const lm = res.multiHandLandmarks[0];
          lastDetectionTimeRef.current = Date.now();
          
          // Bio-Mechanical Analysis
          const getDist = (p1: any, p2: any) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
          
          const wrist = lm[0];
          const thumbTip = lm[4];
          const indexMCP = lm[5];
          const indexPIP = lm[6];
          const indexTip = lm[8];
          const middleTip = lm[12];
          const ringTip = lm[16];
          const pinkyTip = lm[20];
          const palmCenter = lm[9]; // Middle finger MCP often represents palm center

          const palmSize = getDist(indexMCP, lm[17]);
          
          // 1. Straightness Check (Dot Product of index segments)
          const vec1 = { x: indexPIP.x - indexMCP.x, y: indexPIP.y - indexMCP.y };
          const vec2 = { x: indexTip.x - indexPIP.x, y: indexTip.y - indexPIP.y };
          const mag1 = Math.sqrt(vec1.x**2 + vec1.y**2);
          const mag2 = Math.sqrt(vec2.x**2 + vec2.y**2);
          const dot = (vec1.x * vec2.x + vec1.y * vec2.y) / (mag1 * mag2);
          const isIndexStraight = dot > 0.96; // Very strict straightness

          // 2. Folded Check for others
          const isMiddleFolded = getDist(middleTip, palmCenter) < palmSize * 0.8;
          const isRingFolded = getDist(ringTip, palmCenter) < palmSize * 0.8;
          const isPinkyFolded = getDist(pinkyTip, palmCenter) < palmSize * 0.8;
          
          const isPistol = isIndexStraight && isMiddleFolded && isRingFolded && isPinkyFolded;

          // 3. Stateful Trigger Logic (Thumb distance to side of Index MCP)
          const triggerDist = getDist(thumbTip, indexMCP);
          const isTriggerActive = triggerDist < palmSize * 0.7;
          
          // Final Trigger Pulse Logic
          let fireEvent = false;
          if (isTriggerActive && triggerReadyRef.current && isPistol) {
            fireEvent = true;
            triggerReadyRef.current = false; // Gate closed until reset
          } else if (!isTriggerActive) {
            triggerReadyRef.current = true; // Gate reset
          }

          // 4. Adaptive Aim Smoothing
          const rawProjX = (1 - indexTip.x) * 2 - 1;
          const rawProjY = (1 - indexTip.y) * 2 - 1;

          const dx = rawProjX - smoothedAimRef.current.x;
          const dy = rawProjY - smoothedAimRef.current.y;
          const velocity = Math.sqrt(dx*dx + dy*dy);
          
          // Move faster? Smoothing is lower. Still? Smoothing is high.
          const smoothingFactor = THREE.MathUtils.clamp(velocity * 4, MIN_SMOOTHING, MAX_SMOOTHING);
          
          smoothedAimRef.current.x += dx * smoothingFactor;
          smoothedAimRef.current.y += dy * smoothingFactor;

          if (sceneRef.current) {
            sceneRef.current.handData = { 
              landmarks: lm, 
              isPistol, 
              isTriggerPulled: fireEvent, // We send the event instead of the raw state
              aimPoint: { ...smoothedAimRef.current } 
            };
          }
          onHandStatusRef.current({ isPistol, isTrigger: isTriggerActive, isPresent: true });
        } else {
          if (sceneRef.current) sceneRef.current.handData = null;
          onHandStatusRef.current({ isPistol: false, isTrigger: false, isPresent: false });
        }
      } catch (err) {}
    });

    const cam = new Camera(videoRef.current, {
      onFrame: async () => { 
        if (videoRef.current && videoRef.current.readyState >= 2) {
          try { await hands.send({ image: videoRef.current }); } catch(e) {}
        }
      },
      width: 1280, height: 720
    });
    cam.start().then(() => onLoaded());

    const spawnDisc = () => {
      if (!sceneRef.current) return;
      const types: DiscType[] = ['NORMAL', 'FAST', 'PULSATOR', 'SHIELD', 'BOMB'];
      const type = types[Math.floor(Math.random() * types.length)];
      
      const palette = [0x22d3ee, 0xfacc15, 0xd946ef, 0x4ade80, 0xf43f5e];
      const color = palette[Math.floor(Math.random() * palette.length)];
      let speed = 0.12 + (Math.random() * 0.08);
      if (type === 'FAST') speed *= 2.5;

      const group = new THREE.Group();
      const size = 0.9 + Math.random() * 0.5;
      
      const core = new THREE.Mesh(new THREE.SphereGeometry(size * 0.25, 16, 16), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 4 }));
      const ring1 = new THREE.Mesh(new THREE.TorusGeometry(size * 0.5, 0.04, 8, 32), new THREE.MeshStandardMaterial({ color, emissive: color, transparent: true, opacity: 0.9 }));
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(size * 0.8, 0.02, 4, 32), new THREE.MeshStandardMaterial({ color, emissive: color, transparent: true, opacity: 0.5 }));
      group.add(core, ring1, ring2);

      const hitbox = new THREE.Mesh(new THREE.SphereGeometry(size * 1.35, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
      group.add(hitbox);

      const angle = Math.random() * Math.PI * 2;
      const pos = new THREE.Vector3(Math.cos(angle) * SPAWN_RADIUS, Math.sin(angle) * SPAWN_RADIUS, -40 - Math.random() * 15);
      group.position.copy(pos);
      scene.add(group);

      const velocity = new THREE.Vector3((Math.random()-0.5)*15, (Math.random()-0.5)*15, 0).sub(pos).normalize().multiplyScalar(speed);
      sceneRef.current.discs.push({ 
        id: Math.random().toString(36), type, position: pos, velocity, mesh: group as any, size: size * 1.35, 
        originalSize: size, spawnTime: Date.now() 
      });
    };

    const addVFX = (text: string, pos: THREE.Vector3, color: string) => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: createTextTexture(text, color), transparent: true }));
      sprite.position.copy(pos);
      sprite.scale.set(5, 2.5, 1);
      scene.add(sprite);
      sceneRef.current?.floatingVFX.push({ mesh: sprite, velocity: new THREE.Vector3(0, 0.06, 0.04), life: 1.0 });
    };

    const spawnTrail = (disc: Disc) => {
      if (!sceneRef.current) return;
      const color = ((disc.mesh.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).color;
      const ringGeom = new THREE.TorusGeometry(disc.originalSize * 0.6, 0.015, 8, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4 });
      const ghost = new THREE.Mesh(ringGeom, ringMat);
      ghost.position.copy(disc.mesh.position);
      ghost.rotation.copy(disc.mesh.rotation);
      ghost.scale.copy(disc.mesh.scale);
      scene.add(ghost);
      sceneRef.current.trailParticles.push({ mesh: ghost, life: 1.0 });
    };

    const animate = () => {
      requestAnimationFrame(animate);
      if (!sceneRef.current) return;
      const { scene, camera, renderer, discs, particles, trailParticles, floatingVFX, handData, laser, crosshair, muzzleFlash } = sceneRef.current;

      const isLost = lastDetectionTimeRef.current === 0 ? false : (Date.now() - lastDetectionTimeRef.current > TRACKING_TIMEOUT_MS);
      if (isLost !== trackingLost) setTrackingLost(isLost);

      if (isActiveRef.current && !isLost) {
        if (discs.length < MAX_DISCS) spawnDisc();
        for (let i = discs.length - 1; i >= 0; i--) {
          const d = discs[i]; 
          d.mesh.position.add(d.velocity);
          d.mesh.children[1].rotation.z += 0.1; 
          d.mesh.children[2].rotation.y += 0.05;
          if (Math.random() > 0.7) spawnTrail(d);
          if (d.mesh.position.z > 5) { scene.remove(d.mesh); discs.splice(i, 1); }
        }
        for (let i = trailParticles.length - 1; i >= 0; i--) {
          const tp = trailParticles[i]; tp.life -= 0.05;
          (tp.mesh.material as THREE.MeshBasicMaterial).opacity = tp.life * 0.4;
          tp.mesh.scale.multiplyScalar(0.96);
          if (tp.life <= 0) { scene.remove(tp.mesh); trailParticles.splice(i, 1); }
        }
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i]; p.mesh.position.add(p.velocity); p.life -= 0.04;
          p.mesh.scale.setScalar(Math.max(0.01, p.life));
          if (p.life <= 0) { scene.remove(p.mesh); particles.splice(i, 1); }
        }
        for (let i = floatingVFX.length - 1; i >= 0; i--) {
          const v = floatingVFX[i]; v.mesh.position.add(v.velocity); v.life -= 0.025;
          (v.mesh.material as THREE.SpriteMaterial).opacity = v.life;
          if (v.life <= 0) { scene.remove(v.mesh); floatingVFX.splice(i, 1); }
        }
      }

      if ((muzzleFlash.material as THREE.MeshBasicMaterial).opacity > 0) {
        (muzzleFlash.material as THREE.MeshBasicMaterial).opacity -= 0.15;
        muzzleFlash.scale.multiplyScalar(0.9);
      }

      if (handData?.isPistol && !isLost) {
        laser.visible = true; crosshair.visible = true;
        const currentTargetNDC = new THREE.Vector2(handData.aimPoint.x, handData.aimPoint.y);
        
        let magnetTarget = null;
        let bestDist = 0.35; // Magnetism radius
        discs.forEach(d => {
          const screenPos = d.mesh.position.clone().project(camera);
          const dist = currentTargetNDC.distanceTo(new THREE.Vector2(screenPos.x, screenPos.y));
          if (dist < bestDist) { bestDist = dist; magnetTarget = new THREE.Vector2(screenPos.x, screenPos.y); }
        });

        if (magnetTarget) {
          currentTargetNDC.lerp(magnetTarget, 0.85); // Aggressive magnetic lock
          ringMat.color.set(0x00ff00);
          crosshair.children[2].scale.setScalar(0.75 + Math.sin(Date.now()*0.025)*0.1);
        } else {
          ringMat.color.set(0xffffff);
          crosshair.children[2].scale.setScalar(1.2);
        }

        const aimWorld = new THREE.Vector3(currentTargetNDC.x, currentTargetNDC.y, 0.975).unproject(camera);
        crosshair.position.copy(aimWorld);
        crosshair.lookAt(camera.position);

        const tipLM = handData.landmarks[8];
        const tipWorld = new THREE.Vector3((1-tipLM.x)*2-1, (1-tipLM.y)*2-1, 0.85).unproject(camera);
        muzzleFlash.position.copy(tipWorld);
        laser.geometry.setFromPoints([tipWorld, aimWorld.clone().multiplyScalar(40)]);

        // Process Stateful Trigger Event
        if (handData.isTriggerPulled && isActiveRef.current) {
          audioService.playShoot();
          (muzzleFlash.material as THREE.MeshBasicMaterial).opacity = 1.0;
          muzzleFlash.scale.setScalar(0.7);
          
          const ray = new THREE.Raycaster();
          ray.setFromCamera(currentTargetNDC, camera);
          const hits = ray.intersectObjects(discs.map(d => d.mesh), true);
          
          if (hits.length > 0) {
            const hit = hits[0];
            const discIdx = discs.findIndex(d => d.mesh.uuid === hit.object.parent?.uuid || d.mesh.uuid === hit.object.uuid);
            if (discIdx !== -1) {
              const disc = discs[discIdx];
              const distToCenter = hit.point.distanceTo(disc.mesh.position);
              const isBullseye = distToCenter < disc.originalSize * 0.3;
              
              const pts = Math.round((isBullseye ? 1200 : 350) * (1 + comboCountRef.current * 0.2));
              onScoreUpdateRef.current(pts);
              onComboUpdateRef.current(comboCountRef.current + 1);
              audioService.playHit(disc.type, comboCountRef.current + 1, isBullseye ? 1 : 0.5);
              
              addVFX(isBullseye ? "CRITICAL!" : "POP!", hit.point.clone(), isBullseye ? "#facc15" : "#00ffff");

              const col = (disc.mesh.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
              for(let i=0; i<40; i++) {
                const p = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: col.color, transparent: true }));
                p.position.copy(hit.point);
                scene.add(p);
                particles.push({ mesh: p, velocity: new THREE.Vector3((Math.random()-0.5)*6, (Math.random()-0.5)*6, (Math.random()-0.5)*6), life: 1.0 });
              }
              sceneRef.current.shake = isBullseye ? 2.0 : 0.9;
              scene.remove(disc.mesh);
              discs.splice(discIdx, 1);
            }
          } else {
            audioService.playMiss();
            onComboUpdateRef.current(0);
            addVFX("MISS", aimWorld.clone(), "#ff0044");
          }
        }
      } else {
        laser.visible = false; crosshair.visible = false;
      }

      if (sceneRef.current.shake > 0) {
        camera.position.set((Math.random()-0.5)*sceneRef.current.shake, (Math.random()-0.5)*sceneRef.current.shake, 0);
        sceneRef.current.shake *= 0.86;
      } else { camera.position.set(0,0,0); }

      renderer.render(scene, camera);
    };

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix(); 
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize); 
    animate();
    
    return () => { 
      window.removeEventListener('resize', handleResize); 
      renderer.dispose(); 
      scene.clear(); 
      sceneRef.current = null; 
    };
  }, []);

  return (
    <>
      <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover -scale-x-100" />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      {isActive && trackingLost && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#020617]/90 backdrop-blur-2xl">
          <div className="relative">
             <div className="w-24 h-24 border-4 border-fuchsia-500 rounded-full animate-ping absolute inset-0 opacity-40"></div>
             <div className="w-24 h-24 border-4 border-white/10 rounded-full flex items-center justify-center">
                <span className="text-white font-black text-5xl">!</span>
             </div>
          </div>
          <h2 className="text-4xl font-black text-white tracking-[0.2em] uppercase mt-10 italic">SYNC ERROR</h2>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px] mt-3 animate-pulse">Relinking Neural Core...</p>
        </div>
      )}
    </>
  );
};

export default ARGame;
