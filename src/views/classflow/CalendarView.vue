<script setup lang="ts">
import { ref, computed } from 'vue'
import { useClassFlowStore } from '@/stores/classflowStore'
import { useToast } from '@/composables/useToast'
import GlassCard from '@/components/GlassCard.vue'
import { ChevronLeft, ChevronRight, Plus, X, Sun, Calendar } from 'lucide-vue-next'
import type { CalendarHoliday } from '@/types/classflow'

const cf = useClassFlowStore()
const toast = useToast()

const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth() + 1) // 1-12

// Form state
const showForm = ref(false)
const editingHolidayId = ref<string | null>(null)
const formType = ref<'holiday' | 'reschedule'>('holiday')
const formDate = ref('')
const formReason = ref('')
const formClassId = ref<string | null>(null)
const formRescheduledDate = ref('')
const formRescheduleStart = ref('')
const formRescheduleEnd = ref('')

const dayNames = ['日', '一', '二', '三', '四', '五', '六']

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay()
}

const calendarDays = computed(() => {
  const totalDays = daysInMonth(currentYear.value, currentMonth.value)
  const firstDay = firstDayOfMonth(currentYear.value, currentMonth.value)
  const days: { day: number; date: string; isOther: boolean }[] = []
  // Previous month padding
  const prevMonth = currentMonth.value === 1 ? 12 : currentMonth.value - 1
  const prevYear = currentMonth.value === 1 ? currentYear.value - 1 : currentYear.value
  const prevDays = daysInMonth(prevYear, prevMonth)
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevDays - i
    const m = String(prevMonth).padStart(2, '0')
    const day = String(d).padStart(2, '0')
    days.push({ day: d, date: `${prevYear}-${m}-${day}`, isOther: true })
  }
  // Current month
  for (let d = 1; d <= totalDays; d++) {
    const m = String(currentMonth.value).padStart(2, '0')
    const day = String(d).padStart(2, '0')
    days.push({ day: d, date: `${currentYear.value}-${m}-${day}`, isOther: false })
  }
  return days
})

const monthHolidays = computed(() => {
  const start = `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-01`
  const end = `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-${String(daysInMonth(currentYear.value, currentMonth.value)).padStart(2, '0')}`
  return cf.getHolidaysByDateRange(start, end)
})

function getDotColors(date: string): string[] {
  const colors: string[] = []
  for (const h of monthHolidays.value) {
    if (h.date === date && h.date) {
      if (h.type === 'holiday') colors.push(h.classId === null ? '#EF4444' : '#F59E0B')
      if (h.type === 'reschedule') colors.push('#6366F1')
    }
    if (h.type === 'reschedule' && h.rescheduledDate === date) {
      colors.push('#10B981')
    }
  }
  return [...new Set(colors)]
}

function getDayHolidays(date: string): CalendarHoliday[] {
  return monthHolidays.value.filter(h => h.date === date || h.rescheduledDate === date)
}

const todayStr = new Date().toISOString().split('T')[0]

function prevMonth() {
  if (currentMonth.value === 1) { currentMonth.value = 12; currentYear.value-- }
  else { currentMonth.value-- }
}

function nextMonth() {
  if (currentMonth.value === 12) { currentMonth.value = 1; currentYear.value++ }
  else { currentMonth.value++ }
}

function openAddForm() {
  editingHolidayId.value = null
  formType.value = 'holiday'
  formDate.value = todayStr
  formReason.value = ''
  formClassId.value = null
  formRescheduledDate.value = ''
  formRescheduleStart.value = ''
  formRescheduleEnd.value = ''
  showForm.value = true
}

function openEditForm(holiday: CalendarHoliday) {
  editingHolidayId.value = holiday.id
  formType.value = holiday.type
  formDate.value = holiday.date
  formReason.value = holiday.reason
  formClassId.value = holiday.classId
  formRescheduledDate.value = holiday.rescheduledDate || ''
  formRescheduleStart.value = holiday.rescheduleStartTime || ''
  formRescheduleEnd.value = holiday.rescheduleEndTime || ''
  showForm.value = true
}

function handleSave() {
  if (!formDate.value || !formReason.value.trim()) return
  const data = {
    date: formDate.value,
    reason: formReason.value.trim(),
    classId: formClassId.value,
    type: formType.value,
    rescheduledDate: formType.value === 'reschedule' ? formRescheduledDate.value : undefined,
    rescheduleStartTime: formType.value === 'reschedule' ? formRescheduleStart.value : undefined,
    rescheduleEndTime: formType.value === 'reschedule' ? formRescheduleEnd.value : undefined,
  }
  if (editingHolidayId.value) {
    cf.updateHoliday(editingHolidayId.value, data)
    toast.show('已更新', '日历记录已更新', '✅', '#10B981')
  } else {
    cf.addHoliday(data)
    toast.show('已添加', '日历记录已添加', '✅', '#10B981')
  }
  showForm.value = false
}

function handleDelete(id: string) {
  if (confirm('确定要删除这条记录吗？')) {
    cf.deleteHoliday(id)
    toast.show('已删除', '日历记录已删除', '🗑️', '#EF4444')
  }
}

