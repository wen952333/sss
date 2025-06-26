<?php
// backend/includes/Deck.php
require_once __DIR__ . '/Card.php';
require_once __DIR__ . '/config.php';

class Deck {
    private array $cards = [];

    public function __construct(bool $shuffled = true) {
        foreach (CARD_SUITS as $suit) {
            foreach (CARD_RANKS as $rank) {
                $this->cards[] = new Card($rank, $suit);
            }
        }
        if ($shuffled) {
            $this->shuffle();
        }
    }

    public function shuffle(): void {
        shuffle($this->cards);
    }

    public function deal(int $count = 1): array {
        if ($count > count($this->cards)) {
            throw new OutOfRangeException("Not enough cards in deck to deal {$count}.");
        }
        return array_splice($this->cards, 0, $count);
    }

    public function count(): int {
        return count($this->cards);
    }

    public function getCards(): array {
        return $this->cards;
    }
}
?>
