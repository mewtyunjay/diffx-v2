if (import.meta.env.DEV) {
  import("react-grab");
}

import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PierreDiffWorkerProvider } from './components/diff/PierreDiffWorkerProvider.tsx'

document.documentElement.classList.add('dark')
document.documentElement.style.colorScheme = 'dark'

createRoot(document.getElementById('root')!).render(
  <PierreDiffWorkerProvider>
    <App />
  </PierreDiffWorkerProvider>,
)
