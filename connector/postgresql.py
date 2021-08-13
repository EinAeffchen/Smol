from contextlib import contextmanager
from pathlib import Path

import sqlalchemy.orm
from utils.utils import read_config
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool


class PostgresqlConnector:
    def __init__(self) -> None:
        self.engine = None
        self.session_factory = None
        self.Session = None

    def __get_uri_by_config(self):
        db_config = read_config()["database"]
        return f"postgresql://{db_config.get('user', 'postgres')}:{db_config.get('password', '')}@{db_config.get('host', 'postgresql')}:{db_config.get('port', 5432)}/fapflix"

    def __setup_environment(self):
        self.engine = create_engine(self.__get_uri_by_config(), poolclass=NullPool)
        self.session_factory = sqlalchemy.orm.sessionmaker(bind=self.engine)
        self.Session = sqlalchemy.orm.scoped_session(self.session_factory)

    def get_engine(self):
        if not self.engine:
            self.__setup_environment()
        return self.engine

    def __get_session_class(self):
        if not self.Session:
            self.__setup_environment()
        return self.Session

    @contextmanager
    def get_database_session(self) -> sqlalchemy.orm.session.Session:
        Session = self.__get_session_class()

        session = Session()
        try:
            yield session
            session.commit()
        except:
            session.rollback()
            raise
        finally:
            Session.remove()


class SQLAlchemyConnector:
    instance = None

    @classmethod
    def setup_openfaas(cls):
        cls.instance = PostgresqlConnector()

    @classmethod
    def get_instance(
        cls,
    ) -> PostgresqlConnector:
        if not cls.instance:
            # default to OpenFaaS implementation
            cls.setup_openfaas()
        return cls.instance
