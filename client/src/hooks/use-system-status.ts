import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface SystemStatus {
  connectionStable: boolean;
  serverLoad: 'low' | 'medium' | 'high';
  responseTime: number;
  queueLength: number;
  memoryUsage: number;
  connectionUtilization: number;
  cacheHitRatio: number;
  lastUpdated: Date;
}

interface QueueData {
  position: number;
  totalInQueue: number;
  estimatedWaitTime: number;
  processingRate: number;
  systemLoad: 'low' | 'medium' | 'high';
}

export function useSystemStatus() {
  const [connectionStable, setConnectionStable] = useState(true);
  const [responseTime, setResponseTime] = useState(0);

  // Monitor system health via API
  const { data: systemHealth, isError } = useQuery({
    queryKey: ['/api/system/health'],
    refetchInterval: 10000, // Check every 10 seconds
    onSuccess: (data) => {
      setConnectionStable(true);
    },
    onError: () => {
      setConnectionStable(false);
    }
  });

  // Monitor response times
  useEffect(() => {
    const startTime = Date.now();
    
    fetch('/api/system/ping')
      .then(() => {
        const endTime = Date.now();
        setResponseTime(endTime - startTime);
      })
      .catch(() => {
        setResponseTime(5000); // Set high response time on error
      });
  }, []);

  // Calculate server load based on various metrics
  const getServerLoad = (): 'low' | 'medium' | 'high' => {
    if (!systemHealth) return 'medium';
    
    const { connectionUtilization = 0, queueLength = 0, memoryUsage = 0 } = systemHealth;
    
    if (connectionUtilization > 80 || queueLength > 1000 || memoryUsage > 1500) {
      return 'high';
    } else if (connectionUtilization > 50 || queueLength > 500 || memoryUsage > 1000) {
      return 'medium';
    }
    
    return 'low';
  };

  const systemStatus: SystemStatus = {
    connectionStable: connectionStable && !isError,
    serverLoad: getServerLoad(),
    responseTime,
    queueLength: systemHealth?.queueLength || 0,
    memoryUsage: systemHealth?.memoryUsage || 0,
    connectionUtilization: systemHealth?.connectionUtilization || 0,
    cacheHitRatio: systemHealth?.cacheHitRatio || 0,
    lastUpdated: new Date()
  };

  return {
    systemStatus,
    isHealthy: systemStatus.connectionStable && systemStatus.serverLoad !== 'high',
    needsOptimization: systemStatus.serverLoad === 'high' || systemStatus.responseTime > 2000
  };
}

export function useQueueStatus(submissionId?: string): QueueData | null {
  const { data: queueData } = useQuery({
    queryKey: ['/api/queue/status', submissionId],
    enabled: !!submissionId,
    refetchInterval: 5000, // Check queue every 5 seconds
  });

  if (!queueData) return null;

  return {
    position: queueData.position || 0,
    totalInQueue: queueData.totalInQueue || 0,
    estimatedWaitTime: queueData.estimatedWaitTime || 0,
    processingRate: queueData.processingRate || 60,
    systemLoad: queueData.systemLoad || 'medium'
  };
}

export function useAdaptivePerformance() {
  const { systemStatus } = useSystemStatus();
  
  // Determine if we should use reduced animations
  const shouldReduceAnimations = 
    systemStatus.serverLoad === 'high' || 
    systemStatus.responseTime > 3000 ||
    !systemStatus.connectionStable;

  // Determine if we should show queue information
  const shouldShowQueue = systemStatus.queueLength > 0;

  // Determine if we should preload content
  const shouldPreload = 
    systemStatus.serverLoad === 'low' && 
    systemStatus.connectionStable &&
    systemStatus.responseTime < 1000;

  return {
    shouldReduceAnimations,
    shouldShowQueue,
    shouldPreload,
    adaptiveClass: shouldReduceAnimations ? 'reduced-motion' : 'full-motion'
  };
}