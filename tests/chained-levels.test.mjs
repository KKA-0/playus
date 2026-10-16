import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

// Use the project's TypeScript compiler so these tests also run on Node 20.
const source = await readFile(new URL('../src/components/games/chained/levels.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } });
const { CHAPTERS, PHYSICS, getCameraY, isAtPortal, isValidCheckpoint } =
  await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('every checkpoint safely spawns both players on its own platform', () => {
  for (const chapter of CHAPTERS) {
    for (const cp of chapter.checkpoints) {
      const platform = chapter.platforms.find(p => p.checkpointId === cp.id);
      assert.ok(platform, `${chapter.name}: missing camp ${cp.id}`);
      for (const p of [cp.p1, cp.p2]) {
        assert.ok(p.x >= platform.x && p.x + 24 <= platform.x + platform.w);
        assert.ok(p.y + 32 <= platform.y && p.y < cp.deathY);
      }
      assert.ok(Math.hypot(cp.p2.x - cp.p1.x, cp.p2.y - cp.p1.y) <= 140);
      assert.equal(chapter.checkpoints[cp.id], cp);
    }
  }
});

// Search jump trajectories with the same gravity, speed, and platform collisions as the
// game. A 56px box represents two 24px players jumping together with an 8px gap.
// Requiring the entire pair to land on the next slab checks that narrow ledges remain fair.
const canJumpTogether = (from, to, platforms) => {
  const width = 56;
  const height = 32;
  let positions = [];
  for (let x = Math.max(10, from.x); x + width <= Math.min(790, from.x + from.w); x += 2) {
    positions.push({ x, y: from.y - height, vy: PHYSICS.jumpForce });
  }

  for (let frame = 0; frame < 60 && positions.length; frame++) {
    const next = new Map();
    for (const previous of positions) {
      for (const vx of [-PHYSICS.walkSpeed, 0, PHYSICS.walkSpeed]) {
        const p = {
          x: Math.max(10, Math.min(790 - width, previous.x + vx)),
          y: previous.y + previous.vy + PHYSICS.gravity,
          vy: previous.vy + PHYSICS.gravity,
        };
        let collided = false;
        for (const platform of platforms) {
          if (p.x + width <= platform.x || p.x >= platform.x + platform.w ||
            p.y + height < platform.y || p.y >= platform.y + platform.h) continue;
          if (p.vy >= 0 && previous.y + height <= platform.y + 8) {
            if (platform === to && p.x >= to.x && p.x + width <= to.x + to.w) return true;
            collided = true;
          } else if (p.vy < 0 && previous.y >= platform.y + platform.h - 8) {
            p.y = platform.y + platform.h;
            p.vy = 0;
          }
        }
        if (!collided && p.y < from.y) next.set(`${p.x},${p.y},${p.vy}`, p);
      }
    }
    positions = [...next.values()];
  }
  return false;
};

for (const chapter of CHAPTERS.slice(1)) {
  test(`${chapter.name}: two players can reach every ledge and the portal`, () => {
    for (let i = 1; i < chapter.platforms.length; i++) {
      assert.ok(canJumpTogether(chapter.platforms[i - 1], chapter.platforms[i], chapter.platforms),
        `Unreachable jump from y=${chapter.platforms[i - 1].y} to y=${chapter.platforms[i].y}`);
    }
  });
}

test('each chapter wins only at its own portal, with room for both players', () => {
  for (const chapter of CHAPTERS) {
    const left = { x: chapter.portal.x - 28, y: chapter.portal.y - 32, width: 24, height: 32 };
    const right = { ...left, x: chapter.portal.x + 4 };
    assert.ok(isAtPortal(left, chapter) && isAtPortal(right, chapter));
    assert.equal(isAtPortal({ ...left, y: chapter.checkpoints[0].p1.y }, chapter), false);
    assert.equal(isAtPortal({ ...right, x: chapter.portal.x + 80 }, chapter), false);
    for (const other of CHAPTERS.filter(c => c !== chapter)) {
      assert.equal(isAtPortal(left, other), false, 'Old portal must not complete another chapter');
    }
  }
});

test('camera keeps the summit and portal visible in every chapter', () => {
  for (const chapter of CHAPTERS) {
    const cameraY = getCameraY(chapter.portal.y - 32, chapter, 480);
    const portalOnScreen = chapter.portal.y - 25 - cameraY;
    assert.ok(portalOnScreen >= 30 && portalOnScreen <= 450);
    assert.equal(getCameraY(1000, chapter, 480), 220);
  }
});

test('invalid chapter and checkpoint transitions are rejected', () => {
  assert.ok(isValidCheckpoint(2, 2));
  for (const [chapter, checkpoint] of [[-1, 0], [3, 0], [0, -1], [0, 3], [1.5, 0], [0, NaN]]) {
    assert.equal(isValidCheckpoint(chapter, checkpoint), false);
  }
});
