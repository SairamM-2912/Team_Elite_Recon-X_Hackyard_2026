"""Datasets and Schema Explorer API Routes for RECON-X."""
import sqlite3
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List
from app.db.seed_data import DB_PATHS
from app.config import SENSITIVE_COLUMNS, CANARY_IDENTIFIERS

router = APIRouter(prefix="/api/datasets", tags=["Datasets"])

DATASETS_METADATA = {
    "healthcare": {
        "sector": "Healthcare & Life Sciences",
        "compliance": "HIPAA / HITECH / GDPR",
        "description": "Patient records, clinical diagnoses, medical condition ICD codes, and canary decoy patient.",
        "tables": ["patients", "diagnoses"],
        "canary_record": "Jane Doe Canary (CANARY-HC-9999, SSN 999-00-0001)",
        "canary_field": "Jane Doe Canary"
    },
    "banking": {
        "sector": "Financial & Banking Services",
        "compliance": "PCI-DSS / GLBA / SOX",
        "description": "Customer bank accounts, credit scores, balances, transaction logs, and high-net-worth canary account.",
        "tables": ["accounts", "transactions"],
        "canary_record": "John Sterling Canary (CANARY-BNK-7777, $99,999,999)",
        "canary_field": "CANARY-BNK-7777"
    },
    "corporate_hr": {
        "sector": "Corporate Human Resources & Payroll",
        "compliance": "EEOC / GDPR / Internal Privacy",
        "description": "Employee directory, salary compensation bands, performance evaluations, and executive canary profile.",
        "tables": ["employees", "performance_reviews"],
        "canary_record": "Arthur Canary Pendelton (CANARY-EMP-001, $999,999)",
        "canary_field": "CANARY-EMP-001"
    },
    "retail": {
        "sector": "Retail & E-Commerce",
        "compliance": "CCPA / GDPR / FTC Privacy",
        "description": "Customer profiles, order histories, payment methods, masked card tokens, and canary buyer record.",
        "tables": ["customers", "orders"],
        "canary_record": "Canary Customer Trap (CANARY-RET-8888)",
        "canary_field": "CANARY-RET-8888"
    }
}


@router.get("")
def list_datasets():
    sectors = []
    for sector_id, meta in DATASETS_METADATA.items():
        db_path = DB_PATHS.get(sector_id)
        table_details = []
        if db_path:
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            for tbl in meta["tables"]:
                cur.execute(f"PRAGMA table_info({tbl})")
                cols = cur.fetchall()
                cur.execute(f"SELECT COUNT(*) FROM {tbl}")
                count = cur.fetchone()[0]
                
                col_meta = []
                for c in cols:
                    col_name = c[1]
                    sens = "NONE"
                    for s_key, s_data in SENSITIVE_COLUMNS.items():
                        if s_key in col_name.lower():
                            sens = s_data["level"]
                            break
                    col_meta.append({"name": col_name, "type": c[2], "sensitivity": sens})
                
                table_details.append({
                    "table_name": tbl,
                    "row_count": count,
                    "columns": col_meta
                })
            conn.close()

        sectors.append({
            "id": sector_id,
            "sector": meta["sector"],
            "compliance": meta["compliance"],
            "description": meta["description"],
            "canary_record": meta["canary_record"],
            "tables": table_details
        })
    return {"datasets": sectors}


@router.get("/{sector}/preview/{table}")
def preview_table(sector: str, table: str):
    if sector not in DB_PATHS:
        raise HTTPException(status_code=404, detail="Sector dataset not found")
    db_path = DB_PATHS[sector]
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT * FROM {table} LIMIT 10")
        rows = [dict(r) for r in cur.fetchall()]
        cols = [c[0] for c in cur.description] if cur.description else []
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()
    return {"sector": sector, "table": table, "columns": cols, "rows": rows}
