import { Crepe, CrepeFeature } from '@milkdown/crepe';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/classic.css';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import React, { useRef } from 'react';
import './index.css';

export interface MilkdownCrepeEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  readonly?: boolean;
  placeholder?: string;
  minHeight?: number;
  style?: React.CSSProperties;
  /** 变更时 remount 编辑器以加载新内容 */
  editorKey?: string | number;
}

interface CrepeEditorInnerProps {
  defaultValue: string;
  readonly: boolean;
  placeholder?: string;
  onChange?: (value: string) => void;
}

const CrepeEditorInner: React.FC<CrepeEditorInnerProps> = ({
  defaultValue,
  readonly,
  placeholder,
  onChange,
}) => {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEditor(
    (root) => {
      const crepe = new Crepe({
        root,
        defaultValue,
        featureConfigs: {
          [CrepeFeature.Placeholder]: {
            text: placeholder || '在此输入内容...',
            mode: 'block',
          },
        },
      });

      crepe.setReadonly(readonly);

      if (!readonly) {
        crepe.on((listener) => {
          listener.markdownUpdated((_ctx, markdown) => {
            onChangeRef.current?.(markdown);
          });
        });
      }

      return crepe;
    },
    [readonly, placeholder],
  );

  return <Milkdown />;
};

const MilkdownCrepeEditor: React.FC<MilkdownCrepeEditorProps> = ({
  value = '',
  onChange,
  readonly = false,
  placeholder,
  minHeight = 320,
  style,
  editorKey,
}) => {
  return (
    <div
      className={`milkdown-crepe-editor${readonly ? ' milkdown-crepe-editor--readonly' : ''}`}
      style={{ minHeight, height: '100%', ...style }}
    >
      <MilkdownProvider key={editorKey}>
        <CrepeEditorInner
          defaultValue={value}
          readonly={readonly}
          placeholder={placeholder}
          onChange={readonly ? undefined : onChange}
        />
      </MilkdownProvider>
    </div>
  );
};

export default MilkdownCrepeEditor;
