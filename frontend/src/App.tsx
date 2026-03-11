import { useEffect, useState } from "react"

function App() {
  const [msg, setMsg] = useState("loading")

  useEffect(() => {
    fetch("http://localhost:8080/api/hello")
      .then(res => res.json())
      .then(data => setMsg(data.message))
  }, [])

  return (
    <div>
      <h1>{msg}</h1>
    </div>
  )
}

export default App
