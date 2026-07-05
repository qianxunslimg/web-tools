from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.router import api_router
from common.logging import log_banner, setup_logging
from core.config import get_time_zone, settings
from core.exceptions import register_exception_handlers
from core.middleware import AccessLogMiddleware
from db.db import register_db


OPENAPI_TAGS = [
    {
        "name": "system 系统信息",
        "description": "服务健康检查和运行信息",
    },
    {
        "name": "site 站点能力",
        "description": "公开站点运行态和工具配置接口",
    },
    {
        "name": "ops 运维能力",
        "description": "运维密码保护的后台能力，支持开关、日志和数据库查询",
    },
    {
        "name": "byp_analyze 班易评分析",
        "description": "班易评导出 Excel 的统计分析接口",
    },
]


@asynccontextmanager
async def lifespan(application: FastAPI):
    setup_logging()
    settings.ensure_directories()
    settings.log_config()
    log_banner(
        "{} started at {}".format(
            settings.APP_NAME,
            datetime.now(tz=get_time_zone()).strftime("%Y-%m-%d %H:%M:%S"),
        )
    )
    yield
    log_banner(
        "{} stopped at {}".format(
            settings.APP_NAME,
            datetime.now(tz=get_time_zone()).strftime("%Y-%m-%d %H:%M:%S"),
        )
    )


def create_app():
    application = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        docs_url=settings.DOCS_URL,
        openapi_url=settings.OPENAPI_URL,
        openapi_tags=OPENAPI_TAGS,
        lifespan=lifespan,
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.get_cors_origins(),
        allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.add_middleware(AccessLogMiddleware)
    application.include_router(api_router, prefix=settings.API_PREFIX)
    register_exception_handlers(application)
    register_db(application)

    @application.get("/", summary="查看服务首页")
    async def root():
        return {
            "name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "environment": settings.ENVIRONMENT,
            "api_prefix": settings.API_PREFIX,
            "docs_url": settings.DOCS_URL,
        }

    return application


app = create_app()
