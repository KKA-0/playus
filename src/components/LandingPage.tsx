import React from 'react';
import { 
  Gamepad2, Cpu, ShieldCheck, Activity, 
  ArrowRight, Zap, Music 
} from 'lucide-react';

interface LandingPageProps {
  onStartPlaying: (selectedGame?: 'platformer' | 'shooter' | 'snake' | 'chained' | 'music' | 'farm' | null) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStartPlaying }) => {
  return (
    <div className="landing-container">
      {/* 1. Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-badge">
          <Zap size={14} className="text-cyan animate-pulse" />
          <span>Instant Co-op Arcade</span>
        </div>
        
        <h1 className="landing-hero-title">
          PLAY TOGETHER,<br />
          INSTANTLY.
        </h1>
        
        <p className="landing-hero-subtitle">
          Experience instant co-op gaming directly in your browser. Zero downloads, zero user accounts, and no hassle. Just select a game, share a code with your friend, and start playing!
        </p>

        <div className="hero-characters-ref">
          <img src="/male.png" alt="Player 1" className="hero-char-img" />
          <img src="/female.png" alt="Player 2" className="hero-char-img" />
          <span className="hero-char-tag text-cyan">Ready Player 1 & 2</span>
        </div>
        
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

      {/* 2. Our Mission Section */}
      <section id="mission" className="landing-mission-section">
        <div className="section-header">
          <span className="section-tag">Decentralizing Social Play</span>
          <h2 className="section-title">Our Mission</h2>
          <p className="section-subtitle">
            Couch co-op is dead. Long live web co-op. We want to tear down the barriers of modern multiplayer.
          </p>
        </div>

        <div className="mission-grid">
          <div className="mission-card glass-panel cyan-accent">
            <div className="mission-icon">
              <Cpu size={28} />
            </div>
            <h3>Instant Web Play</h3>
            <p>
              We use modern browser networking to connect you and your friend instantly. Game updates sync in real-time, giving you ultra-low latency play without any lags.
            </p>
          </div>

          <div className="mission-card glass-panel magenta-accent">
            <div className="mission-icon">
              <ShieldCheck size={28} />
            </div>
            <h3>No Accounts, No Barriers</h3>
            <p>
              We believe games should start in seconds. No login credentials, no email verification, no cookies, and no tracking. You spawn a room, text the code to your friend, and start playing immediately.
            </p>
          </div>

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

      {/* 3. Games Showcase Section */}
      <section className="landing-games-section">
        <div className="section-header">
          <span className="section-tag">Interactive Catalog</span>
          <h2 className="section-title">Explore the Arcade</h2>
          <p className="section-subtitle">
            Choose a co-op game or synced media room to start playing. Click a card to auto-select and launch.
          </p>
        </div>

        <div className="games-grid games-grid-title">
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

          <div className="game-option-card farm" onClick={() => onStartPlaying('farm')}>
            <div className="game-card-img">
              <Gamepad2 className="game-card-icon" />
            </div>
            <div className="game-card-content">
              <h3 className="game-card-title">Farm Together</h3>
              <p className="game-card-desc">Choose a character and explore a cozy 2D farm together in a classic GBA-style top-down layout.</p>
              <span className="game-card-players">Co-op Farm Exploration</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. How It Works Section */}
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
            <p className="step-desc">Copy the generated lobby room code to your clipboard.</p>
          </div>

          <div className="step-card glass-panel">
            <div className="step-number">3</div>
            <h4 className="step-title">Share Code</h4>
            <p className="step-desc">Send the code to your friend. They enter it on their browser to connect.</p>
          </div>

          <div className="step-card glass-panel">
            <div className="step-number">4</div>
            <h4 className="step-title">Pick & Play</h4>
            <p className="step-desc">Pick your co-op mode and start playing instantly!</p>
          </div>
        </div>
      </section>
    </div>
  );
};
