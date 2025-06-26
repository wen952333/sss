<?php
// backend/includes/Game.php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Card.php';
require_once __DIR__ . '/Deck.php';
require_once __DIR__ . '/Player.php';

class Game {
    public string $id;
    public array $players = []; // array of Player objects, keyed by player ID
    public Deck $deck;
    public string $status = 'waiting'; // waiting, dealing, arranging, comparing, finished_round
    public ?string $currentPlayerId = null; // Or use for whose turn it is, if applicable
    public array $roundResults = []; // Stores comparison results for the round
    private int $maxPlayers;

    public function __construct(string $id, int $maxPlayers = 4) {
        $this->id = $id;
        $this->deck = new Deck();
        $this->maxPlayers = $maxPlayers;
    }

    public function addPlayer(Player $player): bool {
        if (count($this->players) < $this->maxPlayers && !isset($this->players[$player->id])) {
            $this->players[$player->id] = $player;
            if (count($this->players) == 1 && $this->status == 'waiting') {
                // First player could be considered host, or auto-assign currentPlayerId
            }
            return true;
        }
        return false;
    }

    public function removePlayer(string $playerId): void {
        unset($this->players[$playerId]);
         if (count($this->players) === 0) {
            // Consider deleting game state if no players left
            GameState::delete($this->id);
        }
    }

    public function startGame(): bool {
        if (count($this->players) >= 2 && $this->status === 'waiting') { // Min 2 players
            $this->status = 'dealing';
            $this->deck = new Deck(); // New shuffled deck
            foreach ($this->players as $player) {
                $player->receiveCards($this->deck->deal(13));
            }
            $this->status = 'arranging';
            $this->roundResults = [];
            return true;
        }
        return false;
    }

    public function submitPlayerHand(string $playerId, array $frontCards, array $middleCards, array $backCards): array {
        if (!isset($this->players[$playerId])) {
            return ['success' => false, 'message' => 'Player not found.'];
        }
        $player = $this->players[$playerId];
        if ($player->hasSubmitted) {
            return ['success' => false, 'message' => 'Hand already submitted.'];
        }

        // Basic validation: correct number of cards
        if (count($frontCards) !== 3 || count($middleCards) !== 5 || count($backCards) !== 5) {
            return ['success' => false, 'message' => 'Invalid card counts for hands.'];
        }

        // Check if all 13 cards are used and are unique from player's hand
        $submittedCardStrings = array_merge(
            array_map(fn($c) => is_string($c) ? $c : $c->toString(), $frontCards),
            array_map(fn($c) => is_string($c) ? $c : $c->toString(), $middleCards),
            array_map(fn($c) => is_string($c) ? $c : $c->toString(), $backCards)
        );
        sort($submittedCardStrings);

        $playerHandStrings = array_map(fn(Card $c) => $c->toString(), $player->hand);
        sort($playerHandStrings);

        if (count($submittedCardStrings) !== 13 || $submittedCardStrings !== $playerHandStrings) {
             return ['success' => false, 'message' => 'Submitted cards do not match player original hand.'];
        }
        
        // Convert to Card objects before setting
        $frontCardObjects = array_map(fn($cStr) => Card::fromString($cStr), $frontCards);
        $middleCardObjects = array_map(fn($cStr) => Card::fromString($cStr), $middleCards);
        $backCardObjects = array_map(fn($cStr) => Card::fromString($cStr), $backCards);

        $player->setArrangedHands($frontCardObjects, $middleCardObjects, $backCardObjects);
        
        // Evaluate each hand
        $evalFront = self::evaluateHand($frontCardObjects);
        $evalMiddle = self::evaluateHand($middleCardObjects);
        $evalBack = self::evaluateHand($backCardObjects);

        // Check for "倒水" (misarranged hands)
        if (self::compareSingleHands($evalFront, $evalMiddle) > 0 || self::compareSingleHands($evalMiddle, $evalBack) > 0) {
             $player->evaluatedHands = [
                'front' => $evalFront, 'middle' => $evalMiddle, 'back' => $evalBack,
                'isMisarranged' => true, 'specialType' => 'MISARRANGED'
            ];
            // Player with misarranged hand might lose automatically or get penalized
        } else {
            $player->evaluatedHands = [
                'front' => $evalFront, 'middle' => $evalMiddle, 'back' => $evalBack,
                'isMisarranged' => false,
                'specialType' => self::checkThirteenWaterSpecial($player->hand) // Check overall 13-card special
            ];
        }

        if ($this->checkAllPlayersSubmitted()) {
            $this->compareAllHands();
            $this->status = 'finished_round';
        }

        return ['success' => true, 'message' => 'Hand submitted.'];
    }

