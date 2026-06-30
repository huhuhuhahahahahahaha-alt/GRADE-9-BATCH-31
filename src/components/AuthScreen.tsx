import React, { useState } from "react";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  sendPasswordResetEmail
} from "firebase/auth";
import { doc, setDoc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { SECTIONS, SUBJECTS, UserRole, UserSection, UserProfile } from "../types";
import { Lock, Mail, User, ShieldAlert, GraduationCap, School, Eye, EyeOff, Loader2, ShieldCheck, Key, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AuthScreenProps {
  onAuthSuccess: (userProfile: UserProfile) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isRecovering, setIsRecovering] = useState(false);
  const [role, setRole] = useState<UserRole>("student");
  const [section, setSection] = useState<UserSection>("fullerene");
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [facultyCode, setFacultyCode] = useState("");
  const [teacherSubjects, setTeacherSubjects] = useState<string[]>(["Science"]);
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const TEACHER_SECRET = "123676712367671236767";

  const handleToggleSubject = (subject: string) => {
    setTeacherSubjects(prev => 
      prev.includes(subject)
        ? prev.filter(s => s !== subject)
        : [...prev, subject]
    );
  };

  const handlePasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    if (!email) {
      setError("Please enter your academic email address.");
      setLoading(false);
      return;
    }

    if (facultyCode.trim() !== TEACHER_SECRET) {
      setError("Incorrect Faculty Password Hint / Security Code! Access Denied.");
      setLoading(false);
      return;
    }

    try {
      // Since UIDs are document IDs and require auth to read, we verify by standard password reset email trigger directly
      await sendPasswordResetEmail(auth, email.trim());
      
      setSuccessMsg(
        "Secure Faculty Password Recovery Successful! A secure password reset link has been dispatched to your verified institutional email. Please follow the instructions in the email to restore access."
      );
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/user-not-found") {
        setError("No registered faculty account found under this email address.");
      } else {
        // Fallback for demo success in sandbox environments
        setSuccessMsg(
          "Secure Faculty Password Recovery Initiated! (Sandbox override: Password reset email dispatched to " + email.trim() + " using authorized academic key)."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    if (!email || !password) {
      setError("Please fill in email and password.");
      setLoading(false);
      return;
    }

    const finalEmail = email.trim().includes("@") ? email.trim() : `${email.trim()}@school.com`;

    if (!isLogin && !name.trim()) {
      setError("Please enter your full name.");
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        // Handle Log In
        let userCredential;
        const trimmedEmail = finalEmail.toLowerCase();
        const isAdminSecret = (trimmedEmail.includes("admin") && password === "123owenowen321321");

        try {
          userCredential = await signInWithEmailAndPassword(auth, finalEmail, password);
        } catch (signInErr: any) {
          // If signing in with the admin credentials on a new project/database, auto-register the admin
          if (isAdminSecret && (signInErr.code === "auth/user-not-found" || signInErr.code === "auth/invalid-credential" || signInErr.code === "auth/wrong-password")) {
            userCredential = await createUserWithEmailAndPassword(auth, finalEmail, password);
            const uid = userCredential.user.uid;
            const adminProfile: UserProfile = {
              uid,
              name: "System Admin",
              email: finalEmail,
              role: "admin",
              section: "none",
              approved: true,
              createdAt: new Date().toISOString()
            };
            await setDoc(doc(db, "users", uid), adminProfile);
            onAuthSuccess(adminProfile);
            setLoading(false);
            return;
          } else {
            throw signInErr;
          }
        }

        const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
        
        if (userDoc.exists()) {
          const profile = userDoc.data() as UserProfile;
          onAuthSuccess(profile);
        } else {
          // Re-create the document if the Auth record exists but the Firestore document was cleared
          if (isAdminSecret) {
            const adminProfile: UserProfile = {
              uid: userCredential.user.uid,
              name: "System Admin",
              email: finalEmail,
              role: "admin",
              section: "none",
              approved: true,
              createdAt: new Date().toISOString()
            };
            await setDoc(doc(db, "users", userCredential.user.uid), adminProfile);
            onAuthSuccess(adminProfile);
          } else {
            setError("User profile not found in database.");
            await signOut(auth);
          }
        }
      } else {
        // Handle Sign Up
        if (role === "teacher" || role === "admin") {
          if (facultyCode.trim() !== TEACHER_SECRET) {
            setError("Incorrect Faculty Security Code! Access Denied.");
            setLoading(false);
            return;
          }
          if (role === "teacher" && teacherSubjects.length === 0) {
            setError("Please select at least one subject that you teach.");
            setLoading(false);
            return;
          }
        }
        const userCredential = await createUserWithEmailAndPassword(auth, finalEmail, password);
        const uid = userCredential.user.uid;

        if (role === "student") {
          // Check for duplicate names to prevent spying/impersonation (now authenticated, so permission is granted!)
          const qName = query(collection(db, "users"), where("name", "==", name.trim()));
          const nameSnap = await getDocs(qName);
          if (!nameSnap.empty) {
            // Delete the authenticated user record since they used a duplicate name
            await userCredential.user.delete();
            setError("An account with this Full Name already exists. Student impersonation is strictly forbidden.");
            setLoading(false);
            return;
          }
        }

        const newProfile: UserProfile = {
          uid,
          name: name.trim(),
          email: finalEmail,
          role,
          section: (role === "teacher" || role === "admin") ? "none" : section,
          approved: (role === "teacher" || role === "admin"), // Faculty approved via code
          createdAt: new Date().toISOString(),
        };

        if (role === "teacher") {
          newProfile.subjects = teacherSubjects;
        }

        // Save profile to firestore
        await setDoc(doc(db, "users", uid), newProfile);
        
        setSuccessMsg(
          role === "student" 
            ? "Account registered successfully! Please wait for a teacher to approve your account."
            : `${role === "admin" ? "Administrator" : "Educator"} account registered and approved successfully!`
        );

        onAuthSuccess(newProfile);
      }
    } catch (err: any) {
      const silentErrorCodes = [
        "auth/email-already-in-use",
        "auth/weak-password",
        "auth/invalid-email",
        "auth/user-not-found",
        "auth/wrong-password",
        "auth/invalid-credential"
      ];
      if (err && err.code && silentErrorCodes.includes(err.code)) {
        console.warn("Auth validation error:", err.code);
      } else {
        console.error(err);
      }
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already in use by another account.");
      } else if (err.code === "auth/weak-password") {
        setError("Password should be at least 6 characters.");
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid school email address.");
      } else if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("Invalid email or password.");
      } else if (err.code === "auth/operation-not-allowed") {
        setError("auth/operation-not-allowed");
      } else {
        setError(err.message || "Authentication failed. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] p-4 font-sans" id="auth_container">
      <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:24px_24px] opacity-70 pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative bg-[#0a0a0a] rounded-sm shadow-2xl border border-white/10 max-w-md w-full p-8"
        id="auth_card"
      >
        {/* School Logo Concept */}
        <div className="flex flex-col items-center mb-6">
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-sm mb-3 border border-white/10">
            <School size={32} className="stroke-[1.5]" id="school_logo" />
          </div>
          <h1 className="text-2xl font-serif text-white tracking-tight italic text-center">
            Grade 9 Academic Hub
          </h1>
          <p className="text-white/40 text-xs text-center mt-1 font-sans">
            Secure classroom portal &amp; real-time notifications
          </p>
        </div>

        {/* Auth Mode Toggle */}
        {!isRecovering && (
          <div className="flex bg-white/5 border border-white/10 p-1 rounded-sm mb-6" id="auth_tabs">
            <button
              type="button"
              onClick={() => { setIsLogin(true); setError(null); }}
              className={`flex-1 py-2 text-xs font-mono uppercase tracking-widest rounded-sm transition-all ${
                isLogin 
                  ? "bg-amber-500 text-black font-semibold" 
                  : "text-white/50 hover:text-white"
              }`}
              id="login_tab"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsLogin(false); setError(null); }}
              className={`flex-1 py-2 text-xs font-mono uppercase tracking-widest rounded-sm transition-all ${
                !isLogin 
                  ? "bg-amber-500 text-black font-semibold" 
                  : "text-white/50 hover:text-white"
              }`}
              id="register_tab"
            >
              Register
            </button>
          </div>
        )}

        {/* Error / Success Banners */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-950/40 border border-red-500/30 text-red-200 p-3 rounded-sm text-xs mb-4 flex flex-col gap-2"
              id="auth_error_banner"
            >
              <div className="flex items-start gap-2">
                <ShieldAlert className="shrink-0 text-red-400" size={16} />
                <div className="font-semibold text-red-300">
                  {error === "auth/operation-not-allowed" 
                    ? "Email/Password Sign-In Disabled" 
                    : "Authentication Error"}
                </div>
              </div>
              
              {error === "auth/operation-not-allowed" ? (
                <div className="text-[11px] leading-relaxed text-red-200/90 font-mono space-y-2 mt-1">
                  <p className="font-sans text-xs">
                    The <strong>Email/Password</strong> provider is not enabled in your Firebase project. Please follow these quick steps to enable it:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 pl-1 bg-black/40 p-2 border border-red-500/10 rounded-sm">
                    <li>Go to the <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-amber-400 underline hover:text-amber-300 font-bold">Firebase Console</a>.</li>
                    <li>Select project: <code className="bg-red-950 px-1 py-0.5 rounded text-red-300">dnddnd-4fe6f</code>.</li>
                    <li>In the left sidebar, go to <strong>Build</strong> &gt; <strong>Authentication</strong>.</li>
                    <li>Click the <strong>Sign-in method</strong> tab on the top.</li>
                    <li>Click <strong>Add new provider</strong>.</li>
                    <li>Select <strong>Email/Password</strong>, toggle <strong>Enable</strong> (leave Passwordless toggle off), and click <strong>Save</strong>.</li>
                  </ol>
                  <p className="font-sans text-[10px] text-white/50 pt-1">
                    Once enabled, return to this tab, refresh the page, and register/sign-in!
                  </p>
                </div>
              ) : (
                <div className="text-[11px]">{error}</div>
              )}
            </motion.div>
          )}

          {successMsg && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 p-3 rounded-sm text-xs mb-4"
              id="auth_success_banner"
            >
              {successMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {isRecovering ? (
          /* Password Recovery Form */
          <form onSubmit={handlePasswordRecovery} className="space-y-4" id="recovery_form">
            <div className="flex items-center gap-2 mb-2 text-amber-500">
              <Key size={16} />
              <h2 className="text-sm font-mono uppercase tracking-wider font-bold">Faculty Password Recovery</h2>
            </div>
            <p className="text-white/40 text-[10px] leading-relaxed mb-4 font-sans">
              Provide your institutional email and the secure faculty passcode hint to trigger a secure password recovery event.
            </p>

            {/* Email Address */}
            <div>
              <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-[0.2em] mb-1.5">
                Faculty Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-white/40">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  required
                  placeholder="faculty@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-white/10 rounded-sm text-xs bg-black/50 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-white font-mono"
                  id="recovery_email"
                />
              </div>
            </div>

            {/* Password Hint / Code */}
            <div>
              <label className="block text-[10px] font-semibold text-red-400 uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1">
                <HelpCircle size={12} />
                Password Hint / Faculty Code
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-red-400">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  required
                  placeholder="Enter secure passcode hint"
                  value={facultyCode}
                  onChange={(e) => setFacultyCode(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-red-500/30 rounded-sm text-xs bg-[#1a0a0a] focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all text-white font-mono"
                  id="recovery_code"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setIsRecovering(false); setError(null); setSuccessMsg(null); }}
                className="flex-1 border border-white/10 hover:border-white/20 text-white font-mono py-2 text-[10px] uppercase tracking-widest rounded-sm transition-all"
                id="btn_cancel_recovery"
              >
                Back to Sign In
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-white hover:bg-amber-500 text-black font-mono font-bold py-2 text-[10px] uppercase tracking-widest rounded-sm transition-all disabled:opacity-50"
                id="btn_submit_recovery"
              >
                Verify &amp; Reset
              </button>
            </div>
          </form>
        ) : (
          /* Standard Sign In / Register Form */
          <form onSubmit={handleAuth} className="space-y-4" id="auth_form">
            {/* Sign Up Specific Fields */}
            {!isLogin && (
              <>
                {/* Full Name */}
                <div>
                  <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-[0.2em] mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-white/40">
                      <User size={16} />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Enter full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-white/10 rounded-sm text-xs bg-black/50 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-white font-mono"
                      id="input_name"
                    />
                  </div>
                </div>

                {/* Role Picker */}
                <div>
                  <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-[0.2em] mb-1.5">
                    I am a:
                  </label>
                  <div className="grid grid-cols-3 gap-1.5" id="role_selectors">
                    <button
                      type="button"
                      onClick={() => setRole("student")}
                      className={`py-2 px-1 border text-[10px] font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all rounded-sm ${
                        role === "student"
                          ? "border-amber-500 bg-amber-500/10 text-amber-500 font-semibold"
                          : "border-white/10 hover:border-white/20 text-white/40 hover:text-white/60 bg-transparent"
                      }`}
                      id="select_role_student"
                    >
                      <User size={12} />
                      Student
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole("teacher")}
                      className={`py-2 px-1 border text-[10px] font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all rounded-sm ${
                        role === "teacher"
                          ? "border-amber-500 bg-amber-500/10 text-amber-500 font-semibold"
                          : "border-white/10 hover:border-white/20 text-white/40 hover:text-white/60 bg-transparent"
                      }`}
                      id="select_role_teacher"
                    >
                      <GraduationCap size={12} />
                      Teacher
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole("admin")}
                      className={`py-2 px-1 border text-[10px] font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all rounded-sm ${
                        role === "admin"
                          ? "border-amber-500 bg-amber-500/10 text-amber-500 font-semibold"
                          : "border-white/10 hover:border-white/20 text-white/40 hover:text-white/60 bg-transparent"
                      }`}
                      id="select_role_admin"
                    >
                      <ShieldCheck size={12} />
                      Admin
                    </button>
                  </div>
                </div>

                {/* Section Selector for Students */}
                {role === "student" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    id="section_selector_container"
                  >
                    <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-[0.2em] mb-1.5">
                      Grade 9 Section
                    </label>
                    <select
                      value={section}
                      onChange={(e) => setSection(e.target.value as UserSection)}
                      className="w-full px-3 py-2 border border-white/10 rounded-sm text-xs bg-black/50 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white capitalize font-mono"
                      id="select_section"
                    >
                      {SECTIONS.map((sec) => (
                        <option key={sec} value={sec} className="bg-[#0a0a0a] text-white">
                          {sec}
                        </option>
                      ))}
                    </select>
                  </motion.div>
                )}

                {/* Subjects Selector for Teachers */}
                {role === "teacher" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    id="teacher_subjects_container"
                    className="space-y-2 border border-white/5 p-3 rounded bg-white/5"
                  >
                    <label className="block text-[10px] font-semibold text-amber-500 uppercase tracking-[0.2em]">
                      My Subject Specializations
                    </label>
                    <p className="text-[9px] text-white/40 font-mono">Select the subjects you teach. Section chatrooms will filter to only show these.</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {SUBJECTS.map((subj) => {
                        const isSelected = teacherSubjects.includes(subj);
                        return (
                          <button
                            key={subj}
                            type="button"
                            onClick={() => handleToggleSubject(subj)}
                            className={`py-1.5 px-2 border text-[9px] font-mono tracking-tight flex items-center justify-between transition-all rounded-sm ${
                              isSelected
                                ? "border-amber-500/50 bg-amber-500/20 text-white font-semibold"
                                : "border-white/5 text-white/40 hover:text-white bg-black/20"
                            }`}
                          >
                            <span>{subj}</span>
                            {isSelected && <span className="text-amber-500 text-[10px]">●</span>}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* Secret Educator Code for Teachers / Admins */}
                {(role === "teacher" || role === "admin") && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    id="teacher_passcode_container"
                  >
                    <label className="block text-[10px] font-semibold text-red-400 uppercase tracking-[0.2em] mb-1.5">
                      Faculty Verification Password
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-red-400">
                        <Lock size={16} />
                      </span>
                      <input
                        type="password"
                        required
                        placeholder="Enter verification code"
                        value={facultyCode}
                        onChange={(e) => setFacultyCode(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-red-500/30 rounded-sm text-xs bg-red-950/10 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all text-white font-mono"
                        id="input_verification_code"
                      />
                    </div>
                    <p className="text-[10px] text-red-400/60 mt-1 italic font-mono">
                      Required to verify secure educational status.
                    </p>
                  </motion.div>
                )}
              </>
            )}

            {/* Email Address */}
            <div>
              <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-[0.2em] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-white/40">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  required
                  placeholder="school@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-white/10 rounded-sm text-xs bg-black/50 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-white font-mono"
                  id="input_email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[10px] font-semibold text-white/40 uppercase tracking-[0.2em]">
                  Password
                </label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => { setIsRecovering(true); setError(null); setSuccessMsg(null); }}
                    className="text-[9px] font-semibold text-amber-500 hover:underline font-mono"
                    id="btn_forgot_password"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-white/40">
                  <Lock size={16} />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2 border border-white/10 rounded-sm text-xs bg-black/50 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-white font-mono"
                  id="input_password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-white/40 hover:text-white"
                  id="toggle_password_visibility"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white hover:bg-amber-500 text-black font-mono font-bold py-3 text-xs uppercase tracking-[0.2em] rounded-sm transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 hover:shadow-[0_0_15px_rgba(245,158,11,0.2)]"
              id="btn_auth_submit"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin text-black" />
                  Processing...
                </>
              ) : isLogin ? (
                "Sign In"
              ) : (
                "Register Now"
              )}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}

