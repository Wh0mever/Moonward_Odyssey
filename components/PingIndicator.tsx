import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { multiplayerService } from '../services/multiplayerService';

interface PingIndicatorProps {
    className?: string;
}

export const PingIndicator: React.FC<PingIndicatorProps> = ({ className = '' }) => {
    const [ping, setPing] = useState(0);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const unsubscribe = multiplayerService.onLobbyChange((state) => {
            setPing(state.ping);
            setIsConnected(state.isConnected);
        });

        // Initial state
        const state = multiplayerService.getState();
        setPing(state.ping);
        setIsConnected(state.isConnected);

        return () => unsubscribe();
    }, []);

    if (!isConnected) {
        return null;
    }

    // Get color based on ping
    const getColor = () => {
        if (ping < 50) return 'text-green-400 bg-green-500/20';
        if (ping < 100) return 'text-yellow-400 bg-yellow-500/20';
        return 'text-red-400 bg-red-500/20';
    };

    return (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10 ${getColor()} ${className}`}>
            <Wifi size={14} />
            <span className="font-mono text-sm font-medium">{ping}ms</span>
        </div>
    );
};
