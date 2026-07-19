export type NetworkStatusType = 'checking' | 'hostable' | 'blocked' | 'unknown';

export interface HostabilityResult {
  status: NetworkStatusType;
  details: string;
}

/**
 * Checks if the player's network configuration allows P2P hosting.
 * It gathers ICE candidates using public STUN servers and checks if a server-reflexive (srflx)
 * candidate is gathered, indicating UDP ports are open and STUN resolution is successful.
 */
export const checkNetworkHostability = (): Promise<HostabilityResult> => {
  return new Promise((resolve) => {
    // Setup RTCPeerConnection with Google's public STUN servers
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    };

    let pc: RTCPeerConnection | null = null;
    try {
      pc = new RTCPeerConnection(config);
    } catch (e) {
      resolve({
        status: 'unknown',
        details: 'WebRTC is not supported or is blocked in this browser.',
      });
      return;
    }

    let hasSrflx = false;
    let hasHost = false;
    let isResolved = false;

    const cleanup = () => {
      if (pc) {
        pc.onicecandidate = null;
        pc.onicegatheringstatechange = null;
        pc.close();
        pc = null;
      }
    };

    const finish = () => {
      if (isResolved) return;
      isResolved = true;
      cleanup();

      if (hasSrflx) {
        resolve({
          status: 'hostable',
          details: 'P2P Hostable: Outbound UDP and STUN connection succeeded. Direct lobby connection should work!',
        });
      } else if (hasHost) {
        resolve({
          status: 'blocked',
          details: 'Strict Firewall: Only local IP candidates found. Outbound UDP/STUN traffic appears to be blocked. Other players will likely fail to join your lobby.',
        });
      } else {
        resolve({
          status: 'unknown',
          details: 'No connection candidates could be gathered. Network could be offline or WebRTC block is active.',
        });
      }
    };

    // We must create a data channel to force ICE candidate gathering to begin
    try {
      pc.createDataChannel('hostability-test');
    } catch (e) {
      // Ignore data channel creation error and try anyway
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const cand = event.candidate.candidate;
        if (cand.includes('srflx')) {
          hasSrflx = true;
          // As soon as we see a srflx candidate, we know STUN is working, so we can finish early
          finish();
        } else if (cand.includes('host')) {
          hasHost = true;
        }
      } else {
        // Gathering is completely finished
        finish();
      }
    };

    pc.onicegatheringstatechange = () => {
      if (pc && pc.iceGatheringState === 'complete') {
        finish();
      }
    };

    pc.createOffer()
      .then((offer) => {
        if (pc) {
          return pc.setLocalDescription(offer);
        }
      })
      .catch((err) => {
        console.error('Error creating offer for network test:', err);
        finish();
      });

    // Enforce a hard timeout of 3.5 seconds to avoid hanging indefinitely if NAT is slow
    setTimeout(finish, 3500);
  });
};
