<?php
const SECRET = '十三水的密钥';
function createToken($payload) {
  return base64_encode(json_encode($payload) . '|' . SECRET);
}
function verifyToken($token) {
  $parts = explode('|', base64_decode($token));
  if (count($parts) !== 2 || $parts[1] !== SECRET) return false;
  return json_decode($parts[0], true);
}
