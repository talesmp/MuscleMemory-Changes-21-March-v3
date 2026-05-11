import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { ExerciseDefinition } from "../constants/exercises";
import { FeedbackPhrases } from "../services/geminiService";
import { useShadowTrainer } from "../hooks/useShadowTrainer";
import { useFeedbackEngine } from "../hooks/useFeedbackEngine";
import { playSpeech, initAudioContext, stopSpeech } from "../services/ttsService";
import { Camera, StopCircle, ZoomIn, ZoomOut } from "lucide-react";

const VideoPlayIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
    <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
  </svg>
);

const TvPairingIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="15" x="2" y="7" rx="2" ry="2"/>
    <polyline points="17 2 12 7 7 2"/>
    <path d="M 13 14.5 V 12 A 2 2 0 0 0 11 10 H 8 A 2 2 0 0 0 6 12 V 14 A 2 2 0 0 0 8 16 H 10" />
    <path d="M 11 14.5 V 17 A 2 2 0 0 0 13 19 H 16 A 2 2 0 0 0 18 17 V 15 A 2 2 0 0 0 16 13 H 14" />
  </svg>
);

const RecIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M16 7L22 4V12L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="5.5" cy="19" r="1.5" fill="currentColor" />
    <text x="8.5" y="21" fontSize="6.5" fontWeight="900" fill="currentColor" stroke="none" fontFamily="sans-serif">REC</text>
  </svg>
);

interface ActiveScreenProps {
  exercise: ExerciseDefinition;
  phrases: FeedbackPhrases;
  frontVideo: File;
  sideVideo: File;
  onStop: () => void;
  isTvMode: boolean;
  onToggleTv: () => void;
}

