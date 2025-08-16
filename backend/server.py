from fastapi import FastAPI, APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timedelta
import json
import asyncio
from collections import defaultdict
import jwt


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# JWT Secret (in production, use a proper secret)
JWT_SECRET = "emergency_tracking_secret_key_2025"
security = HTTPBearer()

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.guardian_connections: Dict[str, List[WebSocket]] = defaultdict(list)

    async def connect_user(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    async def connect_guardian(self, websocket: WebSocket, guardian_id: str):
        await websocket.accept()
        self.guardian_connections[guardian_id].append(websocket)

    def disconnect_user(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    def disconnect_guardian(self, websocket: WebSocket, guardian_id: str):
        if guardian_id in self.guardian_connections:
            if websocket in self.guardian_connections[guardian_id]:
                self.guardian_connections[guardian_id].remove(websocket)

    async def broadcast_location_to_guardians(self, user_id: str, location_data: dict):
        # Get user's guardians
        user = await db.users.find_one({"id": user_id})
        if not user or not user.get("guardians"):
            return
            
        for guardian_id in user["guardians"]:
            if guardian_id in self.guardian_connections:
                for websocket in self.guardian_connections[guardian_id]:
                    try:
                        await websocket.send_text(json.dumps({
                            "type": "location_update",
                            "user_id": user_id,
                            "data": location_data
                        }))
                    except:
                        self.disconnect_guardian(websocket, guardian_id)

manager = ConnectionManager()

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    phone: str
    emergency_contacts: List[str] = []
    guardians: List[str] = []
    consent_given: bool = False
    consent_timestamp: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    email: str
    name: str
    phone: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class Guardian(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    phone: str
    users_guarding: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)

class GuardianCreate(BaseModel):
    email: str
    name: str
    phone: str

class LocationData(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    call_active: bool = False
    emergency_mode: bool = False

class EmergencyAlert(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    guardian_id: str
    location: LocationData
    alert_type: str = "emergency_call"
    status: str = "active"  # active, resolved, false_alarm
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ConsentUpdate(BaseModel):
    consent_given: bool

class GuardianAssignment(BaseModel):
    guardian_email: str

# Authentication helper
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return User(**user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Auth Routes
@api_router.post("/register")
async def register_user(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")
    
    user = User(
        email=user_data.email,
        name=user_data.name,
        phone=user_data.phone
    )
    
    await db.users.insert_one(user.dict())
    
    # Create JWT token
    token = jwt.encode({"user_id": user.id}, JWT_SECRET, algorithm="HS256")
    
    return {"user": user, "token": token}

@api_router.post("/login")
async def login_user(login_data: UserLogin):
    user = await db.users.find_one({"email": login_data.email})
    if not user:
        raise HTTPException(status_code=400, detail="Invalid credentials")
    
    # In production, verify password hash here
    token = jwt.encode({"user_id": user["id"]}, JWT_SECRET, algorithm="HS256")
    
    return {"user": User(**user), "token": token}

@api_router.post("/register-guardian")
async def register_guardian(guardian_data: GuardianCreate):
    # Check if guardian exists
    existing_guardian = await db.guardians.find_one({"email": guardian_data.email})
    if existing_guardian:
        raise HTTPException(status_code=400, detail="Guardian already exists")
    
    guardian = Guardian(
        email=guardian_data.email,
        name=guardian_data.name,
        phone=guardian_data.phone
    )
    
    await db.guardians.insert_one(guardian.dict())
    
    # Create JWT token
    token = jwt.encode({"guardian_id": guardian.id}, JWT_SECRET, algorithm="HS256")
    
    return {"guardian": guardian, "token": token}

@api_router.post("/guardian-login")
async def guardian_login(login_data: UserLogin):
    guardian = await db.guardians.find_one({"email": login_data.email})
    if not guardian:
        raise HTTPException(status_code=400, detail="Invalid credentials")
    
    token = jwt.encode({"guardian_id": guardian["id"]}, JWT_SECRET, algorithm="HS256")
    
    return {"guardian": Guardian(**guardian), "token": token}

# User Management Routes
@api_router.get("/profile")
async def get_profile(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.post("/consent")
async def update_consent(consent_data: ConsentUpdate, current_user: User = Depends(get_current_user)):
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {
            "consent_given": consent_data.consent_given,
            "consent_timestamp": datetime.utcnow()
        }}
    )
    return {"success": True, "consent_given": consent_data.consent_given}

@api_router.post("/assign-guardian")
async def assign_guardian(assignment: GuardianAssignment, current_user: User = Depends(get_current_user)):
    # Find guardian by email
    guardian = await db.guardians.find_one({"email": assignment.guardian_email})
    if not guardian:
        raise HTTPException(status_code=404, detail="Guardian not found")
    
    # Add guardian to user's list
    await db.users.update_one(
        {"id": current_user.id},
        {"$addToSet": {"guardians": guardian["id"]}}
    )
    
    # Add user to guardian's list
    await db.guardians.update_one(
        {"id": guardian["id"]},
        {"$addToSet": {"users_guarding": current_user.id}}
    )
    
    return {"success": True, "guardian_assigned": guardian["name"]}

@api_router.get("/my-guardians")
async def get_my_guardians(current_user: User = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user.id})
    if not user.get("guardians"):
        return []
    
    guardians = await db.guardians.find({"id": {"$in": user["guardians"]}}).to_list(100)
    return [Guardian(**guardian) for guardian in guardians]

# Location Tracking Routes
@api_router.post("/location")
async def update_location(location: LocationData, current_user: User = Depends(get_current_user)):
    location.user_id = current_user.id
    
    # Store location in database
    await db.locations.insert_one(location.dict())
    
    # If emergency mode or call active, broadcast to guardians
    if location.emergency_mode or location.call_active:
        await manager.broadcast_location_to_guardians(current_user.id, location.dict())
    
    return {"success": True}

@api_router.post("/emergency-alert")
async def trigger_emergency_alert(current_user: User = Depends(get_current_user)):
    # Get user's last known location
    last_location = await db.locations.find_one(
        {"user_id": current_user.id},
        sort=[("timestamp", -1)]
    )
    
    if not last_location:
        raise HTTPException(status_code=400, detail="No location data available")
    
    user = await db.users.find_one({"id": current_user.id})
    if not user.get("guardians"):
        raise HTTPException(status_code=400, detail="No guardians assigned")
    
    # Create emergency alerts for all guardians
    alerts = []
    for guardian_id in user["guardians"]:
        alert = EmergencyAlert(
            user_id=current_user.id,
            guardian_id=guardian_id,
            location=LocationData(**last_location)
        )
        alerts.append(alert)
        await db.emergency_alerts.insert_one(alert.dict())
    
    # Broadcast emergency to guardians
    await manager.broadcast_location_to_guardians(current_user.id, {
        **last_location,
        "emergency_mode": True,
        "alert_type": "manual_trigger"
    })
    
    return {"success": True, "alerts_created": len(alerts)}

# Guardian Routes
@api_router.get("/guardian/my-users")
async def get_guardian_users(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        guardian_id = payload.get("guardian_id")
        if not guardian_id:
            raise HTTPException(status_code=401, detail="Invalid guardian token")
        
        guardian = await db.guardians.find_one({"id": guardian_id})
        if not guardian:
            raise HTTPException(status_code=401, detail="Guardian not found")
        
        if not guardian.get("users_guarding"):
            return []
        
        users = await db.users.find({"id": {"$in": guardian["users_guarding"]}}).to_list(100)
        return [User(**user) for user in users]
        
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@api_router.get("/guardian/user-location/{user_id}")
async def get_user_location(user_id: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        guardian_id = payload.get("guardian_id")
        if not guardian_id:
            raise HTTPException(status_code=401, detail="Invalid guardian token")
        
        # Verify guardian has permission to track this user
        user = await db.users.find_one({"id": user_id})
        if not user or guardian_id not in user.get("guardians", []):
            raise HTTPException(status_code=403, detail="No permission to track this user")
        
        # Get latest location
        location = await db.locations.find_one(
            {"user_id": user_id},
            sort=[("timestamp", -1)]
        )
        
        if not location:
            return {"location": None}
        
        return {"location": LocationData(**location)}
        
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# WebSocket Routes
@app.websocket("/ws/location/{user_id}")
async def location_websocket(websocket: WebSocket, user_id: str):
    await manager.connect_user(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            location_data = json.loads(data)
            
            # Store location in database
            location = LocationData(user_id=user_id, **location_data)
            await db.locations.insert_one(location.dict())
            
            # Broadcast to guardians if emergency
            if location.emergency_mode or location.call_active:
                await manager.broadcast_location_to_guardians(user_id, location.dict())
                
    except WebSocketDisconnect:
        manager.disconnect_user(user_id)

@app.websocket("/ws/guardian/{guardian_id}")
async def guardian_websocket(websocket: WebSocket, guardian_id: str):
    await manager.connect_guardian(websocket, guardian_id)
    try:
        while True:
            await websocket.receive_text()  # Keep connection alive
    except WebSocketDisconnect:
        manager.disconnect_guardian(websocket, guardian_id)

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()