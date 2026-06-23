/**
 * @name umi 的路由配置
 * @description 只支持 path,component,routes,redirect,wrappers,name,icon 的配置
 * @param path  path 只支持两种占位符配置，第一种是动态参数 :id 的形式，第二种是 * 通配符，通配符只能出现路由字符串的最后。
 * @param component 配置 location 和 path 匹配后用于渲染的 React 组件路径。可以是绝对路径，也可以是相对路径，如果是相对路径，会从 src/pages 开始找起。
 * @param routes 配置子路由，通常在需要为多个路径增加 layout 组件时使用。
 * @param redirect 配置路由跳转
 * @param wrappers 配置路由组件的包装组件，通过包装组件可以为当前的路由组件组合进更多的功能。 比如，可以用于路由级别的权限校验
 * @param name 配置路由的标题，默认读取国际化文件 menu.ts 中 menu.xxxx 的值，如配置 name 为 login，则读取 menu.ts 中 menu.login 的取值作为标题
 * @param icon 配置路由的图标，取值参考 https://ant.design/components/icon-cn， 注意去除风格后缀和大小写，如想要配置图标为 <StepBackwardOutlined /> 则取值应为 stepBackward 或 StepBackward，如想要配置图标为 <UserOutlined /> 则取值应为 user 或者 User
 * @doc https://umijs.org/docs/guides/routes
 */
export default [
  {
    path: '/',
    redirect: '/member_org',
  },
  {
    path: '/auth',
    layout: false,
    wrappers: ['@/wrappers/AIChatHidden'],
    routes: [
      {
        name: 'login',
        path: 'login',
        component: './Auth',
      },
      {
        name: 'reset-password',
        path: 'reset-password',
        component: './ResetPSWD',
      },
    ],
  },
  {
    path: '/member_org',
    name: '成员与组织管理',
    icon: 'TeamOutlined',
    wrappers: ['@/layouts/SecurityLayout'],
    routes: [
      {
        path: '',
        redirect: 'member',
      },
      {
        path: 'member',
        name: '成员管理',
        component: './MemberOrg/Member',
      },
      {
        path: 'organization',
        name: '组织架构管理',
        component: './MemberOrg/Organization',
      },
      {
        path: 'role',
        name: '角色管理',
        component: './MemberOrg/Role',
      },
      // {
      //   path: '/member_org/team',
      //   name: '组与团队管理',
      //   component: './MemberOrg/Team',
      // },
    ]
  },
  {
    path: '/permissions',
    name: '权限基础数据',
    icon: 'AuditOutlined',
    wrappers: ['@/layouts/SecurityLayout'],
    routes: [
      {
        path: '',
        redirect: 'menu',
      },
      {
        path: 'menu',
        name: '菜单权限',
        component: './Permissions/Menu',
      },
      {
        path: 'button',
        name: '按钮权限',
        component: './Permissions/Button',
      },
      {
        path: 'api',
        name: 'API权限',
        component: './Permissions/API',
      },
    ]
  },
  {
    path: '/service_provider',
    name: '三方应用管理',
    icon: 'PartitionOutlined',
    wrappers: ['@/layouts/SecurityLayout'],
    component: './ServiceProvider/Applications',
  },
  {
    path: '/business_data',
    name: '业务数据',
    icon: 'DatabaseOutlined',
    wrappers: ['@/layouts/SecurityLayout'],
    routes: [
      {
        path: '',
        redirect: 'model-design',
      },
      {
        path: 'model-design',
        name: '模型设计',
        component: './BusinessData/ModelDesigner',
        wrappers: ['@/wrappers/BusinessDataDesignAI'],
      },
      {
        path: 'materialization',
        name: '数据物化',
        component: './BusinessData/Materialization',
        wrappers: ['@/wrappers/BusinessDataMaterializeAI'],
      },
    ],
  },
  {
    path: '/ai_management',
    name: 'AI管理',
    icon: 'RobotOutlined',
    wrappers: ['@/layouts/SecurityLayout'],
    routes: [
      {
        path: '',
        redirect: 'providers',
      },
      {
        path: 'providers',
        name: 'AI服务商',
        component: './AIManagement/Providers',
      },
      {
        path: 'models',
        name: 'AI模型',
        component: './AIManagement/AiModels',
      },
      {
        path: 'chat-demo',
        name: 'AI Chat Demo',
        component: './AIManagement/ChatDemo',
      },
      {
        path: 'scopes',
        name: 'Scopes',
        component: './AIManagement/Scopes',
      },
      {
        path: 'tools',
        name: 'Tools',
        component: './AIManagement/Tools',
      },
      {
        path: 'skills',
        name: 'Skills',
        component: './AIManagement/Skills',
      },
      {
        path: 'request-logs',
        name: '请求日志',
        component: './AIManagement/RequestLogs',
      },
    ],
  },
  {
    path: '/account',
    name: '个人中心',
    icon: 'userOutlined',
    wrappers: ['@/layouts/SecurityLayout', '@/wrappers/AIChatHidden'],
    hideInMenu: true,
    layout: false,
    routes: [
      {
        path: 'center',
        name: '个人中心',
        component: './account/center',
        layout: false,
      },
    ],
  },
  {
    path: '*',
    layout: false,
    component: './404',
  },
  {
    path: '/403',
    layout: false,
    component: './403',
  },
  {
    path: '/401',
    layout: false,
    component: './401',
  },
  {
    path: '/500',
    layout: false,
    component: './500',
  },
];
