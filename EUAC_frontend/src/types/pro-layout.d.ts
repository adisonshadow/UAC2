import { ProLayoutProps } from '@ant-design/pro-layout';

declare module '@ant-design/pro-layout' {
  interface ProLayoutProps {
    customConfig?: {
      showCustomHeader?: boolean;
      customThemeColor?: string;
      // 其他自定义配置...
    };
  }
} 