from fastapi import APIRouter

from api.byp_analyze import byp_analyze_api
from api.ops import ops_api
from api.site import site_api
from api.system import system_api


api_router = APIRouter()

api_router.include_router(system_api.router, prefix="/system", tags=["system 系统信息"])
api_router.include_router(site_api.router, prefix="/site", tags=["site 站点能力"])
api_router.include_router(ops_api.router, prefix="/ops", tags=["ops 运维能力"])
api_router.include_router(
    byp_analyze_api.router,
    prefix="/byp_analyze",
    tags=["byp_analyze 班易评分析"],
)
