# frontend

这个前端参考了 `data_collection_platform/frontend` 的分层方式：

- `src/api`: 接口请求与类型
- `src/app`: 常量和站点级配置
- `src/layout`: 顶层布局
- `src/features`: 页面功能模块

但页面内容改成了个人网站场景，并直接接入当前后端的 `/api/v1/system/health` 和 `/api/v1/byp_analyze/`。

## 本地开发

```bash
cd frontend
npm install
npm run dev
```

默认访问 `http://localhost:5173`。
如果要改 API 代理地址，再复制 `.env.example` 为 `.env` 并调整对应字段。
