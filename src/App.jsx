import React, { useRef, useState, useEffect } from 'react'
import axios from 'axios'
import { solveTSP } from './tsp.js'

const SERVER = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const IS_DEMO = import.meta.env.VITE_DEPLOY_MODE === 'demo'

export default function App(){
  const [map, setMap] = useState(null) // {mapId,imageUrl,width,height,units}
  const [units, setUnits] = useState([])
  const [inputList, setInputList] = useState('')
  const [route, setRoute] = useState(null)
  const [unitStates, setUnitStates] = useState({}) // {unitNumber: 'blue'|'red'|'green'}
  const [activeTab, setActiveTab] = useState('main') // 'main' | 'map'
  const [rotation, setRotation] = useState(0) // 0, 90, 180, 270 degrees
  const [zoom, setZoom] = useState(1) // zoom scale
  const [pan, setPan] = useState({x: 0, y: 0}) // pan offset
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({x: 0, y: 0})
  const [highlightedUnit, setHighlightedUnit] = useState(null) // highlighted unit from list
  const [editingUnit, setEditingUnit] = useState(null) // unit being edited
  const [editValue, setEditValue] = useState('') // edit input value
  const [selectedUnits, setSelectedUnits] = useState(new Set()) // multi-selected units
  const [leftPanelVisible, setLeftPanelVisible] = useState(true) // left panel visibility
  const [scrollY, setScrollY] = useState(0) // scroll position for animations
  const imgRef = useRef()
  const containerRef = useRef()
  const leftPanelRef = useRef()

  // Load map from URL on component mount
  useEffect(() => {
    const urlPath = window.location.pathname;
    const mapIdMatch = urlPath.match(/\/maps\/(.+)/);
    if (mapIdMatch) {
      const mapId = mapIdMatch[1];
      loadMapById(mapId);
    }
  }, []);

  // upload map image
  async function uploadMap(e){
    if (IS_DEMO) {
      alert('Upload disabled in demo mode. Use the existing map.');
      return;
    }
    const file = e.target.files[0];
    if (!file) return;
    const form = new FormData();
    form.append('map', file);
    const res = await axios.post(`${SERVER}/maps`, form, { headers: {'Content-Type':'multipart/form-data'} });
    setMap(res.data);
    setUnits(res.data.units || []);
    // Update URL with new mapId
    window.history.pushState({}, '', `/maps/${res.data.mapId}`);
  }

  // clicking on map to add a unit marker
  function onMapClick(e){
    if (!map) return;
    const img = imgRef.current;
    const rect = img.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const newUnit = prompt('Enter unit number (e.g. 1525)');
    if (!newUnit) return;
    const u = { unit: newUnit.trim(), x: Number(x.toFixed(4)), y: Number(y.toFixed(4)), floor: 0 };
    const updated = [...units, u];
    setUnits(updated);
    saveUnitsToServer(updated);
  }

  // clicking on unit label to cycle through colors: blue -> red -> green -> blue
  function onUnitClick(unitNumber, e){
    e.stopPropagation();
    const currentState = unitStates[unitNumber] || 'blue';
    let nextState;
    
    if (currentState === 'blue') {
      nextState = 'red';
      // Add to input list when going from blue to red
      const currentUnits = inputList.split(',').map(s=>s.trim()).filter(Boolean);
      if (!currentUnits.includes(unitNumber)) {
        const newList = currentUnits.length > 0 ? `${inputList}, ${unitNumber}` : unitNumber;
        setInputList(newList);
      }
    } else if (currentState === 'red') {
      nextState = 'green';
    } else {
      nextState = 'blue';
      // Remove from input list when going from green to blue
      const currentUnits = inputList.split(',').map(s=>s.trim()).filter(Boolean);
      const updatedUnits = currentUnits.filter(u => u !== unitNumber);
      setInputList(updatedUnits.join(', '));
    }
    
    setUnitStates(prev => ({
      ...prev,
      [unitNumber]: nextState
    }));
  }

  // double-click on unit label to edit unit number
  function onUnitDoubleClick(unitNumber, e){
    e.stopPropagation();
    const newUnitNumber = prompt('Enter new unit number:', unitNumber);
    if (!newUnitNumber || newUnitNumber === unitNumber) return;
    
    // Update the unit in the units array
    const updatedUnits = units.map(u => 
      u.unit === unitNumber ? { ...u, unit: newUnitNumber.trim() } : u
    );
    setUnits(updatedUnits);
    saveUnitsToServer(updatedUnits);
    
    // Update unit states if the old unit had a state
    if (unitStates[unitNumber]) {
      setUnitStates(prev => {
        const newStates = { ...prev };
        newStates[newUnitNumber.trim()] = prev[unitNumber];
        delete newStates[unitNumber];
        return newStates;
      });
    }
    
    // Update input list if the unit was in it
    const currentUnits = inputList.split(',').map(s=>s.trim()).filter(Boolean);
    if (currentUnits.includes(unitNumber)) {
      const updatedInputUnits = currentUnits.map(u => u === unitNumber ? newUnitNumber.trim() : u);
      setInputList(updatedInputUnits.join(', '));
    }
  }

  async function saveUnitsToServer(updated){
    if (!map || IS_DEMO) { setUnits(updated); return; }
    try {
      await axios.post(`${SERVER}/maps/${map.mapId}/units`, { units: updated });
      setUnits(updated);
    } catch (error) {
      // In case of server error, still update local state
      setUnits(updated);
    }
  }

  function sortUnitsAsc(){
    const sorted = [...units].sort((a, b) => a.unit.localeCompare(b.unit));
    setUnits(sorted);
    saveUnitsToServer(sorted);
  }

  function sortUnitsDesc(){
    const sorted = [...units].sort((a, b) => b.unit.localeCompare(a.unit));
    setUnits(sorted);
    saveUnitsToServer(sorted);
  }

  function addSelectedToRoute(){
    const selectedArray = Array.from(selectedUnits);
    const currentUnits = inputList.split(',').map(s=>s.trim()).filter(Boolean);
    const newUnits = [...new Set([...currentUnits, ...selectedArray])];
    setInputList(newUnits.join(', '));
    setSelectedUnits(new Set());
  }

  function toggleUnitSelection(unitNumber){
    const newSelected = new Set(selectedUnits);
    if (newSelected.has(unitNumber)) {
      newSelected.delete(unitNumber);
    } else {
      newSelected.add(unitNumber);
    }
    setSelectedUnits(newSelected);
  }

  async function computeRouteForSelected(){
    if (!map) return alert('Upload and mark a map first');
    const list = Array.from(selectedUnits);
    if (!list.length) return alert('Select some units first');
    
    if (IS_DEMO) {
      // Client-side route computation for demo mode
      const unitMap = {};
      for (const u of units) unitMap[u.unit] = u;
      const missing = list.filter(u => !unitMap[u]);
      if (missing.length) return alert(`Units not found: ${missing.join(', ')}`);
      
      const points = list.map(unitId => {
        const unit = unitMap[unitId];
        return { id: unit.unit, x: unit.x, y: unit.y, floor: unit.floor || 0 };
      });
      
      const { orderedIdx, length } = solveTSP(points, { floorPenalty: 0.02, returnToStart: false });
      const ordered = orderedIdx.map(i => points[i].id);
      const routePath = orderedIdx.map(i => ({ id: points[i].id, x: points[i].x, y: points[i].y }));
      
      setRoute({ route: ordered, length, path: routePath });
    } else {
      const body = { units: list, startUnit: list[0], returnToStart: false };
      try{
        const res = await axios.post(`${SERVER}/maps/${map.mapId}/route`, body);
        setRoute(res.data);
      }catch(err){
        alert(err.response?.data?.error || 'Route error');
      }
    }
  }

  function loadMapJson(){
    if (!map) return;
    const url = IS_DEMO ? `/demo/data/${map.mapId}.json` : `${SERVER}/maps/${map.mapId}`;
    axios.get(url).then(r=>{
      const mapData = r.data;
      // Fix image URL for demo mode
      if (IS_DEMO && mapData.imageUrl) {
        mapData.imageUrl = mapData.imageUrl.replace('/maps/', '/demo/data/');
      }
      setMap(mapData); setUnits(mapData.units || []);
    })
  }

  // Load map by ID (for URL-based loading)
  async function loadMapById(mapId){
    try {
      const url = IS_DEMO ? `/demo/data/${mapId}.json` : `${SERVER}/maps/${mapId}`;
      const res = await axios.get(url);
      const mapData = res.data;
      // Fix image URL for demo mode to use client-side static files
      if (IS_DEMO && mapData.imageUrl) {
        mapData.imageUrl = mapData.imageUrl.replace('/maps/', '/demo/data/');
      }
      setMap(mapData);
      setUnits(mapData.units || []);
      // Update URL without page reload
      window.history.pushState({}, '', `/maps/${mapId}`);
    } catch (error) {
      alert('Map not found: ' + mapId);
    }
  }

  useEffect(()=>{ if (map) loadMapJson() }, [map?.mapId])

  // Handle scroll for dynamic card animations
  useEffect(() => {
    const handleScroll = () => {
      if (leftPanelRef.current) {
        setScrollY(leftPanelRef.current.scrollTop);
      }
    };
    
    const panel = leftPanelRef.current;
    if (panel) {
      panel.addEventListener('scroll', handleScroll);
      return () => panel.removeEventListener('scroll', handleScroll);
    }
  }, [leftPanelVisible])

  function pixelPos(u){
    const img = imgRef.current;
    if (!img) return {x:0,y:0};
    return { x: u.x * img.naturalWidth, y: u.y * img.naturalHeight };
  }

  async function computeRoute(){
    if (!map) return alert('Upload and mark a map first');
    const list = inputList.split(',').map(s=>s.trim()).filter(Boolean);
    if (!list.length) return alert('Add some unit numbers in the list');
    
    if (IS_DEMO) {
      // Client-side route computation for demo mode
      const unitMap = {};
      for (const u of units) unitMap[u.unit] = u;
      const missing = list.filter(u => !unitMap[u]);
      if (missing.length) return alert(`Units not found: ${missing.join(', ')}`);
      
      const points = list.map(unitId => {
        const unit = unitMap[unitId];
        return { id: unit.unit, x: unit.x, y: unit.y, floor: unit.floor || 0 };
      });
      
      const { orderedIdx, length } = solveTSP(points, { floorPenalty: 0.02, returnToStart: false });
      const ordered = orderedIdx.map(i => points[i].id);
      const routePath = orderedIdx.map(i => ({ id: points[i].id, x: points[i].x, y: points[i].y }));
      
      setRoute({ route: ordered, length, path: routePath });
    } else {
      // Server-side route computation
      const body = { units: list, startUnit: list[0], returnToStart: false };
      try{
        const res = await axios.post(`${SERVER}/maps/${map.mapId}/route`, body);
        setRoute(res.data);
      }catch(err){
        alert(err.response?.data?.error || 'Route error');
      }
    }
    
    // Auto-navigate to Directory Map view on mobile after computing route
    if (window.innerWidth <= 768) {
      setActiveTab('map');
    }
  }

  function exportJSON(){
    const payload = { map, units };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${map?.mapId || 'map'}.json`; a.click();
  }

  // Rotation functions
  function rotateLeft(){
    setRotation(prev => (prev - 90 + 360) % 360);
  }

  function rotateRight(){
    setRotation(prev => (prev + 90) % 360);
  }

  // Zoom and pan functions
  function handleWheel(e){
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.5, Math.min(3, prev * delta)));
  }

  function handleTouchStart(e){
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      containerRef.current.initialDistance = distance;
      containerRef.current.initialZoom = zoom;
    }
  }

  function handleTouchMove(e){
    if (e.touches.length === 2 && containerRef.current.initialDistance) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      const scale = distance / containerRef.current.initialDistance;
      const newZoom = containerRef.current.initialZoom * scale;
      setZoom(Math.max(0.5, Math.min(3, newZoom)));
    }
  }

  // Pan functions
  function handleMouseDown(e){
    setIsDragging(true);
    setDragStart({x: e.clientX - pan.x, y: e.clientY - pan.y});
  }

  function handleMouseMove(e){
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }

  function handleMouseUp(){
    setIsDragging(false);
  }

  function handleTouchStartPan(e){
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({x: touch.clientX - pan.x, y: touch.clientY - pan.y});
    }
  }

  function handleTouchMovePan(e){
    if (e.touches.length === 1 && isDragging) {
      e.preventDefault();
      const touch = e.touches[0];
      setPan({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y
      });
    }
  }

  return (
    <div className="container-fluid h-100">
      {/* Tab Navigation */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary d-lg-none">
        <div className="container-fluid">
          <span className="navbar-brand mb-0 h1">🏬 Mall Route System</span>
          <div className="dropdown">
            <button className="btn btn-outline-light dropdown-toggle" type="button" data-bs-toggle="dropdown">
              {activeTab === 'main' ? '📋 Route Planner' : '🗺️ Directory Map'}
            </button>
            <ul className="dropdown-menu dropdown-menu-end">
              <li><button className={`dropdown-item ${activeTab === 'main' ? 'active' : ''}`} onClick={() => setActiveTab('main')}>📋 Route Planner</button></li>
              <li><button className={`dropdown-item ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}>🗺️ Directory Map</button></li>
            </ul>
          </div>
        </div>
      </nav>

      {/* Main Tab Content */}
      <div ref={leftPanelRef} className={`main-tab ${activeTab === 'main' ? 'd-block' : 'd-none'} ${!leftPanelVisible ? 'd-lg-none' : ''} p-4`}>
        <div className="d-flex flex-column">
          <div className="card mb-1 scroll-card" style={{transform: `translateY(${scrollY > 100 ? Math.max(-100, -scrollY * 0.2) : 0}px)`, zIndex: scrollY < 100 ? 10 : 1}}>
            <div className="card-header bg-success text-white">
              <h5 className="mb-0">📁 Upload Map</h5>
            </div>
            <div className="card-body">
              <label className="form-label">Upload directory map image</label>
              <input type="file" className="form-control" accept="image/*" onChange={uploadMap} />
              <div className="mt-3">
                <button className="btn btn-outline-primary btn-sm me-2" onClick={()=>{ if (map) exportJSON()}}>📤 Export JSON</button>
                <button className="btn btn-outline-secondary btn-sm" onClick={()=>{ if (map) loadMapJson()}}>🔄 Reload</button>
              </div>
            </div>
          </div>

          <div className="card mb-1 scroll-card" style={{transform: `translateY(${scrollY > 300 ? Math.max(-100, -(scrollY - 200) * 0.2) : scrollY < 100 ? Math.min(50, (100 - scrollY) * 0.3) : 0}px)`, zIndex: scrollY >= 100 && scrollY < 300 ? 10 : scrollY < 100 ? 5 : 1}}>
            <div className="card-header bg-info text-white">
              <div className="d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center">
                  <div className="d-flex flex-column me-2">
                    <button className="btn btn-outline-light btn-sm mb-1" style={{fontSize: '10px', padding: '2px 6px'}} onClick={sortUnitsAsc}>🔼</button>
                    <button className="btn btn-outline-light btn-sm" style={{fontSize: '10px', padding: '2px 6px'}} onClick={sortUnitsDesc}>🔽</button>
                  </div>
                  <h5 className="mb-0">📍 Units ({units.length}) {map && <small className="text-light">ID: {map.mapId}</small>}</h5>
                </div>
                {selectedUnits.size > 0 && (
                  <button className="btn btn-success btn-sm" onClick={addSelectedToRoute}>➕ Add ({selectedUnits.size})</button>
                )}
              </div>
            </div>
            <div className="card-body" style={{maxHeight: '300px', overflowY: 'auto'}}>
              {units.map((u,i)=> (
                <div 
                  className={`d-flex justify-content-between align-items-center p-2 mb-2 border rounded ${selectedUnits.has(u.unit) ? 'bg-primary text-white' : highlightedUnit === u.unit ? 'bg-warning' : 'bg-light'}`}
                  key={i}
                  onClick={() => { 
                    if (editingUnit !== u.unit) { 
                      setEditingUnit(null); 
                      setHighlightedUnit(highlightedUnit === u.unit ? null : u.unit);
                      toggleUnitSelection(u.unit);
                    } 
                  }}
                  onDoubleClick={() => { setEditingUnit(u.unit); setEditValue(u.unit); }}
                  style={{cursor: 'pointer'}}
                >
                  <div className="d-flex align-items-center">
                    <input 
                      type="checkbox" 
                      className="form-check-input me-2" 
                      checked={selectedUnits.has(u.unit)}
                      onChange={() => toggleUnitSelection(u.unit)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  {editingUnit === u.unit ? (
                    <input 
                      className="form-control form-control-sm fw-bold" 
                      style={{width: '120px', minWidth: '80px'}}
                      value={editValue} 
                      onChange={(e) => setEditValue(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <span className="fw-bold">{u.unit}</span>
                  )}
                  </div>
                  <div>
                    <button 
                      className="btn btn-outline-primary btn-sm me-1" 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (editingUnit === u.unit) {
                          // Confirm edit
                          const updatedUnits = units.map(unit => 
                            unit.unit === u.unit ? { ...unit, unit: editValue.trim() } : unit
                          );
                          setUnits(updatedUnits);
                          saveUnitsToServer(updatedUnits);
                          setEditingUnit(null);
                        } else {
                          // Start edit
                          setEditingUnit(u.unit);
                          setEditValue(u.unit);
                        }
                      }}
                    >
                      {editingUnit === u.unit ? '✅' : '✏️'}
                    </button>
                    <button className="btn btn-outline-danger btn-sm" onClick={(e) => { e.stopPropagation(); const upd = units.filter(x=>x!==u); setUnits(upd); saveUnitsToServer(upd); }}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card mb-1 scroll-card" style={{transform: `translateY(${scrollY > 500 ? Math.max(-100, -(scrollY - 400) * 0.2) : scrollY < 300 ? Math.min(50, (300 - scrollY) * 0.3) : 0}px)`, zIndex: scrollY >= 300 && scrollY < 500 ? 10 : scrollY < 300 ? 3 : 1}}>
            <div className="card-header bg-warning text-dark">
              <h5 className="mb-0">🏃‍♀️ Route Planning</h5>
            </div>
            <div className="card-body">
              <label className="form-label">Paste comma-separated unit list to route</label>
              <textarea className="form-control mb-3" rows={4} value={inputList} onChange={e=>setInputList(e.target.value)} placeholder="1010, 1050, 1150"></textarea>
              <button className="btn btn-success btn-lg" onClick={computeRoute}>🎯 Compute Route</button>
            </div>
          </div>

          <div className="card scroll-card" style={{transform: `translateY(${scrollY < 500 ? Math.min(50, (500 - scrollY) * 0.3) : 0}px)`, zIndex: scrollY >= 500 ? 10 : 2}}>
            <div className="card-header bg-secondary text-white">
              <h5 className="mb-0">🛤️ Route Result</h5>
            </div>
            <div className="card-body">
              {route ? (
                <div>
                  <div className="alert alert-success">
                    <strong>Length score:</strong> {Math.round(route.length*100)/100}
                  </div>
                  <ol className="list-group list-group-numbered">
                    {route.route.map((r,i)=> <li key={i} className="list-group-item">{r}</li>)}
                  </ol>
                </div>
              ) : <div className="text-muted">No route computed yet</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Vertical Toggle Bar */}
      <div className="d-none d-lg-block position-fixed" style={{left: leftPanelVisible ? '400px' : '20px', top: '50%', transform: 'translateY(-50%)', zIndex: 1001}}>
        <div 
          className="bg-secondary" 
          style={{width: '8px', height: '60px', borderRadius: '4px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '3px'}}
          onClick={() => setLeftPanelVisible(!leftPanelVisible)}
        >
          <div style={{width: '2px', height: '2px', backgroundColor: '#fff', borderRadius: '50%'}}></div>
          <div style={{width: '2px', height: '2px', backgroundColor: '#fff', borderRadius: '50%'}}></div>
          <div style={{width: '2px', height: '2px', backgroundColor: '#fff', borderRadius: '50%'}}></div>
          <div style={{width: '2px', height: '2px', backgroundColor: '#fff', borderRadius: '50%'}}></div>
          <div style={{width: '2px', height: '2px', backgroundColor: '#fff', borderRadius: '50%'}}></div>
        </div>
      </div>

      {/* Directory Map Tab Content */}
      <div className={`map-tab ${!map ? 'no-map' : ''} ${activeTab === 'map' ? 'd-block' : 'd-none'} position-relative`} style={{height: 'calc(100vh - 76px)'}}>
        {map ? (
          <div 
            ref={containerRef}
            className="w-100 h-100 position-relative d-flex justify-content-center align-items-center"
            style={{cursor: isDragging ? 'grabbing' : 'grab', overflow: zoom > 1 ? 'auto' : 'hidden', touchAction: 'none'}}
            onWheel={handleWheel}
            onTouchStart={(e) => {
              handleTouchStart(e);
              handleTouchStartPan(e);
            }}
            onTouchMove={(e) => {
              handleTouchMove(e);
              handleTouchMovePan(e);
            }}
            onTouchEnd={() => setIsDragging(false)}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Floating Control Panel */}
            <div className="position-absolute top-0 end-0 m-3" style={{zIndex: 1000}}>
              <div className="d-flex gap-2">
                <button className="btn btn-primary" onClick={rotateLeft}>↺</button>
                <button className="btn btn-success" onClick={selectedUnits.size > 0 ? computeRouteForSelected : computeRoute}>🎯 Route{selectedUnits.size > 0 ? ` (${selectedUnits.size})` : ''}</button>
                <button className="btn btn-primary" onClick={rotateRight}>↻</button>
              </div>
            </div>
              <div style={{position: 'relative', display: 'inline-block', transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`, transformOrigin: 'center'}}>
                <img 
                  ref={imgRef} 
                  src={IS_DEMO ? map.imageUrl : `${SERVER}${map.imageUrl}`} 
                  className="map-img" 
                  alt="map" 
                  onClick={onMapClick}
                  onError={(e) => console.error('Image failed to load:', e.target.src)}
                  onLoad={() => console.log('Image loaded:', IS_DEMO ? map.imageUrl : `${SERVER}${map.imageUrl}`)}
                />
                {/* overlay SVG */}
                <svg
                  className="svg-overlay"
                  viewBox={`0 0 ${imgRef.current?.naturalWidth || 800} ${imgRef.current?.naturalHeight || 600}`}
                  preserveAspectRatio="xMidYMid meet"
                  style={{pointerEvents: 'none', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%'}}>
                  {/* draw markers */}
                  {units.map((u, idx)=>{
                    const p = pixelPos(u);
                    const img = imgRef.current;
                    const baseSize = Math.min(img?.naturalWidth || 800, img?.naturalHeight || 600);
                    const circleRadius = Math.max(18, baseSize * 0.025);
                    const fontSize = Math.max(10, baseSize * 0.012);
                    const strokeWidth = Math.max(1, baseSize * 0.002);
                    
                    // Check if unit is in input list
                    const inputUnits = inputList.split(',').map(s=>s.trim()).filter(Boolean);
                    const isInInputList = inputUnits.includes(u.unit);
                    
                    // Get unit color state (manual clicking always takes precedence)
                    const unitState = unitStates[u.unit];
                    const isHighlighted = highlightedUnit === u.unit;
                    let fillColor;
                    let circleSize = circleRadius;
                    
                    if (isHighlighted) {
                      fillColor = '#FFD700'; // yellow for highlighted
                      circleSize = circleRadius * 1.5; // increase size
                    } else if (unitState === 'red') {
                      fillColor = '#dc3545'; // red
                    } else if (unitState === 'green') {
                      fillColor = '#28a745'; // green
                    } else if (unitState === 'blue') {
                      fillColor = '#2b8aef'; // blue
                    } else if (isInInputList) {
                      fillColor = '#dc3545'; // red - input list default when no manual state
                    } else {
                      fillColor = '#2b8aef'; // blue (default)
                    }
                    
                    return (
                      <g key={`unit-${idx}`} transform={`translate(${p.x},${p.y})`} style={{cursor: 'pointer', pointerEvents: 'all'}} onClick={(e) => onUnitClick(u.unit, e)} onDoubleClick={(e) => onUnitDoubleClick(u.unit, e)}>
                        <circle r={circleSize} fill={fillColor} stroke="#fff" strokeWidth={strokeWidth} style={{pointerEvents: 'all'}} />
                        <text x={0} y={fontSize * 0.35} textAnchor="middle" fontSize={fontSize} fill="#9932CC" style={{pointerEvents: 'all'}}>{u.unit}</text>
                      </g>
                    )
                  })}

                  {/* draw route polyline */}
                  {route && route.path && (
                    <g>
                      <polyline
                        points={route.path.map(p=>`${p.x * (imgRef.current?.naturalWidth||800)},${p.y * (imgRef.current?.naturalHeight||600)}`).join(' ')}
                        fill="none" stroke="#ff6b6b" strokeWidth={Math.max(3, (Math.min(imgRef.current?.naturalWidth || 800, imgRef.current?.naturalHeight || 600)) * 0.004)} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
                      {route.path.map((p,i)=> {
                        const img = imgRef.current;
                        const baseSize = Math.min(img?.naturalWidth || 800, img?.naturalHeight || 600);
                        const seqRadius = Math.max(6, baseSize * 0.008);
                        const seqFontSize = Math.max(6, baseSize * 0.007);
                        const seqStrokeWidth = Math.max(1, baseSize * 0.001);
                        
                        // Position sequence number slightly offset from unit center
                        const offsetX = p.x * (imgRef.current?.naturalWidth||800) + (baseSize * 0.02);
                        const offsetY = p.y * (imgRef.current?.naturalHeight||600) - (baseSize * 0.02);
                        
                        return (
                          <g key={`seq-${i}`} transform={`translate(${offsetX},${offsetY})`}>
                            <circle r={seqRadius} fill="#ffc107" stroke="#fff" strokeWidth={seqStrokeWidth} />
                            <text x={0} y={seqFontSize * 0.35} textAnchor="middle" fontSize={seqFontSize} fill="#000">{i+1}</text>
                          </g>
                        )
                      })}
                    </g>
                  )}

                </svg>
              </div>
          </div>
        ) : (
          <div className="d-flex align-items-center justify-content-center h-100">
            <div className="text-center">
              <div className="display-1 text-muted mb-3">🗺️</div>
              <h3 className="text-muted">No map loaded</h3>
              <p className="text-muted">Go to Route Planner tab to upload a map</p>
              <button className="btn btn-primary" onClick={() => setActiveTab('main')}>📋 Go to Route Planner</button>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
