import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Users, Brain, Target } from 'lucide-react';

interface LoadingIndicatorProps {
  message?: string;
  type?: 'default' | 'exam' | 'authentication' | 'submission';
  progress?: number;
}

export function LoadingIndicator({ 
  message = "Loading...", 
  type = 'default',
  progress 
}: LoadingIndicatorProps) {
  const [currentTip, setCurrentTip] = useState(0);
  
  const educationalTips = [
    "Did you know? Regular practice improves retention by 40%",
    "Tip: Take short breaks between questions to stay focused",
    "Remember: There's no penalty for reviewing your answers",
    "Success tip: Read each question carefully before answering"
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % educationalTips.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const getIcon = () => {
    switch (type) {
      case 'exam':
        return Brain;
      case 'authentication':
        return Users;
      case 'submission':
        return Target;
      default:
        return BookOpen;
    }
  };

  const Icon = getIcon();

  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] space-y-6">
      {/* Educational Mascot Animation */}
      <motion.div
        animate={{ 
          rotate: [0, 10, -10, 0],
          scale: [1, 1.1, 1]
        }}
        transition={{ 
          duration: 2, 
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="relative"
      >
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
          <Icon className="w-10 h-10 text-white" />
        </div>
        
        {/* Floating particles */}
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-blue-400 rounded-full"
            animate={{
              x: [0, 20, -20, 0],
              y: [0, -20, 20, 0],
              opacity: [0, 1, 0]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.5,
              ease: "easeInOut"
            }}
            style={{
              left: `${50 + (i - 1) * 30}%`,
              top: `${50 + (i - 1) * 20}%`
            }}
          />
        ))}
      </motion.div>

      {/* Progress Bar */}
      {progress !== undefined && (
        <div className="w-64 bg-gray-200 rounded-full h-2">
          <motion.div
            className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}

      {/* Loading Message */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-3"
      >
        <h3 className="text-lg font-semibold text-gray-800">{message}</h3>
        
        {/* Educational Tips Carousel */}
        <AnimatePresence mode="wait">
          <motion.p
            key={currentTip}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="text-sm text-gray-600 max-w-md mx-auto"
          >
            {educationalTips[currentTip]}
          </motion.p>
        </AnimatePresence>
      </motion.div>

      {/* Pulsing dots */}
      <div className="flex space-x-2">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="w-3 h-3 bg-blue-500 rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2
            }}
          />
        ))}
      </div>
    </div>
  );
}

// High-load scenario loading component
export function HighLoadIndicator({ queuePosition }: { queuePosition?: number }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-12 h-12 mx-auto mb-4"
      >
        <div className="w-full h-full border-4 border-blue-200 border-t-blue-600 rounded-full" />
      </motion.div>
      
      <h3 className="text-lg font-semibold text-blue-800 mb-2">
        High Traffic Detected
      </h3>
      
      <p className="text-blue-700 mb-3">
        We're processing a large number of requests. Your session is secure and will be handled shortly.
      </p>
      
      {queuePosition && (
        <div className="bg-white rounded-md p-3 border border-blue-200">
          <p className="text-sm text-blue-600">
            Position in queue: <span className="font-bold">{queuePosition}</span>
          </p>
          <p className="text-xs text-blue-500 mt-1">
            Estimated wait time: {Math.ceil(queuePosition / 100)} minutes
          </p>
        </div>
      )}
    </div>
  );
}

// Submission processing indicator
export function SubmissionIndicator({ stage }: { stage: 'uploading' | 'processing' | 'saving' | 'complete' }) {
  const stages = [
    { key: 'uploading', label: 'Uploading answers', icon: '📤' },
    { key: 'processing', label: 'Processing responses', icon: '⚙️' },
    { key: 'saving', label: 'Saving to database', icon: '💾' },
    { key: 'complete', label: 'Complete!', icon: '✅' }
  ];

  const currentStageIndex = stages.findIndex(s => s.key === stage);

  return (
    <div className="space-y-4">
      {stages.map((stageItem, index) => (
        <motion.div
          key={stageItem.key}
          className={`flex items-center space-x-3 p-3 rounded-lg ${
            index <= currentStageIndex 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-gray-50 border border-gray-200'
          }`}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <div className="text-2xl">{stageItem.icon}</div>
          <div className="flex-1">
            <p className={`font-medium ${
              index <= currentStageIndex ? 'text-green-800' : 'text-gray-600'
            }`}>
              {stageItem.label}
            </p>
          </div>
          {index < currentStageIndex && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center"
            >
              <span className="text-white text-sm">✓</span>
            </motion.div>
          )}
          {index === currentStageIndex && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full"
            />
          )}
        </motion.div>
      ))}
    </div>
  );
}