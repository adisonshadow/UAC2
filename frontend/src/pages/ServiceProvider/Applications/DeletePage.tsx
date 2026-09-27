import { PageContainer } from '@ant-design/pro-components';
import { Alert, Button, Card, Checkbox, Space, Spin, Table, Typography } from 'antd';
import { message, modal } from '@/utils/antdAppApis';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageContainerTitleWithBack from '@/components/PageContainerTitleWithBack';
import {
  deleteApplicationsId,
  getApplicationsIdDeletePreview,
} from '@/services/UAC/api/applications';
import { getApiData, isApiSuccess } from '@/utils/apiResponse';
import { SYSTEM_APPLICATION_CODE } from './Schemas';

const { Text, Paragraph } = Typography;

const ApplicationDeletePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const listPath = '/service_provider';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<API.ApplicationDeletePreview | null>(null);
  const [deleteBuckets, setDeleteBuckets] = useState(false);

  const loadPreview = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await getApplicationsIdDeletePreview({ id });
      if (!isApiSuccess(res)) {
        message.error(res.message || '加载删除预览失败');
        navigate(listPath, { replace: true });
        return;
      }
      const data = getApiData<API.ApplicationDeletePreview>(res);
      if (!data?.application) {
        message.error('应用不存在');
        navigate(listPath, { replace: true });
        return;
      }
      if (data.application.code === SYSTEM_APPLICATION_CODE) {
        message.warning('系统内置应用不可删除');
        navigate(listPath, { replace: true });
        return;
      }
      setPreview(data);
    } catch {
      message.error('加载删除预览失败');
      navigate(listPath, { replace: true });
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const handleSubmit = () => {
    if (!id || !preview?.application) return;
    const app = preview.application;
    const bucketCount = preview.bucketCount || 0;
    const objectCount = preview.objectCount || 0;

    const extra = deleteBuckets
      ? `并将同时删除其归属的 ${bucketCount} 个 Bucket 及其中 ${objectCount} 个文件对象（系统内置 Bucket 会跳过）。`
      : '不会删除归属该应用的 Bucket 与文件。';

    modal.confirm({
      title: '最终确认删除',
      content: (
        <div>
          <Paragraph>
            即将永久删除应用「{app.name}」（{app.code}）。{extra}
          </Paragraph>
          <Paragraph type="danger" style={{ marginBottom: 0 }}>
            此操作不可撤销，请再次确认。
          </Paragraph>
        </div>
      ),
      okText: '确认删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setSubmitting(true);
        try {
          const res = await deleteApplicationsId({ id }, { deleteBuckets });
          if (!isApiSuccess(res)) {
            message.error(res.message || '删除失败');
            return;
          }
          const data = getApiData<{
            deletedBuckets?: number;
            deletedObjects?: number;
            skippedSystemBuckets?: number;
          }>(res);
          if (deleteBuckets && data) {
            message.success(
              `应用已删除；已删 Bucket ${data.deletedBuckets ?? 0} 个、文件 ${data.deletedObjects ?? 0} 个` +
                (data.skippedSystemBuckets
                  ? `（跳过系统 Bucket ${data.skippedSystemBuckets} 个）`
                  : ''),
            );
          } else {
            message.success('应用已删除');
          }
          navigate(listPath, { replace: true });
        } catch {
          message.error('删除失败');
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  const buckets = preview?.buckets || [];
  const app = preview?.application;

  return (
    <PageContainer
      title={
        <PageContainerTitleWithBack title="删除应用" backTo={listPath} />
      }
    >
      <Spin spinning={loading}>
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="warning"
            showIcon
            message="删除应用后不可恢复"
            description="将删除应用记录及其配置。若勾选下方选项，还会删除该应用作为「来源应用」归属的 Bucket，以及这些 Bucket 下的全部文件。"
          />

          <Card size="small" title="应用信息" loading={loading && !app}>
            {app ? (
              <Space orientation="vertical" size={4}>
                <Text>
                  名称：<Text strong>{app.name}</Text>
                </Text>
                <Text>
                  编码：<Text code>{app.code}</Text>
                </Text>
                <Text type="secondary">ID：{app.application_id}</Text>
              </Space>
            ) : null}
          </Card>

          <Card
            size="small"
            title={`来源应用 Bucket（${preview?.bucketCount ?? 0}） / 文件对象（${preview?.objectCount ?? 0}）`}
          >
            <Table
              size="small"
              rowKey={(r) => r.bucketId || r.code || String(Math.random())}
              pagination={false}
              dataSource={buckets}
              locale={{ emptyText: '该应用下没有归属的 Bucket' }}
              columns={[
                { title: '编码', dataIndex: 'code', width: 160 },
                { title: '名称', dataIndex: 'name' },
                {
                  title: '文件数',
                  dataIndex: 'objectCount',
                  width: 90,
                  render: (v: number) => v ?? 0,
                },
                {
                  title: '说明',
                  width: 120,
                  render: (_, r) => (r.isSystem ? '系统内置（不可删）' : '可随应用删除'),
                },
              ]}
            />
            <div style={{ marginTop: 16 }}>
              <Checkbox
                checked={deleteBuckets}
                disabled={!buckets.some((b) => !b.isSystem)}
                onChange={(e) => setDeleteBuckets(e.target.checked)}
              >
                同时删除来源应用的 Bucket 及 Bucket 下的文件
              </Checkbox>
              <div style={{ color: '#888', fontSize: 12, marginTop: 4, marginLeft: 24 }}>
                仅影响上表中归属本应用的 Bucket；系统内置 Bucket 即使勾选也会跳过。共享 Bucket
                中仅「对象 application_id」指向本应用的文件不会因本选项被删除。
              </div>
            </div>
          </Card>

          <Space>
            <Button onClick={() => navigate(listPath)}>取消</Button>
            <Button type="primary" danger loading={submitting} onClick={handleSubmit}>
              提交删除
            </Button>
          </Space>
        </Space>
      </Spin>
    </PageContainer>
  );
};

export default ApplicationDeletePage;
