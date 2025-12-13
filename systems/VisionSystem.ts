import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { VisionResult } from "../types";

export class VisionSystem {
  handLandmarker: HandLandmarker | undefined;
  lastVideoTime = -1;
  
  // Smoothing variables
  currentY: number = 0.5;
  targetY: number = 0.5;
  currentX: number = 0.5;
  targetX: number = 0.5;
  
  // Base Pinch threshold (normalized Euclidean distance)
  private readonly BASE_PINCH_THRESHOLD = 0.08; 
  private readonly SMOOTHING_FACTOR = 0.2;

  async init() {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );
    
    this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
  }

  processFrame(video: HTMLVideoElement): VisionResult | null {
    if (!this.handLandmarker || video.currentTime === this.lastVideoTime) {
      return null;
    }

    this.lastVideoTime = video.currentTime;
    const results = this.handLandmarker.detectForVideo(video, performance.now());

    if (results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0];
      
      // Landmark 4: Thumb Tip
      // Landmark 8: Index Finger Tip
      const thumb = landmarks[4];
      const index = landmarks[8];

      // Calculate Distance (3D Euclidean, though we mostly care about x/y plane)
      const dx = thumb.x - index.x;
      const dy = thumb.y - index.y;
      
      const distance = Math.sqrt(dx*dx + dy*dy);

      // --- ADAPTIVE THRESHOLD LOGIC ---
      // Use tracking confidence as a proxy for lighting conditions.
      // Lower confidence (bad lighting) -> Higher threshold (more forgiving).
      let currentThreshold = this.BASE_PINCH_THRESHOLD;
      
      if (results.handedness && results.handedness.length > 0) {
        const confidence = results.handedness[0][0].score; // 0.0 to 1.0
        // If confidence drops below 0.9, linearly increase threshold up to +0.05
        // This helps prevent "dropping" the object when lighting causes jitter.
        const lightingCompensator = Math.max(0, 0.9 - confidence) * 0.2;
        currentThreshold += lightingCompensator;
      }

      // Check if pinching using adaptive threshold
      if (distance < currentThreshold) {
        // Calculate the center point of the pinch
        const midX = (thumb.x + index.x) / 2;
        const midY = (thumb.y + index.y) / 2;
        
        this.targetX = midX;
        this.targetY = midY;
        
        // Apply Smoothing (Lerp)
        this.currentX = this.currentX + (this.targetX - this.currentX) * this.SMOOTHING_FACTOR;
        this.currentY = this.currentY + (this.targetY - this.currentY) * this.SMOOTHING_FACTOR;
        
        return {
          isPinching: true,
          x: this.currentX,
          y: this.currentY
        };
      }
    }

    // No hand or no pinch
    return {
      isPinching: false,
      x: this.currentX,
      y: this.currentY
    };
  }
}