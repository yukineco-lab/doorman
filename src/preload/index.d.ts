import { ElectronAPI } from '@electron-toolkit/preload'
import type { DoormanAPI } from '../shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: DoormanAPI
  }
}
