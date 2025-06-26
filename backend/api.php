<?php
// backend/api.php
ini_set('display_errors', 1); // For development
error_reporting(E_ALL);

require_once __DIR__ . '/includes/config.php'; // Includes CORS headers
require_once __DIR__ . '/includes/GameState.php';
require_once __DIR__ . '/includes/Game.php';
require_once __DIR__ . '/includes/Player.php';

$action = $_GET['action'] ?? null;
$gameId = $_GET['gameId'] ?? null;
$playerId = $_GET['playerId'] ?? null; // Usually sent by client after joining/creating

$response = ['success' => false, 'message' => 'Invalid action.'];
$gameData = null;
/** @var Game|null $game */
$game = null;

if ($gameId) {
    $gameData = GameState::load($gameId);
    if ($gameData) {
        $game = Game::loadFromState($gameData);
    }
}

$input = json_decode(file_get_contents('php://input'), true);

try {
    switch ($action) {
        case 'createGame':
            $newGameId = substr(md5(uniqid(rand(), true)), 0, 6); // Simple game ID
            $playerName = $input['playerName'] ?? 'Creator';
            $creatorPlayerId = $input['playerId'] ?? uniqid('p_'); // Client should generate a persistent ID

            $game = new Game($newGameId);
            $player = new Player($creatorPlayerId, $playerName);
            $game->addPlayer($player);
            
            if (GameState::save($newGameId, $game->getState())) {
                $response = ['success' => true, 'gameId' => $newGameId, 'playerId' => $creatorPlayerId, 'gameState' => $game->getState()];
            } else {
                $response = ['success' => false, 'message' => 'Failed to save new game.'];
            }
            break;

        case 'joinGame':
            if (!$game) {
                $response = ['success' => false, 'message' => 'Game not found.'];
                break;
            }
            $playerName = $input['playerName'] ?? 'Player';
            $joinPlayerId = $input['playerId'] ?? uniqid('p_');

            if (isset($game->players[$joinPlayerId])) { // Player is rejoining
                 $response = ['success' => true, 'message' => 'Rejoined game.', 'playerId' => $joinPlayerId, 'gameState' => $game->getState()];
                 break;
            }

            $player = new Player($joinPlayerId, $playerName);
            if ($game->addPlayer($player)) {
                GameState::save($gameId, $game->getState());
                $response = ['success' => true, 'message' => 'Joined game.', 'playerId' => $joinPlayerId, 'gameState' => $game->getState()];
            } else {
                 if (count($game->players) >= ($game->maxPlayers ?? 4)) {
                     $response = ['success' => false, 'message' => 'Game is full.'];
                 } else {
                     $response = ['success' => false, 'message' => 'Failed to join game (already in or other error).'];
                 }
            }
            break;

        case 'getGameState':
            if (!$game) {
                $response = ['success' => false, 'message' => 'Game not found.'];
                break;
            }
            $response = ['success' => true, 'gameState' => $game->getState()];
            break;

        case 'startGame':
            if (!$game) { $response = ['success' => false, 'message' => 'Game not found.']; break; }
            // Optional: check if $playerId is host, or allow any player to start
            if ($game->startGame()) {
                GameState::save($gameId, $game->getState());
                $response = ['success' => true, 'message' => 'Game started.', 'gameState' => $game->getState()];
            } else {
                $response = ['success' => false, 'message' => 'Failed to start game (not enough players or wrong status).', 'gameState' => $game->getState()];
            }
            break;

        case 'submitHand':
            if (!$game) { $response = ['success' => false, 'message' => 'Game not found.']; break; }
            if (!$playerId) { $response = ['success' => false, 'message' => 'Player ID required.']; break; }
            
            $front = $input['front'] ?? []; // Expected: array of card strings e.g. ["AS", "KH", "QD"]
            $middle = $input['middle'] ?? [];
            $back = $input['back'] ?? [];

            $result = $game->submitPlayerHand($playerId, $front, $middle, $back);
            if ($result['success']) {
                GameState::save($gameId, $game->getState());
                $response = ['success' => true, 'message' => $result['message'], 'gameState' => $game->getState()];
            } else {
                $response = ['success' => false, 'message' => $result['message'], 'gameState' => $game->getState()];
            }
            break;
        
        case 'nextRound': // Reset for a new round
            if (!$game) { $response = ['success' => false, 'message' => 'Game not found.']; break; }
            if ($game->status !== 'finished_round') {
                 $response = ['success' => false, 'message' => 'Cannot start new round yet. Current status: ' . $game->status]; break;
            }
            // Reset player hands, hasSubmitted, keep scores
            foreach($game->players as $p) {
                $p->hand = [];
                $p->arrangedHands = null;
                $p->evaluatedHands = null;
                $p->hasSubmitted = false;
            }
            $game->status = 'waiting'; // Or go directly to dealing if players > min
            $game->roundResults = [];
             // Option: auto start game if enough players
            if ($game->startGame()) { // This will re-deal and set status to 'arranging'
                 GameState::save($gameId, $game->getState());
                 $response = ['success' => true, 'message' => 'New round started, cards dealt.', 'gameState' => $game->getState()];
            } else {
                 GameState::save($gameId, $game->getState());
                 $response = ['success' => true, 'message' => 'New round ready, waiting for players/start.', 'gameState' => $game->getState()];
            }
            break;

        default:
            $response = ['success' => false, 'message' => 'Unknown action: ' . htmlspecialchars($action ?? 'NULL')];
            break;
    }
} catch (Exception $e) {
    // Log error: error_log($e->getMessage() . "\n" . $e->getTraceAsString());
    $response = ['success' => false, 'message' => 'Server error: ' . $e->getMessage()];
    http_response_code(500); // Internal Server Error
}


echo json_encode($response);
?>
