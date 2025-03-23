import { useState } from 'react'
import './App.css'
import FaceCapture from './components/FaceCapture'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div className='min-h-screen bg-black text-white'>
        <h2 className='text-3xl'> SKIBIDI BLOCKCHAIN</h2>
        <FaceCapture />
      </div>
    </>
  )
}

export default App
