# 学生工作台（Student Workspace）实现计划

## 概述

在 ClassFlow 模块中新增第 7 个标签页 "学生工作台"，允许学生（通过下拉选择器自选身份）查看所有跨班级作业并提交文件。同时提供 "班级作业概览" 模式，让教师快速查看全班学生在各作业上的提交状态。

---

## 1. 需要修改/创建的文件清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 修改 | `src/stores/classflowStore.ts` | 新增 2 个 getter 函数 |
| 新建 | `src/views/classflow/StudentWorkspace.vue` | 主视图组件 |
| 修改 | `src/views/classflow/ClassFlowMaster.vue` | 新增第 7 个标签页 |

无需修改 `src/types/classflow.ts`，现有类型已满足需求。

---

## 2. Store 新增内容 (`classflowStore.ts`)

在 `return` 块之前增加两个函数：

### 2.1 `getAssignmentsByStudent(studentId)`

```ts
function getAssignmentsByStudent(studentId: string): Assignment[] {
  // 1. 找出该学生所在的所有班级
  const classIds = classes.value
    .filter(c => c.studentIds.includes(studentId))
    .map(c => c.id)
  // 2. 返回这些班级的所有作业，按 deadline 排序
  return assignments.value
    .filter(a => classIds.includes(a.classId))
    .sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''))
}
```

**用途**：学生工作台的核心数据源——展示该学生所有待办作业。

### 2.2 `getClassSubmissionOverview(classId, assignmentId?)`

```ts
function getClassSubmissionOverview(classId: string, assignmentId?: string) {
  const students = getStudentsByClass(classId)
  const classAssignments = assignments.value.filter(a => a.classId === classId)
  const targetAssignments = assignmentId
    ? classAssignments.filter(a => a.id === assignmentId)
    : classAssignments

  return students.map(student => {
    const submissions = targetAssignments.map(asg => {
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
```

**用途**：教师概览矩阵——行=学生，列=作业，单元格=状态徽标。

**注意**：`getOrCreateSubmission` 是幂等的，即使学生尚未提交也会创建 pending 记录，确保矩阵完整。此函数被调用时会自动创建缺失的 pending submission 记录（设计上可接受）。

在 `return` 块的末尾加入这两个函数：

```ts
return {
  // ... 现有所有导出 ...
  // 新增
  getAssignmentsByStudent,
  getClassSubmissionOverview,
}
```

---

## 3. `StudentWorkspace.vue` 组件结构

### 3.1 组件架构总览

```
StudentWorkspace.vue
│
├── 模式切换 (modeToggle)
│   ├── "学生工作台" (student 模式)
│   └── "班级概览" (overview 模式)
│
├── [student 模式] 学生选择器
│   └── dropdown 列出所有 activeStudents
│
├── [student 模式] 已选学生的作业列表
│   ├── 统计卡片行 (总作业数 / 已提交 / 已批改 / 平均分)
│   ├── 按班级分组的作业卡片列表
│   │   └── 每项作业一张 AssignmentCard
│   │       ├── 标题、描述、截止日期
│   │       ├── 状态徽标 (未提交/已提交/已批改/已退回)
│   │       ├── 分数显示 (已批改时)
│   │       ├── 评语显示 (已批改时)
│   │       └── 文件上传按钮 (pending 状态时)
│   └── 无作业时的空状态
│
├── [student 模式] 提交文件 Modal
│   ├── 文件选择器 (支持多文件)
│   ├── 已选文件列表
│   └── 确认提交按钮
│
├── [overview 模式] 班级选择器
│   └── dropdown 列出所有 classes
│
├── [overview 模式] 作业选择器 (可选，默认 "全部")
│   └── dropdown: "全部作业" + 各作业标题
│
├── [overview 模式] 概览矩阵表格
│   ├── 表头：作业1 | 作业2 | ... (动态列)
│   ├── 行：学生名 + 各作业状态徽标
│   ├── 徽标颜色：pending=灰色, submitted=黄色, graded=绿色, returned=蓝色
│   ├── 支持点击徽标查看详情
│   └── 底部汇总行 (提交率)
│
└── [组件内] SubmissionModal (文件上传)
    └── 复用现有 useClassFlowFileStorage
```

