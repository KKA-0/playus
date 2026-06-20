import React, { useEffect, useRef, useState } from 'react';
import { usePeer } from '../../context/PeerContext';
import { Play } from 'lucide-react';
import confetti from 'canvas-confetti';

// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 480;
const TILE_SIZE = 40;
const ROWS = CANVAS_HEIGHT / TILE_SIZE; // 12
const COLS = CANVAS_WIDTH / TILE_SIZE; // 20

const GRAVITY = 0.6;
const WALK_SPEED = 4;
const JUMP_FORCE = -11.5;

// Tile types
const TILE_SOLID = 1;
const TILE_SPIKES = 2;
const TILE_KEY = 3;
const TILE_EXIT = 4;
const TILE_GATE = 5;
const TILE_SWITCH = 6;

// 3 Levels Map Data (12 rows x 20 cols)
// 1 = solid block, 2 = spikes, 3 = key, 4 = portal, 5 = gate, 6 = switch
const LEVELS = [
  // LEVEL 1: Introduction to cooperation
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,1],
    [1,4,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,3,0,1],
    [1,0,0,0,6,0,0,0,5,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ],
  // LEVEL 2: Double split paths
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,4,1],
    [1,0,0,0,0,0,5,0,0,0,0,0,0,1,0,0,0,0,0,1],
    [1,1,1,1,0,1,1,1,0,0,6,0,1,1,1,0,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,5,1,1,1,1,1,1,1,0,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ],
  // LEVEL 3: Precision jumping, spikes, switch coordination
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1],
    [1,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,1,1,1,1],
    [1,0,0,0,6,0,0,0,1,1,1,1,1,0,0,1,1,1,1,1],
    [1,1,1,1,1,1,0,0,1,1,1,1,1,5,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,3,0,1],
    [1,0,0,0,0,1,1,1,2,2,2,2,1,1,1,0,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ]
];

interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  isJumping: boolean;
  flipX: boolean;
  animFrame: number;
  animTimer: number;
}

