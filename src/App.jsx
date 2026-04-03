import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import Navigation from './components/Navigation'
import RadarView from './views/RadarView'
import NotesView from './views/NotesView'
import UniverseView from './views/UniverseView'
import SettingsView from './views/SettingsView'

export default function App() {
  return (
    <AppProvider>
      <Router>
        <div className="flex flex-col h-screen overflow-hidden bg-[#0a0f0a]">
          <Navigation />
          <main className="flex-1 overflow-hidden relative">
            <Routes>
              <Route path="/"         element={<RadarView />} />
              <Route path="/notes"    element={<NotesView />} />
              <Route path="/universe" element={<UniverseView />} />
              <Route path="/settings" element={<SettingsView />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AppProvider>
  )
}
