import { createClient } from '@supabase/supabase-js';
import { Quiz, ActiveRoom, PlayerResult } from '../types';

// TUTAJ ZMIEŃ DANE NA SWOJE Z PANELU SUPABASE
const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL || 'TWOJ_URL_Z_PROJEKTU';
const SUPABASE_ANON_KEY = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'TWOJ_KLUCZ_ANON_Z_PROJEKTU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const supabaseService = {
  // --- Quizy ---
  getQuizzes: async () => await supabase.from('quizzes').select('*'),
  
  addQuiz: async (quiz: Quiz) => await supabase.from('quizzes').insert({
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    default_duration: quiz.defaultDuration,
    creator_id: quiz.creatorId,
    questions: quiz.questions
  }),

  updateQuiz: async (quiz: Quiz) => await supabase
    .from('quizzes')
    .update({
      title: quiz.title,
      description: quiz.description,
      default_duration: quiz.defaultDuration,
      questions: quiz.questions
    })
    .eq('id', quiz.id),

  deleteQuiz: async (quizId: string) => await supabase.from('quizzes').delete().eq('id', quizId),

  // --- Sesje Live ---
  createRoom: async (room: ActiveRoom) => await supabase.from('active_rooms').insert({
    code: room.code,
    quiz_id: room.quizId,
    quiz_title: room.quizTitle,
    status: room.status,
    started_at: room.startedAt,
    created_at: room.createdAt,
    duration: room.duration,
    joined_players: room.joinedPlayers
  }),

  updateRoomStatus: async (code: string, status: string, startTime?: number) => await supabase
    .from('active_rooms')
    .update({ status, started_at: startTime })
    .eq('code', code),

  updatePlayers: async (code: string, updatedPlayers: any[]) => await supabase
    .from('active_rooms')
    .update({ joined_players: updatedPlayers })
    .eq('code', code),

  deleteRoom: async (code: string) => await supabase.from('active_rooms').delete().eq('code', code),

  // --- Wyniki ---
  saveResult: async (result: PlayerResult) => await supabase.from('player_results').insert(result),
  
  getAllResults: async () => await supabase
    .from('player_results')
    .select('*')
    .order('timestamp', { ascending: false }),

  // --- Profile i Auth ---
  // W razie potrzeby dodaj tutaj zapytania z sekcji A i E z pliku supabase_setup.md
};