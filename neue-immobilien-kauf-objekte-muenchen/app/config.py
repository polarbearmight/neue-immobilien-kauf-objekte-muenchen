from pydantic import BaseModel
import os


class Settings(BaseModel):
    db_url: str = os.getenv("DB_URL", "sqlite:///./local.db")
    user_agent: str = os.getenv(
        "SCRAPER_UA",
        "Mozilla/5.0 (compatible; OpenClaw-ResearchBot/1.0; +https://github.com/polarbearmight)",
    )
    request_delay_seconds: float = float(os.getenv("REQUEST_DELAY_SECONDS", "10"))


settings = Settings()
