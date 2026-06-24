import { Suspense } from 'react';
import { ConfigProvider, Spin, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AIChatProvider } from '@euac/ai-base';
import '@euac/ai-base/style.css';
import { BrowserRouter } from 'react-router-dom';
import { InitialStateProvider } from '@/providers/InitialStateProvider';
import { setupAiToolDevLogger } from '@/utils/aiToolDevLogger';
import { getAuth } from '@/utils/auth';
import AppRoutes from '@/routes';

setupAiToolDevLogger();

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
      <InitialStateProvider>
        <BrowserRouter>
          <AIChatProvider
            config={{
              apiBase: '/api',
              getToken: () => getAuth().token || null,
              headerOffset: 64,
              hiddenPaths: ['/auth/login', '/auth/reset-password', '/account/center'],
            }}
          >
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
        </BrowserRouter>
      </InitialStateProvider>
    </ConfigProvider>
  );
}
