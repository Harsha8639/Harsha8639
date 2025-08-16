import requests
import sys
import json
from datetime import datetime

class LifeGuardAPITester:
    def __init__(self, base_url="https://calltracker-5.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.user_token = None
        self.guardian_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.user_id = None
        self.guardian_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        default_headers = {'Content-Type': 'application/json'}
        if headers:
            default_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=default_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_user_registration(self):
        """Test user registration"""
        test_user_data = {
            "email": f"testuser_{datetime.now().strftime('%H%M%S')}@example.com",
            "name": "Test User",
            "phone": "+1234567890",
            "password": "testpass123"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "register",
            200,
            data=test_user_data
        )
        
        if success and 'token' in response:
            self.user_token = response['token']
            self.user_id = response['user']['id']
            print(f"   User ID: {self.user_id}")
            return True, test_user_data
        return False, {}

    def test_user_login(self, user_data):
        """Test user login"""
        login_data = {
            "email": user_data["email"],
            "password": user_data["password"]
        }
        
        success, response = self.run_test(
            "User Login",
            "POST",
            "login",
            200,
            data=login_data
        )
        
        if success and 'token' in response:
            # Update token from login
            self.user_token = response['token']
            return True
        return False

    def test_guardian_registration(self):
        """Test guardian registration"""
        test_guardian_data = {
            "email": f"guardian_{datetime.now().strftime('%H%M%S')}@example.com",
            "name": "Test Guardian",
            "phone": "+1987654321"
        }
        
        success, response = self.run_test(
            "Guardian Registration",
            "POST",
            "register-guardian",
            200,
            data=test_guardian_data
        )
        
        if success and 'token' in response:
            self.guardian_token = response['token']
            self.guardian_id = response['guardian']['id']
            print(f"   Guardian ID: {self.guardian_id}")
            return True, test_guardian_data
        return False, {}

    def test_guardian_login(self, guardian_data):
        """Test guardian login"""
        login_data = {
            "email": guardian_data["email"],
            "password": "testpass123"  # Guardian login doesn't verify password in current implementation
        }
        
        success, response = self.run_test(
            "Guardian Login",
            "POST",
            "guardian-login",
            200,
            data=login_data
        )
        
        if success and 'token' in response:
            self.guardian_token = response['token']
            return True
        return False

    def test_user_profile(self):
        """Test getting user profile"""
        if not self.user_token:
            print("❌ No user token available for profile test")
            return False
            
        success, response = self.run_test(
            "Get User Profile",
            "GET",
            "profile",
            200,
            headers={'Authorization': f'Bearer {self.user_token}'}
        )
        return success

    def test_consent_update(self):
        """Test updating user consent"""
        if not self.user_token:
            print("❌ No user token available for consent test")
            return False
            
        success, response = self.run_test(
            "Update Consent (Grant)",
            "POST",
            "consent",
            200,
            data={"consent_given": True},
            headers={'Authorization': f'Bearer {self.user_token}'}
        )
        return success

    def test_assign_guardian(self, guardian_email):
        """Test assigning guardian to user"""
        if not self.user_token:
            print("❌ No user token available for guardian assignment")
            return False
            
        success, response = self.run_test(
            "Assign Guardian",
            "POST",
            "assign-guardian",
            200,
            data={"guardian_email": guardian_email},
            headers={'Authorization': f'Bearer {self.user_token}'}
        )
        return success

    def test_get_my_guardians(self):
        """Test getting user's guardians"""
        if not self.user_token:
            print("❌ No user token available for guardians list")
            return False
            
        success, response = self.run_test(
            "Get My Guardians",
            "GET",
            "my-guardians",
            200,
            headers={'Authorization': f'Bearer {self.user_token}'}
        )
        return success

    def test_location_update(self):
        """Test updating user location"""
        if not self.user_token:
            print("❌ No user token available for location update")
            return False
            
        location_data = {
            "latitude": 37.7749,
            "longitude": -122.4194,
            "accuracy": 10.0,
            "call_active": True,
            "emergency_mode": False
        }
        
        success, response = self.run_test(
            "Update Location",
            "POST",
            "location",
            200,
            data=location_data,
            headers={'Authorization': f'Bearer {self.user_token}'}
        )
        return success

    def test_emergency_alert(self):
        """Test triggering emergency alert"""
        if not self.user_token:
            print("❌ No user token available for emergency alert")
            return False
            
        success, response = self.run_test(
            "Trigger Emergency Alert",
            "POST",
            "emergency-alert",
            200,
            headers={'Authorization': f'Bearer {self.user_token}'}
        )
        return success

    def test_guardian_get_users(self):
        """Test guardian getting their assigned users"""
        if not self.guardian_token:
            print("❌ No guardian token available for users list")
            return False
            
        success, response = self.run_test(
            "Guardian Get Users",
            "GET",
            "guardian/my-users",
            200,
            headers={'Authorization': f'Bearer {self.guardian_token}'}
        )
        return success

    def test_guardian_get_user_location(self):
        """Test guardian getting user location"""
        if not self.guardian_token or not self.user_id:
            print("❌ No guardian token or user ID available for location fetch")
            return False
            
        success, response = self.run_test(
            "Guardian Get User Location",
            "GET",
            f"guardian/user-location/{self.user_id}",
            200,
            headers={'Authorization': f'Bearer {self.guardian_token}'}
        )
        return success

def main():
    print("🚨 LifeGuard Emergency Tracking System - API Testing")
    print("=" * 60)
    
    tester = LifeGuardAPITester()
    
    # Test User Registration and Authentication
    print("\n📱 TESTING USER AUTHENTICATION")
    print("-" * 40)
    
    user_success, user_data = tester.test_user_registration()
    if not user_success:
        print("❌ User registration failed, stopping tests")
        return 1
    
    if not tester.test_user_login(user_data):
        print("❌ User login failed")
        return 1
    
    if not tester.test_user_profile():
        print("❌ User profile fetch failed")
        return 1
    
    # Test Guardian Registration and Authentication
    print("\n🛡️ TESTING GUARDIAN AUTHENTICATION")
    print("-" * 40)
    
    guardian_success, guardian_data = tester.test_guardian_registration()
    if not guardian_success:
        print("❌ Guardian registration failed, stopping tests")
        return 1
    
    if not tester.test_guardian_login(guardian_data):
        print("❌ Guardian login failed")
        return 1
    
    # Test Consent System
    print("\n✅ TESTING CONSENT SYSTEM")
    print("-" * 40)
    
    if not tester.test_consent_update():
        print("❌ Consent update failed")
        return 1
    
    # Test Guardian Management
    print("\n👥 TESTING GUARDIAN MANAGEMENT")
    print("-" * 40)
    
    if not tester.test_assign_guardian(guardian_data["email"]):
        print("❌ Guardian assignment failed")
        return 1
    
    if not tester.test_get_my_guardians():
        print("❌ Get guardians failed")
        return 1
    
    # Test Location Tracking
    print("\n📍 TESTING LOCATION TRACKING")
    print("-" * 40)
    
    if not tester.test_location_update():
        print("❌ Location update failed")
        return 1
    
    # Test Emergency Features
    print("\n🚨 TESTING EMERGENCY FEATURES")
    print("-" * 40)
    
    if not tester.test_emergency_alert():
        print("❌ Emergency alert failed")
        return 1
    
    # Test Guardian Dashboard Features
    print("\n🛡️ TESTING GUARDIAN DASHBOARD")
    print("-" * 40)
    
    if not tester.test_guardian_get_users():
        print("❌ Guardian get users failed")
        return 1
    
    if not tester.test_guardian_get_user_location():
        print("❌ Guardian get user location failed")
        return 1
    
    # Print final results
    print("\n" + "=" * 60)
    print(f"📊 FINAL RESULTS: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 ALL TESTS PASSED! Backend API is working correctly.")
        return 0
    else:
        print(f"⚠️ {tester.tests_run - tester.tests_passed} tests failed. Please check the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())