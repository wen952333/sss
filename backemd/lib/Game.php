<?php
class Game {
    private $id;
    private $players = [];
    private $deck = [];
    private $status = 'waiting'; // waiting, in_progress, finished
    private $currentTurn;
    private $pot = 0;
    private $winners = [];
    
    // 牌型定义
    const SPECIAL_HANDS = [
        '一条龙' => 14,
        '三同花顺' => 13,
        '三分天下' => 12,
        '全大' => 11,
        '全小' => 10,
        '凑一色' => 9,
        '四套三条' => 8,
        '五对三条' => 7,
        '六对半' => 6,
        '三顺子' => 5,
        '三同花' => 4
    ];
    
    public function __construct($gameId = null) {
        if ($gameId) {
            $this->loadGame($gameId);
        }
    }
    
    public function createGame($creatorId) {
        $this->id = uniqid('game_', true);
        $this->status = 'waiting';
        $this->addPlayer($creatorId);
        $this->save();
        return $this->id;
    }
    
    public function joinGame($userId) {
        if ($this->status !== 'waiting') {
            throw new Exception('游戏已开始，无法加入');
        }
        
        if (count($this->players) >= 4) {
            throw new Exception('游戏人数已满');
        }
        
        $this->addPlayer($userId);
        $this->save();
    }
    
    private function addPlayer($userId) {
        $player = [
            'id' => $userId,
            'name' => '玩家' . (count($this->players) + 1),
            'chips' => 1000,
            'hand' => [],
            'ready' => false,
            'submitted' => false,
            'score' => 0
        ];
        
        $this->players[] = $player;
    }
    
    public function startGame() {
        if (count($this->players) < 2) {
            throw new Exception('至少需要2名玩家才能开始游戏');
        }
        
        $this->status = 'in_progress';
        $this->initializeDeck();
        $this->dealCards();
        $this->currentTurn = $this->players[0]['id'];
        $this->save();
    }
    
    private function initializeDeck() {
        $suits = ['S', 'H', 'D', 'C']; // 黑桃,红心,方块,梅花
        $ranks = range(1, 13); // A,2-10,J,Q,K
        
        $this->deck = [];
        foreach ($suits as $suit) {
            foreach ($ranks as $rank) {
                $this->deck[] = ['suit' => $suit, 'rank' => $rank];
            }
        }
        
        shuffle($this->deck);
    }
    
    private function dealCards() {
        $playerCount = count($this->players);
        $cardsPerPlayer = 13;
        
        for ($i = 0; $i < $playerCount; $i++) {
            $this->players[$i]['hand'] = array_splice($this->deck, 0, $cardsPerPlayer);
        }
    }
    
    public function submitCards($userId, $front, $middle, $back) {
        // 验证提交的牌型
        if (count($front) !== 3 || count($middle) !== 5 || count($back) !== 5) {
            throw new Exception('牌型数量不正确');
        }
        
        // 找到玩家并更新状态
        foreach ($this->players as &$player) {
            if ($player['id'] === $userId) {
                $player['front'] = $front;
                $player['middle'] = $middle;
                $player['back'] = $back;
                $player['submitted'] = true;
                break;
            }
        }
        
        // 检查是否所有玩家都已提交
        $allSubmitted = true;
        foreach ($this->players as $player) {
            if (!$player['submitted']) {
                $allSubmitted = false;
                break;
            }
        }
        
        if ($allSubmitted) {
            $this->calculateScores();
            $this->status = 'finished';
        }
        
        $this->save();
    }
    
    private function calculateScores() {
        // 这里简化了实际十三水的计分规则
        foreach ($this->players as &$player) {
            $player['score'] = $this->evaluateHand($player['front'], $player['middle'], $player['back']);
        }
        
        // 找出最高分玩家
        $maxScore = 0;
        foreach ($this->players as $player) {
            if ($player['score'] > $maxScore) {
                $maxScore = $player['score'];
                $this->winners = [$player];
            } elseif ($player['score'] === $maxScore) {
                $this->winners[] = $player;
            }
        }
        
        // 分配底池
        $winnerCount = count($this->winners);
        $winnings = $this->pot / $winnerCount;
        
        foreach ($this->winners as &$winner) {
            $winner['chips'] += $winnings;
        }
        
        // 更新玩家筹码
        foreach ($this->players as &$player) {
            foreach ($this->winners as $winner) {
                if ($player['id'] === $winner['id']) {
                    $player['chips'] = $winner['chips'];
                }
            }
        }
    }
    
