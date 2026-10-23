"""Reel rendering worker. Rendering logic comes in a later task."""

from core.config import get_settings


def main() -> None:
    settings = get_settings()
    print(f"Worker ready. Supabase: {settings.supabase_url}")


if __name__ == "__main__":
    main()
