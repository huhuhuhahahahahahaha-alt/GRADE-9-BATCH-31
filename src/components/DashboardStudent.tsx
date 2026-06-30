import React, { useState, useEffect, useRef } from "react";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  getDocs,
  doc,
  Timestamp,
  limit
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { 
  UserProfile, 
  UserSection,
  MaterialRequest, 
  ChatMessage, 
  StudentGrade, 
  AttendanceRecord,
  SUBJECTS,
  TIMETABLE_SCHEDULES 
} from "../types";
import { 
  LogOut, 
  MessageSquare, 
  Bell, 
  Calendar, 
  FileText, 
  UserCheck, 
  Clock, 
  Send, 
  User, 
  ShieldAlert, 
  BookOpen, 
  Activity, 
  CheckCircle2, 
  AlertTriangle,
  Loader2,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DashboardStudentProps {
  userProfile: UserProfile;
  onLogout: () => void;
}

export default function DashboardStudent({ userProfile, onLogout }: DashboardStudentProps) {
  const [profile, setProfile] = useState<UserProfile>(userProfile);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState<"alerts" | "chats" | "pms" | "grades" | "attendance" | "schedule">("alerts");

  // Real-time alerts
  const [alerts, setAlerts] = useState<MaterialRequest[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);

  // Subject Chat state
  const [selectedSubject, setSelectedSubject] = useState<string>(SUBJECTS[0]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");

  // PM state
  const [selectedTeacher, setSelectedTeacher] = useState<UserProfile | null>(null);
  const [pmMessages, setPmMessages] = useState<ChatMessage[]>([]);
  const [newPm, setNewPm] = useState("");

  // Grades state
  const [grades, setGrades] = useState<StudentGrade[]>([]);

  // Attendance state
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 5000); // check clock every 5 seconds for scheduled alerts
    return () => clearInterval(timer);
  }, []);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const pmEndRef = useRef<HTMLDivElement>(null);

  // 1. Listen to student's profile for real-time approval status!
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "users", profile.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        setProfile(data);
      }
    });
    return () => unsub();
  }, [profile.uid]);

  // 2. Fetch verified teachers for PMs
  useEffect(() => {
    if (!profile.approved) return;
    const q = query(collection(db, "users"), where("role", "==", "teacher"));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach((d) => {
        list.push(d.data() as UserProfile);
      });
      setTeachers(list);
    });
    return () => unsub();
  }, [profile.approved]);

  // 3. Listen to Active Alerts/Material Requests for this student's section
  useEffect(() => {
    if (!profile.approved || profile.section === "none") return;
    const q = query(
      collection(db, "requests"),
      where("section", "==", profile.section),
      where("active", "==", true)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: MaterialRequest[] = [];
      snapshot.forEach((docSnap) => {
        const alert = { id: docSnap.id, ...docSnap.data() } as MaterialRequest;
        list.push(alert);
      });
      // Sort in-memory descending by createdAt safely
      list.sort((a, b) => {
        const getMs = (dateVal: any) => {
          if (!dateVal) return 0;
          if (typeof dateVal === 'string') return new Date(dateVal).getTime();
          if (typeof dateVal === 'object' && 'seconds' in dateVal) return dateVal.seconds * 1000;
          return new Date(dateVal).getTime();
        };
        return getMs(b.createdAt) - getMs(a.createdAt);
      });
      setAlerts(list);
    });

    return () => unsub();
  }, [profile.approved, profile.section]);

  // 4. Listen to Real-time Chatroom Messages (Subject Chats)
  useEffect(() => {
    if (!profile.approved || !selectedSubject || profile.section === "none") return;
    const chatId = `${profile.section}_${selectedSubject.replace(/\s+/g, "")}`;
    const q = query(
      collection(db, "messages"),
      where("chatId", "==", chatId),
      where("section", "==", profile.section)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((d) => {
        msgs.push({ id: d.id, ...d.data() } as ChatMessage);
      });
      // Sort in-memory safely to prevent composite index requirements
      msgs.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeA - timeB;
      });
      setChatMessages(msgs);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    return () => unsub();
  }, [profile.approved, selectedSubject, profile.section]);

  // 5. Listen to PM Messages with selected teacher
  useEffect(() => {
    if (!profile.approved || !selectedTeacher) return;
    const chatId = `pm_${profile.uid}_${selectedTeacher.uid}`;
    const q = query(
      collection(db, "messages"),
      where("chatId", "==", chatId),
      where("participants", "array-contains", profile.uid)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((d) => {
        msgs.push({ id: d.id, ...d.data() } as ChatMessage);
      });
      // Sort in-memory safely to prevent composite index requirements
      msgs.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeA - timeB;
      });
      setPmMessages(msgs);
      setTimeout(() => pmEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    return () => unsub();
  }, [profile.approved, selectedTeacher]);

  // 6. Listen to student's Grades
  useEffect(() => {
    if (!profile.approved) return;
    const q = query(
      collection(db, "grades"),
      where("studentId", "==", profile.uid)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const list: StudentGrade[] = [];
      snapshot.forEach((d) => {
        list.push(d.data() as StudentGrade);
      });
      setGrades(list);
    });
    return () => unsub();
  }, [profile.approved, profile.uid]);

  // 7. Listen to student's section Attendance
  useEffect(() => {
    if (!profile.approved || profile.section === "none") return;
    const q = query(
      collection(db, "attendance"),
      where("section", "==", profile.section)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const list: AttendanceRecord[] = [];
      snapshot.forEach((d) => {
        list.push(d.data() as AttendanceRecord);
      });
      setAttendance(list);
    });
    return () => unsub();
  }, [profile.approved, profile.section]);

  const handleSendSubjectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || profile.section === "none") return;

    const chatId = `${profile.section}_${selectedSubject.replace(/\s+/g, "")}`;
    const msgData = {
      chatId,
      type: "subject",
      section: profile.section,
      subject: selectedSubject,
      senderId: profile.uid,
      senderName: profile.name,
      senderRole: "student",
      content: newMessage.trim(),
      createdAt: Timestamp.now()
    };

    setNewMessage("");
    await addDoc(collection(db, "messages"), msgData);
  };

  const handleSendPmMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPm.trim() || !selectedTeacher) return;

    const chatId = `pm_${profile.uid}_${selectedTeacher.uid}`;
    const msgData = {
      chatId,
      type: "pm",
      senderId: profile.uid,
      senderName: profile.name,
      senderRole: "student",
      recipientId: selectedTeacher.uid,
      participants: [profile.uid, selectedTeacher.uid],
      content: newPm.trim(),
      createdAt: Timestamp.now()
    };

    setNewPm("");
    await addDoc(collection(db, "messages"), msgData);
  };

  const handleSignOut = async () => {
    await signOut(auth);
    onLogout();
  };

  // If the student is not yet approved
  if (!profile.approved) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans" id="approval_pending_view">
        <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-70 pointer-events-none"></div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full text-center border border-slate-100 relative"
          id="pending_box"
        >
          <div className="mx-auto w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 mb-6 border border-amber-100 shadow-inner">
            <Loader2 className="animate-spin" size={32} />
          </div>

          <h2 className="text-2xl font-bold text-slate-800 font-display tracking-tight">
            Security Review Pending
          </h2>
          <p className="text-slate-500 text-sm mt-3 leading-relaxed">
            Hello, <strong className="text-slate-800">{profile.name}</strong>. Your Grade 9 Student Account for section <strong className="text-indigo-600 capitalize">{profile.section}</strong> has been successfully registered.
          </p>

          <div className="my-6 p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs text-left text-slate-600 space-y-2.5">
            <div className="flex gap-2">
              <span className="text-indigo-500 font-bold">✔</span>
              <span>Duplicate Accounts Prevention System Active</span>
            </div>
            <div className="flex gap-2">
              <span className="text-indigo-500 font-bold">✔</span>
              <span>Section Spy Protection Activated</span>
            </div>
            <div className="flex gap-2">
              <span className="text-indigo-500 font-bold">✔</span>
              <span>Encryption &amp; Privacy Protocol Secured</span>
            </div>
          </div>

          <p className="text-slate-500 text-xs mt-2 leading-relaxed">
            Please ask an approved Grade 9 teacher to approve your enrollment. This dashboard will unlock in real-time as soon as you are verified.
          </p>

          <button
            onClick={handleSignOut}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-all"
            id="btn_pending_logout"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </motion.div>
      </div>
    );
  }

  // Active alerts not yet dismissed by the student (filtered by schedule in real-time)
  const activeAlertsToShow = alerts.filter(a => {
    if (dismissedAlerts.includes(a.id)) return false;
    if (a.scheduledFor) {
      const schedTime = new Date(a.scheduledFor).getTime();
      return currentTime >= schedTime;
    }
    return true;
  });

  // Attendance stats calculator
  const studentAttendanceStats = () => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let total = 0;

    attendance.forEach(record => {
      const status = record.records[profile.uid];
      if (status) {
        total++;
        if (status === "present") present++;
        else if (status === "late") late++;
        else if (status === "absent") absent++;
      }
    });

    const rate = total > 0 ? Math.round(((present + late * 0.5) / total) * 100) : 100;
    return { present, late, absent, total, rate };
  };

  const attStats = studentAttendanceStats();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" id="student_dashboard">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-40 px-6 py-4 flex items-center justify-between" id="student_header">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-2 rounded-lg">
            <BookOpen size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold font-display text-slate-800">Grade 9 Academic Portal</h1>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700 capitalize">{profile.name}</span>
              <span>•</span>
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded font-medium uppercase text-[10px]">
                Section {profile.section}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-3.5 py-1.5 border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-100 rounded-lg text-xs font-semibold transition-all"
            id="btn_student_logout"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex max-w-7xl w-full mx-auto p-4 gap-4" id="student_main_container">
        {/* Left Side Navigation Menu */}
        <nav className="w-60 shrink-0 bg-white border border-slate-100 rounded-xl p-4 flex flex-col gap-1 shadow-sm h-[calc(100vh-120px)] sticky top-[90px]" id="student_nav">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">Navigation</p>
          
          <button
            onClick={() => setActiveTab("alerts")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "alerts"
                ? "bg-indigo-50 text-indigo-600"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
            id="nav_alerts"
          >
            <span className="flex items-center gap-2.5">
              <Bell size={16} />
              Material Alerts
            </span>
            {activeAlertsToShow.length > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {activeAlertsToShow.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("chats")}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "chats"
                ? "bg-indigo-50 text-indigo-600"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
            id="nav_chats"
          >
            <MessageSquare size={16} />
            Section Chatrooms
          </button>

          <button
            onClick={() => setActiveTab("pms")}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "pms"
                ? "bg-indigo-50 text-indigo-600"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
            id="nav_pms"
          >
            <User size={16} />
            PMs to Teachers
          </button>

          <button
            onClick={() => setActiveTab("grades")}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "grades"
                ? "bg-indigo-50 text-indigo-600"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
            id="nav_grades"
          >
            <FileText size={16} />
            Academic Gradebook
          </button>

          <button
            onClick={() => setActiveTab("attendance")}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "attendance"
                ? "bg-indigo-50 text-indigo-600"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
            id="nav_attendance"
          >
            <Activity size={16} />
            Attendance Log
          </button>

          <button
            onClick={() => setActiveTab("schedule")}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "schedule"
                ? "bg-indigo-50 text-indigo-600"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
            id="nav_schedule"
          >
            <Calendar size={16} />
            Class Timetable
          </button>
        </nav>

        {/* Dynamic Center Work Area */}
        <main className="flex-1 min-w-0" id="student_workspace">
          <AnimatePresence mode="wait">
            {/* Tab 1: Material Alerts */}
            {activeTab === "alerts" && (
              <motion.div
                key="alerts"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm">
                  <h2 className="text-lg font-bold font-display text-slate-800 flex items-center gap-2">
                    <Bell className="text-indigo-600" size={18} />
                    Classroom Material Requests
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Teachers request specific physical materials (e.g., intermediate pads, specific rulers) here so you can prepare them before they enter the classroom.
                  </p>
                </div>

                {activeAlertsToShow.length === 0 ? (
                  <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 p-8 rounded-xl text-center flex flex-col items-center">
                    <CheckCircle2 size={36} className="text-emerald-500 mb-2" />
                    <h3 className="font-semibold text-sm">All set! No pending material requests.</h3>
                    <p className="text-xs text-emerald-600/80 mt-1">
                      Your teachers haven't requested any paper, books, or devices for your current section. Enjoy the peace!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3" id="material_alerts_list">
                    {activeAlertsToShow.map((alert) => (
                      <motion.div
                        key={alert.id}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white border-2 border-indigo-100 hover:border-indigo-200 rounded-xl p-5 shadow-sm relative overflow-hidden"
                      >
                        {/* Order Theme Corner Flag */}
                        <div className="absolute top-0 right-0 bg-indigo-600 text-white px-3 py-1 rounded-bl-lg text-[10px] font-bold tracking-wider uppercase">
                          Material Alert
                        </div>

                        <div className="flex items-start gap-3.5">
                          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg mt-0.5 shrink-0">
                            <Clock size={18} />
                          </div>
                          
                          <div className="flex-1 min-w-0 pr-20">
                            <div className="text-xs text-slate-500 flex items-center gap-2">
                              <span className="font-semibold text-indigo-700">{alert.teacherName}</span>
                              <span>•</span>
                              <span>{new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>

                            <div className="mt-3 bg-slate-50 border border-slate-100 rounded-lg p-3.5">
                              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                                Items to bring out:
                              </h4>
                              
                              <div className="grid grid-cols-2 gap-2" id="alert_items_grid">
                                {Object.entries(alert.items).map(([name, qty]) => (
                                  <div key={name} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700">
                                    <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center text-[10px]">
                                      {qty}
                                    </span>
                                    <span className="font-medium truncate">{name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {alert.message && (
                              <p className="mt-3 text-xs text-slate-600 italic bg-amber-50/50 border border-amber-100 rounded p-2.5">
                                " {alert.message} "
                              </p>
                            )}

                            <div className="mt-4 flex gap-2">
                              <button
                                onClick={() => setDismissedAlerts([...dismissedAlerts, alert.id])}
                                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
                                id={`dismiss_alert_${alert.id}`}
                              >
                                <CheckCircle2 size={14} />
                                I Have Ready / Got it
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Tab 2: Section Chatrooms */}
            {activeTab === "chats" && (
              <motion.div
                key="chats"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white border border-slate-100 rounded-xl shadow-sm flex h-[calc(100vh-120px)] overflow-hidden"
              >
                {/* Subject sidebar */}
                <div className="w-56 border-r border-slate-100 bg-slate-50/50 p-3 flex flex-col gap-1 overflow-y-auto">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">Subject Chats</p>
                  {SUBJECTS.map((sub) => (
                    <button
                      key={sub}
                      onClick={() => setSelectedSubject(sub)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium truncate transition-all ${
                        selectedSubject === sub
                          ? "bg-indigo-50 text-indigo-600 border border-indigo-100 font-semibold"
                          : "text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent"
                      }`}
                      id={`select_subject_${sub.replace(/\s+/g, "")}`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>

                {/* Chat content pane */}
                <div className="flex-1 flex flex-col h-full">
                  <div className="border-b border-slate-100 px-4 py-3 bg-white flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800">{selectedSubject} Chatroom</h3>
                      <p className="text-[10px] text-indigo-600 font-medium">Real-time room for Section {profile.section}</p>
                    </div>
                  </div>

                  {/* Chat messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
                    {chatMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                        <MessageSquare size={32} className="stroke-[1.5] mb-2 text-slate-300" />
                        <p className="text-xs">No messages yet. Send a message to start the real-time discussion!</p>
                      </div>
                    ) : (
                      chatMessages.map((msg) => {
                        const isMe = msg.senderId === profile.uid;
                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                          >
                            <div className={`max-w-[70%] rounded-xl p-3 text-xs shadow-sm border ${
                              isMe 
                                ? "bg-indigo-600 text-white border-indigo-700 rounded-br-none" 
                                : msg.senderRole === "teacher"
                                ? "bg-rose-50 text-rose-900 border-rose-100 rounded-bl-none"
                                : "bg-white text-slate-800 border-slate-100 rounded-bl-none"
                            }`}>
                              {!isMe && (
                                <div className="font-bold text-[10px] mb-1 flex items-center gap-1.5">
                                  <span className={msg.senderRole === "teacher" ? "text-rose-700 font-semibold" : "text-slate-600"}>
                                    {msg.senderName}
                                  </span>
                                  {msg.senderRole === "teacher" && (
                                    <span className="bg-rose-100 text-rose-700 px-1 py-0.2 rounded uppercase text-[8px] tracking-wider font-bold">
                                      Teacher
                                    </span>
                                  )}
                                </div>
                              )}
                              <p className="leading-relaxed break-words">{msg.content}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Chat input form */}
                  <form onSubmit={handleSendSubjectMessage} className="p-3 border-t border-slate-100 flex gap-2 bg-white">
                    <input
                      type="text"
                      placeholder={`Type a message to ${selectedSubject}...`}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800"
                      id="subject_chat_input"
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-lg text-xs font-semibold transition-all flex items-center justify-center shrink-0"
                      id="btn_send_subject_msg"
                    >
                      <Send size={14} />
                    </button>
                  </form>
                </div>
              </motion.div>
            )}

            {/* Tab 3: PM to Teachers */}
            {activeTab === "pms" && (
              <motion.div
                key="pms"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white border border-slate-100 rounded-xl shadow-sm flex h-[calc(100vh-120px)] overflow-hidden"
              >
                {/* Teachers sidebar */}
                <div className="w-56 border-r border-slate-100 bg-slate-50/50 p-3 flex flex-col gap-1 overflow-y-auto">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">Available Teachers</p>
                  {teachers.length === 0 ? (
                    <p className="text-[10px] text-slate-400 p-2 italic">No educators registered yet.</p>
                  ) : (
                    teachers.map((t) => (
                      <button
                        key={t.uid}
                        onClick={() => setSelectedTeacher(t)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all ${
                          selectedTeacher?.uid === t.uid
                            ? "bg-rose-50 text-rose-700 border border-rose-100 font-semibold"
                            : "text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent"
                        }`}
                        id={`select_teacher_${t.uid}`}
                      >
                        <User size={14} className="text-slate-400 shrink-0" />
                        <span className="truncate">{t.name}</span>
                      </button>
                    ))
                  )}
                </div>

                {/* PM room content pane */}
                <div className="flex-1 flex flex-col h-full">
                  {selectedTeacher ? (
                    <>
                      <div className="border-b border-slate-100 px-4 py-3 bg-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 font-bold flex items-center justify-center text-xs">
                            {selectedTeacher.name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="text-xs font-bold text-slate-800">Private DM with {selectedTeacher.name}</h3>
                            <p className="text-[10px] text-emerald-600 font-medium">Faculty Member • Active Session</p>
                          </div>
                        </div>
                      </div>

                      {/* Message area */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
                        {pmMessages.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                            <MessageSquare size={32} className="stroke-[1.5] mb-2 text-slate-300" />
                            <p className="text-xs font-semibold">Start your secure query thread.</p>
                            <p className="text-[10px] mt-1 max-w-xs">Ask specific questions regarding grading, behavior feedback, or lesson reviews directly. Only you and this educator can view these messages.</p>
                          </div>
                        ) : (
                          pmMessages.map((msg) => {
                            const isMe = msg.senderId === profile.uid;
                            return (
                              <div
                                key={msg.id}
                                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                              >
                                <div className={`max-w-[70%] rounded-xl p-3 text-xs shadow-sm border ${
                                  isMe 
                                    ? "bg-indigo-600 text-white border-indigo-700 rounded-br-none" 
                                    : "bg-white text-slate-800 border-slate-100 rounded-bl-none"
                                }`}>
                                  <p className="leading-relaxed break-words">{msg.content}</p>
                                </div>
                              </div>
                            );
                          })
                        )}
                        <div ref={pmEndRef} />
                      </div>

                      {/* Message input */}
                      <form onSubmit={handleSendPmMessage} className="p-3 border-t border-slate-100 flex gap-2 bg-white">
                        <input
                          type="text"
                          placeholder={`Message ${selectedTeacher.name} securely...`}
                          value={newPm}
                          onChange={(e) => setNewPm(e.target.value)}
                          className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800"
                          id="pm_chat_input"
                        />
                        <button
                          type="submit"
                          disabled={!newPm.trim()}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-lg text-xs font-semibold transition-all flex items-center justify-center shrink-0"
                          id="btn_send_pm"
                        >
                          <Send size={14} />
                        </button>
                      </form>
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                      <User size={48} className="stroke-[1.2] mb-3 text-slate-300" />
                      <h3 className="font-semibold text-slate-700 text-sm">Direct Messaging Channel</h3>
                      <p className="text-xs max-w-sm mt-1 leading-relaxed">
                        Select an approved teacher from the left sidebar to start private query correspondence. Messaging is completely confidential.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Tab 4: Academic Gradebook */}
            {activeTab === "grades" && (
              <motion.div
                key="grades"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm">
                  <h2 className="text-lg font-bold font-display text-slate-800 flex items-center gap-2">
                    <FileText className="text-indigo-600" size={18} />
                    My Academic Grades
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Secure grade reporting system. Only you can view your grades and feedback details.
                  </p>
                </div>

                {grades.length === 0 ? (
                  <div className="bg-slate-100 border border-slate-200 p-8 rounded-xl text-center text-slate-500">
                    <BookOpen size={36} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-semibold">No graded items published yet.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Your subject teachers have not entered any official records into your card.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="student_grades_grid">
                    {grades.map((gradeRecord) => {
                      // Calc average score
                      const totalScore = gradeRecord.grades.reduce((sum, item) => sum + item.score, 0);
                      const totalMax = gradeRecord.grades.reduce((sum, item) => sum + item.maxScore, 0);
                      const percentage = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

                      return (
                        <div key={gradeRecord.id} className="bg-white border border-slate-100 hover:border-indigo-100 rounded-xl shadow-sm p-5 space-y-4 transition-all">
                          <div className="flex justify-between items-center pb-2.5 border-b border-slate-50">
                            <div>
                              <h3 className="font-bold text-sm text-slate-800 font-display">{gradeRecord.subject}</h3>
                              <p className="text-[10px] text-slate-400">Class Report Card</p>
                            </div>
                            <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                              percentage >= 90 ? "bg-emerald-50 text-emerald-700" :
                              percentage >= 75 ? "bg-indigo-50 text-indigo-700" : "bg-rose-50 text-rose-700"
                            }`}>
                              Average: {percentage}%
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Activities Breakdown:</h4>
                            {gradeRecord.grades.length === 0 ? (
                              <p className="text-[10px] italic text-slate-400">No scored entries added.</p>
                            ) : (
                              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                {gradeRecord.grades.map((item, idx) => (
                                  <div key={idx} className="flex justify-between text-xs py-1 px-2.5 bg-slate-50 rounded border border-slate-100">
                                    <span className="text-slate-600 truncate">{item.title}</span>
                                    <span className="font-semibold text-slate-800">{item.score} / {item.maxScore}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {gradeRecord.feedback && (
                            <div className="bg-indigo-50/30 p-2.5 rounded border border-indigo-50 text-xs">
                              <span className="font-semibold text-indigo-800 block text-[10px] uppercase tracking-wider mb-1">Academic Advice:</span>
                              <p className="text-slate-600 leading-relaxed italic">"{gradeRecord.feedback}"</p>
                            </div>
                          )}

                          {gradeRecord.behaviourNotes && (
                            <div className="bg-amber-50/40 p-2.5 rounded border border-amber-50 text-xs">
                              <span className="font-semibold text-amber-800 block text-[10px] uppercase tracking-wider mb-1">Behavior &amp; Participation:</span>
                              <p className="text-slate-600 leading-relaxed">{gradeRecord.behaviourNotes}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* Tab 5: Attendance Log */}
            {activeTab === "attendance" && (
              <motion.div
                key="attendance"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm">
                  <h2 className="text-lg font-bold font-display text-slate-800 flex items-center gap-2">
                    <Activity className="text-indigo-600" size={18} />
                    Attendance Report
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Daily attendance summaries logged by your subject teachers. Keep track of your academic presence!
                  </p>
                </div>

                {/* Score panel */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3" id="student_attendance_metrics">
                  <div className="bg-white border border-slate-100 rounded-xl p-4 text-center shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Presence Rate</span>
                    <span className="text-2xl font-bold font-display text-indigo-600 mt-1 block">{attStats.rate}%</span>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-xl p-4 text-center shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Logged Present</span>
                    <span className="text-2xl font-bold font-display text-emerald-600 mt-1 block">{attStats.present}</span>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-xl p-4 text-center shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Logged Late</span>
                    <span className="text-2xl font-bold font-display text-amber-500 mt-1 block">{attStats.late}</span>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-xl p-4 text-center shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Logged Absent</span>
                    <span className="text-2xl font-bold font-display text-rose-500 mt-1 block">{attStats.absent}</span>
                  </div>
                </div>

                {attendance.length === 0 ? (
                  <div className="bg-slate-100 border border-slate-200 p-8 rounded-xl text-center text-slate-500">
                    <Activity size={36} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-semibold">No attendance logged yet.</p>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse" id="student_attendance_table">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <th className="px-5 py-3">Subject</th>
                            <th className="px-5 py-3">Class Date</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3">Instructor Remark</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                          {attendance.map((record) => {
                            const status = record.records[profile.uid];
                            if (!status) return null;
                            return (
                              <tr key={record.id} className="hover:bg-slate-50/50">
                                <td className="px-5 py-3 font-semibold text-slate-800">{record.subject}</td>
                                <td className="px-5 py-3 text-slate-500">{record.date}</td>
                                <td className="px-5 py-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    status === "present" ? "bg-emerald-50 text-emerald-700" :
                                    status === "late" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
                                  }`}>
                                    {status}
                                  </span>
                                </td>
                                <td className="px-5 py-3 italic text-slate-500">{record.notes || "-"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Tab 6: Class Timetable */}
            {activeTab === "schedule" && (
              <motion.div
                key="schedule"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm">
                  <h2 className="text-lg font-bold font-display text-slate-800 flex items-center gap-2">
                    <Calendar className="text-indigo-600" size={18} />
                    Class Timetable schedule
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    The official weekly timetable for Grade 9 Section <strong className="capitalize">{profile.section}</strong>.
                  </p>
                </div>

                <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden" id="student_schedule_wrapper">
                  <div className="p-4 bg-indigo-50/50 border-b border-slate-100 flex justify-between items-center">
                    <span className="text-xs font-bold text-indigo-800 uppercase tracking-wide">Monday to Friday Timetable</span>
                    <span className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-semibold tracking-wider capitalize">
                      {profile.section} SCHEDULE
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {profile.section !== "none" && TIMETABLE_SCHEDULES[profile.section as Exclude<UserSection, "none">]?.map((slot, index) => {
                      const isSpecial = slot.subject === "Recess" || slot.subject === "Lunch Break";
                      return (
                        <div 
                          key={index} 
                          className={`flex items-center justify-between p-4 text-xs transition-all ${
                            isSpecial ? "bg-slate-50/50 italic text-slate-500" : "hover:bg-slate-50/30"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Clock className={isSpecial ? "text-slate-400" : "text-indigo-500"} size={14} />
                            <span className="font-semibold text-slate-600 font-mono w-28 shrink-0">{slot.time}</span>
                            <span className={`font-bold ${isSpecial ? "text-slate-500" : "text-slate-800 text-sm font-display"}`}>
                              {slot.subject}
                            </span>
                          </div>
                          {!isSpecial && (
                            <div className="text-slate-500 text-xs flex items-center gap-1.5">
                              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-medium">
                                Instructor: {slot.teacher}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Real-time floating POP-UP alert for new teacher requests */}
      <AnimatePresence>
        {activeAlertsToShow.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            id="realtime_alert_popup_overlay"
          >
            <motion.div 
              className="bg-white border-2 border-rose-500 rounded-2xl shadow-2xl max-w-md w-full p-6 relative overflow-hidden"
              id="realtime_alert_popup_box"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500 animate-pulse"></div>
              
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center border border-rose-100 shrink-0 shadow-inner">
                  <ShieldAlert className="animate-bounce" size={24} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-bold uppercase tracking-wider text-[9px] mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
                    Urgent Request from {activeAlertsToShow[0].teacherName}
                  </span>
                  
                  <h3 className="text-sm font-bold text-slate-800 font-display tracking-tight">
                    Please prepare classroom materials immediately!
                  </h3>
                  
                  <div className="mt-3 bg-rose-50/50 border border-rose-100 rounded-xl p-3">
                    <h4 className="text-[10px] font-bold text-rose-700 uppercase tracking-wider mb-2">
                      Bring Out the following items:
                    </h4>
                    <div className="space-y-1.5">
                      {Object.entries(activeAlertsToShow[0].items).map(([name, qty]) => (
                        <div key={name} className="flex items-center justify-between text-xs font-semibold py-1 px-2 bg-white rounded border border-rose-100">
                          <span className="text-slate-700">{name}</span>
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full font-bold text-[10px]">
                            Qty: {qty}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {activeAlertsToShow[0].message && (
                    <div className="mt-3 p-2.5 bg-slate-50 border border-slate-100 rounded text-xs text-slate-600 italic">
                      " {activeAlertsToShow[0].message} "
                    </div>
                  )}

                  <div className="mt-5 flex gap-2">
                    <button
                      onClick={() => setDismissedAlerts([...dismissedAlerts, activeAlertsToShow[0].id])}
                      className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition-all shadow-md shadow-rose-200 hover:shadow-lg flex items-center justify-center gap-1.5"
                      id={`popup_dismiss_${activeAlertsToShow[0].id}`}
                    >
                      <CheckCircle2 size={14} />
                      Got It! (Ready to Bring Out)
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
