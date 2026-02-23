import { Route, Routes } from 'react-router-dom'
import './App.css'
import Landing from './pages/Landing.jsx'
import Multiplayer from './pages/Multiplayer.jsx'
import Board from './pages/Board.jsx'
import SelectArmy from './pages/SelectArmy.jsx'
import UnitSelection from './pages/UnitSelection.jsx'
import EquipmentSelection from './pages/EquipmentSelection.jsx'
import Game from './pages/Game.jsx'
import { SelectionProvider } from './state/SelectionContext.jsx'

function App() {
  return (
    <SelectionProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/multiplayer" element={<Multiplayer />} />
        <Route path="/board" element={<Board />} />
        <Route path="/select-army" element={<SelectArmy />} />
        <Route
          path="/select-army/:killteamId/units"
          element={<UnitSelection />}
        />
        <Route
          path="/select-army/:killteamId/equipment"
          element={<EquipmentSelection />}
        />
        <Route path="/game/:killteamId" element={<Game />} />
      </Routes>
    </SelectionProvider>
  )
}

export default App
