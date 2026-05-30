export type StudentStatus = 'active' | 'archived' | 'graduated'
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'leave'
export type SubmissionStatus = 'pending' | 'submitted' | 'graded' | 'returned'
export type HolidayType = 'holiday' | 'reschedule'

export interface Student {
  id: string
  name: string
  username?: string
  avatarUrl: string
  phone: string
  wechat: string
  tags: string[]
  enrollDate: string
  status: StudentStatus
  notes: string
  createdAt: string
  updatedAt: string
}

export interface ClassSchedule {
  dayOfWeek: number  // 0=周日, 1=周一...6=周六
  startTime: string  // HH:mm
  endTime: string    // HH:mm
  weekInterval: number // 1=每周, 2=每两周, 4=每四周
}

export interface ClassGroup {
  id: string
  name: string
  studentIds: string[]
  schedules: ClassSchedule[]
  color: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface AttendanceRecord {
  studentId: string
  status: AttendanceStatus
  time: string
  note: string
}

export interface Session {
  id: string
  classId: string
  date: string
  startTime: string
  endTime: string
  topic: string
  teacherNotes: string
  homework: string
  attendance: AttendanceRecord[]
  isRescheduled?: boolean
  originalDate?: string
  createdAt: string
  updatedAt: string
}

export interface CalendarHoliday {
  id: string
  date: string
  reason: string
  classId: string | null
  type: HolidayType
  rescheduledDate?: string
  rescheduleStartTime?: string
  rescheduleEndTime?: string
  createdAt: string
  updatedAt: string
}

export interface Assignment {
  id: string
  classId: string
  title: string
  description: string
  deadline: string
  attachments: string[]
  createdAt: string
  updatedAt: string
}

export interface SubmissionFileMeta {
  id: string
  name: string
  size: number
  type: string
  uploadedAt: string
}

export interface Submission {
  id: string
  assignmentId: string
  studentId: string
  status: SubmissionStatus
  files: SubmissionFileMeta[]
  submittedAt: string
  grade: number
  feedback: string
  returnReason?: string
  gradedAt: string
  createdAt: string
  updatedAt: string
}

export type UserRole = 'admin' | 'teacher' | 'student'

export interface ClassFlowUser {
  id: string
  username: string
  password: string
  role: UserRole
  displayName: string
  studentId?: string
  createdAt: string
}
