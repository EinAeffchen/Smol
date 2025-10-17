import os
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, event, pool

from alembic import context
from app.config import settings
from app.models import SQLModel

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Ensure Alembic targets the same database URL as the running application.
config.set_main_option("sqlalchemy.url", settings.general.database_url)

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    # Preserve existing application loggers so Alembic migrations don't disable them
    fileConfig(
        config.config_file_name,
        disable_existing_loggers=False,
    )

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
target_metadata = SQLModel.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.
    ...
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    # --- ADD THIS ENTIRE BLOCK ---
    # This event listener will run for every new connection.
    @event.listens_for(connectable, "connect")
    def _load_vec_extension(dbapi_connection, connection_record):
        """
        Ensure the sqlite-vec extension is loaded for every Alembic connection.

        Tries, in order:
        1) Load from SQLITE_VEC_PATH as-is
        2) Retry without platform suffix to avoid double-extension issues
        3) Fallback: import sqlite_vec and call sqlite_vec.load(...)
        """
        # Establish a candidate path in frozen mode, preferring actual filenames in _MEIPASS
        vec_path = os.environ.get("SQLITE_VEC_PATH")
        if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
            base = Path(sys._MEIPASS)
            if not vec_path or not Path(vec_path).exists():
                candidates = []
                try:
                    for pat in ("vec0*.dll", "vec0*.so", "vec0*.dylib"):
                        candidates += list(base.glob(pat))
                except Exception:
                    candidates = []
                if candidates:
                    vec_path = str(candidates[0])
                    os.environ["SQLITE_VEC_PATH"] = vec_path
                else:
                    # Fallback to conventional name
                    vec_name = {
                        "win32": "vec0.dll",
                        "cygwin": "vec0.dll",
                        "darwin": "vec0.dylib",
                    }.get(sys.platform, "vec0.so")
                    vec_path = str(base / vec_name)
                    os.environ.setdefault("SQLITE_VEC_PATH", vec_path)

        def _strip_suffix(p: str) -> str:
            for suf in (".so", ".dylib", ".dll"):
                if p.lower().endswith(suf):
                    return p[: -len(suf)]
            return p

        dbapi_connection.enable_load_extension(True)
        try:
            tried = []
            if vec_path:
                # 1) try as provided
                tried.append(vec_path)
                try:
                    dbapi_connection.load_extension(vec_path)
                    return
                except Exception:
                    pass

                # 2) try without suffix to avoid double-extension behavior
                alt = _strip_suffix(vec_path)
                if alt != vec_path:
                    tried.append(alt)
                    try:
                        dbapi_connection.load_extension(alt)
                        return
                    except Exception:
                        pass

            # 3) fallback: try python package helper
            try:
                import sqlite_vec  # type: ignore

                sqlite_vec.load(dbapi_connection)
                return
            except Exception as e:
                raise RuntimeError(
                    f"Failed to load sqlite-vec extension. Tried: {tried}. Error: {e}"
                )
        finally:
            # Disable again for security
            try:
                dbapi_connection.enable_load_extension(False)
            except Exception:
                pass

    # --- END OF BLOCK TO ADD ---

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
