import { API } from "../config";
import { Task, TaskType } from "../types";

export const getActiveTasks = async (): Promise<Task[]> => {
  const res = await fetch(`${API}/api/tasks/active`);
  if (!res.ok) throw new Error("Failed to fetch active tasks");
  return res.json();
};

export const startTask = async (type: TaskType): Promise<void> => {
  const res = await fetch(`${API}/api/tasks/${type}`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to start task ${type}`);
};

export const cancelTask = async (id: string): Promise<void> => {
  const res = await fetch(`${API}/api/tasks/${id}/cancel`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to cancel task ${id}`);
};
