<?php
require_once 'config.php';

function db() {
  static $conn;
  if (!$conn) {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    $conn->set_charset('utf8mb4');
  }
  if ($conn->connect_errno) die("DB Error");
  return $conn;
}

function query($sql, $params = [], $multi = false) {
  $stmt = db()->prepare($sql);
  if ($params) {
    $types = str_repeat('s', count($params));
    $stmt->bind_param($types, ...$params);
  }
  $stmt->execute();
  $res = $stmt->get_result();
  if ($multi) return $res->fetch_all(MYSQLI_ASSOC);
  return $res->fetch_assoc();
}

function execute($sql, $params = []) {
  $stmt = db()->prepare($sql);
  if ($params) {
    $types = str_repeat('s', count($params));
    $stmt->bind_param($types, ...$params);
  }
  return $stmt->execute();
}
?>
