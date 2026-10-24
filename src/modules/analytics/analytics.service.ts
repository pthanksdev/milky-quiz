import { prisma } from '../../config/db';
import { UserTopicStat } from '@prisma/client';
import redis, { Keys } from '../../config/redis';

interface AnswerSummary {
  isCorrect: boolean;
  timeTakenMs: number;
}

// ─── Update topic stats on attempt completion ─────────────────
export const updateTopicStats = async (
  userId: string,
  topic: string,
  answers: AnswerSummary[],
) => {
  if (!answers || answers.length === 0) return;

  const correctCount = answers.filter((a) => a.isCorrect).length;
  const totalQuestions = answers.length;
  const totalTime = answers.reduce((sum, a) => sum + (a.timeTakenMs || 0), 0);

  const existing = await prisma.userTopicStat.findUnique({
    where: {
      userId_topic: {
        userId,
        topic,
      },
    },
  });

  if (existing) {
    const newTotal = existing.totalQuestions + totalQuestions;
    const newCorrect = existing.correct + correctCount;
    const prevTotalTime = existing.avgTimeMs * existing.totalQuestions;
    const newAvgTime = Math.round((prevTotalTime + totalTime) / newTotal);

    await prisma.userTopicStat.update({
      where: {
        userId_topic: {
          userId,
          topic,
        },
      },
      data: {
        totalQuestions: newTotal,
        correct: newCorrect,
        avgTimeMs: newAvgTime,
        lastUpdated: new Date(),
      },
    });
  } else {
    const avgTimeMs = Math.round(totalTime / totalQuestions);
    await prisma.userTopicStat.create({
      data: {
        userId,
        topic,
        totalQuestions,
        correct: correctCount,
        avgTimeMs,
      },
    });
  }

  // Invalidate cached analytics in Redis
  try {
    await redis.del(Keys.analytics(userId));
  } catch (err) {
    // Redis deletion error shouldn't fail stats update
  }
};

// ─── Get Personal Analytics Dashboard ─────────────────────────
export const getMyAnalytics = async (userId: string) => {
  // Check Redis cache first
  try {
    const cached = await redis.get(Keys.analytics(userId));
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    // Continue if redis is unavailable
  }

  // Fetch topic breakdown
  const topicStats = await prisma.userTopicStat.findMany({
    where: { userId },
    orderBy: { totalQuestions: 'desc' },
  });

  const formattedTopics = topicStats.map((t: UserTopicStat) => ({
    topic: t.topic,
    totalQuestions: t.totalQuestions,
    correct: t.correct,
    accuracy: t.totalQuestions > 0 ? Math.round((t.correct / t.totalQuestions) * 100) : 0,
    avgTimeMs: t.avgTimeMs,
  }));

  // Identify weakest 3 topics (with at least 3 questions attempted)
  const weakestTopics = [...formattedTopics]
    .filter((t) => t.totalQuestions >= 3)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);

  // Overall completed quiz stats
  const completedAttempts = await prisma.attempt.findMany({
    where: { userId, completedAt: { not: null } },
    orderBy: { completedAt: 'asc' },
    select: {
      id: true,
      score: true,
      totalQuestions: true,
      completedAt: true,
      mode: true,
    },
  });

  const totalQuizzes = completedAttempts.length;
  const totalCorrect = topicStats.reduce((sum: number, t: (typeof topicStats)[number]) => sum + t.correct, 0);
  const totalAttempted = topicStats.reduce((sum: number, t: (typeof topicStats)[number]) => sum + t.totalQuestions, 0);
  const overallAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;

  // Compute daily / weekly streak
  let currentStreak = 0;
  if (completedAttempts.length > 0) {
    const dateSet = new Set(
      completedAttempts.map((a: (typeof completedAttempts)[number]) => a.completedAt!.toISOString().split('T')[0]),
    );

    let checkDate = new Date();
    // Allow today or yesterday as the start of streak
    const todayStr = checkDate.toISOString().split('T')[0];
    checkDate.setDate(checkDate.getDate() - 1);
    const yesterdayStr = checkDate.toISOString().split('T')[0];

    let cursor = dateSet.has(todayStr)
      ? new Date()
      : dateSet.has(yesterdayStr)
      ? checkDate
      : null;

    if (cursor) {
      while (true) {
        const dStr = cursor.toISOString().split('T')[0];
        if (dateSet.has(dStr)) {
          currentStreak++;
          cursor.setDate(cursor.getDate() - 1);
        } else {
          break;
        }
      }
    }
  }

  // Weekly improvement data (grouped by year-week)
  const weeklyMap = new Map<string, { total: number; score: number }>();
  for (const attempt of completedAttempts) {
    const date = new Date(attempt.completedAt!);
    const year = date.getFullYear();
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    const key = `${year}-W${weekNum.toString().padStart(2, '0')}`;

    const current = weeklyMap.get(key) || { total: 0, score: 0 };
    current.total += attempt.totalQuestions;
    current.score += attempt.score;
    weeklyMap.set(key, current);
  }

  const weeklyProgress = Array.from(weeklyMap.entries())
    .map(([week, data]) => ({
      week,
      questionsAnswered: data.total,
      accuracy: data.total > 0 ? Math.round((data.score / data.total) * 100) : 0,
    }))
    .slice(-8); // Last 8 weeks

  const analytics = {
    totalQuizzesCompleted: totalQuizzes,
    totalQuestionsAnswered: totalAttempted,
    overallAccuracy,
    currentStreak,
    topicBreakdown: formattedTopics,
    weakestTopics,
    weeklyProgress,
  };

  // Cache in Redis for 5 minutes (300 seconds)
  try {
    await redis.set(Keys.analytics(userId), JSON.stringify(analytics), 'EX', 300);
  } catch (err) {
    // Continue if redis caching fails
  }

  return analytics;
};
