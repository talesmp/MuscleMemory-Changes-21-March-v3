import { useEffect, useRef, useState } from "react";
import { LandmarkList } from "@mediapipe/pose";
import { ExerciseDefinition } from "../constants/exercises";
import { FeedbackPhrases } from "../services/geminiService";
import { playSpeech, isSpeechActive } from "../services/ttsService";
import { calculateAngle, calculateAccuracy } from "../utils/geometry";

export type FormState = "green" | "yellow" | "red" | "lost";

interface UseFeedbackEngineReturn {
  formState: FormState;
  currentFeedback: string | null;
}

/**
 * @brief Evaluates landmarks against targets, manages TTS cooldown, and returns form state.
 * @return Current form state (color) and the latest feedback string.
 */
export const useFeedbackEngine = (
  landmarks: LandmarkList | null,
  exercise: ExerciseDefinition | null,
  phrases: FeedbackPhrases | null,
  isActive: boolean,
): UseFeedbackEngineReturn => {
  const [formState, setFormState] = useState<FormState>("green");
  const [currentFeedback, setCurrentFeedback] = useState<string | null>(null);
  const lastSpeechTime = useRef<number>(0);

  useEffect(() => {
    if (!isActive || !exercise || !phrases) return;

    if (!landmarks || landmarks.length === 0) {
      setFormState("lost");
      speak("Please step back into the frame.", true);
      return;
    }

    let minAccuracy = 100;
    let worstTarget = null;
    let isLost = false;

    // Evaluate all targets
    for (const target of exercise.targets) {
      const [iA, iB, iC] = target.landmarks;
      const lA = landmarks[iA];
      const lB = landmarks[iB];
      const lC = landmarks[iC];

      // Check confidence
      if (
        !lA ||
        lA.visibility === undefined ||
        lA.visibility < 0.5 ||
        !lB ||
        lB.visibility === undefined ||
        lB.visibility < 0.5 ||
        !lC ||
        lC.visibility === undefined ||
        lC.visibility < 0.5
      ) {
        isLost = true;
        break;
      }

      const angle = calculateAngle(lA, lB, lC);
      const accuracy = calculateAccuracy(
        angle,
        target.targetAngle,
        target.acceptableDeviation,
      );

      // Prioritize safety over action/setup if accuracy is low
      const weight = target.priority === "safety" ? 1.5 : 1.0;
      const weightedAccuracy = Math.max(0, 100 - (100 - accuracy) * weight);

      if (weightedAccuracy < minAccuracy) {
        minAccuracy = weightedAccuracy;
        worstTarget = target;
      }
    }

    if (isLost) {
      setFormState("lost");
      speak("Please step back into the frame.", true);
      return;
    }

    let newState: FormState = "green";
    if (minAccuracy < 75) {
      newState = "red";
    } else if (minAccuracy < 90) {
      newState = "yellow";
    }

    setFormState(newState);

    // Trigger TTS based on state and cooldown
    if (newState === "red" && worstTarget) {
      const phraseList = phrases[worstTarget.priority] || phrases.action;
      const phrase = phraseList[Math.floor(Math.random() * phraseList.length)];
      speak(phrase);
    } else if (newState === "green" && minAccuracy > 95) {
      // Occasional praise
      if (Math.random() > 0.8) {
        const phrase =
          phrases.praise[Math.floor(Math.random() * phrases.praise.length)];
        speak(phrase);
      }
    }
  }, [landmarks, exercise, phrases, isActive]);

  const speak = (text: string, isLostMsg = false) => {
    const now = Date.now();
    // 5-second cooldown for normal feedback, 3-second for lost message
    const cooldown = isLostMsg ? 3000 : 5000;
    
    if (now - lastSpeechTime.current < cooldown) {
      return;
    }

    if (isSpeechActive()) {
      return;
    }

    console.log("[TTS] Speaking:", text);
    playSpeech(text);
    lastSpeechTime.current = now;
    setCurrentFeedback(text);
  };

  return { formState, currentFeedback };
};
