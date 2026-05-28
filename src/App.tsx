import React, { useState, useEffect } from 'react';
import { ActiveRoom, Player, PlayerResult, Quiz, User } from './types';
import { DEFAULT_QUIZZES } from './data';
import Navbar from './components/Navbar';
import StudentQuiz from './components/StudentQuiz';
import AdminPanel from './components/AdminPanel';
import { 
  LogIn, UserPlus, Sparkles, GraduationCap, ArrowRight, Table, HelpCircle, 
  Settings, Key, Layers, Server, Play, Heart, Star, CheckCircle, AlertTriangle, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { hashPassword } from './utils/hash';

// Help pre-generate default teacher user
const DEFAULT_TEACHER_USER: User = {
  id: 'teacher-1',
  email: 'nauczyciel@szkola.pl',
  fullName: 'mgr Wojciech Nowak',
  role: 'admin',
};

export default function App() {
  // 1. Core State
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [activeRooms, setActiveRooms] = useState<ActiveRoom[]>([]);
  const [allResults, setAllResults] = useState<PlayerResult[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // 2. Navigation State
  const [currentView, setCurrentView] = useState<'home' | 'admin' | 'student-history'>('home');
  const [activeStudentRoom, setActiveStudentRoom] = useState<ActiveRoom | null>(null);

  // 3. Form input states for main game page
  const [gameCodeInput, setGameCodeInput] = useState('');
  const [joinError, setJoinError] = useState('');

  // 4. Modal Overlays
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  // Auth form states
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authInviteCode, setAuthInviteCode] = useState('');
  const [authRole, setAuthRole] = useState<'admin' | 'student'>('admin');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // 5. In-Screen Interactive Classroom Simulator toggle
  const [isSimulatorEnabled, setIsSimulatorEnabled] = useState(true);

  // 6. Theme State ('light' | 'dark' | 'system')
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('app_theme') as 'light' | 'dark' | 'system') || 'system';
  });

  // -------------------------------------------------------------
  // INITIALIZATION & DUAL-TAB LOCALSTORAGE SYNCHRONIZATION
  // -------------------------------------------------------------
  useEffect(() => {
    // A. Quizzes loading
    const cachedQuizzes = localStorage.getItem('quizzes_catalog');
    if (cachedQuizzes) {
      setQuizzes(JSON.parse(cachedQuizzes));
    } else {
      localStorage.setItem('quizzes_catalog', JSON.stringify(DEFAULT_QUIZZES));
      setQuizzes(DEFAULT_QUIZZES);
    }

    // B. Active rooms loading
    const cachedRooms = localStorage.getItem('active_rooms');
    if (cachedRooms) {
      setActiveRooms(JSON.parse(cachedRooms));
    }

    // C. Results logs loading
    const cachedResults = localStorage.getItem('player_results');
    if (cachedResults) {
      setAllResults(JSON.parse(cachedResults));
    }

    // D. Auto login default helper for easy testing
    const cachedUser = localStorage.getItem('logged_in_user');
    if (cachedUser) {
      setCurrentUser(JSON.parse(cachedUser));
    }

    // Initialize default users in database (teacher and student)
    const usersList = JSON.parse(localStorage.getItem('registered_users') || '[]');
    let updatedUsers = [...usersList];
    let listChanged = false;

    const teacherExists = usersList.some((u: any) => u.email === DEFAULT_TEACHER_USER.email);
    if (!teacherExists) {
      updatedUsers.push({
        ...DEFAULT_TEACHER_USER,
        password: hashPassword('nauczyciel123')
      });
      listChanged = true;
    }

    const studentExists = usersList.some((u: any) => u.email === 'uczen@szkola.pl');
    if (!studentExists) {
      updatedUsers.push({
        id: 'student-1',
        email: 'uczen@szkola.pl',
        fullName: 'Kamil Kowalski',
        role: 'student',
        password: hashPassword('uczen123')
      });
      listChanged = true;
    }

    // Migrate existing plain-text passwords in database to secure SHA-256 hashes
    updatedUsers = updatedUsers.map((u: any) => {
      const isHexSha256 = /^[a-f0-9]{64}$/.test(u.password || '');
      if (u.password && !isHexSha256) {
        listChanged = true;
        return {
          ...u,
          password: hashPassword(u.password)
        };
      }
      return u;
    });

    if (listChanged) {
      localStorage.setItem('registered_users', JSON.stringify(updatedUsers));
    }

    // Initialize default teacher registration codes if empty
    const cachedCodes = localStorage.getItem('teacher_registration_codes');
    if (!cachedCodes) {
      localStorage.setItem('teacher_registration_codes', JSON.stringify(['KOD-NAUCZYCIELA-2026', 'SZKOLA-MEMO-2026']));
    }
  }, []);

  // Sync back to local storage and bind cross-tab storage changes!
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'active_rooms') {
        const updated = JSON.parse(e.newValue || '[]');
        setActiveRooms(updated);
        
        // If the student has entered a room and is currently viewing it, update the local student room state too!
        if (activeStudentRoom) {
          const match = updated.find((r: ActiveRoom) => r.code === activeStudentRoom.code);
          if (match) {
            setActiveStudentRoom(match);
          } else {
            // Room got cancelled
            setActiveStudentRoom(null);
            setJoinError('Pokój został zamknięty przez osobę prowadzącą.');
          }
        }
      }
      if (e.key === 'player_results') {
        setAllResults(JSON.parse(e.newValue || '[]'));
      }
      if (e.key === 'quizzes_catalog') {
        setQuizzes(JSON.parse(e.newValue || '[]'));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [activeStudentRoom]);

  // Apply theme when selection changes or system settings change
  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = () => {
      if (theme === 'dark') {
        root.classList.add('dark');
      } else if (theme === 'light') {
        root.classList.remove('dark');
      } else {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (systemPrefersDark) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    };

    applyTheme();
    localStorage.setItem('app_theme', theme);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        applyTheme();
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  // Utility to update active rooms states
  const saveRoomsToCache = (rooms: ActiveRoom[]) => {
    setActiveRooms(rooms);
    localStorage.setItem('active_rooms', JSON.stringify(rooms));
  };

  // Utility to save results to database
  const saveResultsToCache = (results: PlayerResult[]) => {
    setAllResults(results);
    localStorage.setItem('player_results', JSON.stringify(results));
  };

  // -------------------------------------------------------------
  // HANDLERS FOR TEACHER ACTIONS
  // -------------------------------------------------------------
  const handleAddNewQuiz = (newQuiz: Quiz) => {
    const updated = [...quizzes, newQuiz];
    setQuizzes(updated);
    localStorage.setItem('quizzes_catalog', JSON.stringify(updated));
  };

  const handleEditQuiz = (editedQuiz: Quiz) => {
    const updated = quizzes.map((q) => q.id === editedQuiz.id ? editedQuiz : q);
    setQuizzes(updated);
    localStorage.setItem('quizzes_catalog', JSON.stringify(updated));
  };

  const handleDeleteQuiz = (quizId: string) => {
    const updated = quizzes.filter((q) => q.id !== quizId);
    setQuizzes(updated);
    localStorage.setItem('quizzes_catalog', JSON.stringify(updated));
  };

  const handleLaunchRoom = (quizId: string, customCode: string, durationSecs: number) => {
    const quiz = quizzes.find((q) => q.id === quizId);
    if (!quiz) return;

    // Check if code is already occupied
    const activeMatch = activeRooms.some((room) => room.code === customCode && room.status !== 'ended');
    if (activeMatch) {
      alert(`Zajęty kod: Pokój o kodzie "${customCode}" już trwa bądź jest w gotowości. Wybierz inny kod.`);
      return;
    }

    const newRoom: ActiveRoom = {
      code: customCode,
      quizId: quiz.id,
      quizTitle: quiz.title,
      status: 'waiting',
      startedAt: null,
      createdAt: Date.now(),
      duration: durationSecs,
      joinedPlayers: [],
    };

    const nextRooms = [newRoom, ...activeRooms.filter(r => r.code !== customCode)];
    saveRoomsToCache(nextRooms);
  };

  const handleStartRoom = (code: string) => {
    const nextRooms = activeRooms.map((room) => {
      if (room.code === code) {
        return {
          ...room,
          status: 'in_progress' as const,
          startedAt: Date.now(),
        };
      }
      return room;
    });
    saveRoomsToCache(nextRooms);

    // If the student is on the same tab in wait mode, update them instantly
    if (activeStudentRoom && activeStudentRoom.code === code) {
      const liveMatch = nextRooms.find((r) => r.code === code);
      if (liveMatch) setActiveStudentRoom(liveMatch);
    }
  };

  const handleEndRoom = (code: string) => {
    const nextRooms = activeRooms.filter((room) => room.code !== code);
    saveRoomsToCache(nextRooms);

    if (activeStudentRoom && activeStudentRoom.code === code) {
      setActiveStudentRoom(null);
    }
  };

  const handleClearResults = () => {
    saveResultsToCache([]);
  };

  // -------------------------------------------------------------
  // HANDLERS FOR STUDENT ACTIONS
  // -------------------------------------------------------------
  const handleSearchGameCode = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');

    const query = gameCodeInput.trim().toUpperCase();
    if (!query) return;

    // Find first active room in matching code
    const matchingRoom = activeRooms.find((r) => r.code === query);
    if (!matchingRoom) {
      setJoinError('Nie znaleziono aktywnego pokoju. Poproś prowadzącego o prawidłowy kod gry.');
      return;
    }

    setActiveStudentRoom(matchingRoom);
  };

  // When student submits their identity to join the room
  const handlePlayerJoinRoom = (player: Player) => {
    if (!activeStudentRoom) return;

    const updatedRooms = activeRooms.map((room) => {
      if (room.code === activeStudentRoom.code) {
        // Prevent duplicate joining of identical device ID
        const existingId = room.joinedPlayers.some((p) => p.id === player.id);
        const joinedPlayers = existingId
          ? room.joinedPlayers.map(p => p.id === player.id ? player : p)
          : [...room.joinedPlayers, player];

        return { ...room, joinedPlayers };
      }
      return room;
    });

    saveRoomsToCache(updatedRooms);
    
    // Update local state copy
    const activeMatch = updatedRooms.find(r => r.code === activeStudentRoom.code);
    if (activeMatch) {
      setActiveStudentRoom(activeMatch);
    }
  };

  // When student quiz finishes, append result log
  const handleSaveStudentResult = (result: PlayerResult) => {
    const nextResults = [result, ...allResults];
    saveResultsToCache(nextResults);

    // Also link result history to logged-in students
    if (currentUser && currentUser.role === 'student') {
      const personalHistory = JSON.parse(localStorage.getItem(`student_history_${currentUser.id}`) || '[]');
      personalHistory.unshift(result);
      localStorage.setItem(`student_history_${currentUser.id}`, JSON.stringify(personalHistory));
    }
  };

  // -------------------------------------------------------------
  // AUTHENTICATION LOGIC
  // -------------------------------------------------------------
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    const usersList = JSON.parse(localStorage.getItem('registered_users') || '[]');
    const hashedAuthPassword = hashPassword(authPassword);
    const match = usersList.find(
      (u: any) => u.email === authEmail.trim() && u.password === hashedAuthPassword
    );

    if (!match) {
      setAuthError('Nieprawidłowy adres e-mail lub hasło.');
      return;
    }

    const payload: User = {
      id: match.id,
      email: match.email,
      fullName: match.fullName,
      role: match.role,
    };

    setCurrentUser(payload);
    localStorage.setItem('logged_in_user', JSON.stringify(payload));
    setIsLoginOpen(false);
    setAuthEmail('');
    setAuthPassword('');

    // If logged in as admin, route to panel automatically
    if (payload.role === 'admin') {
      setCurrentView('admin');
    } else {
      setCurrentView('student-history');
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    if (!authFullName.trim() || !authEmail.trim() || !authPassword || !authInviteCode.trim()) {
      setAuthError('Wszystkie pola formularza rejestracji są obowiązkowe.');
      return;
    }

    // Walidacja hasła: min 8 znaków, małe, duże litery, cyfra
    const isLengthValid = authPassword.length >= 8;
    const hasUppercase = /[A-Z]/.test(authPassword);
    const hasLowercase = /[a-z]/.test(authPassword);
    const hasDigit = /[0-9]/.test(authPassword);

    if (!isLengthValid || !hasUppercase || !hasLowercase || !hasDigit) {
      setAuthError('Hasło musi mieć co najmniej 8 znaków, zawierać małe i duże litery oraz co najmniej jedną cyfrę.');
      return;
    }

    const verificationCode = authInviteCode.trim().toUpperCase();
    const codesList: string[] = JSON.parse(localStorage.getItem('teacher_registration_codes') || '[]');
    
    if (!codesList.includes(verificationCode)) {
      setAuthError('Podany kod rejestracji nauczyciela jest niepoprawny, został już zużyty lub wygasł.');
      return;
    }

    const usersList = JSON.parse(localStorage.getItem('registered_users') || '[]');
    const emailExists = usersList.some((u: any) => u.email === authEmail.trim());

    if (emailExists) {
      setAuthError('Konto o podanym adresie email już istnieje.');
      return;
    }

    const newUserPayload = {
      id: `usr-${Date.now()}`,
      email: authEmail.trim(),
      password: hashPassword(authPassword),
      fullName: authFullName.trim(),
      role: 'admin' as const,
    };

    // Consume the registration code
    const updatedCodesList = codesList.filter(c => c !== verificationCode);
    localStorage.setItem('teacher_registration_codes', JSON.stringify(updatedCodesList));

    usersList.push(newUserPayload);
    localStorage.setItem('registered_users', JSON.stringify(usersList));

    setAuthSuccess('Konto Nauczyciela zostało zarejestrowane pomyślnie przy użyciu kodu.');
    
    // Auto-login registered user instantly for speed
    const userSession: User = {
      id: newUserPayload.id,
      email: newUserPayload.email,
      fullName: newUserPayload.fullName,
      role: newUserPayload.role,
    };
    
    setCurrentUser(userSession);
    localStorage.setItem('logged_in_user', JSON.stringify(userSession));
    setIsRegisterOpen(false);

    // Reset inputs
    setAuthEmail('');
    setAuthPassword('');
    setAuthFullName('');
    setAuthInviteCode('');

    setCurrentView('admin');
  };

  const handleLogout = () => {
    localStorage.removeItem('logged_in_user');
    setCurrentUser(null);
    setCurrentView('home');
  };

  // Quick Auto provision demo room helper
  const handleAutoProvisionRoom = () => {
    handleLaunchRoom('space-quiz', 'KOSM', 180);
    setGameCodeInput('KOSM');
    setJoinError('');
  };

  // Fetch logged in student results history
  const getStudentLocalHistory = (): PlayerResult[] => {
    if (!currentUser || currentUser.role !== 'student') return [];
    
    // Fallback: search allResults matching their registration name
    return allResults.filter(
      (r) => 
        r.firstName.toLowerCase() === currentUser.fullName.split(' ')[0]?.toLowerCase() || 
        r.lastName.toLowerCase() === currentUser.fullName.split(' ').slice(1).join(' ')?.toLowerCase()
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FDFBF7] font-sans selection:bg-[#5F7A61]/15 selection:text-[#2D3436] leading-normal text-[#3E3E3E] relative overflow-x-hidden" id="app-root">
      
      {/* BACKGROUND GRAPHIC WATERMARKS - SUBTLE BOTANICAL CONTOURS */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none">
        {/* Fern/willow branch - Top Left */}
        <svg className="absolute top-[6%] -left-12 md:-left-6 w-64 h-64 md:w-96 md:h-96 opacity-12 dark:opacity-[0.06] text-[#5F7A61] dark:text-[#8FB291] transition-opacity duration-300" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M20 180 C 60 140, 110 80, 150 20" strokeDasharray="3,3" />
          <path d="M20 180 C 60 140, 110 80, 150 20" />
          <path d="M50 150 C 35 155, 20 145, 25 130 C 35 132, 45 140, 50 150" />
          <path d="M50 150 C 60 135, 70 130, 75 145 C 65 150, 55 152, 50 150" />
          <path d="M75 120 C 60 122, 45 110, 50 95 C 60 100, 70 110, 75 120" />
          <path d="M75 120 C 85 105, 95 100, 100 115 C 90 120, 80 122, 75 120" />
          <path d="M100 90 C 85 92, 75 80, 80 65 C 90 70, 95 80, 100 90" />
          <path d="M100 90 C 110 75, 120 70, 125 85 C 115 90, 105 92, 100 90" />
          <path d="M125 60 C 110 62, 105 50, 110 35 C 120 40, 122 50, 125 60" />
          <path d="M125 60 C 135 45, 142 40, 148 55 C 138 60, 130 62, 125 60" />
          <path d="M150 20 C 145 10, 135 5, 140 0 C 148 5, 150 12, 150 20" />
        </svg>

        {/* Monstera leaf contour - Middle Right */}
        <svg className="absolute top-[32%] -right-16 md:-right-8 w-72 h-72 md:w-[420px] md:h-[420px] opacity-12 dark:opacity-[0.06] text-[#5F7A61] dark:text-[#8FB291] transition-opacity duration-300" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M180 180 C 140 140, 100 80, 80 20" />
          <path d="M80 20 C 50 30, 30 50, 25 75 C 25 85, 35 95, 45 90 C 55 85, 60 70, 70 70 C 50 85, 40 105, 38 120 C 38 130, 50 135, 60 125 C 70 115, 78 100, 85 98 C 65 115, 55 138, 55 155 C 55 168, 70 172, 80 160 C 90 145, 96 125, 105 120 C 115 125, 120 145, 130 160 C 140 172, 155 168, 155 155 C 155 138, 145 115, 125 98 C 132 100, 140 115, 150 125 C 160 135, 172 130, 172 120 C 170 105, 160 85, 140 70 C 150 70, 155 85, 165 90 C 175 95, 185 85, 185 75 C 180 50, 160 30, 130 20 C 115 15, 95 15, 80 20" />
        </svg>

        {/* Circular Eucalyptus leaves - Bottom Left */}
        <svg className="absolute bottom-[22%] -left-16 md:-left-8 w-64 h-64 md:w-96 md:h-96 opacity-12 dark:opacity-[0.06] text-[#5F7A61] dark:text-[#8FB291] transition-opacity duration-300" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M20 20 C 50 60, 90 110, 120 180" />
          <circle cx="45" cy="50" r="16" />
          <circle cx="65" cy="45" r="14" />
          <circle cx="70" cy="85" r="18" />
          <circle cx="92" cy="78" r="16" />
          <circle cx="95" cy="125" r="20" />
          <circle cx="118" cy="118" r="18" />
        </svg>

        {/* Meadow wild grass - Bottom Right */}
        <svg className="absolute bottom-12 -right-8 w-48 h-48 md:w-80 md:h-80 opacity-10 dark:opacity-[0.05] text-[#5F7A61] dark:text-[#8FB291] transition-opacity duration-300" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
          <path d="M30 200 C 40 120, 60 70, 110 30" />
          <path d="M60 200 C 65 140, 85 90, 135 50" />
          <path d="M90 200 C 90 150, 110 110, 160 80" />
          <path d="M120 200 C 115 160, 125 130, 175 110" />
          <path d="M150 200 C 145 180, 150 160, 190 145" />
          <path d="M20 200 C 35 150, 45 120, 80 90" />
          <path d="M50 200 C 55 170, 60 140, 95 120" />
        </svg>
      </div>
      
      {/* Top Navbar */}
      <Navbar 
        currentUser={currentUser}
        onOpenLogin={() => { setAuthError(''); setAuthSuccess(''); setIsLoginOpen(true); }}
        onOpenRegister={() => { setAuthError(''); setAuthSuccess(''); setIsRegisterOpen(true); }}
        onLogout={handleLogout}
        currentView={currentView}
        setView={setCurrentView}
        theme={theme}
        setTheme={setTheme}
      />

      {/* Main viewport */}
      <main className="flex-grow">
        {/* If Student is currently in an active game session! */}
        {activeStudentRoom ? (
          <StudentQuiz
            room={activeStudentRoom}
            activeQuizzes={quizzes}
            onPlayerJoin={handlePlayerJoinRoom}
            onSaveResult={handleSaveStudentResult}
            onExit={() => {
              // Leave active student screen
              setActiveStudentRoom(null);
            }}
          />
        ) : (
          <AnimatePresence mode="wait">
            {/* VIEW A: Admin/Teacher Panel */}
            {currentView === 'admin' && currentUser?.role === 'admin' && (
              <motion.div
                key="admin-panel"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <AdminPanel
                  quizzes={quizzes}
                  activeRooms={activeRooms}
                  allResults={allResults}
                  onAddNewQuiz={handleAddNewQuiz}
                  onEditQuiz={handleEditQuiz}
                  onDeleteQuiz={handleDeleteQuiz}
                  onLaunchRoom={handleLaunchRoom}
                  onStartRoom={handleStartRoom}
                  onEndRoom={handleEndRoom}
                  onClearResults={handleClearResults}
                />
              </motion.div>
            )}

            {/* VIEW B: Logged Student Personal Score Board */}
            {currentView === 'student-history' && currentUser?.role === 'student' && (
              <motion.div
                key="student-history-panel"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="max-w-4xl mx-auto px-4 py-10"
              >
                <div className="bg-[#F7F3E9] border border-[#E5E0D5] p-6 sm:p-8 rounded-3xl shadow-sm mb-6">
                  <div className="flex items-center gap-3.5 mb-6">
                    <div className="w-12 h-12 bg-[#5F7A61] text-white rounded-2xl flex items-center justify-center shadow-sm">
                      <Table className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold font-serif text-[#2D3436]">Moje Archiwum Wyników</h2>
                      <p className="text-xs text-[#8C9B81] font-medium">Twoje zaliczone podejścia i statystyki oceniania.</p>
                    </div>
                  </div>

                  {getStudentLocalHistory().length === 0 ? (
                    <div className="text-center py-12 bg-[#FDFBF7] border border-[#E5E0D5] rounded-2xl text-[#8C9B81] font-medium text-sm">
                      Nie odnotowano na tym koncie żadnych rezultatów. Wpisz kod gry i wykonaj test na stronie głównej!
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {getStudentLocalHistory().map((item) => (
                        <div key={item.id} className="p-4 sm:p-5 border border-[#E5E0D5] rounded-2xl bg-[#FDFBF7] flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-sm transition-all duration-200">
                          <div>
                            <span className="text-[10px] uppercase font-bold tracking-wider text-[#5F7A61] bg-[#5F7A61]/10 px-2.5 py-1 rounded-full">
                              Kod pokoju: {item.roomCode}
                            </span>
                            <h4 className="text-base font-bold text-[#2D3436] mt-2 font-serif">{item.quizTitle}</h4>
                            <p className="text-[#8C9B81] text-xs mt-0.5">Wykonano: {new Date(item.timestamp).toLocaleDateString()}</p>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-[9px] text-[#8C9B81] uppercase font-bold tracking-wider">Wynik</p>
                              <p className="font-mono font-bold text-[#3E3E3E] text-sm">{item.score} / {item.totalQuestions} pkt</p>
                            </div>
                            <div className="px-4 py-2 bg-[#5F7A61] font-mono text-white text-sm font-bold rounded-xl shadow-sm">
                              {item.percentage}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => setCurrentView('home')}
                    className="mt-6 py-2.5 px-5 border border-[#E5E0D5] text-[#3E3E3E] font-semibold rounded-full text-xs hover:bg-[#EAE4D7] transition-all cursor-pointer bg-white"
                  >
                    Wróć do strony dołączania kodem
                  </button>
                </div>
              </motion.div>
            )}

            {/* VIEW C: Central Join-by-Code screen (Normal / Home screen) */}
            {currentView === 'home' && (
              <motion.div
                key="home-grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-4xl mx-auto px-4 py-8 sm:py-16 flex flex-col items-center"
              >
                {/* Visual Title Header */}
                <div className="text-center mb-8 max-w-lg">
                  <h2 className="text-3xl sm:text-4xl font-bold text-[#2D3436] tracking-tight leading-tight mb-3 font-serif">
                    Weź udział w quizie!
                  </h2>
                  <p className="text-[#8C9B81] text-sm sm:text-base font-medium">
                    Wpisz poniżej kod dołączenia i rozpocznij wyścig z myśleniem.
                  </p>
                </div>

                {/* Main Centered Game Code Prompt Card */}
                <div className="w-full max-w-md bg-[#F7F3E9] border border-[#E5E0D5] p-6 sm:p-9 rounded-3xl shadow-md mb-8 relative">
                  
                  <form onSubmit={handleSearchGameCode} className="space-y-4">
                    <div>
                      <label htmlFor="student-game-code" className="block text-center text-xs font-bold text-[#8C9B81] uppercase tracking-wider mb-3">
                        Wprowadź kod pokoju quizu
                      </label>
                      <input
                        id="student-game-code"
                        type="text"
                        maxLength={10}
                        placeholder="np. KOSM, MAT12"
                        value={gameCodeInput}
                        onChange={(e) => {
                          setGameCodeInput(e.target.value.toUpperCase().replace(/[^a-zA-Z0-9]/g, ''));
                          setJoinError('');
                        }}
                        className="w-full text-center px-4 py-4 bg-[#FDFBF7] hover:bg-white focus:bg-white text-[#2D3436] font-mono font-bold text-2xl tracking-widest border border-[#E5E0D5] focus:border-[#5F7A61] focus:outline-none rounded-2xl uppercase transition-all shadow-inner focus:ring-4 focus:ring-[#5F7A61]/10"
                      />
                    </div>

                    {joinError && (
                      <div className="p-3.5 bg-rose-50 border border-rose-100/60 rounded-2xl flex items-start gap-2.5 text-rose-700 text-xs text-left">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                        <span>{joinError}</span>
                      </div>
                    )}

                    <button
                      id="student-submit-code-btn"
                      type="submit"
                      disabled={!gameCodeInput}
                      className="w-full py-4 bg-[#5F7A61] hover:bg-[#4D634F] disabled:bg-[#E5E0D5] disabled:text-[#8C9B81] disabled:cursor-not-allowed text-white rounded-full font-bold text-base flex items-center justify-center gap-2 hover:shadow-md transition-all active:scale-95 cursor-pointer shadow-sm shadow-[#5F7A61]/10"
                    >
                      <span>Połącz i podaj dane</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                </div>

                {/* Friendly Test Setup Guides */}
                <div className="w-full max-w-md bg-[#F7F3E9]/50 border border-[#E5E0D5] rounded-3xl p-6 text-center">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-[#5F7A61] mb-2 font-serif">Wskazówki do testowania dla nauczycieli</h4>
                  <p className="text-xs text-[#3E3E3E]/85 leading-relaxed mb-4">
                    Aplikacja posiada pełny, synchroniczny panel nauczyciela do odpalania quizów. Aby ułatwić natychmiastowe sprawdzenie działania, kliknij przycisk szybkiego startu:
                  </p>

                  <div className="space-y-3">
                    <button
                      id="admin-quick-kosm-btn"
                      onClick={handleAutoProvisionRoom}
                      className="w-full py-2.5 px-4 bg-[#5F7A61]/10 hover:bg-[#5F7A61]/20 text-[#5F7A61] font-bold text-xs rounded-full flex items-center justify-center gap-1.5 border border-[#5F7A61]/35 active:scale-95 transition-all cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Załóż i wejdź do pokoju: „KOSM”</span>
                    </button>

                    <div className="text-center text-[10px] text-[#8C9B81] font-medium">
                      Lub zaloguj się jako nauczyciel:<br />
                      Login: <strong className="text-[#3E3E3E]">nauczyciel@szkola.pl</strong> • Hasło: <strong className="text-[#3E3E3E]">nauczyciel123</strong>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>
               {/* -------------------------------------------------------------
      {/* -------------------------------------------------------------
          DASHBOARD SIDE-BY-SIDE CLASSROOM SIMULATOR WIDGET (DEVELOPER PREVIEW)
          ------------------------------------------------------------- */}
      {isSimulatorEnabled && !activeStudentRoom && currentUser && (
        <div className="bg-[#2D3436] border-t border-[#3E3E3E] text-[#F7F3E9] py-5 px-6 shadow-md">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8C9B81] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#8C9B81]"></span>
              </span>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2 font-mono">
                  <Server className="w-4 h-4 text-[#8C9B81]" />
                  Symulator czasu rzeczywistego (Rozgrywka szkolna)
                </h4>
                <p className="text-[10px] text-[#E5E0D5] mt-0.5 max-w-xl">
                  Uruchamiaj i kontroluj stan quizów bez logowania. Tutaj wyświetlają się aktywne klasy. Aby przetestować mechanikę wielu urządzeń, otwórz drugą kartę obok!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Quick links to active quizzes */}
              {activeRooms.map((room) => {
                const isWaiting = room.status === 'waiting';
                const isProgress = room.status === 'in_progress';
                const finishedCount = allResults.filter((r) => r.roomCode === room.code).length;

                return (
                  <div key={room.code} className="bg-[#1D2122] border border-[#3E3E3E] rounded-lg p-2.5 flex items-center gap-3 text-xs">
                    <div>
                      <p className="font-mono font-bold text-[#8C9B81]">{room.code}</p>
                      <p className="text-[9px] text-[#E5E0D5] truncate max-w-[110px]">{room.quizTitle}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {isWaiting && (
                        <button
                          onClick={() => handleStartRoom(room.code)}
                          className="bg-[#5F7A61] hover:bg-[#4D634F] text-white font-bold text-[10px] px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                        >
                          START
                        </button>
                      )}
                      {isProgress && (
                        <>
                          <span className="bg-[#5F7A61]/25 text-[#A1B296] font-bold text-[9px] px-2 py-0.5 rounded-full border border-[#5F7A61]/40 animate-pulse">
                            W grze!
                          </span>
                          <button
                            onClick={() => {
                              if (window.confirm(`Czy na pewno chcesz zakończyć quiz dla pokoju ${room.code}?`)) {
                                handleEndRoom(room.code);
                              }
                            }}
                            className="bg-pink-600 hover:bg-pink-700 text-white font-bold text-[10px] px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                          >
                            KONIEC
                          </button>
                        </>
                      )}
                      <span className="text-[9px] text-[#8C9B81] font-mono">
                        ({finishedCount}/{room.joinedPlayers.length} ukończyło)
                      </span>
                    </div>
                  </div>
                );
              })}

              <button
                onClick={() => setIsSimulatorEnabled(false)}
                className="text-[#8C9B81] hover:text-white text-[11px] font-semibold underline ml-2 cursor-pointer"
              >
                Ukryj pasek symulatora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer copyright */}
      <footer className="border-t border-[#E5E0D5] bg-[#F7F3E9] py-6 text-center text-xs text-[#8C9B81] font-medium">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Ctrl+Quiz. Gotowy na systemy mobilne i stacjonarne.</p>
          <div className="flex items-center gap-1.5 text-[10px] text-[#5F7A61] font-bold uppercase tracking-wider bg-[#5F7A61]/10 px-3 py-1 rounded-full">
            <span>Działa z bazą Firestore / SQL w czasie rzeczywistym</span>
          </div>
        </div>
      </footer>

      {/* -------------------------------------------------------------
          MODAL: LOGIN POPUP OVERLAY
          ------------------------------------------------------------- */}
      {isLoginOpen && (
        <div 
          onClick={() => setIsLoginOpen(false)}
          className="fixed inset-0 bg-[#2D3436]/70 backdrop-blur-md flex items-center justify-center p-4 z-50 cursor-pointer"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#FDFBF7] rounded-3xl p-6 sm:p-8 max-w-sm w-full border border-[#E5E0D5] shadow-2xl relative cursor-default"
          >
            <h3 className="text-xl font-bold font-serif text-[#2D3436] mb-2 flex items-center gap-2">
              <LogIn className="w-5 h-5 text-[#5F7A61]" /> Logowanie
            </h3>
            <p className="text-[#8C9B81] text-xs mb-5 font-medium">Zaloguj się na konto nauczyciela lub ucznia.</p>

            {authError && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl text-xs mb-4">
                {authError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#8C9B81] mb-1.5">Adres E-mail</label>
                <input
                  id="login-email"
                  required
                  type="email"
                  placeholder="np. nauczyciel@szkola.pl"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F7F3E9]/80 border border-[#E5E0D5] rounded-xl text-sm text-[#2D3436] focus:outline-none focus:bg-white focus:border-[#5F7A61]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#8C9B81] mb-1.5">Hasło</label>
                <input
                  id="login-password"
                  required
                  type="password"
                  placeholder="np. nauczyciel123"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F7F3E9]/80 border border-[#E5E0D5] rounded-xl text-sm text-[#2D3436] focus:outline-none focus:bg-white focus:border-[#5F7A61]"
                />
              </div>

              <button
                id="login-submit-btn"
                type="submit"
                className="w-full py-3 bg-[#5F7A61] hover:bg-[#4D634F] text-white rounded-full font-bold text-sm transition-all cursor-pointer shadow-sm shadow-[#5F7A61]/10"
              >
                Połącz i zaloguj
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-[#E5E0D5]">
              <span className="block text-center text-[10px] font-bold text-[#8C9B81] uppercase tracking-wider mb-2">Szybkie autouzupełnianie:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthEmail('nauczyciel@szkola.pl');
                    setAuthPassword('nauczyciel123');
                  }}
                  className="p-2 border border-[#5F7A61]/35 hover:bg-[#5F7A61]/5 rounded-xl text-[11px] font-bold text-[#5F7A61] transition-all cursor-pointer text-center active:scale-95"
                >
                  Nauczyciel/Host
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthEmail('uczen@szkola.pl');
                    setAuthPassword('uczen123');
                  }}
                  className="p-2 border border-[#8C9B81]/35 hover:bg-[#8C9B81]/5 rounded-xl text-[11px] font-bold text-slate-700 transition-all cursor-pointer text-center active:scale-95"
                >
                  Uczeń (Logowanie)
                </button>
              </div>
              <p className="text-[10px] text-[#8C9B81] text-center mt-3 leading-relaxed">
                Rejestracja kont jest dostępna wyłącznie dla Nauczyciela. Uczniowie mogą logować się (bez rejestracji samodzielnej) na przypisane im konta, aby śledzić osobiste wyniki historyczne.
              </p>
            </div>

            <button
              id="login-modal-close"
              onClick={() => setIsLoginOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-[#8C9B81] hover:text-[#2D3436] hover:bg-[#F7F3E9] rounded-xl transition-all cursor-pointer"
              title="Zamknij"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MODAL: REGISTER POPUP OVERLAY
          ------------------------------------------------------------- */}
      {isRegisterOpen && (
        <div 
          onClick={() => setIsRegisterOpen(false)}
          className="fixed inset-0 bg-[#2D3436]/70 backdrop-blur-md flex items-center justify-center p-4 z-50 cursor-pointer"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#FDFBF7] rounded-3xl p-5 sm:p-6 max-w-sm w-full border border-[#E5E0D5] shadow-2xl relative cursor-default"
          >
            <h3 className="text-lg font-bold font-serif text-[#2D3436] mb-1 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#5F7A61]" /> Nowe Konto Nauczyciela
            </h3>
            <p className="text-[#8C9B81] text-[11px] mb-3.5 font-medium leading-relaxed font-sans">
              Zarejestruj się, aby organizować bezpiecznie własne lekcje i quizy.
            </p>

            {authError && (
              <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs mb-3">
                {authError}
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-2.5">
              <input type="hidden" name="role" value="admin" />

              <div>
                <label className="block text-[10px] font-black text-[#8C9B81] mb-1 uppercase tracking-wider">Pełne Imię i Nazwisko</label>
                <input
                  id="reg-fullname"
                  required
                  type="text"
                  placeholder="np. Jan Kowalski"
                  value={authFullName}
                  onChange={(e) => setAuthFullName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#F7F3E9]/80 border border-[#E5E0D5] rounded-xl text-xs focus:outline-none focus:bg-white focus:border-[#5F7A61] text-[#2D3436]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-[#8C9B81] mb-1 uppercase tracking-wider">E-mail szkolny</label>
                <input
                  id="reg-email"
                  required
                  type="email"
                  placeholder="np. kowalski@szkola.edu.pl"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#F7F3E9]/80 border border-[#E5E0D5] rounded-xl text-xs focus:outline-none focus:bg-white focus:border-[#5F7A61] text-[#2D3436]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-black text-[#8C9B81] mb-1 uppercase tracking-wider">Hasło</label>
                  <input
                    id="reg-password"
                    required
                    type="password"
                    placeholder="Min. 8 znaków, A-Z, a-z, 0-9"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#F7F3E9]/80 border border-[#E5E0D5] rounded-xl text-xs focus:outline-none focus:bg-white focus:border-[#5F7A61] text-[#2D3436]"
                    title="Min. 8 znaków, w tym małe i duże litery oraz cyfra"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-[#8C9B81] mb-1 uppercase tracking-wider flex items-center gap-0.5">
                    <Key className="w-3 h-3 text-[#5F7A61]" /> Kod Rejestracji
                  </label>
                  <input
                    id="reg-invite-code"
                    required
                    type="text"
                    placeholder="Wpisz kod..."
                    value={authInviteCode}
                    onChange={(e) => setAuthInviteCode(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#F7F3E9]/80 border border-[#E5E0D5] rounded-xl text-xs font-black tracking-wider text-slate-800 uppercase focus:outline-none focus:bg-white focus:border-amber-500 placeholder-slate-400"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-amber-50/75 border border-amber-150 rounded-xl text-[10px] text-amber-950 leading-normal">
                <span className="font-extrabold block mb-0.5">Wymagany klucz zaproszenia. Domyślny kod startowy:</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-200 text-[#2D3436] font-extrabold text-[9px]">KOD-NAUCZYCIELA-2026</span>
                  <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-200 text-[#2D3436] font-extrabold text-[9px]">SZKOLA-MEMO-2026</span>
                </div>
              </div>

              <div className="text-[10px] text-[#8C9B81] leading-tight font-medium">
                * Uczniowie nie potrzebują rejestracji – dołączają kodem gry bezpośrednio od Ciebie.
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="w-1/3 py-2 border border-[#E5E0D5] text-[#8C9B81] hover:text-[#2D3436] hover:bg-[#F7F3E9]/50 rounded-full font-bold text-xs transition-all cursor-pointer text-center"
                >
                  Anuluj
                </button>
                <button
                  id="reg-submit-btn"
                  type="submit"
                  className="w-2/3 py-2.5 bg-[#5F7A61] hover:bg-[#4D634F] text-white rounded-full font-bold text-xs transition-all cursor-pointer shadow-sm shadow-[#5F7A61]/10 text-center"
                >
                  Załóż konto
                </button>
              </div>
            </form>

            <button
              id="reg-modal-close"
              onClick={() => setIsRegisterOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-[#8C9B81] hover:text-[#2D3436] hover:bg-[#F7F3E9] rounded-xl transition-all cursor-pointer"
              title="Zamknij (Wyjdź)"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      )}

    </div>
  );
}
