import { API } from "../config";
import { SearchResult } from "../types";

export const search = async (query: string): Promise<SearchResult> => {
  const response = await fetch(`${API}/api/search/?query=${query}`);
  return response.json();
};
