<?php
function getDb() {
  static $pdo;
  if ($pdo) return $pdo;
  $pdo = new PDO('sqlite:../db/game.db');
  initDb($pdo);
  return $pdo;
}

function initDb($pdo) {
  $pdo->exec("CREATE TABLE IF NOT EXISTS rooms (
    room_id TEXT PRIMARY KEY,
    status TEXT
  )");
  $pdo->exec("CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT,
    name TEXT,
    is_owner INTEGER DEFAULT 0,
    cards TEXT,
    submitted INTEGER DEFAULT 0,
    result TEXT
  )");
}
