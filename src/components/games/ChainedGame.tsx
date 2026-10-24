import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePeer } from '../../context/PeerContext';
import { Shield, Flag, Award, Maximize, Minimize, Volume2, VolumeX, Gamepad2, ArrowLeft, ArrowRight, ArrowUp, Smartphone } from 'lucide-react';
import confetti from 'canvas-confetti';
import { CHAPTERS, PHYSICS, getCameraY, isAtPortal, isValidCheckpoint } from './chained/levels';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 480;
const GRAVITY = PHYSICS.gravity;
const WALK_SPEED = PHYSICS.walkSpeed;
const JUMP_FORCE = PHYSICS.jumpForce;

const MAX_CHAIN_LENGTH = 140; // Max distance players can move apart
const SPRING_CONSTANT = 0.08; // Pull velocity force strength
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
  const [chapterIndex, setChapterIndex] = useState(0);
  const chapterIndexRef = useRef(0);
  // A new run starts on every teleport, restart, or chapter change. Ignore old positions.
  const runIdRef = useRef(0);
  const lastGameDataRef = useRef(gameData);
  const lastGameEventRef = useRef(gameEvent);
  const chapter = CHAPTERS[chapterIndex];
  const nextChapter = CHAPTERS[chapterIndex + 1];

  // Game UI States
  const [activeCheckpoint, setActiveCheckpoint] = useState<number>(0);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [gameWon, setGameWon] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [gamepadConnected, setGamepadConnected] = useState<boolean>(false);

  // Mobile Detection & 3-Part Touch Controls State
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const userAgentMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(navigator.userAgent);
    const touchCapable = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const smallScreen = window.innerWidth <= 1024;
    return userAgentMobile || (touchCapable && smallScreen);
  });

  const mobileTouchRef = useRef<{ left: boolean; jump: boolean; right: boolean }>({
    left: false,
    jump: false,
    right: false
  });

  const [activeTouches, setActiveTouches] = useState<{ left: boolean; middle: boolean; right: boolean }>({
    left: false,
    middle: false,
    right: false
  });

  // Track window resize to re-check mobile device state
  useEffect(() => {
    const handleResize = () => {
      const userAgentMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(navigator.userAgent);
      const touchCapable = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      const smallScreen = window.innerWidth <= 1024;
      setIsMobile(userAgentMobile || (touchCapable && smallScreen));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handler to split touch area into 3 screen zones: Left (0-33%), Middle Jump (33-66%), Right (66-100%)
  const handleTouchUpdate = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    const container = e.currentTarget.getBoundingClientRect();
    let left = false;
    let middle = false;
    let right = false;

    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      const relativeX = touch.clientX - container.left;
      const width = container.width;

      if (relativeX < width / 3) {
        left = true;
      } else if (relativeX < (width * 2) / 3) {
        middle = true;
      } else {
        right = true;
      }
    }

    mobileTouchRef.current = { left, jump: middle, right };
    setActiveTouches({ left, middle, right });
  };

  // Audio state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [volume, setVolume] = useState<number>(0.5);

  // Fullscreen change listeners
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Gamepad connection listener
  useEffect(() => {
    const handleConnect = () => setGamepadConnected(true);
    const handleDisconnect = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const hasActive = Array.from(gamepads).some(g => g !== null);
      setGamepadConnected(hasActive);
    };

    window.addEventListener('gamepadconnected', handleConnect);
    window.addEventListener('gamepaddisconnected', handleDisconnect);

    // Initial check
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (Array.from(gamepads).some(g => g !== null)) {
      setGamepadConnected(true);
    }

    return () => {
      window.removeEventListener('gamepadconnected', handleConnect);
      window.removeEventListener('gamepaddisconnected', handleDisconnect);
    };
  }, []);

  const toggleFullscreen = () => {
    const container = canvasRef.current?.parentElement;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch((err) => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen();
    }
  };

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

  // Remote player movement delta tracking for player-on-player riding
  const remotePrevXRef = useRef<number>(440);
  const remotePrevYRef = useRef<number>(390);
  const isStandingOnRemoteRef = useRef<boolean>(false);

  // Preloaded GBA sprites from FarmGame
  const maleImageRef = useRef<HTMLImageElement | null>(null);
  const femaleImageRef = useRef<HTMLImageElement | null>(null);
  const p1FacingLeftRef = useRef<boolean>(false);
  const p2FacingLeftRef = useRef<boolean>(false);

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
    const audio = new Audio('/music/chained.mp3');
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

  // Sync volume level
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
  };

  const spawnParticles = useCallback((x: number, y: number, color: string, count = 10) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      particlesRef.current.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3, color, life: 0, maxLife: 20 + Math.random() * 15,
      });
    }
  }, []);

  const applyRun = useCallback((nextIndex: number, checkpointIdx: number, runId: number) => {
    if (!isValidCheckpoint(nextIndex, checkpointIdx)) return;
    const cp = CHAPTERS[nextIndex].checkpoints[checkpointIdx];
    chapterIndexRef.current = nextIndex;
    runIdRef.current = runId;
    currentCheckpointRef.current = checkpointIdx;
    setChapterIndex(nextIndex);
    setActiveCheckpoint(checkpointIdx);
    setGameWon(false);
    setGameOver(false);

    const localSpawn = isHost ? cp.p1 : cp.p2;
    const remoteSpawn = isHost ? cp.p2 : cp.p1;
    Object.assign(localPlayerRef.current, localSpawn, { vx: 0, vy: 0, isJumping: false, grounded: false });
    Object.assign(remotePlayerRef.current, remoteSpawn, { vx: 0, vy: 0, isJumping: false, grounded: false });
    remotePrevXRef.current = remoteSpawn.x;
    remotePrevYRef.current = remoteSpawn.y;
    isStandingOnRemoteRef.current = false;
    particlesRef.current = [];
    spawnParticles(localSpawn.x + 12, localSpawn.y + 16, '#39ff14', 20);
    spawnParticles(remoteSpawn.x + 12, remoteSpawn.y + 16, '#39ff14', 20);
  }, [isHost, spawnParticles]);

  const beginRun = (nextIndex: number, checkpointIdx = 0) => {
    if (!isHost || !isValidCheckpoint(nextIndex, checkpointIdx)) return;
    const runId = runIdRef.current + 1;
    applyRun(nextIndex, checkpointIdx, runId);
    sendGameEvent({ game: 'chained', type: 'reset_run', chapterIndex: nextIndex, checkpointIdx, runId });
  };

  const changeStartCamp = (idx: number) => beginRun(chapterIndexRef.current, idx);

  // Play music when connected and active
  useEffect(() => {
    if (audioRef.current) {
      if (isConnected && !gameOver && !gameWon) {
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
  }, [isConnected, gameOver, gameWon]);

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

    remotePrevXRef.current = isHost ? 440 : 320;
    remotePrevYRef.current = 390;
    isStandingOnRemoteRef.current = false;

    currentCheckpointRef.current = 0;
    setActiveCheckpoint(0);
    setGameOver(false);
    setGameWon(false);
    particlesRef.current = [];

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keypresses if user is typing in a chat input or other text field
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      const keyLower = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd'].includes(keyLower)) {
        e.preventDefault();
      }
      keysRef.current[e.key] = true;
      keysRef.current[keyLower] = true;
      keysRef.current[e.code] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const keyLower = e.key.toLowerCase();
      keysRef.current[e.key] = false;
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

  // Sync P2P message handlers
  useEffect(() => {
    if (!gameData || lastGameDataRef.current === gameData) return;
    lastGameDataRef.current = gameData;
    if (gameData.game !== 'chained' || !Number.isInteger(gameData.runId)) return;

    if (!isHost) {
      if (!isValidCheckpoint(gameData.chapterIndex, gameData.checkpointIdx)) return;
      if (gameData.runId < runIdRef.current) return;
      if (gameData.runId > runIdRef.current) {
        // Snapshots also carry transitions, so a batched React event cannot lose a chapter change.
        applyRun(gameData.chapterIndex, gameData.checkpointIdx, gameData.runId);
      }
      if (gameData.chapterIndex !== chapterIndexRef.current) return;
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
      if (gameData.runId !== runIdRef.current || gameData.chapterIndex !== chapterIndexRef.current) return;
      // Host receives Client position
      if (gameData.player) {
        remotePlayerRef.current.x = gameData.player.x;
        remotePlayerRef.current.y = gameData.player.y;
        remotePlayerRef.current.vx = gameData.player.vx;
        remotePlayerRef.current.vy = gameData.player.vy;
        remotePlayerRef.current.isJumping = gameData.player.isJumping;
      }
    }
  }, [gameData, isHost, applyRun]);

  // Sync game events
  useEffect(() => {
    if (!gameEvent || lastGameEventRef.current === gameEvent) return;
    lastGameEventRef.current = gameEvent;
    if (isHost || gameEvent.game !== 'chained' || !Number.isInteger(gameEvent.runId)) return;
    if (gameEvent.runId < runIdRef.current) return;

    if (gameEvent.type === 'reset_run' && gameEvent.runId > runIdRef.current) {
      applyRun(gameEvent.chapterIndex, gameEvent.checkpointIdx, gameEvent.runId);
    } else if (gameEvent.type === 'win_confetti' &&
      gameEvent.runId === runIdRef.current && gameEvent.chapterIndex === chapterIndexRef.current) {
      setGameWon(true);
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
    }

    resetGameEvent();
  }, [gameEvent, isHost, applyRun, resetGameEvent]);

  const handleRestart = () => beginRun(chapterIndexRef.current);

  const handleNextChapter = () => {
    if (gameWon && nextChapter) beginRun(chapterIndexRef.current + 1);
  };

  // Main game loop & Physics
  useEffect(() => {
    let animationId: number;

    // Platform landing AABB check
    const checkCollisions = (p: PlayerState, displacementY: number) => {
      let grounded = false;

      CHAPTERS[chapterIndexRef.current].platforms.forEach((plat) => {
        const overlapX = p.x + p.width > plat.x && p.x < plat.x + plat.w;
        const overlapY = p.y + p.height >= plat.y && p.y < plat.y + plat.h;

        if (overlapX && overlapY) {
          // Landing from top
          if (displacementY >= 0 && p.y + p.height - displacementY <= plat.y + 8) {
            p.y = plat.y - p.height;
            p.vy = 0;
            p.isJumping = false;
            grounded = true;
          }
          // Hitting ceiling from bottom
          else if (displacementY < 0 && p.y - displacementY >= plat.y + plat.h - 8) {
            p.y = plat.y + plat.h;
            p.vy = 0;
          }
        }
      });

      return grounded;
    };

    const updatePhysics = () => {
      if (gameOver || gameWon) return;
      const currentChapter = CHAPTERS[chapterIndexRef.current];

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

      // Track facing directions
      if (p1.vx < 0) p1FacingLeftRef.current = true;
      else if (p1.vx > 0) p1FacingLeftRef.current = false;

      if (p2.vx < 0) p2FacingLeftRef.current = true;
      else if (p2.vx > 0) p2FacingLeftRef.current = false;

      // --- SPRING CONSTRAINT CALCULATIONS (Based on positions at start of frame) ---
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy);

      let pullX = 0;
      let pullY = 0;
      let snapX = 0;
      let snapY = 0;

      if (dist > MAX_CHAIN_LENGTH) {
        const pullForce = (dist - MAX_CHAIN_LENGTH) * SPRING_CONSTANT;
        const nx = dx / dist;
        const ny = dy / dist;

        if (isHost) {
          pullX = nx * pullForce;
          pullY = ny * pullForce;
        } else {
          pullX = -nx * pullForce;
          pullY = -ny * pullForce;
        }

        // Snap constraint (prevents infinite desync separation)
        const overshoot = dist - POSITION_SNAP_THRESHOLD;
        if (overshoot > 0) {
          if (isHost) {
            snapX = nx * overshoot * 0.5;
            snapY = ny * overshoot * 0.5;
          } else {
            snapX = -nx * overshoot * 0.5;
            snapY = -ny * overshoot * 0.5;
          }
        }
      }

      // --- LOCAL MOVEMENT ---
      let inputVx = 0;
      let gamepadJump = false;

      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = Array.from(gamepads).find((g) => g !== null);
      const touchInputs = mobileTouchRef.current;

      if (gp) {
        const deadzone = 0.2;
        const axisX = gp.axes[0] || 0;
        const axisY = gp.axes[1] || 0;

        if (Math.abs(axisX) > deadzone) {
          inputVx = axisX * WALK_SPEED;
        } else if (
          keysRef.current['a'] ||
          keysRef.current['A'] ||
          keysRef.current['ArrowLeft'] ||
          touchInputs.left ||
          (gp.buttons[14] && gp.buttons[14].pressed)
        ) {
          inputVx = -WALK_SPEED;
        } else if (
          keysRef.current['d'] ||
          keysRef.current['D'] ||
          keysRef.current['ArrowRight'] ||
          touchInputs.right ||
          (gp.buttons[15] && gp.buttons[15].pressed)
        ) {
          inputVx = WALK_SPEED;
        }

        if (
          (gp.buttons[0] && gp.buttons[0].pressed) ||
          (gp.buttons[12] && gp.buttons[12].pressed) ||
          axisY < -deadzone
        ) {
          gamepadJump = true;
        }
      } else {
        if (
          keysRef.current['a'] ||
          keysRef.current['A'] ||
          keysRef.current['ArrowLeft'] ||
          touchInputs.left
        ) {
          inputVx = -WALK_SPEED;
        }
        if (
          keysRef.current['d'] ||
          keysRef.current['D'] ||
          keysRef.current['ArrowRight'] ||
          touchInputs.right
        ) {
          inputVx = WALK_SPEED;
        }
      }

      if (
        (keysRef.current['w'] ||
          keysRef.current['W'] ||
          keysRef.current['ArrowUp'] ||
          keysRef.current[' '] ||
          gamepadJump ||
          touchInputs.jump) &&
        !local.isJumping &&
        local.grounded
      ) {
        local.vy = JUMP_FORCE;
        local.isJumping = true;
        local.grounded = false;
        spawnParticles(local.x + 12, local.y + 32, 'rgba(255, 255, 255, 0.4)', 6);
      }

      // Apply Gravity
      local.vy += GRAVITY;

      // Calculate remote player movement delta
      const remote = remotePlayerRef.current;
      const remoteDeltaX = remote.x - remotePrevXRef.current;
      const remoteDeltaY = remote.y - remotePrevYRef.current;

      // Integrate velocities including keyboard movement, spring pulls, and snap corrections
      // If the local player is grounded and standing still, they anchor themselves and resist chain pull
      let finalPullX = pullX;
      let finalPullY = pullY;
      let finalSnapX = snapX;
      let finalSnapY = snapY;

      if (local.grounded && inputVx === 0) {
        finalPullX = 0;
        finalPullY = 0;
        finalSnapX = 0;
        finalSnapY = 0;
      }

      local.vx = inputVx + finalPullX;
      local.vy += finalPullY;

      // Update positions carrying the local player if they are standing on the remote player
      const shiftX = isStandingOnRemoteRef.current ? remoteDeltaX : 0;
      local.x += local.vx + finalSnapX + shiftX;
      local.x = Math.max(10, Math.min(CANVAS_WIDTH - 10 - local.width, local.x));

      const shiftY = isStandingOnRemoteRef.current ? remoteDeltaY : 0;
      const displacementY = local.vy + finalSnapY + shiftY;
      local.y += displacementY;

      // Check landing and ceiling collisions on platforms using total displacementY
      local.grounded = checkCollisions(local, displacementY);
      
      if (local.grounded) {
        local.isJumping = false;
        isStandingOnRemoteRef.current = false;
      } else {
        // Check collision with remote player
        const overlapX = local.x + local.width > remote.x && local.x < remote.x + remote.width;
        const overlapY = local.y + local.height >= remote.y && local.y < remote.y + remote.height;

        if (overlapX && overlapY) {
          // Landing from top on the remote player
          if (displacementY >= 0 && local.y + local.height - displacementY <= remote.y + 8) {
            local.y = remote.y - local.height;
            local.vy = 0;
            local.isJumping = false;
            local.grounded = true;
            isStandingOnRemoteRef.current = true;
          } else {
            isStandingOnRemoteRef.current = false;
          }
        } else {
          isStandingOnRemoteRef.current = false;
        }
      }

      // --- Sync player state to peer ---
      if (!isHost) {
        sendGameData({
          game: 'chained',
          chapterIndex: chapterIndexRef.current,
          runId: runIdRef.current,
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
        currentChapter.checkpoints.forEach((checkpoint) => {
          const platform = currentChapter.platforms.find(p => p.checkpointId === checkpoint.id);
          const atCamp = (p: PlayerState) => platform && p.x + p.width > platform.x &&
            p.x < platform.x + platform.w && Math.abs(p.y + p.height - checkpoint.y) < 8;
          if (checkpoint.id > currentCheckpointRef.current && atCamp(p1) && atCamp(p2)) {
            currentCheckpointRef.current = checkpoint.id;
            setActiveCheckpoint(checkpoint.id);
            // Spawn trigger particle effect
            spawnParticles(checkpoint.p1.x + 50, checkpoint.y, '#39ff14', 25);
          }
        });

        // 2. Check Abyss / Fall Death Condition
        const activeCp = currentChapter.checkpoints[currentCheckpointRef.current];
        if (p1.y > activeCp.deathY || p2.y > activeCp.deathY) {
          const runId = runIdRef.current + 1;
          applyRun(chapterIndexRef.current, activeCp.id, runId);
          sendGameEvent({ game: 'chained', type: 'reset_run', chapterIndex: chapterIndexRef.current, checkpointIdx: activeCp.id, runId });
        }

        // 3. Check Portal Win Condition
        const reachedPortal = isAtPortal(p1, currentChapter) && isAtPortal(p2, currentChapter);

        if (reachedPortal && !gameWon) {
          setGameWon(true);
          sendGameEvent({ game: 'chained', type: 'win_confetti', chapterIndex: chapterIndexRef.current, runId: runIdRef.current });
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 }
          });
        }

        // Send full sync down to client
        sendGameData({
          game: 'chained',
          chapterIndex: chapterIndexRef.current,
          runId: runIdRef.current,
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
            gameWon: reachedPortal
          }
        });
      }

      // Save remote position for next frame's delta calculation
      remotePrevXRef.current = remote.x;
      remotePrevYRef.current = remote.y;
    };

    // Rendering Engine
    const drawGame = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const currentWidth = canvas.width;
      const currentHeight = canvas.height;
      const scale = Math.min(currentWidth / CANVAS_WIDTH, currentHeight / CANVAS_HEIGHT);
      const offsetX = (currentWidth - CANVAS_WIDTH * scale) / 2;
      const offsetY = (currentHeight - CANVAS_HEIGHT * scale) / 2;

      // Black background for letterbox borders
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, currentWidth, currentHeight);

      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      const p1 = isHost ? localPlayerRef.current : remotePlayerRef.current;
      const p2 = isHost ? remotePlayerRef.current : localPlayerRef.current;
      const currentChapter = CHAPTERS[chapterIndexRef.current];

      // Camera: follows players midpoint vertically
      const midY = (p1.y + p2.y) / 2;
      const cameraY = getCameraY(midY, currentChapter, CANVAS_HEIGHT);

      // 1. Draw Space Gradient Background
      ctx.fillStyle = currentChapter.background;
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
      ctx.strokeStyle = `${currentChapter.color}40`;
      ctx.lineWidth = 6;
      ctx.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Apply camera translation for game objects
      ctx.save();
      ctx.translate(0, -cameraY);

      // 2. Draw Checkpoint Lines
      currentChapter.checkpoints.forEach((cp) => {
        if (cp.y < cameraY - 40 || cp.y > cameraY + CANVAS_HEIGHT + 40) return;
        const isActive = currentCheckpointRef.current >= cp.id;
        ctx.strokeStyle = isActive ? 'rgba(57, 255, 20, 0.35)' : 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, cp.y);
        ctx.lineTo(CANVAS_WIDTH, cp.y);
        ctx.stroke();

        // Label above line
        ctx.fillStyle = isActive ? '#39ff14' : '#94a3b8';
        ctx.font = '8px Orbitron';
        ctx.textAlign = 'left';
        ctx.fillText(cp.label, 20, cp.y - 6);
      });

      // 3. Draw Slabs / Platforms
      currentChapter.platforms.forEach((plat) => {
        if (plat.y + plat.h < cameraY - 140 || plat.y > cameraY + CANVAS_HEIGHT + 40) return;
        if (plat.isCheckpoint) {
          // Draw Neon Green slab for Camps
          const active = currentCheckpointRef.current >= (plat.checkpointId ?? 0);
          ctx.fillStyle = active ? 'rgba(57, 255, 20, 0.15)' : 'rgba(255, 255, 255, 0.03)';
          ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
          ctx.strokeStyle = active ? '#39ff14' : 'rgba(255, 255, 255, 0.1)';
          ctx.lineWidth = 2;
          ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
        } else if (plat.isPuzzleHint) {
          // Draw Neon Orange puzzle platform
          ctx.fillStyle = 'rgba(255, 110, 0, 0.15)';
          ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
          ctx.strokeStyle = '#ff6e00';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);

          // Draw hint text centered above the platform
          ctx.fillStyle = '#ff6e00';
          ctx.font = 'bold 8px Orbitron';
          ctx.textAlign = 'center';
          ctx.fillText(plat.hintText || '', plat.x + plat.w / 2, plat.y - 8);

          // Subtle dashed guide line descending to help align the stack below it
          ctx.strokeStyle = 'rgba(255, 110, 0, 0.2)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(plat.x + plat.w / 2, plat.y + plat.h);
          ctx.lineTo(plat.x + plat.w / 2, plat.y + 130);
          ctx.stroke();
          ctx.setLineDash([]); // reset line dash
        } else {
          // Standard glass platforms
          ctx.fillStyle = 'rgba(22, 24, 44, 0.85)';
          ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
          ctx.strokeStyle = `${currentChapter.color}70`;
          ctx.lineWidth = 1;
          ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
        }
      });

      // 4. Draw exit portal (Top of tower)
      const { x: portalX, y: portalY } = currentChapter.portal;
      // Pulsing portal ring
      const pulseSize = 25 + Math.sin(Date.now() / 150) * 4;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ffea00';
      ctx.strokeStyle = '#ffea00';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(portalX, portalY - 25, pulseSize, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0; // reset

      // Portal base/stand
      ctx.fillStyle = '#ffea00';
      ctx.fillRect(portalX - 20, portalY, 40, 4);

      // Exit portal hint
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = 'bold 8px Orbitron';
      ctx.textAlign = 'center';
      ctx.fillText('Both players must reach the portal together', portalX, portalY + 30);

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
        const lx = p1Center.x + chainDx * t;
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
      const drawCharacterPlayer = (p: PlayerState, baseColor: string, accentColor: string, label: string, isMale: boolean) => {
        const img = isMale ? maleImageRef.current : femaleImageRef.current;
        const imgLoaded = img && img.complete && img.naturalWidth > 0;

        if (imgLoaded) {
          ctx.save();
          // Translate to center-bottom of the player box
          ctx.translate(p.x + p.width / 2, p.y + p.height);

          const facingLeft = isMale ? p1FacingLeftRef.current : p2FacingLeftRef.current;
          if (facingLeft) {
            ctx.scale(-1, 1);
          }

          // Draw the character sprite centered horizontally and aligned to feet at the bottom
          ctx.drawImage(
            img,
            -24,      // half of 48 width
            -48 + 4,  // align feet pivot (48 height)
            48,
            48
          );
          ctx.restore();
        } else {
          // Fallback to classic spacesuit player
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
        }

        // Label tag
        ctx.fillStyle = '#ffffff';
        ctx.font = '9px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText(label, p.x + p.width / 2, p.y - 12);
      };

      drawCharacterPlayer(p1, '#00e1ff', 'rgba(0, 240, 255, 0.85)', isHost ? 'YOU' : 'P1', true);
      drawCharacterPlayer(p2, '#ff00a0', 'rgba(255, 0, 127, 0.85)', !isHost ? 'YOU' : 'P2', false);

      ctx.restore(); // Restores camera translate
      ctx.restore(); // Restores scale & offset
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
  }, [isConnected, isHost, gameOver, gameWon, applyRun, spawnParticles]);

  return (
    <div className="game-main-content">
      {/* Game Header Bar */}
      <div className="game-header-bar glass-panel" style={{ width: '100%', maxWidth: '900px', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h2 className="game-title-text font-display">
          Chained Together <span style={{ color: chapter.color }}>Chapter {chapterIndex + 1} / {CHAPTERS.length}</span>
        </h2>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginLeft: 'auto' }}>
          {isHost ? (
            <div className="peer-badge" style={{ borderColor: 'var(--neon-green)', color: 'var(--neon-green)', gap: '0.4rem', padding: '0.2rem 0.6rem', position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Shield size={14} />
              <select
                aria-label="Starting checkpoint"
                value={activeCheckpoint}
                onChange={(e) => changeStartCamp(parseInt(e.target.value))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--neon-green)',
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  outline: 'none',
                  cursor: 'pointer',
                  paddingRight: '12px',
                  appearance: 'none',
                  WebkitAppearance: 'none'
                }}
              >
                {chapter.checkpoints.map((cp) => (
                  <option key={cp.id} value={cp.id} style={{ background: '#0a0b10', color: '#fff' }}>
                    {cp.label}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: '0.6rem', marginLeft: '-8px', pointerEvents: 'none' }}>▼</span>
            </div>
          ) : (
            <div className="peer-badge" style={{ borderColor: 'var(--neon-green)', color: 'var(--neon-green)', gap: '0.4rem' }}>
              <Shield size={14} />
              <span>{chapter.checkpoints[activeCheckpoint]?.label || 'BASE CAMP'}</span>
            </div>
          )}

          <div className="peer-badge" style={{ borderColor: 'var(--neon-purple)', color: 'var(--neon-purple)', gap: '0.4rem' }}>
            <Flag size={14} />
            <span>Camp {activeCheckpoint + 1} / {chapter.checkpoints.length}</span>
          </div>

          {gamepadConnected && (
            <div className="peer-badge" style={{ borderColor: 'var(--neon-green)', color: 'var(--neon-green)', gap: '0.4rem', animation: 'pulse 1.5s infinite alternate' }}>
              <Gamepad2 size={14} />
              <span>Controller Connected</span>
            </div>
          )}

          {isMobile && (
            <div className="peer-badge" style={{ borderColor: 'var(--neon-purple)', color: 'var(--neon-purple)', gap: '0.4rem' }}>
              <Smartphone size={14} />
              <span>Mobile Touch Controls Active</span>
            </div>
          )}

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

          <button className="copy-btn" onClick={toggleFullscreen} style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>
          <button className="glow-btn-magenta" onClick={stopGame} style={{ padding: '0.4rem 1.2rem', fontSize: '0.8rem' }}>
            Exit Game
          </button>
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: '900px', display: 'flex', flexWrap: 'wrap', gap: '0.4rem 1rem', alignItems: 'baseline' }}>
        <strong className="font-display" style={{ color: chapter.color }}>{chapter.name}</strong>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{chapter.description}</span>
      </div>

      {/* Canvas Area */}
      <div className="canvas-container" style={{ position: 'relative' }}>
        <canvas ref={canvasRef} width={isFullscreen ? 1920 : CANVAS_WIDTH} height={isFullscreen ? 1080 : CANVAS_HEIGHT} />

        {/* 3-Part Screen Mobile Touch Controls Overlay */}
        {isMobile && !gameOver && !gameWon && (
          <div
            className="mobile-touch-overlay"
            onTouchStart={handleTouchUpdate}
            onTouchMove={handleTouchUpdate}
            onTouchEnd={handleTouchUpdate}
            onTouchCancel={handleTouchUpdate}
          >
            <div className={`mobile-touch-zone zone-left ${activeTouches.left ? 'active' : ''}`}>
              <div className="touch-zone-content">
                <div className="touch-zone-icon">
                  <ArrowLeft size={24} />
                </div>
                <span className="touch-zone-label">Move Left</span>
              </div>
            </div>

            <div className={`mobile-touch-zone zone-middle ${activeTouches.middle ? 'active' : ''}`}>
              <div className="touch-zone-content">
                <div className="touch-zone-icon">
                  <ArrowUp size={24} />
                </div>
                <span className="touch-zone-label">Jump</span>
              </div>
            </div>

            <div className={`mobile-touch-zone zone-right ${activeTouches.right ? 'active' : ''}`}>
              <div className="touch-zone-content">
                <div className="touch-zone-icon">
                  <ArrowRight size={24} />
                </div>
                <span className="touch-zone-label">Move Right</span>
              </div>
            </div>
          </div>
        )}

        {/* Victory Screen Overlay */}
        {gameWon && (
          <div className="canvas-overlay" style={{ overflowY: 'auto', justifyContent: 'flex-start', padding: '1rem', boxSizing: 'border-box', gap: '0.75rem' }}>
            <Award size={36} className="text-yellow" style={{ flexShrink: 0, filter: 'drop-shadow(0 0 10px var(--neon-yellow))' }} />
            <h2 className="overlay-title font-display text-green" style={{ fontSize: 'clamp(1.15rem, 4vw, 2.2rem)', letterSpacing: '2px', textAlign: 'center' }}>{nextChapter ? 'CHAPTER COMPLETE!' : 'SUMMIT CONQUERED!'}</h2>
            <p style={{ color: 'var(--neon-green)', fontWeight: 700, textAlign: 'center', margin: 0 }}>
              {nextChapter ? `You completed ${chapter.name} together!` : `You completed all ${CHAPTERS.length} chapters together!`}
            </p>
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>
              {nextChapter ? `Up next: ${nextChapter.name}` : 'From base camp to the crystal summit. What a climb.'}
              {nextChapter && !isHost && <span style={{ display: 'block', marginTop: '0.5rem' }}>Waiting for the host to start the next chapter…</span>}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.75rem' }}>
              {isHost && nextChapter && (
                <button className="glow-btn-cyan font-display" onClick={handleNextChapter} style={{ padding: '0.8rem 1.5rem' }}>
                  Next Chapter <ArrowRight size={16} style={{ verticalAlign: 'middle' }} />
                </button>
              )}
              {isHost && (
                <button className="copy-btn font-display" onClick={handleRestart} style={{ padding: '0.8rem 1.5rem' }}>
                  Replay Chapter
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
      <div className="game-controls-summary" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '900px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        <div>
          {isMobile ? (
            <span>Touch Controls: <span style={{ color: 'var(--text-primary)' }}>Left Screen (Move Left)</span> | <span style={{ color: 'var(--text-primary)' }}>Middle Screen (Jump)</span> | <span style={{ color: 'var(--text-primary)' }}>Right Screen (Move Right)</span></span>
          ) : (
            <span>Walk: <span style={{ color: 'var(--text-primary)' }}>A / D</span> or <span style={{ color: 'var(--text-primary)' }}>← / →</span> | Jump: <span style={{ color: 'var(--text-primary)' }}>W / Space</span> or <span style={{ color: 'var(--text-primary)' }}>↑</span> | Controller: <span style={{ color: 'var(--text-primary)' }}>Left Stick / D-pad (Move) & Button A / D-pad Up (Jump)</span></span>
          )}
        </div>
        <div>
          <span>Rule: </span><span style={{ color: 'var(--neon-purple)', fontWeight: 600 }}>Stay within 140px chain limit</span>
        </div>
      </div>
    </div>
  );
};
