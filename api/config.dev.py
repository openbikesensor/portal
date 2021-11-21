HOST = "0.0.0.0"
PORT = 3000
DEBUG = True
AUTO_RESTART = True
SECRET = "!!!!!!!!!!!!CHANGE ME!!!!!!!!!!!!"
POSTGRES_URL = "postgresql+asyncpg://obs:obs@postgres/obs"
KEYCLOAK_URL = "http://keycloak:8080/auth/realms/obs-dev/"
KEYCLOAK_CLIENT_ID = "portal"
KEYCLOAK_CLIENT_SECRET = "c385278e-bd2e-4f13-9937-34b0c0f44c2d"
DEDICATED_WORKER = True
FRONTEND_URL = "http://localhost:3001/"
FRONTEND_DIR = None
FRONTEND_CONFIG = None
TILES_FILE = None  # "/tiles/tiles.mbtiles"
DATA_DIR = "/data"
ADDITIONAL_CORS_ORIGINS = [
    "http://localhost:8880/",  # for maputnik on 8880
    "http://localhost:8888/",  # for maputnik on 8888
]

# vim: set ft=python :
