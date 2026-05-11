import { GoogleGenAI, Type } from "@google/genai";
import { ExerciseDefinition } from "../constants/exercises";

export interface FeedbackPhrases {
  intro: string;
  setup: string[];
  action: string[];
  safety: string[];
  praise: string[];
}

/**
 * @brief Generates varied textual feedback phrases using Gemini API.
 * @param exercise The calibrated exercise definition.
 * @return Promise resolving to categorized feedback phrases.
 */
export const generateFeedbackPhrases = async (
  exercise: ExerciseDefinition,
): Promise<FeedbackPhrases> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  const ai = new GoogleGenAI({ apiKey });

  const targetDescriptions = exercise.targets
    .map(
      (t) =>
        `- ${t.name}: Target Angle is ${Math.round(t.targetAngle)}° (extracted from user's perfect reference video).`,
    )
    .join("\n");

  const prompt = `
System Persona: You are an elite Biomechanics and Calisthenics Specialist. Your feedback style is "Cue-Dense and Corrective." You prioritize structural integrity over repetitions. You translate complex joint angles into "external cues" (focusing on the environment) and "internal cues" (focusing on body sensation).

Exercise: ${exercise.name}
Description: ${exercise.description}

User's Calibrated Baseline (Based on their perfect reference video):
${targetDescriptions}

Generate a JSON object with 4 arrays of strings ("setup", "action", "safety", "praise") and 1 string ("intro").
Each array should contain 5 varied, short, punchy phrases (max 10 words each).
Use "Correction-Incentive Pairs" (e.g., "Push knee to pinky toe to unlock glute").

CRITICAL INSTRUCTION: DO NOT use exact numbers or degrees in your feedback (e.g., NEVER say "bend to 133 degrees"). Instead, translate the angles into easy-to-understand qualitative cues (e.g., "bend deeper", "drop hips parallel to floor", "straighten your back", "lock out your elbows").

Categories:
1. "intro": A 10-12 second high-level introduction of the exercise, telling the user what is important to be mindful of when doing the exercise.
2. "setup": Focus on joint stacking and starting posture before movement.
3. "action": Focus on maintaining targets and preventing drift during movement.
4. "safety": Urgent corrections for hard fails (e.g., valgus collapse, rounding back).
5. "praise": Short positive reinforcement for perfect form.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intro: { type: Type.STRING },
            setup: { type: Type.ARRAY, items: { type: Type.STRING } },
            action: { type: Type.ARRAY, items: { type: Type.STRING } },
            safety: { type: Type.ARRAY, items: { type: Type.STRING } },
            praise: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["intro", "setup", "action", "safety", "praise"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No text returned from Gemini");

    return JSON.parse(text) as FeedbackPhrases;
  } catch (error) {
    console.error("Error generating feedback:", error);
    // Fallback phrases
    return {
      intro:
        "Welcome to this exercise. Focus on maintaining a strong core and proper alignment throughout the movement.",
      setup: ["Find your vertical pillar.", "Stack ribcage over pelvis."],
      action: [
        "Imagine a steel rod from head to heel.",
        "Keep your chest proud.",
      ],
      safety: [
        "Anchor your opposite toe.",
        "Keep headlights pointed at floor.",
      ],
      praise: ["Perfect form.", "Hold that position.", "Excellent alignment."],
    };
  }
};
