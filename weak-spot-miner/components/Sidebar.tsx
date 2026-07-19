"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { LayoutDashboard, ScanSearch, History, BrainCircuit, LogOut } from "lucide-react";
import { useEffect, useState } from "react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  
  // State to hold the dynamic user data
  const [displayName, setDisplayName] = useState("Loading...");
  const [initials, setInitials] = useState("-");

  const navItems = [
    { name: "Overview", href: "/", icon: LayoutDashboard },
    { name: "New Diagnosis", href: "/diagnose", icon: ScanSearch },
    { name: "History Logs", href: "/history", icon: History },
  ];

  // Fetch the real user when the sidebar mounts
  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email) {
        // Extract the name from the email (e.g., "john.doe@gmail.com" -> "john.doe")
        const emailName = user.email.split('@')[0];
        setDisplayName(emailName);
        setInitials(emailName.substring(0, 2).toUpperCase());
      } else {
        setDisplayName("Guest User");
        setInitials("GU");
      }
    }
    fetchUser();
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert("Error logging out: " + error.message);
    } else {
      router.push("/login"); 
    }
  };

  return (
    <aside className="w-64 h-full bg-white border-r border-slate-200 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-50">
      {/* Brand Header */}
      <div className="h-20 flex items-center px-8 border-b border-slate-100">
        <BrainCircuit className="w-8 h-8 text-indigo-600 mr-3" />
        <span className="text-xl font-bold text-slate-900 tracking-tight">Miner<span className="text-indigo-600">AI</span></span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-4">
          Main Menu
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 font-medium ${
                isActive 
                  ? "bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/50" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Actions & Profile Section */}
      <div className="p-4 border-t border-slate-100 space-y-2">
        {/* Logout Button */}
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-red-600 font-bold rounded-2xl hover:bg-red-50 transition-all duration-300"
        >
          <LogOut className="w-5 h-5" />
          Log Out
        </button>

        {/* User Profile Stub (Now Dynamic) */}
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
            {initials}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {displayName}
            </p>
            <p className="text-xs text-slate-500 truncate"></p>
          </div>
        </div>
      </div>
    </aside>
  );
}