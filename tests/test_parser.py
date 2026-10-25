"""Unit Tests for RECON-X SQL Parser and Normalizer."""
import pytest
from app.core.parser import ParsedQuery


def test_parser_select_statement():
    sql = "SELECT patient_id, full_name, ssn FROM patients WHERE city = 'San Francisco';"
    parsed = ParsedQuery(sql)

    assert parsed.statement_type == "SELECT"
    assert "patients" in parsed.tables
    assert "patient_id" in parsed.columns
    assert "full_name" in parsed.columns
    assert "ssn" in parsed.columns
    assert len(parsed.predicates) == 1
    assert parsed.predicates[0]["column"] == "city"
    assert parsed.predicates[0]["value"] == "'San Francisco'"


def test_parser_sensitive_columns_mapping():
    sql = "SELECT full_name, ssn, salary, diagnosis FROM patients;"
    parsed = ParsedQuery(sql)

    sens_col_names = [sc["column"] for sc in parsed.sensitive_columns]
    assert "ssn" in sens_col_names
    assert "salary" in sens_col_names
    assert "diagnosis" in sens_col_names


def test_parser_canary_detection():
    sql = "SELECT * FROM patients WHERE full_name = 'Jane Doe Canary';"
    parsed = ParsedQuery(sql)

    assert len(parsed.canary_hits) > 0
    assert "Jane Doe Canary" in parsed.canary_hits


def test_parser_aggregates_and_projections():
    sql = "SELECT department, COUNT(*), AVG(salary) FROM employees GROUP BY department HAVING COUNT(*) > 5;"
    parsed = ParsedQuery(sql)

    assert parsed.has_group_by is True
    assert "department" in parsed.group_by_columns
    assert any(a["func"] == "COUNT" for a in parsed.aggregates)
    assert any(a["func"] == "AVG" for a in parsed.aggregates)


def test_parser_non_select():
    sql = "DROP TABLE patients;"
    parsed = ParsedQuery(sql)
    assert parsed.statement_type == "DROP"
