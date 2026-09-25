from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
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
import jwt
from jwt import InvalidTokenError
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
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

JWT_SECRET = os.environ.get("JWT_SECRET", "")
if not JWT_SECRET or len(JWT_SECRET) < 32:
    raise RuntimeError("JWT_SECRET mancante o troppo corto nel .env (min 32 caratteri)")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 7

_bearer = HTTPBearer(auto_error=False)


def create_host_token() -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": "host",
        "role": "host",
        "iat": now,
        "exp": now + timedelta(days=JWT_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def require_host(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Dict[str, Any]:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized
    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["exp", "iat", "sub", "role"]},
        )
    except InvalidTokenError:
        raise unauthorized
    if payload.get("sub") != "host" or payload.get("role") != "host":
        raise unauthorized
    return payload

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
    paid_month: Optional[str] = None   # "YYYY-MM" ultimo mese pagato
    archived: bool = False
    archived_at: Optional[datetime] = None
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
    paid_month: Optional[str] = None


class SchedaPaidUpdate(BaseModel):
    # True → segna pagato per il mese corrente. False → azzera.
    paid: bool


class SchedaArchiveUpdate(BaseModel):
    archived: bool


class AutoArchiveRequest(BaseModel):
    days: int = 60


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
    reps: str = ""
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ClientStateUpdate(BaseModel):
    notes: Optional[str] = None
    weight: Optional[str] = None
    reps: Optional[str] = None


class ClientStateHistory(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    exercise_id: str
    session_id: Optional[str] = None
    session_name: Optional[str] = None
    notes: str = ""
    weight: str = ""
    reps: str = ""
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
    token = create_host_token()
    return {
        "verified": True,
        "access_token": token,
        "token_type": "bearer",
        "expires_in": JWT_EXPIRE_DAYS * 24 * 60 * 60,
    }


# Schede
@api_router.post("/schede", response_model=Scheda, dependencies=[Depends(require_host)])
async def create_scheda(payload: SchedaCreate):
    code = await gen_unique_code()
    scheda = Scheda(code=code, name=payload.name, client_name=payload.client_name,
                    sessions=payload.sessions)
    await db.schede.insert_one(scheda.model_dump())
    return scheda


@api_router.get("/schede", response_model=List[Scheda], dependencies=[Depends(require_host)])
async def list_schede(archived: str = "false"):
    """
    archived: 'false' (default, solo attive) | 'true' (solo archiviate) | 'all'
    """
    if archived == "true":
        query = {"archived": True}
    elif archived == "all":
        query = {}
    else:
        # Includi anche i documenti legacy senza il campo `archived`
        query = {"$or": [{"archived": False}, {"archived": {"$exists": False}}]}
    docs = await db.schede.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Scheda(**d) for d in docs]


