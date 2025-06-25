<?php
function getUserByToken($token) {
  global $db;
  if (!$token) return null;
  $user = $db->query("SELECT * FROM users WHERE token=?", [$token])->fetch();
  return $user ?: null;
}
