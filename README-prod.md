*HINT: This is still work in progress*

# Use Docker in Production

1) Clone the repo as described in the [README.md](README.md)

2) Configure the port in the `docker-compose-prod.yaml`:

```bash
...
- '3001:80'
...
```

3) Copy and edit the `config.json` (set the domain and previously selected port):

```bash
cp frontend/src/config.dev.json frontend/src/config.json
nano frontend/src/config.json
```

3) Build and run the container

```bash
docker-compose -f docker-compose-prod.yaml up --build
```

4) Test the frontend

The frontend should be available under your configured domain and port.
