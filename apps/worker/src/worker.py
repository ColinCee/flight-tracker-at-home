"""Cloudflare Worker entry point — bridges FastAPI app to Workers runtime."""

import os

from workers import WorkerEntrypoint

_ENV_KEYS = [
    "CORS_ORIGINS",
    "CACHE_TTL",
    "OPENSKY_CLIENT_ID",
    "OPENSKY_CLIENT_SECRET",
]

_app = None


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        import asgi

        global _app
        if _app is None:
            # Inject Cloudflare env vars into os.environ so existing
            # code using os.getenv() works unchanged.
            for key in _ENV_KEYS:
                val = getattr(self.env, key, None)
                if val is not None:
                    os.environ[key] = str(val)

            from src.app import create_app

            _app = create_app()

        return await asgi.fetch(_app, request.js_object, self.env)
