import { io, Socket } from 'socket.io-client';

export interface RemotePlayer {
    id: string;
    username: string;
    position: [number, number, number];
    rotation: number;
    health: number;
    isHost: boolean;
    isReady: boolean;
    slot: number;
}

export interface ChatMessage {
    id: string;
    username: string;
    text: string;
    timestamp: number;
}

export interface LobbyInfo {
    id: string;
    name: string;
    playerCount: number;
    maxPlayers: number;
    gameState: string;
    hostUsername: string;
}

export interface LobbyState {
    lobbyId: string | null;
    lobbyName: string | null;
    players: RemotePlayer[];
    chat: ChatMessage[];
    isHost: boolean;
    gameState: 'idle' | 'waiting' | 'loading' | 'playing';
    isConnected: boolean;
    isInQueue: boolean;
    ping: number;
}

type LobbyCallback = (state: LobbyState) => void;
type PlayersCallback = (players: RemotePlayer[]) => void;
type ChatCallback = (message: ChatMessage) => void;
type LobbyListCallback = (lobbies: LobbyInfo[]) => void;
type EnemiesCallback = (enemies: any[]) => void;
type CollectiblesCallback = (collectibles: any[]) => void;
type ItemCallback = (itemId: string) => void;

class MultiplayerService {
    private socket: Socket | null = null;
    private serverUrl: string = 'http://localhost:4001';
    private username: string = '';
    private lobbyState: LobbyState = {
        lobbyId: null,
        lobbyName: null,
        players: [],
        chat: [],
        isHost: false,
        gameState: 'idle',
        isConnected: false,
        isInQueue: false,
        ping: 0
    };

    private pingInterval: NodeJS.Timeout | null = null;
    private lobbyCallbacks: LobbyCallback[] = [];
    private playerUpdateCallbacks: PlayersCallback[] = [];
    private chatCallbacks: ChatCallback[] = [];
    private lobbyListCallbacks: LobbyListCallback[] = [];
    private enemyCallbacks: EnemiesCallback[] = [];
    private collectibleCallbacks: CollectiblesCallback[] = [];
    private itemRemovedCallbacks: ItemCallback[] = [];
    private enemyDiedCallbacks: ItemCallback[] = [];
    private gameStartCallbacks: (() => void)[] = [];
    private gameLoadingCallbacks: (() => void)[] = [];
    private gameOverCallbacks: ((reason: string, killedPlayer: string) => void)[] = [];

    setServerUrl(url: string) {
        this.serverUrl = url;
    }

    connect(): Promise<boolean> {
        return new Promise((resolve) => {
            if (this.socket?.connected) {
                resolve(true);
                return;
            }

            this.socket = io(this.serverUrl, {
                transports: ['websocket'],
                reconnection: true,
                reconnectionAttempts: 5
            });

            this.socket.on('connect', () => {
                console.log('Connected to multiplayer server');
                this.lobbyState.isConnected = true;
                this.startPingTracking();
                this.notifyLobbyChange();
                resolve(true);
            });

            this.socket.on('disconnect', () => {
                console.log('Disconnected from multiplayer server');
                this.stopPingTracking();
                this.lobbyState = {
                    lobbyId: null,
                    lobbyName: null,
                    players: [],
                    chat: [],
                    isHost: false,
                    gameState: 'idle',
                    isConnected: false,
                    isInQueue: false,
                    ping: 0
                };
                this.notifyLobbyChange();
            });

            this.socket.on('connect_error', () => {
                console.error('Failed to connect to multiplayer server');
                resolve(false);
            });

            this.setupEventHandlers();
        });
    }

    private startPingTracking() {
        this.pingInterval = setInterval(() => {
            if (!this.socket) return;

            const start = Date.now();
            this.socket.emit('ping', (serverTime: number) => {
                const ping = Date.now() - start;
                this.lobbyState.ping = ping;
                this.socket?.emit('reportPing', ping);
                this.notifyLobbyChange();
            });
        }, 2000);
    }

