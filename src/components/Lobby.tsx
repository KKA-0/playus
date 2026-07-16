import React, { useState, useEffect, useRef } from 'react';
import { usePeer } from '../context/PeerContext';
import { 
  Play, Copy, Check, MessageSquare, Users, Wifi, 
  Gamepad2, LogOut, ArrowRight, ShieldAlert
} from 'lucide-react';

export const Lobby: React.FC = () => {
  const {
    peerId,
    isConnected,
    isConnecting,
    connectionError,
    isHost,
    messages,
    ping,
    activeGame,
    hostGame,
    joinGame,
    disconnect,
    sendMessage,
    selectGame,
    startGame,
  } = usePeer();

  const [inputCode, setInputCode] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(peerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleHost = async () => {
    try {
      await hostGame();
    } catch (err) {
      console.error(err);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    try {
      await joinGame(inputCode.trim());
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendMessage(chatInput.trim());
    setChatInput('');
  };



  // Render Setup Screen (Not connected)
  if (!isConnected && !peerId && !isConnecting) {
    return (
      <div className="setup-container glass-panel">
        <h1 className="logo-text font-display">PLAYUS</h1>
        <p className="setup-subtitle">Instant Real-time Co-op HTML5 Games via WebRTC P2P</p>

        <div className="setup-modes">
          <div className="setup-card host glass-panel">
            <div className="card-icon">
              <Users size={32} />
            </div>
            <h2>Host a Lobby</h2>
            <p>Create a new co-op session and get a shareable code to invite your friend.</p>
            <button className="glow-btn-cyan font-display" onClick={handleHost} style={{ width: '100%', padding: '0.85rem' }}>
              Create Lobby
            </button>
          </div>

          <div className="setup-card join glass-panel">
            <div className="card-icon">
              <Gamepad2 size={32} />
            </div>
            <h2>Join a Lobby</h2>
            <p>Enter the game lobby code provided by your friend to join their session.</p>
            <form onSubmit={handleJoin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="text"
                className="input-neon"
                placeholder="Enter Lobby Code..."
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
              />
              <button 
                type="submit" 
                className="glow-btn-magenta font-display" 
                style={{ width: '100%', padding: '0.85rem' }}
                disabled={!inputCode.trim()}
              >
                Join Game
              </button>
            </form>
          </div>
        </div>

        {connectionError && (
          <div className="peer-badge text-magenta" style={{ marginTop: '2rem', borderColor: 'var(--neon-magenta)', background: 'rgba(255,0,127,0.05)' }}>
            <ShieldAlert size={16} />
            <span>{connectionError}</span>
          </div>
        )}
      </div>
    );
  }

  // Render Connecting Spinner Screen
  if (isConnecting || (peerId && !isConnected && !isHost)) {
    return (
      <div className="connecting-container glass-panel">
        <div className="spinner">
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
        </div>
        <h2 className="font-display text-cyan">Connecting to Signalling Server...</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          {isHost ? 'Generating room credentials...' : `Connecting to room: ${inputCode}...`}
        </p>
        <button className="glow-btn-magenta" onClick={disconnect} style={{ padding: '0.5rem 1.5rem' }}>
          Cancel
        </button>
      </div>
    );
  }

  // Render Waiting for Peer Screen (Hosted but nobody joined yet)
  if (isHost && !isConnected && peerId) {
    return (
      <div className="connecting-container glass-panel">
        <div className="spinner">
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
        </div>
        <h2 className="font-display text-cyan">Waiting for Player 2...</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Share this code with your friend to connect.</p>
        
        <div className="share-block">
          <div className="copy-input">{peerId}</div>
          <button className="copy-btn" onClick={handleCopyCode} title="Copy Code">
            {copied ? <Check size={16} className="text-green" /> : <Copy size={16} />}
          </button>
        </div>

        <button className="glow-btn-magenta" onClick={disconnect} style={{ padding: '0.5rem 1.5rem', marginTop: '1rem' }}>
          Close Lobby
        </button>
      </div>
    );
  }

  // Render Lobby Room Screen (Connected!)
  return (
    <div className="lobby-grid">
      <div className="lobby-main">
        {/* Connection status bar */}
        <div className="players-status-bar glass-panel">
          <div className={`player-node host ${isHost ? 'active' : ''}`}>
            <div className="player-avatar host">P1</div>
            <div className="player-info">
              <span className="player-name">{isHost ? 'You' : 'Opponent'}</span>
              <span className="player-role">Host</span>
            </div>
          </div>

          <div className={`player-node guest ${!isHost ? 'active' : ''}`}>
            <div className="player-avatar guest">P2</div>
            <div className="player-info">
              <span className="player-name">{!isHost ? 'You' : 'Opponent'}</span>
              <span className="player-role">Client</span>
            </div>
          </div>
        </div>

        {/* Game selection screen */}
        <div className="game-selector-panel glass-panel">
          <h2 className="game-selector-title font-display text-cyan">Select Co-op Game</h2>
          <div className="games-grid">
            <div 
              className={`game-option-card platformer ${activeGame === 'platformer' ? 'selected' : ''}`}
              onClick={() => isHost && selectGame('platformer')}
              style={{ pointerEvents: isHost ? 'auto' : 'none' }}
            >
              <div className="game-card-img">
                <Gamepad2 className="game-card-icon" />
              </div>
              <div className="game-card-content">
                <h3 className="game-card-title">Gem Hunters</h3>
                <p className="game-card-desc">Jump, dodge traps, and stand on pressure plates in this pixel platformer to open gates for each other and grab the exit key!</p>
                <span className="game-card-players">Co-op Platformer</span>
              </div>
            </div>

            <div 
              className={`game-option-card shooter ${activeGame === 'shooter' ? 'selected' : ''}`}
              onClick={() => isHost && selectGame('shooter')}
              style={{ pointerEvents: isHost ? 'auto' : 'none' }}
            >
              <div className="game-card-img">
                <Gamepad2 className="game-card-icon" />
              </div>
              <div className="game-card-content">
                <h3 className="game-card-title">Arena Survival</h3>
                <p className="game-card-desc">Top-down shooter where players share a health bar. Defeat hordes of incoming monsters together and watch each other's back!</p>
                <span className="game-card-players">Top-Down Survival</span>
              </div>
            </div>

            <div 
              className={`game-option-card snake ${activeGame === 'snake' ? 'selected' : ''}`}
              onClick={() => isHost && selectGame('snake')}
              style={{ pointerEvents: isHost ? 'auto' : 'none' }}
            >
              <div className="game-card-img">
                <Gamepad2 className="game-card-icon" />
              </div>
              <div className="game-card-content">
                <h3 className="game-card-title">Cyber Slither</h3>
                <p className="game-card-desc">Slither around, eat glowing pellets to grow, and speed boost with left click. Avoid crashing into AI opponent bots or the screen boundaries!</p>
                <span className="game-card-players">Co-op Snake Arena</span>
              </div>
            </div>

            <div 
              className={`game-option-card chained ${activeGame === 'chained' ? 'selected' : ''}`}
              onClick={() => isHost && selectGame('chained')}
              style={{ pointerEvents: isHost ? 'auto' : 'none' }}
            >
              <div className="game-card-img">
                <Gamepad2 className="game-card-icon" />
              </div>
              <div className="game-card-content">
                <h3 className="game-card-title">Chained Together</h3>
                <p className="game-card-desc">Coordinate your movements and jumps in this physics climb! You are linked by a spring chain, so pull each other up to ascend platforms.</p>
                <span className="game-card-players">Co-op physics climber</span>
              </div>
            </div>

            <div 
              className={`game-option-card farm ${activeGame === 'farm' ? 'selected' : ''}`}
              onClick={() => isHost && selectGame('farm')}
              style={{ pointerEvents: isHost ? 'auto' : 'none' }}
            >
              <div className="game-card-img">
                <Gamepad2 className="game-card-icon" />
              </div>
              <div className="game-card-content">
                <h3 className="game-card-title">Farm Together</h3>
                <p className="game-card-desc">Choose a character and explore a cozy 2D farm together in a classic GBA-style top-down layout.</p>
                <span className="game-card-players">Co-op Farm Exploration</span>
              </div>
            </div>

            <div 
              className={`game-option-card drawing ${activeGame === 'drawing' ? 'selected' : ''}`}
              onClick={() => isHost && selectGame('drawing')}
              style={{ pointerEvents: isHost ? 'auto' : 'none' }}
            >
              <div className="game-card-img">
                <Gamepad2 className="game-card-icon" />
              </div>
              <div className="game-card-content">
                <h3 className="game-card-title">Chaotic Drawing</h3>
                <p className="game-card-desc">Draw a chosen word together! Take turns drawing on a synced canvas that alternates every 10 seconds. Create a masterpiece together!</p>
                <span className="game-card-players">Co-op Alternating Drawing</span>
              </div>
            </div>
          </div>
        </div>

        {/* Launch actions */}
        <div className="lobby-launch-bar glass-panel">
          <div style={{ display: 'flex', gap: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Selected Game</span>
              <span className="font-display" style={{ fontWeight: 700, color: activeGame ? 'var(--neon-green)' : 'var(--text-muted)' }}>
                {activeGame === 'platformer' && 'Gem Hunters (Platformer)'}
                {activeGame === 'shooter' && 'Arena Survival (Top-Down)'}
                {activeGame === 'snake' && 'Cyber Slither (Snake Arena)'}
                {activeGame === 'chained' && 'Chained Together (Climbing Physics)'}
                {activeGame === 'farm' && 'Farm Together (Top-Down GBA)'}
                {activeGame === 'drawing' && 'Chaotic Drawing (Alternating Canvas)'}
                {!activeGame && 'No Game Selected'}
              </span>
            </div>


          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="copy-btn" onClick={disconnect} style={{ gap: '0.5rem' }}>
              <LogOut size={16} /> Disconnect
            </button>

            {isHost ? (
              <button 
                className="glow-btn-cyan font-display" 
                style={{ padding: '0.75rem 2rem', gap: '0.5rem', display: 'flex', alignItems: 'center' }}
                disabled={!activeGame}
                onClick={startGame}
              >
                <Play size={16} /> Launch Game
              </button>
            ) : (
              <div className="peer-badge text-yellow" style={{ borderColor: 'var(--neon-yellow)' }}>
                <Wifi size={14} className="status-dot connecting" />
                <span>Waiting for Host to Launch...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar Column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>

        {/* Chat Sidebar */}
        <div className="lobby-chat-panel glass-panel" style={{ height: '360px' }}>
          <div className="chat-header">
            <MessageSquare size={18} className="text-cyan" />
            <h3 className="chat-header-title">Lobby Chat</h3>
            <div className="peer-badge" style={{ marginLeft: 'auto', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
              {ping}ms
            </div>
          </div>

          <div className="chat-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-message ${msg.sender}`}>
                {msg.sender !== 'system' && (
                  <span className="msg-sender">{msg.senderName}</span>
                )}
                <div className="msg-bubble">{msg.text}</div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="chat-input-form">
            <input
              type="text"
              className="input-neon"
              placeholder="Type a message..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              style={{ padding: '0.6rem 0.8rem', fontSize: '0.9rem' }}
            />
            <button type="submit" className="copy-btn" style={{ padding: '0.6rem' }} disabled={!chatInput.trim()}>
              <ArrowRight size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
