import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const SelectionContext = createContext(null)

const STORAGE_KEY = 'kt-selection-state'

const normalizeSelection = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value
  return Array.from(value)
}

function SelectionProvider({ children }) {
  const [selectedUnitsByTeam, setSelectedUnitsByTeam] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return {}
      const parsed = JSON.parse(stored)
      return parsed?.selectedUnitsByTeam ?? {}
    } catch (error) {
      console.warn('Failed to read selection storage.', error)
      return {}
    }
  })
  const [selectedEquipmentByTeam, setSelectedEquipmentByTeam] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return {}
      const parsed = JSON.parse(stored)
      return parsed?.selectedEquipmentByTeam ?? {}
    } catch (error) {
      console.warn('Failed to read selection storage.', error)
      return {}
    }
  })
  const [selectedWeaponsByTeam, setSelectedWeaponsByTeam] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return {}
      const parsed = JSON.parse(stored)
      return parsed?.selectedWeaponsByTeam ?? {}
    } catch (error) {
      console.warn('Failed to read selection storage.', error)
      return {}
    }
  })
  const [selectedTacOpsByTeam, setSelectedTacOpsByTeam] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return {}
      const parsed = JSON.parse(stored)
      return parsed?.selectedTacOpsByTeam ?? {}
    } catch (error) {
      console.warn('Failed to read selection storage.', error)
      return {}
    }
  })
  const [selectedPrimaryOpsByTeam, setSelectedPrimaryOpsByTeam] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return {}
      const parsed = JSON.parse(stored)
      return parsed?.selectedPrimaryOpsByTeam ?? {}
    } catch (error) {
      console.warn('Failed to read selection storage.', error)
      return {}
    }
  })
  const [legionaryMarksByTeam, setLegionaryMarksByTeam] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return {}
      const parsed = JSON.parse(stored)
      return parsed?.legionaryMarksByTeam ?? {}
    } catch (error) {
      console.warn('Failed to read selection storage.', error)
      return {}
    }
  })

  const setSelectedUnits = (killteamId, nextSelection) => {
    setSelectedUnitsByTeam((prev) => ({
      ...prev,
      [killteamId]: normalizeSelection(nextSelection),
    }))
  }

  const setSelectedEquipment = (killteamId, nextSelection) => {
    setSelectedEquipmentByTeam((prev) => ({
      ...prev,
      [killteamId]: normalizeSelection(nextSelection),
    }))
  }

  const setSelectedWeapons = (killteamId, unitKey, nextSelection) => {
    setSelectedWeaponsByTeam((prev) => {
      const currentTeam = prev[killteamId] ?? {}
      return {
        ...prev,
        [killteamId]: {
          ...currentTeam,
          [unitKey]: normalizeSelection(nextSelection),
        },
      }
    })
  }

  const setSelectedTacOp = (killteamId, nextSelection) => {
    setSelectedTacOpsByTeam((prev) => ({
      ...prev,
      [killteamId]: nextSelection ?? null,
    }))
  }

  const setSelectedPrimaryOp = (killteamId, nextSelection) => {
    setSelectedPrimaryOpsByTeam((prev) => ({
      ...prev,
      [killteamId]: nextSelection ?? null,
    }))
  }

  const setLegionaryMarks = (killteamId, nextMarks) => {
    setLegionaryMarksByTeam((prev) => {
      const current = prev[killteamId] ?? {}
      const resolved =
        typeof nextMarks === 'function' ? nextMarks(current) : nextMarks
      if (resolved === current) return prev
      return {
        ...prev,
        [killteamId]: resolved,
      }
    })
  }

  const value = useMemo(
    () => ({
      selectedUnitsByTeam,
      selectedEquipmentByTeam,
      selectedWeaponsByTeam,
      selectedTacOpsByTeam,
      selectedPrimaryOpsByTeam,
      setSelectedUnits,
      setSelectedEquipment,
      setSelectedWeapons,
      setSelectedTacOp,
      setSelectedPrimaryOp,
      legionaryMarksByTeam,
      setLegionaryMarks,
    }),
    [
      selectedUnitsByTeam,
      selectedEquipmentByTeam,
      selectedWeaponsByTeam,
      selectedTacOpsByTeam,
      selectedPrimaryOpsByTeam,
      legionaryMarksByTeam,
    ],
  )

  useEffect(() => {
    try {
      const payload = JSON.stringify({
        selectedUnitsByTeam,
        selectedEquipmentByTeam,
        selectedWeaponsByTeam,
        selectedTacOpsByTeam,
        selectedPrimaryOpsByTeam,
        legionaryMarksByTeam,
      })
      localStorage.setItem(STORAGE_KEY, payload)
    } catch (error) {
      console.warn('Failed to persist selection storage.', error)
    }
  }, [
    selectedUnitsByTeam,
    selectedEquipmentByTeam,
    selectedWeaponsByTeam,
    selectedTacOpsByTeam,
    selectedPrimaryOpsByTeam,
    legionaryMarksByTeam,
  ])

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  )
}

const useSelection = () => {
  const context = useContext(SelectionContext)
  if (!context) {
    throw new Error('useSelection must be used within a SelectionProvider')
  }
  return context
}

export { SelectionProvider, useSelection }
