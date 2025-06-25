// 用户认证
export const registerUser = async (username) => {
  const response = await fetch('https://9526.ip-ddns.com/api/user.php?action=register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username }),
  });
  return response.json();
};

// 获取可用游戏列表
export const getAvailableGames = async () => {
  const response = await fetch('https://9526.ip-ddns.com/api/game.php?action=list');
  return response.json();
};

// 其他API调用...
