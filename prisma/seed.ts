import { PrismaClient, Difficulty, QuestionType, QuizStatus, Visibility } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Milky Quiz database seeding...');

  // 1. Create Demo Users
  const passwordHash = await bcrypt.hash('password123', 12);

  const demoUser = await prisma.user.upsert({
    where: { username: 'quizmaster' },
    update: {},
    create: {
      username: 'quizmaster',
      fullName: 'Alex Quizmaster',
      passwordHash,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    },
  });

  const studentUser = await prisma.user.upsert({
    where: { username: 'speedylearner' },
    update: {},
    create: {
      username: 'speedylearner',
      fullName: 'Sam Student',
      passwordHash,
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    },
  });

  console.log(`👤 Users seeded: ${demoUser.username}, ${studentUser.username}`);

  // 2. Create Sample Quiz: Astronomy & Space Exploration
  const spaceQuiz = await prisma.quiz.upsert({
    where: { shareCode: 'MILKY001' },
    update: {},
    create: {
      authorId: demoUser.id,
      title: 'Cosmic Wonders: The Solar System & Beyond',
      description: 'Journey through stars, planets, and space mysteries in this comprehensive science quiz.',
      topic: 'Astronomy',
      difficulty: Difficulty.MEDIUM,
      status: QuizStatus.PUBLISHED,
      visibility: Visibility.PUBLIC,
      isPublic: true,
      shareCode: 'MILKY001',
      coverUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80',
      questions: {
        create: [
          {
            text: 'Which planet is known as the "Red Planet" due to iron oxide on its surface?',
            type: QuestionType.MCQ,
            orderIndex: 0,
            difficultyScore: 1.5,
            explanation: 'Mars is red because its surface rocks and dust are rich in iron oxide (rust).',
            hint: 'It is the fourth planet from the Sun.',
            options: {
              create: [
                { text: 'Venus', isCorrect: false },
                { text: 'Mars', isCorrect: true },
                { text: 'Jupiter', isCorrect: false },
                { text: 'Mercury', isCorrect: false },
              ],
            },
          },
          {
            text: 'Light from the Sun takes approximately how long to reach Earth?',
            type: QuestionType.MCQ,
            orderIndex: 1,
            difficultyScore: 2.5,
            explanation: 'Sunlight travels at ~300,000 km/s and takes about 8 minutes and 20 seconds to travel 150 million km.',
            hint: 'It takes between 7 and 9 minutes.',
            options: {
              create: [
                { text: '8 minutes 20 seconds', isCorrect: true },
                { text: 'Instantaneous', isCorrect: false },
                { text: '3 minutes 10 seconds', isCorrect: false },
                { text: '24 seconds', isCorrect: false },
              ],
            },
          },
          {
            text: 'The Milky Way is classified as a barred spiral galaxy.',
            type: QuestionType.TRUE_FALSE,
            orderIndex: 2,
            difficultyScore: 2.0,
            explanation: 'Observations confirm that the Milky Way is indeed a barred spiral galaxy.',
            hint: 'Look at the central bar-shaped structure of stars.',
            options: {
              create: [
                { text: 'True', isCorrect: true },
                { text: 'False', isCorrect: false },
              ],
            },
          },
          {
            text: 'What celestial object has a gravitational pull so strong that even light cannot escape?',
            type: QuestionType.MCQ,
            orderIndex: 3,
            difficultyScore: 3.0,
            explanation: 'Black holes have an event horizon beyond which no particles or radiation can escape.',
            hint: 'Singularity at its center.',
            options: {
              create: [
                { text: 'Neutron Star', isCorrect: false },
                { text: 'White Dwarf', isCorrect: false },
                { text: 'Black Hole', isCorrect: true },
                { text: 'Pulsar', isCorrect: false },
              ],
            },
          },
          {
            text: 'Which moon of Jupiter is considered the most volcanically active body in the Solar System?',
            type: QuestionType.MCQ,
            orderIndex: 4,
            difficultyScore: 4.0,
            explanation: 'Io experiences intense tidal heating from Jupiter and neighboring moons, powering hundreds of volcanoes.',
            hint: 'Its name is only two letters.',
            options: {
              create: [
                { text: 'Europa', isCorrect: false },
                { text: 'Ganymede', isCorrect: false },
                { text: 'Callisto', isCorrect: false },
                { text: 'Io', isCorrect: true },
              ],
            },
          },
        ],
      },
    },
  });

  console.log(`🚀 Space Quiz seeded: "${spaceQuiz.title}" (Code: ${spaceQuiz.shareCode})`);

  // 3. Create Sample Quiz: JavaScript & Web Architecture
  const jsQuiz = await prisma.quiz.upsert({
    where: { shareCode: 'DEVJS101' },
    update: {},
    create: {
      authorId: demoUser.id,
      title: 'JavaScript Core Concepts & Async Mastery',
      description: 'Test your understanding of the event loop, closures, promises, and TypeScript typing.',
      topic: 'Technology',
      difficulty: Difficulty.HARD,
      status: QuizStatus.PUBLISHED,
      visibility: Visibility.PUBLIC,
      isPublic: true,
      shareCode: 'DEVJS101',
      coverUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80',
      questions: {
        create: [
          {
            text: 'Which queue handles resolved Promise callbacks in the JavaScript Event Loop?',
            type: QuestionType.MCQ,
            orderIndex: 0,
            difficultyScore: 3.5,
            explanation: 'Promise callbacks (then, catch, finally) and queueMicrotask are placed in the Microtask Queue.',
            hint: 'It has higher priority than the Macrotask (Task) queue.',
            options: {
              create: [
                { text: 'Microtask Queue', isCorrect: true },
                { text: 'Macrotask Queue', isCorrect: false },
                { text: 'Render Queue', isCorrect: false },
                { text: 'I/O Polling Queue', isCorrect: false },
              ],
            },
          },
          {
            text: 'In JavaScript, typeof null returns "object" due to a historical bug in the initial implementation.',
            type: QuestionType.TRUE_FALSE,
            orderIndex: 1,
            difficultyScore: 2.0,
            explanation: 'In the first JS engine, values were stored in 32-bit units with a type tag. 000 meant object, and null was represented as the NULL pointer (0x00).',
            hint: 'Think about JS backwards compatibility.',
            options: {
              create: [
                { text: 'True', isCorrect: true },
                { text: 'False', isCorrect: false },
              ],
            },
          },
          {
            text: 'What is the return value of [1, 2, 3].map(parseInt)?',
            type: QuestionType.MCQ,
            orderIndex: 2,
            difficultyScore: 4.5,
            explanation: 'map passes (element, index). parseInt(1, 0) is 1; parseInt(2, 1) is NaN; parseInt(3, 2) is NaN.',
            hint: 'Remember parseInt takes an optional radix parameter as its second argument.',
            options: {
              create: [
                { text: '[1, 2, 3]', isCorrect: false },
                { text: '[1, NaN, NaN]', isCorrect: true },
                { text: '[1, 0, 0]', isCorrect: false },
                { text: 'TypeError', isCorrect: false },
              ],
            },
          },
        ],
      },
    },
  });

  console.log(`💻 Tech Quiz seeded: "${jsQuiz.title}" (Code: ${jsQuiz.shareCode})`);

  // 4. Create Initial User Topic Stats for Analytics Demo
  await prisma.userTopicStat.upsert({
    where: {
      userId_topic: {
        userId: studentUser.id,
        topic: 'Astronomy',
      },
    },
    update: {},
    create: {
      userId: studentUser.id,
      topic: 'Astronomy',
      totalQuestions: 15,
      correct: 12,
      avgTimeMs: 4200,
    },
  });

  await prisma.userTopicStat.upsert({
    where: {
      userId_topic: {
        userId: studentUser.id,
        topic: 'Technology',
      },
    },
    update: {},
    create: {
      userId: studentUser.id,
      topic: 'Technology',
      totalQuestions: 10,
      correct: 6,
      avgTimeMs: 6800,
    },
  });

  console.log('📊 Analytics topic stats seeded for Sam Student.');
  console.log('✅ Milky Quiz Database Seed Completed Successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
