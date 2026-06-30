/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, getDocFromServer } from "firebase/firestore";
import { auth, db } from "./firebase";
import { UserProfile } from "./types";
import AuthScreen from "./components/AuthScreen";
import DashboardStudent from "./components/DashboardStudent";
import DashboardTeacher from "./components/DashboardTeacher";
import DashboardAdmin from "./components/DashboardAdmin";
import { School, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. Connection Test as required by our Firebase Integration rules
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, "test", "connection"));
        console.log("Firebase Connection verified successfully.");
      } catch (error) {
        if (error instanceof Error && error.message.includes("the client is offline")) {
          console.error("Please check your Firebase configuration or network status.");
        }
      }
    }
    testConnection();
  }, []);

  // 2. Watch Authentication state change
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        try {
          const docSnap = await getDoc(doc(db, "users", authUser.uid));
          if (docSnap.exists()) {
            setUser(docSnap.data() as UserProfile);
          } else {
            console.warn("User authenticated but profile not found.");
            setUser(null);
          }
        } catch (error) {
          console.error("Error loading user profile:", error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-[#e0e0e0] flex flex-col items-center justify-center p-4" id="app_loading_screen">
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:24px_24px] opacity-70 pointer-events-none"></div>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <div className="p-4 bg-amber-500/10 text-amber-500 rounded-sm shadow-inner inline-flex border border-white/10">
            <School size={40} className="stroke-[1.5] animate-pulse" />
          </div>
          <h2 className="text-xl font-serif text-white tracking-tight italic">Grade 9 Academic Portal</h2>
          <div className="flex items-center justify-center gap-2 text-xs text-white/40">
            <Loader2 className="animate-spin text-amber-500" size={16} />
            <span className="font-mono uppercase tracking-widest text-[10px]">Securing encrypted connection...</span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0]" id="app_root">
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <AuthScreen onAuthSuccess={(profile) => setUser(profile)} />
          </motion.div>
        ) : user.role === "admin" ? (
          <motion.div
            key="admin_dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <DashboardAdmin userProfile={user} onLogout={() => setUser(null)} />
          </motion.div>
        ) : user.role === "teacher" ? (
          <motion.div
            key="teacher_dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <DashboardTeacher userProfile={user} onLogout={() => setUser(null)} />
          </motion.div>
        ) : (
          <motion.div
            key="student_dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <DashboardStudent userProfile={user} onLogout={() => setUser(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
