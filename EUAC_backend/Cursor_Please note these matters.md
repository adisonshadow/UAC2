Cursor，你一定要注意这些事项：

- 修改本项目的代码并保存后，web服务会自动启动，无需你启动
- 如果你需要安装package, 
    1. 先执行使用VPN： export http_proxy=http://127.0.0.1:7890 &&export https_proxy=$http_proxy
    2. 使用 sudo yarn，需要密码时再提示我
- 使用curl 测试一个API时，如需认证token，请向我索要一个
- 不要删除我留下的注释(以 // // 开头)，你自己写的注释随你处置
- 修改代码后如需更新API文档，不要忘记更新相关路由中的 swagger注释，也不要忘记检查swagger注释中的Schemas是否需要更新
- 如需连接数据库，请打开 ./config.json 查看连接信息
- 如需修改表结构，请先告知我详细，经过我确认后再修改，数据库结构文件在 scripts/schemas.sql，修改后我将手工更新到数据库

## 本项目特殊设计
### 权限 permissions

#### 资源类型 resource_type
- 分为MENU、BUTTON、API

#### 操作类型 actions
- 包含create、read、update、delete
- API 的 action 有 create、read、update、delete
- MENU、BUTTON 的 action 只有 read