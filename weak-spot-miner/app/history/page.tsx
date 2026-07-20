"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { Trash2, FileText, ArrowRight, Loader2 } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function HistoryPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);


  useEffect(() => {
    async function fetchHistory() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("error_submissions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("SUPABASE ERROR:", error.message);
      }

      if (data) setLogs(data);
      setIsLoading(false);
    }

    fetchHistory();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault(); 
    setLogs((prevLogs) => prevLogs.filter((log) => log.id !== id));

    const { error } = await supabase
      .from("error_submissions")
      .delete()
      .eq("id", id);

    if (error) {
      alert("Failed to delete from database: " + error.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-8 sm:p-12 max-w-5xl mx-auto w-full">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">History Logs</h1>
        <p className="text-slate-500">Review or delete your past diagnostic reports.</p>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700">No history found</h3>
          <p className="text-slate-500 mb-6">You haven't run any analyses yet.</p>
          <Link href="/diagnose" className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700">
            Start New Diagnosis
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {logs.map((log) => {
            // Determine the best name to show based on your database schema
            const displayName = log.error_name 
              || log.title 
              || (log.analysis_json && log.analysis_json.error_name) 
              || (log.analysis && log.analysis.title)
              || log.file_name 
              || "Unnamed Error";

            return (
              <Link 
                href={`/results/${log.id}`} 
                key={log.id}
                className="group flex items-center justify-between p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    {/* The new dynamic display name */}
                    <h3 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                      {displayName}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {new Date(log.created_at).toLocaleDateString()} at {new Date(log.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={(e) => handleDelete(log.id, e)}
                    className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    title="Delete Report"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  
                  <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}