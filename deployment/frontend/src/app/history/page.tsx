'use client';

import { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Badge,
  Button,
  Input,
  Select,
  Space,
  Tag,
  Modal,
  Descriptions,
  Statistic,
  Row,
  Col,
  message,
  DatePicker,
  Tooltip,
  Empty,
  Spin
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  DownloadOutlined,
  FilterOutlined,
  CalendarOutlined,
  MedicineBoxOutlined,
  CameraOutlined,
  MergeOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

// Extend dayjs with relative time plugin
dayjs.extend(relativeTime);

const { Option } = Select;
const { RangePicker } = DatePicker;

interface PredictionRecord {
  id: number;
  timestamp: string;
  mode: 'clinical_only' | 'image_only' | 'fusion';
  prediction: 'Infected' | 'Uninfected';
  confidence_score: number;
  risk_level: 'Low' | 'Moderate' | 'High';
  clinical_score?: number;
  image_score?: number;
  filename?: string;
  age?: number;
  sex?: string;
  model_version?: string;
  computation_time?: number;
}

export default function HistoryPage() {
  const [loading, setLoading] = useState(false);
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [filteredPredictions, setFilteredPredictions] = useState<PredictionRecord[]>([]);
  const [selectedPrediction, setSelectedPrediction] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [filters, setFilters] = useState({
    mode: '',
    prediction: '',
    riskLevel: '',
    dateRange: null as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null,
    search: ''
  });

  // Fetch predictions
  const fetchPredictions = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/history?skip=0&limit=100');
      if (!response.ok) {
        throw new Error('Failed to fetch');
      }
      const data = await response.json();
      setPredictions(data);
      setFilteredPredictions(data);
    } catch (error) {
      message.error('Failed to fetch history');
      console.error('Error fetching predictions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPredictions();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...predictions];

    // Mode filter
    if (filters.mode) {
      filtered = filtered.filter(p => p.mode === filters.mode);
    }

    // Prediction filter
    if (filters.prediction) {
      filtered = filtered.filter(p => p.prediction === filters.prediction);
    }

    // Risk level filter
    if (filters.riskLevel) {
      filtered = filtered.filter(p => p.risk_level === filters.riskLevel);
    }

    // Date range filter
    if (filters.dateRange?.[0] && filters.dateRange?.[1]) {
      const start = filters.dateRange[0].startOf('day');
      const end = filters.dateRange[1].endOf('day');
      filtered = filtered.filter(p => 
        dayjs(p.timestamp).isAfter(start) && dayjs(p.timestamp).isBefore(end)
      );
    }

    // Search filter (by ID)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(p => 
        p.id.toString().includes(searchLower)
      );
    }

    setFilteredPredictions(filtered);
  }, [filters, predictions]);

  // View prediction details
  const viewDetails = async (id: number) => {
    try {
      const response = await fetch(`http://localhost:8000/predictions/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch');
      }
      const data = await response.json();
      setSelectedPrediction(data);
      setModalVisible(true);
    } catch (error) {
      message.error('Failed to load prediction details');
    }
  };

  // Export data as CSV
  const exportAsCSV = () => {
    const headers = ['ID', 'Timestamp', 'Mode', 'Prediction', 'Confidence', 'Risk Level', 'Clinical Score', 'Image Score'];
    const csvData = filteredPredictions.map(p => [
      p.id,
      dayjs(p.timestamp).format('YYYY-MM-DD HH:mm:ss'),
      p.mode,
      p.prediction,
      (p.confidence_score * 100).toFixed(1) + '%',
      p.risk_level,
      p.clinical_score ? (p.clinical_score * 100).toFixed(1) + '%' : 'N/A',
      p.image_score ? (p.image_score * 100).toFixed(1) + '%' : 'N/A'
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `predictions_${dayjs().format('YYYY-MM-DD_HH-mm')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Export as JSON
  const exportAsJSON = () => {
    const dataStr = JSON.stringify(filteredPredictions, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `predictions_${dayjs().format('YYYY-MM-DD_HH-mm')}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Get mode icon
  const getModeIcon = (mode: string) => {
    switch(mode) {
      case 'clinical_only': return <MedicineBoxOutlined />;
      case 'image_only': return <CameraOutlined />;
      case 'fusion': return <MergeOutlined />;
      default: return null;
    }
  };

  // Table columns
  const columns: ColumnsType<PredictionRecord> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      sorter: (a, b) => a.id - b.id,
    },
    {
      title: 'Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 120,
      render: (text: string) => (
        <Tooltip title={dayjs(text).format('YYYY-MM-DD HH:mm:ss')}>
          {dayjs(text).fromNow()}
        </Tooltip>
      ),
      sorter: (a, b) => dayjs(a.timestamp).unix() - dayjs(b.timestamp).unix(),
    },
    {
      title: 'Mode',
      dataIndex: 'mode',
      key: 'mode',
      width: 120,
      render: (mode: string) => {
        const colors: Record<string, string> = {
          clinical_only: 'blue',
          image_only: 'green',
          fusion: 'purple'
        };
        const labels: Record<string, string> = {
          clinical_only: 'Clinical',
          image_only: 'Image',
          fusion: 'Fusion'
        };
        return (
          <Tag color={colors[mode]} icon={getModeIcon(mode)}>
            {labels[mode] || mode}
          </Tag>
        );
      },
    },
    {
      title: 'Prediction',
      dataIndex: 'prediction',
      key: 'prediction',
      width: 100,
      render: (pred: string) => (
        <Badge 
          status={pred === 'Infected' ? 'error' : 'success'} 
          text={pred} 
        />
      ),
    },
    {
      title: 'Confidence',
      dataIndex: 'confidence_score',
      key: 'confidence',
      width: 100,
      render: (score: number) => {
        const color = score > 0.7 ? 'green' : score > 0.4 ? 'orange' : 'red';
        return (
          <span style={{ color }}>
            {(score * 100).toFixed(1)}%
          </span>
        );
      },
      sorter: (a, b) => a.confidence_score - b.confidence_score,
    },
    {
      title: 'Risk Level',
      dataIndex: 'risk_level',
      key: 'risk',
      width: 100,
      render: (level: string) => {
        const colors: Record<string, string> = {
          Low: 'green',
          Moderate: 'orange',
          High: 'red'
        };
        return <Tag color={colors[level]}>{level}</Tag>;
      },
    },
    {
      title: 'Clinical Score',
      dataIndex: 'clinical_score',
      key: 'clinical',
      width: 110,
      render: (score?: number) => score ? 
        <span>{(score * 100).toFixed(1)}%</span> : 
        <span className="text-gray-400">—</span>,
    },
    {
      title: 'Image Score',
      dataIndex: 'image_score',
      key: 'image',
      width: 110,
      render: (score?: number) => score ? 
        <span>{(score * 100).toFixed(1)}%</span> : 
        <span className="text-gray-400">—</span>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button 
          icon={<EyeOutlined />} 
          size="small" 
          onClick={() => viewDetails(record.id)}
          type="primary"
          ghost
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="p-6">
      <Card
        title={
          <div className="flex items-center gap-3">
            <span className="text-xl font-semibold">📋 Prediction History</span>
            <Badge 
              count={filteredPredictions.length} 
              style={{ backgroundColor: '#1890ff' }} 
              showZero
            />
          </div>
        }
        extra={
          <Space>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={fetchPredictions}
              loading={loading}
            >
              Refresh
            </Button>
            <Button 
              icon={<DownloadOutlined />}
              onClick={exportAsJSON}
            >
              JSON
            </Button>
            <Button 
              type="primary" 
              icon={<DownloadOutlined />}
              onClick={exportAsCSV}
            >
              Export CSV
            </Button>
          </Space>
        }
        className="shadow-md"
      >
        {/* Filters */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Input
                placeholder="Search by ID"
                prefix={<SearchOutlined className="text-gray-400" />}
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
                allowClear
              />
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Select
                placeholder="Filter by Mode"
                style={{ width: '100%' }}
                value={filters.mode || undefined}
                onChange={(value) => setFilters({...filters, mode: value})}
                allowClear
                suffixIcon={<FilterOutlined />}
              >
                <Option value="clinical_only">Clinical Only</Option>
                <Option value="image_only">Image Only</Option>
                <Option value="fusion">Fusion</Option>
              </Select>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Select
                placeholder="Filter by Result"
                style={{ width: '100%' }}
                value={filters.prediction || undefined}
                onChange={(value) => setFilters({...filters, prediction: value})}
                allowClear
              >
                <Option value="Infected">Infected</Option>
                <Option value="Uninfected">Uninfected</Option>
              </Select>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Select
                placeholder="Filter by Risk"
                style={{ width: '100%' }}
                value={filters.riskLevel || undefined}
                onChange={(value) => setFilters({...filters, riskLevel: value})}
                allowClear
              >
                <Option value="Low">Low Risk</Option>
                <Option value="Moderate">Moderate Risk</Option>
                <Option value="High">High Risk</Option>
              </Select>
            </Col>
            <Col xs={24} md={6}>
              <RangePicker
                style={{ width: '100%' }}
                onChange={(dates) => setFilters({...filters, dateRange: dates as any})}
                placeholder={['Start Date', 'End Date']}
                suffixIcon={<CalendarOutlined />}
              />
            </Col>
          </Row>
        </div>

        {/* Table */}
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={filteredPredictions}
            rowKey="id"
            pagination={{
              defaultPageSize: 20,
              pageSizeOptions: ['10', '20', '50', '100'],
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `Total ${total} predictions`,
              position: ['bottomCenter']
            }}
            scroll={{ x: 1200 }}
            locale={{
              emptyText: (
                <Empty 
                  image={Empty.PRESENTED_IMAGE_SIMPLE} 
                  description="No predictions found" 
                />
              )
            }}
          />
        </Spin>
      </Card>

      {/* Detail Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <span>Prediction Details #{selectedPrediction?.id}</span>
            {selectedPrediction && (
              <Tag color={
                selectedPrediction.mode === 'clinical_only' ? 'blue' :
                selectedPrediction.mode === 'image_only' ? 'green' : 'purple'
              }>
                {selectedPrediction.mode?.replace('_', ' ').toUpperCase()}
              </Tag>
            )}
          </div>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
        className="prediction-detail-modal"
      >
        {selectedPrediction ? (
          <div className="space-y-6">
            {/* Summary Stats */}
            <Row gutter={16}>
              <Col span={8}>
                <Card size="small" className="text-center">
                  <Statistic 
                    title="Prediction" 
                    value={selectedPrediction.prediction}
                    valueStyle={{ 
                      color: selectedPrediction.prediction === 'Infected' ? '#cf1322' : '#389e0d',
                      fontSize: '20px'
                    }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" className="text-center">
                  <Statistic 
                    title="Confidence" 
                    value={(selectedPrediction.confidence_score * 100).toFixed(1)}
                    suffix="%"
                    valueStyle={{ fontSize: '20px' }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" className="text-center">
                  <Statistic 
                    title="Risk Level" 
                    value={selectedPrediction.risk_level}
                    valueStyle={{ 
                      color: 
                        selectedPrediction.risk_level === 'Low' ? '#389e0d' :
                        selectedPrediction.risk_level === 'Moderate' ? '#fa8c16' : '#cf1322',
                      fontSize: '20px'
                    }}
                  />
                </Card>
              </Col>
            </Row>

            {/* Details */}
            <Card title="Detailed Information" size="small">
              <Descriptions bordered column={2}>
                <Descriptions.Item label="Timestamp">
                  {dayjs(selectedPrediction.timestamp).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
                <Descriptions.Item label="Mode">
                  <Tag color={
                    selectedPrediction.mode === 'clinical_only' ? 'blue' :
                    selectedPrediction.mode === 'image_only' ? 'green' : 'purple'
                  }>
                    {selectedPrediction.mode?.replace('_', ' ').toUpperCase()}
                  </Tag>
                </Descriptions.Item>
                
                {selectedPrediction.age && (
                  <Descriptions.Item label="Age">{selectedPrediction.age} years</Descriptions.Item>
                )}
                {selectedPrediction.sex && (
                  <Descriptions.Item label="Sex">{selectedPrediction.sex}</Descriptions.Item>
                )}
                
                <Descriptions.Item label="Clinical Score">
                  {selectedPrediction.clinical_score ? 
                    `${(selectedPrediction.clinical_score * 100).toFixed(1)}%` : 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="Image Score">
                  {selectedPrediction.image_score ? 
                    `${(selectedPrediction.image_score * 100).toFixed(1)}%` : 'N/A'}
                </Descriptions.Item>
                
                <Descriptions.Item label="Model Version">
                  <Tag color="geekblue">{selectedPrediction.model_version || 'v1.0'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Computation Time">
                  {selectedPrediction.computation_time ? 
                    `${selectedPrediction.computation_time.toFixed(3)}s` : 'N/A'}
                </Descriptions.Item>

                {selectedPrediction.filename && (
                  <Descriptions.Item label="Image File" span={2}>
                    <Tag color="cyan">{selectedPrediction.filename}</Tag>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            {/* Explanation Section */}
            {selectedPrediction.explanation && (
              <Card title="Explanation" size="small">
                <p className="text-gray-600 italic mb-3">
                  {selectedPrediction.explanation.note}
                </p>
                
                {/* Clinical Scores if available (from hybrid approach) */}
                {selectedPrediction.explanation.clinical_scores && (
                  <div className="mb-3 p-3 bg-blue-50 rounded">
                    <h4 className="font-semibold mb-2">Clinical Syndrome Scores:</h4>
                    <Row gutter={16}>
                      <Col span={8}>
                        <div className="text-center">
                          <div className="text-sm text-gray-500">Malaria Score</div>
                          <div className="text-lg font-bold text-blue-600">
                            {selectedPrediction.explanation.clinical_scores.malaria_score}
                          </div>
                        </div>
                      </Col>
                      <Col span={8}>
                        <div className="text-center">
                          <div className="text-sm text-gray-500">Respiratory Score</div>
                          <div className="text-lg font-bold text-green-600">
                            {selectedPrediction.explanation.clinical_scores.respiratory_score}
                          </div>
                        </div>
                      </Col>
                      <Col span={8}>
                        <div className="text-center">
                          <div className="text-sm text-gray-500">GI Score</div>
                          <div className="text-lg font-bold text-orange-600">
                            {selectedPrediction.explanation.clinical_scores.gi_score}
                          </div>
                        </div>
                      </Col>
                    </Row>
                  </div>
                )}
                
                {selectedPrediction.explanation.contributing_factors && (
                  <div className="mt-2">
                    <span className="font-semibold">Top contributing factors:</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedPrediction.explanation.contributing_factors.map((factor: string, i: number) => (
                        <Tag key={i} color="blue" className="px-3 py-1">
                          {factor}
                        </Tag>
                      ))}
                    </div>
                  </div>
                )}

                {/* Model probability if available */}
                {selectedPrediction.explanation.model_probability && (
                  <div className="mt-3 text-sm text-gray-500">
                    Model probability: {(selectedPrediction.explanation.model_probability * 100).toFixed(1)}%
                  </div>
                )}
              </Card>
            )}

            {/* Heatmap if available */}
            {selectedPrediction.heatmap_path && (
              <Card title="Grad-CAM Heatmap" size="small">
                <div className="flex justify-center">
                  <img 
                    src={`http://localhost:8000/static/heatmaps/${selectedPrediction.heatmap_path}`}
                    alt="Grad-CAM Heatmap"
                    className="max-w-full h-auto rounded-lg border shadow-sm"
                    style={{ maxHeight: '300px' }}
                  />
                </div>
                <p className="text-sm text-gray-500 text-center mt-2">
                  Heatmap shows regions the model focused on for diagnosis
                </p>
              </Card>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <Spin />
          </div>
        )}
      </Modal>
    </div>
  );
}