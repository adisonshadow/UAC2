import { useAIChatDisplayMode } from '@EADAF/ai-base';
import { ApiOutlined, PartitionOutlined } from '@ant-design/icons';
import { Alert, Collapse, Spin, Tag, Tree, Typography } from 'antd';
import type { DataNode } from 'antd/es/tree';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import {
  getApplicationsPublicApiCatalog,
  type ApplicationApiCatalogOperation,
  type ApplicationApiCatalogService,
  type ApplicationApiCatalogTreeNode,
  type ApplicationApiCatalogResult,
} from '@/services/UAC/api/applicationsPublic';
import {
  buildApplicationApiDocsPath,
  parseApiDocsRoutePathFromPathname,
} from '@/utils/applicationApiDocsUrl';
import { getApiData, getApiErrorMessage, isApiSuccess } from '@/utils/apiResponse';
import './index.css';

const { Text, Paragraph } = Typography;

function methodClass(method?: string) {
  return `application-api-catalog__method application-api-catalog__method--${(method || 'get').toLowerCase()}`;
}

function buildOperationPath(basePath: string | undefined, routePattern?: string) {
  const base = (basePath || '').replace(/\/$/, '');
  const suffix = routePattern || '';
  return `${base}${suffix}` || base || '/';
}

function normalizeRoutePath(routePath?: string): string {
  return String(routePath || '')
    .replace(/^\/+|\/+$/g, '')
    .trim();
}

function findServiceByRoutePath(
  services: ApplicationApiCatalogService[],
  routePath?: string,
): ApplicationApiCatalogService | undefined {
  const target = normalizeRoutePath(routePath);
  if (!target) return undefined;
  return services.find((service) => normalizeRoutePath(service.routePath) === target);
}

function collectApiCodes(nodes: ApplicationApiCatalogTreeNode[]): string[] {
  const codes: string[] = [];
  const walk = (items: ApplicationApiCatalogTreeNode[]) => {
    items.forEach((node) => {
      if (node.isApiNode) codes.push(node.code);
      if (node.children?.length) walk(node.children);
    });
  };
  walk(nodes);
  return codes;
}

function toTreeNodes(items: ApplicationApiCatalogTreeNode[]): DataNode[] {
  return items.map((item) => ({
    key: item.code,
    title: item.isApiNode ? (
      <span>
        <ApiOutlined style={{ marginRight: 6, color: '#1677ff' }} />
        {item.name}
      </span>
    ) : (
      <span>
        <PartitionOutlined style={{ marginRight: 6 }} />
        <Text strong>{item.name}</Text>
        {item.serviceCount != null ? (
          <Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>
            ({item.serviceCount})
          </Text>
        ) : null}
      </span>
    ),
    selectable: !!item.isApiNode,
    isLeaf: !!item.isApiNode,
    children: item.children?.length ? toTreeNodes(item.children) : undefined,
  }));
}

