"use client";

import { useState, useRef, useCallback } from "react";
import { Camera, X, Check, Aperture } from "lucide-react";

export default function WebcamScanner({ onCapture }: { onCapture: (file: File) => void }) {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Starts the laptop webcam stream
  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } // Prefers back camera on mobile, defaults to webcam on desktop
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access the camera. Please ensure permissions are granted.");
      setIsCameraOpen(false);
    }
  };

  // Stops the stream and turns off the hardware camera light
  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  }, []);

  // Snaps the picture from the video feed
  const takeSnapshot = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas dimensions to match the video stream
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert the canvas image to a File object
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], "webcam-scan.jpg", { type: "image/jpeg" });
            onCapture(file); // Pass the file back to the parent component
            stopCamera();
          }
        }, "image/jpeg", 0.9);
      }
    }
  };

  return (
    <div className="w-full">
      {!isCameraOpen ? (
        <button
          onClick={startCamera}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-50 text-indigo-700 font-bold rounded-xl hover:bg-indigo-100 transition-colors w-full justify-center border border-indigo-200"
        >
          <Camera className="w-5 h-5" />
          Scan with Laptop Camera
        </button>
      ) : (
        <div className="relative bg-slate-900 rounded-2xl overflow-hidden shadow-xl border border-slate-700">
          {/* Live Video Feed */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-[400px] object-cover"
          />
          
          {/* Hidden Canvas for processing the image */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Camera Controls */}
          <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex justify-center items-center gap-6">
            <button
              onClick={stopCamera}
              className="p-3 bg-slate-800 text-white rounded-full hover:bg-slate-700 transition-colors"
              title="Cancel"
            >
              <X className="w-6 h-6" />
            </button>
            
            <button
              onClick={takeSnapshot}
              className="p-4 bg-indigo-600 text-white rounded-full hover:bg-indigo-500 transition-all border-4 border-indigo-300 shadow-[0_0_15px_rgba(79,70,229,0.5)]"
              title="Take Photo"
            >
              <Aperture className="w-8 h-8" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}