import { useEffect, useRef, useState } from 'react'
import { PALACE_LOCATIONS } from '../data/palaceMap'
import './palace-map.css'

export default function PalaceMap({ selectedLabel, onSelect, availableLabels = [] }) {
  const [layer, setLayer] = useState('buildings')
  const [zoom, setZoom] = useState(1)
  const viewport = useRef(null)
  const [viewportSize, setViewportSize] = useState({ width: 640, height: 400 })
  const fittedWidth = Math.min(viewportSize.width, viewportSize.height * 3372 / 2173)
  const canvasWidth = Math.max(1, fittedWidth * zoom)
  const canvasHeight = canvasWidth * 2173 / 3372
  const selectedPoint = PALACE_LOCATIONS.find((point) => point.label === selectedLabel)
  const visibleLayer = selectedPoint?.layer || layer
  const [layerOverride, setLayerOverride] = useState(null)
  const activeLayer = layerOverride?.selected === selectedLabel ? layerOverride.layer : visibleLayer

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setViewportSize({ width: Math.max(1, width), height: Math.max(1, height) })
    })
    observer.observe(viewport.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const container = viewport.current
    if (!container || selectedPoint?.layer !== activeLayer) return
    container.scrollTo({ left: zoom === 1 ? 0 : canvasWidth * selectedPoint.x / 100 - container.clientWidth / 2,
      top: zoom === 1 ? 0 : canvasHeight * selectedPoint.y / 100 - container.clientHeight / 2, behavior: 'auto' })
  }, [selectedPoint, activeLayer, zoom, canvasWidth, canvasHeight])

  function switchLayer(next) {
    setLayer(next)
    setLayerOverride({ selected: selectedLabel, layer: next })
  }

  return (
    <section className="palace-map" aria-label="แผนที่พระราชวังหลัวอัน">
      <div className="palace-map-toolbar">
        <div className="palace-map-tabs" aria-label="ประเภทแผนที่">
          <button type="button" aria-pressed={activeLayer === 'buildings'} onClick={() => switchLayer('buildings')}>ตำหนักและอาคาร</button>
          <button type="button" aria-pressed={activeLayer === 'gates'} onClick={() => switchLayer('gates')}>ประตูและป้อม</button>
        </div>
        <div className="palace-map-zoom">
          <button type="button" aria-label="ย่อแผนที่" disabled={zoom === 1} onClick={() => setZoom(Math.max(1, zoom - 0.5))}>−</button>
          <button type="button" aria-label="แสดงแผนที่เต็มภาพ" onClick={() => setZoom(1)}>{zoom === 1 ? 'พอดีกรอบ' : `${zoom * 100}%`}</button>
          <button type="button" aria-label="ขยายแผนที่" disabled={zoom === 3} onClick={() => setZoom(Math.min(3, zoom + 0.5))}>+</button>
        </div>
      </div>
      <div ref={viewport} className="palace-map-scroll" tabIndex="0" role="region" aria-label="เลื่อนดูแผนที่ หรือเลือกสถานที่จากรายการด้านข้าง">
        <div className="palace-map-stage" style={{ width: Math.max(viewportSize.width, canvasWidth), height: Math.max(viewportSize.height, canvasHeight) }}>
        <div className="palace-map-canvas" style={{ width: canvasWidth, '--map-pin-size': `${Math.max(18, Math.min(30, canvasWidth / 30))}px` }}>
          <img
            src={`${import.meta.env.BASE_URL}maps/palace-${activeLayer}.png`}
            alt={activeLayer === 'buildings' ? 'ผังตำหนักและอาคาร หมายเลข 1 ถึง 32 โดยตำหนัก 6 แบ่งเป็น 6.1 ถึง 6.4' : 'ผังประตูและป้อม A ถึง M'}
            width="3372" height="2173" draggable="false"
          />
          {PALACE_LOCATIONS.filter((point) => point.layer === activeLayer).map((point) => (
            <button
              key={point.label} type="button"
              className={`palace-map-pin ${availableLabels.includes(point.label) ? 'available' : ''} ${selectedLabel === point.label ? 'selected' : ''}`}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              aria-label={`${point.label} ${point.name}`}
              aria-pressed={selectedLabel === point.label}
              title={`${point.label} · ${point.name}`}
              onClick={() => onSelect(point.label)}
            >{point.label}</button>
          ))}
        </div>
        </div>
      </div>
      <div className="palace-map-legend"><span>● สีเขียว: มีคนที่ไปได้</span><span>● สีทอง: จุดที่เลือก</span><span>คลิกหมายเลขเพื่อดูรายละเอียด · ขยายแล้วเลื่อนดูได้</span></div>
    </section>
  )
}
