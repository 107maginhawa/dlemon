/**
 * Video Tile Component
 * Renders video element with MediaStream
 */

import { useEffect, useRef } from 'react'
import { cn } from '@monobase/ui/lib/utils'

interface VideoTileProps {
  stream: MediaStream | null
  muted?: boolean
  className?: string
  label?: string
}

export function VideoTile({ stream, muted = false, className, label }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return (
    <div className={cn('relative bg-gray-900 rounded-lg overflow-hidden', className)}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className="w-full h-full object-cover"
      />
      {label && (
        <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
          {label}
        </div>
      )}
      {!stream && (
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <div className="text-center">
            <div className="text-gray-400">No video</div>
          </div>
        </div>
      )}
    </div>
  )
}
