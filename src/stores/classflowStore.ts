import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useLocalStorage } from '@/composables/useLocalStorage'
import { useSupabaseTable } from '@/composables/useSupabaseTable'
import type {
  Student, ClassGroup, Session, AttendanceRecord,
  Assignment, Submission, SubmissionFileMeta,
  AttendanceStatus, StudentStatus, CalendarHoliday, ClassSchedule,
} from '@/types/classflow'

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

function nowISO(): string {
  return new Date().toISOString()
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

export const useClassFlowStore = defineStore('classflow', () => {
  // --- State (Supabase-backed, with localStorage fallback) ---
  const { data: students, add: addStudentRecord, update: updateStudentRecord, remove: removeStudentRecord } = useSupabaseTable<Student>('cf_students', 'cf-students', [])
  const { data: classes, add: addClassRecord, update: updateClassRecord, remove: removeClassRecord } = useSupabaseTable<ClassGroup>('cf_classes', 'cf-classes', [])
  const { data: sessions, add: addSessionRecord, update: updateSessionRecord, remove: removeSessionRecord } = useSupabaseTable<Session>('cf_sessions', 'cf-sessions', [])
  const { data: assignments, add: addAssignmentRecord, update: updateAssignmentRecord, remove: removeAssignmentRecord } = useSupabaseTable<Assignment>('cf_assignments', 'cf-assignments', [])
  const { data: submissions, add: addSubmissionRecord, update: updateSubmissionRecord, remove: removeSubmissionRecord } = useSupabaseTable<Submission>('cf_submissions', 'cf-submissions', [])
  const { data: holidays, add: addHolidayRecord, update: updateHolidayRecord, remove: removeHolidayRecord } = useSupabaseTable<CalendarHoliday>('cf_holidays', 'cf-holidays', [])
  const currentClassId = useLocalStorage<string | null>('cf-current-class', null)

  // --- Migration: convert old `schedule` string to `schedules` array ---
  if (classes.value.length > 0 && !classes.value[0].schedules) {
    const dayMap: Record<string, number> = { '周日':0,'周一':1,'周二':2,'周三':3,'周四':4,'周五':5,'周六':6 }
    classes.value = classes.value.map((c: Record<string, unknown> | ClassGroup) => {
      const cls = c as Record<string, unknown>
      if (!cls.schedules && cls.schedule) {
        const s = cls.schedule as string
        const m = s.match(/(每周|每两周|每四周)?\s*(周[一二三四五六日]|周日|周一|周二|周三|周四|周五|周六)\s+(\d{2}:\d{2})-(\d{2}:\d{2})/)
        if (m && dayMap[m[2]] !== undefined) {
          const interval = m[1] === '每两周' ? 2 : m[1] === '每四周' ? 4 : 1
          const schedules: ClassSchedule[] = [{ dayOfWeek: dayMap[m[2]], startTime: m[3], endTime: m[4], weekInterval: interval }]
          return { ...cls, schedules } as ClassGroup
        }
        return { ...cls, schedules: [] } as ClassGroup
      }
      return { ...cls, schedules: cls.schedules || [] } as ClassGroup
    })
  }

  // --- Computed ---
  const activeStudents = computed(() => students.value.filter(s => s.status === 'active'))
  const archivedStudents = computed(() => students.value.filter(s => s.status === 'archived'))
  const graduatedStudents = computed(() => students.value.filter(s => s.status === 'graduated'))

  const todaySessions = computed(() =>
    sessions.value.filter(s => s.date === todayStr())
  )

  const upcomingSessions = computed(() =>
    sessions.value.filter(s => s.date >= todayStr())
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
  )

  const pendingSubmissions = computed(() =>
    submissions.value.filter(s => s.status === 'submitted')
  )

  const gradedSubmissions = computed(() =>
    submissions.value.filter(s => s.status === 'graded')
  )

  const overdueAssignments = computed(() => {
    const now = new Date().toISOString()
    return assignments.value.filter(a => a.deadline < now)
  })

  // --- Holiday helpers (used in multiple computeds) ---
  function isHoliday(date: string, classId?: string | null): boolean {
    return holidays.value.some(h =>
      h.date === date && h.type === 'holiday' &&
      (h.classId === null || h.classId === classId)
    )
  }

  const holidayExemptedAbsences = computed(() => {
    return sessions.value.filter(s => isHoliday(s.date, s.classId))
      .flatMap(s => s.attendance.filter(a => a.status === 'absent')
        .map(a => ({ studentId: a.studentId, sessionId: s.id, date: s.date })))
  })

  const weeklyStats = computed(() => {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekStr = weekAgo.toISOString().split('T')[0]
    const weekSessions = sessions.value.filter(s => s.date >= weekStr)
    const totalHours = weekSessions.reduce((sum, s) => {
      const [sh, sm] = s.startTime.split(':').map(Number)
      const [eh, em] = s.endTime.split(':').map(Number)
      return sum + (eh - sh) + (em - sm) / 60
    }, 0)
    const totalAttendance = weekSessions.reduce((sum, s) => sum + s.attendance.length, 0)
    const presentCount = weekSessions.reduce((sum, s) =>
      sum + s.attendance.filter(a => a.status === 'present').length, 0
    )
    // Exclude holiday-exempted absences
    const absentCount = weekSessions.reduce((sum, s) => {
      if (isHoliday(s.date, s.classId)) return sum
      return sum + s.attendance.filter(a => a.status === 'absent').length
    }, 0)
    const effectiveTotal = totalAttendance - weekSessions
      .filter(s => isHoliday(s.date, s.classId))
      .reduce((sum, s) => sum + s.attendance.filter(a => a.status === 'absent').length, 0)

    const weekAssignments = assignments.value.filter(a => a.createdAt >= weekStr)
    const totalSubmissions = weekAssignments.reduce((sum, a) =>
      sum + submissions.value.filter(s => s.assignmentId === a.id).length, 0
    )
    const gradedCount = weekAssignments.reduce((sum, a) =>
      sum + submissions.value.filter(s => s.assignmentId === a.id && s.status === 'graded').length, 0
    )
    return {
      totalHours: Math.round(totalHours * 10) / 10,
      avgAttendance: effectiveTotal > 0 ? Math.round((presentCount / effectiveTotal) * 100) : 0,
      submissionRate: totalSubmissions > 0 ? Math.round((gradedCount / totalSubmissions) * 100) : 0,
      totalSessions: weekSessions.length,
      absentCount,
    }
  })

  // --- Student Detail Computeds ---
  function getStudentSessions(studentId: string): Session[] {
    return sessions.value.filter(s =>
      s.attendance.some(a => a.studentId === studentId)
    ).sort((a, b) => b.date.localeCompare(a.date))
  }

  function getStudentAttendanceDetail(studentId: string) {
    const studentSessions = getStudentSessions(studentId)
    const records = studentSessions.map(s => {
      const att = s.attendance.find(a => a.studentId === studentId)
      const cls = classes.value.find(c => c.id === s.classId)
      const holidayExempted = isHoliday(s.date, s.classId) && att?.status === 'absent'
      return {
        sessionId: s.id,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        className: cls?.name || '未命名班级',
        topic: s.topic,
        status: att?.status || 'absent' as AttendanceStatus,
        isHolidayExempted: holidayExempted,
        isRescheduled: s.isRescheduled || false,
        originalDate: s.originalDate || '',
      }
    })
    const total = records.length
    const present = records.filter(r => r.status === 'present').length
    const late = records.filter(r => r.status === 'late').length
    const absent = records.filter(r => r.status === 'absent' && !r.isHolidayExempted).length
    const leave = records.filter(r => r.status === 'leave').length
    const exempted = records.filter(r => r.isHolidayExempted).length
    return {
      records,
      total,
      present,
      late,
      absent,
      leave,
      exempted,
      attendanceRate: total > 0 ? Math.round(((present + late + leave) / total) * 100) : 0,
    }
  }

  function getStudentHomeworkDetail(studentId: string) {
    const studentSubmissions = submissions.value.filter(s => s.studentId === studentId)
    const details = studentSubmissions.map(sub => {
      const asg = assignments.value.find(a => a.id === sub.assignmentId)
      const cls = classes.value.find(c => c.id === asg?.classId)
      return {
        assignmentId: sub.assignmentId,
        title: asg?.title || '未知作业',
        className: cls?.name || '未知班级',
        status: sub.status,
        grade: sub.grade,
        feedback: sub.feedback,
        submittedAt: sub.submittedAt,
        gradedAt: sub.gradedAt,
        deadline: asg?.deadline || '',
        filesCount: sub.files.length,
      }
    }).sort((a, b) => (b.submittedAt || b.deadline).localeCompare(a.submittedAt || a.deadline))
    const total = details.length
    const graded = details.filter(d => d.status === 'graded').length
    const submitted = details.filter(d => d.status === 'submitted').length
    const pending = details.filter(d => d.status === 'pending').length
    const gradedWithScore = details.filter(d => d.status === 'graded' && d.grade > 0)
    const avgGrade = gradedWithScore.length > 0
      ? Math.round(gradedWithScore.reduce((sum, d) => sum + d.grade, 0) / gradedWithScore.length)
      : 0
    return { details, total, graded, submitted, pending, avgGrade }
  }

  function getStudentDetail(studentId: string) {
    const attendance = getStudentAttendanceDetail(studentId)
    const homework = getStudentHomeworkDetail(studentId)
    const studentObj = students.value.find(s => s.id === studentId)
    const classList = classes.value
      .filter(c => c.studentIds.includes(studentId))
      .map(c => ({ id: c.id, name: c.name, schedules: c.schedules, color: c.color }))
    return {
      student: studentObj,
      classes: classList,
      attendance,
      homework,
    }
  }

  // --- Holiday Actions ---
  function addHoliday(data: {
    date: string
    reason: string
    classId: string | null
    type: 'holiday' | 'reschedule'
    rescheduledDate?: string
    rescheduleStartTime?: string
    rescheduleEndTime?: string
  }): string {
    const id = uid('hol')
    const holiday: CalendarHoliday = {
      id, ...data,
      classId: data.classId ?? null,
      rescheduledDate: data.rescheduledDate || undefined,
      rescheduleStartTime: data.rescheduleStartTime || undefined,
      rescheduleEndTime: data.rescheduleEndTime || undefined,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    }
    addHolidayRecord(holiday)
    return id
  }

  function updateHoliday(id: string, patch: Partial<CalendarHoliday>): void {
    updateHolidayRecord(id, { ...patch, updatedAt: nowISO() })
  }

  function deleteHoliday(id: string): void {
    removeHolidayRecord(id)
  }

  function getHolidaysByDateRange(start: string, end: string): CalendarHoliday[] {
    return holidays.value.filter(h => h.date >= start && h.date <= end)
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  function getRescheduledSessions() {
    return holidays.value
      .filter(h => h.type === 'reschedule')
      .map(h => {
        const cls = classes.value.find(c => c.id === h.classId)
        return {
          ...h,
          className: cls?.name || '未命名班级',
        }
      })
  }

  // --- Student Actions ---
  function addStudent(data: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = uid('stu')
    const student: Student = {
      id,
      ...data,
      avatarUrl: data.avatarUrl || '',
      createdAt: nowISO(),
      updatedAt: nowISO(),
    }
    addStudentRecord(student)
    return id
  }

  function updateStudent(id: string, patch: Partial<Student>): void {
    updateStudentRecord(id, { ...patch, updatedAt: nowISO() })
  }

  function deleteStudent(id: string): void {
    removeStudentRecord(id)
    classes.value.forEach(cls => {
      if (cls.studentIds.includes(id)) {
        updateClassRecord(cls.id, { studentIds: cls.studentIds.filter(sid => sid !== id) })
      }
    })
  }

  function archiveStudent(id: string): void {
    updateStudent(id, { status: 'archived' })
  }

  // --- Class Actions ---
  function addClass(data: Omit<ClassGroup, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = uid('cls')
    const cls: ClassGroup = {
      id, ...data,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    }
    addClassRecord(cls)
    return id
  }

  function updateClass(id: string, patch: Partial<ClassGroup>): void {
    updateClassRecord(id, { ...patch, updatedAt: nowISO() })
  }

  function deleteClass(id: string): void {
    removeClassRecord(id)
    // 级联删除关联的 sessions 和 assignments
    sessions.value.filter(s => s.classId === id).forEach(s => removeSessionRecord(s.id))
    assignments.value.filter(a => a.classId === id).forEach(a => removeAssignmentRecord(a.id))
  }

  function addStudentToClass(classId: string, studentId: string): void {
    const cls = classes.value.find(c => c.id === classId)
    if (cls && !cls.studentIds.includes(studentId)) {
      updateClassRecord(classId, { studentIds: [...cls.studentIds, studentId], updatedAt: nowISO() })
    }
  }

  function removeStudentFromClass(classId: string, studentId: string): void {
    const cls = classes.value.find(c => c.id === classId)
    if (cls) {
      updateClassRecord(classId, { studentIds: cls.studentIds.filter(id => id !== studentId), updatedAt: nowISO() })
    }
  }

  function getStudentsByClass(classId: string): Student[] {
    const cls = classes.value.find(c => c.id === classId)
    if (!cls) return []
    return cls.studentIds.map(id => students.value.find(s => s.id === id)).filter(Boolean) as Student[]
  }

  // --- Session / Attendance Actions ---
  function createSession(data: Omit<Session, 'id' | 'createdAt' | 'updatedAt' | 'attendance'>): string {
    const id = uid('ses')
    const cls = classes.value.find(c => c.id === data.classId)
    const attendance: AttendanceRecord[] = cls
      ? cls.studentIds.map(sid => ({
          studentId: sid,
          status: 'present' as AttendanceStatus,
          time: data.startTime,
          note: '',
        }))
      : []
    const session: Session = {
      id, ...data, attendance,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    }
    addSessionRecord(session)
    return id
  }

  function updateSession(id: string, patch: Partial<Session>): void {
    updateSessionRecord(id, { ...patch, updatedAt: nowISO() })
  }

  function deleteSession(id: string): void {
    removeSessionRecord(id)
  }

  function setAttendance(sessionId: string, studentId: string, status: AttendanceStatus, note = ''): void {
    const session = sessions.value.find(s => s.id === sessionId)
    if (!session) return
    let attendance = [...session.attendance]
    const idx = attendance.findIndex(a => a.studentId === studentId)
    if (idx !== -1) {
      attendance[idx] = { ...attendance[idx], status, note: note || attendance[idx].note }
    } else {
      attendance.push({ studentId, status, time: '', note })
    }
    updateSessionRecord(sessionId, { attendance, updatedAt: nowISO() })
  }

  function markAllPresent(sessionId: string): void {
    const session = sessions.value.find(s => s.id === sessionId)
    if (!session) return
    const attendance = session.attendance.map(a => ({ ...a, status: 'present' as AttendanceStatus }))
    updateSessionRecord(sessionId, { attendance, updatedAt: nowISO() })
  }

  function getSessionById(id: string): Session | undefined {
    return sessions.value.find(s => s.id === id)
  }

  function getSessionsByClass(classId: string): Session[] {
    return sessions.value.filter(s => s.classId === classId)
      .sort((a, b) => b.date.localeCompare(a.date))
  }

  // --- Assignment Actions ---
  function addAssignment(data: Omit<Assignment, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = uid('asg')
    const asg: Assignment = {
      id, ...data,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    }
    addAssignmentRecord(asg)
    return id
  }

  function updateAssignment(id: string, patch: Partial<Assignment>): void {
    updateAssignmentRecord(id, { ...patch, updatedAt: nowISO() })
  }

  function deleteAssignment(id: string): void {
    removeAssignmentRecord(id)
    // 级联删除关联的提交记录
    submissions.value.filter(s => s.assignmentId === id).forEach(s => removeSubmissionRecord(s.id))
  }

  // --- Submission Actions ---
  function getOrCreateSubmission(assignmentId: string, studentId: string): Submission {
    let sub = submissions.value.find(s => s.assignmentId === assignmentId && s.studentId === studentId)
    if (!sub) {
      const id = uid('sub')
      sub = {
        id, assignmentId, studentId,
        status: 'pending',
        files: [],
        submittedAt: '',
        grade: 0,
        feedback: '',
        gradedAt: '',
        createdAt: nowISO(),
        updatedAt: nowISO(),
      }
      addSubmissionRecord(sub)
    }
    return sub
  }

  function submitAssignment(assignmentId: string, studentId: string, fileMetas: SubmissionFileMeta[]): string {
    const sub = getOrCreateSubmission(assignmentId, studentId)
    updateSubmissionRecord(sub.id, { status: 'submitted', files: fileMetas, submittedAt: nowISO(), updatedAt: nowISO() })
    return sub.id
  }

  function gradeSubmission(id: string, grade: number, feedback: string): void {
    updateSubmissionRecord(id, { status: 'graded', grade, feedback, gradedAt: nowISO(), updatedAt: nowISO() })
  }

  function returnSubmission(id: string, reason?: string): void {
    updateSubmissionRecord(id, { status: 'returned', grade: 0, feedback: reason || '', updatedAt: nowISO() })
  }

  function getSubmissionsByAssignment(assignmentId: string): Submission[] {
    return submissions.value.filter(s => s.assignmentId === assignmentId)
  }

  function getAssignmentsByStudent(studentId: string): Assignment[] {
    const classIds = classes.value
      .filter(c => c.studentIds.includes(studentId))
      .map(c => c.id)
    return assignments.value
      .filter(a => classIds.includes(a.classId))
      .sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''))
  }

  function getClassSubmissionOverview(classId: string, assignmentId?: string) {
    const students = getStudentsByClass(classId)
    const classAssignments = assignments.value.filter(a => a.classId === classId)
    const target = assignmentId
      ? classAssignments.filter(a => a.id === assignmentId)
      : classAssignments
    return students.map(student => {
      const submissions = target.map(asg => {
        const sub = getOrCreateSubmission(asg.id, student.id)
        return {
          assignmentId: asg.id,
          assignmentTitle: asg.title,
          deadline: asg.deadline,
          status: sub.status,
          grade: sub.grade,
          submittedAt: sub.submittedAt,
        }
      })
      return { student, submissions }
    })
  }

  // --- Export / Import ---
  function exportData(): string {
    return JSON.stringify({
      students: students.value,
      classes: classes.value,
      sessions: sessions.value,
      assignments: assignments.value,
      submissions: submissions.value,
      holidays: holidays.value,
    })
  }

  function importData(json: string): void {
    try {
      const data = JSON.parse(json)
      if (data.students) students.value = data.students
      if (data.classes) {
        // Migrate old `schedule` string to `schedules` array
        classes.value = data.classes.map((c: Record<string, unknown>) => {
          if (!c.schedules && c.schedule) {
            const s = c.schedule as string
            // Try to parse "每周X HH:MM-HH:MM" format
            const scheduleMatch = s.match(/(?:每周|每两周|每四周)\s*(周[一二三四五六日]|周日|周一|周二|周三|周四|周五|周六)\s+(\d{2}:\d{2})-(\d{2}:\d{2})/)
            const dayMap: Record<string, number> = { '周日':0,'周一':1,'周二':2,'周三':3,'周四':4,'周五':5,'周六':6,'周天':0,'星期日':0,'星期一':1,'星期二':2,'星期三':3,'星期四':4,'星期五':5,'星期六':6 }
            if (scheduleMatch && dayMap[scheduleMatch[1]] !== undefined) {
              const interval = s.includes('每两周') ? 2 : s.includes('每四周') ? 4 : 1
              return { ...c, schedules: [{ dayOfWeek: dayMap[scheduleMatch[1]], startTime: scheduleMatch[2], endTime: scheduleMatch[3], weekInterval: interval }] }
            }
            return { ...c, schedules: [] }
          }
          return c
        })
      }
      if (data.sessions) sessions.value = data.sessions
      if (data.assignments) assignments.value = data.assignments
      if (data.submissions) submissions.value = data.submissions
      if (data.holidays) holidays.value = data.holidays
    } catch { /* ignore */ }
  }

  return {
    // state
    students, classes, sessions, assignments, submissions, holidays, currentClassId,
    // computeds
    activeStudents, archivedStudents, graduatedStudents,
    todaySessions, upcomingSessions,
    pendingSubmissions, gradedSubmissions, overdueAssignments,
    weeklyStats, holidayExemptedAbsences,
    // student detail
    getStudentSessions, getStudentAttendanceDetail, getStudentHomeworkDetail, getStudentDetail,
    // holiday
    isHoliday, addHoliday, updateHoliday, deleteHoliday,
    getHolidaysByDateRange, getRescheduledSessions,
    // student actions
    addStudent, updateStudent, deleteStudent, archiveStudent,
    // class actions
    addClass, updateClass, deleteClass,
    addStudentToClass, removeStudentFromClass, getStudentsByClass,
    // session actions
    createSession, updateSession, deleteSession,
    setAttendance, markAllPresent, getSessionById, getSessionsByClass,
    // assignment actions
    addAssignment, updateAssignment, deleteAssignment,
    // submission actions
    getOrCreateSubmission, submitAssignment, gradeSubmission, returnSubmission,
    getSubmissionsByAssignment,
    // student workspace
    getAssignmentsByStudent, getClassSubmissionOverview,
    // data
    exportData, importData,
  }
})
