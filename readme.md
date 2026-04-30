# my_fastapi_service

这是一个面向个人网站场景的全栈骨架，后端和前端都参考了 `data_collection_platform` 的分层方式，但保留了更轻量、更适合个人项目的实现。

## 当前目录结构

```text
backend
├── Dockerfile               # 后端镜像构建
└── app
    ├── app.py               # 应用工厂与 FastAPI 入口
    ├── api                  # 接口层，只处理路由和协议
    ├── common               # 通用响应模型、日志等共享能力
    ├── core                 # 配置、异常、中间件等基础设施
    ├── db                   # 数据库接入与模型定义
    ├── migrations           # Aerich 迁移文件
    └── modules              # 业务层，沉淀可复用业务逻辑

frontend
├── src/api                  # 前端 API client 和接口类型
├── src/app                  # 站点常量和轻量状态定义
├── src/layout               # 顶层头部和布局组件
├── src/features             # 首页、项目、写作、工具区模块
└── src/styles.css           # 全局样式和视觉系统
```

博客内容已经纳入当前仓库，目录位于：

```text
backend/app/content/blog
├── README.md
└── posts
    └── YYYY/slug
        ├── index.md
        └── assets/
```

## 重构原则

- `api` 只保留协议层代码，具体业务逻辑下沉到 `modules`
- `frontend` 借鉴参考项目的 `api/app/layout/features` 分层，而不是复制后台业务页面
- 个人网站和在线工具放在同一个前端里，共享样式、布局和接口能力
- `backend` 和 `frontend` 分目录组织，和参考项目保持一致
- MySQL 已经并入顶层 `docker-compose.yml`，本地启动不再需要单独进 `mysql/`

## 运行方式

配置文件：

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

后端默认值已经写在代码里，如果你不需要改库连接、环境标识这类配置，`backend/.env` 可以不建。

后端：

```bash
cd backend/app
./run.sh
```

前端：

```bash
cd frontend
npm run dev
```

也可以直接用 Docker Compose：

```bash
docker compose up --build
```

默认地址：

- MySQL：`localhost:4306`
- 后端：`http://localhost:9000`
- 文档：`http://localhost:9000/docs`
- 前端：`http://localhost:9001`

## 博客写作

旧 Hexo 博客已经导入到 `backend/app/content/blog/posts`，后续新文章也继续放这里。

图片规则统一为：

```md
![示例图片](./assets/example.png)
```

也就是每篇文章一个目录，图片和附件都放在当前文章目录的 `assets/` 下。服务端会自动把相对路径解析成站内资源地址。

新建文章可以直接用脚手架：

```bash
cd backend/app
python tools/create_blog_post.py --title "我的新文章" --slug my-new-post --category 开发随笔 --tag 记录
```

如果你之后还想从旧静态博客重新导一次，可以用：

```bash
cd backend/app
python tools/import_hexo_blog.py --source /你的旧博客静态站目录 --clean
```

## Env 说明

- `backend/.env`：给 FastAPI 后端配置用，可选；只有需要覆盖默认值时再写
- `frontend/.env`：给 Vite 本地开发用
