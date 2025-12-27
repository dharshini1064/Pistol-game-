
import * as THREE from 'three';

export type DiscType = 'NORMAL' | 'FAST' | 'PULSATOR' | 'SHIELD' | 'BOMB' | 'SWARM';

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface HandData {
  landmarks: Point3D[];
  isPistol: boolean;
  isTriggerPulled: boolean;
  aimPoint: { x: number; y: number };
}

export interface Disc {
  id: string;
  type: DiscType;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  mesh: THREE.Mesh;
  size: number;
  originalSize: number;
  spawnTime: number;
  hitsRemaining?: number;
}

export interface FloatingText {
  id: string;
  text: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  opacity: number;
  color: string;
  life: number;
}

export interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
}

export interface TrailParticle {
  mesh: THREE.Mesh;
  life: number;
}
