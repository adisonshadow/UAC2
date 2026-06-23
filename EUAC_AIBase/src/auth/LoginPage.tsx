import { Button, Card, Badge, Typography } from 'antd';
import { buildSsoLoginUrl } from './auth';

export default function LoginPage() {
  const handleLogin = () => {
    window.location.href = buildSsoLoginUrl();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <Badge.Ribbon text="业务系统接入样板">
        <Card style={{ width: 420 }}>
          <Typography.Title level={4}>EUAC AIBase Demo</Typography.Title>
          <Typography.Text style={{ fontSize: 28, fontWeight: 600 }}>销售管理系统</Typography.Text>
          
          <Typography.Paragraph type="secondary" style={{ marginTop: 26 }}>
            请先通过单点登录（应用：EUAC_AIBase）。
          </Typography.Paragraph>

          <Button type="primary" block size="large" onClick={handleLogin}>
            前往登录
          </Button>

        </Card>
      </Badge.Ribbon>
    </div>
  );
}
