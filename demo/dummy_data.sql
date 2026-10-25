-- Fictional PostgreSQL data for a RECON-X database security demonstration.
-- Customer email and phone fields are SENSITIVE.
-- Transaction data is CONFIDENTIAL.
-- Employee roles are INTERNAL.
-- Audit records are SECURITY-SENSITIVE.

CREATE TABLE customers (
    customer_id INTEGER PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(254) NOT NULL,
    phone VARCHAR(32),
    city VARCHAR(80) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE employees (
    employee_id INTEGER PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    department VARCHAR(80) NOT NULL,
    role VARCHAR(80) NOT NULL
);

CREATE TABLE transactions (
    transaction_id INTEGER PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
    amount NUMERIC(12, 2) NOT NULL,
    transaction_type VARCHAR(32) NOT NULL,
    transaction_date TIMESTAMPTZ NOT NULL,
    status VARCHAR(24) NOT NULL
);

CREATE TABLE audit_demo (
    log_id INTEGER PRIMARY KEY,
    username VARCHAR(80) NOT NULL,
    action VARCHAR(80) NOT NULL,
    table_name VARCHAR(80) NOT NULL,
    event_time TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_customers_city ON customers(city);
CREATE INDEX idx_employees_department ON employees(department);
CREATE INDEX idx_transactions_customer_date ON transactions(customer_id, transaction_date);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_audit_demo_username_time ON audit_demo(username, event_time);

INSERT INTO customers (customer_id, full_name, email, phone, city, created_at) VALUES
    (1001, 'Avery Example', 'avery.example@example.com', '+1-202-555-0101', 'Northstar Bay', '2025-01-12 09:15:00+00'),
    (1002, 'Blake Sample', 'blake.sample@example.com', '+1-202-555-0102', 'Cedar Falls', '2025-02-03 14:30:00+00'),
    (1003, 'Casey Fiction', 'casey.fiction@example.com', '+1-202-555-0103', 'Lumen Harbor', '2025-02-18 11:05:00+00'),
    (1004, 'Drew Demo', 'drew.demo@example.com', '+1-202-555-0104', 'Maple Junction', '2025-03-07 16:45:00+00'),
    (1005, 'Emery Placeholder', 'emery.placeholder@example.com', '+1-202-555-0105', 'Northstar Bay', '2025-03-22 08:20:00+00'),
    (1006, 'Finley Mock', 'finley.mock@example.com', '+1-202-555-0106', 'Quartz Point', '2025-04-11 13:10:00+00'),
    (1007, 'Gray Test', 'gray.test@example.com', '+1-202-555-0107', 'Cedar Falls', '2025-05-02 10:00:00+00'),
    (1008, 'Harper Fictional', 'harper.fictional@example.com', '+1-202-555-0108', 'Lumen Harbor', '2025-05-19 17:25:00+00');

INSERT INTO employees (employee_id, full_name, department, role) VALUES
    (201, 'Jordan Example', 'Payments', 'Analyst'),
    (202, 'Morgan Sample', 'Customer Care', 'Team Lead'),
    (203, 'Riley Fiction', 'Risk Operations', 'Reviewer'),
    (204, 'Taylor Demo', 'Security', 'Auditor'),
    (205, 'Quinn Placeholder', 'Payments', 'Administrator');

INSERT INTO transactions (transaction_id, customer_id, amount, transaction_type, transaction_date, status) VALUES
    (5001, 1001, 24.95, 'purchase', '2025-06-01 09:12:00+00', 'completed'),
    (5002, 1002, 1200.00, 'transfer', '2025-06-01 11:40:00+00', 'pending'),
    (5003, 1003, 8.50, 'refund', '2025-06-02 15:05:00+00', 'completed'),
    (5004, 1004, 349.99, 'purchase', '2025-06-03 08:30:00+00', 'review'),
    (5005, 1005, 75.25, 'withdrawal', '2025-06-04 19:18:00+00', 'completed'),
    (5006, 1006, 5200.00, 'transfer', '2025-06-05 12:00:00+00', 'held'),
    (5007, 1007, 16.40, 'purchase', '2025-06-06 10:45:00+00', 'failed'),
    (5008, 1008, 985.75, 'deposit', '2025-06-07 16:22:00+00', 'completed'),
    (5009, 1001, 140.00, 'withdrawal', '2025-06-08 07:55:00+00', 'pending'),
    (5010, 1003, 62.10, 'purchase', '2025-06-09 20:10:00+00', 'completed');

INSERT INTO audit_demo (log_id, username, action, table_name, event_time) VALUES
    (9001, 'demo_analyst', 'SELECT', 'transactions', '2025-06-10 09:00:00+00'),
    (9002, 'demo_reviewer', 'SELECT', 'customers', '2025-06-10 09:12:00+00'),
    (9003, 'demo_auditor', 'POLICY_CHECK', 'transactions', '2025-06-10 09:25:00+00'),
    (9004, 'demo_service', 'LOGIN', 'audit_demo', '2025-06-10 09:40:00+00'),
    (9005, 'demo_analyst', 'SCHEMA_INSPECT', 'employees', '2025-06-10 09:55:00+00');
