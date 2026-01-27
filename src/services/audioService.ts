
import { GoogleGenAI, Modality } from "@google/genai";

// 初始化 AudioContext (必须在用户交互后才能 resume)
let audioContext: AudioContext | null = null;
let isMuted = false; // 全局静音状态

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }
  return audioContext;
};

// 切换静音
export const toggleMute = () => {
  isMuted = !isMuted;
  return isMuted;
};

export const getMuteState = () => isMuted;

// Base64 解码辅助函数
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// 音频数据解码
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * 调用 Gemini TTS 生成语音并播放
 * @param text 要说的话
 * @param voiceName 角色音色 ('Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Aoede')
 */
export const playTTS = async (text: string, voiceName: string = 'Aoede') => {
  if (isMuted) return; // 如果静音，直接返回

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("TTS Skipped: No API Key");
    return;
  }

  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (base64Audio) {
      const audioBuffer = await decodeAudioData(
        decode(base64Audio),
        ctx,
        24000,
        1,
      );
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start();
    }
  } catch (error) {
    console.error("Gemini TTS Error:", error);
  }
};