    private stopPingTracking() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    private setupEventHandlers() {
        if (!this.socket) return;

        this.socket.on('playerJoined', (player: RemotePlayer) => {
            this.lobbyState.players.push(player);
            this.notifyLobbyChange();
            this.notifyPlayerUpdate();
        });

        this.socket.on('playerLeft', (playerId: string) => {
            this.lobbyState.players = this.lobbyState.players.filter(p => p.id !== playerId);
            this.notifyLobbyChange();
            this.notifyPlayerUpdate();
        });

        this.socket.on('playerMoved', (data: { id: string; position: [number, number, number]; rotation: number; health: number }) => {
            const player = this.lobbyState.players.find(p => p.id === data.id);
            if (player) {
                player.position = data.position;
                player.rotation = data.rotation;
                player.health = data.health;
                this.notifyPlayerUpdate();
            }
        });

        this.socket.on('playerReady', (data: { id: string; isReady: boolean }) => {
            const player = this.lobbyState.players.find(p => p.id === data.id);
            if (player) {
                player.isReady = data.isReady;
                this.notifyLobbyChange();
            }
        });

        this.socket.on('newHost', (hostId: string) => {
            this.lobbyState.players.forEach(p => p.isHost = p.id === hostId);
            this.lobbyState.isHost = this.socket?.id === hostId;
            this.notifyLobbyChange();
        });

        this.socket.on('chatMessage', (message: ChatMessage) => {
            this.lobbyState.chat.push(message);
            if (this.lobbyState.chat.length > 100) {
                this.lobbyState.chat.shift();
            }
            this.chatCallbacks.forEach(cb => cb(message));
            this.notifyLobbyChange();
        });

        this.socket.on('gameLoading', () => {
            console.log('[MP Client] >>> gameLoading event received');
            this.lobbyState.gameState = 'loading';
            this.notifyLobbyChange();
            this.gameLoadingCallbacks.forEach(cb => cb());
        });

        this.socket.on('gameStarted', () => {
            console.log('[MP Client] >>> gameStarted event received! Transitioning to playing...');
            this.lobbyState.gameState = 'playing';
            this.notifyLobbyChange();
            this.gameStartCallbacks.forEach(cb => cb());
            console.log('[MP Client] gameStarted callbacks executed:', this.gameStartCallbacks.length);
        });

        this.socket.on('matchFound', (data: { id: string; name: string; players: RemotePlayer[] }) => {
            console.log('[MP Client] >>> matchFound event received!', data);
            console.log('[MP Client] Match lobby:', data.name, 'Players:', data.players.map(p => p.username).join(', '));
            this.lobbyState.lobbyId = data.id;
            this.lobbyState.lobbyName = data.name;
            this.lobbyState.players = data.players;
            this.lobbyState.isInQueue = false;
            this.lobbyState.gameState = 'loading';
            this.lobbyState.isHost = data.players.find(p => p.id === this.socket?.id)?.isHost || false;
            console.log('[MP Client] Updated lobbyState.gameState to:', this.lobbyState.gameState);
            this.notifyLobbyChange();
            this.gameLoadingCallbacks.forEach(cb => cb());
            console.log('[MP Client] matchFound processing complete');
        });

        this.socket.on('lobbyListUpdated', () => {
            this.refreshLobbies();
        });

        this.socket.on('enemyUpdate', (enemies: any[]) => {
            this.enemyCallbacks.forEach(cb => cb(enemies));
        });

        this.socket.on('collectibleUpdate', (collectibles: any[]) => {
            this.collectibleCallbacks.forEach(cb => cb(collectibles));
        });

        this.socket.on('itemRemoved', (itemId: string) => {
            this.itemRemovedCallbacks.forEach(cb => cb(itemId));
        });

        this.socket.on('enemyDied', (enemyId: string) => {
            this.enemyDiedCallbacks.forEach(cb => cb(enemyId));
        });

        this.socket.on('gameOver', (data: { reason: string; killedPlayer: string }) => {
            console.log('[MP Client] >>> gameOver event received!', data);
            this.lobbyState.gameState = 'idle';
            this.lobbyState.lobbyId = null;
            this.lobbyState.lobbyName = null;
            this.lobbyState.players = [];
            this.notifyLobbyChange();
            this.gameOverCallbacks.forEach(cb => cb(data.reason, data.killedPlayer));
        });
    }

    disconnect() {
        this.stopPingTracking();
        this.socket?.disconnect();
        this.socket = null;
        this.lobbyState = {
            lobbyId: null,
            lobbyName: null,
            players: [],
            chat: [],
            isHost: false,
            gameState: 'idle',
            isConnected: false,
            isInQueue: false,
            ping: 0
        };
    }

