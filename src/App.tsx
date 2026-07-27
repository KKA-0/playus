import React, { useState, useEffect, useRef } from 'react';
import { PeerProvider, usePeer } from './context/PeerContext';
import { Lobby } from './components/Lobby';
import { LandingPage } from './components/LandingPage';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { PlatformerGame } from './components/games/PlatformerGame';
import { TopDownGame } from './components/games/TopDownGame';
import { ChainedGame } from './components/games/ChainedGame';
import { FarmGame } from './components/games/FarmGame';
import { 
  MessageSquare, ArrowRight, Gamepad, HelpCircle 
} from 'lucide-react';

const AppContent: React.FC = () => {
  const {
    isConnected,
    isGameStarted,
    activeGame,
    ping,
    peerId,
    targetId,
    messages,
    sendMessage,
    selectGame,
    level
  } = usePeer();

  const [chatInput, setChatInput] = useState<string>('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [userWantsLanding, setUserWantsLanding] = useState<boolean>(true);
  const [showPrivacy, setShowPrivacy] = useState<boolean>(false);

  // Computed state: Show landing if user wants it AND they are not actively hosting/connected AND not looking at privacy policy
  const activeLanding = userWantsLanding && !isConnected && !peerId && !showPrivacy;

  // Auto-scroll gameplay chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGameStarted]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendMessage(chatInput.trim());
    setChatInput('');
  };

  return (
    <>
      {/* Background Cyber Grid */}
      <div className="cyber-grid"></div>

      {/* Global Header */}
      <header className="header-container">
        <div 
          className="logo-section" 
          style={{ cursor: !isGameStarted ? 'pointer' : 'default' }}
          onClick={() => {
            if (!isGameStarted) {
              setUserWantsLanding(true);
              setShowPrivacy(false);
            }
          }}
        >
          <Gamepad size={28} className="text-cyan" />
          <span className="logo-text font-display">PlayUs</span>
        </div>

        {!isGameStarted && (
          <nav className="nav-links">
            <button 
              className={`nav-link ${activeLanding ? 'active' : ''}`}
              onClick={() => {
                setUserWantsLanding(true);
                setShowPrivacy(false);
              }}
            >
              Mission
            </button>
            <button 
              className={`nav-link ${!activeLanding && !showPrivacy ? 'active' : ''}`}
              onClick={() => {
                setUserWantsLanding(false);
                setShowPrivacy(false);
              }}
            >
              Arcade Lobby
            </button>
            <button 
              className={`nav-link ${showPrivacy ? 'active' : ''}`}
              onClick={() => {
                setShowPrivacy(true);
              }}
            >
              Privacy Policy
            </button>
          </nav>
        )}

        {isConnected && (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div className="peer-badge" style={{ borderColor: 'var(--neon-green)' }}>
              <span className="status-dot connected"></span>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                P2P Link: {targetId.substring(0, 6)}...
              </span>
            </div>
            <div className="peer-badge" style={{ borderColor: 'var(--neon-cyan)' }}>
              Latency: {ping}ms
            </div>
          </div>
        )}
      </header>

      {/* Main View Area */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!isGameStarted ? (
          showPrivacy ? (
            <PrivacyPolicy onClose={() => setShowPrivacy(false)} />
          ) : activeLanding ? (
            <LandingPage onStartPlaying={(selectedGame) => {
              if (selectedGame) {
                selectGame(selectedGame);
              }
              setUserWantsLanding(false);
            }} />
          ) : (
            <Lobby />
          )
        ) : (
          <div className="game-layout">
            {/* Game Canvas on left */}
            <div className="game-main-content">
              {activeGame === 'platformer' && <PlatformerGame />}
              {activeGame === 'shooter' && <TopDownGame />}
              {activeGame === 'chained' && <ChainedGame />}
              {activeGame === 'farm' && <FarmGame />}
            </div>

            {/* Sidebar Column on right */}
            <div className="game-side-column">

              {/* Controls guide */}
              <div className="controls-legend-panel glass-panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <HelpCircle size={16} className="text-cyan" />
                  <h4 className="legend-title">Controls Guide</h4>
                </div>
                
                {activeGame === 'platformer' ? (
                  <ul className="controls-list">
                    <li className="control-item">
                      <span className="control-label">Move Left</span>
                      <span className="control-key">A / ←</span>
                    </li>
                    <li className="control-item">
                      <span className="control-label">Move Right</span>
                      <span className="control-key">D / →</span>
                    </li>
                    <li className="control-item">
                      <span className="control-label">Jump</span>
                      <span className="control-key">W / Space</span>
                    </li>
                    <li className="control-item">
                      <span className="control-label">Exit Key</span>
                      <span className="text-yellow">🔑 Gold Key</span>
                    </li>
                  </ul>
                ) : activeGame === 'shooter' ? (
                  <ul className="controls-list">
                    <li className="control-item">
                      <span className="control-label">
                        {level === 2 ? 'Move Horizontally' : 'Move Around'}
                      </span>
                      <span className="control-key">
                        {level === 2 ? 'A, D / ←, →' : 'WASD / Arrows'}
                      </span>
                    </li>
                    <li className="control-item">
                      <span className="control-label">Aim Turret</span>
                      <span className="control-key">Mouse Move</span>
                    </li>
                    <li className="control-item">
                      <span className="control-label">Shoot Laser</span>
                      <span className="control-key">Left Click</span>
                    </li>
                    <li className="control-item">
                      <span className="control-label">Health Pool</span>
                      <span className="text-magenta">❤️ Shared</span>
                    </li>
                    {level === 2 && (
                      <li className="control-item">
                        <span className="control-label">Enemy Spawns</span>
                        <span className="text-yellow">⬆️ Top Only</span>
                      </li>
                    )}
                    {level === 3 && (
                      <>
                        <li className="control-item">
                          <span className="control-label">Map Size</span>
                          <span className="text-cyan">🌐 3x Expanded</span>
                        </li>
                        <li className="control-item">
                          <span className="control-label">Safe Zone</span>
                          <span className="text-green">⭕ Get Inside!</span>
                        </li>
                      </>
                    )}
                  </ul>
                ) : activeGame === 'chained' ? (
                  <ul className="controls-list">
                    <li className="control-item">
                      <span className="control-label">Walk Left/Right</span>
                      <span className="control-key">A, D / ←, →</span>
                    </li>
                    <li className="control-item">
                      <span className="control-label">Jump Up</span>
                      <span className="control-key">W, Space / ↑</span>
                    </li>
                    <li className="control-item">
                      <span className="control-label">Tension pull</span>
                      <span className="text-purple">⛓️ Chained</span>
                    </li>
                    <li className="control-item">
                      <span className="control-label">Goal</span>
                      <span className="text-green">🏁 Exit Portal</span>
                    </li>
                  </ul>
                ) : (
                  <ul className="controls-list">
                    <li className="control-item">
                      <span className="control-label">Walk Around</span>
                      <span className="control-key">WASD / Arrows</span>
                    </li>
                    <li className="control-item">
                      <span className="control-label">Farm Plot</span>
                      <span className="text-yellow">🌱 Spawn center</span>
                    </li>
                    <li className="control-item">
                      <span className="control-label">Gender Select</span>
                      <span className="text-green">Male / Female</span>
                    </li>
                  </ul>
                )}
              </div>

              {/* In-game Mini Chat */}
              <div className="game-chat-panel glass-panel">
                <div className="chat-header">
                  <MessageSquare size={16} className="text-cyan" />
                  <h4 className="chat-header-title">Live Chat</h4>
                </div>

                <div className="chat-messages" style={{ maxHeight: '260px' }}>
                  {messages.map((msg) => (
                    <div key={msg.id} className={`chat-message ${msg.sender}`}>
                      {msg.sender !== 'system' && (
                        <span className="msg-sender" style={{ fontSize: '0.7rem' }}>
                          {msg.senderName}
                        </span>
                      )}
                      <div className="msg-bubble" style={{ padding: '0.5rem 0.7rem', fontSize: '0.85rem' }}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                <form onSubmit={handleSendMessage} className="chat-input-form">
                  <input
                    type="text"
                    className="input-neon"
                    placeholder="Chat..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    style={{ padding: '0.5rem 0.7rem', fontSize: '0.85rem' }}
                  />
                  <button type="submit" className="copy-btn" style={{ padding: '0.5rem' }} disabled={!chatInput.trim()}>
                    <ArrowRight size={14} />
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Global Footer Status Bar */}
      <footer className="connection-footer-bar">
        <div>
          <span>Engine Status: </span>
          <span className="text-cyan" style={{ fontWeight: 600 }}>WebRTC Active</span>
        </div>
        <div>
          {isConnected ? (
            <span>
              Connected to lobby peer <span className="text-green">{targetId.substring(0, 12)}...</span>
            </span>
          ) : (
            <span>
              {peerId ? `Lobby Ready. Code: ${peerId}` : 'Not connected to a lobby'}
            </span>
          )}
        </div>
      </footer>
    </>
  );
};

export const App: React.FC = () => {
  return (
    <PeerProvider>
      <AppContent />
    </PeerProvider>
  );
};

export default App;
