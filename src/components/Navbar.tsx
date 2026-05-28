import React from 'react';
import { User } from '../types';
import { GraduationCap, LogIn, LogOut, UserPlus, Home, ClipboardList, Settings } from 'lucide-react';
import { motion } from 'motion/react';

interface NavbarProps {
  currentUser: User | null;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onLogout: () => void;
  currentView: 'home' | 'admin' | 'student-history';
  setView: (view: 'home' | 'admin' | 'student-history') => void;
  onOpenProfileSettings: () => void;
}

export default function Navbar({
  currentUser,
  onOpenLogin,
  onOpenRegister,
  onLogout,
  currentView,
  setView,
  onOpenProfileSettings,
}: NavbarProps) {
  return (
    <header className="border-b border-[#E5E0D5] bg-[#FDFBF7]/90 backdrop-blur-md sticky top-0 z-40">
      <div id="navbar-container" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div 
          id="nav-logo" 
          onClick={() => (currentUser?.role === 'admin' || currentUser?.role === 'teacher') ? setView('admin') : setView('home')} 
          className="flex items-center gap-2.5 cursor-pointer group active:scale-95 transition-all duration-250"
        >
          <div className="w-10 h-10 rounded-xl bg-[#5F7A61] flex items-center justify-center text-white shadow-md shadow-[#5F7A61]/10 group-hover:bg-[#4D634F] transition-colors">
            <GraduationCap className="w-5.5 h-5.5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-[#2D3436] font-serif">Ctrl+Quiz</h1>
            <p className="text-[10px] sm:text-xs text-[#8C9B81] font-medium block leading-none mt-0.5">wiedza na farcie</p>
          </div>
        </div>

        <div id="nav-actions" className="flex items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-3">
              {currentUser.role === 'student' && (
                <button
                  id="nav-student-history"
                  onClick={() => setView(currentView === 'student-history' ? 'home' : 'student-history')}
                  className={`hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                    currentView === 'student-history'
                      ? 'bg-[#5F7A61]/10 text-[#5F7A61] border border-[#5F7A61]/25'
                      : 'text-[#3E3E3E] hover:bg-[#F7F3E9]'
                  }`}
                >
                  <ClipboardList className="w-4 h-4" />
                  {currentView === 'student-history' ? 'Strona główna' : 'Moje Wyniki'}
                </button>
              )}

              <div className="flex flex-col items-end text-right hidden md:block">
                <span className="text-sm font-semibold text-[#2D3436]">{currentUser.fullName}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#5F7A61] bg-[#5F7A61]/10 px-2 py-0.5 rounded-full">
                  {currentUser.role === 'admin' ? 'Administrator' : currentUser.role === 'teacher' ? 'Nauczyciel' : 'Uczeń'}
                </span>
              </div>

              <button
                id="nav-settings-btn"
                onClick={onOpenProfileSettings}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold text-[#3E3E3E] hover:bg-[#F7F3E9] border border-[#E5E0D5] transition-all cursor-pointer"
                title="Dostęp do ustawień profilu i zmiana hasła"
              >
                <Settings className="w-4 h-4 text-[#8C9B81]" />
                <span className="hidden sm:inline">Ustawienia</span>
              </button>

              <button
                id="nav-logout-btn"
                onClick={onLogout}
                className="flex items-center gap-1 px-4 py-2 rounded-full text-sm font-medium text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all cursor-pointer"
                title="Wyloguj się"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Wyloguj</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                id="nav-login-btn"
                onClick={onOpenLogin}
                className="flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold text-[#3E3E3E] hover:bg-[#F7F3E9] transition-all cursor-pointer border border-[#E5E0D5]"
              >
                <LogIn className="w-4 h-4 text-[#8C9B81]" />
                <span>Zaloguj</span>
              </button>
              <button
                id="nav-register-btn"
                onClick={onOpenRegister}
                className="flex items-center gap-1.5 px-5 py-2 bg-[#5F7A61] hover:bg-[#4D634F] text-white rounded-full text-sm font-semibold shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-95"
              >
                <UserPlus className="w-4 h-4" />
                <span>Rejestracja</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {currentUser && currentUser.role === 'student' && (
        <div className="sm:hidden flex border-t border-[#E5E0D5] bg-[#F7F3E9]/50 px-4 py-2 justify-around gap-2 text-xs font-semibold">
          <button
            id="nav-mobile-home"
            onClick={() => setView('home')}
            className={`flex items-center gap-1 py-1 px-3.5 rounded-full ${
              currentView === 'home' ? 'bg-[#5F7A61] text-white shadow-sm' : 'text-[#3E3E3E]'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Dołącz</span>
          </button>
          <button
            id="nav-mobile-student"
            onClick={() => setView('student-history')}
            className={`flex items-center gap-1 py-1 px-3.5 rounded-full ${
              currentView === 'student-history' ? 'bg-[#5F7A61] text-white shadow-sm' : 'text-[#3E3E3E]'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Moje Wyniki</span>
          </button>
        </div>
      )}
    </header>
  );
}