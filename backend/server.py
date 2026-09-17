from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import random
import string
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ----- Models -----
class ExerciseItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    sets: int = 3
    reps: str = "10"          # "10", "8-12", "AMRAP"
    weight: str = ""          # "50kg", "bodyweight"
    rest_seconds: int = 60
    notes: str = ""


class SessionItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str                 # es. "Giorno A - Push"
    exercises: List[ExerciseItem] = []


class Scheda(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    name: str                 # nome scheda
    client_name: str          # nome cliente
    sessions: List[SessionItem] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SchedaCreate(BaseModel):
    name: str
    client_name: str
    sessions: List[SessionItem] = []


class SchedaUpdate(BaseModel):
    name: Optional[str] = None
    client_name: Optional[str] = None
    sessions: Optional[List[SessionItem]] = None


class CheckIn(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    session_id: Optional[str] = None
    session_name: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CheckInCreate(BaseModel):
    code: str
    session_id: Optional[str] = None
    session_name: Optional[str] = None


class Exercise(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    muscle_group: str
    description: str


class ExerciseCreate(BaseModel):
    name: str
    muscle_group: str
    description: str


# ----- Helpers -----
def clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


async def gen_unique_code() -> str:
    for _ in range(20):
        code = "".join(random.choices(string.digits, k=6))
        exists = await db.schede.find_one({"code": code}, {"_id": 0, "code": 1})
        if not exists:
            return code
    raise HTTPException(500, "Impossibile generare codice univoco")


# ----- Routes -----
@api_router.get("/")
async def root():
    return {"message": "GymCode API"}


# Schede
@api_router.post("/schede", response_model=Scheda)
async def create_scheda(payload: SchedaCreate):
    code = await gen_unique_code()
    scheda = Scheda(code=code, name=payload.name, client_name=payload.client_name,
                    sessions=payload.sessions)
    await db.schede.insert_one(scheda.model_dump())
    return scheda


@api_router.get("/schede", response_model=List[Scheda])
async def list_schede():
    docs = await db.schede.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Scheda(**d) for d in docs]


@api_router.get("/schede/{code}", response_model=Scheda)
async def get_scheda(code: str):
    doc = await db.schede.find_one({"code": code}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Scheda non trovata")
    return Scheda(**doc)


@api_router.put("/schede/{code}", response_model=Scheda)
async def update_scheda(code: str, payload: SchedaUpdate):
    doc = await db.schede.find_one({"code": code}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Scheda non trovata")
    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "sessions" in update:
        update["sessions"] = [SessionItem(**s).model_dump() if not isinstance(s, dict) else s
                              for s in update["sessions"]]
    update["updated_at"] = datetime.now(timezone.utc)
    await db.schede.update_one({"code": code}, {"$set": update})
    doc = await db.schede.find_one({"code": code}, {"_id": 0})
    return Scheda(**doc)


@api_router.delete("/schede/{code}")
async def delete_scheda(code: str):
    r = await db.schede.delete_one({"code": code})
    if r.deleted_count == 0:
        raise HTTPException(404, "Scheda non trovata")
    await db.checkins.delete_many({"code": code})
    return {"ok": True}


# Check-ins
@api_router.post("/checkins", response_model=CheckIn)
async def create_checkin(payload: CheckInCreate):
    scheda = await db.schede.find_one({"code": payload.code}, {"_id": 0, "code": 1})
    if not scheda:
        raise HTTPException(404, "Codice scheda non trovato")
    ci = CheckIn(**payload.model_dump())
    await db.checkins.insert_one(ci.model_dump())
    return ci


@api_router.get("/checkins/{code}", response_model=List[CheckIn])
async def list_checkins(code: str, limit: int = 200):
    docs = await db.checkins.find({"code": code}, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return [CheckIn(**d) for d in docs]


@api_router.get("/checkins/{code}/stats")
async def checkin_stats(code: str):
    now = datetime.now(timezone.utc)
    # start of ISO week (Monday) at UTC midnight
    week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)

    week = await db.checkins.count_documents({"code": code, "timestamp": {"$gte": week_start}})
    month = await db.checkins.count_documents({"code": code, "timestamp": {"$gte": month_start}})
    year = await db.checkins.count_documents({"code": code, "timestamp": {"$gte": year_start}})
    total = await db.checkins.count_documents({"code": code})

    # Last 12 weeks counts (for a mini chart)
    weekly_history = []
    for i in range(11, -1, -1):
        ws = week_start - timedelta(weeks=i)
        we = ws + timedelta(weeks=1)
        c = await db.checkins.count_documents({"code": code,
                                               "timestamp": {"$gte": ws, "$lt": we}})
        weekly_history.append({"week_start": ws.isoformat(), "count": c})

    return {"week": week, "month": month, "year": year, "total": total,
            "weekly_history": weekly_history}


@api_router.delete("/checkins/{checkin_id}")
async def delete_checkin(checkin_id: str):
    r = await db.checkins.delete_one({"id": checkin_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Check-in non trovato")
    return {"ok": True}


# Exercise library
DEFAULT_EXERCISES = [
    ("Panca Piana", "Pettorali", "Esercizio fondamentale per pettorali, spalle anteriori e tricipiti. Sdraiati sulla panca, presa poco più larga delle spalle."),
    ("Squat", "Gambe", "Re degli esercizi. Bilanciere sui trapezi, scendi mantenendo la schiena dritta finché le cosce sono parallele al pavimento."),
    ("Stacco da Terra", "Schiena", "Esercizio completo per catena posteriore. Schiena neutra, spingi con i talloni, estendi anche e ginocchia insieme."),
    ("Trazioni", "Schiena", "Presa prona alla sbarra, tira il petto verso la sbarra contraendo dorsali e scapole."),
    ("Military Press", "Spalle", "In piedi, bilanciere all'altezza delle spalle. Spingi sopra la testa senza inarcare la schiena."),
    ("Curl Bilanciere", "Bicipiti", "In piedi, gomiti fissi al fianco, fletti gli avambracci portando il bilanciere alle spalle."),
    ("French Press", "Tricipiti", "Sdraiato o in piedi, estendi i gomiti mantenendoli fissi puntati verso l'alto."),
    ("Affondi", "Gambe", "Alternando le gambe, passo lungo in avanti, scendi finché il ginocchio posteriore sfiora il pavimento."),
    ("Rematore", "Schiena", "Busto inclinato 45°, tira il bilanciere verso l'ombelico contraendo le scapole."),
    ("Plank", "Core", "Mantieni la posizione con avambracci a terra, corpo allineato dalle spalle alle caviglie."),
    ("Crunch", "Core", "Sdraiato supino, ginocchia piegate, solleva le scapole contraendo l'addome."),
    ("Leg Press", "Gambe", "Alla macchina, piedi alla larghezza spalle, spingi la piattaforma senza bloccare le ginocchia."),
    ("Panca Inclinata", "Pettorali", "Panca a 30-45°, colpisce la porzione alta del petto."),
    ("Alzate Laterali", "Spalle", "Manubri lungo i fianchi, sollevali di lato fino all'altezza spalle, gomiti leggermente piegati."),
    ("Dip alle Parallele", "Tricipiti", "Sospeso alle parallele, scendi finché le spalle sono all'altezza dei gomiti, poi spingi."),
]


@api_router.get("/exercises", response_model=List[Exercise])
async def list_exercises():
    docs = await db.exercises.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    return [Exercise(**d) for d in docs]


@api_router.post("/exercises", response_model=Exercise)
async def create_exercise(payload: ExerciseCreate):
    ex = Exercise(**payload.model_dump())
    await db.exercises.insert_one(ex.model_dump())
    return ex


@api_router.delete("/exercises/{exercise_id}")
async def delete_exercise(exercise_id: str):
    r = await db.exercises.delete_one({"id": exercise_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Esercizio non trovato")
    return {"ok": True}


@app.on_event("startup")
async def seed():
    count = await db.exercises.count_documents({})
    if count == 0:
        seed_docs = [Exercise(name=n, muscle_group=m, description=d).model_dump()
                     for (n, m, d) in DEFAULT_EXERCISES]
        await db.exercises.insert_many(seed_docs)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
