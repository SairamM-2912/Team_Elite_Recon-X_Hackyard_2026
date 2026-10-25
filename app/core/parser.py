"""SQL Parser and Normalizer for RECON-X Security Engine.

Extracts tables, columns, predicates, aggregate functions, and flags potential
canary keywords or structural anomalies without external heavy parser dependencies.
"""
import re
from typing import Dict, List, Set, Any, Optional
from app.config import SENSITIVE_COLUMNS, CANARY_IDENTIFIERS


class ParsedQuery:
    def __init__(self, raw_query: str):
        self.raw_query = raw_query.strip()
        self.cleaned_query = self._remove_comments(self.raw_query)
        self.normalized_query = self._normalize_whitespace(self.cleaned_query)
        self.statement_type = self._detect_statement_type()
        
        self.tables: List[str] = []
        self.columns: List[str] = []
        self.aggregates: List[Dict[str, str]] = []
        self.where_clause: str = ""
        self.predicates: List[Dict[str, Any]] = []
        self.has_limit: bool = False
        self.limit_value: Optional[int] = None
        self.has_group_by: bool = False
        self.group_by_columns: List[str] = []
        self.canary_hits: List[str] = []
        self.sensitive_columns: List[Dict[str, str]] = []
        self.is_pure_aggregate: bool = False
        
        self._parse()

    def _remove_comments(self, sql: str) -> str:
        # Remove /* ... */ comments
        sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.DOTALL)
        # Remove -- ... comments
        sql = re.sub(r"--[^\n]*", " ", sql)
        return sql

    def _normalize_whitespace(self, sql: str) -> str:
        s = " ".join(sql.split()).strip()
        return s.rstrip(";").strip()

    def _detect_statement_type(self) -> str:
        words = self.normalized_query.split()
        if not words:
            return "EMPTY"
        first = words[0].upper()
        if first in ("SELECT", "WITH"):
            return "SELECT"
        if first in ("INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "CREATE"):
            return first
        return "UNKNOWN"

    def _parse(self):
        sql = self.normalized_query
        
        # Check for Canary values in SQL text
        for canary in CANARY_IDENTIFIERS:
            if canary.lower() in sql.lower():
                self.canary_hits.append(canary)

        if self.statement_type != "SELECT":
            return

        # Extract LIMIT
        limit_match = re.search(r"\bLIMIT\s+(\d+)\b", sql, re.IGNORECASE)
        if limit_match:
            self.has_limit = True
            self.limit_value = int(limit_match.group(1))

        # Extract GROUP BY
        group_match = re.search(r"\bGROUP\s+BY\s+(.*?)(?=\bORDER\s+BY\b|\bHAVING\b|\bLIMIT\b|$)", sql, re.IGNORECASE)
        if group_match:
            self.has_group_by = True
            raw_groups = group_match.group(1).split(",")
            self.group_by_columns = [g.strip().strip("`'\"") for g in raw_groups if g.strip()]

        # Extract WHERE clause
        where_match = re.search(r"\bWHERE\s+(.*?)(?=\bGROUP\s+BY\b|\bORDER\s+BY\b|\bHAVING\b|\bLIMIT\b|$)", sql, re.IGNORECASE)
        if where_match:
            self.where_clause = where_match.group(1).strip()
            self._extract_predicates(self.where_clause)

        # Extract FROM and JOIN tables
        from_match = re.search(r"\bFROM\s+([a-zA-Z0-9_\.,\s]+?)(?=\bWHERE\b|\bGROUP\s+BY\b|\bORDER\s+BY\b|\bHAVING\b|\bLIMIT\b|\bJOIN\b|$)", sql, re.IGNORECASE)
        if from_match:
            tbl_chunk = from_match.group(1)
            for part in tbl_chunk.split(","):
                tbl_name = part.strip().split()[0].strip("`'\"")
                if tbl_name and tbl_name.upper() not in ("SELECT", "WHERE", "GROUP", "LIMIT", "ORDER"):
                    self.tables.append(tbl_name)

        join_matches = re.findall(r"\b(?:LEFT|RIGHT|INNER|FULL|CROSS)?\s*JOIN\s+([a-zA-Z0-9_]+)", sql, re.IGNORECASE)
        for tbl in join_matches:
            tbl_name = tbl.strip().strip("`'\"")
            if tbl_name and tbl_name not in self.tables:
                self.tables.append(tbl_name)

        # Extract SELECT projection columns and Aggregates
        select_match = re.search(r"\bSELECT\s+(.*?)\s+\bFROM\b", sql, re.IGNORECASE)
        if select_match:
            select_chunk = select_match.group(1)
            self._extract_projections_and_aggregates(select_chunk)

        # Map sensitive columns
        all_referenced_cols = set(self.columns + [p["column"] for p in self.predicates if "column" in p])
        for col in all_referenced_cols:
            clean_col = col.lower().split(".")[-1].strip("`'\"")
            for sens_key, meta in SENSITIVE_COLUMNS.items():
                if sens_key in clean_col:
                    self.sensitive_columns.append({
                        "column": col,
                        "matched_rule": sens_key,
                        "level": meta["level"],
                        "type": meta["type"]
                    })
        self.is_pure_aggregate = len(self.aggregates) > 0 and len([c for c in self.columns if c != "*"]) == 0

    def _extract_projections_and_aggregates(self, select_chunk: str):
        # Scan for aggregate functions
        agg_pattern = re.compile(r"\b(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*(.*?)\s*\)", re.IGNORECASE)
        for match in agg_pattern.finditer(select_chunk):
            func = match.group(1).upper()
            arg = match.group(2).strip()
            self.aggregates.append({"func": func, "arg": arg})

        # Split projections by comma outside parentheses
        parts = []
        buf = []
        paren_depth = 0
        for ch in select_chunk:
            if ch == "(":
                paren_depth += 1
            elif ch == ")":
                paren_depth -= 1
            elif ch == "," and paren_depth == 0:
                parts.append("".join(buf).strip())
                buf = []
                continue
            buf.append(ch)
        if buf:
            parts.append("".join(buf).strip())

        for p in parts:
            if not p:
                continue
            # If it's not an aggregate function, extract column name
            if not any(p.upper().startswith(f) for f in ("COUNT(", "SUM(", "AVG(", "MIN(", "MAX(")):
                # Handle aliases e.g. "age AS user_age"
                col_name = re.split(r"\s+AS\s+|\s+", p, flags=re.IGNORECASE)[0].strip("`'\"")
                if col_name and col_name != "*":
                    self.columns.append(col_name)
                elif col_name == "*":
                    self.columns.append("*")

    def _extract_predicates(self, where_text: str):
        # Split on AND / OR
        pred_tokens = re.split(r"\s+(?:AND|OR)\s+", where_text, flags=re.IGNORECASE)
        for token in pred_tokens:
            token = token.strip("() ;").strip()
            op_match = re.search(r"([a-zA-Z0-9_\.]+)\s*(=|!=|<>|<=|>=|<|>|\bLIKE\b|\bIN\b|\bBETWEEN\b)\s*(.*)", token, re.IGNORECASE)
            if op_match:
                col = op_match.group(1).strip()
                op = op_match.group(2).strip().upper()
                val = op_match.group(3).strip().rstrip(";")
                self.predicates.append({
                    "column": col,
                    "operator": op,
                    "value": val,
                    "raw": token
                })
            else:
                self.predicates.append({"raw": token})

    def to_dict(self) -> Dict[str, Any]:
        return {
            "statement_type": self.statement_type,
            "normalized_query": self.normalized_query,
            "tables": self.tables,
            "columns": self.columns,
            "aggregates": self.aggregates,
            "is_pure_aggregate": len(self.aggregates) > 0 and len([c for c in self.columns if c != "*"]) == 0,
            "where_clause": self.where_clause,
            "predicates": self.predicates,
            "has_limit": self.has_limit,
            "limit_value": self.limit_value,
            "has_group_by": self.has_group_by,
            "group_by_columns": self.group_by_columns,
            "sensitive_columns": self.sensitive_columns,
            "canary_hits": self.canary_hits
        }
