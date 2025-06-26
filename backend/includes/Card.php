<?php
// backend/includes/Card.php
require_once __DIR__ . '/config.php';

class Card {
    public string $rank; // '2'-'A'
    public string $suit; // 'C', 'D', 'H', 'S'
    public int $value;  // 用于比较的数值 RANK_VALUES[$rank]

    public function __construct(string $rank, string $suit) {
        if (!in_array($rank, CARD_RANKS) || !in_array($suit, CARD_SUITS)) {
            throw new InvalidArgumentException("Invalid card rank or suit: {$rank}{$suit}");
        }
        $this->rank = $rank;
        $this->suit = $suit;
        $this->value = RANK_VALUES[$rank];
    }

    public function toString(): string {
        return $this->rank . $this->suit;
    }

    public function getImageUrl(): string {
        $rank_map = [
            'A' => 'ace', 'K' => 'king', 'Q' => 'queen', 'J' => 'jack', 'T' => '10',
            '9' => '9', '8' => '8', '7' => '7', '6' => '6', '5' => '5', '4' => '4', '3' => '3', '2' => '2'
        ];
        $suit_name = SUIT_NAMES[$this->suit];
        $rank_name = $rank_map[$this->rank];
        return "cards/{$rank_name}_of_{$suit_name}.svg";
    }

    public static function fromString(string $cardStr): Card {
        $rank = substr($cardStr, 0, strlen($cardStr) - 1);
        $suit = substr($cardStr, -1);
        return new Card($rank, $suit);
    }
}
?>
