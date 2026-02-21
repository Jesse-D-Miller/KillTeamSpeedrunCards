import { createContext, useContext, useMemo, useState } from 'react'

const SelectionContext = createContext(null)

const normalizeSelection = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value
  return Array.from(value)
}

function SelectionProvider({ children }) {
  const [selectedUnitsByTeam, setSelectedUnitsByTeam] = useState({})
  const [selectedEquipmentByTeam, setSelectedEquipmentByTeam] = useState({})

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
