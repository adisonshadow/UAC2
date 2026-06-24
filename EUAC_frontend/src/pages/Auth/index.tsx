import { Footer } from '@/components';
import { getHealth } from '@/services/UAC/api/health';
import { getAuthCheck, postAuthLogin } from '@/services/UAC/api/auth';
import { getApplicationsSsoId } from '@/services/UAC/api/applicationsSso';
import { getCaptcha } from '@/services/UAC/api/captcha';
import { history } from '@/utils/navigation';
import { useInitialState } from '@/providers/InitialStateProvider';
import { Helmet } from '@/components/Helmet';
import { message, Modal, Form, Input, Button, Card, Space, Spin, Result } from 'antd';
import Lottie from 'react-lottie-player';
import React, { useState, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import SliderCaptchaComponent, { SliderCaptchaRef } from '@/components/SliderCaptcha';
import bigdataLottie from '@/assets/lotties/bigdata-2.json';
import loadingLottie from '@/assets/lotties/loading.json';
import './index.scss';
import { saveAuth, checkAuth, checkTokenValid, parseAuthUser } from '@/utils/auth';
import { getApiErrorMessage } from '@/utils/apiResponse';
import { normalizeUploadFileId } from '@/utils/image';
// import { useAIChatDisplayMode } from '@euac/ai-base';

interface LoginParams {
  username: string;
  password: string;
  type?: string;
  captcha_data?: {
    captcha_id: string;
  };
}

interface UserInfo {
  user_id: string;
  username: string;
  name: string;
  avatar: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  email: string;
  phone: string | null;
  status: 'ACTIVE' | 'DISABLED' | 'LOCKED' | 'ARCHIVED';
  department_id: string | null;
  must_change_password?: boolean;
}

interface ApplicationInfo {
  application_id?: string;
  name?: string;
  sso_enabled?: boolean;
  sso_config?: {
    redirect_uri?: string;
    protocol?: string;
    currentTimestamp?: string;
    secret?: string;
    redirect_mode?: 'POST_REDIRECT' | 'HEADER_REDIRECT';
    salt?: string;
    base_url?: string;
    client_id?: string;
    client_secret?: string;
    issuer?: string;
    frontend_url?: string;
  };
}

interface SsoErrorInfo {
  message: string;
}

interface LoginResponse {
  code?: number;
  message?: string;
  data?: {
    token?: string;
    refresh_token?: string;
    expires_in?: string;
    user_id?: string;
    need_captcha?: boolean;
    must_change_password?: boolean;
    sso?: {
      application_id?: string;
      application_name?: string;
      application_code?: string;
      sso_config?: API.SSOConfig;
    };
  };
}

const LoginPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [loginParams, setLoginParams] = useState<LoginParams | null>(null);
  const [captchaId, setCaptchaId] = useState<string>('');
  const [applicationInfo, setApplicationInfo] = useState<ApplicationInfo | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [redirectMessage, setRedirectMessage] = useState('');
  const [ssoError, setSsoError] = useState<SsoErrorInfo | null>(null);
  const [isApplicationInfoLoaded, setIsApplicationInfoLoaded] = useState(false);
  const captchaRef = useRef<SliderCaptchaRef>(null);
  const ssoRedirectStartedRef = useRef(false);
  const { setInitialState } = useInitialState();

  // useAIChatDisplayMode('hidden');

  // 独立的SSO回调方法（显式传入 SSO 应用信息，避免闭包读取到过期的 applicationInfo）
  const submitSsoCallback = (
    ssoAppInfo: ApplicationInfo,
    userInfo: UserInfo,
    token: string,
    refreshToken?: string,
  ) => {
    console.log('submitSsoCallback', ssoAppInfo, userInfo, token, refreshToken);
    if (!ssoAppInfo?.sso_enabled || !ssoAppInfo?.sso_config?.redirect_uri) {
      console.warn('SSO 配置不完整，跳过跳转');
      return;
    }

    const { redirect_uri, protocol, currentTimestamp, secret, redirect_mode } = ssoAppInfo.sso_config;
    
    if (protocol === 'OIDC') {
      // 检查跳转模式
      if (redirect_mode === 'HEADER_REDIRECT') {
        // 302重定向模式：通过URL参数传递JWT信息
        console.log('使用302重定向模式跳转到:', redirect_uri);
        
        // 构建包含JWT信息的URL
        const url = new URL(redirect_uri);
        url.searchParams.set('access_token', token);
        if (refreshToken) {
          url.searchParams.set('refresh_token', refreshToken);
        }
        url.searchParams.set('token_type', 'Bearer');
        url.searchParams.set('expires_in', '3600');
        
        // 添加state参数
        const stateParam = new URLSearchParams(window.location.search).get('state');
        if (stateParam) {
          url.searchParams.set('state', stateParam);
        }
        
        // 添加验证信息
        url.searchParams.set('verify', JSON.stringify({
          timestamp: currentTimestamp || "null",
          public_secret: secret,
          expires_in: 600,
        }));
        
        // 添加用户信息
        url.searchParams.set('user_info', JSON.stringify({
          user_id: userInfo.user_id,
          username: userInfo.username,
          name: userInfo.name,
          email: userInfo.email,
          phone: userInfo.phone,
          gender: userInfo.gender,
          status: userInfo.status,
          avatar: normalizeUploadFileId(userInfo.avatar),
          department_id: userInfo.department_id
        }));
        
        console.log('302重定向URL:', url.toString());
        window.location.href = url.toString();
        return;
      }
      
      // POST跳转模式（默认）：使用表单提交
      // 创建一个隐藏的表单来提交 POST 请求
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = redirect_uri;
      form.enctype = 'application/x-www-form-urlencoded';
      form.style.display = 'none';

      // 添加 IdP 信息
      const idpInput = document.createElement('input');
      idpInput.type = 'hidden';
      idpInput.name = 'idp';
      idpInput.value = 'IAM';
      form.appendChild(idpInput);

      // 添加 Access Token
      const accessTokenInput = document.createElement('input');
      accessTokenInput.type = 'hidden';
      accessTokenInput.name = 'access_token';
      accessTokenInput.value = token;
      form.appendChild(accessTokenInput);

      // 添加 Refresh Token
      const refreshTokenInput = document.createElement('input');
      refreshTokenInput.type = 'hidden';
      refreshTokenInput.name = 'refresh_token';
      refreshTokenInput.value = refreshToken || '';
      form.appendChild(refreshTokenInput);

      // 添加 Token Type
      const tokenTypeInput = document.createElement('input');
      tokenTypeInput.type = 'hidden';
      tokenTypeInput.name = 'token_type';
      tokenTypeInput.value = 'Bearer';
      form.appendChild(tokenTypeInput);

      // 添加过期时间
      const expiresInInput = document.createElement('input');
      expiresInInput.type = 'hidden';
      expiresInInput.name = 'expires_in';
      expiresInInput.value = '3600'; // 默认1小时，可以根据实际情况调整
      form.appendChild(expiresInInput);

      // 添加 state 参数
      const stateInput = document.createElement('input');
      stateInput.type = 'hidden';
      stateInput.name = 'state';
      stateInput.value = new URLSearchParams(window.location.search).get('state') || '';
      form.appendChild(stateInput);

      // 添加合法性验证信息
      const verifyInput = document.createElement('input');
      verifyInput.type = 'hidden';
      verifyInput.name = 'verify';
      verifyInput.value = JSON.stringify({
        timestamp: currentTimestamp || "null",
        public_secret: secret,
        expires_in: 600,
      });
      form.appendChild(verifyInput);

      // 添加用户信息
      const userInfoInput = document.createElement('input');
      userInfoInput.type = 'hidden';
      userInfoInput.name = 'user_info';
      userInfoInput.value = JSON.stringify({
        user_id: userInfo.user_id,
        username: userInfo.username,
        name: userInfo.name,
        email: userInfo.email,
        phone: userInfo.phone,
        gender: userInfo.gender,
        status: userInfo.status,
        avatar: normalizeUploadFileId(userInfo.avatar),
        department_id: userInfo.department_id
      });
      form.appendChild(userInfoInput);

      // 将表单添加到文档并提交
      document.body.appendChild(form);
      // 打印表单中的所有值
      const formData = new FormData(form);
      console.log('Form data:');
      for (const [key, value] of formData.entries()) {
        console.log(`${key}: ${value}`);
      }
      form.submit();
    }
  };

  const resolveSsoError = (error: unknown): SsoErrorInfo => ({
    message: getApiErrorMessage(error, 'SSO 登录失败'),
  });

  const performSsoRedirect = async (
    appId: string,
    userInfo: UserInfo,
    token: string,
    refreshToken?: string,
  ) => {
    try {
      const response = await getApplicationsSsoId({ id: appId }, { skipErrorHandler: true });
      if (response.code === 200 && response.data?.sso_enabled && response.data?.sso_config?.redirect_uri) {
        setSsoError(null);
        submitSsoCallback(response.data, userInfo, token, refreshToken);
        return;
      }
      setSsoError({
        message: getApiErrorMessage(response, 'SSO 登录失败'),
      });
      ssoRedirectStartedRef.current = false;
    } catch (error) {
      console.error('SSO 跳转失败:', error);
      setSsoError(resolveSsoError(error));
      ssoRedirectStartedRef.current = false;
    }
  };

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await getHealth();
        if (response.code !== 200) {
          Modal.error({
            title: '系统异常',
            content: '系统服务暂时不可用，请稍后再试',
            okText: '确定',
          });
          return;
        }

        // 检查数据库状态
        if (response.data?.database?.status === 'error') {
          Modal.error({
            title: '数据库异常',
            content: response.data.database.message || '数据库连接异常，请稍后再试',
            okText: '确定',
          });
          return;
        }
        
      } catch (error) {
        Modal.error({
          title: '网络异常',
          content: '无法连接到服务器，请检查网络连接',
          okText: '确定',
        });
      }
    };

    const fetchApplicationInfo = async () => {
      const urlParams = new URL(window.location.href).searchParams;
      const appId = urlParams.get('app');
      if (!appId) {
        setIsApplicationInfoLoaded(true);
        return;
      }
      if (isApplicationInfoLoaded) {
        return;
      }
      try {
        const response = await getApplicationsSsoId({ id: appId }, { skipErrorHandler: true });
        if (response.code === 200 && response.data) {
          setApplicationInfo(response.data);
          setSsoError(null);
        } else {
          setSsoError({
            message: getApiErrorMessage(response, 'SSO 登录失败'),
          });
        }
      } catch (error) {
        setSsoError(resolveSsoError(error));
      } finally {
        setIsApplicationInfoLoaded(true);
      }
    };

    const checkUserLoginStatus = async () => {
      try {
        setIsCheckingAuth(true);
        const isTokenValid = await checkTokenValid();
        
        if (isTokenValid) {
          setIsLoggedIn(true);
          const urlParams = new URL(window.location.href).searchParams;
          const appId = urlParams.get('app');
          if (!appId) {
            setRedirectMessage('您已登录，正在打开管理界面……');
          }
        }
      } catch (error) {
        console.error('检查登录状态失败:', error);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkHealth();
    fetchApplicationInfo();
    checkUserLoginStatus();
  }, []); // 移除依赖项，避免循环调用

  // 已登录用户的 SSO / 管理台跳转（等待 applicationInfo 加载完成且无 SSO 错误后再执行）
  useEffect(() => {
    if (!isLoggedIn || isCheckingAuth || ssoRedirectStartedRef.current || ssoError) {
      return;
    }

    const urlParams = new URL(window.location.href).searchParams;
    const appId = urlParams.get('app');

    if (!appId) {
      ssoRedirectStartedRef.current = true;
      const timer = setTimeout(() => {
        history.push('/');
      }, 1500);
      return () => clearTimeout(timer);
    }

    if (!isApplicationInfoLoaded) {
      return;
    }

    setRedirectMessage(
      applicationInfo?.name
        ? `您已登录，正在打开 ${applicationInfo.name} 应用……`
        : '您已登录，正在打开应用……',
    );

    ssoRedirectStartedRef.current = true;
    const timer = setTimeout(async () => {
      try {
        const userData = parseAuthUser(await getAuthCheck({}));
        if (!userData) {
          message.error('获取用户信息失败');
          ssoRedirectStartedRef.current = false;
          return;
        }
        const userInfo: UserInfo = {
          user_id: userData.user_id,
          username: userData.username,
          name: userData.name,
          avatar: userData.avatar,
          gender: userData.gender,
          email: userData.email,
          phone: userData.phone,
          status: userData.status,
          department_id: userData.department_id,
        };
        const token = localStorage.getItem('token') || '';
        const refreshToken = localStorage.getItem('refresh_token') || '';
        await performSsoRedirect(appId, userInfo, token, refreshToken);
      } catch (error) {
        console.error('SSO 自动跳转失败:', error);
        setSsoError(resolveSsoError(error));
        ssoRedirectStartedRef.current = false;
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [isLoggedIn, isCheckingAuth, isApplicationInfoLoaded, applicationInfo, ssoError]);

  const handleLoginSuccess = async (userInfo: UserInfo, token: string, refreshToken?: string) => {
    try {

      // 保存 token
      saveAuth(token, refreshToken);

      // 等待一下，确保 token 已经保存
      await new Promise(resolve => setTimeout(resolve, 100));

      // 获取用户信息
      const userResponse = await getAuthCheck({});
      const userData = parseAuthUser(userResponse);

      if (userData) {
        const updatedUserInfo: UserInfo = {
          user_id: userData.user_id || '',
          username: userInfo.username,
          name: userData.name || userInfo.username,
          avatar: normalizeUploadFileId(userData.avatar),
          gender: userData.gender as UserInfo['gender'],
          email: userData.email || '',
          phone: userData.phone || null,
          status: userData.status as UserInfo['status'],
          department_id: userData.department_id || null,
          must_change_password: userData.must_change_password,
        };

        flushSync(() => {
          setInitialState((s:any) => ({
            ...s,
            currentUser: updatedUserInfo,
          }));
        });

        if (updatedUserInfo.must_change_password) {
          message.info('首次登录请先修改默认密码');
          history.push('/account/center');
          return;
        }

        // 处理 SSO 回调 - 只有在URL中有app参数时才执行SSO回调
        const urlParams = new URL(window.location.href).searchParams;
        const appId = urlParams.get('app');
        
        if (appId) {
          await performSsoRedirect(appId, updatedUserInfo, token, refreshToken);
          return;
        }

        // 验证权限并跳转
        const redirect = urlParams.get('redirect');
        if (redirect) {
          // 保留 app 参数
          const appId = urlParams.get('app');
          const redirectWithApp = appId ? `${redirect}${redirect.includes('?') ? '&' : '?'}app=${appId}` : redirect;
          history.push(redirectWithApp);
        } else {
          await checkAuth(setInitialState);
        }
      } else {
        // throw new Error('获取用户信息失败');
        message.error('登录失败，请重试');
      }
    } catch (error) {
      // 清除 token
      saveAuth('', '');
      message.error('登录失败，请重试');
    }
  };

  const handleLogin = async (loginData: LoginParams) => {
    try {
      setLoading(true);
      const msg = await postAuthLogin(loginData) as LoginResponse;

      if (msg.data?.token) {
        message.success('登录成功！');
        setShowCaptcha(false);

        // 存储token
        saveAuth(msg.data.token, msg.data.refresh_token);

        // 检查是否有SSO信息需要处理 - 只有在URL中有app参数时才处理SSO
        const urlParams = new URL(window.location.href).searchParams;
        const appId = urlParams.get('app');
        
        if (msg.data?.sso && appId) {
          const ssoInfo = msg.data.sso;
          console.log('登录响应中包含SSO信息:', ssoInfo);
          
          // 更新应用信息
          setApplicationInfo({
            application_id: ssoInfo.application_id,
            name: ssoInfo.application_name,
            sso_enabled: true,
            sso_config: {
              redirect_uri: ssoInfo.sso_config?.redirect_uri,
              protocol: ssoInfo.sso_config?.protocol,
              currentTimestamp:
                ssoInfo.sso_config?.currentTimestamp != null
                  ? String(ssoInfo.sso_config.currentTimestamp)
                  : undefined,
              secret: ssoInfo.sso_config?.secret,
              redirect_mode: ssoInfo.sso_config?.redirect_mode,
              salt: ssoInfo.sso_config?.salt,
              base_url: ssoInfo.sso_config?.base_url,
              client_id: ssoInfo.sso_config?.client_id,
              client_secret: ssoInfo.sso_config?.client_secret,
              issuer: ssoInfo.sso_config?.issuer,
              frontend_url: ssoInfo.sso_config?.frontend_url,
            }
          });
          
          // 获取用户信息
          const userData = parseAuthUser(await getAuthCheck({}, { skipErrorHandler: true }));
          if (userData) {
            const userInfo: UserInfo = {
              user_id: userData.user_id,
              username: loginData.username,
              name: userData.name || loginData.username,
              avatar: userData.avatar,
              gender: userData.gender,
              email: userData.email,
              phone: userData.phone,
              status: userData.status,
              department_id: userData.department_id,
            };

            await handleLoginSuccess(userInfo, msg.data.token, msg.data.refresh_token);
            return true;
          }
        } else {
          const userData = parseAuthUser(await getAuthCheck({}, { skipErrorHandler: true }));
          if (userData) {
            const userInfo: UserInfo = {
              user_id: userData.user_id,
              username: loginData.username,
              name: userData.name || loginData.username,
              avatar: userData.avatar,
              gender: userData.gender,
              email: userData.email,
              phone: userData.phone,
              status: userData.status,
              department_id: userData.department_id,
            };

            await handleLoginSuccess(userInfo, msg.data.token, msg.data.refresh_token);
            return true;
          }
        }
      } else if (msg.data?.need_captcha) {
        setLoginParams(loginData);
        const response = await getCaptcha();
        if (!response.data?.captcha_id) {
          message.error('获取验证码失败，请重试！');
        } else {
          setCaptchaId(response.data.captcha_id);
          setShowCaptcha(true);
        }
      } else {
        message.error(msg.message || '登录失败');
      }
      return false;
    } catch (error) {
      message.error('登录失败，请稍后重试');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: LoginParams) => {
    await handleLogin(values);
  };

  const handleCaptchaSuccess = async (duration: number, trail: { x?: number; y?: number; timestamp?: number }[]) => {
    if (!loginParams || !captchaId) return;

    try {
      const loginData = {
        ...loginParams,
        captcha_data: {
          captcha_id: captchaId,
        },
      };
      
      const success = await handleLogin(loginData);
      if (!success) {
        setShowCaptcha(false);
        captchaRef.current?.reset();
      }
    } catch (error: any) {
      setShowCaptcha(false);
      captchaRef.current?.reset();
      message.error(error.response?.data?.message || '登录失败', 20);
    }
  };

  const pageTitle = applicationInfo?.name || 'IAM';
  const pageDescription = applicationInfo?.sso_enabled ? '请使用统一身份认证登录' : '请使用用户名和密码登录';
  const appIdFromUrl = new URLSearchParams(window.location.search).get('app');
  const isLoadingSsoContext = isCheckingAuth || (Boolean(appIdFromUrl) && !isApplicationInfoLoaded);

  // 背景组件
  const AuthBackground = () => (
    <div className="auth-bg">
      <img src="/images/bg.svg" alt="background" className="bg-image" />
      <div className="bg-text">
        {/* <div className="title">IAM</div> */}
      </div>
      <Lottie
        className="lottie-bg"
        animationData={bigdataLottie}
        loop
        play
      />
    </div>
  );

  // 页面容器组件
  const AuthPageContainer = ({ children }: { children: React.ReactNode }) => (
    <div className="auth-page">
      <Helmet>
        <title>登录- {pageTitle}</title>
      </Helmet>
      <AuthBackground />
      <div className="auth-content">
        {children}
        <Footer />
      </div>
    </div>
  );

  const renderSsoError = () => (
    <Card className="auth-card" variant="borderless">
      <Result
        status="error"
        title={ssoError?.message || 'SSO 登录失败'}
        subTitle={undefined}
        extra={[
          <Button type="primary" key="retry" onClick={() => window.location.reload()}>
            重试
          </Button>,
        ]}
      />
    </Card>
  );

  // 正在检查登录状态或加载 SSO 应用配置
  if (isLoadingSsoContext) {
    return (
      <AuthPageContainer>
        <Card className="auth-card" variant="borderless">
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: '20px', color: '#666' }}>
              {appIdFromUrl ? '正在加载 SSO 应用配置...' : '正在检查登录状态...'}
            </div>
          </div>
        </Card>
      </AuthPageContainer>
    );
  }

  if (ssoError) {
    return (
      <AuthPageContainer>
        {renderSsoError()}
      </AuthPageContainer>
    );
  }

  // 如果已登录且无 SSO 错误，显示重定向提示
  if (isLoggedIn) {
    return (
      <AuthPageContainer>
        <Card className="auth-card" variant="borderless">
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Lottie
              style={{ width: '80px', height: '80px', margin: '0 auto 20px' }}
              animationData={loadingLottie}
              loop
              play
            />
            <div style={{ fontSize: '16px', color: '#333', marginBottom: '10px' }}>
              {redirectMessage}
            </div>
            <div style={{ fontSize: '14px', color: '#666' }}>
              请稍候，正在为您跳转...
            </div>
          </div>
        </Card>
      </AuthPageContainer>
    );
  }

  return (
    <AuthPageContainer>
      <Card className="auth-card" variant="borderless">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div className="auth-header">
            <img src="/images/logo.svg" alt="UAC" className="logo" />
            <div className="title">{pageTitle}</div>
            <div className="description">{pageDescription}</div>
          </div>

          <Form
            form={form}
            name="login"
            initialValues={{
              autoLogin: true,
              username: 'admin',
              password: '123456',
            }}
            onFinish={async (values) => {
              await handleSubmit(values as LoginParams);
            }}
            size="large"
          >
            <Form.Item
              name="username"
              rules={[
                {
                  required: true,
                  message: '请输入用户名!',
                },
              ]}
            >
              <Input
                placeholder="用户名"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                {
                  required: true,
                  message: '请输入密码！',
                },
              ]}
            >
              <Input.Password
                placeholder="密码"
              />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>
                登录
              </Button>
            </Form.Item>

            <div className="d-flex justify-content-end">
                <Button type="link" onClick={() => {
                  const urlParams = new URLSearchParams(window.location.search);
                  const appId = urlParams.get('app');
                  history.push(`/auth/reset-password${appId ? `?app=${appId}` : ''}`);
                }}>
                  忘记密码？
                </Button>
            </div>
          </Form>
        </Space>
      </Card>

      <Modal
        title="需验证您是真人操作"
        open={showCaptcha}
        footer={null}
        closable={true}
        maskClosable={false}
        onCancel={() => {
          setShowCaptcha(false);
          captchaRef.current?.reset();
        }}
      >
        <SliderCaptchaComponent
          ref={captchaRef}
          onSuccess={handleCaptchaSuccess}
          onClose={() => setShowCaptcha(false)}
          captchaId={captchaId}
        />
      </Modal>
    </AuthPageContainer>
  );
};

export default LoginPage;