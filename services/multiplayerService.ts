import { io, Socket } from 'socket.io-client';

export interface RemotePlayer {
    id: string;
    username: string;
    position: [number, number, number];
    rotation: number;
    health: number;
    isHost: boolean;
}

export interface LobbyState {
    lobbyId: string | null;
    players: RemotePlayer[];
    isHost: boolean;
    gameStarted: boolean;
    isConnected: boolean;
    isInQueue: boolean;
}

type LobbyCallback = (state: LobbyState) => void;
type PlayersCallback = (players: RemotePlayer[]) => void;
type EnemiesCallback = (enemies: any[]) => void;
type CollectiblesCallback = (collectibles: any[]) => void;
type ItemCallback = (itemId: string) => void;

class MultiplayerService {
    private socket: Socket | null = null;
    private serverUrl: string = 'http://localhost:4001';
    private username: string = '';
    private lobbyState: LobbyState = {
        lobbyId: null,
        players: [],
        isHost: false,
        gameStarted: false,
        isConnected: false,
        isInQueue: false
    };

    private lobbyCallbacks: LobbyCallback[] = [];
    private playerUpdateCallbacks: PlayersCallback[] = [];
    private enemyCallbacks: EnemiesCallback[] = [];
    private collectibleCallbacks: CollectiblesCallback[] = [];
    private itemRemovedCallbacks: ItemCallback[] = [];
    private enemyDiedCallbacks: ItemCallback[] = [];
    private gameStartCallbacks: (() => void)[] = [];

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
                this.notifyLobbyChange();
                resolve(true);
            });

            this.socket.on('disconnect', () => {
                console.log('Disconnected from multiplayer server');
                this.lobbyState.isConnected = false;
                this.lobbyState.lobbyId = null;
                this.lobbyState.players = [];
                this.notifyLobbyChange();
            });

            this.socket.on('connect_error', () => {
                console.error('Failed to connect to multiplayer server');
                resolve(false);
            });

            this.setupEventHandlers();
        });
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

        this.socket.on('newHost', (hostId: string) => {
            this.lobbyState.players.forEach(p => p.isHost = p.id === hostId);
            this.lobbyState.isHost = this.socket?.id === hostId;
            this.notifyLobbyChange();
        });

        this.socket.on('gameStarted', () => {
            this.lobbyState.gameStarted = true;
            this.notifyLobbyChange();
            this.gameStartCallbacks.forEach(cb => cb());
        });

        this.socket.on('matchFound', (data: { lobbyId: string; players: RemotePlayer[] }) => {
            this.lobbyState.lobbyId = data.lobbyId;
            this.lobbyState.players = data.players;
            this.lobbyState.isInQueue = false;
            this.lobbyState.isHost = data.players.find(p => p.id === this.socket?.id)?.isHost || false;
            this.notifyLobbyChange();
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
    }

    disconnect() {
        this.socket?.disconnect();
        this.socket = null;
        this.lobbyState = {
            lobbyId: null,
            players: [],
            isHost: false,
            gameStarted: false,
            isConnected: false,
            isInQueue: false
        };
    }

    async register(username: string): Promise<{ success: boolean; error?: string }> {
        if (!this.socket) return { success: false, error: 'Not connected' };

        return new Promise((resolve) => {
            this.socket!.emit('register', username, (result: { success: boolean; error?: string }) => {
                if (result.success) {
                    this.username = username;
                }
                resolve(result);
            });
        });
    }

    async createLobby(): Promise<{ success: boolean; lobbyId?: string; error?: string }> {
        if (!this.socket) return { success: false, error: 'Not connected' };

        return new Promise((resolve) => {
            this.socket!.emit('createLobby', (result: { success: boolean; lobbyId?: string; error?: string }) => {
                if (result.success && result.lobbyId) {
                    this.lobbyState.lobbyId = result.lobbyId;
                    this.lobbyState.isHost = true;
                    this.lobbyState.players = [{
                        id: this.socket!.id!,
                        username: this.username,
                        position: [0, 2, 0],
                        rotation: 0,
                        health: 100,
                        isHost: true
                    }];
                    this.notifyLobbyChange();
                }
                resolve(result);
            });
        });
    }

    async joinLobby(lobbyId: string): Promise<{ success: boolean; error?: string }> {
        if (!this.socket) return { success: false, error: 'Not connected' };

        return new Promise((resolve) => {
            this.socket!.emit('joinLobby', lobbyId, (result: { success: boolean; players?: RemotePlayer[]; error?: string }) => {
                if (result.success && result.players) {
                    this.lobbyState.lobbyId = lobbyId;
                    this.lobbyState.players = result.players;
                    this.lobbyState.isHost = false;
                    this.notifyLobbyChange();
                }
                resolve(result);
            });
        });
    }

    async quickMatch(): Promise<{ success: boolean; waiting?: boolean; lobbyId?: string }> {
        if (!this.socket) return { success: false };

        return new Promise((resolve) => {
            this.socket!.emit('quickMatch', (result: { success: boolean; waiting?: boolean; lobbyId?: string }) => {
                if (result.waiting) {
                    this.lobbyState.isInQueue = true;
                    this.notifyLobbyChange();
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

    leaveLobby() {
        this.socket?.emit('leaveLobby');
        this.lobbyState.lobbyId = null;
        this.lobbyState.players = [];
        this.lobbyState.isHost = false;
        this.lobbyState.gameStarted = false;
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
}

export const multiplayerService = new MultiplayerService();
