export interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  isCheckpoint?: boolean;
  checkpointId?: number;
  isPuzzleHint?: boolean;
  hintText?: string;
}

export interface Checkpoint {
  id: number;
  label: string;
  y: number;
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  deathY: number;
}

export interface Chapter {
  name: string;
  description: string;
  color: string;
  background: string;
  platforms: Platform[];
  checkpoints: Checkpoint[];
  portal: { x: number; y: number };
}

export const PHYSICS = { gravity: 0.5, walkSpeed: 6, jumpForce: -10.5 };

const checkpoint = (id: number, name: string, y: number): Checkpoint => ({
  id,
  label: `Camp ${id + 1}: ${name}`,
  y,
  p1: { x: 320, y: y - 50 },
  p2: { x: 440, y: y - 50 },
  deathY: y + (id === 0 ? 90 : 180),
});

const camp = (y: number, checkpointId: number): Platform => ({
  x: 200, y, w: 400, h: 24, isCheckpoint: true, checkpointId,
});

const step = (x: number, y: number, w: number, hintText?: string): Platform => ({
  x, y, w, h: 16, ...(hintText ? { isPuzzleHint: true, hintText } : {}),
});

export const CHAPTERS: Chapter[] = [
  {
    name: 'The First Ascent',
    description: 'Learn to climb, stack, and pull each other to the portal.',
    color: '#9d4edd',
    background: '#05060b',
    checkpoints: [
      checkpoint(0, 'Base Camp', 440),
      checkpoint(1, 'Rift Bridge', -50),
      checkpoint(2, 'Highland Watchtower', -750),
    ],
    portal: { x: 400, y: -1430 },
    platforms: [
      { x: -100, y: 440, w: 1000, h: 40, isCheckpoint: true, checkpointId: 0 },
      step(320, 340, 160),
      step(100, 250, 180), step(520, 250, 180),
      step(300, 150, 200),
      step(80, 50, 180), step(540, 50, 180),
      camp(-50, 1),
      step(100, -150, 180), step(520, -150, 180),
      step(100, -250, 180), step(520, -250, 180),
      step(300, -370, 200, 'CO-OP STACK JUMP REQUIRED'),
      step(100, -470, 180), step(520, -470, 180),
      step(300, -570, 200),
      step(100, -670, 180), step(520, -670, 180),
      { x: 150, y: -750, w: 500, h: 24, isCheckpoint: true, checkpointId: 2 },
      step(80, -850, 180), step(540, -850, 180),
      step(330, -950, 140),
      step(100, -1050, 180), step(520, -1050, 180),
      step(280, -1150, 240),
      step(60, -1250, 160), step(580, -1250, 160),
      step(350, -1330, 100),
      step(200, -1430, 400),
    ],
  },
  {
    name: 'Skybridge Switchbacks',
    description: 'Cross the shaft together. Pause on each ledge before the next jump.',
    color: '#22d3ee',
    background: '#05121c',
    checkpoints: [
      checkpoint(0, 'Cloud Dock', 440),
      checkpoint(1, 'Crosswind Rest', -40),
      checkpoint(2, 'Skybridge Lookout', -580),
    ],
    portal: { x: 400, y: -1120 },
    platforms: [
      camp(440, 0),
      step(410, 360, 170, 'JUMP TOGETHER; LAND TOGETHER'),
      step(540, 280, 150),
      step(410, 200, 160),
      step(280, 120, 160),
      step(140, 40, 170),
      camp(-40, 1),
      step(100, -130, 150),
      step(230, -220, 140),
      step(360, -310, 130, 'KEEP YOUR PARTNER CLOSE'),
      step(490, -400, 140),
      step(620, -490, 140),
      camp(-580, 2),
      step(480, -670, 120),
      step(350, -760, 120),
      step(220, -850, 120),
      step(90, -940, 130),
      step(60, -1030, 130),
      step(200, -1120, 400),
    ],
  },
  {
    name: 'The Crystal Summit',
    description: 'Small ledges and tight turns. Make room for your partner at every landing.',
    color: '#fbbf24',
    background: '#171020',
    checkpoints: [
      checkpoint(0, 'Crystal Gate', 440),
      checkpoint(1, 'Needle Ridge', -100),
      checkpoint(2, 'Summit Shelter', -640),
    ],
    portal: { x: 400, y: -1180 },
    platforms: [
      camp(440, 0),
      step(340, 350, 120, 'MAKE ROOM FOR TWO'),
      step(220, 260, 110),
      step(340, 170, 100),
      step(220, 80, 110),
      step(100, -10, 100),
      camp(-100, 1),
      step(200, -190, 100),
      step(320, -280, 90),
      step(440, -370, 90),
      step(560, -460, 90, 'SHORT STEPS; SHARED LANDINGS'),
      step(660, -550, 100),
      camp(-640, 2),
      step(480, -730, 90),
      step(360, -820, 80),
      step(240, -910, 80),
      step(120, -1000, 90),
      step(80, -1090, 90),
      step(200, -1180, 400),
    ],
  },
];

interface PlayerBounds { x: number; y: number; width: number; height: number }

export const isAtPortal = (player: PlayerBounds, chapter: Chapter) => (
  Math.abs(player.x + player.width / 2 - chapter.portal.x) < 40 &&
  Math.abs(player.y + player.height - chapter.portal.y) < 15
);

export const getCameraY = (midpointY: number, chapter: Chapter, height: number) => (
  Math.max(chapter.portal.y - height / 2, Math.min(220, midpointY - height / 2))
);

export const isValidCheckpoint = (chapterIndex: number, checkpointIndex: number) => (
  Number.isInteger(chapterIndex) && Number.isInteger(checkpointIndex) &&
  !!CHAPTERS[chapterIndex]?.checkpoints[checkpointIndex]
);
