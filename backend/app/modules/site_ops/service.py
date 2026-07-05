from __future__ import annotations

import json
import shutil
import tempfile
import zipfile
from collections import deque
from datetime import datetime
from pathlib import Path
from threading import RLock
from typing import Any, Optional

from loguru import logger

from core.config import get_time_zone, settings


FEATURE_FILE_LOCK = RLock()
REMOVED_FEATURE_FLAG_KEYS = {"toolkit_intake_form", "site_blog"}

DEFAULT_FEATURE_FLAGS = [
    {
        "key": "site_overview_cards",
        "label": "首页导航卡片",
        "description": "首页展示最近能力和快捷入口。",
        "group": "site",
        "enabled": True,
        "public": True,
    },
    {
        "key": "toolkit_byp_analyze",
        "label": "BYP 分析工具",
        "description": "班易评 Excel 分析入口是否开放。",
        "group": "toolkit",
        "enabled": True,
        "public": True,
    },
    {
        "key": "ops_logs",
        "label": "日志查看",
        "description": "运维页日志查看能力。",
        "group": "ops",
        "enabled": True,
        "public": False,
    },
    {
        "key": "ops_submissions",
        "label": "数据库表查询",
        "description": "运维页数据库表白名单查询能力。",
        "group": "ops",
        "enabled": True,
        "public": False,
    },
]


def _now_dt() -> datetime:
    return datetime.now(tz=get_time_zone())


def _now_iso() -> str:
    return _now_dt().isoformat()


def _feature_flags_file() -> Path:
    return Path(settings.OPS_DATA_DIR).resolve() / "feature_flags.json"


def _atomic_write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_name(path.name + ".tmp")
    temp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temp_path.replace(path)


def _read_json(path: Path, default_payload: Any) -> Any:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        _atomic_write_json(path, default_payload)
        return default_payload

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        logger.warning("Failed to read json file {}: {}", path, exc)
        _atomic_write_json(path, default_payload)
        return default_payload


def _normalized_feature_flags() -> list[dict[str, Any]]:
    default_payload = {"flags": []}
    data = _read_json(_feature_flags_file(), default_payload)
    existing_flags = data.get("flags") if isinstance(data, dict) else []
    existing_map = {
        str(item.get("key")): item
        for item in existing_flags
        if isinstance(item, dict) and item.get("key")
    }

    merged: list[dict[str, Any]] = []
    changed = False

    for default_flag in DEFAULT_FEATURE_FLAGS:
        current = existing_map.get(default_flag["key"], {})
        merged_flag = {
            **default_flag,
            "enabled": bool(current.get("enabled", default_flag["enabled"])),
            "updated_at": str(current.get("updated_at") or _now_iso()),
        }
        if current != merged_flag:
            changed = True
        merged.append(merged_flag)

    known_keys = {item["key"] for item in DEFAULT_FEATURE_FLAGS}
    for key, item in existing_map.items():
        if key in REMOVED_FEATURE_FLAG_KEYS:
            changed = True
            continue
        if key not in known_keys:
            merged.append(item)

    if changed or len(existing_flags) != len(merged):
        _atomic_write_json(_feature_flags_file(), {"flags": merged})

    return merged

def get_all_feature_flags() -> list[dict[str, Any]]:
    with FEATURE_FILE_LOCK:
        return _normalized_feature_flags()


def get_public_feature_flags() -> list[dict[str, Any]]:
    return [item for item in get_all_feature_flags() if item.get("public")]


def is_feature_enabled(key: str, default: bool = True) -> bool:
    feature_map = {item["key"]: item for item in get_all_feature_flags()}
    item = feature_map.get(key)
    if item is None:
        return default
    return bool(item.get("enabled"))


