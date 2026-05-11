import React from "react";
import { EXERCISES, ExerciseId } from "../constants/exercises";
import { AppData } from "../App";
import { Play, Home, Dumbbell, History, User } from "lucide-react";

interface HomeScreenProps {
  appData: AppData;
  onSelect: (id: ExerciseId) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  appData,
  onSelect,
}) => {
  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-900 font-sans">
      <div className="flex-1 overflow-y-auto p-6 pb-24">
        <div className="w-full max-w-md mx-auto space-y-8 py-8">
          <div className="text-center">
            <h1 className="text-4xl font-black tracking-tight text-slate-900 font-display">
              Select Exercise
            </h1>
            <p className="mt-2 text-slate-500 font-medium">
              Choose a calibrated exercise to begin.
            </p>
          </div>

          <div className="space-y-4">
            {(Object.keys(appData) as ExerciseId[]).map((id) => {
              const exercise = EXERCISES[id];
              return (
                <button
                  key={id}
                  onClick={() => onSelect(id)}
                  className="w-full p-6 rounded-2xl border-2 border-slate-200 bg-white hover:border-orange-500 hover:bg-orange-50 transition-all text-left group flex items-center justify-between shadow-sm"
                >
                  <div className="pr-4">
                    <h3 className="text-xl font-bold text-slate-900 group-hover:text-orange-600 transition-colors font-display">
                      {exercise.name}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1 font-medium">
                      {exercise.description}
                    </p>
                  </div>
                  <div className="w-10 h-10 shrink-0 rounded-full bg-orange-50 border-2 border-orange-200 group-hover:bg-orange-500 group-hover:border-orange-500 flex items-center justify-center transition-colors">
                    <Play className="w-4 h-4 text-orange-400 group-hover:text-white ml-0.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Navigation Bar */}
      <div className="bg-white border-t border-slate-200 px-8 py-4 flex justify-between items-center shrink-0">
        <button className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors">
          <Home className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-orange-500">
          <Dumbbell className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Workouts</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors">
          <History className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-wider">History</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors">
          <User className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Profile</span>
        </button>
      </div>
    </div>
  );
};
