from fastapi import FastAPI

app = FastAPI(title="Flight Tracker at Home API")


@app.get("/health")
async def health():
    return {"status": "ok"}
