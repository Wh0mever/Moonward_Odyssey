import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Search, Play, ArrowLeft, Copy, Check, Loader2, Wifi, WifiOff } from 'lucide-react';
import { multiplayerService, LobbyState, RemotePlayer } from '../services/multiplayerService';

interface MultiplayerLobbyProps {
    onBack: () => void;
    onGameStart: () => void;
    serverUrl?: string;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({ onBack, onGameStart, serverUrl }) => {
    const [username, setUsername] = useState('');
    const [isRegistered, setIsRegistered] = useState(false);
    const [lobbyCode, setLobbyCode] = useState('');
    const [lobbyState, setLobbyState] = useState<LobbyState | null>(null);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (serverUrl) {
            multiplayerService.setServerUrl(serverUrl);
        }

        const unsubLobby = multiplayerService.onLobbyChange(setLobbyState);
        const unsubGameStart = multiplayerService.onGameStart(onGameStart);

        return () => {
            unsubLobby();
            unsubGameStart();
        };
    }, [serverUrl, onGameStart]);

    const handleConnect = async () => {
        if (!username.trim()) {
            setError('Enter username');
            return;
        }

        setIsConnecting(true);
        setError('');

        const connected = await multiplayerService.connect();
        if (!connected) {
            setError('Failed to connect to server');
            setIsConnecting(false);
            return;
        }

        const result = await multiplayerService.register(username.trim());
        if (!result.success) {
            setError(result.error || 'Registration failed');
            setIsConnecting(false);
            return;
        }

        setIsRegistered(true);
        setIsConnecting(false);
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

    const handleJoinLobby = async () => {
        if (!lobbyCode.trim()) {
            setError('Enter lobby code');
            return;
        }

        setIsLoading(true);
        setError('');
        const result = await multiplayerService.joinLobby(lobbyCode.trim().toUpperCase());
        if (!result.success) {
            setError(result.error || 'Failed to join lobby');
        }
        setIsLoading(false);
    };

    const handleQuickMatch = async () => {
        setIsLoading(true);
        setError('');
        await multiplayerService.quickMatch();
        setIsLoading(false);
    };

    const handleCancelMatch = () => {
        multiplayerService.cancelMatch();
    };

    const handleStartGame = async () => {
        const result = await multiplayerService.startGame();
        if (!result.success) {
            setError(result.error || 'Failed to start game');
        }
    };

    const handleLeaveLobby = () => {
        multiplayerService.leaveLobby();
    };

    const copyLobbyCode = () => {
        if (lobbyState?.lobbyId) {
            navigator.clipboard.writeText(lobbyState.lobbyId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleBack = () => {
        multiplayerService.disconnect();
        onBack();
    };

    // Username input screen
    if (!isRegistered) {
        return (
            <div className="fixed inset-0 bg-gradient-to-b from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center">
                <div className="bg-slate-800/80 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md border border-purple-500/30 shadow-2xl">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-white/60 hover:text-white mb-6 transition-colors"
                    >
                        <ArrowLeft size={20} />
                        Back
                    </button>

                    <div className="flex items-center gap-3 mb-6">
                        <Users className="text-purple-400" size={32} />
                        <h2 className="text-2xl font-bold text-white">Multiplayer</h2>
                    </div>

                    <div className="flex items-center gap-2 mb-4 text-sm">
                        {lobbyState?.isConnected ? (
                            <>
                                <Wifi className="text-green-400" size={16} />
                                <span className="text-green-400">Connected</span>
                            </>
                        ) : (
                            <>
                                <WifiOff className="text-gray-400" size={16} />
                                <span className="text-gray-400">Not connected</span>
                            </>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-white/80 mb-2 text-sm">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                                placeholder="Enter your username..."
                                maxLength={16}
                                className="w-full px-4 py-3 bg-slate-700/50 border border-purple-500/30 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-purple-400 transition-colors"
                            />
                        </div>

                        {error && (
                            <div className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-lg">
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleConnect}
                            disabled={isConnecting || !username.trim()}
                            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                        >
                            {isConnecting ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    Connecting...
                                </>
                            ) : (
                                'Connect'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // In matchmaking queue
    if (lobbyState?.isInQueue) {
        return (
            <div className="fixed inset-0 bg-gradient-to-b from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center">
                <div className="bg-slate-800/80 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md border border-purple-500/30 shadow-2xl text-center">
                    <Loader2 className="animate-spin text-purple-400 mx-auto mb-4" size={48} />
                    <h2 className="text-2xl font-bold text-white mb-2">Finding Match...</h2>
                    <p className="text-white/60 mb-6">Waiting for another player</p>

                    <button
                        onClick={handleCancelMatch}
                        className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    // In lobby
    if (lobbyState?.lobbyId) {
        return (
            <div className="fixed inset-0 bg-gradient-to-b from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center">
                <div className="bg-slate-800/80 backdrop-blur-lg rounded-2xl p-8 w-full max-w-lg border border-purple-500/30 shadow-2xl">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-white">Lobby</h2>
                        <div className="flex items-center gap-2">
                            <span className="text-purple-400 font-mono text-lg">{lobbyState.lobbyId}</span>
                            <button
                                onClick={copyLobbyCode}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                title="Copy lobby code"
                            >
                                {copied ? (
                                    <Check className="text-green-400" size={18} />
                                ) : (
                                    <Copy className="text-white/60" size={18} />
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="mb-6">
                        <h3 className="text-white/80 mb-3 flex items-center gap-2">
                            <Users size={18} />
                            Players ({lobbyState.players.length}/4)
                        </h3>
                        <div className="space-y-2">
                            {lobbyState.players.map((player) => (
                                <div
                                    key={player.id}
                                    className="flex items-center justify-between px-4 py-3 bg-slate-700/50 rounded-lg border border-purple-500/20"
                                >
                                    <span className="text-white font-medium">{player.username}</span>
                                    <div className="flex items-center gap-2">
                                        {player.isHost && (
                                            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">
                                                HOST
                                            </span>
                                        )}
                                        {player.id === multiplayerService.getSocketId() && (
                                            <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">
                                                YOU
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {error && (
                        <div className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-lg mb-4">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={handleLeaveLobby}
                            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                        >
                            Leave
                        </button>

                        {lobbyState.isHost && (
                            <button
                                onClick={handleStartGame}
                                disabled={lobbyState.players.length < 2}
                                className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                            >
                                <Play size={20} />
                                Start Game
                            </button>
                        )}
                    </div>

                    {!lobbyState.isHost && (
                        <p className="text-center text-white/40 mt-4 text-sm">
                            Waiting for host to start the game...
                        </p>
                    )}
                </div>
            </div>
        );
    }

    // Lobby menu
    return (
        <div className="fixed inset-0 bg-gradient-to-b from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center">
            <div className="bg-slate-800/80 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md border border-purple-500/30 shadow-2xl">
                <button
                    onClick={handleBack}
                    className="flex items-center gap-2 text-white/60 hover:text-white mb-6 transition-colors"
                >
                    <ArrowLeft size={20} />
                    Back
                </button>

                <div className="flex items-center gap-3 mb-2">
                    <Users className="text-purple-400" size={32} />
                    <h2 className="text-2xl font-bold text-white">Welcome, {username}!</h2>
                </div>

                <p className="text-white/60 mb-6">Choose how to play</p>

                {error && (
                    <div className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-lg mb-4">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    {/* Create Lobby */}
                    <button
                        onClick={handleCreateLobby}
                        disabled={isLoading}
                        className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-3"
                    >
                        <UserPlus size={22} />
                        Create Private Lobby
                    </button>

                    {/* Join Lobby */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={lobbyCode}
                            onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === 'Enter' && handleJoinLobby()}
                            placeholder="Enter lobby code..."
                            maxLength={6}
                            className="flex-1 px-4 py-3 bg-slate-700/50 border border-purple-500/30 rounded-lg text-white uppercase font-mono placeholder-white/40 focus:outline-none focus:border-purple-400 transition-colors"
                        />
                        <button
                            onClick={handleJoinLobby}
                            disabled={isLoading || !lobbyCode.trim()}
                            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-white rounded-lg transition-colors"
                        >
                            Join
                        </button>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/10"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-slate-800 text-white/40">or</span>
                        </div>
                    </div>

                    {/* Quick Match */}
                    <button
                        onClick={handleQuickMatch}
                        disabled={isLoading}
                        className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-3"
                    >
                        <Search size={22} />
                        Quick Match
                    </button>
                </div>
            </div>
        </div>
    );
};
