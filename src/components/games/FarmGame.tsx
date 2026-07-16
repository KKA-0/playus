import React, { useEffect, useRef, useState } from 'react';
import { usePeer } from '../../context/PeerContext';
import type { PlayerState, Crop, WildItem, SmokeParticle, InventoryItem, Weed, ChickenState } from './farm/types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, MAP_WIDTH, MAP_HEIGHT, PLAYER_SPEED, SPRITE_SIZE } from './farm/constants';
import { getGameClock, getAmbientColor, getItemEmoji } from './farm/utils';
import { ChestOverlay } from './farm/ChestOverlay';
import { CharacterSelection } from './farm/CharacterSelection';
import { GameHeader } from './farm/GameHeader';

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

  const [gamepadConnected, setGamepadConnected] = useState<boolean>(false);
  const prevGamepadButtonsRef = useRef<boolean[]>([]);

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
  const weed1ImageRef = useRef<HTMLImageElement | null>(null);
  const weed2ImageRef = useRef<HTMLImageElement | null>(null);
  const weed3ImageRef = useRef<HTMLImageElement | null>(null);
  const chickenImageRef = useRef<HTMLImageElement | null>(null);
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
    inventory: [
      { type: 'seeds', count: 1 },
      { type: 'watering_can', count: 1 },
      null
    ]
  });

  const remotePlayerRef = useRef<PlayerState>({
    x: 500,
    y: 400,
    gender: null,
    facingLeft: false,
    isMoving: false,
    inHouse: false,
    facingUp: false,
    inventory: [
      { type: 'seeds', count: 1 },
      { type: 'watering_can', count: 1 },
      null
    ]
  });

  // Chest items ref (10 slots)
  const chestItemsRef = useRef<(InventoryItem | null)[]>([
    null, null, null, null, null,
    null, null, null, null, null
  ]);

  // Crops ref
  const cropsRef = useRef<Crop[]>([]);

  const wildItemsRef = useRef<WildItem[]>([
    { id: 'berry_1', x: 200, y: 300, type: 'berry', active: true, respawnTimer: 0 },
    { id: 'berry_2', x: 820, y: 365, type: 'berry', active: true, respawnTimer: 0 },
    { id: 'wood_1', x: 150, y: 600, type: 'wood', active: true, respawnTimer: 0 },
    { id: 'stone_1', x: 900, y: 200, type: 'stone', active: true, respawnTimer: 0 },
  ]);

  const generateInitialWeeds = (): Weed[] => {
    const list: Weed[] = [];
    const count = 60;
    let attempts = 0;
    while (list.length < count && attempts < 1000) {
      attempts++;
      const wx = 40 + Math.random() * (MAP_WIDTH - 80);
      const wy = 40 + Math.random() * (MAP_HEIGHT - 80);

      if (wx >= 395 && wx <= 605 && wy >= 55 && wy <= 215) continue;
      if (wx >= 330 && wx <= 670 && wy >= 230 && wy <= 470) continue;

      list.push({
        id: `weed_${Date.now()}_${list.length}_${Math.floor(Math.random() * 1000)}`,
        x: wx,
        y: wy,
        type: Math.floor(Math.random() * 3) + 1
      });
    }
    return list;
  };

  const weedsRef = useRef<Weed[]>(generateInitialWeeds());

  const generateInitialChickens = (): ChickenState[] => [
    {
      id: 'chicken_1',
      x: 350,
      y: 180,
      startX: 350,
      startY: 180,
      vx: 0,
      vy: 0,
      direction: 'down',
      state: 'idle',
      timer: 1 + Math.random() * 2,
      frameIndex: 0,
      animationTick: 0
    },
    {
      id: 'chicken_2',
      x: 650,
      y: 180,
      startX: 650,
      startY: 180,
      vx: 0,
      vy: 0,
      direction: 'down',
      state: 'idle',
      timer: 1 + Math.random() * 2,
      frameIndex: 0,
      animationTick: 0
    },
    {
      id: 'chicken_3',
      x: 500,
      y: 260,
      startX: 500,
      startY: 260,
      vx: 0,
      vy: 0,
      direction: 'down',
      state: 'idle',
      timer: 1 + Math.random() * 2,
      frameIndex: 0,
      animationTick: 0
    }
  ];

  const chickensRef = useRef<ChickenState[]>(generateInitialChickens());

  // UI rendering state force-updater
  const [uiVersion, setUiVersion] = useState<number>(0);

  // Chest UI open state
  const [isChestOpen, setIsChestOpen] = useState<boolean>(false);
  const isChestOpenRef = useRef<boolean>(false);
  useEffect(() => {
    isChestOpenRef.current = isChestOpen;
  }, [isChestOpen]);

  // Proximity indicator refs for keyboard event listeners
  const isNearChestRef = useRef<boolean>(false);

  const smokeParticlesRef = useRef<SmokeParticle[]>([]);
  const fireParticlesRef = useRef<any[]>([]);

  // Preload assets
  useEffect(() => {
    let loadedCount = 0;
    const totalAssets = 11;

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

    const weed1Img = new Image();
    weed1Img.src = '/weed1.png';
    weed1Img.onload = onAssetLoad;
    weed1Img.onerror = (e) => {
      console.error('Failed to load weed1 image asset', e);
      onAssetLoad();
    };
    weed1ImageRef.current = weed1Img;

    const weed2Img = new Image();
    weed2Img.src = '/weed2.png';
    weed2Img.onload = onAssetLoad;
    weed2Img.onerror = (e) => {
      console.error('Failed to load weed2 image asset', e);
      onAssetLoad();
    };
    weed2ImageRef.current = weed2Img;

    const weed3Img = new Image();
    weed3Img.src = '/weed3.png';
    weed3Img.onload = onAssetLoad;
    weed3Img.onerror = (e) => {
      console.error('Failed to load weed3 image asset', e);
      onAssetLoad();
    };
    weed3ImageRef.current = weed3Img;

    const chickenImg = new Image();
    chickenImg.src = '/farm/pets/chicken.png';
    chickenImg.onload = onAssetLoad;
    chickenImg.onerror = (e) => {
      console.error('Failed to load chicken image asset', e);
      onAssetLoad();
    };
    chickenImageRef.current = chickenImg;
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

  const addToInventory = (player: PlayerState, itemType: string): boolean => {
    if (itemType !== 'watering_can') {
      const existingSlotIdx = player.inventory.findIndex(
        (slot) => slot !== null && slot.type === itemType && slot.count < 10
      );
      if (existingSlotIdx !== -1) {
        const slot = player.inventory[existingSlotIdx];
        if (slot) {
          slot.count++;
          return true;
        }
      }
    }

    const emptySlotIdx = player.inventory.findIndex((slot) => slot === null);
    if (emptySlotIdx !== -1) {
      player.inventory[emptySlotIdx] = { type: itemType, count: 1 };
      return true;
    }

    return false;
  };

  const spawnPluckParticles = (x: number, y: number) => {
    for (let i = 0; i < 8; i++) {
      smokeParticlesRef.current.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() - 0.5) * 1.2,
        size: 3 + Math.random() * 4,
        opacity: 0.7 + Math.random() * 0.3,
        maxLife: 30 + Math.random() * 20,
        life: 0
      });
    }
  };

  const triggerInteract = () => {
    if (isNearChestRef.current) {
      setIsChestOpen((prev) => !prev);
      return;
    }
    if (isChestOpenRef.current) {
      setIsChestOpen(false);
      return;
    }

    const p = localPlayerRef.current;
    if (!p.inHouse) {
      // 1. Check crop harvesting
      let closestCropIdx = -1;
      let minDist = 35;
      cropsRef.current.forEach((crop, idx) => {
        const dist = Math.hypot(p.x - crop.x, p.y - crop.y);
        if (dist < minDist) {
          minDist = dist;
          closestCropIdx = idx;
        }
      });

      if (closestCropIdx !== -1 && cropsRef.current[closestCropIdx].stage === 2) {
        const cropType = cropsRef.current[closestCropIdx].type;
        const success = addToInventory(p, cropType);
        if (success) {
          performGameAction({ type: 'harvest', index: closestCropIdx });
        } else {
          alertFullBackpack();
        }
        return;
      }

      // 2. Check wild item gathering
      let closestItem: WildItem | null = null;
      let minItemDist = 35;
      wildItemsRef.current.forEach((item) => {
        if (item.active) {
          const dist = Math.hypot(p.x - item.x, p.y - item.y);
          if (dist < minItemDist) {
            minItemDist = dist;
            closestItem = item;
          }
        }
      });

      if (closestItem) {
        const itemType = (closestItem as WildItem).type;
        const success = addToInventory(p, itemType);
        if (success) {
          performGameAction({ type: 'pickup_item', itemId: (closestItem as WildItem).id });
        } else {
          alertFullBackpack();
        }
        return;
      }

      // 3. Check weed plucking
      let closestWeed: Weed | null = null;
      let minWeedDist = 25;
      for (const weed of weedsRef.current) {
        const dist = Math.hypot(p.x - weed.x, p.y - weed.y);
        if (dist < minWeedDist) {
          minWeedDist = dist;
          closestWeed = weed;
        }
      }

      if (closestWeed) {
        spawnPluckParticles(closestWeed.x, closestWeed.y);
        performGameAction({ type: 'pluck_weed', weedId: closestWeed.id });
        return;
      }
    }
  };

  const triggerUseHeldItem = () => {
    if (isChestOpenRef.current) return;

    const p = localPlayerRef.current;
    if (!p.inHouse) {
      const selectedSlotIdx = selectedSlotRef.current;
      const heldItem = p.inventory[selectedSlotIdx];

      if (heldItem && heldItem.type === 'seeds') {
        // Plant crop on plot (plot: x [350, 650], y [250, 450])
        const isOnPlot = p.x >= 350 && p.x <= 650 && p.y >= 250 && p.y <= 450;
        if (isOnPlot) {
          const newCrop: Crop = {
            x: p.x,
            y: p.y,
            type: Math.random() < 0.6 ? 'carrot' : 'pumpkin',
            stage: 0,
            watered: false,
            growthTimer: 0
          };
          performGameAction({ type: 'plant', crop: newCrop });

          // Consume seed
          heldItem.count--;
          if (heldItem.count <= 0) {
            p.inventory[selectedSlotIdx] = null;
          }
          setUiVersion((v) => v + 1);
        }
      } else if (heldItem && heldItem.type === 'watering_can') {
        // Water crop
        let closestCropIdx = -1;
        let minDist = 35;
        cropsRef.current.forEach((crop, idx) => {
          const dist = Math.hypot(p.x - crop.x, p.y - crop.y);
          if (dist < minDist) {
            minDist = dist;
            closestCropIdx = idx;
          }
        });
        if (closestCropIdx !== -1 && !cropsRef.current[closestCropIdx].watered) {
          performGameAction({ type: 'water', index: closestCropIdx });
        }
      }
    }
  };

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

      if (e.key === 'e' || e.key === 'E') {
        triggerInteract();
      }

      if (e.key === ' ') {
        triggerUseHeldItem();
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

  // Warning tracker for full backpack
  const inventoryFullTimeRef = useRef<number>(0);
  const lastChestTransferTimeRef = useRef<number>(0);
  const alertFullBackpack = () => {
    inventoryFullTimeRef.current = Date.now();
  };

  const performGameAction = (action: any) => {
    if (!isHost && isConnected) {
      // Client sends to Host to perform action
      sendGameEvent({ type: 'farm_action', action });
      return;
    }

    // Host or Single Player handles the action
    switch (action.type) {
      case 'plant':
        // Check if there is already a crop within 25px
        const dup = cropsRef.current.some(c => Math.hypot(c.x - action.crop.x, c.y - action.crop.y) < 25);
        if (!dup) {
          cropsRef.current.push(action.crop);
        }
        break;
      case 'water':
        if (cropsRef.current[action.index]) {
          cropsRef.current[action.index].watered = true;
        }
        break;
      case 'harvest':
        if (cropsRef.current[action.index]) {
          cropsRef.current.splice(action.index, 1);
        }
        break;
      case 'pickup_item':
        const itemObj = wildItemsRef.current.find(i => i.id === action.itemId);
        if (itemObj && itemObj.active) {
          itemObj.active = false;
          itemObj.respawnTimer = 0;
        }
        break;
      case 'chest_transfer':
        chestItemsRef.current = [...action.chest];
        break;
      case 'pluck_weed':
        weedsRef.current = weedsRef.current.filter((w) => w.id !== action.weedId);
        break;
      default:
        break;
    }
    // Force UI update
    setUiVersion(v => v + 1);
  };

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
      if (!isHost) {
        // Client receives master state from Host
        if (gameData.chest) {
          if (Date.now() - lastChestTransferTimeRef.current > 800) {
            chestItemsRef.current = [...gameData.chest];
          }
        }
        if (gameData.crops) cropsRef.current = [...gameData.crops];
        if (gameData.wildItems) wildItemsRef.current = [...gameData.wildItems];
        if (gameData.weeds) weedsRef.current = [...gameData.weeds];
        if (gameData.chickens) chickensRef.current = [...gameData.chickens];
        if (gameData.elapsedTime !== undefined) {
          elapsedTimeRef.current = gameData.elapsedTime;
        }
        setUiVersion(v => v + 1);
      }
    } else if (gameData.type === 'action') {
      if (isHost) {
        // Host performs the action requested by Client
        performGameAction(gameData.action);
      }
    }
  }, [gameData, isHost, performGameAction]);

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

  // Restart/Action trigger from peer
  useEffect(() => {
    if (gameEvent) {
      if (gameEvent.type === 'restart_farm') {
        handleRestartLocal();
        resetGameEvent();
      } else if (gameEvent.type === 'farm_action') {
        if (isHost) {
          performGameAction(gameEvent.action);
        }
        resetGameEvent();
      }
    }
  }, [gameEvent, isHost, performGameAction, resetGameEvent]);

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
      inventory: [
        { type: 'seeds', count: 1 },
        { type: 'watering_can', count: 1 },
        null
      ]
    };
    remotePlayerRef.current = {
      x: isHost ? 520 : 480,
      y: 350,
      gender: null,
      facingLeft: false,
      isMoving: false,
      inHouse: false,
      facingUp: false,
      inventory: [
        { type: 'seeds', count: 1 },
        { type: 'watering_can', count: 1 },
        null
      ]
    };
    smokeParticlesRef.current = [];
    fireParticlesRef.current = [];
    weedsRef.current = generateInitialWeeds();
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
    localPlayerRef.current.inventory = [
      { type: 'seeds', count: 1 },
      { type: 'watering_can', count: 1 },
      null
    ];

    remotePlayerRef.current.x = isHost ? 520 : 480;
    remotePlayerRef.current.y = 350;
    remotePlayerRef.current.gender = remoteGender;
    remotePlayerRef.current.inHouse = false;
    remotePlayerRef.current.facingUp = false;
    remotePlayerRef.current.inventory = [
      { type: 'seeds', count: 1 },
      { type: 'watering_can', count: 1 },
      null
    ];

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

      // Chest collision: x in [532, 568], y in [100, 120]
      if (x > 532 - margin && x < 568 + margin && y > 100 && y < 120 + margin) return true;

      return false;
    };

    const updatePhysics = () => {
      const p = localPlayerRef.current;

      // Poll gamepad buttons
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = Array.from(gamepads).find((g) => g !== null);

      if (gp) {
        const isButtonPressed = (btnIndex: number) => {
          return gp.buttons[btnIndex] ? gp.buttons[btnIndex].pressed : false;
        };
        const wasButtonPressed = (btnIndex: number) => {
          return prevGamepadButtonsRef.current[btnIndex] || false;
        };
        const isButtonJustPressed = (btnIndex: number) => {
          return isButtonPressed(btnIndex) && !wasButtonPressed(btnIndex);
        };

        // LB (4) -> Cycle inventory backward
        if (isButtonJustPressed(4)) {
          setSelectedSlot((curr) => (curr - 1 + 3) % 3);
        }
        // RB (5) -> Cycle inventory forward
        if (isButtonJustPressed(5)) {
          setSelectedSlot((curr) => (curr + 1) % 3);
        }

        // Button A (0) -> Use held item (Space)
        if (isButtonJustPressed(0)) {
          triggerUseHeldItem();
        }

        // Button X (2) -> Interact (E)
        if (isButtonJustPressed(2)) {
          triggerInteract();
        }

        // Button B (1) -> Close chest
        if (isButtonJustPressed(1) && isChestOpenRef.current) {
          setIsChestOpen(false);
        }

        prevGamepadButtonsRef.current = gp.buttons.map((b) => b.pressed);
      } else {
        prevGamepadButtonsRef.current = [];
      }

      // Proximity check for chest
      const distToChest = Math.hypot(p.x - 550, p.y - 120);
      isNearChestRef.current = p.inHouse && distToChest < 45;

      // Host or single-player ticks crop growth and wild items respawn
      if (isHost || !isConnected) {
        cropsRef.current.forEach((crop) => {
          if (crop.stage < 2 && crop.watered) {
            crop.growthTimer += 1 / 60;
            if (crop.growthTimer >= 8) { // 8 seconds per growth stage
              crop.stage++;
              crop.growthTimer = 0;
              crop.watered = false; // reset water status for next stage
            }
          }
        });

        // Wild item respawn logic
        wildItemsRef.current.forEach((item) => {
          if (!item.active) {
            item.respawnTimer += 1 / 60;
            if (item.respawnTimer >= 20) { // 20 seconds respawn timer
              item.active = true;
              item.respawnTimer = 0;
            }
          }
        });

        // Wild weed random spawning logic (Day 4 onwards, check every 20 seconds)
        if (elapsedTimeRef.current >= 6300) {
          const currentSpTime = Math.floor(elapsedTimeRef.current);
          if (currentSpTime > 0 && currentSpTime % 20 === 0) {
            const hasSpawnedThisTick = weedsRef.current.some(w => w.id.startsWith(`spawn_${currentSpTime}`));
            if (!hasSpawnedThisTick) {
              if (Math.random() < 0.4 && weedsRef.current.length < 90) {
                let spawned = false;
                let attempts = 0;
                while (!spawned && attempts < 100) {
                  attempts++;
                  const wx = 40 + Math.random() * (MAP_WIDTH - 80);
                  const wy = 40 + Math.random() * (MAP_HEIGHT - 80);

                  if (wx >= 395 && wx <= 605 && wy >= 55 && wy <= 215) continue;
                  if (wx >= 330 && wx <= 670 && wy >= 230 && wy <= 470) continue;

                  weedsRef.current.push({
                    id: `spawn_${currentSpTime}_${Math.floor(Math.random() * 1000)}`,
                    x: wx,
                    y: wy,
                    type: Math.floor(Math.random() * 3) + 1
                  });
                  spawned = true;
                  setUiVersion((v) => v + 1);
                }
              }
            }
          }
        }

        // Chickens wandering & animation update
        chickensRef.current.forEach((ch) => {
          ch.timer -= 1 / 60;
          if (ch.timer <= 0) {
            if (ch.state === 'idle') {
              ch.state = 'walking';
              const dirs: ('down' | 'left' | 'right' | 'up')[] = ['down', 'left', 'right', 'up'];
              ch.direction = dirs[Math.floor(Math.random() * dirs.length)];
              const speed = 0.5 + Math.random() * 0.4;
              if (ch.direction === 'left') { ch.vx = -speed; ch.vy = 0; }
              else if (ch.direction === 'right') { ch.vx = speed; ch.vy = 0; }
              else if (ch.direction === 'up') { ch.vx = 0; ch.vy = -speed; }
              else { ch.vx = 0; ch.vy = speed; }
              ch.timer = 1.5 + Math.random() * 2;
            } else {
              ch.state = 'idle';
              ch.vx = 0;
              ch.vy = 0;
              ch.timer = 1 + Math.random() * 2;
            }
          }

          if (ch.state === 'walking') {
            const nextX = ch.x + ch.vx;
            const nextY = ch.y + ch.vy;

            // Constrain wandering area: near their starting coordinates (up to 120px)
            const maxWander = 120;
            const withinBoundaries = 
              nextX >= Math.max(40, ch.startX - maxWander) && 
              nextX <= Math.min(MAP_WIDTH - 40, ch.startX + maxWander) &&
              nextY >= Math.max(40, ch.startY - maxWander) && 
              nextY <= Math.min(MAP_HEIGHT - 40, ch.startY + maxWander);

            // Check boundaries and house collision
            if (withinBoundaries && !checkHouseCollision(nextX, nextY)) {
              ch.x = nextX;
              ch.y = nextY;
            } else {
              // Bounced or hit boundary: turn around
              ch.vx = -ch.vx;
              ch.vy = -ch.vy;
              if (ch.direction === 'left') ch.direction = 'right';
              else if (ch.direction === 'right') ch.direction = 'left';
              else if (ch.direction === 'up') ch.direction = 'down';
              else ch.direction = 'up';
            }

            // Animate walking frames (4 frames per row, 8 ticks per frame)
            ch.animationTick++;
            if (ch.animationTick >= 8) {
              ch.frameIndex = (ch.frameIndex + 1) % 4;
              ch.animationTick = 0;
            }
          } else {
            // Idle frame animation: slower blinking/pecking
            ch.animationTick++;
            if (ch.animationTick >= 16) {
              ch.frameIndex = (ch.frameIndex + 1) % 4;
              ch.animationTick = 0;
            }
          }
        });
      }

      if (isChestOpenRef.current) {
        p.isMoving = false;
      } else {
        let dx = 0;
        let dy = 0;

        let gpDx = 0;
        let gpDy = 0;
        if (gp) {
          const deadzone = 0.2;
          const axisX = gp.axes[0] || 0;
          const axisY = gp.axes[1] || 0;

          if (Math.abs(axisX) > deadzone) gpDx = axisX;
          if (Math.abs(axisY) > deadzone) gpDy = axisY;

          if (gp.buttons[14] && gp.buttons[14].pressed) gpDx = -1;
          if (gp.buttons[15] && gp.buttons[15].pressed) gpDx = 1;
          if (gp.buttons[12] && gp.buttons[12].pressed) gpDy = -1;
          if (gp.buttons[13] && gp.buttons[13].pressed) gpDy = 1;

          const mag = Math.sqrt(gpDx * gpDx + gpDy * gpDy);
          if (mag > 1) {
            gpDx /= mag;
            gpDy /= mag;
          }
        }

        if (gpDx !== 0 || gpDy !== 0) {
          dx = gpDx;
          dy = gpDy;
        } else {
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
      }

      if (isHost) {
        elapsedTimeRef.current += 1 / 60;
      }

      // Sync character position and master states (Host only) with remote peer
      if (isHost) {
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
          chest: chestItemsRef.current,
          crops: cropsRef.current,
          wildItems: wildItemsRef.current,
          weeds: weedsRef.current,
          chickens: chickensRef.current,
          elapsedTime: elapsedTimeRef.current
        });
      } else {
        // Client only sends player state
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
          }
        });
      }



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

      const drawChest = (cCtx: CanvasRenderingContext2D, cx: number, cy: number) => {
        const width = 36;
        const height = 28;
        const rx = cx - width / 2;
        const ry = cy - height;

        // Wooden body
        cCtx.fillStyle = '#8B5A2B';
        cCtx.fillRect(rx, ry, width, height);

        // Seams and detail lines (dark brown)
        cCtx.fillStyle = '#5C3A21';
        cCtx.fillRect(rx, ry + height - 4, width, 4); // bottom shadow
        cCtx.fillRect(rx + 3, ry + 12, width - 6, 2); // middle seam

        // Gold trim bands
        cCtx.fillStyle = '#FFD700';
        cCtx.fillRect(rx, ry, 3, height); // left border
        cCtx.fillRect(rx + width - 3, ry, 3, height); // right border
        cCtx.fillRect(rx + 3, ry, width - 6, 3); // top border

        // Lock plate
        cCtx.fillStyle = '#DAA520';
        cCtx.fillRect(rx + width / 2 - 4, ry + 10, 8, 7);
        cCtx.fillStyle = '#000000';
        cCtx.fillRect(rx + width / 2 - 1, ry + 12, 2, 4); // lock keyhole
      };

      const drawTooltip = (tCtx: CanvasRenderingContext2D, text: string, subtext: string, tx: number, ty: number) => {
        tCtx.save();
        tCtx.font = 'bold 9px Orbitron';
        const textWidth = tCtx.measureText(text).width;
        tCtx.font = '7px Orbitron';
        const subtextWidth = tCtx.measureText(subtext).width;
        const w = Math.max(textWidth, subtextWidth) + 16;
        const h = 26;
        const bx = tx - w / 2;
        const by = ty - h - 10;

        // Bubble background
        tCtx.fillStyle = 'rgba(11, 12, 21, 0.9)';
        tCtx.strokeStyle = 'rgba(255, 234, 0, 0.8)';
        tCtx.lineWidth = 1;
        tCtx.beginPath();
        if (tCtx.roundRect) {
          tCtx.roundRect(bx, by, w, h, 6);
        } else {
          tCtx.rect(bx, by, w, h);
        }
        tCtx.fill();
        tCtx.stroke();

        // Arrow pointer pointing down
        tCtx.fillStyle = 'rgba(11, 12, 21, 0.9)';
        tCtx.beginPath();
        tCtx.moveTo(tx - 4, by + h);
        tCtx.lineTo(tx, by + h + 4);
        tCtx.lineTo(tx + 4, by + h);
        tCtx.closePath();
        tCtx.fill();
        tCtx.strokeStyle = 'rgba(255, 234, 0, 0.8)';
        tCtx.beginPath();
        tCtx.moveTo(tx - 4, by + h);
        tCtx.lineTo(tx, by + h + 4);
        tCtx.lineTo(tx + 4, by + h);
        tCtx.stroke();

        // Text
        tCtx.fillStyle = '#ffea00';
        tCtx.font = 'bold 9px Orbitron';
        tCtx.textAlign = 'center';
        tCtx.textBaseline = 'top';
        tCtx.fillText(text, tx, by + 4);

        // Subtext
        tCtx.fillStyle = '#ffffff';
        tCtx.font = '7px Orbitron';
        tCtx.fillText(subtext, tx, by + 15);
        tCtx.restore();
      };

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

        // Draw Chest in house (at top right, x=550, y=120)
        drawChest(ctx, 550, 120);

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

        // Chest Tooltip Proximity Check
        if (isNearChestRef.current) {
          drawTooltip(ctx, 'CHEST', 'Press [E] to Open', 550, 120 - 15);
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

        // 2. Draw Planted Crops on soil plot
        cropsRef.current.forEach((crop) => {
          // Draw dirt mound
          ctx.fillStyle = '#4E3629';
          ctx.beginPath();
          ctx.ellipse(crop.x, crop.y - 2, 10, 5, 0, 0, Math.PI * 2);
          ctx.fill();

          // Blue outline ring if watered
          if (crop.watered) {
            ctx.strokeStyle = '#29b6f6';
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }

          if (crop.stage === 0) {
            // Seedling sprout (tiny green dot)
            ctx.fillStyle = '#a1e9a4';
            ctx.fillRect(crop.x - 1, crop.y - 6, 2, 4);
            ctx.fillStyle = '#81c784';
            ctx.beginPath();
            ctx.arc(crop.x, crop.y - 6, 2, 0, Math.PI * 2);
            ctx.fill();
          } else if (crop.stage === 1) {
            // Medium sprout (small double leaves)
            ctx.fillStyle = '#4caf50';
            ctx.fillRect(crop.x - 1, crop.y - 8, 2, 6);
            ctx.beginPath();
            ctx.arc(crop.x - 3, crop.y - 8, 2.5, 0, Math.PI * 2);
            ctx.arc(crop.x + 3, crop.y - 8, 2.5, 0, Math.PI * 2);
            ctx.fill();
          } else if (crop.stage === 2) {
            // Fully Grown Veggie
            ctx.font = '15px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            const cropEmoji = crop.type === 'carrot' ? '🥕' : '🎃';
            ctx.fillText(cropEmoji, crop.x, crop.y + 2);
          }
        });

        // 3. Draw Wild Collectibles
        wildItemsRef.current.forEach((item) => {
          if (item.active) {
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.beginPath();
            ctx.ellipse(item.x, item.y - 1, 9, 3, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.font = '15px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            let emoji = '🪵';
            if (item.type === 'berry') emoji = '🍓';
            else if (item.type === 'stone') emoji = '🪨';
            ctx.fillText(emoji, item.x, item.y + 2);
          }
        });

        // 3.5 Draw Wild Weeds
        weedsRef.current.forEach((weed) => {
          const type = weed.type || (parseInt(weed.id.split('_')[2] || '0') % 3) + 1;
          let img: HTMLImageElement | null = null;
          let w = 18;
          let h = 18;
          let shadowW = 6;
          let shadowH = 2;

          if (type === 1) {
            img = weed1ImageRef.current;
            w = 12;
            h = 12;
            shadowW = 4;
            shadowH = 1.5;
          } else if (type === 3) {
            img = weed3ImageRef.current;
            w = 26;
            h = 26;
            shadowW = 9;
            shadowH = 3;
          } else {
            img = weed2ImageRef.current;
            w = 18;
            h = 18;
            shadowW = 6;
            shadowH = 2;
          }

          // Draw shadow
          ctx.fillStyle = 'rgba(0,0,0,0.12)';
          ctx.beginPath();
          ctx.ellipse(weed.x, weed.y - 1, shadowW, shadowH, 0, 0, Math.PI * 2);
          ctx.fill();

          // Draw image
          if (img) {
            ctx.drawImage(img, weed.x - w / 2, weed.y - h, w, h);
          }
        });

        // 3.8 Draw Chickens
        chickensRef.current.forEach((ch) => {
          // Draw shadow
          ctx.fillStyle = 'rgba(0,0,0,0.15)';
          ctx.beginPath();
          ctx.ellipse(ch.x, ch.y - 1, 6, 2, 0, 0, Math.PI * 2);
          ctx.fill();

          if (chickenImageRef.current) {
            let row = 0;
            if (ch.direction === 'left') row = 1;
            else if (ch.direction === 'right') row = 2;
            else if (ch.direction === 'up') row = 3;

            const size = 32;
            const sx = ch.frameIndex * size;
            const sy = row * size;

            ctx.drawImage(
              chickenImageRef.current,
              sx,
              sy,
              size,
              size,
              ch.x - 12,
              ch.y - 22,
              24,
              24
            );
          }
        });

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

        // 7. Draw Interaction Tooltips (relative to camera position)
        let closestCropIdx = -1;
        let minDist = 35;
        cropsRef.current.forEach((crop, idx) => {
          const dist = Math.hypot(p1.x - crop.x, p1.y - crop.y);
          if (dist < minDist) {
            minDist = dist;
            closestCropIdx = idx;
          }
        });
        const closestCrop = closestCropIdx !== -1 ? cropsRef.current[closestCropIdx] : null;

        if (closestCrop && closestCrop.stage === 2) {
          drawTooltip(ctx, 'READY CROP', 'Press [E] to Harvest', closestCrop.x, closestCrop.y - 12);
        } else {
          // Check proximity to wild items
          let closestItem: WildItem | null = null;
          let minItemDist = 35;
          wildItemsRef.current.forEach((item) => {
            if (item.active) {
              const dist = Math.hypot(p1.x - item.x, p1.y - item.y);
              if (dist < minItemDist) {
                minItemDist = dist;
                closestItem = item;
              }
            }
          });

          if (closestItem) {
            drawTooltip(ctx, (closestItem as WildItem).type.toUpperCase(), 'Press [E] to Gather', (closestItem as WildItem).x, (closestItem as WildItem).y - 12);
          } else {
            // Check weed proximity
            let closestWeed: Weed | null = null;
            let minWeedDist = 25;
            for (const weed of weedsRef.current) {
              const dist = Math.hypot(p1.x - weed.x, p1.y - weed.y);
              if (dist < minWeedDist) {
                minWeedDist = dist;
                closestWeed = weed;
              }
            }

            if (closestWeed) {
              drawTooltip(ctx, 'WILD WEED', 'Press [E] to Clean', closestWeed.x, closestWeed.y - 10);
            } else {
              // Plot tools hints
              const isOnPlot = p1.x >= 350 && p1.x <= 650 && p1.y >= 250 && p1.y <= 450;
              if (isOnPlot) {
                const heldItem = p1.inventory[selectedSlotRef.current];
                if (heldItem && heldItem.type === 'seeds') {
                  drawTooltip(ctx, 'SOIL PLOT', 'Press [Space] to Plant', p1.x, p1.y - 45);
                } else if (heldItem && heldItem.type === 'watering_can' && closestCrop && !closestCrop.watered) {
                  drawTooltip(ctx, 'DRY CROP', 'Press [Space] to Water', closestCrop.x, closestCrop.y - 12);
                }
              }
            }
          }
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
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      // Draw Day count
      ctx.fillStyle = '#ffea00';
      ctx.font = 'bold 8px Orbitron';
      ctx.fillText(`DAY ${clockInfo.virtualDay}`, 688, 25);

      // Draw Time string
      ctx.fillStyle = '#f8f9fa';
      ctx.font = 'bold 9px Orbitron';
      ctx.fillText(clockInfo.timeStr, 688, 37);

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

        // Draw the item emoji inside the slot
        const item = p1.inventory[i];
        if (item) {
          ctx.font = '14px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(getItemEmoji(item.type), sx + slotSize / 2, slotY + slotSize / 2 + 1);

          // Draw stack count inside the slot circle
          if (item.type !== 'watering_can') {
            ctx.fillStyle = '#ffea00';
            ctx.font = 'bold 8px Orbitron';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText(String(item.count), sx + slotSize - 3, slotY + slotSize - 2);
          }
        }
      }

      // Draw Backpack Full alert (in screen space)
      if (Date.now() - inventoryFullTimeRef.current < 2000) {
        ctx.fillStyle = '#ff4a4a';
        ctx.font = 'bold 12px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('BACKPACK FULL!', CANVAS_WIDTH / 2, 100);
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

  const transferToChest = (playerSlotIdx: number) => {
    const p = localPlayerRef.current;
    const item = p.inventory[playerSlotIdx];
    if (!item) return;

    const newChest = chestItemsRef.current.map((slot) => (slot ? { ...slot } : null));

    if (item.type !== 'watering_can') {
      for (let i = 0; i < newChest.length; i++) {
        const slot = newChest[i];
        if (slot && slot.type === item.type && slot.count < 10) {
          const space = 10 - slot.count;
          const transferAmt = Math.min(space, item.count);
          slot.count += transferAmt;
          item.count -= transferAmt;
          if (item.count <= 0) {
            p.inventory[playerSlotIdx] = null;
            break;
          }
        }
      }
    }

    if (item.count > 0) {
      const emptyChestIdx = newChest.findIndex((slot) => slot === null);
      if (emptyChestIdx !== -1) {
        newChest[emptyChestIdx] = { type: item.type, count: item.count };
        p.inventory[playerSlotIdx] = null;
      }
    }

    // Set local chest state and lock sync immediately to avoid lag/flashing
    chestItemsRef.current = newChest;
    lastChestTransferTimeRef.current = Date.now();

    performGameAction({ type: 'chest_transfer', chest: newChest });
    setUiVersion((v) => v + 1);
  };

  const transferToPlayer = (chestSlotIdx: number) => {
    const p = localPlayerRef.current;
    const item = chestItemsRef.current[chestSlotIdx];
    if (!item) return;

    const newChest = chestItemsRef.current.map((slot) => (slot ? { ...slot } : null));
    const chestItem = newChest[chestSlotIdx];
    if (!chestItem) return;

    if (chestItem.type !== 'watering_can') {
      for (let i = 0; i < p.inventory.length; i++) {
        const slot = p.inventory[i];
        if (slot && slot.type === chestItem.type && slot.count < 10) {
          const space = 10 - slot.count;
          const transferAmt = Math.min(space, chestItem.count);
          slot.count += transferAmt;
          chestItem.count -= transferAmt;
          if (chestItem.count <= 0) {
            newChest[chestSlotIdx] = null;
            break;
          }
        }
      }
    }

    if (chestItem.count > 0) {
      const emptyPlayerIdx = p.inventory.findIndex((slot) => slot === null);
      if (emptyPlayerIdx !== -1) {
        p.inventory[emptyPlayerIdx] = { type: chestItem.type, count: chestItem.count };
        newChest[chestSlotIdx] = null;
      } else {
        alertFullBackpack();
      }
    }

    // Set local chest state and lock sync immediately to avoid lag/flashing
    chestItemsRef.current = newChest;
    lastChestTransferTimeRef.current = Date.now();

    performGameAction({ type: 'chest_transfer', chest: newChest });
    setUiVersion((v) => v + 1);
  };

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
      <GameHeader
        volume={volume}
        isFullscreen={isFullscreen}
        onVolumeChange={handleVolumeChange}
        onToggleFullscreen={toggleFullscreen}
        onRestart={triggerRestart}
        onExit={stopGame}
        gamepadConnected={gamepadConnected}
      />

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
          <CharacterSelection
            localGender={localGender}
            remoteGender={remoteGender}
            isConnected={isConnected}
            onSelectGender={setLocalGender}
          />
        )}

        {/* Storage Chest UI Overlay */}
        <ChestOverlay
          isOpen={isChestOpen}
          uiVersion={uiVersion}
          chestItems={chestItemsRef.current}
          playerInventory={localPlayerRef.current.inventory}
          onClose={() => setIsChestOpen(false)}
          onTransferToPlayer={transferToPlayer}
          onTransferToChest={transferToChest}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '900px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        <div>
          <span>Walk: </span><span style={{ color: 'var(--text-primary)' }}>WASD / Arrows</span> | <span>Action: </span><span style={{ color: 'var(--text-primary)' }}>Space (Use Item)</span> | <span>Interact: </span><span style={{ color: 'var(--text-primary)' }}>E (Harvest/Chest)</span> | <span>Controller: </span><span style={{ color: 'var(--text-primary)' }}>Left Stick / D-pad (Move), Button A (Use Item), Button X (Interact), LB / RB (Cycle slots)</span>
        </div>
        <div>
          <span>Farm Together: </span><span style={{ color: 'var(--neon-yellow)', fontWeight: 600 }}>Spawned at empty center plot</span>
        </div>
      </div>
    </div>
  );
};
