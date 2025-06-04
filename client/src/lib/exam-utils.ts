// Exam utility functions for managing exam state and logic

export interface ExamQuestion {
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
}

export interface ExamState {
  questions: ExamQuestion[];
  currentQuestion: number;
  answers: (string | null)[];
  timeLeft: number;
  isSubmitted: boolean;
  startTime: Date;
}

export interface ExamResult {
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  totalQuestions: number;
  score: number;
  percentage: number;
  accuracy: number;
}

/**
 * Initialize exam state with questions
 */
export function initializeExam(questions: ExamQuestion[]): ExamState {
  return {
    questions,
    currentQuestion: 0,
    answers: new Array(questions.length).fill(null),
    timeLeft: 600, // 10 minutes in seconds
    isSubmitted: false,
    startTime: new Date(),
  };
}

/**
 * Update answer for a specific question
 */
export function updateAnswer(
  state: ExamState,
  questionIndex: number,
  answer: string | null
): ExamState {
  const newAnswers = [...state.answers];
  newAnswers[questionIndex] = answer;
  
  return {
    ...state,
    answers: newAnswers,
  };
}

/**
 * Navigate to next question
 */
export function nextQuestion(state: ExamState): ExamState {
  if (state.currentQuestion < state.questions.length - 1) {
    return {
      ...state,
      currentQuestion: state.currentQuestion + 1,
    };
  }
  return state;
}

/**
 * Navigate to previous question
 */
export function previousQuestion(state: ExamState): ExamState {
  if (state.currentQuestion > 0) {
    return {
      ...state,
      currentQuestion: state.currentQuestion - 1,
    };
  }
  return state;
}

/**
 * Jump to specific question
 */
export function goToQuestion(state: ExamState, questionIndex: number): ExamState {
  if (questionIndex >= 0 && questionIndex < state.questions.length) {
    return {
      ...state,
      currentQuestion: questionIndex,
    };
  }
  return state;
}

/**
 * Calculate exam progress statistics
 */
export function calculateProgress(state: ExamState) {
  const answeredCount = state.answers.filter(answer => answer !== null).length;
  const progressPercentage = ((state.currentQuestion + 1) / state.questions.length) * 100;
  const completionPercentage = (answeredCount / state.questions.length) * 100;
  
  return {
    currentQuestion: state.currentQuestion + 1,
    totalQuestions: state.questions.length,
    answeredCount,
    unansweredCount: state.questions.length - answeredCount,
    progressPercentage,
    completionPercentage,
  };
}

/**
 * Check if exam can be submitted
 */
export function canSubmitExam(state: ExamState): boolean {
  // Can submit if at least one question is answered or time is up
  return state.answers.some(answer => answer !== null) || state.timeLeft <= 0;
}

/**
 * Prepare exam data for submission
 */
export function prepareSubmissionData(
  state: ExamState,
  examData: {
    mobile: string;
    topic: string;
    batch: string;
    district: string;
  }
) {
  return {
    topic_id: examData.topic,
    mobile: examData.mobile,
    batch_name: examData.batch,
    district: examData.district,
    questions: state.questions.map(q => q.question),
    answers: state.answers,
  };
}

/**
 * Calculate exam results from server response
 */
export function calculateExamResults(
  correctCount: number,
  wrongCount: number,
  unansweredCount: number,
  totalQuestions: number
): ExamResult {
  const score = correctCount;
  const percentage = Math.round((correctCount / totalQuestions) * 100);
  const attempted = correctCount + wrongCount;
  const accuracy = attempted > 0 ? Math.round((correctCount / attempted) * 100) : 0;

  return {
    correctCount,
    wrongCount,
    unansweredCount,
    totalQuestions,
    score,
    percentage,
    accuracy,
  };
}

/**
 * Get question status for progress indicator
 */
export function getQuestionStatus(
  questionIndex: number,
  currentQuestion: number,
  answers: (string | null)[]
): 'current' | 'answered' | 'unanswered' {
  if (questionIndex === currentQuestion) {
    return 'current';
  } else if (answers[questionIndex] !== null) {
    return 'answered';
  } else {
    return 'unanswered';
  }
}

/**
 * Format time remaining for display
 */
export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Check if time is running low (warning threshold)
 */
export function isTimeWarning(timeLeft: number): boolean {
  return timeLeft <= 60; // Last minute warning
}

/**
 * Check if time is critical (danger threshold)
 */
export function isTimeCritical(timeLeft: number): boolean {
  return timeLeft <= 30; // Last 30 seconds
}

/**
 * Generate exam session ID for tracking
 */
export function generateSessionId(): string {
  return `exam_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate exam data before submission
 */
export function validateExamData(examData: {
  mobile: string;
  topic: string;
  batch: string;
  district: string;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!examData.mobile || examData.mobile.length !== 10) {
    errors.push('Invalid mobile number');
  }
  
  if (!examData.topic || examData.topic.trim().length === 0) {
    errors.push('Topic ID is required');
  }
  
  if (!examData.batch || examData.batch.trim().length === 0) {
    errors.push('Batch name is required');
  }
  
  if (!examData.district || examData.district.trim().length === 0) {
    errors.push('District is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Save exam state to session storage
 */
export function saveExamState(state: ExamState): void {
  try {
    sessionStorage.setItem('examState', JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save exam state to session storage:', error);
  }
}

/**
 * Load exam state from session storage
 */
export function loadExamState(): ExamState | null {
  try {
    const saved = sessionStorage.getItem('examState');
    if (saved) {
      const state = JSON.parse(saved);
      // Restore Date object
      state.startTime = new Date(state.startTime);
      return state;
    }
  } catch (error) {
    console.warn('Failed to load exam state from session storage:', error);
  }
  return null;
}

/**
 * Clear exam state from session storage
 */
export function clearExamState(): void {
  try {
    sessionStorage.removeItem('examState');
  } catch (error) {
    console.warn('Failed to clear exam state from session storage:', error);
  }
}

/**
 * Calculate elapsed time since exam start
 */
export function calculateElapsedTime(startTime: Date): number {
  return Math.floor((Date.now() - startTime.getTime()) / 1000);
}

/**
 * Get exam status based on current state
 */
export function getExamStatus(state: ExamState): 'not-started' | 'in-progress' | 'time-warning' | 'time-critical' | 'expired' | 'completed' {
  if (state.isSubmitted) {
    return 'completed';
  }
  
  if (state.timeLeft <= 0) {
    return 'expired';
  }
  
  if (state.timeLeft <= 30) {
    return 'time-critical';
  }
  
  if (state.timeLeft <= 60) {
    return 'time-warning';
  }
  
  if (state.currentQuestion >= 0) {
    return 'in-progress';
  }
  
  return 'not-started';
}
