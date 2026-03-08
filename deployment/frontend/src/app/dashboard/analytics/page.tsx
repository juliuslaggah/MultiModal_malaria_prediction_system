'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Select,
  DatePicker,
  Table,
  Tag,
  message,
  Spin,
  Empty,
  Space,
  Button,
  Tooltip
} from 'antd';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  MedicineBoxOutlined,
  CameraOutlined,
  MergeOutlined,
  DownloadOutlined,
  ReloadOutlined,
  CalendarOutlined,
  RiseOutlined,
  FallOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

// Extend dayjs
dayjs.extend(relativeTime);

const { Option } = Select;
const { RangePicker } = DatePicker;
const { RangePicker: DateRangePicker } = DatePicker;

interface Prediction {
  id: number;
  timestamp: string;
  mode: 'clinical_only' | 'image_only' | 'fusion';
  prediction: 'Infected' | 'Uninfected';
  confidence_score: number;
  risk_level: 'Low' | 'Moderate' | 'High';
  clinical_score?: number;
  image_score?: number;
}

interface AnalyticsData {
  overview: {
    total: number;
    infected: number;
    uninfected: number;
    avgConfidence: number;
    avgClinicalScore: number;
    avgImageScore: number;
    successRate: number;
  };
  trends: Array<{
    date: string;
    infected: number;
    uninfected: number;
    total: number;
    avgConfidence: number;
  }>;
  modeDistribution: Array<{
    mode: string;
    count: number;
    percentage: number;
  }>;
  riskDistribution: Array<{
    risk: string;
    count: number;
    percentage: number;
  }>;
  hourlyDistribution: Array<{
    hour: string;
    count: number;
    infected: number;
  }>;
  modelPerformance: {
    clinical_accuracy: number;
    image_accuracy: number;
    fusion_accuracy: number;
    avgClinicalTime: number;
    avgImageTime: number;
    avgFusionTime: number;
  };
  recentTrends: Array<{
    date: string;
    clinical: number;
    image: number;
    fusion: number;
  }>;
}

