<?php
/**
 * 统一自动超时踢人和理牌工具
 * 用法: require_once '_timeout_helper.php'; handleTimeoutsAndAutoPlay($roomId, $pdo);
 * 要求players表有 join_time, deal_time, finish_time 字段，cards字段存13张，submitted字段标记是否已理牌
 */
function handleTimeoutsAndAutoPlay($roomId, $pdo) {
    $now = time();
    $players = $pdo->query("SELECT * FROM players WHERE room_id='$roomId'")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($players as $p) {
        // 1. 未准备超时踢出（入场超45秒、局后未准备超45秒）
        if (!$p['submitted'] && isset($p['join_time']) && strtotime($p['join_time']) + 45 < $now) {
            $pdo->prepare("DELETE FROM players WHERE id=?")->execute([$p['id']]);
            continue;
        }
        if ($p['submitted'] && isset($p['finish_time']) && strtotime($p['finish_time']) + 45 < $now) {
            $pdo->prepare("DELETE FROM players WHERE id=?")->execute([$p['id']]);
            continue;
        }
        // 2. 理牌超时自动提交（发牌后180秒未理牌，使用智能分牌）
        if (isset($p['deal_time']) && !$p['submitted'] && strtotime($p['deal_time']) + 180 < $now) {
            $cards = json_decode($p['cards'], true);
            if (is_array($cards) && count($cards) === 13) {
                list($head, $middle, $tail) = smartSplitNoFoul($cards);
                $autoCards = array_merge($head, $middle, $tail);
                $pdo->prepare("UPDATE players SET cards=?, submitted=1 WHERE id=?")
                    ->execute([json_encode($autoCards), $p['id']]);
            }
        }
    }
}

/**
 * 智能分牌（不倒水，点数较高，性能友好）
 * 返回 [head, middle, tail]，每个为数组
 */
function smartSplitNoFoul($cards13) {
    // 枚举所有头道3张组合，挑选中尾道不倒水且总点数最高
    $combs = combinations($cards13, 3);
    $best = null;
    $bestScore = -1;
    foreach ($combs as $head) {
        $left = array_diff($cards13, $head);
        foreach (combinations($left, 5) as $middle) {
            $tail = array_diff($left, $middle);
            if (count($tail) !== 5) continue;
            if (isFoul($head, $middle, $tail)) continue;
            $score = array_sum(array_map('cardValue', $head))
                   + array_sum(array_map('cardValue', $middle))
                   + array_sum(array_map('cardValue', $tail));
            if ($score > $bestScore) {
                $bestScore = $score;
                $best = [$head, $middle, $tail];
            }
        }
    }
    if ($best) return $best;
    // 所有分法都倒水，退化为顺序分
    return [
        array_slice($cards13, 0, 3),
        array_slice($cards13, 3, 8),
        array_slice($cards13, 8, 13)
    ];
}

/** 判断是否倒水 */
function isFoul($head, $middle, $tail) {
    $headRank = areaTypeRank(areaType($head, 'head'), 'head');
    $midRank = areaTypeRank(areaType($middle, 'middle'), 'middle');
    $tailRank = areaTypeRank(areaType($tail, 'tail'), 'tail');
    return !($headRank <= $midRank && $midRank <= $tailRank);
}
/** 牌型分数（和前端一致，简化版） */
function areaType($cards, $area) {
    $vals = array_map(function($c){return explode('_',$c)[0];}, $cards);
    $suits = array_map(function($c){return explode('_',$c)[2];}, $cards);
    $uniqVals = array_unique($vals);
    $uniqSuits = array_unique($suits);
    if (count($cards) == 3) {
        if (count($uniqVals) == 1) return "三条";
        if (count($uniqVals) == 2) return "对子";
        return "高牌";
    }
    if (count($uniqSuits) == 1 && isStraight($vals)) return "同花顺";
    if (countDuplicates($vals, 4)) return "铁支";
    if (countDuplicates($vals, 3) && countDuplicates($vals, 2)) return "葫芦";
    if (count($uniqSuits) == 1) return "同花";
    if (isStraight($vals)) return "顺子";
    if (countDuplicates($vals, 3)) return "三条";
    if (countDuplicates($vals, 2) == 2) return "两对";
    if (countDuplicates($vals, 2)) return "对子";
    return "高牌";
}
function areaTypeRank($type, $area) {
    if ($area == 'head') {
        if ($type == "三条") return 4;
        if ($type == "对子") return 2;
        return 1;
    }
    $rank = [
        "同花顺"=>9, "铁支"=>8, "葫芦"=>7, "同花"=>6, "顺子"=>5,
        "三条"=>4, "两对"=>3, "对子"=>2, "高牌"=>1
    ];
    return $rank[$type] ?? 1;
}
function isStraight($vals) {
    $order = ['2'=>2,'3'=>3,'4'=>4,'5'=>5,'6'=>6,'7'=>7,'8'=>8,'9'=>9,'10'=>10,'jack'=>11,'queen'=>12,'king'=>13,'ace'=>14];
    $nums = array_map(function($v)use($order){return $order[$v];}, $vals);
    sort($nums);
    $uniq = array_values(array_unique($nums));
    if (count($uniq) != count($nums)) return false;
    if ($uniq[count($uniq)-1]-$uniq[0] == count($uniq)-1) return true;
    if ($uniq == [2,3,4,5,14]) return true;
    return false;
}
function countDuplicates($arr, $n) {
    $vals = array_count_values($arr);
    $cnt = 0;
    foreach ($vals as $v) if ($v == $n) $cnt++;
    return $cnt;
}

/** 生成所有 n 选 k 的组合，结果为二维数组 */
function combinations($arr, $k) {
    $ret = [];
    $n = count($arr);
    if ($k > $n) return [];
    $indexes = range(0, $k - 1);
    while (true) {
        $comb = [];
        foreach ($indexes as $i) $comb[] = $arr[$i];
        $ret[] = $comb;
        // 找下一个组合
        for ($i = $k - 1; $i >= 0; $i--) {
            if ($indexes[$i] != $i + $n - $k) break;
        }
        if ($i < 0) break;
        $indexes[$i]++;
        for ($j = $i + 1; $j < $k; $j++) {
            $indexes[$j] = $indexes[$j - 1] + 1;
        }
    }
    return $ret;
}
function cardValue($card) {
    $v = explode('_', $card)[0];
    if ($v === 'ace') return 14;
    if ($v === 'king') return 13;
    if ($v === 'queen') return 12;
    if ($v === 'jack') return 11;
    return intval($v);
}
