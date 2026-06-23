const Router = require('koa-router');
const roleRoutes = require('./roleRoutes');
const userRoutes = require('./userRoutes');
const authRoutes = require('./authRoutes');
const permissionRoutes = require('./permissionRoutes');
const uploadRoutes = require('./uploadRoutes');
const departmentRoutes = require('./departmentRoutes');
const captchaRoutes = require('./captchaRoutes');
const applicationRoutes = require('./applicationRoutes');
const applicationSsoRoutes = require('./applicationSsoRoutes');
const adminProviderRoutes = require('./adminProviderRoutes');
const adminAiModelRoutes = require('./adminAiModelRoutes');
const adminScopeRoutes = require('./adminScopeRoutes');
const adminToolRoutes = require('./adminToolRoutes');
const adminSkillRoutes = require('./adminSkillRoutes');
const adminAiRequestLogRoutes = require('./adminAiRequestLogRoutes');
const aiRoutes = require('./aiRoutes');
const demoSalesRoutes = require('./demoSalesRoutes');
const businessDataRoutes = require('./businessDataRoutes');

const router = new Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     SSOConfig:
 *       type: object
 *       required:
 *         - protocol
 *         - redirect_uri
 *         - salt
 *       properties:
 *         protocol:
 *           type: string
 *           enum: [OIDC]
 *           description: SSO使用的协议
 *           example: "OIDC"
 *         redirect_uri:
 *           type: string
 *           format: uri
 *           description: SSO回调地址
 *           example: "https://hrms.example.com/auth/callback"
 *         salt:
 *           type: string
 *           description: SSO签名盐值，用于JWT签名
 *           example: "sso-salt-123"
 *         secret:
 *           type: string
 *           description: 基于currenttime、salt，使用 bcrypt 生成的Hash值
 *           example: "$2a$10$xxxxx"
 *         currentTimestamp:
 *           type: integer
 *           description: 当前时间戳， 用于生成secret
 *           example: 17198592000
 *         redirect_mode:
 *           type: string
 *           enum: [POST_REDIRECT, HEADER_REDIRECT]
 *           default: POST_REDIRECT
 *           description: |
 *             SSO跳转模式
 *             - POST_REDIRECT: POST跳转（默认）
 *             - HEADER_REDIRECT: 302重定向+URL参数
 *           example: "POST_REDIRECT"
 *         base_url:
 *           type: string
 *           format: uri
 *           description: SSO系统的基础URL
 *           example: "https://your-sso-system.com"
 *         client_id:
 *           type: string
 *           description: OIDC客户端ID
 *           example: "your-client-id"
 *         client_secret:
 *           type: string
 *           description: OIDC客户端密钥
 *           example: "your-client-secret"
 *         issuer:
 *           type: string
 *           format: uri
 *           description: OIDC发行者URL
 *           example: "https://sso.example.com"
 *         frontend_url:
 *           type: string
 *           format: uri
 *           description: 前端应用URL
 *           example: "https://your-app.com"
 *         additional_params:
 *           type: object
 *           description: 其他SSO协议特定的参数
 *           additionalProperties: true
 *           example: {
 *             "client_id": "hrms-client",
 *             "client_secret": "your-client-secret",
 *             "issuer": "https://sso.example.com"
 *           }
 *     APIConnectConfig:
 *       type: object
 *       required:
 *         - salt
 *       properties:
 *         app_secret:
 *           type: string
 *           description: 应用API私钥（由服务端根据 application_id 和 salt 生成）
 *           example: "wLTAwMDAtMDAwMDAwMDAwMDAxIiwidXNlcm5hbWUiOiJhZG1pbiIsImlhdCI6MTc0OTE4MTAyMCwiZXhwIjoxNzQ5MjY3NDIwfQ.VOfXDBi5DeWGTsAMzRmBNfP4AikJhT6WevpupizBrm4"
 *         salt:
 *           type: string
 *           description: 签名盐值
 *           example: "random-salt-456"
 *     APIDataScope:
 *       type: object
 *       description: API数据权限范围配置
 *       additionalProperties:
 *         type: string
 *         enum: [all, department, self]
 *         description: 数据权限范围
 *       example:
 *         user:read: "department"
 *         user:write: "self"
 *         department:read: "all"
 *     Application:
 *       type: object
 *       properties:
 *         application_id:
 *           type: string
 *           format: uuid
 *           description: 应用ID
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         name:
 *           type: string
 *           description: 应用名称
 *           example: "人力资源管理系统"
 *         code:
 *           type: string
 *           description: 应用编码
 *           example: "hrms"
 *         status:
 *           type: string
 *           enum: [ACTIVE, DISABLED]
 *           description: 应用状态
 *           example: "ACTIVE"
 *         sso_enabled:
 *           type: boolean
 *           description: 是否启用SSO
 *           example: true
 *         sso_config:
 *           $ref: '#/components/schemas/SSOConfig'
 *         api_enabled:
 *           type: boolean
 *           description: 是否启用API服务
 *           example: true
 *         api_connect_config:
 *           $ref: '#/components/schemas/APIConnectConfig'
 *         api_data_scope:
 *           $ref: '#/components/schemas/APIDataScope'
 *         description:
 *           type: string
 *           description: 应用描述
 *           example: "公司人力资源管理系统"
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *           example: "2024-03-21T10:00:00.000Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 *           example: "2024-03-21T10:00:00.000Z"
 *         deleted_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: 删除时间
 *           example: null
 *     User:
 *       type: object
 *       properties:
 *         user_id:
 *           type: string
 *           format: uuid
 *         username:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         phone:
 *           type: string
 *         status:
 *           type: string
 *           enum: [ACTIVE, DISABLED]
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     Role:
 *       type: object
 *       properties:
 *         role_id:
 *           type: string
 *           format: uuid
 *         role_name:
 *           type: string
 *         code:
 *           type: string
 *         description:
 *           type: string
 *         status:
 *           type: string
 *           enum: [ACTIVE, ARCHIVED]
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     Permission:
 *       type: object
 *       properties:
 *         permission_id:
 *           type: string
 *           format: uuid
 *           description: 权限ID
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         name:
 *           type: string
 *           description: 权限名称
 *           example: "用户管理"
 *         code:
 *           type: string
 *           description: 权限编码
 *           example: "user:manage"
 *         description:
 *           type: string
 *           description: 权限描述
 *           example: "允许对用户进行增删改查操作"
 *         resource_type:
 *           type: string
 *           description: 资源类型
 *           enum: [MENU, BUTTON, API]
 *           example: "MENU"
 *         actions:
 *           type: array
 *           description: 操作类型列表
 *           items:
 *             type: string
 *             enum: [create, read, update, delete]
 *           example: ["create", "read", "update", "delete"]
 *         parent_id:
 *           type: string
 *           format: uuid
 *           description: 父权限ID
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         status:
 *           type: string
 *           enum: [ACTIVE, DISABLED]
 *           description: 权限状态
 *           example: "ACTIVE"
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *           example: "2024-03-21T10:00:00.000Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 *           example: "2024-03-21T10:00:00.000Z"
 *     Department:
 *       type: object
 *       properties:
 *         department_id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         code:
 *           type: string
 *         parent_id:
 *           type: string
 *           format: uuid
 *         status:
 *           type: string
 *           enum: [ACTIVE, DISABLED]
 *         description:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     File:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         filename:
 *           type: string
 *         originalname:
 *           type: string
 *         mimetype:
 *           type: string
 *         size:
 *           type: integer
 *         path:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *     Captcha:
 *       type: object
 *       properties:
 *         captcha_id:
 *           type: string
 *           format: uuid
 *         target_position:
 *           type: object
 *           properties:
 *             x:
 *               type: number
 *             y:
 *               type: number
 *         image:
 *           type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *         expires_at:
 *           type: string
 *           format: date-time
 *     Error:
 *       type: object
 *       properties:
 *         code:
 *           type: integer
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           nullable: true
 */

// 注册各个模块的路由
router.use(authRoutes.routes());
router.use(userRoutes.routes());
router.use(roleRoutes.routes());
router.use(permissionRoutes.routes());
router.use(departmentRoutes.routes());
router.use(uploadRoutes.routes());
router.use(captchaRoutes.routes());
router.use(applicationRoutes.routes());
router.use(applicationSsoRoutes.routes());
router.use(adminProviderRoutes.routes());
router.use(adminAiModelRoutes.routes());
router.use(adminScopeRoutes.routes());
router.use(adminToolRoutes.routes());
router.use(adminSkillRoutes.routes());
router.use(adminAiRequestLogRoutes.routes());
router.use(aiRoutes.routes());
router.use(demoSalesRoutes.routes());
router.use(businessDataRoutes.routes());

module.exports = router; 