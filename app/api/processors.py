from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlmodel import Session
from app.models import Media, ProcessingTask
from app.database import engine, get_session
from app.processor_registry import load_processors
from datetime import datetime, timezone
from app.config import MEDIA_DIR, READ_ONLY
from app.logger import logger
import subprocess
import ffmpeg

router = APIRouter()


@router.get("/media/{media_id}/processors", summary="List all processors")
def list_processors():
    return [p.name for p in load_processors()]


@router.get(
    "/media/{media_id}/processors/{processor_name}",
    summary="Get a processor’s output",
)
def get_processor(
    media_id: int,
    processor_name: str,
    session: Session = Depends(get_session),
):
    for p in load_processors():
        if p.name == processor_name:
            return p.get_results(media_id, session)
    raise HTTPException(404, f"Processor {processor_name} not found")


@router.post(
    "/media/{media_id}/converter",
    summary="Converts video to web compatible format",
)
def start_conversion(
    media_id: int,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    if READ_ONLY:
        return HTTPException(
            status_code=403, detail="Not allowed in READ_ONLY mode."
        )
    media = session.get(Media, media_id)
    if not media:
        raise HTTPException(404, "Media not found")
    task = ProcessingTask(
        task_type="convert",
        status="pending",
        total=100,  # we’ll treat this as a percentage 0–100
        processed=0,
        created_at=datetime.now(timezone.utc),
    )
    session.add(task)
    session.commit()
    session.refresh(task)
    background_tasks.add_task(
        _run_conversion, task.id, str(media.path), media.id
    )
    return task


def _run_conversion(task_id: str, media_path: str, media_id: int):
    with Session(engine) as session:
        task: ProcessingTask = session.get(ProcessingTask, task_id)
        task.status = "running"
        task.started_at = datetime.now(timezone.utc)
        session.add(task)
        session.commit()
        full_path = MEDIA_DIR / media_path
        temp_output_path = full_path.with_name(full_path.stem + "_temp.mp4")
        try:
            info = ffmpeg.probe(str(full_path))
        except ffmpeg.Error as e:
            logger.error("stdout: %s", e.stdout.decode("utf8"))
            logger.error("stderr: %s", e.stderr.decode("utf8"))
            raise
        dur_s = float(info["format"]["duration"])
        dur_us = dur_s * 1000000
        # run ffmpeg with stderr piped so we can parse “progress=…”
        # Here’s one way using the “-progress” flag:
        cmd = [
            "ffmpeg",
            "-i",
            full_path,
            "-movflags",
            "use_metadata_tags",
            "-c:v",
            "libx264",
            "-c:a",
            "aac",
            "-preset",
            "fast",
            "-progress",
            "pipe:1",  # emits key=value pairs on stdout
            "-nostats",
            "-filter:v",
            "fps=30",
            "-y",
            temp_output_path,
        ]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, text=True)

        for line in proc.stdout:
            # ffmpeg -progress emits lines like "out_time_ms=1234567" etc.
            if line.startswith("out_time_ms="):
                out_us: str = line.split("=")[1].strip()
                if out_us.isnumeric():
                    out_us = int(out_us)
                else:
                    continue
                pct = min(100, int(out_us / dur_us * 100))
                task.processed = pct
                session.add(task)
                session.commit()
            if line.startswith("progress=end"):
                break

        proc.wait()
        task.processed = 100
        task.status = "completed"
        task.finished_at = datetime.now(timezone.utc)
        new_file = temp_output_path.rename(full_path)
        media = session.get(Media, media_id)
        media.path = str(new_file.relative_to(MEDIA_DIR))
        media.filename = new_file.name
        session.add(media)
        if new_file.exists():
            full_path.unlink()
        session.add(task)
        session.commit()
