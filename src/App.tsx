/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { SetupScreen } from "./components/SetupScreen";
import { HomeScreen } from "./components/HomeScreen";
import { IntroScreen } from "./components/IntroScreen";
import { ActiveScreen } from "./components/ActiveScreen";
import { ExerciseDefinition, ExerciseId } from "./constants/exercises";
import { FeedbackPhrases } from "./services/geminiService";
import { initAudioContext } from "./services/ttsService";

export type ExerciseData = {
  calibrated: ExerciseDefinition;
  phrases: FeedbackPhrases;
  frontVideo: File;
  sideVideo: File;
};

export type AppData = Record<ExerciseId, ExerciseData>;

type AppState = "setup" | "home" | "intro" | "active";

export default function App() {
  const [appState, setAppState] = useState<AppState>("setup");
  const [appData, setAppData] = useState<AppData | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] =
    useState<ExerciseId | null>(null);
  const [isTvMode, setIsTvMode] = useState(false);

  const handleSetupComplete = (data: AppData) => {
    setAppData(data);
    setAppState("home");
  };

  const handleSelectExercise = (id: ExerciseId) => {
    initAudioContext();
    setSelectedExerciseId(id);
    setAppState("intro");
  };

  const handleStartExercise = () => {
    setAppState("active");
  };

  const handleStop = () => {
    setAppState("home");
    setSelectedExerciseId(null);
    setIsTvMode(false);
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center font-sans sm:p-8 overflow-x-hidden">
      <div className={`flex items-center justify-center transition-all duration-500 ease-in-out w-full max-w-[1400px] ${isTvMode ? 'gap-8 lg:gap-12' : 'gap-0'}`}>
        <div className="w-full max-w-[430px] h-[100dvh] sm:h-[850px] sm:max-h-[90vh] bg-white text-slate-900 sm:rounded-[3rem] sm:border-[12px] border-slate-200 overflow-hidden relative shadow-2xl flex flex-col shrink-0 z-10">
        {appState === "setup" && (
          <SetupScreen onComplete={handleSetupComplete} />
        )}
        {appState === "home" && appData && (
          <HomeScreen appData={appData} onSelect={handleSelectExercise} />
        )}
        {appState === "intro" && appData && selectedExerciseId && (
          <IntroScreen
            data={appData[selectedExerciseId]}
            onComplete={handleStartExercise}
          />
        )}
        {appState === "active" && appData && selectedExerciseId && (
          <ActiveScreen
            exercise={appData[selectedExerciseId].calibrated}
            phrases={appData[selectedExerciseId].phrases}
            frontVideo={appData[selectedExerciseId].frontVideo}
            sideVideo={appData[selectedExerciseId].sideVideo}
            onStop={handleStop}
            isTvMode={isTvMode}
            onToggleTv={() => setIsTvMode(!isTvMode)}
          />
        )}
        </div>

        {/* TV Container */}
        <div
          id="tv-container"
          className={`shrink-0 transition-all duration-500 ease-in-out hidden lg:block ${
            isTvMode ? "w-[800px] h-[450px] opacity-100" : "w-0 h-[450px] opacity-0"
          }`}
        ></div>
      </div>
    </div>
  );
}
