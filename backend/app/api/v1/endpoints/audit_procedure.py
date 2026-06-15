"""
审计程序模板管理 & 执行 API
"""
import uuid
import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from loguru import logger

from app.core.database import get_db
from app.api.v1.deps import get_current_user
from app.models.audit_procedure import (
    AuditProcedure, ProcedureItem, ProcedureExecution, ProcedureRow,
    ProcedureType, ProcedureStatus, ItemDataType,
)
from app.models.user import User

router = APIRouter()


# ==================== 程序模板管理 ====================

@router.get("")
async def list_procedures(
    procedure_type: Optional[str] = Query(None),
    is_preset: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取审计程序模板列表"""
    q = db.query(AuditProcedure).filter(AuditProcedure.is_active == True)
    
    if procedure_type:
        q = q.filter(AuditProcedure.procedure_type == procedure_type)
    if is_preset is not None:
        q = q.filter(AuditProcedure.is_preset == is_preset)
    if search:
        q = q.filter(
            AuditProcedure.name.ilike(f"%{search}%") |
            AuditProcedure.target_process.ilike(f"%{search}%")
        )
    
    total = q.count()
    procedures = q.order_by(AuditProcedure.created_at.desc()).offset(
        (page - 1) * page_size).limit(page_size).all()
    
    return {
        "code": 200, "message": "获取成功",
        "data": [_proc_to_dict(p) for p in procedures],
        "total": total, "page": page, "page_size": page_size,
    }


@router.get("/{procedure_id}")
async def get_procedure(
    procedure_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取程序模板详情（含检查节点）"""
    proc = db.query(AuditProcedure).filter(
        AuditProcedure.id == procedure_id,
        AuditProcedure.is_active == True,
    ).first()
    if not proc:
        raise HTTPException(status_code=404, detail="程序模板不存在")
    return {"code": 200, "message": "获取成功", "data": _proc_to_dict(proc)}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_procedure(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建审计程序模板"""
    proc = AuditProcedure(
        procedure_code=data.get("procedure_code", f"CP-{uuid.uuid4().hex[:6].upper()}"),
        name=data["name"],
        procedure_type=data.get("procedure_type", ProcedureType.WALKTHROUGH),
        description=data.get("description"),
        target_process=data.get("target_process"),
        data_sources=data.get("data_sources"),
        created_by_id=current_user.id,
    )
    db.add(proc)
    db.flush()
    
    # 创建检查节点
    for idx, item_data in enumerate(data.get("items", [])):
        item = ProcedureItem(
            procedure_id=proc.id,
            sort_order=item_data.get("sort_order", idx),
            field_name=item_data["field_name"],
            field_label=item_data["field_label"],
            data_type=item_data.get("data_type", ItemDataType.TEXT),
            data_source=item_data.get("data_source"),
            expected_result=item_data.get("expected_result"),
            options=item_data.get("options"),
            is_required=item_data.get("is_required", True),
            placeholder=item_data.get("placeholder"),
            remark=item_data.get("remark"),
        )
        db.add(item)
    
    db.commit()
    db.refresh(proc)
    logger.info(f"审计程序模板创建成功: {proc.procedure_code} - {proc.name}")
    return {"code": 201, "message": "创建成功", "data": {"id": proc.id, "procedure_code": proc.procedure_code, "name": proc.name}}


# ==================== 程序执行 ====================

@router.get("/executions")
async def list_executions(
    project_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取程序执行记录列表"""
    q = db.query(ProcedureExecution)
    if project_id:
        q = q.filter(ProcedureExecution.project_id == project_id)
    if status:
        q = q.filter(ProcedureExecution.status == status)
    
    total = q.count()
    executions = q.order_by(ProcedureExecution.created_at.desc()).offset(
        (page - 1) * page_size).limit(page_size).all()
    
    return {
        "code": 200, "message": "获取成功",
        "data": [_exec_to_dict(e) for e in executions],
        "total": total, "page": page, "page_size": page_size,
    }


@router.post("/executions", status_code=status.HTTP_201_CREATED)
async def create_execution(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """创建程序执行（对某项目执行某程序）"""
    project_id = data.get("project_id")
    procedure_id = data.get("procedure_id")
    
    if not project_id or not procedure_id:
        raise HTTPException(status_code=400, detail="缺少 project_id 或 procedure_id")
    
    proc = db.query(AuditProcedure).filter(AuditProcedure.id == procedure_id).first()
    if not proc:
        raise HTTPException(status_code=404, detail="程序模板不存在")
    
    exec_entry = ProcedureExecution(
        project_id=project_id,
        procedure_id=procedure_id,
        status=ProcedureStatus.IN_PROGRESS,
        executor_id=current_user.id,
        started_at=datetime.utcnow(),
    )
    db.add(exec_entry)
    db.commit()
    db.refresh(exec_entry)
    
    logger.info(f"程序执行开始: {proc.name} → 项目 {project_id}")
    return {
        "code": 201, "message": "开始执行",
        "data": {"id": exec_entry.id, "procedure_name": proc.name, "item_count": len(proc.items)},
    }


@router.put("/executions/{exec_id}/rows")
async def save_execution_rows(
    exec_id: str,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """保存程序执行数据行（批量保存检查结果）"""
    execution = db.query(ProcedureExecution).filter(ProcedureExecution.id == exec_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="执行记录不存在")
    
    # 删除旧行
    db.query(ProcedureRow).filter(ProcedureRow.execution_id == exec_id).delete()
    
    # 插入新行
    rows_data = data.get("rows", [])
    for idx, row_data in enumerate(rows_data):
        row = ProcedureRow(
            execution_id=exec_id,
            row_index=idx,
            data=row_data.get("data", {}),
            conclusion=row_data.get("conclusion"),
            remark=row_data.get("remark"),
        )
        db.add(row)
    
    execution.sample_count = len(rows_data)
    db.commit()
    
    logger.info(f"程序执行数据已保存: {exec_id}, {len(rows_data)} 行")
    return {"code": 200, "message": f"已保存 {len(rows_data)} 行数据", "data": {"row_count": len(rows_data)}}


@router.post("/executions/{exec_id}/complete")
async def complete_execution(
    exec_id: str,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """完成程序执行（提交结论，生成 Excel）"""
    execution = db.query(ProcedureExecution).filter(ProcedureExecution.id == exec_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="执行记录不存在")
    
    conclusion = data.get("conclusion", "")
    execution.conclusion = conclusion
    execution.status = ProcedureStatus.COMPLETED
    execution.completed_at = datetime.utcnow()
    
    # 生成 Excel 文件并保存到项目文件夹
    
    from app.services.procedure_export import generate_procedure_excel
    
    project = execution.project
    proc = execution.procedure
    
    try:
        file_path = generate_procedure_excel(
            project_code=project.project_code,
            project_name=project.project_name,
            procedure_code=proc.procedure_code,
            procedure_name=proc.name,
            items=proc.items,
            rows=execution.rows,
            conclusion=conclusion,
        )
        execution.output_file_path = file_path
        logger.info(f"程序执行Excel已生成: {file_path}")
    except Exception as e:
        logger.error(f"生成Excel失败: {e}")
    
    db.commit()
    
    return {
        "code": 200, "message": "程序执行完成",
        "data": {"execution_id": exec_id, "conclusion": conclusion, "file_path": execution.output_file_path},
    }


@router.get("/executions/{exec_id}")
async def get_execution_detail(
    exec_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取程序执行详情（含所有数据行）"""
    execution = db.query(ProcedureExecution).filter(ProcedureExecution.id == exec_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="执行记录不存在")
    return {"code": 200, "message": "获取成功", "data": _exec_to_dict(execution, include_rows=True)}


@router.get("/executions/{exec_id}/export")
async def export_execution_excel(
    exec_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """导出程序执行结果为 Excel（如已存在则返回路径）"""
    execution = db.query(ProcedureExecution).filter(ProcedureExecution.id == exec_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="执行记录不存在")
    
    if execution.output_file_path:
        return {"code": 200, "message": "导出成功", "data": {"file_path": execution.output_file_path}}
    else:
        return {"code": 200, "message": "尚未生成Excel文件，请先完成执行", "data": None}


# ==================== 辅助函数 ====================

def _proc_to_dict(proc: AuditProcedure) -> dict:
    return {
        "id": proc.id,
        "procedure_code": proc.procedure_code,
        "name": proc.name,
        "procedure_type": proc.procedure_type.value if proc.procedure_type else None,
        "description": proc.description,
        "target_process": proc.target_process,
        "data_sources": proc.data_sources,
        "version": proc.version,
        "is_preset": proc.is_preset,
        "items": [
            {
                "id": item.id,
                "sort_order": item.sort_order,
                "field_name": item.field_name,
                "field_label": item.field_label,
                "data_type": item.data_type.value if item.data_type else "text",
                "data_source": item.data_source,
                "expected_result": item.expected_result,
                "options": item.options,
                "is_required": item.is_required,
                "placeholder": item.placeholder,
                "remark": item.remark,
            }
            for item in (proc.items or [])
        ],
        "created_at": proc.created_at.isoformat() if proc.created_at else None,
    }


def _exec_to_dict(exec_entry: ProcedureExecution, include_rows: bool = False) -> dict:
    result = {
        "id": exec_entry.id,
        "project_id": exec_entry.project_id,
        "project_name": exec_entry.project.project_name if exec_entry.project else None,
        "procedure_id": exec_entry.procedure_id,
        "procedure_name": exec_entry.procedure.name if exec_entry.procedure else None,
        "procedure_type": exec_entry.procedure.procedure_type.value if exec_entry.procedure and exec_entry.procedure.procedure_type else None,
        "target_process": exec_entry.procedure.target_process if exec_entry.procedure else None,
        "status": exec_entry.status.value if exec_entry.status else None,
        "sample_count": exec_entry.sample_count,
        "conclusion": exec_entry.conclusion,
        "output_file_path": exec_entry.output_file_path,
        "started_at": exec_entry.started_at.isoformat() if exec_entry.started_at else None,
        "completed_at": exec_entry.completed_at.isoformat() if exec_entry.completed_at else None,
    }
    if include_rows:
        result["items"] = _proc_to_dict(exec_entry.procedure).get("items", []) if exec_entry.procedure else []
        result["rows"] = [
            {
                "row_index": r.row_index,
                "data": r.data,
                "conclusion": r.conclusion,
                "remark": r.remark,
            }
            for r in (exec_entry.rows or [])
        ]
    return result
