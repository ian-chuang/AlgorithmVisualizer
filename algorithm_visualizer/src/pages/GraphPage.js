import "./GraphPage.css";

import { dijkstra, aStarManhattan, aStarDiagonal, aStarEuclidean, depthFirstSearch, breadthFirstSearch, getNodesInShortestPathOrder } from "./graph_components/graphAlgorithms";
import { recursiveDivision, randomMaze, randomWeightedMaze, prims, dfsMaze, binaryTreeMaze, terrainMap } from "./graph_components/mazeAlgorithms";

import { useState, useEffect, useRef } from "react"
import {Node} from './graph_components/Node';

const VISIT_DELAY = 10;
const PATH_DELAY = 40;
const CELL_SIZE = 1.5;
const GRID_HEIGHT = 70;
const pxToNode = px => Math.floor(px / parseFloat(getComputedStyle(document.documentElement).fontSize) / CELL_SIZE);

var prevTimeout = 0;
var mouseButton = -1;
var startRow, startCol, endRow, endCol = null;
var selectedNode = null;
var startCoveredOverNode = null;
var endCoveredOverNode = null;
var currentAlgorithm = null;
  
export const GraphPage = () => {
  const grid = useRef([]).current;
  const gridRef = useRef();
  const [dimensions, setDimensions] = useState(null);

  // INITIALIZATION

  useEffect(() => {
    requestAnimationFrame(() => {
      [startRow, startCol] = [2,2];
      [endRow, endCol] = [grid.length-3, grid[0].length-3];
      resetGrid();
    })
  
    resizeGrid();
    window.addEventListener('resize', resizeGrid);
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    gridRef.current.addEventListener("contextmenu", e => e.preventDefault());
    document.querySelector("#terrainImageInput").addEventListener("change", generateImageTerrain);

    return () => {
      window.removeEventListener('resize', resizeGrid);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      gridRef.current.removeEventListener("contextmenu", e => e.preventDefault());
      document.querySelector("#terrainImageInput").addEventListener("change", generateImageTerrain);
    };
  }, []);


  // IMAGE HANDLING

  const generateImageTerrain = () => {

    // Helper Function to Convert Range
    const convertRange = (val, in_min, in_max, out_min, out_max) => {
      return (val - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
    }
   
    const file = document.querySelector("#terrainImageInput").files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = function (event) {
      
      const imgElement = document.createElement("img");
      imgElement.src = event.target.result;

      imgElement.onload = function (e) {

        // Resize Image to Dimensions of Grid
        const canvas = document.createElement("canvas");
        
        const MAX_WIDTH = grid[0].length;
        const MAX_HEIGHT = grid.length;

        canvas.width = MAX_WIDTH;
        canvas.height = MAX_HEIGHT;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(e.target, 0, 0, canvas.width, canvas.height);


        // Retrieve RGBA pixel values of resized image
        let imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
        let pixels = imgData.data;

        // Convert RGBA to Greyscale Weight (range 2-30)
        const greyscaleWeights = [];
        for (var i = 0; i < pixels.length; i += 4) {
          let lightness = parseInt((pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3);
          greyscaleWeights.push(Math.round(convertRange(lightness,0,255,2,30)));
        }

        // Create Weighted Walls
        const walls = [];
        let idx = 0;
        for (let row = 0; row < grid.length; row++) {
            for (let col = 0; col < grid[0].length; col++) {
                walls.push([row, col, greyscaleWeights[idx++]]);
            }
        }

        // Update Grid with Weighted Walls
        resetGrid();
        for (let i = 0; i < walls.length; i++) {

          const node = grid[walls[i][0]][walls[i][1]];
          let weight = null;
          if (walls[i].length === 3) weight = walls[i][2];

          const delay = 1000 * i / walls.length;
          setTimeout(() => {
            if (
              node.ref.className !== 'node-start' &&
              node.ref.className !== 'node-end'
            ) {
              if (weight) node.ref.className = `node-weight-${weight}`;
              else node.ref.className = 'node-wall';
              animateElement(node.ref, 100, [
                {transform: `scale(1.3)`},
                {transform: 'scale(1)'}
              ]);
            }
          }, delay);

        }

      }}
  }   

  
  // MOUSE HANDLERS

  const handleMouseDown = e => {
    mouseButton = e.button;

    if (!e.target.parentNode.id) return;
    let [name, row, col] = e.target.parentNode.id.split('-');
    
    if (name !== "node") return;

    const node = grid[row][col];

    if (mouseButton === 0) {
      if (node.ref.className === 'node-start') {
        selectedNode = 'node-start';
      }
      else if (node.ref.className === 'node-end') {
        selectedNode = 'node-end';
      }
      else if (node.ref.className === 'node-wall') {
        return;
      }
      else {
        node.ref.className = 'node-wall';
        if (currentAlgorithm) runAlgorithm(null, true);
        else animateElement(node.ref, 100);
      }
    }
    else if (mouseButton === 2) {
      if (node.ref.className === 'node-wall' || node.ref.className.startsWith('node-weight-')) {
        node.ref.className = 'node-empty';
        if (currentAlgorithm) runAlgorithm(null, true);
      }
    }    
  }

  const handleMouseMove = e => {
    if (mouseButton === -1) return;

    if (!e.target.parentNode.id) return;
    let [name, row, col] = e.target.parentNode.id.split('-');

    if (name !== 'node') return;

    const node = grid[row][col];

    if (mouseButton === 0) {
      if (node.ref.className === 'node-start') {
        return;
      }
      else if (node.ref.className === 'node-end') {
        return;
      }
      else {
        if (selectedNode === 'node-start') {
          const prevNode = grid[startRow][startCol];

          if (startCoveredOverNode && (startCoveredOverNode === 'node-wall' || startCoveredOverNode.startsWith('node-weight-'))) prevNode.ref.className = startCoveredOverNode;
          else prevNode.ref.className = 'node-empty';
          startCoveredOverNode = node.ref.className;

          node.ref.className = 'node-start';
          [startRow, startCol] = [row, col];

          if (currentAlgorithm) runAlgorithm(null, true);
          else animateElement(node.ref, 50, [
            {transform: `scale(.75)`},
            {transform: 'scale(1)'}
          ]);
        }
        else if (selectedNode === 'node-end') {
          const prevNode = grid[endRow][endCol];

          if (endCoveredOverNode && (endCoveredOverNode === 'node-wall' || endCoveredOverNode.startsWith('node-weight-'))) prevNode.ref.className = endCoveredOverNode;
          else prevNode.ref.className = 'node-empty';
          endCoveredOverNode = node.ref.className;

          node.ref.className = 'node-end';
          [endRow, endCol] = [row, col];

          if (currentAlgorithm) runAlgorithm(null, true);
          else animateElement(node.ref, 50, [
            {transform: `scale(.75)`},
            {transform: 'scale(1)'}
          ]);
        }
        else if (node.ref.className !== 'node-wall') {
          node.ref.className = 'node-wall';
          if (currentAlgorithm) runAlgorithm(null, true);
          else animateElement(node.ref, 100);
        }
      }
    }
    else if (mouseButton === 2) {
      if (node.ref.className === 'node-wall' || node.ref.className.startsWith('node-weight-')) {
        node.ref.className = 'node-empty';
        if (currentAlgorithm) runAlgorithm(null, true);
      }
    }
  }

  const handleMouseUp = () => {
    mouseButton = -1;
    selectedNode = null;
  }

  //RUNNING ALGORITHMS

  const runAlgorithm = (algorithmFunction = null, noDelay = false) => {
    clearVisualization();

    if (algorithmFunction) currentAlgorithm = algorithmFunction;

    const visitedNodesInOrder = currentAlgorithm(grid, grid[startRow][startCol], grid[endRow][endCol]);
    const nodesInShortestPathOrder = getNodesInShortestPathOrder(grid[endRow][endCol]);

    if (noDelay) {
      for (let i = 0; i < visitedNodesInOrder.length; i++) {
        visitedNodesInOrder[i].ref.childNodes[0].className = 'node-visited';
      }
      for (let i = 0; i < nodesInShortestPathOrder.length; i++) {
        nodesInShortestPathOrder[i].ref.childNodes[0].className = 'node-shortest-path';
      }
    }
    else {
      for (let i = 0; i < visitedNodesInOrder.length; i++) {
        setTimeout(() => {
          const overlay = visitedNodesInOrder[i].ref.childNodes[0];
          overlay.className = 'node-visited';
          animateElement(overlay, 200, [
            {transform: `scale(0)`, borderRadius: '100%'},
            {transform: 'scale(1)', borderRadius: 0}
          ]);
        }, VISIT_DELAY * i);
      }
      setTimeout(() => {
        for (let i = 0; i < nodesInShortestPathOrder.length; i++) {
          setTimeout(() => {
            const overlay = nodesInShortestPathOrder[i].ref.childNodes[0];
            overlay.className = 'node-shortest-path';
            animateElement(overlay, 200);
          }, PATH_DELAY * i);
        }
      }, VISIT_DELAY * visitedNodesInOrder.length)
    }
  }

  const generateMaze = (mazeFunction) => {
    resetGrid();
    const walls = mazeFunction(grid);
    for (let i = 0; i < walls.length; i++) {

      const node = grid[walls[i][0]][walls[i][1]];
      let weight = null;
      if (walls[i].length === 3) weight = walls[i][2];

      const delay = 1000 * i / walls.length;
      setTimeout(() => {
        if (
          node.ref.className !== 'node-start' &&
          node.ref.className !== 'node-end'
        ) {
          if (weight) node.ref.className = `node-weight-${weight}`;
          else node.ref.className = 'node-wall';
          animateElement(node.ref, 100, [
            {transform: `scale(1.3)`},
            {transform: 'scale(1)'}
          ]);
        }
      }, delay);
    }
  } 

  // GRID FUNCTIONS

  const resetGrid = () => {
    startCoveredOverNode = null;
    endCoveredOverNode = null;
    currentAlgorithm = null;
    clearAllTimeouts();

    for (let row=0; row<grid.length; row++) {
      for (let col=0; col<grid[0].length; col++) {
        const node = grid[row][col];
        if ((endRow !== row || endCol !== col) && (startRow !== row || startCol !== col))
          node.ref.className = 'node-empty';
          node.ref.childNodes[0].className = 'node-empty';

        resetNode(node);
      }
    }
    grid[endRow][endCol].ref.className = 'node-end';
    grid[startRow][startCol].ref.className = 'node-start';
  }

  const clearVisualization = (completeStop = false) => {
    if (completeStop) currentAlgorithm = null;
    clearAllTimeouts();

    for (let row=0; row<grid.length; row++) {
      for (let col=0; col<grid[0].length; col++) {
        const node = grid[row][col];
        node.ref.childNodes[0].className = 'node-empty';
        resetNode(node);
      }
    }
  }

  const resizeGrid = () => {
    clearAllTimeouts();

    let rows = pxToNode(gridRef.current.offsetHeight);
    let cols = pxToNode(gridRef.current.offsetWidth);
    
    if (rows > 1 && rows % 2 === 0) rows--;
    if (cols > 1 && cols % 2 === 0) cols--;

    setDimensions({
      rows: rows, 
      cols: cols
    });

    if (startRow && startCol && endRow && endCol) {
      if (startRow > rows - 1) startRow = rows - 1;
      if (startCol > cols - 1) startCol = cols - 1;
      if (endRow > rows - 1) endRow = rows - 1;
      if (endCol > cols - 1) endCol = cols - 1;
      if ((startRow === endRow) && (startCol === endCol))
        startCol -= 1;
      grid[endRow][endCol].ref.className = 'node-end';
      grid[startRow][startCol].ref.className = 'node-start';
    }

    if (currentAlgorithm) runAlgorithm(null, true);
  }

  // NODE FUNCTIONS

  const createNode = (refs, rows, cols) => {
    return {
      ref: refs,
      row: rows,
      col: cols,
      g: Infinity,
      h: Infinity,
      f: Infinity,
      dv: Infinity,
      known: false,
      pv: null
    }
  }

  const animateElement = (element, time, animation = [{transform: `scale(0)`}, {transform: 'scale(1)'}]) => {
    element.animate(animation, {
      duration: time,
      iterations: 1
    });
  }

  const resetNode = (node) => {
    node.dv = Infinity;
    node.known = false;
    node.pv = null;
    node.g = Infinity;
    node.h = Infinity;
    node.f = Infinity;
  }

  // TOOLS

  const clearAllTimeouts = () => {
    const highestTimeoutId = setTimeout(()=>{});
    for (let i = prevTimeout ; i < highestTimeoutId ; i++) {
        clearTimeout(i); 
    }
    prevTimeout = highestTimeoutId;
  }

  // MAKE GRID HTML
 
  const makeGridElement = () => {
    grid.length = 0;

    return (
      <div className="grid d-flex flex-column mb-3" id="grid" ref={gridRef} style={{width: '100%', height: `${GRID_HEIGHT}vh`}}>
        { dimensions &&
          [...Array(dimensions.rows)].map((e1,r) => {
            const currentRow = [];
            const elementRow = (
              <div className="grid-row d-flex flex-row" key={r}>
                {
                  [...Array(dimensions.cols)].map((e2,c) => {
                    return (
                      <Node 
                        ref={ref=>currentRow.push(createNode(ref, r, c))}
                        key={c}
                        row={r}
                        col={c}
                        type={'node-empty'}
                      />
                    );
                  })
                }
              </div>
            );
            grid.push(currentRow);
            return elementRow;
          })
        }
      </div>
    );
  }

  return (
    <div className="graphPage container-fluid">

      {/* Title */}
      <h1 className="my-4"> Graph Algorithms </h1>

      {/* Graph Algorithm Grid */}
      {makeGridElement()}


      {/* Graph Buttons */}
      <div className="mb-3 gap-2 d-flex justify-content-start flex-wrap">
        <button className="btn btn-info" onClick={resetGrid}>Reset Board</button>
        <button className="btn btn-info" onClick={() => {clearVisualization({completeStop: true});}}>Clear Visualization</button>
        <button className="btn btn-outline-light" onClick={()=> {runAlgorithm(dijkstra)}}>Dijkstra</button>
        <button className="btn btn-outline-light" onClick={()=> {runAlgorithm(aStarManhattan)}}>A* (Manhattan)</button>
        <button className="btn btn-outline-light" onClick={()=> {runAlgorithm(aStarDiagonal)}}>A* (Diagonal)</button>
        <button className="btn btn-outline-light" onClick={()=> {runAlgorithm(aStarEuclidean)}}>A* (Euclidean)</button>
        <button className="btn btn-outline-light" onClick={()=> {runAlgorithm(depthFirstSearch)}}>Depth First Search</button>
        <button className="btn btn-outline-light" onClick={()=> {runAlgorithm(breadthFirstSearch)}}>Breadth First Search</button>
        <button className="btn btn-outline-light" onClick={() => {generateMaze(recursiveDivision)}}>Recursive Maze</button>
        <button className="btn btn-outline-light" onClick={() => {generateMaze(prims)}}>Prims Maze</button>
        <button className="btn btn-outline-light" onClick={() => {generateMaze(dfsMaze)}}>DFS Maze</button>
        <button className="btn btn-outline-light" onClick={() => {generateMaze(binaryTreeMaze)}}>Binary Tree Maze</button>
        <button className="btn btn-outline-light" onClick={() => {generateMaze(randomMaze)}}>Random Maze</button>
        <button className="btn btn-outline-light" onClick={() => {generateMaze(randomWeightedMaze)}}>Random Weighted Maze</button>
        <button className="btn btn-outline-light" onClick={() => {generateMaze(terrainMap)}}>Terrain Map</button>
      </div>

      <input type="file" id="terrainImageInput" accept=".jpg, .jpeg, .png"/>
      <div>
        <img id="input" />
      </div>
      <div>
        <img id="output" />
      </div>

    </div>
  );

  
}