    private function checkAllPlayersSubmitted(): bool {
        if (empty($this->players)) return false;
        foreach ($this->players as $player) {
            if (!$player->hasSubmitted) {
                return false;
            }
        }
        return true;
    }

    // --- POKER HAND EVALUATION LOGIC ---
    // This is the most complex part. Needs careful implementation.

    /**
     * Evaluates a given hand of cards.
     * @param Card[] $cards
     * @return array ['type' => HAND_TYPE_STRENGTH_CONST, 'name' => 'Poker Hand Name', 'rank_values' => [card values for tie-breaking], 'display_cards' => [card strings]]
     */
    public static function evaluateHand(array $cards): array {
        // Sort cards by value descending for easier processing
        usort($cards, fn(Card $a, Card $b) => $b->value <=> $a->value);
        $values = array_map(fn(Card $c) => $c->value, $cards);
        $suits = array_map(fn(Card $c) => $c->suit, $cards);
        $cardStrings = array_map(fn(Card $c) => $c->toString(), $cards);

        $isFlush = count(array_unique($suits)) === 1;
        
        // Check for Straight (A-5 straight needs special handling)
        $isStraight = false;
        $uniqueValues = array_unique($values);
        sort($uniqueValues); // Sort ascending for straight check
        if (count($uniqueValues) >= 5) { // For 5-card hands, count == 5
            $isSeq = true;
            for ($i = 0; $i < count($uniqueValues) - 1; $i++) {
                if ($uniqueValues[$i+1] - $uniqueValues[$i] !== 1) {
                    $isSeq = false;
                    break;
                }
            }
            if ($isSeq) $isStraight = true;
            // Check for A-5 straight (A,2,3,4,5), values would be [14,2,3,4,5] -> sort to [2,3,4,5,14]
            // For A-5 straight, the Ace counts as 1 for ranking, but its actual value is 14.
            // For evaluation, we can temporarily treat Ace as 1 if it forms A-5.
            // The highest card in A-5 straight is 5.
            if (count($cards) === 5 && $uniqueValues == [2,3,4,5,14]) { // A,2,3,4,5
                $isStraight = true;
                $values = [5,4,3,2,1]; // For tie-breaking, A-5 straight ranks by its 5.
            } else {
                 // For normal straights, $values is already sorted descending by card value.
                 // For tie-breaking, we just need the highest card.
                 $values = array_map(fn(Card $c) => $c->value, $cards); // re-get original values for tie-break
            }
        }
         // If it was an A-5 straight, the $values for tie-breaking are already set.
        // Otherwise, use the original descending sorted values.
        // For straights and flushes, tie-breaking is just by high card.
        // For other hands, tie-breaking involves ranks of pairs, trips, etc.

        $valueCounts = array_count_values(array_map(fn(Card $c) => $c->value, $cards)); // Original values
        arsort($valueCounts); // Sort counts descending, then value descending

        // Default rank_values for tie-breaking: all card values, highest first
        $tieBreakValues = array_map(fn(Card $c) => $c->value, $cards); // cards are already sorted high to low

        if ($isStraight && $isFlush) {
            return ['type' => HAND_TYPE_STRENGTH['STRAIGHT_FLUSH'], 'name' => 'Straight Flush', 'rank_values' => $tieBreakValues, 'display_cards' => $cardStrings];
        }

        $fours = array_keys($valueCounts, 4);
        if (count($fours) > 0) {
            $kicker = array_values(array_diff($tieBreakValues, [$fours[0],$fours[0],$fours[0],$fours[0]]));
            return ['type' => HAND_TYPE_STRENGTH['FOUR_OF_A_KIND'], 'name' => 'Four of a Kind', 'rank_values' => [$fours[0], $kicker[0] ?? 0], 'display_cards' => $cardStrings];
        }

        $threes = array_keys($valueCounts, 3);
        $pairs = array_keys($valueCounts, 2);
        if (count($threes) > 0 && count($pairs) > 0) {
            return ['type' => HAND_TYPE_STRENGTH['FULL_HOUSE'], 'name' => 'Full House', 'rank_values' => [$threes[0], $pairs[0]], 'display_cards' => $cardStrings];
        }
        if (count($threes) > 0 && count($cards) === 3) { // Special for 3-card front hand
             return ['type' => HAND_TYPE_STRENGTH['THREE_OF_A_KIND'], 'name' => 'Three of a Kind', 'rank_values' => [$threes[0]], 'display_cards' => $cardStrings];
        }


        if ($isFlush) {
            return ['type' => HAND_TYPE_STRENGTH['FLUSH'], 'name' => 'Flush', 'rank_values' => $tieBreakValues, 'display_cards' => $cardStrings];
        }
        if ($isStraight) {
            return ['type' => HAND_TYPE_STRENGTH['STRAIGHT'], 'name' => 'Straight', 'rank_values' => $tieBreakValues, 'display_cards' => $cardStrings];
        }

        if (count($threes) > 0) { // For 5-card hand, three of a kind + 2 kickers
            $kickers = array_values(array_diff($tieBreakValues, [$threes[0],$threes[0],$threes[0]]));
            sort($kickers); $kickers = array_reverse($kickers);
            return ['type' => HAND_TYPE_STRENGTH['THREE_OF_A_KIND'], 'name' => 'Three of a Kind', 'rank_values' => array_merge([$threes[0]], $kickers), 'display_cards' => $cardStrings];
        }

        if (count($pairs) >= 2) {
            rsort($pairs); // Ensure highest pair comes first
            $kickers = array_values(array_diff($tieBreakValues, [$pairs[0],$pairs[0],$pairs[1],$pairs[1]]));
            return ['type' => HAND_TYPE_STRENGTH['TWO_PAIR'], 'name' => 'Two Pair', 'rank_values' => [$pairs[0], $pairs[1], $kickers[0] ?? 0], 'display_cards' => $cardStrings];
        }
        if (count($pairs) === 1) {
            if (count($cards) === 3) { // Front hand pair
                $kickers = array_values(array_diff($tieBreakValues, [$pairs[0], $pairs[0]]));
                return ['type' => HAND_TYPE_STRENGTH['PAIR'], 'name' => 'Pair', 'rank_values' => [$pairs[0], $kickers[0] ?? 0], 'display_cards' => $cardStrings];
            } else { // 5-card hand pair
                $kickers = array_values(array_diff($tieBreakValues, [$pairs[0], $pairs[0]]));
                sort($kickers); $kickers = array_reverse($kickers); // Sort kickers high to low
                return ['type' => HAND_TYPE_STRENGTH['PAIR'], 'name' => 'Pair', 'rank_values' => array_merge([$pairs[0]], $kickers), 'display_cards' => $cardStrings];
            }
        }
        // High card (for 3 or 5 cards)
        return ['type' => HAND_TYPE_STRENGTH['HIGH_CARD'], 'name' => 'High Card', 'rank_values' => $tieBreakValues, 'display_cards' => $cardStrings];
    }
    