    async register(username: string): Promise<{ success: boolean; error?: string }> {
        if (!this.socket) return { success: false, error: 'Not connected' };

        return new Promise((resolve) => {
            this.socket!.emit('register', username, (result: { success: boolean; error?: string }) => {
                if (result.success) {
                    this.username = username;
                    // Save to localStorage
                    localStorage.setItem('moonward_username', username);
                }
                resolve(result);
            });
        });
    }

    getSavedUsername(): string | null {
        return localStorage.getItem('moonward_username');
    }

    async getLobbies(): Promise<LobbyInfo[]> {
        if (!this.socket) return [];

        return new Promise((resolve) => {
            this.socket!.emit('getLobbies', (lobbies: LobbyInfo[]) => {
                resolve(lobbies);
            });
        });
    }

    private refreshLobbies() {
        this.getLobbies().then(lobbies => {
            this.lobbyListCallbacks.forEach(cb => cb(lobbies));
        });
    }

    async createLobby(): Promise<{ success: boolean; lobbyId?: string; lobbyName?: string; error?: string }> {
        if (!this.socket) return { success: false, error: 'Not connected' };

        return new Promise((resolve) => {
            this.socket!.emit('createLobby', (result: { success: boolean; lobbyId?: string; lobbyName?: string; error?: string }) => {
                if (result.success && result.lobbyId) {
                    this.lobbyState.lobbyId = result.lobbyId;
                    this.lobbyState.lobbyName = result.lobbyName || 'Lobby';
                    this.lobbyState.isHost = true;
                    this.lobbyState.gameState = 'waiting';
                    this.lobbyState.players = [{
                        id: this.socket!.id!,
                        username: this.username,
                        position: [0, 2, 0],
                        rotation: 0,
                        health: 100,
                        isHost: true,
                        isReady: true,
                        slot: 1
                    }];
                    this.lobbyState.chat = [];
                    this.notifyLobbyChange();
                }
                resolve(result);
            });
        });
    }

    async joinLobby(lobbyId: string): Promise<{ success: boolean; error?: string }> {
        if (!this.socket) return { success: false, error: 'Not connected' };

        return new Promise((resolve) => {
            this.socket!.emit('joinLobby', lobbyId, (result: { success: boolean; lobby?: any; error?: string }) => {
                if (result.success && result.lobby) {
                    this.lobbyState.lobbyId = result.lobby.id;
                    this.lobbyState.lobbyName = result.lobby.name;
                    this.lobbyState.players = result.lobby.players;
                    this.lobbyState.chat = result.lobby.chat || [];
                    this.lobbyState.isHost = false;
                    this.lobbyState.gameState = 'waiting';
                    this.notifyLobbyChange();
                }
                resolve(result);
            });
        });
    }

    async quickMatch(): Promise<{ success: boolean; status?: string }> {
        if (!this.socket) {
            console.log('[MP Client] quickMatch failed - not connected');
            return { success: false };
        }

        console.log('[MP Client] quickMatch called, emitting to server...');
        return new Promise((resolve) => {
            this.socket!.emit('quickMatch', (result: { success: boolean; status?: string }) => {
                console.log('[MP Client] quickMatch callback received:', result);
                if (result.status === 'searching') {
                    console.log('[MP Client] Added to matchmaking queue, waiting for match...');
                    this.lobbyState.isInQueue = true;
                    this.notifyLobbyChange();
                } else if (result.status === 'matched') {
                    console.log('[MP Client] Matched immediately! Waiting for matchFound event...');
                }
                resolve(result);
            });
        });
    }

    cancelMatch() {
        this.socket?.emit('cancelMatch');
        this.lobbyState.isInQueue = false;
        this.notifyLobbyChange();
    }

    sendChat(text: string) {
        if (!this.socket || !text.trim()) return;
        this.socket.emit('sendChat', text.trim());
    }

    toggleReady() {
        this.socket?.emit('toggleReady');
    }

    async startGame(): Promise<{ success: boolean; error?: string }> {
        if (!this.socket) return { success: false, error: 'Not connected' };

        return new Promise((resolve) => {
            this.socket!.emit('startGame', resolve);
        });
    }

    sendPlayerUpdate(position: [number, number, number], rotation: number, health: number) {
        if (!this.socket || !this.lobbyState.lobbyId) return;
        this.socket.emit('playerUpdate', { position, rotation, health });
    }

