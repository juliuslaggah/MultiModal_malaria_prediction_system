'use client';

import { useState, useEffect } from 'react';
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
  AlertTriangle,
  MinusCircle
} from 'lucide-react'

// Define the type for activity items
interface ActivityItem {
  id: number;
  type: string;
  result: string;
  time: string;
}

// Helper function to format time
const formatRelativeTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
};

// This function fetches data
const getStats = async () => {
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://multimodal-malaria-prediction-system-3.onrender.com';
    
    const response = await fetch(`${API_URL}/history?skip=0&limit=1000`, {
      cache: 'no-store'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    
    const predictions = await response.json();
    
    const totalPredictions = predictions.length;
    const infectedCount = predictions.filter((p: any) => p.prediction === 'Infected').length;
    const uninfectedCount = predictions.filter((p: any) => p.prediction === 'Uninfected').length;
    const insufficientCount = predictions.filter((p: any) => 
      p.prediction === 'Insufficient Symptoms' || 
      p.prediction?.toLowerCase().includes('insufficient')
    ).length;
    
    const recentActivity: ActivityItem[] = predictions.slice(0, 5).map((p: any) => ({
      id: p.id,
      type: p.mode === 'clinical_only' ? 'Clinical' : 
            p.mode === 'image_only' ? 'Image' : 'Fusion',
      result: p.prediction === 'Insufficient Symptoms' ? 'Insufficient' : p.prediction,
      time: formatRelativeTime(p.timestamp)
    }));

    let accuracy = 94.5;
    try {
      const healthResponse = await fetch(`${API_URL}/health`);
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        if (healthData.statistics?.success_rate) {
          accuracy = parseFloat((healthData.statistics.success_rate * 100).toFixed(1));
        }
      }
    } catch (error) {
      console.warn('Could not fetch accuracy, using default:', error);
    }

    return {
      totalPredictions,
      infectedCount,
      uninfectedCount,
      insufficientCount,
      accuracy: Number(accuracy),
      recentActivity
    };
    
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return {
      totalPredictions: 0,
      infectedCount: 0,
      uninfectedCount: 0,
      insufficientCount: 0,
      accuracy: 0,
      recentActivity: []
    };
  }
}

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const data = await getStats();
      setStats(data);
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

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
        {/* Total Predictions */}
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

        {/* Infected Cases */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <span className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full">
              {stats.totalPredictions > 0 ? ((stats.infectedCount / stats.totalPredictions) * 100).toFixed(1) : '0'}%
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {stats.infectedCount.toLocaleString()}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Infected Cases
          </p>
        </div>

        {/* Uninfected Cases */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
              {stats.totalPredictions > 0 ? ((stats.uninfectedCount / stats.totalPredictions) * 100).toFixed(1) : '0'}%
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {stats.uninfectedCount.toLocaleString()}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Uninfected Cases
          </p>
        </div>

        {/* Insufficient Symptoms */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
              <MinusCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded-full">
              {stats.totalPredictions > 0 ? ((stats.insufficientCount / stats.totalPredictions) * 100).toFixed(1) : '0'}%
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            {stats.insufficientCount?.toLocaleString() || '0'}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Insufficient Symptoms
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
              {stats.recentActivity.length > 0 ? (
                stats.recentActivity.map((activity: ActivityItem) => (
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
                        : activity.result === 'Uninfected'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                    }`}>
                      {activity.result}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                  No recent activity
                </p>
              )}
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