@api_router.get("/schede/{code}", response_model=Scheda)
async def get_scheda(code: str):
    doc = await db.schede.find_one({"code": code}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Scheda non trovata")
    if doc.get("archived"):
        # Il client con solo il codice NON deve vedere schede archiviate.
        raise HTTPException(404, "Scheda non trovata")
    return Scheda(**doc)


@api_router.put("/schede/{code}", response_model=Scheda, dependencies=[Depends(require_host)])
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


@api_router.delete("/schede/{code}", dependencies=[Depends(require_host)])
async def delete_scheda(code: str):
    r = await db.schede.delete_one({"code": code})
    if r.deleted_count == 0:
        raise HTTPException(404, "Scheda non trovata")
    await db.checkins.delete_many({"code": code})
    await db.client_state.delete_many({"code": code})
    await db.client_state_history.delete_many({"code": code})
    return {"ok": True}


@api_router.put("/schede/{code}/paid", response_model=Scheda, dependencies=[Depends(require_host)])
async def set_paid(code: str, payload: SchedaPaidUpdate):
    doc = await db.schede.find_one({"code": code}, {"_id": 0, "code": 1})
    if not doc:
        raise HTTPException(404, "Scheda non trovata")
    now = datetime.now(timezone.utc)
    current_month = f"{now.year:04d}-{now.month:02d}"
    new_val = current_month if payload.paid else None
    await db.schede.update_one(
        {"code": code},
        {"$set": {"paid_month": new_val, "updated_at": now}},
    )
    doc = await db.schede.find_one({"code": code}, {"_id": 0})
    return Scheda(**doc)


@api_router.put("/schede/{code}/archive", response_model=Scheda, dependencies=[Depends(require_host)])
async def set_archived(code: str, payload: SchedaArchiveUpdate):
    doc = await db.schede.find_one({"code": code}, {"_id": 0, "code": 1})
    if not doc:
        raise HTTPException(404, "Scheda non trovata")
    now = datetime.now(timezone.utc)
    await db.schede.update_one(
        {"code": code},
        {"$set": {
            "archived": payload.archived,
            "archived_at": now if payload.archived else None,
            "updated_at": now,
        }},
    )
    doc = await db.schede.find_one({"code": code}, {"_id": 0})
    return Scheda(**doc)


@api_router.post("/schede/auto-archive", dependencies=[Depends(require_host)])
async def auto_archive(payload: AutoArchiveRequest):
    """
    Archivia in silenzio tutte le schede attive senza check-in da `days` giorni
    (fallback: created_at). Restituisce l'elenco dei codici archiviati.
    """
    days = max(1, min(365, int(payload.days) if payload.days else 60))
    now = datetime.now(timezone.utc)
    threshold = now - timedelta(days=days)
    archived_codes: List[str] = []

    cursor = db.schede.find(
        {"$or": [{"archived": False}, {"archived": {"$exists": False}}]},
        {"_id": 0, "code": 1, "created_at": 1},
    )
    async for s in cursor:
        code = s.get("code")
        if not code:
            continue
        last = await db.checkins.find_one(
            {"code": code}, {"_id": 0, "timestamp": 1}, sort=[("timestamp", -1)]
        )
        last_ts = (last or {}).get("timestamp") or s.get("created_at")
        if isinstance(last_ts, str):
            # Difensivo: tollera datetime salvati come stringhe
            try:
                last_ts = datetime.fromisoformat(last_ts.replace("Z", "+00:00"))
            except Exception:
                last_ts = None
        if last_ts is None:
            continue
        if last_ts.tzinfo is None:
            last_ts = last_ts.replace(tzinfo=timezone.utc)
        if last_ts < threshold:
            await db.schede.update_one(
                {"code": code},
                {"$set": {"archived": True, "archived_at": now, "updated_at": now}},
            )
            archived_codes.append(code)

    return {"archived_codes": archived_codes, "count": len(archived_codes), "days": days}


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
                    reps=(cs or {}).get("reps", "") or ex.get("reps", "") or "",
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


@api_router.delete("/checkins/{checkin_id}", dependencies=[Depends(require_host)])
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


MUSCLE_GROUPS = ["PETTO", "DORSO", "SPALLE", "BICIPITI", "TRICIPITI", "ADDOME", "GAMBE", "CORPO LIBERO"]
LEGACY_MUSCLE_MAP = {
    "Pettorali": "PETTO",
    "Pettorale": "PETTO",
    "Petto": "PETTO",
    "Schiena": "DORSO",
    "Dorso": "DORSO",
    "Spalle": "SPALLE",
    "Bicipiti": "BICIPITI",
    "Bicipite": "BICIPITI",
    "Tricipiti": "TRICIPITI",
    "Tricipite": "TRICIPITI",
    "Core": "ADDOME",
    "Addome": "ADDOME",
    "Addominali": "ADDOME",
    "Gambe": "GAMBE",
    "Corpo libero": "CORPO LIBERO",
}


# Exercise library
DEFAULT_EXERCISES_LIBRARY = [
    ("Panca Piana", "PETTO", "Esercizio fondamentale per pettorali, spalle anteriori e tricipiti. Sdraiati sulla panca, presa poco più larga delle spalle."),
    ("Panca Inclinata", "PETTO", "Panca a 30-45°, colpisce la porzione alta del petto."),
    ("Squat", "GAMBE", "Re degli esercizi. Bilanciere sui trapezi, scendi mantenendo la schiena dritta finché le cosce sono parallele al pavimento."),
    ("Affondi", "GAMBE", "Alternando le gambe, passo lungo in avanti, scendi finché il ginocchio posteriore sfiora il pavimento."),
    ("Leg Press", "GAMBE", "Alla macchina, piedi alla larghezza spalle, spingi la piattaforma senza bloccare le ginocchia."),
    ("Stacco da Terra", "DORSO", "Esercizio completo per catena posteriore. Schiena neutra, spingi con i talloni, estendi anche e ginocchia insieme."),
    ("Rematore", "DORSO", "Busto inclinato 45°, tira il bilanciere verso l'ombelico contraendo le scapole."),
    ("Trazioni", "DORSO", "Presa prona alla sbarra, tira il petto verso la sbarra contraendo dorsali e scapole."),
    ("Military Press", "SPALLE", "In piedi, bilanciere all'altezza delle spalle. Spingi sopra la testa senza inarcare la schiena."),
    ("Alzate Laterali", "SPALLE", "Manubri lungo i fianchi, sollevali di lato fino all'altezza spalle, gomiti leggermente piegati."),
    ("Curl Bilanciere", "BICIPITI", "In piedi, gomiti fissi al fianco, fletti gli avambracci portando il bilanciere alle spalle."),
    ("French Press", "TRICIPITI", "Sdraiato o in piedi, estendi i gomiti mantenendoli fissi puntati verso l'alto."),
    ("Dip alle Parallele", "TRICIPITI", "Sospeso alle parallele, scendi finché le spalle sono all'altezza dei gomiti, poi spingi."),
    ("Plank", "ADDOME", "Mantieni la posizione con avambracci a terra, corpo allineato dalle spalle alle caviglie."),
    ("Crunch", "ADDOME", "Sdraiato supino, ginocchia piegate, solleva le scapole contraendo l'addome."),
    ("Push Up", "CORPO LIBERO", "Piegamenti sulle braccia; petto verso il pavimento, corpo teso."),
    ("Burpees", "CORPO LIBERO", "Squat + plank + salto verticale, esercizio full body."),
]


@api_router.get("/muscle-groups")
async def get_muscle_groups():
    return {"groups": MUSCLE_GROUPS}


@api_router.get("/exercises", response_model=List[Exercise])
async def list_exercises():
    docs = await db.exercises.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    return [Exercise(**d) for d in docs]


@api_router.post("/exercises", response_model=Exercise, dependencies=[Depends(require_host)])
async def create_exercise(payload: ExerciseCreate):
    ex = Exercise(**payload.model_dump())
    await db.exercises.insert_one(ex.model_dump())
    return ex


@api_router.delete("/exercises/{exercise_id}", dependencies=[Depends(require_host)])
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


@api_router.put("/warmup", response_model=WarmupTemplate, dependencies=[Depends(require_host)])
async def put_warmup(payload: WarmupUpdate):
    template = WarmupTemplate(exercises=payload.exercises)
    await db.warmup.update_one({}, {"$set": template.model_dump()}, upsert=True)
    return template


@app.on_event("startup")
async def seed():
    # Normalize legacy muscle_group values
    async for doc in db.exercises.find({}, {"_id": 0}):
        mg = doc.get("muscle_group", "")
        if mg not in MUSCLE_GROUPS:
            new_mg = LEGACY_MUSCLE_MAP.get(mg, "CORPO LIBERO")
            await db.exercises.update_one({"id": doc["id"]}, {"$set": {"muscle_group": new_mg}})
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