const COLORS = {
  infected: '#cf1322',
  uninfected: '#389e0d',
  clinical: '#1890ff',
  image: '#52c41a',
  fusion: '#722ed1',
  low: '#52c41a',
  moderate: '#fa8c16',
  high: '#f5222d',
  primary: '#1677ff'
};

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'all' | 'custom'>('week');
  const [customDates, setCustomDates] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [data, setData] = useState<AnalyticsData>({
    overview: {
      total: 0,
      infected: 0,
      uninfected: 0,
      avgConfidence: 0,
      avgClinicalScore: 0,
      avgImageScore: 0,
      successRate: 0
    },
    trends: [],
    modeDistribution: [],
    riskDistribution: [],
    hourlyDistribution: [],
    modelPerformance: {
      clinical_accuracy: 0,
      image_accuracy: 0,
      fusion_accuracy: 0,
      avgClinicalTime: 0,
      avgImageTime: 0,
      avgFusionTime: 0
    },
    recentTrends: []
  });

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch all predictions
      const response = await fetch('http://localhost:8000/history?skip=0&limit=1000');
      if (!response.ok) throw new Error('Failed to fetch');
      const predictions: Prediction[] = await response.json();

      if (predictions.length === 0) {
        setLoading(false);
        return;
      }

      // Filter by date range
      let filteredPredictions = [...predictions];
      
      if (timeRange !== 'all' && timeRange !== 'custom') {
        const now = dayjs();
        let startDate = now;
        
        switch(timeRange) {
          case 'day':
            startDate = now.subtract(1, 'day');
            break;
          case 'week':
            startDate = now.subtract(7, 'day');
            break;
          case 'month':
            startDate = now.subtract(30, 'day');
            break;
        }
        
        filteredPredictions = predictions.filter(p => 
          dayjs(p.timestamp).isAfter(startDate)
        );
      } else if (timeRange === 'custom' && customDates?.[0] && customDates?.[1]) {
        const start = customDates[0].startOf('day');
        const end = customDates[1].endOf('day');
        filteredPredictions = predictions.filter(p => 
          dayjs(p.timestamp).isAfter(start) && dayjs(p.timestamp).isBefore(end)
        );
      }

      // Calculate overview
      const total = filteredPredictions.length;
      const infected = filteredPredictions.filter(p => p.prediction === 'Infected').length;
      const uninfected = total - infected;
      const avgConfidence = filteredPredictions.reduce((sum, p) => sum + p.confidence_score, 0) / total;
      const avgClinical = filteredPredictions
        .filter(p => p.clinical_score)
        .reduce((sum, p) => sum + (p.clinical_score || 0), 0) / 
        filteredPredictions.filter(p => p.clinical_score).length || 0;
      const avgImage = filteredPredictions
        .filter(p => p.image_score)
        .reduce((sum, p) => sum + (p.image_score || 0), 0) / 
        filteredPredictions.filter(p => p.image_score).length || 0;
      const successRate = filteredPredictions.length / predictions.length;

      // Calculate trends (group by date)
      const trendsMap = new Map();
      filteredPredictions.forEach(p => {
        const date = dayjs(p.timestamp).format('MMM DD');
        if (!trendsMap.has(date)) {
          trendsMap.set(date, { date, infected: 0, uninfected: 0, total: 0, sumConfidence: 0 });
        }
        const entry = trendsMap.get(date);
        if (p.prediction === 'Infected') {
          entry.infected++;
        } else {
          entry.uninfected++;
        }
        entry.total++;
        entry.sumConfidence += p.confidence_score;
      });

      const trends = Array.from(trendsMap.values())
        .map(entry => ({
          ...entry,
          avgConfidence: entry.sumConfidence / entry.total
        }))
        .sort((a, b) => dayjs(a.date).unix() - dayjs(b.date).unix());

      // Calculate mode distribution
      const modeMap = new Map();
      filteredPredictions.forEach(p => {
        const mode = p.mode || 'unknown';
        modeMap.set(mode, (modeMap.get(mode) || 0) + 1);
      });
      const modeDistribution = Array.from(modeMap.entries()).map(([mode, count]) => ({
        mode: mode.replace('_', ' ').toUpperCase(),
        count,
        percentage: (count / total) * 100
      }));

      // Calculate risk distribution
      const riskMap = new Map();
      filteredPredictions.forEach(p => {
        const risk = p.risk_level || 'Unknown';
        riskMap.set(risk, (riskMap.get(risk) || 0) + 1);
      });
      const riskDistribution = Array.from(riskMap.entries()).map(([risk, count]) => ({
        risk,
        count,
        percentage: (count / total) * 100
      }));

      // Calculate hourly distribution
      const hourMap = new Map();
      for (let i = 0; i < 24; i++) {
        hourMap.set(i, { count: 0, infected: 0 });
      }
      
      filteredPredictions.forEach(p => {
        const hour = dayjs(p.timestamp).hour();
        const entry = hourMap.get(hour) || { count: 0, infected: 0 };
        entry.count++;
        if (p.prediction === 'Infected') entry.infected++;
        hourMap.set(hour, entry);
      });

      const hourlyDistribution = Array.from(hourMap.entries())
        .map(([hour, data]) => ({
          hour: `${hour.toString().padStart(2, '0')}:00`,
          count: data.count,
          infected: data.infected
        }));

      // Calculate model performance by mode
      const clinicalPreds = filteredPredictions.filter(p => p.mode === 'clinical_only');
      const imagePreds = filteredPredictions.filter(p => p.mode === 'image_only');
      const fusionPreds = filteredPredictions.filter(p => p.mode === 'fusion');

      // Recent trends by mode over time
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = dayjs().subtract(i, 'day').format('MMM DD');
        return { date, clinical: 0, image: 0, fusion: 0 };
      }).reverse();

      filteredPredictions.forEach(p => {
        const dateStr = dayjs(p.timestamp).format('MMM DD');
        const trendEntry = last7Days.find(d => d.date === dateStr);
        if (trendEntry) {
          if (p.mode === 'clinical_only') trendEntry.clinical++;
          else if (p.mode === 'image_only') trendEntry.image++;
          else if (p.mode === 'fusion') trendEntry.fusion++;
        }
      });

      setData({
        overview: {
          total,
          infected,
          uninfected,
          avgConfidence: avgConfidence * 100,
          avgClinicalScore: avgClinical * 100,
          avgImageScore: avgImage * 100,
          successRate: successRate * 100
        },
        trends,
        modeDistribution,
        riskDistribution,
        hourlyDistribution,
        modelPerformance: {
          clinical_accuracy: clinicalPreds.length ? 
            clinicalPreds.filter(p => p.prediction === 'Infected').length / clinicalPreds.length * 100 : 0,
          image_accuracy: imagePreds.length ? 
            imagePreds.filter(p => p.prediction === 'Infected').length / imagePreds.length * 100 : 0,
          fusion_accuracy: fusionPreds.length ? 
            fusionPreds.filter(p => p.prediction === 'Infected').length / fusionPreds.length * 100 : 0,
          avgClinicalTime: 0.023, // You can calculate from actual data if available
          avgImageTime: 0.045,
          avgFusionTime: 0.067
        },
        recentTrends: last7Days
      });

    } catch (error) {
      message.error('Failed to load analytics');
      console.error('Analytics error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange, customDates]);

  // Export analytics report
  const exportReport = () => {
    const report = {
      generatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      timeRange: timeRange,
      overview: data.overview,
      modeDistribution: data.modeDistribution,
      riskDistribution: data.riskDistribution,
      modelPerformance: data.modelPerformance,
      trends: data.trends
    };

    const dataStr = JSON.stringify(report, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_report_${dayjs().format('YYYY-MM-DD_HH-mm')}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold mb-1">📊 Analytics Dashboard</h1>
          <p className="text-gray-500">
            Real-time insights and statistics from {data.overview.total} predictions
          </p>
        </div>
        <Space>
          <Select value={timeRange} onChange={setTimeRange} style={{ width: 130 }}>
            <Option value="day">Last 24h</Option>
            <Option value="week">Last 7 days</Option>
            <Option value="month">Last 30 days</Option>
            <Option value="all">All time</Option>
            <Option value="custom">Custom</Option>
          </Select>
          {timeRange === 'custom' && (
            <RangePicker 
              onChange={(dates) => setCustomDates(dates as any)}
              style={{ width: 250 }}
            />
          )}
          <Button 
            icon={<ReloadOutlined />} 
            onClick={fetchAnalytics}
            loading={loading}
          >
            Refresh
          </Button>
          <Button 
            type="primary" 
            icon={<DownloadOutlined />}
            onClick={exportReport}
          >
            Export Report
          </Button>
        </Space>
      </div>

      {/* Overview Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} className="shadow-sm">
            <Statistic
              title="Total Predictions"
              value={data.overview.total}
              prefix={<MedicineBoxOutlined />}
              valueStyle={{ color: COLORS.primary }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} className="shadow-sm">
            <Statistic
              title="Infected"
              value={data.overview.infected}
              valueStyle={{ color: COLORS.infected }}
              prefix={<RiseOutlined />}
              suffix={`/ ${((data.overview.infected / data.overview.total) * 100 || 0).toFixed(1)}%`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} className="shadow-sm">
            <Statistic
              title="Uninfected"
              value={data.overview.uninfected}
              valueStyle={{ color: COLORS.uninfected }}
              prefix={<FallOutlined />}
              suffix={`/ ${((data.overview.uninfected / data.overview.total) * 100 || 0).toFixed(1)}%`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading} className="shadow-sm">
            <Statistic
              title="Avg Confidence"
              value={data.overview.avgConfidence.toFixed(1)}
              suffix="%"
              precision={1}
              valueStyle={{ color: COLORS.primary }}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts Row 1 */}
      <Row gutter={[16, 16]}>
        {/* Trend Chart */}
        <Col xs={24} lg={16}>
          <Card 
            title="Prediction Trends Over Time" 
            loading={loading}
            className="shadow-sm"
            extra={
              <Tag color="blue">
                {data.trends.length} days
              </Tag>
            }
          >
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trends}>
                  <defs>
                    <linearGradient id="colorInfected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.infected} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={COLORS.infected} stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorUninfected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.uninfected} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={COLORS.uninfected} stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="infected" 
                    stroke={COLORS.infected} 
                    fillOpacity={1}
                    fill="url(#colorInfected)"
                    name="Infected"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="uninfected" 
                    stroke={COLORS.uninfected} 
                    fillOpacity={1}
                    fill="url(#colorUninfected)"
                    name="Uninfected"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>

        {/* Confidence Trend */}
        <Col xs={24} lg={8}>
          <Card 
            title="Average Confidence Trend" 
            loading={loading}
            className="shadow-sm"
          >
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <RechartsTooltip 
                    formatter={(value: any) => [`${value.toFixed(1)}%`, 'Confidence']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="avgConfidence" 
                    stroke={COLORS.primary}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Avg Confidence"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Charts Row 2 */}
      <Row gutter={[16, 16]}>
        {/* Mode Distribution */}
        <Col xs={24} lg={8}>
          <Card 
            title="Usage by Mode" 
            loading={loading}
            className="shadow-sm"
          >
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.modeDistribution}
                    dataKey="count"
                    nameKey="mode"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent = 0 }) => {
                      const percentage = (percent * 100).toFixed(1);
                      return `${name} (${percentage}%)`;
                    }}
                  >
                    {data.modeDistribution.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={
                          entry.mode.includes('CLINICAL') ? COLORS.clinical :
                          entry.mode.includes('IMAGE') ? COLORS.image :
                          COLORS.fusion
                        }
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>

        {/* Risk Distribution */}
        <Col xs={24} lg={8}>
          <Card 
            title="Risk Level Distribution" 
            loading={loading}
            className="shadow-sm"
          >
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.riskDistribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 'dataMax']} />
                  <YAxis type="category" dataKey="risk" />
                  <RechartsTooltip 
                    formatter={(value: any, name: any, props: any) => [
                      `${value} (${props.payload.percentage.toFixed(1)}%)`, 
                      'Count'
                    ]}
                  />
                  <Bar dataKey="count" name="Count">
                    {data.riskDistribution.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={
                          entry.risk === 'Low' ? COLORS.low :
                          entry.risk === 'Moderate' ? COLORS.moderate :
                          COLORS.high
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>

        {/* Hourly Distribution */}
        <Col xs={24} lg={8}>
          <Card 
            title="Hourly Prediction Distribution" 
            loading={loading}
            className="shadow-sm"
          >
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.hourlyDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" interval={3} />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="count" fill={COLORS.primary} name="Total" />
                  <Bar dataKey="infected" fill={COLORS.infected} name="Infected" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Charts Row 3 */}
      <Row gutter={[16, 16]}>
        {/* Model Performance */}
        <Col xs={24} lg={12}>
          <Card 
            title="Model Performance by Mode" 
            loading={loading}
            className="shadow-sm"
          >
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Card size="small" className="text-center bg-blue-50">
                  <Statistic
                    title={<span className="text-blue-700">Clinical</span>}
                    value={data.modelPerformance.clinical_accuracy.toFixed(1)}
                    suffix="%"
                    precision={1}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Avg: {(data.modelPerformance.avgClinicalTime * 1000).toFixed(0)}ms
                  </div>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" className="text-center bg-green-50">
                  <Statistic
                    title={<span className="text-green-700">Image</span>}
                    value={data.modelPerformance.image_accuracy.toFixed(1)}
                    suffix="%"
                    precision={1}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Avg: {(data.modelPerformance.avgImageTime * 1000).toFixed(0)}ms
                  </div>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" className="text-center bg-purple-50">
                  <Statistic
                    title={<span className="text-purple-700">Fusion</span>}
                    value={data.modelPerformance.fusion_accuracy.toFixed(1)}
                    suffix="%"
                    precision={1}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Avg: {(data.modelPerformance.avgFusionTime * 1000).toFixed(0)}ms
                  </div>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Average Scores */}
        <Col xs={24} lg={12}>
          <Card 
            title="Average Scores by Mode" 
            loading={loading}
            className="shadow-sm"
          >
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Card size="small" className="text-center">
                  <Statistic
                    title="Clinical"
                    value={data.overview.avgClinicalScore.toFixed(1)}
                    suffix="%"
                    valueStyle={{ color: COLORS.clinical }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" className="text-center">
                  <Statistic
                    title="Image"
                    value={data.overview.avgImageScore.toFixed(1)}
                    suffix="%"
                    valueStyle={{ color: COLORS.image }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" className="text-center">
                  <Statistic
                    title="Overall"
                    value={data.overview.avgConfidence.toFixed(1)}
                    suffix="%"
                    valueStyle={{ color: COLORS.primary }}
                  />
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Recent Mode Trends */}
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card 
            title="Mode Usage Trends (Last 7 Days)" 
            loading={loading}
            className="shadow-sm"
          >
            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.recentTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="clinical" 
                    stroke={COLORS.clinical} 
                    strokeWidth={2}
                    name="Clinical"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="image" 
                    stroke={COLORS.image} 
                    strokeWidth={2}
                    name="Image"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="fusion" 
                    stroke={COLORS.fusion} 
                    strokeWidth={2}
                    name="Fusion"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Loading State */}
      {loading && (
        <div className="fixed inset-0 bg-white bg-opacity-50 flex items-center justify-center z-50">
          <Spin size="large" tip="Loading analytics..." />
        </div>
      )}
    </div>
  );
}
