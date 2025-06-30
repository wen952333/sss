<?php
/**
 * 超时踢人+理牌超时自动分牌+比牌后自动恢复准备+新一轮未准备踢人
 */
function handleTimeoutsAndAutoPlay($roomId, $pdo) {
    $now = time();
    $players = $pdo->query("SELECT * FROM players WHERE room_id='$roomId'")->fetchAll(PDO::FETCH_ASSOC);
    $room = $pdo->query("SELECT * FROM rooms WHERE room_id='$roomId'")->fetch(PDO::FETCH_ASSOC);

    // ======== 踢人唯一条件：准备阶段未准备45秒自动踢出 ========
    // 新一轮准备阶段或刚进房，未submitted玩家超过45秒踢出
    if ($room && $room['status'] === 'waiting') {
        // 优先用rooms表的ready_reset_time作为本轮准备阶段基准时间
        $reset = isset($room['ready_reset_time']) ? strtotime($room['ready_reset_time']) : 0;
        foreach ($players as $p) {
            // 兼容老库：没有ready_reset_time时用玩家join_time
            $baseTime = $reset ?: (isset($p['join_time']) ? strtotime($p['join_time']) : 0);
            if (!$p['submitted'] && $baseTime && $baseTime + 45 < $now) {
                $pdo->prepare("DELETE FROM players WHERE id=?")->execute([$p['id']]);
            }
        }
    }

    // 2. 4人都准备自动发牌
    if ($room && $room['status'] === 'waiting') {
        $allReady = true;
        foreach ($players as $p) {
            if (!$p['submitted']) {
                $allReady = false;
                break;
            }
        }
        if ($allReady && count($players) === 4) {
            // 发牌
            $pdo->prepare("UPDATE rooms SET status='started' WHERE room_id=?")->execute([$roomId]);
            $cards = [];
            $suits = ['clubs', 'spades', 'diamonds', 'hearts'];
            $ranks = ['2','3','4','5','6','7','8','9','10','jack','queen','king','ace'];
            foreach ($suits as $suit) foreach ($ranks as $rank) $cards[] = "{$rank}_of_{$suit}";
            shuffle($cards);
            foreach ($players as $p) {
                $hand = array_splice($cards, 0, 13);
                $pdo->prepare("UPDATE players SET cards=?, deal_time=?, submitted=0, finish_time=NULL, result=NULL WHERE id=?")
                    ->execute([json_encode($hand), date('Y-m-d H:i:s', $now), $p['id']]);
            }
        }
    }

    // 3. 理牌120秒未提交自动智能分牌（不踢人）
    if ($room && $room['status'] === 'started') {
        foreach ($players as $p) {
            if (!$p['submitted'] && isset($p['deal_time']) && strtotime($p['deal_time']) + 120 < $now) {
                $cards = json_decode($p['cards'], true);
                if (is_array($cards) && count($cards) === 13) {
                    list($head, $middle, $tail) = smartSplitNoFoul($cards);
                    $autoCards = array_merge($head, $middle, $tail);
                    $pdo->prepare("UPDATE players SET cards=?, submitted=1, finish_time=? WHERE id=?")
                        ->execute([json_encode($autoCards), date('Y-m-d H:i:s', $now), $p['id']]);
                }
            }
            // ======= 删除理牌180秒未理牌踢人的部分 =======
        }
    }

    // 4. 比牌后5秒自动恢复准备，提前关闭弹窗也可恢复
    if ($room && $room['status'] === 'started') {
        $allPlayed = true;
        $latestFinish = 0;
        foreach ($players as $p) {
            if (!$p['submitted']) $allPlayed = false;
            if ($p['finish_time']) $latestFinish = max($latestFinish, strtotime($p['finish_time']));
        }
        if ($allPlayed && count($players) === 4 && $latestFinish) {
            // 检查是否所有玩家都已关闭比牌弹窗（result为null/空），否则等5秒
            $allResultClosed = true;
            foreach ($players as $p) {
                if (!empty($p['result'])) { $allResultClosed = false; break; }
            }
            if ($allResultClosed || $now - $latestFinish >= 5) {
                // 恢复准备，重置房间
                $pdo->prepare("UPDATE rooms SET status='waiting', ready_reset_time=? WHERE room_id=?")
                    ->execute([date('Y-m-d H:i:s', $now), $roomId]);
                $pdo->prepare("UPDATE players SET submitted=0, cards=NULL, result=NULL, deal_time=NULL, finish_time=NULL, ready_reset_time=? WHERE room_id=?")
                    ->execute([date('Y-m-d H:i:s', $now), $roomId]);
            }
        }
    }

    // 5. 新一轮恢复后45秒未准备自动踢出（已合并到第1步，不再重复）
}

// ... 后续保留原有智能分牌算法 ...
// smartSplitNoFoul、handTypeScore、areaType、isFoul、combinations等函数保持不变
?>
