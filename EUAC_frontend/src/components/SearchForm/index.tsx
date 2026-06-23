import { Form, Input, Button, Space } from 'antd';
import { SearchOutlined, ClearOutlined } from '@ant-design/icons';
import React from 'react';

interface SearchFormProps {
  onSearch: (value: string) => void;
  onReset: () => void;
  placeholder?: string;
  width?: number;
}

const SearchForm: React.FC<SearchFormProps> = ({
  onSearch,
  onReset,
  placeholder = '请输入搜索内容',
  width = 200,
}) => {
  const [form] = Form.useForm();

  const handleSearch = () => {
    const values = form.getFieldsValue();
    onSearch(values.searchText || '');
  };

  const handleReset = () => {
    form.resetFields();
    onReset();
  };

  return (
    <Form
      form={form}
      style={{ margin: 0, display: 'flex', alignItems: 'center' }}
      onFinish={handleSearch}
    >
      <Form.Item
        name="searchText"
        style={{ margin: 0, marginRight: 8 }}
      >
        <Input
          placeholder={placeholder}
          style={{ width }}
          allowClear
          onPressEnter={handleSearch}
        />
      </Form.Item>
      <Space>
        <Button
          type="primary"
          ghost
          icon={<SearchOutlined />}
          onClick={handleSearch}
        >
          搜索
        </Button>
        <Button
          icon={<ClearOutlined />}
          onClick={handleReset}
        />
      </Space>
    </Form>
  );
};

export default SearchForm; 