-- ============================================================
-- ClassFlow 数据库表结构（camelCase 列名，与 TS 类型一致）
-- 在 Supabase SQL Editor 中执行此脚本
-- 注意：如果已用旧版建表，先执行下方的 DROP 语句
-- ============================================================

-- 如果已有旧表（snake_case 版本），先删除重建
-- DROP TABLE IF EXISTS cf_submissions CASCADE;
-- DROP TABLE IF EXISTS cf_assignments CASCADE;
-- DROP TABLE IF EXISTS cf_sessions CASCADE;
-- DROP TABLE IF EXISTS cf_classes CASCADE;
-- DROP TABLE IF EXISTS cf_students CASCADE;
-- DROP TABLE IF EXISTS cf_holidays CASCADE;
-- DROP TABLE IF EXISTS cf_users CASCADE;

-- 1. 用户表
CREATE TABLE IF NOT EXISTS cf_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
  "displayName" TEXT NOT NULL DEFAULT '',
  "studentId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 学生库
CREATE TABLE IF NOT EXISTS cf_students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  username TEXT,
  "avatarUrl" TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  wechat TEXT NOT NULL DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]',
  "enrollDate" TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'graduated')),
  notes TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 班级表
CREATE TABLE IF NOT EXISTS cf_classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  "studentIds" JSONB NOT NULL DEFAULT '[]',
  schedules JSONB NOT NULL DEFAULT '[]',
  color TEXT NOT NULL DEFAULT '#10B981',
  description TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. 课次/签到表
CREATE TABLE IF NOT EXISTS cf_sessions (
  id TEXT PRIMARY KEY,
  "classId" TEXT NOT NULL REFERENCES cf_classes(id) ON DELETE CASCADE,
  date TEXT NOT NULL DEFAULT '',
  "startTime" TEXT NOT NULL DEFAULT '',
  "endTime" TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  "teacherNotes" TEXT NOT NULL DEFAULT '',
  homework TEXT NOT NULL DEFAULT '',
  attendance JSONB NOT NULL DEFAULT '[]',
  "isRescheduled" BOOLEAN NOT NULL DEFAULT FALSE,
  "originalDate" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. 作业任务表
CREATE TABLE IF NOT EXISTS cf_assignments (
  id TEXT PRIMARY KEY,
  "classId" TEXT NOT NULL REFERENCES cf_classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  deadline TEXT NOT NULL DEFAULT '',
  attachments JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. 作业提交表
CREATE TABLE IF NOT EXISTS cf_submissions (
  id TEXT PRIMARY KEY,
  "assignmentId" TEXT NOT NULL REFERENCES cf_assignments(id) ON DELETE CASCADE,
  "studentId" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'graded', 'returned')),
  files JSONB NOT NULL DEFAULT '[]',
  "submittedAt" TEXT NOT NULL DEFAULT '',
  grade REAL NOT NULL DEFAULT 0,
  feedback TEXT NOT NULL DEFAULT '',
  "returnReason" TEXT,
  "gradedAt" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. 放假日历表
CREATE TABLE IF NOT EXISTS cf_holidays (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  "classId" TEXT,
  type TEXT NOT NULL DEFAULT 'holiday' CHECK (type IN ('holiday', 'reschedule')),
  "rescheduledDate" TEXT,
  "rescheduleStartTime" TEXT,
  "rescheduleEndTime" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_cf_sessions_class_date ON cf_sessions("classId", date);
CREATE INDEX IF NOT EXISTS idx_cf_assignments_class ON cf_assignments("classId");
CREATE INDEX IF NOT EXISTS idx_cf_submissions_assignment ON cf_submissions("assignmentId");
CREATE INDEX IF NOT EXISTS idx_cf_submissions_student ON cf_submissions("studentId");
CREATE INDEX IF NOT EXISTS idx_cf_holidays_date ON cf_holidays(date);
CREATE INDEX IF NOT EXISTS idx_cf_users_username ON cf_users(username);
