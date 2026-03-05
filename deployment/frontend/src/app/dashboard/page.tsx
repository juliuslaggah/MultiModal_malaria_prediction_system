import Link from 'next/link'
import { 
  Stethoscope, 
  Image as ImageIcon, 
  Layers, 
  History,
  BarChart3,
  ArrowRight,
  Activity,
  Thermometer,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react'

// This would typically come from an API
const getStats = async () => {
  // Mock data - replace with actual API call
  return {
    totalPredictions: 50,
    infectedCount: 35,
    uninfectedCount: 15,
    accuracy: 94.5,
    recentActivity: [
      { id: 1, type: 'Clinical', result: 'Uninfected', time: '2 min ago' },
      { id: 2, type: 'Image', result: 'Infected', time: '15 min ago' },
      { id: 3, type: 'Fusion', result: 'Infected', time: '1 hour ago' },
      { id: 4, type: 'Clinical', result: 'Uninfected', time: '2 hours ago' },
    ]
  }
}

export default async function DashboardPage() {
  const stats = await getStats()

  const features = [
    {
      title: 'Clinical Prediction',
      description: 'Diagnose malaria based on patient symptoms.',
      icon: Stethoscope,
      href: '/predict/clinical',
      color: 'blue',
      gradient: 'from-blue-500 to-cyan-500',
      lightBg: 'bg-blue-50',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    {
      title: 'Image Prediction',
      description: 'Analyze blood smear images.',
      icon: ImageIcon,
      href: '/predict/image',
      color: 'green',
      gradient: 'from-green-500 to-emerald-500',
      lightBg: 'bg-green-50',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
    },
    {
      title: 'Fusion Prediction',
      description: 'Combine clinical and image data for enhanced multimodal diagnosis.',
      icon: Layers,
      href: '/predict/fusion',
      color: 'purple',
      gradient: 'from-purple-500 to-pink-500',
      lightBg: 'bg-purple-50',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
    },
  ]

  const quickActions = [
    { name: 'History', href: '/history', icon: History, color: 'amber' },
    { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, color: 'indigo' },
  ]

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-cyan-600 to-teal-600 p-8 text-white shadow-xl">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:60px_60px]" />
        <div className="relative z-10">
          <h1 className="text-3xl font-bold mb-2">
            Welcome to Malaria Diagnosis System
          </h1>
          <p className="text-blue-100 max-w-2xl text-lg">
            A multimodal approach combining clinical symptoms and blood smear images 
            for accurate malaria diagnosis.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Activity className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
              Total
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {stats.totalPredictions.toLocaleString()}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Total Predictions
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <span className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full">
              {((stats.infectedCount / stats.totalPredictions) * 100).toFixed(1)}%
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {stats.infectedCount.toLocaleString()}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Infected Cases
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
              {((stats.uninfectedCount / stats.totalPredictions) * 100).toFixed(1)}%
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {stats.uninfectedCount.toLocaleString()}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Uninfected Cases
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <Activity className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded-full">
              Model
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {stats.accuracy}%
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Model Accuracy
          </p>
        </div>
      </div>

      {/* Feature Cards */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Diagnosis Modes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <Link
                key={feature.href}
                href={feature.href}
                className="group relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-all hover:-translate-y-1"
              >
                <div className={`absolute inset-0 bg-gradient-to-r ${feature.gradient} opacity-0 group-hover:opacity-5 rounded-xl transition-opacity`} />
                <div className="relative">
                  <div className={`w-12 h-12 ${feature.iconBg} rounded-lg flex items-center justify-center mb-4`}>
                    <Icon className={`h-6 w-6 ${feature.iconColor}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {feature.description}
                  </p>
                  <div className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    Start prediction
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Quick Actions and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Quick Actions
          </h2>
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all group"
              >
                <div className={`p-3 bg-${action.color}-100 dark:bg-${action.color}-900/20 rounded-lg mr-4`}>
                  <Icon className={`h-5 w-5 text-${action.color}-600 dark:text-${action.color}-400`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {action.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    View {action.name.toLowerCase()} and insights
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
              </Link>
            )
          })}
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Recent Activity
              </h2>
              <Link 
                href="/history"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center"
              >
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
            <div className="space-y-4">
              {stats.recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  <div className="flex items-center">
                    <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg mr-3">
                      {activity.type === 'Clinical' && <Stethoscope className="h-4 w-4 text-blue-600" />}
                      {activity.type === 'Image' && <ImageIcon className="h-4 w-4 text-green-600" />}
                      {activity.type === 'Fusion' && <Layers className="h-4 w-4 text-purple-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {activity.type} Prediction
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {activity.time}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                    activity.result === 'Infected' 
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                      : 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                  }`}>
                    {activity.result}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            System Status
          </h2>
          <span className="flex items-center text-sm text-green-600 dark:text-green-400">
            <span className="w-2 h-2 bg-green-600 rounded-full mr-2 animate-pulse" />
            Operational
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Stethoscope className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Clinical Model</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">XGBoost</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <ImageIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Image Model</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">ShuffleNetV2</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <Layers className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Fusion Alpha</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">0.5</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Avg Response</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">0.08s</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
