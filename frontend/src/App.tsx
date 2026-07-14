import { Suspense } from 'react';
import { App as AntdApp, ConfigProvider, Spin, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AIChatProvider } from '@EADAF/ai-base';
import '@EADAF/ai-base/style.css';
import { BrowserRouter } from 'react-router-dom';
import AIChatClientToolsRegistrar from '@/components/AIChatClientToolsRegistrar';
import { ChatSessionGroupProvider } from '@/ai/ChatSessionGroupProvider';
import { createAIChatConfig } from '@/config/aiChat';
import { InitialStateProvider } from '@/providers/InitialStateProvider';
import AppRoutes from '@/routes';
import { setupAIMutationRouter } from '@/ai/toolMutation';
import { AntdAppApiBridge } from '@/utils/antdAppApis';
import { setupAiToolDevLogger } from '@/utils/aiToolDevLogger';
import { setupAiToolInvokeFileLogger } from '@/utils/toolInvokeFileLogger';
import { getAuth } from '@/utils/auth';

setupAiToolDevLogger();
setupAiToolInvokeFileLogger();
setupAIMutationRouter();

const originalError = console.error;
console.error = (...args) => {
  if (
    args[0]?.includes?.('is deprecated') ||
    args[0]?.includes?.('net::ERR_FILE_NOT_FOUND') ||
    args[0]?.includes?.('[antd: ConfigProvider]') ||
    args[0]?.includes?.('[antd: Tabs] `indicatorSize`') ||
    args[0]?.includes?.(
      'Unchecked runtime.lastError: The message port closed before a response was received.',
    )
  ) {
    return;
  }
  originalError.call(console, ...args);
};

const aiChatConfig = createAIChatConfig(() => getAuth().token || null);

export default function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
        },
      }}
    >
      <AntdApp>
        <AntdAppApiBridge>
          <InitialStateProvider>
            <BrowserRouter>
              <ChatSessionGroupProvider>
                <AIChatProvider config={aiChatConfig}>
                  <AIChatClientToolsRegistrar />
                  <Suspense
                    fallback={
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          height: '100vh',
                        }}
                      >
                        <Spin size="large" />
                      </div>
                    }
                  >
                    <AppRoutes />
                  </Suspense>
                </AIChatProvider>
              </ChatSessionGroupProvider>
            </BrowserRouter>
          </InitialStateProvider>
        </AntdAppApiBridge>
      </AntdApp>
    </ConfigProvider>
  );
}
