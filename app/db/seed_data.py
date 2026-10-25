"""Seed Data for RECON-X Protected Databases.

Populates four sector databases (Healthcare, Banking, Corporate HR, Retail/Business)
with realistic relational data, sensitive columns, and deliberate canary honeypot records.
"""
import sqlite3
import os
import tempfile
from typing import Dict, Any

_is_vercel = bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))
_base_db_dir = tempfile.gettempdir() if _is_vercel else os.path.dirname(__file__)

DB_PATHS = {
    "healthcare": os.path.join(_base_db_dir, "healthcare.db"),
    "banking": os.path.join(_base_db_dir, "banking.db"),
    "corporate_hr": os.path.join(_base_db_dir, "corporate_hr.db"),
    "retail": os.path.join(_base_db_dir, "retail.db")
}


def init_all_databases():
    """Create and seed SQLite databases for all four sectors."""
    try:
        os.makedirs(_base_db_dir, exist_ok=True)
    except OSError:
        pass
    _init_healthcare(DB_PATHS["healthcare"])
    _init_banking(DB_PATHS["banking"])
    _init_corporate_hr(DB_PATHS["corporate_hr"])
    _init_retail(DB_PATHS["retail"])


def _init_healthcare(db_path: str):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.execute("DROP TABLE IF EXISTS diagnoses")
    cur.execute("DROP TABLE IF EXISTS patients")

    cur.execute("""
    CREATE TABLE patients (
        patient_id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        dob TEXT NOT NULL,
        gender TEXT NOT NULL,
        zip_code TEXT NOT NULL,
        ssn TEXT NOT NULL,
        insurance_id TEXT NOT NULL,
        city TEXT NOT NULL
    );
    """)

    cur.execute("""
    CREATE TABLE diagnoses (
        diagnosis_id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        icd_code TEXT NOT NULL,
        condition_name TEXT NOT NULL,
        severity TEXT NOT NULL,
        treatment_cost REAL NOT NULL,
        FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
    );
    """)

    # Seed 15 realistic patients
    patients = [
        ("P-1001", "Emma Watson", "1985-04-12", "F", "94102", "345-21-9876", "INS-4401", "San Francisco"),
        ("P-1002", "Liam Davis", "1972-11-23", "M", "94103", "456-32-1122", "INS-8812", "San Francisco"),
        ("P-1003", "Sophia Miller", "1990-08-15", "F", "94102", "567-43-3344", "INS-2390", "San Francisco"),
        ("P-1004", "Noah Wilson", "1965-02-28", "M", "94104", "678-54-5566", "INS-9901", "San Francisco"),
        ("P-1005", "Olivia Brown", "1988-06-19", "F", "94102", "789-65-7788", "INS-1123", "San Francisco"),
        ("P-1006", "William Jones", "1958-12-04", "M", "94105", "890-76-9900", "INS-7744", "San Francisco"),
        ("P-1007", "Ava Garcia", "1995-09-30", "F", "94103", "901-87-1234", "INS-5566", "San Francisco"),
        ("P-1008", "James Martinez", "1982-01-14", "M", "94102", "112-98-3456", "INS-3322", "San Francisco"),
        ("P-1009", "Isabella Taylor", "1977-07-22", "F", "94104", "223-09-5678", "INS-6677", "San Francisco"),
        ("P-1010", "Benjamin Anderson", "1960-03-18", "M", "94105", "334-10-7890", "INS-8899", "San Francisco"),
        ("P-1011", "Mia Thomas", "1992-10-05", "F", "94102", "445-21-9012", "INS-1200", "San Francisco"),
        ("P-1012", "Lucas Jackson", "1984-05-11", "M", "94103", "556-32-1324", "INS-3400", "San Francisco"),
        ("P-1013", "Charlotte White", "1970-09-17", "F", "94104", "667-43-3546", "INS-5600", "San Francisco"),
        ("P-1014", "Alexander Harris", "1999-12-25", "M", "94105", "778-54-5768", "INS-7800", "San Francisco"),
        # Canary Honeypot Record
        ("CANARY-HC-9999", "Jane Doe Canary", "1990-01-01", "F", "00000", "999-00-0001", "INS-CANARY-TRAP", "Trapville")
    ]
    cur.executemany("INSERT INTO patients VALUES (?,?,?,?,?,?,?,?)", patients)

    diagnoses = [
        ("D-01", "P-1001", "I10", "Hypertension", "Mild", 1250.0),
        ("D-02", "P-1002", "E11.9", "Type 2 Diabetes", "Moderate", 3400.0),
        ("D-03", "P-1003", "J45.909", "Asthma", "Mild", 850.0),
        ("D-04", "P-1004", "I25.10", "Atherosclerotic Heart Disease", "Severe", 18200.0),
        ("D-05", "P-1005", "F32.9", "Depressive Disorder", "Moderate", 2100.0),
        ("D-06", "P-1006", "C50.919", "Malignant Neoplasm of Breast", "Critical", 45000.0),
        ("D-07", "P-1007", "M54.5", "Low Back Pain", "Mild", 620.0),
        ("D-08", "P-1008", "I10", "Hypertension", "Moderate", 1450.0),
        ("D-09", "P-1009", "E11.9", "Type 2 Diabetes", "Moderate", 3100.0),
        ("D-10", "P-1010", "I25.10", "Atherosclerotic Heart Disease", "Severe", 16500.0),
        ("D-11", "P-1011", "J45.909", "Asthma", "Mild", 900.0),
        ("D-12", "P-1012", "K21.9", "GERD", "Mild", 550.0),
        ("D-13", "P-1013", "M17.9", "Osteoarthritis of Knee", "Moderate", 4200.0),
        ("D-14", "P-1014", "S83.511A", "ACL Tear", "Severe", 8900.0),
        ("D-99", "CANARY-HC-9999", "Z00.00", "Canary Honeytoken Syndrome", "Decoy", 99999.0)
    ]
    cur.executemany("INSERT INTO diagnoses VALUES (?,?,?,?,?,?)", diagnoses)

    conn.commit()
    conn.close()


