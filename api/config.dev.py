HOST = "0.0.0.0"
PORT = 3000
DEBUG = True
VERBOSE = False
AUTO_RESTART = True
SECRET = "d55910bac6de27cc76e12b829d2c5f3a70cc9236d4bd3bea9ad024408dd6912e"
POSTGRES_URL = "postgresql+asyncpg://obs:obs@postgres/obs"
POSTGRES_POOL_SIZE = 20
POSTGRES_MAX_OVERFLOW = 2 * POSTGRES_POOL_SIZE
KEYCLOAK_URL = "http://keycloak:8080/auth/realms/obs-dev/"
KEYCLOAK_CLIENT_ID = "portal"
KEYCLOAK_CLIENT_SECRET = "iHV2YWbdXWsVViJ0HKVYwbJkW8gNqdX2"
DEDICATED_WORKER = True
API_URL = "http://localhost:3000/"
FRONTEND_URL = "http://localhost:3001/"
FRONTEND_HTTPS = False
FRONTEND_DIR = None
FRONTEND_CONFIG = {
    "imprintUrl": "https://example.com/imprint",
    "privacyPolicyUrl": "https://example.com/privacy",
    "mapHome": {"zoom": 6, "longitude": 10.2, "latitude": 51.3},
    # "banner": {"text": "This is a development installation.", "style": "info"},
}

TILES_FILE = None  # "/tiles/tiles.mbtiles"
DATA_DIR = "/data"
ADDITIONAL_CORS_ORIGINS = [
    "http://localhost:8880/",  # for maputnik on 8880
    "http://localhost:8888/",  # for maputnik on 8888
]

# vim: set ft=python :
