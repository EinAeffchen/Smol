import { API } from "../config";
import { Task } from "../types";

export const getTask = async (task_id: string): Promise<Task> => {
  const response = await fetch(`${API}/api/tasks/${task_id}`);
  return response.json();
};