    syncEnemies(enemies: any[]) {
        if (!this.socket || !this.lobbyState.isHost) return;
        this.socket.emit('enemySync', enemies);
    }

    syncCollectibles(collectibles: any[]) {
        if (!this.socket || !this.lobbyState.isHost) return;
        this.socket.emit('collectibleSync', collectibles);
    }

    notifyItemCollected(itemId: string) {
        this.socket?.emit('itemCollected', itemId);
    }

    notifyEnemyKilled(enemyId: string) {
        this.socket?.emit('enemyKilled', enemyId);
    }

    notifyPlayerDied() {
        if (!this.socket || !this.lobbyState.lobbyId) return;
        console.log('[MP Client] Notifying server: player died');
        this.socket.emit('playerDied');
    }

    leaveLobby() {
        this.socket?.emit('leaveLobby');
        this.lobbyState.lobbyId = null;
        this.lobbyState.lobbyName = null;
        this.lobbyState.players = [];
        this.lobbyState.chat = [];
        this.lobbyState.isHost = false;
        this.lobbyState.gameState = 'idle';
        this.notifyLobbyChange();
    }

    // Subscriptions
    onLobbyChange(callback: LobbyCallback) {
        this.lobbyCallbacks.push(callback);
        return () => {
            this.lobbyCallbacks = this.lobbyCallbacks.filter(cb => cb !== callback);
        };
    }

    onPlayerUpdate(callback: PlayersCallback) {
        this.playerUpdateCallbacks.push(callback);
        return () => {
            this.playerUpdateCallbacks = this.playerUpdateCallbacks.filter(cb => cb !== callback);
        };
    }

    onChatMessage(callback: ChatCallback) {
        this.chatCallbacks.push(callback);
        return () => {
            this.chatCallbacks = this.chatCallbacks.filter(cb => cb !== callback);
        };
    }

    onLobbyListUpdate(callback: LobbyListCallback) {
        this.lobbyListCallbacks.push(callback);
        return () => {
            this.lobbyListCallbacks = this.lobbyListCallbacks.filter(cb => cb !== callback);
        };
    }

    onEnemyUpdate(callback: EnemiesCallback) {
        this.enemyCallbacks.push(callback);
        return () => {
            this.enemyCallbacks = this.enemyCallbacks.filter(cb => cb !== callback);
        };
    }

    onCollectibleUpdate(callback: CollectiblesCallback) {
        this.collectibleCallbacks.push(callback);
        return () => {
            this.collectibleCallbacks = this.collectibleCallbacks.filter(cb => cb !== callback);
        };
    }

    onItemRemoved(callback: ItemCallback) {
        this.itemRemovedCallbacks.push(callback);
        return () => {
            this.itemRemovedCallbacks = this.itemRemovedCallbacks.filter(cb => cb !== callback);
        };
    }

    onEnemyDied(callback: ItemCallback) {
        this.enemyDiedCallbacks.push(callback);
        return () => {
            this.enemyDiedCallbacks = this.enemyDiedCallbacks.filter(cb => cb !== callback);
        };
    }

    onGameStart(callback: () => void) {
        this.gameStartCallbacks.push(callback);
        return () => {
            this.gameStartCallbacks = this.gameStartCallbacks.filter(cb => cb !== callback);
        };
    }

    onGameLoading(callback: () => void) {
        this.gameLoadingCallbacks.push(callback);
        return () => {
            this.gameLoadingCallbacks = this.gameLoadingCallbacks.filter(cb => cb !== callback);
        };
    }

    onGameOver(callback: (reason: string, killedPlayer: string) => void) {
        this.gameOverCallbacks.push(callback);
        return () => {
            this.gameOverCallbacks = this.gameOverCallbacks.filter(cb => cb !== callback);
        };
    }

    private notifyLobbyChange() {
        this.lobbyCallbacks.forEach(cb => cb({ ...this.lobbyState }));
    }

    private notifyPlayerUpdate() {
        this.playerUpdateCallbacks.forEach(cb => cb([...this.lobbyState.players]));
    }

    getState(): LobbyState {
        return { ...this.lobbyState };
    }

    getUsername(): string {
        return this.username;
    }

    getSocketId(): string | undefined {
        return this.socket?.id;
    }

    getPing(): number {
        return this.lobbyState.ping;
    }
}

export const multiplayerService = new MultiplayerService();
