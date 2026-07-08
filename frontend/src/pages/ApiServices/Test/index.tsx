import { PlayCircleOutlined, RobotOutlined, ReloadOutlined, ToolOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { sendMockUserMessage, useAISurface, useChatReference } from '@EADAF/ai-base';
import {
  Alert,
  Button,
  Collapse,
  Descriptions,
  Input,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import PageContainerTitleWithBack from '@/components/PageContainerTitleWithBack';
import { buildApiServiceReference } from '@/ai/chatReferenceBuilders';
import { buildApiServiceTestParamsPrompt } from '@/pages/ApiServices/ai/buildApiServiceTestParamsPrompt';
import { buildApiServiceTestAutoFixPrompt } from '@/pages/ApiServices/ai/buildApiServiceTestAutoFixPrompt';
import {
  describeApiServiceTestFailure,
  formatApiServiceTestError,
  isApiServiceTestFailure,
} from '@/pages/ApiServices/ai/apiServiceTestError';
import {
  getApiServiceTestProfile,
  postApiServiceSuggestTestParams,
  postApiServiceTest,
} from '@/services/UAC/api/apiServices';
import { getApiData, getApiErrorMessage, isApiSuccess } from '@/utils/apiResponse';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const WRITE_OPERATIONS = new Set([
  'create', 'insertOne', 'insertMany', 'save', 'updateOne', 'updateMany',
  'deleteOne', 'deleteMany', 'findOneAndUpdate', 'findOneAndDelete', 'replaceOne',
]);

function isWriteOperation(operation?: string) {
  return Boolean(operation && WRITE_OPERATIONS.has(operation));
}

type TestLocationState = {
  autoRunTest?: boolean;
  fixContext?: { errorMessage?: string };
};

function parseParametersJson(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (!trimmed) return {};
  return JSON.parse(trimmed) as Record<string, unknown>;
}

const ApiServiceTestPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state || {}) as TestLocationState;
  const { id: serviceId } = useParams<{ id: string }>();
  const [messageApi, contextHolder] = message.useMessage();
  const { addReference } = useChatReference();
  const [profileLoading, setProfileLoading] = useState(true);
  const [testLoading, setTestLoading] = useState(false);
  const [profile, setProfile] = useState<API.ApiServiceTestProfile | null>(null);
  const [selectedOperation, setSelectedOperation] = useState<string | undefined>();
  const [parametersText, setParametersText] = useState('{}');
  const [parseError, setParseError] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [result, setResult] = useState<API.ApiServiceTestResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const autoRunConsumedRef = useRef(false);

  const parametersRef = useRef(parametersText);
  parametersRef.current = parametersText;
  const selectedOperationRef = useRef(selectedOperation);
  selectedOperationRef.current = selectedOperation;
  const testErrorRef = useRef(testError);
  testErrorRef.current = testError;
  const resultRef = useRef(result);
  resultRef.current = result;

  const currentOpProfile = useMemo(
    () => profile?.enabledOperations?.find((item) => item.operation === selectedOperation),
    [profile, selectedOperation],
  );

  const loadProfile = useCallback(async () => {
    if (!serviceId) return;
    setProfileLoading(true);
    setLoadError(null);
    setResult(null);
    try {
      const res = await getApiServiceTestProfile(serviceId);
      if (!isApiSuccess(res)) {
        setLoadError(getApiErrorMessage(res, '加载测试上下文失败'));
        setProfile(null);
        return;
      }
      const data = getApiData<API.ApiServiceTestProfile>(res);
      setProfile(data || null);
      const firstOp = data?.enabledOperations?.[0]?.operation;
      setSelectedOperation(firstOp);
      const mock = data?.enabledOperations?.[0]?.mockParameters || {};
      setParametersText(JSON.stringify(mock, null, 2));
      setParseError(null);
    } catch (err) {
      setLoadError(getApiErrorMessage(err, '加载测试上下文失败'));
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useAISurface({
    id: 'api-services.test',
    domain: 'bizdata',
    label: 'API 服务测试',
    read: () => ({
      serviceId,
      serviceCode: profile?.code,
      selectedOperation: selectedOperationRef.current,
      parametersText: parametersRef.current,
      testError: testErrorRef.current,
      lastTestResult: resultRef.current,
      profileSummary: profile
        ? {
            code: profile.code,
            basePath: profile.basePath,
            operations: profile.enabledOperations?.map((op) => op.operation),
          }
        : null,
    }),
    applyMutation: (mutation) => {
      if (mutation.type === 'apiservice.test_params.suggested' || mutation.type === 'apiservice.test_params.set') {
        const payload = mutation.payload as { mockParameters?: Record<string, unknown> } | undefined;
        if (payload?.mockParameters) {
          setParametersText(JSON.stringify(payload.mockParameters, null, 2));
          setParseError(null);
        }
        return;
      }
      if (mutation.type === 'apiservice.test_completed') {
        const payload = mutation.payload as {
          success?: boolean;
          error?: string;
          preview?: unknown;
          executable?: boolean;
          executableReason?: string;
          validationErrors?: Array<{ path?: string; message?: string }>;
          savedMockParameters?: Record<string, unknown>;
        };
        if (payload?.success === false) {
          setTestError(payload.error || '测试失败');
          setResult(null);
          return;
        }
        setTestError(null);
        setResult(payload as API.ApiServiceTestResult);
        if (payload?.savedMockParameters) {
          setParametersText(JSON.stringify(payload.savedMockParameters, null, 2));
          setParseError(null);
        }
      }
    },
    matchMutation: (mutation) =>
      mutation.domain === 'bizdata'
      && (
        mutation.type === 'apiservice.test_params.suggested'
        || mutation.type === 'apiservice.test_params.set'
        || mutation.type === 'apiservice.test_completed'
      ),
  });

  const handleResetMock = async () => {
    if (!serviceId || !selectedOperation) return;
    try {
      const res = await postApiServiceSuggestTestParams(serviceId, { operation: selectedOperation });
      if (!isApiSuccess(res)) {
        messageApi.error(getApiErrorMessage(res, '重置模拟参数失败'));
        return;
      }
      const data = getApiData<API.ApiServiceSuggestTestParamsResult>(res);
      setParametersText(JSON.stringify(data?.mockParameters || {}, null, 2));
      setParseError(null);
      messageApi.success('已重置为默认模拟参数');
    } catch (err) {
      messageApi.error(getApiErrorMessage(err, '重置模拟参数失败'));
    }
  };

  const handleAiGenerate = () => {
    if (!profile) return;
    addReference(
      buildApiServiceReference({
        id: profile.serviceId,
        code: profile.code,
        name: profile.name,
        routePath: profile.routePath,
        status: profile.status,
        entityCode: profile.entityCode,
      }),
    );
    sendMockUserMessage(
      buildApiServiceTestParamsPrompt({
        code: profile.code,
        name: profile.name,
        operation: selectedOperation,
        operationLabel: currentOpProfile?.label,
      }),
    );
  };

  const handleAutoFix = () => {
    if (!profile) return;
    addReference(
      buildApiServiceReference({
        id: profile.serviceId,
        code: profile.code,
        name: profile.name,
        routePath: profile.routePath,
        status: profile.status,
        entityCode: profile.entityCode,
      }),
    );
    sendMockUserMessage(
      buildApiServiceTestAutoFixPrompt({
        serviceId: profile.serviceId,
        code: profile.code,
        name: profile.name,
        operation: selectedOperation,
        operationLabel: currentOpProfile?.label,
        parametersText,
        errorMessage: testError || parseError || undefined,
      }),
    );
  };

  const runTest = useCallback(async () => {
    if (!serviceId || !selectedOperation) return;
    let parameters: Record<string, unknown>;
    try {
      parameters = parseParametersJson(parametersText);
      setParseError(null);
    } catch {
      setParseError('参数 JSON 格式不正确');
      setTestError(null);
      return;
    }

    setTestLoading(true);
    setResult(null);
    setTestError(null);
    try {
      const res = await postApiServiceTest(serviceId, {
        operation: selectedOperation,
        parameters,
      });
      if (isApiSuccess(res)) {
        const data = getApiData<API.ApiServiceTestResult>(res) || null;
        setResult(data);
        if (data?.savedMockParameters) {
          setParametersText(JSON.stringify(data.savedMockParameters, null, 2));
          setParseError(null);
        }
        const failureMessage = describeApiServiceTestFailure(data);
        if (isApiServiceTestFailure(data)) {
          setTestError(failureMessage || '测试未通过');
        } else {
          setTestError(null);
        }
      } else {
        const errMsg = getApiErrorMessage(res, '测试请求失败');
        setTestError(formatApiServiceTestError(res, errMsg));
        messageApi.error(errMsg);
      }
    } catch (err) {
      const errMsg = formatApiServiceTestError(err, '测试请求失败');
      setTestError(errMsg);
      messageApi.error(getApiErrorMessage(err, '测试请求失败'));
    } finally {
      setTestLoading(false);
    }
  }, [messageApi, parametersText, selectedOperation, serviceId]);

  useEffect(() => {
    autoRunConsumedRef.current = false;
  }, [serviceId]);

  useEffect(() => {
    if (!locationState.autoRunTest || autoRunConsumedRef.current) return;
    if (profileLoading || !profile || !selectedOperation) return;
    autoRunConsumedRef.current = true;
    void runTest();
    navigate(location.pathname, { replace: true, state: {} });
  }, [
    location.pathname,
    locationState.autoRunTest,
    navigate,
    profile,
    profileLoading,
    runTest,
    selectedOperation,
  ]);

  const schemaCollapseItems = [
    ...(profile?.requestParameterInterface
      ? [
          {
            key: 'interface',
            label: '请求参数 TypeScript interface（设计期）',
            children: (
              <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>
                {profile.requestParameterInterface}
              </pre>
            ),
          },
        ]
      : []),
    ...(currentOpProfile?.parameterSchema
      ? [
          {
            key: 'schema',
            label: '运行时 JSON Schema',
            children: (
              <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(currentOpProfile.parameterSchema, null, 2)}
              </pre>
            ),
          },
        ]
      : []),
  ];

  return (
    <PageContainer
      title={
        <PageContainerTitleWithBack
          title={`测试请求${profile?.code ? ` · ${profile.code}` : ''}`}
        />
      }
    >
      {contextHolder}

      {profileLoading && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <Spin description="正在加载测试上下文…" />
        </div>
      )}

      {!profileLoading && loadError && (
        <Alert type="error" message={loadError} showIcon style={{ marginBottom: 16 }} />
      )}

      {!profileLoading && profile && (
        <>
          {profile.testAutoRollback === false
            && isWriteOperation(selectedOperation)
            && currentOpProfile?.executable !== false && (
            <Alert
              type="warning"
              showIcon
              message="API 测试中：写操作将真实落库"
              description="系统设置已关闭「API 测试中写操作自动回滚」。本次仅在测试页执行的写操作会提交到数据库，不影响已发布 API 的线上行为。"
              style={{ marginBottom: 16 }}
            />
          )}
          <Descriptions size="small" column={1} bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Operation">
              <Text>
                {currentOpProfile?.label || selectedOperation}
                {currentOpProfile?.httpMethod ? ` (${currentOpProfile.httpMethod})` : ''}
              </Text>
              {currentOpProfile?.executable === false && (
                <Tag color="warning" style={{ marginLeft: 8 }}>
                  仅校验
                </Tag>
              )}
              {currentOpProfile?.mockParametersSource === 'saved' && (
                <Tag color="success" style={{ marginLeft: 8 }}>
                  已保存 mock
                </Tag>
              )}
            </Descriptions.Item>
            {/* {currentOpProfile?.requestPreview && (
              <Descriptions.Item label="请求预览">
                <Text code copyable>
                  {currentOpProfile.requestPreview.method} {currentOpProfile.requestPreview.url}
                </Text>
              </Descriptions.Item>
            )} */}
            {currentOpProfile?.executableReason && currentOpProfile.executable === false && (
              <Descriptions.Item label="说明">
                <Text type="secondary">{currentOpProfile.executableReason}</Text>
              </Descriptions.Item>
            )}
            {profile.transportEndpoints?.length ? (
              <Descriptions.Item label="访问协议">
                <Space orientation="vertical" size={4}>
                  {profile.transportEndpoints.map((item) => (
                    <span key={item.protocol}>
                      <Tag>{item.label || item.protocol}</Tag>
                      <Text code copyable>{item.url}</Text>
                    </span>
                  ))}
                </Space>
              </Descriptions.Item>
            ) : null}
          </Descriptions>

          {schemaCollapseItems.length > 0 && (
            <Collapse items={schemaCollapseItems} style={{ marginBottom: 12 }} />
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              模拟参数（JSON）
            </Paragraph>
            <Button
              size="small"
              className="ai-btn"
              icon={<RobotOutlined />}
              onClick={handleAiGenerate}
            >
              AI 生成参数
            </Button>
          </div>
          <TextArea
            rows={10}
            value={parametersText}
            onChange={(e) => {
              setParametersText(e.target.value);
              setParseError(null);
              setTestError(null);
            }}
            style={{ fontFamily: 'monospace', fontSize: 12, marginBottom: 8 }}
          />
          {parseError && (
            <Alert type="error" message={parseError} showIcon style={{ marginBottom: 12 }} />
          )}
          {testError && !parseError && (
            <Alert type="error" message="测试失败" description={testError} showIcon style={{ marginBottom: 12 }} />
          )}

          <Space wrap style={{ marginBottom: 24 }}>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={testLoading}
              onClick={() => void runTest()}
            >
              发送测试
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void handleResetMock()}>
              重置 mock
            </Button>
            <Button
              icon={<ToolOutlined />}
              disabled={!testError && !parseError}
              onClick={handleAutoFix}
            >
              自动修复
            </Button>
          </Space>

          {result && (
            <>
              <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                <Text code>
                  {result.httpMethod} {result.url}
                </Text>
                {result.query && Object.keys(result.query).length > 0 && (
                  <span style={{ marginLeft: 8 }}>Query: {JSON.stringify(result.query)}</span>
                )}
                {typeof result.durationMs === 'number' && (
                  <span style={{ marginLeft: 8 }}>耗时 {result.durationMs} ms</span>
                )}
                {result.rolledBack && (
                  <Tag color="blue" style={{ marginLeft: 8 }}>
                    写操作已回滚
                  </Tag>
                )}
                {result.rolledBack === false
                  && isWriteOperation(result.operation || selectedOperation)
                  && result.executable !== false && (
                  <Tag color="orange" style={{ marginLeft: 8 }}>
                    已落库
                  </Tag>
                )}
                {result.executable === false && (
                  <Tag color="warning" style={{ marginLeft: 8 }}>
                    未执行
                  </Tag>
                )}
              </Paragraph>
              {result.executableReason && result.executable === false && (
                <Alert
                  type="warning"
                  message={result.executableReason}
                  showIcon
                  style={{ marginBottom: 12 }}
                />
              )}
              {result.preview != null && (
                <div
                  style={{
                    background: '#fafafa',
                    border: '1px solid #f0f0f0',
                    borderRadius: 6,
                    padding: 12,
                    maxHeight: 480,
                    overflow: 'auto',
                  }}
                >
                  <pre style={{ margin: 0, fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(result.preview, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}
        </>
      )}
    </PageContainer>
  );
};

export default ApiServiceTestPage;