def _init_banking(db_path: str):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.execute("DROP TABLE IF EXISTS transactions")
    cur.execute("DROP TABLE IF EXISTS accounts")

    cur.execute("""
    CREATE TABLE accounts (
        account_id TEXT PRIMARY KEY,
        customer_name TEXT NOT NULL,
        account_type TEXT NOT NULL,
        balance REAL NOT NULL,
        credit_score INTEGER NOT NULL,
        branch TEXT NOT NULL
    );
    """)

    cur.execute("""
    CREATE TABLE transactions (
        tx_id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        amount REAL NOT NULL,
        tx_type TEXT NOT NULL,
        merchant TEXT NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(account_id)
    );
    """)

    accounts = [
        ("ACC-5001", "Robert Chen", "Checking", 8450.25, 780, "Downtown SF"),
        ("ACC-5002", "Elena Rostova", "Savings", 42100.50, 815, "Financial District"),
        ("ACC-5003", "Marcus Vance", "Checking", 2300.00, 640, "Mission"),
        ("ACC-5004", "Aaliyah Patel", "Investment", 125400.00, 830, "Downtown SF"),
        ("ACC-5005", "David Kim", "Checking", 5600.75, 710, "Sunset"),
        ("ACC-5006", "Sarah Jenkins", "Savings", 18900.00, 755, "Mission"),
        ("ACC-5007", "Carlos Mendez", "Checking", 1450.10, 620, "Mission"),
        ("ACC-5008", "Hannah Schmidt", "Investment", 88900.00, 795, "Financial District"),
        ("ACC-5009", "Tariq Mansoor", "Checking", 7800.00, 730, "Sunset"),
        ("ACC-5010", "Chloe Dubois", "Savings", 31200.00, 770, "Downtown SF"),
        # Canary Honeypot Record
        ("CANARY-BNK-7777", "John Sterling Canary", "Offshore Secret", 99999999.00, 900, "Trap Vault")
    ]
    cur.executemany("INSERT INTO accounts VALUES (?,?,?,?,?,?)", accounts)

    transactions = [
        ("TX-101", "ACC-5001", 124.50, "Debit", "Supermarket SF"),
        ("TX-102", "ACC-5001", 1200.00, "Credit", "Payroll Direct Deposit"),
        ("TX-103", "ACC-5002", 5000.00, "Transfer", "Brokerage Funding"),
        ("TX-104", "ACC-5003", 65.20, "Debit", "Gas Station"),
        ("TX-105", "ACC-5004", 15000.00, "Wire", "Tech Capital Partners"),
        ("TX-106", "ACC-5005", 210.00, "Debit", "Restaurant Group"),
        ("TX-107", "ACC-5006", 800.00, "Debit", "Airline Tickets"),
        ("TX-108", "ACC-5007", 45.00, "Debit", "Coffee Roasters"),
        ("TX-109", "ACC-5008", 2200.00, "Debit", "Design Studio"),
        ("TX-110", "ACC-5009", 150.00, "Debit", "Electronics Mart"),
        ("TX-999", "CANARY-BNK-7777", 500000.00, "Wire", "Honeypot Decoy Wire")
    ]
    cur.executemany("INSERT INTO transactions VALUES (?,?,?,?,?)", transactions)

    conn.commit()
    conn.close()


