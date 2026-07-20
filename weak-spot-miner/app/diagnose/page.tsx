"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FileImage, ArrowRight, Camera, FileText, X, BrainCircuit } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import WebcamScanner from "@/components/WebcamScanner";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DiagnosePage() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);


  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) setSelectedFile(e.dataTransfer.files[0]);
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) setSelectedFile(e.target.files[0]);
  };


  const handleCameraCapture = (file: File) => {
    setSelectedFile(file);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert("You must be logged in to analyze errors!");
        window.location.href = "/login";
        return;
      }

      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `error_images/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('error_images').upload(filePath, selectedFile);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('error_images').getPublicUrl(filePath);
      const rawBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const API_BASE_URL = (typeof rawBaseUrl === 'string') ? rawBaseUrl.replace(/\/$/, "") : "http://localhost:8000";
      const apiResponse = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          file_url: publicUrl
        })
      });

      if (!apiResponse.ok) throw new Error("Backend connection failed");

      const data = await apiResponse.json();
      // ADD THIS:
      router.push(`/results/${data.submission_id}`);
      setIsSuccess(true);
      setIsSuccess(true);
    } catch (error) {
      console.error("Pipeline failed:", error);
      alert("Failed to analyze file. Ensure FastAPI is running on port 8000.");
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="p-8 sm:p-12 max-w-4xl mx-auto w-full">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">New Diagnosis</h1>
        <p className="text-slate-500">Upload an image of your code, math problem, or assignment to find your weak spots.</p>
      </div>

      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100 p-8 sm:p-12">
        {isAnalyzing || isSuccess ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-75"></div>
              <div className="relative bg-indigo-50 p-6 rounded-full text-indigo-600 border border-indigo-100">
                <BrainCircuit className="w-12 h-12" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Engine is processing...</h3>
            <p className="text-slate-500 max-w-md">Our AI is analyzing your submission, identifying structural flaws, and generating a custom practice plan.</p>
          </div>
        ) : !selectedFile ? (
          <div className="flex flex-col w-full">
            {/* Drag & Drop Zone */}
            <div 
              className={`relative w-full rounded-3xl p-10 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer border-2 border-dashed
                ${isDragging ? "border-indigo-400 bg-indigo-50/50" : "border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-slate-50/80"}`}
              onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
              onClick={() => document.getElementById("fileInput")?.click()}
            >
              <input type="file" id="fileInput" className="hidden" accept="image/*, .pdf, .doc, .docx" onChange={handleFileChange} />
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-4 group-hover:-translate-y-1 transition-transform">
                <UploadCloud className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="font-bold text-slate-800 mb-1">Upload File</h3>
              <p className="text-xs text-slate-400 text-center mb-4">Images, PDFs, or Word Docs</p>
            </div>

            {/* Divider */}
            <div className="my-6 flex items-center gap-4 text-slate-400 before:flex-1 before:border-t before:border-slate-200 after:flex-1 after:border-t after:border-slate-200">
               or
            </div>

            {/* The New Laptop Camera Scanner */}
            <WebcamScanner onCapture={handleCameraCapture} />
          </div>
        ) : (
          <div className="flex flex-col items-center py-8">
            <div className="w-full max-w-lg p-6 rounded-3xl border border-slate-200 bg-slate-50 flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-100 p-3 rounded-2xl text-indigo-600"><FileImage className="w-6 h-6" /></div>
                <div className="overflow-hidden">
                  <p className="font-semibold text-slate-900 truncate max-w-[200px]">{selectedFile.name}</p>
                  <p className="text-xs text-slate-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <button onClick={() => setSelectedFile(null)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <button 
              onClick={handleAnalyze}
              className="flex items-center gap-2 px-8 py-4 rounded-full font-semibold text-lg bg-slate-900 text-white hover:bg-slate-800 hover:shadow-xl hover:shadow-slate-900/20 active:scale-95 transition-all duration-300"
            >
              Start Analysis <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}