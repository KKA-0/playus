import React, { useEffect, useRef, useState } from 'react';
import { usePeer } from '../../context/PeerContext';
import { Music, Link2, RefreshCw, Disc, Info } from 'lucide-react';

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (IFrameAPI: any) => void;
    SpotifyIframeApi?: any;
    onYouTubeIframeAPIReady?: () => void;
    YT?: any;
  }
}

// Custom inline SVG components for logos to avoid external icon constraints
const YoutubeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="currentColor" />
  </svg>
);

const SpotifyIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M8 11.5c2.5-1.5 5.5-1.5 8 0" />
    <path d="M7 14c3-2 7-2 10 0" />
    <path d="M9 9c2-1 4-1 6 0" />
  </svg>
);

// Curated Soundtrack mappings between Spotify and YouTube
const CURATED_SOUNDTRACKS: Record<string, { spotify: string; youtube: string; title: string; desc: string }> = {
  lofi: {
    spotify: 'spotify:playlist:37i9dQZF1DXdLTE7aGDX1r',
    youtube: 'jfKfPfyJRdk', // Lofi Girl Gaming Beats
    title: 'Gaming Lo-Fi',
    desc: 'Relaxing chill study beats to keep you focused.'
  },
  synthwave: {
    spotify: 'spotify:playlist:37i9dQZF1DX8g96SyvUu4V',
    youtube: '4xDzrJKXOOY', // Synthwave compilation
    title: 'Synthwave/Retro',
    desc: 'Arcade outrun, synth gems, and retrowave speed tracks.'
  },
  electro: {
    spotify: 'spotify:playlist:37i9dQZF1DXdgn7Jy10O6t',
    youtube: '1F_47c6S5_0', // EDM compilation
    title: 'Arena Electro',
    desc: 'High energy electronic beats for maximum focus.'
  },
  chiptune: {
    spotify: 'spotify:playlist:37i9dQZF1DX0tZ6OIB9JjV',
    youtube: 'TpH60k1H-H0', // Chiptune compilation
    title: '8-Bit Chiptunes',
    desc: 'Vintage retro square waves and keygen nostalgia.'
  }
};

const DEFAULT_SPOTIFY_PLAYLIST = CURATED_SOUNDTRACKS.lofi.spotify;
const DEFAULT_YOUTUBE_VIDEO = CURATED_SOUNDTRACKS.lofi.youtube;

