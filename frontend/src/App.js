import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Alert, AlertDescription } from './components/ui/alert';
import { Badge } from './components/ui/badge';
import { Separator } from './components/ui/separator';
import { toast } from 'sonner';
import { Toaster } from './components/ui/toaster';
import axios from 'axios';
import { 
  Shield, 
  MapPin, 
  Phone, 
  Users, 
  AlertTriangle, 
  Eye, 
  EyeOff,
  Heart,
  Navigation,
  Clock,
  UserPlus
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [user, setUser] = useState(null);
  const [guardian, setGuardian] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [guardianToken, setGuardianToken] = useState(localStorage.getItem('guardianToken'));
  const [activeTab, setActiveTab] = useState('user');
  const [location, setLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [guardians, setGuardians] = useState([]);
  const [guardianUsers, setGuardianUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [emergencyMode, setEmergencyMode] = useState(false);
  
  const wsRef = useRef(null);
  const locationIntervalRef = useRef(null);

  useEffect(() => {
    if (token) {
      fetchUserProfile();
    }
    if (guardianToken) {
      fetchGuardianProfile();
    }
  }, [token, guardianToken]);

  useEffect(() => {
    if (isTracking && user) {
      startLocationTracking();
    } else {
      stopLocationTracking();
    }
    return () => stopLocationTracking();
  }, [isTracking, user]);

  const fetchUserProfile = async () => {
    try {
      const response = await axios.get(`${API}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
      fetchMyGuardians();
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to fetch profile');
    }
  };

  const fetchGuardianProfile = async () => {
    try {
      const response = await axios.get(`${API}/guardian/my-users`, {
        headers: { Authorization: `Bearer ${guardianToken}` }
      });
      setGuardianUsers(response.data);
    } catch (error) {
      console.error('Error fetching guardian profile:', error);
    }
  };

  const fetchMyGuardians = async () => {
    try {
      const response = await axios.get(`${API}/my-guardians`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGuardians(response.data);
    } catch (error) {
      console.error('Error fetching guardians:', error);
    }
  };

  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }

    const updateLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            call_active: true,
            emergency_mode: emergencyMode
          };
          
          setLocation(locationData);
          
          // Send to backend
          axios.post(`${API}/location`, locationData, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(error => {
            console.error('Error updating location:', error);
          });
        },
        (error) => {
          console.error('Geolocation error:', error);
          toast.error('Failed to get location');
        },
        { 
          enableHighAccuracy: true, 
          timeout: 10000,
          maximumAge: 5000
        }
      );
    };

    updateLocation(); // Initial update
    locationIntervalRef.current = setInterval(updateLocation, 8000); // Update every 8 seconds
  };

  const stopLocationTracking = () => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  const handleRegister = async (formData) => {
    try {
      const response = await axios.post(`${API}/register`, formData);
      setToken(response.data.token);
      setUser(response.data.user);
      localStorage.setItem('token', response.data.token);
      toast.success('Registration successful');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
    }
  };

  const handleLogin = async (formData) => {
    try {
      const response = await axios.post(`${API}/login`, formData);
      setToken(response.data.token);
      setUser(response.data.user);
      localStorage.setItem('token', response.data.token);
      toast.success('Login successful');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    }
  };

  const handleGuardianRegister = async (formData) => {
    try {
      const response = await axios.post(`${API}/register-guardian`, formData);
      setGuardianToken(response.data.token);
      setGuardian(response.data.guardian);
      localStorage.setItem('guardianToken', response.data.token);
      toast.success('Guardian registration successful');
      setActiveTab('guardian-dashboard');
      fetchGuardianProfile();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Guardian registration failed');
    }
  };

  const handleGuardianLogin = async (formData) => {
    try {
      const response = await axios.post(`${API}/guardian-login`, formData);
      setGuardianToken(response.data.token);
      setGuardian(response.data.guardian);
      localStorage.setItem('guardianToken', response.data.token);
      toast.success('Guardian login successful');
      setActiveTab('guardian-dashboard');
      fetchGuardianProfile();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Guardian login failed');
    }
  };

  const handleConsent = async (consentGiven) => {
    try {
      await axios.post(`${API}/consent`, { consent_given: consentGiven }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(prev => ({ ...prev, consent_given: consentGiven }));
      toast.success(consentGiven ? 'Consent granted' : 'Consent revoked');
    } catch (error) {
      toast.error('Failed to update consent');
    }
  };

  const handleAssignGuardian = async (guardianEmail) => {
    try {
      await axios.post(`${API}/assign-guardian`, { guardian_email: guardianEmail }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Guardian assigned successfully');
      fetchMyGuardians();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to assign guardian');
    }
  };

  const triggerEmergency = async () => {
    try {
      setEmergencyMode(true);
      await axios.post(`${API}/emergency-alert`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Emergency alert sent to guardians', {
        style: { backgroundColor: '#fef2f2', borderColor: '#fca5a5', color: '#dc2626' }
      });
    } catch (error) {
      toast.error('Failed to send emergency alert');
    }
  };

  const fetchUserLocation = async (userId) => {
    try {
      const response = await axios.get(`${API}/guardian/user-location/${userId}`, {
        headers: { Authorization: `Bearer ${guardianToken}` }
      });
      setUserLocation(response.data.location);
    } catch (error) {
      console.error('Error fetching user location:', error);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    setActiveTab('user');
    stopLocationTracking();
  };

  const guardianLogout = () => {
    setGuardian(null);
    setGuardianToken(null);
    localStorage.removeItem('guardianToken');
    setActiveTab('guardian');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <Toaster />
      
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-blue-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-2 rounded-xl">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">LifeGuard</h1>
                <p className="text-sm text-gray-600">Emergency Response System</p>
              </div>
            </div>
            
            {(user || guardian) && (
              <div className="flex items-center space-x-4">
                {user && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Welcome, {user.name}</span>
                    <Button variant="outline" size="sm" onClick={logout}>
                      Logout
                    </Button>
                  </div>
                )}
                {guardian && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Guardian: {guardian.name}</span>
                    <Button variant="outline" size="sm" onClick={guardianLogout}>
                      Logout
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="user" className="flex items-center space-x-2">
              <Users className="w-4 h-4" />
              <span>User Portal</span>
            </TabsTrigger>
            <TabsTrigger value="guardian" className="flex items-center space-x-2">
              <Shield className="w-4 h-4" />
              <span>Guardian Portal</span>
            </TabsTrigger>
            <TabsTrigger value="guardian-dashboard" className="flex items-center space-x-2">
              <Eye className="w-4 h-4" />
              <span>Guardian Dashboard</span>
            </TabsTrigger>
          </TabsList>

          {/* User Portal */}
          <TabsContent value="user">
            {!user ? (
              <UserAuth onRegister={handleRegister} onLogin={handleLogin} />
            ) : (
              <UserDashboard 
                user={user}
                location={location}
                isTracking={isTracking}
                setIsTracking={setIsTracking}
                guardians={guardians}
                onConsent={handleConsent}
                onAssignGuardian={handleAssignGuardian}
                onTriggerEmergency={triggerEmergency}
                emergencyMode={emergencyMode}
                setEmergencyMode={setEmergencyMode}
              />
            )}
          </TabsContent>

          {/* Guardian Portal */}
          <TabsContent value="guardian">
            {!guardian ? (
              <GuardianAuth 
                onRegister={handleGuardianRegister} 
                onLogin={handleGuardianLogin} 
              />
            ) : (
              <div className="text-center py-12">
                <Heart className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Welcome, Guardian {guardian.name}
                </h2>
                <p className="text-gray-600 mb-6">
                  Switch to the Guardian Dashboard to monitor your assigned users.
                </p>
                <Button onClick={() => setActiveTab('guardian-dashboard')}>
                  Go to Dashboard
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Guardian Dashboard */}
          <TabsContent value="guardian-dashboard">
            {guardian ? (
              <GuardianDashboard 
                guardian={guardian}
                users={guardianUsers}
                selectedUser={selectedUser}
                setSelectedUser={setSelectedUser}
                userLocation={userLocation}
                onFetchLocation={fetchUserLocation}
              />
            ) : (
              <div className="text-center py-12">
                <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Guardian Access Required
                </h2>
                <p className="text-gray-600 mb-6">
                  Please register or login as a guardian to access the dashboard.
                </p>
                <Button onClick={() => setActiveTab('guardian')}>
                  Guardian Login
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// User Authentication Component
const UserAuth = ({ onRegister, onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLogin) {
      onLogin(formData);
    } else {
      onRegister(formData);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <Card className="bg-white/80 backdrop-blur-sm border-blue-200">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center space-x-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>{isLogin ? 'User Login' : 'User Registration'}</span>
          </CardTitle>
          <CardDescription>
            {isLogin ? 'Sign in to your account' : 'Create your emergency response account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
                className="border-blue-200 focus:border-blue-400"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                required
                className="border-blue-200 focus:border-blue-400"
              />
            </div>
            {!isLogin && (
              <>
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                    className="border-blue-200 focus:border-blue-400"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    required
                    className="border-blue-200 focus:border-blue-400"
                  />
                </div>
              </>
            )}
            <Button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
              {isLogin ? 'Login' : 'Register'}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              {isLogin ? 'Need to register?' : 'Already have an account?'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Guardian Authentication Component
const GuardianAuth = ({ onRegister, onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLogin) {
      onLogin(formData);
    } else {
      onRegister(formData);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <Card className="bg-white/80 backdrop-blur-sm border-green-200">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center space-x-2">
            <Shield className="w-5 h-5 text-green-600" />
            <span>{isLogin ? 'Guardian Login' : 'Guardian Registration'}</span>
          </CardTitle>
          <CardDescription>
            {isLogin ? 'Sign in as a trusted guardian' : 'Register as a trusted emergency contact'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
                className="border-green-200 focus:border-green-400"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                required
                className="border-green-200 focus:border-green-400"
              />
            </div>
            {!isLogin && (
              <>
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                    className="border-green-200 focus:border-green-400"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    required
                    className="border-green-200 focus:border-green-400"
                  />
                </div>
              </>
            )}
            <Button type="submit" className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
              {isLogin ? 'Login' : 'Register'}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-green-600 hover:text-green-800 text-sm"
            >
              {isLogin ? 'Need to register as guardian?' : 'Already registered?'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// User Dashboard Component
const UserDashboard = ({ 
  user, 
  location, 
  isTracking, 
  setIsTracking, 
  guardians, 
  onConsent, 
  onAssignGuardian, 
  onTriggerEmergency,
  emergencyMode,
  setEmergencyMode
}) => {
  const [guardianEmail, setGuardianEmail] = useState('');

  const handleAssignGuardian = (e) => {
    e.preventDefault();
    if (guardianEmail.trim()) {
      onAssignGuardian(guardianEmail);
      setGuardianEmail('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Emergency Alert Banner */}
      {emergencyMode && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">
            <strong>EMERGENCY MODE ACTIVE</strong> - Your guardians are receiving your location updates.
            <Button 
              size="sm" 
              variant="outline" 
              className="ml-4 border-red-300 text-red-700"
              onClick={() => setEmergencyMode(false)}
            >
              Deactivate
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Consent Section */}
      {!user.consent_given && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-amber-800">
              <AlertTriangle className="w-5 h-5" />
              <span>Emergency Consent Required</span>
            </CardTitle>
            <CardDescription className="text-amber-700">
              To use the emergency tracking features, you must consent to location sharing with your trusted guardians during emergency situations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Your Privacy & Safety:</strong>
                  <ul className="list-disc ml-6 mt-2 space-y-1">
                    <li>Location is shared ONLY with your pre-approved guardians</li>
                    <li>Sharing happens ONLY during emergency situations</li>
                    <li>No notifications appear on your device during emergencies</li>
                    <li>All data is encrypted and auto-deleted after 48 hours</li>
                  </ul>
                </AlertDescription>
              </Alert>
              <div className="flex space-x-4">
                <Button onClick={() => onConsent(true)} className="bg-green-600 hover:bg-green-700">
                  I Consent to Emergency Tracking
                </Button>
                <Button variant="outline" onClick={() => onConsent(false)}>
                  Decline
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Location Tracking Card */}
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              <span>Location Tracking</span>
            </CardTitle>
            <CardDescription>
              Monitor your location during calls for emergency situations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {location && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-sm text-blue-600 mb-2">Current Location:</div>
                <div className="text-lg font-mono text-blue-800">
                  {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                </div>
                <div className="text-xs text-blue-500 mt-1">
                  Accuracy: {location.accuracy}m • {new Date().toLocaleTimeString()}
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Call Tracking: {isTracking ? 'Active' : 'Inactive'}
              </span>
              <Button
                onClick={() => setIsTracking(!isTracking)}
                variant={isTracking ? "destructive" : "default"}
                size="sm"
                disabled={!user.consent_given}
              >
                {isTracking ? (
                  <>
                    <EyeOff className="w-4 h-4 mr-2" />
                    Stop Tracking
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Start Tracking
                  </>
                )}
              </Button>
            </div>

            {user.consent_given && (
              <Button 
                onClick={onTriggerEmergency}
                className="w-full bg-red-600 hover:bg-red-700 text-white"
                size="lg"
              >
                <AlertTriangle className="w-5 h-5 mr-2" />
                EMERGENCY ALERT
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Guardians Management Card */}
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-green-600" />
              <span>Trusted Guardians</span>
            </CardTitle>
            <CardDescription>
              Manage who can receive your emergency location
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {guardians.length > 0 ? (
              <div className="space-y-2">
                {guardians.map((guardian) => (
                  <div key={guardian.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div>
                      <div className="font-medium text-green-800">{guardian.name}</div>
                      <div className="text-sm text-green-600">{guardian.email}</div>
                    </div>
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      Guardian
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <Alert>
                <UserPlus className="h-4 w-4" />
                <AlertDescription>
                  No guardians assigned. Add trusted contacts who can receive your emergency location.
                </AlertDescription>
              </Alert>
            )}

            <Separator />
            
            <form onSubmit={handleAssignGuardian} className="space-y-3">
              <Label htmlFor="guardian-email">Add Guardian by Email</Label>
              <div className="flex space-x-2">
                <Input
                  id="guardian-email"
                  type="email"
                  placeholder="guardian@example.com"
                  value={guardianEmail}
                  onChange={(e) => setGuardianEmail(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" size="sm">
                  Add
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Guardian Dashboard Component
const GuardianDashboard = ({ 
  guardian, 
  users, 
  selectedUser, 
  setSelectedUser, 
  userLocation, 
  onFetchLocation 
}) => {
  useEffect(() => {
    if (selectedUser) {
      onFetchLocation(selectedUser.id);
      const interval = setInterval(() => {
        onFetchLocation(selectedUser.id);
      }, 10000); // Refresh every 10 seconds
      
      return () => clearInterval(interval);
    }
  }, [selectedUser]);

  return (
    <div className="space-y-6">
      <Card className="bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-green-600" />
            <span>Guardian Dashboard</span>
          </CardTitle>
          <CardDescription>
            Monitor the safety and location of users under your care
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <Alert>
              <Users className="h-4 w-4" />
              <AlertDescription>
                No users are currently assigned to your guardian account. Users need to add your email as their guardian.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {users.map((user) => (
                <Card 
                  key={user.id} 
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedUser?.id === user.id 
                      ? 'ring-2 ring-blue-500 bg-blue-50' 
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => setSelectedUser(user)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        user.consent_given ? 'bg-green-500' : 'bg-gray-400'
                      }`} />
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-gray-600">{user.phone}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedUser && (
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Navigation className="w-5 h-5 text-red-600" />
              <span>{selectedUser.name}'s Location</span>
            </CardTitle>
            <CardDescription>
              Real-time location monitoring for emergency response
            </CardDescription>
          </CardHeader>
          <CardContent>
            {userLocation ? (
              <div className="space-y-4">
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <div className="flex items-center space-x-2 mb-3">
                    <MapPin className="w-5 h-5 text-red-600" />
                    <span className="font-medium text-red-800">Current Location</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-sm text-red-600">Coordinates:</div>
                      <div className="font-mono text-lg text-red-800">
                        {userLocation.latitude.toFixed(6)}, {userLocation.longitude.toFixed(6)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-red-600">Accuracy:</div>
                      <div className="text-red-800">{userLocation.accuracy}m</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center space-x-4">
                    <Badge className={`${
                      userLocation.emergency_mode 
                        ? 'bg-red-100 text-red-800 border-red-200' 
                        : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                    }`}>
                      {userLocation.emergency_mode ? 'EMERGENCY ACTIVE' : 'Normal Tracking'}
                    </Badge>
                    <div className="flex items-center space-x-1 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>{new Date(userLocation.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <Button 
                    onClick={() => {
                      const url = `https://maps.google.com/maps?q=${userLocation.latitude},${userLocation.longitude}`;
                      window.open(url, '_blank');
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <MapPin className="w-4 h-4 mr-2" />
                    Open in Maps
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => onFetchLocation(selectedUser.id)}
                  >
                    Refresh Location
                  </Button>
                </div>
              </div>
            ) : (
              <Alert>
                <MapPin className="h-4 w-4" />
                <AlertDescription>
                  No location data available for this user. They may not have started tracking yet.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default App;