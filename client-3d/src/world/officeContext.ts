import { createContext, useContext } from 'react'
import { getOffice, type OfficeData } from '../map/office'

// The office the 3D scenery draws: the one the game shows, or the draft in the editor's
// 3D preview (provided inside its <Canvas>).
export const OfficeContext = createContext<OfficeData | null>(null)

export const useOffice = () => useContext(OfficeContext) ?? getOffice()
