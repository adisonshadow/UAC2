-- 创建超级管理员
-- 1. 创建超级管理员角色
INSERT INTO uac.roles (role_id, role_name, code, description, status)
VALUES (
    '10000000-0000-0000-0000-000000000001',
    '超级管理员',
    'SUPER_ADMIN',
    '系统最高权限角色',
    'ACTIVE'
);

-- 2. 创建管理员用户（密码：123456）
INSERT INTO uac.users (user_id, username, password_hash, email, avatar, phone, gender, status)
VALUES (
    '10000000-0000-0000-0000-000000000001',
    'admin',
    '$2a$10$8c90r1pL61cViUzyWnGb.OesyqAoTSuWf6pfWVhSBVvaNFnuJko9.',  -- 123456 的 bcrypt 哈希
    'admin@test.com',
    '1fa0a3de-d1d2-406f-89f0-a9522e0c0c3a',
    '13800138000',
    'MALE',
    'ACTIVE'
);

-- 3. 为超级管理员角色分配所有权限
INSERT INTO uac.role_permissions (role_id, permission_id)
SELECT 
    '10000000-0000-0000-0000-000000000001', -- 超级管理员角色ID
    permission_id
FROM uac.permissions;

-- 4. 将超级管理员角色分配给admin用户
INSERT INTO uac.user_roles (user_id, role_id)
VALUES (
    '10000000-0000-0000-0000-000000000001', -- admin用户ID
    '10000000-0000-0000-0000-000000000001'  -- 超级管理员角色ID
);

-- 5. 为超级管理员添加所有数据权限规则
INSERT INTO uac.data_permission_rules (role_id, resource_type, conditions, status)
VALUES (
    '10000000-0000-0000-0000-000000000001',
    '*',
    '{"operator": "ALL"}',
    'ACTIVE'
); 