    /**
     * Compares two evaluated hands.
     * @return int >0 if hand1 wins, <0 if hand2 wins, 0 if tie
     */
    public static function compareSingleHands(array $evalHand1, array $evalHand2): int {
        if ($evalHand1['type'] !== $evalHand2['type']) {
            return $evalHand1['type'] <=> $evalHand2['type'];
        }
        // Same type, compare by rank_values
        for ($i = 0; $i < count($evalHand1['rank_values']); $i++) {
            if ($evalHand1['rank_values'][$i] !== $evalHand2['rank_values'][$i]) {
                return $evalHand1['rank_values'][$i] <=> $evalHand2['rank_values'][$i];
            }
        }
        return 0; // Perfect tie
    }

    /**
     * Checks for 13-card special hands. This is complex and has many variations.
     * @param Card[] $all13Cards
     * @return string|null Name of special hand or null.
     */
    public static function checkThirteenWaterSpecial(array $all13Cards): ?string {
        if (count($all13Cards) !== 13) return null;
        usort($all13Cards, fn(Card $a, Card $b) => $b->value <=> $a->value); // Sort for consistency
        
        $values = array_map(fn(Card $c) => $c->value, $all13Cards);
        $suits = array_map(fn(Card $c) => $c->suit, $all13Cards);

        // 至尊清龙 (Royal Dragon): A-K Suited
        $isAllSameSuit = count(array_unique($suits)) === 1;
        $isAKStraight = true;
        $expectedDragonValues = range(14, 2); // A, K, Q, J, T, 9, 8, 7, 6, 5, 4, 3, 2
        $uniqueHandValues = array_unique($values);
        sort($uniqueHandValues); $uniqueHandValues = array_reverse($uniqueHandValues); // highest to lowest
        if (count($uniqueHandValues) === 13) { // Must be 13 unique values for A-K
            for ($i = 0; $i < 13; $i++) {
                if ($uniqueHandValues[$i] !== $expectedDragonValues[$i]) {
                    $isAKStraight = false;
                    break;
                }
            }
        } else {
            $isAKStraight = false;
        }

        if ($isAKStraight && $isAllSameSuit) {
            return 'ROYAL_DRAGON';
        }
        // 一条龙 (Dragon): A-K
        if ($isAKStraight) {
            return 'DRAGON';
        }

        // 六对半 (Six Pairs Plus): 6 pairs and 1 kicker
        $valueCounts = array_count_values($values);
        $numPairs = 0;
        foreach ($valueCounts as $count) {
            if ($count === 2) $numPairs++;
        }
        if ($numPairs === 6) {
            return 'SIX_PAIRS_PLUS';
        }
        
        // TODO: Add more special hands: 三同花, 三顺子, 五对三条 etc.
        // These require evaluating the chosen front/middle/back hands,
        // so this function might be better placed after hand arrangement or might need the arranged hands.
        // For now, these are simple 13-card pattern checks.

        return null;
    }

