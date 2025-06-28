<?php
require_once '../utils/cors.php';
require_once '../db/db.php';
require_once '../utils/auth.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$roomId = $data['roomId'];
$token = $data['token'];
$cards = $data['cards'];

$user = verifyToken($token);
if (!$user || $user['roomId'] !== $roomId) die(json_encode(['success'=>false, 'code'=>401]));

$pdo = getDb();
$pdo->prepare("UPDATE players SET cards=?, submitted=1 WHERE room_id=? AND name=?")
    ->execute([json_encode($cards), $roomId, $user['name']]);

// 检查是否全部玩家都提交，则结算
$all = $pdo->query("SELECT * FROM players WHERE room_id='$roomId'")->fetchAll();
$allSubmitted = true;
foreach ($all as $p) if (!$p['submitted']) $allSubmitted = false;

if ($allSubmitted) {
  // 获取房间类型和底分
  $room = $pdo->query("SELECT * FROM rooms WHERE room_id='$roomId'")->fetch();
  $baseScore = intval($room['score'] ?? 1);
  $multiplier = ($room['type'] ?? 'normal') === 'double' ? 2 : 1;
  $mult = $baseScore * $multiplier;

  // 1. 读取所有玩家三道
  $playerData = [];
  foreach ($all as $p) {
    $c = json_decode($p['cards'], true);
    if (!is_array($c) || count($c) != 13) continue;
    $playerData[] = [
      'id' => $p['id'],
      'name' => $p['name'],
      'head' => array_slice($c,0,3),
      'middle' => array_slice($c,3,5),
      'tail' => array_slice($c,8,5),
      'special' => getSpecialType($c),
      'score' => 0,
    ];
  }
  $N = count($playerData);

  // 2. 特殊牌型判定
  $specialTypes = [];
  foreach ($playerData as $player) {
    if ($player['special']) $specialTypes[$player['name']] = $player['special'];
  }

  // 3. 计分
  for ($i = 0; $i < $N; ++$i) {
    for ($j = 0; $j < $N; ++$j) {
      if ($i === $j) continue;
      $p1 = &$playerData[$i];
      $p2 = &$playerData[$j];

      // 特殊牌型处理
      if ($p1['special'] && !$p2['special']) {
        $p1['score'] += 3 * $mult;
        continue;
      }
      if (!$p1['special'] && $p2['special']) {
        // p1输，无分
        continue;
      }
      if ($p1['special'] && $p2['special']) {
        // 同种特殊牌型才平局，否则按优先级
        $rank1 = specialTypeRank($p1['special']);
        $rank2 = specialTypeRank($p2['special']);
        if ($rank1 > $rank2) $p1['score'] += 3 * $mult;
        else if ($rank1 == $rank2) {} // 平局
        continue;
      }

      // 普通三道比牌，必须分胜负
      $areas = ['head','middle','tail'];
      $areaScore = [ 'head'=>getAreaScore($p1['head'], 'head'), 'middle'=>getAreaScore($p1['middle'], 'middle'), 'tail'=>getAreaScore($p1['tail'], 'tail') ];
      $areaScore2 = [ 'head'=>getAreaScore($p2['head'], 'head'), 'middle'=>getAreaScore($p2['middle'], 'middle'), 'tail'=>getAreaScore($p2['tail'], 'tail') ];

      $winAll = true;
      $sum = 0;
      foreach ($areas as $area) {
        $cmp = compareArea($p1[$area], $p2[$area], $area);
        if ($cmp > 0) $sum += $areaScore[$area] * $mult;
        else { $winAll = false; }
      }
      // 只有三道全胜才能得分
      if ($winAll) $p1['score'] += $sum;
    }
  }

  // 4. 写回每人得分
  foreach ($playerData as $p) {
    $pdo->prepare("UPDATE players SET result=? WHERE id=?")
        ->execute([json_encode([['name'=>$p['name'],'score'=>$p['score']]]), $p['id']]);
  }
}
echo json_encode(['success'=>true]);

