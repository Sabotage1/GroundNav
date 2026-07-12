import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createDefaultState } from '../src/data/defaultState'
import type { AppState } from '../src/types'
import { touchState } from './domain'

type Mutator<T> = (state: AppState) => T

export class StateStore {
  private state: AppState = createDefaultState()
  private writeQueue = Promise.resolve()

  constructor(private readonly filePath: string) {}

  async init() {
    try {
      const saved = JSON.parse(await readFile(this.filePath, 'utf8')) as AppState
      this.state = {
        ...createDefaultState(),
        ...saved,
        vehicles: saved.vehicles ?? createDefaultState().vehicles,
        assignments: saved.assignments ?? [],
        holdingPoints: saved.holdingPoints ?? createDefaultState().holdingPoints,
        startupPoints: saved.startupPoints ?? createDefaultState().startupPoints,
        pushPresets: saved.pushPresets ?? createDefaultState().pushPresets,
        events: saved.events ?? []
      }
      this.state.vehicles = this.state.vehicles.map((vehicle) => ({ ...vehicle, connected: false }))
    } catch {
      await this.persist()
    }
    return this.snapshot()
  }

  snapshot(): AppState {
    return structuredClone(this.state)
  }

  async update<T>(mutator: Mutator<T>) {
    const result = mutator(this.state)
    touchState(this.state)
    await this.persist()
    return { result, state: this.snapshot() }
  }

  async reset() {
    this.state = createDefaultState()
    await this.persist()
    return this.snapshot()
  }

  private async persist() {
    const body = JSON.stringify(this.state, null, 2)
    const filePath = this.filePath
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(dirname(filePath), { recursive: true })
      const tempPath = `${filePath}.tmp`
      await writeFile(tempPath, body, 'utf8')
      await rename(tempPath, filePath)
    })
    return this.writeQueue
  }
}
