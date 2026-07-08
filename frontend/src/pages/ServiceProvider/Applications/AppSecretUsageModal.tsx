import { Alert, Modal, Typography } from 'antd';
import React from 'react';
import { resolveApiUrl } from '@/constants/env';

const { Paragraph, Text, Title } = Typography;

interface AppSecretUsageModalProps {
  open: boolean;
  application?: {
    application_id?: string;
    name?: string;
    code?: string;
  } | null;
  onClose: () => void;
}

const AppSecretUsageModal: React.FC<AppSecretUsageModalProps> = ({ open, application, onClose }) => {
  const tokenUrl = resolveApiUrl('/api/v1/applications/token');
  const appId = application?.application_id || '<application_id>';
  const appName = application?.name || '当前应用';

  const requestExample = `POST ${tokenUrl}
Content-Type: application/json

{
  "application_id": "${appId}",
  "app_secret": "<您的应用私钥>"
}`;

  const usageExample = `Authorization: Bearer <返回的 token>`;

  return (
    <Modal
      title={`密钥使用说明 — ${appName}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={640}
      destroyOnHidden
    >
      <Alert
        type="warning"
        showIcon
        title="应用私钥（app_secret）属于机密信息"
        description="仅保存在贵司服务端，勿写入前端代码、勿提交到 Git、勿通过 URL 或日志泄露。泄露后请立即在「密钥管理」中重新生成。"
        style={{ marginBottom: 16 }}
      />

      <Typography>
        <Title level={5}>使用流程</Title>
        <Paragraph>
          <ol style={{ paddingLeft: 20, margin: 0 }}>
            <li>在「密钥管理」中生成或复制 <Text code>app_secret</Text>（与 SSO 共用同一密钥）。</li>
            <li>
              贵司<strong>服务端</strong>调用下方接口，提交 <Text code>application_id</Text> 与{' '}
              <Text code>app_secret</Text>，EADAF 校验通过后<strong>签发 JWT Token</strong>（无需在本地自行加密签名）。
            </li>
            <li>
              调用文件存储、业务 API 等接口时，在请求头携带{' '}
              <Text code>Authorization: Bearer {'{token}'}</Text>。
            </li>
            <li>Token 过期后重复第 2 步换取新 Token（默认有效期 24 小时，以服务端配置为准）。</li>
          </ol>
        </Paragraph>

        <Title level={5} style={{ marginTop: 16 }}>
          1. 换取 Token
        </Title>
        <Paragraph>
          <pre
            style={{
              background: '#f5f5f5',
              padding: 12,
              borderRadius: 8,
              fontSize: 12,
              overflow: 'auto',
            }}
          >
            {requestExample}
          </pre>
        </Paragraph>
        <Paragraph type="secondary" style={{ fontSize: 12 }}>
          成功响应示例：<Text code>{'{"code":200,"data":{"token":"eyJ..."}}'}</Text>
        </Paragraph>

        <Title level={5}>2. 携带 Token 访问 API</Title>
        <Paragraph>
          <pre
            style={{
              background: '#f5f5f5',
              padding: 12,
              borderRadius: 8,
              fontSize: 12,
            }}
          >
            {usageExample}
          </pre>
        </Paragraph>

        <Title level={5} style={{ marginTop: 16 }}>
          安全建议
        </Title>
        <ul style={{ paddingLeft: 20, margin: 0, color: 'rgba(0,0,0,0.65)' }}>
          <li>私钥只用于服务端到 EADAF 的 Token 换取，不要下发给浏览器或移动端。</li>
          <li>生产环境请使用 HTTPS，并在配置中心或密钥管理服务中存储私钥。</li>
          <li>不同环境（开发/测试/生产）应使用不同应用与密钥。</li>
        </ul>
      </Typography>
    </Modal>
  );
};

export default AppSecretUsageModal;
