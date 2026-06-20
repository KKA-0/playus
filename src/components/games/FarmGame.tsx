import React, { useEffect, useRef, useState } from 'react';
import { usePeer } from '../../context/PeerContext';
import { Maximize, Minimize, Volume2, VolumeX } from 'lucide-react';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 480;
const MAP_WIDTH = 1200;
const MAP_HEIGHT = 800;
const PLAYER_SPEED = 4.5;
const SPRITE_SIZE = 48; // Display size of the player characters

interface PlayerState {
  x: number;
  y: number;
  gender: 'male' | 'female' | null;
  facingLeft: boolean;
  isMoving: boolean;
  inHouse: boolean;
  facingUp: boolean;
  inventory: (string | null)[];
}

interface SmokeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  maxLife: number;
  life: number;
}

// 25 mins Day (1500s) + 10 mins Night (600s) = 35 mins cycle (2100s)
const getGameClock = (elapsedSeconds: number) => {
  const cycleSeconds = elapsedSeconds % 2100;
  let isNight = false;
  let virtualHour = 6;
  let virtualMinute = 0;

  if (cycleSeconds < 1500) {
    // Day: 06:00 AM to 08:00 PM (14 hours = 840 mins)
    const pct = cycleSeconds / 1500;
    const totalVirtualMinutes = pct * 840;
    virtualHour = Math.floor(6 + totalVirtualMinutes / 60);
    virtualMinute = Math.floor(totalVirtualMinutes % 60);
  } else {
    // Night: 08:00 PM to 06:00 AM (10 hours = 600 mins)
    isNight = true;
    const pct = (cycleSeconds - 1500) / 600;
    const totalVirtualMinutes = pct * 600;
    virtualHour = Math.floor(20 + totalVirtualMinutes / 60) % 24;
    virtualMinute = Math.floor(totalVirtualMinutes % 60);
  }

  const ampm = virtualHour >= 12 ? 'PM' : 'AM';
  const displayHour = virtualHour % 12 === 0 ? 12 : virtualHour % 12;
  const displayMinute = String(virtualMinute).padStart(2, '0');
  const timeStr = `${displayHour}:${displayMinute} ${ampm}`;

  return { timeStr, isNight, cycleSeconds };
};

