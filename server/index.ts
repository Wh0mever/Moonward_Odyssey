import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    pingInterval: 2000,
    pingTimeout: 5000
});

// ============ LOGGING UTILITIES ============
const LOG_COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

function log(category: string, message: string, data?: any) {
    const timestamp = new Date().toLocaleTimeString();
    const color = getLogColor(category);
    const prefix = `${LOG_COLORS.bright}[${timestamp}]${LOG_COLORS.reset} ${color}[${category}]${LOG_COLORS.reset}`;

    if (data !== undefined) {
        console.log(`${prefix} ${message}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
    } else {
        console.log(`${prefix} ${message}`);
    }
}

function getLogColor(category: string): string {
    switch (category) {
        case 'CONNECT': return LOG_COLORS.green;
        case 'DISCONNECT': return LOG_COLORS.red;
        case 'REGISTER': return LOG_COLORS.cyan;
        case 'LOBBY': return LOG_COLORS.yellow;
        case 'MATCH': return LOG_COLORS.magenta;
        case 'GAME': return LOG_COLORS.blue;
        case 'CHAT': return LOG_COLORS.cyan;
        case 'SYNC': return LOG_COLORS.yellow;
        case 'ERROR': return LOG_COLORS.red;
        default: return LOG_COLORS.reset;
    }
}

// Types
interface Player {
    id: string;
    username: string;
    position: [number, number, number];
    rotation: number;
    health: number;
    isHost: boolean;
    isReady: boolean;
    slot: number;
    lastActivity: number;
}

interface ChatMessage {
    id: string;
    username: string;
    text: string;
    timestamp: number;
}

interface Lobby {
    id: string;
    name: string;
    hostId: string;
    players: Map<string, Player>;
    gameState: 'waiting' | 'loading' | 'playing' | 'finished';
    maxPlayers: number;
    createdAt: number;
    chat: ChatMessage[];
}

// State
const lobbies = new Map<string, Lobby>();
const usernames = new Map<string, { socketId: string; lastActivity: number }>();
const socketToLobby = new Map<string, string>();
const socketToPing = new Map<string, number>();
const matchmakingQueue: string[] = [];
let lobbyCounter = 1;

const MAX_LOBBIES = 20;
const MAX_PLAYERS_PER_LOBBY = 4;
const USERNAME_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Cleanup inactive usernames
setInterval(() => {
    const now = Date.now();
    usernames.forEach((data, username) => {
        if (now - data.lastActivity > USERNAME_TIMEOUT) {
            log('REGISTER', `Username released due to inactivity: ${username}`);
            usernames.delete(username);
        }
    });
}, 60000);

// Generate unique message ID
function generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

// Get next lobby name
function getNextLobbyName(): string {
    const name = `Lobby ${lobbyCounter}`;
    lobbyCounter++;
    return name;
}

// Find available slot in lobby
function findAvailableSlot(lobby: Lobby): number {
    const usedSlots = new Set(Array.from(lobby.players.values()).map(p => p.slot));
    for (let i = 1; i <= MAX_PLAYERS_PER_LOBBY; i++) {
        if (!usedSlots.has(i)) return i;
    }
    return -1;
}

// Get public lobby info
function getLobbyInfo(lobby: Lobby) {
    return {
        id: lobby.id,
        name: lobby.name,
        playerCount: lobby.players.size,
        maxPlayers: lobby.maxPlayers,
        gameState: lobby.gameState,
        hostUsername: Array.from(lobby.players.values()).find(p => p.isHost)?.username || 'Unknown'
    };
}

// Log current server state
function logServerState() {
    log('INFO', `Server State: ${lobbies.size} lobbies, ${io.sockets.sockets.size} connected, ${matchmakingQueue.length} in queue`);
}

io.on('connection', (socket: Socket) => {
    log('CONNECT', `Client connected: ${socket.id}`);
    logServerState();

    // Ping tracking
    socket.on('ping', (callback) => {
        callback(Date.now());
    });

    // Update ping value from client
    socket.on('reportPing', (ping: number) => {
        socketToPing.set(socket.id, ping);
    });

    // Register username (MANDATORY)
    socket.on('register', (username: string, callback: (result: { success: boolean; error?: string }) => void) => {
        log('REGISTER', `Registration attempt: "${username}" from ${socket.id}`);

        if (!username || username.trim().length < 2) {
            log('REGISTER', `FAILED: Username too short`);
            callback({ success: false, error: 'Username must be at least 2 characters' });
            return;
        }

        const trimmed = username.trim();
        const existing = usernames.get(trimmed);
        if (existing && existing.socketId !== socket.id) {
            const timeSince = Date.now() - existing.lastActivity;
            if (timeSince < USERNAME_TIMEOUT) {
                log('REGISTER', `FAILED: Username "${trimmed}" taken by ${existing.socketId}`);
                callback({ success: false, error: 'Username taken' });
                return;
            }
        }

        usernames.set(trimmed, { socketId: socket.id, lastActivity: Date.now() });
        (socket as any).username = trimmed;
        callback({ success: true });
        log('REGISTER', `SUCCESS: "${trimmed}" registered to ${socket.id}`);
    });

    // Get lobby list
    socket.on('getLobbies', (callback: (lobbies: any[]) => void) => {
        const lobbyList = Array.from(lobbies.values())
            .filter(l => l.gameState === 'waiting' && l.players.size < l.maxPlayers)
            .map(getLobbyInfo);
        log('LOBBY', `Lobby list requested by ${socket.id}: ${lobbyList.length} available`);
        callback(lobbyList);
    });

    // Create lobby with named format
    socket.on('createLobby', (callback: (result: { success: boolean; lobbyId?: string; lobbyName?: string; error?: string }) => void) => {
        log('LOBBY', `Create lobby request from ${socket.id}`);

        if (lobbies.size >= MAX_LOBBIES) {
            log('LOBBY', `FAILED: Max lobbies reached (${MAX_LOBBIES})`);
            callback({ success: false, error: 'Max lobbies reached (20)' });
            return;
        }

        const lobbyId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const lobbyName = getNextLobbyName();
        const username = (socket as any).username || 'Guest';

        const player: Player = {
            id: socket.id,
            username,
            position: [0, 2, 0],
            rotation: 0,
            health: 100,
            isHost: true,
            isReady: true,
            slot: 1,
            lastActivity: Date.now()
        };

        const lobby: Lobby = {
            id: lobbyId,
            name: lobbyName,
            hostId: socket.id,
            players: new Map([[socket.id, player]]),
            gameState: 'waiting',
            maxPlayers: MAX_PLAYERS_PER_LOBBY,
            createdAt: Date.now(),
            chat: []
        };

        lobbies.set(lobbyId, lobby);
        socketToLobby.set(socket.id, lobbyId);
        socket.join(lobbyId);

        callback({ success: true, lobbyId, lobbyName });
        log('LOBBY', `SUCCESS: ${lobbyName} (${lobbyId}) created by ${username}`);

        // Broadcast lobby list update
        io.emit('lobbyListUpdated');
        logServerState();
    });

    // Join existing lobby
    socket.on('joinLobby', (lobbyId: string, callback: (result: { success: boolean; lobby?: any; error?: string }) => void) => {
        log('LOBBY', `Join lobby ${lobbyId} request from ${socket.id}`);

        const lobby = lobbies.get(lobbyId);

        if (!lobby) {
            log('LOBBY', `FAILED: Lobby ${lobbyId} not found`);
            callback({ success: false, error: 'Lobby not found' });
            return;
        }

        if (lobby.players.size >= lobby.maxPlayers) {
            log('LOBBY', `FAILED: Lobby ${lobbyId} is full`);
            callback({ success: false, error: 'Lobby is full' });
            return;
        }

        if (lobby.gameState !== 'waiting') {
            log('LOBBY', `FAILED: Lobby ${lobbyId} game already started (${lobby.gameState})`);
            callback({ success: false, error: 'Game already started' });
            return;
        }

        const slot = findAvailableSlot(lobby);
        if (slot === -1) {
            log('LOBBY', `FAILED: No available slots in ${lobbyId}`);
            callback({ success: false, error: 'No available slots' });
            return;
        }

        const username = (socket as any).username || 'Guest';
        const player: Player = {
            id: socket.id,
            username,
            position: [Math.random() * 10 - 5, 2, Math.random() * 10 - 5],
            rotation: 0,
            health: 100,
            isHost: false,
            isReady: false,
            slot,
            lastActivity: Date.now()
        };

        lobby.players.set(socket.id, player);
        socketToLobby.set(socket.id, lobbyId);
        socket.join(lobbyId);

        const lobbyData = {
            id: lobby.id,
            name: lobby.name,
            players: Array.from(lobby.players.values()),
            chat: lobby.chat.slice(-50) // Last 50 messages
        };

        callback({ success: true, lobby: lobbyData });
        log('LOBBY', `SUCCESS: ${username} joined ${lobby.name} (slot ${slot})`);

        // Notify others
        socket.to(lobbyId).emit('playerJoined', player);
        io.emit('lobbyListUpdated');
    });

    // Play with Randoms (2 players max)
    socket.on('quickMatch', (callback: (result: { success: boolean; status?: string }) => void) => {
        const username = (socket as any).username || 'Anonymous';
        log('MATCH', `Quick match request from ${username} (${socket.id})`);
        log('MATCH', `Current queue: [${matchmakingQueue.join(', ')}]`);

        // Remove from queue if already there
        const queueIndex = matchmakingQueue.indexOf(socket.id);
        if (queueIndex > -1) {
            matchmakingQueue.splice(queueIndex, 1);
            log('MATCH', `Removed ${socket.id} from existing queue position`);
        }

        if (matchmakingQueue.length > 0) {
            // Match found!
            const partnerId = matchmakingQueue.shift()!;
            log('MATCH', `MATCH FOUND! ${socket.id} paired with ${partnerId}`);

            const partnerSocket = io.sockets.sockets.get(partnerId);

            if (partnerSocket) {
                // Create lobby for matched players
                const lobbyId = Math.random().toString(36).substring(2, 8).toUpperCase();
                const lobbyName = `Match ${lobbyId}`;

                const host: Player = {
                    id: partnerId,
                    username: (partnerSocket as any).username || 'Player 1',
                    position: [0, 2, 0],
                    rotation: 0,
                    health: 100,
                    isHost: true,
                    isReady: true,
                    slot: 1,
                    lastActivity: Date.now()
                };

                const joiner: Player = {
                    id: socket.id,
                    username: (socket as any).username || 'Player 2',
                    position: [1, 2, 0],
                    rotation: 0,
                    health: 100,
                    isHost: false,
                    isReady: true,
                    slot: 2,
                    lastActivity: Date.now()
                };

                const lobby: Lobby = {
                    id: lobbyId,
                    name: lobbyName,
                    hostId: partnerId,
                    players: new Map([[partnerId, host], [socket.id, joiner]]),
                    gameState: 'loading',
                    maxPlayers: 2,
                    createdAt: Date.now(),
                    chat: []
                };

                lobbies.set(lobbyId, lobby);
                socketToLobby.set(partnerId, lobbyId);
                socketToLobby.set(socket.id, lobbyId);
                partnerSocket.join(lobbyId);
                socket.join(lobbyId);

                const lobbyData = {
                    id: lobbyId,
                    name: lobbyName,
                    players: [host, joiner]
                };

                log('MATCH', `Created match lobby: ${lobbyName}`);
                log('MATCH', `Players: ${host.username} (host) vs ${joiner.username}`);

                // Send callback FIRST so client updates state
                callback({ success: true, status: 'matched' });
                log('MATCH', `Callback sent with status: matched`);

                // Small delay to ensure both clients are ready
                setTimeout(() => {
                    log('MATCH', `>>> Emitting matchFound to partner (${partnerId})`);
                    partnerSocket.emit('matchFound', lobbyData);

                    log('MATCH', `>>> Emitting matchFound to current (${socket.id})`);
                    socket.emit('matchFound', lobbyData);

                    log('MATCH', `matchFound events sent!`);
                }, 100);

                // Start game after loading delay
                log('GAME', `Scheduling gameStarted in 3.5 seconds for lobby ${lobbyId}`);
                setTimeout(() => {
                    const l = lobbies.get(lobbyId);
                    if (l) {
                        l.gameState = 'playing';
                        log('GAME', `>>> Emitting gameStarted to lobby ${lobbyId}`);
                        io.to(lobbyId).emit('gameStarted');
                        log('GAME', `gameStarted event sent to ${l.players.size} players!`);
                    } else {
                        log('ERROR', `Lobby ${lobbyId} not found when trying to start game!`);
                    }
                }, 3500);
            } else {
                // Partner disconnected
                log('MATCH', `Partner ${partnerId} disconnected, adding ${socket.id} to queue`);
                matchmakingQueue.push(socket.id);
                callback({ success: true, status: 'searching' });
            }
        } else {
            // Add to queue
            matchmakingQueue.push(socket.id);
            log('MATCH', `No match available, ${username} added to queue`);
            log('MATCH', `Queue now: [${matchmakingQueue.join(', ')}]`);
            callback({ success: true, status: 'searching' });
        }
    });

    // Cancel matchmaking
    socket.on('cancelMatch', () => {
        const index = matchmakingQueue.indexOf(socket.id);
        if (index > -1) {
            matchmakingQueue.splice(index, 1);
            log('MATCH', `${(socket as any).username} cancelled matchmaking`);
        }
    });

    // Send chat message
    socket.on('sendChat', (text: string) => {
        const lobbyId = socketToLobby.get(socket.id);
        if (!lobbyId) return;

        const lobby = lobbies.get(lobbyId);
        if (!lobby) return;

        const username = (socket as any).username || 'Guest';
        const message: ChatMessage = {
            id: generateMessageId(),
            username,
            text: text.slice(0, 200), // Limit message length
            timestamp: Date.now()
        };

        lobby.chat.push(message);
        if (lobby.chat.length > 100) {
            lobby.chat.shift(); // Keep last 100 messages
        }

        log('CHAT', `[${lobby.name}] ${username}: ${text.slice(0, 50)}${text.length > 50 ? '...' : ''}`);
        io.to(lobbyId).emit('chatMessage', message);
    });

    // Toggle ready state
    socket.on('toggleReady', () => {
        const lobbyId = socketToLobby.get(socket.id);
        if (!lobbyId) return;

        const lobby = lobbies.get(lobbyId);
        if (!lobby) return;

        const player = lobby.players.get(socket.id);
        if (player && !player.isHost) {
            player.isReady = !player.isReady;
            log('LOBBY', `${player.username} ready: ${player.isReady}`);
            io.to(lobbyId).emit('playerReady', { id: socket.id, isReady: player.isReady });
        }
    });

    // Start game (host only, 2+ players)
    socket.on('startGame', (callback: (result: { success: boolean; error?: string }) => void) => {
        const lobbyId = socketToLobby.get(socket.id);
        log('GAME', `Start game request from ${socket.id} for lobby ${lobbyId}`);

        if (!lobbyId) {
            log('GAME', `FAILED: Not in a lobby`);
            callback({ success: false, error: 'Not in a lobby' });
            return;
        }

        const lobby = lobbies.get(lobbyId);
        if (!lobby || lobby.hostId !== socket.id) {
            log('GAME', `FAILED: Not the host`);
            callback({ success: false, error: 'Not the host' });
            return;
        }

        if (lobby.players.size < 2) {
            log('GAME', `FAILED: Need at least 2 players (have ${lobby.players.size})`);
            callback({ success: false, error: 'Need at least 2 players' });
            return;
        }

        // Start loading phase
        lobby.gameState = 'loading';
        log('GAME', `${lobby.name}: Loading phase started`);
        io.to(lobbyId).emit('gameLoading');

        // After 3 seconds, start the actual game
        setTimeout(() => {
            const l = lobbies.get(lobbyId);
            if (l) {
                l.gameState = 'playing';
                log('GAME', `>>> Emitting gameStarted to ${l.name}`);
                io.to(lobbyId).emit('gameStarted');
                log('GAME', `${l.name}: Game started with ${l.players.size} players!`);
            }
        }, 3000);

        callback({ success: true });
        io.emit('lobbyListUpdated');
    });

    // Player position update
    socket.on('playerUpdate', (data: { position: [number, number, number]; rotation: number; health: number }) => {
        const lobbyId = socketToLobby.get(socket.id);
        if (!lobbyId) return;

        const lobby = lobbies.get(lobbyId);
        if (!lobby) return;

        const player = lobby.players.get(socket.id);
        if (player) {
            player.position = data.position;
            player.rotation = data.rotation;
            player.health = data.health;
            player.lastActivity = Date.now();

            const username = (socket as any).username;
            if (username && usernames.has(username)) {
                usernames.get(username)!.lastActivity = Date.now();
            }
        }

        socket.to(lobbyId).emit('playerMoved', {
            id: socket.id,
            ...data
        });
    });

    // Host syncs enemies
    socket.on('enemySync', (enemies: any[]) => {
        const lobbyId = socketToLobby.get(socket.id);
        if (!lobbyId) return;

        const lobby = lobbies.get(lobbyId);
        if (lobby && lobby.hostId === socket.id) {
            socket.to(lobbyId).emit('enemyUpdate', enemies);
        }
    });

    // Host syncs collectibles
    socket.on('collectibleSync', (collectibles: any[]) => {
        const lobbyId = socketToLobby.get(socket.id);
        if (!lobbyId) return;

        const lobby = lobbies.get(lobbyId);
        if (lobby && lobby.hostId === socket.id) {
            socket.to(lobbyId).emit('collectibleUpdate', collectibles);
        }
    });

    // Player collected item
    socket.on('itemCollected', (itemId: string) => {
        const lobbyId = socketToLobby.get(socket.id);
        if (lobbyId) {
            socket.to(lobbyId).emit('itemRemoved', itemId);
        }
    });

    // Enemy killed
    socket.on('enemyKilled', (enemyId: string) => {
        const lobbyId = socketToLobby.get(socket.id);
        if (lobbyId) {
            socket.to(lobbyId).emit('enemyDied', enemyId);
        }
    });

    // Player died - game over for everyone
    socket.on('playerDied', () => {
        const lobbyId = socketToLobby.get(socket.id);
        if (!lobbyId) return;

        const lobby = lobbies.get(lobbyId);
        if (!lobby) return;

        const player = lobby.players.get(socket.id);
        const killedPlayerName = player?.username || 'Unknown';

        log('GAME', `GAME OVER! ${killedPlayerName} died in lobby ${lobbyId}`);

        // Notify all players in lobby
        io.to(lobbyId).emit('gameOver', {
            reason: 'player_died',
            killedPlayer: killedPlayerName
        });

        // Clean up lobby
        lobby.players.forEach((_, playerId) => {
            socketToLobby.delete(playerId);
            const playerSocket = io.sockets.sockets.get(playerId);
            if (playerSocket) {
                playerSocket.leave(lobbyId);
            }
        });

        lobbies.delete(lobbyId);
        log('LOBBY', `${lobby.name} closed - game over`);
        io.emit('lobbyListUpdated');
    });

    // Leave lobby
    socket.on('leaveLobby', () => {
        log('LOBBY', `${socket.id} leaving lobby`);
        handleDisconnect(socket);
        io.emit('lobbyListUpdated');
    });

    // Disconnect
    socket.on('disconnect', () => {
        log('DISCONNECT', `Client disconnected: ${socket.id} (${(socket as any).username || 'unknown'})`);
        handleDisconnect(socket);
        socketToPing.delete(socket.id);
        logServerState();
    });

    function handleDisconnect(socket: Socket) {
        // Remove from matchmaking queue
        const queueIndex = matchmakingQueue.indexOf(socket.id);
        if (queueIndex > -1) {
            matchmakingQueue.splice(queueIndex, 1);
            log('MATCH', `Removed ${socket.id} from matchmaking queue`);
        }

        // Leave lobby
        const lobbyId = socketToLobby.get(socket.id);
        if (lobbyId) {
            const lobby = lobbies.get(lobbyId);
            if (lobby) {
                lobby.players.delete(socket.id);
                socket.to(lobbyId).emit('playerLeft', socket.id);
                log('LOBBY', `${(socket as any).username || socket.id} left ${lobby.name}`);

                if (lobby.hostId === socket.id) {
                    if (lobby.players.size > 0) {
                        const newHostId = lobby.players.keys().next().value;
                        lobby.hostId = newHostId;
                        const newHost = lobby.players.get(newHostId);
                        if (newHost) {
                            newHost.isHost = true;
                            newHost.slot = 1;
                            io.to(lobbyId).emit('newHost', newHostId);
                            log('LOBBY', `New host in ${lobby.name}: ${newHost.username}`);
                        }
                    } else {
                        lobbies.delete(lobbyId);
                        log('LOBBY', `${lobby.name} closed - empty`);
                    }
                }
            }
            socketToLobby.delete(socket.id);
            io.emit('lobbyListUpdated');
        }
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        lobbies: lobbies.size,
        players: io.sockets.sockets.size,
        queue: matchmakingQueue.length
    });
});

// List lobbies (REST endpoint)
app.get('/lobbies', (req, res) => {
    const lobbyList = Array.from(lobbies.values())
        .filter(l => l.gameState === 'waiting')
        .map(getLobbyInfo);
    res.json(lobbyList);
});

const PORT = 4001;
httpServer.listen(PORT, () => {
    console.log('');
    console.log(`${LOG_COLORS.bright}${LOG_COLORS.green}🚀 Moonward Multiplayer Server${LOG_COLORS.reset}`);
    console.log(`${LOG_COLORS.cyan}   Port: ${PORT}${LOG_COLORS.reset}`);
    console.log(`${LOG_COLORS.yellow}   Max lobbies: ${MAX_LOBBIES}${LOG_COLORS.reset}`);
    console.log(`${LOG_COLORS.yellow}   Max players/lobby: ${MAX_PLAYERS_PER_LOBBY}${LOG_COLORS.reset}`);
    console.log('');
});
