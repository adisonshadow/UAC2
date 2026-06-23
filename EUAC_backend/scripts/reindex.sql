-- 对需要重建的索引执行REINDEX操作
REINDEX INDEX uac.idx_users_email;
REINDEX INDEX uac.department_closure_pkey;
REINDEX INDEX uac.data_permission_rules_pkey;
REINDEX INDEX uac.data_permission_rules_deleted_at_idx;
REINDEX INDEX uac.data_permission_rules_status_idx;
REINDEX INDEX uac.operation_logs_pkey;
REINDEX INDEX uac.operation_logs_status_idx;
REINDEX INDEX uac.permissions_status_idx;
REINDEX INDEX uac.users_username_key;
REINDEX INDEX uac.login_attempts_pkey;
REINDEX INDEX uac.departments_code_key;
REINDEX INDEX uac.departments_status_idx;
REINDEX INDEX uac.roles_status_idx;
REINDEX INDEX uac.permissions_code_key;
REINDEX INDEX uac.permissions_deleted_at_idx;
REINDEX INDEX uac.department_history_pkey; 