### 3.2 详细组件分解

#### 3.2.1 模式切换 (mode toggle)

- 使用两个按钮或 segmented control：`学生工作台` / `班级概览`
- 用 `ref<'student' | 'overview'>('student')` 控制
- 与 ClassFlowMaster 的 tab 设计风格一致

#### 3.2.2 学生选择器 (student selector)

- `<select v-model="selectedStudentId">` 
- 选项来自 `cf.activeStudents`，在 `onMounted` 时自动选中第一个
- 当 `selectedStudentId` 变化时，所有作业数据通过 computed 自动更新
- 显示当前学生的名字和班级归属（如："张三（周六班 · 周三班）"）

#### 3.2.3 作业列表 (assignment list)

**核心 computed `studentAssignments`**:

```ts
const studentAssignments = computed(() => {
  if (!selectedStudentId.value) return []
  const asgs = cf.getAssignmentsByStudent(selectedStudentId.value)
  return asgs.map(asg => {
    const cls = cf.classes.find(c => c.id === asg.classId)
    const sub = cf.getOrCreateSubmission(asg.id, selectedStudentId.value)
    return { assignment: asg, className: cls?.name || '', submission: sub }
  })
})
```

**按班级分组**：

```ts
const assignmentsByClass = computed(() => {
  const map = new Map<string, { className: string; color: string; items: typeof studentAssignments.value }>()
  for (const item of studentAssignments.value) {
    const cls = cf.classes.find(c => c.id === item.assignment.classId)
    const key = cls?.id || 'unknown'
    if (!map.has(key)) {
      map.set(key, { className: cls?.name || '未知班级', color: cls?.color || '#999', items: [] })
    }
    map.get(key)!.items.push(item)
  }
  return Array.from(map.entries())
})
```

**作业卡片渲染**：对每个 `item: { assignment, className, submission }`：

```
┌──────────────────────────────────────────┐
│ 📘 周六班 · 截止: 2026-06-10            │
│                                          │
│ Unit 4 录音作业                          │
│ 请录制第 4 单元对话音频                 │
│                                          │
│ 状态: ● 未提交                          │
│ 或:   ✅ 已提交 (3 个文件) 2026-06-05  │
│ 或:   ⭐ 已批改 92分 "发音清晰"        │
│ 或:   ↩️ 已退回                         │
│                                          │
│ [📤 提交文件]  (仅 pending/returned 时) │
└──────────────────────────────────────────┘
```

#### 3.2.4 提交 Modal (SubmissionModal)

内嵌或独立的 Teleport modal：

- 标题：`提交作业：{作业标题}`
- 文件选择器 `<input type="file" multiple>`
- 已选文件列表（文件名、大小）
- 提交按钮调用 `cf.submitAssignment(assignmentId, studentId, fileMetas)`
- 提交后关闭 modal，toast 通知，列表自动刷新

文件上传逻辑复用现有模式：

```ts
async function handleSubmit() {
  const fileMetas = await Promise.all(
    files.value.map(f => fs.storeFile(f, `${assignmentId}_${studentId}`))
  )
  cf.submitAssignment(assignmentId, studentId, fileMetas)
  toast.show('已提交', `作业「${title}」提交成功`, '📤', '#10B981')
  showModal.value = false
}
```

#### 3.2.5 班级作业概览矩阵 (overview mode)

**核心 computed**:

```ts
const overviewData = computed(() => {
  if (!overviewClassId.value) return null
  return cf.getClassSubmissionOverview(overviewClassId.value, overviewAssignmentId.value || undefined)
})
```

**表格渲染**：

```
┌──────────┬────────────┬────────────┬────────────┬────────────┐
│ 学生     │ Unit 4作业 │ Unit 5作业 │ Unit 6作业 │ 提交率     │
├──────────┼────────────┼────────────┼────────────┼────────────┤
│ 张三     │ ✅ 已批改  │ ⏳ 已提交  │ ⬜ 未提交  │ 66%        │
│ 李四     │ ⏳ 已提交  │ ✅ 已批改  │ ⏳ 已提交  │ 100%       │
│ 王五     │ ⬜ 未提交  │ ⬜ 未提交  │ ⬜ 未提交  │ 0%         │
├──────────┼────────────┼────────────┼────────────┼────────────┤
│ 提交率   │ 66%        │ 66%        │ 33%        │            │
└──────────┴────────────┴────────────┴────────────┴────────────┘
```

