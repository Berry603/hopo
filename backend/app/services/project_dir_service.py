"""
项目文件目录管理服务
审计项目创建时自动生成标准文件夹结构
"""
import os
import sys
from pathlib import Path
from datetime import datetime
from loguru import logger

# 直接加载模板模块，避免触发 services/__init__.py 的导入链
_template_path = Path(__file__).parent / "project_dir_template.py"
import importlib.util
_spec = importlib.util.spec_from_file_location("_project_dir_template", _template_path)
_tpl = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_tpl)
PROJECT_DIR_TREE = _tpl.PROJECT_DIR_TREE
FOLDER_INDEX_CONTENT = _tpl.FOLDER_INDEX_CONTENT

# 项目根目录
AUDIT_PROJECTS_ROOT = Path(__file__).resolve().parent.parent.parent.parent / "Auditoprojects"


def get_project_dir(project_code: str, project_name: str) -> str:
    """
    获取（如不存在则创建）项目文件夹路径

    Args:
        project_code: 项目编号
        project_name: 项目名称

    Returns:
        project_dir: 项目文件夹的绝对路径
    """
    safe_name = _sanitize_name(project_name)
    project_dir_name = f"{project_code}_{safe_name}"
    project_dir = AUDIT_PROJECTS_ROOT / project_dir_name
    project_dir.mkdir(parents=True, exist_ok=True)
    return str(project_dir)


def get_project_file_path(project_code: str, project_name: str, subdir: str, filename: str) -> str:
    """获取项目子目录下的文件完整路径（自动创建子目录）"""
    project_dir = Path(get_project_dir(project_code, project_name))
    target_dir = project_dir / subdir
    target_dir.mkdir(parents=True, exist_ok=True)
    return str(target_dir / filename)


def create_project_directory(project_code: str, project_name: str) -> str:
    """
    为审计项目创建标准文件夹结构
    
    Args:
        project_code: 项目编号 (如 AP-20260610-3A7F)
        project_name: 项目名称
        
    Returns:
        project_dir: 项目文件夹的绝对路径
        
    Raises:
        OSError: 目录创建失败
    """
    # 项目文件夹名: project_code_project_name
    safe_name = _sanitize_name(project_name)
    project_dir_name = f"{project_code}_{safe_name}"
    project_dir = AUDIT_PROJECTS_ROOT / project_dir_name
    
    if project_dir.exists():
        logger.warning(f"项目文件夹已存在，跳过创建: {project_dir}")
        return str(project_dir)
    
    # 递归创建目录树
    _create_tree(project_dir, PROJECT_DIR_TREE)
    
    # 生成文件夹索引说明
    index_content = FOLDER_INDEX_CONTENT.format(
        project_name=project_name,
        project_code=project_code,
        create_date=datetime.now().strftime("%Y-%m-%d"),
    )
    index_file = project_dir / "99_归档与说明" / "文件夹索引说明.txt"
    index_file.write_text(index_content, encoding="utf-8")
    
    logger.info(f"审计项目文件夹创建成功: {project_dir}")
    return str(project_dir)


def _create_tree(base_dir: Path, tree: list):
    """递归创建目录树"""
    for node in tree:
        if isinstance(node, str):
            # 字符串：创建对应的 .gitkeep 占位文件（作为"待创建文件"的占位）
            pass
        elif isinstance(node, tuple):
            name, children = node
            dir_path = base_dir / name
            dir_path.mkdir(parents=True, exist_ok=True)
            
            if children and isinstance(children, list):
                _create_tree(dir_path, children)
            else:
                # 空目录，创建 .gitkeep
                _touch_gitkeep(dir_path)


def _touch_gitkeep(dir_path: Path):
    """在目录中创建 .gitkeep 文件"""
    gitkeep = dir_path / ".gitkeep"
    if not gitkeep.exists():
        gitkeep.write_text("", encoding="utf-8")


def _sanitize_name(name: str) -> str:
    """清理文件名中的非法字符"""
    illegal_chars = r'<>:"/\|?*'
    for c in illegal_chars:
        name = name.replace(c, "_")
    return name.strip().replace(" ", "_")[:50]
