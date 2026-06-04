import React, { useEffect, useRef, useState } from 'react';
import { usePeer } from '../../context/PeerContext';
import { Shield, Flag, Award } from 'lucide-react';
import confetti from 'canvas-confetti';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 480;
const GRAVITY = 0.5;
const WALK_SPEED = 3.6;
const JUMP_FORCE = -10.5;

const MAX_CHAIN_LENGTH = 140; // Max distance players can move apart
const SPRING_CONSTANT = 0.06; // Pull velocity force strength
const POSITION_SNAP_THRESHOLD = 150; // Hard snap threshold

interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isJumping: boolean;
  width: number;
  height: number;
  grounded: boolean;
}

interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  isCheckpoint?: boolean;
  checkpointLabel?: string;
  checkpointId?: number;
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

// Slabs structure (Tower height going from y = 440 to y = -1420)
const PLATFORMS: Platform[] = [
  // Bottom floor - Camp 1
  { x: -100, y: 440, w: 1000, h: 40, isCheckpoint: true, checkpointLabel: 'CAMP 1: BASE CAMP', checkpointId: 0 },
  
  // Low Slabs
  { x: 320, y: 340, w: 160, h: 16 },
  { x: 100, y: 250, w: 180, h: 16 },
  { x: 520, y: 250, w: 180, h: 16 },
  { x: 300, y: 150, w: 200, h: 16 },
  { x: 80, y: 50, w: 180, h: 16 },
  { x: 540, y: 50, w: 180, h: 16 },
  
  // Camp 2 (Checkpoint Middle)
  { x: 200, y: -50, w: 400, h: 24, isCheckpoint: true, checkpointLabel: 'CAMP 2: RIFT BRIDGE', checkpointId: 1 },

  // Mid Slabs
  { x: 100, y: -150, w: 160, h: 16 },
  { x: 540, y: -150, w: 160, h: 16 },
  { x: 320, y: -250, w: 160, h: 16 },
  { x: 80, y: -350, w: 180, h: 16 },
  { x: 540, y: -350, w: 180, h: 16 },
  { x: 280, y: -450, w: 240, h: 16 },
  { x: 100, y: -550, w: 160, h: 16 },
  { x: 540, y: -550, w: 160, h: 16 },
  { x: 300, y: -650, w: 200, h: 16 },

  // Camp 3 (Checkpoint Upper)
  { x: 150, y: -750, w: 500, h: 24, isCheckpoint: true, checkpointLabel: 'CAMP 3: HIGHLAND WATCHTOWER', checkpointId: 2 },

  // High Slabs
  { x: 80, y: -850, w: 180, h: 16 },
  { x: 540, y: -850, w: 180, h: 16 },
  { x: 330, y: -950, w: 140, h: 16 },
  { x: 100, y: -1050, w: 180, h: 16 },
  { x: 520, y: -1050, w: 180, h: 16 },
  { x: 280, y: -1150, w: 240, h: 16 },
  { x: 60, y: -1250, w: 160, h: 16 },
  { x: 580, y: -1250, w: 160, h: 16 },
  { x: 350, y: -1330, w: 100, h: 16 },

  // Exit portal platform
  { x: 200, y: -1430, w: 400, h: 30 }
];

const CHECKPOINTS = [
  { id: 0, label: 'CAMP 1: BASE CAMP', y: 440, p1: { x: 320, y: 390 }, p2: { x: 440, y: 390 }, deathY: 530 },
  { id: 1, label: 'CAMP 2: RIFT BRIDGE', y: -50, p1: { x: 320, y: -100 }, p2: { x: 440, y: -100 }, deathY: 130 },
  { id: 2, label: 'CAMP 3: HIGHLAND WATCHTOWER', y: -750, p1: { x: 320, y: -800 }, p2: { x: 440, y: -800 }, deathY: -570 }
];

