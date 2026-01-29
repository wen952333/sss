
// AI functionality has been disabled to prevent build errors related to API keys.
export const getSuggestedHandArrangement = async (_cards: any[]) => {
  // Simulate a delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  return {
    front: [],
    middle: [],
    back: [],
    reasoning: "AI功能暂不可用 (API Key未配置)"
  };
};