    private function evaluateHand($front, $middle, $back) {
        // 简化的牌型评估
        $score = 0;
        
        // 评估前墩
        $score += $this->evaluateSet($front);
        
        // 评估中墩
        $score += $this->evaluateSet($middle) * 2;
        
        // 评估后墩
        $score += $this->evaluateSet($back) * 3;
        
        return $score;
    }
    
    private function evaluateSet($cards) {
        // 检查是否为特殊牌型
        foreach (self::SPECIAL_HANDS as $hand => $value) {
            if ($this->isSpecialHand($cards, $hand)) {
                return $value;
            }
        }
        
        // 普通牌型评估
        return $this->evaluateNormalHand($cards);
    }
    
    private function isSpecialHand($cards, $handType) {
        // 这里简化了特殊牌型的检测逻辑
        // 实际实现需要完整的牌型检测算法
        return false;
    }
    
    private function evaluateNormalHand($cards) {
        // 简化的普通牌型计分
        $ranks = array_column($cards, 'rank');
        rsort($ranks);
        
        // 同花顺检测
        if ($this->isStraightFlush($cards)) {
            return 9;
        }
        
        // 四条检测
        if ($this->isFourOfAKind($ranks)) {
            return 8;
        }
        
        // 葫芦检测
        if ($this->isFullHouse($ranks)) {
            return 7;
        }
        
        // 同花检测
        if ($this->isFlush($cards)) {
            return 6;
        }
        
        // 顺子检测
        if ($this->isStraight($ranks)) {
            return 5;
        }
        
        // 三条检测
        if ($this->isThreeOfAKind($ranks)) {
            return 4;
        }
        
        // 两对检测
        if ($this->isTwoPair($ranks)) {
            return 3;
        }
        
        // 一对检测
        if ($this->isOnePair($ranks)) {
            return 2;
        }
        
        // 高牌
        return 1;
    }
    
    // 以下为各种牌型检测方法（简化实现）
    private function isStraightFlush($cards) {
        return $this->isFlush($cards) && $this->isStraight(array_column($cards, 'rank'));
    }
    
    private function isFourOfAKind($ranks) {
        $counts = array_count_values($ranks);
        return in_array(4, $counts);
    }
    
    private function isFullHouse($ranks) {
        $counts = array_count_values($ranks);
        return in_array(3, $counts) && in_array(2, $counts);
    }
    
    private function isFlush($cards) {
        $suits = array_column($cards, 'suit');
        return count(array_unique($suits)) === 1;
    }
    
    private function isStraight($ranks) {
        sort($ranks);
        $min = min($ranks);
        $straight = range($min, $min + count($ranks) - 1);
        return $ranks === $straight;
    }
    
    private function isThreeOfAKind($ranks) {
        $counts = array_count_values($ranks);
        return in_array(3, $counts);
    }
    
    private function isTwoPair($ranks) {
        $counts = array_count_values($ranks);
        $pairs = 0;
        foreach ($counts as $count) {
            if ($count >= 2) $pairs++;
        }
        return $pairs >= 2;
    }
    
    private function isOnePair($ranks) {
        $counts = array_count_values($ranks);
        return in_array(2, $counts);
    }
    
    public function getState() {
        return [
            'id' => $this->id,
            'status' => $this->status,
            'pot' => $this->pot,
            'currentTurn' => $this->currentTurn,
            'winners' => $this->winners
        ];
    }
    
    public function getPlayers() {
        return $this->players;
    }
    
    public static function listAvailableGames() {
        // 实际应用中应查询数据库
        return [];
    }
    
    private function save() {
        // 实际应用中应保存到数据库
    }
    
    private function loadGame($gameId) {
        // 实际应用中应从数据库加载
    }
}
?>
