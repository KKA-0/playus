import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Peer } from 'peerjs';
import type { DataConnection } from 'peerjs';

export interface ChatMessage {
  id: string;
  sender: 'self' | 'other' | 'system';
  senderName: string;
  text: string;
  timestamp: Date;
}

interface PeerContextType {
  peerId: string;
  targetId: string;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  isHost: boolean;
  messages: ChatMessage[];
  ping: number;
  activeGame: 'platformer' | 'shooter' | 'snake' | 'chained' | 'music' | null;
  isGameStarted: boolean;
  gameData: any;
  gameEvent: any;
  resetGameEvent: () => void;
  hostGame: () => Promise<string>;
  joinGame: (targetId: string) => Promise<void>;
  disconnect: () => void;
  sendMessage: (text: string) => void;
  sendGameData: (data: any) => void;
  selectGame: (game: 'platformer' | 'shooter' | 'snake' | 'chained' | 'music' | null) => void;
  startGame: () => void;
  stopGame: () => void;
  sendGameEvent: (data: any) => void;
  spotifySyncData: { uri: string; position: number; isPaused: boolean; timestamp: number; genre?: string | null } | null;
  sendSpotifySync: (data: { uri: string; position: number; isPaused: boolean; genre?: string | null }) => void;
  activeMusicUri: string;
  setActiveMusicUri: (uri: string) => void;
  soundtrackGenre: string | null;
  setSoundtrackGenre: (genre: string | null) => void;
}

const PeerContext = createContext<PeerContextType | undefined>(undefined);

export const usePeer = () => {
  const context = useContext(PeerContext);
  if (!context) {
    throw new Error('usePeer must be used within a PeerProvider');
  }
  return context;
};