    public function compareAllHands(): void {
        $this->roundResults = ['comparisons' => [], 'scores' => [], 'special_bonuses' => []];
        $playerIds = array_keys($this->players);
        $numPlayers = count($playerIds);

        // Initialize scores for this round
        foreach ($playerIds as $pid) {
            $this->roundResults['scores'][$pid] = 0;
            $this->roundResults['special_bonuses'][$pid] = 0; // For 13-card specials
             // Check for 13-card special hand type and assign base points
            $specialType = $this->players[$pid]->evaluatedHands['specialType'] ?? null;
            if ($specialType) {
                // Example: Royal Dragon gets a large bonus
                if ($specialType === 'ROYAL_DRAGON') $this->roundResults['special_bonuses'][$pid] += 26; // e.g., 13*2
                if ($specialType === 'DRAGON') $this->roundResults['special_bonuses'][$pid] += 13;
                if ($specialType === 'SIX_PAIRS_PLUS') $this->roundResults['special_bonuses'][$pid] += 3;
                // Add other special hand bonuses
            }
        }
        
        // Pairwise comparisons
        for ($i = 0; $i < $numPlayers; $i++) {
            for ($j = $i + 1; $j < $numPlayers; $j++) {
                $p1Id = $playerIds[$i];
                $p2Id = $playerIds[$j];
                $player1 = $this->players[$p1Id];
                $player2 = $this->players[$p2Id];

                $p1ScoreThisMatch = 0;
                $p2ScoreThisMatch = 0;
                
                $isP1Misarranged = $player1->evaluatedHands['isMisarranged'] ?? false;
                $isP2Misarranged = $player2->evaluatedHands['isMisarranged'] ?? false;

                $comparisonKey = "{$p1Id}_vs_{$p2Id}";
                $this->roundResults['comparisons'][$comparisonKey] = [];

                if ($isP1Misarranged && $isP2Misarranged) { // Both misarranged - draw, or specific rule
                    // Usually both lose to non-misarranged players, but against each other can be a wash.
                    // For simplicity, let's say no points exchanged if both misarranged.
                    // Or, if game rules state, they both lose max points to everyone else.
                } elseif ($isP1Misarranged) {
                    $p2ScoreThisMatch += 3; // P2 wins all 3 hands by default (打枪)
                    // Potentially more if "打枪" has bonus points
                     $this->roundResults['comparisons'][$comparisonKey]['misarranged'] = $p1Id;
                } elseif ($isP2Misarranged) {
                    $p1ScoreThisMatch += 3; // P1 wins all 3 hands
                     $this->roundResults['comparisons'][$comparisonKey]['misarranged'] = $p2Id;
                } else {
                    // Normal comparison if neither is misarranged
                    $p1Hands = $player1->evaluatedHands;
                    $p2Hands = $player2->evaluatedHands;
                    $p1SegWins = 0;
                    $p2SegWins = 0;

                    foreach (HAND_SEGMENTS as $segment) { // 'front', 'middle', 'back'
                        $res = self::compareSingleHands($p1Hands[$segment], $p2Hands[$segment]);
                        if ($res > 0) {
                            $p1ScoreThisMatch++;
                            $p1SegWins++;
                            $this->roundResults['comparisons'][$comparisonKey][$segment] = $p1Id;
                        } elseif ($res < 0) {
                            $p2ScoreThisMatch++;
                            $p2SegWins++;
                             $this->roundResults['comparisons'][$comparisonKey][$segment] = $p2Id;
                        } else {
                             $this->roundResults['comparisons'][$comparisonKey][$segment] = 'tie';
                        }
                    }
                    // Check for 打枪 (sweeping one opponent)
                    if ($p1SegWins === 3) $p1ScoreThisMatch *= 2; // Double points for打枪 (e.g., 3 becomes 6)
                    if ($p2SegWins === 3) $p2ScoreThisMatch *= 2;
                }
                
                $this->roundResults['scores'][$p1Id] += $p1ScoreThisMatch;
                $this->roundResults['scores'][$p1Id] -= $p2ScoreThisMatch; // Net score
                $this->roundResults['scores'][$p2Id] += $p2ScoreThisMatch;
                $this->roundResults['scores'][$p2Id] -= $p1ScoreThisMatch; // Net score
            }
        }
        
        // Add special bonuses to final scores for the round
        foreach ($playerIds as $pid) {
            $this->roundResults['scores'][$pid] += $this->roundResults['special_bonuses'][$pid];
            $this->players[$pid]->score += $this->roundResults['scores'][$pid]; // Update total score
        }
        $this->status = 'finished_round';
    }


