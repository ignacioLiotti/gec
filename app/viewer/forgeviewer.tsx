'use client'
import { useEffect, useRef } from 'react'
import './forge.css'

declare global {
  interface Window { Autodesk: any }
}

export default function ForgeViewer({ urn }: { urn: string }) {
  const viewerDiv = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadScript = (src: string) =>
      new Promise<void>((resolve) => {
        const script = document.createElement('script')
        script.src = src
        script.onload = () => resolve()
        document.body.appendChild(script)
      })

    const initViewer = async () => {
      try {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.98.0/style.min.css'
        document.head.appendChild(link)

        await loadScript('https://developer.api.autodesk.com/modelderivative/v2/viewers/7.98.0/viewer3D.min.js')

        const response = await fetch('/api/aps/token')
        const data = await response.json()
        const options = { env: 'AutodeskProduction', accessToken: data.access_token }

        window.Autodesk.Viewing.Initializer(options, () => {
          const viewer = new window.Autodesk.Viewing.GuiViewer3D(viewerDiv.current)
          viewer.start()
          const documentId = `urn:${urn}`
          window.Autodesk.Viewing.Document.load(documentId, (doc: any) => {
            const defaultModel = doc.getRoot().getDefaultGeometry()
            viewer.loadDocumentNode(doc, defaultModel)
          })
        })
      } catch (error) {
        console.error('Error initializing viewer:', error)
      }
    }

    initViewer()
  }, [urn])

  return (
    <div className="forge-container">
      <div ref={viewerDiv} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}