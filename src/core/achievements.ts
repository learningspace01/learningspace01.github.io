export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  unlocked: boolean
  unlockedAt: string | null
}

export function getAchievements(
  totalWords: number,
  masterWords: number,
  streakDays: number,
  sessionCount: number
): Achievement[] {
  return [
    {
      id: 'first_import',
      name: '初次导入',
      description: '导入第一个词库',
      icon: '📥',
      unlocked: totalWords > 0,
      unlockedAt: totalWords > 0 ? 'auto' : null,
    },
    {
      id: 'streak_7',
      name: '连续7天打卡',
      description: '连续学习7天',
      icon: '🔥',
      unlocked: streakDays >= 7,
      unlockedAt: null,
    },
    {
      id: 'master_50',
      name: '掌握50词',
      description: '累积掌握50个单词',
      icon: '⭐',
      unlocked: masterWords >= 50,
      unlockedAt: null,
    },
    {
      id: 'master_100',
      name: '掌握100词',
      description: '累积掌握100个单词',
      icon: '🌟',
      unlocked: masterWords >= 100,
      unlockedAt: null,
    },
    {
      id: 'streak_30',
      name: '连续30天打卡',
      description: '连续学习30天',
      icon: '💎',
      unlocked: streakDays >= 30,
      unlockedAt: null,
    },
    {
      id: 'finish_book',
      name: '完成一本词库',
      description: '掌握一本词库中的所有单词',
      icon: '🏆',
      unlocked: false,
      unlockedAt: null,
    },
  ]
}
