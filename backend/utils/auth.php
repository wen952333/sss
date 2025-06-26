<?php
const SECRET = 'shisanshui_secret';

function createToken($payload) {
    // $payload为数组，先转json再拼接密钥
    return base64_encode(json_encode($payload) . '|' . SECRET);
}

function verifyToken($token) {
    $decoded = base64_decode($token);
    if (!$decoded) return false;
    $parts = explode('|', $decoded);
    if (count($parts) !== 2 || $parts[1] !== SECRET) return false;
    $payload = json_decode($parts[0], true);
    if (!$payload) return false;
    return $payload;
}
