export type UserRole = "student" | "teacher" | "admin";
export type UserSection = "fullerene" | "diamond" | "graphite" | "lonsdalite" | "none";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  section: UserSection;
  approved: boolean;
  createdAt: string;
  subjects?: string[]; // Subjects taught (for teachers)
}

export interface MaterialRequest {
  id: string;
  teacherId: string;
  teacherName: string;
  section: "fullerene" | "diamond" | "graphite" | "lonsdalite";
  items: Record<string, number>;
  message: string;
  scheduledFor: string | null; // Scheduled time in ISO string
  createdAt: string; // ISO string
  active: boolean;
}

export interface ChatMessage {
  id: string;
  chatId: string; // "section_subject" or "pm_studentId_teacherId"
  type: "subject" | "pm";
  senderId: string;
  senderName: string;
  senderRole: "student" | "teacher";
  content: string;
  createdAt: any; // Date timestamp from firestore
}

export interface GradeItem {
  title: string;
  score: number;
  maxScore: number;
}

export interface StudentGrade {
  id: string; // studentId_subject
  studentId: string;
  studentName: string;
  section: "fullerene" | "diamond" | "graphite" | "lonsdalite";
  subject: string;
  grades: GradeItem[];
  feedback: string;
  behaviourNotes: string;
  updatedBy: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string; // section_subject_date
  section: "fullerene" | "diamond" | "graphite" | "lonsdalite";
  subject: string;
  date: string; // YYYY-MM-DD
  records: Record<string, "present" | "absent" | "late">;
  notes: string;
  updatedBy: string;
  updatedAt: string;
}

export const SECTIONS: Exclude<UserSection, "none">[] = ["fullerene", "diamond", "graphite", "lonsdalite"];

export const SUBJECTS = [
  "Mathematics",
  "Science",
  "English",
  "Filipino",
  "Araling Panlipunan (AP)",
  "MAPEH",
  "TLE",
  "EsP"
];

export const TIMETABLE_SCHEDULES: Record<Exclude<UserSection, "none">, { time: string; subject: string; teacher: string }[]> = {
  fullerene: [
    { time: "07:30 - 08:30", subject: "Science", teacher: "Mr. Henderson" },
    { time: "08:30 - 09:30", subject: "Mathematics", teacher: "Mrs. Ramirez" },
    { time: "09:30 - 10:00", subject: "Recess", teacher: "-" },
    { time: "10:00 - 11:00", subject: "English", teacher: "Miss Thompson" },
    { time: "11:00 - 12:00", subject: "Filipino", teacher: "Mr. Santos" },
    { time: "12:00 - 01:00", subject: "Lunch Break", teacher: "-" },
    { time: "01:00 - 02:00", subject: "Araling Panlipunan (AP)", teacher: "Mrs. Delos Reyes" },
    { time: "02:00 - 03:00", subject: "MAPEH", teacher: "Mr. Cruz" }
  ],
  diamond: [
    { time: "07:30 - 08:30", subject: "Mathematics", teacher: "Mrs. Ramirez" },
    { time: "08:30 - 09:30", subject: "Science", teacher: "Mr. Henderson" },
    { time: "09:30 - 10:00", subject: "Recess", teacher: "-" },
    { time: "10:00 - 11:00", subject: "Filipino", teacher: "Mr. Santos" },
    { time: "11:00 - 12:00", subject: "English", teacher: "Miss Thompson" },
    { time: "12:00 - 01:00", subject: "Lunch Break", teacher: "-" },
    { time: "01:00 - 02:00", subject: "MAPEH", teacher: "Mr. Cruz" },
    { time: "02:00 - 03:00", subject: "TLE", teacher: "Mrs. Alcantara" }
  ],
  graphite: [
    { time: "07:30 - 08:30", subject: "English", teacher: "Miss Thompson" },
    { time: "08:30 - 09:30", subject: "Filipino", teacher: "Mr. Santos" },
    { time: "09:30 - 10:00", subject: "Recess", teacher: "-" },
    { time: "10:00 - 11:00", subject: "Science", teacher: "Mr. Henderson" },
    { time: "11:00 - 12:00", subject: "Mathematics", teacher: "Mrs. Ramirez" },
    { time: "12:00 - 01:00", subject: "Lunch Break", teacher: "-" },
    { time: "01:00 - 02:00", subject: "EsP", teacher: "Mr. Mendoza" },
    { time: "02:00 - 03:00", subject: "Araling Panlipunan (AP)", teacher: "Mrs. Delos Reyes" }
  ],
  lonsdalite: [
    { time: "07:30 - 08:30", subject: "Filipino", teacher: "Mr. Santos" },
    { time: "08:30 - 09:30", subject: "English", teacher: "Miss Thompson" },
    { time: "09:30 - 10:00", subject: "Recess", teacher: "-" },
    { time: "10:00 - 11:00", subject: "MAPEH", teacher: "Mr. Cruz" },
    { time: "11:00 - 12:00", subject: "Science", teacher: "Mr. Henderson" },
    { time: "12:00 - 01:00", subject: "Lunch Break", teacher: "-" },
    { time: "01:00 - 02:00", subject: "Mathematics", teacher: "Mrs. Ramirez" },
    { time: "02:00 - 03:00", subject: "TLE", teacher: "Mrs. Alcantara" }
  ]
};
