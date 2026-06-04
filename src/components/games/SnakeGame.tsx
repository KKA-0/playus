import React, { useEffect, useRef, useState } from 'react';
import { usePeer } from '../../context/PeerContext';
import { Trophy, Clock, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 480;
const MAP_WIDTH = 2000;
const MAP_HEIGHT = 2000;
const GAME_DURATION = 60; // 60 seconds game
const TARGET_SCORE = 1500; // Combined score to win
const STARTING_LENGTH = 10;
const SEGMENT_SPACING = 10; // spacing between segments in pixels

interface Position {
  x: number;
  y: number;
}

interface PlayerSnake {
  segments: Position[];
  angle: number;
  isBoosting: boolean;
  score: number;
  active: boolean;
  invulnerableTimer: number; // Flash when invulnerable after respawning
}

interface Food {
  id: string;
  x: number;
  y: number;
  size: number;
  color: string;
  value: number;
}

interface Bot {
  id: string;
  name: string;
  color: string;
  segments: Position[];
  angle: number;
  targetAngle: number;
  speed: number;
  changeDirTimer: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

export const SnakeGame: React.FC = () => {
  const {
    isHost,
    isConnected,
    gameData,
    gameEvent,
    resetGameEvent,
    sendGameData,
    sendGameEvent,
    stopGame
  } = usePeer();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // React UI states
  const [score, setScore] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(GAME_DURATION);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [gameWon, setGameWon] = useState<boolean>(false);
  const [isDead, setIsDead] = useState<boolean>(false);
  const [respawnCounter, setRespawnCounter] = useState<number>(0);

  // User input states
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const mousePosRef = useRef<Position>({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 });
  const isMouseDownRef = useRef<boolean>(false);

  // Entities refs
  const localPlayerRef = useRef<PlayerSnake>({
    segments: [],
    angle: 0,
    isBoosting: false,
    score: 0,
    active: true,
    invulnerableTimer: 0
  });

  const remotePlayerRef = useRef<PlayerSnake>({
    segments: [],
    angle: 0,
    isBoosting: false,
    score: 0,
    active: false,
    invulnerableTimer: 0
  });

  const foodRef = useRef<Food[]>([]);
  const botsRef = useRef<Bot[]>([]);
  const particlesRef = useRef<Particle[]>([]);

  // Host-authoritative timer and metrics
  const sharedScoreRef = useRef<number>(0);
  const timerRef = useRef<number>(GAME_DURATION);
  const boostFrameCounterRef = useRef<number>(0);
  const lastSyncTimeRef = useRef<number>(0);

  // Initialize controls and starting positions
  useEffect(() => {
    // Generate initial snake segments
    const startY = isHost ? 800 : 1200;
    const startX = isHost ? 600 : 1400;
    const startAngle = isHost ? 0 : Math.PI;

    const initialSegments: Position[] = [];
    for (let i = 0; i < STARTING_LENGTH; i++) {
      initialSegments.push({
        x: startX - Math.cos(startAngle) * i * SEGMENT_SPACING,
        y: startY - Math.sin(startAngle) * i * SEGMENT_SPACING
      });
    }

    localPlayerRef.current = {
      segments: initialSegments,
      angle: startAngle,
      isBoosting: false,
      score: 0,
      active: true,
      invulnerableTimer: 180 // 3 seconds of invulnerability
    };

    remotePlayerRef.current = {
      segments: [],
      angle: 0,
      isBoosting: false,
      score: 0,
      active: false,
      invulnerableTimer: 0
    };

    // Reset metrics
    sharedScoreRef.current = 0;
    timerRef.current = GAME_DURATION;
    foodRef.current = [];
    botsRef.current = [];
    particlesRef.current = [];
    setScore(0);
    setTimeRemaining(GAME_DURATION);
    setGameOver(false);
    setGameWon(false);
    setIsDead(false);

    // Event listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      keysRef.current[e.key] = true;
      if (e.key === ' ') {
        isMouseDownRef.current = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key] = false;
      if (e.key === ' ') {
        isMouseDownRef.current = false;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mousePosRef.current = {
        x: ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
        y: ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT
      };
    };

    const handleMouseDown = () => {
      isMouseDownRef.current = true;
    };

    const handleMouseUp = () => {
      isMouseDownRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isHost]);

  // Network Sync Handlers
  useEffect(() => {
    if (!gameData) return;

    if (isHost) {
      // Host receives Client snake segments, angle, isBoosting
      if (gameData.player) {
        remotePlayerRef.current.segments = gameData.player.segments;
        remotePlayerRef.current.angle = gameData.player.angle;
        remotePlayerRef.current.isBoosting = gameData.player.isBoosting;
        remotePlayerRef.current.active = gameData.player.active;
        remotePlayerRef.current.invulnerableTimer = gameData.player.invulnerableTimer;
      }
    } else {
      // Client receives full state from Host
      if (gameData.player) {
        remotePlayerRef.current.segments = gameData.player.segments;
        remotePlayerRef.current.angle = gameData.player.angle;
        remotePlayerRef.current.isBoosting = gameData.player.isBoosting;
        remotePlayerRef.current.active = gameData.player.active;
        remotePlayerRef.current.invulnerableTimer = gameData.player.invulnerableTimer;
      }
      if (gameData.food) {
        foodRef.current = gameData.food;
      }
      if (gameData.bots) {
        botsRef.current = gameData.bots;
      }
      if (gameData.metrics) {
        setScore(gameData.metrics.score);
        setTimeRemaining(gameData.metrics.time);
        sharedScoreRef.current = gameData.metrics.score;
        timerRef.current = gameData.metrics.time;

        // Self score sync - adjust length if server-authoritative score changes
        const oldScore = localPlayerRef.current.score;
        const newScore = isHost ? gameData.metrics.p1Score : gameData.metrics.p2Score;
        localPlayerRef.current.score = newScore;

        if (newScore > oldScore) {
          // Grow snake segments
          const growAmount = Math.floor((newScore - oldScore) / 10);
          for (let g = 0; g < growAmount; g++) {
            const tail = localPlayerRef.current.segments[localPlayerRef.current.segments.length - 1] || { x: 400, y: 240 };
            localPlayerRef.current.segments.push({ ...tail });
          }
        } else if (newScore < oldScore) {
          // Shrink snake segments (boosting or penalty)
          const shrinkAmount = Math.max(0, Math.floor((oldScore - newScore) / 10));
          if (localPlayerRef.current.segments.length > STARTING_LENGTH) {
            localPlayerRef.current.segments = localPlayerRef.current.segments.slice(
              0,
              Math.max(STARTING_LENGTH, localPlayerRef.current.segments.length - shrinkAmount)
            );
          }
        }
      }
      if (gameData.status) {
        setGameOver(gameData.status.gameOver);
        setGameWon(gameData.status.gameWon);
      }
    }
  }, [gameData, isHost]);

  // Handle one-off events
  useEffect(() => {
    if (!gameEvent) return;

    if (gameEvent.type === 'player_death' && gameEvent.target === (isHost ? 'host' : 'client')) {
      // Trigger death explosion locally
      explodeSnake(localPlayerRef.current.segments, isHost ? 'var(--neon-cyan)' : 'var(--neon-magenta)');
      setIsDead(true);
      setRespawnCounter(2); // 2s respawn delay
      localPlayerRef.current.active = false;
      localPlayerRef.current.segments = [];
    } else if (gameEvent.type === 'player_death' && gameEvent.target === (isHost ? 'client' : 'host')) {
      // Other player died, explode them
      explodeSnake(remotePlayerRef.current.segments, isHost ? 'var(--neon-magenta)' : 'var(--neon-cyan)');
    } else if (gameEvent.type === 'victory_confetti') {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
    } else if (gameEvent.type === 'reset_game') {
      handleRestartLocal();
    }

    resetGameEvent();
  }, [gameEvent]);

  // Respawn countdown timer
  useEffect(() => {
    if (!isDead) return;
    const interval = setInterval(() => {
      setRespawnCounter((c) => {
        if (c <= 1) {
          clearInterval(interval);
          respawnPlayer();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isDead]);

  const respawnPlayer = () => {
    const startY = isHost ? 800 : 1200;
    const startX = isHost ? 600 : 1400;
    const startAngle = isHost ? 0 : Math.PI;

    const initialSegments: Position[] = [];
    for (let i = 0; i < STARTING_LENGTH; i++) {
      initialSegments.push({
        x: startX - Math.cos(startAngle) * i * SEGMENT_SPACING,
        y: startY - Math.sin(startAngle) * i * SEGMENT_SPACING
      });
    }

    localPlayerRef.current = {
      segments: initialSegments,
      angle: startAngle,
      isBoosting: false,
      score: 0,
      active: true,
      invulnerableTimer: 180 // 3 seconds flashing/safe
    };

    setIsDead(false);

    if (isHost) {
      // Host authoritative score penalty
      localPlayerRef.current.score = 0;
    } else {
      // Client notifies host it respawned
      sendGameEvent({ type: 'respawn' });
    }
  };

  const explodeSnake = (segments: Position[], color: string) => {
    if (!segments || segments.length === 0) return;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      // Generate explosion particles
      for (let p = 0; p < 3; p++) {
        const pAngle = Math.random() * Math.PI * 2;
        const pSpeed = 0.5 + Math.random() * 2.5;
        particlesRef.current.push({
          x: seg.x,
          y: seg.y,
          vx: Math.cos(pAngle) * pSpeed,
          vy: Math.sin(pAngle) * pSpeed,
          size: 2 + Math.random() * 3,
          color,
          life: 0,
          maxLife: 20 + Math.random() * 20
        });
      }
    }
  };

  const handleRestartLocal = () => {
    const startY = isHost ? 800 : 1200;
    const startX = isHost ? 600 : 1400;
    const startAngle = isHost ? 0 : Math.PI;

    const initialSegments: Position[] = [];
    for (let i = 0; i < STARTING_LENGTH; i++) {
      initialSegments.push({
        x: startX - Math.cos(startAngle) * i * SEGMENT_SPACING,
        y: startY - Math.sin(startAngle) * i * SEGMENT_SPACING
      });
    }

    localPlayerRef.current = {
      segments: initialSegments,
      angle: startAngle,
      isBoosting: false,
      score: 0,
      active: true,
      invulnerableTimer: 180
    };

    remotePlayerRef.current = {
      segments: [],
      angle: 0,
      isBoosting: false,
      score: 0,
      active: false,
      invulnerableTimer: 0
    };

    foodRef.current = [];
    botsRef.current = [];
    particlesRef.current = [];
    setScore(0);
    setTimeRemaining(GAME_DURATION);
    setGameOver(false);
    setGameWon(false);
    setIsDead(false);
    setRespawnCounter(0);

    sharedScoreRef.current = 0;
    timerRef.current = GAME_DURATION;
  };

  const handleRestart = () => {
    if (!isHost) return;
    handleRestartLocal();
    sendGameEvent({ type: 'reset_game' });
  };

  // Main loop & Physics
  useEffect(() => {
    let animationId: number;
    let timerInterval: any;

    const spawnFood = (count = 1, forceColor?: string, forcePos?: Position, forceVal?: number) => {
      const colors = ['#39ff14', '#00f0ff', '#ff007f', '#ffea00', '#9d4edd'];
      for (let i = 0; i < count; i++) {
        const x = forcePos ? forcePos.x + (Math.random() - 0.5) * 20 : 20 + Math.random() * (MAP_WIDTH - 40);
        const y = forcePos ? forcePos.y + (Math.random() - 0.5) * 20 : 20 + Math.random() * (MAP_HEIGHT - 40);
        foodRef.current.push({
          id: Math.random().toString(36).substring(2, 9),
          x,
          y,
          size: forceVal ? 6 : 3.5 + Math.random() * 3,
          color: forceColor || colors[Math.floor(Math.random() * colors.length)],
          value: forceVal || 10
        });
      }
    };

    const spawnBot = () => {
      const colors = ['#ef4444', '#f97316', '#a855f7'];
      const names = ['Hyperion', 'Nemesis', 'Ares'];
      const index = Math.floor(Math.random() * colors.length);

      // Spawn on edges
      let bx = 0;
      let by = 0;
      const edge = Math.floor(Math.random() * 4);
      if (edge === 0) { bx = Math.random() * MAP_WIDTH; by = 20; }
      else if (edge === 1) { bx = MAP_WIDTH - 20; by = Math.random() * MAP_HEIGHT; }
      else if (edge === 2) { bx = Math.random() * MAP_WIDTH; by = MAP_HEIGHT - 20; }
      else { bx = 20; by = Math.random() * MAP_HEIGHT; }

      const botAngle = Math.random() * Math.PI * 2;
      const botSegments: Position[] = [];
      const botLen = 8 + Math.floor(Math.random() * 6);
      for (let i = 0; i < botLen; i++) {
        botSegments.push({
          x: bx - Math.cos(botAngle) * i * SEGMENT_SPACING,
          y: by - Math.sin(botAngle) * i * SEGMENT_SPACING
        });
      }

      botsRef.current.push({
        id: Math.random().toString(36).substring(2, 9),
        name: names[index],
        color: colors[index],
        segments: botSegments,
        angle: botAngle,
        targetAngle: botAngle,
        speed: 1.8 + Math.random() * 0.8,
        changeDirTimer: 30
      });
    };

    const updatePhysics = () => {
      if (gameOver || gameWon) return;

      // Update local player invulnerability flash
      if (localPlayerRef.current.invulnerableTimer > 0) {
        localPlayerRef.current.invulnerableTimer--;
      }

      // Update particles
      particlesRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
      });
      particlesRef.current = particlesRef.current.filter((p) => p.life < p.maxLife);

      if (!localPlayerRef.current.active) return;

      // --- LOCAL SNAKE steering ---
      const head = localPlayerRef.current.segments[0];
      if (!head) return;

      let targetAngle = localPlayerRef.current.angle;
      let hasInput = false;

      // Keyboard Controls
      let kx = 0;
      let ky = 0;
      if (keysRef.current['a'] || keysRef.current['A'] || keysRef.current['ArrowLeft']) kx = -1;
      if (keysRef.current['d'] || keysRef.current['D'] || keysRef.current['ArrowRight']) kx = 1;
      if (keysRef.current['w'] || keysRef.current['W'] || keysRef.current['ArrowUp']) ky = -1;
      if (keysRef.current['s'] || keysRef.current['S'] || keysRef.current['ArrowDown']) ky = 1;

      if (kx !== 0 || ky !== 0) {
        targetAngle = Math.atan2(ky, kx);
        hasInput = true;
      } else {
        // Steering towards Mouse (relative to screen center since camera centers on head)
        const mX = mousePosRef.current.x;
        const mY = mousePosRef.current.y;
        const dx = mX - CANVAS_WIDTH / 2;
        const dy = mY - CANVAS_HEIGHT / 2;
        const dist = Math.hypot(dx, dy);

        if (dist > 12) {
          targetAngle = Math.atan2(dy, dx);
          hasInput = true;
        }
      }

      // Rotate snake smoothly towards target angle
      if (hasInput) {
        let angleDiff = targetAngle - localPlayerRef.current.angle;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

        localPlayerRef.current.angle += angleDiff * 0.12; // turn rate
      }

      // Local boosting checks
      const minLengthForBoost = 8;
      const wantsBoost = isMouseDownRef.current && localPlayerRef.current.segments.length > minLengthForBoost;
      localPlayerRef.current.isBoosting = wantsBoost;

      const speed = wantsBoost ? 4.2 : 2.2;
      const moveX = Math.cos(localPlayerRef.current.angle) * speed;
      const moveY = Math.sin(localPlayerRef.current.angle) * speed;

      // Update head position
      const newHead = {
        x: head.x + moveX,
        y: head.y + moveY
      };

      // Clamp to boundaries
      newHead.x = Math.max(8, Math.min(MAP_WIDTH - 8, newHead.x));
      newHead.y = Math.max(8, Math.min(MAP_HEIGHT - 8, newHead.y));

      // Propagate movement to other segments
      const updatedSegments = [...localPlayerRef.current.segments];
      updatedSegments[0] = newHead;

      for (let i = 1; i < updatedSegments.length; i++) {
        const prev = updatedSegments[i - 1];
        const curr = updatedSegments[i];
        const dist = Math.hypot(prev.x - curr.x, prev.y - curr.y);
        if (dist > SEGMENT_SPACING) {
          const ratio = SEGMENT_SPACING / dist;
          curr.x = prev.x - (prev.x - curr.x) * ratio;
          curr.y = prev.y - (prev.y - curr.y) * ratio;
        }
      }
      localPlayerRef.current.segments = updatedSegments;

      // --- Network sync outputs ---
      if (!isHost) {
        // Client sends local position and boosting state to Host
        sendGameData({
          player: {
            segments: localPlayerRef.current.segments,
            angle: localPlayerRef.current.angle,
            isBoosting: localPlayerRef.current.isBoosting,
            active: localPlayerRef.current.active,
            invulnerableTimer: localPlayerRef.current.invulnerableTimer
          }
        });
      } else {
        // --- HOST AUTHORITATIVE CALCULATIONS ---
        const p1 = localPlayerRef.current;
        const p2 = remotePlayerRef.current;

        // Spawn food if count is low
        if (foodRef.current.length < 25) {
          spawnFood(35 - foodRef.current.length);
        }

        // Spawn AI bots
        if (botsRef.current.length < 3) {
          spawnBot();
        }

        // Update AI Bots
        botsRef.current.forEach((bot) => {
          const bHead = bot.segments[0];
          bot.changeDirTimer--;

          if (bot.changeDirTimer <= 0) {
            // Smart Bot AI: Find closest food within radius, steer towards it
            let closestFood: Food | null = null;
            let minDist = 150;
            for (const f of foodRef.current) {
              const d = Math.hypot(f.x - bHead.x, f.y - bHead.y);
              if (d < minDist) {
                minDist = d;
                closestFood = f;
              }
            }

            if (closestFood) {
              bot.targetAngle = Math.atan2(closestFood.y - bHead.y, closestFood.x - bHead.x);
            } else {
              // Wander randomly
              bot.targetAngle = bot.angle + (Math.random() - 0.5) * 2;
            }
            bot.changeDirTimer = 30 + Math.random() * 50;
          }

          // Smooth rotation
          let diff = bot.targetAngle - bot.angle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          bot.angle += diff * 0.08;

          // Move bot segments
          const bMoveX = Math.cos(bot.angle) * bot.speed;
          const bMoveY = Math.sin(bot.angle) * bot.speed;
          const bNewHead = {
            x: Math.max(8, Math.min(MAP_WIDTH - 8, bHead.x + bMoveX)),
            y: Math.max(8, Math.min(MAP_HEIGHT - 8, bHead.y + bMoveY))
          };

          const bSegments = [...bot.segments];
          bSegments[0] = bNewHead;
          for (let i = 1; i < bSegments.length; i++) {
            const prev = bSegments[i - 1];
            const curr = bSegments[i];
            const d = Math.hypot(prev.x - curr.x, prev.y - curr.y);
            if (d > SEGMENT_SPACING) {
              const r = SEGMENT_SPACING / d;
              curr.x = prev.x - (prev.x - curr.x) * r;
              curr.y = prev.y - (prev.y - curr.y) * r;
            }
          }
          bot.segments = bSegments;
        });

        // Boost penalties (Host authoritative)
        boostFrameCounterRef.current++;
        if (boostFrameCounterRef.current >= 6) {
          boostFrameCounterRef.current = 0;

          // If P1 is boosting, reduce score and spawn food at tail
          if (p1.active && p1.isBoosting && p1.segments.length > STARTING_LENGTH) {
            p1.score = Math.max(0, p1.score - 10);
            sharedScoreRef.current = Math.max(0, sharedScoreRef.current - 10);
            const tail = p1.segments[p1.segments.length - 1];
            spawnFood(1, 'var(--neon-cyan)', tail, 5);
          }

          // If P2 is boosting, reduce score and spawn food at tail
          if (p2.active && p2.isBoosting && p2.segments.length > STARTING_LENGTH) {
            p2.score = Math.max(0, p2.score - 10);
            sharedScoreRef.current = Math.max(0, sharedScoreRef.current - 10);
            const tail = p2.segments[p2.segments.length - 1];
            spawnFood(1, 'var(--neon-magenta)', tail, 5);
          }
        }

        // Food Eating check
        const snakes = [
          { playerType: 'p1', obj: p1 },
          { playerType: 'p2', obj: p2 }
        ];

        foodRef.current.forEach((food) => {
          let eaten = false;

          // Check if players eat
          snakes.forEach((s) => {
            if (s.obj.active && !eaten) {
              const headPos = s.obj.segments[0];
              if (headPos) {
                const dist = Math.hypot(headPos.x - food.x, headPos.y - food.y);
                if (dist < 10 + food.size) {
                  eaten = true;
                  s.obj.score += food.value;
                  sharedScoreRef.current += food.value;

                  // Trigger eat particle locally for host
                  spawnEatParticles(food.x, food.y, food.color);

                  // Grow P1 locally
                  if (s.playerType === 'p1') {
                    const tail = p1.segments[p1.segments.length - 1] || headPos;
                    p1.segments.push({ ...tail });
                  }
                }
              }
            }
          });

          // Check if Bots eat
          if (!eaten) {
            botsRef.current.forEach((bot) => {
              if (!eaten) {
                const bHead = bot.segments[0];
                const dist = Math.hypot(bHead.x - food.x, bHead.y - food.y);
                if (dist < 10 + food.size) {
                  eaten = true;
                  const tail = bot.segments[bot.segments.length - 1] || bHead;
                  bot.segments.push({ ...tail });
                  spawnEatParticles(food.x, food.y, food.color);
                }
              }
            });
          }

          if (eaten) {
            // Mark food out of bounds to filter
            food.x = -999;
          }
        });
        foodRef.current = foodRef.current.filter((f) => f.x > 0);

        // Crash Collision Check (Host Authoritative)
        // Check Player 1 (Host) Death
        if (p1.active && p1.invulnerableTimer <= 0 && p1.segments[0]) {
          let died = false;
          const p1Head = p1.segments[0];

          // Hit border?
          if (p1Head.x < 12 || p1Head.x > MAP_WIDTH - 12 || p1Head.y < 12 || p1Head.y > MAP_HEIGHT - 12) {
            died = true;
          }

          // Hit P2 body?
          if (!died && p2.active && p2.invulnerableTimer <= 0) {
            p2.segments.forEach((seg) => {
              if (Math.hypot(p1Head.x - seg.x, p1Head.y - seg.y) < 12) {
                died = true;
              }
            });
          }

          // Hit own body? (Exclude first 8 segments)
          if (!died) {
            p1.segments.slice(8).forEach((seg) => {
              if (Math.hypot(p1Head.x - seg.x, p1Head.y - seg.y) < 12) {
                died = true;
              }
            });
          }

          // Hit any bot body?
          if (!died) {
            botsRef.current.forEach((bot) => {
              bot.segments.forEach((seg) => {
                if (Math.hypot(p1Head.x - seg.x, p1Head.y - seg.y) < 12) {
                  died = true;
                }
              });
            });
          }

          if (died) {
            // Explode P1 segments into food
            p1.segments.forEach((seg, index) => {
              if (index % 2 === 0) {
                spawnFood(1, 'var(--neon-cyan)', seg, 15);
              }
            });

            // Send death event
            sendGameEvent({ type: 'player_death', target: 'host' });
            explodeSnake(p1.segments, 'var(--neon-cyan)');
            setIsDead(true);
            setRespawnCounter(2);
            p1.active = false;
            p1.segments = [];
            p1.score = 0;
          }
        }

        // Check Player 2 (Client) Death
        if (p2.active && p2.invulnerableTimer <= 0 && p2.segments[0]) {
          let died = false;
          const p2Head = p2.segments[0];

          // Hit border?
          if (p2Head.x < 12 || p2Head.x > MAP_WIDTH - 12 || p2Head.y < 12 || p2Head.y > MAP_HEIGHT - 12) {
            died = true;
          }

          // Hit P1 body?
          if (!died && p1.active && p1.invulnerableTimer <= 0) {
            p1.segments.forEach((seg) => {
              if (Math.hypot(p2Head.x - seg.x, p2Head.y - seg.y) < 12) {
                died = true;
              }
            });
          }

          // Hit own body? (Exclude first 8 segments)
          if (!died) {
            p2.segments.slice(8).forEach((seg) => {
              if (Math.hypot(p2Head.x - seg.x, p2Head.y - seg.y) < 12) {
                died = true;
              }
            });
          }

          // Hit any bot body?
          if (!died) {
            botsRef.current.forEach((bot) => {
              bot.segments.forEach((seg) => {
                if (Math.hypot(p2Head.x - seg.x, p2Head.y - seg.y) < 12) {
                  died = true;
                }
              });
            });
          }

          if (died) {
            // Explode P2 segments into food
            p2.segments.forEach((seg, index) => {
              if (index % 2 === 0) {
                spawnFood(1, 'var(--neon-magenta)', seg, 15);
              }
            });

            // Send death event
            sendGameEvent({ type: 'player_death', target: 'client' });
            explodeSnake(p2.segments, 'var(--neon-magenta)');
            p2.active = false;
            p2.segments = [];
            p2.score = 0;
          }
        }

        // Check Bots Death (Hit player bodies or other bots)
        botsRef.current.forEach((bot) => {
          const bHead = bot.segments[0];
          if (!bHead) return;

          let botDied = false;

          // Hit P1?
          if (p1.active && p1.invulnerableTimer <= 0) {
            p1.segments.forEach((seg) => {
              if (Math.hypot(bHead.x - seg.x, bHead.y - seg.y) < 12) {
                botDied = true;
              }
            });
          }

          // Hit P2?
          if (!botDied && p2.active && p2.invulnerableTimer <= 0) {
            p2.segments.forEach((seg) => {
              if (Math.hypot(bHead.x - seg.x, bHead.y - seg.y) < 12) {
                botDied = true;
              }
            });
          }

          // Hit other bots?
          if (!botDied) {
            botsRef.current.forEach((other) => {
              if (other.id !== bot.id) {
                other.segments.forEach((seg) => {
                  if (Math.hypot(bHead.x - seg.x, bHead.y - seg.y) < 12) {
                    botDied = true;
                  }
                });
              }
            });
          }

          if (botDied) {
            // Explode bot into food
            bot.segments.forEach((seg, index) => {
              if (index % 2 === 0) {
                spawnFood(1, bot.color, seg, 20);
              }
            });
            explodeSnake(bot.segments, bot.color);
            bot.id = 'DEAD'; // Mark for filter
          }
        });
        botsRef.current = botsRef.current.filter((b) => b.id !== 'DEAD');

        // Check Win/Lose Condition
        if (sharedScoreRef.current >= TARGET_SCORE && timerRef.current > 0) {
          setGameWon(true);
          sendGameEvent({ type: 'victory_confetti' });
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 }
          });
        } else if (timerRef.current <= 0 && sharedScoreRef.current < TARGET_SCORE) {
          setGameOver(true);
        }

        // Host updates metrics and broadcasts state
        setScore(sharedScoreRef.current);

        const now = Date.now();
        if (now - lastSyncTimeRef.current > 45) { // sync throttle (approx 20fps network rate)
          sendGameData({
            player: {
              segments: p1.segments,
              angle: p1.angle,
              isBoosting: p1.isBoosting,
              active: p1.active,
              invulnerableTimer: p1.invulnerableTimer
            },
            bots: botsRef.current,
            food: foodRef.current,
            metrics: {
              score: sharedScoreRef.current,
              p1Score: p1.score,
              p2Score: p2.score,
              time: timerRef.current
            },
            status: {
              gameOver: sharedScoreRef.current < TARGET_SCORE && timerRef.current <= 0,
              gameWon: sharedScoreRef.current >= TARGET_SCORE
            }
          });
          lastSyncTimeRef.current = now;
        }
      }
    };

    const spawnEatParticles = (x: number, y: number, color: string) => {
      for (let i = 0; i < 4; i++) {
        const pAngle = Math.random() * Math.PI * 2;
        const pSpeed = 0.5 + Math.random() * 1.5;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(pAngle) * pSpeed,
          vy: Math.sin(pAngle) * pSpeed,
          size: 1.5 + Math.random() * 2,
          color,
          life: 0,
          maxLife: 10 + Math.random() * 10
        });
      }
    };

    // Rendering
    const drawGame = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Calculate camera translation offsets (centering on local player head)
      const localSnake = localPlayerRef.current;
      const head = localSnake.active && localSnake.segments[0] ? localSnake.segments[0] : { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
      
      const cameraX = head.x - CANVAS_WIDTH / 2;
      const cameraY = head.y - CANVAS_HEIGHT / 2;

      // Draw background flat color on the screen first
      ctx.fillStyle = '#05060b';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Apply camera translation for all world entities
      ctx.save();
      ctx.translate(-cameraX, -cameraY);

      // Draw Grid lines over MAP_WIDTH and MAP_HEIGHT
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= MAP_WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, MAP_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y <= MAP_HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(MAP_WIDTH, y);
        ctx.stroke();
      }

      // Border bounds around MAP_WIDTH and MAP_HEIGHT
      ctx.strokeStyle = 'rgba(57, 255, 20, 0.25)'; // Neon Green border
      ctx.lineWidth = 6;
      ctx.strokeRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

      // 2. Draw Food Pellets
      foodRef.current.forEach((food) => {
        ctx.fillStyle = food.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = food.color;
        ctx.beginPath();
        ctx.arc(food.x, food.y, food.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowBlur = 0; // reset glow

      // 3. Draw Particles
      particlesRef.current.forEach((p) => {
        const opacity = 1 - p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = opacity;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0; // reset

      // 4. Draw AI Opponent Bots
      botsRef.current.forEach((bot) => {
        // Draw trailing segments
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(20, 20, 20, 0.5)';
        ctx.beginPath();
        bot.segments.forEach((seg, idx) => {
          if (idx === 0) ctx.moveTo(seg.x, seg.y);
          else ctx.lineTo(seg.x, seg.y);
        });
        ctx.stroke();

        // Draw body coordinates
        bot.segments.forEach((seg, idx) => {
          if (idx === 0) return; // skip head
          const scale = 1 - (idx / bot.segments.length) * 0.5;
          ctx.fillStyle = bot.color;
          ctx.beginPath();
          ctx.arc(seg.x, seg.y, 7 * scale, 0, Math.PI * 2);
          ctx.fill();
        });

        // Draw Bot head
        const bHead = bot.segments[0];
        if (bHead) {
          ctx.fillStyle = bot.color;
          ctx.shadowBlur = 10;
          ctx.shadowColor = bot.color;
          ctx.beginPath();
          ctx.arc(bHead.x, bHead.y, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Draw Bot eyes
          ctx.fillStyle = '#000000';
          const leftEyeX = bHead.x + Math.cos(bot.angle - 0.5) * 5;
          const leftEyeY = bHead.y + Math.sin(bot.angle - 0.5) * 5;
          const rightEyeX = bHead.x + Math.cos(bot.angle + 0.5) * 5;
          const rightEyeY = bHead.y + Math.sin(bot.angle + 0.5) * 5;
          ctx.beginPath();
          ctx.arc(leftEyeX, leftEyeY, 2, 0, Math.PI * 2);
          ctx.arc(rightEyeX, rightEyeY, 2, 0, Math.PI * 2);
          ctx.fill();

          // Label above bot
          ctx.fillStyle = '#ffffff';
          ctx.font = '8px Orbitron';
          ctx.textAlign = 'center';
          ctx.fillText(bot.name, bHead.x, bHead.y - 15);
        }
      });

      // 5. Draw Player Snakes
      const drawPlayerSnake = (snake: PlayerSnake, bodyColor: string, headColor: string, label: string) => {
        if (!snake.active || snake.segments.length === 0) return;

        const isInvulnerable = snake.invulnerableTimer > 0;
        // Flashing effect if invulnerable
        if (isInvulnerable && Math.floor(Date.now() / 100) % 2 === 0) {
          return;
        }

        ctx.save();
        if (isInvulnerable) {
          ctx.globalAlpha = 0.55;
        }

        // Draw trail background shadow
        ctx.lineWidth = 16;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(10, 10, 20, 0.45)';
        ctx.beginPath();
        snake.segments.forEach((seg, idx) => {
          if (idx === 0) ctx.moveTo(seg.x, seg.y);
          else ctx.lineTo(seg.x, seg.y);
        });
        ctx.stroke();

        // Draw body segments
        snake.segments.forEach((seg, idx) => {
          if (idx === 0) return; // skip head
          const scale = 1 - (idx / snake.segments.length) * 0.55;
          ctx.fillStyle = bodyColor;
          ctx.beginPath();
          ctx.arc(seg.x, seg.y, 8 * scale, 0, Math.PI * 2);
          ctx.fill();

          // Draw little internal core glowing circles
          ctx.fillStyle = headColor;
          ctx.beginPath();
          ctx.arc(seg.x, seg.y, 2.5 * scale, 0, Math.PI * 2);
          ctx.fill();
        });

        // Draw Head
        const headNode = snake.segments[0];
        ctx.fillStyle = headColor;
        ctx.shadowBlur = snake.isBoosting ? 15 : 8;
        ctx.shadowColor = headColor;
        ctx.beginPath();
        ctx.arc(headNode.x, headNode.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Draw player eyes pointing in direction of angle
        ctx.fillStyle = '#000000';
        const leftEyeX = headNode.x + Math.cos(snake.angle - 0.4) * 5;
        const leftEyeY = headNode.y + Math.sin(snake.angle - 0.4) * 5;
        const rightEyeX = headNode.x + Math.cos(snake.angle + 0.4) * 5;
        const rightEyeY = headNode.y + Math.sin(snake.angle + 0.4) * 5;
        ctx.beginPath();
        ctx.arc(leftEyeX, leftEyeY, 2.5, 0, Math.PI * 2);
        ctx.arc(rightEyeX, rightEyeY, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Visor glow indicator
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(leftEyeX + Math.cos(snake.angle) * 0.8, leftEyeY + Math.sin(snake.angle) * 0.8, 0.8, 0, Math.PI * 2);
        ctx.arc(rightEyeX + Math.cos(snake.angle) * 0.8, rightEyeY + Math.sin(snake.angle) * 0.8, 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Label above player
        ctx.fillStyle = '#ffffff';
        ctx.font = '9px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText(label, headNode.x, headNode.y - 16);

        ctx.restore();
      };

      // Draw Host and Client snakes
      const p1 = isHost ? localPlayerRef.current : remotePlayerRef.current;
      const p2 = isHost ? remotePlayerRef.current : localPlayerRef.current;

      drawPlayerSnake(p1, '#0b2636', '#00f0ff', isHost ? 'YOU' : 'P1');
      drawPlayerSnake(p2, '#33081e', '#ff007f', !isHost ? 'YOU' : 'P2');

      ctx.restore();
    };

    const gameLoop = () => {
      updatePhysics();
      drawGame();
      animationId = requestAnimationFrame(gameLoop);
    };

    // Authoritative host timer countdown
    if (isHost && isConnected && !gameOver && !gameWon) {
      timerInterval = setInterval(() => {
        timerRef.current = Math.max(0, timerRef.current - 1);
        setTimeRemaining(timerRef.current);
      }, 1000);
    }

    if (isConnected) {
      gameLoop();
    }

    return () => {
      cancelAnimationFrame(animationId);
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [isConnected, isHost, gameOver, gameWon]);

  // Host listens for client respawn notifications
  useEffect(() => {
    if (isHost && gameData && gameData.type === 'game_event' && gameData.payload?.type === 'respawn') {
      // Re-enable client snake active flag autoritatively
      remotePlayerRef.current.active = true;
      remotePlayerRef.current.invulnerableTimer = 180;
      remotePlayerRef.current.score = 0;
    }
  }, [gameData, isHost]);

  const getLeaderboard = () => {
    const list: { name: string; score: number; isLocal: boolean; isRemote: boolean }[] = [];
    
    // Add local player
    list.push({
      name: isHost ? 'You (P1)' : 'You (P2)',
      score: localPlayerRef.current.score,
      isLocal: true,
      isRemote: false
    });

    // Add remote player
    if (isConnected && remotePlayerRef.current.active) {
      list.push({
        name: isHost ? 'P2 (Client)' : 'P1 (Host)',
        score: remotePlayerRef.current.score,
        isLocal: false,
        isRemote: true
      });
    }

    // Add bots
    botsRef.current.forEach((bot) => {
      list.push({
        name: bot.name,
        score: bot.segments.length * 10,
        isLocal: false,
        isRemote: false
      });
    });

    // Sort descending by score
    list.sort((a, b) => b.score - a.score);

    // Limit to top 5
    return list.slice(0, 5);
  };

  return (
    <div className="game-main-content">
      {/* Game Header Metrics Panel */}
      <div className="game-header-bar glass-panel" style={{ width: '100%', maxWidth: '900px' }}>
        <h2 className="game-title-text font-display">
          TARGET: <span className="text-green">{TARGET_SCORE} PTS</span>
        </h2>

        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div className="peer-badge" style={{ borderColor: 'var(--neon-cyan)', color: 'var(--neon-cyan)', gap: '0.4rem' }}>
            <Trophy size={14} />
            <span>Score: {score}</span>
          </div>

          <div className="peer-badge" style={{ borderColor: 'var(--neon-magenta)', color: 'var(--neon-magenta)', gap: '0.4rem' }}>
            <Clock size={14} />
            <span>Time: {timeRemaining}s</span>
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="canvas-container" style={{ cursor: 'crosshair', position: 'relative' }}>
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />

        {/* Score Board / Leaderboard Overlay */}
        <div 
          className="glass-panel" 
          style={{ 
            position: 'absolute', 
            top: '15px', 
            right: '15px', 
            padding: '10px 15px', 
            minWidth: '160px', 
            fontSize: '0.8rem', 
            pointerEvents: 'none',
            background: 'rgba(5, 6, 11, 0.75)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            boxShadow: 'var(--glass-glow)',
            zIndex: 10
          }}
        >
          <h4 style={{ margin: '0 0 8px 0', fontFamily: 'var(--font-display)', color: 'var(--neon-green)', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '4px', fontSize: '0.85rem', letterSpacing: '1px', textAlign: 'left' }}>
            LEADERBOARD
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
            {getLeaderboard().map((entry, idx) => (
              <div 
                key={idx} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  gap: '1rem',
                  fontWeight: entry.isLocal ? 'bold' : 'normal',
                  color: entry.isLocal ? 'var(--neon-cyan)' : entry.isRemote ? 'var(--neon-magenta)' : 'var(--text-secondary)'
                }}
              >
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '100px' }}>
                  {idx + 1}. {entry.name}
                </span>
                <span>{entry.score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Player Dead Respawning Overlay */}
        {isDead && (
          <div className="canvas-overlay" style={{ background: 'rgba(5, 6, 11, 0.85)' }}>
            <h2 className="overlay-title font-display text-magenta" style={{ fontSize: '2.5rem' }}>EXPLODED!</h2>
            <p style={{ color: 'var(--text-secondary)' }}>You crashed into a snake body or wall.</p>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Zap size={28} className="text-yellow status-dot connecting" />
              <p style={{ color: 'var(--neon-yellow)', fontWeight: 600 }}>Respawning in {respawnCounter}s...</p>
            </div>
          </div>
        )}

        {/* Defeat Screen Overlay */}
        {gameOver && (
          <div className="canvas-overlay">
            <h2 className="overlay-title font-display text-magenta" style={{ fontSize: '3rem' }}>MISSION FAILED</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Time ran out before achieving the target score.</p>
            <p style={{ color: 'var(--neon-green)', fontWeight: 700 }}>Combined Score: {score} / {TARGET_SCORE} pts</p>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              {isHost && (
                <button className="glow-btn-cyan font-display" onClick={handleRestart} style={{ padding: '0.8rem 2rem' }}>
                  Try Again
                </button>
              )}
              <button className="glow-btn-magenta font-display" onClick={stopGame} style={{ padding: '0.8rem 2rem' }}>
                Back to Lobby
              </button>
            </div>
          </div>
        )}

        {/* Victory Screen Overlay */}
        {gameWon && (
          <div className="canvas-overlay">
            <h2 className="overlay-title font-display text-green" style={{ fontSize: '3.5rem', letterSpacing: '3px' }}>VICTORY!</h2>
            <p style={{ color: 'var(--neon-green)', fontWeight: 700, fontSize: '1.2rem' }}>Combined target score surpassed!</p>
            <p style={{ color: 'var(--text-secondary)', marginTop: '-0.5rem' }}>Final Score: {score} pts (Target: {TARGET_SCORE} pts)</p>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              {isHost && (
                <button className="glow-btn-cyan font-display" onClick={handleRestart} style={{ padding: '0.8rem 2rem' }}>
                  Play Again
                </button>
              )}
              <button className="glow-btn-magenta font-display" onClick={stopGame} style={{ padding: '0.8rem 2rem' }}>
                Back to Lobby
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Control Guide Helper Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '900px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        <div>
          <span>Steer: </span><span style={{ color: 'var(--text-primary)' }}>Mouse Cursor</span> or <span className="control-key">WASD</span> | <span>Boost: </span><span style={{ color: 'var(--text-primary)' }}>Left Click</span> or <span className="control-key">Space</span>
        </div>
        <div>
          <span>Avoid: </span><span style={{ color: 'var(--neon-magenta)', fontWeight: 600 }}>Snake Bodies & Borders</span>
        </div>
      </div>
    </div>
  );
};
