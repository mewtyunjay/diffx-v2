import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyAppConfig } from './app-config.ts'
import { PierreDiffWorkerProvider } from './components/diff/PierreDiffWorkerProvider.tsx'

document.documentElement.classList.add('dark')
document.documentElement.style.colorScheme = 'dark'

void applyAppConfig().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <PierreDiffWorkerProvider>
      <App />
    </PierreDiffWorkerProvider>,
  )
})
