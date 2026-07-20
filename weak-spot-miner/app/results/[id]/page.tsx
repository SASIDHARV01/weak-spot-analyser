"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { BrainCircuit, BookOpen, Wrench, ExternalLink, ArrowLeft, Loader2, Terminal, MessageSquare, Send, User, Bot } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

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
      console.error("Quiz generation error:", error);
      alert("Connection error generating quiz. Ensure the backend engine is active.");
      setIsGeneratingQuiz(false);
    }
  };

  useEffect(() => {
    async function fetchResults() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: submission, error } = await supabase
        .from("error_submissions")
        .select("*")
        .eq("id", params.id)
        .single();

      if (error) {
        console.error("Error fetching results:", error);
      } else {
        setData(submission);
      }
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
        body: JSON.stringify({
          submission_id: params.id,
          message: userMessage
        })
      });

      if (!response.ok) throw new Error("Failed to send message");
      
      const resData = await response.json();
      setChatMessages(prev => [...prev, { role: 'assistant', content: resData.reply }]);
    } catch (error) {
      console.error("Chat error:", error);
      setChatMessages(prev => [...prev, { role: 'assistant', content: "Connection error. Failed to reach remote engine." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading your deep analysis...</p>
      </div>
    );
  }

  if (!data) return <div className="p-12 text-center text-slate-800 font-bold">Result not found</div>;

  let resourceLinks: any[] = [];
  try {
    if (data && data.resource_links) {
      if (Array.isArray(data.resource_links)) {
        resourceLinks = data.resource_links;
      } else if (typeof data.resource_links === 'string') {
        resourceLinks = JSON.parse(data.resource_links);
      } else if (typeof data.resource_links === 'object') {
        resourceLinks = Object.values(data.resource_links);
      }
    }
  } catch (e) {
    console.error("Failed to parse resource links:", e);
    resourceLinks = [];
  }

  if (!Array.isArray(resourceLinks)) {
    resourceLinks = [];
  }

  return (
    <div className="p-8 sm:p-12 max-w-5xl mx-auto w-full pb-32">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <button onClick={() => router.push("/")} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Diagnosis Complete</h1>
          <p className="text-slate-500 text-sm mt-1">Uploaded on {new Date(data.created_at).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Core Issue Summary */}
          <div className="bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
              <BrainCircuit className="w-32 h-32" />
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-xl font-bold text-sm mb-6 border border-red-100">
              <Terminal className="w-4 h-4" />
              {data.weak_spot_tag || "Unknown Error"}
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-3">Why it failed</h2>
            <p className="text-slate-700 text-lg leading-relaxed">{data.error_type || "No explanation provided."}</p>
          </div>

          {/* The Immediate Fix */}
          <div className="bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-indigo-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-indigo-100 p-2.5 rounded-xl text-indigo-700"><Wrench className="w-6 h-6" /></div>
              <h2 className="text-xl font-bold text-slate-900">The Immediate Fix</h2>
            </div>
            <div className="prose prose-indigo max-w-none text-slate-700 whitespace-pre-wrap bg-slate-50 p-6 rounded-2xl border border-slate-100 font-mono text-sm">
              {data.immediate_fix || "Analyzing fix..."}
            </div>
          </div>

          {/* Phase C: Interactive Tutor Chat */}
          <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-slate-100 flex flex-col h-[400px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 rounded-t-3xl flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-lg text-white"><MessageSquare className="w-5 h-5" /></div>
              <h3 className="font-bold text-slate-900">AI Tutor</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-indigo-600" />
                    </div>
                  )}
                  <div className={`px-4 py-3 rounded-2xl max-w-[80%] text-sm ${
                    msg.role === 'user' 
                      ? 'bg-slate-900 text-white rounded-tr-sm' 
                      : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                  }`}>
                    {msg.content}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-slate-600" />
                    </div>
                  )}
                </div>
              ))}
              {isChatLoading && (
                <div className="flex gap-3 justify-start">
                   <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="px-4 py-3 rounded-2xl bg-slate-100 text-slate-500 rounded-tl-sm flex items-center gap-2 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
                    </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100">
              <div className="relative">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask a question about this error..."
                  className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                  disabled={isChatLoading}
                />
                <button 
                  type="submit" 
                  disabled={isChatLoading || !chatInput.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* Right Sidebar Area */}
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-slate-100">
            <h3 className="font-bold text-slate-900 px-2 mb-3">Source Image</h3>
            <div className="rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 aspect-video relative">
              <img src={data.file_url} alt="Uploaded error" className="object-cover w-full h-full" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-3xl text-white shadow-xl">
            <div className="flex items-center gap-3 mb-4 text-indigo-300">
              <BookOpen className="w-6 h-6" />
              <h3 className="font-bold">Core Concept</h3>
            </div>
            <h4 className="text-xl font-bold mb-2">What you need to learn</h4>
            <p className="text-slate-300 text-sm leading-relaxed">{data.prerequisites || "Analyzing core concepts..."}</p>
          </div>

          {/* SAFE RECOMMENDED RESOURCES BLOCK */}
<div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-slate-100">
  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
    <ExternalLink className="w-5 h-5 text-indigo-500" /> Recommended Resources
  </h3>

  {resourceLinks.length > 0 ? (
    <div className="space-y-3">
      {resourceLinks.map((link: any, index: number) => {
        if (!link) return null;

        // Force URL into a safe string
        let rawUrl = String(link.url || link.link || "").trim();

        // Ignore invalid values
        if (
          !rawUrl ||
          rawUrl === "undefined" ||
          rawUrl === "[object Object]"
        ) {
          return null;
        }

        let cleanUrl = rawUrl;
        const markdownRegex = /\[.*?\]\((.*?)\)/;

        // Safe markdown parsing
        const match = rawUrl.match(markdownRegex);
        if (match?.[1]) {
          cleanUrl = match[1];
        }

        return (
          <a
            key={index}
            href={cleanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 rounded-2xl transition-all group"
          >
            <p className="text-sm font-semibold text-slate-700 group-hover:text-indigo-700 line-clamp-2">
              {link.title || "Resource Link"}
            </p>

            <span className="text-xs text-indigo-500 mt-2 inline-flex items-center gap-1 font-medium">
              Read more <ExternalLink className="w-3 h-3" />
            </span>
          </a>
        );
      })}
    </div>
  ) : (
    <p className="text-sm text-slate-500 italic">
      No external resources generated for this issue.
    </p>
  )}
</div>
          
          {/* Phase D: On-Demand Quiz Trigger */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-8 rounded-3xl text-white shadow-xl flex flex-col items-center text-center">
            <div className="bg-white/20 p-3 rounded-full mb-4">
              <BrainCircuit className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-2">Ready to test your skills?</h3>
            <p className="text-indigo-100 text-sm mb-6 leading-relaxed">
              Prove you've mastered this concept. Generate a custom, 3-question quiz based specifically on this exact error.
            </p>
            <button
              onClick={handleGenerateQuiz}
              disabled={isGeneratingQuiz}
              className="w-full py-3 px-6 bg-white text-indigo-700 hover:bg-indigo-50 font-bold rounded-xl transition-all disabled:opacity-90 flex items-center justify-center gap-2 shadow-lg"
            >
              {isGeneratingQuiz ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                  Generating Test...
                </>
              ) : (
                <>
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  Test My Knowledge
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}