import { Empty, List, Tag } from 'antd';
import React from 'react';
import { optionsFromEnum } from '../../utils/enumUtils';

interface EnumOptionsPreviewProps {
  record: API.BusinessDataEnum;
}

const EnumOptionsPreview: React.FC<EnumOptionsPreviewProps> = ({ record }) => {
  const options = optionsFromEnum(record);
  if (!options.length) {
    return <Empty description="暂无选项" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }
  return (
    <List
      size="small"
      style={{ maxWidth: 320, maxHeight: 280, overflow: 'auto' }}
      dataSource={options}
      renderItem={(item) => (
        <List.Item style={{ padding: '6px 0' }}>
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Tag color="blue">{item.value}</Tag>
              {item.order != null && (
                <span style={{ color: '#999', fontSize: 12 }}>排序 {item.order}</span>
              )}
            </div>
            <div>{item.label}</div>
            {item.description && (
              <div style={{ color: '#999', fontSize: 12 }}>{item.description}</div>
            )}
          </div>
        </List.Item>
      )}
    />
  );
};

export default EnumOptionsPreview;
