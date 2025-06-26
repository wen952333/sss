<?php
// backend/includes/GameState.php
class GameState {
    private static string $gamesDir = __DIR__ . '/../games/';

    public static function save(string $gameId, array $data): bool {
        if (!is_dir(self::$gamesDir)) {
            mkdir(self::$gamesDir, 0775, true);
        }
        $filePath = self::$gamesDir . $gameId . '.json';
        return file_put_contents($filePath, json_encode($data, JSON_PRETTY_PRINT)) !== false;
    }

    public static function load(string $gameId): ?array {
        $filePath = self::$gamesDir . $gameId . '.json';
        if (file_exists($filePath)) {
            $content = file_get_contents($filePath);
            return json_decode($content, true);
        }
        return null;
    }

    public static function delete(string $gameId): bool {
         $filePath = self::$gamesDir . $gameId . '.json';
         if (file_exists($filePath)) {
             return unlink($filePath);
         }
         return false;
    }
}
?>
