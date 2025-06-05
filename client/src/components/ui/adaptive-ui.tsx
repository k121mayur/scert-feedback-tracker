import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Alert, AlertDescription } from './alert';
import { Button } from './button';
import { Wifi, WifiOff, RefreshCw, Heart, Zap } from 'lucide-react';

interface SystemStatus {
  connectionStable: boolean;
  serverLoad: 'low' | 'medium' | 'high';
  responseTime: number;
  queueLength: number;
}

interface AdaptiveUIProps {
  systemStatus: SystemStatus;
  children: React.ReactNode;
}

export function AdaptiveUI({ systemStatus, children }: AdaptiveUIProps) {
  const [isLowBandwidth, setIsLowBandwidth] = useState(false);
  const [showOptimizedVersion, setShowOptimizedVersion] = useState(false);

  useEffect(() => {
    // Detect slow connections or high server load
    const shouldOptimize = 
      systemStatus.responseTime > 2000 || 
      systemStatus.serverLoad === 'high' ||
      !systemStatus.connectionStable;
    
    setShowOptimizedVersion(shouldOptimize);
    setIsLowBandwidth(systemStatus.responseTime > 3000);
  }, [systemStatus]);

  if (showOptimizedVersion) {
    return (
      <div className="adaptive-ui-optimized">
        <TrafficAwareHeader systemStatus={systemStatus} />
        <div className={`content-wrapper ${isLowBandwidth ? 'minimal-animations' : ''}`}>
          {children}
        </div>
        <ConnectionStatusBar systemStatus={systemStatus} />
      </div>
    );
  }

  return (
    <div className="adaptive-ui-normal">
      {children}
    </div>
  );
}

function TrafficAwareHeader({ systemStatus }: { systemStatus: SystemStatus }) {
  return (
    <motion.div
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`sticky top-0 z-50 p-3 ${
        systemStatus.serverLoad === 'high' 
          ? 'bg-orange-100 border-orange-200' 
          : 'bg-blue-100 border-blue-200'
      } border-b`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <motion.div
            animate={{ 
              scale: systemStatus.serverLoad === 'high' ? [1, 1.1, 1] : 1 
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {systemStatus.serverLoad === 'high' ? (
              <Zap className="w-5 h-5 text-orange-600" />
            ) : (
              <Heart className="w-5 h-5 text-blue-600" />
            )}
          </motion.div>
          
          <div>
            <p className={`text-sm font-medium ${
              systemStatus.serverLoad === 'high' 
                ? 'text-orange-800' 
                : 'text-blue-800'
            }`}>
              {systemStatus.serverLoad === 'high' 
                ? 'High traffic detected - Optimized experience active'
                : 'System running smoothly'
              }
            </p>
            
            {systemStatus.queueLength > 0 && (
              <p className="text-xs text-gray-600">
                {systemStatus.queueLength} submissions in queue
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {systemStatus.connectionStable ? (
            <Wifi className="w-4 h-4 text-green-600" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-600" />
          )}
          
          <span className="text-xs text-gray-600">
            {systemStatus.responseTime}ms
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function ConnectionStatusBar({ systemStatus }: { systemStatus: SystemStatus }) {
  if (systemStatus.connectionStable && systemStatus.serverLoad !== 'high') {
    return null;
  }

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 shadow-lg z-50"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${
            systemStatus.connectionStable ? 'bg-green-500' : 'bg-red-500'
          }`} />
          
          <span className="text-sm text-gray-700">
            {systemStatus.connectionStable 
              ? 'Connected - Processing at reduced speed due to high traffic'
              : 'Connection issues detected'
            }
          </span>
        </div>
        
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.location.reload()}
          className="flex items-center space-x-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </Button>
      </div>
    </motion.div>
  );
}

// Playful error recovery component
export function PlayfulErrorRecovery({ 
  error, 
  onRetry, 
  onGoHome 
}: { 
  error: string; 
  onRetry: () => void; 
  onGoHome: () => void; 
}) {
  const [encouragementIndex, setEncouragementIndex] = useState(0);
  
  const encouragements = [
    "Don't worry! Even the best systems need a moment sometimes. 🌟",
    "Oops! Looks like we hit a small bump. Let's try again! 💪",
    "Technical hiccup detected! But we believe in your persistence! 🚀",
    "Every great achievement faces obstacles. This is just a tiny one! ✨",
    "Systems can be quirky sometimes. Your determination isn't! 🌈"
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setEncouragementIndex(prev => (prev + 1) % encouragements.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="max-w-md mx-auto p-6 text-center"
    >
      {/* Animated mascot */}
      <motion.div
        animate={{ 
          rotate: [-5, 5, -5],
          y: [0, -10, 0]
        }}
        transition={{ 
          duration: 2, 
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="text-6xl mb-4"
      >
        🤖
      </motion.div>

      <motion.h3
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-xl font-semibold text-gray-800 mb-2"
      >
        Oops! Something went sideways
      </motion.h3>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mb-4"
      >
        <p className="text-sm text-gray-600 mb-3">{error}</p>
        
        <AnimatePresence mode="wait">
          <motion.p
            key={encouragementIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-sm text-blue-600 font-medium"
          >
            {encouragements[encouragementIndex]}
          </motion.p>
        </AnimatePresence>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="space-y-3"
      >
        <Button 
          onClick={onRetry}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
        
        <Button 
          onClick={onGoHome}
          variant="outline"
          className="w-full"
        >
          Go to Home
        </Button>
      </motion.div>

      {/* Floating encouragement particles */}
      <div className="relative">
        {Array.from({ length: 5 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-blue-400 rounded-full"
            animate={{
              x: [0, (Math.random() - 0.5) * 100],
              y: [0, -50 - Math.random() * 30],
              opacity: [0, 1, 0],
              scale: [0, 1, 0]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: i * 0.6,
              ease: "easeOut"
            }}
            style={{
              left: '50%',
              top: '50%'
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// Instant feedback micro-animations
export function InstantFeedback({ 
  type, 
  children 
}: { 
  type: 'success' | 'error' | 'warning' | 'info';
  children: React.ReactNode;
}) {
  const getColors = () => {
    switch (type) {
      case 'success': return 'from-green-400 to-green-600';
      case 'error': return 'from-red-400 to-red-600';
      case 'warning': return 'from-yellow-400 to-yellow-600';
      case 'info': return 'from-blue-400 to-blue-600';
      default: return 'from-gray-400 to-gray-600';
    }
  };

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`relative overflow-hidden rounded-lg bg-gradient-to-r ${getColors()} p-4 text-white shadow-lg`}
    >
      <motion.div
        initial={{ x: '-100%' }}
        animate={{ x: '100%' }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />
      
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
}

// Adaptive button that changes based on system load
export function AdaptiveButton({ 
  children, 
  systemLoad, 
  ...props 
}: { 
  children: React.ReactNode; 
  systemLoad: 'low' | 'medium' | 'high';
  [key: string]: any;
}) {
  const getLoadingVariant = () => {
    switch (systemLoad) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'default';
    }
  };

  return (
    <motion.div
      whileHover={{ scale: systemLoad === 'high' ? 1 : 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Button 
        variant={getLoadingVariant()}
        {...props}
        className={`transition-all duration-300 ${
          systemLoad === 'high' 
            ? 'animate-pulse' 
            : ''
        } ${props.className || ''}`}
      >
        {systemLoad === 'high' && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full"
          />
        )}
        {children}
      </Button>
    </motion.div>
  );
}