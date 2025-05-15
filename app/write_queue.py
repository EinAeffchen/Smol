# write_queue.py
from asyncio import Queue
import asyncio


class WriteQueueManager:
    def __init__(self):
        self.queue = Queue()
        self.running = False

    def start(self):
        if not self.running:
            asyncio.create_task(self._worker())
            self.running = True

    async def _worker(self):
        while True:
            fn, args = await self.queue.get()
            try:
                await asyncio.to_thread(fn, *args)
            except Exception as e:
                print(f"[WriteQueue Error] {e}")
            self.queue.task_done()

    def submit(self, fn, *args):
        self.queue.put_nowait((fn, args))


# global singleton
write_queue = WriteQueueManager()
