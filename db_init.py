from os import read
from sqlalchemy import DDL, event
from sqlalchemy.sql import text
from model.videos import *
from utils.utils import read_config
from connector.postgresql import SQLAlchemyConnector
from model.base import Base
import sqlalchemy_utils


def create_schema():
    event.listen(
        Base.metadata,
        "before_create",
        DDL(
            """
            CREATE SCHEMA IF NOT EXISTS moars;
            """
        ),
    )

def create_db(engine):
    if not sqlalchemy_utils.database_exists(engine.url):
        sqlalchemy_utils.create_database(engine.url)


if __name__ == "__main__":
    engine = SQLAlchemyConnector.get_instance().get_engine()
    create_db(engine)
    create_schema()
    Base.metadata.create_all(engine, checkfirst=True)
