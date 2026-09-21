from fastapi import FastAPI, APIRouter, HTTPException, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from motor.motor_asyncio import AsyncIOMotorClient
import os
import random
import string
import logging
import time
import bcrypt
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

HOST_PASSWORD_HASH = os.environ.get("HOST_PASSWORD_HASH", "").encode("ascii")
if not HOST_PASSWORD_HASH.startswith((b"$2a$", b"$2b$", b"$2y$")):
    raise RuntimeError("HOST_PASSWORD_HASH mancante o non valido nel .env")

# Semplice rate limit in-memory per IP: max 5 tentativi / minuto
_login_attempts: Dict[str, List[float]] = {}
def _check_rate(ip: str) -> bool:
    now = time.time()
    window = [t for t in _login_attempts.get(ip, []) if now - t < 60]
    _login_attempts[ip] = window
    return len(window) < 5

def _record_attempt(ip: str) -> None:
    _login_attempts.setdefault(ip, []).append(time.time())


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


class ClientState(BaseModel):
    code: str
    exercise_id: str
    notes: str = ""
    weight: str = ""
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ClientStateUpdate(BaseModel):
    notes: Optional[str] = None
    weight: Optional[str] = None


class ClientStateHistory(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    exercise_id: str
    session_id: Optional[str] = None
    session_name: Optional[str] = None
    notes: str = ""
    weight: str = ""
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class WarmupTemplate(BaseModel):
    exercises: List[ExerciseItem] = []
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class WarmupUpdate(BaseModel):
    exercises: List[ExerciseItem]


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


# Host auth
class HostVerifyRequest(BaseModel):
    password: str = Field(min_length=1, max_length=72)


@api_router.post("/host/verify")
async def host_verify(request: Request, body: HostVerifyRequest):
    ip = request.client.host if request.client else "unknown"
    if not _check_rate(ip):
        raise HTTPException(429, "Troppi tentativi, riprova tra un minuto")
    supplied = body.password.encode("utf-8")
    if len(supplied) > 72:
        _record_attempt(ip)
        raise HTTPException(401, "Password host non valida")
    ok = await run_in_threadpool(bcrypt.checkpw, supplied, HOST_PASSWORD_HASH)
    if not ok:
        _record_attempt(ip)
        raise HTTPException(401, "Password host non valida")
    return {"verified": True}


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
    await db.client_state.delete_many({"code": code})
    await db.client_state_history.delete_many({"code": code})
    return {"ok": True}


# Check-ins
@api_router.post("/checkins", response_model=CheckIn)
async def create_checkin(payload: CheckInCreate):
    scheda = await db.schede.find_one({"code": payload.code}, {"_id": 0})
    if not scheda:
        raise HTTPException(404, "Codice scheda non trovato")
    ci = CheckIn(**payload.model_dump())
    await db.checkins.insert_one(ci.model_dump())

    # Snapshot: for each exercise in the completed session, write a history entry
    # from the current client_state so the host can see progression over time.
    if payload.session_id:
        target = None
        for s in scheda.get("sessions", []):
            if s.get("id") == payload.session_id:
                target = s
                break
        if target:
            for ex in target.get("exercises", []):
                ex_id = ex.get("id")
                if not ex_id:
                    continue
                cs = await db.client_state.find_one(
                    {"code": payload.code, "exercise_id": ex_id}, {"_id": 0}
                )
                snap = ClientStateHistory(
                    code=payload.code,
                    exercise_id=ex_id,
                    session_id=payload.session_id,
                    session_name=payload.session_name,
                    notes=(cs or {}).get("notes", "") or "",
                    weight=(cs or {}).get("weight", "") or ex.get("weight", "") or "",
                    timestamp=ci.timestamp,
                )
                await db.client_state_history.insert_one(snap.model_dump())
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


DEFAULT_WARMUP = [
    ("Stretching posizione squadra", "Seduto con schiena dritta, piante dei piedi unite, ginocchia verso il pavimento"),
    ("Gambe divaricate", "Seduto con gambe aperte, allungati in avanti mantenendo la schiena dritta"),
    ("Posizione dell'ostacolista", "Una gamba tesa, l'altra piegata dietro, allungati sulla gamba tesa"),
    ("Posizione del cobra", "Sdraiato prono, spingi il busto in alto con le braccia mantenendo il bacino a terra"),
    ("Posizione del tavolo", "A quattro zampe, spingi bacino e petto verso l'alto"),
    ("Posizione del gatto", "A quattro zampe, alterna schiena curva verso l'alto e schiena inarcata"),
    ("Posizione del bambino", "In ginocchio, siediti sui talloni e allunga le braccia in avanti a terra"),
]


# Exercise library
DEFAULT_EXERCISES_LIBRARY = [
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


# Client state (per-exercise notes + weight override written by the client)
@api_router.get("/schede/{code}/client-state", response_model=List[ClientState])
async def list_client_state(code: str):
    docs = await db.client_state.find({"code": code}, {"_id": 0}).to_list(1000)
    return [ClientState(**d) for d in docs]


@api_router.put("/schede/{code}/client-state/{exercise_id}", response_model=ClientState)
async def upsert_client_state(code: str, exercise_id: str, payload: ClientStateUpdate):
    scheda = await db.schede.find_one({"code": code}, {"_id": 0, "code": 1})
    if not scheda:
        raise HTTPException(404, "Codice scheda non trovato")
    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    update["code"] = code
    update["exercise_id"] = exercise_id
    update["updated_at"] = datetime.now(timezone.utc)
    await db.client_state.update_one(
        {"code": code, "exercise_id": exercise_id},
        {"$set": update},
        upsert=True,
    )
    doc = await db.client_state.find_one({"code": code, "exercise_id": exercise_id}, {"_id": 0})
    return ClientState(**doc)


@api_router.get("/schede/{code}/client-state/{exercise_id}/history", response_model=List[ClientStateHistory])
async def client_state_history(code: str, exercise_id: str, limit: int = 30):
    docs = await db.client_state_history.find(
        {"code": code, "exercise_id": exercise_id}, {"_id": 0}
    ).sort("timestamp", -1).to_list(limit)
    return [ClientStateHistory(**d) for d in docs]


# Warmup template (single shared document — applied at the top of every client scheda)
@api_router.get("/warmup", response_model=WarmupTemplate)
async def get_warmup():
    doc = await db.warmup.find_one({}, {"_id": 0})
    if not doc:
        exs = [ExerciseItem(name=n, sets=1, reps="30s", weight="", rest_seconds=0, notes=d).model_dump()
               for (n, d) in DEFAULT_WARMUP]
        template = WarmupTemplate(exercises=[ExerciseItem(**e) for e in exs])
        await db.warmup.insert_one(template.model_dump())
        return template
    return WarmupTemplate(**doc)


@api_router.put("/warmup", response_model=WarmupTemplate)
async def put_warmup(payload: WarmupUpdate):
    template = WarmupTemplate(exercises=payload.exercises)
    await db.warmup.update_one({}, {"$set": template.model_dump()}, upsert=True)
    return template


@app.on_event("startup")
async def seed():
    count = await db.exercises.count_documents({})
    if count == 0:
        seed_docs = [Exercise(name=n, muscle_group=m, description=d).model_dump()
                     for (n, m, d) in DEFAULT_EXERCISES_LIBRARY]
        await db.exercises.insert_many(seed_docs)
    # Seed warmup template if missing
    if not await db.warmup.find_one({}):
        exs = [ExerciseItem(name=n, sets=1, reps="30s", weight="", rest_seconds=0, notes=d).model_dump()
               for (n, d) in DEFAULT_WARMUP]
        await db.warmup.insert_one(WarmupTemplate(exercises=[ExerciseItem(**e) for e in exs]).model_dump())


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
