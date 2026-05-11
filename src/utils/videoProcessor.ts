import { Pose, Results } from "@mediapipe/pose";
import { JointTarget } from "../constants/exercises";
import { calculateAngle } from "./geometry";

/**
 * @brief Analyzes a reference video to extract calibrated target angles.
 * @param videoFile The uploaded video file.
 * @param targets The joint targets to analyze in this view.
 * @return A promise resolving to a record of target names and their calibrated angles.
 */
export const analyzeVideo = async (
  videoFile: File,
  targets: JointTarget[],
): Promise<Record<string, number>> => {
  if (targets.length === 0) return {};

  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = URL.createObjectURL(videoFile);
    video.muted = true;
    video.playsInline = true;

    const pose = new Pose({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    const collectedAngles: Record<string, number[]> = {};
    targets.forEach((t) => (collectedAngles[t.name] = []));

    pose.onResults((results: Results) => {
      if (results.poseLandmarks) {
        targets.forEach((target) => {
          const [a, b, c] = target.landmarks;
          const lA = results.poseLandmarks[a];
          const lB = results.poseLandmarks[b];
          const lC = results.poseLandmarks[c];

          if (
            lA &&
            lA.visibility &&
            lA.visibility > 0.5 &&
            lB &&
            lB.visibility &&
            lB.visibility > 0.5 &&
            lC &&
            lC.visibility &&
            lC.visibility > 0.5
          ) {
            collectedAngles[target.name].push(calculateAngle(lA, lB, lC));
          }
        });
      }
    });

    video.onloadeddata = async () => {
      try {
        await video.play();

        const processFrame = async () => {
          if (video.ended || video.paused) {
            const finalAngles: Record<string, number> = {};

            targets.forEach((t) => {
              const angles = collectedAngles[t.name];
              if (angles.length === 0) {
                finalAngles[t.name] = t.targetAngle; // Fallback to default
                return;
              }

              if (t.analysisType === "min") {
                finalAngles[t.name] = Math.min(...angles);
              } else if (t.analysisType === "max") {
                finalAngles[t.name] = Math.max(...angles);
              } else {
                // Average for constant
                finalAngles[t.name] =
                  angles.reduce((a, b) => a + b, 0) / angles.length;
              }
            });

            pose.close();
            URL.revokeObjectURL(video.src);
            resolve(finalAngles);
            return;
          }

          await pose.send({ image: video });
          requestAnimationFrame(processFrame);
        };

        processFrame();
      } catch (err) {
        pose.close();
        URL.revokeObjectURL(video.src);
        reject(err);
      }
    };

    video.onerror = (err) => {
      pose.close();
      URL.revokeObjectURL(video.src);
      reject(new Error("Failed to load video file."));
    };
  });
};