// ================== 工具函数 =====================
// 特殊牌型判定
function getSpecialType($cards) {
  // 1. 一条龙（A2345678910JQK全花色不同即可）
  $vals = [];
  foreach ($cards as $c) { $parts = explode('_', $c); $vals[$parts[0]]=true; }
  $dragon = ['2','3','4','5','6','7','8','9','10','jack','queen','king','ace'];
  $isDragon = true; foreach ($dragon as $v) if (!isset($vals[$v])) $isDragon = false;
  if ($isDragon) return '一条龙';

  // 2. 六对半：有6对+1单张
  $count = [];
  foreach ($cards as $c) { $parts = explode('_', $c); $k=$parts[0]; $count[$k] = ($count[$k]??0)+1; }
  $pairs = 0; $single = 0;
  foreach ($count as $v) { if ($v==2) $pairs++; if ($v==1) $single++; if ($v==4) $pairs+=2; }
  if ($pairs==6 && $single==1) return '六对半';

  // 3. 三同花
  $suits = [[],[],[]];
  for($i=0;$i<3;$i++) $suits[0][] = explode('_',$cards[$i])[2];
  for($i=3;$i<8;$i++) $suits[1][] = explode('_',$cards[$i])[2];
  for($i=8;$i<13;$i++) $suits[2][] = explode('_',$cards[$i])[2];
  $is3Flush = count(array_unique($suits[0]))==1 && count(array_unique($suits[1]))==1 && count(array_unique($suits[2]))==1;
  $isTailStraightFlush = isStraight($cards,8,13) && (count(array_unique($suits[2]))==1);
  if ($is3Flush && !$isTailStraightFlush) return '三同花';

  // 4. 三顺子
  $is3Seq = isStraight($cards,0,3) && isStraight($cards,3,8) && isStraight($cards,8,13);
  if ($is3Seq && !$isTailStraightFlush) return '三顺子';

  return null;
}
function specialTypeRank($type) {
  // 越大越强
  switch($type) {
    case '一条龙': return 4;
    case '三同花': return 3;
    case '三顺子': return 2;
    case '六对半': return 1;
    default: return 0;
  }
}
// 区间顺子
function isStraight($cards,$start,$end) {
  $order = ['2'=>2,'3'=>3,'4'=>4,'5'=>5,'6'=>6,'7'=>7,'8'=>8,'9'=>9,'10'=>10,'jack'=>11,'queen'=>12,'king'=>13,'ace'=>14];
  $vals = [];
  for($i=$start;$i<$end;$i++) $vals[] = $order[explode('_',$cards[$i])[0]];
  sort($vals);
  if (count(array_unique($vals))!=count($vals)) return false;
  if ($vals[count($vals)-1]-$vals[0]==count($vals)-1) return true;
  // A23特殊顺
  if ($vals==[2,3,14]) return true;
  return false;
}
// 三道得分
function getAreaScore($cards,$area) {
  $type = getAreaType($cards,$area);
  if ($area=='head') {
    if ($type=="三条") return 3;
    return 1;
  }
  if ($area=='middle') {
    if ($type=="铁支") return 8;
    if ($type=="同花顺") return 10;
    if ($type=="葫芦") return 2;
    return 1;
  }
  if ($area=='tail') {
    if ($type=="铁支") return 4;
    if ($type=="同花顺") return 5;
    return 1;
  }
  return 1;
}
// 牌型
function getAreaType($cards,$area) {
  $vals = []; $suits = [];
  $order = ['2'=>2,'3'=>3,'4'=>4,'5'=>5,'6'=>6,'7'=>7,'8'=>8,'9'=>9,'10'=>10,'jack'=>11,'queen'=>12,'king'=>13,'ace'=>14];
  foreach($cards as $c){ $parts=explode('_',$c); $vals[]=$order[$parts[0]]; $suits[]=$parts[2]; }
  $cnt = array_count_values($vals);
  if ($area=='head') {
    if (max($cnt)==3) return "三条";
    if (max($cnt)==2) return "对子";
    return "高牌";
  }
  if (max($cnt)==4) return "铁支";
  if (count(array_unique($suits))==1 && isStraight2($vals)) return "同花顺";
  if (in_array(3,$cnt) && in_array(2,$cnt)) return "葫芦";
  if (count(array_unique($suits))==1) return "同花";
  if (isStraight2($vals)) return "顺子";
  if (in_array(3,$cnt)) return "三条";
  if (count(array_keys($cnt,2))==2) return "两对";
  if (in_array(2,$cnt)) return "对子";
  return "高牌";
}
function isStraight2($vals) {
  sort($vals);
  if (count(array_unique($vals))!=count($vals)) return false;
  if ($vals[count($vals)-1]-$vals[0]==count($vals)-1) return true;
  // A23特殊顺
  if ($vals==[2,3,14]) return true;
  return false;
}

