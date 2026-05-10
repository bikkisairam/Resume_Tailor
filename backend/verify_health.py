#!/usr/bin/env python3
"""
Verification script for /health endpoint implementation.
"""
from app import app

def verify_health_endpoint():
    """Verify that /health endpoint works correctly"""
    with app.test_client() as client:
        response = client.get('/health')
        
        print("Health Endpoint Verification")
        print("=" * 50)
        print(f"Status Code: {response.status_code} (Expected: 200)")
        print(f"Content-Type: {response.content_type} (Expected: application/json)")
        print(f"Response Body: {response.get_json()} (Expected: {{'status': 'ok'}})")
        print("=" * 50)
        
        # Verify all acceptance criteria
        assert response.status_code == 200, "Status code should be 200"
        assert response.content_type == 'application/json', "Content-Type should be application/json"
        assert response.get_json() == {"status": "ok"}, "Response body should be {'status': 'ok'}"
        
        print("✅ All acceptance criteria verified!")
        return True

if __name__ == "__main__":
    verify_health_endpoint()
