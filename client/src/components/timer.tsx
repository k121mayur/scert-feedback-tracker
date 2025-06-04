import { useMemo } from "react";

interface TimerProps {
  timeLeft: number;
  className?: string;
}

export function Timer({ timeLeft, className = "" }: TimerProps) {
  const formattedTime = useMemo(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [timeLeft]);

  return <span className={className}>{formattedTime}</span>;
}
