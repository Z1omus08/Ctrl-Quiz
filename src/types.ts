export interface Question {
  id: string;
  text: string;
  answers: string[];
  correctAnswerIndex: number;
  type?: 'single' | 'multicheck' | 'text' | 'dropdown' | 'bricks';
  correctAnswerIndices?: number[]; // Dla 'multicheck'
  correctTextAnswers?: string[];   // Dla 'text' (opcjonalne, bez znaczenia wielkość liter)
  bricksText?: string;             // Dla 'bricks' (np. "Stolicą Polski jest [gap], a Francji [gap].")
  bricksCorrectAnswers?: string[]; // Dla 'bricks' (poprawne ułożenie luk)
  points?: number;                 // Indywidualna punktacja za pytanie
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  creatorId: string;
  defaultDuration: number; // w sekundach
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  className: string;
  joinedAt: number;
}

export type RoomStatus = 'waiting' | 'in_progress' | 'ended';

export interface ActiveRoom {
  code: string;
  quizId: string;
  quizTitle: string;
  status: RoomStatus;
  startedAt: number | null;
  createdAt: number;
  duration: number; // Limit czasu w sekundach
  joinedPlayers: Player[];
}

export interface PlayerResult {
  id: string;
  roomCode: string;
  firstName: string;
  lastName: string;
  className: string;
  quizTitle: string;
  answers: { [questionIndex: number]: any }; // Odpowiedź studenta na dane pytanie
  score: number; // Suma uzyskanych punktów
  totalQuestions: number; // Maksymalna możliwa punktacja
  percentage: number; // Wynik procentowy
  timestamp: number;
  timeRemaining?: number; // Czas, jaki pozostał
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'teacher' | 'student';
}

export function getQuestionMaxPoints(question: Question): number {
  if (question.points !== undefined && question.points !== null) {
    return question.points;
  }
  if (question.type === 'bricks') {
    const gapCount = (question.bricksText || '').split('[gap]').length - 1;
    return Math.max(1, question.bricksCorrectAnswers?.length || gapCount || 1);
  }
  return 1;
}

export function calculateQuestionScore(question: Question, studentAnswer: any): number {
  if (studentAnswer === undefined || studentAnswer === null) {
    return 0;
  }
  const type = question.type || 'single';
  
  if (type === 'bricks') {
    if (!Array.isArray(studentAnswer)) return 0;
    const correctAnswers = question.bricksCorrectAnswers || [];
    const gapCount = Math.max(1, correctAnswers.length || (question.bricksText || '').split('[gap]').length - 1 || 1);
    
    let correctGapsCount = 0;
    studentAnswer.forEach((ans, aIdx) => {
      const correctVal = correctAnswers[aIdx] || '';
      if (String(ans || '').trim().toLowerCase() === correctVal.trim().toLowerCase()) {
        correctGapsCount++;
      }
    });

    if (question.points !== undefined && question.points !== null) {
      return Number(((correctGapsCount / gapCount) * question.points).toFixed(2));
    }
    return correctGapsCount;
  }

  const isCorrect = isQuestionCorrectFallback(question, studentAnswer);
  return isCorrect ? getQuestionMaxPoints(question) : 0;
}

function isQuestionCorrectFallback(question: Question, studentAnswer: any): boolean {
  const type = question.type || 'single';
  
  if (type === 'single' || type === 'dropdown') {
    return Number(studentAnswer) === question.correctAnswerIndex;
  }
  
  if (type === 'multicheck') {
    const correctIndices = question.correctAnswerIndices || [question.correctAnswerIndex];
    if (!Array.isArray(studentAnswer)) return false;
    if (studentAnswer.length !== correctIndices.length) return false;
    return studentAnswer.every(val => correctIndices.includes(Number(val))) &&
           correctIndices.every(val => studentAnswer.includes(Number(val)));
  }
  
  if (type === 'text') {
    const studentStr = String(studentAnswer).trim().toLowerCase();
    const correctAnswers = question.correctTextAnswers && question.correctTextAnswers.length > 0 
      ? question.correctTextAnswers 
      : (question.answers || []);
    if (correctAnswers.length === 0) return false;
    return correctAnswers.some(ans => ans.trim().toLowerCase() === studentStr);
  }

  return false;
}

export function formatPolishPoints(pts: number): string {
  const rounded = Math.round(pts);
  if (rounded === 1) return `${pts} punkt`;
  const lastDigit = rounded % 10;
  const lastTwoDigits = rounded % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 10 || lastTwoDigits > 20)) {
    return `${pts} punkty`;
  }
  return `${pts} punktów`;
}