export const ActiveScreen: React.FC<ActiveScreenProps> = ({
  exercise,
  phrases,
  frontVideo,
  sideVideo,
  onStop,
  isTvMode,
  onToggleTv,
}) => {
  const [stage, setStage] = useState<"positioning" | "countdown" | "active">(
    "positioning",
  );
  const [countdown, setCountdown] = useState(3);
  const [showReferenceVideos, setShowReferenceVideos] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [frontUrl, setFrontUrl] = useState<string>("");
  const [isTvZoomedIn, setIsTvZoomedIn] = useState(false);

  const handleToggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 1000);
    } else {
      setIsRecording(true);
    }
  };
  const [sideUrl, setSideUrl] = useState<string>("");
  const tvVideoRef = useRef<HTMLVideoElement>(null);
  const tvFrontVideoRef = useRef<HTMLVideoElement>(null);
  const tvSideVideoRef = useRef<HTMLVideoElement>(null);
  const overlayFrontVideoRef = useRef<HTMLVideoElement>(null);
  const overlaySideVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const fUrl = URL.createObjectURL(frontVideo);
    const sUrl = URL.createObjectURL(sideVideo);
    setFrontUrl(fUrl);
    setSideUrl(sUrl);

    return () => {
      URL.revokeObjectURL(fUrl);
      URL.revokeObjectURL(sUrl);
    };
  }, [frontVideo, sideVideo]);

  const toggleReferenceVideos = () => {
    if (!showReferenceVideos) {
      stopSpeech();
      setShowReferenceVideos(true);
    } else {
      setShowReferenceVideos(false);
      setStage("positioning");
      setCountdown(3);
    }
  };

  const {
    webcamVideoRef,
    frontVideoRef,
    sideVideoRef,
    canvasRef,
    userLandmarks,
    isReady,
    error,
  } = useShadowTrainer(true, frontVideo, sideVideo, stage, exercise.id);

  useEffect(() => {
    const front = frontVideoRef.current;
    const side = sideVideoRef.current;

    const syncFront = () => {
      if (!front) return;
      const ct = front.currentTime;
      if (overlayFrontVideoRef.current && Math.abs(overlayFrontVideoRef.current.currentTime - ct) > 0.1) {
        overlayFrontVideoRef.current.currentTime = ct;
      }
      if (tvFrontVideoRef.current && Math.abs(tvFrontVideoRef.current.currentTime - ct) > 0.1) {
        tvFrontVideoRef.current.currentTime = ct;
      }
    };

    const syncSide = () => {
      if (!side) return;
      const ct = side.currentTime;
      if (overlaySideVideoRef.current && Math.abs(overlaySideVideoRef.current.currentTime - ct) > 0.1) {
        overlaySideVideoRef.current.currentTime = ct;
      }
      if (tvSideVideoRef.current && Math.abs(tvSideVideoRef.current.currentTime - ct) > 0.1) {
        tvSideVideoRef.current.currentTime = ct;
      }
    };

    const playFront = () => {
      overlayFrontVideoRef.current?.play().catch(() => {});
      tvFrontVideoRef.current?.play().catch(() => {});
    };
    const pauseFront = () => {
      overlayFrontVideoRef.current?.pause();
      tvFrontVideoRef.current?.pause();
    };

    const playSide = () => {
      overlaySideVideoRef.current?.play().catch(() => {});
      tvSideVideoRef.current?.play().catch(() => {});
    };
    const pauseSide = () => {
      overlaySideVideoRef.current?.pause();
      tvSideVideoRef.current?.pause();
    };

    if (front) {
      front.addEventListener("timeupdate", syncFront);
      front.addEventListener("play", playFront);
      front.addEventListener("pause", pauseFront);
      
      // Initial sync
      syncFront();
      if (!front.paused) playFront();
    }
    if (side) {
      side.addEventListener("timeupdate", syncSide);
      side.addEventListener("play", playSide);
      side.addEventListener("pause", pauseSide);
      
      // Initial sync
      syncSide();
      if (!side.paused) playSide();
    }

    return () => {
      if (front) {
        front.removeEventListener("timeupdate", syncFront);
        front.removeEventListener("play", playFront);
        front.removeEventListener("pause", pauseFront);
      }
      if (side) {
        side.removeEventListener("timeupdate", syncSide);
        side.removeEventListener("play", playSide);
        side.removeEventListener("pause", pauseSide);
      }
    };
  }, [frontVideoRef.current, sideVideoRef.current, showReferenceVideos, isTvMode]);

  useEffect(() => {
    if (isTvMode && canvasRef.current && tvVideoRef.current) {
      try {
        const stream = canvasRef.current.captureStream(30);
        tvVideoRef.current.srcObject = stream;
      } catch (e) {
        console.error("Failed to capture canvas stream", e);
      }
    }
  }, [isTvMode, canvasRef.current]);

  // Only activate feedback engine when in 'active' stage
  const { formState, currentFeedback } = useFeedbackEngine(
    userLandmarks,
    exercise,
    phrases,
    stage === "active" && !showReferenceVideos,
  );

  // Check if all required landmarks are visible
  const [isFullyVisible, setIsFullyVisible] = useState(false);

  useEffect(() => {
    initAudioContext();
  }, []);

  useEffect(() => {
    if (!userLandmarks || userLandmarks.length === 0) {
      setIsFullyVisible(false);
      return;
    }

    const requiredIndices = new Set<number>();
    exercise.targets.forEach((t) =>
      t.landmarks.forEach((idx) => requiredIndices.add(idx)),
    );

    const visible = Array.from(requiredIndices).every((idx) => {
      const l = userLandmarks[idx];
      return l && l.visibility !== undefined && l.visibility > 0.85;
    });

    setIsFullyVisible(visible);
  }, [userLandmarks, exercise]);

  // Handle stage transitions and countdown
  useEffect(() => {
    if (showReferenceVideos) return;

    if (stage === "positioning") {
      if (isFullyVisible) {
        setStage("countdown");
      }
    } else if (stage === "countdown") {
      if (!isFullyVisible) {
        // Abort countdown if user steps out of frame
        setStage("positioning");
        setCountdown(3);
        return;
      }

      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setStage("active");
        // Speak setup phrase
        const phrase =
          phrases.setup[Math.floor(Math.random() * phrases.setup.length)];
        playSpeech(phrase);
      }
    }
  }, [stage, countdown, isFullyVisible, phrases]);

  // Determine border color
  const getBorderColor = () => {
    if (stage !== "active") return "border-slate-200";
    switch (formState) {
      case "green":
        return "border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]";
      case "yellow":
        return "border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.3)]";
      case "red":
        return "border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]";
      case "lost":
        return "border-slate-400 border-dashed";
      default:
        return "border-slate-200";
    }
  };

  return (
    <div className="relative h-full bg-white flex flex-col items-center justify-center p-4 font-sans">
      {/* Header */}
      <div className="absolute top-6 left-6 right-6 flex flex-col z-10 gap-3">
        <div className="w-full text-center">
          <div className="bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-md shadow-sm border border-white/10 inline-block max-w-full">
            <h2 className="text-xs font-bold text-white font-display tracking-wide truncate">{exercise.name}</h2>
          </div>
        </div>
        <div className="flex w-full justify-between">
          <button
            onClick={toggleReferenceVideos}
            title="Reference Videos"
            className={`p-3 rounded-full transition-colors backdrop-blur-md shadow-sm border ${
              showReferenceVideos
                ? "bg-orange-500 text-white border-orange-600"
                : "bg-white/80 hover:bg-slate-100 text-slate-700 border-slate-200"
            }`}
          >
            <VideoPlayIcon className="w-6 h-6" />
          </button>
          <button
            onClick={onToggleTv}
            title="Cast to TV"
            className={`p-3 rounded-full transition-colors backdrop-blur-md shadow-sm border ${
              isTvMode
                ? "bg-orange-500 text-white border-orange-600"
                : "bg-white/80 hover:bg-slate-100 text-slate-700 border-slate-200"
            }`}
          >
            <TvPairingIcon className="w-6 h-6" />
          </button>
          <button
            onClick={handleToggleRecording}
            title="Record Exercise"
            className={`p-3 rounded-full transition-colors backdrop-blur-md shadow-sm border ${
              isRecording
                ? "bg-red-500 text-white border-red-600"
                : "bg-white/80 hover:bg-slate-100 text-slate-700 border-slate-200"
            }`}
          >
            <RecIcon className="w-6 h-6" />
          </button>
          <button
            onClick={onStop}
            className="p-3 bg-white/80 hover:bg-slate-100 text-slate-900 rounded-full transition-colors backdrop-blur-md shadow-sm border border-slate-200"
          >
            <StopCircle className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Video Container */}
      <div
        className={`relative w-full flex-1 mt-28 mb-4 rounded-2xl overflow-hidden border-4 transition-all duration-300 bg-slate-100 shadow-inner ${getBorderColor()}`}
      >
        {isRecording && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500/80 backdrop-blur-sm text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 z-50 animate-pulse">
            <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
            <span className="text-sm font-bold tracking-wide whitespace-nowrap">Recording in progress...</span>
          </div>
        )}
        {showSavedToast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-800/90 backdrop-blur-sm text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 z-50">
            <span className="text-sm font-bold tracking-wide whitespace-nowrap">Recording saved!</span>
          </div>
        )}

        {/* Hidden video elements for MediaPipe processing */}
        <video
          ref={webcamVideoRef}
          className="absolute opacity-0 pointer-events-none w-1 h-1"
          playsInline
          muted
          autoPlay
          preload="auto"
        />
        <video
          ref={frontVideoRef}
          className="absolute opacity-0 pointer-events-none w-1 h-1"
          playsInline
          muted
          preload="auto"
        />
        <video
          ref={sideVideoRef}
          className="absolute opacity-0 pointer-events-none w-1 h-1"
          playsInline
          muted
          preload="auto"
        />

        {/* Canvas for rendering webcam and skeletons */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Overlays */}
        {!isReady && (
          <div className="absolute inset-0 bg-slate-100 flex flex-col items-center justify-center text-slate-500 z-10">
            <Camera className="w-12 h-12 mb-4 animate-pulse text-orange-500" />
            <p className="font-medium">Initializing Camera & AI Model...</p>
          </div>
        )}

        {isReady && stage === "positioning" && (
          <div className="absolute inset-0 bg-white/40 flex flex-col items-center justify-center text-slate-900 text-center p-6 backdrop-blur-sm">
            <h3 className="text-2xl font-black mb-2 font-display">Step into the Frame</h3>
            <p className="text-slate-600 max-w-md font-medium mb-4">
              Position your entire body in the frame. The countdown will start
              automatically when all required joints are clearly visible.
            </p>
            <div className="bg-slate-900/10 px-4 py-2 rounded-full">
              <p className="text-sm text-slate-700 font-bold">
                Position camera at 45° angle
              </p>
            </div>
          </div>
        )}

        {stage === "countdown" && (
          <div className="absolute inset-0 bg-white/40 flex items-center justify-center z-10 backdrop-blur-sm">
            <span className="text-9xl font-black text-orange-500 drop-shadow-md animate-pulse font-display">
              {countdown > 0 ? countdown : "GO!"}
            </span>
          </div>
        )}

        {stage === "active" && formState === "lost" && (
          <div className="absolute inset-0 bg-white/40 flex items-center justify-center text-slate-900 backdrop-blur-sm">
            <h3 className="text-2xl font-black text-center font-display">
              Tracking Lost
              <br />
              <span className="text-lg text-slate-600 font-medium font-sans">
                Please step back into the frame
              </span>
            </h3>
          </div>
        )}

        {/* Reference Videos Overlay */}
        {showReferenceVideos && (
          <div className="absolute inset-0 z-30 bg-white flex flex-col gap-2 p-2">
            <div className="flex-1 relative rounded-xl overflow-hidden bg-slate-100 border-2 border-slate-200">
              <div className="absolute top-2 left-2 bg-white/90 px-2 py-1 rounded text-xs font-bold text-slate-700 z-10 shadow-sm">
                Front View
              </div>
              {frontUrl && (
                <video
                  ref={overlayFrontVideoRef}
                  src={frontUrl}
                  className="absolute inset-0 w-full h-full object-cover"
                  muted
                  playsInline
                />
              )}
            </div>
            <div className="flex-1 relative rounded-xl overflow-hidden bg-slate-100 border-2 border-slate-200">
              <div className="absolute top-2 left-2 bg-white/90 px-2 py-1 rounded text-xs font-bold text-slate-700 z-10 shadow-sm">
                Side View
              </div>
              {sideUrl && (
                <video
                  ref={overlaySideVideoRef}
                  src={sideUrl}
                  className="absolute inset-0 w-full h-full object-cover"
                  muted
                  playsInline
                />
              )}
            </div>
          </div>
        )}

        {/* TV Portal */}
        {isTvMode && document.getElementById("tv-container") && createPortal(
          <div className="w-full h-full bg-black rounded-[2rem] border-[16px] border-black shadow-2xl overflow-hidden flex flex-row relative">
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-1.5 bg-slate-800 rounded-full z-20"></div>
            
            {/* Live Tracking */}
            <div className="w-1/3 shrink-0 border-r border-slate-800 relative bg-black transition-all duration-300">
              <video
                ref={tvVideoRef}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay
                muted
                playsInline
              />
              <div className="absolute top-3 left-3 bg-black/40 px-2.5 py-1 rounded-lg text-white text-xs font-bold backdrop-blur-md border border-white/10 z-10 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                Live Tracking
              </div>
            </div>

            {/* Reference Videos */}
            <div className={`flex-1 flex ${isTvZoomedIn ? 'flex-row' : 'flex-col'} relative bg-black transition-all duration-300`}>
              {/* Front View */}
              <div className={`flex-1 relative ${isTvZoomedIn ? 'border-r border-slate-800' : 'border-b border-slate-800'}`}>
                {frontUrl && (
                  <video
                    ref={tvFrontVideoRef}
                    src={frontUrl}
                    className={`absolute inset-0 w-full h-full ${isTvZoomedIn ? 'object-cover' : 'object-contain'}`}
                    muted
                    playsInline
                  />
                )}
                <div className="absolute top-3 left-3 bg-black/40 px-2.5 py-1 rounded-lg text-white text-xs font-bold backdrop-blur-md border border-white/10 z-10">
                  Front View
                </div>
                {!isTvZoomedIn && (
                  <button 
                    onClick={() => setIsTvZoomedIn(true)}
                    className="absolute top-3 right-3 bg-black/40 hover:bg-black/60 p-1.5 rounded-lg text-white backdrop-blur-md border border-white/10 z-10 transition-colors cursor-pointer"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Side View */}
              <div className="flex-1 relative">
                {sideUrl && (
                  <video
                    ref={tvSideVideoRef}
                    src={sideUrl}
                    className={`absolute inset-0 w-full h-full ${isTvZoomedIn ? 'object-cover' : 'object-contain'}`}
                    muted
                    playsInline
                  />
                )}
                <div className="absolute top-3 left-3 bg-black/40 px-2.5 py-1 rounded-lg text-white text-xs font-bold backdrop-blur-md border border-white/10 z-10">
                  Side View
                </div>
                {isTvZoomedIn && (
                  <button 
                    onClick={() => setIsTvZoomedIn(false)}
                    className="absolute top-3 right-3 bg-black/40 hover:bg-black/60 p-1.5 rounded-lg text-white backdrop-blur-md border border-white/10 z-10 transition-colors cursor-pointer"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.getElementById("tv-container")!
        )}
      </div>

      {error && (
        <div className="absolute bottom-6 left-6 right-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-center font-medium shadow-sm">
          {error}
        </div>
      )}
    </div>
  );
};
