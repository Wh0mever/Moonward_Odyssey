import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Types
interface Player {
    id: string;
    username: string;
    position: [number, number, number];
    rotation: number;
    health: number;
    isHost: boolean;
    lastActivity: number;
}

interface Lobby {
    id: string;
    hostId: string;
    players: Map<string, Player>;
    gameState: 'waiting' | 'playing' | 'finished';
    maxPlayers: number;
    createdAt: number;
}

// State
const lobbies = new Map<string, Lobby>();
const usernames = new Map<string, { socketId: string; lastActivity: number }>();
const socketToLobby = new Map<string, string>();
const matchmakingQueue: string[] = [];

const MAX_LOBBIES = 20;
const MAX_PLAYERS_PER_LOBBY = 4;
const USERNAME_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Cleanup inactive usernames
setInterval(() => {
    const now = Date.now();
    usernames.forEach((data, username) => {
        if (now - data.lastActivity > USERNAME_TIMEOUT) {
            console.log(`Username ${username} released due to inactivity`);
            usernames.delete(username);
        }
    });
}, 60000);

// Generate lobby ID
function generateLobbyId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Register username
    socket.on('register', (username: string, callback: (result: { success: boolean; error?: string }) => void) => {
        // Check if username is taken
        const existing = usernames.get(username);
        if (existing && existing.socketId !== socket.id) {
            const timeSince = Date.now() - existing.lastActivity;
            if (timeSince < USERNAME_TIMEOUT) {
                callback({ success: false, error: 'Username taken' });
                return;
            }
        }

        usernames.set(username, { socketId: socket.id, lastActivity: Date.now() });
        (socket as any).username = username;
        callback({ success: true });
        console.log(`Username registered: ${username}`);
    });

    // Create lobby
    socket.on('createLobby', (callback: (result: { success: boolean; lobbyId?: string; error?: string }) => void) => {
        if (lobbies.size >= MAX_LOBBIES) {
            callback({ success: false, error: 'Max lobbies reached' });
            return;
        }

        const lobbyId = generateLobbyId();
        const username = (socket as any).username || 'Guest';

        const player: Player = {
            id: socket.id,
            username,
            position: [0, 2, 0],
            rotation: 0,
            health: 100,
            isHost: true,
            lastActivity: Date.now()
        };

        const lobby: Lobby = {
            id: lobbyId,
            hostId: socket.id,
            players: new Map([[socket.id, player]]),
            gameState: 'waiting',
            maxPlayers: MAX_PLAYERS_PER_LOBBY,
            createdAt: Date.now()
        };

        lobbies.set(lobbyId, lobby);
        socketToLobby.set(socket.id, lobbyId);
        socket.join(lobbyId);

        callback({ success: true, lobbyId });
        console.log(`Lobby created: ${lobbyId} by ${username}`);
    });

    // Join lobby
    socket.on('joinLobby', (lobbyId: string, callback: (result: { success: boolean; players?: any[]; error?: string }) => void) => {
        const lobby = lobbies.get(lobbyId);

        if (!lobby) {
            callback({ success: false, error: 'Lobby not found' });
            return;
        }

        if (lobby.players.size >= lobby.maxPlayers) {
            callback({ success: false, error: 'Lobby is full' });
            return;
        }

        if (lobby.gameState !== 'waiting') {
            callback({ success: false, error: 'Game already started' });
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
            lastActivity: Date.now()
        };

        lobby.players.set(socket.id, player);
        socketToLobby.set(socket.id, lobbyId);
        socket.join(lobbyId);

        const players = Array.from(lobby.players.values());
        callback({ success: true, players });

        // Notify others
        socket.to(lobbyId).emit('playerJoined', player);
        console.log(`${username} joined lobby ${lobbyId}`);
    });

    // Quick match
    socket.on('quickMatch', (callback: (result: { success: boolean; lobbyId?: string; waiting?: boolean }) => void) => {
        // Remove from queue if already there
        const queueIndex = matchmakingQueue.indexOf(socket.id);
        if (queueIndex > -1) {
            matchmakingQueue.splice(queueIndex, 1);
        }

        if (matchmakingQueue.length > 0) {
            // Match with waiting player
            const partnerId = matchmakingQueue.shift()!;
            const partnerSocket = io.sockets.sockets.get(partnerId);

            if (partnerSocket) {
                // Create lobby for both
                const lobbyId = generateLobbyId();

                const host: Player = {
                    id: partnerId,
                    username: (partnerSocket as any).username || 'Guest',
                    position: [0, 2, 0],
                    rotation: 0,
                    health: 100,
                    isHost: true,
                    lastActivity: Date.now()
                };

                const joiner: Player = {
                    id: socket.id,
                    username: (socket as any).username || 'Guest',
                    position: [5, 2, 0],
                    rotation: 0,
                    health: 100,
                    isHost: false,
                    lastActivity: Date.now()
                };

                const lobby: Lobby = {
                    id: lobbyId,
                    hostId: partnerId,
                    players: new Map([[partnerId, host], [socket.id, joiner]]),
                    gameState: 'waiting',
                    maxPlayers: MAX_PLAYERS_PER_LOBBY,
                    createdAt: Date.now()
                };

                lobbies.set(lobbyId, lobby);
                socketToLobby.set(partnerId, lobbyId);
                socketToLobby.set(socket.id, lobbyId);
                partnerSocket.join(lobbyId);
                socket.join(lobbyId);

                // Notify both
                partnerSocket.emit('matchFound', { lobbyId, players: [host, joiner] });
                callback({ success: true, lobbyId });
                console.log(`Quick match: ${host.username} + ${joiner.username} -> ${lobbyId}`);
            } else {
                // Partner disconnected, add to queue
                matchmakingQueue.push(socket.id);
                callback({ success: true, waiting: true });
            }
        } else {
            // Add to queue
            matchmakingQueue.push(socket.id);
            callback({ success: true, waiting: true });
            console.log(`${(socket as any).username} waiting for match`);
        }
    });

    // Cancel matchmaking
    socket.on('cancelMatch', () => {
        const index = matchmakingQueue.indexOf(socket.id);
        if (index > -1) {
            matchmakingQueue.splice(index, 1);
        }
    });

    // Start game (host only)
    socket.on('startGame', (callback: (result: { success: boolean; error?: string }) => void) => {
        const lobbyId = socketToLobby.get(socket.id);
        if (!lobbyId) {
            callback({ success: false, error: 'Not in a lobby' });
            return;
        }

        const lobby = lobbies.get(lobbyId);
        if (!lobby || lobby.hostId !== socket.id) {
            callback({ success: false, error: 'Not the host' });
            return;
        }

        lobby.gameState = 'playing';
        io.to(lobbyId).emit('gameStarted');
        callback({ success: true });
        console.log(`Game started in lobby ${lobbyId}`);
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

            // Update username activity
            const username = (socket as any).username;
            if (username && usernames.has(username)) {
                usernames.get(username)!.lastActivity = Date.now();
            }
        }

        // Broadcast to others in lobby
        socket.to(lobbyId).emit('playerMoved', {
            id: socket.id,
            ...data
        });
    });

    // Sync enemies
    socket.on('enemySync', (enemies: any[]) => {
        const lobbyId = socketToLobby.get(socket.id);
        if (!lobbyId) return;

        const lobby = lobbies.get(lobbyId);
        if (lobby && lobby.hostId === socket.id) {
            socket.to(lobbyId).emit('enemyUpdate', enemies);
        }
    });

    // Sync collectibles
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

    // Leave lobby
    socket.on('leaveLobby', () => {
        handleDisconnect(socket);
    });

    // Disconnect
    socket.on('disconnect', () => {
        handleDisconnect(socket);
        console.log(`Client disconnected: ${socket.id}`);
    });

    function handleDisconnect(socket: Socket) {
        // Remove from matchmaking queue
        const queueIndex = matchmakingQueue.indexOf(socket.id);
        if (queueIndex > -1) {
            matchmakingQueue.splice(queueIndex, 1);
        }

        // Leave lobby
        const lobbyId = socketToLobby.get(socket.id);
        if (lobbyId) {
            const lobby = lobbies.get(lobbyId);
            if (lobby) {
                lobby.players.delete(socket.id);
                socket.to(lobbyId).emit('playerLeft', socket.id);

                // If host left, assign new host or close lobby
                if (lobby.hostId === socket.id) {
                    if (lobby.players.size > 0) {
                        const newHostId = lobby.players.keys().next().value;
                        lobby.hostId = newHostId;
                        const newHost = lobby.players.get(newHostId);
                        if (newHost) {
                            newHost.isHost = true;
                            io.to(lobbyId).emit('newHost', newHostId);
                        }
                    } else {
                        lobbies.delete(lobbyId);
                        console.log(`Lobby ${lobbyId} closed - empty`);
                    }
                }
            }
            socketToLobby.delete(socket.id);
        }
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        lobbies: lobbies.size,
        players: io.sockets.sockets.size,
        queue: matchmakingQueue.length
    });
});

// List lobbies (for debugging)
app.get('/lobbies', (req, res) => {
    const lobbyList = Array.from(lobbies.values()).map(l => ({
        id: l.id,
        players: l.players.size,
        state: l.gameState
    }));
    res.json(lobbyList);
});

const PORT = 4001;
httpServer.listen(PORT, () => {
    console.log(`🚀 Multiplayer server running on port ${PORT}`);
});
