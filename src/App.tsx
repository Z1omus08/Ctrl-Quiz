import React, { useState, useEffect } from 'react';
import { ActiveRoom, Player, PlayerResult, Quiz, User } from './types';
import { DEFAULT_QUIZZES } from './data';
import { supabase } from './services/supabaseService';
import Navbar from './components/Navbar';
import StudentQuiz from './components/StudentQuiz';
import AdminPanel from './components/AdminPanel';
import { 
  LogIn, UserPlus, Sparkles, GraduationCap, ArrowRight, Table, HelpCircle, 
  Settings, Key, Layers, Server, Play, Heart, Star, CheckCircle, AlertTriangle, X,
  Sun, Moon, Monitor, Trash2, Plus, UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { hashPassword } from './utils/hash';

// Help pre-generate default users
const DEFAULT_TEACHER_USER: User = {
  id: 'teacher-1',
  email: 'nauczyciel@szkola.pl',
  fullName: 'mgr Wojciech Nowak',
  role: 'teacher',
};

const DEFAULT_ADMIN_USER: User = {
  id: 'admin-1',
  email: 'admin',
  fullName: 'admin',
  role: 'admin',
};

export default function App() {
  // 1. Core State
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [activeRooms, setActiveRooms] = useState<ActiveRoom[]>([]);
  const [allResults, setAllResults] = useState<PlayerResult[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // 2. Navigation State
  const [currentView, setCurrentView] = useState<'home' | 'admin' | 'student-history'>(() => {
    try {
      const cached = localStorage.getItem('logged_in_user');
      if (cached) {
        const user = JSON.parse(cached);
        if (user.role === 'admin' || user.role === 'teacher') {
          return 'admin';
        } else if (user.role === 'student') {
          return 'student-history';
        }
      }
    } catch (e) {
      // ignore
    }
    return 'home';
  });
  const [activeStudentRoom, setActiveStudentRoom] = useState<ActiveRoom | null>(null);

  // 3. Form input states for main game page
  const [gameCodeInput, setGameCodeInput] = useState('');
  const [joinError, setJoinError] = useState('');

  // 4. Modal Overlays
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);

  // Profile Settings form states
  const [profileCurrentPassword, setProfileCurrentPassword] = useState('');
  const [profileNewPassword, setProfileNewPassword] = useState('');
  const [profileConfirmPassword, setProfileConfirmPassword] = useState('');
  const [profileFullName, setProfileFullName] = useState('');
  const [profileRegCodes, setProfileRegCodes] = useState<any[]>([]);
  const [profileActiveTab, setProfileActiveTab] = useState<'profile' | 'codes'>('profile');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  // Auth form states
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authInviteCode, setAuthInviteCode] = useState('');
  const [authRole, setAuthRole] = useState<'admin' | 'teacher' | 'student'>('teacher');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // 6. Theme State ('light' | 'dark' | 'system')
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('app_theme') as 'light' | 'dark' | 'system') || 'system';
  });

  // -------------------------------------------------------------
  // INITIALIZATION & SUPABASE SYNCHRONIZATION
  // -------------------------------------------------------------
  const loadQuizzesFromSupabase = async () => {
    try {
      const { data, error } = await supabase.from('quizzes').select('*');
      if (!error && data) {
        const formattedQuizzes: Quiz[] = data.map((q: any) => ({
          id: q.id,
          title: q.title,
          description: q.description,
          defaultDuration: q.default_duration,
          creatorId: q.creator_id,
          questions: q.questions
        }));
        setQuizzes(formattedQuizzes);
        localStorage.setItem('quizzes_catalog', JSON.stringify(formattedQuizzes));
      }
    } catch (err) {
      console.error('Failed to load quizzes:', err);
    }
  };

  const loadResultsFromSupabase = async () => {
    try {
      const { data, error } = await supabase
        .from('player_results')
        .select('*')
        .order('timestamp', { ascending: false });

      if (!error && data) {
        const formattedResults: PlayerResult[] = data.map((res: any) => ({
          id: res.id,
          roomCode: res.room_code,
          firstName: res.first_name,
          lastName: res.last_name,
          className: res.class_name,
          quizTitle: res.quiz_title,
          answers: res.answers,
          score: res.score,
          totalQuestions: res.total_questions,
          percentage: res.percentage,
          timestamp: res.timestamp,
          timeRemaining: res.time_remaining
        }));
        setAllResults(formattedResults);
        localStorage.setItem('player_results', JSON.stringify(formattedResults));
      }
    } catch (err) {
      console.error('Failed to load player results:', err);
    }
  };

  const loadActiveRoomsFromSupabase = async () => {
    try {
      const { data, error } = await supabase.from('active_rooms').select('*');
      if (!error && data) {
        const formattedRooms: ActiveRoom[] = data.map((r: any) => ({
          code: r.code,
          quizId: r.quiz_id,
          quizTitle: r.quiz_title,
          status: r.status,
          startedAt: r.started_at,
          createdAt: r.created_at,
          duration: r.duration,
          joinedPlayers: r.joined_players || []
        }));
        setActiveRooms(formattedRooms);
        localStorage.setItem('active_rooms', JSON.stringify(formattedRooms));

        if (activeStudentRoom) {
          const match = formattedRooms.find((r: ActiveRoom) => r.code === activeStudentRoom.code);
          if (match) {
            setActiveStudentRoom(match);
          } else {
            setActiveStudentRoom(null);
            setJoinError('Pokój został zamknięty lub zakończony przez osobę prowadzącą.');
          }
        }
      }
    } catch (err) {
      console.error('Failed to load active rooms:', err);
    }
  };

  const seedDefaultUsersAndQuizzesToSupabase = async () => {
    try {
      // Seed default admin user: ProgramDoTw0rz3ni4Qu1zow
      const adminPassHash = hashPassword('ProgramDoTw0rz3ni4Qu1zow');
      const { data: adminCheck } = await supabase.from('profiles').select('id').eq('email', 'admin').maybeSingle();
      if (!adminCheck) {
        await supabase.from('profiles').insert({
          id: 'usr-admin',
          email: 'admin',
          full_name: 'admin',
          password_hash: adminPassHash,
          role: 'admin'
        });
      }

      // Seed default teacher user
      const teacherPassHash = hashPassword('nauczyciel123');
      const { data: teacherCheck } = await supabase.from('profiles').select('id').eq('email', 'nauczyciel@szkola.pl').maybeSingle();
      if (!teacherCheck) {
        await supabase.from('profiles').insert({
          id: 'usr-default-teacher',
          email: 'nauczyciel@szkola.pl',
          full_name: 'Tomasz Nauczyciel',
          password_hash: teacherPassHash,
          role: 'teacher'
        });
      }

      // Seed default quizzes if catalog is completely empty in database
      const { data: quizzesCount } = await supabase.from('quizzes').select('id');
      if (!quizzesCount || quizzesCount.length === 0) {
        for (const quiz of DEFAULT_QUIZZES) {
          await supabase.from('quizzes').insert({
            id: quiz.id,
            title: quiz.title,
            description: quiz.description,
            default_duration: quiz.defaultDuration,
            creator_id: quiz.creatorId,
            questions: quiz.questions
          });
        }
        await loadQuizzesFromSupabase();
      }
    } catch (err) {
      console.error('Data seeding to Supabase failed:', err);
    }
  };

  const loadProfileRegCodes = async () => {
    try {
      const { data, error } = await supabase.from('registration_codes').select('*');
      if (!error && data) {
        const mapped = data.map((item: any) => ({
          code: item.code,
          expiresAt: item.expires_at ? new Date(item.expires_at).getTime() : null
        }));
        setProfileRegCodes(mapped);
        localStorage.setItem('teacher_registration_codes', JSON.stringify(mapped));
      }
    } catch (e) {
      console.error('Failed to loading reg codes:', e);
    }
  };

  // Initial Data seed & load
  useEffect(() => {
    const initializeDataFlows = async () => {
      await seedDefaultUsersAndQuizzesToSupabase();
      await loadQuizzesFromSupabase();
      await loadResultsFromSupabase();
      await loadActiveRoomsFromSupabase();
    };

    initializeDataFlows();

    // Check localStorage logged in session of browser fallback
    const cachedUser = localStorage.getItem('logged_in_user');
    if (cachedUser) {
      try {
        setCurrentUser(JSON.parse(cachedUser));
      } catch (e) {
        // ignore
      }
    }
  }, []);

  // Poll Active Rooms for state changes or players joining from other browser contexts
  useEffect(() => {
    loadActiveRoomsFromSupabase();
    const interval = setInterval(() => {
      loadActiveRoomsFromSupabase();
    }, 2500);
    return () => clearInterval(interval);
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

  // Tick every second to refresh registration codes from Supabase
  useEffect(() => {
    let timer: any;
    if (isProfileSettingsOpen && profileActiveTab === 'codes') {
      loadProfileRegCodes();
      timer = setInterval(() => {
        loadProfileRegCodes();
      }, 3000);
    }
    return () => clearInterval(timer);
  }, [isProfileSettingsOpen, profileActiveTab]);

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
  const handleAddNewQuiz = async (newQuiz: Quiz) => {
    try {
      const { error } = await supabase.from('quizzes').insert({
        id: newQuiz.id,
        title: newQuiz.title,
        description: newQuiz.description,
        default_duration: newQuiz.defaultDuration,
        creator_id: newQuiz.creatorId,
        questions: newQuiz.questions
      });
      if (!error) {
        setQuizzes((prev) => [...prev, newQuiz]);
      } else {
        alert(`Błąd podczas dodawania quizu: ${error.message}`);
      }
    } catch (e: any) {
      alert(`Błąd połączenia z bazą: ${e.message}`);
    }
  };

  const handleEditQuiz = async (editedQuiz: Quiz) => {
    try {
      const { error } = await supabase
        .from('quizzes')
        .update({
          title: editedQuiz.title,
          description: editedQuiz.description,
          default_duration: editedQuiz.defaultDuration,
          questions: editedQuiz.questions
        })
        .eq('id', editedQuiz.id);
      if (!error) {
        setQuizzes((prev) => prev.map((q) => (q.id === editedQuiz.id ? editedQuiz : q)));
      } else {
        alert(`Błąd edycji quizu: ${error.message}`);
      }
    } catch (e: any) {
      alert(`Błąd połączenia z bazą: ${e.message}`);
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    try {
      const { error } = await supabase.from('quizzes').delete().eq('id', quizId);
      if (!error) {
        setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
      } else {
        alert(`Błąd usuwania quizu: ${error.message}`);
      }
    } catch (e: any) {
      alert(`Błąd połączenia z bazą: ${e.message}`);
    }
  };

  const handleLaunchRoom = async (quizId: string, customCode: string, durationSecs: number) => {
    const quiz = quizzes.find((q) => q.id === quizId);
    if (!quiz) return;

    // Sprawdź czy kod jest wolny bezpośrednio w Supabase
    const { data: activeMatch } = await supabase
      .from('active_rooms')
      .select('code')
      .eq('code', customCode)
      .maybeSingle();

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

    try {
      const { error } = await supabase.from('active_rooms').insert({
        code: newRoom.code,
        quiz_id: newRoom.quizId,
        quiz_title: newRoom.quizTitle,
        status: newRoom.status,
        started_at: newRoom.startedAt,
        created_at: newRoom.createdAt,
        duration: newRoom.duration,
        joined_players: newRoom.joinedPlayers
      });

      if (!error) {
        setActiveRooms((prev) => [newRoom, ...prev.filter((r) => r.code !== customCode)]);
      } else {
        alert(`Błąd dodawania pokoju: ${error.message}`);
      }
    } catch (e: any) {
      alert(`Błąd połączenia z bazą: ${e.message}`);
    }
  };

  const handleStartRoom = async (code: string) => {
    const startTime = Date.now();
    try {
      const { error } = await supabase
        .from('active_rooms')
        .update({ status: 'in_progress', started_at: startTime })
        .eq('code', code);

      if (!error) {
        setActiveRooms((prev) =>
          prev.map((room) => {
            if (room.code === code) {
              return {
                ...room,
                status: 'in_progress' as const,
                startedAt: startTime,
              };
            }
            return room;
          })
        );

        if (activeStudentRoom && activeStudentRoom.code === code) {
          setActiveStudentRoom((prev) =>
            prev ? { ...prev, status: 'in_progress', startedAt: startTime } : null
          );
        }
      } else {
        alert(`Błąd uruchamiania pokoju: ${error.message}`);
      }
    } catch (e: any) {
      alert(`Błąd uruchamiania pokoju: ${e.message}`);
    }
  };

  const handleEndRoom = async (code: string) => {
    try {
      const { error } = await supabase.from('active_rooms').delete().eq('code', code);
      if (!error) {
        setActiveRooms((prev) => prev.filter((room) => room.code !== code));
        if (activeStudentRoom && activeStudentRoom.code === code) {
          setActiveStudentRoom(null);
        }
      } else {
        alert(`Błąd zamykania pokoju: ${error.message}`);
      }
    } catch (e: any) {
      alert(`Błąd połączenia z bazą: ${e.message}`);
    }
  };

  const handleClearResults = async () => {
    try {
      const { error } = await supabase.from('player_results').delete().neq('id', 'placeholder-id');
      if (!error) {
        setAllResults([]);
      } else {
        alert(`Błąd czyszczenia wyników: ${error.message}`);
      }
    } catch (e: any) {
      alert(`Błąd połączenia z bazą: ${e.message}`);
    }
  };

  // -------------------------------------------------------------
  // HANDLERS FOR STUDENT ACTIONS
  // -------------------------------------------------------------
  const handleSearchGameCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');

    const query = gameCodeInput.trim().toUpperCase();
    if (!query) return;

    try {
      const { data, error } = await supabase
        .from('active_rooms')
        .select('*')
        .eq('code', query)
        .maybeSingle();

      if (error || !data) {
        setJoinError('Nie znaleziono aktywnego pokoju. Poproś prowadzącego o prawidłowy kod gry.');
        return;
      }

      const matchingRoom: ActiveRoom = {
        code: data.code,
        quizId: data.quiz_id,
        quizTitle: data.quiz_title,
        status: data.status,
        startedAt: data.started_at,
        createdAt: data.created_at,
        duration: data.duration,
        joinedPlayers: data.joined_players || []
      };

      setActiveStudentRoom(matchingRoom);
    } catch (e: any) {
      setJoinError('Błąd połączenia z bazą.');
    }
  };

  const handlePlayerJoinRoom = async (player: Player) => {
    if (!activeStudentRoom) return;

    try {
      const existingId = activeStudentRoom.joinedPlayers.some((p) => p.id === player.id);
      const updatedPlayers = existingId
        ? activeStudentRoom.joinedPlayers.map((p) => (p.id === player.id ? player : p))
        : [...activeStudentRoom.joinedPlayers, player];

      const { error } = await supabase
        .from('active_rooms')
        .update({ joined_players: updatedPlayers })
        .eq('code', activeStudentRoom.code);

      if (!error) {
        setActiveRooms((prev) =>
          prev.map((room) => {
            if (room.code === activeStudentRoom.code) {
              return { ...room, joinedPlayers: updatedPlayers };
            }
            return room;
          })
        );
        setActiveStudentRoom((prev) => (prev ? { ...prev, joinedPlayers: updatedPlayers } : null));
      } else {
        alert(`Błąd dołączania do pokoju: ${error.message}`);
      }
    } catch (e: any) {
      alert(`Błąd połączenia z bazą: ${e.message}`);
    }
  };

  const handleSaveStudentResult = async (result: PlayerResult) => {
    try {
      const { error } = await supabase.from('player_results').insert({
        id: result.id,
        room_code: result.roomCode,
        first_name: result.firstName,
        last_name: result.lastName,
        class_name: result.className,
        quiz_title: result.quizTitle,
        answers: result.answers,
        score: result.score,
        total_questions: result.totalQuestions,
        percentage: result.percentage,
        timestamp: result.timestamp,
        time_remaining: result.timeRemaining
      });

      if (!error) {
        setAllResults((prev) => [result, ...prev]);
        if (currentUser && currentUser.role === 'student') {
          const personalHistory = JSON.parse(
            localStorage.getItem(`student_history_${currentUser.id}`) || '[]'
          );
          personalHistory.unshift(result);
          localStorage.setItem(`student_history_${currentUser.id}`, JSON.stringify(personalHistory));
        }
      } else {
        alert(`Błąd zapisu wyniku: ${error.message}`);
      }
    } catch (e: any) {
      alert(`Błąd połączenia: ${e.message}`);
    }
  };

  // -------------------------------------------------------------
  // AUTHENTICATION LOGIC
  // -------------------------------------------------------------
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    const hashedPass = hashPassword(authPassword);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', authEmail.trim())
        .eq('password_hash', hashedPass)
        .maybeSingle();

      if (error || !data) {
        setAuthError('Nieprawidłowy adres e-mail lub hasło.');
        return;
      }

      const payload: User = {
        id: data.id,
        email: data.email,
        fullName: data.full_name,
        role: data.role,
      };

      setCurrentUser(payload);
      localStorage.setItem('logged_in_user', JSON.stringify(payload));
      setIsLoginOpen(false);
      setAuthEmail('');
      setAuthPassword('');

      // If logged in as admin or teacher, route to panel automatically
      if (payload.role === 'admin' || payload.role === 'teacher') {
        setCurrentView('admin');
      } else {
        setCurrentView('student-history');
      }
    } catch (err: any) {
      setAuthError(`Błąd połączenia z bazą: ${err.message}`);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
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

    try {
      // Sprawdź kod rejestracji w Supabase
      const { data: matchedCode, error: codeErr } = await supabase
        .from('registration_codes')
        .select('*')
        .eq('code', verificationCode)
        .maybeSingle();

      if (codeErr || !matchedCode) {
        setAuthError('Podany kod rejestracji nauczyciela jest niepoprawny, został już zużyty lub wygasł.');
        return;
      }

      if (matchedCode.expires_at && new Date(matchedCode.expires_at).getTime() < Date.now()) {
        setAuthError('Podany kod rejestracji nauczyciela wygasł.');
        return;
      }

      // Sprawdź czy e-mail już istnieje
      const { data: emailMatch } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', authEmail.trim())
        .maybeSingle();

      if (emailMatch) {
        setAuthError('Konto o podanym adresie email już istnieje.');
        return;
      }

      const hashedPassword = hashPassword(authPassword);
      const newUserId = `usr-${Date.now()}`;

      // Utwórz nowy profil
      const { error: insertErr } = await supabase.from('profiles').insert({
        id: newUserId,
        email: authEmail.trim(),
        full_name: authFullName.trim(),
        password_hash: hashedPassword,
        role: 'teacher'
      });

      if (insertErr) {
        setAuthError(`Nie udało się utworzyć konta: ${insertErr.message}`);
        return;
      }

      // Usuń zużyty kod z Supabase
      await supabase.from('registration_codes').delete().eq('code', verificationCode);

      setAuthSuccess('Konto Nauczyciela zostało zarejestrowane pomyślnie przy użyciu kodu.');

      const userSession: User = {
        id: newUserId,
        email: authEmail.trim(),
        fullName: authFullName.trim(),
        role: 'teacher',
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
    } catch (err: any) {
      setAuthError(`Wystąpił błąd podczas rejestracji: ${err.message}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('logged_in_user');
    setCurrentUser(null);
    setCurrentView('home');
  };

  const handleProfileSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    if (!currentUser) return;

    const name = profileFullName.trim();
    if (!name) {
      setProfileError('Nazwa użytkownika nie może być pusta.');
      return;
    }

    try {
      // Pobierz bieżący rekord użytkownika z Supabase do walidacji hasła
      const { data: userProfile, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (fetchErr || !userProfile) {
        setProfileError('Nie znaleziono Twojego konta w bazie.');
        return;
      }

      let newHashedPassword = userProfile.password_hash;
      let isPasswordChanged = false;

      if (profileCurrentPassword || profileNewPassword || profileConfirmPassword) {
        if (!profileCurrentPassword || !profileNewPassword || !profileConfirmPassword) {
          setProfileError('Aby zmienić hasło, musisz podać obecne hasło, nowe hasło oraz je potwierdzić.');
          return;
        }

        if (profileNewPassword !== profileConfirmPassword) {
          setProfileError('Nowe hasła nie są ze sobą zgodne.');
          return;
        }

        // Walidacja nowego hasła: min 8 znaków, małe, duże litery, cyfra
        const isLengthValid = profileNewPassword.length >= 8;
        const hasUppercase = /[A-Z]/.test(profileNewPassword);
        const hasLowercase = /[a-z]/.test(profileNewPassword);
        const hasDigit = /[0-9]/.test(profileNewPassword);

        if (!isLengthValid || !hasUppercase || !hasLowercase || !hasDigit) {
          setProfileError('Nowe hasło musi mieć co najmniej 8 znaków, składać się z małych i dużych liter oraz zawierać cyfrę.');
          return;
        }

        const currentHashed = hashPassword(profileCurrentPassword);
        if (userProfile.password_hash !== currentHashed) {
          setProfileError('Obecne hasło jest niepoprawne.');
          return;
        }

        newHashedPassword = hashPassword(profileNewPassword);
        isPasswordChanged = true;
      }

      // Aktualizacja profilu w Supabase
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ full_name: name, password_hash: newHashedPassword })
        .eq('id', currentUser.id);

      if (updateErr) {
        setProfileError(`Błąd aktualizacji profilu: ${updateErr.message}`);
        return;
      }

      // Update active session metadata
      const updatedSession = {
        ...currentUser,
        fullName: name,
      };
      setCurrentUser(updatedSession);
      localStorage.setItem('logged_in_user', JSON.stringify(updatedSession));

      setProfileSuccess(
        isPasswordChanged
          ? 'Profil oraz hasło zostały zaktualizowane pomyślnie!'
          : 'Profil został zaktualizowany pomyślnie!'
      );

      // Clear password fields
      setProfileCurrentPassword('');
      setProfileNewPassword('');
      setProfileConfirmPassword('');
    } catch (err: any) {
      setProfileError(`Błąd połączenia z bazą: ${err.message}`);
    }

    setTimeout(() => {
      setIsProfileSettingsOpen(false);
      setProfileSuccess('');
    }, 1500);
  };

  const handleGenerateProfileRegCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'NAUCZYCIEL-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const currentList: any[] = JSON.parse(localStorage.getItem('teacher_registration_codes') || '[]');
    const now = Date.now();
    
    // Clean up expired ones on the fly
    const activeAndNotExpired = currentList.filter((item: any) => {
      if (typeof item === 'string') return true; // fallback
      return item.expiresAt > now;
    });

    if (!activeAndNotExpired.some((item: any) => (typeof item === 'string' ? item : item.code) === code)) {
      const newCodeObj = {
        code,
        expiresAt: now + 10 * 60 * 1000, // 10 minutes from now
      };
      const updated = [newCodeObj, ...activeAndNotExpired];
      localStorage.setItem('teacher_registration_codes', JSON.stringify(updated));
      setProfileRegCodes(updated);
    }
  };

  const handleDeleteProfileRegCode = (code: string) => {
    const currentList: any[] = JSON.parse(localStorage.getItem('teacher_registration_codes') || '[]');
    const updated = currentList.filter((c: any) => {
      const codeStr = typeof c === 'string' ? c : c.code;
      return codeStr !== code;
    });
    localStorage.setItem('teacher_registration_codes', JSON.stringify(updated));
    setProfileRegCodes(updated);
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
        onOpenProfileSettings={() => {
          setProfileError('');
          setProfileSuccess('');
          setProfileCurrentPassword('');
          setProfileNewPassword('');
          setProfileConfirmPassword('');
          setProfileFullName(currentUser?.fullName || '');
          setProfileActiveTab('profile');
          const rawCodes = localStorage.getItem('teacher_registration_codes');
          let parsed: any[] = [];
          try {
            parsed = JSON.parse(rawCodes || '[]');
          } catch (e) {}
          const now = Date.now();
          const converted = parsed.map((item: any) => {
            if (typeof item === 'string') {
              return { code: item, expiresAt: now + 10 * 60 * 1000 };
            }
            return item;
          });
          const activeCodes = converted.filter((c: any) => c && c.expiresAt > now);
          localStorage.setItem('teacher_registration_codes', JSON.stringify(activeCodes));
          setProfileRegCodes(activeCodes);
          setIsProfileSettingsOpen(true);
        }}
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
            {currentView === 'admin' && currentUser && (currentUser.role === 'admin' || currentUser.role === 'teacher') && (
              <motion.div
                key="admin-panel"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <AdminPanel
                  currentUser={currentUser}
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


              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>
         

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
                <label className="block text-xs font-bold text-[#8C9B81] mb-1.5">Nazwa użytkownika lub E-mail</label>
                <input
                  id="login-email"
                  required
                  type="text"
                  placeholder="np. supernauczyciel@szkola.pl"
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
                  placeholder="np. LubieUczyc12"
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
              <p className="text-[10px] text-[#8C9B81] text-center leading-relaxed">
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
              <input type="hidden" name="role" value="teacher" />

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

      {/* -------------------------------------------------------------
          MODAL: PROFILE SETTINGS POPUP OVERLAY
          ------------------------------------------------------------- */}
      {isProfileSettingsOpen && currentUser && (
        <div 
          onClick={() => {
            setIsProfileSettingsOpen(false);
            setProfileCurrentPassword('');
            setProfileNewPassword('');
            setProfileConfirmPassword('');
            setProfileError('');
            setProfileSuccess('');
          }}
          className="fixed inset-0 bg-[#2D3436]/70 backdrop-blur-md flex items-center justify-center p-4 z-50 cursor-pointer"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#FDFBF7] rounded-3xl p-6 sm:p-7 max-w-md w-full border border-[#E5E0D5] shadow-2xl relative cursor-default max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-xl font-bold font-serif text-[#2D3436] mb-1 flex items-center gap-2">
              <Settings className="w-5 h-5 text-[#5F7A61]" /> Profil i Ustawienia
            </h3>
            <p className="text-[#8C9B81] text-xs mb-4 font-medium">
              Zarządzaj swoimi preferencjami, hasełkami i kodami dostępu.
            </p>

            {/* If user is admin or teacher, allow switching sub-tabs in settings */}
            {(currentUser.role === 'admin' || currentUser.role === 'teacher') && (
              <div className="flex border-b border-[#E5E0D5] mb-5">
                <button
                  type="button"
                  onClick={() => setProfileActiveTab('profile')}
                  className={`flex-1 pb-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    profileActiveTab === 'profile'
                      ? 'border-[#5F7A61] text-[#2D3436]'
                      : 'border-transparent text-[#8C9B81] hover:text-[#2D3436]'
                  }`}
                >
                  Mój Profil & Motyw
                </button>
                <button
                  type="button"
                  onClick={() => setProfileActiveTab('codes')}
                  className={`flex-1 pb-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    profileActiveTab === 'codes'
                      ? 'border-[#5F7A61] text-[#2D3436]'
                      : 'border-transparent text-[#8C9B81] hover:text-[#2D3436]'
                  }`}
                >
                  Kody Rejestracji
                </button>
              </div>
            )}

            {profileError && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl text-xs mb-4 font-semibold">
                {profileError}
              </div>
            )}

            {profileSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl text-xs mb-4 font-semibold">
                {profileSuccess}
              </div>
            )}

            {/* TAB 1: PROFILE EDIT */}
            {profileActiveTab === 'profile' && (
              <form onSubmit={handleProfileSettingsSubmit} className="space-y-4">
                {/* Informacje o profilu */}
                <div className="bg-[#F7F3E9] p-3.5 rounded-2xl text-xs">
                  <div className="text-[#8C9B81] font-bold uppercase tracking-wider text-[10px]">Zalogowany jako</div>
                  <div className="text-[#2D3436] font-bold mt-1 text-sm">{currentUser.fullName}</div>
                  <div className="text-[#8C9B81] font-medium font-mono text-[11px] mt-0.5">{currentUser.email}</div>
                  <div className="mt-2 text-[10px] font-bold text-[#5F7A61] uppercase tracking-wider inline-block bg-[#5F7A61]/10 px-2.5 py-1 rounded-full">
                    Rola: {currentUser.role === 'admin' ? 'Administrator' : currentUser.role === 'teacher' ? 'Nauczyciel' : 'Uczeń'}
                  </div>
                </div>

                {/* Zmiana nazwy */}
                <div>
                  <label className="block text-[11px] font-bold text-[#8C9B81] mb-1">Nazwa użytkownika (Imię i Nazwisko)</label>
                  <input
                    required
                    type="text"
                    placeholder="Wpisz imię i nazwisko"
                    value={profileFullName}
                    onChange={(e) => setProfileFullName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F3E9]/80 border border-[#E5E0D5] rounded-xl text-xs sm:text-sm text-[#2D3436] focus:outline-none focus:bg-white focus:border-[#5F7A61] font-medium"
                  />
                </div>

                {/* Zmiana hasła (opcjonalnie) */}
                <div className="border-t border-[#E5E0D5]/60 pt-3">
                  <h4 className="text-[11px] font-extrabold text-[#2D3436]/80 uppercase tracking-widest mb-2.5">Zmień hasło (opcjonalnie)</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[#8C9B81] mb-1">Obecne hasło</label>
                      <input
                        type="password"
                        placeholder="Wpisz dotychczasowe hasło"
                        value={profileCurrentPassword}
                        onChange={(e) => setProfileCurrentPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-[#F7F3E9]/80 border border-[#E5E0D5] rounded-xl text-xs sm:text-sm text-[#2D3436] focus:outline-none focus:bg-white focus:border-[#5F7A61]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#8C9B81] mb-1">Nowe hasło</label>
                      <input
                        type="password"
                        placeholder="Min. 8 znaków, A-Z, a-z, 0-9"
                        value={profileNewPassword}
                        onChange={(e) => setProfileNewPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-[#F7F3E9]/80 border border-[#E5E0D5] rounded-xl text-xs sm:text-sm text-[#2D3436] focus:outline-none focus:bg-white focus:border-[#5F7A61]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#8C9B81] mb-1">Potwierdź nowe hasło</label>
                      <input
                        type="password"
                        placeholder="Wpisz nowe hasło ponownie"
                        value={profileConfirmPassword}
                        onChange={(e) => setProfileConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-[#F7F3E9]/80 border border-[#E5E0D5] rounded-xl text-xs sm:text-sm text-[#2D3436] focus:outline-none focus:bg-white focus:border-[#5F7A61]"
                      />
                    </div>
                  </div>
                </div>

                {/* Zmiana motywu */}
                <div className="border-t border-[#E5E0D5]/60 pt-3">
                  <label className="block text-[11px] font-bold text-[#8C9B81] dark:!text-slate-400 mb-1.5 uppercase tracking-wider">Preferowany Motyw</label>
                  <div className="grid grid-cols-2 gap-1 bg-[#F7F3E9]/70 rounded-xl p-1 border border-[#E5E0D5]">
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        theme === 'light'
                          ? 'bg-[#5F7A61] text-white shadow-xs font-black'
                          : 'text-[#8C9B81] dark:!text-slate-500 hover:text-[#2D3436]'
                      }`}
                    >
                      <Sun className="w-3 h-3" />
                      <span>Jasny</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        theme === 'dark'
                          ? 'bg-[#5F7A61] text-white shadow-xs font-black'
                          : 'text-[#8C9B81] dark:!text-slate-500 hover:text-[#2D3436]'
                      }`}
                    >
                      <Moon className="w-3 h-3" />
                      <span>Ciemny</span>
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:!text-slate-400 block mt-1.5 leading-relaxed">
                    Domyślnie aplikacja dopasowuje się automatycznie do motywu Twojego systemu operacyjnego.
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2.5 pt-2 border-t border-[#E5E0D5]/60">
                  <button
                    type="button"
                    onClick={() => setIsProfileSettingsOpen(false)}
                    className="w-1/3 py-2.5 border border-[#E5E0D5] text-[#8C9B81] hover:text-[#2D3436] hover:bg-[#F7F3E9] rounded-full font-bold text-xs transition-all cursor-pointer text-center"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    className="w-2/3 py-2.5 bg-[#5F7A61] hover:bg-[#4D634F] text-white rounded-full font-bold text-xs transition-all cursor-pointer shadow-sm shadow-[#5F7A61]/10 text-center"
                  >
                    Zapisz zmiany
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: KEY GENERATION */}
            {profileActiveTab === 'codes' && (currentUser.role === 'admin' || currentUser.role === 'teacher') && (
              <div className="space-y-4">
                <div className="bg-[#F7F3E9] p-3 border border-[#E5E0D5] rounded-2xl">
                  <h4 className="text-xs font-extrabold text-[#2D3436] flex items-center gap-1.5 uppercase tracking-wider">
                    <UserCheck className="w-4 h-4 text-[#5F7A61]" /> Klucze dla Nauczycieli
                  </h4>
                  <p className="text-[#8C9B81] text-[11px] font-medium mt-1 leading-relaxed">
                    Każdy wygenerowany kod umożliwia jednorazową i bezpieczną rejestrację nowego konta nauczycielskiego w systemie.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateProfileRegCode}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-[0.98]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Wygeneruj nowy kod</span>
                </button>

                <div className="max-h-56 overflow-y-auto pr-1 space-y-2">
                  {profileRegCodes.length === 0 ? (
                    <div className="border border-dashed border-[#E5E0D5] p-6 rounded-2xl text-center text-[#8C9B81] text-xs font-semibold bg-[#F7F3E9]/25 italic">
                      Brak aktywnych kodów rejestracji. Kliknij przycisk powyżej, by wygenerować unikalny klucz zaproszenia.
                    </div>
                  ) : (
                    profileRegCodes.map((item) => {
                      const codeStr = typeof item === 'string' ? item : item.code;
                      const expiresAt = typeof item === 'string' ? null : item.expiresAt;
                      
                      let timeLeftStr = 'Bezterminowy';
                      if (expiresAt) {
                        const timeLeft = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
                        const m = Math.floor(timeLeft / 60);
                        const s = timeLeft % 60;
                        timeLeftStr = timeLeft > 0 ? `Wygasa za: ${m}m ${s}s` : 'Wygasł';
                      }

                      return (
                        <div key={codeStr} className="flex items-center justify-between p-2.5 bg-[#F7F3E9]/50 border border-[#E5E0D5] rounded-xl hover:shadow-2xs transition-all">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-black font-mono text-[#2D3436] tracking-wider bg-white px-2 py-0.5 rounded border border-[#E5E0D5] shadow-3xs self-start">{codeStr}</span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {timeLeftStr}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteProfileRegCode(codeStr)}
                            className="p-1 px-1.5 hover:bg-rose-50 text-rose-500 rounded-lg transition-all cursor-pointer"
                            title="Usuń ten kod"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex pt-3 border-t border-[#E5E0D5]/60 justify-end">
                  <button
                    type="button"
                    onClick={() => setIsProfileSettingsOpen(false)}
                    className="py-2.5 px-6 bg-[#5F7A61] hover:bg-[#4D634F] text-white rounded-full font-bold text-xs transition-all cursor-pointer shadow-sm text-center"
                  >
                    Gotowe
                  </button>
                </div>
              </div>
            )}

            <button
              id="profile-modal-close"
              onClick={() => {
                setIsProfileSettingsOpen(false);
                setProfileCurrentPassword('');
                setProfileNewPassword('');
                setProfileConfirmPassword('');
                setProfileError('');
                setProfileSuccess('');
              }}
              className="absolute top-4 right-4 p-1.5 text-[#8C9B81] hover:text-[#2D3436] hover:bg-[#F7F3E9] rounded-xl transition-all cursor-pointer"
              title="Zamknij"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      )}

    </div>
  );
}