// 花色权重
function suitWeight($s) {
  // spades > hearts > clubs > diamonds
  switch($s) {
    case "spades": return 4;
    case "hearts": return 3;
    case "clubs": return 2;
    case "diamonds": return 1;
    default: return 0;
  }
}

// 三道比较，必须分胜负
function compareArea($a, $b, $area) {
  $order = ['2'=>2,'3'=>3,'4'=>4,'5'=>5,'6'=>6,'7'=>7,'8'=>8,'9'=>9,'10'=>10,'jack'=>11,'queen'=>12,'king'=>13,'ace'=>14];
  $typeA = getAreaType($a, $area);
  $typeB = getAreaType($b, $area);
  $rankA = areaTypeRank($typeA, $area);
  $rankB = areaTypeRank($typeB, $area);
  if ($rankA != $rankB) return $rankA > $rankB ? 1 : -1;
  // 牌型相同，比主点数
  $mainA = mainPoint($a, $typeA, $area);
  $mainB = mainPoint($b, $typeB, $area);
  if ($mainA > $mainB) return 1;
  if ($mainA < $mainB) return -1;
  // 比花色
  $mainSuitA = mainSuit($a, $typeA, $area);
  $mainSuitB = mainSuit($b, $typeB, $area);
  if ($mainSuitA > $mainSuitB) return 1;
  if ($mainSuitA < $mainSuitB) return -1;
  // 再比副牌
  $subA = subPoints($a, $typeA, $area);
  $subB = subPoints($b, $typeB, $area);
  for ($i = 0; $i < count($subA); $i++) {
    if ($subA[$i] > $subB[$i]) return 1;
    if ($subA[$i] < $subB[$i]) return -1;
  }
  // 比副花色
  $subSuitA = subSuits($a, $typeA, $area);
  $subSuitB = subSuits($b, $typeB, $area);
  for ($i = 0; $i < count($subSuitA); $i++) {
    if ($subSuitA[$i] > $subSuitB[$i]) return 1;
    if ($subSuitA[$i] < $subSuitB[$i]) return -1;
  }
  // 理论上不会平
  return 0;
}
function areaTypeRank($type, $area) {
  if ($area=='head') {
    if ($type=="三条") return 4;
    if ($type=="对子") return 2;
    return 1;
  }
  if ($type=="铁支") return 8;
  if ($type=="同花顺") return 7;
  if ($type=="葫芦") return 6;
  if ($type=="同花") return 5;
  if ($type=="顺子") return 4;
  if ($type=="三条") return 3;
  if ($type=="两对") return 2;
  if ($type=="对子") return 1;
  return 0;
}
function mainPoint($cards, $type, $area) {
  $order = ['2'=>2,'3'=>3,'4'=>4,'5'=>5,'6'=>6,'7'=>7,'8'=>8,'9'=>9,'10'=>10,'jack'=>11,'queen'=>12,'king'=>13,'ace'=>14];
  $vals = [];
  foreach($cards as $c){ $parts=explode('_',$c); $vals[]=$order[$parts[0]]; }
  $cnt = array_count_values($vals);
  // 只考虑主牌点数
  if ($type=="三条"||$type=="铁支"||$type=="对子") {
    arsort($cnt); $k = array_keys($cnt)[0]; return $k;
  }
  if ($type=="葫芦") {
    foreach($cnt as $k=>$v) if ($v==3) return $k;
  }
  if ($type=="同花顺"||$type=="顺子") {
    rsort($vals);
    // 顺子特殊大小
    $svals = $vals;
    sort($svals);
    // 10,J,Q,K,A最大
    if ($svals==[10,11,12,13,14]) return 14.9;
    // A,2,3,4,5次之
    if ($svals==[2,3,4,5,14]) return 5.5;
    // 9,10,J,Q,K
    if ($svals==[9,10,11,12,13]) return 13;
    // 8,9,10,J,Q
    if ($svals==[8,9,10,11,12]) return 12;
    // 其它正常最大牌
    return max($vals);
  }
  return max($vals);
}
function mainSuit($cards, $type, $area) {
  // 主牌的花色
  $order = ['2'=>2,'3'=>3,'4'=>4,'5'=>5,'6'=>6,'7'=>7,'8'=>8,'9'=>9,'10'=>10,'jack'=>11,'queen'=>12,'king'=>13,'ace'=>14];
  $vals = [];
  $suits = [];
  foreach($cards as $c){ $parts=explode('_',$c); $vals[]=$order[$parts[0]]; $suits[]=$parts[2]; }
  $cnt = array_count_values($vals);
  if ($type=="三条"||$type=="铁支"||$type=="对子") {
    arsort($cnt); $main = array_keys($cnt)[0];
    // 拿主牌花色最大
    $bestSuit = 0;
    foreach($cards as $c){ $parts=explode('_',$c); if ($order[$parts[0]]==$main) $bestSuit = max($bestSuit, suitWeight($parts[2])); }
    return $bestSuit;
  }
  if ($type=="葫芦") {
    foreach($cnt as $k=>$v) if ($v==3) {
      $bestSuit = 0;
      foreach($cards as $c){ $parts=explode('_',$c); if ($order[$parts[0]]==$k) $bestSuit = max($bestSuit, suitWeight($parts[2])); }
      return $bestSuit;
    }
  }
  if ($type=="同花顺"||$type=="顺子") {
    // 最大点花色
    $maxV = mainPoint($cards,$type,$area);
    foreach($cards as $c){ $parts=explode('_',$c); if ($order[$parts[0]]==$maxV) return suitWeight($parts[2]); }
  }
  return max(array_map('suitWeight',$suits));
}
function subPoints($cards, $type, $area) {
  $order = ['2'=>2,'3'=>3,'4'=>4,'5'=>5,'6'=>6,'7'=>7,'8'=>8,'9'=>9,'10'=>10,'jack'=>11,'queen'=>12,'king'=>13,'ace'=>14];
  $vals = [];
  foreach($cards as $c){ $parts=explode('_',$c); $vals[]=$order[$parts[0]]; }
  $cnt = array_count_values($vals);
  // 副牌点
  if ($type=="三条"||$type=="铁支"||$type=="对子") {
    arsort($cnt); $main = array_keys($cnt)[0];
    $subs = [];
    foreach($vals as $v) if ($v!=$main) $subs[]=$v;
    rsort($subs);
    return $subs;
  }
  if ($type=="葫芦") {
    $main = null; $pair = null;
    foreach($cnt as $k=>$v) { if ($v==3) $main=$k; if ($v==2) $pair=$k; }
    return [$pair];
  }
  $r = $vals;
  rsort($r);
  return $r;
}
function subSuits($cards, $type, $area) {
  $order = ['2'=>2,'3'=>3,'4'=>4,'5'=>5,'6'=>6,'7'=>7,'8'=>8,'9'=>9,'10'=>10,'jack'=>11,'queen'=>12,'king'=>13,'ace'=>14];
  $vals = [];
  $suits = [];
  foreach($cards as $c){ $parts=explode('_',$c); $vals[]=$order[$parts[0]]; $suits[]=$parts[2]; }
  $cnt = array_count_values($vals);
  if ($type=="三条"||$type=="铁支"||$type=="对子") {
    arsort($cnt); $main = array_keys($cnt)[0];
    $subs = [];
    foreach($cards as $c){
      $parts=explode('_',$c);
      if ($order[$parts[0]]!=$main) $subs[]=suitWeight($parts[2]);
    }
    rsort($subs);
    return $subs;
  }
  if ($type=="葫芦") {
    $main = null; $pair = null;
    foreach($cnt as $k=>$v) { if ($v==3) $main=$k; if ($v==2) $pair=$k; }
    $best = 0;
    foreach($cards as $c){ $parts=explode('_',$c); if ($order[$parts[0]]==$pair) $best = max($best,suitWeight($parts[2])); }
    return [$best];
  }
  $out = [];
  $maxV = mainPoint($cards,$type,$area);
  foreach($cards as $c){ $parts=explode('_',$c); if ($order[$parts[0]]!=$maxV) $out[] = suitWeight($parts[2]); }
  rsort($out);
  return $out;
}
