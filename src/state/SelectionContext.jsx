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

  const value = useMemo(
    () => ({
      selectedUnitsByTeam,
      selectedEquipmentByTeam,
      setSelectedUnits,
      setSelectedEquipment,
    }),
    [selectedUnitsByTeam, selectedEquipmentByTeam],
  )

  useEffect(() => {
    try {
      const payload = JSON.stringify({
        selectedUnitsByTeam,
        selectedEquipmentByTeam,
      })
      localStorage.setItem(STORAGE_KEY, payload)
    } catch (error) {
      console.warn('Failed to persist selection storage.', error)
    }
  }, [selectedUnitsByTeam, selectedEquipmentByTeam])

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
