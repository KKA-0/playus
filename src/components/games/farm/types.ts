export interface InventoryItem {
  type: string;
  count: number;
}

export interface PlayerState {
  x: number;
  y: number;
  gender: 'male' | 'female' | null;
  facingLeft: boolean;
  isMoving: boolean;
  inHouse: boolean;
  facingUp: boolean;
  inventory: (InventoryItem | null)[];
}

export interface Crop {
  x: number;
  y: number;
  type: 'carrot' | 'pumpkin';
  stage: number; // 0, 1, 2
  watered: boolean;
  growthTimer: number;
}

export interface WildItem {
  id: string;
  x: number;
  y: number;
  type: 'berry' | 'wood' | 'stone';
  active: boolean;
  respawnTimer: number;
}

export interface SmokeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  maxLife: number;
  life: number;
}

export interface Weed {
  id: string;
  x: number;
  y: number;
  type?: number;
}

export interface ChickenState {
  id: string;
  x: number;
  y: number;
  startX: number;
  startY: number;
  vx: number;
  vy: number;
  direction: 'down' | 'left' | 'right' | 'up';
  state: 'idle' | 'walking';
  timer: number;
  frameIndex: number;
  animationTick: number;
}