def _init_corporate_hr(db_path: str):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.execute("DROP TABLE IF EXISTS performance_reviews")
    cur.execute("DROP TABLE IF EXISTS employees")

    cur.execute("""
    CREATE TABLE employees (
        emp_id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        department TEXT NOT NULL,
        job_title TEXT NOT NULL,
        salary REAL NOT NULL,
        bonus REAL NOT NULL,
        performance_rating INTEGER NOT NULL
    );
    """)

    cur.execute("""
    CREATE TABLE performance_reviews (
        review_id TEXT PRIMARY KEY,
        emp_id TEXT NOT NULL,
        reviewer TEXT NOT NULL,
        rating INTEGER NOT NULL,
        disciplinary_flag INTEGER NOT NULL,
        notes TEXT NOT NULL,
        FOREIGN KEY (emp_id) REFERENCES employees(emp_id)
    );
    """)

    # 10 Engineering employees, suitable for differencing attack demo:
    # Query 1: SELECT SUM(salary) FROM employees WHERE department='Engineering'
    # Query 2: SELECT SUM(salary) FROM employees WHERE department='Engineering' AND emp_id != 'EMP-104'
    employees = [
        ("EMP-101", "Alice Vance", "Engineering", "Staff Software Engineer", 185000.0, 25000.0, 5),
        ("EMP-102", "Bob Smith", "Engineering", "Senior Software Engineer", 155000.0, 18000.0, 4),
        ("EMP-103", "Charlie Brown", "Engineering", "Software Engineer II", 130000.0, 12000.0, 3),
        ("EMP-104", "Target Victim David", "Engineering", "Principal Architect", 220000.0, 40000.0, 5),
        ("EMP-105", "Eve Thorne", "Engineering", "Security Engineer", 160000.0, 20000.0, 4),
        ("EMP-106", "Frank Castle", "Engineering", "DevOps Engineer", 140000.0, 15000.0, 3),
        ("EMP-107", "Grace Hopper", "Engineering", "Director of Platform", 260000.0, 55000.0, 5),
        ("EMP-108", "Hank Pym", "Engineering", "QA Lead", 125000.0, 10000.0, 3),
        ("EMP-109", "Iris West", "Engineering", "Frontend Engineer", 135000.0, 12000.0, 4),
        ("EMP-110", "Jack Ryan", "Engineering", "Backend Engineer", 145000.0, 15000.0, 4),
        # HR Department employees
        ("EMP-201", "Karen Gillan", "Human Resources", "HR Director", 165000.0, 20000.0, 4),
        ("EMP-202", "Leo Tolstoy", "Human Resources", "Recruiter", 95000.0, 8000.0, 3),
        # Finance
        ("EMP-301", "Mona Lisa", "Finance", "Controller", 175000.0, 25000.0, 5),
        ("EMP-302", "Nate Archibald", "Finance", "Senior Analyst", 115000.0, 12000.0, 3),
        # Canary Honeypot Record
        ("CANARY-EMP-001", "Arthur Canary Pendelton", "Shadow Research", "Decoy Executive", 999999.0, 500000.0, 5)
    ]
    cur.executemany("INSERT INTO employees VALUES (?,?,?,?,?,?,?)", employees)

    reviews = [
        ("REV-01", "EMP-101", "Grace Hopper", 5, 0, "Exceptional systems architecture leadership."),
        ("REV-02", "EMP-102", "Alice Vance", 4, 0, "Consistently delivers features ahead of schedule."),
        ("REV-03", "EMP-103", "Bob Smith", 3, 0, "Solid contributor, expanding testing rigor."),
        ("REV-04", "EMP-104", "Grace Hopper", 5, 0, "Critical pillar of company infrastructure."),
        ("REV-05", "EMP-105", "Alice Vance", 4, 0, "Identified and mitigated security posture gaps."),
        ("REV-99", "CANARY-EMP-001", "Security Honeypot", 5, 1, "CANARY HONEYTOKEN - DO NOT TOUCH")
    ]
    cur.executemany("INSERT INTO performance_reviews VALUES (?,?,?,?,?,?)", reviews)

    conn.commit()
    conn.close()