def update_feature_flag(key: str, enabled: bool) -> dict[str, Any]:
    with FEATURE_FILE_LOCK:
        flags = _normalized_feature_flags()
        target = None
        for item in flags:
            if item.get("key") == key:
                item["enabled"] = bool(enabled)
                item["updated_at"] = _now_iso()
                target = item
                break
        if target is None:
            raise KeyError(key)
        _atomic_write_json(_feature_flags_file(), {"flags": flags})
        logger.info("Feature flag updated: {} -> {}", key, enabled)
        return target


def _ensure_log_dir() -> Path:
    log_dir = Path(settings.LOG_DIR).resolve()
    log_dir.mkdir(parents=True, exist_ok=True)
    return log_dir


def _safe_log_path(filename: str) -> Path:
    log_dir = _ensure_log_dir()
    candidate = (log_dir / filename).resolve()
    if log_dir != candidate and log_dir not in candidate.parents:
        raise ValueError("invalid log path")
    if not candidate.exists() or not candidate.is_file():
        raise FileNotFoundError(filename)
    return candidate


def list_log_files() -> list[dict[str, Any]]:
    files: list[dict[str, Any]] = []
    log_dir = _ensure_log_dir()
    for entry in log_dir.iterdir():
        if not entry.is_file():
            continue
        if entry.suffix.lower() not in {".log", ".txt", ".json", ".jsonl", ".gz", ".zip"}:
            continue
        stat = entry.stat()
        files.append(
            {
                "name": entry.name,
                "size": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime, tz=get_time_zone()).isoformat(),
            }
        )
    files.sort(key=lambda item: item["modified"], reverse=True)
    return files


def tail_log_file(
    filename: str,
    lines: int = 200,
    keyword: Optional[str] = None,
    level: Optional[str] = None,
) -> dict[str, Any]:
    path = _safe_log_path(filename)
    filtered_lines: deque[str] = deque(maxlen=lines)
    total_lines = 0
    matched_lines = 0
    keyword_text = (keyword or "").strip().lower()
    level_text = (level or "").strip().upper()

    with path.open("r", encoding="utf-8", errors="ignore") as handle:
        for raw in handle:
            total_lines += 1
            line = raw.rstrip("\n")
            normalized_line = line.lower()
            if keyword_text and keyword_text not in normalized_line:
                continue
            if level_text and level_text not in line.upper():
                continue
            matched_lines += 1
            filtered_lines.append(line)

    return {
        "file": path.name,
        "lines": list(filtered_lines),
        "total_lines": total_lines,
        "matched_lines": matched_lines,
    }


def resolve_log_file(filename: str) -> Path:
    return _safe_log_path(filename)


def build_logs_archive(archive_prefix: str = "site_logs_") -> Path:
    log_dir = _ensure_log_dir()
    temp_file = tempfile.NamedTemporaryFile(prefix=archive_prefix, suffix=".zip", delete=False)
    archive_path = Path(temp_file.name)
    temp_file.close()

    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(log_dir.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(log_dir))
    return archive_path


def copy_log_file_to_temp(filename: str, temp_prefix: str = "site_log_") -> tuple[Path, str]:
    path = _safe_log_path(filename)
    temp_file = tempfile.NamedTemporaryFile(
        prefix=temp_prefix,
        suffix=path.suffix or ".log",
        delete=False,
    )
    temp_path = Path(temp_file.name)
    temp_file.close()
    shutil.copyfile(path, temp_path)
    return temp_path, path.name


async def build_ops_overview() -> dict[str, Any]:
    features = get_all_feature_flags()
    log_files = list_log_files()

    return {
        "service_name": settings.APP_NAME,
        "service_version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "log_dir": settings.LOG_DIR,
        "db_enabled": settings.DB_ENABLED,
        "log_files_count": len(log_files),
        "enabled_features": sum(1 for item in features if item.get("enabled")),
        "feature_count": len(features),
        "recent_logs": log_files[:5],
    }


def get_site_runtime_payload() -> dict[str, Any]:
    public_flags = get_public_feature_flags()
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "feature_flags": public_flags,
        "feature_map": {item["key"]: bool(item.get("enabled")) for item in public_flags},
    }