export const PlatformerGame: React.FC = () => {
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
  const [currentLevel, setCurrentLevel] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [levelWon, setLevelWon] = useState<boolean>(false);
  const [gameCompleted, setGameCompleted] = useState<boolean>(false);

  // Local physical states
  const localPlayerRef = useRef<PlayerState>({
    x: 80,
    y: 350,
    vx: 0,
    vy: 0,
    width: 24,
    height: 32,
    isJumping: false,
    flipX: false,
    animFrame: 0,
    animTimer: 0
  });

  const remotePlayerRef = useRef<PlayerState>({
    x: 120,
    y: 350,
    vx: 0,
    vy: 0,
    width: 24,
    height: 32,
    isJumping: false,
    flipX: false,
    animFrame: 0,
    animTimer: 0
  });

  // Level states managed by Host
  const levelStateRef = useRef({
    currentLevel: 0,
    keyCollected: false,
    gateOpen: false,
    switchesPressed: [false],
    levelCompleted: false
  });

  // Keyboard controls
  const keysRef = useRef<{ [key: string]: boolean }>({});

  // Reset players to level start positions
  const resetPlayerPositions = (levelIdx: number) => {
    if (levelIdx === 0) {
      localPlayerRef.current.x = 80;
      localPlayerRef.current.y = 350;
      remotePlayerRef.current.x = 120;
      remotePlayerRef.current.y = 350;
    } else if (levelIdx === 1) {
      // Level 2 splits: Host spawns bottom-left, Client top-left
      if (isHost) {
        localPlayerRef.current.x = 80;
        localPlayerRef.current.y = 320;
        remotePlayerRef.current.x = 80;
        remotePlayerRef.current.y = 80;
      } else {
        localPlayerRef.current.x = 80;
        localPlayerRef.current.y = 80;
        remotePlayerRef.current.x = 80;
        remotePlayerRef.current.y = 320;
      }
    } else {
      // Level 3
      localPlayerRef.current.x = 60;
      localPlayerRef.current.y = 320;
      remotePlayerRef.current.x = 100;
      remotePlayerRef.current.y = 320;
    }

    localPlayerRef.current.vx = 0;
    localPlayerRef.current.vy = 0;
    localPlayerRef.current.isJumping = false;

    remotePlayerRef.current.vx = 0;
    remotePlayerRef.current.vy = 0;
    remotePlayerRef.current.isJumping = false;
  };

  // Sync state initialization
  useEffect(() => {
    resetPlayerPositions(0);
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keypresses if user is typing in a chat input or other text field
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

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

  // Handle incoming data
  useEffect(() => {
    if (!gameData) return;

    // Client receives full authoritative level states + remote player pos from Host
    if (!isHost) {
      if (gameData.player) {
        remotePlayerRef.current.x = gameData.player.x;
        remotePlayerRef.current.y = gameData.player.y;
        remotePlayerRef.current.vx = gameData.player.vx;
        remotePlayerRef.current.vy = gameData.player.vy;
        remotePlayerRef.current.isJumping = gameData.player.isJumping;
        remotePlayerRef.current.flipX = gameData.player.flipX;
        remotePlayerRef.current.animFrame = gameData.player.animFrame;
      }

      if (gameData.levelState) {
        const oldLevel = levelStateRef.current.currentLevel;
        levelStateRef.current = gameData.levelState;
        
        setCurrentLevel(gameData.levelState.currentLevel);
        setLevelWon(gameData.levelState.levelCompleted);

        // If level changes, reset local position
        if (gameData.levelState.currentLevel !== oldLevel) {
          resetPlayerPositions(gameData.levelState.currentLevel);
        }
      }
    } 
    // Host receives client position
    else {
      if (gameData.player) {
        remotePlayerRef.current.x = gameData.player.x;
        remotePlayerRef.current.y = gameData.player.y;
        remotePlayerRef.current.vx = gameData.player.vx;
        remotePlayerRef.current.vy = gameData.player.vy;
        remotePlayerRef.current.isJumping = gameData.player.isJumping;
        remotePlayerRef.current.flipX = gameData.player.flipX;
        remotePlayerRef.current.animFrame = gameData.player.animFrame;
      }
    }
  }, [gameData, isHost]);

  // Handle one-off events (like next level load trigger, death effects, or final win)
  useEffect(() => {
    if (!gameEvent) return;

    if (gameEvent.type === 'level_reset') {
      resetPlayerPositions(levelStateRef.current.currentLevel);
    } else if (gameEvent.type === 'game_win') {
      setGameCompleted(true);
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
    }

    resetGameEvent();
  }, [gameEvent]);

  // Main game physics and loop
  useEffect(() => {
    let animationId: number;

    let lastTime = performance.now();
    const timeStep = 1000 / 60;
    let accumulator = 0;

    const gameLoop = (currentTime: number) => {
      let deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      if (deltaTime > 100) deltaTime = 100;

      accumulator += deltaTime;
      while (accumulator >= timeStep) {
        updatePhysics();
        accumulator -= timeStep;
      }

      drawGame();
      syncNetwork();
      animationId = requestAnimationFrame(gameLoop);
    };

    // Physics Engine
    const updatePhysics = () => {
      const p = localPlayerRef.current;
      const levelIdx = levelStateRef.current.currentLevel;
      const map = LEVELS[levelIdx];

      // Reset horizontal speed
      p.vx = 0;

      // Handle Key Inputs
      if (keysRef.current['ArrowLeft'] || keysRef.current['a'] || keysRef.current['A']) {
        p.vx = -WALK_SPEED;
        p.flipX = true;
      }
      if (keysRef.current['ArrowRight'] || keysRef.current['d'] || keysRef.current['D']) {
        p.vx = WALK_SPEED;
        p.flipX = false;
      }
      if ((keysRef.current['ArrowUp'] || keysRef.current['w'] || keysRef.current['W'] || keysRef.current[' ']) && !p.isJumping) {
        p.vy = JUMP_FORCE;
        p.isJumping = true;
      }

      // Apply Gravity
      p.vy += GRAVITY;

      // Update Walking Animation Frame
      if (p.vx !== 0) {
        p.animTimer += 1;
        if (p.animTimer >= 8) {
          p.animFrame = (p.animFrame + 1) % 4;
          p.animTimer = 0;
        }
      } else {
        p.animFrame = 0;
      }

      // Collision Detection - Move X
      p.x += p.vx;
      checkTileCollisions(p, map, 'x');

      // Collision Detection - Move Y
      p.y += p.vy;
      p.isJumping = true; // Assume jumping/falling unless collision sets grounded
      checkTileCollisions(p, map, 'y');

      // Screen boundaries
      if (p.x < 0) p.x = 0;
      if (p.x > CANVAS_WIDTH - p.width) p.x = CANVAS_WIDTH - p.width;
      if (p.y > CANVAS_HEIGHT) {
        // Fell out of screen -> Die
        handlePlayerDeath();
      }

      // --- Host Authoritative Checks (Switches, Gates, Gem Collections, Exit Portal) ---
      if (isHost) {
        const p1 = localPlayerRef.current;
        const p2 = remotePlayerRef.current;
        const state = levelStateRef.current;

        // Check if players hit switches
        let switchPressedThisFrame = false;
        
        // Scan the map for switch positions
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (map[r][c] === TILE_SWITCH) {
              const switchX = c * TILE_SIZE;
              const switchY = r * TILE_SIZE + 24; // Switches are low bounding box
              
              const p1On = checkRectOverlap(p1.x, p1.y, p1.width, p1.height, switchX, switchY, TILE_SIZE, 16);
              const p2On = checkRectOverlap(p2.x, p2.y, p2.width, p2.height, switchX, switchY, TILE_SIZE, 16);

              if (p1On || p2On) {
                switchPressedThisFrame = true;
              }
            }
          }
        }
        
        state.gateOpen = switchPressedThisFrame;

        // Check if either player overlaps key
        if (!state.keyCollected) {
          for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
              if (map[r][c] === TILE_KEY) {
                const keyX = c * TILE_SIZE + 10;
                const keyY = r * TILE_SIZE + 10;
                const keySize = 20;

                const p1Hits = checkRectOverlap(p1.x, p1.y, p1.width, p1.height, keyX, keyY, keySize, keySize);
                const p2Hits = checkRectOverlap(p2.x, p2.y, p2.width, p2.height, keyX, keyY, keySize, keySize);

                if (p1Hits || p2Hits) {
                  state.keyCollected = true;
                  setScore((s) => s + 100);
                }
              }
            }
          }
        }

        // Check if players touch hazards (Spikes)
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (map[r][c] === TILE_SPIKES) {
              const spikeX = c * TILE_SIZE + 4;
              const spikeY = r * TILE_SIZE + 20;
              const spikeW = TILE_SIZE - 8;
              const spikeH = 20;

              const p1Dies = checkRectOverlap(p1.x, p1.y, p1.width, p1.height, spikeX, spikeY, spikeW, spikeH);
              const p2Dies = checkRectOverlap(p2.x, p2.y, p2.width, p2.height, spikeX, spikeY, spikeW, spikeH);

              if (p1Dies || p2Dies) {
                handlePlayerDeath();
              }
            }
          }
        }

        // Check Exit portal (Must collect key, and BOTH players must overlap exit door)
        if (state.keyCollected && !state.levelCompleted) {
          for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
              if (map[r][c] === TILE_EXIT) {
                const portalX = c * TILE_SIZE + 4;
                const portalY = r * TILE_SIZE + 4;
                const portalSize = TILE_SIZE - 8;

                const p1AtExit = checkRectOverlap(p1.x, p1.y, p1.width, p1.height, portalX, portalY, portalSize, portalSize);
                const p2AtExit = checkRectOverlap(p2.x, p2.y, p2.width, p2.height, portalX, portalY, portalSize, portalSize);

                if (p1AtExit && p2AtExit) {
                  state.levelCompleted = true;
                  setLevelWon(true);
                }
              }
            }
          }
        }
      }
    };

    // AABB rectangle overlap helper
    const checkRectOverlap = (
      ax: number, ay: number, aw: number, ah: number,
      bx: number, by: number, bw: number, bh: number
    ) => {
      return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    };

    const checkTileCollisions = (p: PlayerState, map: number[][], dir: 'x' | 'y') => {
      const left = Math.floor(p.x / TILE_SIZE);
      const right = Math.floor((p.x + p.width) / TILE_SIZE);
      const top = Math.floor(p.y / TILE_SIZE);
      const bottom = Math.floor((p.y + p.height) / TILE_SIZE);

      // Check collision in bounding boxes
      for (let r = top; r <= bottom; r++) {
        for (let c = left; c <= right; c++) {
          if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
            const tile = map[r][c];

            // Collide with solid blocks, or closed gates
            if (tile === TILE_SOLID || (tile === TILE_GATE && !levelStateRef.current.gateOpen)) {
              if (dir === 'x') {
                if (p.vx > 0) {
                  p.x = c * TILE_SIZE - p.width;
                } else if (p.vx < 0) {
                  p.x = (c + 1) * TILE_SIZE;
                }
              } else {
                if (p.vy > 0) {
                  p.y = r * TILE_SIZE - p.height;
                  p.vy = 0;
                  p.isJumping = false;
                } else if (p.vy < 0) {
                  p.y = (r + 1) * TILE_SIZE;
                  p.vy = 0;
                }
              }
            }
          }
        }
      }
    };

    const handlePlayerDeath = () => {
      if (isHost) {
        sendGameEvent({ type: 'level_reset' });
        resetPlayerPositions(levelStateRef.current.currentLevel);
      } else {
        // Request reset from host
        sendGameEvent({ type: 'request_reset' });
      }
    };

    // Canvas rendering engine
    const drawGame = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const levelIdx = levelStateRef.current.currentLevel;
      const map = LEVELS[levelIdx];
      const gateOpen = levelStateRef.current.gateOpen;
      const keyCollected = levelStateRef.current.keyCollected;

      // 1. Draw Space Background
      ctx.fillStyle = '#05060b';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Grid helper lines (subtle)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
      ctx.lineWidth = 1;
      for (let x = 0; x < CANVAS_WIDTH; x += TILE_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y < CANVAS_HEIGHT; y += TILE_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }

      // 2. Draw Level Tiles
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const tile = map[r][c];
          const x = c * TILE_SIZE;
          const y = r * TILE_SIZE;

          if (tile === TILE_SOLID) {
            // Neon cyan border glass bricks
            ctx.fillStyle = 'rgba(17, 24, 39, 0.8)';
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
            
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 8, y);
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + 8);
            ctx.stroke();
          } 
          
          else if (tile === TILE_SPIKES) {
            // Drawing red warning spikes
            ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
            ctx.lineWidth = 2;
            
            ctx.beginPath();
            // Draw 4 little triangles per tile
            for (let i = 0; i < 4; i++) {
              const sx = x + (i * 10);
              ctx.moveTo(sx, y + TILE_SIZE);
              ctx.lineTo(sx + 5, y + 16);
              ctx.lineTo(sx + 10, y + TILE_SIZE);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          } 
          
          else if (tile === TILE_SWITCH) {
            // Pressure Plate
            ctx.fillStyle = gateOpen ? '#10b981' : '#eab308';
            ctx.shadowBlur = 10;
            ctx.shadowColor = gateOpen ? '#10b981' : '#eab308';
            
            if (gateOpen) {
              ctx.fillRect(x + 4, y + 32, TILE_SIZE - 8, 8);
            } else {
              ctx.fillRect(x + 4, y + 24, TILE_SIZE - 8, 16);
            }
            ctx.shadowBlur = 0; // reset
          } 
          
          else if (tile === TILE_GATE) {
            if (!gateOpen) {
              // Glowing yellow gate blocks
              ctx.fillStyle = 'rgba(234, 179, 8, 0.15)';
              ctx.fillRect(x + 8, y, TILE_SIZE - 16, TILE_SIZE);
              
              ctx.strokeStyle = '#eab308';
              ctx.lineWidth = 3;
              ctx.shadowBlur = 8;
              ctx.shadowColor = '#eab308';
              ctx.beginPath();
              ctx.moveTo(x + 8, y);
              ctx.lineTo(x + 8, y + TILE_SIZE);
              ctx.moveTo(x + TILE_SIZE - 8, y);
              ctx.lineTo(x + TILE_SIZE - 8, y + TILE_SIZE);
              ctx.stroke();
              ctx.shadowBlur = 0; // reset
            }
          } 
          
          else if (tile === TILE_KEY) {
            if (!keyCollected) {
              // Floating gold key
              const bounceY = Math.sin(Date.now() / 200) * 4;
              ctx.fillStyle = '#ffea00';
              ctx.strokeStyle = '#ffea00';
              ctx.shadowBlur = 12;
              ctx.shadowColor = '#ffea00';
              ctx.lineWidth = 2;

              ctx.beginPath();
              ctx.arc(x + 16, y + 20 + bounceY, 6, 0, Math.PI * 2);
              ctx.moveTo(x + 22, y + 20 + bounceY);
              ctx.lineTo(x + 32, y + 20 + bounceY);
              ctx.lineTo(x + 32, y + 26 + bounceY);
              ctx.moveTo(x + 28, y + 20 + bounceY);
              ctx.lineTo(x + 28, y + 24 + bounceY);
              ctx.stroke();
              ctx.shadowBlur = 0; // reset
            }
          } 
          
          else if (tile === TILE_EXIT) {
            // Exit portal
            const pulse = 10 + Math.sin(Date.now() / 150) * 4;
            ctx.strokeStyle = keyCollected ? '#10b981' : '#64748b';
            ctx.shadowBlur = keyCollected ? pulse : 0;
            ctx.shadowColor = '#10b981';
            ctx.lineWidth = 3;
            
            // Outer ring
            ctx.beginPath();
            ctx.arc(x + 20, y + 20, 18, 0, Math.PI * 2);
            ctx.stroke();

            // Inner core swirl
            ctx.fillStyle = keyCollected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 116, 139, 0.1)';
            ctx.beginPath();
            ctx.arc(x + 20, y + 20, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0; // reset
          }
        }
      }

      // 3. Draw Players
      const drawPlayerChar = (player: PlayerState, color: string, glowColor: string) => {
        ctx.save();
        ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
        
        if (player.flipX) {
          ctx.scale(-1, 1);
        }

        // Glow helmet
        ctx.shadowBlur = 10;
        ctx.shadowColor = glowColor;

        // Draw body/space suit
        ctx.fillStyle = color;
        ctx.fillRect(-player.width / 2, -player.height / 2 + 10, player.width, player.height - 18);

        // Helmet/Dome
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(0, -player.height / 2 + 10, 12, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Visor
        ctx.fillStyle = glowColor;
        ctx.fillRect(2, -player.height / 2 + 4, 8, 6);

        // Draw moving legs
        ctx.shadowBlur = 0; // reset
        ctx.fillStyle = '#0f172a';
        
        // simple walk cycle
        const walkCycle = player.animFrame;
        const leftOffset = walkCycle === 1 ? -4 : walkCycle === 3 ? 4 : 0;
        const rightOffset = walkCycle === 1 ? 4 : walkCycle === 3 ? -4 : 0;
        
        // left leg
        ctx.fillRect(-8, player.height / 2 - 8, 4, 8 + leftOffset);
        // right leg
        ctx.fillRect(4, player.height / 2 - 8, 4, 8 + rightOffset);

        // Jetpack trail if jumping/flying
        if (player.isJumping && Math.random() > 0.3) {
          ctx.fillStyle = '#ef4444';
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#f97316';
          ctx.fillRect(-12, 0, 4, 10);
        }

        ctx.restore();
      };

      // Draw Host (Cyan) and Client (Magenta)
      const p1 = isHost ? localPlayerRef.current : remotePlayerRef.current;
      const p2 = isHost ? remotePlayerRef.current : localPlayerRef.current;

      drawPlayerChar(p1, '#00e1ff', 'rgba(0, 240, 255, 0.8)');
      drawPlayerChar(p2, '#ff00a0', 'rgba(255, 0, 127, 0.8)');
    };

    // Network Sync Loops
    const syncNetwork = () => {
      // Send current local coordinates
      const myState = localPlayerRef.current;
      
      const payload: any = {
        player: {
          x: myState.x,
          y: myState.y,
          vx: myState.vx,
          vy: myState.vy,
          isJumping: myState.isJumping,
          flipX: myState.flipX,
          animFrame: myState.animFrame
        }
      };

      // If we are Host, we also append authoritative level metrics
      if (isHost) {
        payload.levelState = levelStateRef.current;
      }

      sendGameData(payload);
    };

    // Start running loop
    if (isConnected && !gameCompleted) {
      animationId = requestAnimationFrame(gameLoop);
    }

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isConnected, isHost, gameCompleted]);

  // Host listener for request_reset from client
  useEffect(() => {
    if (isHost && gameData && gameData.type === 'request_reset') {
      sendGameEvent({ type: 'level_reset' });
      resetPlayerPositions(levelStateRef.current.currentLevel);
    }
  }, [gameData, isHost]);

  // Handle clicking next level (Host authority)
  const handleNextLevel = () => {
    const nextIdx = levelStateRef.current.currentLevel + 1;
    if (nextIdx < LEVELS.length) {
      levelStateRef.current.currentLevel = nextIdx;
      levelStateRef.current.keyCollected = false;
      levelStateRef.current.gateOpen = false;
      levelStateRef.current.levelCompleted = false;

      setCurrentLevel(nextIdx);
      setLevelWon(false);
      resetPlayerPositions(nextIdx);

      // sync to client immediately
      sendGameData({
        levelState: levelStateRef.current
      });
    } else {
      // Game fully completed!
      setGameCompleted(true);
      sendGameEvent({ type: 'game_win' });
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
    }
  };

  const handleRestartGame = () => {
    setLevelWon(false);
    setGameCompleted(false);
    setScore(0);
    
    if (isHost) {
      levelStateRef.current.currentLevel = 0;
      levelStateRef.current.keyCollected = false;
      levelStateRef.current.gateOpen = false;
      levelStateRef.current.levelCompleted = false;
      
      setCurrentLevel(0);
      resetPlayerPositions(0);

      sendGameEvent({ type: 'level_reset' });
      sendGameData({
        levelState: levelStateRef.current
      });
    }
  };

  return (
    <div className="game-main-content">
      <div className="game-header-bar glass-panel" style={{ width: '100%', maxWidth: '900px' }}>
        <h2 className="game-title-text font-display">
          LEVEL {currentLevel + 1}: <span className="text-cyan">
            {currentLevel === 0 && "GATEKEEPER'S RIFT"}
            {currentLevel === 1 && "COORDINATED ESCAPE"}
            {currentLevel === 2 && "THE SPIKE CHAMBERS"}
          </span>
        </h2>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div className="peer-badge" style={{ borderColor: 'var(--neon-green)', color: 'var(--neon-green)' }}>
            Score: {score}
          </div>
          <div className="peer-badge" style={{ color: 'var(--neon-yellow)' }}>
            {levelStateRef.current.keyCollected ? '🔑 Key Acquired!' : '❌ Key Required'}
          </div>
        </div>
      </div>

      <div className="canvas-container">
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />

        {/* Level Won Overlay */}
        {levelWon && !gameCompleted && (
          <div className="canvas-overlay">
            <h2 className="overlay-title font-display text-green">STAGE CLEARED!</h2>
            <p style={{ color: 'var(--text-secondary)' }}>You both reached the escape portal safely.</p>
            {isHost ? (
              <button className="glow-btn-cyan font-display" onClick={handleNextLevel} style={{ padding: '0.8rem 2rem' }}>
                Next Stage <Play size={14} style={{ marginLeft: '6px', display: 'inline' }} />
              </button>
            ) : (
              <span className="text-yellow font-display" style={{ fontSize: '1rem' }}>Waiting for host to load next stage...</span>
            )}
          </div>
        )}

        {/* Game Victory Overlay */}
        {gameCompleted && (
          <div className="canvas-overlay">
            <h2 className="overlay-title font-display text-cyan" style={{ fontSize: '3rem', letterSpacing: '2px' }}>VICTORY!</h2>
            <p style={{ color: 'var(--neon-green)', fontWeight: 700, fontSize: '1.2rem' }}>All levels cleared successfully!</p>
            <p style={{ color: 'var(--text-secondary)', marginTop: '-0.5rem' }}>Final Score: {score + 500} pts (Cooperative Bonus Included)</p>
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              {isHost && (
                <button className="glow-btn-cyan font-display" onClick={handleRestartGame} style={{ padding: '0.8rem 2rem' }}>
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

      {/* Quick controls list */}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '900px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        <div>
          <span>Your Player: </span>
          <span className="font-display" style={{ fontWeight: 700, color: isHost ? '#00e1ff' : '#ff00a0' }}>
            {isHost ? 'P1 (CYAN)' : 'P2 (MAGENTA)'}
          </span>
        </div>
        <div>
          <span>Controls: </span>
          <span className="control-key">A</span> / <span className="control-key">D</span> or <span className="control-key">←</span> / <span className="control-key">→</span> to Move | <span className="control-key">W</span> / <span className="control-key">Space</span> to Jump
        </div>
      </div>
    </div>
  );
};
