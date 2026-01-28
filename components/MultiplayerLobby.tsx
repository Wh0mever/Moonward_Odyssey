import React, { useState, useEffect, useRef } from 'react';
import { Users, UserPlus, Search, Play, ArrowLeft, Send, Loader2, Wifi, RefreshCw, User, MessageCircle } from 'lucide-react';
import { multiplayerService, LobbyState, LobbyInfo, ChatMessage } from '../services/multiplayerService';

interface MultiplayerLobbyProps {
    onBack: () => void;
    onGameStart: () => void;
    serverUrl?: string;
}

type Screen = 'username' | 'menu' | 'searching' | 'browser' | 'lobby' | 'loading';

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({ onBack, onGameStart, serverUrl }) => {
    const [screen, setScreen] = useState<Screen>('username');
    const [username, setUsername] = useState(multiplayerService.getSavedUsername() || '');
    const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
    const [lobbies, setLobbies] = useState<LobbyInfo[]>([]);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (serverUrl) {
            multiplayerService.setServerUrl(serverUrl);
        }

        const unsubLobby = multiplayerService.onLobbyChange((state) => {
            setLobbyState(state);

            // Handle state transitions
            if (state.gameState === 'loading') {
                setScreen('loading');
            } else if (state.lobbyId && state.gameState === 'waiting') {
                setScreen('lobby');
            } else if (state.isInQueue) {
                setScreen('searching');
            }
        });

        // Dedicated subscription for game start - more reliable
        const unsubGameStart = multiplayerService.onGameStart(() => {
            console.log('Game started! Transitioning to play...');
            onGameStart();
        });

        const unsubLobbyList = multiplayerService.onLobbyListUpdate(setLobbies);

        return () => {
            unsubLobby();
            unsubGameStart();
            unsubLobbyList();
        };
    }, [serverUrl, onGameStart]);

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [lobbyState?.chat]);

    const handleConnect = async () => {
        if (!username.trim() || username.trim().length < 2) {
            setError('Username must be at least 2 characters');
            return;
        }

        setIsLoading(true);
        setError('');

        const connected = await multiplayerService.connect();
        if (!connected) {
            setError('Failed to connect to server');
            setIsLoading(false);
            return;
        }

        const result = await multiplayerService.register(username.trim());
        if (!result.success) {
            setError(result.error || 'Registration failed');
            setIsLoading(false);
            return;
        }

        setScreen('menu');
        setIsLoading(false);
        refreshLobbies();
    };

    const refreshLobbies = async () => {
        const list = await multiplayerService.getLobbies();
        setLobbies(list);
    };

    const handleCreateLobby = async () => {
        setIsLoading(true);
        setError('');
        const result = await multiplayerService.createLobby();
        if (!result.success) {
            setError(result.error || 'Failed to create lobby');
        }
        setIsLoading(false);
    };

    const handleJoinLobby = async (lobbyId: string) => {
        setIsLoading(true);
        setError('');
        const result = await multiplayerService.joinLobby(lobbyId);
        if (!result.success) {
            setError(result.error || 'Failed to join lobby');
        }
        setIsLoading(false);
    };

    const handleQuickMatch = async () => {
        setError('');
        setScreen('searching'); // Immediately show searching screen
        const result = await multiplayerService.quickMatch();
        if (!result.success) {
            setScreen('menu'); // Return to menu on error
            setError('Failed to start matchmaking');
        }
    };

    const handleCancelMatch = () => {
        multiplayerService.cancelMatch();
        setScreen('menu');
    };

    const handleStartGame = async () => {
        const result = await multiplayerService.startGame();
        if (!result.success) {
            setError(result.error || 'Failed to start game');
        }
    };

    const handleLeaveLobby = () => {
        multiplayerService.leaveLobby();
        setScreen('menu');
        refreshLobbies();
    };

    const handleSendChat = () => {
        if (chatInput.trim()) {
            multiplayerService.sendChat(chatInput);
            setChatInput('');
        }
    };

    const handleBack = () => {
        multiplayerService.disconnect();
        onBack();
    };

    // Get ping color
    const getPingColor = (ping: number) => {
        if (ping < 50) return 'text-green-400';
        if (ping < 100) return 'text-yellow-400';
        return 'text-red-400';
    };

    // === USERNAME SCREEN ===
    if (screen === 'username') {
        return (
            <div className="fixed inset-0 bg-gradient-to-b from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center">
                <div className="bg-slate-800/90 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md border border-purple-500/30 shadow-2xl">
                    <button onClick={handleBack} className="flex items-center gap-2 text-white/60 hover:text-white mb-6">
                        <ArrowLeft size={20} /> Back
                    </button>

                    <div className="flex items-center gap-3 mb-6">
                        <Users className="text-purple-400" size={32} />
                        <h2 className="text-2xl font-bold text-white">Multiplayer</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-white/80 mb-2 text-sm">Enter Your Nickname</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                                placeholder="Your nickname..."
                                maxLength={16}
                                className="w-full px-4 py-3 bg-slate-700/50 border border-purple-500/30 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-purple-400"
                            />
                        </div>

                        {error && <div className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-lg">{error}</div>}

                        <button
                            onClick={handleConnect}
                            disabled={isLoading || username.trim().length < 2}
                            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-bold rounded-lg flex items-center justify-center gap-2"
                        >
                            {isLoading ? <><Loader2 className="animate-spin" size={20} /> Connecting...</> : 'Continue'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // === SEARCHING SCREEN ===
    if (screen === 'searching') {
        return (
            <div className="fixed inset-0 bg-gradient-to-b from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center">
                <div className="bg-slate-800/90 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md border border-purple-500/30 text-center">
                    <Loader2 className="animate-spin text-cyan-400 mx-auto mb-4" size={64} />
                    <h2 className="text-2xl font-bold text-white mb-2">Finding Match...</h2>
                    <p className="text-white/60 mb-6">Searching for another player</p>

                    <button onClick={handleCancelMatch} className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg">
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    // === LOADING SCREEN ===
    if (screen === 'loading') {
        return (
            <div className="fixed inset-0 bg-black flex flex-col items-center justify-center">
                <div className="relative mb-8">
                    <div className="w-32 h-32 border-4 border-purple-500/30 rounded-full animate-pulse" />
                    <div className="absolute inset-0 w-32 h-32 border-4 border-t-cyan-400 rounded-full animate-spin" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">LOADING WORLD</h2>
                <p className="text-white/60 mb-4">Synchronizing with players...</p>
                <div className="flex gap-2">
                    {lobbyState?.players.map((p, i) => (
                        <div key={p.id} className="px-3 py-1 bg-purple-500/20 rounded text-purple-300 text-sm">
                            {p.username}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // === LOBBY SCREEN ===
    if (screen === 'lobby' && lobbyState?.lobbyId) {
        return (
            <div className="fixed inset-0 bg-gradient-to-b from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center p-4">
                <div className="bg-slate-800/90 backdrop-blur-lg rounded-2xl p-6 w-full max-w-2xl border border-purple-500/30 shadow-2xl">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-2xl font-bold text-white">{lobbyState.lobbyName}</h2>
                            <p className="text-white/40 text-sm">Code: {lobbyState.lobbyId}</p>
                        </div>
                        <div className={`flex items-center gap-2 ${getPingColor(lobbyState.ping)}`}>
                            <Wifi size={16} />
                            <span className="font-mono">{lobbyState.ping}ms</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                        {/* Player Slots */}
                        <div>
                            <h3 className="text-white/80 mb-2 flex items-center gap-2"><User size={16} /> Players</h3>
                            <div className="space-y-2">
                                {[1, 2, 3, 4].map((slot) => {
                                    const player = lobbyState.players.find(p => p.slot === slot);
                                    return (
                                        <div key={slot} className={`px-4 py-3 rounded-lg border ${player ? 'bg-slate-700/50 border-purple-500/30' : 'bg-slate-900/30 border-white/10'}`}>
                                            {player ? (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-white font-medium">{player.username}</span>
                                                    <div className="flex gap-2">
                                                        {player.isHost && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">HOST</span>}
                                                        {player.id === multiplayerService.getSocketId() && <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">YOU</span>}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-white/30">Slot {slot} - Empty</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Chat */}
                        <div className="flex flex-col">
                            <h3 className="text-white/80 mb-2 flex items-center gap-2"><MessageCircle size={16} /> Chat</h3>
                            <div className="flex-1 bg-slate-900/50 rounded-lg p-2 h-40 overflow-y-auto text-sm">
                                {lobbyState.chat.length === 0 ? (
                                    <p className="text-white/30 text-center py-4">No messages yet</p>
                                ) : (
                                    lobbyState.chat.map((msg) => (
                                        <div key={msg.id} className="mb-1">
                                            <span className="text-purple-400 font-medium">{msg.username}: </span>
                                            <span className="text-white/80">{msg.text}</span>
                                        </div>
                                    ))
                                )}
                                <div ref={chatEndRef} />
                            </div>
                            <div className="flex gap-2 mt-2">
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                                    placeholder="Type message..."
                                    maxLength={200}
                                    className="flex-1 px-3 py-2 bg-slate-700/50 border border-purple-500/20 rounded-lg text-white text-sm placeholder-white/40 focus:outline-none"
                                />
                                <button onClick={handleSendChat} className="px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg">
                                    <Send size={16} className="text-white" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {error && <div className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-lg mb-4">{error}</div>}

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button onClick={handleLeaveLobby} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg">
                            Leave
                        </button>
                        {lobbyState.isHost && (
                            <button
                                onClick={handleStartGame}
                                disabled={lobbyState.players.length < 2}
                                className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-bold rounded-lg flex items-center justify-center gap-2"
                            >
                                <Play size={20} /> Start Game ({lobbyState.players.length}/4)
                            </button>
                        )}
                        {!lobbyState.isHost && (
                            <div className="flex-1 py-3 bg-slate-700/50 text-white/60 rounded-lg text-center">
                                Waiting for host...
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // === MAIN MENU SCREEN ===
    return (
        <div className="fixed inset-0 bg-gradient-to-b from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center p-4">
            <div className="bg-slate-800/90 backdrop-blur-lg rounded-2xl p-6 w-full max-w-xl border border-purple-500/30 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <button onClick={handleBack} className="flex items-center gap-2 text-white/60 hover:text-white">
                        <ArrowLeft size={20} /> Back
                    </button>
                    {lobbyState?.isConnected && (
                        <div className={`flex items-center gap-2 ${getPingColor(lobbyState.ping)}`}>
                            <Wifi size={16} />
                            <span className="font-mono text-sm">{lobbyState.ping}ms</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3 mb-2">
                    <Users className="text-purple-400" size={32} />
                    <div>
                        <h2 className="text-2xl font-bold text-white">Welcome, {username}!</h2>
                        <p className="text-white/60 text-sm">Choose how to play</p>
                    </div>
                </div>

                {error && <div className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-lg mb-4">{error}</div>}

                <div className="grid grid-cols-2 gap-4 mb-6">
                    {/* Play with Randoms */}
                    <button
                        onClick={handleQuickMatch}
                        disabled={isLoading}
                        className="py-6 bg-gradient-to-br from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl flex flex-col items-center justify-center gap-2"
                    >
                        <Search size={28} />
                        <span>Play with Randoms</span>
                        <span className="text-xs text-white/60">2 Players • Auto-match</span>
                    </button>

                    {/* Create Game */}
                    <button
                        onClick={handleCreateLobby}
                        disabled={isLoading}
                        className="py-6 bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl flex flex-col items-center justify-center gap-2"
                    >
                        <UserPlus size={28} />
                        <span>Create Game</span>
                        <span className="text-xs text-white/60">Up to 4 Players</span>
                    </button>
                </div>

                {/* Lobby Browser */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-white/80 font-medium">Open Lobbies</h3>
                        <button onClick={refreshLobbies} className="text-white/60 hover:text-white p-1">
                            <RefreshCw size={16} />
                        </button>
                    </div>

                    <div className="bg-slate-900/50 rounded-xl p-3 max-h-48 overflow-y-auto">
                        {lobbies.length === 0 ? (
                            <p className="text-white/40 text-center py-4">No open lobbies. Create one!</p>
                        ) : (
                            <div className="space-y-2">
                                {lobbies.map((lobby) => (
                                    <button
                                        key={lobby.id}
                                        onClick={() => handleJoinLobby(lobby.id)}
                                        className="w-full px-4 py-3 bg-slate-800/50 hover:bg-slate-700/50 border border-purple-500/20 hover:border-purple-500/50 rounded-lg flex items-center justify-between transition-all"
                                    >
                                        <div className="text-left">
                                            <div className="text-white font-medium">{lobby.name}</div>
                                            <div className="text-white/40 text-xs">Host: {lobby.hostUsername}</div>
                                        </div>
                                        <div className="text-purple-400 font-mono">
                                            {lobby.playerCount}/{lobby.maxPlayers}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