    public function getState(): array {
        return [
            'id' => $this->id,
            'players' => array_map(fn(Player $p) => $p->toArray(), array_values($this->players)), // Send as array of players
            'status' => $this->status,
            'maxPlayers' => $this->maxPlayers,
            'roundResults' => $this->roundResults,
            // 'deckCount' => $this->deck->count(), // For debug
        ];
    }

    public static function loadFromState(array $stateData): Game {
        $game = new Game($stateData['id'], $stateData['maxPlayers'] ?? 4);
        $game->status = $stateData['status'];
        $game->roundResults = $stateData['roundResults'] ?? [];

        foreach ($stateData['players'] as $playerData) {
            $player = new Player($playerData['id'], $playerData['name']);
            $player->score = $playerData['score'];
            $player->hasSubmitted = $playerData['hasSubmitted'];
            
            if (!empty($playerData['hand'])) {
                $player->hand = array_map(fn($cardStr) => Card::fromString($cardStr), $playerData['hand']);
            }
            if (!empty($playerData['arrangedHands'])) {
                 $player->arrangedHands = [
                    'front' => array_map(fn($cStr) => Card::fromString($cStr), $playerData['arrangedHands']['front']),
                    'middle' => array_map(fn($cStr) => Card::fromString($cStr), $playerData['arrangedHands']['middle']),
                    'back' => array_map(fn($cStr) => Card::fromString($cStr), $playerData['arrangedHands']['back']),
                ];
            }
            if (!empty($playerData['evaluatedHands'])) {
                $player->evaluatedHands = $playerData['evaluatedHands'];
            }
            $game->players[$player->id] = $player;
        }
        return $game;
    }
}
?>
