
import { useState, useRef, useCallback, useEffect } from 'react';
import { GamePhase, GameState, Seat } from '../types';

export interface ServerSeat {
    carriage_id: number;
    seat: Seat;
    user_id: number;
    nickname: string;
    game_round?: number; 
}

export const useSeats = (phase: GamePhase) => {
    const [occupiedSeats, setOccupiedSeats] = useState<ServerSeat[]>([]);
    const pollingRef = useRef<number | null>(null);

    const fetchSeats = useCallback(async () => {
        try {
            const res = await fetch('/api/game/seat');
            if (res.ok) {
              const data = await res.json() as any;
              if (data.seats) setOccupiedSeats(data.seats);
            }
        } catch (e) {
            console.error("Polling error", e);
        }
    }, []);

    useEffect(() => {
        if (phase === GamePhase.LOBBY || phase === GamePhase.PLAYING) {
            fetchSeats(); 
            pollingRef.current = window.setInterval(fetchSeats, 2000); 
        } else {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        }
        return () => { 
            if (pollingRef.current) clearInterval(pollingRef.current); 
        };
    }, [phase, fetchSeats]);

    return { occupiedSeats, fetchSeats, setOccupiedSeats };
};
