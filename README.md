# OpenDRIVE Road Network Processor

A comprehensive tool for parsing, visualizing, and route planning on OpenDRIVE HD maps. Built with C++ for performance-critical parsing and Python/React for flexibility and modern UI.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      React Frontend                         │
│  ┌─────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────┐  │
│  │Dashboard│ │Map Viewer│ │Route Plan  │ │Traffic Signs │  │
│  └────┬────┘ └────┬─────┘ └─────┬──────┘ └──────┬───────┘  │
│       └───────────┴─────────────┴───────────────┘           │
│                           │ REST API                        │
├───────────────────────────┼─────────────────────────────────┤
│                    FastAPI Backend                          │
│  ┌────────────────────────┴────────────────────────┐        │
│  │              Python API Layer                    │        │
│  └────────────────────────┬────────────────────────┘        │
│                           │ pybind11                        │
├───────────────────────────┼─────────────────────────────────┤
│                    C++ Core Library                         │
│  ┌──────────┐ ┌───────────┐ ┌──────────────────────┐       │
│  │  Parser  │ │ Geometry  │ │   Route Planner      │       │
│  │  (XML)   │ │Calculator │ │  (Dijkstra/A*)       │       │
│  └──────────┘ └───────────┘ └──────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## Features

### C++ Core Library
- **OpenDRIVE Parser**: Full support for OpenDRIVE 1.4-1.6 format
  - Road geometry (line, arc, spiral/clothoid, polynomial)
  - Lane sections and widths
  - Traffic signals and signs
  - Junctions and connections
- **Geometry Calculator**: Accurate road geometry computation
  - Fresnel integrals for clothoid curves
  - Lane boundary and center line sampling
- **Route Planner**: Efficient pathfinding algorithms
  - Dijkstra's algorithm for shortest path
  - A* with Euclidean heuristic
  - Scenario route generation

### Python Backend
- FastAPI REST API
- Map upload and management
- Route planning endpoints
- Pure Python fallback parser (no C++ required)

### React Frontend
- Interactive map visualization
- Road and lane geometry display
- Traffic sign overlay
- Route planning interface
- Map statistics and analysis

## Prerequisites

### C++ Build
- CMake 3.15+
- C++17 compiler (GCC 8+, Clang 7+)
- TinyXML2 library
- pybind11 (for Python bindings)

### Python
- Python 3.9+
- pip

### Frontend
- Node.js 18+
- npm or bun

## Installation

### 1. Build C++ Library

```bash
cd backend/cpp

# Install dependencies (Ubuntu/Debian)
sudo apt install libtinyxml2-dev python3-pybind11

# Build
mkdir build && cd build
cmake .. -DBUILD_PYTHON_BINDINGS=ON
make -j$(nproc)

# Install Python module
sudo make install
# Or for local install:
pip install .
```

### 2. Install Python Backend

```bash
cd backend
pip install -r requirements.txt
```

### 3. Install Frontend

```bash
cd frontend
npm install
```

## Running

### Start Backend

```bash
cd backend/python
python api.py
# API runs on http://localhost:8000
```

### Start Frontend

```bash
cd frontend
npm run dev
# UI runs on http://localhost:8080
```

### CLI Tool

```bash
# After building C++
./build/opendrive_cli parse sample.xodr
./build/opendrive_cli validate sample.xodr
./build/opendrive_cli export sample.xodr > roads.csv
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/maps` | List all maps |
| POST | `/maps/upload` | Upload .xodr file |
| GET | `/maps/{id}` | Get map info |
| DELETE | `/maps/{id}` | Delete map |
| GET | `/maps/{id}/roads` | Get road geometry |
| GET | `/maps/{id}/signals` | Get traffic signals |
| GET | `/maps/{id}/junctions` | Get junctions |
| POST | `/maps/{id}/route` | Plan route |

## Project Structure

```
OpenDRIVE Road Network Processor/
├── backend/
│   ├── cpp/
│   │   ├── include/opendrive/    # C++ headers
│   │   ├── src/                  # C++ implementation
│   │   ├── bindings/             # pybind11 bindings
│   │   └── CMakeLists.txt
│   ├── python/
│   │   └── api.py                # FastAPI backend
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/           # React components
│   │   ├── pages/                # Page components
│   │   ├── hooks/                # API hooks
│   │   └── types/                # TypeScript types
│   └── package.json
├── data/
│   └── maps/                     # Uploaded .xodr files
├── samples/                      # Sample OpenDRIVE files
└── README.md
```

## OpenDRIVE Format

OpenDRIVE is an open standard for logical road network descriptions. Key elements:

- **Roads**: Define the road topology with reference line geometry
- **Lanes**: Describe lane layout within each road
- **Junctions**: Connect multiple roads
- **Signals**: Traffic signs, lights, and markings

### Supported Geometry Types

| Type | Description |
|------|-------------|
| Line | Straight segment |
| Arc | Constant curvature |
| Spiral | Clothoid (linearly varying curvature) |
| Poly3 | Cubic polynomial |
| ParamPoly3 | Parametric cubic polynomial |

## Development

### Adding New Features

1. Implement in C++ core (`backend/cpp/src/`)
2. Add pybind11 bindings (`backend/cpp/bindings/`)
3. Expose via FastAPI (`backend/python/api.py`)
4. Add React hooks (`frontend/src/hooks/`)
5. Build UI components (`frontend/src/components/`)

### Testing

```bash
# C++ tests
cd backend/cpp/build
ctest

# Python tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

## License

MIT License

## References

- [OpenDRIVE Specification](https://www.asam.net/standards/detail/opendrive/)
- [ASAM OpenDRIVE](https://www.asam.net/standards/detail/opendrive/)
