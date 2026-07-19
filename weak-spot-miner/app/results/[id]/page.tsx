"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { BrainCircuit, BookOpen, Wrench, ExternalLink, ArrowLeft, Loader2, Terminal, MessageSquare, Send, User, Bot } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

// Safe API URL initialization
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_BASE_URL = (typeof rawApiUrl === 'string') ? rawApiUrl.replace(/\/$/, "") : "http://localhost:8000";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [chatMessages, setChatMessages] = useState<{role: string, content: string}[]>([
    { role: 'assistant', content: "I've analyzed your error. Do you have any questions about the fix or the core concepts?" }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);

  const handleGenerateQuiz = async () => {
    setIsGeneratingQuiz(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/generate-quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: params.id })
      });
      
      const resData = await response.json();
      if (resData.status === "success") {
        router.push(`/quiz/${resData.quiz_id}`);
      } else {
        alert("Failed to generate quiz: " + resData.message);
        setIsGeneratingQuiz(false);
      }
    } catch (error) {
      alert("Connection error. Ensure FastAPI is running.");
      setIsGeneratingQuiz(false);
    }
  };

  useEffect(() => {
    async function fetchResults() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: submission, error } = await supabase
        .from("error_submissions")
        .select("*")
        .eq("id", params.id)
        .single();

      if (!error) setData(submission);
      setLoading(false);
    }
    fetchResults();
  }, [params.id, router]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: params.id, message: userMessage })
      });

      if (!response.ok) throw new Error();
      const resData = await response.json();
      setChatMessages(prev => [...prev, { role: 'assistant', content: resData.reply }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: "Connection error. Ensure backend is running." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 text-indigo-600 animate-spin" /></div>;
  if (!data) return <div className="p-12 text-center font-bold">Result not found</div>;

  const resourceLinks = Array.isArray(data.resource_links) 
    ? data.resource_links 
    : (typeof data.resource_links === 'string' ? JSON.parse(data.resource_links || '[]') : []);

  return (
    <div className="p-8 sm:p-12 max-w-5xl mx-auto w-full pb-32">
      <div className="mb-8 flex items-center gap-4">
        <button onClick={() => router.push("/")} className="p-2 bg-slate-100 rounded-full"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-3xl font-bold">Diagnosis Complete</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-100">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-xl font-bold text-sm mb-6 border border-red-100">
              <Terminal className="w-4 h-4" /> {data?.weak_spot_tag ?? "Unknown"}
            </div>
            <p className="text-slate-700 text-lg">{data?.error_type ?? "No explanation."}</p>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-indigo-100">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Wrench className="text-indigo-700" /> The Immediate Fix</h2>
            <div className="bg-slate-50 p-6 rounded-2xl font-mono text-sm">{data?.immediate_fix ?? "Analyzing..."}</div>
          </div>

          {/* Chat Component */}
          <div className="bg-white rounded-3xl border border-slate-100 flex flex-col h-[400px]">
             {/* ... (Keep your existing chat UI here) ... */}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100">
            <h3 className="font-bold mb-4 flex items-center gap-2"><ExternalLink className="w-5 h-5" /> Resources</h3>
            {resourceLinks.length > 0 ? (
              <div className="space-y-3">
                {resourceLinks.map((link: any, index: number) => {
                  if (!link?.url) return null; // CRITICAL SAFETY CHECK
                  const cleanUrl = link.url.replace(/^\[(.*?)\]\((.*?)\)$/, '$2').replace(/[\[\]\(\)]/g, '');
                  return (
                    <a key={index} href={cleanUrl} target="_blank" rel="noopener noreferrer" className="block p-4 bg-slate-50 hover:bg-indigo-50 rounded-2xl">
                      <p className="text-sm font-semibold">{link.title || "Resource"}</p>
                    </a>
                  )
                })}
              </div>
            ) : <p className="text-sm text-slate-500">No resources.</p>}
          </div>
          
          <button onClick={handleGenerateQuiz} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold">
            {isGeneratingQuiz ? <Loader2 className="animate-spin" /> : "Test My Knowledge"}
          </button>
        </div>
      </div>
    </div>
  );
}