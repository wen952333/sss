import { CarriageData, TableData, Card, Seat, PlayerHand, HandSubmission, TableResult } from '../types';
import { createDeck } from './deck';
import { evaluate3, evaluate5, compareHands, HandType } from './suggestions';

const STORE_KEY_CARRIAGES = 'thirteen_water_carriages_v1';
const STORE_KEY_SUBMISSIONS = 'thirteen_water_submissions_v1';

const getLaneWaterValue = (analyzed: { type: HandType, values: number[] }, segment: 'top'|'mid'|'bot'): number => {
    if (segment === 'top') return analyzed.type === HandType.THREE_OF_A_KIND ? 3 : 1;
    if (segment === 'mid') {
        if (analyzed.type === HandType.FULL_HOUSE) return 2;
        if (analyzed.type === HandType.FOUR_OF_A_KIND) return 8;
        if (analyzed.type === HandType.STRAIGHT_FLUSH) return 10;
        return 1;
    }
    if (segment === 'bot') {
        if (analyzed.type === HandType.FOUR_OF_A_KIND) return 4;
        if (analyzed.type === HandType.STRAIGHT_FLUSH) return 5;
        return 1;
    }
    return 1;
};

const checkSpecialHand = (hand: PlayerHand): { water: number, name: string } | null => {
    const all = [...hand.top, ...hand.middle, ...hand.bottom];
    const ranks = all.map(c => c.rank);
    const unique = new Set(ranks);
    if(unique.size === 13) return { water: 26, name: '至尊清龙' }; 

    const counts: Record<number, number> = {};
    ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
    let pairs = 0; let quads = 0;
    Object.values(counts).forEach(c => {
        pairs += Math.floor(c/2);
        if(c===4) quads++;
    });
    if(pairs === 6) {
        if(quads === 2) return { water: 30, name: '六对半(双四条)' };
        if(quads === 1) return { water: 14, name: '六对半(带四条)' };
        return { water: 3, name: '六对半' };
    }
    return null; 
};

const generateTable = (id: number): TableData => {
  const deck = createDeck();
  const hands: Record<Seat, Card[]> = {
    'North': deck.slice(0, 13),
    'East': deck.slice(13, 26),
    'South': deck.slice(26, 39),
    'West': deck.slice(39, 52),
  };
  return { id, hands };
};

const generateCarriages = (count: number = 20): CarriageData[] => {
  const existing = localStorage.getItem(STORE_KEY_CARRIAGES);
  if (existing) return JSON.parse(existing);

  const carriages: CarriageData[] = [];
  for (let i = 1; i <= count; i++) {
    const tables: TableData[] = [];
    for (let j = 0; j < 10; j++) {
      tables.push(generateTable(j));
    }
    carriages.push({ id: i, tables });
  }
  
  localStorage.setItem(STORE_KEY_CARRIAGES, JSON.stringify(carriages));
  return carriages;
};

let GLOBAL_CARRIAGES = generateCarriages();

export const getCarriage = (id: number): CarriageData | undefined => GLOBAL_CARRIAGES.find(c => c.id === id);

export const getPlayerSubmissions = (playerId: string): HandSubmission[] => {
    const stored = localStorage.getItem(STORE_KEY_SUBMISSIONS);
    const all = stored ? JSON.parse(stored) : [];
    return all.filter((s: any) => s.playerId === playerId).map((s: any) => ({
        carriageId: s.carriageId, tableId: s.tableId, seat: s.seat, hand: s.hand, timestamp: s.timestamp
    }));
};

export const getCarriagePlayerCount = (carriageId: number): number => {
    const stored = localStorage.getItem(STORE_KEY_SUBMISSIONS);
    const all = stored ? JSON.parse(stored) : [];
    const players = new Set<string>();
    all.filter((s: any) => s.carriageId === carriageId).forEach((s:any) => players.add(s.playerId));
    return players.size;
};

export const submitPlayerHand = (playerId: string, submission: HandSubmission) => {
    const stored = localStorage.getItem(STORE_KEY_SUBMISSIONS);
    const all = stored ? JSON.parse(stored) : [];
    const filtered = all.filter((s: any) => !(s.playerId === playerId && s.carriageId === submission.carriageId && s.tableId === submission.tableId));
    filtered.push({ ...submission, playerId, name: '我' });
    localStorage.setItem(STORE_KEY_SUBMISSIONS, JSON.stringify(filtered));
};

