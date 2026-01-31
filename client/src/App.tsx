import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AppProvider } from './context/AppContext'
import { BiometricProvider } from './context/BiometricContext'
import { SessionProvider } from './context/SessionContext'
import ProtectedRoute from './components/common/ProtectedRoute'
import AuthPage from './pages/AuthPage'
import IntakePage from './pages/IntakePage'
import ValidationReportPage from './pages/ValidationReportPage'
import HistoryPage from './pages/HistoryPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <BiometricProvider>
            <SessionProvider>
              <div className="min-h-screen bg-neutral-50">
                <Routes>
                  <Route path="/auth" element={<AuthPage />} />
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <IntakePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/report"
                    element={
                      <ProtectedRoute>
                        <ValidationReportPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/history"
                    element={
                      <ProtectedRoute>
                        <HistoryPage />
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </div>
            </SessionProvider>
          </BiometricProvider>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