**状态徽标映射**：

| 状态 | 显示文字 | 颜色 |
|------|---------|------|
| `pending` | 未提交 | `var(--text-tertiary)` |
| `submitted` | 待批改 | `#F59E0B` (warning) |
| `graded` | 已批改 | `#10B981` (success) |
| `returned` | 已退回 | `#4F6EF7` (accent) |

**交互**：
- 点击已提交的单元格可查看提交时间和文件数量
- 点击已批改的单元格可查看分数和评语
- 也可以选择不实现点击交互，保持纯概览

### 3.3 状态枚举 (内部)

```ts
const mode = ref<'student' | 'overview'>('student')
const selectedStudentId = ref('')
const overviewClassId = ref('')
const overviewAssignmentId = ref('')  // '' 表示全部

// 提交 modal
const showSubmitModal = ref(false)
const submittingAssignment = ref<Assignment | null>(null)
const submitFiles = ref<File[]>([])
```

---

## 4. ClassFlowMaster.vue 的修改

### 4.1 新增 Icon 导入

```ts
import { BookOpen } from 'lucide-vue-next'
```

### 4.2 新增 Tab 配置

```ts
const tabs = [
  { id: 'dashboard',   label: '仪表盘', icon: LayoutDashboard },
  { id: 'students',    label: '学生库',  icon: Users },
  { id: 'classes',     label: '班级管理', icon: GraduationCap },
  { id: 'attendance',  label: '签到台',  icon: ClipboardCheck },
  { id: 'assignments', label: '作业中心', icon: FileEdit },
  { id: 'calendar',    label: '日历',    icon: CalendarDays },
  // 新增：
  { id: 'workspace',   label: '学生工作台', icon: BookOpen },
]
```

### 4.3 导入新视图

```ts
import StudentWorkspace from './StudentWorkspace.vue'
```

### 4.4 添加条件渲染

```html
<StudentWorkspace v-else-if="activeTab === 'workspace'" />
```

---

## 5. 与现有批改流程的集成

| 学生工作台的操作 | 对现有系统的影响 |
|----------------|----------------|
| 学生选择身份 | 无，纯本地状态 |
| 学生提交文件 | `cf.submitAssignment()` → 创建/更新 Submission → 状态变为 `submitted` |
| 提交后 | AssignmentsView 的 Kanban "已提交待批改" 列自动出现该项 |
| 教师批改后 | 学生工作台自动显示分数和评语（Submission 是响应式的） |
| 教师退回后 | 状态变为 `returned`，学生工作台显示退回状态，允许重新提交 |

**无需额外集成代码**——Pinia 的响应式状态确保所有视图自动同步。`AssignmentsView.vue` 中的 Kanban 已经通过 `cf.getSubmissionsByAssignment()` + `cf.pendingSubmissions` 实时反映所有提交。

---

## 6. "需要帮助" 标记（Stretch Goal）

### 设计思路

在 Submission 类型中新增可选字段 `studentNote?: string`，或在类型中新增 `helpRequested?: boolean`。

**方案 A（推荐）**：在作业卡片上增加一个 "标记为需要帮助" 的 toggle 按钮。提交时或提交后，学生可以切换此标记。教师在批改时能看到此标记。

**需要的类型变更** (`classflow.ts`)：
```ts
export interface Submission {
  // ...现有字段
  studentNote?: string       // 新增：学生备注/求助信息
  helpRequested?: boolean    // 新增：是否需要帮助
}
```

**Store 新增方法**：
```ts
function setStudentNote(submissionId: string, note: string): void {
  const sub = submissions.value.find(s => s.id === submissionId)
  if (sub) { sub.studentNote = note; sub.updatedAt = nowISO() }
}

function toggleHelpRequest(submissionId: string): void {
  const sub = submissions.value.find(s => s.id === submissionId)
  if (sub) { sub.helpRequested = !sub.helpRequested; sub.updatedAt = nowISO() }
}
```

**AssignmentsView 集成**：在 Kanban 的 submitted 列卡片上显示 `🚩 需要帮助` 标记。

