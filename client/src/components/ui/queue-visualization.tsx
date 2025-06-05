import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Users, Zap, CheckCircle } from 'lucide-react';

interface QueueData {
  position: number;
  totalInQueue: number;
  estimatedWaitTime: number;
  processingRate: number;
  systemLoad: 'low' | 'medium' | 'high';
}

interface QueueVisualizationProps {
  queueData: QueueData;
  submissionType: 'exam' | 'feedback' | 'authentication';
}

export function QueueVisualization({ queueData, submissionType }: QueueVisualizationProps) {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + (100 / (queueData.estimatedWaitTime * 60)); // Progress per second
        return Math.min(newProgress, 95); // Cap at 95% until completion
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [queueData.estimatedWaitTime]);

  const getSystemLoadColor = () => {
    switch (queueData.systemLoad) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getSubmissionIcon = () => {
    switch (submissionType) {
      case 'exam': return '📝';
      case 'feedback': return '💭';
      case 'authentication': return '🔐';
      default: return '📋';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">{getSubmissionIcon()}</div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {submissionType === 'exam' ? 'Exam Submission' : 
               submissionType === 'feedback' ? 'Feedback Processing' : 
               'Authentication Queue'}
            </h3>
            <p className="text-sm text-gray-600">Processing your request</p>
          </div>
        </div>
        
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${getSystemLoadColor()}`}>
          {queueData.systemLoad.toUpperCase()} LOAD
        </div>
      </div>

      {/* Queue Position */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{queueData.position}</div>
          <div className="text-sm text-blue-600">Position in Queue</div>
        </div>
        
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{queueData.estimatedWaitTime}m</div>
          <div className="text-sm text-green-600">Estimated Wait</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <motion.div
            className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Queue Visualization */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Queue Status</h4>
        <div className="flex items-center space-x-2">
          {/* People ahead in queue */}
          {Array.from({ length: Math.min(queueData.position - 1, 5) }).map((_, i) => (
            <motion.div
              key={i}
              className="w-8 h-8 bg-yellow-200 rounded-full flex items-center justify-center text-xs"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.1 }}
            >
              👤
            </motion.div>
          ))}
          
          {queueData.position > 6 && (
            <div className="text-sm text-gray-500">
              +{queueData.position - 6} more
            </div>
          )}
          
          {/* Current user */}
          <motion.div
            className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold"
            animate={{ 
              scale: [1, 1.1, 1],
              boxShadow: ['0 0 0 0 rgba(59, 130, 246, 0.7)', '0 0 0 10px rgba(59, 130, 246, 0)', '0 0 0 0 rgba(59, 130, 246, 0)']
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            YOU
          </motion.div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex items-center space-x-2">
          <Users className="w-4 h-4 text-blue-500" />
          <span className="text-gray-600">
            {queueData.totalInQueue} in queue
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <Zap className="w-4 h-4 text-green-500" />
          <span className="text-gray-600">
            {queueData.processingRate}/min processing
          </span>
        </div>
      </div>

      {/* Encouraging Message */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200"
      >
        <p className="text-sm text-blue-700">
          {queueData.systemLoad === 'high' 
            ? "High traffic detected! We're working hard to process all submissions quickly."
            : queueData.position <= 5
            ? "You're almost next! Hang tight for just a moment."
            : "Thanks for your patience. Your submission is secure and will be processed soon."
          }
        </p>
      </motion.div>
    </div>
  );
}

// Mini queue status for header/navigation
export function MiniQueueStatus({ queueLength, processingRate }: { queueLength: number; processingRate: number }) {
  if (queueLength === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center space-x-2 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-3 h-3 border border-yellow-600 border-t-transparent rounded-full"
      />
      <span>{queueLength} submissions processing</span>
    </motion.div>
  );
}

// Processing complete animation
export function ProcessingComplete({ submissionType }: { submissionType: string }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="text-center p-8"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4"
      >
        <CheckCircle className="w-10 h-10 text-white" />
      </motion.div>
      
      <motion.h3
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-xl font-semibold text-green-800 mb-2"
      >
        {submissionType} Complete!
      </motion.h3>
      
      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-green-600"
      >
        Your submission has been successfully processed and saved.
      </motion.p>

      {/* Confetti effect */}
      <div className="relative">
        {Array.from({ length: 10 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-gradient-to-r from-yellow-400 to-red-400 rounded-full"
            initial={{ 
              x: 0, 
              y: 0, 
              scale: 0,
              rotate: 0 
            }}
            animate={{ 
              x: (Math.random() - 0.5) * 200,
              y: -100 + Math.random() * -50,
              scale: 1,
              rotate: 360 
            }}
            transition={{ 
              duration: 1.5,
              delay: 0.8 + i * 0.1,
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