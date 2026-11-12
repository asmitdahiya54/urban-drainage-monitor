import os
from pathlib import Path
from functools import lru_cache

from dotenv import load_dotenv
from supabase import create_client, Client

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_FILE, override=True)

STORAGE_BUCKET = "community-event-photos"


@lru_cache(maxsize=1)
def get_supabase_storage() -> Client:
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        raise RuntimeError(
            f"Supabase credentials missing. Check: {ENV_FILE}"
        )

    return create_client(supabase_url, supabase_key)


if __name__ == "__main__":
    print("Environment file exists:", ENV_FILE.exists())
    print("URL loaded:", bool(os.getenv("SUPABASE_URL")))
    print("Secret loaded:", bool(os.getenv("SUPABASE_SERVICE_ROLE_KEY")))

    storage = get_supabase_storage()
    buckets = storage.storage.list_buckets()

    print("Supabase Storage connection successful!")

    for bucket in buckets:
        print(bucket.name)