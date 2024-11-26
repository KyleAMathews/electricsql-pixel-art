import { Row } from "@electric-sql/client";

export type User = {
  id: string;
  username: string;
  last_active: Date;
  pixels_placed: number;
  created_at: Date;
}

export type Pixel = Row & {
  x: number;
  y: number;
  color: string;
  user_id: string;
  last_updated: Date;
}

export interface DatabaseSchema {
  users: User;
  pixels: Pixel;
}
