import React, { useEffect, useState, useRef } from "react";
import { ExerciseData } from "../App";
import { playSpeech, initAudioContext, stopSpeech } from "../services/ttsService";
import { SkipForward } from "lucide-react";

interface IntroScreenProps {
  data: ExerciseData;
  onComplete: () => void;
}

export const IntroScreen: React.FC<IntroScreenProps> = ({
  data,
  onComplete,
}) => {
  const [frontUrl, setFrontUrl] = useState<string>("");
  const [sideUrl, setSideUrl] = useState<string>("");
  const hasStartedRef = useRef(false);
  const isSkippedRef = useRef(false);

  useEffect(() => {
    const fUrl = URL.createObjectURL(data.frontVideo);
    const sUrl = URL.createObjectURL(data.sideVideo);
    setFrontUrl(fUrl);
    setSideUrl(sUrl);

    return () => {
      URL.revokeObjectURL(fUrl);
      URL.revokeObjectURL(sUrl);
    };
  }, [data]);

  useEffect(() => {
    let isMounted = true;

    // Initialize audio and play intro
    initAudioContext();

    const playIntro = async () => {
      try {
        await playSpeech(data.phrases.intro);
        
        if (!isSkippedRef.current && isMounted) {
          await playSpeech("Please step into the frame to start tracking.");
        }
      } catch (err) {
        console.error("Intro speech failed", err);
      }
      // When speech finishes, automatically proceed
      if (!isSkippedRef.current && isMounted) {
        onComplete();
      }
    };

    playIntro();

    return () => {
      isMounted = false;
      stopSpeech();
    };
  }, [data.phrases.intro]); // Removed onComplete to prevent re-triggering on App re-renders

  const handleSkip = () => {
    isSkippedRef.current = true;
    stopSpeech();
    onComplete();
  };

  return (
    <div className="relative h-full bg-white flex flex-col items-center justify-center p-4 font-sans">
      <div className="absolute top-6 left-6 right-6 flex flex-col z-10 gap-3">
        <div className="w-full text-center">
          <div className="bg-white/80 px-3 py-1.5 rounded-full backdrop-blur-md shadow-sm border border-slate-200 inline-block max-w-full">
            <h2 className="text-xs font-bold text-slate-900 font-display tracking-wide truncate">
              {data.calibrated.name} <span className="text-slate-500 font-medium ml-1">Introduction</span>
            </h2>
          </div>
        </div>
        <div className="flex w-full justify-end">
          <button
            onClick={handleSkip}
            className="flex items-center gap-2 px-4 py-2 bg-white/80 hover:bg-slate-100 text-slate-700 font-bold rounded-full backdrop-blur-md transition-colors shadow-sm border border-slate-200"
          >
            <span>Skip</span>
            <SkipForward className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="w-full flex-1 mt-28 mb-4 flex flex-col gap-4">
        <div className="flex-1 relative rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-100 shadow-sm">
          <div className="absolute top-2 left-2 bg-white/90 px-2 py-1 rounded text-xs font-bold text-slate-700 z-10 shadow-sm">
            Front View
          </div>
          {frontUrl && (
            <video
              src={frontUrl}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              loop
              muted
              playsInline
            />
          )}
        </div>
        <div className="flex-1 relative rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-100 shadow-sm">
          <div className="absolute top-2 left-2 bg-white/90 px-2 py-1 rounded text-xs font-bold text-slate-700 z-10 shadow-sm">
            Side View
          </div>
          {sideUrl && (
            <video
              src={sideUrl}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              loop
              muted
              playsInline
            />
          )}
        </div>
      </div>

      <div className="w-full p-4 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 text-center mb-4 shadow-sm">
        <p className="text-slate-600 text-sm font-medium">
          Listen to the instructions carefully.
        </p>
      </div>
    </div>
  );
};
