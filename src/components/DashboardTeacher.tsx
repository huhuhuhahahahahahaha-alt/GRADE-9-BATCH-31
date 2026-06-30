import React, { useState, useEffect, useRef } from "react";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs,
  setDoc,
  Timestamp,
  limit
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../firebase";
import { 
  UserProfile, 
  MaterialRequest, 
  ChatMessage, 
  StudentGrade, 
  AttendanceRecord,
  SECTIONS,
  SUBJECTS 
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
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  Activity, 
  Check, 
  X, 
  Search, 
  AlertCircle,
  Loader2,
  Bookmark,
  Award
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DashboardTeacherProps {
  userProfile: UserProfile;
  onLogout: () => void;
}

// Pre-defined material catalog
const MATERIAL_CATALOG = [
  { id: "1", name: "1/4 Sheet of Paper", category: "Paper" },
  { id: "2", name: "1/2 Sheet of Paper (Crosswise)", category: "Paper" },
  { id: "3", name: "1/2 Sheet of Paper (Lengthwise)", category: "Paper" },
  { id: "4", name: "Whole Intermediate Pad", category: "Paper" },
  { id: "5", name: "Science Notebook", category: "Books" },
  { id: "6", name: "Mathematics Textbook", category: "Books" },
  { id: "7", name: "Scientific Calculator", category: "Tools" },
  { id: "8", name: "Drawing Compass", category: "Tools" },
  { id: "9", name: "Black / Blue Ballpen", category: "Writing" },
  { id: "10", name: "Lead Pencil & Eraser", category: "Writing" },
  { id: "11", name: "Coloring Crayons / Markers", category: "Art" },
  { id: "12", name: "Graphing/Grid Paper", category: "Paper" }
];

export default function DashboardTeacher({ userProfile, onLogout }: DashboardTeacherProps) {
  const [activeTab, setActiveTab] = useState<"approvals" | "request" | "grades" | "attendance" | "chats" | "pms">("request");

  // User list
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);

  // Cart / Materials request state
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customItem, setCustomItem] = useState("");
  const [targetSection, setTargetSection] = useState<"fullerene" | "diamond" | "graphite" | "lonsdalite">("fullerene");
  const [alertMessage, setAlertMessage] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [recentAlerts, setRecentAlerts] = useState<MaterialRequest[]>([]);

  const availableSubjects = userProfile.subjects && userProfile.subjects.length > 0 
    ? userProfile.subjects 
    : SUBJECTS;

  // Grade Management state
  const [gradeSection, setGradeSection] = useState<"fullerene" | "diamond" | "graphite" | "lonsdalite">("fullerene");
  const [gradeSubject, setGradeSubject] = useState(userProfile.subjects?.[0] || SUBJECTS[0]);
  const [selectedStudentGrade, setSelectedStudentGrade] = useState<UserProfile | null>(null);
  const [activityTitle, setActivityTitle] = useState("");
  const [activityScore, setActivityScore] = useState<number | "">("");
  const [activityMaxScore, setActivityMaxScore] = useState<number | "">("");
  const [gradeFeedback, setGradeFeedback] = useState("");
  const [gradeBehavior, setGradeBehavior] = useState("");
  const [studentGradesList, setStudentGradesList] = useState<StudentGrade[]>([]);

  // Attendance Management state
  const [attSection, setAttSection] = useState<"fullerene" | "diamond" | "graphite" | "lonsdalite">("fullerene");
  const [attSubject, setAttSubject] = useState(userProfile.subjects?.[0] || SUBJECTS[0]);
  const [attDate, setAttDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, "present" | "absent" | "late">>({});
  const [attendanceNotes, setAttendanceNotes] = useState("");
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);

  // Section Subject Chats
  const [chatSection, setChatSection] = useState<"fullerene" | "diamond" | "graphite" | "lonsdalite">("fullerene");
  const [chatSubject, setChatSubject] = useState(userProfile.subjects?.[0] || SUBJECTS[0]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newChatMsg, setNewChatMsg] = useState("");

  // PMs Inbox
  const [pmThreads, setPmThreads] = useState<{ student: UserProfile; lastMessage: string }[]>([]);
  const [selectedStudentPm, setSelectedStudentPm] = useState<UserProfile | null>(null);
  const [pmMessages, setPmMessages] = useState<ChatMessage[]>([]);
  const [newPmMsg, setNewPmMsg] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const pmEndRef = useRef<HTMLDivElement>(null);

  // 1. Listen to ALL registered users
  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const studs: UserProfile[] = [];
      const pending: UserProfile[] = [];
      
      snapshot.forEach((docSnap) => {
        const u = docSnap.data() as UserProfile;
        if (u.role === "student") {
          if (u.approved) {
            studs.push(u);
          } else {
            pending.push(u);
          }
        }
      });
      
      setStudents(studs);
      setPendingUsers(pending);
    });
    return () => unsub();
  }, []);

  // 2. Fetch recent alerts posted by this teacher
  useEffect(() => {
    const q = query(
      collection(db, "requests"),
      where("teacherId", "==", userProfile.uid)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const list: MaterialRequest[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as MaterialRequest);
      });
      // Sort in-memory descending by createdAt safely, then limit to 20
      list.sort((a, b) => {
        const getMs = (dateVal: any) => {
          if (!dateVal) return 0;
          if (typeof dateVal === 'string') return new Date(dateVal).getTime();
          if (typeof dateVal === 'object' && 'seconds' in dateVal) return dateVal.seconds * 1000;
          return new Date(dateVal).getTime();
        };
        return getMs(b.createdAt) - getMs(a.createdAt);
      });
      setRecentAlerts(list.slice(0, 20));
    });
    return () => unsub();
  }, [userProfile.uid]);

  // 3. Listen to all students' Grades under currently selected Section & Subject
  useEffect(() => {
    const q = query(
      collection(db, "grades"),
      where("section", "==", gradeSection),
      where("subject", "==", gradeSubject)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const list: StudentGrade[] = [];
      snapshot.forEach((d) => {
        list.push(d.data() as StudentGrade);
      });
      setStudentGradesList(list);
    });
    return () => unsub();
  }, [gradeSection, gradeSubject]);

  // 4. Listen to attendance log for selected date, section, and subject
  useEffect(() => {
    const attendanceId = `${attSection}_${attSubject.replace(/\s+/g, "")}_${attDate}`;
    const unsub = onSnapshot(doc(db, "attendance", attendanceId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as AttendanceRecord;
        setAttendanceRecords(data.records);
        setAttendanceNotes(data.notes);
      } else {
        // Reset to default
        setAttendanceRecords({});
        setAttendanceNotes("");
      }
    });
    return () => unsub();
  }, [attSection, attSubject, attDate]);

  // 5. Listen to Section Subject Chat Messages
  useEffect(() => {
    const chatId = `${chatSection}_${chatSubject.replace(/\s+/g, "")}`;
    const q = query(
      collection(db, "messages"),
      where("chatId", "==", chatId)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((d) => {
        msgs.push({ id: d.id, ...d.data() } as ChatMessage);
      });
      // Sort in-memory ascending by createdAt safely, then take the last 100 messages
      msgs.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeA - timeB;
      });
      setChatMessages(msgs.slice(-100));
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    return () => unsub();
  }, [chatSection, chatSubject]);

  // 6. Listen to PM Threads from students
  useEffect(() => {
    // A teacher finds PMs by listening to messages with type == 'pm'
    const q = query(
      collection(db, "messages"),
      where("type", "==", "pm")
    );

    const unsub = onSnapshot(q, async (snapshot) => {
      const studentUidsSet = new Set<string>();
      const threadsMap: Record<string, string> = {}; // studentId -> last message content

      const msgs: ChatMessage[] = [];
      snapshot.forEach((d) => {
        msgs.push(d.data() as ChatMessage);
      });
      // Sort in-memory descending by createdAt safely
      msgs.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      msgs.forEach((msg) => {
        const parts = msg.chatId.split("_");
        const studentId = parts[1];
        const teacherId = parts[2];

        if (teacherId === userProfile.uid) {
          studentUidsSet.add(studentId);
          if (!threadsMap[studentId]) {
            threadsMap[studentId] = msg.content;
          }
        }
      });

      // Get student profiles for these threads
      const studentProfiles: { student: UserProfile; lastMessage: string }[] = [];
      for (const studId of Array.from(studentUidsSet)) {
        const stud = students.find(s => s.uid === studId);
        if (stud) {
          studentProfiles.push({ student: stud, lastMessage: threadsMap[studId] });
        } else {
          // If profile not loaded yet, query it
          try {
            const docSnap = await getDocs(query(collection(db, "users"), where("uid", "==", studId)));
            docSnap.forEach((sd) => {
              const profile = sd.data() as UserProfile;
              studentProfiles.push({ student: profile, lastMessage: threadsMap[studId] });
            });
          } catch (e) {
            console.error(e);
          }
        }
      }
      setPmThreads(studentProfiles);
    });

    return () => unsub();
  }, [students, userProfile.uid]);

  // 7. Listen to Active PM conversation messages
  useEffect(() => {
    if (!selectedStudentPm) return;
    const chatId = `pm_${selectedStudentPm.uid}_${userProfile.uid}`;
    const q = query(
      collection(db, "messages"),
      where("chatId", "==", chatId)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = [];
      snapshot.forEach((d) => {
        msgs.push({ id: d.id, ...d.data() } as ChatMessage);
      });
      // Sort in-memory ascending by createdAt safely, then take the last 100 messages
      msgs.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeA - timeB;
      });
      setPmMessages(msgs.slice(-100));
      setTimeout(() => pmEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });

    return () => unsub();
  }, [selectedStudentPm, userProfile.uid]);

  // APPROVAL HANDLERS
  const handleApproveUser = async (studentId: string) => {
    await updateDoc(doc(db, "users", studentId), {
      approved: true
    });
  };

  const handleRejectUser = async (studentId: string) => {
    await deleteDoc(doc(db, "users", studentId));
  };

  // CART HANDLERS
  const addToCart = (itemName: string) => {
    setCart(prev => ({
      ...prev,
      [itemName]: (prev[itemName] || 0) + 1
    }));
  };

  const removeFromCart = (itemName: string) => {
    setCart(prev => {
      const next = { ...prev };
      if (next[itemName] <= 1) {
        delete next[itemName];
      } else {
        next[itemName]--;
      }
      return next;
    });
  };

  const clearCart = () => {
    setCart({});
  };

  const addCustomItemToCart = () => {
    if (!customItem.trim()) return;
    addToCart(customItem.trim());
    setCustomItem("");
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.keys(cart).length === 0) return;

    let scheduleString: string | null = null;
    if (isScheduled && scheduledDate && scheduledTime) {
      scheduleString = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
    }

    const requestId = `req_${Date.now()}`;
    const requestData: MaterialRequest = {
      id: requestId,
      teacherId: userProfile.uid,
      teacherName: userProfile.name,
      section: targetSection,
      items: cart,
      message: alertMessage.trim(),
      scheduledFor: scheduleString,
      createdAt: new Date().toISOString(),
      active: true
    };

    await setDoc(doc(db, "requests", requestId), requestData);
    
    // Clear state
    setCart({});
    setAlertMessage("");
    setIsScheduled(false);
    setScheduledDate("");
    setScheduledTime("");
    alert("Checkout completed! Material alert broadcasted successfully to Section " + targetSection + ".");
  };

  const handleToggleAlertActive = async (alertId: string, currentStatus: boolean) => {
    await updateDoc(doc(db, "requests", alertId), {
      active: !currentStatus
    });
  };

  const handleDeleteAlert = async (alertId: string) => {
    if (confirm("Are you sure you want to delete this material request history?")) {
      await deleteDoc(doc(db, "requests", alertId));
    }
  };

  // GRADE HANDLERS
  const loadStudentGradeDetails = (student: UserProfile) => {
    setSelectedStudentGrade(student);
    const existing = studentGradesList.find(g => g.studentId === student.uid);
    if (existing) {
      setGradeFeedback(existing.feedback || "");
      setGradeBehavior(existing.behaviourNotes || "");
    } else {
      setGradeFeedback("");
      setGradeBehavior("");
    }
  };

  const handleAddGradeActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentGrade || !activityTitle.trim() || activityScore === "" || activityMaxScore === "") return;

    const gradeId = `${selectedStudentGrade.uid}_${gradeSubject.replace(/\s+/g, "")}`;
    const existing = studentGradesList.find(g => g.studentId === selectedStudentGrade.uid);

    const newActivity = {
      title: activityTitle.trim(),
      score: Number(activityScore),
      maxScore: Number(activityMaxScore)
    };

    const updatedGrades = existing ? [...existing.grades, newActivity] : [newActivity];

    const gradeData: StudentGrade = {
      id: gradeId,
      studentId: selectedStudentGrade.uid,
      studentName: selectedStudentGrade.name,
      section: gradeSection,
      subject: gradeSubject,
      grades: updatedGrades,
      feedback: gradeFeedback.trim(),
      behaviourNotes: gradeBehavior.trim(),
      updatedBy: userProfile.name,
      updatedAt: new Date().toISOString()
    };

    await setDoc(doc(db, "grades", gradeId), gradeData);

    // Reset activity inputs
    setActivityTitle("");
    setActivityScore("");
    setActivityMaxScore("");
    alert("Score successfully added to " + selectedStudentGrade.name + "'s register.");
  };

  const handleUpdateFeedback = async () => {
    if (!selectedStudentGrade) return;

    const gradeId = `${selectedStudentGrade.uid}_${gradeSubject.replace(/\s+/g, "")}`;
    const existing = studentGradesList.find(g => g.studentId === selectedStudentGrade.uid);

    const gradeData: StudentGrade = {
      id: gradeId,
      studentId: selectedStudentGrade.uid,
      studentName: selectedStudentGrade.name,
      section: gradeSection,
      subject: gradeSubject,
      grades: existing ? existing.grades : [],
      feedback: gradeFeedback.trim(),
      behaviourNotes: gradeBehavior.trim(),
      updatedBy: userProfile.name,
      updatedAt: new Date().toISOString()
    };

    await setDoc(doc(db, "grades", gradeId), gradeData);
    alert("Feedback & behavior notes updated for " + selectedStudentGrade.name + ".");
  };

  const handleDeleteGradeActivityItem = async (studentId: string, index: number) => {
    const existing = studentGradesList.find(g => g.studentId === studentId);
    if (!existing) return;

    if (confirm("Remove this score entry?")) {
      const updated = [...existing.grades];
      updated.splice(index, 1);

      await updateDoc(doc(db, "grades", existing.id), {
        grades: updated,
        updatedBy: userProfile.name,
        updatedAt: new Date().toISOString()
      });
    }
  };

  // ATTENDANCE HANDLERS
  const handleToggleAttendance = (studentId: string, status: "present" | "absent" | "late") => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleSaveAttendance = async () => {
    // Populate default "present" for any students not marked yet
    const finalRecords: Record<string, "present" | "absent" | "late"> = {};
    const sectionStudents = students.filter(s => s.section === attSection);
    
    sectionStudents.forEach(s => {
      finalRecords[s.uid] = attendanceRecords[s.uid] || "present";
    });

    const attendanceId = `${attSection}_${attSubject.replace(/\s+/g, "")}_${attDate}`;
    const attendanceData: AttendanceRecord = {
      id: attendanceId,
      section: attSection,
      subject: attSubject,
      date: attDate,
      records: finalRecords,
      notes: attendanceNotes.trim(),
      updatedBy: userProfile.uid,
      updatedAt: new Date().toISOString()
    };

    await setDoc(doc(db, "attendance", attendanceId), attendanceData);
    alert("Attendance logged successfully for " + attSection + " (" + attDate + ").");
  };

  // CHAT HANDLERS
  const handleSendChatMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatMsg.trim()) return;

    const chatId = `${chatSection}_${chatSubject.replace(/\s+/g, "")}`;
    const msgData = {
      chatId,
      type: "subject",
      section: chatSection,
      subject: chatSubject,
      senderId: userProfile.uid,
      senderName: userProfile.name,
      senderRole: "teacher",
      content: newChatMsg.trim(),
      createdAt: Timestamp.now()
    };

    setNewChatMsg("");
    await addDoc(collection(db, "messages"), msgData);
  };

  // PM HANDLERS
  const handleSendPmMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPmMsg.trim() || !selectedStudentPm) return;

    const chatId = `pm_${selectedStudentPm.uid}_${userProfile.uid}`;
    const msgData = {
      chatId,
      type: "pm",
      senderId: userProfile.uid,
      senderName: userProfile.name,
      senderRole: "teacher",
      recipientId: selectedStudentPm.uid,
      participants: [selectedStudentPm.uid, userProfile.uid],
      content: newPmMsg.trim(),
      createdAt: Timestamp.now()
    };

    setNewPmMsg("");
    await addDoc(collection(db, "messages"), msgData);
  };

  const handleSignOut = async () => {
    await signOut(auth);
    onLogout();
  };

  const filteredStudentsForGrades = students.filter(s => s.section === gradeSection);
  const filteredStudentsForAttendance = students.filter(s => s.section === attSection);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" id="teacher_dashboard">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-40 px-6 py-4 flex items-center justify-between" id="teacher_header">
        <div className="flex items-center gap-3">
          <div className="bg-rose-600 text-white p-2 rounded-lg">
            <UserCheck size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold font-display text-slate-800">Grade 9 Educator Console</h1>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">{userProfile.name}</span>
              <span>•</span>
              <span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded font-bold uppercase text-[9px] tracking-wider">
                Approved Faculty Member
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-3.5 py-1.5 border border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-100 rounded-lg text-xs font-semibold transition-all"
          id="btn_teacher_logout"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </header>

      <div className="flex-1 flex max-w-7xl w-full mx-auto p-4 gap-4" id="teacher_main_container">
        {/* Left Side Navigation Menu */}
        <nav className="w-60 shrink-0 bg-white border border-slate-100 rounded-xl p-4 flex flex-col gap-1 shadow-sm h-[calc(100vh-120px)] sticky top-[90px]" id="teacher_nav">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">Faculty Management</p>
          
          <button
            onClick={() => setActiveTab("request")}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "request"
                ? "bg-rose-50 text-rose-700"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
            id="nav_req_materials"
          >
            <ShoppingCart size={16} />
            Request Materials
          </button>

          <button
            onClick={() => setActiveTab("approvals")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "approvals"
                ? "bg-rose-50 text-rose-700"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
            id="nav_pending_approvals"
          >
            <span className="flex items-center gap-2.5">
              <UserCheck size={16} />
              Pending Approvals
            </span>
            {pendingUsers.length > 0 && (
              <span className="bg-rose-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pendingUsers.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("grades")}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "grades"
                ? "bg-rose-50 text-rose-700"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
            id="nav_teacher_grades"
          >
            <FileText size={16} />
            Grade Management
          </button>

          <button
            onClick={() => setActiveTab("attendance")}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "attendance"
                ? "bg-rose-50 text-rose-700"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
            id="nav_teacher_attendance"
          >
            <Activity size={16} />
            Attendance Tracking
          </button>

          <button
            onClick={() => setActiveTab("chats")}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "chats"
                ? "bg-rose-50 text-rose-700"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
            id="nav_teacher_chats"
          >
            <MessageSquare size={16} />
            Section Chatrooms
          </button>

          <button
            onClick={() => setActiveTab("pms")}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "pms"
                ? "bg-rose-50 text-rose-700"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
            id="nav_teacher_pms"
          >
            <span className="flex items-center gap-2.5">
              <User size={16} />
              Student PM Inbox
            </span>
            {pmThreads.length > 0 && (
              <span className="bg-slate-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pmThreads.length}
              </span>
            )}
          </button>
        </nav>

        {/* Dynamic Center Work Area */}
        <main className="flex-1 min-w-0" id="teacher_workspace">
          <AnimatePresence mode="wait">
            
            {/* Tab: approvals */}
            {activeTab === "approvals" && (
              <motion.div
                key="approvals"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm">
                  <h2 className="text-lg font-bold font-display text-slate-800">Student Sign Up Approvals</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    To prevent students from creating fake accounts or spying on other Grade 9 sections, all student registrations remain locked until explicitly approved by an educator here.
                  </p>
                </div>

                {pendingUsers.length === 0 ? (
                  <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-8 rounded-xl text-center flex flex-col items-center">
                    <Check size={36} className="text-emerald-500 mb-2" />
                    <h3 className="font-semibold text-sm">Approvals Queue is Empty!</h3>
                    <p className="text-xs text-emerald-600 mt-1">
                      No student accounts are currently awaiting secure review.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-100 rounded-xl shadow-sm divide-y divide-slate-100" id="approvals_list">
                    {pendingUsers.map((pending) => (
                      <div key={pending.uid} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                            {pending.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 text-sm">{pending.name}</h4>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                              <span>{pending.email}</span>
                              <span>•</span>
                              <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded font-semibold uppercase text-[8px]">
                                Section {pending.section}
                              </span>
                              <span>•</span>
                              <span>Registered: {new Date(pending.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRejectUser(pending.uid)}
                            className="p-1.5 border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-100 rounded-lg text-xs transition-all flex items-center gap-1 font-semibold"
                            id={`reject_student_${pending.uid}`}
                          >
                            <X size={14} />
                            Reject / Deny
                          </button>
                          <button
                            onClick={() => handleApproveUser(pending.uid)}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1"
                            id={`approve_student_${pending.uid}`}
                          >
                            <Check size={14} />
                            Approve Access
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Tab: material request (Cart-like Notify system) */}
            {activeTab === "request" && (
              <motion.div
                key="request"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-4"
              >
                {/* Left side: Item Selection Catalog */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm">
                    <h2 className="text-base font-bold font-display text-slate-800">Materials Request Catalog</h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Assemble items that students should bring out or have on their desks before you arrive. Add items to your checkout cart.
                    </p>
                  </div>

                  {/* Catalog Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="materials_catalog_grid">
                    {MATERIAL_CATALOG.map((item) => {
                      const countInCart = cart[item.name] || 0;
                      return (
                        <div key={item.id} className="bg-white border border-slate-100 rounded-xl p-4 flex items-center justify-between shadow-sm hover:border-indigo-100 transition-all">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{item.category}</span>
                            <span className="text-xs font-semibold text-slate-800 mt-0.5 block">{item.name}</span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            {countInCart > 0 && (
                              <>
                                <button
                                  onClick={() => removeFromCart(item.name)}
                                  className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg flex items-center justify-center transition-all text-xs"
                                  id={`remove_item_${item.id}`}
                                >
                                  <Minus size={12} />
                                </button>
                                <span className="w-6 text-center text-xs font-bold text-slate-800">{countInCart}</span>
                              </>
                            )}
                            <button
                              onClick={() => addToCart(item.name)}
                              className="w-7 h-7 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center transition-all text-xs"
                              id={`add_item_${item.id}`}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Custom item input */}
                  <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm flex gap-2 items-center">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Custom material item</label>
                      <input
                        type="text"
                        placeholder="e.g. protractor, science workbook page 20"
                        value={customItem}
                        onChange={(e) => setCustomItem(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800"
                        id="input_custom_material"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addCustomItemToCart}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-all self-end"
                      id="btn_add_custom_item"
                    >
                      Add Custom
                    </button>
                  </div>

                  {/* Recent Broadcasts */}
                  <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm">
                    <h3 className="font-bold text-sm text-slate-800 font-display mb-3">Recently Broadcasted Alerts</h3>
                    {recentAlerts.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No previous alerts found.</p>
                    ) : (
                      <div className="space-y-3.5 max-h-60 overflow-y-auto" id="recent_alerts_container">
                        {recentAlerts.map((alert) => (
                          <div key={alert.id} className="border border-slate-100 rounded-lg p-3 text-xs bg-slate-50 flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="font-semibold text-slate-800 capitalize bg-white px-2 py-0.5 border border-slate-200 rounded text-[10px]">
                                  Section {alert.section}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {new Date(alert.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="font-medium text-slate-700">
                                {Object.entries(alert.items).map(([n, q]) => `${n} (${q}x)`).join(", ")}
                              </p>
                              {alert.message && (
                                <p className="text-slate-500 italic mt-1 font-mono">"{alert.message}"</p>
                              )}
                              {alert.scheduledFor && (
                                <div className="text-[10px] text-indigo-600 font-semibold mt-1 flex items-center gap-1">
                                  <Clock size={10} />
                                  Scheduled: {new Date(alert.scheduledFor).toLocaleString()}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleToggleAlertActive(alert.id, alert.active)}
                                className={`px-2 py-1 rounded text-[10px] font-bold ${
                                  alert.active 
                                    ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" 
                                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                }`}
                                id={`toggle_active_${alert.id}`}
                              >
                                {alert.active ? "Active (Broadcasted)" : "Muted"}
                              </button>
                              <button
                                onClick={() => handleDeleteAlert(alert.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition-all"
                                id={`delete_alert_${alert.id}`}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side: Checkout & Setup Pane */}
                <div className="space-y-4">
                  <div className="bg-white border-2 border-indigo-100 rounded-xl p-5 shadow-sm sticky top-[90px]" id="checkout_cart_pane">
                    <h3 className="font-bold text-sm text-slate-800 font-display pb-3 border-b border-slate-100 flex items-center gap-2">
                      <ShoppingCart className="text-indigo-600" size={16} />
                      Checkout cart
                    </h3>

                    {Object.keys(cart).length === 0 ? (
                      <div className="py-12 text-center text-slate-400 text-xs">
                        <AlertCircle className="mx-auto text-slate-300 mb-2" size={24} />
                        Cart is empty. Add materials from the catalog first!
                      </div>
                    ) : (
                      <form onSubmit={handleCheckout} className="space-y-4 mt-3">
                        {/* Cart items listing */}
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                          {Object.entries(cart).map(([name, qty]) => (
                            <div key={name} className="flex justify-between items-center text-xs bg-slate-50 rounded border border-slate-100 py-1.5 px-3">
                              <span className="font-medium text-slate-700 truncate mr-2">{name}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-bold text-indigo-600">Qty: {qty}</span>
                                <button
                                  type="button"
                                  onClick={() => removeFromCart(name)}
                                  className="text-slate-400 hover:text-rose-600"
                                  id={`checkout_remove_${name.replace(/\s+/g, "")}`}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={clearCart}
                          className="text-right block w-full text-[10px] font-bold text-rose-600 hover:underline mb-2"
                          id="btn_clear_cart"
                        >
                          Clear All Items
                        </button>

                        {/* Select Target Section */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Target Section (broadcast to students)
                          </label>
                          <select
                            value={targetSection}
                            onChange={(e) => setTargetSection(e.target.value as any)}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 capitalize"
                            id="checkout_select_section"
                          >
                            {SECTIONS.map((sec) => (
                              <option key={sec} value={sec}>
                                {sec}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Custom Short Sentence Message */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Short Notification Message
                          </label>
                          <textarea
                            placeholder="e.g. Please ready these before our quiz, thank you!"
                            value={alertMessage}
                            onChange={(e) => setAlertMessage(e.target.value)}
                            maxLength={100}
                            rows={2}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 text-left"
                            id="checkout_custom_message"
                          />
                        </div>

                        {/* Presets and scheduling */}
                        <div className="bg-indigo-50/50 rounded-lg p-3 border border-indigo-100 space-y-2">
                          <label className="flex items-center gap-2 text-[10px] font-bold text-indigo-900 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isScheduled}
                              onChange={(e) => setIsScheduled(e.target.checked)}
                              className="rounded text-indigo-600 focus:ring-0"
                              id="checkout_checkbox_schedule"
                            />
                            Schedule alert for future date &amp; time
                          </label>

                          {isScheduled && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              className="grid grid-cols-2 gap-2 mt-1.5"
                              id="checkout_schedule_inputs"
                            >
                              <div>
                                <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Date</label>
                                <input
                                  type="date"
                                  required
                                  value={scheduledDate}
                                  onChange={(e) => setScheduledDate(e.target.value)}
                                  className="w-full px-2 py-1 border border-indigo-200 rounded text-[10px] bg-white text-slate-700 focus:outline-none"
                                  id="schedule_date"
                                />
                              </div>
                              <div>
                                <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Time</label>
                                <input
                                  type="time"
                                  required
                                  value={scheduledTime}
                                  onChange={(e) => setScheduledTime(e.target.value)}
                                  className="w-full px-2 py-1 border border-indigo-200 rounded text-[10px] bg-white text-slate-700 focus:outline-none"
                                  id="schedule_time"
                                />
                              </div>
                            </motion.div>
                          )}
                        </div>

                        {/* Broadcast button */}
                        <button
                          type="submit"
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 rounded-lg transition-all shadow-md flex items-center justify-center gap-1.5"
                          id="btn_checkout_submit"
                        >
                          <Bell size={12} />
                          {isScheduled ? "Preset & Schedule Alert" : "Checkout & Send Alert Now"}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tab: grades */}
            {activeTab === "grades" && (
              <motion.div
                key="grades"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-4"
              >
                {/* Section filter and student list */}
                <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm space-y-4">
                  <div>
                    <h2 className="text-base font-bold font-display text-slate-800">Gradebook Setup</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Select section &amp; subject to access student score folders.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Section</label>
                      <select
                        value={gradeSection}
                        onChange={(e) => { setGradeSection(e.target.value as any); setSelectedStudentGrade(null); }}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none text-slate-700 capitalize"
                        id="grade_select_section"
                      >
                        {SECTIONS.map((sec) => (
                          <option key={sec} value={sec}>
                            {sec}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Subject</label>
                      <select
                        value={gradeSubject}
                        onChange={(e) => { setGradeSubject(e.target.value); setSelectedStudentGrade(null); }}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none text-slate-700"
                        id="grade_select_subject"
                      >
                        {availableSubjects.map((sub) => (
                          <option key={sub} value={sub}>
                            {sub}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Student list */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Students in Section</p>
                    {filteredStudentsForGrades.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">No students approved for section {gradeSection} yet.</p>
                    ) : (
                      <div className="space-y-1 max-h-80 overflow-y-auto">
                        {filteredStudentsForGrades.map((stud) => {
                          const existingRecord = studentGradesList.find(g => g.studentId === stud.uid);
                          const isSelected = selectedStudentGrade?.uid === stud.uid;
                          return (
                            <button
                              key={stud.uid}
                              onClick={() => loadStudentGradeDetails(stud)}
                              className={`w-full text-left p-2.5 rounded-lg text-xs flex justify-between items-center transition-all border ${
                                isSelected 
                                  ? "bg-rose-50 border-rose-100 text-rose-700 font-semibold" 
                                  : "bg-slate-50 border-transparent hover:bg-slate-100/50 text-slate-700"
                              }`}
                              id={`grade_student_${stud.uid}`}
                            >
                              <span className="truncate">{stud.name}</span>
                              {existingRecord && existingRecord.grades.length > 0 && (
                                <span className="text-[10px] bg-rose-100/50 text-rose-700 px-1.5 py-0.2 rounded font-bold shrink-0">
                                  {existingRecord.grades.length} Graded
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Main grade card & inputs */}
                <div className="lg:col-span-2 space-y-4">
                  {selectedStudentGrade ? (
                    <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm space-y-5">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <div>
                          <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Currently Editing</span>
                          <h3 className="font-bold text-base text-slate-800 font-display">{selectedStudentGrade.name}</h3>
                          <p className="text-xs text-slate-400">{gradeSubject} • Grade 9 Section {gradeSection}</p>
                        </div>
                      </div>

                      {/* Score additions form */}
                      <form onSubmit={handleAddGradeActivity} className="bg-slate-50 p-4 border border-slate-100 rounded-xl space-y-3">
                        <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                          <Plus size={14} />
                          Log New Score Entry (Quiz, Task, Exam)
                        </h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Activity Title</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Quiz 1: Genetics"
                              value={activityTitle}
                              onChange={(e) => setActivityTitle(e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 rounded text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-rose-500"
                              id="input_activity_title"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Student Score</label>
                            <input
                              type="number"
                              required
                              placeholder="e.g. 24"
                              value={activityScore}
                              onChange={(e) => setActivityScore(e.target.value === "" ? "" : Number(e.target.value))}
                              className="w-full px-2 py-1 border border-slate-200 rounded text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-rose-500"
                              id="input_activity_score"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Max Score</label>
                            <input
                              type="number"
                              required
                              placeholder="e.g. 30"
                              value={activityMaxScore}
                              onChange={(e) => setActivityMaxScore(e.target.value === "" ? "" : Number(e.target.value))}
                              className="w-full px-2 py-1 border border-slate-200 rounded text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-rose-500"
                              id="input_activity_max"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-bold transition-all shadow"
                          id="btn_add_activity_score"
                        >
                          Add Record Entry
                        </button>
                      </form>

                      {/* Current Activity scores list */}
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scored Activities Breakdown:</h4>
                        {(() => {
                          const existing = studentGradesList.find(g => g.studentId === selectedStudentGrade.uid);
                          if (!existing || existing.grades.length === 0) {
                            return <p className="text-xs text-slate-400 italic">No score records added for this class segment yet.</p>;
                          }
                          return (
                            <div className="space-y-1.5 max-h-40 overflow-y-auto" id="grades_history_list">
                              {existing.grades.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-xs py-1.5 px-3 bg-slate-50 rounded border border-slate-100">
                                  <div>
                                    <span className="font-semibold text-slate-700">{item.title}</span>
                                    <span className="text-[10px] text-slate-400 block">Logged Score Entry</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="font-mono font-bold text-slate-800 text-sm">{item.score} / {item.maxScore}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteGradeActivityItem(selectedStudentGrade.uid, idx)}
                                      className="text-slate-400 hover:text-rose-600"
                                      id={`delete_activity_score_${idx}`}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Feedback remarks and Behaviour logging */}
                      <div className="space-y-3.5 border-t border-slate-100 pt-4">
                        <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wide">Educator Evaluation Notes</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Academic Feedback / Advice</label>
                            <textarea
                              placeholder="Add homework feedback, suggestions, areas of struggle..."
                              value={gradeFeedback}
                              onChange={(e) => setGradeFeedback(e.target.value)}
                              rows={3}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-rose-500 text-slate-700"
                              id="input_grade_feedback"
                            />
                          </div>

                          <div>
                            <label className="block text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Behavior &amp; Classroom Participation Remarks</label>
                            <textarea
                              placeholder="Log behavior notes, class contributions, cooperativeness..."
                              value={gradeBehavior}
                              onChange={(e) => setGradeBehavior(e.target.value)}
                              rows={3}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-rose-500 text-slate-700"
                              id="input_grade_behavior"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleUpdateFeedback}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold transition-all shadow"
                          id="btn_update_feedback"
                        >
                          Save Notes &amp; Remarks
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full bg-white border border-slate-100 rounded-xl p-8 flex flex-col items-center justify-center text-center text-slate-400 shadow-sm">
                      <Award size={48} className="stroke-[1.2] mb-3 text-slate-300 animate-pulse" />
                      <h3 className="font-bold text-slate-700 text-sm font-display">Academic Gradebook Editor</h3>
                      <p className="text-xs max-w-sm mt-1 leading-relaxed">
                        Select a verified student from the left column list to review past activities, publish quiz marks, and log behavioral observations.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Tab: attendance */}
            {activeTab === "attendance" && (
              <motion.div
                key="attendance"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* Configuration header */}
                <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm space-y-4">
                  <div>
                    <h2 className="text-base font-bold font-display text-slate-800">Daily Attendance Tracking</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Automated registration logs for class analytics and reporting.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Section</label>
                      <select
                        value={attSection}
                        onChange={(e) => setAttSection(e.target.value as any)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none text-slate-700 capitalize"
                        id="attendance_select_section"
                      >
                        {SECTIONS.map((sec) => (
                          <option key={sec} value={sec}>
                            {sec}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Subject Period</label>
                      <select
                        value={attSubject}
                        onChange={(e) => setAttSubject(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none text-slate-700"
                        id="attendance_select_subject"
                      >
                        {availableSubjects.map((sub) => (
                          <option key={sub} value={sub}>
                            {sub}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Class Session Date</label>
                      <input
                        type="date"
                        value={attDate}
                        onChange={(e) => setAttDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none text-slate-700"
                        id="attendance_select_date"
                      />
                    </div>
                  </div>
                </div>

                {/* Registry panel */}
                <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700 uppercase tracking-wider">Class Registry list</span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded">
                      Approved Section Students: {filteredStudentsForAttendance.length}
                    </span>
                  </div>

                  {filteredStudentsForAttendance.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs italic">
                      No students registered or approved under section {attSection} yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100" id="attendance_student_list">
                      {filteredStudentsForAttendance.map((student) => {
                        const status = attendanceRecords[student.uid] || "present";
                        return (
                          <div key={student.uid} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/20">
                            <div>
                              <span className="font-bold text-slate-800 text-xs">{student.name}</span>
                              <span className="text-[10px] text-slate-400 block">{student.email}</span>
                            </div>

                            {/* Status toggles */}
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleAttendance(student.uid, "present")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                  status === "present"
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                    : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
                                }`}
                                id={`att_present_${student.uid}`}
                              >
                                Present
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleAttendance(student.uid, "late")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                  status === "late"
                                    ? "bg-amber-50 border-amber-200 text-amber-700"
                                    : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
                                }`}
                                id={`att_late_${student.uid}`}
                              >
                                Late
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleAttendance(student.uid, "absent")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                  status === "absent"
                                    ? "bg-rose-50 border-rose-200 text-rose-700"
                                    : "bg-white border-slate-100 text-slate-500 hover:bg-slate-50"
                                }`}
                                id={`att_absent_${student.uid}`}
                              >
                                Absent
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Remarks input and Save */}
                  {filteredStudentsForAttendance.length > 0 && (
                    <div className="p-5 border-t border-slate-100 bg-slate-50/30 space-y-4">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Session behavior / absence remarks</label>
                        <input
                          type="text"
                          placeholder="e.g. Completed genetics laboratory experiment seamlessly. 2 students had excused absences."
                          value={attendanceNotes}
                          onChange={(e) => setAttendanceNotes(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-rose-500 text-slate-700"
                          id="attendance_notes"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleSaveAttendance}
                        className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold transition-all shadow"
                        id="btn_save_attendance_records"
                      >
                        Publish Attendance Sheet
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Tab: chats */}
            {activeTab === "chats" && (
              <motion.div
                key="chats"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white border border-slate-100 rounded-xl shadow-sm flex h-[calc(100vh-120px)] overflow-hidden"
              >
                {/* Rooms selection sidebar */}
                <div className="w-56 border-r border-slate-100 bg-slate-50/50 p-3 flex flex-col gap-4 overflow-y-auto">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1">Class Section</label>
                    <select
                      value={chatSection}
                      onChange={(e) => setChatSection(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none text-slate-700 capitalize"
                      id="chats_sidebar_select_section"
                    >
                      {SECTIONS.map((sec) => (
                        <option key={sec} value={sec}>
                          {sec}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1 flex flex-col gap-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-1.5">Subject Chats</p>
                    {availableSubjects.map((sub) => (
                      <button
                        key={sub}
                        onClick={() => setChatSubject(sub)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium truncate transition-all ${
                          chatSubject === sub
                            ? "bg-rose-50 text-rose-700 border border-rose-100 font-semibold"
                            : "text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent"
                        }`}
                        id={`teacher_select_subject_chat_${sub.replace(/\s+/g, "")}`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chat window panel */}
                <div className="flex-1 flex flex-col h-full">
                  <div className="border-b border-slate-100 px-4 py-3 bg-white flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800">{chatSubject} Chatroom</h3>
                      <p className="text-[10px] text-rose-600 font-bold uppercase tracking-wider">Moderating Section {chatSection}</p>
                    </div>
                  </div>

                  {/* Messages container */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
                    {chatMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                        <MessageSquare size={32} className="stroke-[1.5] mb-2 text-slate-300" />
                        <p className="text-xs">No active messages in this chatroom segment yet.</p>
                      </div>
                    ) : (
                      chatMessages.map((msg) => {
                        const isMe = msg.senderId === userProfile.uid;
                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                          >
                            <div className={`max-w-[70%] rounded-xl p-3 text-xs shadow-sm border ${
                              isMe 
                                ? "bg-rose-600 text-white border-rose-700 rounded-br-none" 
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

                  {/* Send Form */}
                  <form onSubmit={handleSendChatMsg} className="p-3 border-t border-slate-100 flex gap-2 bg-white">
                    <input
                      type="text"
                      placeholder={`Post instructions to Section ${chatSection} ${chatSubject}...`}
                      value={newChatMsg}
                      onChange={(e) => setNewChatMsg(e.target.value)}
                      className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 text-slate-800"
                      id="teacher_chat_input"
                    />
                    <button
                      type="submit"
                      disabled={!newChatMsg.trim()}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-lg text-xs font-semibold transition-all flex items-center justify-center shrink-0"
                      id="btn_teacher_send_msg"
                    >
                      <Send size={14} />
                    </button>
                  </form>
                </div>
              </motion.div>
            )}

            {/* Tab: pms */}
            {activeTab === "pms" && (
              <motion.div
                key="pms"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white border border-slate-100 rounded-xl shadow-sm flex h-[calc(100vh-120px)] overflow-hidden"
              >
                {/* Inbox Threads List */}
                <div className="w-64 border-r border-slate-100 bg-slate-50/50 p-3 flex flex-col gap-1 overflow-y-auto">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">Student PM Channels</p>
                  {pmThreads.length === 0 ? (
                    <p className="text-[10px] text-slate-400 p-2 italic leading-relaxed">No student inquiries received yet.</p>
                  ) : (
                    pmThreads.map((thread) => (
                      <button
                        key={thread.student.uid}
                        onClick={() => setSelectedStudentPm(thread.student)}
                        className={`w-full text-left p-2.5 rounded-lg text-xs flex flex-col gap-1 transition-all border ${
                          selectedStudentPm?.uid === thread.student.uid
                            ? "bg-rose-50 border-rose-100 font-semibold text-rose-700"
                            : "bg-white border-transparent hover:bg-slate-50 text-slate-600"
                        }`}
                        id={`teacher_select_pm_${thread.student.uid}`}
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className="font-bold text-slate-800 truncate text-[11px]">{thread.student.name}</span>
                          <span className="bg-slate-100 text-slate-500 px-1 py-0.2 rounded uppercase text-[8px]">
                            {thread.student.section}
                          </span>
                        </div>
                        <span className="truncate text-[10px] text-slate-400">{thread.lastMessage}</span>
                      </button>
                    ))
                  )}
                </div>

                {/* Conversation Panel */}
                <div className="flex-1 flex flex-col h-full">
                  {selectedStudentPm ? (
                    <>
                      <div className="border-b border-slate-100 px-4 py-3 bg-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center text-xs">
                            {selectedStudentPm.name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="text-xs font-bold text-slate-800">Direct Message: {selectedStudentPm.name}</h3>
                            <p className="text-[10px] text-slate-400">Class Section: {selectedStudentPm.section}</p>
                          </div>
                        </div>
                      </div>

                      {/* Messages area */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
                        {pmMessages.map((msg) => {
                          const isMe = msg.senderId === userProfile.uid;
                          return (
                            <div
                              key={msg.id}
                              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                            >
                              <div className={`max-w-[70%] rounded-xl p-3 text-xs shadow-sm border ${
                                isMe 
                                  ? "bg-rose-600 text-white border-rose-700 rounded-br-none" 
                                  : "bg-white text-slate-800 border-slate-100 rounded-bl-none"
                              }`}>
                                <p className="leading-relaxed break-words">{msg.content}</p>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={pmEndRef} />
                      </div>

                      {/* Message input */}
                      <form onSubmit={handleSendPmMsg} className="p-3 border-t border-slate-100 flex gap-2 bg-white">
                        <input
                          type="text"
                          placeholder={`Message ${selectedStudentPm.name} securely...`}
                          value={newPmMsg}
                          onChange={(e) => setNewPmMsg(e.target.value)}
                          className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 text-slate-800"
                          id="teacher_pm_chat_input"
                        />
                        <button
                          type="submit"
                          disabled={!newPmMsg.trim()}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-lg text-xs font-semibold transition-all flex items-center justify-center shrink-0"
                          id="btn_teacher_send_pm"
                        >
                          <Send size={14} />
                        </button>
                      </form>
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                      <User size={48} className="stroke-[1.2] mb-3 text-slate-300" />
                      <h3 className="font-semibold text-slate-700 text-sm">Direct PM Channels</h3>
                      <p className="text-xs max-w-sm mt-1 leading-relaxed">
                        Select a pending or active student thread from the left list to answer inquiries, review specific records, or address private feedback requests.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
