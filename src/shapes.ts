import { Shape } from '@electric-sql/client'
import { Pixel, User } from './types/schema'

export const pixelShape = () => {
  if (typeof window !== 'undefined') {
    return {
      url: new URL('/shape-proxy', window?.location.origin).href,
      table: 'pixels',
    }
  } else {
    return {
      url: 'http://localhost:3000/shape-proxy',
      table: 'pixels',
    }
  }
}

export const userShape = () => {
  if (typeof window !== 'undefined') {
    return {
      url: new URL('/shape-proxy', window?.location.origin).href,
      table: 'users',
    }
  } else {
    return {
      url: 'http://localhost:3000/shape-proxy',
      table: 'users',
    }
  }
}

export type PixelShape = Shape<Pixel>
export type UserShape = Shape<User>
