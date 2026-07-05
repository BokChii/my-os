export type ItemType = "task" | "note" | "link" | "event" | "template";
export type ItemStatus = "inbox" | "active" | "done" | "archived";
export type ReadState = "unread" | "reading" | "read";

export interface Project {
  id: string;
  name: string;
  color: string | null;
  status: "active" | "paused" | "done";
  sort_order: number;
}

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  content: string | null;
  status: ItemStatus;
  priority: 0 | 1 | 2 | 3;
  project_id: string | null;
  tags: string[];
  due_date: string | null;
  start_at: string | null;
  end_at: string | null;
  reminder_at: string | null;
  focus_date: string | null;
  focus_rank: number | null;
  url: string | null;
  metadata: {
    title?: string;
    description?: string;
    image?: string;
    site_name?: string;
    read_state?: ReadState;
    summary?: string;
    variables?: string[];
  };
  is_favorite: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}