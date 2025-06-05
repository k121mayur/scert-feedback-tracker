import { motion } from 'framer-motion';
import { Users, Clock, Activity, AlertCircle, CheckCircle2 } from 'lucide-react';

// Real-time queue position visualization
export const QueuePositionDisplay = ({ 
  position, 
  totalInQueue, 
  estimatedWaitTime,
  processingRate 
}: {
  position: number;
  totalInQueue: number;
  estimatedWaitTime: number;
  processingRate: number;
}) => {
  const progressPercentage = ((totalInQueue - position) / totalInQueue) * 100;

  return (
    <div className="bg-white rounded-lg p-6 shadow-lg border-l-4 border-blue-500">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">आपकी कतार में स्थिति</h3>
        <motion.div
          className="flex items-center space-x-2 text-blue-600"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Users className="w-5 h-5" />
          <span className="font-bold">{position}</span>
        </motion.div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>प्रगति</span>
          <span>{Math.round(progressPercentage)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-green-500"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Queue stats */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-orange-500" />
          <div>
            <p className="text-gray-600">अनुमानित प्रतीक्षा</p>
            <p className="font-semibold">{Math.ceil(estimatedWaitTime / 60)} मिनट</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-green-500" />
          <div>
            <p className="text-gray-600">प्रोसेसिंग दर</p>
            <p className="font-semibold">{processingRate}/मिनट</p>
          </div>
        </div>
      </div>

      {/* Encouraging message based on position */}
      <motion.div
        className="mt-4 p-3 bg-blue-50 rounded-lg"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <p className="text-sm text-blue-700 text-center">
          {position <= 10 
            ? "बहुत जल्द आपकी बारी आएगी! तैयार रहें।"
            : position <= 50
            ? "कुछ समय और बाकी है। धैर्य रखें।"
            : "व्यस्त समय है। आपका इंतजार जल्द खत्म होगा।"
          }
        </p>
      </motion.div>
    </div>
  );
};

// Smart system load indicator with educational context
export const SystemLoadIndicator = ({ 
  load,
  activeUsers,
  systemCapacity,
  averageResponseTime 
}: {
  load: 'low' | 'moderate' | 'high' | 'peak';
  activeUsers: number;
  systemCapacity: number;
  averageResponseTime: number;
}) => {
  const getLoadConfig = () => {
    switch (load) {
      case 'low':
        return {
          color: 'text-green-600 bg-green-100',
          icon: CheckCircle2,
          message: 'सिस्टम तेज़ गति से काम कर रहा है',
          recommendation: 'अभी परीक्षा शुरू करने का बेहतरीन समय है!'
        };
      case 'moderate':
        return {
          color: 'text-blue-600 bg-blue-100',
          icon: Activity,
          message: 'सिस्टम सामान्य गति से काम कर रहा है',
          recommendation: 'परीक्षा के लिए तैयार हो जाएं।'
        };
      case 'high':
        return {
          color: 'text-orange-600 bg-orange-100',
          icon: Users,
          message: 'सिस्टम व्यस्त है, धीमी गति',
          recommendation: 'धैर्य रखें - बहुत से शिक्षक ऑनलाइन हैं।'
        };
      case 'peak':
        return {
          color: 'text-red-600 bg-red-100',
          icon: AlertCircle,
          message: 'चरम व्यस्तता - देरी संभावित',
          recommendation: 'कृपया धैर्य रखें या बाद में प्रयास करें।'
        };
      default:
        return {
          color: 'text-gray-600 bg-gray-100',
          icon: Activity,
          message: 'स्थिति जांची जा रही है',
          recommendation: 'कृपया प्रतीक्षा करें...'
        };
    }
  };

  const config = getLoadConfig();
  const IconComponent = config.icon;
  const utilizationPercentage = (activeUsers / systemCapacity) * 100;

  return (
    <div className="bg-white rounded-lg p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <motion.div
            className={`p-3 rounded-full ${config.color}`}
            animate={{ 
              scale: load === 'peak' ? [1, 1.1, 1] : 1,
              rotate: load === 'peak' ? [0, 5, -5, 0] : 0
            }}
            transition={{ 
              duration: 2,
              repeat: load === 'peak' ? Infinity : 0
            }}
          >
            <IconComponent className="w-6 h-6" />
          </motion.div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">सिस्टम स्थिति</h3>
            <p className="text-sm text-gray-600">{config.message}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-800">{activeUsers.toLocaleString()}</p>
          <p className="text-sm text-gray-600">सक्रिय उपयोगकर्ता</p>
        </div>
      </div>

      {/* System utilization bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>सिस्टम उपयोग</span>
          <span>{Math.round(utilizationPercentage)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <motion.div
            className={`h-full ${
              utilizationPercentage > 90 ? 'bg-red-500' :
              utilizationPercentage > 70 ? 'bg-orange-500' :
              utilizationPercentage > 50 ? 'bg-yellow-500' :
              'bg-green-500'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(utilizationPercentage, 100)}%` }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Performance metrics */}
      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
        <div>
          <p className="text-gray-600">औसत प्रतिक्रिया समय</p>
          <p className="font-semibold text-lg">
            {averageResponseTime < 1000 
              ? `${averageResponseTime}ms` 
              : `${(averageResponseTime / 1000).toFixed(1)}s`
            }
          </p>
        </div>
        <div>
          <p className="text-gray-600">सिस्टम क्षमता</p>
          <p className="font-semibold text-lg">{systemCapacity.toLocaleString()}</p>
        </div>
      </div>

      {/* Recommendation */}
      <motion.div
        className={`p-3 rounded-lg ${config.color.replace('text-', 'text-').replace('bg-', 'bg-')}`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8 }}
      >
        <p className="text-sm font-medium text-center">
          {config.recommendation}
        </p>
      </motion.div>
    </div>
  );
};

// Queue management controls for teachers
export const QueueManagementPanel = ({ 
  onRefreshStatus,
  onLeaveQueue,
  onRetryConnection,
  canLeaveQueue = true 
}: {
  onRefreshStatus: () => void;
  onLeaveQueue: () => void;
  onRetryConnection: () => void;
  canLeaveQueue?: boolean;
}) => {
  return (
    <div className="bg-white rounded-lg p-4 shadow-lg border-t-4 border-blue-500">
      <h4 className="text-md font-semibold text-gray-800 mb-3">कतार प्रबंधन</h4>
      
      <div className="space-y-2">
        <motion.button
          onClick={onRefreshStatus}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          स्थिति ताज़ा करें
        </motion.button>

        <motion.button
          onClick={onRetryConnection}
          className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          कनेक्शन पुनः प्रयास करें
        </motion.button>

        {canLeaveQueue && (
          <motion.button
            onClick={onLeaveQueue}
            className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            कतार छोड़ें
          </motion.button>
        )}
      </div>

      <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-600 text-center">
        सुझाव: व्यस्त समय में धैर्य रखें। आपकी परीक्षा की तैयारी करते रहें।
      </div>
    </div>
  );
};