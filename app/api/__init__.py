from .media import router as media
from .person import router as person
from .tasks import router as tasks
from .face import router as face
from .tags import router as tags
from .search import router as search
from .duplicates import router as duplicates

__all__ = ["media", "person", "tasks", "face", "tags", "search", "duplicates"]
