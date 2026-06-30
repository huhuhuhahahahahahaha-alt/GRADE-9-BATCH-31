import React, { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  Timestamp 
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { 
  UserProfile, 
  SECTIONS, 
  SUBJECTS, 
  UserRole, 
  UserSection, 
  MaterialRequest 
} from "../types";
import { 
  LogOut, 
  Shield, 
  Users, 
  UserCheck, 
  Trash2, 
  UserCog, 
  Edit, 
  Search, 
  Filter, 
  Check, 
  X, 
  Bell, 
  Radio, 
  GraduationCap, 
  School, 
  Activity,
  Calendar,
  Layers,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DashboardAdminProps {
  userProfile: UserProfile;
  onLogout: () => void;
}

export default function DashboardAdmin({ userProfile, onLogout }: DashboardAdminProps) {
  const [activeTab, setActiveTab] = useState<"directory" | "broadcast" | "analytics">("directory");
  
  // Firestore state
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [recentBroadcasts, setRecentBroadcasts] = useState<MaterialRequest[]>([]);

  // Filter/Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [sectionFilter, setSectionFilter] = useState<"all" | UserSection>("all");

  // Edit User modal state
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editRole, setEditRole] = useState<UserRole>("student");
  const [editSection, setEditSection] = useState<UserSection>("none");
  const [editSubjects, setEditSubjects] = useState<string[]>([]);

  // Broadcast state
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastSections, setBroadcastSections] = useState<UserSection[]>(["fullerene"]);
  const [broadcastItemName, setBroadcastItemName] = useState("");
  const [broadcastItemQty, setBroadcastItemQty] = useState(1);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  const TEACHER_SECRET = "123676712367671236767";

  // 1. Listen to all users in the system
  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const users: UserProfile[] = [];
      snapshot.forEach((d) => {
        users.push({ id: d.id, ...d.data() } as any);
      });
      setAllUsers(users);
    });
    return () => unsub();
  }, []);

  // 2. Listen to all broadcasts
  useEffect(() => {
    const q = query(collection(db, "requests"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const alerts: MaterialRequest[] = [];
      snapshot.forEach((d) => {
        alerts.push({ id: d.id, ...d.data() } as MaterialRequest);
      });
      setRecentBroadcasts(alerts);
    });
    return () => unsub();
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
    onLogout();
  };

  const handleApproveUser = async (userId: string) => {
    try {
      await updateDoc(doc(db, "users", userId), { approved: true });
    } catch (err) {
      console.error("Error approving user:", err);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this user's profile and revoke access?")) {
      return;
    }
    try {
      await deleteDoc(doc(db, "users", userId));
    } catch (err) {
      console.error("Error deleting user:", err);
    }
  };

  const openEditModal = (user: UserProfile) => {
    setEditingUser(user);
    setEditRole(user.role);
    setEditSection(user.section);
    setEditSubjects(user.subjects || []);
  };

  const handleSaveUserEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const updatedFields: Partial<UserProfile> = {
        role: editRole,
        section: editRole === "student" ? editSection : "none",
        subjects: editRole === "teacher" ? editSubjects : undefined
      };

      await updateDoc(doc(db, "users", editingUser.uid), updatedFields);
      setEditingUser(null);
    } catch (err) {
      console.error("Error updating user profile:", err);
    }
  };

  const toggleSubjectForEdit = (subj: string) => {
    setEditSubjects(prev => 
      prev.includes(subj) ? prev.filter(s => s !== subj) : [...prev, subj]
    );
  };

  const toggleBroadcastSection = (sec: UserSection) => {
    setBroadcastSections(prev => 
      prev.includes(sec) ? prev.filter(s => s !== sec) : [...prev, sec]
    );
  };

  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;

    try {
      // We'll create one alert/request document per targeted section to keep consistency with the database schema
      for (const targetSec of broadcastSections) {
        const payload: any = {
          teacherName: `System Admin (${userProfile.name})`,
          teacherId: userProfile.uid,
          section: targetSec,
          message: broadcastMessage.trim(),
          items: broadcastItemName ? [{ name: broadcastItemName, quantity: broadcastItemQty }] : [],
          approved: true,
          createdAt: Timestamp.now()
        };

        if (isScheduled && scheduledDate && scheduledTime) {
          payload.scheduledAt = `${scheduledDate}T${scheduledTime}`;
          payload.status = "scheduled";
        } else {
          payload.status = "sent";
        }

        await addDoc(collection(db, "requests"), payload);
      }

      // Reset
      setBroadcastMessage("");
      setBroadcastItemName("");
      setBroadcastItemQty(1);
      setIsScheduled(false);
      setScheduledDate("");
      setScheduledTime("");
      alert("Broadcast alert dispatched to target sections successfully!");
    } catch (err) {
      console.error("Error sending broadcast:", err);
    }
  };

  const handleDeleteBroadcast = async (id: string) => {
    if (!window.confirm("Delete this broadcast alert?")) return;
    try {
      await deleteDoc(doc(db, "requests", id));
    } catch (err) {
      console.error("Error deleting alert:", err);
    }
  };

  // Directory computations
  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesSection = sectionFilter === "all" || u.section === sectionFilter;
    return matchesSearch && matchesRole && matchesSection;
  });

  const pendingApprovals = allUsers.filter(u => u.role === "student" && !u.approved);

  // Analytics computations
  const totalUsersCount = allUsers.length;
  const studentCount = allUsers.filter(u => u.role === "student").length;
  const teacherCount = allUsers.filter(u => u.role === "teacher").length;
  const adminCount = allUsers.filter(u => u.role === "admin").length;
  const approvedCount = allUsers.filter(u => u.approved).length;
  const approvalRate = totalUsersCount > 0 ? Math.round((approvedCount / totalUsersCount) * 100) : 100;

  // Breakdown of students by section
  const sectionCounts = {
    fullerene: allUsers.filter(u => u.role === "student" && u.section === "fullerene").length,
    diamond: allUsers.filter(u => u.role === "student" && u.section === "diamond").length,
    graphite: allUsers.filter(u => u.role === "student" && u.section === "graphite").length,
    lonsdalite: allUsers.filter(u => u.role === "student" && u.section === "lonsdalite").length,
  };
  const maxSectionStudents = Math.max(...Object.values(sectionCounts), 1);

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col font-sans text-[#e0e0e0]" id="admin_dashboard">
      <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:24px_24px] opacity-70 pointer-events-none"></div>

      {/* Top Header */}
      <header className="bg-[#0a0a0a] border-b border-white/10 sticky top-0 z-40 px-6 py-4 flex items-center justify-between" id="admin_header">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500/10 text-amber-500 p-2 border border-white/10 rounded-sm">
            <Shield size={20} className="stroke-[1.5]" />
          </div>
          <div>
            <h1 className="text-sm font-serif text-white tracking-wider italic flex items-center gap-2">
              System Control Dashboard
              <span className="px-1.5 py-0.5 bg-red-500/15 text-red-400 border border-red-500/20 rounded-full font-mono text-[9px] uppercase tracking-widest font-bold">
                Level 1 Root
              </span>
            </h1>
            <div className="flex items-center gap-1.5 text-[10px] text-white/40 font-mono mt-0.5">
              <span>Admin:</span>
              <span className="text-white/70 font-semibold">{userProfile.name}</span>
              <span>•</span>
              <span className="text-amber-500">{userProfile.email}</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-3 py-1.5 border border-white/10 text-white/50 hover:text-red-400 hover:border-red-500/30 rounded-sm text-[10px] font-mono uppercase tracking-widest transition-all"
          id="btn_admin_logout"
        >
          <LogOut size={12} />
          <span>Revoke Session</span>
        </button>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto p-4 gap-4" id="admin_container">
        {/* Navigation Sidebar */}
        <nav className="w-60 shrink-0 bg-[#0a0a0a] border border-white/10 rounded-sm p-4 flex flex-col gap-1.5 shadow-xl h-[calc(100vh-120px)] sticky top-[90px]" id="admin_nav">
          <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.2em] px-2.5 mb-2 font-mono">Control Terminal</p>
          
          <button
            onClick={() => setActiveTab("directory")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-sm text-xs font-mono uppercase tracking-wider transition-all border ${
              activeTab === "directory"
                ? "bg-amber-500/10 border-amber-500/40 text-amber-400 font-semibold"
                : "border-transparent text-white/50 hover:bg-white/5 hover:text-white"
            }`}
            id="nav_directory"
          >
            <span className="flex items-center gap-2.5">
              <Users size={14} />
              User Directory
            </span>
            {pendingApprovals.length > 0 && (
              <span className="bg-red-500 text-black text-[9px] font-bold px-1.5 py-0.2 rounded-full font-mono animate-pulse">
                {pendingApprovals.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("broadcast")}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-sm text-xs font-mono uppercase tracking-wider transition-all border ${
              activeTab === "broadcast"
                ? "bg-amber-500/10 border-amber-500/40 text-amber-400 font-semibold"
                : "border-transparent text-white/50 hover:bg-white/5 hover:text-white"
            }`}
            id="nav_broadcast"
          >
            <Radio size={14} />
            Global Broadcasts
          </button>

          <button
            onClick={() => setActiveTab("analytics")}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-sm text-xs font-mono uppercase tracking-wider transition-all border ${
              activeTab === "analytics"
                ? "bg-amber-500/10 border-amber-500/40 text-amber-400 font-semibold"
                : "border-transparent text-white/50 hover:bg-white/5 hover:text-white"
            }`}
            id="nav_analytics"
          >
            <Activity size={14} />
            Analytics Portal
          </button>

          {/* Quick System Statistics Widget */}
          <div className="mt-auto border border-white/5 bg-white/[0.02] rounded-sm p-3 font-mono text-[9px] space-y-1.5 text-white/40">
            <span className="text-white/60 font-bold block border-b border-white/10 pb-1 mb-1 uppercase tracking-wider">System State</span>
            <div className="flex justify-between">
              <span>Total Nodes:</span>
              <span className="text-white font-semibold">{totalUsersCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Active Students:</span>
              <span className="text-white font-semibold">{studentCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Staff Members:</span>
              <span className="text-white font-semibold">{teacherCount}</span>
            </div>
            <div className="flex justify-between text-amber-400">
              <span>Needs Approval:</span>
              <span className="font-bold">{pendingApprovals.length}</span>
            </div>
          </div>
        </nav>

        {/* Dynamic Center Work Area */}
        <main className="flex-1 min-w-0" id="admin_workspace">
          <AnimatePresence mode="wait">
            
            {/* Tab 1: User Directory */}
            {activeTab === "directory" && (
              <motion.div
                key="directory"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* Pending Approvals Panel (Shown conditionally on top) */}
                {pendingApprovals.length > 0 && (
                  <div className="bg-[#1a0f0a] border border-orange-500/30 p-5 rounded-sm" id="pending_approvals_alert">
                    <h2 className="text-xs font-mono font-bold uppercase text-orange-400 flex items-center gap-2 tracking-wider">
                      <UserCheck size={16} className="animate-bounce" />
                      Pending Student Enrollments Requiring Verification ({pendingApprovals.length})
                    </h2>
                    <p className="text-[10px] text-white/40 mt-1 mb-4 font-sans">
                      These students have registered accounts. Please confirm and verify their Grade 9 classroom assignment to unlock their academic portals.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3" id="pending_approvals_grid">
                      {pendingApprovals.map((p) => (
                        <div key={p.uid} className="bg-black/50 border border-white/10 p-3 flex justify-between items-center rounded-sm">
                          <div>
                            <span className="text-white font-semibold text-xs block">{p.name}</span>
                            <span className="text-[10px] text-amber-500 font-mono capitalize">Section: {p.section}</span>
                            <span className="text-[9px] text-white/40 block mt-0.5">{p.email}</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApproveUser(p.uid)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-black font-mono font-bold text-[9px] uppercase tracking-wider rounded-sm transition-all"
                              id={`approve_student_${p.uid}`}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleDeleteUser(p.uid)}
                              className="p-1.5 border border-white/10 hover:border-red-500/30 text-white/40 hover:text-red-400 rounded-sm transition-all"
                              id={`delete_pending_${p.uid}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Main Directory List & Filters */}
                <div className="bg-[#0a0a0a] border border-white/10 rounded-sm p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                    <div>
                      <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-white">Registered Academic Directory</h2>
                      <p className="text-[10px] text-white/40 font-mono">View, route, alter roles, and manage specialization access records.</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-1 text-white/60 rounded-sm font-mono">
                        Active Database Nodes: {filteredUsers.length}
                      </span>
                    </div>
                  </div>

                  {/* Search and Filters panel */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3" id="directory_filters">
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-white/40">
                        <Search size={14} />
                      </span>
                      <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-white/10 rounded-sm text-xs bg-black/50 text-white font-mono focus:outline-none focus:border-amber-500"
                        id="directory_search"
                      />
                    </div>

                    <div>
                      <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value as any)}
                        className="w-full px-3 py-2 border border-white/10 rounded-sm text-xs bg-[#050505] text-white font-mono focus:outline-none focus:border-amber-500 capitalize"
                        id="filter_role"
                      >
                        <option value="all">All Roles</option>
                        <option value="student">Students</option>
                        <option value="teacher">Teachers</option>
                        <option value="admin">Administrators</option>
                      </select>
                    </div>

                    <div>
                      <select
                        value={sectionFilter}
                        onChange={(e) => setSectionFilter(e.target.value as any)}
                        className="w-full px-3 py-2 border border-white/10 rounded-sm text-xs bg-[#050505] text-white font-mono focus:outline-none focus:border-amber-500 capitalize"
                        id="filter_section"
                      >
                        <option value="all">All Sections</option>
                        {SECTIONS.map((sec) => (
                          <option key={sec} value={sec}>{sec}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Users Table */}
                  <div className="border border-white/10 rounded-sm overflow-hidden" id="directory_table_wrapper">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse font-mono" id="directory_table">
                        <thead>
                          <tr className="bg-white/[0.02] border-b border-white/10 text-[9px] font-bold text-white/40 uppercase tracking-widest">
                            <th className="px-5 py-3">User Profile</th>
                            <th className="px-5 py-3">Role Badge</th>
                            <th className="px-5 py-3">Class Scope</th>
                            <th className="px-5 py-3">Verification</th>
                            <th className="px-5 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-xs text-white/70">
                          {filteredUsers.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="text-center py-8 text-white/40 italic">
                                No registered nodes matching target filter.
                              </td>
                            </tr>
                          ) : (
                            filteredUsers.map((u) => (
                              <tr key={u.uid} className="hover:bg-white/[0.01]">
                                <td className="px-5 py-3">
                                  <div>
                                    <span className="font-semibold text-white block">{u.name}</span>
                                    <span className="text-[10px] text-white/40 font-sans block mt-0.5">{u.email}</span>
                                  </div>
                                </td>
                                <td className="px-5 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                                    u.role === "admin" ? "bg-red-500/10 border-red-500/30 text-red-400" :
                                    u.role === "teacher" ? "bg-amber-500/10 border-amber-500/30 text-amber-400" :
                                    "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                                  }`}>
                                    {u.role}
                                  </span>
                                </td>
                                <td className="px-5 py-3">
                                  {u.role === "student" ? (
                                    <span className="text-white capitalize">{u.section}</span>
                                  ) : u.role === "teacher" ? (
                                    <div className="flex flex-wrap gap-1 max-w-xs">
                                      {u.subjects && u.subjects.length > 0 ? (
                                        u.subjects.map((sub) => (
                                          <span key={sub} className="px-1.5 py-0.2 bg-white/5 border border-white/10 text-[9px] rounded-sm text-white/60">
                                            {sub}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="text-white/30 italic text-[10px]">No subjects</span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-white/30 font-serif italic">Global system</span>
                                  )}
                                </td>
                                <td className="px-5 py-3">
                                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${
                                    u.approved ? "text-emerald-400" : "text-orange-400"
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${u.approved ? "bg-emerald-500" : "bg-orange-500 animate-pulse"}`}></span>
                                    {u.approved ? "Verified" : "Pending Approval"}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-right">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => openEditModal(u)}
                                      className="p-1.5 border border-white/10 hover:border-amber-500/30 text-white/40 hover:text-amber-400 rounded-sm transition-all"
                                      title="Edit account properties"
                                      id={`edit_user_${u.uid}`}
                                    >
                                      <UserCog size={13} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteUser(u.uid)}
                                      className="p-1.5 border border-white/10 hover:border-red-500/30 text-white/40 hover:text-red-400 rounded-sm transition-all"
                                      title="Delete account record"
                                      id={`delete_user_${u.uid}`}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tab 2: Global Broadcast & notice creation */}
            {activeTab === "broadcast" && (
              <motion.div
                key="broadcast"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-4"
              >
                {/* Notice Creator Form */}
                <div className="bg-[#0a0a0a] border border-white/10 rounded-sm p-5 shadow-sm space-y-4 h-fit">
                  <div>
                    <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-white">Broadcast Event Terminal</h2>
                    <p className="text-[10px] text-white/40 font-mono">Create classroom alerts or schedule material requests to target section networks.</p>
                  </div>

                  <form onSubmit={handleCreateBroadcast} className="space-y-4" id="broadcast_form">
                    
                    {/* Select Sections */}
                    <div>
                      <label className="block text-[9px] font-bold text-white/40 uppercase tracking-[0.2em] mb-1.5">
                        Target Section Subnets
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {SECTIONS.map((sec) => {
                          const isSelected = broadcastSections.includes(sec);
                          return (
                            <button
                              key={sec}
                              type="button"
                              onClick={() => toggleBroadcastSection(sec)}
                              className={`py-2 px-2 border text-[10px] font-mono uppercase tracking-wider flex items-center justify-between transition-all rounded-sm ${
                                isSelected
                                  ? "border-amber-500 bg-amber-500/10 text-amber-500 font-semibold"
                                  : "border-white/10 text-white/40 hover:text-white bg-black/30"
                              }`}
                            >
                              <span>{sec}</span>
                              {isSelected && <span className="text-amber-500 text-[10px]">✔</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Short Notice Text */}
                    <div>
                      <label className="block text-[9px] font-bold text-white/40 uppercase tracking-[0.2em] mb-1.5">
                        Broadcast Statement Message
                      </label>
                      <textarea
                        required
                        placeholder="Enter notice alert, e.g. Attention students: Class remains suspended or prepare for science laboratory exams tomorrow!"
                        value={broadcastMessage}
                        onChange={(e) => setBroadcastMessage(e.target.value)}
                        rows={4}
                        maxLength={150}
                        className="w-full px-3 py-2 border border-white/10 rounded-sm text-xs bg-black/50 text-white font-mono focus:outline-none focus:border-amber-500 text-left"
                        id="broadcast_msg_input"
                      />
                    </div>

                    {/* Optional Material Request attachments (add to cart concept) */}
                    <div className="border border-white/10 p-3 rounded-sm space-y-3 bg-white/[0.01]">
                      <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider block font-mono">Attach Material Requirement (Optional)</span>
                      
                      <div>
                        <label className="block text-[8px] font-mono text-white/40 uppercase tracking-wider mb-1">Material Name</label>
                        <input
                          type="text"
                          placeholder="e.g. 1/4 sheet of paper, protractor"
                          value={broadcastItemName}
                          onChange={(e) => setBroadcastItemName(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-white/10 rounded bg-[#050505] text-white text-xs font-mono focus:outline-none"
                          id="broadcast_item_name"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[8px] font-mono text-white/40 uppercase tracking-wider mb-1">Item Quantity</label>
                          <input
                            type="number"
                            min={1}
                            value={broadcastItemQty}
                            onChange={(e) => setBroadcastItemQty(Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 border border-white/10 rounded bg-[#050505] text-white text-xs font-mono focus:outline-none"
                            id="broadcast_item_qty"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Preset and scheduling */}
                    <div className="border border-white/10 p-3 rounded-sm space-y-2 bg-white/[0.01]">
                      <label className="flex items-center gap-2 text-[9px] font-bold text-white/60 font-mono cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isScheduled}
                          onChange={(e) => setIsScheduled(e.target.checked)}
                          className="rounded border-white/10 text-amber-500 focus:ring-0 focus:ring-offset-0 bg-[#050505]"
                          id="broadcast_check_schedule"
                        />
                        Schedule System Alert Event
                      </label>

                      {isScheduled && (
                        <div className="grid grid-cols-2 gap-2 mt-1.5 font-mono" id="broadcast_schedule_inputs">
                          <div>
                            <label className="block text-[8px] text-white/40 uppercase tracking-wider mb-1">Target Date</label>
                            <input
                              type="date"
                              required
                              value={scheduledDate}
                              onChange={(e) => setScheduledDate(e.target.value)}
                              className="w-full px-2 py-1.5 border border-white/10 rounded text-[10px] bg-black text-white focus:outline-none"
                              id="broadcast_date"
                            />
                          </div>
                          <div>
                            <label className="block text-[8px] text-white/40 uppercase tracking-wider mb-1">Target Time</label>
                            <input
                              type="time"
                              required
                              value={scheduledTime}
                              onChange={(e) => setScheduledTime(e.target.value)}
                              className="w-full px-2 py-1.5 border border-white/10 rounded text-[10px] bg-black text-white focus:outline-none"
                              id="broadcast_time"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-white hover:bg-amber-500 text-black text-xs font-mono font-bold py-2.5 rounded-sm transition-all shadow flex items-center justify-center gap-1.5 uppercase tracking-wider hover:shadow-[0_0_15px_rgba(245,158,11,0.25)]"
                      id="btn_send_broadcast"
                    >
                      <Radio size={12} />
                      {isScheduled ? "Preset Notice Schedule" : "Broadcast Event Now"}
                    </button>
                  </form>
                </div>

                {/* Recent Broadcasts List */}
                <div className="lg:col-span-2 bg-[#0a0a0a] border border-white/10 rounded-sm p-5 space-y-4">
                  <div>
                    <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-white">Broadcast logs &amp; Alert registry</h2>
                    <p className="text-[10px] text-white/40 font-mono">Real-time status tracking of all alerts deployed to student networks.</p>
                  </div>

                  {recentBroadcasts.length === 0 ? (
                    <div className="border border-white/5 p-8 rounded text-center text-white/30 italic font-mono text-xs">
                      No active alerts logged. Dispatched broadcasts populate in real-time.
                    </div>
                  ) : (
                    <div className="space-y-3" id="broadcasts_list">
                      {recentBroadcasts.map((b) => (
                        <div 
                          key={b.id} 
                          className="bg-black/50 border border-white/10 rounded-sm p-4 relative overflow-hidden flex flex-col justify-between gap-3 hover:border-white/20 transition-all"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-500 font-mono px-1.5 py-0.2 rounded font-bold uppercase tracking-wider">
                                  Section: {b.section}
                                </span>
                                {b.status === "scheduled" ? (
                                  <span className="text-[9px] bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 font-mono px-1.5 py-0.2 rounded-full uppercase tracking-widest">
                                    Scheduled: {b.scheduledAt?.replace("T", " ")}
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono px-1.5 py-0.2 rounded-full uppercase tracking-widest">
                                    Broadcasting Live
                                  </span>
                                )}
                              </div>
                              <p className="text-white text-xs font-serif mt-2.5 leading-relaxed">
                                "{b.message}"
                              </p>
                            </div>

                            <button
                              onClick={() => handleDeleteBroadcast(b.id!)}
                              className="text-white/40 hover:text-red-400 border border-transparent hover:border-red-500/20 hover:bg-red-500/5 p-1 rounded-sm transition-all"
                              id={`delete_broadcast_${b.id}`}
                            >
                              <X size={14} />
                            </button>
                          </div>

                          {b.items && b.items.length > 0 && (
                            <div className="border-t border-white/5 pt-2.5 flex justify-between items-center bg-white/[0.01] p-2 rounded-sm">
                              <div>
                                <span className="text-[8px] uppercase tracking-wider text-white/40 block font-mono">Attachment: Required material</span>
                                <span className="text-white font-mono font-bold text-xs">{b.items[0].name}</span>
                              </div>
                              <span className="font-mono text-amber-400 font-bold text-xs bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-sm">
                                Qty Needed: {b.items[0].quantity}
                              </span>
                            </div>
                          )}

                          <div className="text-[9px] font-mono text-white/30 text-right mt-1">
                            Issued by: {b.teacherName}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Tab 3: System Analytics */}
            {activeTab === "analytics" && (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* Visual Analytics overview cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-mono" id="analytics_counters">
                  <div className="bg-[#0a0a0a] border border-white/10 rounded-sm p-4 text-center">
                    <span className="text-[9px] text-white/40 uppercase tracking-widest block">System Registrations</span>
                    <span className="text-2xl font-bold text-white mt-1.5 block">{totalUsersCount}</span>
                  </div>
                  <div className="bg-[#0a0a0a] border border-white/10 rounded-sm p-4 text-center">
                    <span className="text-[9px] text-white/40 uppercase tracking-widest block">Approved Nodes</span>
                    <span className="text-2xl font-bold text-emerald-400 mt-1.5 block">{approvedCount}</span>
                  </div>
                  <div className="bg-[#0a0a0a] border border-white/10 rounded-sm p-4 text-center">
                    <span className="text-[9px] text-white/40 uppercase tracking-widest block">Pending Queue</span>
                    <span className="text-2xl font-bold text-orange-400 mt-1.5 block">{pendingApprovals.length}</span>
                  </div>
                  <div className="bg-[#0a0a0a] border border-white/10 rounded-sm p-4 text-center">
                    <span className="text-[9px] text-white/40 uppercase tracking-widest block">Security Integrity</span>
                    <span className="text-2xl font-bold text-amber-500 mt-1.5 block">{approvalRate}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Circle Enrollment percentage */}
                  <div className="bg-[#0a0a0a] border border-white/10 rounded-sm p-5 flex flex-col items-center justify-center text-center">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white mb-4 block text-left w-full border-b border-white/10 pb-2">Enrollment Verification Rate</h3>
                    
                    <div className="relative w-44 h-44 flex items-center justify-center mt-3">
                      {/* Custom styled SVG progress circle */}
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.02)" strokeWidth="8" fill="transparent" />
                        <circle 
                          cx="50" 
                          cy="50" 
                          r="40" 
                          stroke="rgb(245, 158, 11)" 
                          strokeWidth="8" 
                          fill="transparent" 
                          strokeDasharray={251.2}
                          strokeDashoffset={251.2 - (251.2 * approvalRate) / 100}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="text-3xl font-bold font-mono text-white">{approvalRate}%</span>
                        <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest mt-0.5">Verified Rate</span>
                      </div>
                    </div>

                    <div className="mt-5 text-[10px] text-white/40 font-mono space-y-1">
                      <div className="flex items-center gap-1.5 justify-center">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span>Approved &amp; Active: <strong className="text-white">{approvedCount}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 justify-center">
                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                        <span>Pending Security Review: <strong className="text-white">{pendingApprovals.length}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Section Breakdown bar chart */}
                  <div className="bg-[#0a0a0a] border border-white/10 rounded-sm p-5 space-y-4">
                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white border-b border-white/10 pb-2">Grade 9 Section Breakdown</h3>
                    <p className="text-[10px] text-white/40 font-mono leading-relaxed mb-2">Comparison metrics of student enrollment distributions inside registered Grade 9 sections.</p>

                    <div className="space-y-4 pt-2 font-mono">
                      {Object.entries(sectionCounts).map(([sectionName, count]) => {
                        const pct = count > 0 ? Math.round((count / maxSectionStudents) * 100) : 0;
                        return (
                          <div key={sectionName} className="space-y-1.5">
                            <div className="flex justify-between items-center text-[10px] uppercase">
                              <span className="font-bold text-white tracking-wider">{sectionName}</span>
                              <span className="text-amber-500 font-bold">{count} Students</span>
                            </div>
                            <div className="h-2 bg-white/5 border border-white/15 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                                className="h-full bg-gradient-to-r from-amber-600 to-amber-400"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>

      {/* Real-time User Edit Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0a0a0a] border border-white/10 p-6 rounded-sm max-w-md w-full relative space-y-4 font-mono text-xs"
              id="edit_user_modal"
            >
              <button 
                onClick={() => setEditingUser(null)}
                className="absolute top-4 right-4 text-white/40 hover:text-white"
                id="btn_close_edit_modal"
              >
                <X size={16} />
              </button>

              <div className="border-b border-white/10 pb-3">
                <span className="text-[9px] text-amber-500 uppercase tracking-widest font-bold">Node Settings Modification</span>
                <h3 className="text-sm font-bold text-white mt-1">{editingUser.name}</h3>
                <span className="text-[10px] text-white/40 block mt-0.5">{editingUser.email}</span>
              </div>

              <form onSubmit={handleSaveUserEdits} className="space-y-4">
                
                {/* Role Switcher */}
                <div>
                  <label className="block text-[9px] font-bold text-white/40 uppercase tracking-wider mb-1.5">Configure User Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 border border-white/10 rounded-sm bg-[#050505] text-white font-mono focus:outline-none"
                    id="modal_edit_role"
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                {/* Section Selector (Visible only if Student) */}
                {editRole === "student" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    id="modal_section_container"
                  >
                    <label className="block text-[9px] font-bold text-white/40 uppercase tracking-wider mb-1.5">Assign Section Subnet</label>
                    <select
                      value={editSection}
                      onChange={(e) => setEditSection(e.target.value as UserSection)}
                      className="w-full px-3 py-2 border border-white/10 rounded-sm bg-[#050505] text-white font-mono focus:outline-none capitalize"
                      id="modal_edit_section"
                    >
                      {SECTIONS.map((sec) => (
                        <option key={sec} value={sec}>{sec}</option>
                      ))}
                    </select>
                  </motion.div>
                )}

                {/* Subject Specializations (Visible only if Teacher) */}
                {editRole === "teacher" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-2 border border-white/5 p-3 rounded-sm bg-white/[0.01]"
                    id="modal_subjects_container"
                  >
                    <label className="block text-[9px] font-bold text-amber-500 uppercase tracking-wider">Taught Specializations</label>
                    <p className="text-[9px] text-white/30">Edit the subject segments this teacher teaches. Filters what chats/grades/attendance they edit.</p>
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      {SUBJECTS.map((subj) => {
                        const isSelected = editSubjects.includes(subj);
                        return (
                          <button
                            key={subj}
                            type="button"
                            onClick={() => toggleSubjectForEdit(subj)}
                            className={`py-1.5 px-2 border text-[9px] font-mono tracking-tight flex items-center justify-between transition-all rounded-sm ${
                              isSelected
                                ? "border-amber-500/50 bg-amber-500/10 text-white font-semibold"
                                : "border-white/5 text-white/40 hover:text-white bg-black/20"
                            }`}
                          >
                            <span>{subj}</span>
                            {isSelected && <span className="text-amber-500 font-bold">●</span>}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="flex-1 py-2 border border-white/10 hover:border-white/20 font-bold uppercase text-[9px] tracking-wider rounded-sm text-white/60 transition-all"
                    id="btn_modal_cancel"
                  >
                    Discard Changes
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase text-[9px] tracking-wider rounded-sm transition-all"
                    id="btn_modal_save"
                  >
                    Save Modifications
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
