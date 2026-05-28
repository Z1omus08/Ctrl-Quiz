import { Quiz } from './types';

/**
 * Tablica startowa dla quizów.
 * Wszystkie szablony quizów są pobierane i zapisywane bezpośrednio w tabeli
 * `quizzes` w Supabase, a nie przechowywane w pliku po stronie klienta.
 */
export const DEFAULT_QUIZZES: Quiz[] = [];