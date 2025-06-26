<?php
function getDb() {
  static $pdo;
  if ($pdo) return $pdo;
  $pdo = new PDO(
    'mysql:host=localhost;dbname=shisanshui;charset=utf8mb4', // 数据库名shisanshui举例
    '你的用户名',
    '你的密码'
  );
  return $pdo;
}
