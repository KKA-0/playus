import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePeer } from '../../context/PeerContext';
import { Gamepad2, Maximize2, Minimize2, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import confetti from 'canvas-confetti';

// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 480;
const TILE_SIZE = 40;
const ROWS = CANVAS_HEIGHT / TILE_SIZE; // 12
const COLS = CANVAS_WIDTH / TILE_SIZE; // 20

const GRAVITY = 0.58;
const WALK_SPEED = 4.2;
const JUMP_FORCE = -11.6;

// Tile types
const TILE_SOLID = 1;
const TILE_SPIKES = 2;
const TILE_TERMINAL = 3; // Door Unlock Terminal / Switch
const TILE_DOOR = 4;     // Exit Security Door
const TILE_GATE = 5;     // Pressure Gate
const TILE_SWITCH = 6;   // Pressure Switch

// 4 Levels Map Data (12 rows x 20 cols)
// 1 = solid block, 2 = spikes, 3 = door terminal, 4 = exit door, 5 = gate, 6 = switch
const LEVELS = [
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
  ridingPlayer?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

/** Check if player is near/inside the exit door zone */
const isPlayerInExitZone = (p: PlayerState, doorRow: number, doorCol: number) => {
  const zoneLeft = Math.max(0, (doorCol - 0.5) * TILE_SIZE);
  const zoneRight = Math.min(CANVAS_WIDTH, (doorCol + 1.5) * TILE_SIZE);
  const zoneTop = doorRow * TILE_SIZE - 10;
  const zoneBottom = (doorRow + 2) * TILE_SIZE;

  const playerFeetY = p.y + p.height;

  return (
    p.x < zoneRight &&
    p.x + p.width > zoneLeft &&
    playerFeetY >= zoneTop &&
    playerFeetY <= zoneBottom
  );
};

// Web Audio API Sound Synthesizer (Zero asset loading delay, instant audio)
class SoundFX {
  private ctx: AudioContext | null = null;

  private getContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  jump(volume = 0.5) {
    const ctx = this.getContext();
    if (!ctx || volume <= 0) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(380, now + 0.12);
    gain.gain.setValueAtTime(volume * 0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  switch(volume = 0.5) {
    const ctx = this.getContext();
    if (!ctx || volume <= 0) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(660, now + 0.05);
    gain.gain.setValueAtTime(volume * 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  terminalUnlock(volume = 0.5) {
    const ctx = this.getContext();
    if (!ctx || volume <= 0) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.07);
      gain.gain.setValueAtTime(volume * 0.25, now + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.18);
    });
  }

  death(volume = 0.5) {
    const ctx = this.getContext();
    if (!ctx || volume <= 0) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.25);
    gain.gain.setValueAtTime(volume * 0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  levelWin(volume = 0.5) {
    const ctx = this.getContext();
    if (!ctx || volume <= 0) return;
    const now = ctx.currentTime;
    [440, 554.37, 659.25, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      gain.gain.setValueAtTime(volume * 0.3, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.25);
    });
  }
}

const sfx = new SoundFX();

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
  const [doorUnlockedState, setDoorUnlockedState] = useState<boolean>(false);

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
    animTimer: 0,
    ridingPlayer: false
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
    animTimer: 0,
    ridingPlayer: false
  });

  // Target coordinates for smooth remote player interpolation
  const remoteTargetRef = useRef<{ x: number; y: number; vx: number; vy: number; isJumping: boolean; flipX: boolean; animFrame: number }>({
    x: 120,
    y: 350,
    vx: 0,
    vy: 0,
    isJumping: false,
    flipX: false,
    animFrame: 0
  });

  // Level states managed by Host
  const levelStateRef = useRef({
    currentLevel: 0,
    doorUnlocked: false,
    gateOpen: false,
    levelCompleted: false
  });

  // Particle System
  const particlesRef = useRef<Particle[]>([]);

  // Keyboard controls & Timers
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const prevGamepadButtonsRef = useRef<boolean[]>([]);
  const prevGamepadAxisYRef = useRef<number>(0);
  const coyoteTimerRef = useRef<number>(0);
  const jumpBufferTimerRef = useRef<number>(0);
  const prevGateOpenRef = useRef<boolean>(false);

  // Preloaded Game Sprites
  const brickImgRef = useRef<HTMLImageElement | null>(null);
  const gateSwitchOffImgRef = useRef<HTMLImageElement | null>(null);
  const gateSwitchOnImgRef = useRef<HTMLImageElement | null>(null);
  const maleImageRef = useRef<HTMLImageElement | null>(null);
  const femaleImageRef = useRef<HTMLImageElement | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [volume, setVolume] = useState<number>(0.5);

  useEffect(() => {
    const brick = new Image();
    brick.src = '/gateIt/ch1-brick.png';
    brickImgRef.current = brick;

    const switchOff = new Image();
    switchOff.src = '/gateIt/gateSwitchOFF.png';
    gateSwitchOffImgRef.current = switchOff;

    const switchOn = new Image();
    switchOn.src = '/gateIt/gateSwitchON.png';
    gateSwitchOnImgRef.current = switchOn;

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
      if (isConnected && volume > 0) {
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
  }, [isConnected, volume]);

  // Particle Spawner Helper
  const spawnParticles = (x: number, y: number, color: string, count = 12, speed = 2.5) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (Math.random() * 0.7 + 0.3) * speed;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - (Math.random() * 1.5),
        size: Math.random() * 3.5 + 2,
        color,
        alpha: 1,
        life: 0,
        maxLife: Math.random() * 20 + 20
      });
    }
  };

  // Reset players to level start positions
  const resetPlayerPositions = (levelIdx: number) => {
    if (levelIdx === 0) {
      localPlayerRef.current.x = 80;
      localPlayerRef.current.y = 350;
      remotePlayerRef.current.x = 120;
      remotePlayerRef.current.y = 350;
      remoteTargetRef.current.x = 120;
      remoteTargetRef.current.y = 350;
    } else if (levelIdx === 1) {
      // Level 2 splits: Host bottom-left, Client top-left
      if (isHost) {
        localPlayerRef.current.x = 80;
        localPlayerRef.current.y = 350;
        remotePlayerRef.current.x = 80;
        remotePlayerRef.current.y = 80;
        remoteTargetRef.current.x = 80;
        remoteTargetRef.current.y = 80;
      } else {
        localPlayerRef.current.x = 80;
        localPlayerRef.current.y = 80;
        remotePlayerRef.current.x = 80;
        remotePlayerRef.current.y = 350;
        remoteTargetRef.current.x = 80;
        remoteTargetRef.current.y = 350;
      }
    } else {
      // Level 3
      localPlayerRef.current.x = 60;
      localPlayerRef.current.y = 320;
      remotePlayerRef.current.x = 100;
      remotePlayerRef.current.y = 320;
      remoteTargetRef.current.x = 100;
      remoteTargetRef.current.y = 320;
    }

    localPlayerRef.current.vx = 0;
    localPlayerRef.current.vy = 0;
    localPlayerRef.current.isJumping = false;
    localPlayerRef.current.ridingPlayer = false;

    remotePlayerRef.current.vx = 0;
    remotePlayerRef.current.vy = 0;
    remotePlayerRef.current.isJumping = false;

    // Spawn respawn particle burst
    spawnParticles(localPlayerRef.current.x + 12, localPlayerRef.current.y + 16, '#00f0ff', 16);
    spawnParticles(remotePlayerRef.current.x + 12, remotePlayerRef.current.y + 16, '#ff00a0', 16);
  };

  const restartCurrentLevel = () => {
    const levelIdx = levelStateRef.current.currentLevel;
    levelStateRef.current.doorUnlocked = false;
    levelStateRef.current.gateOpen = false;
    levelStateRef.current.levelCompleted = false;
    setDoorUnlockedState(false);
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

  // Setup Keyboard inputs
  useEffect(() => {
    resetPlayerPositions(0);

    const handleKeyDown = (e: KeyboardEvent) => {
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

    if (!isHost) {
      if (gameData.player) {
        remoteTargetRef.current = {
          x: gameData.player.x,
          y: gameData.player.y,
          vx: gameData.player.vx,
          vy: gameData.player.vy,
          isJumping: gameData.player.isJumping,
          flipX: gameData.player.flipX,
          animFrame: gameData.player.animFrame
        };
      }

      if (gameData.levelState) {
        const oldLevel = levelStateRef.current.currentLevel;
        const oldDoorState = levelStateRef.current.doorUnlocked;
        levelStateRef.current = gameData.levelState;

        setCurrentLevel(gameData.levelState.currentLevel);
        setDoorUnlockedState(gameData.levelState.doorUnlocked);

        if (!oldDoorState && gameData.levelState.doorUnlocked) {
          sfx.terminalUnlock(volume);
        }

        if (gameData.levelState.currentLevel !== oldLevel) {
          resetPlayerPositions(gameData.levelState.currentLevel);
        }
      }
    } else {
      if (gameData.player) {
        remoteTargetRef.current = {
          x: gameData.player.x,
          y: gameData.player.y,
          vx: gameData.player.vx,
          vy: gameData.player.vy,
          isJumping: gameData.player.isJumping,
          flipX: gameData.player.flipX,
          animFrame: gameData.player.animFrame
        };
      }
    }
  }, [gameData, isHost, volume]);

  // Handle one-off game events
  useEffect(() => {
    if (!gameEvent) return;

    if (gameEvent.type === 'level_reset') {
      resetPlayerPositions(levelStateRef.current.currentLevel);
    } else if (gameEvent.type === 'request_reset' && isHost) {
      sfx.death(volume);
      sendGameEvent({ type: 'level_reset' });
      resetPlayerPositions(levelStateRef.current.currentLevel);
    } else if (gameEvent.type === 'game_win') {
      setGameCompleted(true);
      sfx.levelWin(volume);
      confetti({
        particleCount: 160,
        spread: 90,
        origin: { y: 0.6 }
      });
    }

    resetGameEvent();
  }, [gameEvent, isHost, resetGameEvent, volume]);

  const advanceToNextLevel = useCallback(() => {
    if (!isHost) return;

    sfx.levelWin(volume);
    const nextIdx = levelStateRef.current.currentLevel + 1;
    if (nextIdx < LEVELS.length) {
      levelStateRef.current.currentLevel = nextIdx;
      levelStateRef.current.doorUnlocked = false;
      levelStateRef.current.gateOpen = false;
      levelStateRef.current.levelCompleted = false;

      setCurrentLevel(nextIdx);
      setDoorUnlockedState(false);
      resetPlayerPositions(nextIdx);

      sendGameData({
        levelState: levelStateRef.current
      });
    } else {
      levelStateRef.current.levelCompleted = true;
      setGameCompleted(true);
      sendGameEvent({ type: 'game_win' });
      confetti({
        particleCount: 180,
        spread: 100,
        origin: { y: 0.6 }
      });
    }
  }, [isHost, sendGameData, sendGameEvent, volume]);

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

    // One-way player head riding & boost collision
    const checkPlayerOnPlayerCollision = (p: PlayerState, other: PlayerState) => {
      const LANDING_TOLERANCE = 14;
      const HORIZONTAL_MARGIN = 3;

      const overlapsX =
        p.x + p.width > other.x + HORIZONTAL_MARGIN &&
        p.x < other.x + other.width - HORIZONTAL_MARGIN;

      if (!overlapsX) {
        p.ridingPlayer = false;
        return;
      }

      const feetY = p.y + p.height;
      const otherTopY = other.y;

      if (p.vy >= 0 && feetY >= otherTopY && feetY <= otherTopY + LANDING_TOLERANCE) {
        p.y = otherTopY - p.height;
        p.vy = 0;
        p.isJumping = false;
        p.ridingPlayer = true;
        // Inherit other player's horizontal movement for smooth tandem riding
        if (Math.abs(other.vx) > 0.1 && p.vx === 0) {
          p.x += other.vx * 0.85;
        }
      } else {
        p.ridingPlayer = false;
      }
    };

    const checkTileCollisions = (p: PlayerState, map: number[][], dir: 'x' | 'y') => {
      const EPS = 0.05;
      const left = Math.floor((p.x + EPS) / TILE_SIZE);
      const right = Math.floor((p.x + p.width - EPS) / TILE_SIZE);
      const top = Math.floor((p.y + EPS) / TILE_SIZE);
      const bottom = Math.floor((p.y + p.height - EPS) / TILE_SIZE);

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
      const rPlayer = remotePlayerRef.current;
      const target = remoteTargetRef.current;

      // Smooth remote player interpolation (lerp)
      rPlayer.x += (target.x - rPlayer.x) * 0.45;
      rPlayer.y += (target.y - rPlayer.y) * 0.45;
      rPlayer.vx = target.vx;
      rPlayer.vy = target.vy;
      rPlayer.isJumping = target.isJumping;
      rPlayer.flipX = target.flipX;
      rPlayer.animFrame = target.animFrame;

      const levelIdx = levelStateRef.current.currentLevel;
      const map = LEVELS[levelIdx] || LEVELS[0];

      // Gamepad handling
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

      // Horizontal movement
      p.vx = 0;
      if (isLeft) {
        p.vx = -WALK_SPEED;
        p.flipX = true;
      }
      if (isRight) {
        p.vx = WALK_SPEED;
        p.flipX = false;
      }

      // Coyote time & Jump Buffering
      if (coyoteTimerRef.current > 0) coyoteTimerRef.current--;
      if (jumpBufferTimerRef.current > 0) jumpBufferTimerRef.current--;

      const canJump = !p.isJumping || coyoteTimerRef.current > 0;

      if (jumpBufferTimerRef.current > 0 && canJump) {
        // Extra boost if jumping off teammate's head!
        p.vy = p.ridingPlayer ? JUMP_FORCE * 1.08 : JUMP_FORCE;
        p.isJumping = true;
        p.ridingPlayer = false;
        coyoteTimerRef.current = 0;
        jumpBufferTimerRef.current = 0;
        sfx.jump(volume);
        spawnParticles(p.x + p.width / 2, p.y + p.height, '#00f0ff', 6, 1.5);
      }

      // Variable jump height
      if (!isJump && p.vy < -3) {
        p.vy = -3;
      }

      // Gravity
      p.vy += GRAVITY;
      if (p.vy > 12) p.vy = 12;

      // Walking animation
      if (p.vx !== 0) {
        p.animTimer += 1;
        if (p.animTimer >= 6) {
          p.animFrame = (p.animFrame + 1) % 4;
          p.animTimer = 0;
        }
      } else {
        p.animFrame = 0;
      }

      // Move X
      p.x += p.vx;
      checkTileCollisions(p, map, 'x');

      // Move Y
      p.y += p.vy;
      p.isJumping = true;
      checkTileCollisions(p, map, 'y');

      // Player on player platforming
      checkPlayerOnPlayerCollision(p, rPlayer);

      if (!p.isJumping) {
        coyoteTimerRef.current = 6;
      }

      // Screen boundaries
      if (p.x < 0) p.x = 0;
      if (p.x > CANVAS_WIDTH - p.width) p.x = CANVAS_WIDTH - p.width;
      if (p.y > CANVAS_HEIGHT + 40) {
        handlePlayerDeath();
      }

      // Host Authoritative Logic
      if (isHost) {
        const p1 = localPlayerRef.current;
        const p2 = remotePlayerRef.current;
        const state = levelStateRef.current;

        let switchPressedThisFrame = false;

        // Check switches
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (map[r][c] === TILE_SWITCH) {
              const switchX = c * TILE_SIZE + 2;
              const switchY = r * TILE_SIZE + 14;
              const switchW = TILE_SIZE - 4;
              const switchH = 26;

              const p1On = checkRectOverlap(p1.x, p1.y, p1.width, p1.height, switchX, switchY, switchW, switchH);
              const p2On = checkRectOverlap(p2.x, p2.y, p2.width, p2.height, switchX, switchY, switchW, switchH);

              if (p1On || p2On) {
                switchPressedThisFrame = true;
              }
            }
          }
        }

        if (switchPressedThisFrame !== prevGateOpenRef.current) {
          prevGateOpenRef.current = switchPressedThisFrame;
          if (switchPressedThisFrame) {
            sfx.switch(volume);
          }
        }

        state.gateOpen = switchPressedThisFrame;

        // Check door terminal
        if (!state.doorUnlocked) {
          for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
              if (map[r][c] === TILE_TERMINAL) {
                const termX = c * TILE_SIZE + 4;
                const termY = r * TILE_SIZE + 4;
                const termSize = TILE_SIZE - 8;

                const p1Hits = checkRectOverlap(p1.x, p1.y, p1.width, p1.height, termX, termY, termSize, termSize);
                const p2Hits = checkRectOverlap(p2.x, p2.y, p2.width, p2.height, termX, termY, termSize, termSize);

                if (p1Hits || p2Hits) {
                  state.doorUnlocked = true;
                  setDoorUnlockedState(true);
                  setScore((s) => s + 100);
                  sfx.terminalUnlock(volume);
                  spawnParticles(c * TILE_SIZE + 20, r * TILE_SIZE + 20, '#10b981', 25, 4);
                }
              }
            }
          }
        }

        // Check spikes
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

        // Exit door check (both players at door)
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

      // Update active particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const pt = particlesRef.current[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life++;
        pt.alpha = 1 - pt.life / pt.maxLife;
        if (pt.life >= pt.maxLife) {
          particlesRef.current.splice(i, 1);
        }
      }
    };

    const handlePlayerDeath = () => {
      sfx.death(volume);
      if (isHost) {
        sendGameEvent({ type: 'level_reset' });
        resetPlayerPositions(levelStateRef.current.currentLevel);
      } else {
        sendGameEvent({ type: 'request_reset' });
      }
    };

    // Canvas rendering engine
    const drawGame = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Crisp pixel rendering
      ctx.imageSmoothingEnabled = false;

      const levelIdx = levelStateRef.current.currentLevel;
      const map = LEVELS[levelIdx] || LEVELS[0];
      const gateOpen = levelStateRef.current.gateOpen;
      const doorUnlocked = levelStateRef.current.doorUnlocked;

      // 1. Draw Space Background
      ctx.fillStyle = '#060814';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Subtle Cyber Grid Lines
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.035)';
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
            const brick = brickImgRef.current;
            if (brick && brick.complete && brick.naturalWidth > 0) {
              ctx.drawImage(brick, x, y, TILE_SIZE, TILE_SIZE);
            } else {
              // High-tech solid block fallback
              ctx.fillStyle = '#1e293b';
              ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
              ctx.strokeStyle = '#334155';
              ctx.lineWidth = 1;
              ctx.strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
            }
          } else if (tile === TILE_SPIKES) {
            // Animated Neon Hazard Spikes
            const glow = Math.sin(Date.now() / 200) * 0.2 + 0.8;
            ctx.save();
            ctx.fillStyle = `rgba(239, 68, 68, ${0.25 * glow})`;
            ctx.strokeStyle = `rgba(239, 68, 68, ${glow})`;
            ctx.lineWidth = 2;
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#ef4444';

            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
              const sx = x + (i * 10);
              ctx.moveTo(sx, y + TILE_SIZE);
              ctx.lineTo(sx + 5, y + 16);
              ctx.lineTo(sx + 10, y + TILE_SIZE);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          } else if (tile === TILE_SWITCH) {
            // Pressure Plate
            ctx.save();
            const switchImg = gateOpen ? gateSwitchOnImgRef.current : gateSwitchOffImgRef.current;
            if (switchImg && switchImg.complete && switchImg.naturalWidth > 0) {
              ctx.drawImage(switchImg, x, y, TILE_SIZE, TILE_SIZE);
            } else {
              ctx.fillStyle = gateOpen ? '#10b981' : '#eab308';
              ctx.shadowBlur = 10;
              ctx.shadowColor = gateOpen ? '#10b981' : '#eab308';
              if (gateOpen) {
                ctx.fillRect(x + 4, y + 32, TILE_SIZE - 8, 8);
              } else {
                ctx.fillRect(x + 4, y + 24, TILE_SIZE - 8, 16);
              }
            }
            ctx.restore();
          } else if (tile === TILE_GATE) {
            ctx.save();
            if (!gateOpen) {
              // Glowing Laser Energy Barrier
              const pulse = Math.sin(Date.now() / 120) * 0.3 + 0.7;
              ctx.fillStyle = `rgba(234, 179, 8, ${0.2 * pulse})`;
              ctx.fillRect(x + 6, y, TILE_SIZE - 12, TILE_SIZE);

              ctx.strokeStyle = '#eab308';
              ctx.lineWidth = 3;
              ctx.shadowBlur = 12 * pulse;
              ctx.shadowColor = '#eab308';

              // Laser vertical bars
              ctx.beginPath();
              ctx.moveTo(x + 8, y);
              ctx.lineTo(x + 8, y + TILE_SIZE);
              ctx.moveTo(x + TILE_SIZE / 2, y);
              ctx.lineTo(x + TILE_SIZE / 2, y + TILE_SIZE);
              ctx.moveTo(x + TILE_SIZE - 8, y);
              ctx.lineTo(x + TILE_SIZE - 8, y + TILE_SIZE);
              ctx.stroke();

              // Top/Bottom Gate Emitter Mounts
              ctx.fillStyle = '#475569';
              ctx.fillRect(x + 4, y, TILE_SIZE - 8, 6);
              ctx.fillRect(x + 4, y + TILE_SIZE - 6, TILE_SIZE - 8, 6);
            } else {
              // Open Gate Retracted State
              ctx.fillStyle = '#10b981';
              ctx.fillRect(x + 4, y, TILE_SIZE - 8, 4);
              ctx.fillRect(x + 4, y + TILE_SIZE - 4, TILE_SIZE - 8, 4);
              ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
              ctx.lineWidth = 1;
              ctx.setLineDash([4, 4]);
              ctx.strokeRect(x + 6, y + 4, TILE_SIZE - 12, TILE_SIZE - 8);
              ctx.setLineDash([]);
            }
            ctx.restore();
          } else if (tile === TILE_TERMINAL) {
            // Key / Door Unlock Terminal
            ctx.save();
            const termSwitchImg = doorUnlocked ? gateSwitchOnImgRef.current : gateSwitchOffImgRef.current;
            if (termSwitchImg && termSwitchImg.complete && termSwitchImg.naturalWidth > 0) {
              ctx.drawImage(termSwitchImg, x, y, TILE_SIZE, TILE_SIZE);
            } else {
              ctx.fillStyle = doorUnlocked ? 'rgba(16, 185, 129, 0.25)' : 'rgba(0, 240, 255, 0.2)';
              ctx.fillRect(x + 6, y + 8, 28, 30);
              ctx.strokeStyle = doorUnlocked ? '#10b981' : '#00f0ff';
              ctx.lineWidth = 2;
              ctx.shadowBlur = 10;
              ctx.shadowColor = doorUnlocked ? '#10b981' : '#00f0ff';
              ctx.strokeRect(x + 6, y + 8, 28, 30);
            }

            // Key Floating Icon
            const floatOffset = Math.sin(Date.now() / 220) * 3;
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowBlur = 8;
            ctx.shadowColor = doorUnlocked ? '#10b981' : '#ffd700';
            ctx.fillText(doorUnlocked ? '✅' : '🔑', x + 20, y + 24 + floatOffset);
            ctx.restore();
          } else if (tile === TILE_DOOR) {
            // Futuristic Exit Portal Door
            const pulse = Math.sin(Date.now() / 160) * 3;
            ctx.save();
            if (doorUnlocked) {
              // Open Portal
              ctx.fillStyle = 'rgba(16, 185, 129, 0.3)';
              ctx.fillRect(x + 2, y - 6, TILE_SIZE - 4, TILE_SIZE + 6);

              ctx.strokeStyle = '#10b981';
              ctx.lineWidth = 3;
              ctx.shadowBlur = 15;
              ctx.shadowColor = '#10b981';
              ctx.strokeRect(x + 2, y - 6, TILE_SIZE - 4, TILE_SIZE + 6);

              // Swirling Portal Core
              ctx.fillStyle = 'rgba(16, 185, 129, 0.75)';
              ctx.beginPath();
              ctx.arc(x + 20, y + 18, 12 + pulse, 0, Math.PI * 2);
              ctx.fill();

              // Top Indicator Lamp (Green)
              ctx.fillStyle = '#10b981';
              ctx.beginPath();
              ctx.arc(x + 20, y, 4, 0, Math.PI * 2);
              ctx.fill();
            } else {
              // Locked Security Door
              ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
              ctx.fillRect(x + 2, y - 6, TILE_SIZE - 4, TILE_SIZE + 6);

              ctx.strokeStyle = '#475569';
              ctx.lineWidth = 2;
              ctx.strokeRect(x + 2, y - 6, TILE_SIZE - 4, TILE_SIZE + 6);

              // Lock Light (Red)
              ctx.fillStyle = '#ef4444';
              ctx.shadowBlur = 8;
              ctx.shadowColor = '#ef4444';
              ctx.beginPath();
              ctx.arc(x + 20, y + 16, 5, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          }
        }
      }

      // 3. Draw Particles
      for (const pt of particlesRef.current) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, pt.alpha);
        ctx.fillStyle = pt.color;
        ctx.shadowBlur = 6;
        ctx.shadowColor = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 4. Draw Characters (Male for P1, Female for P2)
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
          ctx.translate(p.x + p.width / 2, p.y + p.height);

          if (p.flipX) {
            ctx.scale(-1, 1);
          }

          ctx.shadowBlur = 10;
          ctx.shadowColor = glowColor;

          ctx.drawImage(
            img,
            -24,
            -48 + 4,
            48,
            48
          );
          ctx.restore();
        } else {
          // Space suit fallback
          ctx.save();
          ctx.translate(p.x + p.width / 2, p.y + p.height / 2);

          if (p.flipX) {
            ctx.scale(-1, 1);
          }

          ctx.shadowBlur = 10;
          ctx.shadowColor = glowColor;

          ctx.fillStyle = baseColor;
          ctx.fillRect(-p.width / 2, -p.height / 2 + 10, p.width, p.height - 18);

          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.arc(0, -p.height / 2 + 10, 12, Math.PI, 0);
          ctx.fill();
          ctx.strokeStyle = baseColor;
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = glowColor;
          ctx.fillRect(2, -p.height / 2 + 4, 8, 6);

          ctx.shadowBlur = 0;
          ctx.fillStyle = '#0f172a';

          const walkCycle = p.animFrame;
          const leftOffset = walkCycle === 1 ? -4 : walkCycle === 3 ? 4 : 0;
          const rightOffset = walkCycle === 1 ? 4 : walkCycle === 3 ? -4 : 0;

          ctx.fillRect(-8, p.height / 2 - 8, 4, 8 + leftOffset);
          ctx.fillRect(4, p.height / 2 - 8, 4, 8 + rightOffset);

          ctx.restore();
        }

        // Floating name badge
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 6;
        ctx.shadowColor = glowColor;
        ctx.fillText(label, p.x + p.width / 2, p.y - 8);
        ctx.shadowBlur = 0;
      };

      const p1 = isHost ? localPlayerRef.current : remotePlayerRef.current;
      const p2 = isHost ? remotePlayerRef.current : localPlayerRef.current;

      const p1Label = isHost ? 'P1 (YOU)' : 'P1';
      const p2Label = !isHost ? 'P2 (YOU)' : 'P2';

      drawCharacterPlayer(p1, '#00e1ff', 'rgba(0, 240, 255, 0.85)', p1Label, true);
      drawCharacterPlayer(p2, '#ff00a0', 'rgba(255, 0, 127, 0.85)', p2Label, false);
    };

    // Network Sync
    const syncNetwork = () => {
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

      if (isHost) {
        payload.levelState = levelStateRef.current;
      }

      sendGameData(payload);
    };

    if (isConnected && !gameCompleted) {
      animationId = requestAnimationFrame(gameLoop);
    }

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isConnected, isHost, gameCompleted, advanceToNextLevel, volume]);

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
      setDoorUnlockedState(false);
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
          <div className="peer-badge" style={{ borderColor: doorUnlockedState ? 'var(--neon-green)' : 'var(--neon-yellow)', color: doorUnlockedState ? 'var(--neon-green)' : 'var(--neon-yellow)' }}>
            {doorUnlockedState ? '🚪 Portal Active!' : '🔒 Portal Locked (Find Key)'}
          </div>

          {/* Volume Control */}
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
            title="Restart current level"
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
            <span className="control-key">A</span> / <span className="control-key">D</span> or <span className="control-key">←</span> / <span className="control-key">→</span> Move | <span className="control-key">W</span> / <span className="control-key">Space</span> Jump
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