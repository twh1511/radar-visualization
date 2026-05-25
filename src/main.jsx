import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { installRoslibMock } from './mockRoslib'

if (typeof window !== 'undefined' && window.location.search.includes('mockRos=1')) {
  installRoslibMock()
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
