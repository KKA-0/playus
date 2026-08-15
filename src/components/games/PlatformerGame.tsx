import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePeer } from '../../context/PeerContext';
import { Gamepad2, Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Volume2, VolumeX } from 'lucide-react';

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
const TILE_TERMINAL = 3; // Door Unlock Terminal / Switch
const TILE_DOOR = 4;     // Exit Security Door
const TILE_GATE = 5;     // Pressure Gate
const TILE_SWITCH = 6;   // Pressure Switch

const brickImg = new Image();
brickImg.src = 'gateIt/ch1-brick.png';
const gateSwtichOFFImg = new Image();
gateSwtichOFFImg.src = 'gateIt/gateSwitchOFF.png';
const gateSwtichONImg = new Image();
gateSwtichONImg.src = 'gateIt/gateSwitchON.png';

// 3 Levels Map Data (12 rows x 20 cols)
// 1 = solid block, 2 = spikes, 3 = door terminal, 4 = exit door, 5 = gate, 6 = switch
const LEVELS = [
  // LEVEL 1: Introduction to cooperation
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
    [1, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 3, 1], // Switch at col 4 and return switch at col 12
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ],
  // LEVEL 2: Double split paths
  [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0, 4, 1],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, , 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
    [1, 0, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 3, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ],
  // LEVEL 3: Precision jumping, spikes, switch coordination
  [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1],
    [1, 0, 0, 0, 6, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 5, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 3, 0, 1],
    [1, 0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
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

/** True when a player is grounded in the tile(s) directly below the exit door. */
const isPlayerInExitZone = (p: PlayerState, doorRow: number, doorCol: number) => {
  const zoneLeft = Math.max(0, (doorCol - 1) * TILE_SIZE);
  const zoneRight = Math.min(CANVAS_WIDTH, (doorCol + 2) * TILE_SIZE);
  const zoneTop = doorRow * TILE_SIZE;
  const zoneBottom = (doorRow + 2) * TILE_SIZE;

  const playerFeetY = p.y + p.height;

  return (
    !p.isJumping &&
    p.x < zoneRight &&
    p.x + p.width > zoneLeft &&
    playerFeetY >= zoneTop &&
    playerFeetY <= zoneBottom
  );
};

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      if (containerRef.current) {
        containerRef.current.requestFullscreen().catch((err) => {
          console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // Game UI States
  const [currentLevel, setCurrentLevel] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [gameCompleted, setGameCompleted] = useState<boolean>(false);
  const [gamepadConnected, setGamepadConnected] = useState<boolean>(false);

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
    doorUnlocked: false,
    gateOpen: false,
    switchesPressed: [false],
    levelCompleted: false
  });

  // Keyboard controls
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const prevGamepadButtonsRef = useRef<boolean[]>([]);
  const prevGamepadAxisYRef = useRef<number>(0);
  const coyoteTimerRef = useRef<number>(0);
  const jumpBufferTimerRef = useRef<number>(0);

  // Preloaded GBA character sprites from ChainedGame / FarmGame
  const maleImageRef = useRef<HTMLImageElement | null>(null);
  const femaleImageRef = useRef<HTMLImageElement | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [volume, setVolume] = useState<number>(0.5);


  useEffect(() => {
    const maleImg = new Image();
    maleImg.src = '/male.png';
    maleImageRef.current = maleImg;

    const femaleImg = new Image();
    femaleImg.src = '/female.png';
    femaleImageRef.current = femaleImg;
  }, []);

    // Initialize background music
    useEffect(() => {
      const audio = new Audio('/music/genHunters.mp3');
      audio.loop = true;
      audio.volume = volume;
  
      const handleEnded = () => {
        audio.currentTime = 0;
        audio.play().catch((err) => {
          console.warn('Audio loop replay blocked:', err);
        });
      };
  
      audio.addEventListener('ended', handleEnded);
      audioRef.current = audio;
  
      return () => {
        if (audioRef.current) {
          audioRef.current.removeEventListener('ended', handleEnded);
          audioRef.current.pause();
          audioRef.current = null;
        }
      };
    }, []);

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVol = parseFloat(e.target.value);
      setVolume(newVol);
      if (audioRef.current) {
        audioRef.current.volume = newVol;
      }
    };
  

  useEffect(() => {
    const handleConnect = () => setGamepadConnected(true);
    const handleDisconnect = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const hasActive = Array.from(gamepads).some((g) => g !== null);
      setGamepadConnected(hasActive);
    };

    window.addEventListener('gamepadconnected', handleConnect);
    window.addEventListener('gamepaddisconnected', handleDisconnect);

    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (Array.from(gamepads).some((g) => g !== null)) {
      setGamepadConnected(true);
    }

    return () => {
      window.removeEventListener('gamepadconnected', handleConnect);
      window.removeEventListener('gamepaddisconnected', handleDisconnect);
    };
  }, []);


    // Play music when connected and active
    useEffect(() => {
      if (audioRef.current) {
        if (isConnected) {
          if (audioRef.current.paused) {
            audioRef.current.play().catch((err) => {
              console.warn('Audio play blocked or failed:', err);
            });
          }
        } else {
          if (!audioRef.current.paused) {
            audioRef.current.pause();
          }
        }
      }
    }, [isConnected]);
  
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

  const restartCurrentLevel = () => {
    const levelIdx = levelStateRef.current.currentLevel;
    levelStateRef.current.doorUnlocked = false;
    levelStateRef.current.gateOpen = false;
    levelStateRef.current.levelCompleted = false;
    resetPlayerPositions(levelIdx);
    sendGameEvent({ type: 'level_reset' });
    sendGameData({ levelState: levelStateRef.current });
  };

  const handleRestartLevel = () => {
    if (gameCompleted) return;

    if (isHost) {
      restartCurrentLevel();
    } else {
      sendGameData({ type: 'request_restart_level' });
    }
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

      const keyLower = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd'].includes(keyLower)) {
        e.preventDefault();
      }

      keysRef.current[keyLower] = true;
      keysRef.current[e.code] = true;

      if (keyLower === 'w' || keyLower === 'arrowup' || keyLower === ' ' || e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
        jumpBufferTimerRef.current = 8;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const keyLower = e.key.toLowerCase();
      keysRef.current[keyLower] = false;
      keysRef.current[e.code] = false;
    };

    const handleBlur = () => {
      keysRef.current = {};
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
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
    } else if (gameEvent.type === 'request_reset' && isHost) {
      sendGameEvent({ type: 'level_reset' });
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
  }, [gameEvent, isHost]);

  const advanceToNextLevel = useCallback(() => {
    if (!isHost) return;

    const nextIdx = levelStateRef.current.currentLevel + 1;
    if (nextIdx < LEVELS.length) {
      levelStateRef.current.currentLevel = nextIdx;
      levelStateRef.current.doorUnlocked = false;
      levelStateRef.current.gateOpen = false;
      levelStateRef.current.levelCompleted = false;

      setCurrentLevel(nextIdx);
      resetPlayerPositions(nextIdx);

      sendGameData({
        levelState: levelStateRef.current
      });
    } else {
      levelStateRef.current.levelCompleted = true;
      setGameCompleted(true);
      sendGameEvent({ type: 'game_win' });
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
    }
  }, [isHost, sendGameData, sendGameEvent]);

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

    // AABB rectangle overlap helper
    const checkRectOverlap = (
      ax: number, ay: number, aw: number, ah: number,
      bx: number, by: number, bw: number, bh: number
    ) => {
      return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    };

    // One-way "stand on top" collision so a player can use the other player as a platform.
    // Only resolves when the moving player is falling (or stationary) onto the other
    // player's head - it never blocks movement from the side or from below.
    const checkPlayerOnPlayerCollision = (p: PlayerState, other: PlayerState) => {
      const LANDING_TOLERANCE = 14; // how many px of overlap still counts as "landing" on the head
      const HORIZONTAL_MARGIN = 4;  // shrink the landing zone slightly so it feels fair

      const overlapsX =
        p.x + p.width > other.x + HORIZONTAL_MARGIN &&
        p.x < other.x + other.width - HORIZONTAL_MARGIN;

      if (!overlapsX) return;

      const feetY = p.y + p.height;
      const otherTopY = other.y;

      // Only "land" when falling/stationary and feet are close to the other player's head
      if (p.vy >= 0 && feetY >= otherTopY && feetY <= otherTopY + LANDING_TOLERANCE) {
        p.y = otherTopY - p.height;
        p.vy = 0;
        p.isJumping = false;
      }
    };

    const checkTileCollisions = (p: PlayerState, map: number[][], dir: 'x' | 'y') => {
      const EPS = 0.01;
      const left = Math.floor((p.x + EPS) / TILE_SIZE);
      const right = Math.floor((p.x + p.width - EPS) / TILE_SIZE);
      const top = Math.floor((p.y + EPS) / TILE_SIZE);
      const bottom = Math.floor((p.y + p.height - EPS) / TILE_SIZE);

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

    // Physics Engine
    const updatePhysics = () => {
      const p = localPlayerRef.current;
      const levelIdx = levelStateRef.current.currentLevel;
      const map = LEVELS[levelIdx];

      let gpLeft = false;
      let gpRight = false;
      let gpJump = false;
      let gpJumpJustPressed = false;

      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = Array.from(gamepads).find((g) => g !== null);

      if (gp) {
        const deadzone = 0.2;
        const axisX = gp.axes[0] || 0;
        const axisY = gp.axes[1] || 0;

        gpLeft = axisX < -deadzone || (gp.buttons[14]?.pressed ?? false);
        gpRight = axisX > deadzone || (gp.buttons[15]?.pressed ?? false);
        gpJump =
          (gp.buttons[0]?.pressed ?? false) ||
          (gp.buttons[12]?.pressed ?? false) ||
          axisY < -deadzone;

        const wasJumpPressed =
          prevGamepadButtonsRef.current[0] ||
          prevGamepadButtonsRef.current[12] ||
          prevGamepadAxisYRef.current < -deadzone;
        gpJumpJustPressed = gpJump && !wasJumpPressed;

        prevGamepadButtonsRef.current = gp.buttons.map((b) => b.pressed);
        prevGamepadAxisYRef.current = axisY;
      } else {
        prevGamepadButtonsRef.current = [];
        prevGamepadAxisYRef.current = 0;
      }

      const isLeft = keysRef.current['arrowleft'] || keysRef.current['a'] || keysRef.current['keya'] || gpLeft;
      const isRight = keysRef.current['arrowright'] || keysRef.current['d'] || keysRef.current['keyd'] || gpRight;
      const isJump =
        keysRef.current['arrowup'] ||
        keysRef.current['w'] ||
        keysRef.current['keyw'] ||
        keysRef.current['space'] ||
        keysRef.current[' '] ||
        gpJump;

      if (gpJumpJustPressed) {
        jumpBufferTimerRef.current = 8;
      }

      // Handle horizontal movement
      p.vx = 0;
      if (isLeft) {
        p.vx = -WALK_SPEED;
        p.flipX = true;
      }
      if (isRight) {
        p.vx = WALK_SPEED;
        p.flipX = false;
      }

      // Timers for Coyote time and Jump Buffering
      if (coyoteTimerRef.current > 0) coyoteTimerRef.current--;
      if (jumpBufferTimerRef.current > 0) jumpBufferTimerRef.current--;

      const canJump = !p.isJumping || coyoteTimerRef.current > 0;

      if (jumpBufferTimerRef.current > 0 && canJump) {
        p.vy = JUMP_FORCE;
        p.isJumping = true;
        coyoteTimerRef.current = 0;
        jumpBufferTimerRef.current = 0;
      }

      // Variable jump height: cut jump velocity if player releases jump key early
      if (!isJump && p.vy < -3) {
        p.vy = -3;
      }

      // Apply Gravity
      p.vy += GRAVITY;
      if (p.vy > 12) p.vy = 12; // Terminal velocity

      // Update Walking Animation Frame
      if (p.vx !== 0) {
        p.animTimer += 1;
        if (p.animTimer >= 6) {
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
      p.isJumping = true; // Assume jumping/falling unless Y collision sets grounded
      checkTileCollisions(p, map, 'y');

      // Let this player stand on top of the other player, like a platform
      checkPlayerOnPlayerCollision(p, remotePlayerRef.current);

      // Update coyote time if grounded
      if (!p.isJumping) {
        coyoteTimerRef.current = 6; // 6 frames coyote time window
      }

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

        let switchPressedThisFrame = false;

        // Scan the map for any active switch positions
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (map[r][c] === TILE_SWITCH) {
              const switchX = c * TILE_SIZE + 2;
              const switchY = r * TILE_SIZE + 16; // Start detection 16px from top of tile
              const switchW = TILE_SIZE - 4;
              const switchH = 24;

              // Check if either Player 1 OR Player 2 is on this switch
              const p1On = checkRectOverlap(p1.x, p1.y, p1.width, p1.height, switchX, switchY, switchW, switchH);
              const p2On = checkRectOverlap(p2.x, p2.y, p2.width, p2.height, switchX, switchY, switchW, switchH);

              if (p1On || p2On) {
                switchPressedThisFrame = true;
              }
            }
          }
        }

        // Open the pressure gate if ANY switch is occupied
        state.gateOpen = switchPressedThisFrame;

        // Check if either player activates Door Unlock Terminal (TILE_TERMINAL / tile 3)
        if (!state.doorUnlocked) {
          for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
              if (map[r][c] === TILE_TERMINAL) {
                const termX = c * TILE_SIZE + 6;
                const termY = r * TILE_SIZE + 6;
                const termSize = TILE_SIZE - 12;

                const p1Hits = checkRectOverlap(p1.x, p1.y, p1.width, p1.height, termX, termY, termSize, termSize);
                const p2Hits = checkRectOverlap(p2.x, p2.y, p2.width, p2.height, termX, termY, termSize, termSize);

                if (p1Hits || p2Hits) {
                  state.doorUnlocked = true;
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

        // Both players must be standing below the unlocked exit door to advance
        if (state.doorUnlocked && !state.levelCompleted) {
          for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
              if (map[r][c] === TILE_DOOR) {
                const p1AtExit = isPlayerInExitZone(p1, r, c);
                const p2AtExit = isPlayerInExitZone(p2, r, c);

                if (p1AtExit && p2AtExit) {
                  state.levelCompleted = true;
                  advanceToNextLevel();
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
      const doorUnlocked = levelStateRef.current.doorUnlocked;

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
            ctx.drawImage(brickImg, x, y, TILE_SIZE, TILE_SIZE);
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

          else if (tile === TILE_TERMINAL) {
            // Door Unlock Terminal

            // ctx.drawImage(gateSwtichONImg, x, y, TILE_SIZE, TILE_SIZE);
            if (gateSwtichONImg.complete && gateSwtichOFFImg.complete) {
              ctx.drawImage(doorUnlocked ? gateSwtichONImg : gateSwtichOFFImg, x, y, TILE_SIZE, TILE_SIZE);
            }

            // ctx.fillStyle = doorUnlocked ? 'rgba(16, 185, 129, 0.2)' : 'rgba(0, 240, 255, 0.15)';
            // ctx.fillRect(x + 6, y + 8, 28, 32);
            // ctx.strokeStyle = doorUnlocked ? '#10b981' : '#00f0ff';
            // ctx.lineWidth = 2;
            // ctx.strokeRect(x + 6, y + 8, 28, 32);

            // // Screen glow
            // ctx.fillStyle = doorUnlocked ? '#10b981' : '#00f0ff';
            // ctx.shadowBlur = 8;
            // ctx.shadowColor = doorUnlocked ? '#10b981' : '#00f0ff';
            // ctx.fillRect(x + 10, y + 12, 20, 14);

            // // Terminal status label
            // ctx.fillStyle = '#0f172a';
            // ctx.font = 'bold 8px Orbitron, monospace';
            // ctx.textAlign = 'center';
            // ctx.fillText(doorUnlocked ? 'OPEN' : 'LOCK', x + 20, y + 22);
            // ctx.shadowBlur = 0; // reset
          }

          else if (tile === TILE_DOOR) {
            // Futuristic Security Exit Door
            const pulse = Math.sin(Date.now() / 150) * 3;

            ctx.save();
            if (doorUnlocked) {
              // UNLOCKED OPEN DOOR
              ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
              ctx.fillRect(x + 2, y, TILE_SIZE - 4, TILE_SIZE);

              ctx.strokeStyle = '#10b981';
              ctx.lineWidth = 3;
              ctx.shadowBlur = 12;
              ctx.shadowColor = '#10b981';
              ctx.strokeRect(x + 2, y, TILE_SIZE - 4, TILE_SIZE);

              // Open Portal Interior Core
              ctx.fillStyle = 'rgba(16, 185, 129, 0.6)';
              ctx.beginPath();
              ctx.arc(x + 20, y + 20, 10 + pulse, 0, Math.PI * 2);
              ctx.fill();

              // Top Indicator Lamp (Green)
              ctx.fillStyle = '#10b981';
              ctx.beginPath();
              ctx.arc(x + 20, y + 6, 3, 0, Math.PI * 2);
              ctx.fill();
            } else {
              // LOCKED SECURITY DOOR
              ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
              ctx.fillRect(x + 2, y, TILE_SIZE - 4, TILE_SIZE);

              ctx.strokeStyle = '#475569';
              ctx.lineWidth = 2;
              ctx.strokeRect(x + 2, y, TILE_SIZE - 4, TILE_SIZE);

              // Steel door slats
              ctx.beginPath();
              ctx.moveTo(x + 6, y + 10); ctx.lineTo(x + TILE_SIZE - 6, y + 10);
              ctx.moveTo(x + 6, y + 20); ctx.lineTo(x + TILE_SIZE - 6, y + 20);
              ctx.moveTo(x + 6, y + 30); ctx.lineTo(x + TILE_SIZE - 6, y + 30);
              ctx.stroke();

              // Lock Light (Red)
              ctx.fillStyle = '#ef4444';
              ctx.shadowBlur = 8;
              ctx.shadowColor = '#ef4444';
              ctx.beginPath();
              ctx.arc(x + 20, y + 20, 5, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          }
        }
      }

      // 3. Draw Players (Using Chained Game Characters)
      const drawCharacterPlayer = (
        p: PlayerState,
        baseColor: string,
        glowColor: string,
        label: string,
        isMale: boolean
      ) => {
        const img = isMale ? maleImageRef.current : femaleImageRef.current;
        const imgLoaded = img && img.complete && img.naturalWidth > 0;

        if (imgLoaded) {
          ctx.save();
          // Translate to center-bottom of the player box
          ctx.translate(p.x + p.width / 2, p.y + p.height);

          if (p.flipX) {
            ctx.scale(-1, 1);
          }

          // Subtle glow under sprite
          ctx.shadowBlur = 8;
          ctx.shadowColor = glowColor;

          // Draw character sprite centered horizontally and aligned to feet at the bottom
          ctx.drawImage(
            img,
            -24,      // half of 48 width
            -48 + 4,  // align feet pivot (48 height)
            48,
            48
          );
          ctx.restore();
        } else {
          // Fallback to space suit player
          ctx.save();
          ctx.translate(p.x + p.width / 2, p.y + p.height / 2);

          if (p.flipX) {
            ctx.scale(-1, 1);
          }

          // Glow helmet
          ctx.shadowBlur = 10;
          ctx.shadowColor = glowColor;

          // Draw body/space suit
          ctx.fillStyle = baseColor;
          ctx.fillRect(-p.width / 2, -p.height / 2 + 10, p.width, p.height - 18);

          // Helmet/Dome
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.arc(0, -p.height / 2 + 10, 12, Math.PI, 0);
          ctx.fill();
          ctx.strokeStyle = baseColor;
          ctx.lineWidth = 2;
          ctx.stroke();

          // Visor
          ctx.fillStyle = glowColor;
          ctx.fillRect(2, -p.height / 2 + 4, 8, 6);

          // Draw moving legs
          ctx.shadowBlur = 0; // reset
          ctx.fillStyle = '#0f172a';

          const walkCycle = p.animFrame;
          const leftOffset = walkCycle === 1 ? -4 : walkCycle === 3 ? 4 : 0;
          const rightOffset = walkCycle === 1 ? 4 : walkCycle === 3 ? -4 : 0;

          ctx.fillRect(-8, p.height / 2 - 8, 4, 8 + leftOffset);
          ctx.fillRect(4, p.height / 2 - 8, 4, 8 + rightOffset);

          // Jetpack trail if jumping/flying
          if (p.isJumping && Math.random() > 0.3) {
            ctx.fillStyle = '#ef4444';
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#f97316';
            ctx.fillRect(-12, 0, 4, 10);
          }

          ctx.restore();
        }

        // Label tag above character
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 4;
        ctx.shadowColor = glowColor;
        ctx.fillText(label, p.x + p.width / 2, p.y - 8);
        ctx.shadowBlur = 0; // reset
      };

      // Draw Host (Male character / Cyan) and Client (Female character / Magenta)
      const p1 = isHost ? localPlayerRef.current : remotePlayerRef.current;
      const p2 = isHost ? remotePlayerRef.current : localPlayerRef.current;

      const p1Label = isHost ? 'P1 (YOU)' : 'P1';
      const p2Label = !isHost ? 'P2 (YOU)' : 'P2';

      drawCharacterPlayer(p1, '#00e1ff', 'rgba(0, 240, 255, 0.85)', p1Label, true);
      drawCharacterPlayer(p2, '#ff00a0', 'rgba(255, 0, 127, 0.85)', p2Label, false);
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
  }, [isConnected, isHost, gameCompleted, advanceToNextLevel]);

  // Host listener for client restart requests
  useEffect(() => {
    if (isHost && gameData?.type === 'request_restart_level') {
      restartCurrentLevel();
    }
  }, [gameData, isHost]);

  const handleRestartGame = () => {
    setGameCompleted(false);
    setScore(0);

    if (isHost) {
      levelStateRef.current.currentLevel = 0;
      levelStateRef.current.doorUnlocked = false;
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
    <div className={`game-main-content ${isFullscreen ? 'fullscreen-mode' : ''}`} ref={containerRef}>
      <div className="game-header-bar glass-panel" style={{ width: '100%', maxWidth: '900px' }}>
        <h2 className="game-title-text font-display">
          LEVEL {currentLevel + 1}: <span className="text-cyan">
            {currentLevel === 0 && "PILOT"}
            {currentLevel === 1 && "DON'T WORRY!"}
            {currentLevel === 2 && "DOOMED?"}
          </span>
        </h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* <div className="peer-badge" style={{ borderColor: 'var(--neon-green)', color: 'var(--neon-green)' }}>
            Score: {score}
          </div> */}
          {/* <div className="peer-badge" style={{ borderColor: levelStateRef.current.doorUnlocked ? 'var(--neon-green)' : 'var(--neon-yellow)', color: levelStateRef.current.doorUnlocked ? 'var(--neon-green)' : 'var(--neon-yellow)' }}>
            {levelStateRef.current.doorUnlocked ? '🚪 Door Unlocked!' : '🔒 Door Locked'}
          </div> */}

          {/* Volume Control Widget */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '0.3rem 0.6rem' }}>
            {volume === 0 ? <VolumeX size={14} className="text-muted" /> : <Volume2 size={14} style={{ color: 'var(--neon-purple)' }} />}
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={handleVolumeChange}
              style={{
                width: '70px',
                height: '4px',
                accentColor: 'var(--neon-purple)',
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.1)'
              }}
            />
            <span style={{ fontSize: '0.75rem', minWidth: '24px', textAlign: 'right', fontFamily: 'var(--font-display)', opacity: 0.8 }}>
              {Math.round(volume * 100)}%
            </span>
          </div>
          {gamepadConnected && (
            <div className="peer-badge" style={{ borderColor: 'var(--neon-green)', color: 'var(--neon-green)', gap: '0.4rem' }}>
              <Gamepad2 size={14} />
              <span>Controller</span>
            </div>
          )}
          <button
            className="glow-btn-cyan font-display"
            onClick={handleRestartLevel}
            style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            // title={'Restart this level'
          >
            <RotateCcw size={14} />
          </button>
          <button
            className="glow-btn-cyan font-display"
            onClick={toggleFullScreen}
            style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            {isFullscreen ? (
              <>
                <Minimize2 size={14} /> Exit Fullscreen
              </>
            ) : (
              <>
                <Maximize2 size={14} /> Fullscreen
              </>
            )}
          </button>
          <button className="glow-btn-magenta" onClick={stopGame} style={{ padding: '0.4rem 1.2rem', fontSize: '0.8rem' }}>
            Exit Game
          </button>
        </div>
      </div>

      <div className="canvas-container">
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />

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

      {/* Interactive Controls & On-Screen Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', maxWidth: '900px', marginTop: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <div>
            <span>Your Player: </span>
            <span className="font-display" style={{ fontWeight: 700, color: isHost ? '#00e1ff' : '#ff00a0' }}>
              {isHost ? 'P1 (CYAN)' : 'P2 (MAGENTA)'}
            </span>
          </div>
          <div>
            <span>Controls: </span>
            <span className="control-key">A</span> / <span className="control-key">D</span> or <span className="control-key">←</span> / <span className="control-key">→</span> to Move | <span className="control-key">W</span> / <span className="control-key">Space</span> to Jump
            {gamepadConnected && (
              <span> | <span className="control-key">Stick</span> / <span className="control-key">D-Pad</span> Move | <span className="control-key">A</span> / <span className="control-key">↑</span> Jump</span>
            )}
          </div>
        </div>

        {/* Touch & Mouse Virtual Control Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', width: '100%' }}>
          <button
            className="glow-btn-cyan font-display"
            style={{ padding: '0.5rem 1.4rem', fontSize: '0.85rem', userSelect: 'none', touchAction: 'manipulation' }}
            onMouseDown={() => { keysRef.current['a'] = true; }}
            onMouseUp={() => { keysRef.current['a'] = false; }}
            onMouseLeave={() => { keysRef.current['a'] = false; }}
            onTouchStart={(e) => { e.preventDefault(); keysRef.current['a'] = true; }}
            onTouchEnd={(e) => { e.preventDefault(); keysRef.current['a'] = false; }}
          >
            ◄ Move Left
          </button>
          <button
            className="glow-btn-cyan font-display"
            style={{ padding: '0.5rem 2rem', fontSize: '0.85rem', fontWeight: 'bold', userSelect: 'none', touchAction: 'manipulation' }}
            onMouseDown={() => { keysRef.current['w'] = true; jumpBufferTimerRef.current = 8; }}
            onMouseUp={() => { keysRef.current['w'] = false; }}
            onMouseLeave={() => { keysRef.current['w'] = false; }}
            onTouchStart={(e) => { e.preventDefault(); keysRef.current['w'] = true; jumpBufferTimerRef.current = 8; }}
            onTouchEnd={(e) => { e.preventDefault(); keysRef.current['w'] = false; }}
          >
            ▲ JUMP
          </button>
          <button
            className="glow-btn-cyan font-display"
            style={{ padding: '0.5rem 1.4rem', fontSize: '0.85rem', userSelect: 'none', touchAction: 'manipulation' }}
            onMouseDown={() => { keysRef.current['d'] = true; }}
            onMouseUp={() => { keysRef.current['d'] = false; }}
            onMouseLeave={() => { keysRef.current['d'] = false; }}
            onTouchStart={(e) => { e.preventDefault(); keysRef.current['d'] = true; }}
            onTouchEnd={(e) => { e.preventDefault(); keysRef.current['d'] = false; }}
          >
            Move Right ►
          </button>
        </div>
      </div>
    </div>
  );
};