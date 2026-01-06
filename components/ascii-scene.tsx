"use client"

import { useState, useEffect, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { EffectComposer } from "@react-three/postprocessing"
import { OrbitControls } from "@react-three/drei"
import { Vector2, Mesh } from "three"
import { DitherEffect } from "./dither-effect"

function RotatingTorusKnot() {
  const meshRef = useRef<Mesh>(null)

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.3
      meshRef.current.rotation.y += delta * 0.5
    }
  })

  return (
    <mesh ref={meshRef} scale={1}>
      <torusKnotGeometry args={[0.8, 0.3, 100, 16]} />
      <meshStandardMaterial color="#f37f59" roughness={0.3} metalness={0.1} />
    </mesh>
  )
}

export function AsciiScene() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [resolution, setResolution] = useState(new Vector2(1920, 1080))

  // Track resolution for effect
  useEffect(() => {
    const container = containerRef.current
    if (container) {
      // Set initial resolution
      const rect = container.getBoundingClientRect()
      setResolution(new Vector2(rect.width, rect.height))

      // Update resolution on resize
      const handleResize = () => {
        const rect = container.getBoundingClientRect()
        setResolution(new Vector2(rect.width, rect.height))
      }
      window.addEventListener("resize", handleResize)

      return () => {
        window.removeEventListener("resize", handleResize)
      }
    }
  }, [])

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }} className="h-full w-full">
      <Canvas
        camera={{ position: [0, 0, 3], fov: 50 }}
        style={{ background: "#808080" }}
      >
        <color attach="background" args={["#808080"]} />


        {/* Lighting */}
        <hemisphereLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={2} />
        <directionalLight position={[-5, 3, -5]} intensity={1.2} />

        {/* 3D Model */}
        <RotatingTorusKnot />

        <OrbitControls enableDamping enableZoom={true} />


        {/* Dither Effect */}
        <EffectComposer>
          <DitherEffect
            intensity={1}
            color1="#000000"
            color2="#ffffff"
            brightness={0.4}
            contrast={1}
            pixelSize={1.5}
            colorSteps={1}
            gamma={1}
            resolution={resolution}
          />
        </EffectComposer>
      </Canvas>
    </div>
  )
}