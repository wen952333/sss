<?php
ini_set('display_errors', 0);
error_reporting(0);

header("Access-Control-Allow-Origin: https://ss.wenge.ip-ddns.com");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Credentials: true");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}
