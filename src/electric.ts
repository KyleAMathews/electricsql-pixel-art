import { createClient } from '@electric-sql/client'
import { ElectricDatabase, electrify } from '@electric-sql/client'
import { genUUID } from '@electric-sql/client'
import { DatabaseSchema } from './types/schema'

let electric: ElectricDatabase<DatabaseSchema>

export async function initElectric() {
  if (electric) return electric

  const config = {
    url: 'ws://localhost:3000',
    debug: true,
  }

  const { tabId } = await createClient(config)
  electric = await electrify<DatabaseSchema>(config, tabId)
  return electric
}

export function useElectric() {
  if (!electric) {
    throw new Error('Electric not initialized. Call initElectric() first.')
  }
  return electric
}

export const generateUserId = () => genUUID()