const getAmbientColor = (cycleSeconds: number) => {
  if (cycleSeconds < 1320) {
    // 0 to 22 mins: Broad daylight -> transparent
    return null;
  } else if (cycleSeconds < 1500) {
    // 22 to 25 mins: Sunset transition -> warm orange overlay fading in
    const progress = (cycleSeconds - 1320) / 180;
    const r = Math.floor(200 * progress);
    const g = Math.floor(90 * progress);
    const b = Math.floor(40 * progress);
    const a = progress * 0.38;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  } else if (cycleSeconds < 1980) {
    // 25 to 33 mins: Deep night -> dark blue overlay
    return 'rgba(10, 14, 42, 0.45)';
  } else {
    // 33 to 35 mins: Sunrise transition -> soft pink/yellow dawn fading out
    const progress = (cycleSeconds - 1980) / 120;
    const r = Math.floor(200 * (1 - progress));
    const g = Math.floor(90 * (1 - progress));
    const b = Math.floor(40 * (1 - progress));
    const a = (1 - progress) * 0.38;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
};

export const FarmGame: React.FC = () => {
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

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Character selection states
  const [localGender, setLocalGender] = useState<'male' | 'female' | null>(null);
  const [remoteGender, setRemoteGender] = useState<'male' | 'female' | null>(null);
  const [selectionComplete, setSelectionComplete] = useState<boolean>(false);

  // Game clock states
  const elapsedTimeRef = useRef<number>(0);

  // Inventory selection state
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const selectedSlotRef = useRef<number>(0);
  useEffect(() => {
    selectedSlotRef.current = selectedSlot;
  }, [selectedSlot]);

  // Audio state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const homeAudioRef = useRef<HTMLAudioElement | null>(null);
  const [volume, setVolume] = useState<number>(0.5);

  // Initialize audio on mount
  useEffect(() => {
    const audio = new Audio('/music/farm.mp3');
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

    const homeAudio = new Audio('/music/home.mp3');
    homeAudio.loop = true;
    homeAudio.volume = volume;

    const handleHomeEnded = () => {
      homeAudio.currentTime = 0;
      homeAudio.play().catch((err) => {
        console.warn('Home audio loop replay blocked:', err);
      });
    };

    homeAudio.addEventListener('ended', handleHomeEnded);
    homeAudioRef.current = homeAudio;

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('ended', handleEnded);
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (homeAudioRef.current) {
        homeAudioRef.current.removeEventListener('ended', handleHomeEnded);
        homeAudioRef.current.pause();
        homeAudioRef.current = null;
      }
    };
  }, []);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
    if (homeAudioRef.current) {
      homeAudioRef.current.volume = newVol;
    }
  };

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

  // Asset preloading status
  const [assetsLoaded, setAssetsLoaded] = useState<boolean>(false);

  // Image references
  const maleImageRef = useRef<HTMLImageElement | null>(null);
  const femaleImageRef = useRef<HTMLImageElement | null>(null);
  const maleUpImageRef = useRef<HTMLImageElement | null>(null);
  const femaleUpImageRef = useRef<HTMLImageElement | null>(null);
  const bedImageRef = useRef<HTMLImageElement | null>(null);
  const sofaImageRef = useRef<HTMLImageElement | null>(null);
  const chimneyGifRef = useRef<HTMLImageElement | null>(null);

  const outdoorBgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const indoorBgCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Keep track of canvas CSS dimensions to avoid getBoundingClientRect layout thrashing
  const canvasRectRef = useRef<{ width: number; height: number }>({ width: 800, height: 480 });

  // Keyboard controls
  const keysRef = useRef<{ [key: string]: boolean }>({});

  // Entity states
  const localPlayerRef = useRef<PlayerState>({
    x: 500,
    y: 400,
    gender: null,
    facingLeft: false,
    isMoving: false,
    inHouse: false,
    facingUp: false,
    inventory: [null, null, null]
  });

  const remotePlayerRef = useRef<PlayerState>({
    x: 500,
    y: 400,
    gender: null,
    facingLeft: false,
    isMoving: false,
    inHouse: false,
    facingUp: false,
    inventory: [null, null, null]
  });

  const smokeParticlesRef = useRef<SmokeParticle[]>([]);
  const fireParticlesRef = useRef<any[]>([]);

  // Preload assets
  useEffect(() => {
    let loadedCount = 0;
    const totalAssets = 7;

    const onAssetLoad = () => {
      loadedCount++;
      if (loadedCount === totalAssets) {
        setAssetsLoaded(true);
      }
    };

    const maleImg = new Image();
    maleImg.src = '/male.png';
    maleImg.onload = onAssetLoad;
    maleImg.onerror = (e) => {
      console.error('Failed to load male image asset', e);
      onAssetLoad(); // fall back gracefully
    };
    maleImageRef.current = maleImg;

    const femaleImg = new Image();
    femaleImg.src = '/female.png';
    femaleImg.onload = onAssetLoad;
    femaleImg.onerror = (e) => {
      console.error('Failed to load female image asset', e);
      onAssetLoad(); // fall back gracefully
    };
    femaleImageRef.current = femaleImg;

    const maleUpImg = new Image();
    maleUpImg.src = '/male_up.png';
    maleUpImg.onload = onAssetLoad;
    maleUpImg.onerror = (e) => {
      console.error('Failed to load male_up image asset', e);
      onAssetLoad(); // fall back gracefully
    };
    maleUpImageRef.current = maleUpImg;

    const femaleUpImg = new Image();
    femaleUpImg.src = '/female_up.png';
    femaleUpImg.onload = onAssetLoad;
    femaleUpImg.onerror = (e) => {
      console.error('Failed to load female_up image asset', e);
      onAssetLoad(); // fall back gracefully
    };
    femaleUpImageRef.current = femaleUpImg;

    const bedImg = new Image();
    bedImg.src = '/bed.png';
    bedImg.onload = onAssetLoad;
    bedImg.onerror = (e) => {
      console.error('Failed to load bed image asset', e);
      onAssetLoad(); // fall back gracefully
    };
    bedImageRef.current = bedImg;

    const sofaImg = new Image();
    sofaImg.src = '/sofa.png';
    sofaImg.onload = onAssetLoad;
    sofaImg.onerror = (e) => {
      console.error('Failed to load sofa image asset', e);
      onAssetLoad(); // fall back gracefully
    };
    sofaImageRef.current = sofaImg;

    const chimneyImg = new Image();
    chimneyImg.src = '/chimni.gif';
    chimneyImg.onload = onAssetLoad;
    chimneyImg.onerror = (e) => {
      console.error('Failed to load chimney image asset', e);
      onAssetLoad(); // fall back gracefully
    };
  }, []);

  // Hide chimney gif overlay when selection is not complete
  useEffect(() => {
    if (!selectionComplete && chimneyGifRef.current) {
      chimneyGifRef.current.style.display = 'none';
    }
  }, [selectionComplete]);

  // Keep track of canvas CSS dimensions to avoid getBoundingClientRect layout thrashing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        canvasRectRef.current = {
          width: entry.contentRect.width || canvas.clientWidth || 800,
          height: entry.contentRect.height || canvas.clientHeight || 480
        };
      }
    });

    observer.observe(canvas);
    return () => observer.disconnect();
  }, [assetsLoaded]);

  // Create offscreen canvases once assets are loaded
  useEffect(() => {
    if (!assetsLoaded) return;

    // 1. Create Outdoor Background Canvas
    const outCanvas = document.createElement('canvas');
    outCanvas.width = MAP_WIDTH;
    outCanvas.height = MAP_HEIGHT;
    const outCtx = outCanvas.getContext('2d');
    if (outCtx) {
      // Draw Grass Base
      outCtx.fillStyle = '#2d6a4f';
      outCtx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

      // Draw Grass Details
      outCtx.fillStyle = '#40916c';
      for (let tx = 0; tx < MAP_WIDTH; tx += 64) {
        for (let ty = 0; ty < MAP_HEIGHT; ty += 64) {
          if ((tx + ty) % 128 === 0) {
            outCtx.fillRect(tx + 16, ty + 16, 4, 8);
            outCtx.fillRect(tx + 20, ty + 20, 4, 12);
            outCtx.fillRect(tx + 12, ty + 24, 4, 6);
          } else if ((tx + ty) % 96 === 0) {
            outCtx.fillRect(tx + 40, ty + 40, 4, 6);
            outCtx.fillRect(tx + 44, ty + 36, 4, 10);
          }
        }
      }

      // Draw warm dirt path
      outCtx.fillStyle = '#d8b18a';
      outCtx.fillRect(480, 190, 40, 60);

      // Draw Soil Plot
      outCtx.fillStyle = '#5c4033';
      outCtx.fillRect(350, 250, 300, 200);
      outCtx.strokeStyle = '#3e2723';
      outCtx.lineWidth = 6;
      outCtx.strokeRect(350, 250, 300, 200);

      // Draw tilled furrow lines
      outCtx.strokeStyle = '#4e3629';
      outCtx.lineWidth = 3;
      for (let px = 380; px < 650; px += 30) {
        outCtx.beginPath();
        outCtx.moveTo(px, 255);
        outCtx.lineTo(px, 445);
        outCtx.stroke();
      }

      // Draw Farmhouse
      outCtx.fillStyle = '#f5ebe0';
      outCtx.fillRect(420, 120, 160, 70);

      // Wall wood details
      outCtx.fillStyle = '#d5c4b1';
      outCtx.fillRect(420, 185, 160, 5);

      // Roof (red tiled GBA polygon)
      outCtx.fillStyle = '#e63946';
      outCtx.beginPath();
      outCtx.moveTo(410, 120);
      outCtx.lineTo(430, 80);
      outCtx.lineTo(570, 80);
      outCtx.lineTo(590, 120);
      outCtx.closePath();
      outCtx.fill();

      // Roof details
      outCtx.strokeStyle = '#c1121f';
      outCtx.lineWidth = 2;
      outCtx.strokeRect(430, 80, 140, 40);
      outCtx.beginPath();
      outCtx.moveTo(465, 80); outCtx.lineTo(465, 120);
      outCtx.moveTo(500, 80); outCtx.lineTo(500, 120);
      outCtx.moveTo(535, 80); outCtx.lineTo(535, 120);
      outCtx.stroke();

      // Window (glowing cozy warm yellow)
      outCtx.fillStyle = '#ffea00';
      outCtx.fillRect(445, 140, 25, 20);
      outCtx.strokeStyle = '#4e3629';
      outCtx.lineWidth = 2;
      outCtx.strokeRect(445, 140, 25, 20);
      outCtx.beginPath();
      outCtx.moveTo(457.5, 140); outCtx.lineTo(457.5, 160);
      outCtx.moveTo(445, 150); outCtx.lineTo(470, 150);
      outCtx.stroke();

      // Door (dark brown wooden door)
      outCtx.fillStyle = '#5c4033';
      outCtx.fillRect(485, 150, 30, 40);
      outCtx.strokeStyle = '#3e2723';
      outCtx.strokeRect(485, 150, 30, 40);
      // Door knob
      outCtx.fillStyle = '#ffea00';
      outCtx.beginPath();
      outCtx.arc(510, 170, 2.5, 0, Math.PI * 2);
      outCtx.fill();

      // Fences and Decorative Elements
      outCtx.fillStyle = '#8d6e63';
      for (let fx = 100; fx < MAP_WIDTH - 100; fx += 120) {
        if (fx < 320 || fx > 680) {
          outCtx.fillRect(fx, 220, 6, 20);
          outCtx.fillRect(fx + 40, 220, 6, 20);
          outCtx.fillStyle = '#a1887f';
          outCtx.fillRect(fx, 224, 46, 4);
          outCtx.fillRect(fx, 232, 46, 4);
          outCtx.fillStyle = '#8d6e63';
        }
      }

      // Cozy Flowers
      const drawFlower = (x: number, y: number, color: string) => {
        outCtx.fillStyle = color;
        outCtx.beginPath();
        outCtx.arc(x, y, 4, 0, Math.PI * 2);
        outCtx.fill();
        outCtx.fillStyle = '#ffea00';
        outCtx.fillRect(x - 1, y - 1, 2, 2);
      };
      drawFlower(200, 300, '#ff007f');
      drawFlower(215, 290, '#00f0ff');
      drawFlower(230, 310, '#ff007f');
      drawFlower(800, 350, '#ffea00');
      drawFlower(820, 365, '#e63946');
      drawFlower(790, 380, '#9d4edd');
    }
    outdoorBgCanvasRef.current = outCanvas;

    // 2. Create Indoor Background Canvas
    const inCanvas = document.createElement('canvas');
    inCanvas.width = CANVAS_WIDTH;
    inCanvas.height = CANVAS_HEIGHT;
    const inCtx = inCanvas.getContext('2d');
    if (inCtx) {
      // Cozy black margins
      inCtx.fillStyle = '#090a10';
      inCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Wooden floor
      inCtx.fillStyle = '#b76e39';
      inCtx.fillRect(180, 100, 440, 300);

      // Floorboard lines
      inCtx.strokeStyle = '#9c5a2b';
      inCtx.lineWidth = 1.5;
      for (let wy = 120; wy < 400; wy += 24) {
        inCtx.beginPath();
        inCtx.moveTo(180, wy);
        inCtx.lineTo(620, wy);
        inCtx.stroke();
      }

      // Stone walls
      inCtx.fillStyle = '#546e7a';
      inCtx.fillRect(170, 80, 460, 20);
      inCtx.fillRect(170, 80, 10, 320);
      inCtx.fillRect(620, 80, 10, 320);
      inCtx.fillRect(170, 400, 200, 10);
      inCtx.fillRect(430, 400, 200, 10);

      // Exit sill
      inCtx.fillStyle = '#8d6e63';
      inCtx.fillRect(370, 400, 60, 10);

      // Furniture
      if (bedImageRef.current) {
        inCtx.drawImage(bedImageRef.current, 175, 75, 140, 140);
      } else {
        inCtx.fillStyle = '#5c4033';
        inCtx.fillRect(190, 100, 120, 110);
        inCtx.fillStyle = '#eceff1';
        inCtx.fillRect(198, 108, 104, 25);
        inCtx.fillStyle = '#b30000';
        inCtx.fillRect(190, 133, 120, 77);
        inCtx.fillStyle = '#e60000';
        inCtx.fillRect(190, 133, 120, 12);
      }

      if (sofaImageRef.current) {
        inCtx.drawImage(sofaImageRef.current, 465, 235, 150, 100);
      } else {
        inCtx.fillStyle = '#0d47a1';
        inCtx.fillRect(480, 250, 80, 15);
        inCtx.fillStyle = '#1976d2';
        inCtx.fillRect(480, 265, 80, 35);
        inCtx.fillStyle = '#0d47a1';
        inCtx.fillRect(472, 253, 10, 47);
        inCtx.fillRect(558, 253, 10, 47);
      }
    }
    indoorBgCanvasRef.current = inCanvas;
  }, [assetsLoaded]);

  // Set up local keyboard listeners
  useEffect(() => {
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

      if (e.key === '1') {
        setSelectedSlot(0);
      } else if (e.key === '2') {
        setSelectedSlot(1);
      } else if (e.key === '3') {
        setSelectedSlot(2);
      }
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
  }, []);

  // Synchronize character selections and starting states
  useEffect(() => {
    if (!gameData) return;

    if (gameData.type === 'selection') {
      setRemoteGender(gameData.gender);
    } else if (gameData.type === 'movement') {
      if (gameData.player) {
        remotePlayerRef.current.x = gameData.player.x;
        remotePlayerRef.current.y = gameData.player.y;
        remotePlayerRef.current.facingLeft = gameData.player.facingLeft;
        remotePlayerRef.current.isMoving = gameData.player.isMoving;
        remotePlayerRef.current.gender = gameData.player.gender;
        remotePlayerRef.current.inHouse = gameData.player.inHouse;
        remotePlayerRef.current.facingUp = gameData.player.facingUp;
        if (gameData.player.inventory) {
          remotePlayerRef.current.inventory = gameData.player.inventory;
        }
      }
      if (!isHost && gameData.elapsedTime !== undefined) {
        elapsedTimeRef.current = gameData.elapsedTime;
      }
    }
  }, [gameData]);

  // Sync selection events
  useEffect(() => {
    if (localGender) {
      sendGameData({ type: 'selection', gender: localGender });
      localPlayerRef.current.gender = localGender;
    }
  }, [localGender]);

  // Check if both selections are complete
  useEffect(() => {
    // If not connected to peer, local selection is enough
    if (!isConnected) {
      if (localGender) {
        setRemoteGender(localGender === 'male' ? 'female' : 'male'); // mock remote gender
        setSelectionComplete(true);
      }
    } else {
      if (localGender && remoteGender) {
        setSelectionComplete(true);
      }
    }
  }, [localGender, remoteGender, isConnected]);

  // Restart trigger from peer
  useEffect(() => {
    if (gameEvent && gameEvent.type === 'restart_farm') {
      handleRestartLocal();
      resetGameEvent();
    }
  }, [gameEvent]);

  const handleRestartLocal = () => {
    setLocalGender(null);
    setRemoteGender(null);
    setSelectionComplete(false);
    setSelectedSlot(0);
    localPlayerRef.current = {
      x: isHost ? 480 : 520,
      y: 350,
      gender: null,
      facingLeft: false,
      isMoving: false,
      inHouse: false,
      facingUp: false,
      inventory: [null, null, null]
    };
    remotePlayerRef.current = {
      x: isHost ? 520 : 480,
      y: 350,
      gender: null,
      facingLeft: false,
      isMoving: false,
      inHouse: false,
      facingUp: false,
      inventory: [null, null, null]
    };
    smokeParticlesRef.current = [];
    fireParticlesRef.current = [];
    elapsedTimeRef.current = 0;
  };

  const triggerRestart = () => {
    handleRestartLocal();
    if (isHost) {
      sendGameEvent({ type: 'restart_farm' });
    }
  };

  // Main game physics and drawing loop
  useEffect(() => {
    if (!selectionComplete || !assetsLoaded) return;

    // Reset spawning positions in the plot center
    localPlayerRef.current.x = isHost ? 480 : 520;
    localPlayerRef.current.y = 350;
    localPlayerRef.current.gender = localGender;
    localPlayerRef.current.inHouse = false;
    localPlayerRef.current.facingUp = false;
    localPlayerRef.current.inventory = [null, null, null];

    remotePlayerRef.current.x = isHost ? 520 : 480;
    remotePlayerRef.current.y = 350;
    remotePlayerRef.current.gender = remoteGender;
    remotePlayerRef.current.inHouse = false;
    remotePlayerRef.current.facingUp = false;
    remotePlayerRef.current.inventory = [null, null, null];

    let animationId: number;

    const checkHouseCollision = (x: number, y: number): boolean => {
      // House bounding box: x in [420, 580], y in [80, 190]
      // Add margin for character size
      const padding = 16;
      const hLeft = 420 - padding;
      const hRight = 580 + padding;
      const hTop = 80 - padding;
      const hBottom = 190 + padding;

      return x > hLeft && x < hRight && y > hTop && y < hBottom;
    };

    const checkHouseInteriorCollision = (x: number, y: number): boolean => {
      const margin = 14;
      const fLeft = 180 + margin;
      const fRight = 620 - margin;
      const fTop = 100 + margin;
      const fBottom = 400 - margin;

      // Allow passing boundary at the doorway exit
      const isAtExit = x >= 370 && x <= 430 && y >= fBottom;
      if (isAtExit) return false;

      // Floor borders
      if (x < fLeft || x > fRight || y < fTop || y > fBottom) return true;

      // Sofa collision: x in [470, 570], y in [240, 310]
      if (x > 470 - margin && x < 570 + margin && y > 240 - margin && y < 310 + margin) return true;

      // Bed collision: x in [190, 310], y in [100, 210]
      if (x > 190 - margin && x < 310 + margin && y > 100 - margin && y < 210 + margin) return true;

      // Chimney collision: x in [368, 432], y in [100, 136]
      if (x > 368 - margin && x < 432 + margin && y > 100 && y < 136 + margin) return true;

      return false;
    };

    const updatePhysics = () => {
      const p = localPlayerRef.current;
      let dx = 0;
      let dy = 0;

      if (keysRef.current['a'] || keysRef.current['A'] || keysRef.current['ArrowLeft']) dx = -1;
      if (keysRef.current['d'] || keysRef.current['D'] || keysRef.current['ArrowRight']) dx = 1;
      if (keysRef.current['w'] || keysRef.current['W'] || keysRef.current['ArrowUp']) dy = -1;
      if (keysRef.current['s'] || keysRef.current['S'] || keysRef.current['ArrowDown']) dy = 1;

      // Normalization
      if (dx !== 0 && dy !== 0) {
        const length = Math.sqrt(dx * dx + dy * dy);
        dx /= length;
        dy /= length;
      }

      const vx = dx * PLAYER_SPEED;
      const vy = dy * PLAYER_SPEED;

      p.isMoving = vx !== 0 || vy !== 0;

      if (vx < 0) {
        p.facingLeft = true;
      } else if (vx > 0) {
        p.facingLeft = false;
      }

      if (dy < 0) {
        p.facingUp = true;
      } else if (dy > 0) {
        p.facingUp = false;
      } else if (dx !== 0) {
        p.facingUp = false;
      }

      // Propose new positions
      let nextX = p.x + vx;
      let nextY = p.y + vy;

      if (!p.inHouse) {
        // --- OUTDOORS MOVEMENT ---
        // Enter house door trigger: door is at y=190, x in [480, 520]
        if (nextY < 206 && p.y >= 195 && nextX >= 480 && nextX <= 520) {
          p.inHouse = true;
          p.x = 400; // spawn inside house
          p.y = 370;
        } else {
          // Normal collisions
          if (!checkHouseCollision(nextX, p.y)) {
            p.x = Math.max(20, Math.min(MAP_WIDTH - 20, nextX));
          }
          if (!checkHouseCollision(p.x, nextY)) {
            p.y = Math.max(20, Math.min(MAP_HEIGHT - 20, nextY));
          }
        }
      } else {
        // --- INDOORS MOVEMENT ---
        // Exit house door trigger: bottom sill at y=400, x in [370, 430]
        if (nextY > 400 && nextX >= 370 && nextX <= 430) {
          p.inHouse = false;
          p.x = 500; // spawn outside door
          p.y = 205;
        } else {
          if (!checkHouseInteriorCollision(nextX, p.y)) {
            p.x = nextX;
          }
          if (!checkHouseInteriorCollision(p.x, nextY)) {
            p.y = nextY;
          }
        }
      }

      if (isHost) {
        elapsedTimeRef.current += 1 / 60;
      }

      // Sync character position with remote peer
      sendGameData({
        type: 'movement',
        player: {
          x: p.x,
          y: p.y,
          facingLeft: p.facingLeft,
          isMoving: p.isMoving,
          gender: p.gender,
          inHouse: p.inHouse,
          facingUp: p.facingUp,
          inventory: p.inventory
        },
        elapsedTime: elapsedTimeRef.current
      });



      // Play music if local player is standing on the crop plot (x: [350, 650], y: [250, 450]) outdoors
      const isOnPlot = !p.inHouse && p.x >= 350 && p.x <= 650 && p.y >= 250 && p.y <= 450;
      if (audioRef.current) {
        if (isOnPlot && selectionComplete) {
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

      // Play home music if local player is inside the house
      if (homeAudioRef.current) {
        if (p.inHouse && selectionComplete) {
          if (homeAudioRef.current.paused) {
            homeAudioRef.current.play().catch((err) => {
              console.warn('Home audio play blocked or failed:', err);
            });
          }
        } else {
          if (!homeAudioRef.current.paused) {
            homeAudioRef.current.pause();
          }
        }
      }

      // Update chimney smoke particles (outdoors)
      if (!p.inHouse) {
        const chimneyX = 560;
        const chimneyY = 70;
        if (Math.random() < 0.15) {
          smokeParticlesRef.current.push({
            x: chimneyX,
            y: chimneyY,
            vx: -0.2 - Math.random() * 0.4,
            vy: -0.5 - Math.random() * 0.8,
            size: 4 + Math.random() * 5,
            opacity: 0.6 + Math.random() * 0.3,
            maxLife: 80 + Math.random() * 40,
            life: 0
          });
        }
      }

      // Tick particles
      smokeParticlesRef.current.forEach((part) => {
        part.x += part.vx;
        part.y += part.vy;
        part.life++;
        part.opacity = Math.max(0, 1 - part.life / part.maxLife);
      });
      smokeParticlesRef.current = smokeParticlesRef.current.filter((part) => part.life < part.maxLife);

      fireParticlesRef.current.forEach((part) => {
        part.x += part.vx;
        part.y += part.vy;
        part.life++;
      });
      fireParticlesRef.current = fireParticlesRef.current.filter((part) => part.life < part.maxLife);
    };

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

      const p1 = localPlayerRef.current;
      const p2 = remotePlayerRef.current;

      const drawPlayer = (player: PlayerState, isMe: boolean) => {
        if (!player.gender) return;

        const img = player.gender === 'male'
          ? (player.facingUp ? maleUpImageRef.current : maleImageRef.current)
          : (player.facingUp ? femaleUpImageRef.current : femaleImageRef.current);
        if (!img) return;

        ctx.save();
        // Move to player coordinate
        ctx.translate(player.x, player.y);

        // Flip image horizontally if facing left
        if (player.facingLeft) {
          ctx.scale(-1, 1);
        }

        // Draw character sprite centered at coordinate
        // (x, y) acts as the center-bottom pivot of the character feet
        ctx.drawImage(
          img,
          -SPRITE_SIZE / 2,
          -SPRITE_SIZE + 4, // Draw slightly upwards so pivot aligns with feet
          SPRITE_SIZE,
          SPRITE_SIZE
        );

        ctx.restore();

        // Draw Label Tag above player
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px Orbitron';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 3;
        ctx.fillText(
          `${isMe ? 'YOU' : 'PARTNER'} (${player.gender.toUpperCase()})`,
          player.x,
          player.y - SPRITE_SIZE - 2
        );
        ctx.shadowBlur = 0; // Reset
      };

      if (p1.inHouse) {
        // --- DRAW HOUSE INTERIOR ---
        if (indoorBgCanvasRef.current) {
          ctx.drawImage(indoorBgCanvasRef.current, 0, 0);
        } else {
          // Fallback if not cached yet
          ctx.fillStyle = '#090a10';
          ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          ctx.fillStyle = '#b76e39';
          ctx.fillRect(180, 100, 440, 300);
          ctx.strokeStyle = '#9c5a2b';
          ctx.lineWidth = 1.5;
          for (let wy = 120; wy < 400; wy += 24) {
            ctx.beginPath();
            ctx.moveTo(180, wy);
            ctx.lineTo(620, wy);
            ctx.stroke();
          }
          ctx.fillStyle = '#546e7a';
          ctx.fillRect(170, 80, 460, 20);
          ctx.fillRect(170, 80, 10, 320);
          ctx.fillRect(620, 80, 10, 320);
          ctx.fillRect(170, 400, 200, 10);
          ctx.fillRect(430, 400, 200, 10);
          ctx.fillStyle = '#8d6e63';
          ctx.fillRect(370, 400, 60, 10);
          if (bedImageRef.current) {
            ctx.drawImage(bedImageRef.current, 175, 75, 140, 140);
          }
          if (sofaImageRef.current) {
            ctx.drawImage(sofaImageRef.current, 465, 235, 150, 100);
          }
        }

        // Position and display animated Chimney GIF inside the house
        if (chimneyGifRef.current) {
          const chimneyWidth = 64;
          const chimneyHeight = 64;
          const worldX = 400;
          const worldY = 144; // bottom of chimney

          const rect = canvasRectRef.current;
          const cssScaleX = rect.width / canvas.width;
          const cssScaleY = rect.height / canvas.height;

          // Inside the house, the viewport is fixed (no camera scroll)
          const canvasX = (worldX - chimneyWidth / 2) * scale + offsetX;
          const canvasY = (worldY - chimneyHeight) * scale + offsetY;
          const canvasW = chimneyWidth * scale;
          const canvasH = chimneyHeight * scale;

          chimneyGifRef.current.style.display = 'block';
          chimneyGifRef.current.style.left = `${canvasX * cssScaleX}px`;
          chimneyGifRef.current.style.top = `${canvasY * cssScaleY}px`;
          chimneyGifRef.current.style.width = `${canvasW * cssScaleX}px`;
          chimneyGifRef.current.style.height = `${canvasH * cssScaleY}px`;
        }

        // Cozy fireplace glow inside the house
        const gradFireplace = ctx.createRadialGradient(400, 120, 2, 400, 120, 90);
        gradFireplace.addColorStop(0, 'rgba(255, 120, 0, 0.35)');
        gradFireplace.addColorStop(1, 'rgba(255, 120, 0, 0)');
        ctx.fillStyle = gradFireplace;
        ctx.beginPath();
        ctx.arc(400, 120, 90, 0, Math.PI * 2);
        ctx.fill();

        // 5. Draw Y-Sorted Players in House (only draw remote if they are in the house too)
        if (p2.gender && p2.inHouse) {
          if (p1.y < p2.y) {
            drawPlayer(p1, true);
            drawPlayer(p2, false);
          } else {
            drawPlayer(p2, false);
            drawPlayer(p1, true);
          }
        } else {
          drawPlayer(p1, true);
        }

        // 6. Night shade inside the house (no campfire glow)
        const clockInfo = getGameClock(elapsedTimeRef.current);
        if (clockInfo.isNight) {
          ctx.fillStyle = 'rgba(10, 14, 42, 0.22)'; // soft night shade inside house
          ctx.fillRect(180, 100, 440, 300);
        }
      } else {
        // --- DRAW OUTDOOR FARM ---
        // Camera settings (follow midpoint of players, clamp to map bounds)
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        let cameraX = midX - CANVAS_WIDTH / 2;
        let cameraY = midY - CANVAS_HEIGHT / 2;

        cameraX = Math.max(0, Math.min(MAP_WIDTH - CANVAS_WIDTH, cameraX));
        cameraY = Math.max(0, Math.min(MAP_HEIGHT - CANVAS_HEIGHT, cameraY));

        ctx.save();
        ctx.translate(-cameraX, -cameraY);

        // 1. Draw Map Background (Cached / Pre-rendered)
        if (outdoorBgCanvasRef.current) {
          ctx.drawImage(outdoorBgCanvasRef.current, 0, 0);
        } else {
          // Fallback if not cached yet
          ctx.fillStyle = '#2d6a4f';
          ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }

        // Hide chimney GIF overlay when outdoors
        if (chimneyGifRef.current) {
          chimneyGifRef.current.style.display = 'none';
        }

        // 4. Draw Chimney Smoke Particles
        ctx.fillStyle = 'rgba(230, 230, 230, 0.4)';
        smokeParticlesRef.current.forEach((part) => {
          ctx.save();
          ctx.globalAlpha = part.opacity;
          ctx.beginPath();
          ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });

        // 6. Draw Y-Sorted Players Outdoors (only draw remote if they are outdoors too)
        if (p2.gender && !p2.inHouse) {
          if (p1.y < p2.y) {
            drawPlayer(p1, true);
            drawPlayer(p2, false);
          } else {
            drawPlayer(p2, false);
            drawPlayer(p1, true);
          }
        } else {
          drawPlayer(p1, true);
        }

        // Draw Day/Night Ambient Tint Overlay
        const clockInfo = getGameClock(elapsedTimeRef.current);
        const ambientColor = getAmbientColor(clockInfo.cycleSeconds);
        if (ambientColor) {
          ctx.fillStyle = ambientColor;
          ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

          // Window glow and Player lantern glows at sunset/night
          const isNight = clockInfo.isNight;
          const cycleSeconds = clockInfo.cycleSeconds;
          const intensity = isNight ? 0.35 : 0.2 * ((cycleSeconds - 1320) / 180);

          // Farmhouse window glow
          const gradWindow = ctx.createRadialGradient(457, 150, 2, 457, 150, 40);
          gradWindow.addColorStop(0, `rgba(255, 234, 0, ${intensity * 1.5})`);
          gradWindow.addColorStop(1, 'rgba(255, 234, 0, 0)');
          ctx.fillStyle = gradWindow;
          ctx.beginPath();
          ctx.arc(457, 150, 40, 0, Math.PI * 2);
          ctx.fill();

          // Player 1 (local) glow
          if (p1.gender) {
            const gradP1 = ctx.createRadialGradient(p1.x, p1.y - 12, 5, p1.x, p1.y - 12, 60);
            gradP1.addColorStop(0, `rgba(255, 255, 255, ${intensity * 0.8})`);
            gradP1.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = gradP1;
            ctx.beginPath();
            ctx.arc(p1.x, p1.y - 12, 60, 0, Math.PI * 2);
            ctx.fill();
          }

          // Player 2 (remote) glow
          if (p2.gender && !p2.inHouse) {
            const gradP2 = ctx.createRadialGradient(p2.x, p2.y - 12, 5, p2.x, p2.y - 12, 60);
            gradP2.addColorStop(0, `rgba(255, 255, 255, ${intensity * 0.8})`);
            gradP2.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = gradP2;
            ctx.beginPath();
            ctx.arc(p2.x, p2.y - 12, 60, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.restore(); // Restores camera translate
      }

      // Draw Retro GBA Clock Widget in top right (virtual screen space)
      const clockInfo = getGameClock(elapsedTimeRef.current);
      ctx.fillStyle = 'rgba(11, 12, 21, 0.8)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(645, 15, 140, 38, 8);
      } else {
        ctx.rect(645, 15, 140, 38);
      }
      ctx.fill();
      ctx.stroke();

      // Sun/Moon icon inside widget
      if (!clockInfo.isNight) {
        // Yellow glowing sun
        ctx.fillStyle = '#ffea00';
        ctx.beginPath();
        ctx.arc(665, 34, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffea00';
        ctx.lineWidth = 1.5;
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
          ctx.beginPath();
          ctx.moveTo(665 + Math.cos(a) * 8, 34 + Math.sin(a) * 8);
          ctx.lineTo(665 + Math.cos(a) * 11, 34 + Math.sin(a) * 11);
          ctx.stroke();
        }
      } else {
        // Soft blue crescent moon
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.arc(665, 34, 6, -Math.PI / 2, Math.PI / 2);
        ctx.bezierCurveTo(668, 40, 668, 28, 665, 28);
        ctx.closePath();
        ctx.fill();
      }

      // Draw clock digital text
      ctx.fillStyle = '#f8f9fa';
      ctx.font = 'bold 11px Orbitron';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(clockInfo.timeStr, 688, 34);

      // Draw Retro GBA Inventory HUD in bottom middle (virtual screen space)
      const hudW = 140;
      const hudH = 44;
      const hudX = (CANVAS_WIDTH - hudW) / 2;
      const hudY = CANVAS_HEIGHT - hudH - 15;

      ctx.fillStyle = 'rgba(11, 12, 21, 0.85)';
      ctx.strokeStyle = 'rgba(255, 234, 0, 0.25)'; // matching retro neon yellow
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(hudX, hudY, hudW, hudH, 8);
      } else {
        ctx.rect(hudX, hudY, hudW, hudH);
      }
      ctx.fill();
      ctx.stroke();

      // Draw the 3 inventory slots
      const slotSize = 30;
      const slotGap = 8;
      const totalSlotsWidth = 3 * slotSize + 2 * slotGap;
      const startSlotX = hudX + (hudW - totalSlotsWidth) / 2;
      const slotY = hudY + (hudH - slotSize) / 2;

      const curSelected = selectedSlotRef.current;
      for (let i = 0; i < 3; i++) {
        const sx = startSlotX + i * (slotSize + slotGap);

        // Slot background
        ctx.fillStyle = 'rgba(20, 22, 37, 0.9)';

        // Use gold outline and glow if this slot is selected
        const isSelected = i === curSelected;
        ctx.strokeStyle = isSelected ? 'rgba(255, 234, 0, 0.95)' : 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = isSelected ? 2 : 1;

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(sx, slotY, slotSize, slotSize, 4);
        } else {
          ctx.rect(sx, slotY, slotSize, slotSize);
        }
        ctx.fill();
        ctx.stroke();

        // Draw hotkey number (1, 2, 3) in top-left corner of slot
        ctx.fillStyle = isSelected ? 'rgba(255, 234, 0, 0.8)' : 'rgba(255, 255, 255, 0.35)';
        ctx.font = '7px Orbitron';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(String(i + 1), sx + 3, slotY + 3);
      }

      ctx.restore(); // Restores viewport scale & letterbox offset
    };

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
      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [selectionComplete, assetsLoaded, isHost, localGender, remoteGender]);

  if (!assetsLoaded) {
    return (
      <div className="connecting-container glass-panel">
        <div className="spinner">
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
        </div>
        <h2 className="font-display text-cyan">Loading Assets...</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Preloading farm graphics sheets...</p>
      </div>
    );
  }

  return (
    <div className="game-main-content">
      {/* Game Header Bar */}
      <div className="game-header-bar glass-panel" style={{ width: '100%', maxWidth: '900px' }}>
        <h2 className="game-title-text font-display">
          FARM TOGETHER: <span className="text-yellow">CO-OP SANDBOX</span>
        </h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginLeft: 'auto' }}>

          {/* Volume Control Widget */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '0.3rem 0.6rem' }}>
            {volume === 0 ? <VolumeX size={14} className="text-muted" /> : <Volume2 size={14} style={{ color: 'var(--neon-yellow)' }} />}
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
                accentColor: 'var(--neon-yellow)',
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
          <button className="copy-btn" onClick={triggerRestart} style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>
            Choose Characters
          </button>
          <button className="glow-btn-magenta" onClick={stopGame} style={{ padding: '0.4rem 1.2rem', fontSize: '0.8rem' }}>
            Exit Game
          </button>
        </div>
      </div>

      {/* Canvas container */}
      <div className="canvas-container" style={{ position: 'relative' }}>
        <canvas ref={canvasRef} width={isFullscreen ? 1920 : CANVAS_WIDTH} height={isFullscreen ? 1080 : CANVAS_HEIGHT} />

        {/* Animated Chimney GIF overlay */}
        <img
          ref={chimneyGifRef}
          src="/chimni.gif"
          alt="Chimney"
          style={{
            position: 'absolute',
            display: 'none',
            imageRendering: 'pixelated',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        />

        {/* Character Selection Screen Overlay */}
        {!selectionComplete && (
          <div className="canvas-overlay">
            <h2 className="overlay-title font-display text-yellow" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
              WHO WILL PLAY?
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>Select your GBA character sprite to start the farm</p>

            <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
              {/* Male option card */}
              <div
                className={`game-option-card farm ${localGender === 'male' ? 'selected' : ''}`}
                onClick={() => setLocalGender('male')}
                style={{ width: '180px', padding: '1rem', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
              >
                <div style={{ width: '80px', height: '80px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <img src="/male.png" alt="Male Farmer" style={{ width: '60px', height: '60px', imageRendering: 'pixelated' }} />
                </div>
                <h3 className="font-display" style={{ fontSize: '1rem', margin: '0.75rem 0 0.25rem 0', color: 'var(--text-primary)' }}>MALE</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--neon-cyan)' }}>GBA Sprite 1</span>
              </div>

              {/* Female option card */}
              <div
                className={`game-option-card farm ${localGender === 'female' ? 'selected' : ''}`}
                onClick={() => setLocalGender('female')}
                style={{ width: '180px', padding: '1rem', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
              >
                <div style={{ width: '80px', height: '80px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <img src="/female.png" alt="Female Farmer" style={{ width: '60px', height: '60px', imageRendering: 'pixelated' }} />
                </div>
                <h3 className="font-display" style={{ fontSize: '1rem', margin: '0.75rem 0 0.25rem 0', color: 'var(--text-primary)' }}>FEMALE</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--neon-magenta)' }}>GBA Sprite 2</span>
              </div>
            </div>

            {/* Selection status messages */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>
              <div style={{ color: localGender ? 'var(--neon-green)' : 'var(--text-secondary)' }}>
                You: {localGender ? `Selected ${localGender.toUpperCase()}` : 'Choosing...'}
              </div>
              {isConnected && (
                <div style={{ color: remoteGender ? 'var(--neon-green)' : 'var(--text-secondary)' }}>
                  Partner: {remoteGender ? `Selected ${remoteGender.toUpperCase()}` : 'Choosing...'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Helper guide */}
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '900px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        <div>
          <span>Walk: </span><span style={{ color: 'var(--text-primary)' }}>WASD</span> or <span style={{ color: 'var(--text-primary)' }}>Arrows</span>
        </div>
        <div>
          <span>Farm Together: </span><span style={{ color: 'var(--neon-yellow)', fontWeight: 600 }}>Spawned at empty center plot</span>
        </div>
      </div>
    </div>
  );
};
