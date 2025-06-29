<?php
function handleTimeoutsAndAutoPlay($roomId, $pdo) {
    $now = time();
    $players = $pdo->query("SELECT * FROM players WHERE room_id='$roomId'")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($players as $p) {
        // ...原有逻辑...
        if (isset($p['deal_time']) && !$p['submitted'] && strtotime($p['deal_time']) + 180 < $now) {
            $cards = json_decode($p['cards'], true);
            if (is_array($cards) && count($cards) === 13) {
                list($head, $middle, $tail) = smartSplit($cards);
                $autoCards = array_merge($head, $middle, $tail);
                $pdo->prepare("UPDATE players SET cards=?, submitted=1 WHERE id=?")
                    ->execute([json_encode($autoCards), $p['id']]);
            }
        }
    }
}

// 智能分牌（极简：不倒水+优先大牌，推荐移植前端 getSmartSplits 全算法）
function smartSplit($cards) {
    // 枚举所有合法分法，选最优
    $best = null; $bestScore = -1;
    foreach (combinations($cards, 3) as $head) {
        $left1 = array_diff($cards, $head);
        foreach (combinations($left1, 5) as $middle) {
            $tail = array_diff($left1, $middle);
            if (isFoul($head, $middle, $tail)) continue;
            $score = array_sum(array_map('cardValue', $head)) + array_sum(array_map('cardValue', $middle)) + array_sum(array_map('cardValue', $tail));
            if ($score > $bestScore) { $bestScore = $score; $best = [$head, $middle, $tail]; }
        }
    }
    if ($best) return $best;
    // 退化顺序分
    return [array_slice($cards, 0, 3), array_slice($cards, 3, 8), array_slice($cards, 8, 13)];
}

// 组合生成
function combinations($arr, $k) {
    $result = [];
    $n = count($arr);
    $indexes = range(0, $k - 1);
    while ($indexes[0] < $n - $k + 1) {
        $comb = [];
        foreach ($indexes as $i) $comb[] = $arr[$i];
        $result[] = $comb;
        // 增加下一个组合
        $t = $k - 1;
        while ($t != 0 && $indexes[$t] == $n - $k + $t) $t--;
        $indexes[$t]++;
        for ($i = $t + 1; $i < $k; $i++) $indexes[$i] = $indexes[$i - 1] + 1;
    }
    return $result;
}
function cardValue($card) {
    $v = explode('_', $card)[0];
    if ($v === 'ace') return 14;
    if ($v === 'king') return 13;
    if ($v === 'queen') return 12;
    if ($v === 'jack') return 11;
    return intval($v);
}
