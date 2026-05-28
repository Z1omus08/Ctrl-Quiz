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
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [className, setClassName] = useState('');
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [localPlayerId, setLocalPlayerId] = useState('');

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [qIndex: number]: any }>({});
  const [timeRemaining, setTimeRemaining] = useState<number>(room.duration);
  const [quizFinished, setQuizFinished] = useState(false);
  const [calculatedResult, setCalculatedResult] = useState<PlayerResult | null>(null);

  const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const associatedQuiz = activeQuizzes.find((q) => q.id === room.quizId);

  useEffect(() => {
    if (associatedQuiz?.questions && shuffledQuestions.length === 0) {
      const shuffled = [...associatedQuiz.questions].sort(() => Math.random() - 0.5);
      setShuffledQuestions(shuffled);
    }
  }, [associatedQuiz, shuffledQuestions.length]);

  const questions = shuffledQuestions.length > 0 ? shuffledQuestions : (associatedQuiz?.questions || []);

  useEffect(() => {
    const rId = localStorage.getItem('device_player_id') || 'pl-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('device_player_id', rId);
    setLocalPlayerId(rId);

    const storedJoined = localStorage.getItem(`joined_room_${room.code}`);
    if (storedJoined) {
      try {
        const parsed = JSON.parse(storedJoined);
        setFirstName(parsed.firstName);
        setLastName(parsed.lastName);
        setClassName(parsed.className);
        setFormSubmitted(true);
      } catch (e) {
        console.error('Błąd dekodowania profilu gracza', e);
      }
    }
  }, [room.code]);

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

  useEffect(() => {
    if (room.status !== 'in_progress' || !room.startedAt) return;

    const calculateTimeRemaining = () => {
      const elapsedMs = Date.now() - room.startedAt!;
      const totalDurationMs = room.duration * 1000;
      const leftSecs = Math.max(0, Math.ceil((totalDurationMs - elapsedMs) / 1000));
      return leftSecs;
    };

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

  useEffect(() => {
    if (room.status === 'ended' && formSubmitted && !quizFinished) {
      handleForceFinish();
    }
  }, [room.status]);

  const handleSelectChoice = (choiceIndex: number) => {
    if (quizFinished) return;
    setSelectedAnswers({
      ...selectedAnswers,
      [currentQuestionIndex]: choiceIndex,
    });
  };

  const handleForceFinish = () => {
    setQuizFinished(true);

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    let totalPointsAchieved = 0;
    let totalMaxPoints = 0;
    const mappedAnswers: { [originalIndex: number]: any } = {};

    questions.forEach((q, idx) => {
      const chosen = selectedAnswers[idx];
      totalPointsAchieved += calculateQuestionScore(q, chosen);
      totalMaxPoints += getQuestionMaxPoints(q);

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

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

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

          <div className="mb-6 p-4 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-600 font-medium">
            <span className="font-semibold text-slate-800">Temat quizu:</span> {room.quizTitle}
          </div>

          <form onSubmit={handleJoinSubmit} className="space-y-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-semibold text-slate-700 mb-1.5">Imię</label>
              <input
                id="firstName" required type="text" placeholder="np. Ania" value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-semibold text-slate-700 mb-1.5">Nazwisko</label>
              <input
                id="lastName" required type="text" placeholder="np. Nowak" value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label htmlFor="className" className="block text-sm font-semibold text-slate-700 mb-1.5">Klasa</label>
              <input
                id="className" required type="text" placeholder="np. 4A, 1G, Studia" value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <button
              id="student-join-btn" type="submit"
              className="w-full mt-6 py-3 px-4 bg-[#5F7A61] text-white rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Wejdź do poczekalni</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
          <button onClick={onExit} className="w-full mt-3 py-2.5 text-sm font-semibold text-slate-500">
            Anuluj i wróć
          </button>
        </motion.div>
      </div>
    );
  }

  if (room.status === 'waiting') {
    return (
      <div id="student-waiting-screen" className="max-w-lg mx-auto py-12 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xl relative"
        >
          <div className="w-16 h-16 bg-emerald-50 text-[#5F7A61] rounded-full mx-auto flex items-center justify-center mb-6 animate-pulse">
            <Sparkles className="w-8 h-8" />
          </div>

          <p className="text-xs font-bold uppercase tracking-widest text-[#5F7A61] mb-1">
            Połączono jako {firstName} {lastName} ({className})
          </p>
          <div className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 font-extrabold text-[11px] rounded-full uppercase mb-4 border">
            Gotowy do gry
          </div>

          <h2 className="text-2xl font-extrabold text-slate-800 mb-2">{room.quizTitle}</h2>
          <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
            {associatedQuiz?.description || 'Niedługo nauczyciel rozpocznie ten quiz. Przygotuj się!'}
          </p>

          <div className="py-6 px-4 bg-slate-50 rounded-2xl border mb-6 text-sm">
            <span className="flex items-center gap-1 text-[#5F7A61] font-bold uppercase tracking-wider text-xs justify-center">
              <Timer className="w-3.5 h-3.5" /> Całkowity czas quizu
            </span>
            <span className="text-lg font-mono font-bold text-slate-800 block mt-1.5">
              {formatTime(room.duration)}
            </span>
          </div>

          <div className="flex items-center justify-center gap-3 py-2 text-slate-500 text-xs">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
            <span>Oczekiwanie na rozpoczęcie gry przez prowadzącego...</span>
          </div>

          <div className="mt-8 pt-6 border-t flex justify-between gap-4">
            <button onClick={onExit} className="px-4 py-2 text-sm font-semibold text-pink-600 hover:bg-pink-50 rounded-lg animate-fade-in">
              Opuść pokój
            </button>
            <div className="text-xs text-slate-400 flex items-center">
              Kod pokoju: <strong className="ml-1 text-slate-700">{room.code}</strong>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (room.status === 'in_progress' && !quizFinished) {
    const currentQuestion = questions[currentQuestionIndex];

    if (!currentQuestion) {
      return (
        <div id="student-error-questions" className="text-center py-10 px-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800">Brak pytań w tym quizie</h2>
          <button onClick={onExit} className="mt-4 px-4 py-2 bg-slate-200 rounded">Wróć</button>
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
        <div className="flex items-center justify-between gap-2 mb-2 sm:mb-4 bg-white p-2 sm:p-3 rounded-xl border border-slate-200 text-xs shadow-3xs">
          <div className="flex items-center gap-2">
            <Timer className={`w-4 h-4 ${timeRemaining <= 15 ? 'text-rose-500 animate-bounce' : 'text-[#5F7A61]'}`} />
            <div>
              <p className="text-[9px] uppercase font-bold text-slate-400">Pozostały czas</p>
              <p className={`font-mono text-xs sm:text-sm font-bold ${timeRemaining <= 15 ? 'text-rose-600 font-extrabold' : 'text-slate-700'}`}>
                {formatTime(timeRemaining)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase font-bold text-slate-400">Postęp</p>
            <p className="font-semibold text-slate-700">
              <span className="text-[#5F7A61] font-bold">{currentQuestionIndex + 1}</span> / {questions.length}
            </p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.15 }}
            className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-sm relative"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[10px] font-bold text-[#5F7A61] uppercase tracking-wider">
                {currentQuestionType === 'single' && 'Jednokrotny wybór'}
                {currentQuestionType === 'multicheck' && 'Wielokrotny wybór'}
                {currentQuestionType === 'text' && 'Odpowiedź pisemna'}
                {currentQuestionType === 'dropdown' && 'Wybór z listy'}
                {currentQuestionType === 'bricks' && 'Zadanie z lukami'}
              </span>
              <span className="text-[9px] sm:text-xs font-bold text-[#5F7A61] bg-[#5F7A61]/10 px-1.5 py-0.5 rounded font-mono">
                {formatPolishPoints(getQuestionMaxPoints(currentQuestion))}
              </span>
            </div>

            <h3 className="text-xs sm:text-base lg:text-lg font-bold text-slate-800 leading-snug mb-4">
              {currentQuestion.text}
            </h3>

            {currentQuestionType === 'single' && (
              <div className="space-y-2">
                {currentQuestion.answers.map((answer, cIndex) => {
                  const isSelected = studentAnswerVal === cIndex;
                  return (
                    <button
                      key={cIndex}
                      onClick={() => handleSelectChoice(cIndex)}
                      className={`w-full min-h-[36px] flex items-center text-left gap-3 p-2.5 rounded-lg border text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#5F7A61]/10 border-[#5F7A61] text-[#5F7A61] ring-1 ring-[#5F7A61]'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <span className={`w-5 h-5 shrink-0 text-xs font-mono font-bold flex items-center justify-center rounded ${
                        isSelected ? 'bg-[#5F7A61] text-white' : 'bg-white border text-slate-500'
                      }`}>
                        {String.fromCharCode(65 + cIndex)}
                      </span>
                      <span className="grow break-words">{answer}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {currentQuestionType === 'multicheck' && (
              <div className="space-y-2">
                {currentQuestion.answers.map((answer, cIndex) => {
                  const currentSelection = Array.isArray(studentAnswerVal) ? studentAnswerVal : [];
                  const isSelected = currentSelection.includes(cIndex);
                  return (
                    <button
                      key={cIndex}
                      onClick={() => {
                        const updated = isSelected
                          ? currentSelection.filter((item) => item !== cIndex)
                          : [...currentSelection, cIndex];
                        setSelectedAnswers({
                          ...selectedAnswers,
                          [currentQuestionIndex]: updated,
                        });
                      }}
                      className={`w-full min-h-[36px] flex items-center text-left gap-3 p-2.5 rounded-lg border text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#5F7A61]/10 border-[#5F7A61] text-[#5F7A61] ring-1 ring-[#5F7A61]'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className={`w-4 h-4 shrink-0 rounded flex items-center justify-center border ${
                        isSelected ? 'bg-[#5F7A61] text-white' : 'bg-white'
                      }`}>
                        {isSelected && <span className="text-[10px]">✓</span>}
                      </div>
                      <span className="grow break-words">{answer}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {currentQuestionType === 'text' && (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Wpisz tekst tutaj..."
                  value={studentAnswerVal || ''}
                  onChange={(e) => {
                    setSelectedAnswers({
                      ...selectedAnswers,
                      [currentQuestionIndex]: e.target.value,
                    });
                  }}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none"
                />
              </div>
            )}

            {currentQuestionType === 'dropdown' && (
              <div className="space-y-2">
                <select
                  value={studentAnswerVal !== undefined ? studentAnswerVal : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedAnswers({
                      ...selectedAnswers,
                      [currentQuestionIndex]: val !== '' ? Number(val) : undefined,
                    });
                  }}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm"
                >
                  <option value="">-- Wybierz odpowiedź --</option>
                  {currentQuestion.answers.map((answer, cIndex) => (
                    <option key={cIndex} value={cIndex}>{answer}</option>
                  ))}
                </select>
              </div>
            )}

            {currentQuestionType === 'bricks' && (() => {
              const textContent = currentQuestion.bricksText || '';
              const parts = textContent.split('[gap]');
              const gapCount = parts.length - 1;
              const currentBricksState: string[] = Array.isArray(studentAnswerVal)
                ? studentAnswerVal
                : Array(gapCount).fill('');

              return (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm leading-relaxed text-slate-800 font-semibold">
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
                              className={`inline-flex items-center justify-center align-middle mx-1 px-2 py-0.5 rounded border text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
                                filledWord ? 'bg-[#5F7A61] text-white border-[#5F7A61]' : 'bg-white border-dashed text-slate-400'
                              }`}
                            >
                              {filledWord || `Luka ${pIdx + 1}`}
                            </button>
                          );
                        })()}
                      </React.Fragment>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
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
                          className={`px-2.5 py-1 rounded border text-xs font-semibold ${
                            isPlaced ? 'bg-slate-100 text-slate-300' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {brickWord}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </motion.div>
        </AnimatePresence>

        <div className="mt-4 flex justify-between items-center">
          <button
            disabled={currentQuestionIndex === 0}
            onClick={() => setCurrentQuestionIndex(currentQuestionIndex - 1)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white cursor-pointer"
          >
            Poprzednie
          </button>

          {isLastQuestion ? (
            <button
              onClick={handleForceFinish}
              className="px-4 py-2 bg-[#5F7A61] text-white rounded-lg text-xs font-bold cursor-pointer"
            >
              Zakończ i Zapisz Quiz
            </button>
          ) : (
            <button
              onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
              className="px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer"
            >
              Następne
            </button>
          )}
        </div>
      </div>
    );
  }

  if (quizFinished && calculatedResult) {
    return (
      <div id="student-results-screen" className="max-w-md mx-auto py-8 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xl"
        >
          <Award className="w-12 h-12 text-[#5F7A61] mx-auto mb-4 animate-bounce" />
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Twój wynik końcowy</h2>
          <p className="text-sm text-slate-500 mb-6">{firstName} {lastName} ({className})</p>

          <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto mb-6">
            <div className="bg-slate-50 p-3 rounded-xl border">
              <span className="text-[10px] font-bold text-slate-400 block">PUNKTY</span>
              <span className="text-xl font-mono font-bold text-slate-800">{calculatedResult.score} / {calculatedResult.totalQuestions}</span>
            </div>
            <div className="bg-[#5F7A61]/10 p-3 rounded-xl border border-[#5F7A61]/25">
              <span className="text-[10px] font-bold text-slate-400 block">WYNIK</span>
              <span className="text-xl font-mono font-bold text-[#5F7A61]">{calculatedResult.percentage}%</span>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-xs text-slate-500 font-medium">
              Odpowiedzi zostały zapisane pomyślnie. Szczegółowe wyniki i zestawienie błędów zostały przesłane do bazy danych prowadzącego.
            </p>
          </div>

          <button onClick={onExit} className="mt-6 w-full py-2.5 bg-slate-800 text-white rounded-xl font-semibold text-sm cursor-pointer">
            Wyjdź
          </button>
        </motion.div>
      </div>
    );
  }

  return null;
}