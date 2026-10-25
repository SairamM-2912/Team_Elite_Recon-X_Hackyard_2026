"""
verify_supabase.py
==================
Standalone verification script for Supabase Database & Auth integration.
"""

import sys
import json
import urllib.request
import urllib.error

def verify(url: str, key: str):
    base_url = url.rstrip('/') + '/rest/v1'
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    print("=" * 60)
    print("RECON-X SUPABASE VERIFICATION RUNNER")
    print("=" * 60)
    print(f"Project URL: {url}")
    print()

    # 1. Test Products (Public Select)
    print("[1/4] Checking 'products' table...")
    req = urllib.request.Request(f"{base_url}/products?select=*", headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            products = json.loads(resp.read().decode('utf-8'))
            print(f"  [PASS] Retrieved {len(products)} product(s).")
            if products:
                categories = set(p.get('category') for p in products)
                print(f"    Categories: {', '.join(categories)}")
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8', errors='replace')
        print(f"  [FAIL] HTTP {e.code} - {err_msg}")
    except Exception as e:
        print(f"  [ERROR] {e}")

    # 2. Test Contact Messages RLS
    print("\n[2/4] Testing Row Level Security on 'contact_messages' (Visitor SELECT)...")
    req = urllib.request.Request(f"{base_url}/contact_messages?select=*", headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            messages = json.loads(resp.read().decode('utf-8'))
            if len(messages) == 0:
                print("  [PASS] RLS Active: 0 messages returned to anonymous visitor.")
            else:
                print(f"  [WARN] Visitor read {len(messages)} messages (Check RLS policy).")
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8', errors='replace')
        print(f"  [HTTP {e.code}] {err_msg}")
    except Exception as e:
        print(f"  [ERROR] {e}")

    # 3. Test Contact Message Submission
    print("\n[3/4] Testing Contact Message Submission (Visitor INSERT)...")
    payload = json.dumps({
        "name": "Automated Tester",
        "email": "test@example.com",
        "subject": "Verification Ping",
        "message": "Testing Supabase REST endpoint."
    }).encode('utf-8')
    req = urllib.request.Request(
        f"{base_url}/contact_messages",
        data=payload,
        headers={**headers, "Prefer": "return=minimal"}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            print("  [PASS] Contact message submitted successfully!")
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8', errors='replace')
        print(f"  [FAIL] HTTP {e.code} - {err_msg}")
    except Exception as e:
        print(f"  [ERROR] {e}")

    # 4. Test Orders RLS
    print("\n[4/4] Testing Row Level Security on 'orders'...")
    req = urllib.request.Request(f"{base_url}/orders?select=*", headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            orders = json.loads(resp.read().decode('utf-8'))
            if len(orders) == 0:
                print("  [PASS] RLS Active: Anonymous visitor cannot view customer orders.")
            else:
                print(f"  [WARN] Visitor read {len(orders)} orders (Check RLS policy).")
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8', errors='replace')
        print(f"  [HTTP {e.code}] {err_msg}")
    except Exception as e:
        print(f"  [ERROR] {e}")

    print("\n" + "=" * 60)
    print("Verification complete.")
    print("=" * 60)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python verify_supabase.py <SUPABASE_URL> <SUPABASE_PUBLISHABLE_KEY>")
        sys.exit(1)
    verify(sys.argv[1], sys.argv[2])