function quickHoliday(date: string) {
  formType.value = 'holiday'
  formDate.value = date
  formReason.value = ''
  formClassId.value = null
  formRescheduledDate.value = ''
  formRescheduleStart.value = ''
  formRescheduleEnd.value = ''
  editingHolidayId.value = null
  showForm.value = true
}

function className(id: string | null): string {
  if (id === null) return '全校'
  return cf.classes.find(c => c.id === id)?.name || '未知班级'
}
</script>

<template>
  <div class="calendar-view">
    <div class="page-header">
      <h2 class="page-title">放假日历</h2>
      <button class="btn-primary" @click="openAddForm">
        <Plus :size="16" stroke-width="2" />
        <span>添加记录</span>
      </button>
    </div>

    <!-- Calendar Grid -->
    <GlassCard padding="var(--space-3)" class="calendar-card">
      <div class="calendar-nav">
        <button class="nav-btn" @click="prevMonth">
          <ChevronLeft :size="20" stroke-width="2" />
        </button>
        <span class="nav-title">{{ currentYear }}年{{ currentMonth }}月</span>
        <button class="nav-btn" @click="nextMonth">
          <ChevronRight :size="20" stroke-width="2" />
        </button>
      </div>

      <div class="calendar-grid">
        <div v-for="d in dayNames" :key="d" class="cal-day-header">{{ d }}</div>
        <div
          v-for="(cell, idx) in calendarDays"
          :key="idx"
          class="cal-day"
          :class="{
            other: cell.isOther,
            today: cell.date === todayStr,
            'has-holiday': getDotColors(cell.date).length > 0,
          }"
          @click="!cell.isOther && quickHoliday(cell.date)"
        >
          <span class="cal-day-num">{{ cell.day }}</span>
          <div v-if="getDotColors(cell.date).length > 0" class="cal-dots">
            <span
              v-for="(c, ci) in getDotColors(cell.date)"
              :key="ci"
              class="cal-dot"
              :style="{ background: c }"
            />
          </div>
        </div>
      </div>

      <!-- Legend -->
      <div class="legend">
        <span class="legend-item"><span class="dot" style="background:#EF4444" />全校放假</span>
        <span class="legend-item"><span class="dot" style="background:#F59E0B" />班级放假</span>
        <span class="legend-item"><span class="dot" style="background:#6366F1" />调课</span>
        <span class="legend-item"><span class="dot" style="background:#10B981" />补课</span>
      </div>
    </GlassCard>

    <!-- Holiday List -->
    <section class="section">
      <h3 class="section-title">假期与调课记录</h3>
      <div v-if="monthHolidays.length === 0" class="empty-state">
        <Sun :size="48" stroke-width="1.5" color="var(--text-tertiary)" />
        <p>本月暂无安排</p>
      </div>
      <div v-else class="holiday-list">
        <div
          v-for="h in monthHolidays"
          :key="h.id"
          class="holiday-item"
          :class="h.type"
        >
          <div class="holiday-icon">
            <Sun v-if="h.type === 'holiday'" :size="18" stroke-width="2" color="#F59E0B" />
            <Calendar v-else :size="18" stroke-width="2" color="#6366F1" />
          </div>
          <div class="holiday-info">
            <span class="holiday-type">{{ h.type === 'holiday' ? '放假' : '调课' }}</span>
            <span class="holiday-date">{{ h.date }}</span>
            <span v-if="h.type === 'reschedule' && h.rescheduledDate" class="holiday-rs">
              → {{ h.rescheduledDate }}
              <template v-if="h.rescheduleStartTime"> {{ h.rescheduleStartTime }}-{{ h.rescheduleEndTime }}</template>
            </span>
            <span class="holiday-reason">{{ h.reason }}</span>
            <span class="holiday-class">{{ className(h.classId) }}</span>
          </div>
          <div class="holiday-actions">
            <button class="h-btn" @click="openEditForm(h)">编辑</button>
            <button class="h-btn danger" @click="handleDelete(h.id)">删除</button>
          </div>
        </div>
      </div>
    </section>

    <!-- Form Modal -->
    <Teleport to="body">
      <div v-if="showForm" class="modal-overlay" @click.self="showForm = false">
        <div class="modal-content">
          <h4>{{ editingHolidayId ? '编辑' : '添加' }}日历记录</h4>
          <div class="form-group">
            <label class="field">
              <span>类型</span>
              <select v-model="formType">
                <option value="holiday">放假</option>
                <option value="reschedule">调课</option>
              </select>
            </label>
            <label class="field">
              <span>日期</span>
              <input v-model="formDate" type="date" />
            </label>
            <label class="field">
              <span>班级</span>
              <select v-model="formClassId">
                <option :value="null">全校</option>
                <option v-for="cls in cf.classes" :key="cls.id" :value="cls.id">{{ cls.name }}</option>
              </select>
            </label>
            <label class="field full">
              <span>原因 <span class="required">*</span></span>
              <input v-model="formReason" placeholder="如：国庆节放假、调课" />
            </label>

            <!-- Reschedule fields -->
            <template v-if="formType === 'reschedule'">
              <label class="field">
                <span>补课日期</span>
                <input v-model="formRescheduledDate" type="date" />
              </label>
              <label class="field">
                <span>开始时间</span>
                <input v-model="formRescheduleStart" type="time" />
              </label>
              <label class="field">
                <span>结束时间</span>
                <input v-model="formRescheduleEnd" type="time" />
              </label>
            </template>
          </div>
          <div class="form-actions">
            <button class="btn btn-secondary" @click="showForm = false">取消</button>
            <button class="btn btn-primary" @click="handleSave" :disabled="!formReason.trim() || !formDate">
              {{ editingHolidayId ? '保存' : '添加' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.calendar-view {
  animation: fadeInUp 0.3s var(--ease-out);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6);
}

.page-title {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--text-primary);
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: #10B981;
  color: white;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  transition: background var(--duration-fast) var(--ease-out);
}