def _init_retail(db_path: str):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.execute("DROP TABLE IF EXISTS orders")
    cur.execute("DROP TABLE IF EXISTS customers")

    cur.execute("""
    CREATE TABLE customers (
        cust_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        city TEXT NOT NULL,
        lifetime_spend REAL NOT NULL,
        loyalty_tier TEXT NOT NULL
    );
    """)

    cur.execute("""
    CREATE TABLE orders (
        order_id TEXT PRIMARY KEY,
        cust_id TEXT NOT NULL,
        order_total REAL NOT NULL,
        payment_method TEXT NOT NULL,
        card_last_four TEXT NOT NULL,
        status TEXT NOT NULL,
        FOREIGN KEY (cust_id) REFERENCES customers(cust_id)
    );
    """)

    customers = [
        ("C-801", "Sarah Connor", "sconnor@resistance.net", "555-0101", "Los Angeles", 4250.0, "Platinum"),
        ("C-802", "John McClane", "jmcclane@nypd.gov", "555-0102", "New York", 1850.5, "Gold"),
        ("C-803", "Ellen Ripley", "ripley@weyland.com", "555-0103", "Seattle", 6100.0, "Platinum"),
        ("C-804", "Marty McFly", "marty@hillvalley.org", "555-0104", "San Jose", 890.0, "Silver"),
        ("C-805", "Dana Scully", "dscully@fbi.gov", "555-0105", "Washington DC", 3200.0, "Gold"),
        ("C-806", "Fox Mulder", "fmulder@fbi.gov", "555-0106", "Washington DC", 1400.0, "Silver"),
        # Canary
        ("CANARY-RET-8888", "Canary Customer Trap", "canary@honeypot.sec", "555-9999", "Decoy City", 99999.0, "Canary")
    ]
    cur.executemany("INSERT INTO customers VALUES (?,?,?,?,?,?,?)", customers)

    orders = [
        ("ORD-901", "C-801", 450.0, "Visa", "4321", "Delivered"),
        ("ORD-902", "C-802", 120.5, "Mastercard", "8765", "Delivered"),
        ("ORD-903", "C-803", 1200.0, "Amex", "1098", "Processing"),
        ("ORD-904", "C-804", 45.0, "Visa", "6543", "Delivered"),
        ("ORD-905", "C-805", 380.0, "Mastercard", "2109", "Delivered"),
        ("ORD-999", "CANARY-RET-8888", 99999.0, "DecoyCard", "0000", "CanaryTrap")
    ]
    cur.executemany("INSERT INTO orders VALUES (?,?,?,?,?,?)", orders)

    conn.commit()
    conn.close()
