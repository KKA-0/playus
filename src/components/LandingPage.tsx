import React, { useState, useEffect } from 'react';
import { 
  Gamepad2, Users, Cpu, ShieldCheck, Activity, 
  ArrowRight, Zap, RefreshCw, Music 
} from 'lucide-react';

interface LandingPageProps {
  onStartPlaying: (selectedGame?: 'platformer' | 'shooter' | 'snake' | 'chained' | 'music' | null) => void;
}

type SimulatorState = 'idle' | 'signaling' | 'handshake' | 'connected';

interface LogMessage {
  text: string;
  type: 'info' | 'highlight' | 'success';
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStartPlaying }) => {
  // WebRTC Simulator States
  const [simState, setSimState] = useState<SimulatorState>('idle');
  const [simLogs, setSimLogs] = useState<LogMessage[]>([
    { text: "System idle. Ready to test connection pathways.", type: "info" }
  ]);
  const [ping, setPing] = useState<number | null>(null);

  // Run the simulator sequence
  const startSimulator = () => {
    if (simState !== 'idle') return;

    setSimState('signaling');
    setPing(null);
    setSimLogs([
      { text: "⚡ Initializing WebRTC handshake...", type: "highlight" },
      { text: "ℹ️ Querying local ICE candidates & STUN servers...", type: "info" }
    ]);

    // Step 2: Contacting signaling server
    setTimeout(() => {
      setSimState('handshake');
      setSimLogs(prev => [
        ...prev,
        { text: "🌐 Signal server connected (ws://playus.signaling.io)", type: "info" },
        { text: "🔄 Exchanging SDP Offer / Answer with Player 2...", type: "highlight" }
      ]);
    }, 1800);

    // Step 3: P2P established
    setTimeout(() => {
      setSimState('connected');
      setPing(Math.floor(Math.random() * 12) + 12); // Mock low ping (12 - 24 ms)
      setSimLogs(prev => [
        ...prev,
        { text: "🔑 ICE Candidates gathered. NAT Traversal successful.", type: "info" },
        { text: "✔️ Direct P2P WebRTC SCTP DataChannel opened!", type: "success" },
        { text: "🎮 Input syncing engine started (60 FPS updates).", type: "success" }
      ]);
    }, 3600);
  };

  const resetSimulator = () => {
    setSimState('idle');
    setPing(null);
    setSimLogs([
      { text: "System reset. Ready to test connection pathways.", type: "info" }
    ]);
  };

  // Auto-pulse latency in connected mode
  useEffect(() => {
    if (simState !== 'connected') return;
    const interval = setInterval(() => {
      setPing(Math.floor(Math.random() * 8) + 14);
    }, 3000);
    return () => clearInterval(interval);
  }, [simState]);

  return (
    <div className="landing-container">
      {/* 1. Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-badge">
          <Zap size={14} className="text-cyan animate-pulse" />
          <span>Next-Gen Co-op P2P Gaming</span>
        </div>
        
        <h1 className="landing-hero-title">
          PLAY TOGETHER,<br />
          CONNECTED DIRECTLY.
        </h1>
        
        <p className="landing-hero-subtitle">
          Experience instant co-op gaming directly in your browser. Zero downloads, zero user accounts, and zero middleman servers. PlayUs creates a secure WebRTC peer-to-peer bridge to sync your inputs instantly.
        </p>
        
        <div className="landing-hero-ctas">
          <button 
            className="hero-btn hero-btn-primary" 
            onClick={() => onStartPlaying()}
          >
            Launch Arcade <ArrowRight size={18} />
          </button>
          
          <a href="#mission" className="hero-btn hero-btn-secondary">
            Our Mission
          </a>
        </div>
      </section>

      {/* 2. Interactive WebRTC Simulator Widget */}
      <section className="glass-panel webrtc-simulator">
        <div className="section-header">
          <span className="section-tag">Direct Link Visualizer</span>
          <h2 className="section-title">WebRTC Connection Engine</h2>
          <p className="section-subtitle">
            See how PlayUs bypasses servers to establish direct peer-to-peer connections.
          </p>
        </div>

        <div className="simulator-showcase">
          <div className={`simulator-network ${simState === 'connected' ? 'connected-p2p' : ''}`}>
            
            {/* Player 1 Node */}
            <div className={`simulator-node-wrapper ${simState !== 'idle' ? 'active' : ''}`} style={{ '--glow-color': 'var(--neon-cyan)' } as React.CSSProperties}>
              <div className="simulator-node-element">
                <Users size={32} />
              </div>
              <span className="simulator-node-label">Player 1 (Host)</span>
              <span className="simulator-node-ip">Client Node A</span>
            </div>

            {/* Signaling Server Node */}
            <div className={`simulator-node-wrapper ${(simState === 'signaling' || simState === 'handshake') ? 'active' : ''}`} style={{ '--glow-color': 'var(--neon-purple)' } as React.CSSProperties}>
              <div className="simulator-node-element">
                <Cpu size={30} />
              </div>
              <span className="simulator-node-label">STUN / Signaler</span>
              <span className="simulator-node-ip">Handshake Broker</span>
            </div>

            {/* Player 2 Node */}
            <div className={`simulator-node-wrapper ${(simState === 'handshake' || simState === 'connected') ? 'active' : ''}`} style={{ '--glow-color': 'var(--neon-magenta)' } as React.CSSProperties}>
              <div className="simulator-node-element">
                <Users size={32} />
              </div>
              <span className="simulator-node-label">Player 2 (Peer)</span>
              <span className="simulator-node-ip">Client Node B</span>
            </div>

            {/* Wires */}
            <div className="simulator-wires">
              {/* Wire Left to Center (Signaling) */}
              <div className="wire-line wire-left-to-center"></div>
              {/* Wire Right to Center (Signaling) */}
              <div className="wire-line wire-right-to-center"></div>
              {/* Direct P2P Wire */}
              <div className="wire-line wire-p2p"></div>
            </div>

            {/* Packet animations */}
            {simState === 'signaling' && (
              <div className="packet-pulse packet-to-signalling" style={{ '--packet-color': 'var(--neon-cyan)' } as React.CSSProperties}></div>
            )}
            {simState === 'handshake' && (
              <>
                <div className="packet-pulse packet-from-signalling" style={{ '--packet-color': 'var(--neon-purple)' } as React.CSSProperties}></div>
                <div className="packet-pulse packet-to-signalling" style={{ '--packet-color': 'var(--neon-magenta)', animationDelay: '0.6s' } as React.CSSProperties}></div>
              </>
            )}
            {simState === 'connected' && (
              <>
                <div className="packet-pulse packet-direct-p2p-p1" style={{ '--packet-color': 'var(--neon-green)', top: '12px' } as React.CSSProperties}></div>
                <div className="packet-pulse packet-direct-p2p-p2" style={{ '--packet-color': 'var(--neon-green)', top: '12px', animationDelay: '0.5s' } as React.CSSProperties}></div>
              </>
            )}

          </div>

          {/* Connection Logs console */}
          <div className="simulator-log-panel">
            {simLogs.map((log, index) => (
              <div key={index} className={`sim-log-line ${log.type}`}>
                {log.text}
              </div>
            ))}
          </div>
        </div>

        <div className="simulator-controls">
          {simState === 'idle' && (
            <button className="glow-btn-cyan font-display" onClick={startSimulator} style={{ padding: '0.8rem 2rem' }}>
              Simulate P2P Handshake
            </button>
          )}

          {simState !== 'idle' && (
            <button className="copy-btn" onClick={resetSimulator} style={{ padding: '0.8rem 2rem', gap: '0.5rem' }}>
              <RefreshCw size={14} className={simState !== 'connected' ? 'animate-spin' : ''} /> Reset Simulator
            </button>
          )}

          {ping !== null && (
            <div className="ping-display text-green">
              <Activity size={16} />
              <span>Direct Link Latency: {ping}ms</span>
            </div>
          )}
        </div>
      </section>

      {/* 3. Our Mission Section */}
      <section id="mission" className="landing-mission-section">
        <div className="section-header">
          <span className="section-tag">Decentralizing Social Play</span>
          <h2 className="section-title">Our Mission</h2>
          <p className="section-subtitle">
            Couch co-op is dead. Long live web co-op. We want to tear down the barriers of modern multiplayer.
          </p>
        </div>

        <div className="mission-grid">
          {/* Card 1 */}
          <div className="mission-card glass-panel cyan-accent">
            <div className="mission-icon">
              <Cpu size={28} />
            </div>
            <h3>P2P WebRTC Tech</h3>
            <p>
              By using WebRTC datachannels, we hook players up directly. Game updates travel via client-to-client UDP sockets, giving you the lowest latency possible without passing through an intermediate cloud server.
            </p>
          </div>

          {/* Card 2 */}
          <div className="mission-card glass-panel magenta-accent">
            <div className="mission-icon">
              <ShieldCheck size={28} />
            </div>
            <h3>No Accounts, No Barriers</h3>
            <p>
              We believe games should start in seconds. No login credentials, no email verification, no cookies, and no tracking. You spawn a room, text the code to your friend, and start playing immediately.
            </p>
          </div>

          {/* Card 3 */}
          <div className="mission-card glass-panel green-accent">
            <div className="mission-icon">
              <Activity size={28} />
            </div>
            <h3>True Cooperative Design</h3>
            <p>
              Every game in our arcade is built around shared challenges: pressure plates requiring coordination, shared health pools, physics-linked players, and synced entertainment hubs. PlayUs is co-op by default.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Games Showcase Section */}
      <section className="landing-games-section">
        <div className="section-header">
          <span className="section-tag">Interactive Catalog</span>
          <h2 className="section-title">Explore the Arcade</h2>
          <p className="section-subtitle">
            Choose a co-op game or synced media room to start playing. Click a card to auto-select and launch.
          </p>
        </div>

        <div className="games-grid games-grid-title">
          {/* Game 1: Gem Hunters */}
          <div className="game-option-card platformer" onClick={() => onStartPlaying('platformer')}>
            <div className="game-card-img">
              <Gamepad2 className="game-card-icon" />
            </div>
            <div className="game-card-content">
              <h3 className="game-card-title">Gem Hunters</h3>
              <p className="game-card-desc">Navigate pixel platforms, trigger switches, and hold gates open for each other to escape with the golden key.</p>
              <span className="game-card-players">Co-op Platformer</span>
            </div>
          </div>

          {/* Game 2: Arena Survival */}
          <div className="game-option-card shooter" onClick={() => onStartPlaying('shooter')}>
            <div className="game-card-img">
              <Gamepad2 className="game-card-icon" />
            </div>
            <div className="game-card-content">
              <h3 className="game-card-title">Arena Survival</h3>
              <p className="game-card-desc">Cover each other's blindspots and fight off infinite waves of alien threats. You share one health pool, so play carefully!</p>
              <span className="game-card-players">Top-Down Survival</span>
            </div>
          </div>

          {/* Game 3: Cyber Slither */}
          <div className="game-option-card snake" onClick={() => onStartPlaying('snake')}>
            <div className="game-card-img">
              <Gamepad2 className="game-card-icon" />
            </div>
            <div className="game-card-content">
              <h3 className="game-card-title">Cyber Slither</h3>
              <p className="game-card-desc">Slither through neon pellet fields, grow your snake, and work together to dominate computer bots without crashing.</p>
              <span className="game-card-players">Co-op Snake Arena</span>
            </div>
          </div>

          {/* Game 4: Chained Together */}
          <div className="game-option-card chained" onClick={() => onStartPlaying('chained')}>
            <div className="game-card-img">
              <Gamepad2 className="game-card-icon" />
            </div>
            <div className="game-card-content">
              <h3 className="game-card-title">Chained Together</h3>
              <p className="game-card-desc">Coordinate physics jumps and climbing maneuvers with your peer while tethered by a highly responsive physics spring chain.</p>
              <span className="game-card-players">Co-op physics climber</span>
            </div>
          </div>

          {/* Game 5: Co-op Music Sync */}
          <div className="game-option-card music" onClick={() => onStartPlaying('music')}>
            <div className="game-card-img" style={{ backgroundImage: 'linear-gradient(135deg, #1db954, #191414)' }}>
              <Music className="game-card-icon" style={{ opacity: 0.9 }} />
            </div>
            <div className="game-card-content">
              <h3 className="game-card-title">Co-op Music Sync</h3>
              <p className="game-card-desc">Sync and stream your favorite playlists together. Features synchronized playback triggers and real-time audio rooms.</p>
              <span className="game-card-players">Music Party Mode</span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. How It Works Section */}
      <section className="how-it-works-section">
        <div className="section-header">
          <span className="section-tag">Step-by-Step Guide</span>
          <h2 className="section-title">How It Works</h2>
          <p className="section-subtitle">
            Get your game running in four simple actions. No registration required.
          </p>
        </div>

        <div className="steps-container">
          <div className="step-card glass-panel">
            <div className="step-number">1</div>
            <h4 className="step-title">Launch Lobby</h4>
            <p className="step-desc">Click "Launch Arcade" and create a secure hosting room.</p>
          </div>

          <div className="step-card glass-panel">
            <div className="step-number">2</div>
            <h4 className="step-title">Copy Invite Code</h4>
            <p className="step-desc">Copy the generated WebRTC connection code to your clipboard.</p>
          </div>

          <div className="step-card glass-panel">
            <div className="step-number">3</div>
            <h4 className="step-title">Share Code</h4>
            <p className="step-desc">Send the code to your friend. They enter it on their browser to connect.</p>
          </div>

          <div className="step-card glass-panel">
            <div className="step-number">4</div>
            <h4 className="step-title">Pick & Play</h4>
            <p className="step-desc">Pick your co-op mode. Once direct P2P opens, play instantly!</p>
          </div>
        </div>
      </section>
    </div>
  );
};