function OperationBlock({
  operation,
  basePath,
  requestParameterInterface,
}: {
  operation: ApplicationApiCatalogOperation;
  basePath?: string;
  requestParameterInterface?: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const path = buildOperationPath(basePath, operation.routePattern);
  const hasInterface = Boolean(requestParameterInterface?.trim());
  const hasSchema = Boolean(operation.parametersSchema && Object.keys(operation.parametersSchema).length);
  const hasMock = Boolean(operation.mockParameters && Object.keys(operation.mockParameters).length);
  const hasResponse = Boolean(operation.responseInterface?.trim());

  const schemaBlock = hasSchema ? (
    <pre className="application-api-catalog__schema">
      {JSON.stringify(operation.parametersSchema, null, 2)}
    </pre>
  ) : null;

  return (
    <div className="application-api-catalog__operation">
      <div
        className="application-api-catalog__operation-head"
        onClick={() => setExpanded((prev) => !prev)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setExpanded((prev) => !prev);
        }}
      >
        <span className={methodClass(operation.httpMethod)}>{operation.httpMethod}</span>
        <span className="application-api-catalog__path">{path}</span>
        <Text type="secondary">{operation.label || operation.operation}</Text>
      </div>
      {expanded ? (
        <div className="application-api-catalog__operation-body">
          <Paragraph type="secondary" style={{ marginBottom: 12 }}>
            Operation: <Text code>{operation.operation}</Text>
            {operation.category ? (
              <>
                {' '}
                · Category: <Text code>{operation.category}</Text>
              </>
            ) : null}
          </Paragraph>
          {hasInterface ? (
            <>
              <Text strong>请求参数结构（TypeScript interface）</Text>
              <pre className="application-api-catalog__schema">
                {requestParameterInterface!.trim()}
              </pre>
            </>
          ) : null}
          {hasSchema && hasInterface ? (
            <Collapse
              ghost
              style={{ marginTop: 16 }}
              items={[
                {
                  key: 'schema',
                  label: 'Parameters Schema（运行时 JSON Schema）',
                  children: schemaBlock,
                },
              ]}
            />
          ) : null}
          {hasSchema && !hasInterface ? (
            <>
              <Text strong style={{ display: 'block', marginTop: 0 }}>
                Parameters Schema
              </Text>
              {schemaBlock}
            </>
          ) : null}
          {hasMock ? (
            <>
              <Text strong style={{ display: 'block', marginTop: hasInterface || hasSchema ? 16 : 0 }}>
                模拟参数（JSON）
              </Text>
              <pre className="application-api-catalog__schema">
                {JSON.stringify(operation.mockParameters, null, 2)}
              </pre>
            </>
          ) : null}
          {hasResponse ? (
            <>
              <Text strong style={{ display: 'block', marginTop: 16 }}>
                响应结构（TypeScript interface）
              </Text>
              <pre className="application-api-catalog__schema">
                {operation.responseInterface!.trim()}
              </pre>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ServiceDetail({ service }: { service: ApplicationApiCatalogService }) {
  return (
    <div className="application-api-catalog__detail">
      <h1 className="application-api-catalog__service-title">{service.name || service.code}</h1>
      <div className="application-api-catalog__service-meta">
        <div>
          <Text code>{service.code}</Text>
          {service.status === 'draft' ? (
            <Tag color="orange" style={{ marginLeft: 8 }}>
              未发布
            </Tag>
          ) : service.status === 'published' ? (
            <Tag color="green" style={{ marginLeft: 8 }}>
              已发布
            </Tag>
          ) : null}
          {service.version != null ? <Tag style={{ marginLeft: 8 }}>v{service.version}</Tag> : null}
          {(service.transportProtocols || ['http']).map((p) => (
            <Tag key={p} style={{ marginLeft: 4 }}>
              {p.toUpperCase()}
            </Tag>
          ))}
        </div>
        {service.description ? <Paragraph style={{ marginTop: 8 }}>{service.description}</Paragraph> : null}
        {service.status === 'draft' ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: 12 }}
            message="此 API 尚未发布，仅供开发查阅；发布后方可实际调用。"
          />
        ) : null}
        {/* <Paragraph style={{ marginBottom: 0 }}>
          Base URL: <Text code copyable>{service.basePath}</Text>
          {service.routePath ? (
            <>
              {' '}
              · route_path: <Text code>{service.routePath}</Text>
            </>
          ) : null}
          {service.entityCode ? (
            <>
              {' '}
              · 实体: <Text code>{service.entityCode}</Text>
            </>
          ) : null}
        </Paragraph> */}
        {service.tags?.length ? (
          <div style={{ marginTop: 8 }}>
            {service.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
        ) : null}
      </div>

      <Text strong style={{ fontSize: 16, display: 'block', marginTop: 20 }}>
        Operations
      </Text>
      <div style={{ marginTop: 12 }}>
        {(service.operations || []).length ? (
          service.operations!.map((op) => (
            <OperationBlock
              key={`${service.code}-${op.operation}`}
              operation={op}
              basePath={service.basePath}
              requestParameterInterface={service.requestParameterInterface}
            />
          ))
        ) : (
          <Alert type="info" showIcon message="该 API 服务暂无已启用的 Operation" />
        )}
      </div>
    </div>
  );
}

const ApplicationPublicApiCatalogPage: React.FC = () => {
  useAIChatDisplayMode('hidden');
  const location = useLocation();
  const { code } = useParams<{ code: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<ApplicationApiCatalogResult | undefined>(undefined);
  const [selectedServiceCode, setSelectedServiceCode] = useState<string>();

  const routePathFromUrl = useMemo(
    () => (code ? parseApiDocsRoutePathFromPathname(location.pathname, code) : undefined),
    [code, location.pathname],
  );

  const syncSelectionFromUrl = useCallback(
    (data: ApplicationApiCatalogResult, routePath?: string) => {
      if (routePath) {
        const matched = findServiceByRoutePath(data.services, routePath);
        if (matched?.code) {
          setSelectedServiceCode(matched.code);
          return;
        }
      }
      const firstApi = data.tree ? collectApiCodes(data.tree)[0] : undefined;
      setSelectedServiceCode(firstApi);
    },
    [],
  );

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getApplicationsPublicApiCatalog(code, { skipErrorHandler: true });
        if (cancelled) return;
        if (!isApiSuccess(res)) {
          setError(getApiErrorMessage(res, '加载 API 目录失败'));
          return;
        }
        const data = getApiData<ApplicationApiCatalogResult>(res);
        setCatalog(data);
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err, '加载 API 目录失败'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    if (!catalog) return;
    syncSelectionFromUrl(catalog, routePathFromUrl);
  }, [catalog, routePathFromUrl, syncSelectionFromUrl]);

  useEffect(() => {
    if (!catalog || !code) return undefined;
    const onPopState = () => {
      const routePath = parseApiDocsRoutePathFromPathname(window.location.pathname, code);
      syncSelectionFromUrl(catalog, routePath);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [catalog, code, syncSelectionFromUrl]);

  const treeNodes = useMemo(() => (catalog?.tree ? toTreeNodes(catalog.tree) : []), [catalog?.tree]);
  const selectedService = useMemo(
    () => catalog?.services?.find((item) => item.code === selectedServiceCode),
    [catalog?.services, selectedServiceCode],
  );

  const handleSelectService = useCallback(
    (serviceCode: string) => {
      if (!code || !catalog) return;
      const service = catalog.services.find((item) => item.code === serviceCode);
      if (!service?.routePath) return;
      if (selectedServiceCode === serviceCode) return;
      const nextPath = buildApplicationApiDocsPath(code, service.routePath);
      if (window.location.pathname !== nextPath) {
        window.history.replaceState(window.history.state, '', nextPath);
      }
      setSelectedServiceCode(serviceCode);
    },
    [catalog, code, selectedServiceCode],
  );

  if (loading) {
    return (
      <div className="application-api-catalog" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" tip="加载 API 目录..." />
      </div>
    );
  }

  if (error || !catalog) {
    return (
      <div className="application-api-catalog" style={{ padding: 24 }}>
        <Alert type="error" showIcon message={error || '无法加载 API 目录'} />
      </div>
    );
  }

  return (
    <div className="application-api-catalog">
      <header className="application-api-catalog__header">
        <h1 className="application-api-catalog__header-title">{catalog.application.name} · API 文档</h1>
        <p className="application-api-catalog__header-sub">
          应用 <Text code style={{ color: '#fff' }}>{catalog.application.code}</Text>
          {' · '}
          以下为该应用已授权可访问的 API（公开文档，无需登录）
        </p>
      </header>

      <div className="application-api-catalog__body">
        <aside className="application-api-catalog__sidebar application-api-catalog__tree">
          {treeNodes.length ? (
            <Tree
              showLine
              defaultExpandAll
              motion={false}
              selectedKeys={selectedServiceCode ? [selectedServiceCode] : []}
              treeData={treeNodes}
              onSelect={(keys) => {
                const key = keys[0] as string | undefined;
                if (key) handleSelectService(key);
              }}
            />
          ) : (
            <Text type="secondary">暂无已授权的 API 域，请在应用 API 配置中勾选可访问域</Text>
          )}
        </aside>

        <main className="application-api-catalog__content">
          {selectedService ? (
            <ServiceDetail service={selectedService} />
          ) : (
            <div className="application-api-catalog__detail application-api-catalog__empty">
              请从左侧选择一个 API 服务查看明细
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ApplicationPublicApiCatalogPage;
