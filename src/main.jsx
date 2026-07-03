import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { FinanceProvider } from './FinanceContext'
import { AuthGate } from './AuthContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthGate>
      <FinanceProvider>
        <App />
      </FinanceProvider>
    </AuthGate>
  </React.StrictMode>,
)