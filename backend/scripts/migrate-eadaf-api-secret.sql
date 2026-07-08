-- EADAF 系统应用 API 密钥（dev 联调）
UPDATE uac.applications
SET api_connect_config = jsonb_build_object(
  'app_secret', '0776b8f3ca4d8232630ca04b984ba8d2ec03a73c79e6161c32e3bf35904d7f93'
),
api_enabled = true,
updated_at = CURRENT_TIMESTAMP
WHERE code = 'EADAF';
