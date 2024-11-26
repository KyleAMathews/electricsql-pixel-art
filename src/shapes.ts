import { Shape, ShapeStreamOptions } from "@electric-sql/client";
import { Pixel, User } from "./types/schema";

export const pixelShape = (): ShapeStreamOptions => {
  return {
    url: `${import.meta.env.VITE_ELECTRIC_URL}/v1/shape`,
    table: "pixels",
    databaseId: import.meta.env.VITE_DATABASE_ID,
    params: {
      token: import.meta.env.VITE_ELECTRIC_TOKEN,
    },
  };
};


export const userShape = (): ShapeStreamOptions => {
  return {
    url: `${import.meta.env.VITE_ELECTRIC_URL}/v1/shape`,
    table: "users",
    databaseId: import.meta.env.VITE_DATABASE_ID,
    params: {
      token: import.meta.env.VITE_ELECTRIC_TOKEN,
    },
  };
};

export type PixelShape = Shape<Pixel>;
export type UserShape = Shape<User>;
