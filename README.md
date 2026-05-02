# Server Configuration

## 服务器结构

```
/home/ubuntu/
├── Backend-server-Veda/          # 后端服务（Node.js）
│   ├── modules/
│   │   ├── memo/                 # 数字化学习空间模块
│   │   └── veda/                 # 韦达书库模块
│   ├── db/                       # 数据库
│   ├── server.js                 # 主服务器文件
│   └── package.json              # 依赖配置
│
/var/www/
├── krishna/                      # 前端代码（静态文件）
│   ├── app.js                    # 前端逻辑
│   ├── index.html                # 主页面
│   └── style.css                 # 样式
```

## 后端服务

- **地址：** http://124.223.1.32:3001
- **API 基础路径：** /api
- **启动命令：** npm start
- **健康检查：** GET /api/health

## 前端服务

- **地址：** https://krishna.xn--fiqs8s
- **API 基础 URL：** http://124.223.1.32:3001/api
- **部署位置：** /var/www/krishna/

## 最近修改

- 修复前端 API 配置（API_BASE 指向后端服务）