export const ChainedGame: React.FC = () => {
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

  // Game UI States
  const [activeCheckpoint, setActiveCheckpoint] = useState<number>(0);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [gameWon, setGameWon] = useState<boolean>(false);

  // Controls input refs
  const keysRef = useRef<{ [key: string]: boolean }>({});

  // Local physical states
  const localPlayerRef = useRef<PlayerState>({
    x: 320,
    y: 390,
    vx: 0,
    vy: 0,
    width: 24,
    height: 32,
    isJumping: false,
    grounded: false
  });

  const remotePlayerRef = useRef<PlayerState>({
    x: 440,
    y: 390,
    vx: 0,
    vy: 0,
    width: 24,
    height: 32,
    isJumping: false,
    grounded: false
  });

  // Entity visual effects
  const particlesRef = useRef<Particle[]>([]);
  const currentCheckpointRef = useRef<number>(0);

  // Initialize controls and starting positions
  useEffect(() => {
    // Reset players to base camp positions
    localPlayerRef.current = {
      x: isHost ? 320 : 440,
      y: 390,
      vx: 0,
      vy: 0,
      width: 24,
      height: 32,
      isJumping: false,
      grounded: false
    };

    remotePlayerRef.current = {
      x: isHost ? 440 : 320,
      y: 390,
      vx: 0,
      vy: 0,
      width: 24,
      height: 32,
      isJumping: false,
      grounded: false
    };

    currentCheckpointRef.current = 0;
    setActiveCheckpoint(0);
    setGameOver(false);
    setGameWon(false);
    particlesRef.current = [];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      keysRef.current[e.key] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isHost]);

  // Sync P2P message handlers
  useEffect(() => {
    if (!gameData) return;

    if (!isHost) {
      // Client receives remote player (Host) pos and authoritative game status
      if (gameData.player) {
        remotePlayerRef.current.x = gameData.player.x;
        remotePlayerRef.current.y = gameData.player.y;
        remotePlayerRef.current.vx = gameData.player.vx;
        remotePlayerRef.current.vy = gameData.player.vy;
        remotePlayerRef.current.isJumping = gameData.player.isJumping;
      }
      if (gameData.checkpointIdx !== undefined) {
        currentCheckpointRef.current = gameData.checkpointIdx;
        setActiveCheckpoint(gameData.checkpointIdx);
      }
      if (gameData.status) {
        setGameOver(gameData.status.gameOver);
        setGameWon(gameData.status.gameWon);
      }
    } else {
      // Host receives Client position
      if (gameData.player) {
        remotePlayerRef.current.x = gameData.player.x;
        remotePlayerRef.current.y = gameData.player.y;
        remotePlayerRef.current.vx = gameData.player.vx;
        remotePlayerRef.current.vy = gameData.player.vy;
        remotePlayerRef.current.isJumping = gameData.player.isJumping;
      }
    }
  }, [gameData, isHost]);

  // Sync game events
  useEffect(() => {
    if (!gameEvent) return;

    if (gameEvent.type === 'respawn_checkpoint') {
      const idx = gameEvent.checkpointIdx;
      currentCheckpointRef.current = idx;
      setActiveCheckpoint(idx);
      
      const spawnP1 = CHECKPOINTS[idx].p1;
      const spawnP2 = CHECKPOINTS[idx].p2;

      // Reset coordinates locally
      const local = localPlayerRef.current;
      local.x = isHost ? spawnP1.x : spawnP2.x;
      local.y = isHost ? spawnP1.y : spawnP2.y;
      local.vx = 0;
      local.vy = 0;
      local.isJumping = false;

      const remote = remotePlayerRef.current;
      remote.x = isHost ? spawnP2.x : spawnP1.x;
      remote.y = isHost ? spawnP2.y : spawnP1.y;
      remote.vx = 0;
      remote.vy = 0;
      remote.isJumping = false;

      // Add respawn particles
      spawnParticles(local.x + 12, local.y + 16, 'var(--neon-green)', 20);
      spawnParticles(remote.x + 12, remote.y + 16, 'var(--neon-green)', 20);
    } else if (gameEvent.type === 'win_confetti') {
      setGameWon(true);
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

  const spawnParticles = (x: number, y: number, color: string, count = 10) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        color,
        life: 0,
        maxLife: 20 + Math.random() * 15
      });
    }
  };

  const handleRestartLocal = () => {
    localPlayerRef.current = {
      x: isHost ? 320 : 440,
      y: 390,
      vx: 0,
      vy: 0,
      width: 24,
      height: 32,
      isJumping: false,
      grounded: false
    };

    remotePlayerRef.current = {
      x: isHost ? 440 : 320,
      y: 390,
      vx: 0,
      vy: 0,
      width: 24,
      height: 32,
      isJumping: false,
      grounded: false
    };

    currentCheckpointRef.current = 0;
    setActiveCheckpoint(0);
    setGameOver(false);
    setGameWon(false);
    particlesRef.current = [];
  };

  const handleRestart = () => {
    if (!isHost) return;
    handleRestartLocal();
    sendGameEvent({ type: 'reset_game' });
  };

  // Main game loop & Physics
  useEffect(() => {
    let animationId: number;

    // Platform landing AABB check
    const checkCollisions = (p: PlayerState) => {
      let grounded = false;

      PLATFORMS.forEach((plat) => {
        const overlapX = p.x + p.width > plat.x && p.x < plat.x + plat.w;
        const overlapY = p.y + p.height >= plat.y && p.y < plat.y + plat.h;

        if (overlapX && overlapY) {
          // Landing from top
          if (p.vy > 0 && p.y + p.height - p.vy <= plat.y + 4) {
            p.y = plat.y - p.height;
            p.vy = 0;
            p.isJumping = false;
            grounded = true;
          }
          // Hitting ceiling from bottom
          else if (p.vy < 0 && p.y - p.vy >= plat.y + plat.h - 4) {
            p.y = plat.y + plat.h;
            p.vy = 0;
          }
        }
      });

      return grounded;
    };

    const updatePhysics = () => {
      if (gameOver || gameWon) return;

      // Update local particles
      particlesRef.current.forEach((part) => {
        part.x += part.vx;
        part.y += part.vy;
        part.life++;
      });
      particlesRef.current = particlesRef.current.filter((part) => part.life < part.maxLife);

      const p1 = isHost ? localPlayerRef.current : remotePlayerRef.current;
      const p2 = isHost ? remotePlayerRef.current : localPlayerRef.current;
      const local = localPlayerRef.current;

      // --- LOCAL MOVEMENT ---
      local.vx = 0;
      if (keysRef.current['a'] || keysRef.current['A'] || keysRef.current['ArrowLeft']) {
        local.vx = -WALK_SPEED;
      }
      if (keysRef.current['d'] || keysRef.current['D'] || keysRef.current['ArrowRight']) {
        local.vx = WALK_SPEED;
      }
      if ((keysRef.current['w'] || keysRef.current['W'] || keysRef.current['ArrowUp'] || keysRef.current[' ']) && !local.isJumping && local.grounded) {
        local.vy = JUMP_FORCE;
        local.isJumping = true;
        local.grounded = false;
        spawnParticles(local.x + 12, local.y + 32, 'rgba(255, 255, 255, 0.4)', 6);
      }

      // Apply Gravity
      local.vy += GRAVITY;

      // Collision checks - X movement
      local.x += local.vx;
      local.x = Math.max(10, Math.min(CANVAS_WIDTH - 10 - local.width, local.x));

      // Collision checks - Y movement
      local.y += local.vy;
      local.grounded = checkCollisions(local);
      if (local.grounded) {
        local.isJumping = false;
      }

      // --- SPRING CONSTRAINT CALCULATIONS ---
      // We calculate spring pulling force based on the distance between players
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy);

      if (dist > MAX_CHAIN_LENGTH) {
        const pullForce = (dist - MAX_CHAIN_LENGTH) * SPRING_CONSTANT;
        const nx = dx / dist;
        const ny = dy / dist;

        // Apply spring pull to velocities
        if (isHost) {
          p1.vx += nx * pullForce;
          p1.vy += ny * pullForce;
        } else {
          p2.vx -= nx * pullForce;
          p2.vy -= ny * pullForce;
        }

        // Snap constraint (prevents infinite desync separation)
        const overshoot = dist - POSITION_SNAP_THRESHOLD;
        if (overshoot > 0) {
          const snapX = nx * overshoot * 0.5;
          const snapY = ny * overshoot * 0.5;
          
          if (isHost) {
            p1.x += snapX;
            p1.y += snapY;
          } else {
            p2.x -= snapX;
            p2.y -= snapY;
          }
        }
      }

      // --- Sync player state to peer ---
      if (!isHost) {
        sendGameData({
          player: {
            x: local.x,
            y: local.y,
            vx: local.vx,
            vy: local.vy,
            isJumping: local.isJumping
          }
        });
      } else {
        // --- HOST AUTHORITATIVE RULES ---
        // 1. Update Checkpoint Index
        const midpointY = (p1.y + p2.y) / 2;
        CHECKPOINTS.forEach((checkpoint) => {
          if (midpointY < checkpoint.y && checkpoint.id > currentCheckpointRef.current) {
            currentCheckpointRef.current = checkpoint.id;
            setActiveCheckpoint(checkpoint.id);
            // Spawn trigger particle effect
            spawnParticles(checkpoint.p1.x + 50, checkpoint.y, 'var(--neon-green)', 25);
          }
        });

        // 2. Check Abyss / Fall Death Condition
        const activeCp = CHECKPOINTS[currentCheckpointRef.current];
        if (p1.y > activeCp.deathY || p2.y > activeCp.deathY) {
          // Reset players to active checkpoint
          sendGameEvent({ type: 'respawn_checkpoint', checkpointIdx: currentCheckpointRef.current });
          
          // Re-trigger locally for host
          const spawnP1 = activeCp.p1;
          const spawnP2 = activeCp.p2;
          p1.x = spawnP1.x; p1.y = spawnP1.y; p1.vx = 0; p1.vy = 0; p1.isJumping = false;
          p2.x = spawnP2.x; p2.y = spawnP2.y; p2.vx = 0; p2.vy = 0; p2.isJumping = false;
          spawnParticles(p1.x + 12, p1.y + 16, 'var(--neon-green)', 20);
          spawnParticles(p2.x + 12, p2.y + 16, 'var(--neon-green)', 20);
        }

        // 3. Check Portal Win Condition
        // Top exit platform is at y = -1430. Portal is at x = 370-430
        const portalX = 400;
        const portalY = -1430;
        const p1NearPortal = Math.abs(p1.x + 12 - portalX) < 40 && Math.abs(p1.y + 32 - portalY) < 15;
        const p2NearPortal = Math.abs(p2.x + 12 - portalX) < 40 && Math.abs(p2.y + 32 - portalY) < 15;

        if (p1NearPortal && p2NearPortal && !gameWon) {
          setGameWon(true);
          sendGameEvent({ type: 'win_confetti' });
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 }
          });
        }

        // Send full sync down to client
        sendGameData({
          player: {
            x: local.x,
            y: local.y,
            vx: local.vx,
            vy: local.vy,
            isJumping: local.isJumping
          },
          checkpointIdx: currentCheckpointRef.current,
          status: {
            gameOver: false,
            gameWon: midpointY < -1420 && p1NearPortal && p2NearPortal
          }
        });
      }
    };

    // Rendering Engine
    const drawGame = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const p1 = isHost ? localPlayerRef.current : remotePlayerRef.current;
      const p2 = isHost ? remotePlayerRef.current : localPlayerRef.current;

      // Camera: follows players midpoint vertically
      const midY = (p1.y + p2.y) / 2;
      let cameraY = midY - CANVAS_HEIGHT / 2;
      // Clamp camera so it doesn't go below the bottom floor or way above map top
      cameraY = Math.max(-1500, Math.min(220, cameraY));

      // 1. Draw Space Gradient Background
      ctx.fillStyle = '#05060b';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Grid line guides (scrolling vertically with camera)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
      ctx.lineWidth = 1;
      const gridOffset = -cameraY % 40;
      for (let y = gridOffset; y < CANVAS_HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }
      for (let x = 0; x < CANVAS_WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }

      // Border outline shaft
      ctx.strokeStyle = 'rgba(157, 78, 221, 0.25)'; // Neon Purple borders
      ctx.lineWidth = 6;
      ctx.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Apply camera translation for game objects
      ctx.save();
      ctx.translate(0, -cameraY);

      // 2. Draw Checkpoint Lines
      CHECKPOINTS.forEach((cp) => {
        const isActive = currentCheckpointRef.current >= cp.id;
        ctx.strokeStyle = isActive ? 'rgba(57, 255, 20, 0.35)' : 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, cp.y);
        ctx.lineTo(CANVAS_WIDTH, cp.y);
        ctx.stroke();

        // Label above line
        ctx.fillStyle = isActive ? 'var(--neon-green)' : 'var(--text-muted)';
        ctx.font = '8px Orbitron';
        ctx.textAlign = 'left';
        ctx.fillText(cp.label, 20, cp.y - 6);
      });

      // 3. Draw Slabs / Platforms
      PLATFORMS.forEach((plat) => {
        if (plat.isCheckpoint) {
          // Draw Neon Green slab for Camps
          const active = currentCheckpointRef.current >= (plat.checkpointId ?? 0);
          ctx.fillStyle = active ? 'rgba(57, 255, 20, 0.15)' : 'rgba(255, 255, 255, 0.03)';
          ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
          ctx.strokeStyle = active ? 'var(--neon-green)' : 'rgba(255, 255, 255, 0.1)';
          ctx.lineWidth = 2;
          ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
        } else {
          // Standard glass platforms
          ctx.fillStyle = 'rgba(22, 24, 44, 0.85)';
          ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
          ctx.strokeStyle = 'rgba(157, 78, 221, 0.35)'; // Purple glass border
          ctx.lineWidth = 1;
          ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
        }
      });

      // 4. Draw exit portal (Top of tower)
      const portalX = 400;
      const portalY = -1430;
      // Pulsing portal ring
      const pulseSize = 25 + Math.sin(Date.now() / 150) * 4;
      ctx.shadowBlur = 15;
      ctx.shadowColor = 'var(--neon-yellow)';
      ctx.strokeStyle = 'var(--neon-yellow)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(portalX, portalY - 25, pulseSize, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0; // reset

      // Portal base/stand
      ctx.fillStyle = '#ffea00';
      ctx.fillRect(portalX - 20, portalY, 40, 4);

      // 5. Draw Particles
      particlesRef.current.forEach((part) => {
        const opacity = 1 - part.life / part.maxLife;
        ctx.fillStyle = part.color;
        ctx.globalAlpha = opacity;
        ctx.beginPath();
        ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0; // reset

      // 6. Draw Chain Links connecting P1 and P2
      const p1Center = { x: p1.x + 12, y: p1.y + 16 };
      const p2Center = { x: p2.x + 12, y: p2.y + 16 };
      const chainDx = p2Center.x - p1Center.x;
      const chainDy = p2Center.y - p1Center.y;
      const chainDist = Math.hypot(chainDx, chainDy);

      const linkCount = 14;
      for (let i = 1; i < linkCount; i++) {
        const t = i / linkCount;
        let lx = p1Center.x + chainDx * t;
        let ly = p1Center.y + chainDy * t;

        // Catenary sag sine wave
        const sag = Math.sin(t * Math.PI) * 20 * Math.max(0, 1 - chainDist / (MAX_CHAIN_LENGTH * 1.15));
        ly += sag;

        // Draw steel link ring
        ctx.fillStyle = '#8e9aaf';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(lx, ly, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // 7. Draw Players
      const drawSpacesuitPlayer = (p: PlayerState, baseColor: string, accentColor: string, label: string) => {
        ctx.save();
        ctx.translate(p.x + p.width / 2, p.y + p.height / 2);

        // Visor/Dome glow
        ctx.shadowBlur = 8;
        ctx.shadowColor = accentColor;

        // Body suit
        ctx.fillStyle = baseColor;
        ctx.fillRect(-p.width / 2, -p.height / 2 + 10, p.width, p.height - 18);

        // Helmet Dome
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(0, -p.height / 2 + 10, 11, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Visor glass
        ctx.fillStyle = accentColor;
        ctx.fillRect(-4, -p.height / 2 + 4, 8, 5);

        // Legs
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-8, p.height / 2 - 8, 4, 8);
        ctx.fillRect(4, p.height / 2 - 8, 4, 8);

        ctx.restore();

        // Label tag
        ctx.fillStyle = '#ffffff';
        ctx.font = '9px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText(label, p.x + p.width / 2, p.y - 12);
      };

      drawSpacesuitPlayer(p1, '#00e1ff', 'rgba(0, 240, 255, 0.85)', isHost ? 'YOU' : 'P1');
      drawSpacesuitPlayer(p2, '#ff00a0', 'rgba(255, 0, 127, 0.85)', !isHost ? 'YOU' : 'P2');

      ctx.restore();
    };

    const gameLoop = () => {
      updatePhysics();
      drawGame();
      animationId = requestAnimationFrame(gameLoop);
    };

    if (isConnected) {
      gameLoop();
    }

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isConnected, isHost, gameOver, gameWon]);

  return (
    <div className="game-main-content">
      {/* Game Header Bar */}
      <div className="game-header-bar glass-panel" style={{ width: '100%', maxWidth: '900px' }}>
        <h2 className="game-title-text font-display">
          HEIGHTS CLIMB: <span className="text-purple">TOWER ASCENT</span>
        </h2>

        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div className="peer-badge" style={{ borderColor: 'var(--neon-green)', color: 'var(--neon-green)', gap: '0.4rem' }}>
            <Shield size={14} />
            <span>{CHECKPOINTS[activeCheckpoint]?.label || 'BASE CAMP'}</span>
          </div>

          <div className="peer-badge" style={{ borderColor: 'var(--neon-purple)', color: 'var(--neon-purple)', gap: '0.4rem' }}>
            <Flag size={14} />
            <span>Target: Portal</span>
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="canvas-container" style={{ position: 'relative' }}>
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />

        {/* Victory Screen Overlay */}
        {gameWon && (
          <div className="canvas-overlay">
            <Award size={64} className="text-yellow" style={{ marginBottom: '1rem', filter: 'drop-shadow(0 0 10px var(--neon-yellow))' }} />
            <h2 className="overlay-title font-display text-green" style={{ fontSize: '3.5rem', letterSpacing: '3px' }}>ASCENDED!</h2>
            <p style={{ color: 'var(--neon-green)', fontWeight: 700, fontSize: '1.2rem' }}>You completed the climb together!</p>
            <p style={{ color: 'var(--text-secondary)', marginTop: '-0.5rem' }}>Perfect cooperation and chain physics control.</p>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              {isHost && (
                <button className="glow-btn-cyan font-display" onClick={handleRestart} style={{ padding: '0.8rem 2rem' }}>
                  Restart Climb
                </button>
              )}
              <button className="glow-btn-magenta font-display" onClick={stopGame} style={{ padding: '0.8rem 2rem' }}>
                Back to Lobby
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Helper Controls bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '900px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        <div>
          <span>Walk: </span><span style={{ color: 'var(--text-primary)' }}>A / D</span> or <span style={{ color: 'var(--text-primary)' }}>← / →</span> | <span>Jump: </span><span style={{ color: 'var(--text-primary)' }}>W / Space</span> or <span style={{ color: 'var(--text-primary)' }}>↑</span>
        </div>
        <div>
          <span>Rule: </span><span style={{ color: 'var(--neon-purple)', fontWeight: 600 }}>Stay within 140px chain limit</span>
        </div>
      </div>
    </div>
  );
};
