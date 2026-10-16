export const TILE_SIZE = 40;
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 480;
export const ROWS = 12;
export const COLS = 20;
export const GRAVITY = 0.58;
export const WALK_SPEED = 4.2;
export const JUMP_FORCE = -11.6;
export const TILE_SOLID = 1;
export const TILE_SPIKES = 2;
export const TILE_TERMINAL = 3;
export const TILE_DOOR = 4;
export const TILE_GATE = 5;
export const TILE_SWITCH = 6;

interface Position { x: number; y: number }
export interface GateLevel {
  name: string;
  hint: string;
  map: number[][];
  hostSpawn: Position;
  guestSpawn: Position;
}

const ORIGINAL_MAPS = [
  // LEVEL 1: Introduction to cooperation ("PILOT")
  [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 6, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 6, 0, 0, 0, 0, 3, 1], // Switch at col 3 (raised), gate at col 11, return switch at col 13, terminal at col 18
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ],
  // LEVEL 2: Double split paths ("DON'T WORRY!")
  [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0, 4, 1],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
    [1, 0, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 6, 0, 3, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ],
  // LEVEL 3: Precision jumping, spikes, switch coordination ("DOOMED?")
  [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1],
    [1, 0, 0, 0, 6, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 5, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 6, 0, 0, 3, 0, 1],
    [1, 0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ]
];

const tiles: Record<string, number> = { '.': 0, '#': TILE_SOLID, '^': TILE_SPIKES, T: TILE_TERMINAL, D: TILE_DOOR, G: TILE_GATE, S: TILE_SWITCH };
const mapFromRows = (rows: string[]) => rows.map(row => [...row].map(tile => tiles[tile]));

export const LEVELS: GateLevel[] = [
  {
    name: 'PILOT',
    hint: 'Hold a pressure switch to open the gates. Activate the terminal, then meet at the exit.',
    map: ORIGINAL_MAPS[0],
    hostSpawn: { x: 80, y: 408 }, guestSpawn: { x: 120, y: 408 },
  },
  {
    name: "DON'T WORRY!",
    hint: 'You start apart. Trade switch duty to reunite at the upper exit.',
    map: ORIGINAL_MAPS[1],
    hostSpawn: { x: 80, y: 350 }, guestSpawn: { x: 80, y: 80 },
  },
  {
    name: 'DOOMED?',
    hint: 'Watch the spikes. Use the raised switch and help each other climb.',
    map: ORIGINAL_MAPS[2],
    hostSpawn: { x: 60, y: 320 }, guestSpawn: { x: 100, y: 320 },
  },
  {
    name: 'PASS IT ON',
    hint: 'Hold the left switch while your partner crosses the spike pit. The far switch lets you follow.',
    hostSpawn: { x: 80, y: 408 }, guestSpawn: { x: 120, y: 408 },
    map: mapFromRows([
      '####################',
      '#......#....#......#',
      '#......#....#......#',
      '#......#....#......#',
      '#......#....#..D...#',
      '#......#....#..##..#',
      '#......#....#.....T#',
      '#......#....#....###',
      '#......#....#......#',
      '#......#....#..##..#',
      '#..S...G.^^.G.S....#',
      '####################',
    ]),
  },
  {
    name: 'UPPER HAND',
    hint: 'The upper player holds the first switch. Cross below, then hold the far switch for your partner.',
    hostSpawn: { x: 80, y: 408 }, guestSpawn: { x: 80, y: 168 },
    map: mapFromRows([
      '####################',
      '#.........#........#',
      '#.........#.......D#',
      '#.........#......###',
      '#..S......#........#',
      '#####.....#...##...#',
      '#.........#......T.#',
      '#.....##..#......###',
      '#.........#........#',
      '#..##.....#...##...#',
      '#.........G.^^...S.#',
      '####################',
    ]),
  },
  {
    name: 'LAST LINK',
    hint: 'Pass through three gates together. Use each safe switch to regroup before the final climb.',
    hostSpawn: { x: 80, y: 408 }, guestSpawn: { x: 120, y: 408 },
    map: mapFromRows([
      '####################',
      '#.....#...#...#....#',
      '#.....#...#...#D...#',
      '#.....#...#...##...#',
      '#.....#...#...#..T.#',
      '#.....#...#...#..#.#',
      '#.....#...#...#....#',
      '#.....#...#...##...#',
      '#.....#...#...#....#',
      '#.....G...G...G..#.#',
      '#..S..G.^SG.^SG.S..#',
      '####################',
    ]),
  },
];

export const getLevelSpawns = (levelIndex: number, isHost: boolean) => {
  const level = LEVELS[levelIndex];
  return {
    local: isHost ? level.hostSpawn : level.guestSpawn,
    remote: isHost ? level.guestSpawn : level.hostSpawn,
  };
};

export const getNextLevelIndex = (levelIndex: number): number | null =>
  levelIndex + 1 < LEVELS.length ? levelIndex + 1 : null;

export interface CollisionBody {
  x: number; y: number; vx: number; vy: number;
  width: number; height: number; isJumping: boolean;
}

// Shared with route checks so they use the same solid-wall and gate collisions as play.
export const resolveTileCollisions = (p: CollisionBody, map: number[][], dir: 'x' | 'y', gateOpen: boolean) => {
  const EPS = 0.05;
  const left = Math.floor((p.x + EPS) / TILE_SIZE);
  const right = Math.floor((p.x + p.width - EPS) / TILE_SIZE);
  const top = Math.floor((p.y + EPS) / TILE_SIZE);
  const bottom = Math.floor((p.y + p.height - EPS) / TILE_SIZE);

  for (let r = top; r <= bottom; r++) {
    for (let c = left; c <= right; c++) {
      const tile = map[r]?.[c];
      if (tile !== TILE_SOLID && !(tile === TILE_GATE && !gateOpen)) continue;
      if (dir === 'x') {
        if (p.vx > 0) p.x = c * TILE_SIZE - p.width;
        else if (p.vx < 0) p.x = (c + 1) * TILE_SIZE;
      } else if (p.vy > 0) {
        p.y = r * TILE_SIZE - p.height;
        p.vy = 0;
        p.isJumping = false;
      } else if (p.vy < 0) {
        p.y = (r + 1) * TILE_SIZE;
        p.vy = 0;
      }
    }
  }
};

