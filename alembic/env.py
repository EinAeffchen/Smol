import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, event, pool

from alembic import context
from app.models import SQLModel
from app.config import settings

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

config.set_main_option(
    "sqlalchemy.url",
    f"sqlite:///{settings.general.data_dir}/database/smol.db?cache=shared&mode=rwc&_journal_mode=WAL&_synchronous=NORMAL",
)

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

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
        Ensures that the sqlite-vec extension is loaded for every connection
        that Alembic makes to the database.
        """
        # The path to the extension must be provided via an environment variable
        vec_path = os.environ.get("SQLITE_VEC_PATH")
        if not vec_path:
            raise RuntimeError(
                "SQLITE_VEC_PATH environment variable not set. "
                "Cannot load sqlite-vec extension for Alembic."
            )

        # In Python 3, the dbapi_connection is a 'sqlite3.Connection' object
        dbapi_connection.enable_load_extension(True)
        dbapi_connection.load_extension(vec_path)
        dbapi_connection.enable_load_extension(
            False
        )  # Disable again for security

    # --- END OF BLOCK TO ADD ---

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
