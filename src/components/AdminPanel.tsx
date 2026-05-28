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
}: AdminPanelProps) {
  // Navigation internal tabs
  const [activeTab, setActiveTab] = useState<'rooms' | 'quizzes' | 'results' | 'users'>('rooms');

  // New Quiz Creator form states
  const [isCreatingQuiz, setIsCreatingQuiz] = useState(false);
  const [newQuizTitle, setNewQuizTitle] = useState('');
  const [newQuizDesc, setNewQuizDesc] = useState('');
  const [newQuizDurationSelect, setNewQuizDurationSelect] = useState('120'); // defaulting to 2 mins
  const [newQuestions, setNewQuestions] = useState<Question[]>([
    {
      id: 'q-new-0',
      text: '',
      answers: ['', '', '', ''],
      correctAnswerIndex: 0
    }
  ]);

  // Launches form states
  const generateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const [selectedQuizIdForLaunch, setSelectedQuizIdForLaunch] = useState('');
  const [customLaunchCode, setCustomLaunchCode] = useState(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  });
  const [launchDuration, setLaunchDuration] = useState<number>(120);

  // Stats / Filters for results
  const [classFilter, setClassFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Auxiliary States for Advanced Admin Panel features
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

  const loadRegisteredUsers = () => {
    const list = JSON.parse(localStorage.getItem('registered_users') || '[]');
    setRegisteredUsers(list);
  };

  const handleAddUserSubmit = (e: React.FormEvent) => {
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
    const currentUsers: any[] = JSON.parse(localStorage.getItem('registered_users') || '[]');
    const emailLower = newUserEmail.trim().toLowerCase();
    
    // Check email uniqueness
    if (currentUsers.some(u => u.email.toLowerCase() === emailLower)) {
      setAddUserError('Użytkownik o takim adresie e-mail już istnieje!');
      return;
    }

    const newUser = {
      id: 'usr-' + Date.now().toString(36),
      fullName: newUserFullName.trim(),
      email: emailLower,
      password: hashPassword(newUserPassword.trim()),
      role: newUserRole
    };

    const updated = [...currentUsers, newUser];
    localStorage.setItem('registered_users', JSON.stringify(updated));
    loadRegisteredUsers();

    // Reset fields
    setNewUserFullName('');
    setNewUserEmail('');
    setNewUserPassword('');
    setNewUserRole('teacher');
    setIsAddingUser(false);
  };

  const handleDeleteUser = (userId: string) => {
    setUsersError('');
    if (currentUser?.role !== 'admin') {
      setUsersError('Błąd uprawnień: Tylko Administrator może usuwać konta użytkowników.');
      setDeleteConfirmUserId(null);
      return;
    }
    if (userId === currentUser?.id) {
      setUsersError('Bezpieczeństwo: Nie możesz usunąć konta, na które jesteś obecnie zalogowany!');
      setDeleteConfirmUserId(null);
      return;
    }
    const currentUsers: any[] = JSON.parse(localStorage.getItem('registered_users') || '[]');
    const targetUser = currentUsers.find(u => u.id === userId);
    if (targetUser?.role === 'admin') {
      setUsersError('Bezpieczeństwo: Konta z rolą Administratora nie mogą zostać usunięte z żadnego poziomu.');
      setDeleteConfirmUserId(null);
      return;
    }

    const updated = currentUsers.filter(u => u.id !== userId);
    localStorage.setItem('registered_users', JSON.stringify(updated));
    loadRegisteredUsers();
    setDeleteConfirmUserId(null);
  };

  const handleChangeUserPassword = (userId: string, targetPassword: string) => {
    setUsersError('');
    setChangePasswordError('');
    setChangePasswordSuccess('');

    if (currentUser?.role !== 'admin') {
      setUsersError('Błąd uprawnień: Tylko Administrator może zmieniać hasła innych użytkowników.');
      return;
    }

    const pwd = targetPassword.trim();
    if (pwd.length < 8 || !/[A-Z]/.test(pwd) || !/[a-z]/.test(pwd) || !/[0-9]/.test(pwd)) {
      setChangePasswordError('Hasło musi mieć co najmniej 8 znaków, zawierać małe i duże litery oraz co najmniej jedną cyfrę.');
      return;
    }

    const currentUsers: any[] = JSON.parse(localStorage.getItem('registered_users') || '[]');
    const userIndex = currentUsers.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      setChangePasswordError('Nie znaleziono użytkownika.');
      return;
    }

    currentUsers[userIndex].password = hashPassword(pwd);
    localStorage.setItem('registered_users', JSON.stringify(currentUsers));
    loadRegisteredUsers();

    setChangePasswordSuccess('Hasło użytkownika zostało pomyślnie zmienione!');
    setTimeout(() => {
      setEditingPasswordUserId(null);
      setTempNewPassword('');
      setTempRepeatPassword('');
      setChangePasswordSuccess('');
      setChangePasswordError('');
    }, 1500);
  };

  useEffect(() => {
    loadRegisteredUsers();
  }, [activeTab]);

  useEffect(() => {
    if (currentUser?.role === 'teacher' && activeTab === 'users') {
      setActiveTab('rooms');
    }
  }, [currentUser, activeTab]);

  // Auto-fill launch options when quiz is selected
  useEffect(() => {
    if (selectedQuizIdForLaunch) {
      const selectedQuiz = quizzes.find(q => q.id === selectedQuizIdForLaunch);
      if (selectedQuiz) {
        setLaunchDuration(selectedQuiz.defaultDuration);
        const codePresetName = selectedQuiz.title.split(' ')[0].replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 4);
        setCustomLaunchCode(codePresetName || 'CODE');
      }
    }
  }, [selectedQuizIdForLaunch, quizzes]);

  // Handle Question Change in Quiz Creator
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
    // update indices array if singe changes
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

    // Filter empty questions out or fill template details
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
        description: newQuizDesc || 'Quiz zaktualizowany przez nauczyciela za pomocą panelu.',
        defaultDuration: parseInt(newQuizDurationSelect, 10),
        creatorId: 'educator-panel',
        questions: finalizedQuestions
      };
      onEditQuiz(editedQuiz);
      setEditingQuizId(null);
    } else {
      const newQuiz: Quiz = {
        id: `quiz-${Date.now()}`,
        title: newQuizTitle,
        description: newQuizDesc || 'Quiz stworzony przez nauczyciela za pomocą panelu.',
        defaultDuration: parseInt(newQuizDurationSelect, 10),
        creatorId: 'educator-panel',
        questions: finalizedQuestions
      };
      onAddNewQuiz(newQuiz);
    }

    setIsCreatingQuiz(false);
    // Reset state
    setNewQuizTitle('');
    setNewQuizDesc('');
    setNewQuizDurationSelect('120');
    setNewQuestions([{
      id: 'q-new-0',
      text: '',
      answers: ['', '', '', ''],
      correctAnswerIndex: 0,
      type: 'single',
      correctAnswerIndices: [0],
      correctTextAnswers: [],
      bricksText: '',
      bricksCorrectAnswers: []
    }]);
  };

  // Launching a new game session lobby
  const triggerLaunchRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuizIdForLaunch || !customLaunchCode.trim()) return;
    
    const formattedCode = customLaunchCode.trim().toUpperCase();
    onLaunchRoom(selectedQuizIdForLaunch, formattedCode, launchDuration);
    
    // reset selected launch fields
    setSelectedQuizIdForLaunch('');
    setCustomLaunchCode(generateRandomCode());
  };

  // Get list of distinct classes from results database
  const classesList = Array.from(new Set(allResults.map(r => r.className)));

  // Filtered results
  const filteredResults = allResults.filter(r => {
    const matchesClass = classFilter === 'all' || r.className === classFilter;
    const nameStr = `${r.firstName} ${r.lastName} ${r.className} ${r.quizTitle}`.toLowerCase();
    const matchesSearch = nameStr.includes(searchQuery.toLowerCase());
    return matchesClass && matchesSearch;
  });

  // Calculate generic dashboard statistics
  const totalCompletedQuizzes = allResults.length;
  const averagePercentage = totalCompletedQuizzes > 0
    ? Math.round(allResults.reduce((acc, r) => acc + r.percentage, 0) / totalCompletedQuizzes)
    : 0;

  // Export Results Database to JSON File (to satisfy: "by później móc podłączyć to do bazy danych")
  const exportResultsJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allResults, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `quiz_wyniki_bazy_danych_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id="admin-dashboard">
      {/* Top Welcome Title & Statistics Cards */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">Panel Prowadzącego</h2>
          <p className="text-slate-500 text-sm mt-1">Zarządzaj quizami, uruchamiaj pokoje w czasie rzeczywistym i analizuj postępy uczniów.</p>
        </div>

        {/* Rapid Stats Grid */}
        <div className="grid grid-cols-3 gap-2 shrink-0 sm:gap-4">
          <div className="bg-white px-3 py-2 sm:px-4 sm:py-3 border border-slate-200 rounded-xl shadow-xs text-center">
            <span className="block text-[9px] sm:text-xxs font-extrabold uppercase tracking-wide text-slate-400">Quizy</span>
            <span className="text-lg sm:text-xl font-mono font-black text-[#5F7A61]">{quizzes.length}</span>
          </div>
          <div className="bg-white px-3 py-2 sm:px-4 sm:py-3 border border-slate-200 rounded-xl shadow-xs text-center">
            <span className="block text-[9px] sm:text-xxs font-extrabold uppercase tracking-wide text-slate-400">Wyniki</span>
            <span className="text-lg sm:text-xl font-mono font-black text-emerald-600">{allResults.length}</span>
          </div>
          <div className="bg-white px-3 py-2 sm:px-4 sm:py-3 border border-slate-200 rounded-xl shadow-xs text-center">
            <span className="block text-[9px] sm:text-xxs font-extrabold uppercase tracking-wide text-slate-400">Śr. wynik</span>
            <span className="text-lg sm:text-xl font-mono font-black text-amber-500">{averagePercentage}%</span>
          </div>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex border-b border-slate-200 mb-8 overflow-x-auto gap-2">
        <button
          id="tab-rooms-btn"
          onClick={() => setActiveTab('rooms')}
          className={`pb-3 px-4 font-semibold text-sm border-b-2 whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'rooms'
              ? 'border-[#5F7A61] text-[#5F7A61]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Play className="w-4 h-4" />
          <span>Aktywne Pokoje ({activeRooms.length})</span>
        </button>

        <button
          id="tab-quizzes-btn"
          onClick={() => setActiveTab('quizzes')}
          className={`pb-3 px-4 font-semibold text-sm border-b-2 whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'quizzes'
              ? 'border-[#5F7A61] text-[#5F7A61]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Katalog Quizów ({quizzes.length})</span>
        </button>

        <button
          id="tab-results-btn"
          onClick={() => setActiveTab('results')}
          className={`pb-3 px-4 font-semibold text-sm border-b-2 whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'results'
              ? 'border-[#5F7A61] text-[#5F7A61]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Baza Wyników ({allResults.length})</span>
        </button>

        {currentUser?.role === 'admin' && (
          <button
            id="tab-users-btn"
            onClick={() => setActiveTab('users')}
            className={`pb-3 px-4 font-semibold text-sm border-b-2 whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'users'
                ? 'border-[#5F7A61] text-[#5F7A61]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Użytkownicy ({registeredUsers.length})</span>
          </button>
        )}
      </div>

      {/* TAB 1: LIVE ACTIVE ROOMS & GENERATING ONE */}
      {activeTab === 'rooms' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" id="admin-rooms-view">
          {/* Launch New Room Form */}
          <div className="lg:col-span-1 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm h-fit">
            <h3 className="text-base font-extrabold text-slate-800 mb-4 flex items-center gap-2">
              <Play className="w-4 h-4 text-[#5F7A61]" />
              <span>Uruchom nowy quiz</span>
            </h3>

            <form onSubmit={triggerLaunchRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Wybierz temat quizu</label>
                <select
                  id="launch-select-quiz"
                  required
                  value={selectedQuizIdForLaunch}
                  onChange={(e) => setSelectedQuizIdForLaunch(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-[#5F7A61] focus:ring-4 focus:ring-[#5F7A61]/10 transition-all text-slate-800"
                >
                  <option value="">-- Wybierz Quiz z katalogu --</option>
                  {quizzes.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title} ({q.questions.length} pytań)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Kod dostępu studenta (Game Code)</label>
                </div>
                <div className="relative">
                  <input
                    id="launch-custom-code"
                    type="text"
                    placeholder="np. MAT12, KOSM"
                    required
                    value={customLaunchCode}
                    onChange={(e) => setCustomLaunchCode(e.target.value.toUpperCase().replace(/[^a-zA-Z0-9]/g, ''))}
                    className="w-full pl-4 pr-32 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-[#5F7A61] focus:ring-4 focus:ring-[#5F7A61]/10 transition-all text-slate-850 placeholder:text-slate-400 placeholder:font-normal"
                  />
                  <button
                    type="button"
                    onClick={() => setCustomLaunchCode(generateRandomCode())}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-pink-50 hover:bg-pink-100 text-[#EC4899] text-[10px] rounded-lg font-bold transition-all border border-pink-100 active:scale-95 cursor-pointer flex items-center gap-1"
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>Generuj nowy</span>
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">Uczniowie wpiszą dokładnie ten kod na stronie startowej.</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Całkowity czas trwania quizu (sekundy)</label>
                <div className="flex items-center gap-2">
                  <input
                    id="launch-duration-input"
                    type="number"
                    min="10"
                    max="1800"
                    required
                    value={launchDuration}
                    onChange={(e) => setLaunchDuration(Math.max(10, parseInt(e.target.value, 10)))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-semibold focus:outline-none focus:border-[#5F7A61] focus:ring-4 focus:ring-[#5F7A61]/10 transition-all text-slate-800"
                  />
                  <span className="text-xs text-slate-500 shrink-0 font-semibold">{Math.ceil(launchDuration / 60)} min</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">Po upływie czasu zintegrowany stoper na urządzeniach uczniów zapisze ich odpowiedzi i automatycznie ukończy quiz.</span>
              </div>

              <button
                id="launch-room-btn"
                type="submit"
                disabled={!selectedQuizIdForLaunch || !customLaunchCode}
                className="w-full py-3 px-4 bg-[#5F7A61] hover:bg-[#4D634F] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:shadow-md transition-all cursor-pointer active:scale-95"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Załóż pokój i poczekalnię</span>
              </button>
            </form>
          </div>

          {/* Active Live Rooms list */}
          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#5F7A61]" />
              <span>Lista aktywnych sesji i zarządzanie na żywo</span>
            </h3>

            {activeRooms.length === 0 ? (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-400">
                <AlertCircle className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                <p className="font-semibold text-slate-500">Brak aktywnych pokoi do rozgrywki</p>
                <p className="text-xs max-w-sm mx-auto mt-1">Wybierz quiz po lewej, ustaw unikalny kod i kliknij powyższy przycisk, aby rozpocząć rejestrację.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeRooms.map((room) => {
                  const roomStateLabel = 
                    room.status === 'waiting' ? 'W poczekalni' : 
                    room.status === 'in_progress' ? 'Trwa rozgrywka' : 'Zakończona';
                  
                  // Calculate players who have finished this quiz
                  const finishedPlayersCount = allResults.filter(
                    (res) => res.roomCode === room.code
                  ).length;
                  
                  return (
                    <motion.div
                      layout
                      key={room.code}
                      id={`session-card-${room.code}`}
                      className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden"
                    >
                      {/* Left vertical visual color tag */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                        room.status === 'waiting' ? 'bg-amber-400' :
                        room.status === 'in_progress' ? 'bg-[#5F7A61] animate-pulse' : 'bg-slate-400'
                      }`} />

                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-2xl font-mono font-black text-[#5F7A61] tracking-wider">
                              {room.code}
                            </span>
                            <span className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full ${
                              room.status === 'waiting'
                                ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-100 animate-pulse'
                            }`}>
                              {roomStateLabel}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">
                              {Math.ceil(room.duration / 60)} min limit
                            </span>
                            <span className="text-xs bg-emerald-50 text-emerald-850 font-bold px-2 py-0.5 rounded-full border border-emerald-150">
                              Zakończyło: {finishedPlayersCount} z {room.joinedPlayers.length} graczy
                            </span>
                          </div>
                          <h4 className="text-base font-bold text-slate-800 mt-2">
                            {room.quizTitle}
                          </h4>
                        </div>

                        {/* Control buttons inside Card / Confirmation flow */}
                        <div className="flex items-center gap-2">
                          {roomCodeToConfirmEnd === room.code ? (
                            <div className="flex items-center gap-1.5 bg-pink-50 border border-pink-200 p-1.5 rounded-xl animate-fade-in z-10">
                              <span className="text-[10px] text-pink-850 font-black uppercase tracking-tight px-1 text-pink-700">Zakończyć?</span>
                              <button
                                type="button"
                                onClick={() => {
                                  onEndRoom(room.code);
                                  setRoomCodeToConfirmEnd(null);
                                }}
                                className="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-lg text-[10px] uppercase tracking-wide cursor-pointer active:scale-95 transition-all"
                              >
                                Tak
                              </button>
                              <button
                                type="button"
                                onClick={() => setRoomCodeToConfirmEnd(null)}
                                className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-[10px] uppercase tracking-wide cursor-pointer"
                              >
                                Nie
                              </button>
                            </div>
                          ) : (
                            <>
                              {room.status === 'waiting' && (
                                <button
                                  id={`start-room-${room.code}`}
                                  onClick={() => onStartRoom(room.code)}
                                  className="px-4 py-2 bg-[#5F7A61] hover:bg-[#4D634F] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer"
                                >
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                  <span>START (Wystartuj quiz)</span>
                                </button>
                              )}

                              {room.status === 'in_progress' && (
                                <button
                                  id={`end-room-${room.code}`}
                                  onClick={() => setRoomCodeToConfirmEnd(room.code)}
                                  className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  <span>Zakończ quiz</span>
                                </button>
                              )}

                              <button
                                id={`cancel-room-${room.code}`}
                                onClick={() => setRoomCodeToConfirmEnd(room.code)}
                                className="p-2 border border-slate-200 rounded-xl transition-all delete-btn-custom"
                                title="Zamknij i skasuj pokój"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Display players linked into this room */}
                      <div className="border-t border-slate-100 pt-4 mt-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
                          <span>Dołączeni uczniowie ({room.joinedPlayers.length})</span>
                          {room.status === 'waiting' && (
                            <span className="text-amber-500 flex items-center gap-1 animate-pulse">
                              <RefreshCw className="w-3 h-3 animate-spin" /> oczekiwanie na odpalenie start...
                            </span>
                          )}
                          {room.status === 'in_progress' && (
                            <span className="text-[#5F7A61] flex items-center gap-1 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#5F7A61] animate-ping" />
                              gry w toku... ({finishedPlayersCount} ukończyło)
                            </span>
                          )}
                        </div>

                        {room.joinedPlayers.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">Brak połączonych graczy. Uczniowie mogą wpisać kod gry "{room.code}" u siebie, aby wejść.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {room.joinedPlayers.map((player) => {
                              // Check if player has finished by matching room code and player's identity (first name & last name)
                              const hasFinished = allResults.some(
                                (res) =>
                                  res.roomCode === room.code &&
                                  res.firstName.trim().toLowerCase() === player.firstName.trim().toLowerCase() &&
                                  res.lastName.trim().toLowerCase() === player.lastName.trim().toLowerCase()
                              );

                              return (
                                <div
                                  key={player.id}
                                  className={`border rounded-lg px-2.5 py-1 text-xs font-semibold flex items-center gap-1.5 transition-all ${
                                    hasFinished 
                                      ? 'bg-emerald-50 border-emerald-250 text-emerald-800' 
                                      : 'bg-slate-50 border-slate-200 text-slate-700'
                                  }`}
                                >
                                  <span className={`w-2 h-2 rounded-full ${hasFinished ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
                                  <span>
                                    {player.firstName} {player.lastName}{' '}
                                    <strong className="text-[#5F7A61] text-[10px] font-bold">
                                      ({player.className})
                                    </strong>
                                  </span>
                                  {hasFinished && (
                                    <span className="text-[10px] bg-emerald-500 text-white font-black px-1.5 py-0.2 rounded-md animate-bounce ml-1 flex items-center gap-0.5">
                                      ✓ OK
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MANAGE & CREATE Bespoke Quizzes */}
      {activeTab === 'quizzes' && (
        <div id="admin-quizzes-view">
          {/* Create new quiz toggle */}
          <div className="flex justify-between items-center sm:items-center flex-col sm:flex-row gap-4 mb-6">
            <h3 className="text-base font-extrabold text-slate-800">Moje szablony quizów</h3>
            <button
              id="toggle-create-quiz-btn"
              onClick={() => {
                if (isCreatingQuiz) {
                  setEditingQuizId(null);
                  setNewQuizTitle('');
                  setNewQuizDesc('');
                  setNewQuizDurationSelect('120');
                  setNewQuestions([{
                    id: 'q-new-0',
                    text: '',
                    answers: ['', '', '', ''],
                    correctAnswerIndex: 0,
                    type: 'single',
                    correctAnswerIndices: [0],
                    correctTextAnswers: [],
                    bricksText: '',
                    bricksCorrectAnswers: []
                  }]);
                }
                setIsCreatingQuiz(!isCreatingQuiz);
              }}
              className="py-2.5 px-4 bg-[#5F7A61] hover:bg-[#4E644F] text-white rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isCreatingQuiz ? 'Pokaż katalog' : 'Stwórz własny quiz'}</span>
            </button>
          </div>

          <AnimatePresence mode="wait">
            {isCreatingQuiz ? (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm"
              >
                <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-6">
                  <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[#5F7A61]" />
                    <span>{editingQuizId ? 'Edytuj Szablon Quizu' : 'Kreator Nowego Quizu'}</span>
                  </h4>
                  {editingQuizId && (
                    <span className="text-xs bg-amber-50 text-amber-700 font-bold border border-amber-150 px-2.5 py-1 rounded-full">
                      Tryb edycji: ID {editingQuizId.slice(0, 10)}...
                    </span>
                  )}
                </div>

                <form onSubmit={handleCreateQuizSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tytuł / Temat quizu</label>
                      <input
                        id="title-new-quiz"
                        type="text"
                        required
                        placeholder="np. Sławni Polacy, Ułamki i Procenty"
                        value={newQuizTitle}
                        onChange={(e) => setNewQuizTitle(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-[#5F7A61] transition-all text-slate-850"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Limit czasu (sekundy)</label>
                      <div className="flex gap-2">
                        <input
                          id="duration-new-quiz"
                          type="number"
                          min="10"
                          max="3600"
                          required
                          placeholder="np. 120"
                          value={newQuizDurationSelect}
                          onChange={(e) => setNewQuizDurationSelect(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm font-mono font-semibold focus:outline-none focus:border-[#5F7A61] transition-all"
                        />
                        <span className="text-xs text-slate-500 shrink-0 font-bold self-center whitespace-nowrap">
                          {Math.floor(parseInt(newQuizDurationSelect || '0', 10) / 60)}m {parseInt(newQuizDurationSelect || '0', 10) % 60}s
                        </span>
                      </div>
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {[60, 120, 180, 300, 600].map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setNewQuizDurationSelect(t.toString())}
                            className={`text-[9px] px-1.5 py-0.5 rounded-md font-extrabold border transition-all cursor-pointer ${
                              newQuizDurationSelect === t.toString()
                                ? 'bg-[#5F7A61] text-white border-[#5F7A61]'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {t / 60} min
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="col-span-full">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Krótki opis</label>
                      <input
                        id="desc-new-quiz"
                        type="text"
                        placeholder="Zwięzła informacja o zakresie pytań dla uczniów..."
                        value={newQuizDesc}
                        onChange={(e) => setNewQuizDesc(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-[#5F7A61] transition-all text-slate-850"
                      />
                    </div>
                  </div>

                  {/* Questions Slots Sub-Form */}
                  <div className="space-y-6 pt-4 border-t border-slate-100">
                    <div className="flex justify-between items-center mb-4">
                      <label className="block text-sm font-extrabold text-slate-700">Pytania testowe ({newQuestions.length})</label>
                      <button
                        type="button"
                        onClick={addNewQuestionSlot}
                        className="text-xs font-bold text-[#5F7A61] hover:text-[#4E644F] hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Dodaj kolejne pytanie
                      </button>
                    </div>

                    <div className="space-y-6">
                      {newQuestions.map((q, qIdx) => (
                        <div key={q.id} className="p-5 border border-slate-200 rounded-xl bg-slate-50/50 relative">
                          {newQuestions.length > 1 && (
                            <div className="absolute top-4 right-4 flex items-center gap-2">
                              {questionIdToConfirmDelete === q.id ? (
                                <div className="flex items-center gap-1.5 bg-pink-50 border border-pink-200 px-2 py-1 rounded-lg animate-fade-in text-[10px]">
                                  <span className="text-pink-700 font-bold">Usunąć pytanie?</span>
                                  <button
                                    type="button"
                                    onClick={() => removeQuestionSlot(qIdx)}
                                    className="px-2 py-0.5 text-white font-bold rounded-md cursor-pointer transition-all active:scale-95 text-[10px] delete-btn-custom"
                                  >
                                    Tak
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setQuestionIdToConfirmDelete(null)}
                                    className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-md cursor-pointer text-[10px]"
                                  >
                                    Nie
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setQuestionIdToConfirmDelete(q.id)}
                                  className="text-xs font-bold cursor-pointer px-2 py-0.5 rounded delete-btn-custom"
                                >
                                  Skasuj pytanie
                                </button>
                              )}
                            </div>
                          )}

                           <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div>
                                <span className="text-xs text-slate-500 font-extrabold block mb-1">Treść pytania #{qIdx + 1}</span>
                                <input
                                  required
                                  type="text"
                                  placeholder="Wpisz treść pytania..."
                                  value={q.text}
                                  onChange={(e) => handleQuestionTextChange(qIdx, e.target.value)}
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#5F7A61] transition-all text-slate-850"
                                />
                              </div>

                              <div>
                                <span className="text-xs text-slate-500 font-extrabold block mb-1">Typ pytania</span>
                                <select
                                  value={q.type || 'single'}
                                  onChange={(e) => {
                                    const updated = [...newQuestions];
                                    const typeVal = e.target.value as 'single' | 'multicheck' | 'text' | 'dropdown' | 'bricks';
                                    updated[qIdx] = {
                                      ...updated[qIdx],
                                      type: typeVal,
                                      correctAnswerIndices: updated[qIdx].correctAnswerIndices || [updated[qIdx].correctAnswerIndex || 0],
                                      correctTextAnswers: updated[qIdx].correctTextAnswers || [],
                                      bricksText: updated[qIdx].bricksText || updated[qIdx].text || '',
                                      bricksCorrectAnswers: updated[qIdx].bricksCorrectAnswers || []
                                    };
                                    setNewQuestions(updated);
                                  }}
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:border-[#5F7A61]"
                                >
                                  <option value="single">Jednokrotny wybór (Opcje radiowe)</option>
                                  <option value="multicheck">Wielokrotny wybór (Checkboxy)</option>
                                  <option value="dropdown">Wybór z listy rozwijalnej (Select)</option>
                                  <option value="text">Odpowiedź pisemna / krótki tekst</option>
                                  <option value="bricks">Cegiełki do tekstu (Zdanie z lukami)</option>
                                </select>
                              </div>

                              <div>
                                <span className="text-xs text-slate-500 font-extrabold block mb-1">Punkty za zadanie</span>
                                <input
                                  type="number"
                                  min={1}
                                  placeholder={`Domyślnie: ${getQuestionMaxPoints({ ...q, points: undefined })} pkt`}
                                  value={q.points !== undefined && q.points !== null ? q.points : ''}
                                  onChange={(e) => {
                                    const val = e.target.value ? Math.max(1, parseInt(e.target.value)) : undefined;
                                    const updated = [...newQuestions];
                                    updated[qIdx] = {
                                      ...updated[qIdx],
                                      points: val
                                    };
                                    setNewQuestions(updated);
                                  }}
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#5F7A61] transition-all text-slate-850 font-mono"
                                />
                              </div>
                            </div>

                            {/* 1. SINGLE CHOICE & 2. DROPDOWN CONFIG */}
                            {((q.type || 'single') === 'single' || q.type === 'dropdown') && (
                              <div className="space-y-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Opcje odpowiedzi (zaznacz kropką poprawną)</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {q.answers.map((answer, cIdx) => (
                                    <div key={cIdx} className="flex items-center gap-2">
                                      <input
                                        type="radio"
                                        id={`correct-opt-${qIdx}-${cIdx}`}
                                        name={`correct-answer-grp-${qIdx}`}
                                        checked={q.correctAnswerIndex === cIdx}
                                        onChange={() => handleCorrectAnswerChange(qIdx, cIdx)}
                                        className="accent-[#5F7A61] shrink-0 w-4 h-4 cursor-pointer"
                                        title="Zaznacz jako poprawną odpowiedź"
                                      />
                                      <input
                                        required
                                        type="text"
                                        placeholder={`Opcja ${String.fromCharCode(65 + cIdx)}`}
                                        value={answer}
                                        onChange={(e) => handleAnswerChoiceChange(qIdx, cIdx, e.target.value)}
                                        className={`w-full px-3 py-1.5 bg-white border rounded-lg text-xs focus:outline-none transition-all ${
                                          q.correctAnswerIndex === cIdx 
                                            ? 'border-[#5F7A61] font-semibold text-slate-900 bg-[#5F7A61]/5' 
                                            : 'border-slate-200 text-slate-700'
                                        }`}
                                      />
                                    </div>
                                  ))}
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium italic">Wskazówka: Zaznacz kółkiem (radio button) poprawną opcję po lewej stronie tekstu opcji.</p>
                              </div>
                            )}

                            {/* 3. MULTICHECK CONFIG */}
                            {q.type === 'multicheck' && (
                              <div className="space-y-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Opcje odpowiedzi (zaznacz ptaszkiem wszystkie poprawne)</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {q.answers.map((answer, cIdx) => {
                                    const isChecked = (q.correctAnswerIndices || []).includes(cIdx);
                                    return (
                                      <div key={cIdx} className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          id={`correct-opt-check-${qIdx}-${cIdx}`}
                                          checked={isChecked}
                                          onChange={() => {
                                            const updated = [...newQuestions];
                                            const currentIndices = updated[qIdx].correctAnswerIndices || [];
                                            const nextIndices = isChecked
                                              ? currentIndices.filter(i => i !== cIdx)
                                              : [...currentIndices, cIdx];
                                            updated[qIdx].correctAnswerIndices = nextIndices;
                                            
                                            // Fallback standard correctly updated
                                            if (nextIndices.length > 0) {
                                              updated[qIdx].correctAnswerIndex = nextIndices[0];
                                            }
                                            setNewQuestions(updated);
                                          }}
                                          className="accent-[#5F7A61] shrink-0 w-4 h-4 cursor-pointer"
                                        />
                                        <input
                                          required
                                          type="text"
                                          placeholder={`Opcja ${String.fromCharCode(65 + cIdx)}`}
                                          value={answer}
                                          onChange={(e) => handleAnswerChoiceChange(qIdx, cIdx, e.target.value)}
                                          className={`w-full px-3 py-1.5 bg-white border rounded-lg text-xs focus:outline-none transition-all ${
                                            isChecked 
                                              ? 'border-[#5F7A61] font-semibold text-slate-900 bg-[#5F7A61]/5' 
                                              : 'border-slate-200 text-slate-700'
                                          }`}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium italic">Wskazówka: Zaznacz jedno lub więcej pól poprawności obok opcji odpowiedzi.</p>
                              </div>
                            )}

                            {/* 4. TEXT ANSWER CONFIG */}
                            {q.type === 'text' && (
                              <div className="space-y-2.5">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  Uznawane wersje poprawnej odpowiedzi (oddzielone przecinkami)
                                </label>
                                <input
                                  type="text"
                                  placeholder="np. Mikołaj Kopernik, Kopernik, Nicolaus Copernicus"
                                  value={(q.correctTextAnswers || []).join(', ')}
                                  onChange={(e) => {
                                    const updated = [...newQuestions];
                                    updated[qIdx].correctTextAnswers = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                    // Make sure first choice can serve as safe default text
                                    updated[qIdx].answers[0] = updated[qIdx].correctTextAnswers[0] || '';
                                    setNewQuestions(updated);
                                  }}
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#5F7A61] text-slate-800"
                                />
                                <p className="text-[10px] text-slate-450 font-medium">System automatycznie usunie zbędne białe znaki studenta i ignoruje wielkość liter przy sprawdzaniu odpowiedzi.</p>
                              </div>
                            )}

                            {/* 5. BRICKS IN TEXT CONFIG */}
                            {q.type === 'bricks' && (
                              <div className="space-y-3 bg-[#5F7A61]/5 p-3 rounded-lg border border-[#5F7A61]/10">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                                    Tekst z lukami (użyj <strong className="text-rose-600">[gap]</strong> tam, gdzie gracz ma przeciągnąć klocek)
                                  </label>
                                  <textarea
                                    rows={2}
                                    placeholder="np. Kopernik wstrzymał [gap] i ruszył [gap]."
                                    value={q.bricksText || ''}
                                    onChange={(e) => {
                                      const updated = [...newQuestions];
                                      updated[qIdx].bricksText = e.target.value;
                                      setNewQuestions(updated);
                                    }}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#5F7A61] text-slate-800"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                    Słowa klocków (cegiełki do wyboru przez gracza)
                                  </label>
                                  <div className="grid grid-cols-2 gap-2">
                                    {q.answers.map((brick, bIdx) => (
                                      <input
                                        key={bIdx}
                                        type="text"
                                        placeholder={`Cegiełka ${String.fromCharCode(65 + bIdx)}`}
                                        value={brick}
                                        onChange={(e) => {
                                          const updated = [...newQuestions];
                                          updated[qIdx].answers[bIdx] = e.target.value;
                                          setNewQuestions(updated);
                                        }}
                                        className="w-full px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#5F7A61]"
                                      />
                                    ))}
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-0.5">
                                    Poprawne klocki dla każdej luki po kolei (oddzielone przecinkami)
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="np. Słońce, Ziemię"
                                    value={(q.bricksCorrectAnswers || []).join(', ')}
                                    onChange={(e) => {
                                      const updated = [...newQuestions];
                                      updated[qIdx].bricksCorrectAnswers = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                      setNewQuestions(updated);
                                    }}
                                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#5F7A61]"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingQuizId(null);
                        setIsCreatingQuiz(false);
                        setNewQuizTitle('');
                        setNewQuizDesc('');
                        setNewQuizDurationSelect('120');
                        setNewQuestions([{
                          id: 'q-new-0',
                          text: '',
                          answers: ['', '', '', ''],
                          correctAnswerIndex: 0,
                          type: 'single',
                          correctAnswerIndices: [0],
                          correctTextAnswers: [],
                          bricksText: '',
                          bricksCorrectAnswers: []
                        }]);
                      }}
                      className="py-2.5 px-4 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      Anuluj
                    </button>
                    <button
                      id="save-new-quiz-btn"
                      type="submit"
                      className="py-2.5 px-5 bg-[#5F7A61] hover:bg-[#4E644F] text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95"
                    >
                      {editingQuizId ? 'Zapisz zmiany w quizie' : 'Zapisz quiz w bazie'}
                    </button>
                  </div>
                </form>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {quizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-[#5F7A61]">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        {deleteConfirmQuizId === quiz.id ? (
                          <div id={`del-confirm-${quiz.id}`} className="flex items-center gap-1 bg-pink-50 border border-pink-200 rounded-xl p-1 shrink-0 animate-pulse">
                            <span className="text-[10px] font-black text-pink-700 px-1">Usunąć?</span>
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteQuiz(quiz.id);
                                setDeleteConfirmQuizId(null);
                              }}
                              className="text-white rounded-lg px-2 py-0.5 text-[10px] font-black cursor-pointer shadow-xs active:scale-95 transition-all delete-btn-custom"
                            >
                              Tak
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmQuizId(null)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg px-2 py-0.5 text-[10px] font-bold cursor-pointer active:scale-95 transition-all"
                            >
                              Nie
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handleEditQuizClick(quiz)}
                              className="bg-slate-50 hover:bg-[#5F7A61]/10 text-[#5F7A61] border border-slate-200 hover:border-[#5F7A61]/30 rounded-xl px-2.5 py-1 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                              title="Zmień pytania lub ustawienia tego quizu"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edytuj</span>
                            </button>
                            <button
                              onClick={() => setDeleteConfirmQuizId(quiz.id)}
                              className="border border-slate-200 rounded-xl p-1.5 text-xs font-bold flex items-center justify-center transition-all cursor-pointer active:scale-95 delete-btn-custom"
                              title="Usuń ten quiz z katalogu"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                      <h4 className="text-base font-extrabold text-slate-800 leading-tight">
                        {quiz.title}
                      </h4>
                      <p className="text-slate-500 text-xs mt-2 line-clamp-2">
                        {quiz.description}
                      </p>
                    </div>

                    <div className="border-t border-slate-100 pt-4 mt-4 flex items-center justify-between text-xs font-semibold text-slate-600">
                      <div className="flex gap-1.5">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-mono font-bold">
                          {quiz.questions.length} {quiz.questions.length === 1 ? 'pytanie' : quiz.questions.length >= 2 && quiz.questions.length <= 4 ? 'pytania' : 'pytań'}
                        </span>
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-150 px-2 py-0.5 rounded-md font-mono font-black" title="Suma punktów za cały quiz">
                          {quiz.questions.reduce((acc, q) => acc + getQuestionMaxPoints(q), 0)} pkt
                        </span>
                      </div>
                      <span className="flex items-center gap-1 text-slate-400 font-mono">
                        <Clock className="w-3.5 h-3.5 text-[#5F7A61]" />
                        {Math.floor(quiz.defaultDuration / 60)}m {quiz.defaultDuration % 60}s
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* TAB 3: RESULTS LOGS DATABASE */}
      {activeTab === 'results' && (
        <div id="admin-results-view" className="space-y-6">
          {/* Quick Class Analytics Shelf */}
          {allResults.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 max-w-2xl gap-4">
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Wszystkie sesje</span>
                <span className="text-2xl font-black text-[#5F7A61] font-mono mt-1">{allResults.length}</span>
                <span className="text-[10px] text-slate-500 mt-1">Ukończone podejścia</span>
              </div>
              
              {classFilter !== 'all' ? (
                <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-[#5F7A61] uppercase tracking-wider block">Średnia klasy {classFilter}</span>
                  <span className="text-2xl font-black text-amber-600 font-mono mt-1">
                    {(() => {
                      const classResults = allResults.filter(r => r.className === classFilter);
                      return classResults.length > 0
                        ? `${Math.round(classResults.reduce((acc, r) => acc + r.percentage, 0) / classResults.length)}%`
                        : '0%';
                    })()}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1">Średnia poprawność klasy</span>
                </div>
              ) : (
                <div className="bg-slate-50/40 border border-dashed border-slate-200/80 rounded-xl p-4 flex flex-col justify-center items-center text-center">
                  <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-[280px]">
                    Wybierz konkretną klasę w filtrach poniżej, aby obliczyć i wyświetlić średnią ocen grupy.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">Ewidencja ocen i odpowiedzi</h3>
                <p className="text-slate-400 text-xs mt-0.5">Wszystkie sesje uczniów są zapisywane w formacie przygotowanym pod eksport do MySQL/Firebase.</p>
              </div>

              {/* Actions: Export & Reset database */}
              <div className="flex items-center gap-2 flex-wrap">
                {allResults.length > 0 && (
                  <>
                    <button
                      id="export-db-json-btn"
                      onClick={exportResultsJSON}
                      className="py-2 px-3.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Eksportuj Bazę (JSON)</span>
                    </button>

                    <button
                      id="clear-db-btn"
                      onClick={() => {
                        if (window.confirm('Czy na pewno chcesz usunąć wszystkie zgromadzone wyniki sesji? Tej operacji nie można cofnąć.')) {
                          onClearResults();
                        }
                      }}
                      className="py-2 px-3 text-xs font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer delete-btn-custom"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Wyczyść historię</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Filters shelf */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Klasa</label>
                <select
                  id="filter-class-select"
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  <option value="all">Wszystkie klasy ({allResults.length})</option>
                  {classesList.map(cl => (
                    <option key={cl} value={cl}>Klasa {cl}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Szukaj ucznia / quizu</label>
                <input
                  id="search-filter-input"
                  type="text"
                  placeholder="Napisz imię, nazwisko lub nazwę quizu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#5F7A61]"
                />
              </div>
            </div>

            {/* Results table */}
            {filteredResults.length === 0 ? (
              <div className="text-center py-12 text-slate-400 border border-slate-100 rounded-xl bg-slate-50/30">
                <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-sm">Brak rekordów dopasowanych do filtrów</p>
                <p className="text-xs text-slate-400 mt-0.5">Uczniowie muszą ukończyć chociaż jeden aktywny quiz, aby ich wyniki pojawiły się tutaj.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="min-w-full divide-y divide-slate-150 text-left text-xs text-slate-600 font-semibold">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3.5">Uczeń</th>
                      <th className="px-4 py-3.5">Klasa</th>
                      <th className="px-4 py-3.5">Nazwa Quizu</th>
                      <th className="px-4 py-3.5 text-center">Wynik (Punkty)</th>
                      <th className="px-4 py-3.5 text-center">Procent</th>
                      <th className="px-4 py-3.5 text-right">Data sesji</th>
                      <th className="px-4 py-3.5 text-right">Szczegóły</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredResults.map((res) => {
                      const isExcellent = res.percentage >= 80;
                      const isMedium = res.percentage >= 50 && res.percentage < 80;

                      return (
                        <tr key={res.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 text-slate-900 font-bold">
                            {res.firstName} {res.lastName}
                          </td>
                          <td className="px-4 py-3 font-mono">
                            {res.className}
                          </td>
                          <td className="px-4 py-3 text-slate-700 max-w-xs truncate font-medium">
                            {res.quizTitle}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-slate-800">
                            {res.score} / {res.totalQuestions}
                          </td>
                          <td className="px-4 py-3 text-center font-mono">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                              isExcellent ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' :
                              isMedium ? 'bg-amber-50 text-amber-700 border border-amber-150' : 'bg-rose-50 text-rose-700 border border-rose-150'
                            }`}>
                              {res.percentage}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-[10px] text-slate-400">
                            {new Date(res.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(res.timestamp).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => setSelectedResultForAnalysis(res)}
                              className="bg-slate-50 hover:bg-[#5F7A61]/15 hover:text-[#5F7A61] border border-slate-200 text-slate-700 rounded-xl px-2.5 py-1 text-xs font-bold transition-all cursor-pointer active:scale-95 inline-flex items-center gap-1"
                              title="Przeanalizuj odpowiedź po odpowiedzi"
                            >
                              <BarChart2 className="w-3.5 h-3.5" />
                              <span>Analizuj</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: REGISTERED USERS MANAGEMENT */}
      {activeTab === 'users' && currentUser?.role === 'admin' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm" id="admin-users-view">
          {usersError && (
            <div className="mb-4 bg-rose-50 text-rose-700 text-xs px-3 py-2.5 rounded-xl font-bold flex items-center gap-2 border border-rose-200">
              <AlertCircle className="w-4.5 h-4.5 text-rose-600 animate-pulse" />
              <span>{usersError}</span>
            </div>
          )}

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-base font-extrabold text-slate-800">Zarejestrowani Użytkownicy aplikacji</h3>
              <p className="text-slate-400 text-xs mt-0.5">Zarządzaj kontami uczniów, nauczycieli i administratorów zapisanymi w lokalnej bazie danych.</p>
            </div>

            <button
              onClick={() => setIsAddingUser(!isAddingUser)}
              className="py-2.5 px-4 bg-[#5F7A61] hover:bg-[#4E644F] text-white rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isAddingUser ? 'Pokaż wszystkich' : 'Zarejestruj nowego użytkownika'}</span>
            </button>
          </div>

          <AnimatePresence mode="wait">
            {isAddingUser ? (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="bg-slate-50 border border-slate-200 p-5 sm:p-6 rounded-2xl max-w-xl"
                  >
                    <h4 className="text-sm font-extrabold text-slate-800 mb-4 flex items-center gap-1.5 border-b border-slate-200/60 pb-2">
                      <UserPlus className="w-4 h-4 text-[#5F7A61]" /> Formularz zakładania konta
                    </h4>
                    {addUserError && (
                      <div className="mb-4 bg-rose-50 text-rose-700 text-xs px-3 py-2 rounded-lg font-semibold flex items-center gap-1.5 border border-rose-100">
                        <AlertCircle className="w-4 h-4" />
                        <span>{addUserError}</span>
                      </div>
                    )}
                    <form onSubmit={handleAddUserSubmit} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Imię i Nazwisko / Nazwa</label>
                        <input
                          type="text"
                          required
                          placeholder="np. Anna Kowalska"
                          value={newUserFullName}
                          onChange={(e) => setNewUserFullName(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#5F7A61]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">E-mail (login użytkownika)</label>
                        <input
                          type="email"
                          required
                          placeholder="np. ania@szkola.pl"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#5F7A61]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hasło (min. 8 znaków, A-Z, a-z, 0-9)</label>
                        <input
                          type="text"
                          required
                          placeholder="Min. 8 znaków, mała/wielka litera, cyfra"
                          value={newUserPassword}
                          onChange={(e) => setNewUserPassword(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold font-mono focus:outline-none focus:border-[#5F7A61]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Rola w systemie</label>
                        <select
                          value={newUserRole}
                          onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'teacher' | 'student')}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer"
                        >
                          <option value="teacher">Nauczyciel (Prowadzenie zajęć, kody, quizy)</option>
                          <option value="student">Student / Uczeń (Tylko rozwiązywanie quizów)</option>
                        </select>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsAddingUser(false)}
                          className="py-2 px-3 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 transition-all cursor-pointer"
                        >
                          Anuluj
                        </button>
                        <button
                          type="submit"
                          className="py-2.5 px-4 bg-[#5F7A61] hover:bg-[#4E644F] text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                        >
                          Utwórz i zachowaj konto
                        </button>
                      </div>
                    </form>
                  </motion.div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="min-w-full divide-y divide-slate-150 text-left text-xs text-slate-600 font-semibold">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="px-4 py-3.5">Użytkownik</th>
                          <th className="px-4 py-3.5">Rola</th>
                          <th className="px-4 py-3.5">E-mail (login)</th>
                          <th className="px-4 py-3.5">Hasło</th>
                          <th className="px-4 py-3.5 text-right">Zarządzanie</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {registeredUsers.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-10 text-slate-400 italic">Brak zarejestrowanych osób. Kliknij przycisk powyżej, by utworzyć konto.</td>
                          </tr>
                        ) : (
                          registeredUsers.map((u) => {
                            const isUAdmin = u.role === 'admin';
                            const isUTeacher = u.role === 'teacher';
                            return (
                              <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-4 py-3 text-slate-900 dark:text-slate-100 font-bold flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${isUAdmin ? 'bg-rose-500 animate-pulse' : isUTeacher ? 'bg-[#5F7A61]' : 'bg-emerald-500'}`} />
                                  <span>{u.fullName} {u.id === currentUser?.id ? ' (Ty)' : ''}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isUAdmin 
                                      ? 'bg-rose-50 text-rose-700 border border-rose-150' 
                                      : isUTeacher
                                      ? 'bg-emerald-50 text-emerald-950 font-black border border-[#5F7A61]/25'
                                      : 'bg-blue-50 text-blue-700 border border-blue-150'
                                  }`}>
                                    {isUAdmin ? 'Administrator' : isUTeacher ? 'Nauczyciel' : 'Uczeń'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-slate-600 dark:text-slate-200 font-medium font-mono">
                                  {u.email}
                                </td>
                                <td className="px-4 py-3 text-slate-400 dark:text-slate-300 font-mono text-xs">
                                  <span className="flex items-center gap-1.5" title="Hasło zapisane w bazie jako bezpieczny skrót SHA-256">
                                    <span className="text-slate-300 select-none font-sans font-bold">••••••••</span>
                                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded-md font-sans font-bold">{u.password ? 'SHA-256' : 'brak'}</span>
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right flex items-center justify-end gap-2 flex-wrap">
                                  {currentUser?.role === 'admin' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingPasswordUserId(u.id);
                                        setTempNewPassword('');
                                        setChangePasswordError('');
                                        setChangePasswordSuccess('');
                                      }}
                                      className="p-1 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 border border-slate-200 hover:border-[#5F7A61]/30 hover:bg-[#5F7A61]/5 text-[#5F7A61]"
                                      title="Resetuj lub zmień hasło dla tego użytkownika"
                                    >
                                      <Lock className="w-3 h-3" />
                                      <span>Hasło</span>
                                    </button>
                                  )}

                                  {deleteConfirmUserId === u.id ? (
                                    <div id={`user-del-confirm-${u.id}`} className="inline-flex items-center gap-1.5 bg-pink-50 border border-pink-200 rounded-lg p-1 animate-pulse justify-end">
                                      <span className="text-[10px] font-black text-pink-700 px-1">Na pewno?</span>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteUser(u.id)}
                                        className="text-white bg-pink-600 hover:bg-pink-700 rounded px-2 py-0.5 text-[10px] font-black cursor-pointer shadow-xs active:scale-95 transition-all delete-btn-custom"
                                      >
                                        Tak
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDeleteConfirmUserId(null)}
                                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded px-2 py-0.5 text-[10px] font-bold cursor-pointer active:scale-95 transition-all"
                                      >
                                        Nie
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setDeleteConfirmUserId(u.id)}
                                      disabled={isUAdmin}
                                      className={`p-1 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 delete-btn-custom ${
                                        isUAdmin ? 'opacity-35 cursor-not-allowed' : ''
                                      }`}
                                      title={isUAdmin ? "Nie można usunąć konta administratora" : "Skasuj to konto użytkownika"}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Usuń</span>
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </AnimatePresence>

              {/* Change Password Modal for Admin */}
              {editingPasswordUserId && (
                <div 
                  onClick={() => {
                    setEditingPasswordUserId(null);
                    setTempNewPassword('');
                    setTempRepeatPassword('');
                    setChangePasswordError('');
                    setChangePasswordSuccess('');
                  }}
                  className="fixed inset-0 bg-[#2D3436]/70 backdrop-blur-md flex items-center justify-center p-4 z-50 cursor-pointer animate-fade-in"
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full border border-slate-200 shadow-2xl relative cursor-default text-left"
                  >
                    <h3 className="text-base font-extrabold text-slate-800 mb-2 flex items-center gap-2">
                      <Lock className="w-5 h-5 text-[#5F7A61]" /> Zmień hasło użytkownika
                    </h3>
                    <p className="text-slate-400 text-xs mb-4 leading-normal">
                      Wpisz nowe, bezpieczne hasło logowania dla użytkownika:{' '}
                      <strong className="text-slate-700">
                        {registeredUsers.find(u => u.id === editingPasswordUserId)?.fullName || ''}
                      </strong>
                    </p>

                    {changePasswordError && (
                      <div className="mb-4 bg-rose-50 text-rose-700 text-xs px-3 py-2 rounded-xl font-bold border border-rose-100 flex items-center gap-1.5 leading-normal">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                        <span>{changePasswordError}</span>
                      </div>
                    )}

                    {changePasswordSuccess && (
                      <div className="mb-4 bg-emerald-50 text-emerald-700 text-xs px-3 py-2 rounded-xl font-bold border border-emerald-100 flex items-center gap-1.5 leading-normal">
                        <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-600 animate-bounce" />
                        <span>{changePasswordSuccess}</span>
                      </div>
                    )}

                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (tempNewPassword !== tempRepeatPassword) {
                          setChangePasswordError('Podane hasła nie są identyczne!');
                          return;
                        }
                        if (window.confirm('Czy na pewno chcesz zmienić hasło temu użytkownikowi?')) {
                          handleChangeUserPassword(editingPasswordUserId, tempNewPassword);
                        }
                      }}
                      className="space-y-4"
                    >
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Nowe hasło (min. 8 znaków, A-Z, a-z, 0-9)</label>
                        <input
                          required
                          type="text"
                          placeholder="Zadaj nowe hasło użytkownikowi"
                          value={tempNewPassword}
                          onChange={(e) => setTempNewPassword(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-[#5F7A61] font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Powtórz nowe hasło</label>
                        <input
                          required
                          type="text"
                          placeholder="Powtórz zadane hasło"
                          value={tempRepeatPassword}
                          onChange={(e) => setTempRepeatPassword(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-[#5F7A61] font-mono font-bold"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPasswordUserId(null);
                            setTempNewPassword('');
                            setTempRepeatPassword('');
                            setChangePasswordError('');
                            setChangePasswordSuccess('');
                          }}
                          className="py-2 px-3 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 transition-all cursor-pointer"
                        >
                          Anuluj
                        </button>
                        <button
                          type="submit"
                          className="py-2.5 px-4 bg-[#5F7A61] hover:bg-[#4E644F] text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                        >
                          Zapisz nowe hasło
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </div>
          )}

      {/* ANALYSIS DIALOG MODAL OVERLAY */}
      <AnimatePresence>
        {selectedResultForAnalysis && (() => {
          const res = selectedResultForAnalysis;
          // Find matching template in state
          const quizTemplate = quizzes.find(q => q.title.toLowerCase() === res.quizTitle.toLowerCase());
          const isExcellent = res.percentage >= 80;
          const isMedium = res.percentage >= 50 && res.percentage < 80;

          return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="bg-white rounded-2xl w-full max-w-2xl border border-slate-200 overflow-hidden shadow-2xl flex flex-col my-8 max-h-[85vh]"
              >
                {/* Header */}
                <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50 flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Analiza Szczegółowa Wyniku</span>
                    <h4 className="text-lg font-extrabold text-slate-800 leading-tight mt-1">
                      {res.firstName} {res.lastName}
                    </h4>
                    <p className="text-xs text-[#5F7A61] font-semibold mt-1">
                      Klasa {res.className} • Quiz "{res.quizTitle}"
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedResultForAnalysis(null)}
                    className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-xl transition-all cursor-pointer shrink-0"
                    title="Zamknij podgląd"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Score Summary shelf */}
                <div className="px-5 sm:px-6 py-4 bg-[#5F7A61]/5 border-b border-slate-150 flex justify-between items-center gap-4">
                  <div className="flex items-center gap-3">
                    <span className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black font-mono ${
                      isExcellent ? 'bg-emerald-100 text-emerald-800' :
                      isMedium ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {res.percentage}%
                    </span>
                     <div>
                       <span className="text-xs text-slate-550 block font-semibold">Skuteczność ogólna</span>
                       <span className="text-xs font-extrabold text-slate-800">
                         {res.score} z {res.totalQuestions} pkt
                       </span>
                     </div>
                  </div>

                  <span className="text-[10px] bg-white border border-slate-200 px-3 py-1 rounded-lg text-slate-400 font-mono">
                    {new Date(res.timestamp).toLocaleDateString()} o {new Date(res.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Questions Responses Map */}
                <div className="p-5 sm:p-6 overflow-y-auto space-y-4 bg-slate-50/55 flex-1">
                  {!quizTemplate ? (
                    <div className="text-center py-6 text-slate-500 text-xs italic bg-amber-50 border border-amber-100 rounded-xl px-4">
                      <p className="font-bold">Szablon tego quizu nie istnieje już w katalogu.</p>
                      <p className="mt-1">Poniżej przedstawiono surowy wykaz indeksów wybranych odpowiedzi:</p>
                      <p className="font-mono text-[11px] font-bold mt-2 bg-white/80 p-2 rounded-lg text-slate-700 max-w-sm mx-auto">
                        Odpowiedzi: {JSON.stringify(res.answers)}
                      </p>
                    </div>
                  ) : (
                    quizTemplate.questions.map((question, qIdx) => {
                      const studentSelectedResponse = res.answers[qIdx];
                      const qType = question.type || 'single';
                      
                      // Check correctness
                      let isCorrect = false;
                      if (qType === 'single' || qType === 'dropdown') {
                        isCorrect = studentSelectedResponse !== undefined && studentSelectedResponse !== null && Number(studentSelectedResponse) === question.correctAnswerIndex;
                      } else if (qType === 'multicheck') {
                        const correctIndices = question.correctAnswerIndices || [question.correctAnswerIndex];
                        if (Array.isArray(studentSelectedResponse)) {
                          isCorrect = studentSelectedResponse.length === correctIndices.length &&
                                      studentSelectedResponse.every(val => correctIndices.includes(Number(val))) &&
                                      correctIndices.every(val => studentSelectedResponse.includes(Number(val)));
                        }
                      } else if (qType === 'text') {
                        const studentStr = String(studentSelectedResponse || '').trim().toLowerCase();
                        const correctAnswers = question.correctTextAnswers && question.correctTextAnswers.length > 0 
                          ? question.correctTextAnswers 
                          : (question.answers || []);
                        isCorrect = correctAnswers.some(ans => ans.trim().toLowerCase() === studentStr);
                      } else if (qType === 'bricks') {
                        if (Array.isArray(studentSelectedResponse)) {
                          const correctAnswers = question.bricksCorrectAnswers || [];
                          isCorrect = studentSelectedResponse.length === correctAnswers.length &&
                                      studentSelectedResponse.every((ans, aIdx) => {
                                        const correctVal = correctAnswers[aIdx] || '';
                                        return String(ans || '').trim().toLowerCase() === correctVal.trim().toLowerCase();
                                      });
                        }
                      }

                      const earned = calculateQuestionScore(question, studentSelectedResponse);
                      const maxP = getQuestionMaxPoints(question);
                      const isFullyCorrect = earned === maxP && maxP > 0;
                      const isPartiallyCorrect = earned > 0 && earned < maxP;

                      return (
                        <div key={question.id} className={`p-4 rounded-xl border bg-white ${
                          isFullyCorrect ? 'border-emerald-100 shadow-xs' : isPartiallyCorrect ? 'border-amber-100 shadow-xs' : 'border-rose-100 shadow-xs'
                        } space-y-3`}>
                          <div className="flex justify-between items-start gap-3">
                            <div>
                              <span className="text-[9px] uppercase font-mono font-black text-slate-400 tracking-wider">
                                Pytanie {qIdx + 1} • {
                                  qType === 'single' ? 'Jednokrotny' :
                                  qType === 'multicheck' ? 'Wielokrotny' :
                                  qType === 'text' ? 'Zapis klawiaturowy' :
                                  qType === 'dropdown' ? 'Dropdown' : 'Cegiełki'
                                }
                              </span>
                              <p className="text-sm font-extrabold text-slate-850 leading-tight mt-0.5">
                                {question.text}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-md border border-emerald-150 font-mono">
                                {earned} / {maxP} pkt
                              </span>
                              {isFullyCorrect ? (
                                <span className="px-2 py-0.5 text-[10px] font-black rounded-md uppercase bg-emerald-50 text-emerald-700 border border-emerald-150 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Dobrze
                                </span>
                              ) : isPartiallyCorrect ? (
                                <span className="px-2 py-0.5 text-[10px] font-black rounded-md uppercase bg-amber-50 text-amber-700 border border-amber-150 flex items-center gap-1">
                                  Częściowo
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-[10px] font-black rounded-md uppercase bg-rose-50 text-rose-700 border border-rose-150 flex items-center gap-1">
                                  <XCircle className="w-3.5 h-3.5" /> Źle
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Rich feedback visualizer based on question category */}
                          <div className="pl-3 border-l-2 border-slate-200 text-xs space-y-2 mt-2">
                            {studentSelectedResponse === undefined || studentSelectedResponse === null ? (
                              <p className="text-rose-600 font-bold italic">Nie udzielono odpowiedzi (brakło czasu!).</p>
                            ) : (
                              <div className="space-y-1.5 text-slate-750">
                                {/* Single / Dropdown Choice */}
                                {(qType === 'single' || qType === 'dropdown') && (
                                  <>
                                    <p>
                                      <strong className="text-slate-400 uppercase text-[9px] tracking-wide mr-1.5">Uczeń zaznaczył:</strong>
                                      <span className={isCorrect ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                                        {question.answers[Number(studentSelectedResponse)] !== undefined ? question.answers[Number(studentSelectedResponse)] : studentSelectedResponse}
                                      </span>
                                    </p>
                                    {!isCorrect && (
                                      <p className="text-emerald-700">
                                        <strong className="text-slate-400 uppercase text-[9px] tracking-wide mr-1.5">Prawidłowa opcja:</strong>
                                        <span className="font-bold">{question.answers[question.correctAnswerIndex]}</span>
                                      </p>
                                    )}
                                  </>
                                )}

                                {/* Multicheck Choice */}
                                {qType === 'multicheck' && (() => {
                                  const selected: number[] = Array.isArray(studentSelectedResponse) ? studentSelectedResponse : [];
                                  const correct = question.correctAnswerIndices || [question.correctAnswerIndex];
                                  return (
                                    <>
                                      <p>
                                        <strong className="text-slate-400 uppercase text-[9px] tracking-wide mr-1.5">Zaznaczone:</strong>
                                        <span className={isCorrect ? 'text-emerald-700 font-bold' : 'text-slate-800 font-bold'}>
                                          {selected.length > 0 ? selected.map(i => question.answers[i]).join(', ') : '[brak]'}
                                        </span>
                                      </p>
                                      <p className="text-emerald-700">
                                        <strong className="text-slate-400 uppercase text-[9px] tracking-wide mr-1.5">Poprawny zestaw:</strong>
                                        <span className="font-bold">{correct.map(i => question.answers[i]).join(', ')}</span>
                                      </p>
                                    </>
                                  );
                                })()}

                                {/* Text Answer */}
                                {qType === 'text' && (() => {
                                  const correctAnswers = question.correctTextAnswers && question.correctTextAnswers.length > 0
                                    ? question.correctTextAnswers
                                    : (question.answers || []);
                                  return (
                                    <>
                                      <p>
                                        <strong className="text-slate-400 uppercase text-[9px] tracking-wide mr-1.5">Napisano:</strong>
                                        <span className={isCorrect ? 'text-emerald-700 font-extrabold font-mono text-xs' : 'text-rose-700 font-extrabold font-mono text-xs'}>
                                          "{studentSelectedResponse}"
                                        </span>
                                      </p>
                                      {!isCorrect && (
                                        <p className="text-emerald-750">
                                          <strong className="text-slate-400 uppercase text-[9px] tracking-wide mr-1.5">Uznawane wersje:</strong>
                                          <span className="font-bold">{correctAnswers.map(t => `"${t}"`).join(' lub ')}</span>
                                        </p>
                                      )}
                                    </>
                                  );
                                })()}

                                {/* Bricks Placement */}
                                {qType === 'bricks' && (() => {
                                  const placed: string[] = Array.isArray(studentSelectedResponse) ? studentSelectedResponse : [];
                                  const correct = question.bricksCorrectAnswers || [];
                                  return (
                                    <>
                                      <div>
                                        <strong className="text-slate-400 uppercase text-[9px] tracking-wide mr-1.5 block mb-1">Ułożone klocki:</strong>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {placed.map((val, pIdx) => {
                                            const isPartCorrect = String(val).trim().toLowerCase() === String(correct[pIdx] || '').trim().toLowerCase();
                                            return (
                                              <span key={pIdx} className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                                isPartCorrect ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' : 'bg-rose-50 text-rose-700 border border-rose-150'
                                              }`}>
                                                Slot {pIdx + 1}: {val || '[brak]'}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      </div>
                                      <div>
                                        <strong className="text-slate-400 uppercase text-[9px] tracking-wide mr-1.5 block mb-1 mt-2">Prawidłowy układ:</strong>
                                        <div className="flex flex-wrap gap-1">
                                          {correct.map((val, pIdx) => (
                                            <span key={pIdx} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-100">
                                              Slot {pIdx + 1}: {val}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer action */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => setSelectedResultForAnalysis(null)}
                    className="py-2 px-5 bg-slate-700 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl cursor-pointer active:scale-95 transition-all"
                  >
                    Zamknij analizę
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