export const MusicPlayerRoom: React.FC = () => {
  const { 
    spotifySyncData, 
    sendSpotifySync, 
    isConnected, 
    activeMusicUri, 
    setActiveMusicUri,
    soundtrackGenre,
    setSoundtrackGenre
  } = usePeer();

  // Active music service toggle: 'spotify' | 'youtube'
  const [activeService, setActiveService] = useState<'spotify' | 'youtube'>('spotify');
  
  const [inputUrl, setInputUrl] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('Initializing widgets...');
  
  // Track state targets
  const [spotifyUri, setSpotifyUri] = useState(DEFAULT_SPOTIFY_PLAYLIST);
  const [youtubeVideoId, setYoutubeVideoId] = useState(DEFAULT_YOUTUBE_VIDEO);
  
  // Player instances refs
  const spotifyContainerRef = useRef<HTMLDivElement | null>(null);
  const spotifyControllerRef = useRef<any>(null);
  
  const ytPlayerRef = useRef<any>(null);
  const isYtApiLoaded = useRef(false);

  // Sync state helpers
  const ignoreNextPlaybackUpdate = useRef(false);
  const prevIsPaused = useRef(true);
  const prevPosition = useRef(0);
  const lastUpdateTimestamp = useRef(Date.now());

  // Past tracks history
  const [history, setHistory] = useState<Array<{ id: string; service: string; uri: string; label: string }>>([
    { id: '1', service: 'spotify', uri: CURATED_SOUNDTRACKS.lofi.spotify, label: 'Gaming Lo-Fi Playlist' },
    { id: '2', service: 'youtube', uri: `youtube:${CURATED_SOUNDTRACKS.synthwave.youtube}`, label: 'Synthwave/Retro Compilation' }
  ]);

  // Convert URLs to parsed identifiers
  const parseSpotifyUri = (urlStr: string): string | null => {
    const clean = urlStr.trim();
    if (clean.startsWith('spotify:')) return clean;

    const match = clean.match(/open\.spotify\.com\/(track|playlist|album|artist)\/([a-zA-Z0-9]+)/);
    if (match) return `spotify:${match[1]}:${match[2]}`;
    return null;
  };

  const parseYoutubeVideoId = (urlStr: string): string | null => {
    const clean = urlStr.trim();
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = clean.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // --- RESOLVER METADATA SCRAPERS ---
  
  // Resolve Spotify Track details using free public oembed API
  const fetchSpotifyTrackDetails = async (uri: string): Promise<{ title: string; artist: string } | null> => {
    try {
      const webUrl = `https://open.spotify.com/${uri.replace('spotify:', '').replace(/:/g, '/')}`;
      const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(webUrl)}`);
      if (!response.ok) return null;
      const data = await response.json();
      return {
        title: data.title || '',
        artist: data.author_name || ''
      };
    } catch {
      return null;
    }
  };

  // Resolve YouTube video title using oembed via AllOrigins CORS proxy
  const fetchYoutubeVideoTitle = async (videoId: string): Promise<string> => {
    try {
      const target = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
      const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(target)}`);
      if (!response.ok) return 'YouTube Track';
      const data = await response.json();
      const metadata = JSON.parse(data.contents);
      return metadata.title || 'YouTube Track';
    } catch {
      return 'YouTube Track';
    }
  };

  // Search YouTube dynamically using AllOrigins html proxy & regex parsing
  const searchYoutubeTrack = async (query: string): Promise<string | null> => {
    try {
      setConnectionStatus('Searching track on YouTube...');
      const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
      )}`);
      if (!response.ok) return null;
      const data = await response.json();
      const html = data.contents;
      const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  };

  // Load YouTube Player script dynamically
  const initYoutubePlayer = (): Promise<void> => {
    return new Promise((resolve) => {
      if (window.YT && window.YT.Player) {
        resolve();
        return;
      }

      if (!isYtApiLoaded.current) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
        isYtApiLoaded.current = true;
      }

      const previousCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (previousCallback) previousCallback();
        resolve();
      };
    });
  };

  // Initialize Spotify Embed script
  useEffect(() => {
    if (window.SpotifyIframeApi) return;

    const script = document.createElement('script');
    script.src = 'https://open.spotify.com/embed/iframe-api/v1';
    script.async = true;
    document.body.appendChild(script);

    window.onSpotifyIframeApiReady = (IFrameAPI: any) => {
      window.SpotifyIframeApi = IFrameAPI;
    };
  }, []);

  // Synchronize Curated Genre soundtrack cards automatically on change
  useEffect(() => {
    if (!soundtrackGenre || !CURATED_SOUNDTRACKS[soundtrackGenre]) return;
    
    const mapped = CURATED_SOUNDTRACKS[soundtrackGenre];
    setSpotifyUri(mapped.spotify);
    setYoutubeVideoId(mapped.youtube);
    setActiveMusicUri(mapped.spotify);
  }, [soundtrackGenre]);

  // Synchronize on activeMusicUri changes (e.g. from WebRTC or card selections)
  useEffect(() => {
    if (!activeMusicUri) return;
    if (activeMusicUri.startsWith('spotify:')) {
      setSpotifyUri(activeMusicUri);
      if (soundtrackGenre && CURATED_SOUNDTRACKS[soundtrackGenre]) {
        setYoutubeVideoId(CURATED_SOUNDTRACKS[soundtrackGenre].youtube);
      }
    } else if (activeMusicUri.startsWith('youtube:')) {
      setYoutubeVideoId(activeMusicUri.replace('youtube:', ''));
    }
  }, [activeMusicUri, soundtrackGenre]);

  // Render Spotify Embed Player if selected
  useEffect(() => {
    if (activeService !== 'spotify' || !spotifyContainerRef.current) return;

    const renderSpotify = () => {
      if (!window.SpotifyIframeApi) {
        setTimeout(renderSpotify, 100);
        return;
      }

      const IFrameAPI = window.SpotifyIframeApi;
      const options = {
        uri: spotifyUri,
        width: '100%',
        height: '350', // Full height widget for dedicated room
        theme: 'dark'
      };

      spotifyContainerRef.current!.innerHTML = '';
      const placeholder = document.createElement('div');
      spotifyContainerRef.current!.appendChild(placeholder);

      IFrameAPI.createController(placeholder, options, (controller: any) => {
        spotifyControllerRef.current = controller;
        setConnectionStatus('Spotify Widget Ready');

        controller.addListener('playback_update', (e: any) => {
          if (!e || !e.data) return;
          const { position, isPaused } = e.data;
          const now = Date.now();
          const elapsed = now - lastUpdateTimestamp.current;

          const expected = prevPosition.current + (prevIsPaused.current ? 0 : elapsed);
          const isManualSeek = Math.abs(position - expected) > 3000;
          const isPauseToggled = isPaused !== prevIsPaused.current;

          if (isPauseToggled || isManualSeek) {
            if (ignoreNextPlaybackUpdate.current) {
              ignoreNextPlaybackUpdate.current = false;
            } else if (isConnected) {
              sendSpotifySync({
                uri: spotifyUri,
                position,
                isPaused,
                genre: soundtrackGenre
              });
              setConnectionStatus('Synced with partner');
            }
          }

          prevIsPaused.current = isPaused;
          prevPosition.current = position;
          lastUpdateTimestamp.current = now;
        });
      });
    };

    renderSpotify();

    return () => {
      spotifyControllerRef.current = null;
    };
  }, [activeService, spotifyUri, isConnected]);

  // Render YouTube Iframe Player if selected
  useEffect(() => {
    if (activeService !== 'youtube') return;

    let checkInterval: any;

    const renderYoutube = async () => {
      await initYoutubePlayer();

      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch { /* old player already destroyed */ }
      }

      setConnectionStatus('Loading YouTube Player...');

      ytPlayerRef.current = new window.YT.Player('youtube-iframe-target', {
        height: '350',
        width: '100%',
        videoId: youtubeVideoId,
        playerVars: {
          autoplay: 1,
          controls: 1,
          disablekb: 1,
          modestbranding: 1,
          rel: 0
        },
        events: {
          onReady: () => {
            setConnectionStatus('YouTube Player Ready');
            
            // Periodically check for manual timeline scrub seeks
            checkInterval = setInterval(() => {
              if (!ytPlayerRef.current || typeof ytPlayerRef.current.getCurrentTime !== 'function') return;
              
              const pos = Math.round(ytPlayerRef.current.getCurrentTime() * 1000);
              const now = Date.now();
              const elapsed = now - lastUpdateTimestamp.current;
              
              const expected = prevPosition.current + (prevIsPaused.current ? 0 : elapsed);
              const isManualSeek = Math.abs(pos - expected) > 3000;

              if (isManualSeek && !ignoreNextPlaybackUpdate.current) {
                const isPaused = ytPlayerRef.current.getPlayerState() === 2; // YT.PlayerState.PAUSED
                sendSpotifySync({
                  uri: `youtube:${youtubeVideoId}`,
                  position: pos,
                  isPaused,
                  genre: soundtrackGenre
                });
                setConnectionStatus('Synced seek head');
              }
              
              prevPosition.current = pos;
              lastUpdateTimestamp.current = now;
            }, 1000);
          },
          onStateChange: (event: any) => {
            const state = event.data;
            const isPaused = state === 2;
            const isPlaying = state === 1;

            if (isPlaying || isPaused) {
              const pos = Math.round(ytPlayerRef.current.getCurrentTime() * 1000);
              const isPauseToggled = isPaused !== prevIsPaused.current;

              if (isPauseToggled) {
                if (ignoreNextPlaybackUpdate.current) {
                  ignoreNextPlaybackUpdate.current = false;
                } else if (isConnected) {
                  sendSpotifySync({
                    uri: `youtube:${youtubeVideoId}`,
                    position: pos,
                    isPaused,
                    genre: soundtrackGenre
                  });
                  setConnectionStatus(isPaused ? 'Paused playback' : 'Resumed playback');
                }
                prevIsPaused.current = isPaused;
              }
            }
          }
        }
      });
    };

    renderYoutube();

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [activeService, youtubeVideoId, isConnected]);

  // Incoming WebRTC Sync Packets Handler (Translates between services)
  useEffect(() => {
    if (!spotifySyncData) return;

    const { uri, position, isPaused, timestamp, genre } = spotifySyncData;

    if (genre !== undefined) {
      setSoundtrackGenre(genre);
    }

    const syncPlayback = async () => {
      ignoreNextPlaybackUpdate.current = true;
      const latency = Math.max(0, Date.now() - timestamp);
      const targetSec = (position + latency) / 1000;

      // TARGET ACTIVE SERVICE IS SPOTIFY
      if (activeService === 'spotify' && spotifyControllerRef.current) {
        const controller = spotifyControllerRef.current;

        if (uri.startsWith('spotify:')) {
          if (uri !== spotifyUri) {
            setSpotifyUri(uri);
            controller.loadUri(uri);
            setTimeout(() => {
              if (isPaused) controller.pause();
              else {
                controller.play();
                controller.seek(targetSec);
              }
            }, 800);
          } else {
            if (isPaused && !prevIsPaused.current) controller.pause();
            else if (!isPaused && prevIsPaused.current) {
              controller.play();
              controller.seek(targetSec);
            } else if (!isPaused && Math.abs(prevPosition.current - position) > 4000) {
              controller.seek(targetSec);
            }
          }
        } 
        else if (uri.startsWith('youtube:')) {
          const ytId = uri.replace('youtube:', '');
          const title = await fetchYoutubeVideoTitle(ytId);
          setConnectionStatus(`Sync YouTube: ${title}`);
          console.warn('Custom YouTube-to-Spotify resolving requires developer OAuth scopes.');
        }
      }

      // TARGET ACTIVE SERVICE IS YOUTUBE
      if (activeService === 'youtube' && ytPlayerRef.current) {
        const player = ytPlayerRef.current;

        if (uri.startsWith('youtube:')) {
          const targetYtId = uri.replace('youtube:', '');
          if (targetYtId !== youtubeVideoId) {
            setYoutubeVideoId(targetYtId);
            player.cueVideoById(targetYtId);
            setTimeout(() => {
              if (isPaused) player.pauseVideo();
              else {
                player.playVideo();
                player.seekTo(targetSec, true);
              }
            }, 500);
          } else {
            if (isPaused) player.pauseVideo();
            else {
              player.playVideo();
              player.seekTo(targetSec, true);
            }
          }
        } 
        else if (uri.startsWith('spotify:')) {
          if (uri !== spotifyUri) {
            setSpotifyUri(uri);
            setConnectionStatus('Resolving Spotify details...');
            
            const details = await fetchSpotifyTrackDetails(uri);
            if (details) {
              const query = `${details.artist} ${details.title}`;
              const matchYtId = await searchYoutubeTrack(query);
              if (matchYtId) {
                setYoutubeVideoId(matchYtId);
                player.cueVideoById(matchYtId);
                setTimeout(() => {
                  if (isPaused) player.pauseVideo();
                  else {
                    player.playVideo();
                    player.seekTo(targetSec, true);
                  }
                }, 600);
              }
            } else {
              setConnectionStatus('Failed to resolve Spotify track');
            }
          } else {
            if (isPaused) player.pauseVideo();
            else {
              player.playVideo();
              player.seekTo(targetSec, true);
            }
          }
        }
      }

      setConnectionStatus('Synced with partner');
    };

    syncPlayback();
  }, [spotifySyncData, activeService]);

  // Load user pasted URL (handles both Spotify and YouTube inputs)
  const handleLoadUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    setConnectionStatus('Loading URL...');
    const parsedSpotify = parseSpotifyUri(inputUrl);
    const parsedYoutube = parseYoutubeVideoId(inputUrl);

    if (parsedSpotify) {
      setSpotifyUri(parsedSpotify);
      setSoundtrackGenre('custom');
      setActiveMusicUri(parsedSpotify);

      const details = await fetchSpotifyTrackDetails(parsedSpotify);
      const label = details ? `${details.title} - ${details.artist}` : 'Custom Spotify Track';
      setHistory(prev => [{ id: Date.now().toString(), service: 'spotify', uri: parsedSpotify, label }, ...prev.slice(0, 4)]);

      if (isConnected) {
        sendSpotifySync({
          uri: parsedSpotify,
          position: 0,
          isPaused: false,
          genre: 'custom'
        });
      }

      if (activeService === 'youtube') {
        if (details) {
          const matchYtId = await searchYoutubeTrack(`${details.artist} ${details.title}`);
          if (matchYtId) {
            setYoutubeVideoId(matchYtId);
          }
        }
      }
      setInputUrl('');
    } 
    
    else if (parsedYoutube) {
      setYoutubeVideoId(parsedYoutube);
      setSoundtrackGenre('custom');
      setInputUrl('');

      const title = await fetchYoutubeVideoTitle(parsedYoutube);
      setHistory(prev => [{ id: Date.now().toString(), service: 'youtube', uri: `youtube:${parsedYoutube}`, label: title }, ...prev.slice(0, 4)]);

      if (isConnected) {
        sendSpotifySync({
          uri: `youtube:${parsedYoutube}`,
          position: 0,
          isPaused: false,
          genre: 'custom'
        });
      }
    } else {
      setConnectionStatus('Invalid Spotify/YouTube link');
    }
  };

  // Broadcast manual sync request to peer
  const handleForceSync = () => {
    if (!isConnected) return;
    
    const uri = activeService === 'spotify' ? spotifyUri : `youtube:${youtubeVideoId}`;
    const pos = activeService === 'spotify' 
      ? prevPosition.current 
      : (ytPlayerRef.current ? Math.round(ytPlayerRef.current.getCurrentTime() * 1000) : 0);
    const isPaused = activeService === 'spotify'
      ? prevIsPaused.current
      : (ytPlayerRef.current ? ytPlayerRef.current.getPlayerState() === 2 : true);

    sendSpotifySync({
      uri,
      position: pos,
      isPaused,
      genre: soundtrackGenre
    });
    setConnectionStatus('Force sync frame broadcasted');
  };

  // Quick Select playlist
  const selectCuratedPlaylist = (key: string) => {
    setSoundtrackGenre(key);
    const selected = CURATED_SOUNDTRACKS[key];
    const targetUri = activeService === 'spotify' ? selected.spotify : `youtube:${selected.youtube}`;
    
    setActiveMusicUri(selected.spotify);

    if (isConnected) {
      sendSpotifySync({
        uri: targetUri,
        position: 0,
        isPaused: false,
        genre: key
      });
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', width: '100%', minHeight: '620px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', border: '1px solid rgba(0, 240, 255, 0.2)' }}>
      
      {/* LEFT COLUMN: Player display, service toggles, URL paste */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Disc size={28} className="text-cyan animate-spin" style={{ animationDuration: '4s' }} />
          <div style={{ textAlign: 'left' }}>
            <h2 className="font-display text-cyan" style={{ margin: 0, fontSize: '1.5rem', letterSpacing: '1px' }}>CO-OP MUSIC ROOM</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Status: {connectionStatus}</span>
          </div>
        </div>

        {/* Big Service Selector Toggles */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => setActiveService('spotify')}
            className={`glow-btn-cyan font-display`}
            style={{ 
              flex: 1, 
              padding: '0.75rem', 
              fontSize: '0.9rem', 
              borderRadius: '8px',
              border: '1px solid var(--neon-cyan)',
              background: activeService === 'spotify' ? 'var(--neon-cyan)' : 'transparent',
              color: activeService === 'spotify' ? '#000' : 'var(--neon-cyan)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              cursor: 'pointer'
            }}
          >
            <SpotifyIcon style={{ width: '18px', height: '18px' }} />
            Spotify
          </button>
          <button
            onClick={() => setActiveService('youtube')}
            className={`glow-btn-magenta font-display`}
            style={{ 
              flex: 1, 
              padding: '0.75rem', 
              fontSize: '0.9rem', 
              borderRadius: '8px',
              border: '1px solid var(--neon-magenta)',
              background: activeService === 'youtube' ? 'var(--neon-magenta)' : 'transparent',
              color: activeService === 'youtube' ? '#fff' : 'var(--neon-magenta)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              cursor: 'pointer'
            }}
          >
            <YoutubeIcon style={{ width: '18px', height: '18px' }} />
            YouTube
          </button>
        </div>

        {/* Embedded Player frame mount */}
        <div style={{ height: '350px', borderRadius: '12px', overflow: 'hidden', background: '#0a0a10', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
          {activeService === 'spotify' ? (
            <div ref={spotifyContainerRef} style={{ height: '350px' }} />
          ) : (
            <div id="youtube-iframe-target" style={{ height: '350px', width: '100%' }} />
          )}
        </div>

        {/* Paste link form */}
        <form onSubmit={handleLoadUrl} style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              className="input-neon"
              placeholder="Paste Spotify track/playlist or YouTube video URL..."
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              style={{ padding: '0.6rem 0.8rem 0.6rem 2.2rem', fontSize: '0.85rem' }}
            />
            <Link2 size={14} className="text-muted" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          </div>
          <button type="submit" className="glow-btn-cyan font-display" style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', borderRadius: '8px', cursor: 'pointer' }} disabled={!inputUrl.trim()}>
            Load
          </button>
        </form>

      </div>

      {/* RIGHT COLUMN: Curated Vibe Playlists, guides, and history queue */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '1.5rem', textAlign: 'left' }}>
        
        {/* Curated quick playlists */}
        <div>
          <h4 className="font-display text-cyan" style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', letterSpacing: '0.5px' }}>CHOOSE CO-OP SOUNDTRACK VIBE</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {Object.entries(CURATED_SOUNDTRACKS).map(([key, item]) => {
              const isSelected = soundtrackGenre === key;
              return (
                <div 
                  key={key}
                  onClick={() => selectCuratedPlaylist(key)}
                  className="glass-panel"
                  style={{ 
                    padding: '0.75rem', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    border: isSelected ? '1px solid var(--neon-cyan)' : '1px solid rgba(255,255,255,0.06)',
                    background: isSelected ? 'rgba(0, 240, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: isSelected ? 'var(--neon-cyan)' : '#fff', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Music size={12} />
                    {item.title}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', lineHeight: '1.2' }}>{item.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sync helper action tools */}
        <div className="glass-panel" style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255, 170, 0, 0.15)', background: 'rgba(255, 170, 0, 0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--neon-yellow)', fontSize: '0.85rem', fontWeight: 600 }}>
            <Info size={14} />
            Co-op Sync Controls
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.35rem 0 0.6rem 0', lineHeight: '1.4' }}>
            Playheads are synced automatically. If you run out of sync due to loading lag, use the manual timeline sync tool.
          </p>
          {isConnected && (
            <button 
              type="button" 
              onClick={handleForceSync}
              className="glow-btn-cyan font-display"
              style={{ 
                width: '100%',
                padding: '0.5rem',
                fontSize: '0.75rem',
                borderRadius: '6px',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '0.35rem',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={12} /> Force Sync Playback head
            </button>
          )}
        </div>

        {/* Paste tracks queue history */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <h4 className="font-display text-cyan" style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', letterSpacing: '0.5px' }}>RECENTLY LOADED</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, overflowY: 'auto', maxHeight: '180px' }}>
            {history.map((hist) => (
              <div 
                key={hist.id} 
                onClick={() => {
                  setInputUrl(hist.service === 'spotify' ? hist.uri : `https://www.youtube.com/watch?v=${hist.uri.replace('youtube:', '')}`);
                }}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem', 
                  padding: '0.4rem 0.6rem', 
                  borderRadius: '6px', 
                  background: 'rgba(255,255,255,0.03)', 
                  cursor: 'pointer',
                  border: '1px solid transparent',
                  transition: 'border 0.2s ease',
                  fontSize: '0.75rem'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.border = '1px solid rgba(0, 240, 255, 0.15)')}
                onMouseLeave={(e) => (e.currentTarget.style.border = '1px solid transparent')}
              >
                {hist.service === 'spotify' ? <SpotifyIcon style={{ width: '12px', height: '12px', color: '#1db954' }} /> : <YoutubeIcon style={{ width: '12px', height: '12px', color: '#ff007f' }} />}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{hist.label}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
