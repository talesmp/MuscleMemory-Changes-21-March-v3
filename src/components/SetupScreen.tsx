import React, { useState, useEffect } from "react";
import {
  EXERCISES,
  ExerciseId,
  ExerciseDefinition,
} from "../constants/exercises";
import {
  generateFeedbackPhrases,
  FeedbackPhrases,
} from "../services/geminiService";
import { analyzeVideo } from "../utils/videoProcessor";
import { Loader2, Upload, CheckCircle2, ChevronDown } from "lucide-react";
import { AppData } from "../App";

export type CacheMode = "precomputed" | "online" | "recalculate";
export let USE_PRECOMPUTED_DATA: CacheMode = "precomputed";
const CACHE_KEY = "muscle_memory_exercise_cache";

interface SetupScreenProps {
  onComplete: (data: AppData) => void;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({ onComplete }) => {
  const [videos, setVideos] = useState<
    Record<ExerciseId, { front: File | null; side: File | null }>
  >({
    split_squat: { front: null, side: null },
    pole_overhead_squat: { front: null, side: null },
    slrdl: { front: null, side: null },
  });

  const [selectedId, setSelectedId] = useState<ExerciseId>("split_squat");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const processExercise = async (id: ExerciseId, frontFile: File, sideFile: File) => {
    const exercise = EXERCISES[id];

    let calibratedExercise: ExerciseDefinition | null = null;
    let phrases: FeedbackPhrases | null = null;

      if (USE_PRECOMPUTED_DATA === "precomputed") {
        const cached = localStorage.getItem(`${CACHE_KEY}_${id}`);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed.calibrated && parsed.phrases) {
              calibratedExercise = parsed.calibrated;
              phrases = parsed.phrases;
              console.log(`[Cache] ✅ Found precomputed data for ${id}! Skipping analysis.`);
              setLoadingText(`Loaded precomputed data for ${exercise.name}...`);
            }
          } catch (e) {
            console.warn("[Cache] ⚠️ Failed to parse cached data, recalculating...", e);
          }
        } else {
          console.log(`[Cache] ❌ No precomputed data found for ${id} in localStorage. Will compute and save.`);
        }
      } else if (USE_PRECOMPUTED_DATA === "recalculate") {
        console.log(`[Cache] 🔄 Recalculate mode active. Ignoring existing cache for ${id}.`);
      } else {
        console.log(`[Cache] 🌐 Online mode active. Ignoring cache for ${id}.`);
      }

      if (!calibratedExercise || !phrases) {
        setLoadingText(`Analyzing ${exercise.name} (Front)...`);
        const frontTargets = exercise.targets.filter((t) => t.view === "front");
        const frontAngles = await analyzeVideo(frontFile, frontTargets);

        setLoadingText(`Analyzing ${exercise.name} (Side)...`);
        const sideTargets = exercise.targets.filter((t) => t.view === "side");
        const sideAngles = await analyzeVideo(sideFile, sideTargets);

        const combinedAngles = { ...frontAngles, ...sideAngles };

        calibratedExercise = {
          ...exercise,
          targets: exercise.targets.map((t) => ({
            ...t,
            targetAngle: combinedAngles[t.name] ?? t.targetAngle,
          })),
        };

        setLoadingText(`Generating AI Feedback for ${exercise.name}...`);
        phrases = await generateFeedbackPhrases(calibratedExercise);

        if (USE_PRECOMPUTED_DATA === "recalculate" || USE_PRECOMPUTED_DATA === "precomputed") {
          console.log(`[Cache] 💾 Saving newly computed data for ${id} to localStorage.`);
          localStorage.setItem(
            `${CACHE_KEY}_${id}`,
            JSON.stringify({ calibrated: calibratedExercise, phrases })
          );
        }
      }

      return {
        calibrated: calibratedExercise!,
        phrases: phrases!,
        frontVideo: frontFile,
        sideVideo: sideFile,
      };
  };

  useEffect(() => {
    let isMounted = true;
    const loadDefaultVideos = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setLoadingText("Loading default videos...");
        
        const fetchVideo = async (path: string, name: string) => {
          const res = await fetch(path);
          if (!res.ok) throw new Error(`${name} not found`);
          const blob = await res.blob();
          return new File([blob], name, { type: "video/mp4" });
        };

        const [
          ssFront, ssSide,
          posFront, posSide,
          slrdlFront, slrdlSide
        ] = await Promise.all([
          fetchVideo("/splitsquatfront.mp4", "splitsquatfront.mp4"),
          fetchVideo("/splitsquatside.mp4", "splitsquatside.mp4"),
          fetchVideo("/poleoverheadsquatfront.mp4", "poleoverheadsquatfront.mp4"),
          fetchVideo("/poleoverheadsquatside.mp4", "poleoverheadsquatside.mp4"),
          fetchVideo("/romaniandeadliftsfront.mp4", "romaniandeadliftsfront.mp4"),
          fetchVideo("/romaniandeadliftsside.mp4", "romaniandeadliftsside.mp4"),
        ]);

        if (!isMounted) return;

        setVideos({
          split_squat: { front: ssFront, side: ssSide },
          pole_overhead_squat: { front: posFront, side: posSide },
          slrdl: { front: slrdlFront, side: slrdlSide },
        });

        const appData: Partial<AppData> = {};
        appData.split_squat = await processExercise("split_squat", ssFront, ssSide);
        appData.pole_overhead_squat = await processExercise("pole_overhead_squat", posFront, posSide);
        appData.slrdl = await processExercise("slrdl", slrdlFront, slrdlSide);

        onComplete(appData as AppData);

      } catch (err: any) {
        if (isMounted) {
          console.error("Failed to load default videos:", err);
          setError("Failed to load default videos. You can upload them manually.");
          setIsLoading(false);
        }
      }
    };

    loadDefaultVideos();
    
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVideoChange = (view: "front" | "side", file: File | null) => {
    setVideos((prev) => ({
      ...prev,
      [selectedId]: { ...prev[selectedId], [view]: file },
    }));
  };

  const allVideosUploaded = (Object.keys(videos) as ExerciseId[]).every(
    (id) => videos[id].front && videos[id].side
  );

  const handleStart = async () => {
    if (!allVideosUploaded) {
      setError(
        "Please upload front and side videos for all exercises.",
      );
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const appData: Partial<AppData> = {};
      for (const id of Object.keys(videos) as ExerciseId[]) {
        appData[id] = await processExercise(id, videos[id].front!, videos[id].side!);
      }
      onComplete(appData as AppData);
    } catch (err: any) {
      setError(err.message || "Failed to process videos or generate feedback.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center h-full overflow-y-auto bg-white text-slate-900 p-6 font-sans">
      <div className="w-full space-y-8 my-auto py-8">
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tight text-slate-900 font-display">
            MuscleMemory
          </h1>
          <p className="mt-2 text-slate-500 font-medium">
            Select an exercise and upload its reference videos.
          </p>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-xl border-2 border-slate-200 bg-white shadow-sm">
            <label className="block text-sm font-bold text-slate-700 mb-2 font-display">
              Exercise
            </label>
            <div className="relative">
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value as ExerciseId)}
                className="w-full bg-slate-100 text-slate-900 py-3 px-4 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 appearance-none font-medium"
              >
                {(Object.keys(EXERCISES) as ExerciseId[]).map((id) => (
                  <option key={id} value={id}>
                    {EXERCISES[id].name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
                <ChevronDown className="w-5 h-5 text-slate-400" />
              </div>
            </div>
            <p className="text-sm text-slate-500 mt-3 font-medium">
              {EXERCISES[selectedId].description}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-xl border-2 border-slate-200 bg-white shadow-sm">
            <label className="block text-sm font-bold text-slate-700 mb-2 font-display">
              Front View Reference (Loop)
            </label>
            <div className="flex items-center gap-3">
              <label className="flex-1 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 px-4 rounded-lg text-center transition-colors flex items-center justify-center font-medium">
                <Upload className="w-4 h-4 mr-2" />
                {videos[selectedId].front
                  ? videos[selectedId].front!.name
                  : "Upload Front Video"}
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) =>
                    handleVideoChange("front", e.target.files?.[0] || null)
                  }
                />
              </label>
            </div>
          </div>

          <div className="p-4 rounded-xl border-2 border-slate-200 bg-white shadow-sm">
            <label className="block text-sm font-bold text-slate-700 mb-2 font-display">
              Side View Reference (Loop)
            </label>
            <div className="flex items-center gap-3">
              <label className="flex-1 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 px-4 rounded-lg text-center transition-colors flex items-center justify-center font-medium">
                <Upload className="w-4 h-4 mr-2" />
                {videos[selectedId].side
                  ? videos[selectedId].side!.name
                  : "Upload Side Video"}
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) =>
                    handleVideoChange("side", e.target.files?.[0] || null)
                  }
                />
              </label>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
            {error}
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={isLoading || !allVideosUploaded}
          className="w-full py-4 px-6 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed font-display text-lg tracking-wide shadow-md"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              {loadingText}
            </>
          ) : (
            "Process Exercise"
          )}
        </button>
      </div>
    </div>
  );
};
