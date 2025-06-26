<?php
// backend/includes/Player.php
require_once __DIR__ . '/Card.php';

class Player {
    public string $id;
    public string $name;
    public array $hand = []; // Array of Card objects
    public ?array $arrangedHands = null; // ['front' => [Card,...], 'middle' => [Card,...], 'back' => [Card,...]]
    public ?array $evaluatedHands = null; // ['front' => ['type', 'rank_values', 'score'], ...]
    public int $score = 0;
    public bool $hasSubmitted = false;

    public function __construct(string $id, string $name = "Player") {
        $this->id = $id;
        $this->name = $name ?: "Player " . substr($id, 0, 4);
    }

    public function receiveCards(array $cards): void {
        $this->hand = $cards;
        $this->hasSubmitted = false;
        $this->arrangedHands = null;
        $this->evaluatedHands = null;
    }

    public function setArrangedHands(array $front, array $middle, array $back): void {
        // Convert card strings to Card objects if needed (e.g. from API)
        $this->arrangedHands = [
            'front' => array_map(fn($c) => is_string($c) ? Card::fromString($c) : $c, $front),
            'middle' => array_map(fn($c) => is_string($c) ? Card::fromString($c) : $c, $middle),
            'back' => array_map(fn($c) => is_string($c) ? Card::fromString($c) : $c, $back),
        ];
        $this->hasSubmitted = true;
    }

    public function toArray(): array {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'hand' => array_map(fn(Card $card) => $card->toString(), $this->hand),
            'arrangedHands' => $this->arrangedHands ? [
                'front' => array_map(fn(Card $card) => $card->toString(), $this->arrangedHands['front']),
                'middle' => array_map(fn(Card $card) => $card->toString(), $this->arrangedHands['middle']),
                'back' => array_map(fn(Card $card) => $card->toString(), $this->arrangedHands['back']),
            ] : null,
            'evaluatedHands' => $this->evaluatedHands, // This will contain type and score
            'score' => $this->score,
            'hasSubmitted' => $this->hasSubmitted,
        ];
    }
}
?>