.btn-primary:hover { background: #059669; }

.calendar-card {
  margin-bottom: var(--space-4);
}

.calendar-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  margin-bottom: var(--space-3);
}

.nav-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  border-radius: var(--radius-md);
}

.nav-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.nav-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
  min-width: 120px;
  text-align: center;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0;
}

.cal-day-header {
  text-align: center;
  font-size: 0.6rem;
  font-weight: 500;
  color: var(--text-tertiary);
  padding: 2px 0;
  line-height: 1;
}

.cal-day {
  position: relative;
  height: 36px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out);
  gap: 0;
}

.cal-day:not(.other):hover {
  background: var(--bg-secondary);
}

.cal-day.other {
  opacity: 0.3;
  cursor: default;
}

.cal-day.today .cal-day-num {
  background: #10B981;
  color: white;
  width: 20px;
  height: 20px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cal-day-num {
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1;
}

.cal-dots {
  display: flex;
  gap: 1px;
  position: absolute;
  bottom: 1px;
}

.cal-dot {
  width: 3px;
  height: 3px;
  border-radius: var(--radius-full);
}

.legend {
  display: flex;
  justify-content: center;
  gap: var(--space-3);
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--border);
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 0.65rem;
  color: var(--text-tertiary);
}

.legend-item .dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
}

.section {
  margin-bottom: var(--space-6);
}

.section-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-4);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-8);
  color: var(--text-tertiary);
}

.holiday-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.holiday-item {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--border);
}

.holiday-item.holiday { border-left-color: #F59E0B; }
.holiday-item.reschedule { border-left-color: #6366F1; }

.holiday-icon {
  flex-shrink: 0;
}

.holiday-info {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
}

.holiday-type {
  font-weight: 600;
  font-size: 0.7rem;
  padding: 1px var(--space-2);
  border-radius: var(--radius-sm);
}

.holiday-item.holiday .holiday-type {
  background: rgba(245, 158, 11, 0.12);
  color: #F59E0B;
}

.holiday-item.reschedule .holiday-type {
  background: rgba(99, 102, 241, 0.12);
  color: #6366F1;
}

.holiday-date {
  font-weight: 500;
  color: var(--text-primary);
}

.holiday-rs {
  color: var(--accent);
  font-size: var(--text-xs);
}

.holiday-reason {
  color: var(--text-secondary);
}

.holiday-class {
  font-size: 0.65rem;
  color: var(--text-tertiary);
  padding: 1px var(--space-2);
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
}

.holiday-actions {
  display: flex;
  gap: var(--space-1);
  flex-shrink: 0;
}

.h-btn {
  padding: var(--space-1) var(--space-2);
  font-size: 0.7rem;
  color: #10B981;
  border-radius: var(--radius-sm);
}

.h-btn:hover { background: rgba(16, 185, 129, 0.08); }
.h-btn.danger { color: var(--danger); }
.h-btn.danger:hover { background: rgba(239, 68, 68, 0.08); }

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
}

.modal-content {
  background: white;
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  width: 90%;
  max-width: 480px;
  box-shadow: var(--shadow-xl);
}

.modal-content h4 {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-4);
}

.form-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field.full { grid-column: 1 / -1; }

.field span { font-size: var(--text-xs); font-weight: 500; color: var(--text-secondary); }
.required { color: var(--danger); }

.field input, .field select {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: var(--bg-primary);
}

.field input:focus, .field select:focus {
  outline: none;
  border-color: #10B981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-5);
}

.btn { padding: var(--space-2) var(--space-5); border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: 500; cursor: pointer; transition: all var(--duration-fast) var(--ease-out); }
.btn-secondary { background: var(--bg-secondary); color: var(--text-secondary); }
.btn-secondary:hover { background: var(--bg-tertiary); }

[data-theme="dark"] .modal-content {
  background: var(--dark-surface);
}

[data-theme="dark"] .field input,
[data-theme="dark"] .field select {
  background: var(--dark-bg);
  border-color: var(--dark-border);
}

@media (max-width: 480px) {
  .form-group {
    grid-template-columns: 1fr;
  }
}
</style>
