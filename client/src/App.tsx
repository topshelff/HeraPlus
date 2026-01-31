import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { BiometricProvider } from './context/BiometricContext'
import { SessionProvider } from './context/SessionContext'
import IntakePage from './pages/IntakePage'
import DiagnosticSessionPage from './pages/DiagnosticSessionPage'
import ValidationReportPage from './pages/ValidationReportPage'

function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <BiometricProvider>
          <SessionProvider>
            <div className="min-h-screen bg-neutral-50">
              <Routes>
                <Route path="/" element={<IntakePage />} />
                <Route path="/diagnostic" element={<DiagnosticSessionPage />} />
                <Route path="/report" element={<ValidationReportPage />} />
              </Routes>
            </div>
          </SessionProvider>
        </BiometricProvider>
      </AppProvider>
    </BrowserRouter>
  )
}

export default App
