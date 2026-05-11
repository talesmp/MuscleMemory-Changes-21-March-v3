import { useEffect, useRef, useState, RefObject } from "react";
import { Camera } from "@mediapipe/camera_utils";
import { Pose, Results, LandmarkList } from "@mediapipe/pose";

interface UsePoseTrackingReturn {
  videoRef: RefObject<HTMLVideoElement | null>;
  landmarks: LandmarkList | null;
  isReady: boolean;
  error: string | null;
}

/**
 * @brief Initializes MediaPipe Pose and Camera, returning real-time landmarks.
 * @return Object containing video ref, current landmarks, readiness, and errors.
 */
export const usePoseTracking = (isActive: boolean): UsePoseTrackingReturn => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [landmarks, setLandmarks] = useState<LandmarkList | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const poseRef = useRef<Pose | null>(null);

  useEffect(() => {
    if (!isActive) {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
      return;
    }

    const initMediaPipe = async () => {
      try {
        if (!videoRef.current) return;

        poseRef.current = new Pose({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
          },
        });

        poseRef.current.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          smoothSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        poseRef.current.onResults((results: Results) => {
          if (results.poseLandmarks) {
            setLandmarks(results.poseLandmarks);
          } else {
            setLandmarks(null);
          }
        });

        cameraRef.current = new Camera(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current && poseRef.current) {
              await poseRef.current.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480,
          facingMode: "user",
        });

        await cameraRef.current.start();
        setIsReady(true);
      } catch (err) {
        console.error("MediaPipe Init Error:", err);
        setError("Failed to initialize camera or tracking model.");
      }
    };

    initMediaPipe();

    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
      if (poseRef.current) {
        poseRef.current.close();
      }
    };
  }, [isActive]);

  return { videoRef, landmarks, isReady, error };
};
