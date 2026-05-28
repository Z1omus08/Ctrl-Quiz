import React, { useState, useEffect } from 'react';
import { ActiveRoom, Player, PlayerResult, Question, Quiz, User, getQuestionMaxPoints, calculateQuestionScore } from '../types';
import { 
  Plus, Play, Trophy, Users, CheckCircle, Download, Trash2, 
  Settings, Clock, Sparkles, BookOpen, AlertCircle, RefreshCw, ChevronRight, FileSpreadsheet, PlusCircle,
  Edit, BarChart2, UserCheck, ChevronDown, CheckCircle2, XCircle, UserPlus, Info, X, Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { hashPassword } from '../utils/hash';

interface AdminPanelProps {
  quizzes: Quiz[];
  activeRooms: ActiveRoom[];
  allResults: PlayerResult[];
  currentUser?: User | null;
  onAddNewQuiz: (quiz: Quiz) => void;
  onEditQuiz: (quiz: Quiz) => void;
  onDeleteQuiz: (quizId: string) => void;
  onLaunchRoom: (quizId: string, customCode: string, durationSecs: number) => void;
  onStartRoom: (code: string) => void;
  onEndRoom: (code: string) => void;
  onClearResults: () => void;
  supabaseClient?: any; // Klient Supabase zintegrowany z bazą
}

export default function AdminPanel({
  quizzes,
  activeRooms,
  allResults,
  currentUser,
  onAddNewQuiz,
  onEditQuiz,
  onDeleteQuiz,
  onLaunchRoom,
  onStartRoom,
  onEndRoom,
  onClearResults,
  supabaseClient,
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'rooms' | 'quizzes' | 'results' | 'users'>('rooms');

  const [isCreatingQuiz, setIsCreatingQuiz] = useState(false);
  const [newQuizTitle, setNewQuizTitle] = useState('');
  const [newQuizDesc, setNewQuizDesc] = useState('');
  const [newQuizDurationSelect, setNewQuizDurationSelect] = useState('120');
  const [newQuestions, setNewQuestions] = useState<Question[]>([
    { id: 'q-new-0', text: '', answers: ['', '', '', ''], correctAnswerIndex: 0 }
  ]);

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const [selectedQuizIdForLaunch, setSelectedQuizIdForLaunch] = useState('');
  const [customLaunchCode, setCustomLaunchCode] = useState(() => generateRandomCode());
  const [launchDuration, setLaunchDuration] = useState<number>(120);

  const [classFilter, setClassFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'teacher' | 'student'>('teacher');
  const [addUserError, setAddUserError] = useState('');
  const [usersError, setUsersError] = useState('');
  const [selectedResultForAnalysis, setSelectedResultForAnalysis] = useState<PlayerResult | null>(null);
  const [roomCodeToConfirmEnd, setRoomCodeToConfirmEnd] = useState<string | null>(null);
  const [questionIdToConfirmDelete, setQuestionIdToConfirmDelete] = useState<string | null>(null);
  const [deleteConfirmQuizId, setDeleteConfirmQuizId] = useState<string | null>(null);
  const [deleteConfirmUserId, setDeleteConfirmUserId] = useState<string | null>(null);
  const [editingPasswordUserId, setEditingPasswordUserId] = useState<string | null>(null);
  const [tempNewPassword, setTempNewPassword] = useState('');
  const [tempRepeatPassword, setTempRepeatPassword] = useState('');
  const [changePasswordError, setChangePasswordError] = useState('');
  const [changePasswordSuccess, setChangePasswordSuccess] = useState('');

  const loadRegisteredUsers = async () => {
    if (supabaseClient) {
      const { data, error } = await supabaseClient.from('profiles').select('*');
      if (data) {
        setRegisteredUsers(data.map((u: any) => ({
          id: u.id,
          fullName: u.full_name,
          email: u.email,
          role: u.role,
          password: u.password_hash
        })));
      }
    } else {
      const list = JSON.parse(localStorage.getItem('registered_users') || '[]');
      setRegisteredUsers(list);
    }
  };

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddUserError('');
    if (!newUserFullName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      setAddUserError('Wszystkie pola są wymagane!');
      return;
    }
    const pwd = newUserPassword.trim();
    if (pwd.length < 8 || !/[A-Z]/.test(pwd) || !/[a-z]/.test(pwd) || !/[0-9]/.test(pwd)) {
      setAddUserError('Hasło musi mieć co najmniej 8 znaków, zawierać małe i duże litery oraz co najmniej jedną cyfrę.');
      return;
    }

    if (supabaseClient) {
      const emailLower = newUserEmail.trim().toLowerCase();
      const { data: duplicateCheck } = await supabaseClient.from('profiles').select('id').eq('email', emailLower).single();
      if (duplicateCheck) {
        setAddUserError('Użytkownik o takim adresie e-mail już istnieje w bazie.');
        return;
      }

      const { error } = await supabaseClient.from('profiles').insert({
        id: 'usr-' + Date.now().toString(36),
        full_name: newUserFullName.trim(),
        email: emailLower,
        password_hash: hashPassword(pwd),
        role: newUserRole
      });

      if (error) {
        setAddUserError('Wystąpił błąd podczas dodawania profilu użytkownika.');
      } else {
        setIsAddingUser(false);
        setNewUserFullName('');
        setNewUserEmail('');
        setNewUserPassword('');
        loadRegisteredUsers();
      }
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setUsersError('');
    if (currentUser?.role !== 'admin') {
      setUsersError('Tylko administrator może usuwać konta użytkowników.');
      setDeleteConfirmUserId(null);
      return;
    }
    if (userId === currentUser?.id) {
      setUsersError('Nie możesz usunąć konta, na którym jesteś aktualnie zalogowany.');
      setDeleteConfirmUserId(null);
      return;
    }

    const targetUser = registeredUsers.find(u => u.id === userId);
    if (targetUser?.role === 'admin') {
      setUsersError('Konta o randze Administratora nie mogą zostać skasowane.');
      setDeleteConfirmUserId(null);
      return;
    }

    if (supabaseClient) {
      const { error } = await supabaseClient.from('profiles').delete().eq('id', userId);
      if (error) {
        setUsersError('Nie udało się usunąć profilu użytkownika z bazy danych.');
      } else {
        loadRegisteredUsers();
      }
    }
    setDeleteConfirmUserId(null);
  };

  const handleChangeUserPassword = async (userId: string, targetPassword: string) => {
    setUsersError('');
    setChangePasswordError('');
    setChangePasswordSuccess('');

    if (currentUser?.role !== 'admin') {
      setUsersError('Błąd autoryzacji.');
      return;
    }

    const pwd = targetPassword.trim();
    if (pwd.length < 8 || !/[A-Z]/.test(pwd) || !/[a-z]/.test(pwd) || !/[0-9]/.test(pwd)) {
      setChangePasswordError('Hasło musi mieć co najmniej 8 znaków, zawierać małe i duże litery oraz co najmniej jedną cyfrę.');
      return;
    }

    if (supabaseClient) {
      const { error } = await supabaseClient
        .from('profiles')
        .update({ password_hash: hashPassword(pwd) })
        .eq('id', userId);

      if (error) {
        setChangePasswordError('Błąd aktualizacji hasła w Supabase.');
      } else {
        setChangePasswordSuccess('Hasło zostało pomyślnie zaktualizowane w bazie!');
        setTimeout(() => {
          setEditingPasswordUserId(null);
          setTempNewPassword('');
          setTempRepeatPassword('');
        }, 1500);
      }
    }
  };

  useEffect(() => {
    loadRegisteredUsers();
  }, [activeTab]);

  useEffect(() => {
    if (selectedQuizIdForLaunch) {
      const selectedQuiz = quizzes.find(q => q.id === selectedQuizIdForLaunch);
      if (selectedQuiz) {
        setLaunchDuration(selectedQuiz.defaultDuration);
      }
    }
  }, [selectedQuizIdForLaunch, quizzes]);

  const handleQuestionTextChange = (index: number, text: string) => {
    const updated = [...newQuestions];
    updated[index].text = text;
    setNewQuestions(updated);
  };

  const handleAnswerChoiceChange = (qIndex: number, aIndex: number, text: string) => {
    const updated = [...newQuestions];
    updated[qIndex].answers[aIndex] = text;
    setNewQuestions(updated);
  };

  const handleCorrectAnswerChange = (qIndex: number, chosenCorrectIndex: number) => {
    const updated = [...newQuestions];
    updated[qIndex].correctAnswerIndex = chosenCorrectIndex;
    updated[qIndex].correctAnswerIndices = [chosenCorrectIndex];
    setNewQuestions(updated);
  };

  const addNewQuestionSlot = () => {
    setNewQuestions([
      ...newQuestions,
      {
        id: `q-new-${newQuestions.length}`,
        text: '',
        answers: ['', '', '', ''],
        correctAnswerIndex: 0,
        type: 'single',
        correctAnswerIndices: [0],
        correctTextAnswers: [],
        bricksText: '',
        bricksCorrectAnswers: []
      }
    ]);
  };

  const removeQuestionSlot = (index: number) => {
    if (newQuestions.length === 1) return;
    setNewQuestions(newQuestions.filter((_, i) => i !== index));
    setQuestionIdToConfirmDelete(null);
  };

  const handleEditQuizClick = (quiz: Quiz) => {
    setEditingQuizId(quiz.id);
    setNewQuizTitle(quiz.title);
    setNewQuizDesc(quiz.description);
    setNewQuizDurationSelect(quiz.defaultDuration.toString());
    setNewQuestions(quiz.questions.map((q) => ({
      id: q.id,
      text: q.text,
      answers: [...q.answers],
      correctAnswerIndex: q.correctAnswerIndex,
      type: q.type || 'single',
      correctAnswerIndices: q.correctAnswerIndices || [q.correctAnswerIndex],
      correctTextAnswers: q.correctTextAnswers || [],
      bricksText: q.bricksText || '',
      bricksCorrectAnswers: q.bricksCorrectAnswers || [],
      points: q.points
    })));
    setIsCreatingQuiz(true);
  };

  const handleCreateQuizSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuizTitle.trim()) return;

    const finalizedQuestions = newQuestions.map((q, idx) => ({
      ...q,
      id: q.id.startsWith('q-new-') ? `q-${Date.now()}-${idx}` : q.id,
      text: q.text.trim() || `Przykładowe pytanie numer ${idx + 1}?`,
      answers: q.answers.map((ans, cIdx) => ans.trim() || `Odpowiedź ${String.fromCharCode(65 + cIdx)}`)
    }));

    if (editingQuizId) {
      const editedQuiz: Quiz = {
        id: editingQuizId,
        title: newQuizTitle,
        description: newQuizDesc || 'Opis quizu',
        defaultDuration: parseInt(newQuizDurationSelect, 10),
        creatorId: currentUser?.id || 'educator-panel',
        questions: finalizedQuestions
      };
      onEditQuiz(editedQuiz);
      setEditingQuizId(null);
    } else {
      const newQuiz: Quiz = {
        id: `quiz-${Date.now()}`,
        title: newQuizTitle,
        description: newQuizDesc || 'Opis quizu',
        defaultDuration: parseInt(newQuizDurationSelect, 10),
        creatorId: currentUser?.id || 'educator-panel',
        questions: finalizedQuestions
      };
      onAddNewQuiz(newQuiz);
    }

    setIsCreatingQuiz(false);
    setNewQuizTitle('');
    setNewQuizDesc('');
    setNewQuizDurationSelect('120');
    setNewQuestions([{ id: 'q-new-0', text: '', answers: ['', '', '', ''], correctAnswerIndex: 0 }]);
  };

  const triggerLaunchRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuizIdForLaunch || !customLaunchCode.trim()) return;
    
    onLaunchRoom(selectedQuizIdForLaunch, customLaunchCode.trim().toUpperCase(), launchDuration);
    setSelectedQuizIdForLaunch('');
    setCustomLaunchCode(generateRandomCode());
  };

  const classesList = Array.from(new Set(allResults.map(r => r.className)));

  const filteredResults = allResults.filter(r => {
    const matchesClass = classFilter === 'all' || r.className === classFilter;
    const nameStr = `${r.firstName} ${r.lastName} ${r.className} ${r.quizTitle}`.toLowerCase();
    const matchesSearch = nameStr.includes(searchQuery.toLowerCase());
    return matchesClass && matchesSearch;
  });

  const exportResultsJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allResults, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `wyniki_ctrl_quiz_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in" id="admin-dashboard">
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight font-serif">Panel Prowadzącego</h2>
          <p className="text-slate-500 text-sm mt-1">Twórz quizy, inicjuj pokoje poczekalni i kontroluj wyniki ze szczegółami w chmurze Supabase.</p>
        </div>

        <div className="grid grid-cols-2 gap-2 shrink-0 sm:gap-4">
          <div className="bg-white px-3 py-2 border border-slate-200 rounded-xl text-center shadow-3xs">
            <span className="block text-[10px] font-extrabold uppercase text-slate-400">Quizy w bazie</span>
            <span className="text-lg font-mono font-black text-[#5F7A61]">{quizzes.length}</span>
          </div>
          <div className="bg-white px-3 py-2 border border-slate-200 rounded-xl text-center shadow-3xs">
            <span className="block text-[10px] font-extrabold uppercase text-slate-400">Wszystkie wyniki</span>
            <span className="text-lg font-mono font-black text-emerald-600">{allResults.length}</span>
          </div>
        </div>
      </div>

      <div className="flex border-b border-slate-200 mb-8 overflow-x-auto gap-2">
        <button onClick={() => setActiveTab('rooms')} className={`pb-3 px-4 font-semibold text-sm border-b-2 whitespace-nowrap transition-all cursor-pointer ${activeTab === 'rooms' ? 'border-[#5F7A61] text-[#5F7A61]' : 'border-transparent text-slate-500 hover:text-slate-850'}`}>Aktywne Pokoje ({activeRooms.length})</button>
        <button onClick={() => setActiveTab('quizzes')} className={`pb-3 px-4 font-semibold text-sm border-b-2 whitespace-nowrap transition-all cursor-pointer ${activeTab === 'quizzes' ? 'border-[#5F7A61] text-[#5F7A61]' : 'border-transparent text-slate-500 hover:text-slate-850'}`}>Katalog Quizów ({quizzes.length})</button>
        <button onClick={() => setActiveTab('results')} className={`pb-3 px-4 font-semibold text-sm border-b-2 whitespace-nowrap transition-all cursor-pointer ${activeTab === 'results' ? 'border-[#5F7A61] text-[#5F7A61]' : 'border-transparent text-slate-500 hover:text-slate-850'}`}>Historia Wyników ({allResults.length})</button>
        {currentUser?.role === 'admin' && (
          <button onClick={() => setActiveTab('users')} className={`pb-3 px-4 font-semibold text-sm border-b-2 whitespace-nowrap transition-all cursor-pointer ${activeTab === 'users' ? 'border-[#5F7A61] text-[#5F7A61]' : 'border-transparent text-slate-500'}`}>Użytkownicy ({registeredUsers.length})</button>
        )}
      </div>

      {activeTab === 'rooms' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm h-fit">
            <h3 className="text-base font-extrabold text-slate-800 mb-4 flex items-center gap-2">
              <Play className="w-4 h-4 text-[#5F7A61]" />
              <span>Uruchom nowy quiz</span>
            </h3>

            <form onSubmit={triggerLaunchRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Wybierz quiz</label>
                <select required value={selectedQuizIdForLaunch} onChange={(e) => setSelectedQuizIdForLaunch(e.target.value)} className="w-full p-2 border border-slate-200 rounded-xl text-sm font-semibold cursor-pointer">
                  <option value="">-- Wybierz Quiz --</option>
                  {quizzes.map((q) => (
                    <option key={q.id} value={q.id}>{q.title} ({q.questions.length} pytań)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Kod dostępu</label>
                <div className="relative">
                  <input type="text" value={customLaunchCode} onChange={(e) => setCustomLaunchCode(e.target.value.toUpperCase().replace(/[^a-zA-Z0-9]/g, ''))} className="w-full p-2 border border-slate-200 rounded-xl text-sm font-bold" />
                  <button type="button" onClick={() => setCustomLaunchCode(generateRandomCode())} className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-pink-50 text-[#EC4899] text-[10px] rounded-lg cursor-pointer">Generuj</button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Czas (sekundy)</label>
                <input type="number" min="10" max="1800" value={launchDuration} onChange={(e) => setLaunchDuration(Math.max(10, parseInt(e.target.value, 10)))} className="w-full p-2 border border-slate-200 rounded-xl text-sm font-mono font-semibold" />
              </div>

              <button type="submit" disabled={!selectedQuizIdForLaunch || !customLaunchCode} className="w-full py-3 bg-[#5F7A61] text-white font-bold rounded-xl text-sm hover:bg-[#4D634F] cursor-pointer">
                Załóż pokój i poczekalnię
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-base font-extrabold text-slate-800">Aktywne pokoje na żywo</h3>
            {activeRooms.length === 0 ? (
              <div className="p-8 text-center text-slate-400 border-2 border-dashed rounded-2xl bg-slate-50">
                Brak aktywnych pokoi do rozgrywki. Wybierz quiz i wygeneruj kod po lewej.
              </div>
            ) : (
              activeRooms.map((room) => {
                const finishedCount = allResults.filter(res => res.roomCode === room.code).length;
                return (
                  <div key={room.code} className="bg-white border p-6 rounded-2xl shadow-sm relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-2xl font-mono font-black text-[#5F7A61]">{room.code}</span>
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full">{room.status}</span>
                        </div>
                        <h4 className="text-base font-bold text-slate-800 mt-2">{room.quizTitle}</h4>
                      </div>

                      <div className="flex gap-2">
                        {room.status === 'waiting' && (
                          <button onClick={() => onStartRoom(room.code)} className="px-4 py-2 bg-[#5F7A61] text-white text-xs font-bold rounded-xl cursor-pointer">START</button>
                        )}
                        {room.status === 'in_progress' && (
                          <button onClick={() => onEndRoom(room.code)} className="px-4 py-2 bg-pink-600 text-white text-xs font-bold rounded-xl cursor-pointer">Zakończ</button>
                        )}
                        <button onClick={() => onEndRoom(room.code)} className="p-2 border rounded-xl delete-btn-custom cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>

                    <div className="border-t mt-4 pt-4">
                      <p className="text-xs font-bold text-slate-400 mb-2">Połączeni gracze ({room.joinedPlayers.length}) - Ukończyło: {finishedCount}</p>
                      <div className="flex flex-wrap gap-2">
                        {room.joinedPlayers.map(p => {
                          const hasFinished = allResults.some(res => res.roomCode === room.code && res.firstName === p.firstName && res.lastName === p.lastName);
                          return (
                            <span key={p.id} className={`px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center gap-1.5 ${hasFinished ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-50 text-slate-700'}`}>
                              <span className={`w-2 h-2 rounded-full ${hasFinished ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
                              {p.firstName} {p.lastName} ({p.className})
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'quizzes' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-extrabold text-slate-800">Katalog quizów w chmurze</h3>
            <button onClick={() => setIsCreatingQuiz(!isCreatingQuiz)} className="px-4 py-2.5 bg-[#5F7A61] text-white font-bold rounded-xl text-xs hover:bg-[#4E644F] cursor-pointer">
              {isCreatingQuiz ? 'Pokaż katalog' : 'Utwórz nowy szablon'}
            </button>
          </div>

          <AnimatePresence mode="wait">
            {isCreatingQuiz ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white border p-6 rounded-2xl shadow-sm">
                <form onSubmit={handleCreateQuizSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tytuł quizu</label>
                      <input required type="text" value={newQuizTitle} onChange={(e) => setNewQuizTitle(e.target.value)} className="w-full p-2 border border-slate-200 rounded-xl" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Czas trwania (sekundy)</label>
                      <input required type="number" value={newQuizDurationSelect} onChange={(e) => setNewQuizDurationSelect(e.target.value)} className="w-full p-2 border border-slate-200 rounded-xl font-mono" />
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-extrabold">Zestaw pytań ({newQuestions.length})</span>
                      <button type="button" onClick={addNewQuestionSlot} className="text-xs text-[#5F7A61] font-bold cursor-pointer">+ Dodaj pytanie</button>
                    </div>

                    {newQuestions.map((q, qIdx) => (
                      <div key={q.id} className="p-4 border rounded-xl bg-slate-50 relative space-y-2">
                        {newQuestions.length > 1 && (
                          <button type="button" onClick={() => removeQuestionSlot(qIdx)} className="absolute top-2 right-2 text-xs text-rose-500 font-bold cursor-pointer">Skasuj</button>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input required type="text" placeholder={`Treść pytania ${qIdx + 1}`} value={q.text} onChange={(e) => handleQuestionTextChange(qIdx, e.target.value)} className="w-full p-1.5 border rounded-lg text-xs" />
                          <select value={q.type || 'single'} onChange={(e) => {
                            const updated = [...newQuestions];
                            updated[qIdx] = { ...updated[qIdx], type: e.target.value as any };
                            setNewQuestions(updated);
                          }} className="p-1.5 border rounded-lg text-xs cursor-pointer">
                            <option value="single">Jednokrotny wybór</option>
                            <option value="multicheck">Wielokrotny wybór</option>
                            <option value="text">Odpowiedź pisemna</option>
                            <option value="dropdown">Lista rozwijana</option>
                            <option value="bricks">Zadanie z lukami</option>
                          </select>
                          <input type="number" placeholder="Punkty (np. 1)" value={q.points || ''} onChange={(e) => {
                            const updated = [...newQuestions];
                            updated[qIdx] = { ...updated[qIdx], points: Number(e.target.value) };
                            setNewQuestions(updated);
                          }} className="p-1.5 border rounded-lg text-xs" />
                        </div>

                        {((q.type || 'single') === 'single' || q.type === 'dropdown' || q.type === 'multicheck') && (
                          <div className="grid grid-cols-2 gap-2 pt-2">
                            {q.answers.map((ans, aIdx) => (
                              <div key={aIdx} className="flex items-center gap-2">
                                <input type="checkbox" checked={q.type === 'multicheck' ? (q.correctAnswerIndices || []).includes(aIdx) : q.correctAnswerIndex === aIdx} onChange={() => handleCorrectAnswerChange(qIdx, aIdx)} className="cursor-pointer" />
                                <input required type="text" placeholder={`Opcja ${String.fromCharCode(65 + aIdx)}`} value={ans} onChange={(e) => handleAnswerChoiceChange(qIdx, aIdx, e.target.value)} className="w-full p-1.5 border rounded text-xs bg-white font-medium" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <button type="button" onClick={() => setIsCreatingQuiz(false)} className="px-4 py-2 border rounded-xl text-xs cursor-pointer">Anuluj</button>
                    <button type="submit" className="px-5 py-2 bg-[#5F7A61] text-white rounded-xl text-xs cursor-pointer">Zapisz w katalogu</button>
                  </div>
                </form>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {quizzes.map((quiz) => (
                  <div key={quiz.id} className="bg-white border p-5 rounded-2xl shadow-3xs flex flex-col justify-between">
                    <div>
                      <h4 className="text-base font-extrabold text-slate-800 font-serif">{quiz.title}</h4>
                      <p className="text-slate-400 text-xs mt-1">{quiz.description}</p>
                    </div>
                    <div className="border-t pt-4 mt-4 flex items-center justify-between text-xs font-semibold">
                      <span className="font-bold text-[#5F7A61] bg-[#5F7A61]/10 px-2 py-0.5 rounded-full">{quiz.questions.length} pytań</span>
                      <div className="flex gap-2">
                        <button onClick={() => handleEditQuizClick(quiz)} className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 font-semibold cursor-pointer">Edytuj</button>
                        <button onClick={() => onDeleteQuiz(quiz.id)} className="p-1 border rounded-lg delete-btn-custom cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {activeTab === 'results' && (
        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-extrabold text-slate-800 font-serif">Historia odpowiedzi i dziennik ocen</h3>
            <div className="flex gap-2">
              <button onClick={exportResultsJSON} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold cursor-pointer">Eksportuj wyniki</button>
              <button onClick={onClearResults} className="px-3 py-1.5 border rounded-xl delete-btn-custom text-xs cursor-pointer">Wyczyść historię</button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="min-w-full divide-y text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Uczeń</th>
                  <th className="px-4 py-3">Klasa</th>
                  <th className="px-4 py-3">Quiz</th>
                  <th className="px-4 py-3 text-center">Punkty</th>
                  <th className="px-4 py-3 text-center">Procent</th>
                  <th className="px-4 py-3 text-right">Data</th>
                  <th className="px-4 py-3 text-right">Szczegóły</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white">
                {filteredResults.map((res) => (
                  <tr key={res.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-bold text-slate-900">{res.firstName} {res.lastName}</td>
                    <td className="px-4 py-3 font-mono">{res.className}</td>
                    <td className="px-4 py-3">{res.quizTitle}</td>
                    <td className="px-4 py-3 text-center font-bold">{res.score} / {res.totalQuestions}</td>
                    <td className="px-4 py-3 text-center"><span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">{res.percentage}%</span></td>
                    <td className="px-4 py-3 text-right font-mono text-[10px] text-slate-400">{new Date(res.timestamp).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setSelectedResultForAnalysis(res)} className="px-2 py-1 bg-slate-50 border rounded-lg text-slate-600 font-bold cursor-pointer">Analiza</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'users' && currentUser?.role === 'admin' && (
        <div className="bg-white border rounded-2xl p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-extrabold text-slate-800 font-serif">Użytkownicy i Profile</h3>
            <button onClick={() => setIsAddingUser(!isAddingUser)} className="px-4 py-2.5 bg-[#5F7A61] text-white font-bold rounded-xl text-xs hover:bg-[#4E644F] cursor-pointer">Dodaj konto</button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="min-w-full divide-y text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase">
                <tr>
                  <th className="px-4 py-3">Nazwisko i Imię</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Rola</th>
                  <th className="px-4 py-3 text-right">Akcja</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white">
                {registeredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-bold text-slate-900">{u.fullName}</td>
                    <td className="px-4 py-3 font-mono">{u.email}</td>
                    <td className="px-4 py-3 uppercase font-semibold text-slate-550">{u.role}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDeleteUser(u.id)} disabled={u.role === 'admin'} className="px-2 py-1 border rounded-lg delete-btn-custom cursor-pointer disabled:opacity-30">Usuń</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {selectedResultForAnalysis && (() => {
          const res = selectedResultForAnalysis;
          const quizTemplate = quizzes.find(q => q.title === res.quizTitle);

          return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl w-full max-w-xl max-h-[80vh] overflow-y-auto p-6 relative">
                <button onClick={() => setSelectedResultForAnalysis(null)} className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer"><X className="w-5 h-5" /></button>
                <h4 className="text-lg font-bold mb-1 font-serif">{res.firstName} {res.lastName}</h4>
                <p className="text-xs text-[#5F7A61] font-semibold mb-4">Klasa {res.className} • Quiz: {res.quizTitle}</p>

                <div className="bg-[#5F7A61]/10 p-4 rounded-xl border border-[#5F7A61]/25 mb-4 flex justify-between items-center font-mono">
                  <span>Punkty: {res.score} / {res.totalQuestions} pkt</span>
                  <span className="font-bold text-[#5F7A61] text-lg">{res.percentage}%</span>
                </div>

                <div className="space-y-4">
                  {quizTemplate?.questions.map((q, idx) => {
                    const ans = res.answers[idx];
                    const earned = calculateQuestionScore(q, ans);
                    const maxP = getQuestionMaxPoints(q);
                    return (
                      <div key={q.id} className="p-3 border rounded-xl bg-slate-50">
                        <p className="font-bold text-xs text-slate-800">{idx + 1}. {q.text}</p>
                        <p className="text-[10px] mt-1 text-slate-500 font-mono">Wynik: {earned} / {maxP} pkt</p>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}