**注意**：这是扩展目标，可根据实际需要决定是否在第一版实现。

---

## 7. 暗色模式适配

遵循现有模式：
- 所有容器背景用 CSS 变量 `var(--bg-primary)`, `var(--bg-secondary)`
- 文字用 `var(--text-primary)`, `var(--text-secondary)`, `var(--text-tertiary)`
- 边框用 `var(--border)`
- 需要额外覆盖的自定义容器使用 `[data-theme="dark"]` 选择器

具体需要暗色覆写的元素：

```css
/* 作业卡片容器 */
[data-theme="dark"] .assignment-card {
  background: var(--dark-surface);
}

/* 概览表格 */
[data-theme="dark"] .overview-table td,
[data-theme="dark"] .overview-table th {
  border-color: var(--dark-border);
}

[data-theme="dark"] .overview-table tr:hover td {
  background: var(--dark-bg);
}

/* Modal */
[data-theme="dark"] .submit-modal {
  background: var(--dark-surface);
}
```

---

## 8. 实施步骤（按顺序）

### 步骤 1：Store 新增 getter 函数
- 编辑 `src/stores/classflowStore.ts`
- 增加 `getAssignmentsByStudent` 函数
- 增加 `getClassSubmissionOverview` 函数
- 在 `return` 块中导出这两个函数

### 步骤 2：新建 `StudentWorkspace.vue`
- 创建文件 `src/views/classflow/StudentWorkspace.vue`
- 实现以下内容：
  - Script setup 部分：import 所有依赖，定义 ref/computed
  - 模式切换 UI（student / overview）
  - 学生选择器（dropdown）
  - 统计卡片行（4 个小卡片）
  - 按班级分组的作业卡片列表
  - 提交文件 Modal
  - 班级概览矩阵表格
  - 所有样式（含暗色模式覆写）

### 步骤 3：修改 `ClassFlowMaster.vue`
- 导入 `BookOpen` icon 和 `StudentWorkspace` 组件
- 在 `tabs` 数组末尾新增 workspace tab
- 在模板的条件渲染中添加 `StudentWorkspace` 分支

### 步骤 4：（可选）扩展类型以支持 "需要帮助"
- 修改 `src/types/classflow.ts` 中的 `Submission` 接口
- 在 Store 中新增 `setStudentNote` 和 `toggleHelpRequest`

---

## 9. 验证步骤

1. **Tab 导航**：确认 ClassFlowMaster 显示第 7 个 tab "学生工作台"，点击后切换到 StudentWorkspace 视图
2. **学生选择**：dropdown 列出所有 active 学生，选择后作业列表正确加载
3. **作业展示**：确认显示该学生所属所有班级的作业，状态正确（pending/submitted/graded/returned）
4. **文件提交**：在 pending 作业上点击提交，选择文件，确认提交后：
   - 学生工作台状态变为 "已提交"
   - AssignmentsView 的 Kanban 中对应卡片出现在 "已提交待批改" 列
5. **教师批改**：在 AssignmentsView 中批改该提交，回到学生工作台确认分数和评语显示
6. **退回重交**：教师退回后，学生工作台显示退回状态，允许重新提交
7. **班级概览**：切换到 overview 模式，选择班级和（可选）作业，确认矩阵表格正确显示所有学生的状态
8. **暗色模式**：切换暗色模式，确认所有元素视觉正常
9. **响应式**：在移动端视口下确认布局适配
10. **数据持久化**：刷新页面，确认学生选择器和所有数据恢复

---

## 10. 关键设计决策总结

| 决策 | 方案 | 理由 |
|------|------|------|
| 学生身份选择 | Dropdown 选择器 | 无认证系统，最简单直接 |
| 作业分组 | 按班级分组展示 | 与学生认知一致，"我有哪些班的什么作业" |
| 提交模态框 | 内嵌 Teleport Modal | 与 GradingModal 风格一致，复用现有模式 |
| 概览矩阵 | 切换模式而非独立 tab | 减少 tab 数量，逻辑内聚 |
| 状态同步 | 自动（Pinia 响应式） | 无需手动刷新，现有 store 已支持 |
| 文件存储 | 复用 useClassFlowFileStorage | 与现有提交流程完全兼容 |
