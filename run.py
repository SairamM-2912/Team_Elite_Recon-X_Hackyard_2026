"""RECON-X — Database Security Proxy Startup Runner."""
import uvicorn
from app.config import SERVER_HOST, SERVER_PORT


def main():
    banner = f"""
======================================================================
  ____  _____ ____ ___  _   _      __  __
 |  _ \\| ____/ ___/ _ \\| \\ | |    \\ \\/ /
 | |_) |  _|| |  | | | |  \\| |____ \\  / 
 |  _ <| |__| |__| |_| | |\\  |_____/  \\ 
 |_| \\_\\_____\\____\\___/|_| \\_|    /_/\\_\\
  DATABASE SECURITY PROXY & INFERENCE DEFENSE ENGINE
======================================================================
  [+] Web UI:             http://localhost:{SERVER_PORT}
  [+] Proxy Listening:    http://{SERVER_HOST}:{SERVER_PORT}
  [+] API Docs:           http://localhost:{SERVER_PORT}/docs
  [+] Theme:              Mandatory Light Mode (#F8FAFC / #FFFFFF)
  [+] Protected Targets:  Healthcare, Banking, Corporate HR, Retail
  [+] Detection Engines:  
      • Differencing Reconstruction Attacks
      • Progressive Filtering Sequence
      • Population Narrowing (k-Anonymity Singling-Out)
      • Canary Honeytoken Data Traps
      • Laplace Differential Privacy Perturbation
      • SHA-256 Tamper-Evident Audit Ledger
======================================================================
"""
    print(banner)
    uvicorn.run("app.main:app", host=SERVER_HOST, port=SERVER_PORT, log_level="info")


if __name__ == "__main__":
    main()
