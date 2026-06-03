import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@fontsource/noto-sans-lao/lao-400.css'
import '@fontsource/noto-sans-lao/lao-500.css'
import '@fontsource/noto-sans-lao/lao-600.css'
import '@fontsource/noto-sans-lao/lao-700.css'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
