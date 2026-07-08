import { PartitionOutlined } from '@ant-design/icons';
import { BizdataScopePickerModal } from '@/components/BizdataScopePicker';
import { Button, Space, Tag, Typography } from 'antd';
import React, { useState } from 'react';

const { Text } = Typography;

export type ApiServiceScopeLookupProps = {
  value?: string;
  onChange?: (scopeCode?: string) => void;
  disabled?: boolean;
};

const ApiServiceScopeLookup: React.FC<ApiServiceScopeLookupProps> = ({
  value,
  onChange,
  disabled,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Space wrap>
        {value ? (
          <Tag icon={<PartitionOutlined />} color="blue">
            {value}
          </Tag>
        ) : (
          <Text type="secondary">未选择 Scope</Text>
        )}
        <Button disabled={disabled} onClick={() => setOpen(true)}>
          选择 Scope
        </Button>
        {value && !disabled && (
          <Button type="link" onClick={() => onChange?.(undefined)}>
            清除
          </Button>
        )}
      </Space>
      <BizdataScopePickerModal
        open={open}
        title="选择 Scope（单选）"
        value={value ? [value] : []}
        maxSelection={1}
        onOk={(codes) => {
          onChange?.(codes[0]);
          setOpen(false);
        }}
        onCancel={() => setOpen(false)}
      />
    </>
  );
};

export default ApiServiceScopeLookup;
