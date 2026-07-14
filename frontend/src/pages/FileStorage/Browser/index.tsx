import { DownloadOutlined, EyeOutlined, UploadOutlined } from '@ant-design/icons';
import { ActionType, PageContainer, ProColumns, ProTable } from '@ant-design/pro-components';
import { UrlSyncedProTable } from '@/components/UrlSyncedProTable';
import { Button, Image, Modal, Space, Upload, Tooltip } from 'antd';
import { message } from '@/utils/antdAppApis';
import React, { useRef, useState, useMemo } from 'react';
import { useAIChatPrompts, useChatReference } from '@EADAF/ai-base';
import { buildStorageBrowserPrompts } from '@/ai/pageChatPrompts';
import { buildStorageObjectReference } from '@/ai/chatReferenceBuilders';
import { augmentColumnsWithChatReference } from '@/utils/augmentColumnsWithChatReference';
import {
  getStorageBuckets,
  getStorageDownloadUrl,
  getStorageObjects,
  getStoragePreviewUrl,
  postStorageObjectUpload,
} from '@/services/UAC/api/storage';
import { DEFAULT_PRO_TABLE_OPTIONS } from '@/constants/proTable';
import { useProTableSearchCollapse } from '@/hooks/useProTableSearchCollapse';
import { TABLE_ACTION_COLUMN_BASE, TableActionButton, TableActions } from '@/components/TableActions';
import { isApiSuccess, parseApiListResponse } from '@/utils/apiResponse';
import { request } from '@/utils/request';

type ObjectRecord = API.StorageObject;

