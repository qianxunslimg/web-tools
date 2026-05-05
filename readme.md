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

Docker Compose 默认不需要准备根目录 `.env`，端口、MySQL 账号和低内存参数已经写在 `docker-compose.yml` 里。

如果你手动在宿主机跑后端或前端，需要覆盖代码默认值时再复制各自目录下的 env 模板：

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

也可以通过脚本启动 Docker Compose：

```bash
scripts/run.sh dev
```

默认 `docker-compose.yml` 启动本地开发态：

- 前端使用 Vite dev server，支持热更新
- 后端挂载 `backend/app` 并启用 `uvicorn --reload`
- MySQL、后端、前端端口默认只绑定 `127.0.0.1`

服务器部署也使用同一个 `docker-compose.yml`，但只启动 `prod` profile 里的生产服务：

- 前端使用 `nginx` 静态服务，不跑 Vite dev server
- 后端使用普通 `uvicorn`，不启用 `--reload`
- 前端 nginx 同源代理 `/api`、`/docs`、`/openapi.json` 到后端，服务器上不需要公开后端 9000 端口
- MySQL 使用固定的低内存参数，适合 2 核 2G 这类小机器

```bash
scripts/run.sh prod
```

生产模式默认不会 build 镜像，避免服务器没外网时触发 `npm/pip` 下载。如果确实要在当前机器构建：

```bash
scripts/run.sh prod --build
```

如果服务器内存很小，`--build` 阶段仍然可能比运行态更吃内存，尤其是前端 Vite 构建。更稳的方式是在本地或 CI 构建镜像，服务器只 `docker load -i` 后启动。

低内存服务器推荐发布方式：

```bash
# 本地或 CI 机器执行
scripts/build_images.sh --output release/my_fastapi_service_images.tar

# 上传 release/my_fastapi_service_images.tar 和当前仓库到服务器后，在服务器执行
docker load -i release/my_fastapi_service_images.tar
scripts/run.sh prod
```

默认地址：

- 本地 MySQL：`localhost:4306`
- 本地后端：`http://localhost:9000`
- 本地文档：`http://localhost:9000/docs`
- 本地前端：`http://localhost:9001`
- 生产前端：`http://服务器IP:9001`，API 和文档走同源代理

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

- Docker Compose 运行不依赖根目录 `.env`
- `backend/.env`：只在手动运行后端且需要覆盖默认配置时使用
- `frontend/.env`：只在手动运行前端且需要覆盖 API 地址时使用
