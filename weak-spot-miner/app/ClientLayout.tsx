"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar"; // Adjust this import path if needed!
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  const isAuthPage = pathname === "/login";

  useEffect(() => {
    // 1. Check local storage for the auth token immediately
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session && !isAuthPage) {
        // No token, and trying to access a secure page? Kick them out.
        router.push("/login");
      } else if (session && isAuthPage) {
        // Have a token, but trying to view the login page? Send to dashboard.
        router.push("/");
      }
      
      // Stop the loading screen once the check is done
      setIsLoading(false);
    };

    checkAuth();

    // 2. Listen globally for any login/logout events across tabs!
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        // Hard wipe local storage just to be extra safe
        localStorage.clear(); 
        router.push("/login");
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, [pathname, isAuthPage, router]);

  // Prevent UI flashing! Don't show ANYTHING until we know who they are.
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isAuthPage) {
    return <main className="min-h-screen bg-slate-50">{children}</main>;
  }

  return (
    <div className="flex h-screen bg-white">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-white border-l border-slate-100">
        {children}
      </main>
    </div>
  );
}