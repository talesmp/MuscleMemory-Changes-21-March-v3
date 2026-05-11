export type ExerciseId = "split_squat" | "pole_overhead_squat" | "slrdl";

export interface JointTarget {
  name: string;
  targetAngle: number;
  acceptableDeviation: number; // degrees
  priority: "safety" | "action" | "setup";
  // Indices for MediaPipe Pose landmarks
  landmarks: [number, number, number];
  view: "front" | "side";
  analysisType: "min" | "max" | "constant";
}

export interface ExerciseDefinition {
  id: ExerciseId;
  name: string;
  description: string;
  targets: JointTarget[];
}

// MediaPipe Pose Landmark Indices
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

export const EXERCISES: Record<ExerciseId, ExerciseDefinition> = {
  split_squat: {
    id: "split_squat",
    name: "Split Squat",
    description: "Aim for the 90/90 position. Maintain a vertical torso.",
    targets: [
      {
        name: "Front Knee Depth",
        targetAngle: 90,
        acceptableDeviation: 10,
        priority: "action",
        landmarks: [
          POSE_LANDMARKS.LEFT_HIP,
          POSE_LANDMARKS.LEFT_KNEE,
          POSE_LANDMARKS.LEFT_ANKLE,
        ],
        view: "side",
        analysisType: "min",
      },
      {
        name: "Torso Alignment",
        targetAngle: 180,
        acceptableDeviation: 15,
        priority: "safety",
        landmarks: [
          POSE_LANDMARKS.LEFT_KNEE,
          POSE_LANDMARKS.LEFT_HIP,
          POSE_LANDMARKS.LEFT_SHOULDER,
        ],
        view: "side",
        analysisType: "constant",
      },
      {
        name: "Knee Tracking (Valgus)",
        targetAngle: 180,
        acceptableDeviation: 15,
        priority: "safety",
        landmarks: [
          POSE_LANDMARKS.LEFT_HIP,
          POSE_LANDMARKS.LEFT_KNEE,
          POSE_LANDMARKS.LEFT_ANKLE,
        ],
        view: "front",
        analysisType: "constant",
      },
    ],
  },
  pole_overhead_squat: {
    id: "pole_overhead_squat",
    name: "Pole Overhead Squat",
    description: "Maintain straight arms overhead with the pole while squatting. Keep torso upright.",
    targets: [
      {
        name: "Squat Depth",
        targetAngle: 90,
        acceptableDeviation: 15,
        priority: "action",
        landmarks: [
          POSE_LANDMARKS.LEFT_HIP,
          POSE_LANDMARKS.LEFT_KNEE,
          POSE_LANDMARKS.LEFT_ANKLE,
        ],
        view: "side",
        analysisType: "min",
      },
      {
        name: "Arm Extension",
        targetAngle: 180,
        acceptableDeviation: 15,
        priority: "safety",
        landmarks: [
          POSE_LANDMARKS.LEFT_HIP,
          POSE_LANDMARKS.LEFT_SHOULDER,
          POSE_LANDMARKS.LEFT_WRIST,
        ],
        view: "side",
        analysisType: "constant",
      },
      {
        name: "Torso Uprightness",
        targetAngle: 180,
        acceptableDeviation: 20,
        priority: "safety",
        landmarks: [
          POSE_LANDMARKS.LEFT_KNEE,
          POSE_LANDMARKS.LEFT_HIP,
          POSE_LANDMARKS.LEFT_SHOULDER,
        ],
        view: "side",
        analysisType: "constant",
      },
    ],
  },
  slrdl: {
    id: "slrdl",
    name: "Single-Legged Romanian Deadlift",
    description: "Hinge movement focusing on posterior chain tension.",
    targets: [
      {
        name: "Hip Hinge",
        targetAngle: 90,
        acceptableDeviation: 15,
        priority: "action",
        landmarks: [
          POSE_LANDMARKS.LEFT_SHOULDER,
          POSE_LANDMARKS.LEFT_HIP,
          POSE_LANDMARKS.LEFT_KNEE,
        ],
        view: "side",
        analysisType: "min",
      },
      {
        name: "Lumbar Neutrality",
        targetAngle: 180,
        acceptableDeviation: 10,
        priority: "safety",
        landmarks: [
          POSE_LANDMARKS.NOSE,
          POSE_LANDMARKS.LEFT_SHOULDER,
          POSE_LANDMARKS.LEFT_HIP,
        ],
        view: "side",
        analysisType: "constant",
      },
      {
        name: "Hip Level",
        targetAngle: 90,
        acceptableDeviation: 10,
        priority: "safety",
        landmarks: [
          POSE_LANDMARKS.LEFT_SHOULDER,
          POSE_LANDMARKS.LEFT_HIP,
          POSE_LANDMARKS.RIGHT_HIP,
        ],
        view: "front",
        analysisType: "constant",
      },
    ],
  },
};
