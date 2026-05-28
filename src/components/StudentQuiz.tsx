import React, { useState, useEffect, useRef } from 'react';
import { ActiveRoom, Player, PlayerResult, Question, Quiz, getQuestionMaxPoints, calculateQuestionScore, formatPolishPoints } from '../types';
import { Play, Sparkles, Timer, ArrowRight, CheckCircle2, XCircle, AlertCircle, Award, User, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StudentQuizProps {
  room: ActiveRoom;
  activeQuizzes: Quiz[];
  onPlayerJoin: (player: Player) => void;
  onSaveResult: (result: PlayerResult) => void;
  onExit: () => void;
}

// Verify answer correctness for any question type
export function isQuestionAnswerCorrect(question: Question, studentAnswer: any): boolean {
  const type = question.type || 'single';
  
  if (studentAnswer === undefined || studentAnswer === null) {
    return false;
  }
  
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
  
  if (type === 'bricks') {
    if (!Array.isArray(studentAnswer)) return false;
    const correctAnswers = question.bricksCorrectAnswers || [];
    if (studentAnswer.length !== correctAnswers.length) return false;
    return studentAnswer.every((ans, aIdx) => {
      const correctVal = correctAnswers[aIdx] || '';
      return String(ans || '').trim().toLowerCase() === correctVal.trim().toLowerCase();
    });
  }
  
  return false;
}

export default function StudentQuiz({
  room,
  activeQuizzes,
  onPlayerJoin,
  onSaveResult,
  onExit,
}: StudentQuizProps) {
  // 1. Identity Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [className, setClassName] = useState('');
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [localPlayerId, setLocalPlayerId] = useState('');

  // 2. Active Quiz State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [qIndex: number]: number }>({});
  const [timeRemaining, setTimeRemaining] = useState<number>(room.duration);
  const [quizFinished, setQuizFinished] = useState(false);
  const [calculatedResult, setCalculatedResult] = useState<PlayerResult | null>(null);

  // Stable shuffled version of questions
  const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([]);

  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-find corresponding Quiz object for details
  const associatedQuiz = activeQuizzes.find((q) => q.id === room.quizId);

  // Initialize shuffled questions once when associatedQuiz loads
  useEffect(() => {
    if (associatedQuiz?.questions && shuffledQuestions.length === 0) {
      const shuffled = [...associatedQuiz.questions].sort(() => Math.random() - 0.5);
      setShuffledQuestions(shuffled);
    }
  }, [associatedQuiz, shuffledQuestions.length]);

  const questions = shuffledQuestions.length > 0 ? shuffledQuestions : (associatedQuiz?.questions || []);

  // Generate unique ID for this device session
  useEffect(() => {
    const rId = localStorage.getItem('device_player_id') || 'pl-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('device_player_id', rId);
    setLocalPlayerId(rId);

    // If player has already joined this room on this device, pre-populate
    const storedJoinedJoined = localStorage.getItem(`joined_room_${room.code}`);
    if (storedJoinedJoined) {
      try {
        const parsed = JSON.parse(storedJoinedJoined);
        setFirstName(parsed.firstName);
        setLastName(parsed.lastName);
        setClassName(parsed.className);
        setFormSubmitted(true);
      } catch (e) {
        console.error('Error parsing stored player identity', e);
      }
    }
  }, [room.code]);

  // Form submit to Join Game
  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !className.trim()) return;

    const newPlayer: Player = {
      id: localPlayerId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      className: className.trim(),
      joinedAt: Date.now(),
    };

    onPlayerJoin(newPlayer);
    setFormSubmitted(true);
    localStorage.setItem(`joined_room_${room.code}`, JSON.stringify(newPlayer));
  };

  // Monitor Global Timer when Room is In Progress
  useEffect(() => {
    if (room.status !== 'in_progress' || !room.startedAt) return;

    const calculateTimeRemaining = () => {
      const elapsedMs = Date.now() - room.startedAt!;
      const totalDurationMs = room.duration * 1000;
      const leftSecs = Math.max(0, Math.ceil((totalDurationMs - elapsedMs) / 1000));
      return leftSecs;
    };

    // Set initial
    const initialLeft = calculateTimeRemaining();
    setTimeRemaining(initialLeft);

    if (initialLeft <= 0) {
      handleForceFinish();
      return;
    }

    timerIntervalRef.current = setInterval(() => {
      const remaining = calculateTimeRemaining();
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(timerIntervalRef.current!);
        handleForceFinish();
      }
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [room.status, room.startedAt, room.duration]);

  // Watch for Room Status shifts
  useEffect(() => {
    // If the room was forced to "ended" by host, finish player quiz too
    if (room.status === 'ended' && formSubmitted && !quizFinished) {
      handleForceFinish();
    }
  }, [room.status]);

  // Select Choice Answer
  const handleSelectChoice = (choiceIndex: number) => {
    if (quizFinished) return;
    setSelectedAnswers({
      ...selectedAnswers,
      [currentQuestionIndex]: choiceIndex,
    });
  };

  // Save/Compile final scores
  const handleForceFinish = () => {
    setQuizFinished(true);

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    // Double-check stored answers
    let totalPointsAchieved = 0;
    let totalMaxPoints = 0;
    const mappedAnswers: { [originalIndex: number]: any } = {};

    questions.forEach((q, idx) => {
      const chosen = selectedAnswers[idx];
      totalPointsAchieved += calculateQuestionScore(q, chosen);
      totalMaxPoints += getQuestionMaxPoints(q);

      // Map shuffled indexes back to original indexes in the quiz template
      const originalIdx = (associatedQuiz?.questions || []).findIndex((oq) => oq.id === q.id);
      if (originalIdx !== -1) {
        mappedAnswers[originalIdx] = chosen;
      }
    });

    const finalPercentage = Number(((totalPointsAchieved / (totalMaxPoints || 1)) * 100).toFixed(1));

    const finalResult: PlayerResult = {
      id: `res-${Math.random().toString(36).substr(2, 9)}`,
      roomCode: room.code,
      firstName: firstName || 'Anonim',
      lastName: lastName || 'Uczeń',
      className: className || 'Brak',
      quizTitle: room.quizTitle,
      answers: mappedAnswers,
      score: Number(totalPointsAchieved.toFixed(2)),
      totalQuestions: totalMaxPoints,
      percentage: finalPercentage,
      timestamp: Date.now(),
      timeRemaining: timeRemaining,
    };

    setCalculatedResult(finalResult);
    onSaveResult(finalResult);
  };

  // Human timer display formatting: (MM:SS)
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  // Circle path for absolute time visual countdown
  const timerCircleProgress = (timeRemaining / (room.duration || 1)) * 282.6; // 2 * PI * r = 2 * 3.14 * 45

  // -------------------------------------------------------------
  // RENDERING STAGES
  // -------------------------------------------------------------

  // STAGE A: User Info Entry Form
  if (!formSubmitted) {
    return (
      <div id="student-identity-screen" className="max-w-md mx-auto py-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xl"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-[#5F7A61]/10 text-[#5F7A61] rounded-xl flex items-center justify-center">
              <User className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs uppercase font-extrabold tracking-wider text-[#5F7A61]">Kod gry: {room.code}</p>
              <h2 className="text-xl font-bold text-slate-800">Przedstaw się</h2>
            </div>
          </div>

          <div className="mb-6 p-4 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-600">
            <span className="font-semibold text-slate-800">Temat quizu:</span> {room.quizTitle}
          </div>

          <form onSubmit={handleJoinSubmit} className="space-y-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Imię
              </label>
              <input
                id="firstName"
                required
                type="text"
                placeholder="np. Ania"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full input px-4 py-2.5 bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-800 border border-slate-200 focus:border-[#5F7A61] focus:ring-4 focus:ring-[#5F7A61]/10 focus:outline-none rounded-xl text-base transition-all"
              />
            </div>

            <div>
              <label htmlFor="lastName" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Nazwisko
              </label>
              <input
                id="lastName"
                required
                type="text"
                placeholder="np. Nowak"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full input px-4 py-2.5 bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-800 border border-slate-200 focus:border-[#5F7A61] focus:ring-4 focus:ring-[#5F7A61]/10 focus:outline-none rounded-xl text-base transition-all"
              />
            </div>

            <div>
              <label htmlFor="className" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Klasa
              </label>
              <input
                id="className"
                required
                type="text"
                placeholder="np. 4A, 1G, Studia"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="w-full input px-4 py-2.5 bg-slate-50 hover:bg-slate-100 focus:bg-white text-slate-800 border border-slate-200 focus:border-[#5F7A61] focus:ring-4 focus:ring-[#5F7A61]/10 focus:outline-none rounded-xl text-base transition-all"
              />
            </div>

            <button
              id="student-join-btn"
              type="submit"
              className="w-full mt-6 py-3 px-4 bg-[#5F7A61] hover:bg-[#4D634F] text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              <span>Wejdź do poczekalni</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <button
            id="student-cancel-btn"
            onClick={onExit}
            className="w-full mt-3 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 border border-transparent rounded-xl transition-all"
          >
            Anuluj i wróć
          </button>
        </motion.div>
      </div>
    );
  }

  // STAGE B: Waiting for the Host to click START
  if (room.status === 'waiting') {
    return (
      <div id="student-waiting-screen" className="max-w-lg mx-auto py-12 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xl relative overflow-hidden"
        >
          {/* Decorative glowing gradient circle */}
          <div className="absolute -right-12 -top-12 w-40 h-40 bg-emerald-100 rounded-full filter blur-2xl opacity-50 pointer-events-none" />

          <div className="w-16 h-16 bg-emerald-50 text-[#5F7A61] rounded-full mx-auto flex items-center justify-center mb-6 animate-pulse">
            <Sparkles className="w-8 h-8" />
          </div>

          <p className="text-xs font-bold uppercase tracking-widest text-[#5F7A61] mb-1">
            Połączono jako {firstName} {lastName} ({className})
          </p>
          <div className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 font-extrabold text-[11px] rounded-full uppercase mb-4 border border-emerald-100">
            Gotowy do gry
          </div>

          <h2 className="text-2xl font-extrabold text-slate-800 mb-2 leading-tight">
            {room.quizTitle}
          </h2>
          <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
            {associatedQuiz?.description || 'Niedługo nauczyciel rozpocznie ten quiz. Przygotuj się!'}
          </p>

          <div className="py-6 px-4 bg-slate-50 rounded-2xl border border-slate-100 mb-6 font-medium text-slate-700 text-sm flex flex-col items-center justify-center gap-1.5">
            <span className="flex items-center gap-1 text-[#5F7A61] font-bold uppercase tracking-wider text-xs">
              <Timer className="w-3.5 h-3.5" /> Całkowity czas quizu
            </span>
            <span className="text-lg font-mono font-bold text-slate-800">
              {formatTime(room.duration)} ({Math.ceil(room.duration / 60)} min)
            </span>
            <span className="text-xs text-slate-400">
              Licznik odmierza czas na cały quiz po załadowaniu pytań.
            </span>
          </div>

          <div className="flex items-center justify-center gap-3 py-2 text-slate-500 font-medium text-xs">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
            <span>Oczekiwanie na kliknięcie przycisku <strong>START</strong> przez prowadzącego...</span>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between gap-4">
            <button
              id="student-exit-waiting-btn"
              onClick={onExit}
              className="px-4 py-2 text-sm font-semibold text-pink-600 hover:bg-pink-50 rounded-lg transition-all"
            >
              Opuść pokój
            </button>
            <div className="text-xs text-slate-400 flex items-center justify-center">
              Kod pokoju: <strong className="ml-1 text-slate-700">{room.code}</strong>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // STAGE C: Active Questions Taking
  if (room.status === 'in_progress' && !quizFinished) {
    const currentQuestion = questions[currentQuestionIndex];

    if (!currentQuestion) {
      return (
        <div id="student-error-questions" className="text-center py-10 px-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800">Brak pytań w tym quizie</h2>
          <button onClick={onExit} className="mt-4 px-4 py-2 bg-slate-200 rounded text-slate-700">Wróć</button>
        </div>
      );
    }

    const currentQuestionType = currentQuestion.type || 'single';
    const studentAnswerVal = selectedAnswers[currentQuestionIndex];
    let hasSelected = false;
    
    if (currentQuestionType === 'single' || currentQuestionType === 'dropdown') {
      hasSelected = studentAnswerVal !== undefined && studentAnswerVal !== '';
    } else if (currentQuestionType === 'multicheck') {
      hasSelected = Array.isArray(studentAnswerVal) && studentAnswerVal.length > 0;
    } else if (currentQuestionType === 'text') {
      hasSelected = typeof studentAnswerVal === 'string' && studentAnswerVal.trim().length > 0;
    } else if (currentQuestionType === 'bricks') {
      hasSelected = Array.isArray(studentAnswerVal) && studentAnswerVal.some(b => typeof b === 'string' && b.trim().length > 0);
    }

    const isLastQuestion = currentQuestionIndex === questions.length - 1;

    return (
      <div id="student-quiz-active-screen" className="max-w-xl mx-auto py-2 px-2 sm:py-4 sm:px-4">
        {/* Dynamic header with timer and score status */}
        <div className="flex items-center justify-between gap-2 max-sm:gap-4 mb-2 sm:mb-4 bg-white p-2 sm:p-3 rounded-xl border border-slate-200 shadow-sm text-xs">
          <div className="flex items-center gap-2">
            <div className="relative w-7 h-7 sm:w-10 sm:h-10 flex items-center justify-center shrink-0">
              {/* Radial countdown ring */}
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 48 48">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  className="stroke-slate-100 fill-none"
                  strokeWidth="3.5"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  className={`fill-none transition-all duration-1000 ${
                    timeRemaining <= 15 ? 'stroke-rose-500 animate-pulse' : 'stroke-[#5F7A61]'
                  }`}
                  strokeWidth="3.5"
                  strokeDasharray="125.6"
                  strokeDashoffset={125.6 - (timeRemaining / (room.duration || 1)) * 125.6}
                />
              </svg>
              <Timer className={`absolute w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 ${timeRemaining <= 15 ? 'text-rose-500 animate-bounce' : 'text-[#5F7A61]'}`} />
            </div>
            <div>
              <p className="text-[7.5px] sm:text-[9.5px] uppercase font-bold text-slate-400">Pozostały czas</p>
              <p className={`font-mono text-xs sm:text-base font-bold ${timeRemaining <= 15 ? 'text-rose-600 font-extrabold' : 'text-slate-700'}`}>
                {formatTime(timeRemaining)}
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[7.5px] sm:text-[9.5px] uppercase font-bold text-slate-400">Postęp pytań</p>
            <p className="font-semibold text-slate-700 text-xs sm:text-sm">
              <span className="text-xs sm:text-lg font-bold text-[#5F7A61]">{currentQuestionIndex + 1}</span> / {questions.length}
            </p>
          </div>
        </div>

        {/* Current Question Block */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.15 }}
            className="bg-white rounded-xl border border-slate-200 p-3.5 sm:p-6 shadow-sm relative"
          >
            <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-3">
              <div className="flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-[#5F7A61]" />
                <span className="text-[10px] font-bold text-[#5F7A61] uppercase tracking-widest">
                  {currentQuestionType === 'single' && 'Jednokrotny wybór'}
                  {currentQuestionType === 'multicheck' && 'Wielokrotny wybór'}
                  {currentQuestionType === 'text' && 'Odpowiedź pisemna'}
                  {currentQuestionType === 'dropdown' && 'Wybór z listy'}
                  {currentQuestionType === 'bricks' && 'Przesuwanie cegiełek'}
                </span>
              </div>
              <span className="text-[9px] sm:text-xs font-bold text-[#5F7A61] bg-[#5F7A61]/10 border border-[#5F7A61]/20 px-1.5 py-0.5 rounded font-mono shrink-0">
                {formatPolishPoints(getQuestionMaxPoints(currentQuestion))}
              </span>
            </div>

            <h3 className="text-xs sm:text-base lg:text-lg font-bold text-slate-800 leading-snug mb-2 sm:mb-5">
              {currentQuestion.text}
            </h3>

            {/* Render conditional widget based on Question Type */}
            {currentQuestionType === 'single' && (
              <div className="space-y-1.5 sm:space-y-2.5">
                {currentQuestion.answers.map((answer, cIndex) => {
                  const isSelected = studentAnswerVal === cIndex;
                  const alphabetLabel = String.fromCharCode(65 + cIndex); // A, B, C, D

                  return (
                     <button
                      key={cIndex}
                      id={`choice-btn-${cIndex}`}
                      onClick={() => handleSelectChoice(cIndex)}
                      className={`w-full min-h-[32px] sm:min-h-[42px] flex items-center text-left gap-2 sm:gap-3 p-1.5 sm:p-3 rounded-lg border text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'bg-[#5F7A61]/10 border-[#5F7A61] text-[#5F7A61] shadow-xs ring-1 ring-[#5F7A61]'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <span className={`w-4 h-4 sm:w-5.5 h-5.5 shrink-0 text-[9px] sm:text-xs font-mono font-bold flex items-center justify-center rounded transition-colors ${
                        isSelected ? 'bg-[#5F7A61] text-white' : 'bg-white border border-slate-300 text-slate-500'
                      }`}>
                        {alphabetLabel}
                      </span>
                      <span className="grow break-words tracking-tight leading-tight">{answer}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {currentQuestionType === 'multicheck' && (
              <div className="space-y-1.5 sm:space-y-2.5">
                <p className="text-[9px] sm:text-[11px] text-amber-700 bg-amber-50 rounded-lg p-1 sm:p-2 font-bold flex items-center gap-1 border border-amber-100 mb-1 sm:mb-2">
                  <Sparkles className="w-3 h-3 sm:w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Możesz zaznaczyć więcej niż jedną poprawną odpowiedź!</span>
                </p>
                {currentQuestion.answers.map((answer, cIndex) => {
                  const currentSelection = Array.isArray(studentAnswerVal) ? studentAnswerVal : [];
                  const isSelected = currentSelection.includes(cIndex);
                  const alphabetLabel = String.fromCharCode(65 + cIndex);

                  return (
                    <button
                      key={cIndex}
                      id={`choice-multi-btn-${cIndex}`}
                      onClick={() => {
                        const updated = isSelected
                           ? currentSelection.filter((item) => item !== cIndex)
                          : [...currentSelection, cIndex];
                        setSelectedAnswers({
                          ...selectedAnswers,
                          [currentQuestionIndex]: updated,
                        });
                      }}
                      className={`w-full min-h-[32px] sm:min-h-[42px] flex items-center text-left gap-2 sm:gap-3 p-1.5 sm:p-3 rounded-lg border text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'bg-[#5F7A61]/10 border-[#5F7A61] text-[#5F7A61] shadow-xs ring-1 ring-[#5F7A61]'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 sm:w-4 h-4 shrink-0 rounded flex items-center justify-center border transition-colors ${
                        isSelected ? 'bg-[#5F7A61] border-[#5F7A61] text-white' : 'bg-white border-slate-300'
                      }`}>
                        {isSelected && (
                          <svg className="w-2 h-2 sm:w-3 h-3 stroke-3 stroke-current" fill="none" viewBox="0 0 24 24">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      <span className="text-slate-500 font-mono font-bold text-[9px] sm:text-xs bg-white w-4 h-4 sm:w-5 h-5 rounded border border-slate-250 flex items-center justify-center shrink-0">
                        {alphabetLabel}
                      </span>
                      <span className="grow break-words tracking-tight leading-tight">{answer}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {currentQuestionType === 'text' && (
              <div className="space-y-1.5 sm:space-y-3">
                <label htmlFor="student-text" className="block text-[9px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Wpisz swoją odpowiedź poniżej:
                </label>
                <input
                  id="student-text"
                  type="text"
                  placeholder="Wpisz tekst tutaj..."
                  value={studentAnswerVal || ''}
                  onChange={(e) => {
                    setSelectedAnswers({
                      ...selectedAnswers,
                      [currentQuestionIndex]: e.target.value,
                    });
                  }}
                  className="w-full px-3 py-1.5 sm:px-4 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:outline-none focus:border-[#5F7A61] text-slate-800 transition-all font-semibold"
                />
                <p className="text-[9px] sm:text-[10px] text-slate-400 font-semibold italic">
                  Wskazówka: System nie zwraca uwagi na wielkość liter i usuwa zbędne spacje na początku i końcu słowa.
                </p>
              </div>
            )}

            {currentQuestionType === 'dropdown' && (
              <div className="space-y-1.5 sm:space-y-3">
                <label htmlFor="student-dropdown" className="block text-[9px] sm:text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Wybierz poprawną odpowiedź z listy:
                </label>
                <select
                  id="student-dropdown"
                  value={studentAnswerVal !== undefined ? studentAnswerVal : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedAnswers({
                      ...selectedAnswers,
                      [currentQuestionIndex]: val !== '' ? Number(val) : undefined,
                    });
                  }}
                  className="w-full px-2.5 py-1.5 sm:px-4 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:border-[#5F7A61] text-slate-800 cursor-pointer"
                >
                  <option value="">-- Wybierz odpowiedź --</option>
                  {currentQuestion.answers.map((answer, cIndex) => (
                    <option key={cIndex} value={cIndex}>
                      {answer}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {currentQuestionType === 'bricks' && (() => {
              const textContent = currentQuestion.bricksText || currentQuestion.text || '';
              const parts = textContent.split('[gap]');
              const gapCount = parts.length - 1;
              const currentBricksState: string[] = Array.isArray(studentAnswerVal)
                ? studentAnswerVal
                : Array(gapCount).fill('');

              return (
                <div className="space-y-3 sm:space-y-4">
                  <div className="p-2 sm:p-4 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl leading-relaxed text-xs sm:text-sm font-semibold text-slate-800">
                    {parts.map((part, pIdx) => (
                      <React.Fragment key={pIdx}>
                        <span>{part}</span>
                        {pIdx < gapCount && (() => {
                          const filledWord = currentBricksState[pIdx];
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                if (!filledWord) return;
                                const nextState = [...currentBricksState];
                                nextState[pIdx] = '';
                                setSelectedAnswers({
                                  ...selectedAnswers,
                                  [currentQuestionIndex]: nextState,
                                });
                              }}
                              className={`inline-flex items-center justify-center align-middle mx-1 px-1.5 py-0.5 min-w-[40px] sm:min-w-[60px] rounded-md border text-[9px] sm:text-xs font-black transition-all cursor-pointer ${
                                filledWord
                                  ? 'bg-[#5F7A61] text-white border-[#5F7A61] shadow-xs hover:bg-[#4E644F] active:scale-95'
                                  : 'bg-white border-dashed border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-slate-50 min-h-[18px] sm:min-h-[22px]'
                              }`}
                              title={filledWord ? 'Kliknij, żeby wyciągnąć cegiełkę' : 'Wstaw cegiełkę tutaj'}
                            >
                              {filledWord || `Luka ${pIdx + 1}`}
                            </button>
                          );
                        })()}
                      </React.Fragment>
                    ))}
                  </div>

                  <div>
                    <span className="block text-[8px] sm:text-[9.5px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Pula dostępnych cegiełek (kliknij, by dopasować w wolne miejsce):
                    </span>
                    <div className="flex flex-wrap gap-1 sm:gap-2">
                      {currentQuestion.answers.map((brickWord, bIdx) => {
                        const isPlaced = currentBricksState.includes(brickWord);
                        return (
                          <button
                            key={bIdx}
                            type="button"
                            disabled={isPlaced}
                            onClick={() => {
                              const emptyIdx = currentBricksState.indexOf('');
                              if (emptyIdx !== -1) {
                                const nextState = [...currentBricksState];
                                nextState[emptyIdx] = brickWord;
                                setSelectedAnswers({
                                  ...selectedAnswers,
                                  [currentQuestionIndex]: nextState,
                                });
                              }
                            }}
                            className={`px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded border text-[9px] sm:text-xs font-bold transition-all cursor-pointer ${
                              isPlaced
                                ? 'bg-slate-100 border-slate-100 text-slate-300 cursor-not-allowed'
                                : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-[#5F7A61] text-slate-700 shadow-3xs'
                            }`}
                          >
                            {brickWord}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1.5 text-[8.5px] sm:text-[9.5px] text-slate-400 font-semibold italic">
                      Wskazówka: Cegiełka wędruje do pierwszej wolnej luki. Kliknij cegiełkę w zdaniu powyżej aby ją usunąć.
                    </p>
                  </div>
                </div>
              );
            })()}
          </motion.div>
        </AnimatePresence>

        {/* Navigation bottom buttons */}
        <div className="mt-2.5 sm:mt-4 flex justify-between items-center">
          <button
            id="student-prev-btn"
            disabled={currentQuestionIndex === 0}
            onClick={() => setCurrentQuestionIndex(currentQuestionIndex - 1)}
            className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
              currentQuestionIndex === 0
                ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95'
            }`}
          >
            Poprzednie
          </button>

          {isLastQuestion ? (
            <button
              id="student-finalize-btn"
              onClick={handleForceFinish}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 ${
                hasSelected ? 'bg-[#5F7A61] hover:bg-[#4D634F] shadow-emerald-100/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100'
               }`}
            >
              <span>{hasSelected ? 'Zakończ Quiz' : 'Zapisz i Zakończ'}</span>
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            </button>
          ) : (
            <button
              id="student-next-btn"
              onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
            >
              <span>Następne</span>
              <ArrowRight className="w-3 h-3 shrink-0" />
            </button>
          )}
        </div>

        {/* Quietly list user information at bottom right */}
        <div className="mt-2.5 sm:mt-4 text-center text-[9px] sm:text-xs text-slate-400 font-medium">
          Uczeń: <strong>{firstName} {lastName} ({className})</strong> • Kod quizu: <strong>{room.code}</strong>
        </div>
      </div>
    );
  }

  // STAGE D: Results View (Submitted & Displaying Scores + Review)
  if (quizFinished && calculatedResult) {
    const isExcellent = calculatedResult.percentage >= 80;
    const isMedium = calculatedResult.percentage >= 50 && calculatedResult.percentage < 80;

    return (
      <div id="student-results-screen" className="max-w-2xl mx-auto py-8 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xl text-center mb-6"
        >
          <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 bg-emerald-50 border border-emerald-100/60 shadow-inner">
            <Award className="w-8 h-8 text-[#5F7A61]" />
          </div>

          <p className="text-xs uppercase font-extrabold tracking-wider text-[#5F7A61] mb-1">
            Skorowano pomyślnie i zapisano!
          </p>
          <h2 className="text-2xl font-bold text-slate-900 mb-1 leading-tight">Twój wynik końcowy</h2>
          <p className="text-sm font-semibold text-slate-500 mb-6">
            Dziękujemy za udział, <span className="text-slate-800 font-bold">{firstName} {lastName} ({className})</span>!
          </p>

          <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto mb-8">
            <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl flex flex-col items-center justify-center">
              <span className="text-xs font-bold text-slate-400 uppercase">Punkty uzyskane</span>
              <span className="text-2xl font-mono font-black text-[#5F7A61] mt-1">
                {calculatedResult.score} <span className="text-sm text-slate-400 font-normal">z {calculatedResult.totalQuestions}</span>
              </span>
            </div>

            <div className={`p-4 border border-slate-100 rounded-xl flex flex-col items-center justify-center ${
              isExcellent ? 'bg-emerald-50/50' : isMedium ? 'bg-amber-50/50' : 'bg-rose-50/50'
            }`}>
              <span className="text-xs font-bold text-slate-400 uppercase">Procenty</span>
              <span className={`text-2xl font-mono font-black mt-1 ${
                isExcellent ? 'text-emerald-700' : isMedium ? 'text-amber-700' : 'text-rose-700'
              }`}>
                {calculatedResult.percentage}%
              </span>
            </div>
          </div>

          {/* Review answers directly in UI - now hidden to prevent cheating/leakage */}
          <div className="text-center border-t border-slate-100 pt-6 px-4">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6 max-w-md mx-auto">
              <CheckCircle2 className="w-10 h-10 text-[#5F7A61] mx-auto mb-3" />
              <h3 className="text-sm font-extrabold text-[#3E3E3E] uppercase tracking-wider mb-1.5">
                Twoje odpowiedzi zostały zapisane
              </h3>
              <p className="text-xs text-slate-550 leading-relaxed font-semibold">
                Szczegółowy podgląd poprawnych odpowiedzi został ukryty dla uczestników quizu. Nauczyciel ma pełny podgląd Twoich odpowiedzi i punktów w swoim panelu.
              </p>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <button
              id="student-exit-done-btn"
              onClick={onExit}
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold rounded-xl transition-all inline-block hover:shadow-lg active:scale-95 cursor-pointer"
            >
              Wróć do strony głównej
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Fallback
  return null;
}
