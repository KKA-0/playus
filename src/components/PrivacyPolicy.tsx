import React from 'react';
import { ShieldCheck, Cpu, Server, WifiOff, Database, Lock, ArrowLeft } from 'lucide-react';

interface PrivacyPolicyProps {
  onClose: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onClose }) => {
  return (
    <div className="setup-container glass-panel" style={{ maxWidth: '800px', margin: '2rem auto', textAlign: 'left', padding: '2.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <ShieldCheck size={36} className="text-cyan" />
        <h1 className="logo-text font-display" style={{ margin: 0, fontSize: '2.5rem' }}>PRIVACY POLICY</h1>
      </div>
      
      <p className="setup-subtitle" style={{ textAlign: 'left', margin: '1rem 0 2rem 0' }}>
        PlayUs is built from the ground up to respect your digital privacy. Because our games are powered by peer-to-peer (P2P) technology, your data stays in your control.
      </p>

      <hr style={{ borderColor: 'var(--glass-border)', margin: '2rem 0' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <section style={{ display: 'flex', gap: '1rem' }}>
          <div className="text-cyan" style={{ display: 'flex', alignItems: 'flex-start', paddingTop: '0.2rem' }}>
            <WifiOff size={24} />
          </div>
          <div>
            <h3 className="font-display text-cyan" style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>1. Peer-to-Peer Data (Zero Server Storage)</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
              All gameplay, controller actions, lobby messages, and drawings are transmitted directly between players' devices. We do not operate a centralized game server that inspects, records, or stores your gameplay activity.
            </p>
          </div>
        </section>

        <section style={{ display: 'flex', gap: '1rem' }}>
          <div className="text-magenta" style={{ display: 'flex', alignItems: 'flex-start', paddingTop: '0.2rem' }}>
            <Server size={24} />
          </div>
          <div>
            <h3 className="font-display text-magenta" style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>2. Signaling & Handshake</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
              To connect two players directly, we utilize the public PeerJS signaling cloud. The signaling server is only used to exchange metadata (SDP offers/answers and candidate ICE paths) to orchestrate the handshake. Once the connection is established, all communication transitions to a direct UDP socket.
            </p>
          </div>
        </section>

        <section style={{ display: 'flex', gap: '1rem' }}>
          <div className="text-green" style={{ display: 'flex', alignItems: 'flex-start', paddingTop: '0.2rem' }}>
            <Cpu size={24} />
          </div>
          <div>
            <h3 className="font-display text-green" style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>3. STUN Servers & IP Addresses</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
              Connecting peers behind firewalls requires Network Address Translation (NAT) traversal. We use public STUN servers (provided by Google) to determine your public-facing IP address. STUN servers only handle automated routing discovery and do not log or track your identity.
            </p>
          </div>
        </section>

        <section style={{ display: 'flex', gap: '1rem' }}>
          <div className="text-yellow" style={{ display: 'flex', alignItems: 'flex-start', paddingTop: '0.2rem' }}>
            <Database size={24} />
          </div>
          <div>
            <h3 className="font-display text-yellow" style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>4. Local Device Storage</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
              Any local configuration options, nickname settings, or local highest scores are stored exclusively on your device using standard HTML5 LocalStorage. None of this data is sent to external parties.
            </p>
          </div>
        </section>

        <section style={{ display: 'flex', gap: '1rem' }}>
          <div className="text-purple" style={{ display: 'flex', alignItems: 'flex-start', paddingTop: '0.2rem' }}>
            <Lock size={24} />
          </div>
          <div>
            <h3 className="font-display text-purple" style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>5. Encryption & Security</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
              WebRTC (Web Real-Time Communication) enforces mandatory end-to-end encryption (DTLS and SRTP) for all connection channels. Even if third-party signaling packets were intercepted, your direct peer-to-peer data remains encrypted and unreadable.
            </p>
          </div>
        </section>
      </div>

      <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-start' }}>
        <button 
          className="glow-btn-cyan font-display" 
          onClick={onClose}
          style={{ padding: '0.75rem 1.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}
        >
          <ArrowLeft size={16} /> Back to Arcade
        </button>
      </div>
    </div>
  );
};
