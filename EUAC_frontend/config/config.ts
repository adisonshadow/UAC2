// https://umijs.org/config/
import { defineConfig } from '@umijs/max';
// import { history } from '@umijs/max';
import defaultSettings from './defaultSettings';
import routes from './routes';
// import { NO_TOKEN_APIS, AUTH_HEADER, AUTH_PREFIX, AUTH_PAGES } from '@/constants/auth';
import { APP_ENV } from './env';

// Umi 仅读取 process.env.PORT，不识别 .env.development
process.env.PORT = String(APP_ENV.port);

export default defineConfig({
  define: {
    // 生产环境 API 地址注入前端；开发环境留空，走 proxy 
    'process.env.APP_API_BASE_URL': JSON.stringify(APP_ENV.prodApiBaseUrl),
  },
  // 启用请求配置
  request: {
    dataField: 'data',
  },
  /**
   * @name 开启 hash 模式
   * @description 让 build 之后的产物包含 hash 后缀。通常用于增量发布和避免浏览器加载缓存。
   * @doc https://umijs.org/docs/api/config#hash
   */
  hash: false,

  /**
   * @name history 配置
   * @description 配置 history 类型和基础路径
   * @doc https://umijs.org/docs/api/config#history
   */
  history: {
    type: 'browser',
  },

  /**
   * @name 兼容性设置
   * @description 设置 ie11 不一定完美兼容，需要检查自己使用的所有依赖
   * @doc https://umijs.org/docs/api/config#targets
   */
  // targets: {
  //   ie: 11,
  // },
  /**
   * @name 路由的配置，不在路由中引入的文件不会编译
   * @description 只支持 path，component，routes，redirect，wrappers，title 的配置
   * @doc https://umijs.org/docs/guides/routes
   */
  // umi routes: https://umijs.org/docs/routing
  routes,
  /**
   * @name 主题的配置
   * @description 虽然叫主题，但是其实只是 less 的变量设置
   * @doc antd的主题设置 https://ant.design/docs/react/customize-theme-cn
   * @doc umi 的theme 配置 https://umijs.org/docs/api/config#theme
   */
  theme: {
    // 如果不想要 configProvide 动态设置主题需要把这个设置为 default
    // 只有设置为 variable， 才能使用 configProvide 动态设置主色调
    'root-entry-name': 'variable',
    token: {
      colorPrimary: '#137cfd',
      colorInfo: '#2084ff',
      colorSuccess: '#4cc60f',
      colorError: '#fc3c3f',
      colorTextBase: '#1b1b1b',
      sizeStep: 4,
      borderRadius: 4,
      wireframe: false,
    },
    components: {
      Button: {
        algorithm: true,
        defaultHoverColor: 'rgb(83,172,255)',
      },
    },
  },
  /**
   * @name moment 的国际化配置
   * @description 如果对国际化没有要求，打开之后能减少js的包大小
   * @doc https://umijs.org/docs/api/config#ignoremomentlocale
   */
  ignoreMomentLocale: true,
  /**
   * @name 快速热更新配置
   * @description 一个不错的热更新组件，更新时可以保留 state
   */
  fastRefresh: true,
  //============== 以下都是max的插件配置 ===============
  /**
   * @name 数据流插件
   * @@doc https://umijs.org/docs/max/data-flow
   */
  model: {},
  /**
   * 一个全局的初始数据流，可以用它在插件之间共享数据
   * @description 可以用来存放一些全局的数据，比如用户信息，或者一些全局的状态，全局初始状态在整个 Umi 项目的最开始创建。
   * @doc https://umijs.org/docs/max/data-flow#%E5%85%A8%E5%B1%80%E5%88%9D%E5%A7%8B%E7%8A%B6%E6%80%81
   */
  initialState: {},
  /**
   * @name layout 插件
   * @doc https://umijs.org/docs/max/layout-menu
   */
  layout: {
    locale: true,
    title: 'UAC Admin',
    ...defaultSettings,
  },
  /**
   * @name moment2dayjs 插件
   * @description 将项目中的 moment 替换为 dayjs
   * @doc https://umijs.org/docs/max/moment2dayjs
   */
  moment2dayjs: {
    preset: 'antd',
    plugins: ['duration'],
  },
  /**
   * @name 国际化插件
   * @doc https://umijs.org/docs/max/i18n
   */
  locale: {
    // default zh-CN
    default: 'zh-CN',
    antd: true,
    // default true, when it is true, will use `navigator.language` overwrite default
    baseNavigator: true,
  },
  /**
   * @name antd 插件
   * @description 内置了 babel import 插件
   * @doc https://umijs.org/docs/max/antd#antd
   */
  antd: {},
  /**
   * @name 代理配置
   * @description 可以让你的本地服务器代理到你的服务器上，这样你就可以访问服务器的数据了
   * @see 要注意以下 代理只能在本地开发时使用，build 之后就无法使用了。
   * @doc 代理介绍 https://umijs.org/docs/guides/proxy
   * @doc 代理配置 https://umijs.org/docs/api/config#proxy
   */
  proxy: {
    '/api': {
      target: APP_ENV.devApiBaseUrl,
      changeOrigin: true,
      onProxyRes: (proxyRes) => {
        const contentType = proxyRes.headers['content-type'] || '';
        if (contentType.includes('text/event-stream')) {
          proxyRes.headers['cache-control'] = 'no-cache, no-transform';
          proxyRes.headers['x-accel-buffering'] = 'no';
        }
      },
    },
  },

  /**
   * @name 权限插件
   * @description 基于 initialState 的权限插件，必须先打开 initialState
   * @doc https://umijs.org/docs/max/access
   */
  access: {},
  /**
   * @name <head> 中额外的 script
   * @description 配置 <head> 中额外的 script
   */
  headScripts: [
    {
      content: `
        window.__CSP__ = {
          'default-src': ["'self'"],
          'script-src': ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'https:'],
          'connect-src': ["'self'", 'https:'],
          'font-src': ["'self'", 'data:'],
          'object-src': ["'none'"],
          'media-src': ["'self'"],
          'frame-src': ["'self'"],
        };
      `,
    },
  ],
  mfsu: {
    strategy: 'normal',
  },
  esbuildMinifyIIFE: true, // 修复 esbuild 压缩器自动引入的全局变量导致的命名冲突问题
  // 配置 CSP，主要是 忽略 unsafe-eval 和 unsafe-inline 报错
  metas: [ 
    {
      'http-equiv': 'Content-Security-Policy',
      'content': 'script-src \'self\' \'unsafe-eval\' \'unsafe-inline\' \'sha256-YuUrc/n9jKJwiFhr45L/ozn/PEUJlBjfgOJghn7bKzw=\';',
    },
  ],
});
