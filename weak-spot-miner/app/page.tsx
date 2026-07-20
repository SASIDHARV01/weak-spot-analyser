"use client";

import { useEffect, useState } from "react";
import { Activity, Target, Brain, ArrowRight, Clock } from "lucide-react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DashboardOverview() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, uniqueSpots: 0, mastered: 0 });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

    useEffect(() => {
    async function fetchDashboardData() {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        window.location.href = "/login";
        return;
      }

      const { data, error } = await supabase
        .from("error_submissions")
        .select("*")
        .eq("user_id", user.id) 
        .order("created_at", { ascending: false });

      if (!error && data) {
        const uniqueSpots = new Set(data.map(item => item.weak_spot_identified)).size;
        setStats({
          total: data.length,
          uniqueSpots: uniqueSpots,
          mastered: data.length > 0 ? Math.floor(data.length * 0.8) : 0,
        });

        setRecentActivity(data.slice(0, 3));

        const last7Days = [...Array(7)].map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - i);
          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }).reverse();

        const activityCount = data.reduce((acc: any, curr: any) => {
          const dateStr = new Date(curr.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          acc[dateStr] = (acc[dateStr] || 0) + 1;
          return acc;
        }, {});

        const formattedChartData = last7Days.map(date => ({
          name: date,
          errors: activityCount[date] || 0
        }));

        setChartData(formattedChartData);
      }
      
      setLoading(false);
    }

    fetchDashboardData();
  }, []);

  if (loading) {
    return <div className="p-12 text-center text-slate-400">Loading your analytics...</div>;
  }

  const statCards = [
    { title: "Errors Diagnosed", value: stats.total, icon: Activity, color: "text-blue-600", bg: "bg-blue-50" },
    { title: "Weak Spots Found", value: stats.uniqueSpots, icon: Target, color: "text-red-600", bg: "bg-red-50" },
    { title: "Concepts Mastered", value: stats.mastered, icon: Brain, color: "text-emerald-600", bg: "bg-emerald-50" },
  ];

  return (
    <div className="p-8 sm:p-12 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-12 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-1">Welcome back, Venkata</h1>
          <p className="text-slate-500">Here is your learning progress based on your recent scans.</p>
        </div>
        <Link 
          href="/diagnose" 
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-full font-medium hover:bg-indigo-700 transition-all shadow-sm hover:shadow-indigo-500/25"
        >
          New Diagnosis <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
              <div className="flex items-center gap-4 mb-4">
                <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-slate-500 font-medium">{stat.title}</h3>
              </div>
              <p className="text-4xl font-extrabold text-slate-900">{stat.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Activity Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Scanning Activity (Last 7 Days)</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }} />
                <Bar dataKey="errors" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Scans Sidebar */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Recent Scans</h2>
          {recentActivity.length === 0 ? (
            <p className="text-slate-500 text-sm">No recent scans found.</p>
          ) : (
            <div className="space-y-6">
              {recentActivity.map((log) => (
                <Link key={log.id} href={`/results/${log.id}`} className="block group">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 p-2 bg-slate-50 rounded-xl group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                      <Clock className="w-5 h-5 text-slate-400 group-hover:text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-800 text-sm mb-1 group-hover:text-indigo-600 transition-colors">
                        {log.weak_spot_identified || "Analysis Complete"}
                      </h4>
                      <p className="text-xs text-slate-500 truncate max-w-[200px]">
                        {new Date(log.created_at).toLocaleDateString()} • View Quiz
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <Link href="/history" className="mt-8 block text-center text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
            View All History &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}