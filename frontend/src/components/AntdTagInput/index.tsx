import { CloseCircleFilled } from '@ant-design/icons';
import { Input, Tag, Tooltip, message } from 'antd';
import type { InputRef } from 'antd';
import classNames from 'classnames';
import React, { useRef, useState } from 'react';
import './index.css';

export type AntdTagInputProps = {
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  value?: string[];
  onChange?: (value: string[]) => void;
  disabled?: boolean;
};

function splitTagTokens(text: string) {
  return text
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function addTags(current: string[], incoming: string[]) {
  const next = [...current];
  incoming.forEach((tag) => {
    if (!next.includes(tag)) {
      next.push(tag);
      return;
    }
    message.warning(`标签「${tag}」已存在`);
  });
  return next;
}

const AntdTagInput: React.FC<AntdTagInputProps> = ({
  id,
  className,
  style,
  placeholder,
  value = [],
  onChange,
  disabled,
}) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<InputRef>(null);

  const commitInput = (raw?: string) => {
    const tokens = splitTagTokens(raw ?? inputValue);
    if (!tokens.length) return;
    onChange?.(addTags(value, tokens));
    setInputValue('');
  };

  const handleDelete = (tag: string) => {
    if (disabled) return;
    onChange?.(value.filter((item) => item !== tag));
  };

  const handleClear = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (disabled) return;
    onChange?.([]);
    setInputValue('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitInput();
      return;
    }
    if (event.key === 'Backspace' && !inputValue && value.length) {
      onChange?.(value.slice(0, -1));
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text');
    if (!/[,，]/.test(text)) return;
    event.preventDefault();
    commitInput(text);
  };

  const showClear = !disabled && value.length > 0;

  return (
    <span
      id={id}
      className={classNames(
        'ant-input-affix-wrapper',
        'ant-input-outlined',
        'antd-tag-input',
        {
          'ant-input-disabled': disabled,
        },
        className,
      )}
      style={style}
      onClick={() => {
        if (!disabled) inputRef.current?.focus();
      }}
    >
      <span className="antd-tag-input__content">
        {value.map((item) => {
          const tag = (
            <Tag
              key={item}
              closable={!disabled}
              className="antd-tag-input__tag"
              onClose={(event) => {
                event.preventDefault();
                handleDelete(item);
              }}
            >
              {item.length > 20 ? `${item.slice(0, 20)}...` : item}
            </Tag>
          );

          return item.length > 20 ? (
            <Tooltip title={item} key={item}>
              {tag}
            </Tooltip>
          ) : (
            tag
          );
        })}
        <Input
          ref={inputRef}
          variant="borderless"
          disabled={disabled}
          className="antd-tag-input__input"
          placeholder={value.length ? undefined : placeholder}
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onBlur={() => commitInput()}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
        />
      </span>
      {showClear ? (
        <span className="ant-input-suffix" onMouseDown={(event) => event.preventDefault()}>
          <CloseCircleFilled
            role="button"
            aria-label="close-circle"
            className="ant-input-clear-icon"
            onClick={handleClear}
          />
        </span>
      ) : null}
    </span>
  );
};

export default AntdTagInput;
