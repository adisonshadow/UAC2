import { history } from '@umijs/max';
import { Button, Result } from 'antd';
import React from 'react';

const NoFoundPage: React.FC = () => (
  <Result
    status="403"
    title="禁止访问"
    subTitle="您没有权限访问该页面"
    extra={
      <Button type="primary" onClick={() => history.push('/')}>
        回到首页
      </Button>
    }
  />
);

export default NoFoundPage;
