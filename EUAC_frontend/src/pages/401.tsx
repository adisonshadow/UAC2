import { history } from '@umijs/max';
import { Button, Result } from 'antd';
import React from 'react';

const NoFoundPage: React.FC = () => (
  <Result
    status="403"
    title="您的账户被锁定或已失效"
    subTitle="请联系管理员处理"
    extra={
      <Button type="primary" onClick={() => history.push('/')}>
        回到首页
      </Button>
    }
  />
);

export default NoFoundPage;
