import type { ConversationItemType } from '@ant-design/x';
import type { MessageInfo } from '@ant-design/x-sdk';
import type { ChatToolStep } from '../chat/chatToolSteps';
import type { EADAFChatMessage } from '../chat/EADAFChatProvider';

const DB_NAME = 'eadaf-aibase-chat';
const DB_VERSION = 1;
const META_STORE = 'meta';
const MESSAGES_STORE = 'messages';

export interface ChatStorageMeta {
  conversations: ConversationItemType[];
  activeConversationKey: string;
}

export interface PersistedChatMessage {
  id: string;
  status: string;
  message: EADAFChatMessage & {
    reasoningContent?: string;
    toolSteps?: ChatToolStep[];
  };
}

interface MetaRecord extends ChatStorageMeta {
  namespace: string;
  updatedAt: number;
}

interface MessagesRecord {
  id: string;
  namespace: string;
  conversationKey: string;
  messages: PersistedChatMessage[];
  updatedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'namespace' });
        }
        if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
          db.createObjectStore(MESSAGES_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    });
  }
  return dbPromise;
}

function runTransaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  runner: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const request = runner(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
      }),
  );
}

function messagesRecordId(namespace: string, conversationKey: string): string {
  return `${namespace}::${conversationKey}`;
}

export function getChatStorageNamespace(config: {
  applicationId?: string;
  scopeSlug?: string;
  /** 路由大类会话分组，优先于 scopeSlug（如 business_data、api_services） */
  sessionGroupId?: string;
}): string {
  const app = config.applicationId || 'default-app';
  const group = config.sessionGroupId || config.scopeSlug || 'global';
  return `${app}::${group}`;
}

export async function loadChatMeta(namespace: string): Promise<ChatStorageMeta | null> {
  try {
    const record = (await runTransaction<MetaRecord | undefined>(
      META_STORE,
      'readonly',
      (store) => store.get(namespace),
    )) as MetaRecord | undefined;
    if (!record?.conversations?.length || !record.activeConversationKey) {
      return null;
    }
    return {
      conversations: record.conversations,
      activeConversationKey: record.activeConversationKey,
    };
  } catch {
    return null;
  }
}

export async function saveChatMeta(namespace: string, meta: ChatStorageMeta): Promise<void> {
  try {
    const record: MetaRecord = {
      namespace,
      conversations: meta.conversations,
      activeConversationKey: meta.activeConversationKey,
      updatedAt: Date.now(),
    };
    await runTransaction(META_STORE, 'readwrite', (store) => store.put(record));
  } catch (error) {
    console.warn('[chatHistoryDb] saveChatMeta failed:', error);
  }
}

export async function loadConversationMessages(
  namespace: string,
  conversationKey: string,
): Promise<PersistedChatMessage[]> {
  try {
    const record = (await runTransaction<MessagesRecord | undefined>(
      MESSAGES_STORE,
      'readonly',
      (store) => store.get(messagesRecordId(namespace, conversationKey)),
    )) as MessagesRecord | undefined;
    return Array.isArray(record?.messages) ? record.messages : [];
  } catch {
    return [];
  }
}

const PERSISTABLE_STATUSES = new Set(['success', 'error', 'abort', 'local']);

export function sanitizeMessagesForPersist(
  messages: MessageInfo<EADAFChatMessage>[],
): PersistedChatMessage[] {
  return messages
    .filter((item) => PERSISTABLE_STATUSES.has(item.status))
    .filter((item) => item.message.role === 'user' || item.message.role === 'assistant')
    .map((item) => {
      const msg = item.message as EADAFChatMessage & {
        reasoningContent?: string;
        toolSteps?: ChatToolStep[];
        attachments?: EADAFChatMessage['attachments'];
      };
      const content =
        typeof msg.content === 'string'
          ? msg.content
          : Array.isArray(msg.attachments) && msg.attachments.length
            ? `[附件: ${msg.attachments.map((a) => a.name).join('、')}]`
            : '[含多模态附件]';
      return {
        id: String(item.id),
        status: item.status,
        message: {
          role: msg.role,
          content,
          ...(msg.reasoningContent ? { reasoningContent: msg.reasoningContent } : {}),
          ...(msg.toolSteps ? { toolSteps: msg.toolSteps } : {}),
          ...(msg.attachments?.length ? { attachments: msg.attachments } : {}),
        },
      };
    });
}

export async function saveConversationMessages(
  namespace: string,
  conversationKey: string,
  messages: MessageInfo<EADAFChatMessage>[],
): Promise<void> {
  const sanitized = sanitizeMessagesForPersist(messages);
  if (!sanitized.length) {
    try {
      await runTransaction(MESSAGES_STORE, 'readwrite', (store) =>
        store.delete(messagesRecordId(namespace, conversationKey)),
      );
    } catch (error) {
      console.warn('[chatHistoryDb] deleteConversationMessages failed:', error);
    }
    return;
  }

  try {
    const record: MessagesRecord = {
      id: messagesRecordId(namespace, conversationKey),
      namespace,
      conversationKey,
      messages: sanitized,
      updatedAt: Date.now(),
    };
    await runTransaction(MESSAGES_STORE, 'readwrite', (store) => store.put(record));
  } catch (error) {
    console.warn('[chatHistoryDb] saveConversationMessages failed:', error);
  }
}
