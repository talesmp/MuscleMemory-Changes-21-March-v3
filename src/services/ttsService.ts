import { GoogleGenAI } from "@google/genai";
import { FeedbackPhrases } from "./geminiService";
import { USE_PRECOMPUTED_DATA } from "../components/SetupScreen";

const audioCache: Record<string, string> = {};
let audioCtx: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let currentGainNode: GainNode | null = null;
let isSpeaking = false;
let speechIdCounter = 0;
let currentSpeechId = 0;

export const initAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.resume();
    // Unlock speech synthesis on user interaction
    const unlockUtterance = new SpeechSynthesisUtterance("");
    unlockUtterance.volume = 0;
    window.speechSynthesis.speak(unlockUtterance);
  }
  return audioCtx;
};

export const isSpeechActive = () => isSpeaking;

export const stopSpeech = () => {
  if (audioCtx && currentSource && currentGainNode) {
    const now = audioCtx.currentTime;
    currentGainNode.gain.setValueAtTime(currentGainNode.gain.value, now);
    currentGainNode.gain.linearRampToValueAtTime(0, now + 1); // 1s fade out
    
    const sourceToStop = currentSource;
    setTimeout(() => {
      try {
        sourceToStop.stop();
      } catch (e) {}
    }, 1000);
    
    currentSource = null;
    currentGainNode = null;
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  isSpeaking = false;
  currentSpeechId = ++speechIdCounter;
};

export const generateSpeech = async (text: string): Promise<string | null> => {
  if (audioCache[text]) return audioCache[text];

  const cacheKey = `tts_cache_${btoa(encodeURIComponent(text))}`;

  if (USE_PRECOMPUTED_DATA === "precomputed") {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      console.log(`[TTS Cache] ✅ Found precomputed audio for: "${text}"`);
      audioCache[text] = cached;
      return cached;
    } else {
      console.log(`[TTS Cache] ❌ No precomputed audio found for: "${text}". Will compute and save.`);
    }
  } else if (USE_PRECOMPUTED_DATA === "recalculate") {
    console.log(`[TTS Cache] 🔄 Recalculate mode active. Ignoring existing audio cache for: "${text}".`);
  } else {
    console.log(`[TTS Cache] 🌐 Online mode active. Ignoring audio cache for: "${text}".`);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Puck" },
          },
        },
      },
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      audioCache[text] = base64Audio;
      
      if (USE_PRECOMPUTED_DATA === "recalculate" || USE_PRECOMPUTED_DATA === "precomputed") {
        try {
          localStorage.setItem(cacheKey, base64Audio);
          console.log(`[TTS Cache] 💾 Saved newly computed audio for: "${text}" to localStorage.`);
        } catch (e) {
          console.warn("[TTS Cache] ⚠️ Failed to save audio to localStorage (might be full):", e);
        }
      }

      return base64Audio;
    }
  } catch (e) {
    console.error("TTS Error:", e);
  }
  return null;
};

export const prefetchPhrases = async (phrases: FeedbackPhrases) => {
  // Disabled prefetching entirely to avoid hitting the 15 RPM rate limit
  // on the Gemini free tier. All TTS will be generated on-demand and cached,
  // falling back to browser TTS if rate limited.
  return Promise.resolve();
};

export const playSpeech = async (text: string): Promise<void> => {
  if (isSpeaking) {
    console.log("[TTS] Discarding speech (already speaking):", text);
    return Promise.resolve();
  }
  isSpeaking = true;
  const mySpeechId = ++speechIdCounter;
  currentSpeechId = mySpeechId;

  return new Promise(async (resolve) => {
    const finish = () => {
      if (currentSpeechId === mySpeechId) {
        isSpeaking = false;
      }
      resolve();
    };

    try {
      const ctx = initAudioContext();
      
      // Stop currently playing audio
      if (currentSource) {
        try {
          currentSource.stop();
        } catch (e) {}
        currentSource = null;
        currentGainNode = null;
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }

      let base64 = audioCache[text];
      if (!base64) {
        base64 = (await generateSpeech(text)) || "";
      }

      if (currentSpeechId !== mySpeechId || !isSpeaking) {
        return resolve();
      }

      if (!base64) {
        // Fallback to browser TTS if Gemini TTS fails (e.g., rate limit)
        if ("speechSynthesis" in window) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 1.1;
          const voices = window.speechSynthesis.getVoices();
          const enVoice = voices.find((v) => v.lang.startsWith("en-"));
          if (enVoice) utterance.voice = enVoice;

          utterance.onend = () => finish();
          utterance.onerror = () => finish();

          window.speechSynthesis.speak(utterance);
        } else {
          finish();
        }
        return;
      }

      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      let audioBuffer: AudioBuffer;
      try {
        // Try to decode as standard audio (WAV/MP3)
        const bufferCopy = bytes.buffer.slice(0);
        audioBuffer = await ctx.decodeAudioData(bufferCopy);
      } catch (e) {
        // Fallback: Assume raw PCM 16-bit 24000Hz
        const int16Array = new Int16Array(bytes.buffer);
        audioBuffer = ctx.createBuffer(1, int16Array.length, 24000);
        const channelData = audioBuffer.getChannelData(0);
        for (let i = 0; i < int16Array.length; i++) {
          channelData[i] = int16Array[i] / 32768.0;
        }
      }

      if (currentSpeechId !== mySpeechId || !isSpeaking) {
        return resolve();
      }

      const gainNode = ctx.createGain();
      gainNode.connect(ctx.destination);
      gainNode.gain.setValueAtTime(1, ctx.currentTime);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(gainNode);
      source.onended = () => {
        if (currentSource === source) {
          currentSource = null;
          currentGainNode = null;
        }
        finish();
      };
      currentSource = source;
      currentGainNode = gainNode;
      source.start();
    } catch (err) {
      console.error("Audio play error:", err);
      finish();
    }
  });
};
