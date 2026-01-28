/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import { Rocket, Star, Clock, Users, Home } from 'lucide-react';

interface VictoryScreenProps {
    completionTime: number; // in seconds
    onReturnToMenu: () => void;
}

export const VictoryScreen: React.FC<VictoryScreenProps> = ({ completionTime, onReturnToMenu }) => {
    const [phase, setPhase] = useState<'launch' | 'credits'>('launch');
    const [rocketY, setRocketY] = useState(50);
    const [showStars, setShowStars] = useState(false);

    // Format time as MM:SS
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Rocket launch animation
    useEffect(() => {
        const launchInterval = setInterval(() => {
            setRocketY(prev => {
                if (prev <= -20) {
                    clearInterval(launchInterval);
                    setTimeout(() => {
                        setPhase('credits');
                    }, 500);
                    return prev;
                }
                return prev - 2;
            });
        }, 50);

        setTimeout(() => setShowStars(true), 1000);

        return () => clearInterval(launchInterval);
    }, []);

    const teamMembers = [
        { nickname: 'lunchlpr', role: 'Full Stack Engineer' },
        { nickname: 'dannafla', role: 'Full Stack Engineer' },
        { nickname: 'dancylav', role: 'Full Stack Engineer' },
        { nickname: 'amareilu', role: 'Full Stack Engineer' },
    ];

    return (
        <div className="fixed inset-0 bg-black z-[100] overflow-hidden">

            {/* Stars background */}
            <div className="absolute inset-0">
                {showStars && Array.from({ length: 100 }).map((_, i) => (
                    <div
                        key={i}
                        className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 2}s`,
                            opacity: 0.3 + Math.random() * 0.7,
                        }}
                    />
                ))}
            </div>

            {/* Launch Phase */}
            {phase === 'launch' && (
                <div className="absolute inset-0 flex items-center justify-center">
                    {/* Rocket */}
                    <div
                        className="transition-all duration-100 ease-linear"
                        style={{ transform: `translateY(${rocketY}vh)` }}
                    >
                        <div className="text-center">
                            <Rocket size={120} className="text-cyan-400 mx-auto animate-pulse" style={{ transform: 'rotate(-45deg)' }} />
                            {/* Flame effect */}
                            <div className="w-8 h-16 mx-auto bg-gradient-to-b from-orange-500 via-yellow-400 to-transparent rounded-full blur-sm animate-pulse"
                                style={{ marginTop: '-20px', marginLeft: '30px' }}
                            />
                        </div>
                    </div>

                    {/* Launch text */}
                    <div className="absolute bottom-20 text-center">
                        <h2 className="text-4xl font-bold text-cyan-400 animate-pulse">
                            🚀 LAUNCHING TO SAFETY...
                        </h2>
                    </div>
                </div>
            )}

            {/* Credits Phase */}
            {phase === 'credits' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white animate-fade-in">

                    {/* Mission Complete */}
                    <div className="text-center mb-12">
                        <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-green-400 to-cyan-500 mb-4 drop-shadow-[0_0_20px_rgba(0,255,0,0.5)]">
                            MISSION COMPLETE!
                        </h1>
                        <div className="flex items-center justify-center gap-3 text-2xl text-yellow-400">
                            <Clock size={28} />
                            <span>Completion Time: <span className="font-mono font-bold">{formatTime(completionTime)}</span></span>
                        </div>
                    </div>

                    {/* Game Title */}
                    <div className="text-center mb-10">
                        <h2 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-blue-600 mb-2">
                            MOONWARD
                        </h2>
                        <h3 className="text-3xl font-light tracking-[0.2em] text-white">
                            ODYSSEY 2
                        </h3>
                    </div>

                    {/* Credits Box */}
                    <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4 backdrop-blur-md">
                        <h4 className="text-xl font-bold text-center text-cyan-400 mb-6 flex items-center justify-center gap-2">
                            <Users size={24} />
                            DEVELOPED BY TEAM WHOMEVER
                        </h4>

                        <p className="text-center text-gray-400 text-sm mb-4">
                            Full Stack Web Engineer Students • School 21
                        </p>

                        <div className="grid grid-cols-2 gap-3 mb-6">
                            {teamMembers.map((member, i) => (
                                <div key={i} className="bg-white/5 rounded-lg p-3 text-center border border-white/10">
                                    <span className="text-cyan-300 font-mono font-bold">{member.nickname}</span>
                                </div>
                            ))}
                        </div>

                        <div className="text-center text-gray-400 text-sm mb-6">
                            <p>GGJ School 21 Tashkent • 27-01-2026</p>
                        </div>

                        <div className="text-center mb-6">
                            <p className="text-lg text-yellow-400">
                                ⭐ Спасибо что прошли нашу игру! ⭐
                            </p>
                            <p className="text-gray-500 text-sm mt-2">
                                Thank you for playing our game!
                            </p>
                        </div>

                        {/* Return to Menu */}
                        <button
                            onClick={onReturnToMenu}
                            className="w-full px-6 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-cyan-500/30"
                        >
                            <Home size={24} />
                            RETURN TO MAIN MENU
                        </button>
                    </div>

                </div>
            )}

            {/* CSS Animation */}
            <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 1s ease-out forwards;
        }
      `}</style>
        </div>
    );
};
