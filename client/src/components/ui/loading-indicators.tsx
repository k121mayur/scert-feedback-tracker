import { motion } from 'framer-motion';
import { BookOpen, Users, Clock, CheckCircle } from 'lucide-react';

// Educational loading mascot with animations
export const TeacherLoadingMascot = ({ message = "तैयारी हो रही है..." }: { message?: string }) => (
  <div className="flex flex-col items-center justify-center space-y-4 p-8">
    <motion.div
      className="relative"
      animate={{ 
        scale: [1, 1.1, 1],
        rotate: [0, 5, -5, 0]
      }}
      transition={{ 
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
        <BookOpen className="w-8 h-8 text-blue-600" />
      </div>
      <motion.div
        className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center"
        animate={{ 
          scale: [1, 1.3, 1],
          opacity: [1, 0.7, 1]
        }}
        transition={{ 
          duration: 1.5,
          repeat: Infinity,
          delay: 0.5
        }}
      >
        <Users className="w-3 h-3 text-white" />
      </motion.div>
    </motion.div>
    
    <motion.p
      className="text-lg font-medium text-gray-700 text-center"
      animate={{ opacity: [1, 0.6, 1] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      {message}
    </motion.p>
    
    <div className="flex space-x-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 bg-blue-500 rounded-full"
          animate={{ 
            y: [0, -10, 0],
            opacity: [0.5, 1, 0.5]
          }}
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

// Smart loading indicator that adapts to system load
export const AdaptiveLoadingIndicator = ({ 
  systemLoad = 'normal',
  estimatedTime,
  currentStep
}: {
  systemLoad?: 'low' | 'normal' | 'high' | 'peak';
  estimatedTime?: number;
  currentStep?: string;
}) => {
  const getLoadColor = () => {
    switch (systemLoad) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'normal': return 'text-blue-600 bg-blue-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'peak': return 'text-red-600 bg-red-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };

  const getLoadMessage = () => {
    switch (systemLoad) {
      case 'low': return 'तुरंत शुरू हो रहा है';
      case 'normal': return 'सामान्य गति से लोड हो रहा है';
      case 'high': return 'व्यस्त समय - कृपया प्रतीक्षा करें';
      case 'peak': return 'चरम व्यस्तता - थोड़ा समय लगेगा';
      default: return 'लोड हो रहा है...';
    }
  };

  return (
    <div className="flex flex-col items-center space-y-6 p-6">
      <motion.div
        className={`w-20 h-20 rounded-full flex items-center justify-center ${getLoadColor()}`}
        animate={{ 
          scale: [1, 1.2, 1],
          rotate: systemLoad === 'peak' ? [0, 360] : [0, 180, 0]
        }}
        transition={{ 
          duration: systemLoad === 'peak' ? 3 : 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <Clock className="w-10 h-10" />
      </motion.div>

      <div className="text-center space-y-2">
        <p className="text-lg font-medium text-gray-800">{getLoadMessage()}</p>
        {currentStep && (
          <p className="text-sm text-gray-600">{currentStep}</p>
        )}
        {estimatedTime && (
          <p className="text-sm text-gray-500">
            अनुमानित समय: {estimatedTime} सेकंड
          </p>
        )}
      </div>

      {/* Progress indicator */}
      <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${systemLoad === 'peak' ? 'bg-red-500' : 'bg-blue-500'}`}
          animate={{ 
            x: ['-100%', '100%'],
            opacity: [0.5, 1, 0.5]
          }}
          transition={{ 
            duration: systemLoad === 'peak' ? 4 : 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>
    </div>
  );
};

// Micro-animations for successful operations
export const SuccessAnimation = ({ message = "सफल!" }: { message?: string }) => (
  <motion.div
    className="flex flex-col items-center space-y-4"
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ type: "spring", duration: 0.6 }}
  >
    <motion.div
      className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center"
      animate={{ 
        scale: [1, 1.2, 1],
        rotate: [0, 360]
      }}
      transition={{ 
        duration: 0.8,
        ease: "easeOut"
      }}
    >
      <CheckCircle className="w-8 h-8 text-green-600" />
    </motion.div>
    
    <motion.p
      className="text-lg font-medium text-green-700"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3 }}
    >
      {message}
    </motion.p>
  </motion.div>
);

// Connection status indicator
export const ConnectionStatusIndicator = ({ 
  status = 'connected',
  serverLoad = 'normal'
}: {
  status?: 'connected' | 'reconnecting' | 'disconnected';
  serverLoad?: 'normal' | 'high' | 'overloaded';
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          color: 'bg-green-500',
          message: 'जुड़ा हुआ',
          icon: '●'
        };
      case 'reconnecting':
        return {
          color: 'bg-yellow-500',
          message: 'पुनः जुड़ रहा है',
          icon: '◐'
        };
      case 'disconnected':
        return {
          color: 'bg-red-500',
          message: 'जुड़ाव टूटा',
          icon: '○'
        };
      default:
        return {
          color: 'bg-gray-500',
          message: 'अज्ञात',
          icon: '?'
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <motion.div
      className="flex items-center space-x-2 px-3 py-1 rounded-full bg-white shadow-sm border"
      animate={{ 
        scale: status === 'reconnecting' ? [1, 1.05, 1] : 1
      }}
      transition={{ 
        duration: 1,
        repeat: status === 'reconnecting' ? Infinity : 0
      }}
    >
      <motion.div
        className={`w-2 h-2 rounded-full ${statusConfig.color}`}
        animate={{
          opacity: status === 'reconnecting' ? [1, 0.3, 1] : 1
        }}
        transition={{
          duration: 1,
          repeat: status === 'reconnecting' ? Infinity : 0
        }}
      />
      <span className="text-xs font-medium text-gray-700">
        {statusConfig.message}
      </span>
      {serverLoad === 'high' && (
        <span className="text-xs text-orange-600 font-medium">
          व्यस्त
        </span>
      )}
    </motion.div>
  );
};