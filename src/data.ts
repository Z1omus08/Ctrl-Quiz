import { Quiz } from './types';

export const DEFAULT_QUIZZES: Quiz[] = [
  {
    id: 'space-quiz',
    title: 'Układ Słoneczny i Wszechświat',
    description: 'Sprawdź swoją wiedzę o planetach, gwiazdach i tajemnicach kosmosu.',
    defaultDuration: 180, // 3 minutes
    creatorId: 'admin-default',
    questions: [
      {
        id: 'q1',
        text: 'Która planeta w naszym Układzie Słonecznym jest największa?',
        answers: ['Mars', 'Saturn', 'Jowisz', 'Neptun'],
        correctAnswerIndex: 2,
      },
      {
        id: 'q2',
        text: 'Która planeta znajduje się najbliżej Słońca?',
        answers: ['Wenus', 'Merkury', 'Ziemia', 'Mars'],
        correctAnswerIndex: 1,
      },
      {
        id: 'q3',
        text: 'Ile księżyców posiada planeta Ziemia?',
        answers: ['Jeden', 'Dwa', 'Brak', 'Cztery'],
        correctAnswerIndex: 0,
      },
      {
        id: 'q4',
        text: 'Jak nazywa się nasza galaktyka?',
        answers: ['Galaktyka Andromedy', 'Droga Mleczna', 'Wielki Obłok Magellana', 'Czarna Dziura'],
        correctAnswerIndex: 1,
      },
      {
        id: 'q5',
        text: 'Która planeta znana jest jako „Czerwona Planeta”?',
        answers: ['Wenus', 'Jowisz', 'Mars', 'Uran'],
        correctAnswerIndex: 2,
      },
    ],
  },
  {
    id: 'math-bases',
    title: 'Matematyka – Szybki Sprawdzian',
    description: 'Konkurs logicznego myślenia oraz szybkich obliczeń ułamkowych i geometrycznych.',
    defaultDuration: 120, // 2 minutes
    creatorId: 'admin-default',
    questions: [
      {
        id: 'm1',
        text: 'Ile wynosi pierwiastek kwadratowy z liczby 144?',
        answers: ['10', '12', '14', '16'],
        correctAnswerIndex: 1,
      },
      {
        id: 'm2',
        text: 'Jaki jest wynik działania: 2 + 2 * 2?',
        answers: ['8', '6', '12', '4'],
        correctAnswerIndex: 1,
      },
      {
        id: 'm3',
        text: 'Ile stopni wynosi suma kątów w trójkącie?',
        answers: ['90°', '180°', '270°', '360°'],
        correctAnswerIndex: 1,
      },
      {
        id: 'm4',
        text: 'Co to jest ułamek 3/4 wyrażony w procentach?',
        answers: ['34%', '50%', '75%', '80%'],
        correctAnswerIndex: 2,
      },
    ],
  },
  {
    id: 'geo-world',
    title: 'Geografia i Stolice Świata',
    description: 'Czy znasz mapę świata i najważniejsze stolice państw na różnych kontynentach?',
    defaultDuration: 150, // 2.5 minutes
    creatorId: 'admin-default',
    questions: [
      {
        id: 'g1',
        text: 'Co jest stolicą Francji?',
        answers: ['Londyn', 'Madryt', 'Paryż', 'Rzym'],
        correctAnswerIndex: 2,
      },
      {
        id: 'g2',
        text: 'Który ocean jest najgłębszy i największy na Ziemi?',
        answers: ['Ocean Atlantycki', 'Ocean Indyjski', 'Ocean Spokojny (Pacyfik)', 'Ocean Arktyczny'],
        correctAnswerIndex: 2,
      },
      {
        id: 'g3',
        text: 'Na jakim kontynencie leży najwyższa góra świata (Mount Everest)?',
        answers: ['W Azji', 'W Afryce', 'W Ameryce Północnej', 'W Europie'],
        correctAnswerIndex: 0,
      },
      {
        id: 'g4',
        text: 'Która rzeka jest najdłuższa na świecie?',
        answers: ['Wisła', 'Amazonka', 'Nil', 'Jangcy'],
        correctAnswerIndex: 2, // Nil has historically been standard, though Amazon is close. Nil is safest for general quiz.
      },
      {
        id: 'g5',
        text: 'Z jakim państwem Polska ma najdłuższą granicę?',
        answers: ['Z Niemcami', 'Z Czechami', 'Ze Słowacją', 'Z Ukrainą'],
        correctAnswerIndex: 1, // Czech Republic is 796 km, Slovakia is 541 km, Germany is 467 km.
      },
    ],
  },
];
