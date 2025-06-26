// frontend/src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'    // 这个导入要求 App.jsx 位于 frontend/src/App.jsx
import './App.css'      // 这个导入要求 App.css 位于 frontend/src/App.css

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
