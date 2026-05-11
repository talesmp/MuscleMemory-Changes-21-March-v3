import { useEffect, useRef, useState, RefObject } from "react";

// For TypeScript to recognize global MediaPipe objects from CDN
declare global {
  interface Window {
    Pose: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    POSE_CONNECTIONS: any;
  }
}

interface UseShadowTrainerReturn {
  webcamVideoRef: RefObject<HTMLVideoElement | null>;
  frontVideoRef: RefObject<HTMLVideoElement | null>;
  sideVideoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  userLandmarks: any | null;
  isReady: boolean;
  error: string | null;
  showSkeleton: boolean;
  setShowSkeleton: (show: boolean) => void;
}

export const useShadowTrainer = (
  isActive: boolean,
  frontVideoFile: File | null,
  sideVideoFile: File | null,
  stage: "positioning" | "countdown" | "active",
  exerciseId?: string,
): UseShadowTrainerReturn => {
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const frontVideoRef = useRef<HTMLVideoElement>(null);
  const sideVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [userLandmarks, setUserLandmarks] = useState<any | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSkeleton, setShowSkeletonState] = useState(true);
  const showSkeletonRef = useRef(showSkeleton);

  const setShowSkeleton = (show: boolean) => {
    setShowSkeletonState(show);
    showSkeletonRef.current = show;
  };

  const userPoseRef = useRef<any>(null);
  const refMainPoseRef = useRef<any>(null);
  const refSidePoseRef = useRef<any>(null);

  const userResultsRef = useRef<any>(null);
  const refMainResultsRef = useRef<any>(null);
  const refSideResultsRef = useRef<any>(null);

  const requestRef = useRef<number>(0);
  const scaleRef = useRef<number | null>(null);
  const isVideoPlayingRef = useRef(false);
  const stageRef = useRef(stage);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    if (!frontVideoFile || !sideVideoFile) return;

    const frontUrl = URL.createObjectURL(frontVideoFile);
    const sideUrl = URL.createObjectURL(sideVideoFile);

    if (frontVideoRef.current) {
      frontVideoRef.current.src = frontUrl;
      frontVideoRef.current.loop = true;
      frontVideoRef.current.muted = true;
      frontVideoRef.current.playsInline = true;
      frontVideoRef.current.load();
    }

    if (sideVideoRef.current) {
      sideVideoRef.current.src = sideUrl;
      sideVideoRef.current.loop = true;
      sideVideoRef.current.muted = true;
      sideVideoRef.current.playsInline = true;
      sideVideoRef.current.load();
    }

    return () => {
      URL.revokeObjectURL(frontUrl);
      URL.revokeObjectURL(sideUrl);
    };
  }, [frontVideoFile, sideVideoFile]);

  // Handle video playback synchronization
  useEffect(() => {
    if (stage === "active") {
      if (!isVideoPlayingRef.current) {
        frontVideoRef.current?.play().catch(console.error);
        sideVideoRef.current?.play().catch(console.error);
        isVideoPlayingRef.current = true;
      }
    } else {
      if (isVideoPlayingRef.current) {
        frontVideoRef.current?.pause();
        sideVideoRef.current?.pause();
        if (frontVideoRef.current) frontVideoRef.current.currentTime = 0;
        if (sideVideoRef.current) sideVideoRef.current.currentTime = 0;
        isVideoPlayingRef.current = false;
      }
    }
  }, [stage]);

  useEffect(() => {
    if (!isActive) {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      return;
    }

    let isMounted = true;

    const initMediaPipe = async () => {
      try {
        if (!window.Pose) {
          throw new Error("MediaPipe Pose not loaded from CDN.");
        }

        const poseOptions = {
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          smoothSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        };

        // Initialize 3 Pose instances
        userPoseRef.current = new window.Pose({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        });
        userPoseRef.current.setOptions(poseOptions);
        userPoseRef.current.onResults((results: any) => {
          userResultsRef.current = results;
          if (results.poseLandmarks) {
            setUserLandmarks(results.poseLandmarks);
          } else {
            setUserLandmarks(null);
          }
        });

        refMainPoseRef.current = new window.Pose({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        });
        refMainPoseRef.current.setOptions(poseOptions);
        refMainPoseRef.current.onResults((results: any) => {
          refMainResultsRef.current = results;
        });

        refSidePoseRef.current = new window.Pose({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        });
        refSidePoseRef.current.setOptions(poseOptions);
        refSidePoseRef.current.onResults((results: any) => {
          refSideResultsRef.current = results;
        });

        // Initialize webcam
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: "user" },
          });
          if (webcamVideoRef.current) {
            webcamVideoRef.current.srcObject = stream;
            await new Promise((resolve) => {
              webcamVideoRef.current!.onloadedmetadata = () => {
                webcamVideoRef.current!.play();
                resolve(true);
              };
            });
          }
        } else {
          throw new Error("Camera not supported.");
        }

        if (isMounted) setIsReady(true);

        // Helper to extract frame and send to Pose
        const userCanvas = document.createElement("canvas");
        const frontCanvas = document.createElement("canvas");
        const sideCanvas = document.createElement("canvas");

        const sendVideoFrame = async (pose: any, video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
          if (video.videoWidth === 0 || video.videoHeight === 0) return;
          if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
          if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            await pose.send({ image: canvas });
          }
        };

        let isProcessingUser = false;
        let isProcessingMain = false;
        let isProcessingSide = false;

        // Start processing loop
        const processFrames = () => {
          if (!isMounted) return;

          try {
            // 1. Process user webcam
            if (
              !isProcessingUser &&
              webcamVideoRef.current &&
              webcamVideoRef.current.readyState >= 2
            ) {
              isProcessingUser = true;
              userPoseRef.current.send({ image: webcamVideoRef.current })
                .catch((e: any) => console.error("User Pose Error:", e))
                .finally(() => { isProcessingUser = false; });
            }

            // 2. Process ONLY the active reference video
            if (stageRef.current === "active") {
              let isSideView = false;
              if (userResultsRef.current && userResultsRef.current.poseWorldLandmarks) {
                const leftShoulder = userResultsRef.current.poseWorldLandmarks[11];
                const rightShoulder = userResultsRef.current.poseWorldLandmarks[12];
                if (leftShoulder && rightShoulder) {
                  const userYaw = Math.atan2(
                    leftShoulder.z - rightShoulder.z,
                    leftShoulder.x - rightShoulder.x,
                  );
                  isSideView = Math.abs(userYaw) > 10 * Math.PI / 180;
                }
              }

              if (!isSideView) {
                if (
                  !isProcessingMain &&
                  frontVideoRef.current &&
                  frontVideoRef.current.readyState >= 2 &&
                  !frontVideoRef.current.paused
                ) {
                  isProcessingMain = true;
                  sendVideoFrame(refMainPoseRef.current, frontVideoRef.current, frontCanvas)
                    .catch((e: any) => console.error("Main Pose Error:", e))
                    .finally(() => { isProcessingMain = false; });
                }
              } else {
                if (
                  !isProcessingSide &&
                  sideVideoRef.current &&
                  sideVideoRef.current.readyState >= 2 &&
                  !sideVideoRef.current.paused
                ) {
                  isProcessingSide = true;
                  sendVideoFrame(refSidePoseRef.current, sideVideoRef.current, sideCanvas)
                    .catch((e: any) => console.error("Side Pose Error:", e))
                    .finally(() => { isProcessingSide = false; });
                }
              }
            }

            renderCanvas();
          } catch (err) {
            console.error("Error processing frames:", err);
          }

          requestRef.current = requestAnimationFrame(processFrames);
        };

        processFrames();
      } catch (err: any) {
        console.error("MediaPipe Init Error:", err);
        if (isMounted)
          setError(
            err.message || "Failed to initialize camera or tracking model.",
          );
      }
    };

    initMediaPipe();

    return () => {
      isMounted = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (webcamVideoRef.current && webcamVideoRef.current.srcObject) {
        const stream = webcamVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
      if (userPoseRef.current) userPoseRef.current.close();
      if (refMainPoseRef.current) refMainPoseRef.current.close();
      if (refSidePoseRef.current) refSidePoseRef.current.close();
    };
  }, [isActive]);

  const renderCanvas = () => {
    if (!canvasRef.current || !webcamVideoRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Match canvas size to video
    canvas.width = webcamVideoRef.current.videoWidth;
    canvas.height = webcamVideoRef.current.videoHeight;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Flip horizontally for user view
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    // Draw webcam video
    ctx.drawImage(webcamVideoRef.current, 0, 0, canvas.width, canvas.height);

    const userResults = userResultsRef.current;
    const refMainResults = refMainResultsRef.current;
    const refSideResults = refSideResultsRef.current;

    let activeRefLandmarks3D: any = null;
    let transformedRefLandmarks: any = null;
    let comparisonYawDiff = 0;
    let visualYawDiff = 0;

    if (
      stageRef.current === "active" &&
      userResults &&
      userResults.poseWorldLandmarks
    ) {
      const leftShoulder = userResults.poseWorldLandmarks[11];
      const rightShoulder = userResults.poseWorldLandmarks[12];
      const userYaw = Math.atan2(
        leftShoulder.z - rightShoulder.z,
        leftShoulder.x - rightShoulder.x,
      );

      const isSideView = Math.abs(userYaw) > 10 * Math.PI / 180;

      let activeRefResults = isSideView ? refSideResults : refMainResults;

      if (activeRefResults && activeRefResults.poseWorldLandmarks) {
        activeRefLandmarks3D = activeRefResults.poseWorldLandmarks;
        transformedRefLandmarks = activeRefLandmarks3D;
        const rLeftS = activeRefLandmarks3D[11];
        const rRightS = activeRefLandmarks3D[12];
        const refYaw = Math.atan2(rLeftS.z - rRightS.z, rLeftS.x - rRightS.x);
        
        comparisonYawDiff = userYaw - refYaw;
        
        if (isSideView) {
          if (userYaw > 10 * Math.PI / 180) {
            // User faces left
            const targetYaw = Math.PI / 2 - 15 * Math.PI / 180;
            visualYawDiff = targetYaw - refYaw;
          } else {
            // User faces right
            const targetYaw = -Math.PI / 2 + 15 * Math.PI / 180;
            visualYawDiff = targetYaw - refYaw;
          }
        } else {
          const targetYaw = 0;
          visualYawDiff = targetYaw - refYaw;
        }

        if (exerciseId === "split_squat") {
          // Check stance (which leg is forward)
          const userFaceX = Math.sin(userYaw);
          const userFaceZ = -Math.cos(userYaw);
          const uLeftProj = userResults.poseWorldLandmarks[27].x * userFaceX + userResults.poseWorldLandmarks[27].z * userFaceZ;
          const uRightProj = userResults.poseWorldLandmarks[28].x * userFaceX + userResults.poseWorldLandmarks[28].z * userFaceZ;
          const userLeftForward = uLeftProj > uRightProj;

          const refFaceX = Math.sin(refYaw);
          const refFaceZ = -Math.cos(refYaw);
          const rLeftProj = activeRefLandmarks3D[27].x * refFaceX + activeRefLandmarks3D[27].z * refFaceZ;
          const rRightProj = activeRefLandmarks3D[28].x * refFaceX + activeRefLandmarks3D[28].z * refFaceZ;
          const refLeftForward = rLeftProj > rRightProj;

          if (userLeftForward !== refLeftForward) {
            // Mirror across sagittal plane to swap left/right stance
            const refHipX3D = (activeRefLandmarks3D[23].x + activeRefLandmarks3D[24].x) / 2;
            const refHipY3D = (activeRefLandmarks3D[23].y + activeRefLandmarks3D[24].y) / 2;
            const refHipZ3D = (activeRefLandmarks3D[23].z + activeRefLandmarks3D[24].z) / 2;

            transformedRefLandmarks = activeRefLandmarks3D.map((lm: any) => {
              let x = lm.x - refHipX3D;
              let y = lm.y - refHipY3D;
              let z = lm.z - refHipZ3D;

              // Rotate to align facing direction with +Z
              const cosR = Math.cos(-refYaw);
              const sinR = Math.sin(-refYaw);
              let localX = x * cosR - z * sinR;
              let localZ = x * sinR + z * cosR;

              // Negate X to mirror left/right
              localX = -localX;

              // Rotate back
              const cosRInv = Math.cos(refYaw);
              const sinRInv = Math.sin(refYaw);
              x = localX * cosRInv - localZ * sinRInv;
              z = localX * sinRInv + localZ * cosRInv;

              return {
                ...lm,
                x: x + refHipX3D,
                y: y + refHipY3D,
                z: z + refHipZ3D
              };
            });
          }
        }
      }
    }

    // Draw user skeleton if toggle is on
    if (showSkeletonRef.current && userResults && userResults.poseLandmarks) {
      window.drawConnectors(
        ctx,
        userResults.poseLandmarks,
        window.POSE_CONNECTIONS,
        {
          color: (data: any) => {
            if (!transformedRefLandmarks || !userResults.poseWorldLandmarks)
              return "#10b981";

            const connection = window.POSE_CONNECTIONS[data.index];
            if (!connection) return "#10b981";
            const [i, j] = connection;

            const uFrom = userResults.poseWorldLandmarks[i];
            const uTo = userResults.poseWorldLandmarks[j];
            const rFrom = transformedRefLandmarks[i];
            const rTo = transformedRefLandmarks[j];

            if (!uFrom || !uTo || !rFrom || !rTo) return "#10b981";

            const ux = uTo.x - uFrom.x;
            const uy = uTo.y - uFrom.y;
            const uz = uTo.z - uFrom.z;

            const rx = rTo.x - rFrom.x;
            const ry = rTo.y - rFrom.y;
            const rz = rTo.z - rFrom.z;

            const cosY = Math.cos(comparisonYawDiff);
            const sinY = Math.sin(comparisonYawDiff);
            const rotRx = rx * cosY - rz * sinY;
            const rotRz = rx * sinY + rz * cosY;

            const dot = ux * rotRx + uy * ry + uz * rotRz;
            const magU = Math.sqrt(ux * ux + uy * uy + uz * uz);
            const magR = Math.sqrt(rotRx * rotRx + ry * ry + rotRz * rotRz);

            if (magU === 0 || magR === 0) return "#10b981";

            const cosTheta = dot / (magU * magR);
            const angle = Math.acos(Math.max(-1, Math.min(1, cosTheta)));

            // 25 degrees = 0.436 radians
            if (angle > 0.436) {
              return "#ef4444";
            }
            return "#10b981";
          },
          lineWidth: 4,
        },
      );
    }

    // Draw reference skeleton if active and toggle is on
    if (
      stageRef.current === "active" &&
      showSkeletonRef.current &&
      userResults &&
      userResults.poseWorldLandmarks &&
      userResults.poseLandmarks &&
      transformedRefLandmarks
    ) {
      drawReferenceSkeleton(
        ctx,
        canvas,
        transformedRefLandmarks,
        visualYawDiff,
      );
    }

    ctx.restore();
  };

  const drawReferenceSkeleton = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    refLandmarks3D: any[],
    yawDiff: number,
  ) => {
    if (!refLandmarks3D || refLandmarks3D.length < 33) return;

    // 1. Calculate visible area due to object-cover cropping
    const clientW = canvas.clientWidth || canvas.width;
    const clientH = canvas.clientHeight || canvas.height;
    const scale = Math.max(clientW / canvas.width, clientH / canvas.height);

    const visibleW = clientW / scale;
    const visibleH = clientH / scale;

    const visibleLeft = (canvas.width - visibleW) / 2;
    const visibleBottom = (canvas.height + visibleH) / 2;

    // 2. Calculate Scale
    // We want the reference skeleton to occupy at most 28% of the VISIBLE screen height.
    // A typical human is about 1.8 units tall in MediaPipe 3D space.
    const targetHeightPx = visibleH * 0.28;
    const currentScale = targetHeightPx / 1.8;

    // 3. Translation (Lower Right Corner of VISIBLE area)
    // Since the canvas is flipped horizontally (ctx.scale(-1, 1)),
    // x = visibleLeft is the right edge of the visible screen.
    // To place it in the lower right, we want a small x value (near visibleLeft) 
    // and a large y value (near visibleBottom).
    const anchorX = visibleLeft + visibleW * 0.22; // 22% from the right edge
    // Position anchorY so that the bottom of the background box touches the bottom of the screen
    const anchorY = visibleBottom - targetHeightPx * 0.15;

    // Ref hip center in 3D (for X and Z rotation/centering)
    const refHipX3D = (refLandmarks3D[23].x + refLandmarks3D[24].x) / 2;
    const refHipZ3D = (refLandmarks3D[23].z + refLandmarks3D[24].z) / 2;

    // Find the lowest point (feet) to anchor the Y axis
    const footIndices = [27, 28, 29, 30, 31, 32];
    let refFootY3D = -Infinity;
    for (const idx of footIndices) {
      if (refLandmarks3D[idx] && refLandmarks3D[idx].y > refFootY3D) {
        refFootY3D = refLandmarks3D[idx].y;
      }
    }
    if (refFootY3D === -Infinity) {
      refFootY3D = (refLandmarks3D[23].y + refLandmarks3D[24].y) / 2; // fallback to hip
    }

    // Transform and project reference landmarks
    const projectedLandmarks = refLandmarks3D.map((lm) => {
      // Center X and Z around hip, but anchor Y to the feet
      let x = lm.x - refHipX3D;
      let y = lm.y - refFootY3D;
      let z = lm.z - refHipZ3D;

      // Rotate around Y axis by yawDiff
      const cosY = Math.cos(yawDiff);
      const sinY = Math.sin(yawDiff);
      const rotX = x * cosY - z * sinY;
      const rotZ = x * sinY + z * cosY;

      // Scale to pixels
      const pxX = rotX * currentScale;
      const pxY = y * currentScale;

      const finalX = anchorX + pxX;
      const finalY = anchorY + pxY;

      // Translate to anchor
      return {
        x: finalX / canvas.width,
        y: finalY / canvas.height,
        z: 0, // Ignore Z for 2D drawing to avoid depth scaling issues
        visibility: lm.visibility !== undefined ? lm.visibility : 1,
      };
    });

    // Draw constant background rectangle for reference skeleton
    const boxWidth = targetHeightPx * 1.4;
    const boxHeight = targetHeightPx * 1.35; // Reduced from 1.5 to remove extra space above head
    const boxLeft = anchorX - boxWidth / 2;
    // anchorY is now the feet (bottom of the skeleton). 
    // Shift the box so it mostly goes upwards from the feet, with a little padding below.
    const boxTop = anchorY - boxHeight + targetHeightPx * 0.15;

    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(boxLeft, boxTop, boxWidth, boxHeight, 12);
      ctx.fill();
    } else {
      ctx.fillRect(boxLeft, boxTop, boxWidth, boxHeight);
    }

    // Draw projected reference skeleton
    window.drawConnectors(ctx, projectedLandmarks, window.POSE_CONNECTIONS, {
      color: "#3715B3", // Violet for reference
      lineWidth: 2,
    });
  };

  return {
    webcamVideoRef,
    frontVideoRef,
    sideVideoRef,
    canvasRef,
    userLandmarks,
    isReady,
    error,
    showSkeleton,
    setShowSkeleton,
  };
};
