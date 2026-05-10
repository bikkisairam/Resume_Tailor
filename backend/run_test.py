#!/usr/bin/env python3
"""
Simple test runner to verify tests fail before implementation.
"""
import sys
from app import app

def test_health_endpoint_exists():
    """Verify that /health endpoint exists"""
    with app.test_client() as client:
        response = client.get('/health')
        print(f"Status Code: {response.status_code}")
        print(f"Expected: 200")
        print(f"Content-Type: {response.content_type}")
        print(f"Body: {response.get_data(as_text=True)}")
        
        if response.status_code == 200:
            print("✓ Test PASSED: Status code is 200")
        else:
            print("✗ Test FAILED: Status code is not 200")
            return False
            
        if response.content_type == 'application/json':
            print("✓ Test PASSED: Content-Type is application/json")
        else:
            print("✗ Test FAILED: Content-Type is not application/json")
            return False
            
        if response.get_json() == {"status": "ok"}:
            print("✓ Test PASSED: Body is correct")
        else:
            print("✗ Test FAILED: Body is not correct")
            return False
            
        return True

if __name__ == "__main__":
    print("Running health endpoint tests...\n")
    try:
        success = test_health_endpoint_exists()
        if not success:
            print("\n❌ Tests FAILED (as expected - endpoint not implemented yet)")
            sys.exit(1)
        else:
            print("\n✅ All tests PASSED")
            sys.exit(0)
    except Exception as e:
        print(f"\n❌ Test execution failed with error: {e}")
        sys.exit(1)
