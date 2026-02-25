import { Route, Routes } from 'react-router-dom'
import './App.css'
import Landing from './pages/Landing.jsx'
import Multiplayer from './pages/Multiplayer.jsx'
import Board from './pages/Board.jsx'
import SelectArmy from './pages/SelectArmy.jsx'
import SetUpBattle from './pages/SetUpBattle.jsx'
import UnitSelection from './pages/UnitSelection.jsx'
import EquipmentSelection from './pages/EquipmentSelection.jsx'
import SelectTacOps from './pages/SelectTacOps.jsx'
import SetUpOperatives from './pages/SetUpOperatives.jsx'
import Scouting from './pages/Scouting.jsx'
import SelectPrimaryOp from './pages/SelectPrimaryOp.jsx'
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
        <Route path="/set-up-the-battle" element={<SetUpBattle />} />
        <Route
          path="/select-army/:killteamId/units"
          element={<UnitSelection />}
        />
        <Route
          path="/select-army/:killteamId/equipment"
          element={<EquipmentSelection />}
        />
        <Route path="/select-tac-ops" element={<SelectTacOps />} />
        <Route path="/set-up-operatives" element={<SetUpOperatives />} />
        <Route path="/scouting" element={<Scouting />} />
        <Route path="/select-primary-op" element={<SelectPrimaryOp />} />
        <Route path="/game/:killteamId" element={<Game />} />
      </Routes>
    </SelectionProvider>
  )
}

export default App
