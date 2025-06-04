import { useState, useEffect, useRef, useCallback } from 'react';

interface UseTimerOptions {
  onTimeUp?: () => void;
  onWarning?: (timeLeft: number) => void;
  warningThreshold?: number;
  autoStart?: boolean;
  interval?: number;
}

interface UseTimerReturn {
  timeLeft: number;
  isRunning: boolean;
  isExpired: boolean;
  isWarning: boolean;
  isCritical: boolean;
  formattedTime: string;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: (newDuration?: number) => void;
  addTime: (seconds: number) => void;
  getProgress: () => number;
}

export function useTimer(
  initialDuration: number,
  options: UseTimerOptions = {}
): UseTimerReturn {
  const {
    onTimeUp,
    onWarning,
    warningThreshold = 60,
    autoStart = false,
    interval = 1000,
  } = options;

  const [timeLeft, setTimeLeft] = useState(initialDuration);
  const [isRunning, setIsRunning] = useState(autoStart);
  const [initialTime] = useState(initialDuration);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeLeftRef = useRef(timeLeft);
  const hasWarningFired = useRef(false);
  const hasTimeUpFired = useRef(false);

  // Update ref when timeLeft changes
  timeLeftRef.current = timeLeft;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    if (timeLeftRef.current <= 0) return;
    
    setIsRunning(true);
    clearTimer();
    
    intervalRef.current = setInterval(() => {
      setTimeLeft(prevTime => {
        const newTime = Math.max(0, prevTime - 1);
        
        // Fire warning callback if threshold reached
        if (
          !hasWarningFired.current &&
          newTime <= warningThreshold &&
          newTime > 0 &&
          onWarning
        ) {
          hasWarningFired.current = true;
          onWarning(newTime);
        }
        
        // Fire time up callback when timer expires
        if (newTime === 0 && !hasTimeUpFired.current) {
          hasTimeUpFired.current = true;
          setIsRunning(false);
          if (onTimeUp) {
            // Use setTimeout to ensure state update completes first
            setTimeout(onTimeUp, 0);
          }
        }
        
        return newTime;
      });
    }, interval);
  }, [clearTimer, warningThreshold, onWarning, onTimeUp, interval]);

  const pauseTimer = useCallback(() => {
    setIsRunning(false);
    clearTimer();
  }, [clearTimer]);

  const resetTimer = useCallback((newDuration?: number) => {
    const duration = newDuration ?? initialTime;
    setTimeLeft(duration);
    setIsRunning(false);
    hasWarningFired.current = false;
    hasTimeUpFired.current = false;
    clearTimer();
  }, [initialTime, clearTimer]);

  const addTime = useCallback((seconds: number) => {
    setTimeLeft(prevTime => Math.max(0, prevTime + seconds));
    // Reset warning flag if we've added significant time
    if (seconds > warningThreshold) {
      hasWarningFired.current = false;
    }
  }, [warningThreshold]);

  const getProgress = useCallback(() => {
    return ((initialTime - timeLeft) / initialTime) * 100;
  }, [initialTime, timeLeft]);

  const formatTime = useCallback((seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  // Auto-start timer if specified
  useEffect(() => {
    if (autoStart && timeLeft > 0) {
      startTimer();
    }
  }, [autoStart, startTimer, timeLeft]);

  const isExpired = timeLeft <= 0;
  const isWarning = timeLeft <= warningThreshold && timeLeft > 30;
  const isCritical = timeLeft <= 30 && timeLeft > 0;
  const formattedTime = formatTime(timeLeft);

  return {
    timeLeft,
    isRunning,
    isExpired,
    isWarning,
    isCritical,
    formattedTime,
    startTimer,
    pauseTimer,
    resetTimer,
    addTime,
    getProgress,
  };
}

// Hook for exam-specific timer with additional features
export function useExamTimer(
  duration: number = 600, // 10 minutes default
  onAutoSubmit?: () => void
) {
  const timer = useTimer(duration, {
    onTimeUp: onAutoSubmit,
    warningThreshold: 120, // 2 minutes warning for exams
    autoStart: false,
  });

  const getTimeStatus = useCallback(() => {
    if (timer.isExpired) return 'expired';
    if (timer.isCritical) return 'critical';
    if (timer.isWarning) return 'warning';
    return 'normal';
  }, [timer.isExpired, timer.isCritical, timer.isWarning]);

  const getTimeColor = useCallback(() => {
    const status = getTimeStatus();
    switch (status) {
      case 'expired':
      case 'critical':
        return 'text-destructive';
      case 'warning':
        return 'text-accent';
      default:
        return 'text-foreground';
    }
  }, [getTimeStatus]);

  const shouldShowWarning = useCallback(() => {
    return timer.timeLeft <= 300 && timer.timeLeft > 0; // Show warning in last 5 minutes
  }, [timer.timeLeft]);

  const getWarningMessage = useCallback(() => {
    if (timer.isExpired) {
      return "Time's up! Your exam will be automatically submitted.";
    }
    if (timer.isCritical) {
      return `Only ${timer.timeLeft} seconds remaining!`;
    }
    if (timer.isWarning) {
      return `${Math.ceil(timer.timeLeft / 60)} minutes remaining. Please review your answers.`;
    }
    if (shouldShowWarning()) {
      return `${Math.ceil(timer.timeLeft / 60)} minutes remaining.`;
    }
    return null;
  }, [timer.isExpired, timer.isCritical, timer.isWarning, timer.timeLeft, shouldShowWarning]);

  // Calculate exam time statistics
  const getTimeStats = useCallback(() => {
    const elapsed = duration - timer.timeLeft;
    const elapsedMinutes = Math.floor(elapsed / 60);
    const remainingMinutes = Math.floor(timer.timeLeft / 60);
    const percentageUsed = ((elapsed / duration) * 100).toFixed(1);
    
    return {
      elapsed,
      elapsedMinutes,
      remainingMinutes,
      percentageUsed: parseFloat(percentageUsed),
      totalMinutes: Math.floor(duration / 60),
    };
  }, [duration, timer.timeLeft]);

  return {
    ...timer,
    getTimeStatus,
    getTimeColor,
    shouldShowWarning,
    getWarningMessage,
    getTimeStats,
  };
}

// Hook for feedback session timer (optional timeout)
export function useFeedbackTimer(timeoutMinutes: number = 15) {
  const timer = useTimer(timeoutMinutes * 60, {
    autoStart: true,
    warningThreshold: 300, // 5 minutes warning
  });

  const isNearTimeout = timer.timeLeft <= 300; // Last 5 minutes
  const progressPercentage = timer.getProgress();

  return {
    ...timer,
    isNearTimeout,
    progressPercentage,
    minutesLeft: Math.ceil(timer.timeLeft / 60),
  };
}

// Hook for session timeout (general application timeout)
export function useSessionTimer(
  timeoutMinutes: number = 30,
  onSessionTimeout?: () => void
) {
  const timer = useTimer(timeoutMinutes * 60, {
    autoStart: true,
    onTimeUp: onSessionTimeout,
    warningThreshold: 300, // 5 minutes warning
  });

  const extendSession = useCallback((additionalMinutes: number = 15) => {
    timer.addTime(additionalMinutes * 60);
  }, [timer]);

  const resetSession = useCallback(() => {
    timer.resetTimer(timeoutMinutes * 60);
    timer.startTimer();
  }, [timer, timeoutMinutes]);

  return {
    ...timer,
    extendSession,
    resetSession,
    minutesLeft: Math.ceil(timer.timeLeft / 60),
    isNearExpiry: timer.timeLeft <= 300,
  };
}