export const settleGame = (playerId: string): { totalScore: number, details: TableResult[], validCarriageCount: number } => {
    const stored = localStorage.getItem(STORE_KEY_SUBMISSIONS);
    let allSubs = stored ? JSON.parse(stored) : [];
    
    let totalScore = 0;
    const details: TableResult[] = [];
    const carriageSet = new Set<number>();
    
    const map: any = {};
    allSubs.forEach((s: any) => {
        if(!map[s.carriageId]) map[s.carriageId] = {};
        if(!map[s.carriageId][s.tableId]) map[s.carriageId][s.tableId] = [];
        map[s.carriageId][s.tableId].push(s);
    });

    Object.keys(map).forEach(cId => {
        const carriageId = parseInt(cId);
        Object.keys(map[cId]).forEach(tId => {
            const tableId = parseInt(tId);
            const subs: any[] = map[cId][tId];
            
            if(!subs.find((s:any) => s.playerId === playerId)) return;
            
            carriageSet.add(carriageId);
            const scores: Record<string, number> = {};
            subs.forEach((s:any) => scores[s.playerId] = 0);
            
            if (subs.length < 2) {
                 const resultDetails = subs.map((s: any) => ({
                    playerId: s.playerId,
                    name: s.name,
                    seat: s.seat,
                    hand: s.hand,
                    score: 0
                }));
                details.push({ 
                    tableId, 
                    playersInvolved: subs.map((s:any)=>s.name), 
                    scores: {[playerId]: 0}, 
                    details: resultDetails,
                    voided: true 
                });
                return;
            }
            
            const wSubs = subs.map((s:any) => ({
                ...s, 
                special: checkSpecialHand(s.hand)
            }));
            
            const matchResults: { p1: string, p2: string, w: number, isShoot: boolean }[] = [];

            for(let i=0; i<wSubs.length; i++) {
                for(let j=i+1; j<wSubs.length; j++) {
                    const p1 = wSubs[i];
                    const p2 = wSubs[j];
                    
                    if(p1.special || p2.special) {
                        let w = 0;
                        if(p1.special && p2.special) w = p1.special.water - p2.special.water;
                        else if(p1.special) w = p1.special.water;
                        else w = -p2.special.water;
                        scores[p1.playerId] += w * 2;
                        scores[p2.playerId] -= w * 2;
                    } else {
                        const p1Top = evaluate3(p1.hand.top); const p2Top = evaluate3(p2.hand.top);
                        const p1Mid = evaluate5(p1.hand.middle); const p2Mid = evaluate5(p2.hand.middle);
                        const p1Bot = evaluate5(p1.hand.bottom); const p2Bot = evaluate5(p2.hand.bottom);
                        
                        let w = 0; let p1W = 0; let p2W = 0;
                        
                        const cmp = (a:any, b:any, seg: any) => {
                             const r = compareHands(a,b);
                             if(r>0) { w += getLaneWaterValue(a, seg); p1W++; }
                             else if(r<0) { w -= getLaneWaterValue(b, seg); p2W++; }
                        };
                        cmp(p1Top, p2Top, 'top');
                        cmp(p1Mid, p2Mid, 'mid');
                        cmp(p1Bot, p2Bot, 'bot');
                        
                        let isShoot = false;
                        if(p1W===3) { w*=2; isShoot=true; }
                        if(p2W===3) { w*=2; isShoot=true; }
                        
                        matchResults.push({ p1: p1.playerId, p2: p2.playerId, w, isShoot });
                    }
                }
            }
            
            const shooterCounts: any = {};
            wSubs.forEach((s:any) => shooterCounts[s.playerId]=0);
            matchResults.forEach(m => {
                if(m.isShoot) {
                    if(m.w > 0) shooterCounts[m.p1]++;
                    else shooterCounts[m.p2]++;
                }
            });
            const activeCount = wSubs.length;
            const homeRunPid = Object.keys(shooterCounts).find(pid => shooterCounts[pid] === activeCount - 1);
            
            matchResults.forEach(m => {
                let finalW = m.w;
                if(homeRunPid) {
                    if(m.p1 === homeRunPid && m.w > 0) finalW *= 2;
                    else if(m.p2 === homeRunPid && m.w < 0) finalW *= 2;
                }
                scores[m.p1] += finalW * 2;
                scores[m.p2] -= finalW * 2;
            });

            totalScore += scores[playerId];
            
            const resultDetails = subs.map((s: any) => ({
                playerId: s.playerId,
                name: s.name,
                seat: s.seat,
                hand: s.hand,
                score: scores[s.playerId] || 0,
                specialType: wSubs.find((x:any) => x.playerId === s.playerId)?.special?.name
            }));

            details.push({ 
                tableId, 
                playersInvolved: subs.map((s:any)=>s.name), 
                scores, 
                details: resultDetails,
                voided: false 
            });
        });
    });

    return { totalScore, details, validCarriageCount: carriageSet.size };
};