export const PeerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [peerId, setPeerId] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isHost, setIsHost] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [ping, setPing] = useState<number>(0);
  const [activeGame, setActiveGame] = useState<'platformer' | 'shooter' | 'snake' | 'chained' | 'music' | null>(null);
  const [isGameStarted, setIsGameStarted] = useState<boolean>(false);
  const [gameData, setGameData] = useState<any>(null);
  const [gameEvent, setGameEvent] = useState<any>(null);
  const [spotifySyncData, setSpotifySyncData] = useState<{ uri: string; position: number; isPaused: boolean; timestamp: number; genre?: string | null } | null>(null);
  const [activeMusicUri, setActiveMusicUri] = useState<string>('spotify:playlist:37i9dQZF1DXdLTE7aGDX1r');
  const [soundtrackGenre, setSoundtrackGenre] = useState<string | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const pingIntervalRef = useRef<any>(null);

  // Clean up PeerJS instances on unmount
  useEffect(() => {
    return () => {
      cleanupConnection();
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, []);

  const cleanupConnection = () => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (connRef.current) {
      connRef.current.close();
      connRef.current = null;
    }
    setIsConnected(false);
    setIsGameStarted(false);
    setPing(0);
  };

  const addSystemMessage = (text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        sender: 'system',
        senderName: 'System',
        text,
        timestamp: new Date(),
      },
    ]);
  };

  // Helper to hook up connection listeners
  const setupConnectionListeners = (conn: DataConnection) => {
    connRef.current = conn;

    conn.on('open', () => {
      setIsConnected(true);
      setIsConnecting(false);
      setConnectionError(null);
      setTargetId(conn.peer);
      addSystemMessage(`Connected to player: ${conn.peer.substring(0, 6)}...`);

      // Setup Heartbeat / Ping check
      let lastPingTime = Date.now();
      pingIntervalRef.current = setInterval(() => {
        if (connRef.current && connRef.current.open) {
          lastPingTime = Date.now();
          connRef.current.send({ type: 'ping', time: lastPingTime });
        }
      }, 3000);
    });

    conn.on('data', (data: any) => {
      if (!data || typeof data !== 'object') return;

      switch (data.type) {
        case 'ping':
          // Answer with pong
          if (connRef.current && connRef.current.open) {
            connRef.current.send({ type: 'pong', time: data.time });
          }
          break;

        case 'pong':
          // Calculate roundtrip latency
          const latency = Math.max(0, Date.now() - data.time);
          setPing(Math.round(latency / 2));
          break;

        case 'chat':
          setMessages((prev) => [
            ...prev,
            {
              id: Math.random().toString(36).substr(2, 9),
              sender: 'other',
              senderName: conn.peer.substring(0, 6),
              text: data.text,
              timestamp: new Date(),
            },
          ]);
          break;

        case 'select_game':
          setActiveGame(data.game);
          break;

        case 'start_game':
          setIsGameStarted(true);
          break;

        case 'stop_game':
          setIsGameStarted(false);
          break;

        case 'game_sync':
          setGameData(data.payload);
          break;

        case 'game_event':
          setGameEvent(data.payload);
          break;

        case 'spotify_sync':
          setSpotifySyncData(data.payload);
          if (data.payload && data.payload.uri) {
            setActiveMusicUri(data.payload.uri);
          }
          if (data.payload && data.payload.genre !== undefined) {
            setSoundtrackGenre(data.payload.genre);
          }
          break;

        default:
          break;
      }
    });

    conn.on('close', () => {
      addSystemMessage('Connection closed by remote player.');
      cleanupConnection();
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
      setConnectionError('Connection error occurred.');
      cleanupConnection();
    });
  };

  const hostGame = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      setIsConnecting(true);
      setConnectionError(null);
      setIsHost(true);

      // Create peer object (connects to PeerJS public cloud signaling server)
      const peer = new Peer({
        debug: 1, // Only print warnings & errors
      });

      peerRef.current = peer;

      peer.on('open', (id) => {
        setPeerId(id);
        setIsConnecting(false);
        addSystemMessage(`Lobby created. Code: ${id}`);
        resolve(id);
      });

      peer.on('connection', (conn) => {
        // Accept incoming connection (close old one if exists)
        cleanupConnection();
        addSystemMessage(`Incoming connection from ${conn.peer.substring(0, 6)}...`);
        setupConnectionListeners(conn);
      });

      peer.on('error', (err) => {
        console.error('Peer host error:', err);
        setIsConnecting(false);
        setConnectionError(`Failed to host: ${err.type}`);
        reject(err);
      });
    });
  };

  const joinGame = (id: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!id || id.trim() === '') {
        setConnectionError('Please enter a valid lobby code.');
        reject('Invalid code');
        return;
      }

      setIsConnecting(true);
      setConnectionError(null);
      setIsHost(false);

      // Create local peer
      const peer = new Peer({
        debug: 1,
      });

      peerRef.current = peer;

      peer.on('open', (localId) => {
        setPeerId(localId);

        // Initiate connection to host
        const conn = peer.connect(id.trim(), {
          reliable: true,
        });

        setupConnectionListeners(conn);
        resolve();
      });

      peer.on('error', (err) => {
        console.error('Peer join error:', err);
        setIsConnecting(false);
        setConnectionError(`Failed to connect: Room not found or signaling error.`);
        reject(err);
      });
    });
  };

  const disconnect = () => {
    cleanupConnection();
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setPeerId('');
    setTargetId('');
    setMessages([]);
    setActiveGame(null);
    setIsHost(false);
    setSpotifySyncData(null);
    setActiveMusicUri('spotify:playlist:37i9dQZF1DXdLTE7aGDX1r');
    setSoundtrackGenre(null);
  };

  const sendMessage = (text: string) => {
    if (!text || text.trim() === '') return;

    // Append to local messages
    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        sender: 'self',
        senderName: 'You',
        text,
        timestamp: new Date(),
      },
    ]);

    // Send to peer
    if (connRef.current && connRef.current.open) {
      connRef.current.send({
        type: 'chat',
        text: text,
      });
    }
  };

  const sendGameData = (data: any) => {
    if (connRef.current && connRef.current.open) {
      connRef.current.send({
        type: 'game_sync',
        payload: data,
      });
    }
  };

  // Select game (Host authoritative, client can request but let's make host broadcast)
  const selectGame = (game: 'platformer' | 'shooter' | 'snake' | 'chained' | 'music' | null) => {
    setActiveGame(game);
    if (connRef.current && connRef.current.open) {
      connRef.current.send({
        type: 'select_game',
        game,
      });
    }
  };

  const startGame = () => {
    setIsGameStarted(true);
    if (connRef.current && connRef.current.open) {
      connRef.current.send({
        type: 'start_game',
      });
    }
  };

  const stopGame = () => {
    setIsGameStarted(false);
    if (connRef.current && connRef.current.open) {
      connRef.current.send({
        type: 'stop_game',
      });
    }
  };

  const resetGameEvent = () => {
    setGameEvent(null);
  };

  const sendSpotifySync = (data: { uri: string; position: number; isPaused: boolean; genre?: string | null }) => {
    if (connRef.current && connRef.current.open) {
      connRef.current.send({
        type: 'spotify_sync',
        payload: {
          ...data,
          timestamp: Date.now()
        }
      });
    }
  };

  // Broadcast one-off game events (e.g. key collect, level advancement)
  const sendGameEvent = (data: any) => {
    if (connRef.current && connRef.current.open) {
      connRef.current.send({
        type: 'game_event',
        payload: data,
      });
    }
  };

  return (
    <PeerContext.Provider
      value={{
        peerId,
        targetId,
        isConnected,
        isConnecting,
        connectionError,
        isHost,
        messages,
        ping,
        activeGame,
        isGameStarted,
        gameData,
        gameEvent,
        resetGameEvent,
        hostGame,
        joinGame,
        disconnect,
        sendMessage,
        sendGameData,
        selectGame,
        startGame,
        stopGame,
        sendGameEvent,
        spotifySyncData,
        sendSpotifySync,
        activeMusicUri,
        setActiveMusicUri,
        soundtrackGenre,
        setSoundtrackGenre,
      }}
    >
      {children}
    </PeerContext.Provider>
  );
};
