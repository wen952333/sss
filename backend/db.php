<?php
// 数据库配置
$DB_HOST = '127.0.0.1';      // 数据库主机，建议用127.0.0.1避免socket权限问题
$DB_NAME = 'your_db_name';   // 数据库名（请替换成你实际的库名）
$DB_USER = 'your_db_user';   // 数据库用户名（请替换成你的用户名）
$DB_PASS = 'your_db_pass';   // 数据库密码（请替换成你的密码）

// PDO连接
try {
    $pdo = new PDO(
        "mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4",
        $DB_USER,
        $DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
} catch (PDOException $e) {
    // 返回标准JSON，避免前端解析错误
    header('Content-Type: application/json');
    echo json_encode([
        "ok" => false,
        "error" => "数据库连接失败：" . $e->getMessage()
    ]);
    exit;
}
?>
