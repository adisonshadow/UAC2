-- 重置测试数据库
TRUNCATE TABLE uac.refresh_tokens CASCADE;
TRUNCATE TABLE uac.operation_logs CASCADE;
TRUNCATE TABLE uac.data_permission_rules CASCADE;
TRUNCATE TABLE uac.user_roles CASCADE;
TRUNCATE TABLE uac.role_permissions CASCADE;
TRUNCATE TABLE uac.permissions CASCADE;
TRUNCATE TABLE uac.roles CASCADE;
TRUNCATE TABLE uac.department_history CASCADE;
TRUNCATE TABLE uac.department_closure CASCADE;
TRUNCATE TABLE uac.departments CASCADE;
TRUNCATE TABLE uac.users CASCADE; 