function formatSize(size?: number) {
  if (!size) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

async function fetchStorageBlob(objectId: string, preview: boolean): Promise<Blob> {
  const path = preview ? getStoragePreviewUrl(objectId) : getStorageDownloadUrl(objectId);
  const blob = await request<Blob>(path, { responseType: 'blob', skipErrorHandler: true });
  if (blob.type?.includes('application/json')) {
    const text = await blob.text();
    try {
      const err = JSON.parse(text) as { message?: string };
      throw new Error(err.message || '请求失败');
    } catch (e) {
      if (e instanceof Error && e.message !== '请求失败') throw e;
      throw new Error('请求失败');
    }
  }
  return blob;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const BrowserPage: React.FC = () => {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [previewName, setPreviewName] = useState<string>();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploadingBucketCode, setUploadingBucketCode] = useState<string>();
  const { references } = useChatReference();
  const chatPrompts = useMemo(() => buildStorageBrowserPrompts(references), [references]);
  useAIChatPrompts(chatPrompts);
  const search = useProTableSearchCollapse('file-storage.browser');

  const closePreview = () => {
    setPreviewOpen(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(undefined);
    setPreviewName(undefined);
  };

  const handlePreview = async (record: ObjectRecord) => {
    if (!record.objectId) return;
    try {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(undefined);
      }
      const blob = await fetchStorageBlob(record.objectId, true);
      const url = URL.createObjectURL(blob);
      setPreviewName(record.name || '图片预览');
      setPreviewUrl(url);
      setPreviewOpen(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '预览失败');
    }
  };

  const handleDownload = async (record: ObjectRecord) => {
    if (!record.objectId) return;
    try {
      const blob = await fetchStorageBlob(record.objectId, false);
      triggerBlobDownload(blob, record.name || 'download');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '下载失败');
    }
  };

  return (
    <PageContainer pageHeaderRender={() => <></>}>
      <UrlSyncedProTable<ObjectRecord>
        headerTitle="文件浏览器"
        actionRef={actionRef}
        rowKey="objectId"
        scroll={{ x: 1280 }}
        search={search}
        {...DEFAULT_PRO_TABLE_OPTIONS}
        toolBarRender={() => [
          <Button key="upload" type="primary" className="btn-gradient-primary" icon={<UploadOutlined />} onClick={() => setUploadOpen(true)}>
            上传文件
          </Button>,
        ]}
        request={async (params) => {
          const res = await getStorageObjects({
            page: params.current,
            size: params.pageSize,
            keyword: params.keyword as string | undefined,
            bucketId: params.bucketId as string | undefined,
          });
          const { items, total, success } = parseApiListResponse<ObjectRecord>(res);
          return { data: items, total, success };
        }}
        columns={[
          { title: '资源 ID', dataIndex: 'objectId', copyable: true, ellipsis: true, width: 120 },
          ...augmentColumnsWithChatReference<ObjectRecord>(
            [{ title: '资源名称', dataIndex: 'name', ellipsis: true, width: 200 } as ProColumns<ObjectRecord>],
            'name',
            buildStorageObjectReference,
          ),
          { title: '类型', dataIndex: 'mimeType', width: 140 },
          { title: 'Bucket', render: (_, r) => r.bucket?.name || r.bucket?.code || '-', width: 140 },
          { title: '来源应用', render: (_, r) => r.application?.name || '-', width: 160 },
          { title: '来源用户', render: (_, r) => r.creator?.username || r.creator?.name || '-', width: 100 },
          { title: '大小', render: (_, r) => formatSize(r.size), width: 90 },
          { title: '相对路径', dataIndex: 'relativePath', copyable: true, ellipsis: true, width: 220 },
          { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime', width: 170 },
          {
            ...TABLE_ACTION_COLUMN_BASE,
            width: 70,
            render: (_, record) => (
              <TableActions>
                {record.mimeType?.startsWith('image/') ? (
                  <TableActionButton
                    title="预览"
                    icon={<EyeOutlined />}
                    onClick={() => void handlePreview(record)}
                  />
                ) : null}
                <TableActionButton
                  title="下载"
                  icon={<DownloadOutlined />}
                  onClick={() => void handleDownload(record)}
                />
              </TableActions>
            ),
          },
        ]}
      />

      {previewUrl && (
        <Image
          wrapperStyle={{ display: 'none' }}
          src={previewUrl}
          preview={{
            visible: previewOpen,
            src: previewUrl,
            title: previewName,
            onVisibleChange: (visible) => {
              if (!visible) closePreview();
              else setPreviewOpen(true);
            },
          }}
        />
      )}

      <Modal
        title="上传文件"
        open={uploadOpen}
        footer={null}
        onCancel={() => setUploadOpen(false)}
        destroyOnHidden
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <ProTable
            search={false}
            options={false}
            pagination={false}
            rowKey="bucketId"
            scroll={{ x: 'max-content' }}
            request={async () => {
              const res = await getStorageBuckets({ size: 200 });
              const { items } = parseApiListResponse<API.StorageBucket>(res);
              return { data: items, success: true };
            }}
            columns={[
              { title: '编码', dataIndex: 'code' },
              { title: '名称', dataIndex: 'name' },
              {
                ...TABLE_ACTION_COLUMN_BASE,
                width: 80,
                render: (_, row) => (
                  <TableActions>
                    <Tooltip title="选择文件">
                      <Upload
                        showUploadList={false}
                        disabled={!row.code || Boolean(uploadingBucketCode)}
                        customRequest={async ({ file, onSuccess, onError }) => {
                          if (!row.code) {
                            message.error('该 Bucket 缺少编码，无法上传');
                            onError?.(new Error('missing bucketCode'));
                            return;
                          }
                          setUploadingBucketCode(row.code);
                          try {
                            const fd = new FormData();
                            fd.append('file', file as File);
                            fd.append('bucketCode', row.code);
                            const res = await postStorageObjectUpload(fd);
                            if (isApiSuccess(res)) {
                              message.success('上传成功');
                              setUploadOpen(false);
                              actionRef.current?.reload();
                              onSuccess?.(res);
                            } else {
                              const err = new Error('upload failed');
                              message.error('上传失败');
                              onError?.(err);
                            }
                          } catch (e) {
                            message.error(e instanceof Error ? e.message : '上传失败');
                            onError?.(e as Error);
                          } finally {
                            setUploadingBucketCode(undefined);
                          }
                        }}
                      >
                        <Button
                          type="link"
                          size="small"
                          icon={<UploadOutlined />}
                          loading={uploadingBucketCode === row.code}
                          disabled={!row.code || Boolean(uploadingBucketCode)}
                        />
                      </Upload>
                    </Tooltip>
                  </TableActions>
                ),
              },
            ]}
          />
        </Space>
      </Modal>
    </PageContainer>
  );
};

export default BrowserPage;
