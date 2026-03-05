'use client';

import { Card, Checkbox, Row, Col, Badge } from 'antd';
import { 
  MedicineBoxOutlined, 
  ThunderboltOutlined,
  UserOutlined,
  BulbOutlined,
  CoffeeOutlined,
  ExperimentOutlined,
  WarningOutlined,
  HeartOutlined,
  DashboardOutlined,
  CloudOutlined,
  FireOutlined
} from '@ant-design/icons';

interface SymptomChecklistProps {
  selectedSymptoms: Record<string, boolean>;
  onChange: (symptom: string, checked: boolean) => void;
}

const symptoms = [
  { name: 'Fever', icon: <FireOutlined className="text-red-500" />, color: 'red' },
  { name: 'Headache', icon: <BulbOutlined className="text-yellow-600" />, color: 'gold' },
  { name: 'Abdominal Pain', icon: <HeartOutlined className="text-orange-500" />, color: 'orange' },
  { name: 'General Body Malaise', icon: <UserOutlined className="text-blue-500" />, color: 'blue' },
  { name: 'Dizziness', icon: <ExperimentOutlined className="text-purple-500" />, color: 'purple' },
  { name: 'Vomiting', icon: <CoffeeOutlined className="text-green-600" />, color: 'green' },
  { name: 'Confusion', icon: <WarningOutlined className="text-red-400" />, color: 'red' },
  { name: 'Backache', icon: <DashboardOutlined className="text-brown-500" />, color: 'brown' },
  { name: 'Chest Pain', icon: <HeartOutlined className="text-pink-500" />, color: 'pink' },
  { name: 'Coughing', icon: <CloudOutlined className="text-cyan-500" />, color: 'cyan' },
  { name: 'Joint Pain', icon: <MedicineBoxOutlined className="text-indigo-500" />, color: 'indigo' },
];

export default function SymptomChecklist({ selectedSymptoms, onChange }: SymptomChecklistProps) {
  const selectedCount = Object.values(selectedSymptoms).filter(Boolean).length;

  return (
    <Card 
      title={
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold flex items-center gap-2">
            <ThunderboltOutlined className="text-yellow-500" />
            Clinical Symptoms
          </span>
          <Badge 
            count={`${selectedCount}/11`} 
            style={{ backgroundColor: selectedCount >= 3 ? '#52c41a' : '#faad14' }}
            title={`${selectedCount} symptoms selected (minimum 3 required)`}
          />
        </div>
      }
      className="shadow-md"
    >
      <Row gutter={[16, 12]}>
        {symptoms.map((symptom) => (
          <Col xs={24} sm={12} md={8} lg={6} key={symptom.name}>
            <div 
              className={`
                p-3 rounded-lg border transition-all cursor-pointer
                ${selectedSymptoms[symptom.name] 
                  ? `bg-${symptom.color}-50 border-${symptom.color}-300 shadow-sm` 
                  : 'hover:bg-gray-50 border-gray-200'
                }
              `}
              onClick={() => onChange(symptom.name, !selectedSymptoms[symptom.name])}
            >
              <Checkbox 
                checked={selectedSymptoms[symptom.name] || false}
                onChange={(e) => onChange(symptom.name, e.target.checked)}
                className="w-full"
              >
                <span className="flex items-center gap-2 ml-2">
                  {symptom.icon}
                  <span className={selectedSymptoms[symptom.name] ? `text-${symptom.color}-700` : ''}>
                    {symptom.name}
                  </span>
                </span>
              </Checkbox>
            </div>
          </Col>
        ))}
      </Row>
      
      {selectedCount < 3 && selectedCount > 0 && (
        <div className="mt-4 p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
          ⚠️ Please select at least {3 - selectedCount} more symptom(s) for prediction
        </div>
      )}
    </Card>
  );
}
