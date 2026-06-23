import React from 'react';
import { Tooltip, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';

interface UUIDDisplayProps {
  uuid: string;
  style?: React.CSSProperties;
}

const UUIDDisplay: React.FC<UUIDDisplayProps> = ({ uuid, style }) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(uuid).then(() => {
      message.success('复制成功');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  const displayText = uuid ? `${uuid.slice(0, 3)}...${uuid.slice(-2)}` : '';

  return (
    <Tooltip title={uuid}>
      <span 
        style={{ 
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          ...style 
        }}
        onClick={handleCopy}
      >
        {displayText}
        <CopyOutlined style={{ fontSize: '12px', color: '#1890ff' }} />
      </span>
    </Tooltip>
  );
};

export default UUIDDisplay; 