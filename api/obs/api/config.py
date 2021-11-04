# Configure paths
config.API_ROOT_DIR = config.get("API_ROOT_DIR") or abspath(
    join(dirname(__file__), "..", "..")
)
config.DATA_DIR = config.get("DATA_DIR") or normpath(
    join(config.API_ROOT_DIR, "../data")
)
config.PROCESSING_DIR = config.get("PROCESSING_DIR") or join(
    config.DATA_DIR, "processing"
)
config.PROCESSING_OUTPUT_DIR = config.get("PROCESSING_OUTPUT_DIR") or join(
    config.DATA_DIR, "processing-output"
)
config.TRACKS_DIR = config.get("TRACKS_DIR") or join(config.DATA_DIR, "tracks")
config.OBS_FACE_CACHE_DIR = config.get("OBS_FACE_CACHE_DIR") or join(
    config.DATA_DIR, "obs-face-cache"
)
